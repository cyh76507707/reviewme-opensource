/**
 * ReviewMe v0.01 Contract Integration
 * Handles all interactions with the ReviewMe smart contract
 */

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  fallback,
  parseEther,
  formatEther,
  parseAbiItem,
} from "viem";
import { base } from "viem/chains";

// Base RPC Endpoints with fallback
// Removed: base.llamarpc.com (old blocks), endpoints.omniatech.io (down), rpc.owlracle.info (CORS)
export const BASE_RPC_ENDPOINTS = [
  "https://base-rpc.publicnode.com",
  "https://base.drpc.org",
  "https://base.llamarpc.com",
  "https://base.meowrpc.com",
  "https://mainnet.base.org",
  "https://developer-access-mainnet.base.org",
  "https://base-mainnet.public.blastapi.io",
  "https://base-public.nodies.app",
  "https://rpc.poolz.finance/base",
  "https://api.zan.top/base-mainnet",
  "https://1rpc.io/base",
  "https://endpoints.omniatech.io/v1/base/mainnet/public",
  "https://rpc.owlracle.info/base/70d38ce1826c4a60bb2a8e05a6c8b20f",
  "https://base.public.blockpi.network/v1/rpc/public",
] as const;

/**
 * Create transport with RPC fallback
 */
function _getTransport(rpcEndpoints: readonly string[]) {
  return fallback(
    rpcEndpoints.map((url) =>
      http(url, {
        timeout: 2_000,
        retryCount: 0,
      })
    ),
    { rank: false }
  );
}

// Contract Addresses
// Default to the deployed contract address if env var is not set
export const REVIEWME_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_REVIEWME_CONTRACT_ADDRESS as `0x${string}`) ||
  "0x5BfC8705cF877776e461e27FAcB51D8C2bDd00c7";
export const HUNT_TOKEN_ADDRESS =
  "0x37f0c2915CeCC7e977183B8543Fc0864d03E064C" as const;
export const REVIEWME_TOKEN_ADDRESS =
  "0x37B44b8abB2DeFB35E704306913400888bbdE792" as const;

// Review structure matching contract
export interface Review {
  reviewer: `0x${string}`;
  reviewee: `0x${string}`;
  content: string;
  emoji: number; // 1-5
  timestamp: bigint;
  reviewId?: number; // Review ID from contract
}

