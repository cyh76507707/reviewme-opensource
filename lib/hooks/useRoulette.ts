/**
 * useRoulette - Hook for ReviewRoulette contract interaction
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAccount, useWalletClient } from 'wagmi';
import { createPublicClient, http, formatEther } from 'viem';
import { base } from 'viem/chains';
import { BASE_RPC_ENDPOINTS } from '../reviewme-contract';

// Contract address - set via environment variable
export const ROULETTE_ADDRESS = 
  (process.env.NEXT_PUBLIC_ROULETTE_ADDRESS as `0x${string}`) || 
  '0x0000000000000000000000000000000000000000';

// ReviewRoulette ABI (supports both production and test contracts)
export const ROULETTE_ABI = [
  {
    type: 'function',
    name: 'claim',
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
      { name: 'totalClaims', type: 'uint32' },
      { name: 'lastClaimTime', type: 'uint64' },
      { name: 'canClaim', type: 'bool' },
      { name: 'secondsUntilNextClaim', type: 'uint256' },
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
    name: 'getReward',
    stateMutability: 'pure',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getCooldown',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'finished',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  // Test contract only - timing info
  {
    type: 'function',
    name: 'getTimingInfo',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'cooldownSeconds', type: 'uint256' },
      { name: 'isTestMode', type: 'bool' },
    ],
  },
  {
    type: 'event',
    name: 'Claimed',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'totalClaims', type: 'uint32', indexed: false },
      { name: 'reward', type: 'uint256', indexed: false },
    ],
  },
] as const;

// Create public client
const publicClient = createPublicClient({
  chain: base,
  transport: http(BASE_RPC_ENDPOINTS[0]),
});

// Types
export interface RouletteInfo {
  totalClaims: number;
  lastClaimTime: number;
  canClaim: boolean;
  secondsUntilNextClaim: number;
  status: string;
}

export interface RoulettePoolInfo {
  balance: string;
  balanceRaw: bigint;
  isActive: boolean;
  reward: string;
  rewardRaw: bigint;
  cooldownHours: number;
}

export interface RouletteTimingInfo {
  cooldownSeconds: number;
  isTestMode: boolean;
}

/**
 * Check if roulette is configured
 */
export function useIsRouletteConfigured() {
  return ROULETTE_ADDRESS !== '0x0000000000000000000000000000000000000000';
}

/**
 * Hook to get user's roulette information
 */
export function useRouletteInfo() {
  const { address } = useAccount();
  
  return useQuery({
    queryKey: ['rouletteInfo', address],
    queryFn: async (): Promise<RouletteInfo | null> => {
      if (!address || ROULETTE_ADDRESS === '0x0000000000000000000000000000000000000000') {
        return null;
      }
      
      try {
        const result = await publicClient.readContract({
          address: ROULETTE_ADDRESS,
          abi: ROULETTE_ABI,
          functionName: 'getUserInfo',
          args: [address],
        });
        
        return {
          totalClaims: Number(result[0]),
          lastClaimTime: Number(result[1]),
          canClaim: result[2],
          secondsUntilNextClaim: Number(result[3]),
          status: result[4],
        };
      } catch (error) {
        console.error('Failed to get roulette info:', error);
        return null;
      }
    },
    enabled: !!address && ROULETTE_ADDRESS !== '0x0000000000000000000000000000000000000000',
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to get pool information
 */
export function useRoulettePoolInfo() {
  return useQuery({
    queryKey: ['roulettePoolInfo'],
    queryFn: async (): Promise<RoulettePoolInfo | null> => {
      if (ROULETTE_ADDRESS === '0x0000000000000000000000000000000000000000') {
        return null;
      }
      
      try {
        const [balance, isActive, reward, cooldown] = await Promise.all([
          publicClient.readContract({
            address: ROULETTE_ADDRESS,
            abi: ROULETTE_ABI,
            functionName: 'getPoolBalance',
          }),
          publicClient.readContract({
            address: ROULETTE_ADDRESS,
            abi: ROULETTE_ABI,
            functionName: 'isActive',
          }),
          publicClient.readContract({
            address: ROULETTE_ADDRESS,
            abi: ROULETTE_ABI,
            functionName: 'getReward',
          }),
          publicClient.readContract({
            address: ROULETTE_ADDRESS,
            abi: ROULETTE_ABI,
            functionName: 'getCooldown',
          }),
        ]);
        
        return {
          balance: formatEther(balance),
          balanceRaw: balance,
          isActive,
          reward: formatEther(reward),
          rewardRaw: reward,
          cooldownHours: Number(cooldown) / 3600,
        };
      } catch (error) {
        console.error('Failed to get roulette pool info:', error);
        return null;
      }
    },
    enabled: ROULETTE_ADDRESS !== '0x0000000000000000000000000000000000000000',
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

/**
 * Hook to get timing info (for test mode detection)
 */
export function useRouletteTimingInfo() {
  return useQuery({
    queryKey: ['rouletteTimingInfo'],
    queryFn: async (): Promise<RouletteTimingInfo | null> => {
      if (ROULETTE_ADDRESS === '0x0000000000000000000000000000000000000000') {
        return null;
      }
      
      try {
        // Try to get timing info (test contract)
        const result = await publicClient.readContract({
          address: ROULETTE_ADDRESS,
          abi: ROULETTE_ABI,
          functionName: 'getTimingInfo',
        });
        
        return {
          cooldownSeconds: Number(result[0]),
          isTestMode: result[1],
        };
      } catch {
        // Production contract doesn't have getTimingInfo
        return {
          cooldownSeconds: 6 * 3600, // 6 hours
          isTestMode: false,
        };
      }
    },
    enabled: ROULETTE_ADDRESS !== '0x0000000000000000000000000000000000000000',
    staleTime: 60 * 1000,
  });
}

/**
 * Hook to claim roulette reward
 */
export function useClaimRoulette() {
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      if (!walletClient || !address) {
        throw new Error('Wallet not connected');
      }
      
      if (ROULETTE_ADDRESS === '0x0000000000000000000000000000000000000000') {
        throw new Error('Roulette contract not configured');
      }
      
      const hash = await walletClient.writeContract({
        address: ROULETTE_ADDRESS,
        abi: ROULETTE_ABI,
        functionName: 'claim',
      });
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      return { hash, receipt };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rouletteInfo'] });
      queryClient.invalidateQueries({ queryKey: ['roulettePoolInfo'] });
    },
  });
}

