"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Heart, Copy, Check } from "lucide-react";
import Link from "next/link";
import {
  formatAddress,
  getDefaultAvatar,
  getPrimaryWallet,
} from "@/lib/neynar";
import { ReviewCard } from "@/components/ReviewCard";
import { useReviewsForWallet } from "@/lib/hooks/useReview";
import { useProfile, useProfiles } from "@/lib/hooks/useNeynar";
import { getRatingDistribution } from "@/lib/stats";
import { sdk } from "@farcaster/miniapp-sdk";

// Farcaster Logo SVG - Official Farcaster symbol
const FarcasterLogo = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 1080 1080"
    fill="none"
    className="w-5 h-5"
  >
    <path
      d="M847.387 270V343.023H774.425V415.985H796.779V416.01H847.387V810.795H725.173L725.099 810.434L662.737 515.101C656.791 486.949 641.232 461.477 618.927 443.362C596.623 425.248 568.527 415.275 539.818 415.275H539.575C510.866 415.275 482.77 425.248 460.466 443.362C438.161 461.477 422.602 486.958 416.657 515.101L354.223 810.795H232V416.001H282.608V415.985H304.959V343.023H232V270H847.387Z"
      fill="currentColor"
    />
  </svg>
);

interface UserProfilePageContentProps {
  address: string;
}

