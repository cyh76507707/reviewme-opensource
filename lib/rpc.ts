import { createPublicClient, http, fallback } from "viem";
import { base } from "viem/chains";

// User-friendly progress message types
export interface ProgressMessage {
  type: "info" | "success" | "warning" | "error";
  message: string;
  details?: string;
}

export interface ProgressCallback {
  onProgress?: (message: ProgressMessage) => void;
}

// Base Mainnet RPC endpoints (CORS-enabled public endpoints only)
export const RPC_ENDPOINTS = [
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
];

// RPC rotation system for rate limit mitigation
let currentRpcIndex = 0;

function getNextRpcUrl(): string {
  const rpcUrl = RPC_ENDPOINTS[currentRpcIndex];
  currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
  console.log(`Using RPC endpoint: ${rpcUrl}`);
  return rpcUrl;
}

// Helper function to get user-friendly RPC names
function getRpcDisplayName(rpcUrl: string): string {
  if (rpcUrl.includes("mainnet.base.org")) return "Base Official";
  if (rpcUrl.includes("blockpi.network")) return "BlockPI";
  if (rpcUrl.includes("llamarpc.com")) return "LlamaRPC";
  if (rpcUrl.includes("drpc.org")) return "DRPC";
  if (rpcUrl.includes("meowrpc.com")) return "MeowRPC";
  return "Unknown RPC";
}

// Enhanced RPC client with automatic fallback, faster timeout, and user-friendly messages
export async function createPublicClientWithFallback(
  progressCallback?: ProgressCallback
) {
  const maxRetries = RPC_ENDPOINTS.length;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const rpcUrl = getNextRpcUrl();
    const rpcName = getRpcDisplayName(rpcUrl);

    try {
      // Show progress message
      progressCallback?.onProgress?.({
        type: "info",
        message: `Connecting to ${rpcName}...`,
        details: `Attempt ${attempt + 1} of ${maxRetries}`,
      });

      const client = createPublicClient({
        chain: base,
        transport: http(rpcUrl, {
          timeout: 2000, // 5 second timeout
          retryCount: 0, // Reduce retry count
        }),
      });

      // Test the connection with a simple call and timeout
      const chainIdPromise = client.getChainId();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Connection timeout")), 3000)
      );

      await Promise.race([chainIdPromise, timeoutPromise]);

      // Success message
      progressCallback?.onProgress?.({
        type: "success",
        message: `Connected to ${rpcName}`,
        details: "Ready to process your request",
      });

      console.log(`Successfully connected to RPC: ${rpcUrl}`);
      return client;
    } catch (error) {
      lastError = error as Error;
      console.warn(`RPC attempt ${attempt + 1} failed:`, error);

      // Show failure message with countdown
      const remainingAttempts = maxRetries - attempt - 1;
      if (remainingAttempts > 0) {
        progressCallback?.onProgress?.({
          type: "warning",
          message: `${rpcName} connection failed`,
          details: `Trying next RPC in 1 second... (${remainingAttempts} attempts remaining)`,
        });

        // Wait 1 second before next attempt
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // If it's a CORS error, network error, or timeout, try next RPC immediately
      if (
        error instanceof Error &&
        (error.message.includes("CORS") ||
          error.message.includes("Failed to fetch") ||
          error.message.includes("rate limited") ||
          error.message.includes("over rate limit") ||
          error.message.includes("HTTP request failed") ||
          error.message.includes("timeout") ||
          error.message.includes("Connection timeout"))
      ) {
        console.log("Network/CORS/timeout error detected, trying next RPC...");
        continue;
      }
    }
  }

  // All RPCs failed
  progressCallback?.onProgress?.({
    type: "error",
    message: "All RPC endpoints failed",
    details: `Last error: ${lastError?.message}`,
  });

  throw new Error(
    `All RPC endpoints failed. Last error: ${lastError?.message}`
  );
}

// Simple rotation without fallback (for non-critical operations)
// Use fallback transport to automatically try next RPC on failure
export function createPublicClientWithRotation() {
  return createPublicClient({
    chain: base,
    transport: fallback(
      RPC_ENDPOINTS.map((url) =>
        http(url, {
          timeout: 2000,
          retryCount: 0,
        })
      ),
      {
        rank: false, // Use round-robin instead of ranking
      }
    ),
  });
}
