import { useState, useRef, useCallback, useEffect } from 'react';

interface SlotUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  followerCount: number;
}

interface UseSlotMachineProps {
  users: SlotUser[];
  onSpinComplete?: (selectedUsers: SlotUser[]) => void;
  resultCount?: number;
}

// Animation constants
const SPIN_DURATION = 3200; // 3.2 seconds spin (original duration)
const IDLE_ROTATION_INTERVAL = 2500; // ms between idle rotations (slower for smoother feel)

/**
 * Custom hook for slot machine animation logic using requestAnimationFrame
 */
export function useSlotMachine({
  users,
  onSpinComplete,
  resultCount = 3,
}: UseSlotMachineProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedResults, setSelectedResults] = useState<SlotUser[]>([]);
  const [isIdle, setIsIdle] = useState(true);
  
  const rafRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const usersRef = useRef(users);
  const spinStartRef = useRef(0);
  const lastIndexChangeRef = useRef(0);
  const winnerIndicesRef = useRef<number[]>([]);

  // Keep users ref updated
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (idleTimerRef.current) {
      clearInterval(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  // Idle rotation animation
  useEffect(() => {
    if (!users.length || isSpinning || !isIdle) {
      if (idleTimerRef.current) {
        clearInterval(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return;
    }

    idleTimerRef.current = window.setInterval(() => {
      setSelectedIndex((prev) => (prev + 1) % usersRef.current.length);
    }, IDLE_ROTATION_INTERVAL);

    return () => {
      if (idleTimerRef.current) {
        clearInterval(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [users.length, isSpinning, isIdle]);

  // Select random unique indices
  const selectRandomIndices = useCallback((count: number, total: number): number[] => {
    if (total <= count) {
      return Array.from({ length: total }, (_, i) => i);
    }
    
    const indices: number[] = [];
    while (indices.length < count) {
      const randomIndex = Math.floor(Math.random() * total);
      if (!indices.includes(randomIndex)) {
        indices.push(randomIndex);
      }
    }
    return indices;
  }, []);

  // Start spin animation using requestAnimationFrame for smoothness
  const startSpin = useCallback(() => {
    const currentUsers = usersRef.current;
    if (isSpinning || currentUsers.length < 3) {
      console.log('Cannot start spin:', { isSpinning, usersLength: currentUsers.length });
      return;
    }

    console.log('Starting spin with', currentUsers.length, 'users');
    
    clearTimers();
    setIsSpinning(true);
    setIsIdle(false);
    setSelectedResults([]);

    // Pre-select random winners
    winnerIndicesRef.current = selectRandomIndices(resultCount, currentUsers.length);
    const finalIndex = winnerIndicesRef.current[0];
    
    console.log('Winner indices:', winnerIndicesRef.current, 'Final index:', finalIndex);

    spinStartRef.current = performance.now();
    lastIndexChangeRef.current = spinStartRef.current;

    const animate = (timestamp: number) => {
      const elapsed = timestamp - spinStartRef.current;
      const progress = Math.min(elapsed / SPIN_DURATION, 1);

      if (progress >= 1) {
        // Spin complete - land on final index
        console.log('Spin complete');
        setSelectedIndex(finalIndex);
        setIsSpinning(false);

        const results = winnerIndicesRef.current.map((idx) => currentUsers[idx]);
        setSelectedResults(results);

        if (onSpinComplete) {
          setTimeout(() => onSpinComplete(results), 400);
        }
        return;
      }

      // Calculate dynamic interval using smooth easing
      // Quartic ease-out: starts very fast, slows dramatically at end
      const easeOut = 1 - Math.pow(1 - progress, 4);
      // Starts at 18ms (ultra fast), ends at ~200ms - 2x faster item changes
      const interval = 18 + (easeOut * 182);

      // Check if it's time to change index
      const timeSinceLastChange = timestamp - lastIndexChangeRef.current;
      if (timeSinceLastChange >= interval) {
        setSelectedIndex((prev) => (prev + 1) % currentUsers.length);
        lastIndexChangeRef.current = timestamp;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
  }, [isSpinning, resultCount, selectRandomIndices, onSpinComplete, clearTimers]);

  // Reset to idle state
  const reset = useCallback(() => {
    clearTimers();
    setIsSpinning(false);
    setSelectedResults([]);
    setIsIdle(true);
    setSelectedIndex(0);
  }, [clearTimers]);

  // Stop idle animation
  const stopIdle = useCallback(() => {
    setIsIdle(false);
    if (idleTimerRef.current) {
      clearInterval(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  return {
    selectedIndex,
    isSpinning,
    isIdle,
    selectedResults,
    startSpin,
    reset,
    stopIdle,
  };
}
