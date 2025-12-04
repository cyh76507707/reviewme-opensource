'use client';

import Link from 'next/link';
import { usePlatformDetection } from '@/lib/hooks/usePlatformDetection';

// Version is read from package.json via next.config.js
// Use `npm version patch/minor/major` to update
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0';

export function Footer() {
  const { platform, isLoading } = usePlatformDetection();

  // Determine profile link based on platform
  const profileLink = isLoading
    ? 'https://farcaster.xyz/project7' // Default to Farcaster while loading
    : platform === 'base'
    ? 'https://base.app/profile/0x648A4Da99134d27e3Ae89F5f33bDd535EDcA720D'
    : 'https://farcaster.xyz/project7';

  return (
    <footer className="w-full mt-auto pb-24 md:pb-6">
      {/* Divider line */}
      <div className="border-t border-gray-700/30" />
      
      {/* Footer content */}
      <div className="px-6 py-6 max-w-3xl mx-auto">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-gray-500 text-sm">
            Made with{' '}
            <Link
              href={profileLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-pink-400 hover:text-pink-300 transition-colors underline"
            >
              @project7
            </Link>
            {' '}and ❤️
          </p>
          <p className="text-gray-600 text-xs">
            v{APP_VERSION}
          </p>
        </div>
      </div>
    </footer>
  );
}

