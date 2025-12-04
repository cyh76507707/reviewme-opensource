import { createConfig, http, fallback } from "wagmi";
import { base } from "wagmi/chains";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  coinbaseWallet,
  trustWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { BASE_RPC_ENDPOINTS } from "./reviewme-contract";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID";

/**
 * Create transport with RPC fallback
 * Uses free public RPC endpoints with automatic fallback
 */
function getTransport() {
  const endpoints: string[] = [...BASE_RPC_ENDPOINTS];

  // Add custom RPC URL if provided (highest priority)
  if (process.env.NEXT_PUBLIC_BASE_RPC_URL) {
    endpoints.unshift(process.env.NEXT_PUBLIC_BASE_RPC_URL);
  }

  return fallback(
    endpoints.map((url) =>
      http(url, {
        timeout: 2_000,
        retryCount: 0,
      })
    ),
    { rank: false } // Try endpoints sequentially
  );
}

// Configure wallet list for RainbowKit
// Farcaster miniapp connector will be added separately to maintain priority
const walletConnectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, coinbaseWallet, trustWallet],
    },
    {
      groupName: "Other",
      wallets: [rainbowWallet, walletConnectWallet],
    },
  ],
  {
    appName: "ReviewMe",
    projectId,
  }
);

// Add Farcaster miniapp connector at the beginning (highest priority for auto-connect)
const connectors = [farcasterMiniApp(), ...walletConnectors];

export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: getTransport(), // Fallback RPC with 12+ endpoints
  },
  connectors,
  ssr: true,
});
