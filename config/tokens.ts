import { REVIEWME_CONTRACT_ADDRESS, HUNT_TOKEN_ADDRESS } from '@/lib/reviewme-contract';

// Payment token types
export type PaymentToken = 'HUNT' | 'ETH' | 'USDC' | 'MT';

export interface TokenInfo {
  label: string;
  symbol: string;
  address: `0x${string}`;
  decimals: number;
  isNative: boolean;
}

// Token addresses on Base Mainnet
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
const MT_TOKEN_ADDRESS = '0xFf45161474C39cB00699070Dd49582e417b57a7E' as const;
const USDC_TOKEN_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

export const PAYMENT_TOKENS: Record<PaymentToken, TokenInfo> = {
  HUNT: {
    label: 'HUNT',
    symbol: 'HUNT',
    address: HUNT_TOKEN_ADDRESS,
    decimals: 18,
    isNative: false,
  },
  ETH: {
    label: 'ETH',
    symbol: 'ETH',
    address: ZERO_ADDRESS,
    decimals: 18,
    isNative: true,
  },
  USDC: {
    label: 'USDC',
    symbol: 'USDC',
    address: USDC_TOKEN_ADDRESS,
    decimals: 6,
    isNative: false,
  },
  MT: {
    label: 'MT',
    symbol: 'MT',
    address: MT_TOKEN_ADDRESS,
    decimals: 18,
    isNative: false,
  },
};

