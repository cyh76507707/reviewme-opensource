'use client';

import { FrameProvider } from '@/components/providers/FrameProvider';
import { RainbowKitWrapper } from '@/components/providers/RainbowKitProvider';

import { useEffect } from 'react';
import { cleanOldCache } from '@/lib/cache';

export function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  // Run cache cleanup on mount
  // Note: DB_VERSION increment in lib/cache.ts will automatically reset IndexedDB
  // when the app loads, clearing all cached data
  useEffect(() => {
    cleanOldCache();
  }, []);

  return (
    <RainbowKitWrapper>
      <FrameProvider>
        {children}
      </FrameProvider>
    </RainbowKitWrapper>
  );
}

