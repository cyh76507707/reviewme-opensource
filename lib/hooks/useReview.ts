/**
 * Client-side React hooks for ReviewMe contract interactions
 * Uses wagmi's usePublicClient with fallback RPC and local caching
 */

'use client';

import { usePublicClient } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { REVIEWME_CONTRACT_ADDRESS, REVIEWME_ABI, type Review } from '@/lib/reviewme-contract';
import {
  getCachedReview,
  setCachedReview,
  getCachedRecentReviews,
  setCachedRecentReviews,
  getCachedReviewsForWallet,
  setCachedReviewsForWallet,
  getCachedTxHash,
  setCachedTxHash,
  type CachedReview,
} from '@/lib/cache';
import { parseAbiItem } from 'viem';

// Feature flag: allow fallback to API routes if needed
const USE_CLIENT_RPC = process.env.NEXT_PUBLIC_USE_CLIENT_RPC !== 'false'; // Default: true

// ==================== useReview Hook ====================

export function useReview(reviewId: number, options?: { initialData?: Review }) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ['review', reviewId],
    queryFn: async () => {
      if (!USE_CLIENT_RPC) {
        // Fallback to API route
        const response = await fetch(`/api/reviews/${reviewId}`);
        if (!response.ok) throw new Error('Failed to fetch review');
        const data = await response.json();
        return {
          reviewer: data.reviewer,
          reviewee: data.reviewee,
          content: data.content,
          emoji: data.emoji,
          timestamp: BigInt(data.timestamp || '0'),
          reviewId: data.reviewId,
        } as Review;
      }

      // 1. Check cache
      const cached = await getCachedReview(reviewId);
      if (cached) {
        console.log(`[useReview] 💾 Cache hit: reviewId ${reviewId}`);
        return {
          reviewer: cached.reviewer,
          reviewee: cached.reviewee,
          content: cached.content,
          emoji: cached.emoji,
          timestamp: BigInt(cached.timestamp),
          reviewId: cached.reviewId,
        } as Review;
      }

      if (!publicClient) {
        throw new Error('Public client not available');
      }

      // 2. Fetch from RPC
      console.log(`[useReview] 🔄 Fetching from client RPC: reviewId ${reviewId}`);
      const reviewData = await publicClient.readContract({
        address: REVIEWME_CONTRACT_ADDRESS,
        abi: REVIEWME_ABI,
        functionName: 'reviews' as const,
        args: [BigInt(reviewId)],
      }) as any;

      const review: Review = {
        reviewer: reviewData.reviewer || reviewData[0],
        reviewee: reviewData.reviewee || reviewData[1],
        content: reviewData.content || reviewData[2],
        emoji: Number(reviewData.emoji || reviewData[3] || 0),
        timestamp: reviewData.timestamp || reviewData[4] || 0n,
        reviewId,
      };

      // Check if review data is empty (RPC not synced yet)
      if (!review.content || review.content === '' || review.reviewer === '0x0000000000000000000000000000000000000000') {
        console.warn(`[useReview] ⚠️ Review ${reviewId} not yet available - RPC syncing`);
        throw new Error('Review not yet available - RPC syncing');
      }
      
      console.log(`[useReview] ✅ Successfully fetched review ${reviewId} from client RPC`);

      // 3. Cache result
      await setCachedReview(reviewId, {
        reviewId,
        reviewer: review.reviewer,
        reviewee: review.reviewee,
        content: review.content,
        emoji: review.emoji,
        timestamp: review.timestamp.toString(),
      });

      return review;
    },
    initialData: options?.initialData,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours (reviews never change)
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    retry: 3, // Retry up to 3 times for newly created reviews
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff: 1s, 2s, 4s
  });
}

// ==================== useRecentReviews Hook ====================

