'use client';

import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { erc20Abi } from 'viem';
import { Coins, ExternalLink, Copy, Check, Flame, TrendingUp, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import SwapInterface from '@/components/SwapInterface';
import Image from 'next/image';
import { useTokenInfo, formatNumber, formatPrice } from '@/lib/hooks/useTokenInfo';

const RM_TOKEN_ADDRESS = '0x37B44b8abB2DeFB35E704306913400888bbdE792' as const;
const BASESCAN_URL = `https://basescan.org/token/${RM_TOKEN_ADDRESS}`;

export default function TokenPage() {
  const { address, isConnected } = useAccount();
  const [copied, setCopied] = useState(false);

  // Fetch token info from RPC
  const { data: tokenInfo, isLoading: tokenInfoLoading } = useTokenInfo();

  // Read RM token balance (no caching - real-time data is important)
  const { data: balance, isLoading: balanceLoading } = useReadContract({
    address: RM_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const formattedBalance = balance ? formatUnits(balance, 18) : '0';

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(RM_TOKEN_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black pb-24 md:pb-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-4">
          {/* Token Icon with Glow Border */}
          <div className="relative inline-block">
            {/* Animated glow border */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 blur-xl opacity-75 animate-pulse" />
            
            {/* Token image with border */}
            <div className="relative">
              <div className="relative w-32 h-32 rounded-full p-1 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 animate-pulse">
                <Image 
                  src="/app-icon.png" 
                  alt="RM Token" 
                  width={120} 
                  height={120}
                  className="rounded-full w-full h-full"
                />
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-4xl font-bold text-white mb-2" style={{ fontFamily: "'Poetsen One', cursive" }}>
              ReviewMe (RM)
            </h1>
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              Base token that grows in utility as onchain reviews increase
            </p>
          </div>
        </div>

        {/* Balance Card */}
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-2xl border border-pink-500/20 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Your Balance</h2>
            {isConnected && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Connected
              </div>
            )}
          </div>

          {!isConnected ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">Connect your wallet to view balance</p>
              <div className="text-gray-500 text-sm">
                Use the "Connect Wallet" button above
              </div>
            </div>
          ) : balanceLoading ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-pink-500" />
                <p className="text-gray-400 text-sm">Loading balance...</p>
              </div>
              <div className="h-12 bg-gray-700/30 rounded-lg animate-pulse" />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
                {parseFloat(formattedBalance).toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })} RM
              </div>
              <div className="flex items-center gap-2 text-sm">
                {tokenInfo && tokenInfo.price > 0 && (
                  <span className="text-gray-400">
                    ${(parseFloat(formattedBalance) * tokenInfo.price).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                )}
                <span className="text-gray-500">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Swap Interface */}
        <SwapInterface />

        {/* Token Mechanism */}
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-2xl border border-pink-500/20 p-6 shadow-xl space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-pink-500 to-purple-500 rounded-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-white">How $RM Works</h2>
          </div>

          {/* Minting */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center">
                <Coins className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Minting</h3>
                <p className="text-gray-400 text-sm">
                  Every onchain review mints <span className="text-green-400 font-semibold">100 RM</span> tokens
                </p>
              </div>
            </div>

            {/* Distribution */}
            <div className="ml-11 pl-4 border-l-2 border-gray-700/50 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">→ Reviewer</span>
                <span className="text-white font-semibold">89 RM</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">→ Reviewee</span>
                <span className="text-white font-semibold">10 RM</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">→ Burn</span>
                <span className="text-orange-400 font-semibold flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                  1 RM
                </span>
              </div>
            </div>
          </div>

          {/* Burn Mechanism */}
          <div className="space-y-3 pt-4 border-t border-gray-700/50">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-orange-500/20 border border-orange-500/30 rounded-full flex items-center justify-center">
                <Flame className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Deflationary Model</h3>
                <p className="text-gray-400 text-sm">
                  <span className="text-orange-400 font-semibold">1% of every mint is permanently burned</span>, 
                  creating a deflationary pressure that increases scarcity over time
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700/50">
            <div className="text-center p-3 bg-gray-900/50 rounded-lg">
              <div className="text-2xl font-bold text-green-400">+100</div>
              <div className="text-xs text-gray-500 mt-1">Per Review</div>
            </div>
            <div className="text-center p-3 bg-gray-900/50 rounded-lg">
              <div className="text-2xl font-bold text-orange-400 flex items-center justify-center gap-1">
                <Flame className="w-5 h-5" />
                -1%
              </div>
              <div className="text-xs text-gray-500 mt-1">Burn Rate</div>
            </div>
          </div>
        </div>

        {/* Token Info */}
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-2xl border border-pink-500/20 p-6 shadow-xl space-y-6">
          <h2 className="text-lg font-semibold text-white">Token Information</h2>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50">
              <div className="text-xs text-gray-400 mb-1">Price</div>
              {tokenInfoLoading ? (
                <div className="h-7 bg-gray-800/50 rounded animate-pulse" />
              ) : (
                <div className="space-y-1">
                  <div className="text-lg font-bold text-white">
                    {formatPrice(tokenInfo?.price || 0)}
                  </div>
                  {tokenInfo?.priceChange24h !== null && tokenInfo?.priceChange24h !== undefined && (
                    <div className={`flex items-center gap-1 text-xs ${
                      tokenInfo.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {tokenInfo.priceChange24h >= 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      <span>
                        {tokenInfo.priceChange24h >= 0 ? '+' : ''}
                        {tokenInfo.priceChange24h.toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50">
              <div className="text-xs text-gray-400 mb-1">Market Cap</div>
              {tokenInfoLoading ? (
                <div className="h-7 bg-gray-800/50 rounded animate-pulse" />
              ) : (
                <div className="text-lg font-bold text-white">
                  ${formatNumber(tokenInfo?.marketCap || 0)}
                </div>
              )}
            </div>
          </div>

          {/* Links Section */}
          <div className="space-y-3 pt-2">
            {/* Mint Club */}
            <a
              href="https://mint.club/token/base/RM"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-gray-900/30 hover:bg-gray-900/50 rounded-lg transition-colors border border-gray-700/30 hover:border-gray-600/50"
            >
              <div className="flex items-center gap-3">
                <Image 
                  src="/mc-icon-light.svg" 
                  alt="Mint Club" 
                  width={20} 
                  height={20}
                  className="w-5 h-5"
                />
                <span className="text-sm text-gray-300">View on Mint Club</span>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-400" />
            </a>

            {/* BaseScan - Contract Address */}
            <a
              href={BASESCAN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-gray-900/30 hover:bg-gray-900/50 rounded-lg transition-colors border border-gray-700/30 hover:border-gray-600/50"
            >
              <div className="flex items-center gap-3">
                <Image 
                  src="/basescan-icon.svg" 
                  alt="BaseScan" 
                  width={20} 
                  height={20}
                  className="w-5 h-5"
                />
                <div className="flex flex-col">
                  <span className="text-xs text-gray-400">Contract Address</span>
                  <code className="text-sm text-pink-400 font-mono">
                    {RM_TOKEN_ADDRESS.slice(0, 6)}...{RM_TOKEN_ADDRESS.slice(-6)}
                  </code>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    handleCopyAddress();
                  }}
                  className="p-1.5 hover:bg-gray-700/50 rounded transition-colors"
                  title="Copy address"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </div>
            </a>

            {/* Network Info */}
            <div className="flex items-center justify-between p-3 bg-gray-900/30 rounded-lg border border-gray-700/30">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                </div>
                <span className="text-sm text-gray-300">Base Mainnet (ERC-20)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-300 text-sm text-center">
            💡 RM tokens are earned and used for writing onchain reviews
          </p>
        </div>
      </div>
    </div>
  );
}

