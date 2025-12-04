'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { Dices, Gift, Loader2, Clock, Users, Star, ShoppingBag, Sparkles, ExternalLink, Zap } from 'lucide-react';
import { 
  useRouletteInfo, 
  useRoulettePoolInfo, 
  useClaimRoulette,
  useIsRouletteConfigured,
  useRouletteTimingInfo,
  ROULETTE_ADDRESS 
} from '@/lib/hooks/useRoulette';
import { getRandomProducts, ROULETTE_PRODUCTS } from '@/lib/roulette-products';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { UserSlotMachine } from './components/UserSlotMachine';
import { useSlotMachine } from './hooks/useSlotMachine';

// Filter types
type FilterType = 'following' | 'top' | 'products';

interface FarcasterUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  followerCount: number;
  bio?: string;
}

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

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  const formatNumber = (n: number) => n.toString().padStart(2, '0');

  if (isTestMode) {
    return (
      <div className="flex items-center gap-1.5 font-mono">
        <span className="text-2xl font-bold text-white">{formatNumber(minutes)}</span>
        <span className="text-purple-400">:</span>
        <span className="text-2xl font-bold text-white">{formatNumber(seconds)}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 font-mono">
      <span className="text-2xl font-bold text-white">{formatNumber(hours)}</span>
      <span className="text-purple-400">:</span>
      <span className="text-2xl font-bold text-white">{formatNumber(minutes)}</span>
      <span className="text-purple-400">:</span>
      <span className="text-2xl font-bold text-white">{formatNumber(seconds)}</span>
    </div>
  );
}

// LocalStorage key for persisting spin state
const SPIN_STORAGE_KEY = 'roulette_spin_state';

interface SpinState {
  spinTime: number;
  results: FarcasterUser[];
  selectedUser: FarcasterUser | null;
  filter: FilterType;
}

