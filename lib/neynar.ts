/**
 * Neynar API Helper Functions
 * Provides utility functions for Farcaster profile lookups
 */

export interface NeynarUser {
  fid: number;
  username: string;
  displayName: string;
  pfp: { url: string };
  bio: string;
  followerCount: number;
  followingCount: number;
  verifiedAddresses: {
    ethAddresses: string[];
    primary?: {
      ethAddress: string | null;
    };
    custodyAddress?: string | null;
  };
}

/**
 * Fetch Farcaster profile by username
 * Returns null if user not found (404), throws error for other failures
 */
export async function fetchProfileByUsername(username: string): Promise<NeynarUser | null> {
  try {
    const response = await fetch(`/api/neynar/user?username=${encodeURIComponent(username)}`);
    
    if (!response.ok) {
      // If 404, user not found - return null (this is expected for fallback)
      if (response.status === 404) {
        return null;
      }
      // For other errors, throw to indicate a real problem
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch profile');
    }
    
    return await response.json();
  } catch (error) {
    // Re-throw non-404 errors (network issues, etc.)
    if (error instanceof Error && !error.message.includes('404')) {
      throw error;
    }
    console.error('Error fetching profile by username:', error);
    return null;
  }
}

/**
 * Fetch Farcaster profile by wallet address
 */
export async function fetchProfileByWallet(address: string): Promise<NeynarUser | null> {
  try {
    const response = await fetch(`/api/neynar/user?address=${encodeURIComponent(address)}`);
    
    if (!response.ok) {
      // User might not have a Farcaster account
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching profile by wallet:', error);
    return null;
  }
}

/**
 * Fetch Farcaster profile by FID
 */
export async function fetchProfileByFid(fid: number): Promise<NeynarUser | null> {
  try {
    const response = await fetch(`/api/neynar/user?fid=${fid}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch profile');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching profile by FID:', error);
    return null;
  }
}

/**
 * Get primary wallet address from Farcaster profile
 * Uses the primary.eth_address field from Neynar API, which is the wallet
 * address the user has designated as their primary address.
 * Falls back to first verified address, then custody address if primary is not set.
 */
export function getPrimaryWallet(user: NeynarUser): string | null {
  // First, try to use the primary wallet address (user-designated)
  if (user.verifiedAddresses?.primary?.ethAddress) {
    return user.verifiedAddresses.primary.ethAddress;
  }
  
  // Fallback to first verified address if primary is not set
  if (user.verifiedAddresses?.ethAddresses?.[0]) {
    return user.verifiedAddresses.ethAddresses[0];
  }
  
  // Last resort: use custody address if no verified addresses
  if (user.verifiedAddresses?.custodyAddress) {
    return user.verifiedAddresses.custodyAddress;
  }
  
  return null;
}

/**
 * Format wallet address for display (0x1234...5678)
 */
export function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Fetch multiple Farcaster profiles by wallet addresses (batch)
 * More efficient than individual calls
 */
export async function fetchProfilesByWallets(
  addresses: string[]
): Promise<Record<string, NeynarUser | null>> {
  if (addresses.length === 0) {
    return {}
  }

  try {
    // Split into batches of 50 (Neynar API limit)
    const batches: string[][] = []
    for (let i = 0; i < addresses.length; i += 50) {
      batches.push(addresses.slice(i, i + 50))
    }

    const allProfiles: Record<string, NeynarUser | null> = {}

    // Process batches sequentially to avoid rate limits
    for (const batch of batches) {
      try {
        const response = await fetch('/api/neynar/user/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ addresses: batch }),
        })

        if (!response.ok) {
          console.error(`Batch API error: ${response.status}`)
          // Mark all addresses in this batch as null
          batch.forEach((addr) => {
            allProfiles[addr.toLowerCase()] = null
          })
          continue
        }

        const data = await response.json()
        const profiles = data.profiles || {}

        // Map results back to original addresses (case-insensitive)
        batch.forEach((addr) => {
          const normalizedAddr = addr.toLowerCase()
          allProfiles[normalizedAddr] = profiles[normalizedAddr] || null
        })
      } catch (error) {
        console.error('Error in batch fetch:', error)
        // Mark all addresses in this batch as null
        batch.forEach((addr) => {
          allProfiles[addr.toLowerCase()] = null
        })
      }
    }

    return allProfiles
  } catch (error) {
    console.error('Error fetching profiles by wallets:', error)
    // Return empty object on error
    const result: Record<string, NeynarUser | null> = {}
    addresses.forEach((addr) => {
      result[addr.toLowerCase()] = null
    })
    return result
  }
}

/**
 * Generate deterministic avatar URL from wallet address
 * Uses RainbowKit's default avatar generator
 */
export function getDefaultAvatar(address: string): string {
  // Use a deterministic avatar service
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${address}`;
}

