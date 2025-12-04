'use client';

import React from 'react';

interface CuteHeartIconProps {
  className?: string;
  size?: number;
}

export function CuteHeartIcon({ className = '', size = 24 }: CuteHeartIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Heart shape - classic heart path */}
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill="currentColor"
      />
      
      {/* Left eyebrow */}
      <path
        d="M7.5 7.5 Q8.5 6.8 9.5 7.5"
        stroke="rgba(0,0,0,0.2)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      
      {/* Right eyebrow */}
      <path
        d="M14.5 7.5 Q15.5 6.8 16.5 7.5"
        stroke="rgba(0,0,0,0.2)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      
      {/* Left eye - white circle */}
      <circle cx="9" cy="10" r="2" fill="white" />
      {/* Left eye - black pupil */}
      <circle cx="9" cy="10" r="1" fill="rgba(0,0,0,0.8)" />
      
      {/* Right eye - white circle */}
      <circle cx="15" cy="10" r="2" fill="white" />
      {/* Right eye - black pupil */}
      <circle cx="15" cy="10" r="1" fill="rgba(0,0,0,0.8)" />
      
      {/* Smile */}
      <path
        d="M9 13.5 Q12 16 15 13.5"
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