export default function UserProfilePageContent({
  address,
}: UserProfilePageContentProps) {
  const router = useRouter();
  const [selectedEmoji, setSelectedEmoji] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Use client-side RPC hook with caching
  // Falls back to API route if NEXT_PUBLIC_USE_CLIENT_RPC=false
  const {
    data: reviewsData = [],
    isLoading,
    error: queryError,
  } = useReviewsForWallet(address as `0x${string}`);

  // Sort reviews by timestamp (newest first) and filter by emoji
  const reviews = useMemo(() => {
    let filtered = [...reviewsData];

    // Filter by selected emoji if any
    if (selectedEmoji !== null) {
      filtered = filtered.filter((review) => review.emoji === selectedEmoji);
    }

    // Sort by timestamp (newest first)
    return filtered.sort((a, b) => {
      const timestampA =
        typeof a.timestamp === "bigint" ? Number(a.timestamp) : a.timestamp;
      const timestampB =
        typeof b.timestamp === "bigint" ? Number(b.timestamp) : b.timestamp;
      return timestampB - timestampA;
    });
  }, [reviewsData, selectedEmoji]);

  const loading = isLoading;
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "Failed to load reviews"
    : "";

  // Fetch profile for the page owner
  const { data: profile = null } = useProfile(address);

  // Extract unique addresses from reviews (excluding the profile owner)
  const reviewAddresses = useMemo(() => {
    const addressSet = new Set<string>();
    reviews.forEach((review) => {
      if (review.reviewer.toLowerCase() !== address.toLowerCase()) {
        addressSet.add(review.reviewer.toLowerCase());
      }
      if (review.reviewee.toLowerCase() !== address.toLowerCase()) {
        addressSet.add(review.reviewee.toLowerCase());
      }
    });
    return Array.from(addressSet);
  }, [reviews, address]);

  // Use React Query hook for profile fetching with automatic caching and deduplication
  const { data: profiles = {} } = useProfiles(reviewAddresses);

  // Detect platform (Farcaster vs Base)
  const getProfileUrl = () => {
    if (!profile) return "#";

    if (typeof window === "undefined") {
      // SSR: default to Farcaster
      return `https://farcaster.xyz/${profile.username}`;
    }

    // Check if running in Base app
    // Base app can be detected by:
    // 1. URL parameter ?platform=base (most reliable)
    // 2. User agent containing "Base"
    // 3. Referrer from base.app
    // 4. Hostname includes base.app
    const urlParams = new URLSearchParams(window.location.search);
    const isBaseFromParam = urlParams.get("platform") === "base";

    const isBaseApp =
      isBaseFromParam ||
      window.navigator.userAgent.includes("Base") ||
      window.location.hostname.includes("base.app") ||
      (document.referrer && document.referrer.includes("base.app"));

    if (isBaseApp) {
      // Base app: use base.app/profile/{address}
      return `https://base.app/profile/${address}`;
    } else {
      // Farcaster app: use farcaster.xyz/{username}
      return `https://farcaster.xyz/${profile.username}`;
    }
  };

  const ratingDistribution = getRatingDistribution(
    reviews.map((r) => ({ emoji: r.emoji } as any))
  );

  const EMOJI_MAP: Record<number, string> = {
    5: "❤️",
    4: "🔥",
    3: "💎",
    2: "🤝",
    1: "🤔",
  };

  const EMOJI_LABELS: Record<number, string> = {
    5: "Love",
    4: "Amazing",
    3: "Valuable",
    2: "Respect",
    1: "Reflective",
  };

  const maxCount = Math.max(...Object.values(ratingDistribution), 1);

  // Handle copy profile link
  const handleCopyProfileLink = async () => {
    try {
      // Generate profile URL
      const profileUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/user/${address}`
          : `https://reviewme.fun/user/${address}`;

      // Copy to clipboard
      await navigator.clipboard.writeText(profileUrl);

      // Show feedback
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy profile link:", error);
      // Fallback: try using execCommand
      try {
        const textArea = document.createElement("textarea");
        textArea.value =
          typeof window !== "undefined"
            ? `${window.location.origin}/user/${address}`
            : `https://reviewme.fun/user/${address}`;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      } catch (fallbackError) {
        console.error("Fallback copy failed:", fallbackError);
      }
    }
  };

  // Handle share profile
  const handleShareProfile = async () => {
    try {
      // Get review count
      const reviewCount = reviewsData.length;

      // Get username for message
      const username = profile?.username || formatAddress(address);

      // Generate profile URL
      const profileUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/user/${address}`
          : `https://reviewme.fun/user/${address}`;

      // Create share message
      const shareText = `@${username} has ${reviewCount} onchain review${
        reviewCount !== 1 ? "s" : ""
      } on ReviewMe`;

      // Use composeCast SDK action for native mini app experience
      const result = await sdk.actions.composeCast({
        text: shareText,
        embeds: [profileUrl.trim()] as [string],
      });

      // Optional: Handle the result
      if (result?.cast) {
        console.log("Profile shared successfully:", result.cast.hash);
      } else {
        console.log("Cast composition cancelled");
      }
    } catch (error) {
      console.error("Failed to share profile:", error);
      // Fallback: copy URL to clipboard
      try {
        const profileUrl =
          typeof window !== "undefined"
            ? `${window.location.origin}/user/${address}`
            : `https://reviewme.fun/user/${address}`;
        await navigator.clipboard.writeText(profileUrl);
        alert("Profile URL copied to clipboard");
      } catch (clipboardError) {
        console.error("Failed to copy URL:", clipboardError);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 pb-24 md:pb-8">
      {/* Back Button */}
      <div className="px-6 pt-6">
        <Button
          onClick={() => router.back()}
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 sm:px-6 pt-6 pb-8"
      >
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-gray-700/50 max-w-3xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
            {/* Profile Image */}
            <img
              src={profile?.pfp?.url || getDefaultAvatar(address)}
              alt={profile?.displayName || formatAddress(address)}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-gray-700 flex-shrink-0 mx-auto sm:mx-0"
            />

            {/* Profile Info */}
            <div className="flex-1 w-full text-center sm:text-left">
              <h1 className="text-white text-xl sm:text-2xl font-bold mb-1">
                {profile?.displayName || formatAddress(address)}
              </h1>
              {profile && (
                <a
                  href={getProfileUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 text-sm mb-2 hover:text-pink-400 transition-colors inline-block"
                >
                  @{profile.username}
                </a>
              )}
              <p className="text-gray-500 text-xs mb-4 font-mono break-all">
                {profile
                  ? formatAddress(getPrimaryWallet(profile) || address)
                  : formatAddress(address)}
              </p>

              {profile?.bio && (
                <p className="text-gray-300 text-sm mb-4">{profile.bio}</p>
              )}

              {/* Stats */}
              <div className="flex items-center justify-center sm:justify-start gap-4 sm:gap-6 flex-wrap">
                <div>
                  <div className="text-white text-xl sm:text-2xl font-bold">
                    {reviews.length}
                  </div>
                  <div className="text-gray-400 text-xs">Reviews</div>
                </div>
                {profile && (
                  <>
                    <div>
                      <div className="text-white text-xl sm:text-2xl font-bold">
                        {profile.followerCount}
                      </div>
                      <div className="text-gray-400 text-xs">Followers</div>
                    </div>
                    <div>
                      <div className="text-white text-xl sm:text-2xl font-bold">
                        {profile.followingCount}
                      </div>
                      <div className="text-gray-400 text-xs">Following</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto">
                <Link
                  href={`/review/create?reviewee=${encodeURIComponent(
                    address
                  )}`}
                  className="flex-1 sm:flex-none"
                >
                  <Button className="w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white rounded-xl h-12">
                    <Heart className="w-4 h-4 mr-2" />
                    Write Review
                  </Button>
                </Link>
                <Button
                  onClick={handleShareProfile}
                  variant="outline"
                  className="w-full rounded-xl h-12"
                >
                  <FarcasterLogo />
                  <span className="ml-2">Share Profile</span>
                </Button>
              </div>
              {/* Copy Profile Link */}
              <button
                onClick={handleCopyProfileLink}
                className="text-gray-400 text-sm hover:text-pink-400 transition-colors text-center sm:text-left flex items-center justify-center sm:justify-start gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Profile Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Emotional Overview Section */}
      {reviews.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 sm:px-6 pb-6"
        >
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-gray-700/50 max-w-3xl mx-auto">
            <h3 className="text-white text-lg font-semibold mb-4 text-center sm:text-left">
              Emotional Overview
            </h3>

            {/* Bar Chart */}
            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map((emojiValue) => {
                const count = ratingDistribution[emojiValue] || 0;
                const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;

                return (
                  <div key={emojiValue} className="flex items-center gap-3">
                    {/* Label */}
                    <div className="flex items-center gap-2 min-w-[140px] sm:min-w-[160px]">
                      <span className="text-sm sm:text-base text-gray-300 font-medium">
                        {EMOJI_LABELS[emojiValue]}
                      </span>
                      <span className="text-lg sm:text-xl">
                        {EMOJI_MAP[emojiValue]}
                      </span>
                    </div>

                    {/* Bar */}
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 h-6 sm:h-7 bg-gray-700/50 rounded-full overflow-hidden relative">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{
                            duration: 0.8,
                            ease: "easeOut",
                            delay: emojiValue * 0.1,
                          }}
                          className="h-full bg-gradient-to-r from-pink-500 to-pink-600 rounded-full"
                        />
                      </div>

                      {/* Count */}
                      <span className="text-white text-sm sm:text-base font-semibold min-w-[30px] text-right">
                        {count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Reviews Section */}
      <div className="px-4 sm:px-6 space-y-3 max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
          <h2 className="text-gray-400 text-sm px-1">
            Reviews for {profile?.displayName || formatAddress(address)}
          </h2>
          {/* Emoji Filter Buttons */}
          {reviewsData.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => setSelectedEmoji(null)}
                className={`px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                  selectedEmoji === null
                    ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                    : "bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:bg-gray-800 hover:text-gray-300"
                }`}
              >
                All
              </button>
              {[5, 4, 3, 2, 1].map((emojiValue) => (
                <button
                  key={emojiValue}
                  onClick={() =>
                    setSelectedEmoji(
                      selectedEmoji === emojiValue ? null : emojiValue
                    )
                  }
                  className={`px-2.5 py-1.5 text-sm rounded-lg transition-colors ${
                    selectedEmoji === emojiValue
                      ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                      : "bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:bg-gray-800 hover:text-gray-300"
                  }`}
                >
                  {EMOJI_MAP[emojiValue]}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          // Loading Skeletons
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-8 w-16 mb-3" />
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          // Error State
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-500/10 backdrop-blur-sm rounded-2xl p-8 text-center border border-red-500/20"
          >
            <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Heart className="h-8 w-8 text-red-400" />
            </div>
            <h3 className="text-white text-lg font-semibold mb-2">
              Failed to Load Reviews
            </h3>
            <p className="text-gray-400 text-sm mb-4">{error}</p>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
            >
              Try Again
            </Button>
          </motion.div>
        ) : reviews.length === 0 ? (
          // Empty State (no reviews or filtered out)
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-12 text-center border border-gray-700/50"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-pink-500/20 to-pink-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Heart className="h-10 w-10 text-pink-400" />
            </div>
            <h3 className="text-white text-xl font-semibold mb-3">
              {selectedEmoji !== null
                ? "No reviews with this emoji"
                : "No reviews yet"}
            </h3>
            <p className="text-gray-400 mb-6">
              {selectedEmoji !== null
                ? `Try selecting a different emoji filter.`
                : `Be the first to review ${
                    profile?.displayName || "this user"
                  }!`}
            </p>
            {selectedEmoji !== null ? (
              <Button
                onClick={() => setSelectedEmoji(null)}
                className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white rounded-xl h-12 px-8"
              >
                Show All Reviews
              </Button>
            ) : (
              <Link
                href={`/review/create?reviewee=${encodeURIComponent(address)}`}
              >
                <Button className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white rounded-xl h-12 px-8">
                  <Heart className="w-5 h-5 mr-2" />
                  Write a Review
                </Button>
              </Link>
            )}
          </motion.div>
        ) : (
          // Reviews List
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            {reviews.map((review, index) => {
              // Use the profile owner's profile if they are the reviewer or reviewee
              const reviewerProfile =
                review.reviewer.toLowerCase() === address.toLowerCase()
                  ? profile
                  : profiles[review.reviewer.toLowerCase()] || null;

              const revieweeProfile =
                review.reviewee.toLowerCase() === address.toLowerCase()
                  ? profile
                  : profiles[review.reviewee.toLowerCase()] || null;

              return (
                <ReviewCard
                  key={review.reviewId || index}
                  review={review}
                  reviewId={review.reviewId || index}
                  hideViewProfile={false}
                  reviewerProfile={reviewerProfile}
                  revieweeProfile={revieweeProfile}
                />
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
