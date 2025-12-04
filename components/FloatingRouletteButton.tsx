'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dices } from 'lucide-react';
import { motion } from 'framer-motion';

export function FloatingRouletteButton() {
  const pathname = usePathname();
  
  // Hide button on the roulette page itself
  if (pathname === '/roulette') {
    return null;
  }
  
  return (
    <div className="md:hidden fixed bottom-24 right-4 z-50">
      {/* Glow effect layers - reduced to ~65% size */}
      <div className="absolute inset-2 rounded-full bg-pink-500/30 blur-lg animate-pulse" />
      <div className="absolute inset-3 rounded-full bg-purple-500/20 blur-md animate-pulse" style={{ animationDelay: '0.5s' }} />
      
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.3 }}
      >
        <Link
          href="/roulette"
          className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-pink-600 shadow-lg shadow-pink-500/40 hover:shadow-pink-500/60 hover:scale-110 transition-all duration-300"
        >
          {/* Inner glow */}
          <div className="absolute inset-1 rounded-full bg-gradient-to-br from-pink-400/20 to-transparent" />
          
          {/* Icon */}
          <Dices className="w-6 h-6 text-white relative z-10" strokeWidth={2.5} />
          
          {/* Animated ring - darker pink */}
          <div className="absolute inset-0 rounded-full border-2 border-pink-600/40 animate-ping" style={{ animationDuration: '2s' }} />
          
          {/* NEW badge */}
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold bg-yellow-400 text-gray-900 rounded-full shadow-lg">
            NEW
          </span>
        </Link>
      </motion.div>
    </div>
  );
}

