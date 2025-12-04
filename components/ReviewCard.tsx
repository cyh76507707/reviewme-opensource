'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { fetchProfileByWallet, formatAddress, getDefaultAvatar, type NeynarUser } from '@/lib/neynar';
import { type Review } from '@/lib/reviewme-contract';

const EMOJI_MAP: Record<number, string> = {
  1: '🤔',
  2: '🤝',
  3: '💎',
  4: '🔥',
  5: '❤️',
};

const EMOJI_LABELS: Record<number, string> = {
  1: 'Reflective & critical',
  2: 'Respect & agreement',
  3: 'Valuable & insightful',
  4: 'Amazing & inspiring',
  5: 'Love & appreciation',
};

interface ReviewCardProps {
  review: Review;
  reviewId?: number;
  hideViewProfile?: boolean; // Hide "View Profile" link (e.g., on profile pages)
  reviewerProfile?: NeynarUser | null; // Optional: pre-fetched profile
  revieweeProfile?: NeynarUser | null; // Optional: pre-fetched profile
}

export function ReviewCard({ 
  review, 
  reviewId,
  hideViewProfile,
  reviewerProfile: propReviewerProfile,
  revieweeProfile: propRevieweeProfile,
}: ReviewCardProps) {
  const [reviewerProfile, setReviewerProfile] = useState<NeynarUser | null>(propReviewerProfile || null);
  const [revieweeProfile, setRevieweeProfile] = useState<NeynarUser | null>(propRevieweeProfile || null);
  const [loading, setLoading] = useState(!propReviewerProfile || !propRevieweeProfile);

  // If profiles are provided as props, use them directly
  // Otherwise, fetch individually (fallback for pages that don't use batch)
  useEffect(() => {
    if (propReviewerProfile !== undefined && propRevieweeProfile !== undefined) {
      setReviewerProfile(propReviewerProfile);
      setRevieweeProfile(propRevieweeProfile);
      setLoading(false);
      return;
    }

    // Fallback: fetch individually if not provided
    loadProfiles();
  }, [review.reviewer, review.reviewee, propReviewerProfile, propRevieweeProfile]);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const [reviewer, reviewee] = await Promise.all([
        fetchProfileByWallet(review.reviewer),
        fetchProfileByWallet(review.reviewee),
      ]);
      setReviewerProfile(reviewer);
      setRevieweeProfile(reviewee);
    } catch (error) {
      console.error('Failed to load profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div
      id={`review-${review.reviewId ?? reviewId}`}
      className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-5 border border-gray-700/50 hover:border-gray-600/50 transition-all"
    >
      {/* Header: Reviewer → Reviewee */}
      <div className="flex items-center gap-3 mb-4">
        {/* Mobile: Centered arrow with truncated names */}
        <div className="flex items-center gap-2 flex-1 min-w-0 md:hidden">
          {/* Reviewer */}
          <Link href={`/user/${review.reviewer}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-1 min-w-0">
            <img
              src={reviewerProfile?.pfp?.url || getDefaultAvatar(review.reviewer)}
              alt={reviewerProfile?.displayName || formatAddress(review.reviewer)}
              className="w-10 h-10 rounded-full border-2 border-gray-700 flex-shrink-0"
            />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-white text-sm font-medium truncate">
                {reviewerProfile?.displayName || formatAddress(review.reviewer)}
              </span>
              {reviewerProfile && (
                <span className="text-gray-400 text-xs truncate">@{reviewerProfile.username}</span>
              )}
            </div>
          </Link>

          {/* Arrow - centered */}
          <ArrowRight className="w-4 h-4 text-pink-400 flex-shrink-0 mx-1" />

          {/* Reviewee */}
          <Link href={`/user/${review.reviewee}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-1 min-w-0">
            <div className="relative w-10 h-10 flex-shrink-0">
              {/* Animated glow effect - behind image */}
              <div className="absolute inset-0 w-7 h-7 m-auto rounded-full bg-pink-400/60 blur-lg animate-pulse -z-10"></div>
              <div 
                className="absolute inset-0 w-7 h-7 m-auto rounded-full bg-pink-400/80 blur-xl -z-10"
                style={{
                  animation: 'glow 2s ease-in-out infinite',
                }}
              ></div>
              <div 
                className="absolute inset-0 w-8 h-8 m-auto rounded-full bg-pink-500/40 blur-2xl -z-10"
                style={{
                  animation: 'glow 2s ease-in-out infinite 0.5s',
                }}
              ></div>
              {/* Image on top */}
              <img
                src={revieweeProfile?.pfp?.url || getDefaultAvatar(review.reviewee)}
                alt={revieweeProfile?.displayName || formatAddress(review.reviewee)}
                className="w-10 h-10 rounded-full border-2 border-pink-400/70 relative z-10"
              />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-white text-sm font-medium truncate">
                {revieweeProfile?.displayName || formatAddress(review.reviewee)}
              </span>
              {revieweeProfile && (
                <span className="text-gray-400 text-xs truncate">@{revieweeProfile.username}</span>
              )}
            </div>
          </Link>
        </div>

        {/* Desktop: Left-aligned, no truncate */}
        <div className="hidden md:flex items-center gap-3 flex-1">
          {/* Reviewer */}
          <Link href={`/user/${review.reviewer}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img
              src={reviewerProfile?.pfp?.url || getDefaultAvatar(review.reviewer)}
              alt={reviewerProfile?.displayName || formatAddress(review.reviewer)}
              className="w-10 h-10 rounded-full border-2 border-gray-700 flex-shrink-0"
            />
            <div className="flex flex-col">
              <span className="text-white text-sm font-medium">
                {reviewerProfile?.displayName || formatAddress(review.reviewer)}
              </span>
              {reviewerProfile && (
                <span className="text-gray-400 text-xs">@{reviewerProfile.username}</span>
              )}
            </div>
          </Link>

          {/* Arrow */}
          <ArrowRight className="w-4 h-4 text-pink-400 flex-shrink-0" />

          {/* Reviewee with animated glow effect */}
          <Link href={`/user/${review.reviewee}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="relative w-10 h-10 flex-shrink-0">
              {/* Animated glow effect - behind image */}
              <div className="absolute inset-0 w-7 h-7 m-auto rounded-full bg-pink-400/60 blur-lg animate-pulse -z-10"></div>
              <div 
                className="absolute inset-0 w-7 h-7 m-auto rounded-full bg-pink-400/80 blur-xl -z-10"
                style={{
                  animation: 'glow 2s ease-in-out infinite',
                }}
              ></div>
              <div 
                className="absolute inset-0 w-8 h-8 m-auto rounded-full bg-pink-500/40 blur-2xl -z-10"
                style={{
                  animation: 'glow 2s ease-in-out infinite 0.5s',
                }}
              ></div>
              {/* Image on top */}
              <img
                src={revieweeProfile?.pfp?.url || getDefaultAvatar(review.reviewee)}
                alt={revieweeProfile?.displayName || formatAddress(review.reviewee)}
                className="w-10 h-10 rounded-full border-2 border-pink-400/70 relative z-10"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-white text-sm font-medium">
                {revieweeProfile?.displayName || formatAddress(review.reviewee)}
              </span>
              {revieweeProfile && (
                <span className="text-gray-400 text-xs">@{revieweeProfile.username}</span>
              )}
            </div>
          </Link>
        </div>
      </div>

      {/* Review Content - More prominent */}
      <p className="text-white text-base font-medium leading-relaxed mb-3">
        {review.content}
      </p>

      {/* Emoji Rating - Simplified, moved to bottom */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{EMOJI_MAP[review.emoji] || '🤔'}</span>
        <span className="text-gray-400 text-xs">
          {EMOJI_LABELS[review.emoji] || 'Reflective & critical'}
        </span>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-700/50 flex items-center justify-between gap-2">
        <span className="text-gray-500 text-xs whitespace-nowrap">
          Review #{review.reviewId ?? reviewId ?? '?'}
        </span>
        <div className="flex items-center gap-3 ml-auto">
            {/* Timestamp */}
            <span className="text-gray-500 text-xs whitespace-nowrap">
              {formatTimestamp(review.timestamp)}
            </span>
            {!hideViewProfile && (review.reviewId !== undefined || reviewId !== undefined) && (
              <Link
                href={`/review/${review.reviewId ?? reviewId}`}
                className="text-pink-400 text-xs hover:underline whitespace-nowrap"
              >
                View Review →
              </Link>
            )}
        </div>
      </div>
    </div>
  );
}
