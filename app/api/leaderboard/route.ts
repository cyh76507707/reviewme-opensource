import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, fallback } from "viem";
import { base } from "viem/chains";
import { BASE_RPC_ENDPOINTS } from "@/lib/reviewme-contract";

function _getTransport(rpcEndpoints: readonly string[]) {
  return fallback(
    rpcEndpoints.map((url) =>
      http(url, {
        timeout: 2_000,
        retryCount: 0,
      })
    ),
    { rank: false }
  );
}

const REVIEWME_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_REVIEWME_CONTRACT_ADDRESS as `0x${string}`) ||
  "0x5BfC8705cF877776e461e27FAcB51D8C2bDd00c7";

const REVIEWME_ABI = [
  {
    type: "function",
    name: "getRecentReviews",
    stateMutability: "view",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "reviewer", type: "address" },
          { name: "reviewee", type: "address" },
          { name: "content", type: "string" },
          { name: "emoji", type: "uint8" },
          { name: "timestamp", type: "uint256" },
        ],
      },
      { name: "reviewIds", type: "uint256[]" },
    ],
  },
] as const;

export interface LeaderboardEntry {
  address: string;
  count: number;
}

export interface LeaderboardData {
  topReviewers: LeaderboardEntry[];
  topReviewees: LeaderboardEntry[];
  lastUpdated: number;
}

// Server-side memory cache (10 minutes)
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
let leaderboardCache: LeaderboardData | null = null;
let cacheTimestamp = 0;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const forceRefresh = searchParams.get("forceRefresh") === "true";

    // Return cached data if still valid
    if (
      !forceRefresh &&
      leaderboardCache &&
      Date.now() - cacheTimestamp < CACHE_DURATION
    ) {
      console.log("[API] Returning cached leaderboard data");
      return NextResponse.json(leaderboardCache, {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300",
        },
      });
    }

    console.log("[API] Fetching fresh leaderboard data...");

    // Create public client
    const publicClient = createPublicClient({
      chain: base,
      transport: _getTransport(BASE_RPC_ENDPOINTS),
    });

    // Fetch recent 5000 reviews in parallel batches of 500
    const BATCH_SIZE = 500;
    const TOTAL_FETCH = 5000;
    const batchCount = Math.ceil(TOTAL_FETCH / BATCH_SIZE);

    const batchPromises = Array.from({ length: batchCount }, (_, i) => {
      const offset = BigInt(i * BATCH_SIZE);
      return publicClient.readContract({
        address: REVIEWME_CONTRACT_ADDRESS,
        abi: REVIEWME_ABI,
        functionName: "getRecentReviews",
        args: [offset, BigInt(BATCH_SIZE)],
      }) as Promise<[any[], bigint[]]>;
    });

    const results = await Promise.all(batchPromises);
    const reviews = results.flatMap(([batchReviews]) => batchReviews);

    // Aggregate counts
    const reviewerCounts = new Map<string, number>();
    const revieweeCounts = new Map<string, number>();

    reviews.forEach((review: any) => {
      // Count reviews written
      const reviewerAddr = review.reviewer.toLowerCase();
      reviewerCounts.set(
        reviewerAddr,
        (reviewerCounts.get(reviewerAddr) || 0) + 1
      );

      // Count reviews received
      const revieweeAddr = review.reviewee.toLowerCase();
      revieweeCounts.set(
        revieweeAddr,
        (revieweeCounts.get(revieweeAddr) || 0) + 1
      );
    });

    // Sort and get top 10
    const topReviewers = [...reviewerCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([address, count]) => ({ address, count }));

    const topReviewees = [...revieweeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([address, count]) => ({ address, count }));

    // Create result
    const result: LeaderboardData = {
      topReviewers,
      topReviewees,
      lastUpdated: Date.now(),
    };

    // Update cache
    leaderboardCache = result;
    cacheTimestamp = Date.now();

    console.log("[API] Leaderboard data updated:", {
      reviewers: topReviewers.length,
      reviewees: topReviewees.length,
      totalReviews: reviews.length,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300",
      },
    });
  } catch (error: any) {
    console.error("[API] Failed to fetch leaderboard data:", error);

    // Return cached data if available, even if expired
    if (leaderboardCache) {
      console.log("[API] Returning stale cache due to error");
      return NextResponse.json(leaderboardCache, {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300",
        },
      });
    }

    // Return empty data if no cache
    const emptyResult: LeaderboardData = {
      topReviewers: [],
      topReviewees: [],
      lastUpdated: 0,
    };

    return NextResponse.json(emptyResult, { status: 500 });
  }
}
