'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Gift, Check, Lock, Loader2, Sparkles, AlertCircle, Clock, Zap, ExternalLink } from 'lucide-react';
import { 
  useStreakInfo, 
  usePoolInfo, 
  useClaimStreak,
  useIsStreakConfigured,
  useTimingInfo,
  STREAK_AIRDROP_ADDRESS 
} from '@/lib/hooks/useStreak';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';

// Reward amounts for each day
const REWARDS = ['10', '10', '10', '20', '20', '20', '50'];
const TOTAL_WEEK_REWARD = REWARDS.reduce((a, b) => a + Number(b), 0);

// Day card icons/emojis for visual variety
const DAY_ICONS = ['💎', '💎', '💎', '🎁', '🎁', '🎁', '🏆'];

// Countdown timer component
function CountdownTimer({ 
  secondsRemaining, 
  isTestMode,
  onComplete 
}: { 
  secondsRemaining: number; 
  isTestMode: boolean;
  onComplete?: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState(secondsRemaining);
  const [hasCompleted, setHasCompleted] = useState(false);

  useEffect(() => {
    setTimeLeft(secondsRemaining);
    setHasCompleted(false);
  }, [secondsRemaining]);

  useEffect(() => {
    if (timeLeft <= 0) {
      if (!hasCompleted && onComplete) {
        setHasCompleted(true);
        onComplete();
      }
      return;
    }
    
    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft, hasCompleted, onComplete]);

  // Format time
  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  const formatNumber = (n: number) => n.toString().padStart(2, '0');

  if (isTestMode) {
    // For test mode (1-minute days), just show MM:SS
    return (
      <div className="flex items-center gap-1.5 font-mono">
        <span className="text-2xl font-bold text-white">{formatNumber(minutes)}</span>
        <span className="text-pink-400">:</span>
        <span className="text-2xl font-bold text-white">{formatNumber(seconds)}</span>
      </div>
    );
  }

  // For production (24-hour days), show HH:MM:SS
  return (
    <div className="flex items-center gap-1.5 font-mono">
      <span className="text-2xl font-bold text-white">{formatNumber(hours)}</span>
      <span className="text-pink-400">:</span>
      <span className="text-2xl font-bold text-white">{formatNumber(minutes)}</span>
      <span className="text-pink-400">:</span>
      <span className="text-2xl font-bold text-white">{formatNumber(seconds)}</span>
    </div>
  );
}

export default function StreakPage() {
  const { address, isConnected } = useAccount();
  const isConfigured = useIsStreakConfigured();
  const { data: streakInfo, isLoading: isLoadingStreak, refetch: refetchStreak } = useStreakInfo();
  const { data: poolInfo, isLoading: isLoadingPool } = usePoolInfo();
  const { data: timingInfo, refetch: refetchTiming } = useTimingInfo();
  const claimMutation = useClaimStreak();
  const [showSuccess, setShowSuccess] = useState(false);

  // Refetch all data
  const refetchAll = useCallback(() => {
    refetchStreak();
    refetchTiming();
  }, [refetchStreak, refetchTiming]);

  // Also refetch periodically in test mode (every 10 seconds)
  useEffect(() => {
    if (timingInfo?.isTestMode) {
      const interval = setInterval(() => {
        refetchAll();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [timingInfo?.isTestMode, refetchAll]);

  const handleClaim = async () => {
    try {
      await claimMutation.mutateAsync();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Claim failed:', error);
    }
  };

  // Check if streak is broken (missed claiming yesterday)
  const isStreakBroken = () => {
    if (!streakInfo || !timingInfo) return false;
    if (streakInfo.totalStreak === 0) return false;
    // If lastClaimDay is more than 1 day ago, streak is broken
    return timingInfo.currentDay > streakInfo.lastClaimDay + 1;
  };

  const streakBroken = isStreakBroken();

  // Calculate which days are completed in the current cycle
  // If streak is broken, show 0 completed (starting fresh)
  const getCompletedDays = () => {
    if (!streakInfo || streakInfo.totalStreak === 0) return 0;
    if (streakBroken) return 0; // Streak is broken, will reset on next claim
    return ((streakInfo.totalStreak - 1) % 7) + 1;
  };

  const completedDays = getCompletedDays();

  // Not configured state
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gray-900 pb-24">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-8">
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-800 flex items-center justify-center">
              <Flame className="w-10 h-10 text-gray-600" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Coming Soon</h1>
            <p className="text-gray-400">
              The streak reward event is not yet active.
            </p>
            <p className="text-gray-500 text-sm mt-4">
              Check back later for exciting daily rewards!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 pb-24">
      <div className="max-w-lg mx-auto px-4 pt-4 pb-6">
        
        {/* Header Banner */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-pink-600/20 border border-pink-500/20 p-6 mb-6"
        >
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-pink-500/30 to-transparent rounded-full blur-2xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-purple-500/30 to-transparent rounded-full blur-2xl" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-6 h-6 text-orange-400" />
              <span className="text-gray-400 text-sm font-medium">Total Streak</span>
            </div>
            
            <div className="flex items-baseline gap-2 mb-4">
              <span className={`text-5xl font-bold ${streakBroken ? 'text-gray-500' : 'text-white'}`}>
                {isLoadingStreak ? (
                  <span className="animate-pulse">--</span>
                ) : streakBroken ? (
                  // Show 0 when streak is broken (will reset on next claim)
                  0
                ) : (
                  streakInfo?.totalStreak || 0
                )}
              </span>
              <span className="text-xl text-gray-400">days</span>
              {streakBroken && streakInfo && streakInfo.totalStreak > 0 && (
                <span className="text-sm text-red-400 line-through ml-2">
                  was {streakInfo.totalStreak}
                </span>
              )}
            </div>

            {/* Pool info */}
            {poolInfo && (
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-pink-400" />
                  <span className="text-gray-400">Pool:</span>
                  <span className="text-white font-medium">
                    {Number(poolInfo.balance).toLocaleString(undefined, { maximumFractionDigits: 0 })} RM
                  </span>
                </div>
                {poolInfo.isActive ? (
                  <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                    Active
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
                    Ended
                  </span>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Test Mode Banner */}
        {timingInfo?.isTestMode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-400 text-sm font-medium">
                  ⚡ Test Mode: {Math.round(timingInfo.dayLengthSeconds / 60)}-minute days
                </span>
              </div>
              <button
                onClick={refetchAll}
                className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors"
              >
                ↻ Refresh
              </button>
            </div>
          </motion.div>
        )}

        {/* Streak Broken Warning */}
        {isConnected && streakBroken && streakInfo && streakInfo.totalStreak > 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30"
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">💔</div>
              <div>
                <p className="text-red-400 font-medium">Streak Broken!</p>
                <p className="text-gray-400 text-sm">
                  You missed a day. Your {streakInfo.totalStreak}-day streak will reset to Day 1.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Status Message */}
        {isConnected && streakInfo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`mb-6 p-4 rounded-xl border ${
              streakInfo.canClaimToday 
                ? streakBroken
                  ? 'bg-orange-500/10 border-orange-500/20'
                  : 'bg-green-500/10 border-green-500/20' 
                : 'bg-gray-800/50 border-gray-700/50'
            }`}
          >
            <div className="flex items-center gap-3">
              {streakInfo.canClaimToday ? (
                <>
                  <Sparkles className={`w-5 h-5 ${streakBroken ? 'text-orange-400' : 'text-green-400'}`} />
                  <div>
                    <p className={`font-medium ${streakBroken ? 'text-orange-400' : 'text-green-400'}`}>
                      {streakBroken ? 'Start Fresh!' : streakInfo.status}
                    </p>
                    <p className="text-gray-400 text-sm">
                      Claim <span className="text-white font-medium">{streakInfo.todayReward} RM</span> to {streakBroken ? 'begin a new streak' : 'continue your streak'}!
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-gray-500" />
                  <p className="text-gray-400">{streakInfo.status}</p>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Countdown Timer - show for all connected users */}
        {isConnected && timingInfo && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/20"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-pink-400" />
                <span className="text-gray-400 text-sm">
                  {streakInfo?.status === 'Already claimed today' 
                    ? 'Next streak in' 
                    : 'Day resets in'}
                </span>
              </div>
              <CountdownTimer 
                secondsRemaining={timingInfo.secondsUntilNextDay} 
                isTestMode={timingInfo.isTestMode}
                onComplete={refetchAll}
              />
            </div>
          </motion.div>
        )}

        {/* Section Title */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Daily Review Rewards</h2>
          <p className="text-gray-400 text-sm">
            Write a review every day to build your streak and earn up to <span className="text-pink-400 font-medium">{TOTAL_WEEK_REWARD} RM</span> per week!{' '}
            <a 
              href="https://farcaster.xyz/project7/0x9f41efa9" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-pink-400 hover:text-pink-300 transition-colors"
            >
              Learn More
              <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>

        {/* 7-Day Grid */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {REWARDS.map((reward, index) => {
            const dayNumber = index + 1;
            const isCompleted = completedDays >= dayNumber;
            const isCurrentDay = completedDays === index && streakInfo?.canClaimToday;
            const isUpcoming = completedDays < dayNumber;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className={`relative rounded-xl p-3 border transition-all ${
                  isCompleted
                    ? 'bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30'
                    : isCurrentDay
                    ? 'bg-gradient-to-br from-pink-500/20 to-purple-500/10 border-pink-500/50 ring-2 ring-pink-500/30'
                    : 'bg-gray-800/50 border-gray-700/50'
                } ${index === 6 ? 'col-span-2' : ''}`}
              >
                <div>
                  <p className="text-gray-400 text-xs font-medium mb-1">Day {dayNumber}</p>
                  
                  <div className="flex items-center justify-center flex-col gap-1">
                    <span className="text-2xl">
                      {isCompleted ? (
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                          <Check className="w-5 h-5 text-green-400" />
                        </div>
                      ) : (
                        DAY_ICONS[index]
                      )}
                    </span>
                    
                    <p className={`font-bold ${
                      isCompleted 
                        ? 'text-green-400' 
                        : isCurrentDay 
                        ? 'text-pink-400' 
                        : 'text-white'
                    } ${index === 6 ? 'text-lg' : 'text-sm'}`}>
                      +{reward} RM
                    </p>
                  </div>
                </div>

                {/* Day 7 special badge */}
                {index === 6 && (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <span className="text-gray-400 text-xs">Week Complete!</span>
                  </div>
                )}

                {/* Lock icon for upcoming days */}
                {isUpcoming && !isCurrentDay && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center">
                    <Lock className="w-3 h-3 text-gray-500" />
                  </div>
                )}

                {/* Pulse animation for current day */}
                {isCurrentDay && (
                  <div className="absolute inset-0 rounded-xl border-2 border-pink-500/50 animate-pulse" />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Claim Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {!isConnected ? (
            <div className="text-center">
              <p className="text-gray-400 mb-4">Connect your wallet to start earning rewards</p>
              <ConnectButton />
            </div>
          ) : streakInfo?.canClaimToday ? (
            <button
              onClick={handleClaim}
              disabled={claimMutation.isPending}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold text-lg hover:from-pink-600 hover:to-purple-700 transition-all shadow-lg shadow-pink-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {claimMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Claiming...
                </>
              ) : (
                <>
                  <Gift className="w-5 h-5" />
                  Claim {streakInfo.todayReward} RM
                </>
              )}
            </button>
          ) : (
            <div className="space-y-3">
              <button
                disabled
                className="w-full py-4 px-6 rounded-xl bg-gray-800 text-gray-500 font-semibold text-lg cursor-not-allowed border border-gray-700"
              >
                {streakInfo?.status || 'Not Available'}
              </button>
              
              {streakInfo?.status === 'Write a new review first' && (
                <Link
                  href="/review/create"
                  className="block w-full py-3 px-6 rounded-xl bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-400 font-medium text-center border border-pink-500/30 hover:from-pink-500/30 hover:to-purple-500/30 transition-all"
                >
                  Write a Review →
                </Link>
              )}
            </div>
          )}
        </motion.div>

        {/* Success Toast */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className="fixed bottom-24 left-4 right-4 max-w-lg mx-auto p-4 rounded-xl bg-green-500 text-white font-medium text-center shadow-lg shadow-green-500/25"
            >
              🎉 Reward claimed successfully!
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Toast */}
        <AnimatePresence>
          {claimMutation.isError && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className="fixed bottom-24 left-4 right-4 max-w-lg mx-auto p-4 rounded-xl bg-red-500 text-white font-medium text-center shadow-lg shadow-red-500/25"
            >
              ❌ {claimMutation.error?.message || 'Claim failed. Please try again.'}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info Section */}
        <div className="mt-8 p-4 rounded-xl bg-gray-800/30 border border-gray-700/50">
          <h3 className="text-white font-medium mb-2">How it works</h3>
          <ul className="text-gray-400 text-sm space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-pink-400">1.</span>
              Write a review about anyone on ReviewMe
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pink-400">2.</span>
              Come back here and claim your daily bonus
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pink-400">3.</span>
              Keep your streak going for bigger rewards!
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pink-400">4.</span>
              After Day 7, the cycle resets but your total streak continues
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pink-400">5.</span>
              Daily reset at 00:00 UTC (midnight)
            </li>
          </ul>
        </div>

        {/* Contract Info (for transparency) */}
        {STREAK_AIRDROP_ADDRESS !== '0x0000000000000000000000000000000000000000' && (
          <div className="mt-4 text-center">
            <a
              href={`https://basescan.org/address/${STREAK_AIRDROP_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
            >
              Contract: {STREAK_AIRDROP_ADDRESS.slice(0, 6)}...{STREAK_AIRDROP_ADDRESS.slice(-4)}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

