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
    name: "reviews",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "reviewer", type: "address" },
      { name: "reviewee", type: "address" },
      { name: "content", type: "string" },
      { name: "emoji", type: "uint8" },
      { name: "timestamp", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "totalReviews",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ReviewSubmitted event signature
const transport = _getTransport(BASE_RPC_ENDPOINTS);
const publicClient = createPublicClient({
  chain: base,
  transport,
});

export interface ReviewDetail {
  reviewer: `0x${string}`;
  reviewee: `0x${string}`;
  content: string;
  emoji: number;
  timestamp: bigint;
  reviewId: number;
}

/**
 * Get a single review by reviewId with txHash
 * Server-side API route for review detail pages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { reviewId: string } }
) {
  try {
    const reviewId = parseInt(params.reviewId, 10);

    if (isNaN(reviewId) || reviewId < 0) {
      return NextResponse.json({ error: "Invalid reviewId" }, { status: 400 });
    }

    // Check total reviews first
    const totalReviews = (await publicClient.readContract({
      address: REVIEWME_CONTRACT_ADDRESS,
      abi: REVIEWME_ABI,
      functionName: "totalReviews",
    })) as bigint;

    if (reviewId >= Number(totalReviews)) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Fetch review data with retry logic for newly created reviews
    let reviewData: any;
    let retries = 0;
    const maxRetries = 3;
    const retryDelays = [1000, 2000, 4000]; // 1s, 2s, 4s

    while (retries <= maxRetries) {
      reviewData = (await publicClient.readContract({
        address: REVIEWME_CONTRACT_ADDRESS,
        abi: REVIEWME_ABI,
        functionName: "reviews",
        args: [BigInt(reviewId)],
      })) as any;

      const reviewer = reviewData.reviewer || reviewData[0];
      const content = reviewData.content || reviewData[2];

      // Check if review data is valid (not empty/zero address)
      if (
        reviewer &&
        reviewer !== "0x0000000000000000000000000000000000000000" &&
        content &&
        content !== ""
      ) {
        break; // Data is valid, exit retry loop
      }

      // If we've exhausted retries, fail
      if (retries === maxRetries) {
        console.error(
          `Review ${reviewId} data is empty after ${maxRetries} retries - RPC not synced yet`
        );
        return NextResponse.json(
          {
            error:
              "Review not yet available - RPC syncing. Please try again in a few seconds.",
          },
          { status: 404 }
        );
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, retryDelays[retries]));
      retries++;
      console.log(`Retry ${retries}/${maxRetries} for review ${reviewId}`);
    }

    if (!reviewData) {
      return NextResponse.json(
        { error: "Review data not found" },
        { status: 404 }
      );
    }

    const reviewDetail = {
      reviewer: reviewData.reviewer || reviewData[0],
      reviewee: reviewData.reviewee || reviewData[1],
      content: reviewData.content || reviewData[2],
      emoji: Number(reviewData.emoji || reviewData[3] || 0),
      timestamp: (reviewData.timestamp || reviewData[4] || 0n).toString(), // Convert BigInt to string for JSON serialization
      reviewId,
    };

    return NextResponse.json(reviewDetail, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error: any) {
    console.error("Failed to get review detail:", error);
    const errorMessage =
      error?.message || error?.toString() || "Failed to fetch review detail";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
