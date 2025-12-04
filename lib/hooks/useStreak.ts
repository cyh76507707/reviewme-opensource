/**
 * useStreak - Hook for StreakAirdrop contract interaction
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAccount, useWalletClient } from 'wagmi';
import { createPublicClient, http, formatEther } from 'viem';
import { base } from 'viem/chains';
import { BASE_RPC_ENDPOINTS } from '../reviewme-contract';

// Contract address - set via environment variable
export const STREAK_AIRDROP_ADDRESS = 
  (process.env.NEXT_PUBLIC_STREAK_AIRDROP_ADDRESS as `0x${string}`) || 
  '0x0000000000000000000000000000000000000000';

// StreakAirdrop ABI (supports both production and test contracts)
export const STREAK_AIRDROP_ABI = [
  {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'finish',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getUserInfo',
    stateMutability: 'view',
    inputs: [{ name: 'userAddr', type: 'address' }],
    outputs: [
      { name: 'totalStreak', type: 'uint32' },
      { name: 'currentDayInCycle', type: 'uint8' },
      { name: 'lastClaimDay', type: 'uint64' },
      { name: 'canClaimToday', type: 'bool' },
      { name: 'todayReward', type: 'uint256' },
      { name: 'status', type: 'string' },
    ],
  },
  {
    type: 'function',
    name: 'getPoolBalance',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'isActive',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getRewards',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256[7]' }],
  },
  {
    type: 'function',
    name: 'admin',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'finished',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  // Test contract only - timing functions
  {
    type: 'function',
    name: 'getTimingInfo',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'currentDay', type: 'uint64' },
      { name: 'secondsUntilNextDay', type: 'uint256' },
      { name: 'dayLengthSeconds', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'getDayLength',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'Claimed',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'totalStreak', type: 'uint32', indexed: false },
      { name: 'dayInCycle', type: 'uint8', indexed: false },
      { name: 'reward', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'EventFinished',
    inputs: [
      { name: 'remainingTokens', type: 'uint256', indexed: false },
    ],
  },
] as const;

// Create public client
const publicClient = createPublicClient({
  chain: base,
  transport: http(BASE_RPC_ENDPOINTS[0]),
});

// Types
export interface StreakInfo {
  totalStreak: number;
  currentDayInCycle: number;
  lastClaimDay: number;
  canClaimToday: boolean;
  todayReward: string;
  todayRewardRaw: bigint;
  status: string;
}

export interface PoolInfo {
  balance: string;
  balanceRaw: bigint;
  isActive: boolean;
  rewards: string[];
  rewardsRaw: bigint[];
}

export interface TimingInfo {
  currentDay: number;
  secondsUntilNextDay: number;
  dayLengthSeconds: number;
  isTestMode: boolean; // true if dayLength < 86400 (less than 24 hours)
}

/**
 * Hook to get user's streak information
 */
