'use client';

import { useMemo, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Heart, Loader2, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { ReviewCard } from '@/components/ReviewCard';
import { useRecentReviews } from '@/lib/hooks/useReview';
import { useProfiles } from '@/lib/hooks/useNeynar';
import { fetchProfileByUsername, getPrimaryWallet } from '@/lib/neynar';
import { type Review } from '@/lib/reviewme-contract';

const REVIEWS_PER_PAGE = 20;

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [offset, setOffset] = useState(0);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [scrollPosition, setScrollPosition] = useState<number | null>(null);
  const [expectedReviewCount, setExpectedReviewCount] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Use client-side RPC hook with caching
  // Falls back to API route if NEXT_PUBLIC_USE_CLIENT_RPC=false
  const { data: currentPageReviews = [], isLoading, error: queryError } = useRecentReviews(offset, REVIEWS_PER_PAGE);
  
  // Merge new reviews with existing ones
  useEffect(() => {
    if (currentPageReviews.length > 0) {
      if (offset === 0) {
        // First page: replace all reviews
        setAllReviews(currentPageReviews);
      } else {
        // Subsequent pages: append new reviews (avoid duplicates)
        setAllReviews((prev) => {
          const existingIds = new Set(prev.map(r => r.reviewId));
          const newReviews = currentPageReviews.filter(r => r.reviewId && !existingIds.has(r.reviewId));
          return [...prev, ...newReviews];
        });
      }
    }
  }, [currentPageReviews, offset]);

  // Restore scroll position after new reviews are loaded
  useEffect(() => {
    if (scrollPosition !== null && expectedReviewCount !== null && !isLoading) {
      // Check if we have the expected number of reviews
      if (allReviews.length >= expectedReviewCount) {
        // Wait for DOM to update, then restore scroll position
        setTimeout(() => {
          window.scrollTo({
            top: scrollPosition,
            behavior: 'auto', // Instant scroll, not smooth
          });
          setScrollPosition(null);
          setExpectedReviewCount(null);
        }, 100);
      }
    }
  }, [allReviews.length, isLoading, scrollPosition, expectedReviewCount]);

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      // Remove @ if present
      const username = searchQuery.trim().replace(/^@/, '');
      
      // Fetch profile by username
      const profile = await fetchProfileByUsername(username);
      
      if (!profile) {
        alert(`User "@${username}" not found`);
        setIsSearching(false);
        return;
      }

      // Get primary wallet address
      const walletAddress = getPrimaryWallet(profile);
      
      if (!walletAddress) {
        alert(`No wallet address found for "@${username}"`);
        setIsSearching(false);
        return;
      }

      // Navigate to user profile page
      router.push(`/user/${walletAddress}`);
    } catch (error) {
      console.error('Search error:', error);
      alert('Failed to search user. Please try again.');
      setIsSearching(false);
    }
  };
  
  // Handle reviewId parameter from shared links
  useEffect(() => {
    const reviewId = searchParams.get('reviewId');
    if (reviewId && !isLoading) {
      const reviewIdNum = parseInt(reviewId, 10);
      if (!isNaN(reviewIdNum)) {
        // Check if review exists in current list
        const reviewExists = allReviews.some(r => r.reviewId === reviewIdNum);
        
        if (reviewExists) {
          // Scroll to review if it exists on homepage
          const reviewElement = document.getElementById(`review-${reviewId}`);
          if (reviewElement) {
            setTimeout(() => {
              reviewElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              reviewElement.classList.add('ring-2', 'ring-pink-500', 'ring-offset-2', 'ring-offset-gray-900');
              setTimeout(() => {
                reviewElement.classList.remove('ring-2', 'ring-pink-500', 'ring-offset-2', 'ring-offset-gray-900');
              }, 3000);
            }, 100);
          }
        } else {
          // If review not in recent list, redirect to review detail page
          router.push(`/review/${reviewId}`);
        }
      }
    }
  }, [searchParams, allReviews, isLoading, router]);
  
  // Extract unique addresses from reviews
  const addresses = useMemo(() => {
    const addressSet = new Set<string>();
    allReviews.forEach((review) => {
      addressSet.add(review.reviewer.toLowerCase());
      addressSet.add(review.reviewee.toLowerCase());
    });
    return Array.from(addressSet);
  }, [allReviews]);

  // Use React Query hook for profile fetching with automatic caching and deduplication
  const { data: profiles = {} } = useProfiles(addresses);

  // Convert query error to string for display
  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Failed to load reviews') : '';
  const loading = isLoading;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 pb-24 md:pb-8">

      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="px-6 pt-8 pb-6 text-center"
      >
        <h2 className="text-white text-2xl font-semibold mb-2" style={{ fontFamily: "'Poetsen One', cursive" }}>
          Onchain <span className="bg-gradient-to-r from-pink-400 to-purple-500 text-transparent bg-clip-text">Reviews</span>
          <br />
          for Real <span className="text-pink-400 animate-glow-text">People</span>
        </h2>
        <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto">
          Write heartfelt reviews about people you know on Base. More reviews, more demand for <Link href="/token" className="bg-gradient-to-r from-yellow-400 to-amber-500 text-transparent bg-clip-text font-semibold hover:from-yellow-300 hover:to-amber-400 transition-all">$RM</Link>.
        </p>
        <div className="flex flex-col items-center gap-3">
          <Link href="/review/create">
            <Button
              className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white rounded-2xl h-12 px-8 shadow-lg shadow-pink-500/25 transition-all hover:shadow-pink-500/40 hover:scale-[1.02]"
              style={{ fontFamily: "'Poetsen One', cursive" }}
            >
              <Heart className="w-5 h-5 mr-2 fill-white" />
              Write a Review
            </Button>
          </Link>
          <Link 
            href="/streak" 
            className="text-sm text-pink-400 hover:text-pink-300 transition-colors"
          >
            Earn Additional $RM →
          </Link>
        </div>
      </motion.div>

      {/* Reviews Feed */}
      <div className="px-6 max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
          <h2 className="text-gray-400 text-sm px-1">Recent Reviews</h2>
          {/* Search Box */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <input
                type="text"
                placeholder="username"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    handleSearch();
                  }
                }}
                className="w-full sm:w-36 md:w-40 px-3 py-1.5 text-base bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/50"
                style={{ fontSize: '16px' }}
              />
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            </div>
            <Button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              size="sm"
              className="h-8 px-3 text-xs bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/20 rounded-lg whitespace-nowrap"
            >
              {isSearching ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                'Search'
              )}
            </Button>
          </div>
        </div>
        
        {loading ? (
          // Loading Skeletons
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50">
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
            <h3 className="text-white text-lg font-semibold mb-2">Failed to Load Reviews</h3>
            <p className="text-gray-400 text-sm mb-4">{error}</p>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
            >
              Try Again
            </Button>
          </motion.div>
        ) : allReviews.length === 0 ? (
          // Empty State
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-12 text-center border border-gray-700/50"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-pink-500/20 to-pink-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Heart className="h-10 w-10 text-pink-400" />
            </div>
            <h3 className="text-white text-xl font-semibold mb-3">
              No reviews yet
            </h3>
            <p className="text-gray-400 mb-6">
              Be the first to write an on-chain review!
            </p>
            <Link href="/review/create">
              <Button 
                className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white rounded-xl h-12 px-8"
              >
                <Heart className="w-5 h-5 mr-2" />
                Write a Review
              </Button>
            </Link>
          </motion.div>
        ) : (
          // Reviews List
          <div className="space-y-3">
            {allReviews.map((review, index) => (
              <ReviewCard
                key={review.reviewId ?? index}
                review={review}
                reviewId={review.reviewId ?? index}
                reviewerProfile={profiles[review.reviewer.toLowerCase()] || null}
                revieweeProfile={profiles[review.reviewee.toLowerCase()] || null}
              />
            ))}
          </div>
        )}
      </div>

      {/* Load More Button */}
      {allReviews.length > 0 && currentPageReviews.length >= REVIEWS_PER_PAGE && (
        <div className="px-6 mt-3 max-w-3xl mx-auto">
          <Button
            onClick={() => {
              // Save current scroll position before loading more
              setScrollPosition(window.scrollY);
              // Expect to add REVIEWS_PER_PAGE more reviews
              setExpectedReviewCount(allReviews.length + REVIEWS_PER_PAGE);
              setOffset((prev) => prev + REVIEWS_PER_PAGE);
            }}
            disabled={isLoading}
            variant="outline"
            className="w-full rounded-xl h-12"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More Reviews'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
