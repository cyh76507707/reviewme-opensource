'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, User, Coins, Flame } from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();
  
  const navItems: { href: string; label: string; icon: typeof Home; isNew?: boolean }[] = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/streak', label: 'Streak', icon: Flame, isNew: true },
    { href: '/token', label: '$RM', icon: Coins },
    { href: '/leaderboard', label: 'Rank', icon: Trophy },
    { href: '/my-page', label: 'Me', icon: User },
  ];
  
  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname?.startsWith(href);
  };
  
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-lg border-t border-pink-500/10 safe-area-bottom">
      <div className="max-w-md mx-auto px-6 py-3">
        <div className="flex items-center justify-around">
          {navItems.map(({ href, label, icon: Icon, isNew }) => {
            const active = isActive(href);
            
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                  active
                    ? 'text-pink-400 bg-pink-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
                  {isNew && !active && (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-pink-500 animate-warm-pulse"></span>
                  )}
                </div>
                <span className="text-xs font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

