import { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

export type Platform = 'farcaster' | 'base' | 'web';

export function usePlatformDetection() {
  const [platform, setPlatform] = useState<Platform>('web');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function detect() {
      try {
        // SDK context 가져오기
        const context = await sdk.context;
        
        if (context && context.client) {
          // Base App 체크 (clientFid === 309857)
          if (context.client.clientFid === 309857) {
            setPlatform('base');
          } else {
            // 일반 Farcaster 앱 (Warpcast 등)
            setPlatform('farcaster');
          }
        } else {
          // 웹 브라우저
          setPlatform('web');
        }
      } catch (error) {
        console.log('Not running in mini app, defaulting to web');
        setPlatform('web');
      } finally {
        setIsLoading(false);
      }
    }

    detect();
  }, []);

  return { platform, isLoading };
}

