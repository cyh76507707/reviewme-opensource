import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http, formatEther, fallback } from "viem";
import { base } from "viem/chains";
import { BASE_RPC_ENDPOINTS } from "@/lib/reviewme-contract";

interface TokenInfo {
  price: number;
  marketCap: number;
  totalSupply: number;
  priceChange24h: number | null;
}

const RM_TOKEN_ADDRESS =
  "0x37B44b8abB2DeFB35E704306913400888bbdE792" as `0x${string}`;
const HUNT_TOKEN_ADDRESS =
  "0x37f0c2915CeCC7e977183B8543Fc0864d03E064C" as `0x${string}`;
const USDC_TOKEN_ADDRESS =
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as `0x${string}`; // USDC on Base (lowercase)
const MCV2_BOND_ADDRESS =
  "0xc5a076cad94176c2996B32d8466Be1cE757FAa27" as `0x${string}`;
const ONEINCH_SPOT_PRICE_AGGREGATOR =
  "0x00000000000D6FFc74A8feb35aF5827bf57f6786" as `0x${string}`; // 1inch Spot Price Aggregator on Base (correct address from mintpad)

// ABIs
const SPOT_PRICE_ABI = [
  {
    inputs: [
      { name: "srcToken", type: "address" },
      { name: "dstToken", type: "address" },
      { name: "useWrappers", type: "bool" },
    ],
    name: "getRate",
    outputs: [{ name: "weightedRate", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const MCV2_BOND_ABI = [
  {
    inputs: [{ name: "token", type: "address" }],
    name: "priceForNextMint",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const ERC20_ABI = [
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Create a public client for Base with fallback (no wallet needed)
const publicClient = createPublicClient({
  chain: base,
  transport: fallback(
    BASE_RPC_ENDPOINTS.map((url) =>
      http(url, {
        timeout: 2_000,
        retryCount: 0,
        batch: true,
      })
    ),
    { rank: false }
  ),
});

/**
 * Get HUNT price in USD from 1inch spot price aggregator
 */
async function getHuntPrice(blockNumber?: bigint): Promise<number> {
  const weightedRate = await publicClient.readContract({
    address: ONEINCH_SPOT_PRICE_AGGREGATOR,
    abi: SPOT_PRICE_ABI,
    functionName: "getRate",
    args: [HUNT_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS, false],
    ...(blockNumber ? { blockNumber } : {}), // Only include blockNumber if defined
  });
  return Number(weightedRate) / 1_000_000;
}

/**
 * Get token price in USD
 */
async function getTokenPrice(blockNumber?: bigint): Promise<number> {
  const tokenPriceInHuntWei = await publicClient.readContract({
    address: MCV2_BOND_ADDRESS,
    abi: MCV2_BOND_ABI,
    functionName: "priceForNextMint",
    args: [RM_TOKEN_ADDRESS],
    ...(blockNumber ? { blockNumber } : {}), // Only include blockNumber if defined
  });
  const tokenPriceInHunt = Number(formatEther(tokenPriceInHuntWei));
  const huntPrice = await getHuntPrice(blockNumber);
  return tokenPriceInHunt * huntPrice;
}

/**
 * Hook to fetch token info (like mintpad implementation)
 */
export function useTokenInfo() {
  return useQuery({
    queryKey: ["token-info", RM_TOKEN_ADDRESS],
    queryFn: async () => {
      try {
        console.log("🔍 Fetching token info...");

        // Get current block number (like mintpad does)
        let currentBlock: bigint | undefined;
        try {
          currentBlock = await publicClient.getBlockNumber();
          console.log("📦 Current block:", currentBlock);
        } catch (error) {
          console.warn(
            "⚠️ Failed to get block number, will use latest:",
            error
          );
          currentBlock = undefined; // Will use latest block
        }

        // Get current price and supply
        const [latestTokenPrice, supply] = await Promise.all([
          getTokenPrice(),
          publicClient.readContract({
            address: RM_TOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: "totalSupply",
          }),
        ]);

        console.log("💰 Latest token price:", latestTokenPrice);
        console.log("📊 Total supply:", supply);

        const totalSupply = Number(formatEther(supply));

        // Get 24h ago price (43200 blocks = 1 day) - only if we have currentBlock
        let priceChange24h: number | null = null;

        if (currentBlock) {
          try {
            const oneDayAgoBlock = currentBlock - 43_200n;
            const oneDayAgoPrice = await getTokenPrice(oneDayAgoBlock);
            if (oneDayAgoPrice > 0) {
              priceChange24h =
                ((latestTokenPrice - oneDayAgoPrice) / oneDayAgoPrice) * 100;
            }
            console.log("📈 24h price change:", priceChange24h);
          } catch (error) {
            console.warn("⚠️ Could not fetch 24h ago price:", error);
          }
        } else {
          console.log("⚠️ Skipping 24h price change (no block number)");
        }

        const marketCap = latestTokenPrice * totalSupply;

        const result = {
          price: latestTokenPrice,
          marketCap,
          totalSupply,
          priceChange24h,
        };

        console.log("✅ Token info fetched:", result);
        return result as TokenInfo;
      } catch (error) {
        console.error("❌ Error fetching token info:", error);
        throw error; // Let React Query handle the error
      }
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // Refetch every 1 minute
    retry: 2,
  });
}

/**
 * Format large numbers with K, M, B suffixes
 */
export function formatNumber(num: number): string {
  if (num === 0) return "0";

  const absNum = Math.abs(num);

  if (absNum >= 1e9) {
    return `${(num / 1e9).toFixed(2)}B`;
  }
  if (absNum >= 1e6) {
    return `${(num / 1e6).toFixed(2)}M`;
  }
  if (absNum >= 1e3) {
    return `${(num / 1e3).toFixed(2)}K`;
  }

  return num.toFixed(2);
}

/**
 * Format price with appropriate decimal places (Mint Club style - subscript notation for leading zeros)
 */
export function formatPrice(price: number): string {
  if (price === 0) return "$0";

  // For prices >= $1, show 2 decimal places
  if (price >= 1) {
    return `$${price.toFixed(2)}`;
  }

  // For prices < $1, check if we need subscript notation
  const str = price.toString();
  const match = str.match(/^0\.0+/);

  if (match) {
    const leadingZeros = match[0].length - 2; // subtract "0."

    // Only use subscript notation if there are 4 or more leading zeros
    if (leadingZeros >= 4) {
      // Get significant digits after the leading zeros
      const significantPart = str.slice(match[0].length);
      const displayDigits = significantPart.slice(0, 4); // Show 4 significant digits

      // Use Unicode subscript numbers
      const subscriptMap: { [key: string]: string } = {
        "0": "₀",
        "1": "₁",
        "2": "₂",
        "3": "₃",
        "4": "₄",
        "5": "₅",
        "6": "₆",
        "7": "₇",
        "8": "₈",
        "9": "₉",
      };
      const subscriptZeros = leadingZeros
        .toString()
        .split("")
        .map((d) => subscriptMap[d])
        .join("");

      return `$0.0${subscriptZeros}${displayDigits}`;
    }
  }

  // For other small numbers (< $1 but >= 4 leading zeros), show up to 6 decimal places
  return `$${price.toFixed(6).replace(/\.?0+$/, "")}`;
}
