/**
 * Leaderboard functionality using server-side API
 * Server handles aggregation and caching (10-minute cache)
 */

export interface LeaderboardEntry {
  address: string;
  count: number;
  username?: string;
  pfpUrl?: string;
}

export interface LeaderboardData {
  topReviewers: LeaderboardEntry[];
  topReviewees: LeaderboardEntry[];
  lastUpdated: number;
}

/**
 * Get leaderboard data from server-side API
 * Server handles fetching 1000 reviews, aggregation, and 10-minute caching
 */
export async function getLeaderboardData(forceRefresh = false): Promise<LeaderboardData> {
  try {
    const url = forceRefresh
      ? '/api/leaderboard?forceRefresh=true'
      : '/api/leaderboard';
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data as LeaderboardData;
  } catch (error) {
    console.error('Failed to fetch leaderboard data:', error);
    
    // Return empty data on error
    return {
      topReviewers: [],
      topReviewees: [],
      lastUpdated: 0
    };
  }
}

/**
 * Get all unique addresses from leaderboard data
 * This is used by the component to fetch profiles using useProfiles hook
 */
export function getLeaderboardAddresses(data: LeaderboardData): string[] {
  const addresses = new Set<string>();
  
  data.topReviewers.forEach(entry => addresses.add(entry.address.toLowerCase()));
  data.topReviewees.forEach(entry => addresses.add(entry.address.toLowerCase()));
  
  return Array.from(addresses);
}

