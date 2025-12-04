/**
 * React Query hooks for Neynar profile data
 * Provides caching and deduplication to prevent rate limit issues
 * Uses IndexedDB for persistent caching across page refreshes
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchProfilesByWallets, fetchProfileByWallet, type NeynarUser } from '@/lib/neynar';
import {
  getCachedProfile,
  getCachedProfiles,
  setCachedProfile,
  setCachedProfiles,
  type CachedProfile,
} from '@/lib/cache';

/**
 * Convert CachedProfile to NeynarUser
 */
function cachedToNeynar(cached: CachedProfile | null): NeynarUser | null {
  if (!cached) return null;
  return {
    fid: cached.fid,
    username: cached.username,
    displayName: cached.displayName,
    pfp: cached.pfp,
    bio: cached.bio,
    followerCount: cached.followerCount,
    followingCount: cached.followingCount,
    verifiedAddresses: cached.verifiedAddresses,
  };
}

/**
 * Convert NeynarUser to CachedProfile
 */
function neynarToCached(address: string, user: NeynarUser | null): CachedProfile | null {
  if (!user) return null;
  return {
    address: address.toLowerCase(),
    fid: user.fid,
    username: user.username,
    displayName: user.displayName,
    pfp: user.pfp,
    bio: user.bio,
    followerCount: user.followerCount,
    followingCount: user.followingCount,
    verifiedAddresses: user.verifiedAddresses,
  };
}

/**
 * Hook to fetch multiple profiles by wallet addresses with caching
 * Automatically batches requests and prevents duplicate calls
 * Uses IndexedDB for persistent caching across page refreshes
 */
export function useProfiles(addresses: string[]) {
  // Normalize addresses and remove duplicates
  const normalizedAddresses = [...new Set(addresses.map(addr => addr.toLowerCase()))].filter(Boolean);
  
  return useQuery({
    queryKey: ['neynarProfiles', normalizedAddresses.sort().join(',')],
    queryFn: async () => {
      if (normalizedAddresses.length === 0) {
        return {} as Record<string, NeynarUser | null>;
      }
      
      // 1. Check IndexedDB cache first
      const cachedProfiles = await getCachedProfiles(normalizedAddresses);
      console.log(`[useProfiles] 📦 Checked IndexedDB for ${normalizedAddresses.length} addresses, found ${Object.keys(cachedProfiles).length} cached`);
      
      // Find addresses that are not cached or are null (need to fetch)
      const addressesToFetch: string[] = [];
      const result: Record<string, NeynarUser | null> = {};
      
      normalizedAddresses.forEach(addr => {
        const cached = cachedProfiles[addr];
        if (cached === undefined) {
          // Not in cache, need to fetch
          addressesToFetch.push(addr);
          result[addr] = null; // Temporary null
        } else {
          // Found in cache (could be null for users without Farcaster)
          result[addr] = cachedToNeynar(cached);
        }
      });
      
      console.log(`[useProfiles] 🔍 Need to fetch ${addressesToFetch.length} profiles from API`);
      
      // 2. Fetch missing profiles from API
      if (addressesToFetch.length > 0) {
        try {
          const fetchedProfiles = await fetchProfilesByWallets(addressesToFetch);
          console.log(`[useProfiles] ✅ Fetched ${Object.keys(fetchedProfiles).length} profiles from batch API`);
          
          // Merge fetched profiles into result
          Object.entries(fetchedProfiles).forEach(([addr, profile]) => {
            result[addr.toLowerCase()] = profile;
          });
          
          // 3. Cache fetched profiles (including nulls to avoid repeated API calls)
          const profilesToCache: Record<string, CachedProfile | null> = {};
          addressesToFetch.forEach(addr => {
            const profile = fetchedProfiles[addr.toLowerCase()] || null;
            profilesToCache[addr] = neynarToCached(addr, profile);
          });
          await setCachedProfiles(profilesToCache);
          console.log(`[useProfiles] 💾 Cached ${Object.keys(profilesToCache).length} profiles to IndexedDB`);
        } catch (error) {
          console.error('[useProfiles] ❌ Failed to fetch profiles:', error);
          // Keep null values for addresses that failed to fetch
        }
      }
      
      return result;
    },
    enabled: normalizedAddresses.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes (profiles don't change often)
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2, // Retry up to 2 times on failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff
  });
}

/**
 * Hook to fetch a single profile by wallet address
 * Uses IndexedDB for persistent caching across page refreshes
 */
export function useProfile(address: string | null | undefined) {
  return useQuery({
    queryKey: ['neynarProfile', address?.toLowerCase()],
    queryFn: async () => {
      if (!address) return null;
      
      // 1. Check IndexedDB cache first
      const cached = await getCachedProfile(address);
      if (cached !== undefined) {
        // Found in cache (could be null for users without Farcaster)
        console.log(`[useProfile] 📦 Cache hit for ${address}${cached === null ? ' (no Farcaster profile)' : ''}`);
        return cachedToNeynar(cached);
      }
      
      console.log(`[useProfile] 🔍 Cache miss, fetching from API for ${address}`);
      
      // 2. Fetch from API if not cached
      try {
        const profile = await fetchProfileByWallet(address);
        
        // 3. Cache the result (including null to avoid repeated API calls)
        await setCachedProfile(address, neynarToCached(address, profile));
        console.log(`[useProfile] 💾 Cached profile for ${address}`);
        
        return profile;
      } catch (error) {
        console.error(`[useProfile] ❌ Failed to fetch profile for ${address}:`, error);
        // Cache null to avoid repeated failed API calls
        await setCachedProfile(address, null);
        return null;
      }
    },
    enabled: !!address,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
}