export function useStreakInfo() {
  const { address } = useAccount();
  
  return useQuery({
    queryKey: ['streakInfo', address],
    queryFn: async (): Promise<StreakInfo | null> => {
      if (!address || STREAK_AIRDROP_ADDRESS === '0x0000000000000000000000000000000000000000') {
        return null;
      }
      
      try {
        const result = await publicClient.readContract({
          address: STREAK_AIRDROP_ADDRESS,
          abi: STREAK_AIRDROP_ABI,
          functionName: 'getUserInfo',
          args: [address],
        });
        
        return {
          totalStreak: Number(result[0]),
          currentDayInCycle: Number(result[1]),
          lastClaimDay: Number(result[2]),
          canClaimToday: result[3],
          todayReward: formatEther(result[4]),
          todayRewardRaw: result[4],
          status: result[5],
        };
      } catch (error) {
        console.error('Failed to get streak info:', error);
        return null;
      }
    },
    enabled: !!address && STREAK_AIRDROP_ADDRESS !== '0x0000000000000000000000000000000000000000',
    staleTime: 0, // Always refetch - no caching
    gcTime: 0, // Don't cache
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to get pool information
 */
export function usePoolInfo() {
  return useQuery({
    queryKey: ['poolInfo'],
    queryFn: async (): Promise<PoolInfo | null> => {
      if (STREAK_AIRDROP_ADDRESS === '0x0000000000000000000000000000000000000000') {
        return null;
      }
      
      try {
        const [balance, isActive, rewards] = await Promise.all([
          publicClient.readContract({
            address: STREAK_AIRDROP_ADDRESS,
            abi: STREAK_AIRDROP_ABI,
            functionName: 'getPoolBalance',
          }),
          publicClient.readContract({
            address: STREAK_AIRDROP_ADDRESS,
            abi: STREAK_AIRDROP_ABI,
            functionName: 'isActive',
          }),
          publicClient.readContract({
            address: STREAK_AIRDROP_ADDRESS,
            abi: STREAK_AIRDROP_ABI,
            functionName: 'getRewards',
          }),
        ]);
        
        return {
          balance: formatEther(balance),
          balanceRaw: balance,
          isActive,
          rewards: rewards.map(r => formatEther(r)),
          rewardsRaw: [...rewards],
        };
      } catch (error) {
        console.error('Failed to get pool info:', error);
        return null;
      }
    },
    enabled: STREAK_AIRDROP_ADDRESS !== '0x0000000000000000000000000000000000000000',
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to get timing information (for countdown timer)
 * Works with both production (24h days) and test (1min days) contracts
 */
export function useTimingInfo() {
  return useQuery({
    queryKey: ['timingInfo'],
    queryFn: async (): Promise<TimingInfo | null> => {
      if (STREAK_AIRDROP_ADDRESS === '0x0000000000000000000000000000000000000000') {
        return null;
      }
      
      try {
        // Try to get timing info (test contract)
        const result = await publicClient.readContract({
          address: STREAK_AIRDROP_ADDRESS,
          abi: STREAK_AIRDROP_ABI,
          functionName: 'getTimingInfo',
        });
        
        const dayLengthSeconds = Number(result[2]);
        
        return {
          currentDay: Number(result[0]),
          secondsUntilNextDay: Number(result[1]),
          dayLengthSeconds,
          isTestMode: dayLengthSeconds < 86400,
        };
      } catch {
        // Production contract doesn't have getTimingInfo, calculate from UTC
        const now = Math.floor(Date.now() / 1000);
        const currentDay = Math.floor(now / 86400);
        const nextDayStart = (currentDay + 1) * 86400;
        const secondsUntilNextDay = nextDayStart - now;
        
        return {
          currentDay,
          secondsUntilNextDay,
          dayLengthSeconds: 86400,
          isTestMode: false,
        };
      }
    },
    enabled: STREAK_AIRDROP_ADDRESS !== '0x0000000000000000000000000000000000000000',
    staleTime: 0, // Always refetch
    gcTime: 0,
    refetchOnMount: 'always',
  });
}

/**
 * Hook to claim streak reward
 */
export function useClaimStreak() {
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      if (!walletClient || !address) {
        throw new Error('Wallet not connected');
      }
      
      if (STREAK_AIRDROP_ADDRESS === '0x0000000000000000000000000000000000000000') {
        throw new Error('Streak airdrop contract not configured');
      }
      
      // Send transaction
      const hash = await walletClient.writeContract({
        address: STREAK_AIRDROP_ADDRESS,
        abi: STREAK_AIRDROP_ABI,
        functionName: 'claim',
      });
      
      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      return { hash, receipt };
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['streakInfo'] });
      queryClient.invalidateQueries({ queryKey: ['poolInfo'] });
    },
  });
}

/**
 * Check if streak airdrop is configured
 */
export function useIsStreakConfigured() {
  return STREAK_AIRDROP_ADDRESS !== '0x0000000000000000000000000000000000000000';
}

/**
 * Helper: Get day label (1-7) for display
 */
export function getDayLabel(dayInCycle: number): string {
  return `Day ${dayInCycle}`;
}

/**
 * Helper: Check if a specific day in the cycle is completed
 */
export function isDayCompleted(currentDayInCycle: number, dayIndex: number, totalStreak: number): boolean {
  if (totalStreak === 0) return false;
  
  // Current cycle start day
  const cycleStartStreak = Math.floor((totalStreak - 1) / 7) * 7 + 1;
  const completedDaysInCycle = totalStreak - cycleStartStreak + 1;
  
  return dayIndex < completedDaysInCycle;
}

/**
 * Helper: Check if a specific day is the current claimable day
 */
export function isCurrentDay(currentDayInCycle: number, dayIndex: number): boolean {
  return currentDayInCycle === dayIndex + 1;
}

