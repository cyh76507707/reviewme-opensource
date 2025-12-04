'use client';

import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { User, Heart, TrendingUp, Loader2, ExternalLink, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReviewCard } from '@/components/ReviewCard';
import { useReviewsForWallet, useReviewsByReviewer } from '@/lib/hooks/useReview';
import { useProfile, useProfiles } from '@/lib/hooks/useNeynar';
import Link from 'next/link';
import Image from 'next/image';

export default function MyPage() {
  const { address, isConnected } = useAccount();

  // Use hooks with IndexedDB caching
  const { data: profile, isLoading: profileLoading } = useProfile(address);
  const { data: reviewsReceived = [], isLoading: receivedLoading } = useReviewsForWallet(address || '0x0');
  const { data: reviewsGiven = [], isLoading: givenLoading } = useReviewsByReviewer(address || '0x0');

  // Collect all unique addresses from reviews for batch fetching
  const allReviewAddresses = useMemo(() => {
    const addresses = new Set<string>();
    reviewsReceived.forEach(review => {
      addresses.add(review.reviewer);
      addresses.add(review.reviewee);
    });
    reviewsGiven.forEach(review => {
      addresses.add(review.reviewer);
      addresses.add(review.reviewee);
    });
    return Array.from(addresses);
  }, [reviewsReceived, reviewsGiven]);

  // Fetch all profiles in batch
  const { data: profiles, isLoading: profilesLoading } = useProfiles(allReviewAddresses);

  const loading = receivedLoading || givenLoading;

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 pb-24 md:pb-8">
        <div className="max-w-3xl mx-auto">
          <div className="px-6 pt-20 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-6"
            >
            <div className="w-24 h-24 rounded-full bg-gray-800/50 flex items-center justify-center">
              <User className="w-12 h-12 text-gray-600" />
            </div>
            <div>
              <h1 className="text-white text-2xl font-bold mb-2">Connect Your Wallet</h1>
              <p className="text-gray-400 text-sm">
                Connect your wallet to view your profile and reviews
              </p>
            </div>
          </motion.div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 pb-24 md:pb-8">
      <div className="max-w-3xl mx-auto">
        {/* Profile Header */}
        <div className="px-6 pt-8 pb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-4"
          >
          {profileLoading ? (
            <>
              <div className="w-24 h-24 rounded-full bg-gray-800/50 animate-pulse" />
              <div className="h-6 w-32 bg-gray-800/50 rounded animate-pulse" />
            </>
          ) : (
            <>
              {profile?.pfp?.url ? (
                <Image
                  src={profile.pfp.url}
                  alt={profile.username || 'User'}
                  width={96}
                  height={96}
                  className="rounded-full"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
                  <User className="w-12 h-12 text-white" />
                </div>
              )}
              
              <div className="text-center">
                {profile?.username ? (
                  <h1 className="text-white text-2xl font-bold">@{profile.username}</h1>
                ) : (
                  <h1 className="text-gray-400 text-sm font-mono">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </h1>
                )}
                
                <Link
                  href={`/user/${address}`}
                  className="inline-flex items-center gap-1 text-pink-400 text-sm mt-2 hover:text-pink-300 transition-colors"
                >
                  View Public Profile
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Stats */}
      <div className="px-6 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-pink-400" />
              <span className="text-gray-400 text-sm">Received</span>
            </div>
            <div className="text-white text-2xl font-bold">
              {loading ? '...' : reviewsReceived.length}
            </div>
          </div>
          
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <span className="text-gray-400 text-sm">Given</span>
            </div>
            <div className="text-white text-2xl font-bold">
              {loading ? '...' : reviewsGiven.length}
            </div>
          </div>
        </div>
      </div>

      {/* Reviews Received */}
      <div className="px-6 mb-8">
        <h2 className="text-white text-lg font-semibold mb-4">Reviews I've Received</h2>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
            <p className="text-gray-400">Loading reviews...</p>
          </div>
        ) : profilesLoading && reviewsReceived.length > 0 ? (
          <div className="space-y-3">
            {reviewsReceived.map((review, index) => (
              <div key={index} className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-5 border border-gray-700/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gray-700 animate-pulse" />
                  <div className="h-4 bg-gray-700 rounded animate-pulse w-24" />
                  <ArrowRight className="w-4 h-4 text-gray-600" />
                  <div className="w-10 h-10 rounded-full bg-gray-700 animate-pulse" />
                  <div className="h-4 bg-gray-700 rounded animate-pulse w-24" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-700 rounded animate-pulse w-full" />
                  <div className="h-4 bg-gray-700 rounded animate-pulse w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : reviewsReceived.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">No reviews yet</p>
            <p className="text-gray-500 text-sm mt-2">Share your profile to get reviews from others</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviewsReceived.map((review, index) => (
              <ReviewCard 
                key={index} 
                review={review} 
                hideViewProfile={false}
                reviewerProfile={profiles?.[review.reviewer.toLowerCase()] ?? null}
                revieweeProfile={profiles?.[review.reviewee.toLowerCase()] ?? null}
              />
            ))}
          </div>
        )}
      </div>

      {/* Reviews Given */}
      <div className="px-6">
        <h2 className="text-white text-lg font-semibold mb-4">Reviews I've Written</h2>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            <p className="text-gray-400">Loading reviews...</p>
          </div>
        ) : profilesLoading && reviewsGiven.length > 0 ? (
          <div className="space-y-3">
            {reviewsGiven.map((review, index) => (
              <div key={index} className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-5 border border-gray-700/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gray-700 animate-pulse" />
                  <div className="h-4 bg-gray-700 rounded animate-pulse w-24" />
                  <ArrowRight className="w-4 h-4 text-gray-600" />
                  <div className="w-10 h-10 rounded-full bg-gray-700 animate-pulse" />
                  <div className="h-4 bg-gray-700 rounded animate-pulse w-24" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-700 rounded animate-pulse w-full" />
                  <div className="h-4 bg-gray-700 rounded animate-pulse w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : reviewsGiven.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">You haven't written any reviews yet</p>
            <Link href="/review/create">
              <Button className="bg-purple-500 hover:bg-purple-600">
                Write Your First Review
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {reviewsGiven.map((review, index) => (
              <ReviewCard 
                key={index} 
                review={review} 
                hideViewProfile={false}
                reviewerProfile={profiles?.[review.reviewer.toLowerCase()] ?? null}
                revieweeProfile={profiles?.[review.reviewee.toLowerCase()] ?? null}
              />
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

