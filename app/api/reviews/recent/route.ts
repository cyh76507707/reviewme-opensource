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

export interface Review {
  reviewer: `0x${string}`;
  reviewee: `0x${string}`;
  content: string;
  emoji: number;
  timestamp: bigint;
  reviewId?: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // Create public client per request (better for serverless environments)
    const publicClient = createPublicClient({
      chain: base,
      transport: _getTransport(BASE_RPC_ENDPOINTS),
    });

    const [reviews, reviewIds] = (await publicClient.readContract({
      address: REVIEWME_CONTRACT_ADDRESS,
      abi: REVIEWME_ABI,
      functionName: "getRecentReviews",
      args: [BigInt(offset), BigInt(limit)],
    })) as [any[], bigint[]];

    // Convert BigInt to string for JSON serialization
    const formattedReviews = reviews.map((r, index) => ({
      reviewer: r.reviewer,
      reviewee: r.reviewee,
      content: r.content,
      emoji: Number(r.emoji),
      timestamp: r.timestamp.toString(), // Convert BigInt to string
      reviewId: Number(reviewIds[index]),
    }));

    return NextResponse.json(formattedReviews, {
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
      },
    });
  } catch (error: any) {
    console.error("Failed to get recent reviews:", error);
    const errorMessage =
      error?.message || error?.toString() || "Failed to fetch recent reviews";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
