"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, TrendingUp, Medal, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getLeaderboardData,
  getLeaderboardAddresses,
  type LeaderboardEntry,
} from "@/lib/leaderboard";
import { useProfiles } from "@/lib/hooks/useNeynar";
import { formatAddress } from "@/lib/neynar";
import Link from "next/link";

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<"reviewers" | "reviewees">(
    "reviewees"
  );
  const [topReviewers, setTopReviewers] = useState<LeaderboardEntry[]>([]);
  const [topReviewees, setTopReviewees] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [error, setError] = useState("");
  const [allAddresses, setAllAddresses] = useState<string[]>([]);

  // Fetch profiles using the shared useProfiles hook (with IndexedDB caching)
  const { data: profiles, isLoading: profilesLoading } =
    useProfiles(allAddresses);

  const loadLeaderboard = async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await getLeaderboardData(forceRefresh);

      setTopReviewers(data.topReviewers);
      setTopReviewees(data.topReviewees);
      setLastUpdated(data.lastUpdated);

      // Get all unique addresses for profile fetching
      setAllAddresses(getLeaderboardAddresses(data));
    } catch (error) {
      console.error("Failed to load leaderboard:", error);
      setError("Failed to load leaderboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const handleRefresh = () => {
    loadLeaderboard(true);
  };

  // Enrich entries with profile data from useProfiles
  const enrichWithProfiles = (
    entries: LeaderboardEntry[]
  ): LeaderboardEntry[] => {
    if (!profiles) return entries;

    return entries.map((entry) => {
      const profile = profiles[entry.address.toLowerCase()];
      return {
        ...entry,
        username: profile?.username,
        pfpUrl: profile?.pfp?.url,
      };
    });
  };

  const currentData =
    activeTab === "reviewers"
      ? enrichWithProfiles(topReviewers)
      : enrichWithProfiles(topReviewees);

  // Get medal emoji for top 3
  const getMedalEmoji = (rank: number) => {
    if (rank === 0) return "🥇";
    if (rank === 1) return "🥈";
    if (rank === 2) return "🥉";
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 pb-24 md:pb-8">
      {/* Header */}
      <div className="px-6 pt-8 pb-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4"
        >
          <Trophy className="w-12 h-12 text-yellow-400" />
          <h1
            className="text-white text-3xl font-bold"
            style={{ fontFamily: "'Poetsen One', cursive" }}
          >
            Leaderboard
          </h1>
          <p className="text-gray-400 text-sm max-w-md">
            Top contributors based on the last 1000 reviews
          </p>

          {/* Refresh Button */}
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-2 text-sm"
          >
            {refreshing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </>
            )}
          </Button>

          {lastUpdated > 0 && (
            <p className="text-gray-500 text-xs">
              Last updated: {new Date(lastUpdated).toLocaleTimeString()}
            </p>
          )}
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="px-6 mb-6">
        <div className="flex gap-2 bg-gray-800/50 rounded-xl p-1 max-w-md mx-auto">
          <button
            onClick={() => setActiveTab("reviewees")}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "reviewees"
                ? "bg-pink-500 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Medal className="w-4 h-4 inline mr-2" />
            Top Reviewees
          </button>
          <button
            onClick={() => setActiveTab("reviewers")}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "reviewers"
                ? "bg-pink-500 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-2" />
            Top Reviewers
          </button>
        </div>
      </div>

      {/* Leaderboard List */}
      <div className="px-6 max-w-2xl mx-auto">
        {error ? (
          <div className="text-center py-12">
            <p className="text-red-400 mb-4">{error}</p>
            <Button
              onClick={() => {
                setError("");
                loadLeaderboard(true);
              }}
              className="bg-pink-500"
            >
              Retry
            </Button>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
            <p className="text-gray-400">Loading leaderboard...</p>
          </div>
        ) : currentData.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No data available yet
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            {currentData.map((entry, index) => {
              const medal = getMedalEmoji(index);

              return (
                <motion.div
                  key={entry.address}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border ${
                    index < 3
                      ? "border-yellow-500/30 shadow-lg shadow-yellow-500/10"
                      : "border-gray-700/50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="flex-shrink-0 w-12 text-center">
                      {medal ? (
                        <span className="text-3xl">{medal}</span>
                      ) : (
                        <span className="text-gray-400 font-bold text-lg">
                          #{index + 1}
                        </span>
                      )}
                    </div>

                    {/* Profile Image */}
                    <div className="flex-shrink-0">
                      {profilesLoading ? (
                        <div className="w-12 h-12 rounded-full bg-gray-700 animate-pulse" />
                      ) : entry.pfpUrl ? (
                        <img
                          src={entry.pfpUrl}
                          alt={entry.username || "User"}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-500" />
                      )}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      {profilesLoading ? (
                        <div className="h-5 bg-gray-700 rounded animate-pulse w-24" />
                      ) : entry.username ? (
                        <Link
                          href={`/user/${entry.address}`}
                          className="text-white font-semibold hover:text-pink-400 transition-colors block truncate"
                        >
                          @{entry.username}
                        </Link>
                      ) : (
                        <Link
                          href={`/user/${entry.address}`}
                          className="text-gray-400 text-sm hover:text-pink-400 transition-colors block truncate"
                        >
                          {formatAddress(entry.address as `0x${string}`)}
                        </Link>
                      )}
                    </div>

                    {/* Count */}
                    <div className="flex-shrink-0 text-right">
                      <div className="text-2xl font-bold text-white">
                        {entry.count}
                      </div>
                      <div className="text-xs text-gray-400">
                        {activeTab === "reviewers" ? "reviews" : "received"}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Info */}
      <div className="px-6 mt-8 max-w-2xl mx-auto">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm text-center">
            📊 Rankings are based on the most recent 5,000 reviews and update
            every 10 minutes
          </p>
        </div>
      </div>
    </div>
  );
}