// ReviewMe Contract ABI
export const REVIEWME_ABI = [
  {
    type: "function",
    name: "submitReview",
    stateMutability: "nonpayable",
    inputs: [
      { name: "reviewee", type: "address" },
      { name: "content", type: "string" },
      { name: "emoji", type: "uint8" },
      { name: "maxHuntAmount", type: "uint256" },
    ],
    outputs: [{ name: "reviewId", type: "uint256" }],
  },
  {
    type: "function",
    name: "getReviewsForWallet",
    stateMutability: "view",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "reviewer", type: "address" },
          { name: "reviewee", type: "address" },
          { name: "content", type: "string" },
          { name: "emoji", type: "uint8" },
          { name: "timestamp", type: "uint256" },
        ],
      },
      { name: "reviewIds", type: "uint256[]" },
    ],
  },
  {
    type: "function",
    name: "getReviewsByReviewer",
    stateMutability: "view",
    inputs: [{ name: "reviewer", type: "address" }],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "reviewer", type: "address" },
          { name: "reviewee", type: "address" },
          { name: "content", type: "string" },
          { name: "emoji", type: "uint8" },
          { name: "timestamp", type: "uint256" },
        ],
      },
      { name: "reviewIds", type: "uint256[]" },
    ],
  },
  {
    type: "function",
    name: "getRecentReviews",
    stateMutability: "view",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "reviewer", type: "address" },
          { name: "reviewee", type: "address" },
          { name: "content", type: "string" },
          { name: "emoji", type: "uint8" },
          { name: "timestamp", type: "uint256" },
        ],
      },
      { name: "reviewIds", type: "uint256[]" },
    ],
  },
  {
    type: "function",
    name: "getReviewCount",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "estimateReviewCost",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "huntAmount", type: "uint256" },
      { name: "royalty", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "totalReviews",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "reviews",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "reviewer", type: "address" },
      { name: "reviewee", type: "address" },
      { name: "content", type: "string" },
      { name: "emoji", type: "uint8" },
      { name: "timestamp", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "ReviewSubmitted",
    inputs: [
      { name: "reviewId", type: "uint256", indexed: true },
      { name: "reviewer", type: "address", indexed: true },
      { name: "reviewee", type: "address", indexed: true },
      { name: "content", type: "string", indexed: false },
      { name: "emoji", type: "uint8", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

// ERC20 ABI for HUNT token
export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

// Create public client for reading with RPC fallback
export const publicClient = createPublicClient({
  chain: base,
  transport: _getTransport(BASE_RPC_ENDPOINTS),
});

// Get wallet client for writing
export function getWalletClient() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No ethereum provider found");
  }

  return createWalletClient({
    chain: base,
    transport: custom(window.ethereum),
  });
}

/**
 * Estimate HUNT cost for submitting a review
 */
export async function estimateReviewCost(): Promise<{
  huntAmount: bigint;
  royalty: bigint;
}> {
  try {
    const [huntAmount, royalty] = (await publicClient.readContract({
      address: REVIEWME_CONTRACT_ADDRESS,
      abi: REVIEWME_ABI,
      functionName: "estimateReviewCost",
    })) as [bigint, bigint];

    return { huntAmount, royalty };
  } catch (error: any) {
    console.error("Failed to estimate review cost:", error);

    // If contract call fails, try calling Mint Club Bond directly
    try {
      const MINTCLUB_BOND_ADDRESS =
        "0xc5a076cad94176c2996B32d8466Be1cE757FAa27" as const;
      // Use the exported constant instead of hardcoded old address
      const TOKENS_PER_REVIEW = parseEther("100");

      const MINTCLUB_BOND_ABI = [
        {
          type: "function",
          name: "getPriceForTokens",
          stateMutability: "view",
          inputs: [
            { name: "token", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [
            { name: "reserveAmount", type: "uint256" },
            { name: "royalty", type: "uint256" },
          ],
        },
        {
          type: "function",
          name: "priceForNextMint",
          stateMutability: "view",
          inputs: [{ name: "token", type: "address" }],
          outputs: [{ name: "", type: "uint256" }],
        },
      ] as const;

      console.log(
        "Using fallback estimation with token:",
        REVIEWME_TOKEN_ADDRESS
      );

      try {
        // First try getPriceForTokens directly
        const [reserveAmount, royalty] = (await publicClient.readContract({
          address: MINTCLUB_BOND_ADDRESS,
          abi: MINTCLUB_BOND_ABI,
          functionName: "getPriceForTokens",
          args: [REVIEWME_TOKEN_ADDRESS, TOKENS_PER_REVIEW],
        })) as [bigint, bigint];

        return { huntAmount: reserveAmount, royalty };
      } catch (priceError) {
        console.warn(
          "getPriceForTokens failed, trying priceForNextMint approximation:",
          priceError
        );

        // Fallback: Calculate based on priceForNextMint
        const price = (await publicClient.readContract({
          address: MINTCLUB_BOND_ADDRESS,
          abi: MINTCLUB_BOND_ABI,
          functionName: "priceForNextMint",
          args: [REVIEWME_TOKEN_ADDRESS],
        })) as bigint;

        // Calculate cost for 100 tokens
        // Note: This is an approximation. Bonding curve price increases as we mint.
        // We add a 20% buffer to be safe.
        const estimatedCost = price * 100n;
        const safeCost = (estimatedCost * 120n) / 100n;

        console.log(
          `Estimated cost via priceForNextMint: ${formatEther(
            estimatedCost
          )} HUNT`
        );
        console.log(`Safe fallback cost: ${formatEther(safeCost)} HUNT`);

        return {
          huntAmount: safeCost,
          royalty: 0n, // Royalty is usually small, buffer should cover it
        };
      }
    } catch (directError) {
      console.error("All estimation methods failed:", directError);

      // Final Fallback: Return a safe default (1 HUNT)
      // 0.001 HUNT was too low for the new token
      console.warn("Using final safe fallback: 1.0 HUNT");
      return {
        huntAmount: parseEther("1.0"),
        royalty: 0n,
      };
    }
  }
}

/**
 * Check HUNT token allowance
 */
export async function checkHuntAllowance(
  owner: `0x${string}`
): Promise<bigint> {
  try {
    const allowance = (await publicClient.readContract({
      address: HUNT_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [owner, REVIEWME_CONTRACT_ADDRESS],
    })) as bigint;

    return allowance;
  } catch (error) {
    console.error("Failed to check HUNT allowance:", error);
    throw error;
  }
}

/**
 * Approve HUNT tokens for ReviewMe contract
 */
export async function approveHunt(
  amount: bigint,
  walletClient?: any
): Promise<`0x${string}`> {
  try {
    const client = walletClient || getWalletClient();
    const account = client.account || (await client.getAddresses())[0];

    const hash = await client.writeContract({
      address: HUNT_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [REVIEWME_CONTRACT_ADDRESS, amount],
      account,
    });

    // Wait for transaction confirmation
    await publicClient.waitForTransactionReceipt({ hash });

    return hash;
  } catch (error) {
    console.error("Failed to approve HUNT:", error);
    throw error;
  }
}

/**
 * Submit a review
 */
export async function submitReview(
  reviewee: `0x${string}`,
  content: string,
  emoji: number,
  maxHuntAmount: bigint,
  walletClient?: any
): Promise<{ hash: `0x${string}`; reviewId: bigint }> {
  const client = walletClient || getWalletClient();
  let account = client.account;
  if (!account) {
    const addresses = await client.getAddresses();
    account = addresses[0];
  }

  try {
    // Skip simulation and just submit the transaction directly
    // Simulation can sometimes fail even when the actual transaction would succeed
    console.log("Submitting review transaction...");
    const hash = await client.writeContract({
      address: REVIEWME_CONTRACT_ADDRESS,
      abi: REVIEWME_ABI,
      functionName: "submitReview",
      args: [reviewee, content, emoji, maxHuntAmount],
      account,
    });

    console.log("Transaction submitted:", hash);

    // Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Parse logs to get reviewId
    // For now, return 0 as reviewId (can be parsed from events later)

    return { hash, reviewId: 0n };
  } catch (error: any) {
    console.error("Failed to submit review:", error);

    // Handle common errors
    if (
      error?.message?.includes("User rejected") ||
      error?.message?.includes("User denied")
    ) {
      throw new Error("Transaction was rejected by user.");
    }

    // Try to extract the old simulation error handling logic
    try {
      await publicClient.simulateContract({
        address: REVIEWME_CONTRACT_ADDRESS,
        abi: REVIEWME_ABI,
        functionName: "submitReview",
        args: [reviewee, content, emoji, maxHuntAmount],
        account,
      });
    } catch (simulateError: any) {
      console.error("Simulation failed:", simulateError);

      // Extract revert reason if available
      let errorMessage = "Transaction simulation failed";
      if (simulateError?.cause?.reason) {
        errorMessage = simulateError.cause.reason;
      } else if (simulateError?.message) {
        errorMessage = simulateError.message;
      } else if (simulateError?.shortMessage) {
        errorMessage = simulateError.shortMessage;
      }

      // Check for common revert reasons
      if (errorMessage.includes("Invalid emoji")) {
        throw new Error(
          "Invalid emoji selected. Please select an emoji between 1-5."
        );
      } else if (errorMessage.includes("Invalid reviewee")) {
        throw new Error("Invalid reviewee address.");
      } else if (errorMessage.includes("Cannot review yourself")) {
        throw new Error("You cannot review yourself.");
      } else if (errorMessage.includes("Content too long")) {
        throw new Error(`Review content must be ${150} characters or less.`);
      } else if (
        errorMessage.includes("transfer amount exceeds balance") ||
        errorMessage.includes("insufficient funds") ||
        errorMessage.includes("insufficient balance") ||
        errorMessage.includes("ERC20: transfer amount exceeds balance")
      ) {
        // Check user's HUNT balance
        try {
          const balance = (await publicClient.readContract({
            address: HUNT_TOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [account],
          })) as bigint;

          const formattedBalance = formatEther(balance);
          const formattedMaxAmount = formatEther(maxHuntAmount);

          throw new Error(
            `Insufficient HUNT balance. You have ${formattedBalance} HUNT, but need ${formattedMaxAmount} HUNT. ` +
              `Please ensure you have enough HUNT tokens in your wallet.`
          );
        } catch (balanceError) {
          throw new Error(
            `Insufficient HUNT balance. The transaction requires ${formatEther(
              maxHuntAmount
            )} HUNT tokens. ` +
              `Please ensure you have enough HUNT tokens in your wallet.`
          );
        }
      } else if (errorMessage.includes("allowance")) {
        throw new Error(
          "Insufficient HUNT allowance. Please approve HUNT spending first."
        );
      } else if (
        errorMessage.includes("getPriceForTokens") ||
        errorMessage.includes("mint")
      ) {
        throw new Error(
          "Failed to mint ReviewMe tokens. The Mint Club Bond contract may be experiencing issues. Please try again later."
        );
      }

      // Generic error message
      throw new Error(`Transaction failed: ${errorMessage}`);
    }

    // If we get here, re-throw the original error
    throw error;
  }
}

/**
 * Get reviews for a specific wallet with reviewIds (paginated)
 * @param wallet - Wallet address to get reviews for
 * @param offset - Offset for pagination (default: 0)
 * @param limit - Maximum number of reviews to return (default: 1000 for backward compatibility)
 */
export async function getReviewsForWallet(
  wallet: `0x${string}`,
  offset: number = 0,
  limit: number = 1000
): Promise<Review[]> {
  try {
    const [reviews, reviewIds] = (await publicClient.readContract({
      address: REVIEWME_CONTRACT_ADDRESS,
      abi: REVIEWME_ABI,
      functionName: "getReviewsForWallet",
      args: [wallet, BigInt(offset), BigInt(limit)],
    })) as [any[], bigint[]];

    return reviews.map((r, index) => ({
      reviewer: r.reviewer,
      reviewee: r.reviewee,
      content: r.content,
      emoji: Number(r.emoji),
      timestamp: r.timestamp,
      reviewId: Number(reviewIds[index]),
    }));
  } catch (error) {
    console.error("Failed to get reviews for wallet:", error);
    throw error;
  }
}

/**
 * Get reviews written by a specific reviewer with reviewIds
 */
export async function getReviewsByReviewer(
  reviewer: `0x${string}`
): Promise<Review[]> {
  try {
    const [reviews, reviewIds] = (await publicClient.readContract({
      address: REVIEWME_CONTRACT_ADDRESS,
      abi: REVIEWME_ABI,
      functionName: "getReviewsByReviewer",
      args: [reviewer],
    })) as [any[], bigint[]];

    return reviews.map((r, index) => ({
      reviewer: r.reviewer,
      reviewee: r.reviewee,
      content: r.content,
      emoji: Number(r.emoji),
      timestamp: r.timestamp,
      reviewId: Number(reviewIds[index]),
    }));
  } catch (error) {
    console.error("Failed to get reviews by reviewer:", error);
    throw error;
  }
}

/**
 * Get recent reviews (paginated) with reviewIds
 * Uses API route on client-side to avoid CORS issues, direct RPC on server-side
 */
export async function getRecentReviews(
  offset: number = 0,
  limit: number = 20
): Promise<Review[]> {
  // On client-side, use API route to avoid CORS issues
  if (typeof window !== "undefined") {
    try {
      const response = await fetch(
        `/api/reviews/recent?offset=${offset}&limit=${limit}`
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to fetch reviews: ${response.statusText}`
        );
      }
      const data = await response.json();
      // Convert timestamp string back to bigint
      return data.map((r: any) => ({
        ...r,
        timestamp: BigInt(r.timestamp),
      })) as Review[];
    } catch (error) {
      console.error("Failed to get recent reviews:", error);
      throw error;
    }
  }

  // On server-side, use direct RPC call
  try {
    const [reviews, reviewIds] = (await publicClient.readContract({
      address: REVIEWME_CONTRACT_ADDRESS,
      abi: REVIEWME_ABI,
      functionName: "getRecentReviews",
      args: [BigInt(offset), BigInt(limit)],
    })) as [any[], bigint[]];

    return reviews.map((r, index) => ({
      reviewer: r.reviewer,
      reviewee: r.reviewee,
      content: r.content,
      emoji: Number(r.emoji),
      timestamp: r.timestamp,
      reviewId: Number(reviewIds[index]),
    }));
  } catch (error) {
    console.error("Failed to get recent reviews:", error);
    throw error;
  }
}

/**
 * Get transaction hashes for multiple review IDs (batch)
 * Uses server-side API route to avoid CORS and minimize RPC calls
 */
export async function getTxHashesForReviewIds(
  reviewIds: number[]
): Promise<Record<number, string>> {
  if (reviewIds.length === 0) {
    return {};
  }

  try {
    const response = await fetch("/api/reviews/tx-hashes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reviewIds }),
    });

    if (!response.ok) {
      console.warn("Failed to fetch tx hashes, continuing without them");
      return {};
    }

    const data = await response.json();
    return data.txHashes || {};
  } catch (error) {
    console.warn("Failed to fetch tx hashes:", error);
    return {};
  }
}

/**
 * Get review count for a wallet
 */
export async function getReviewCount(wallet: `0x${string}`): Promise<number> {
  try {
    const count = (await publicClient.readContract({
      address: REVIEWME_CONTRACT_ADDRESS,
      abi: REVIEWME_ABI,
      functionName: "getReviewCount",
      args: [wallet],
    })) as bigint;

    return Number(count);
  } catch (error) {
    console.error("Failed to get review count:", error);
    throw error;
  }
}

/**
 * Get total reviews count
 */
export async function getTotalReviews(): Promise<number> {
  try {
    const count = (await publicClient.readContract({
      address: REVIEWME_CONTRACT_ADDRESS,
      abi: REVIEWME_ABI,
      functionName: "totalReviews",
    })) as bigint;

    return Number(count);
  } catch (error) {
    console.error("Failed to get total reviews:", error);
    throw error;
  }
}

/**
 * Check HUNT balance
 */
export async function getHuntBalance(account: `0x${string}`): Promise<bigint> {
  try {
    const balance = (await publicClient.readContract({
      address: HUNT_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account],
    })) as bigint;

    return balance;
  } catch (error) {
    console.error("Failed to get HUNT balance:", error);
    throw error;
  }
}

/**
 * Format HUNT amount for display
 */
export function formatHunt(amount: bigint): string {
  return formatEther(amount);
}

/**
 * Parse HUNT amount from string
 */
export function parseHunt(amount: string): bigint {
  return parseEther(amount);
}