export function useRecentReviews(offset: number = 0, limit: number = 20) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ['recentReviews', offset, limit],
    queryFn: async () => {
      if (!USE_CLIENT_RPC) {
        // Fallback to API route
        const response = await fetch(`/api/reviews/recent?offset=${offset}&limit=${limit}`);
        if (!response.ok) throw new Error('Failed to fetch recent reviews');
        const data = await response.json();
        return data.map((r: any) => ({
          ...r,
          timestamp: BigInt(r.timestamp),
        })) as Review[];
      }

      // 1. Check cache
      const cached = await getCachedRecentReviews(offset, limit);
      if (cached) {
        console.log(`[useRecentReviews] 💾 Cache hit: ${cached.length} reviews (offset: ${offset})`);
        return cached.map((r) => ({
          reviewer: r.reviewer,
          reviewee: r.reviewee,
          content: r.content,
          emoji: r.emoji,
          timestamp: BigInt(r.timestamp),
          reviewId: r.reviewId,
        })) as Review[];
      }

      if (!publicClient) {
        throw new Error('Public client not available');
      }

      // 2. Fetch from RPC
      console.log(`[useRecentReviews] 🔄 Fetching from client RPC: offset ${offset}, limit ${limit}`);
      const [reviews, reviewIds] = await publicClient.readContract({
        address: REVIEWME_CONTRACT_ADDRESS,
        abi: REVIEWME_ABI,
        functionName: 'getRecentReviews',
        args: [BigInt(offset), BigInt(limit)],
      }) as [any[], bigint[]];

      const formattedReviews: Review[] = reviews.map((r, index) => ({
        reviewer: r.reviewer,
        reviewee: r.reviewee,
        content: r.content,
        emoji: Number(r.emoji),
        timestamp: r.timestamp,
        reviewId: Number(reviewIds[index]),
      }));
      
      console.log(`[useRecentReviews] ✅ Successfully fetched ${formattedReviews.length} reviews from client RPC`);

      // 3. Cache result
      await setCachedRecentReviews(
        offset,
        limit,
        formattedReviews.map((r) => ({
          reviewId: r.reviewId!,
          reviewer: r.reviewer,
          reviewee: r.reviewee,
          content: r.content,
          emoji: r.emoji,
          timestamp: r.timestamp.toString(),
        }))
      );

      return formattedReviews;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (balance between freshness and performance)
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

// ==================== useReviewsForWallet Hook ====================

export function useReviewsForWallet(wallet: `0x${string}`) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ['reviewsForWallet', wallet],
    queryFn: async () => {
      console.log(`[useReviewsForWallet] Fetching reviews for wallet: ${wallet}`);

      // 1. Check IndexedDB cache first
      const cachedReviews = await getCachedReviewsForWallet(wallet);
      if (cachedReviews) {
        console.log(`[useReviewsForWallet] ✅ Cache hit (IndexedDB) for wallet ${wallet}`);
        return cachedReviews.map(r => ({
          ...r,
          timestamp: BigInt(r.timestamp),
        })) as Review[];
      }

      console.log(`[useReviewsForWallet] ⚠️ Cache miss, fetching from RPC for wallet ${wallet}`);

      // 2. Fetch from RPC
      let reviews: Review[];
      
      if (!USE_CLIENT_RPC) {
        // Fallback: use existing function from lib/reviewme-contract
        const { getReviewsForWallet } = await import('@/lib/reviewme-contract');
        reviews = await getReviewsForWallet(wallet);
      } else {
        if (!publicClient) {
          throw new Error('Public client not available');
        }

        // Use pagination: offset=0, limit=1000 to get all reviews (backward compatible)
        // For wallets with many reviews, consider implementing pagination in the UI
        const [reviewsData, reviewIds] = await publicClient.readContract({
          address: REVIEWME_CONTRACT_ADDRESS,
          abi: REVIEWME_ABI,
          functionName: 'getReviewsForWallet',
          args: [wallet, BigInt(0), BigInt(1000)],
        }) as [any[], bigint[]];

        reviews = reviewsData.map((r, index) => ({
          reviewer: r.reviewer,
          reviewee: r.reviewee,
          content: r.content,
          emoji: Number(r.emoji),
          timestamp: r.timestamp,
          reviewId: Number(reviewIds[index]),
        })) as Review[];
      }

      // 3. Cache to IndexedDB
      const reviewsToCache = reviews.map(r => ({
        reviewer: r.reviewer,
        reviewee: r.reviewee,
        content: r.content,
        emoji: r.emoji,
        timestamp: r.timestamp.toString(),
        reviewId: r.reviewId!,
      }));
      await setCachedReviewsForWallet(wallet, reviewsToCache);
      console.log(`[useReviewsForWallet] 💾 Cached ${reviews.length} reviews for wallet ${wallet}`);

      return reviews;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

// ==================== useReviewsByReviewer Hook ====================

export function useReviewsByReviewer(reviewer: `0x${string}`) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ['reviewsByReviewer', reviewer],
    queryFn: async () => {
      console.log(`[useReviewsByReviewer] Fetching reviews by reviewer: ${reviewer}`);

      if (!USE_CLIENT_RPC) {
        // Fallback: use existing function from lib/reviewme-contract
        const { getReviewsByReviewer } = await import('@/lib/reviewme-contract');
        return getReviewsByReviewer(reviewer);
      }

      if (!publicClient) {
        throw new Error('Public client not available');
      }

      const [reviewsData, reviewIds] = await publicClient.readContract({
        address: REVIEWME_CONTRACT_ADDRESS,
        abi: REVIEWME_ABI,
        functionName: 'getReviewsByReviewer',
        args: [reviewer],
      }) as [any[], bigint[]];

      const reviews = reviewsData.map((r, index) => ({
        reviewer: r.reviewer,
        reviewee: r.reviewee,
        content: r.content,
        emoji: Number(r.emoji),
        timestamp: r.timestamp,
        reviewId: Number(reviewIds[index]),
      })) as Review[];

      console.log(`[useReviewsByReviewer] ✅ Fetched ${reviews.length} reviews by reviewer ${reviewer}`);
      return reviews;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

// ==================== useTxHash Hook ====================

const REVIEW_SUBMITTED_EVENT = parseAbiItem(
  'event ReviewSubmitted(uint256 indexed reviewId, address indexed reviewer, address indexed reviewee, string content, uint8 emoji, uint256 timestamp)'
);

export function useTxHash(reviewId: number) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ['txHash', reviewId],
    queryFn: async () => {
      // 1. Check cache first (txHash never changes, so cache forever)
      const cached = getCachedTxHash(reviewId);
      if (cached) {
        console.log(`[useTxHash] 💾 Cache hit: reviewId ${reviewId}`);
        return cached;
      }

      // 2. Try API route first (faster, optimized, cached on server)
      // API route is more efficient because:
      // - Server-side caching (5 min TTL)
      // - Batch processing
      // - Optimized RPC endpoints
      try {
        console.log(`[useTxHash] 🔄 Trying API route first: reviewId ${reviewId}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch('/api/reviews/tx-hashes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewIds: [reviewId] }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          const txHash = data.txHashes?.[reviewId] || null;
          
          // Cache result if found
          if (txHash) {
            setCachedTxHash(reviewId, txHash);
            console.log(`[useTxHash] ✅ Found via API route: reviewId ${reviewId}`);
          }
          
          return txHash;
        }
      } catch (error: any) {
        // API route failed, fall back to client RPC
        if (error.name !== 'AbortError') {
          console.warn(`[useTxHash] ⚠️ API route failed for reviewId ${reviewId}, falling back to client RPC:`, error);
        } else {
          console.warn(`[useTxHash] ⏱️ API route timeout for reviewId ${reviewId}, falling back to client RPC`);
        }
      }

      // 3. Fallback to client RPC only if API route fails
      if (!USE_CLIENT_RPC || !publicClient) {
        return null;
      }

      // 4. Fetch from RPC with shorter timeout (heavy operation - scan last 7 days)
      try {
        console.log(`[useTxHash] 🔄 Fetching from client RPC (getLogs): reviewId ${reviewId}`);
        // Use Promise.race to timeout quickly
        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), 8000); // 8 second timeout for getLogs
        });

        const rpcPromise = (async () => {
          const currentBlock = await publicClient.getBlockNumber();
          const BLOCKS_PER_7_DAYS = 300_000n;
          const fromBlock = currentBlock > BLOCKS_PER_7_DAYS 
            ? currentBlock - BLOCKS_PER_7_DAYS 
            : 0n;

          const logs = await publicClient.getLogs({
            address: REVIEWME_CONTRACT_ADDRESS,
            event: REVIEW_SUBMITTED_EVENT,
            fromBlock,
            toBlock: currentBlock,
            args: {
              reviewId: BigInt(reviewId),
            },
          });

          // Since we filtered by reviewId, any log returned is the one we want
          return logs[0]?.transactionHash || null;
        })();

        const txHash = await Promise.race([rpcPromise, timeoutPromise]);

        // Cache result if found
        if (txHash) {
          setCachedTxHash(reviewId, txHash);
          console.log(`[useTxHash] ✅ Found via client RPC (getLogs): reviewId ${reviewId}`);
        } else {
          console.warn(`[useTxHash] ⚠️ Not found or timeout: reviewId ${reviewId}`);
        }

        return txHash;
      } catch (error) {
        console.error(`Failed to fetch txHash for review ${reviewId}:`, error);
        // Return null instead of throwing to allow UI to handle gracefully
        return null;
      }
    },
    staleTime: Infinity, // Never refetch (txHash never changes)
    gcTime: Infinity, // Keep in cache forever
    retry: false, // Don't retry if not found (might be older than 7 days)
  });
}

