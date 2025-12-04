import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, fallback, parseAbiItem } from "viem";
import { base } from "viem/chains";
import { BASE_RPC_ENDPOINTS } from "@/lib/reviewme-contract";

function _getTransport(rpcEndpoints: readonly string[]) {
  return fallback(
    rpcEndpoints.map((url) =>
      http(url, {
        timeout: 2_000, // Reduced timeout: 5 seconds (getLogs is heavy)
        retryCount: 0, // Reduced retries: 1 retry (faster failure)
      })
    ),
    { rank: false } // Sequential fallback
  );
}

const REVIEWME_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_REVIEWME_CONTRACT_ADDRESS as `0x${string}`) ||
  "0x5BfC8705cF877776e461e27FAcB51D8C2bDd00c7";

// ReviewSubmitted event signature
const REVIEW_SUBMITTED_EVENT = parseAbiItem(
  "event ReviewSubmitted(uint256 indexed reviewId, address indexed reviewer, address indexed reviewee, string content, uint8 emoji, uint256 timestamp)"
);

// Cache for tx hashes (in-memory, per serverless instance)
const txHashCache = new Map<number, string>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps = new Map<number, number>();

/**
 * Get transaction hashes for multiple review IDs in batch
 * Only scans recent blocks (last 7 days ~ 300,000 blocks) to minimize RPC calls
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reviewIds }: { reviewIds: number[] } = body;

    if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
      return NextResponse.json(
        { error: "reviewIds array is required" },
        { status: 400 }
      );
    }

    // Create public client per request
    const publicClient = createPublicClient({
      chain: base,
      transport: _getTransport(BASE_RPC_ENDPOINTS),
    });

    // Check cache first
    const now = Date.now();
    const cachedResults: Record<number, string> = {};
    const uncachedIds: number[] = [];

    for (const reviewId of reviewIds) {
      const cached = txHashCache.get(reviewId);
      const timestamp = cacheTimestamps.get(reviewId);

      if (cached && timestamp && now - timestamp < CACHE_DURATION) {
        cachedResults[reviewId] = cached;
      } else {
        uncachedIds.push(reviewId);
      }
    }

    // If all are cached, return immediately
    if (uncachedIds.length === 0) {
      return NextResponse.json(
        { txHashes: cachedResults },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        }
      );
    }

    // Get current block number
    const currentBlock = await publicClient.getBlockNumber();

    // Scan last 7 days (~300,000 blocks at ~2s per block)
    // Base block time is ~2 seconds, so 7 days = 7 * 24 * 60 * 60 / 2 = 302,400 blocks
    const BLOCKS_PER_7_DAYS = 300_000n;
    const fromBlock =
      currentBlock > BLOCKS_PER_7_DAYS ? currentBlock - BLOCKS_PER_7_DAYS : 0n;

    console.log(
      `[tx-hashes] Fetching events for ${uncachedIds.length} reviewIds from block ${fromBlock} to ${currentBlock}`
    );

    // Fetch ReviewSubmitted events in batch
    // Get all events and filter by reviewId (more efficient than multiple queries)
    const logs = await publicClient.getLogs({
      address: REVIEWME_CONTRACT_ADDRESS,
      event: REVIEW_SUBMITTED_EVENT,
      fromBlock,
      toBlock: currentBlock,
    });

    console.log(`[tx-hashes] Found ${logs.length} ReviewSubmitted events`);

    // Map events to reviewId -> txHash
    const txHashes: Record<number, string> = { ...cachedResults };

    for (const log of logs) {
      if (log.args.reviewId !== undefined) {
        const reviewId = Number(log.args.reviewId);
        if (uncachedIds.includes(reviewId)) {
          txHashes[reviewId] = log.transactionHash;
          // Update cache
          txHashCache.set(reviewId, log.transactionHash);
          cacheTimestamps.set(reviewId, now);
        }
      }
    }

    // For reviewIds not found in events, cache null to avoid repeated lookups
    for (const reviewId of uncachedIds) {
      if (!txHashes[reviewId]) {
        // Don't cache null - allow retry in case event is in older blocks
        console.warn(
          `[tx-hashes] ReviewId ${reviewId} not found in recent events`
        );
      }
    }

    return NextResponse.json(
      { txHashes },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error: any) {
    console.error("Failed to get tx hashes:", error);
    const errorMessage =
      error?.message ||
      error?.toString() ||
      "Failed to fetch transaction hashes";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
