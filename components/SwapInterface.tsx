'use client';

import { usePlatformDetection } from '@/lib/hooks/usePlatformDetection';
import { sdk } from '@farcaster/miniapp-sdk';
import { useState } from 'react';
import { ArrowUpDown, ExternalLink } from 'lucide-react';

const RM_TOKEN_ADDRESS = '0x37B44b8abB2DeFB35E704306913400888bbdE792';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const UNISWAP_URL = `https://app.uniswap.org/swap?outputCurrency=${RM_TOKEN_ADDRESS}&chain=base`;

export default function SwapInterface() {
  const { platform, isLoading } = usePlatformDetection();
  const [swapLoading, setSwapLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Farcaster/Base SDK swapToken 호출
  const handleNativeSwap = async () => {
    try {
      setSwapLoading(true);
      setError(null);
      
      const result = await sdk.actions.swapToken({
        // USDC → RM (사용자가 수정 가능)
        sellToken: `eip155:8453/erc20:${USDC_ADDRESS}`,
        buyToken: `eip155:8453/erc20:${RM_TOKEN_ADDRESS}`,
      });

      if (result.success) {
        console.log('Swap successful:', result.swap.transactions);
        // 성공 처리 - 잔액 자동 업데이트됨
      } else {
        console.error('Swap failed:', result.reason);
        if (result.reason === 'rejected_by_user') {
          setError('Swap cancelled by user');
        } else {
          setError('Swap failed. Please try again.');
        }
      }
    } catch (err) {
      console.error('Swap error:', err);
      setError('Failed to open swap interface');
    } finally {
      setSwapLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-2xl border border-pink-500/20 p-6 shadow-xl">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500" />
        </div>
      </div>
    );
  }

  // Farcaster 앱 또는 Base App
  if (platform === 'farcaster' || platform === 'base') {
    const platformName = platform === 'base' ? 'Base App' : 'Farcaster';
    
    return (
      <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-2xl border border-pink-500/20 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Swap to $RM</h2>
          <div className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded-md">
            <span className="text-xs text-blue-300 font-medium">{platformName}</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <button
          onClick={handleNativeSwap}
          disabled={swapLoading}
          className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-pink-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {swapLoading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              <span>Opening Swap...</span>
            </>
          ) : (
            <>
              <ArrowUpDown className="w-5 h-5" />
              <span>Swap Tokens</span>
            </>
          )}
        </button>

        <p className="text-sm text-gray-400 text-center">
          Opens {platformName}'s native swap interface
        </p>
      </div>
    );
  }

  // 웹 브라우저 - Uniswap 링크
  return (
    <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-2xl border border-pink-500/20 p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Swap to $RM</h2>
        <div className="px-2 py-1 bg-gray-700/50 border border-gray-600/30 rounded-md">
          <span className="text-xs text-gray-400 font-medium">Web</span>
        </div>
      </div>

      <a
        href={UNISWAP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-pink-500/20 flex items-center justify-center gap-2"
      >
        <ArrowUpDown className="w-5 h-5" />
        <span>Swap on Uniswap</span>
        <ExternalLink className="w-4 h-4" />
      </a>

      <p className="text-sm text-gray-400 text-center">
        Opens Uniswap in a new tab
      </p>
    </div>
  );
}