export default function RoulettePage() {
  const { address, isConnected } = useAccount();
  const isConfigured = useIsRouletteConfigured();
  const { data: rouletteInfo, refetch: refetchInfo } = useRouletteInfo();
  const { data: poolInfo } = useRoulettePoolInfo();
  const { data: timingInfo } = useRouletteTimingInfo();
  const claimMutation = useClaimRoulette();
  
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('following');
  const [previewUsers, setPreviewUsers] = useState<FarcasterUser[]>([]);
  const [spinResults, setSpinResults] = useState<FarcasterUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<FarcasterUser | null>(null);
  const [userFid, setUserFid] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasActiveSpinSession, setHasActiveSpinSession] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Slot machine hook
  const {
    selectedIndex,
    isSpinning,
    isIdle,
    selectedResults,
    startSpin,
    reset: resetSlot,
    stopIdle,
  } = useSlotMachine({
    users: previewUsers,
    resultCount: 3,
    onSpinComplete: (results) => {
      setSpinResults(results);
      saveSpinState(results, null);
    },
  });

  // Load persisted spin state from localStorage
  useEffect(() => {
    if (!address || !timingInfo) return;
    
    try {
      const stored = localStorage.getItem(`${SPIN_STORAGE_KEY}_${address}`);
      if (stored) {
        const state: SpinState = JSON.parse(stored);
        const cooldownMs = (timingInfo.cooldownSeconds || 21600) * 1000;
        const now = Date.now();
        
        if (now - state.spinTime < cooldownMs) {
          setSpinResults(state.results);
          setSelectedUser(state.selectedUser);
          setSelectedFilter(state.filter);
          setHasActiveSpinSession(true);
        } else {
          localStorage.removeItem(`${SPIN_STORAGE_KEY}_${address}`);
        }
      }
    } catch (e) {
      console.error('Failed to load spin state:', e);
    }
  }, [address, timingInfo]);

  // Save spin state to localStorage
  const saveSpinState = useCallback((results: FarcasterUser[], selected: FarcasterUser | null) => {
    if (!address) return;
    
    const state: SpinState = {
      spinTime: Date.now(),
      results,
      selectedUser: selected,
      filter: selectedFilter,
    };
    localStorage.setItem(`${SPIN_STORAGE_KEY}_${address}`, JSON.stringify(state));
    setHasActiveSpinSession(true);
  }, [address, selectedFilter]);

  // Clear spin state (after successful claim)
  const clearSpinState = useCallback(() => {
    if (!address) return;
    localStorage.removeItem(`${SPIN_STORAGE_KEY}_${address}`);
    setSpinResults([]);
    setSelectedUser(null);
    setHasActiveSpinSession(false);
    resetSlot();
  }, [address, resetSlot]);

  // Get user's FID from their wallet
  useEffect(() => {
    async function fetchUserFid() {
      if (!address) {
        setUserFid(null);
        return;
      }
      
      try {
        const res = await fetch(`/api/neynar/user?address=${address}`);
        if (res.ok) {
          const data = await res.json();
          setUserFid(data.fid);
        } else {
          setUserFid(null);
        }
      } catch {
        setUserFid(null);
      }
    }
    
    fetchUserFid();
  }, [address]);

  // Fetch users for preview based on selected filter
  const fetchPreviewUsers = useCallback(async (filter: FilterType) => {
    setIsLoadingPreview(true);
    setError(null);
    
    try {
      let users: FarcasterUser[] = [];
      
      switch (filter) {
        case 'following':
          if (!userFid) {
            throw new Error('Connect Farcaster to use this filter');
          }
          const followingRes = await fetch(`/api/neynar/following?fid=${userFid}`);
          if (!followingRes.ok) throw new Error('Failed to fetch');
          const followingData = await followingRes.json();
          users = followingData.users || [];
          break;
          
        case 'top':
          // Fetch more users for better variety in the slot machine
          const topRes = await fetch('/api/neynar/user/batch?fids=3,2,5650,239,576,680,194,12142,616,99');
          if (!topRes.ok) throw new Error('Failed to fetch');
          const topData = await topRes.json();
          users = (topData.users || []).map((u: any) => ({
            fid: u.fid,
            username: u.username,
            displayName: u.display_name || u.displayName,
            pfpUrl: u.pfp_url || u.pfp?.url,
            followerCount: u.follower_count || u.followerCount,
            bio: u.profile?.bio?.text || u.bio,
          }));
          break;
          
        case 'products':
          // Get more products for the slot machine
          const allProducts = ROULETTE_PRODUCTS;
          const productFids = allProducts.map(p => p.fid).join(',');
          const productsRes = await fetch(`/api/neynar/user/batch?fids=${productFids}`);
          if (!productsRes.ok) throw new Error('Failed to fetch');
          const productsData = await productsRes.json();
          users = (productsData.users || []).map((u: any) => ({
            fid: u.fid,
            username: u.username,
            displayName: u.display_name || u.displayName,
            pfpUrl: u.pfp_url || u.pfp?.url,
            followerCount: u.follower_count || u.followerCount,
            bio: u.profile?.bio?.text || u.bio,
          }));
          break;
      }
      
      // Filter out self (user's own FID) to prevent self-review
      const filteredUsers = userFid 
        ? users.filter(u => u.fid !== userFid)
        : users;
      
      // Shuffle users for variety
      const shuffled = filteredUsers.sort(() => Math.random() - 0.5);
      setPreviewUsers(shuffled);
      
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
      setPreviewUsers([]);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [userFid]);

  // Load preview users when filter changes
  useEffect(() => {
    if (hasActiveSpinSession) return; // Don't fetch if we have active session
    if (selectedFilter === 'following' && !userFid) return; // Don't fetch following without FID
    
    fetchPreviewUsers(selectedFilter);
  }, [selectedFilter, userFid, hasActiveSpinSession, fetchPreviewUsers]);

  // Handle filter change
  const handleFilterChange = (filter: FilterType) => {
    if (hasActiveSpinSession) return;
    if (filter === 'following' && !userFid) return;
    
    setSelectedFilter(filter);
    setPreviewUsers([]);
    resetSlot();
  };

  // Handle spin button click
  const handleSpinClick = () => {
    if (isSpinning || previewUsers.length < 3) return;
    
    setError(null);
    stopIdle();
    startSpin();
  };

  // Handle user selection from results
  const handleUserSelect = (user: FarcasterUser) => {
    setSelectedUser(user);
    saveSpinState(spinResults, user);
  };

  // Handle claim
  const handleClaim = async () => {
    try {
      await claimMutation.mutateAsync();
      setShowSuccess(true);
      clearSpinState();
      setTimeout(() => {
        setShowSuccess(false);
        refetchInfo();
      }, 3000);
    } catch (error) {
      console.error('Claim failed:', error);
    }
  };

  // Refetch on countdown complete
  const handleCountdownComplete = useCallback(() => {
    refetchInfo();
  }, [refetchInfo]);

  // Not configured state
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gray-900 pb-24">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-8">
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-800 flex items-center justify-center">
              <Dices className="w-10 h-10 text-gray-600" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Coming Soon</h1>
            <p className="text-gray-400">Review Roulette is not yet active.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6 pb-6">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-orange-500/20 border border-purple-500/20 p-4 mb-4"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/30 to-transparent rounded-full blur-2xl" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Dices className="w-5 h-5 text-purple-400" />
              <h1 className="text-lg font-bold text-white">Review Roulette</h1>
            </div>
            <p className="text-gray-400 text-sm mb-3">
              Spin to discover someone new to review!{'\n'}
              Earn <span className="text-pink-400 font-medium">+20 RM</span> bonus every 6 hours.{' '}
              <a 
                href="https://farcaster.xyz/project7/0x1e57fb28" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline"
              >
                Learn more
              </a>
            </p>
            {poolInfo && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-sm">
                  <Gift className="w-4 h-4 text-purple-400" />
                  <span className="text-gray-300">Pool:</span>
                  <span className="text-white font-semibold">
                    {Number(poolInfo.balance).toLocaleString(undefined, { maximumFractionDigits: 0 })} RM
                  </span>
                  {poolInfo.isActive && (
                    <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-xs">
                  This event can be halted anytime without notice.
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Test Mode Banner */}
        {timingInfo?.isTestMode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 p-2 rounded-xl bg-yellow-500/10 border border-yellow-500/30"
          >
            <div className="flex items-center justify-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 text-sm font-medium">
                Test Mode: {Math.round(timingInfo.cooldownSeconds / 60)}-min cooldown
              </span>
            </div>
          </motion.div>
        )}

        {/* Countdown Timer */}
        {isConnected && rouletteInfo && rouletteInfo.secondsUntilNextClaim > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <span className="text-gray-400 text-sm">Next spin in</span>
              </div>
              <CountdownTimer 
                secondsRemaining={rouletteInfo.secondsUntilNextClaim}
                isTestMode={timingInfo?.isTestMode || false}
                onComplete={handleCountdownComplete}
              />
            </div>
          </motion.div>
        )}

        {/* Main Content - Show Results or Slot Machine */}
        {spinResults.length > 0 ? (
          // Show results after spin
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            {rouletteInfo?.canClaim ? (
              // Review completed state
              <>
                <h2 className="text-sm font-medium text-green-400 mb-3">✅ Review completed!</h2>
                {selectedUser && (
                  <div className="p-4 rounded-xl border bg-green-500/10 border-green-500/30 flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-700 flex-shrink-0">
                      {selectedUser.pfpUrl ? (
                        <img src={selectedUser.pfpUrl} alt={selectedUser.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          {selectedUser.username?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{selectedUser.displayName || selectedUser.username}</p>
                      <p className="text-sm text-gray-400">@{selectedUser.username}</p>
                    </div>
                    <div className="text-green-400 text-sm font-medium">✓ Reviewed</div>
                  </div>
                )}
              </>
            ) : (
              // Pick from results
              <>
                <h2 className="text-sm font-medium text-gray-400 mb-3">🎯 Pick one to review:</h2>
                <div className="space-y-2">
                  {spinResults.map((user, index) => {
                    const isSelected = selectedUser?.fid === user.fid;
                    return (
                      <motion.button
                        key={user.fid}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.15 }}
                        onClick={() => handleUserSelect(user)}
                        className={`w-full p-3 rounded-xl border transition-all text-left flex items-center gap-3 ${
                          isSelected
                            ? 'bg-purple-500/20 border-purple-500/50 ring-2 ring-purple-500/30'
                            : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-800 hover:border-purple-500/30'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 flex-shrink-0">
                          {user.pfpUrl ? (
                            <img src={user.pfpUrl} alt={user.username} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                              {user.username?.[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{user.displayName || user.username}</p>
                          <p className="text-xs text-gray-500">@{user.username}</p>
                        </div>
                        <p className="text-xs text-gray-500">{user.followerCount?.toLocaleString()}</p>
                      </motion.button>
                    );
                  })}
                </div>
                
                {selectedUser && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                    <Link
                      href={`/review/create/${encodeURIComponent(selectedUser.username)}`}
                      className="block w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium text-center shadow-lg shadow-purple-500/25"
                    >
                      ✍️ Write Review for @{selectedUser.username}
                    </Link>
                  </motion.div>
                )}
              </>
            )}
          </motion.div>
        ) : (
          // Show Slot Machine
          <>
            {/* Filter Selection */}
            <div className="mb-4">
              <h2 className="text-sm font-medium text-gray-400 mb-2">Choose your option to spin:</h2>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleFilterChange('following')}
                  disabled={!userFid || hasActiveSpinSession || isSpinning}
                  className={`p-3 rounded-xl border transition-all ${
                    selectedFilter === 'following'
                      ? 'bg-purple-500/20 border-purple-500/50 ring-2 ring-purple-500/30'
                      : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-800'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Users className={`w-5 h-5 mx-auto mb-1 ${selectedFilter === 'following' ? 'text-purple-400' : 'text-gray-500'}`} />
                  <p className={`text-xs font-medium ${selectedFilter === 'following' ? 'text-purple-400' : 'text-gray-500'}`}>Following</p>
                  {!userFid && <p className="text-[8px] text-gray-600">🔒 FC</p>}
                </button>
                
                <button
                  onClick={() => handleFilterChange('top')}
                  disabled={hasActiveSpinSession || isSpinning}
                  className={`p-3 rounded-xl border transition-all ${
                    selectedFilter === 'top'
                      ? 'bg-purple-500/20 border-purple-500/50 ring-2 ring-purple-500/30'
                      : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-800'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Star className={`w-5 h-5 mx-auto mb-1 ${selectedFilter === 'top' ? 'text-purple-400' : 'text-gray-400'}`} />
                  <p className={`text-xs font-medium ${selectedFilter === 'top' ? 'text-purple-400' : 'text-gray-300'}`}>Top Users</p>
                </button>
                
                <button
                  onClick={() => handleFilterChange('products')}
                  disabled={hasActiveSpinSession || isSpinning}
                  className={`p-3 rounded-xl border transition-all ${
                    selectedFilter === 'products'
                      ? 'bg-purple-500/20 border-purple-500/50 ring-2 ring-purple-500/30'
                      : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-800'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <ShoppingBag className={`w-5 h-5 mx-auto mb-1 ${selectedFilter === 'products' ? 'text-purple-400' : 'text-gray-400'}`} />
                  <p className={`text-xs font-medium ${selectedFilter === 'products' ? 'text-purple-400' : 'text-gray-300'}`}>Products</p>
                </button>
              </div>
            </div>

            {/* Slot Machine */}
            <div className="mb-4 rounded-2xl bg-gray-800 border border-gray-700/50 overflow-hidden isolate">
              {isLoadingPreview ? (
                <div className="h-[280px] flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                </div>
              ) : previewUsers.length > 0 ? (
                <UserSlotMachine 
                  users={previewUsers}
                  selectedIndex={selectedIndex}
                  isSpinning={isSpinning}
                />
              ) : (
                <div className="h-[280px] flex items-center justify-center text-gray-500">
                  {error || 'No users available'}
                </div>
              )}
            </div>

            {/* Spin Button */}
            {!isConnected ? (
              <div className="text-center mb-4">
                <p className="text-gray-400 mb-3 text-sm">Connect wallet to spin</p>
                <ConnectButton />
              </div>
            ) : (
              <motion.button
                onClick={handleSpinClick}
                disabled={isSpinning || previewUsers.length < 3 || (rouletteInfo?.secondsUntilNextClaim ?? 0) > 0}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 bg-[length:200%_100%] text-white font-bold text-lg shadow-lg shadow-pink-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
                style={{
                  animation: isSpinning ? 'none' : 'shimmer 3s ease-in-out infinite',
                }}
              >
                {isSpinning ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Spinning...
                  </>
                ) : (rouletteInfo?.secondsUntilNextClaim ?? 0) > 0 ? (
                  <>
                    <Clock className="w-5 h-5" />
                    Wait for cooldown
                  </>
                ) : (
                  <>
                    <Dices className="w-5 h-5" />
                    Spin Now
                  </>
                )}
              </motion.button>
            )}
          </>
        )}

        {/* Claim Button */}
        {isConnected && rouletteInfo?.canClaim && hasActiveSpinSession && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
            <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 mb-3">
              <div className="flex items-center gap-2 text-green-400">
                <Sparkles className="w-4 h-4" />
                <span className="font-medium text-sm">Ready to claim your bonus!</span>
              </div>
            </div>
            
            <button
              onClick={handleClaim}
              disabled={claimMutation.isPending}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold text-lg shadow-lg shadow-green-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {claimMutation.isPending ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Claiming...</>
              ) : (
                <><Gift className="w-5 h-5" /> Claim 20 RM</>
              )}
            </button>
          </motion.div>
        )}

        {/* How it works */}
        <div className="mt-6 p-4 rounded-xl bg-gray-800/30 border border-gray-700/50">
          <h3 className="text-white font-semibold mb-3">How it works</h3>
          <ol className="text-gray-400 text-sm space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-pink-400 font-medium">1.</span> 
              <span>Choose a pool and spin to discover users</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pink-400 font-medium">2.</span> 
              <span>Pick someone from the results and write a review</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pink-400 font-medium">3.</span> 
              <span>Come back and claim your +20 RM bonus</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pink-400 font-medium">4.</span> 
              <span>Spin again every 6 hours!</span>
            </li>
          </ol>
        </div>

        {/* Contract Info */}
        {ROULETTE_ADDRESS !== '0x0000000000000000000000000000000000000000' && (
          <div className="mt-3 text-center">
            <a
              href={`https://basescan.org/address/${ROULETTE_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-400 inline-flex items-center gap-1"
            >
              Contract: {ROULETTE_ADDRESS.slice(0, 6)}...{ROULETTE_ADDRESS.slice(-4)}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Success Toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed bottom-24 left-4 right-4 max-w-lg mx-auto p-4 rounded-xl bg-green-500 text-white font-medium text-center shadow-lg"
          >
            🎉 +20 RM claimed successfully!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add shimmer animation */}
      <style jsx global>{`
        @keyframes shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  );
}
