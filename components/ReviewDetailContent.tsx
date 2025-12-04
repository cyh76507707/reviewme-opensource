'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatAddress, getDefaultAvatar } from '@/lib/neynar';
import { ShareButtons } from '@/components/ShareButtons';
import { TxHashLink } from '@/components/TxHashLink';
import { useReview } from '@/lib/hooks/useReview';
import { useProfile } from '@/lib/hooks/useNeynar';
import type { Review } from '@/lib/reviewme-contract';

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

// Format timestamp to relative time (e.g., "2 mins ago")
function formatTimestamp(timestamp: bigint): string {
  const now = Date.now();
  const date = Number(timestamp) * 1000;
  const diff = now - date;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  
  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

interface ReviewDetailContentProps {
  reviewId: number;
  initialReview?: Review;
}

export function ReviewDetailContent({ reviewId, initialReview }: ReviewDetailContentProps) {
  // Use client-side RPC hook with caching
  // Falls back to API route if NEXT_PUBLIC_USE_CLIENT_RPC=false
  const { data: review, isLoading, error } = useReview(reviewId, {
    initialData: initialReview,
  });

  // Fetch profiles using React Query hooks with IndexedDB caching
  const { data: reviewerProfile } = useProfile(review?.reviewer);
  const { data: revieweeProfile } = useProfile(review?.reviewee);

  if (isLoading && !review) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 pb-24 md:pb-8">
        <div className="max-w-3xl mx-auto px-6 pt-8">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 sm:p-10 border border-gray-700/50">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-700 rounded w-1/3"></div>
              <div className="h-12 bg-gray-700 rounded"></div>
              <div className="h-24 bg-gray-700 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !review) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 pb-24 md:pb-8">
        <div className="max-w-3xl mx-auto px-6 pt-8">
          <Link href="/">
            <Button variant="ghost" className="mb-6 text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <div className="bg-red-500/10 backdrop-blur-sm rounded-2xl p-8 text-center border border-red-500/20">
            <h3 className="text-white text-lg font-semibold mb-2">Failed to Load Review</h3>
            <p className="text-gray-400 text-sm mb-4">
              {error instanceof Error ? error.message : 'Review not found'}
            </p>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 pb-24 md:pb-8">
      <div className="max-w-3xl mx-auto px-6 pt-8">
        {/* Back Button */}
        <Link href="/">
          <Button
            variant="ghost"
            className="mb-6 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        {/* Review Content Card */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 sm:p-10 border border-gray-700/50">
          {/* Title Section: Onchain Review for */}
          <div className="mb-8">
            <div className="text-gray-400 text-sm mb-3">Onchain Review for:</div>
            <Link href={`/user/${review.reviewee}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity mb-6">
              <img
                src={revieweeProfile?.pfp?.url || getDefaultAvatar(review.reviewee)}
                alt={revieweeProfile?.displayName || formatAddress(review.reviewee)}
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-pink-500/50 object-cover"
              />
              <div className="flex flex-col">
                <span className="text-white font-bold text-xl sm:text-2xl">
                  {revieweeProfile?.displayName || formatAddress(review.reviewee)}
                </span>
                {revieweeProfile && (
                  <span className="text-gray-400 text-sm">@{revieweeProfile.username}</span>
                )}
              </div>
            </Link>

            {/* Review Text */}
            <p className="text-white text-2xl sm:text-4xl font-bold leading-tight mb-4">
              {review.content}
            </p>

            {/* Emoji & Time */}
            <div className="flex items-center gap-2 text-gray-400 text-xs">
              <span className="text-lg">{EMOJI_MAP[review.emoji] || '🤔'}</span>
              <span>{EMOJI_LABELS[review.emoji] || 'Reflective & critical'}</span>
              <span className="text-gray-600">•</span>
              <span>{formatTimestamp(review.timestamp)}</span>
            </div>
          </div>

          {/* Reviewed by Section */}
          <div className="mb-6">
            <div className="text-gray-400 text-sm mb-3">Reviewed by:</div>
            <Link href={`/user/${review.reviewer}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img
                src={reviewerProfile?.pfp?.url || getDefaultAvatar(review.reviewer)}
                alt={reviewerProfile?.displayName || formatAddress(review.reviewer)}
                className="w-10 h-10 rounded-full border border-gray-700 object-cover"
              />
              <div className="flex flex-col">
                <span className="text-white font-medium">
                  {reviewerProfile?.displayName || formatAddress(review.reviewer)}
                </span>
                {reviewerProfile && (
                  <span className="text-gray-400 text-xs">@{reviewerProfile.username}</span>
                )}
              </div>
            </Link>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-700/50 my-6"></div>

          {/* RM Distribution - Subtle Bar Graph */}
          <div className="space-y-2">
            <div className="text-xs text-gray-400 font-medium mb-3">
              100 <span className="text-yellow-400">$RM</span> Distribution
            </div>
            
            {/* Compact Bar Graphs */}
            <div className="space-y-1.5">
              {/* Reviewer - 89% */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-5 bg-gray-900/30 rounded overflow-hidden relative">
                  <div className="absolute inset-0 bg-gray-600/40 rounded" style={{ width: '89%' }}></div>
                  <div className="absolute inset-0 flex items-center px-2 text-xs">
                    <span className="text-gray-300">89% → @{reviewerProfile?.username || formatAddress(review.reviewer).slice(0, 8)}</span>
                  </div>
                </div>
              </div>

              {/* Reviewee - 10% */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-5 bg-gray-900/30 rounded overflow-hidden relative">
                  <div className="absolute inset-0 bg-gray-600/40 rounded" style={{ width: '10%' }}></div>
                  <div className="absolute inset-0 flex items-center px-2 text-xs">
                    <span className="text-gray-300">10% → @{revieweeProfile?.username || formatAddress(review.reviewee).slice(0, 8)}</span>
                  </div>
                </div>
              </div>

              {/* Burn - 1% */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-5 bg-gray-900/30 rounded overflow-hidden relative">
                  <div className="absolute inset-0 bg-gray-600/40 rounded" style={{ width: '1%' }}></div>
                  <div className="absolute inset-0 flex items-center px-2 text-xs">
                    <span className="text-gray-300">1% → burn</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Transaction Link */}
          <div className="mt-6 mb-6">
            <TxHashLink
              reviewId={review.reviewId ?? reviewId}
              initialTxHash={null}
            />
          </div>

          {/* Share Section */}
          <ShareButtons reviewId={reviewId} review={review} />
        </div>
      </div>
    </div>
  );
}
