import { notFound } from "next/navigation";
import { Metadata } from "next";
import { formatAddress } from "@/lib/neynar";
import { getProfilesByAddresses } from "@/lib/neynar-server";
import {
  publicClient,
  REVIEWME_CONTRACT_ADDRESS,
  REVIEWME_ABI,
  type Review,
} from "@/lib/reviewme-contract";
import { cache } from "react";
import { ReviewDetailContent } from "@/components/ReviewDetailContent";
import { constructMetadata } from "@/lib/metadata";

const fetchReviewDetail = cache(
  async (reviewId: number): Promise<Review | null> => {
    try {
      // Direct RPC call to avoid "fetch self" issues in production
      // This runs on the server during metadata generation
      const reviewData = (await publicClient.readContract({
        address: REVIEWME_CONTRACT_ADDRESS,
        abi: REVIEWME_ABI,
        functionName: "reviews",
        args: [BigInt(reviewId)],
      })) as any;

      const reviewer = reviewData.reviewer || reviewData[0];

      // Check if review exists (valid reviewer address)
      if (
        !reviewer ||
        reviewer === "0x0000000000000000000000000000000000000000"
      ) {
        return null;
      }

      return {
        reviewer: reviewData.reviewer || reviewData[0],
        reviewee: reviewData.reviewee || reviewData[1],
        content: reviewData.content || reviewData[2],
        emoji: Number(reviewData.emoji || reviewData[3] || 0),
        timestamp: reviewData.timestamp || reviewData[4] || 0n,
        reviewId: reviewId,
      };
    } catch (error) {
      // Timeout or error - return null for graceful degradation
      // Client-side will handle data fetching with proper retry logic
      console.error("Failed to fetch review detail (SEO metadata):", error);
      return null;
    }
  }
);

export async function generateMetadata({
  params,
}: {
  params: { reviewId: string };
}): Promise<Metadata> {
  const reviewId = parseInt(params.reviewId, 10);

  // Try to fetch review data for SEO, but don't fail if it's a new review
  // New reviews will be handled client-side with proper retry logic
  try {
    const review = await fetchReviewDetail(reviewId);

    if (!review) {
      // Return basic metadata for new/unfound reviews
      return constructMetadata({
        title: `Review #${reviewId} | ReviewMe`,
      });
    }

    const profiles = await getProfilesByAddresses([
      review.reviewer,
      review.reviewee,
    ]);
    const reviewerProfile = profiles[review.reviewer.toLowerCase()];
    const revieweeProfile = profiles[review.reviewee.toLowerCase()];

    const reviewerName =
      reviewerProfile?.displayName || formatAddress(review.reviewer);
    const revieweeName =
      revieweeProfile?.displayName || formatAddress(review.reviewee);

    const description = `${reviewerName} reviewed ${revieweeName}: "${review.content.substring(
      0,
      150
    )}${review.content.length > 150 ? "..." : ""}"`;

    return constructMetadata({
      title: `Review #${reviewId} by ${reviewerName}`,
      description,
      path: `/review/${reviewId}`,
      imageUrl: revieweeProfile?.pfp?.url,
    });
  } catch (error) {
    console.error("Failed to generate metadata for review:", error);
    // Return basic metadata if fetch fails (e.g., for newly created reviews)
    return constructMetadata({
      title: `Review #${reviewId} | ReviewMe`,
    });
  }
}

export default async function ReviewDetailPage({
  params,
}: {
  params: { reviewId: string };
}) {
  const reviewId = parseInt(params.reviewId, 10);

  if (isNaN(reviewId) || reviewId < 0) {
    notFound();
  }

  // For newly created reviews, we don't fetch on server to avoid RPC overload
  // Client component will handle all data fetching with caching and retry logic
  // SEO metadata is still generated in generateMetadata() for existing reviews
  return <ReviewDetailContent reviewId={reviewId} initialReview={undefined} />;
}
