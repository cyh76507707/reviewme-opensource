'use client';

import { Star } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ImageWithFallback } from "./ImageWithFallback";
import { motion } from "framer-motion";

interface User {
  id: string;
  fid: number;
  displayName: string;
  username: string;
  profileImage: string;
  reviewCount: number;
}

interface UserProfileCardProps {
  user: User;
  onViewReviews: () => void;
}

export function UserProfileCard({ user, onViewReviews }: UserProfileCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-4 border border-gray-700/50 hover:border-pink-500/30 transition-all cursor-pointer"
      onClick={onViewReviews}
    >
      <div className="flex items-center gap-4">
        {/* Profile Image */}
        <div className="relative flex-shrink-0">
          <ImageWithFallback
            src={user.profileImage}
            alt={user.displayName}
            className="w-16 h-16 rounded-full object-cover ring-2 ring-pink-500/20"
          />
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-gray-900" />
        </div>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium truncate">{user.displayName}</h3>
          <p className="text-sm text-gray-400 truncate">@{user.username}</p>
          <Badge 
            variant="secondary"
            className="mt-2 bg-pink-500/10 text-pink-300 border-pink-500/20 text-xs"
          >
            <Star className="w-3 h-3 mr-1 fill-pink-400" />
            {user.reviewCount} reviews
          </Badge>
        </div>

        {/* Arrow Icon */}
        <div className="text-gray-500">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

