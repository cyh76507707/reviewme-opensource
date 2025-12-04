'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface SlotUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  followerCount: number;
}

interface UserSlotMachineProps {
  users: SlotUser[];
  selectedIndex: number;
  isSpinning: boolean;
  visibleCount?: number;
}

const ITEM_HEIGHT = 56; // Height of each slot item including gap
const CARD_HEIGHT = 52; // Actual card height

/**
 * Slot machine style user carousel with ultra-smooth animations
 */
export function UserSlotMachine({ 
  users, 
  selectedIndex, 
  isSpinning,
  visibleCount = 5 
}: UserSlotMachineProps) {
  
  // Container height based on visible items
  const containerHeight = visibleCount * ITEM_HEIGHT;
  const centerOffset = (containerHeight / 2) - (CARD_HEIGHT / 2);
  
  // Process users with position calculations
  const processedUsers = useMemo(() => {
    if (!users.length) return [];
    
    const totalUsers = users.length;
    const halfCount = Math.floor(visibleCount / 2);
    
    return users.map((user, index) => {
      // Calculate offset relative to selected index (circular)
      let offset = index - selectedIndex;
      
      // Normalize to create circular carousel
      if (offset > totalUsers / 2) {
        offset -= totalUsers;
      } else if (offset < -totalUsers / 2) {
        offset += totalUsers;
      }
      
      const distanceFromCenter = Math.abs(offset);
      const isCenter = offset === 0;
      
      // Smooth scaling based on distance
      const scale = isCenter ? 1 : Math.max(0.9, 1 - distanceFromCenter * 0.03);
      
      // Smooth opacity based on distance
      const opacity = isCenter ? 1 : Math.max(0.35, 1 - distanceFromCenter * 0.25);
      
      // Vertical position from top of container
      const verticalPosition = centerOffset + (offset * ITEM_HEIGHT);
      
      // Z-index (center on top, but keep low to avoid header overlap)
      const zIndex = 10 - distanceFromCenter;
      
      return {
        ...user,
        index,
        offset,
        distanceFromCenter,
        scale,
        opacity,
        verticalPosition,
        zIndex,
        isCenter,
        isVisible: distanceFromCenter <= halfCount,
      };
    });
  }, [users, selectedIndex, visibleCount, centerOffset]);

  if (!users.length) {
    return (
      <div style={{ height: containerHeight }} className="flex items-center justify-center">
        <div className="text-gray-500">No users loaded</div>
      </div>
    );
  }

  // Animation transition config
  const transition = isSpinning 
    ? { type: 'tween' as const, duration: 0.018, ease: 'linear' as const } // Ultra-fast transition for 2x speed
    : { type: 'spring' as const, stiffness: 300, damping: 28, mass: 0.5 }; // Smooth landing

  return (
    <div 
      className="relative overflow-hidden"
      style={{ height: containerHeight }}
    >
      {/* Top gradient fade */}
      <div 
        className="absolute top-0 left-0 right-0 h-20 pointer-events-none"
        style={{ 
          background: 'linear-gradient(to bottom, rgb(31, 41, 55) 0%, rgb(31, 41, 55) 30%, transparent 100%)',
          zIndex: 15
        }}
      />
      
      {/* Bottom gradient fade */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
        style={{ 
          background: 'linear-gradient(to top, rgb(31, 41, 55) 0%, rgb(31, 41, 55) 30%, transparent 100%)',
          zIndex: 15
        }}
      />
      
      {/* Left pin indicator */}
      <div 
        className="absolute left-0 pointer-events-none"
        style={{ 
          top: centerOffset + (CARD_HEIGHT / 2) - 12, // Center of center card
          zIndex: 20 
        }}
      >
        <motion.div
          animate={isSpinning ? { 
            x: [0, -2, 0],
            scaleY: [1, 1.1, 1]
          } : { x: 0, scaleY: 1 }}
          transition={{ 
            duration: 0.12, 
            repeat: isSpinning ? Infinity : 0,
            repeatType: 'reverse'
          }}
        >
          <div className="w-3 h-6 bg-gradient-to-r from-pink-500 to-purple-500 rounded-r-full shadow-lg shadow-pink-500/50" />
        </motion.div>
      </div>
      
      {/* Right pin indicator */}
      <div 
        className="absolute right-0 pointer-events-none"
        style={{ 
          top: centerOffset + (CARD_HEIGHT / 2) - 12, // Center of center card
          zIndex: 20 
        }}
      >
        <motion.div
          animate={isSpinning ? { 
            x: [0, 2, 0],
            scaleY: [1, 1.1, 1]
          } : { x: 0, scaleY: 1 }}
          transition={{ 
            duration: 0.12, 
            repeat: isSpinning ? Infinity : 0,
            repeatType: 'reverse',
            delay: 0.06
          }}
        >
          <div className="w-3 h-6 bg-gradient-to-l from-pink-500 to-purple-500 rounded-l-full shadow-lg shadow-pink-500/50" />
        </motion.div>
      </div>
      
      {/* Center selection highlight border */}
      <div 
        className="absolute left-0 right-0 pointer-events-none px-2"
        style={{ 
          top: centerOffset,
          height: CARD_HEIGHT,
          zIndex: 12
        }}
      >
        <motion.div 
          className="w-full h-full rounded-xl border-2"
          animate={{
            borderColor: isSpinning 
              ? ['rgb(236, 72, 153)', 'rgb(168, 85, 247)', 'rgb(236, 72, 153)']
              : 'rgb(236, 72, 153)',
            boxShadow: isSpinning
              ? ['0 0 15px rgba(236, 72, 153, 0.4)', '0 0 25px rgba(168, 85, 247, 0.5)', '0 0 15px rgba(236, 72, 153, 0.4)']
              : '0 0 15px rgba(236, 72, 153, 0.3)',
          }}
          transition={{
            duration: 0.5,
            repeat: isSpinning ? Infinity : 0,
            ease: 'easeInOut'
          }}
        />
      </div>
      
      {/* Users container */}
      <div className="absolute inset-0">
        {processedUsers.filter(u => u.isVisible).map((user) => (
          <motion.div
            key={user.fid}
            className="absolute left-0 right-0 px-2"
            style={{ 
              zIndex: user.zIndex,
              willChange: isSpinning ? 'transform, opacity' : 'auto',
              height: CARD_HEIGHT,
            }}
            initial={false}
            animate={{ 
              y: user.verticalPosition,
              scale: user.scale,
              opacity: user.opacity,
            }}
            transition={transition}
          >
            <div 
              className={`h-full flex items-center gap-3 px-3 rounded-xl backdrop-blur-sm transition-colors duration-150 ${
                user.isCenter 
                  ? 'bg-gray-800/95 border border-pink-500/40 shadow-lg shadow-pink-500/10' 
                  : 'bg-gray-800/60 border border-gray-700/40'
              }`}
            >
              {/* Avatar */}
              <div className={`w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ${
                user.isCenter ? 'ring-2 ring-pink-500/50' : 'ring-1 ring-gray-600/50'
              }`}>
                {user.pfpUrl ? (
                  <img 
                    src={user.pfpUrl} 
                    alt={user.username}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-700 flex items-center justify-center text-gray-400 text-sm font-medium">
                    {user.username?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              
              {/* User info */}
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate text-sm ${user.isCenter ? 'text-white' : 'text-gray-400'}`}>
                  {user.displayName || user.username}
                </p>
                <p className={`text-xs truncate ${user.isCenter ? 'text-gray-400' : 'text-gray-600'}`}>
                  @{user.username}
                </p>
              </div>
              
              {/* Follower count */}
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-medium ${user.isCenter ? 'text-pink-400' : 'text-gray-600'}`}>
                  {user.followerCount?.toLocaleString()}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
