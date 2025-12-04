'use client';

import { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Review } from '@/lib/reviewme-contract';
import { formatAddress } from '@/lib/neynar';
import { useProfile } from '@/lib/hooks/useNeynar';
import { useFrame } from '@/components/providers/FrameProvider';
import { sdk } from '@farcaster/miniapp-sdk';

interface ShareButtonsProps {
  reviewId: number;
  review: Review;
}

// X (Twitter) Logo SVG - Official X logo
const XLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

// Farcaster Logo SVG - Official Farcaster symbol
const FarcasterLogo = () => (
  <svg width="28" height="28" viewBox="0 0 1080 1080" fill="none" className="w-7 h-7">
    <path d="M847.387 270V343.023H774.425V415.985H796.779V416.01H847.387V810.795H725.173L725.099 810.434L662.737 515.101C656.791 486.949 641.232 461.477 618.927 443.362C596.623 425.248 568.527 415.275 539.818 415.275H539.575C510.866 415.275 482.77 425.248 460.466 443.362C438.161 461.477 422.602 486.958 416.657 515.101L354.223 810.795H232V416.001H282.608V415.985H304.959V343.023H232V270H847.387Z" fill="currentColor"/>
  </svg>
);

// Base Logo SVG - Base logo (simplified B)
const BaseLogo = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="w-7 h-7">
    <rect width="24" height="24" rx="4" fill="currentColor"/>
    <path d="M8 6h6c2.5 0 4 1.5 4 4s-1.5 4-4 4H8V6zm2 2v4h4c1.1 0 2-.9 2-2s-.9-2-2-2h-4z" fill="white"/>
  </svg>
);

export function ShareButtons({ reviewId, review }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [isBaseApp, setIsBaseApp] = useState(false);
  const { openUrl } = useFrame();
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const isBaseFromParam: boolean = urlParams.get('platform') === 'base';
      
      const isBase: boolean = Boolean(isBaseFromParam || (
        window.navigator.userAgent.includes('Base') ||
        window.location.hostname.includes('base.app') ||
        (document.referrer && document.referrer.includes('base.app'))
      ));
      
      setIsBaseApp(isBase);
    }
  }, []);
  
  // Share homepage with reviewId parameter so it opens in mini app
  const reviewUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/review/${reviewId}`
    : `https://reviewme.fun/review/${reviewId}`;

  // Load profiles so we can prefer @username over raw address when available
  const { data: reviewerProfile } = useProfile(review.reviewer);
  const { data: revieweeProfile } = useProfile(review.reviewee);

  const reviewerLabel = reviewerProfile?.username
    ? `@${reviewerProfile.username}`
    : formatAddress(review.reviewer);

  const revieweeLabel = revieweeProfile?.username
    ? `@${revieweeProfile.username}`
    : formatAddress(review.reviewee);
  
  // Compose share text with review content and attribution
  const shareText = `${review.content}\n\n${reviewerLabel} made an onchain review for ${revieweeLabel} via ReviewMe`;

  const handleCopyLink = async () => {
    try {
      // Copy only the URL (trim to remove any trailing spaces)
      await navigator.clipboard.writeText(reviewUrl.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleTwitterShare = () => {
    // Twitter automatically adds the URL as a card, so we include it in the text
    // Trim reviewUrl to remove any trailing spaces
    const twitterText = `${shareText}\n${reviewUrl.trim()}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}`;
    openUrl(twitterUrl);
  };

  const handleFarcasterShare = async () => {
    try {
      // Use composeCast SDK action for native mini app experience
      // This works in both Farcaster and Base app environments
      const result = await sdk.actions.composeCast({
        text: shareText,
        embeds: [reviewUrl.trim()] as [string],
      });

      // Optional: Handle the result (cast hash, etc.)
      if (result?.cast) {
        console.log('Cast posted successfully:', result.cast.hash);
      } else {
        // User cancelled or cast was not posted
        console.log('Cast composition cancelled');
      }
    } catch (error) {
      // Fallback to URL-based sharing if SDK action fails
      // (e.g., not in mini app environment or SDK error)
      console.warn('composeCast failed, falling back to URL:', error);
      
      const farcasterText = `${shareText}\n${reviewUrl.trim()}`;
      
      if (isBaseApp) {
        // Base app: open in Base app with text
        const baseUrl = `https://base.app/share?text=${encodeURIComponent(farcasterText)}`;
        openUrl(baseUrl);
      } else {
        // Farcaster: open in Warpcast
        const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(farcasterText)}`;
        openUrl(warpcastUrl);
      }
    }
  };

  return (
    <div className="pt-6 border-t border-gray-700/50">
      <div className="text-gray-400 text-sm font-medium mb-3">Share this review:</div>
      <div className="flex items-center gap-2 md:gap-3">
        {/* X (Twitter) Button - Black background, white text */}
        <button
          onClick={handleTwitterShare}
          className="inline-flex items-center justify-center gap-2 px-0 md:px-4 h-10 w-10 md:w-auto bg-black hover:bg-gray-900 text-white rounded-lg border border-gray-800 transition-colors"
        >
          <XLogo />
          <span className="hidden md:inline">Share on X</span>
        </button>
        
        {/* Farcaster/Base Button - Purple for Farcaster, Base blue for Base app */}
        <button
          onClick={handleFarcasterShare}
          className={
            isBaseApp
              ? "inline-flex items-center justify-center gap-2 px-0 md:px-4 h-10 w-10 md:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-lg border border-blue-500 transition-colors"
              : "inline-flex items-center justify-center gap-2 px-0 md:px-4 h-10 w-10 md:w-auto bg-purple-600 hover:bg-purple-700 text-white rounded-lg border border-purple-500 transition-colors"
          }
        >
          {isBaseApp ? (
            <>
              <BaseLogo />
              <span className="hidden md:inline">Base App</span>
            </>
          ) : (
            <>
              <FarcasterLogo />
              <span className="hidden md:inline">Farcaster</span>
            </>
          )}
        </button>
        
        {/* Copy Link Button - Standard outline style */}
        <button
          onClick={handleCopyLink}
          className="inline-flex items-center justify-center gap-2 px-0 md:px-4 h-10 w-10 md:w-auto bg-transparent hover:bg-gray-800 text-gray-300 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-5 h-5" />
              <span className="hidden md:inline">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-5 h-5" />
              <span className="hidden md:inline">Copy Link</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
