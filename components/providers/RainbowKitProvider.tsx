'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { config } from '@/lib/wagmi';
import { useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { reconnect } from 'wagmi/actions';

const queryClient = new QueryClient();

export function RainbowKitWrapper({ children }: { children: React.ReactNode }) {
  // Attempt Farcaster Mini App wallet auto-connect without affecting web
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Some environments may not support wallet API
        const getProvider = (sdk as any)?.wallet?.getEthereumProvider;
        if (!getProvider) return;

        const provider = await getProvider();
        if (!provider || cancelled) return;

        // Expose as injected provider for wagmi injected connector
        // Do not overwrite if already present
        if (typeof window !== 'undefined' && !(window as any).ethereum) {
          (window as any).ethereum = provider as any;
        }

        // Let wagmi reconnect using available connectors
        try {
          await reconnect(config);
        } catch {
          // Non-fatal; user can still connect manually
        }
      } catch {
        // Ignore auto-connect failures silently
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#ec4899',
            accentColorForeground: 'white',
            borderRadius: 'medium',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
