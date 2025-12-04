"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Heart,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useAccount, useChainId, useSwitchChain, useWalletClient } from "wagmi";
import { base } from "wagmi/chains";
import Link from "next/link";
import { useSearchParams, useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  fetchProfileByUsername,
  fetchProfileByFid,
  getPrimaryWallet,
  fetchProfileByWallet,
  fetchProfilesByWallets,
  type NeynarUser,
} from "@/lib/neynar";
import { sdk } from "@/lib/miniapp";
import { getLeaderboardData } from "@/lib/leaderboard";
import {
  estimateReviewCost,
  approveHunt,
  submitReview as submitReviewContract,
  checkHuntAllowance,
  formatHunt,
  parseHunt,
  HUNT_TOKEN_ADDRESS,
  REVIEWME_CONTRACT_ADDRESS,
  REVIEWME_ABI,
} from "@/lib/reviewme-contract";
import { deleteCachedReview, setCachedReview } from "@/lib/cache";
import {
  executeDecentTransaction,
  getDecentQuote,
  type PaymentToken,
} from "@/lib/decent";
import { PAYMENT_TOKENS } from "@/config/tokens";
import { formatUnits } from "viem";
import { publicClient } from "@/lib/reviewme-contract";

const EMOJI_OPTIONS = [
  { value: 5, emoji: "❤️", label: "Love & appreciation" },
  { value: 4, emoji: "🔥", label: "Amazing & inspiring" },
  { value: 3, emoji: "💎", label: "Valuable & insightful" },
  { value: 2, emoji: "🤝", label: "Respect & agreement" },
  { value: 1, emoji: "🤔", label: "Reflective & critical" },
];

const MAX_CONTENT_LENGTH = 145;

export default function ReviewCreateClient() {
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const searchParams = useSearchParams();
  const params = useParams();
  const queryClient = useQueryClient();

  // Check if on correct network
  const isCorrectNetwork = chainId === base.id;

  // Search state
  const [username, setUsername] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Reviewee data
  const [reviewee, setReviewee] = useState<
    (NeynarUser & { wallet: string }) | null
  >(null);
  
  // Self-review prevention
  const isSelfReview = reviewee && userAddress && 
    reviewee.wallet.toLowerCase() === userAddress.toLowerCase();

  // Recent reviewees state
  const [recentReviewees, setRecentReviewees] = useState<
    (NeynarUser & { wallet: string })[]
  >([]);
  const [loadingRecentReviewees, setLoadingRecentReviewees] = useState(false);

  // Review form state
  const [selectedEmoji, setSelectedEmoji] = useState<number | null>(null);
  const [content, setContent] = useState("");

  // Token selection state
  const [selectedToken, setSelectedToken] = useState<PaymentToken>("HUNT");
  const selectedTokenRef = useRef(selectedToken);

  useEffect(() => {
    selectedTokenRef.current = selectedToken;
  }, [selectedToken]);

  const [tokenPrice, setTokenPrice] = useState<bigint | null>(null);
  const [tokenPriceLoading, setTokenPriceLoading] = useState(false);
  const [isHuntFallback, setIsHuntFallback] = useState(false); // Track if showing HUNT price as fallback
  const [tokenBalance, setTokenBalance] = useState<bigint | null>(null);
  const [tokenBalanceLoading, setTokenBalanceLoading] = useState(false);

  // Submission state
  const [huntCost, setHuntCost] = useState("0");
  const [estimating, setEstimating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [submittedReviewId, setSubmittedReviewId] = useState<number | null>(
    null
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Estimate HUNT cost for review
  const estimateHuntCost = async () => {
    setEstimating(true);
    try {
      const { huntAmount } = await estimateReviewCost();
      console.log("Estimated HUNT cost:", formatHunt(huntAmount));
      setHuntCost(formatHunt(huntAmount));

      // If non-HUNT token selected, get quote
      // Note: content is not required here - loadTokenPrice will use placeholder if needed
      if (selectedToken !== "HUNT" && reviewee && selectedEmoji) {
        await loadTokenPrice(huntAmount);
      }
    } catch (err) {
      console.error("Failed to estimate cost:", err);
      // Don't set a fallback - let the user know there's an issue
      setError("Failed to estimate review cost. Please try again.");
      setHuntCost("0");
    } finally {
      setEstimating(false);
    }
  };

  // Load token price quote from Decent
  const loadTokenPrice = async (huntAmount: bigint) => {
    if (!reviewee || !selectedEmoji) return;

    // Capture the token we are fetching for to avoid race conditions
    const tokenToFetch = selectedToken;

    if (tokenToFetch === "HUNT") {
      setTokenPrice(huntAmount);
      setIsHuntFallback(false);
      return;
    }

    // For non-HUNT tokens, we need userAddress for Decent API
    // If wallet is not connected, show HUNT price as fallback
    if (!userAddress) {
      setTokenPrice(huntAmount); // Show HUNT equivalent as fallback
      setIsHuntFallback(true); // Mark as HUNT fallback
      return;
    }

    setIsHuntFallback(false); // Reset fallback flag when wallet is connected

    // For non-HUNT tokens, we need content for Decent API, but use placeholder if not available
    // This allows users to see the price estimate before writing the review
    const reviewContent = content.trim() || "Preview";

    setTokenPriceLoading(true);
    try {
      const quote = await getDecentQuote(
        userAddress as `0x${string}`,
        tokenToFetch,
        reviewee.wallet as `0x${string}`,
        reviewContent,
        selectedEmoji,
        huntAmount
      );

      // Check if token changed while we were awaiting
      if (selectedTokenRef.current !== tokenToFetch) {
        return;
      }

      setTokenPrice(quote.srcAmount);
      setIsHuntFallback(false);
    } catch (err) {
      // Check if token changed while we were awaiting
      if (selectedTokenRef.current !== tokenToFetch) {
        return;
      }

      console.error("Failed to get token price:", err);
      // Fallback to HUNT price if Decent API fails
      setTokenPrice(huntAmount);
      setIsHuntFallback(true); // Mark as HUNT fallback
    } finally {
      // Only turn off loading if we are still on the same token
      if (selectedTokenRef.current === tokenToFetch) {
        setTokenPriceLoading(false);
      }
    }
  };

  // Load token balance
  const loadTokenBalance = async () => {
    if (!userAddress || !isConnected) {
      setTokenBalance(null);
      return;
    }

    // Capture the token we are fetching for to avoid race conditions
    const tokenToFetch = selectedToken;

    setTokenBalanceLoading(true);
    try {
      const tokenInfo = PAYMENT_TOKENS[tokenToFetch];

      if (tokenInfo.isNative) {
        // ETH balance
        const balance = await publicClient.getBalance({ address: userAddress });

        // Check if token changed while we were awaiting
        if (selectedTokenRef.current !== tokenToFetch) {
          return;
        }

        setTokenBalance(balance);
      } else {
        // ERC20 balance
        const balance = await publicClient.readContract({
          address: tokenInfo.address,
          abi: [
            {
              inputs: [{ name: "account", type: "address" }],
              name: "balanceOf",
              outputs: [{ name: "", type: "uint256" }],
              stateMutability: "view",
              type: "function",
            },
          ],
          functionName: "balanceOf",
          args: [userAddress],
        });

        // Check if token changed while we were awaiting
        if (selectedTokenRef.current !== tokenToFetch) {
          return;
        }

        setTokenBalance(balance as bigint);
      }
    } catch (err) {
      // Check if token changed while we were awaiting
      if (selectedTokenRef.current !== tokenToFetch) {
        return;
      }

      console.error("Failed to load token balance:", err);
      setTokenBalance(null);
    } finally {
      // Only turn off loading if we are still on the same token
      if (selectedTokenRef.current === tokenToFetch) {
        setTokenBalanceLoading(false);
      }
    }
  };

  // Load reviewee profile by wallet address
  const loadRevieweeByAddress = async (address: string) => {
    setSearching(true);
    setSearchError("");

    try {
      const user = await fetchProfileByWallet(address as `0x${string}`);

      if (!user) {
        throw new Error("User not found");
      }

      // Get wallet address
      const wallet = getPrimaryWallet(user);
      if (!wallet) {
        throw new Error("User has no verified Ethereum address");
      }

      setReviewee({
        ...user,
        wallet: wallet,
      });

      // Estimate HUNT cost
      estimateHuntCost();
    } catch (err: any) {
      setSearchError(err.message || "Failed to load user profile");
    } finally {
      setSearching(false);
    }
  };

  // Load reviewee profile by FID (for Share Extension)
  const loadRevieweeByFid = async (fid: number) => {
    setSearching(true);
    setSearchError("");

    try {
      const user = await fetchProfileByFid(fid);

      if (!user) {
        throw new Error("User not found");
      }

      // Get wallet address
      const wallet = getPrimaryWallet(user);
      if (!wallet) {
        throw new Error("User has no verified Ethereum address");
      }

      setReviewee({
        ...user,
        wallet: wallet,
      });

      // Estimate HUNT cost
      estimateHuntCost();
    } catch (err: any) {
      setSearchError(err.message || "Failed to load user profile");
    } finally {
      setSearching(false);
    }
  };

  // Load trending reviewees on mount (from leaderboard data)
  useEffect(() => {
    const loadTrendingReviewees = async () => {
      // Don't load if user is searching or has selected a reviewee
      if (searching || reviewee || username.trim()) return;

      setLoadingRecentReviewees(true);
      try {
        // Get leaderboard data (uses 10-minute server cache)
        const leaderboardData = await getLeaderboardData();

        if (leaderboardData.topReviewees.length === 0) {
          setRecentReviewees([]);
          return;
        }

        // Shuffle and pick random 10 from top reviewees
        const shuffled = [...leaderboardData.topReviewees]
          .sort(() => Math.random() - 0.5)
          .slice(0, 10);

        const revieweeAddresses = shuffled.map((entry) => entry.address);

        // Fetch profiles in batch (single API call)
        const profiles = await fetchProfilesByWallets(revieweeAddresses);

        // Convert to reviewee list with primary wallet
        const revieweeList = revieweeAddresses
          .map((addr) => {
            const profile = profiles[addr.toLowerCase()];
            if (!profile) return null;

            const wallet = getPrimaryWallet(profile);
            if (!wallet) return null;

            return {
              ...profile,
              wallet,
            };
          })
          .filter(
            (item): item is NeynarUser & { wallet: string } => item !== null
          );

        setRecentReviewees(revieweeList);
      } catch (err) {
        console.error("Failed to load trending reviewees:", err);
        setRecentReviewees([]);
      } finally {
        setLoadingRecentReviewees(false);
      }
    };

    loadTrendingReviewees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Auto-load reviewee from URL slug (username)
  useEffect(() => {
    if (params?.slug && Array.isArray(params.slug) && params.slug.length > 0) {
      const targetUsername = params.slug[0];
      // Only search if we haven't already found the user or if the username in URL is different
      if (
        targetUsername &&
        (!reviewee ||
          reviewee.username.toLowerCase() !== targetUsername.toLowerCase())
      ) {
        setUsername(targetUsername);
        handleSearch(targetUsername);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // Auto-load reviewee from query parameter (wallet address)
  useEffect(() => {
    const revieweeAddress = searchParams.get("reviewee");
    if (revieweeAddress && !reviewee) {
      loadRevieweeByAddress(revieweeAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Auto-load reviewee from castFid (Share Extension URL parameter)
  useEffect(() => {
    const castFid = searchParams.get("castFid");
    if (castFid && !reviewee) {
      loadRevieweeByFid(parseInt(castFid, 10));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Handle Share Extension SDK context (enriched cast data)
  useEffect(() => {
    const handleShareContext = async () => {
      try {
        const context = await sdk.context;
        if (context?.location?.type === "cast_share" && !reviewee) {
          const cast = (context.location as any).cast;
          if (cast?.author) {
            // Use enriched author data from SDK
            const authorFid = cast.author.fid;
            if (authorFid) {
              loadRevieweeByFid(authorFid);
            }
          }
        }
      } catch (error) {
        console.error("Failed to get SDK context for share extension:", error);
      }
    };

    handleShareContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load token balance when token selection or wallet connection changes
  useEffect(() => {
    if (isConnected && userAddress) {
      loadTokenBalance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedToken, isConnected, userAddress]);

  // Load token price when token selection or hunt cost changes
  // Note: content is NOT included in dependencies because price calculation uses placeholder if content is empty
  useEffect(() => {
    if (reviewee && selectedEmoji && huntCost !== "0") {
      const huntAmount = parseHunt(huntCost);
      if (selectedToken !== "HUNT") {
        // For non-HUNT tokens, load price from Decent API
        // loadTokenPrice will use placeholder content if actual content is empty
        loadTokenPrice(huntAmount);
      } else {
        // For HUNT, directly set the price
        setTokenPrice(huntAmount);
        setIsHuntFallback(false);
      }
    } else {
      // If required data is missing, clear the price
      setTokenPrice(null);
      setTokenPriceLoading(false);
      setIsHuntFallback(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedToken, reviewee, selectedEmoji, huntCost]);

  // Search for user
  const handleSearch = async (usernameOverride?: string) => {
    const targetUsername =
      typeof usernameOverride === "string" ? usernameOverride : username;

    if (!targetUsername.trim()) return;

    setSearching(true);
    setSearchError("");
    setReviewee(null);

    try {
      const trimmedUsername = targetUsername.trim();
      const hadEthSuffix = trimmedUsername.toLowerCase().endsWith(".eth");
      const usernameWithoutEth = trimmedUsername.replace(/\.eth$/i, "");

      let user: NeynarUser | null = null;

      // Try the exact username first (including .eth if provided)
      try {
        user = await fetchProfileByUsername(trimmedUsername);
      } catch (err) {
        // Continue to try alternatives
      }

      // If not found and had .eth suffix, try without it
      if (!user && hadEthSuffix) {
        try {
          user = await fetchProfileByUsername(usernameWithoutEth);
        } catch (err) {
          // Continue to try alternatives
        }
      }

      // If not found and didn't have .eth suffix, try with it
      if (!user && !hadEthSuffix) {
        try {
          user = await fetchProfileByUsername(`${usernameWithoutEth}.eth`);
        } catch (err) {
          // All attempts failed
        }
      }

      if (!user) {
        throw new Error("User not found");
      }

      // Get wallet address
      const wallet = getPrimaryWallet(user);
      if (!wallet) {
        throw new Error("User has no verified Ethereum address");
      }

      setReviewee({
        ...user,
        wallet: wallet,
      });

      // Estimate HUNT cost
      estimateHuntCost();
    } catch (err: any) {
      setSearchError(err.message || "Failed to find user");
    } finally {
      setSearching(false);
    }
  };

  // Approve HUNT tokens
  const handleApprove = async () => {
    if (!isConnected || !userAddress) {
      setError("Please connect your wallet");
      return;
    }

    // Check if on Base network
    if (!isCorrectNetwork) {
      try {
        await switchChain?.({ chainId: base.id });
      } catch (err: any) {
        setError("Please switch to Base network to continue");
        return;
      }
    }

    setApproving(true);
    setError("");

    try {
      // Check current allowance
      const currentAllowance = await checkHuntAllowance(userAddress);

      // Use huntCost from state, or estimate if not available
      let huntAmount: bigint;
      if (huntCost && huntCost !== "0") {
        huntAmount = parseHunt(huntCost);
      } else {
        const estimate = await estimateReviewCost();
        huntAmount = estimate.huntAmount;
        setHuntCost(formatHunt(estimate.huntAmount));
      }

      if (currentAllowance >= huntAmount) {
        console.log("HUNT already approved");
        return;
      }

      // Approve HUNT tokens (with 10% buffer)
      const approveAmount =
        huntAmount + (huntAmount * BigInt(10)) / BigInt(100);
      const hash = await approveHunt(approveAmount, walletClient);
      console.log("HUNT approval tx sent:", hash);

      // Wait for approval transaction to be confirmed
      console.log("Waiting for approval confirmation...");
      await publicClient.waitForTransactionReceipt({ hash });
      console.log("HUNT approval confirmed");

      // Additional wait to ensure all RPC endpoints are synced
      // This prevents "insufficient allowance" errors due to RPC fallback delays
      console.log("Waiting for RPC sync...");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify allowance is actually updated
      const verifiedAllowance = await checkHuntAllowance(userAddress);
      console.log("Verified allowance:", verifiedAllowance.toString());
      if (verifiedAllowance < huntAmount) {
        throw new Error(
          "Approval not yet reflected. Please try again in a moment."
        );
      }
    } catch (err: any) {
      setError(err.message || "Failed to approve HUNT");
      throw err; // Re-throw to stop handleSubmit from continuing
    } finally {
      setApproving(false);
    }
  };

  // Submit review
  const handleSubmit = async () => {
    if (!isConnected || !userAddress) {
      setError("Please connect your wallet");
      return;
    }

    // Check if on Base network
    if (!isCorrectNetwork) {
      try {
        await switchChain?.({ chainId: base.id });
      } catch (err: any) {
        setError("Please switch to Base network to continue");
        return;
      }
    }

    if (!reviewee) {
      setError("Please search for a user first");
      return;
    }

    if (!selectedEmoji) {
      setError("Please select an emoji");
      return;
    }

    if (!content.trim()) {
      setError("Please write a review");
      return;
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      setError(`Review must be ${MAX_CONTENT_LENGTH} characters or less`);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // Get max HUNT amount (with 5% slippage)
      // Use huntCost from state, or estimate if not available
      let huntAmount: bigint;
      if (huntCost && huntCost !== "0") {
        huntAmount = parseHunt(huntCost);
      } else {
        const estimate = await estimateReviewCost();
        huntAmount = estimate.huntAmount;
        setHuntCost(formatHunt(estimate.huntAmount));
      }
      const maxHuntAmount = huntAmount + (huntAmount * BigInt(5)) / BigInt(100); // 5% slippage

      let hash: `0x${string}`;

      // If using ETH, USDC, or MT, use Decent API for atomic swap + submit
      if (
        selectedToken === "ETH" ||
        selectedToken === "USDC" ||
        selectedToken === "MT"
      ) {
        console.log(
          `Using Decent to swap ${selectedToken} to HUNT and submit review`
        );
        hash = await executeDecentTransaction(
          userAddress as `0x${string}`,
          walletClient,
          selectedToken,
          reviewee.wallet as `0x${string}`,
          content,
          selectedEmoji,
          maxHuntAmount
        );
        console.log("✅ Successfully used Decent transaction");
      } else {
        // Use HUNT directly
        // First, check HUNT balance
        const huntBalance = (await publicClient.readContract({
          address: HUNT_TOKEN_ADDRESS,
          abi: [
            {
              inputs: [{ name: "account", type: "address" }],
              name: "balanceOf",
              outputs: [{ name: "", type: "uint256" }],
              stateMutability: "view",
              type: "function",
            },
          ],
          functionName: "balanceOf",
          args: [userAddress],
        })) as bigint;

        console.log("HUNT balance:", formatHunt(huntBalance));
        console.log("Required HUNT:", formatHunt(maxHuntAmount));

        if (huntBalance < maxHuntAmount) {
          throw new Error(
            `Insufficient HUNT balance. You have ${formatHunt(
              huntBalance
            )} HUNT, but need ${formatHunt(maxHuntAmount)} HUNT.`
          );
        }

        // Ensure HUNT is approved
        try {
          await handleApprove();
        } catch (approveError: any) {
          console.error("Approve failed:", approveError);
          throw approveError;
        }

        // Submit review
        const result = await submitReviewContract(
          reviewee.wallet as `0x${string}`,
          content,
          selectedEmoji,
          maxHuntAmount,
          walletClient
        );
        hash = result.hash;
      }

      setTxHash(hash);
      console.log("Review submitted:", { hash });

      // Wait for transaction confirmation and fetch the latest review ID
      // This works for both HUNT and Decent transactions
      await publicClient.waitForTransactionReceipt({ hash });

      // Wait a bit more for RPC to sync (2 seconds)
      // This ensures the review data is available when user clicks "View Review Post"
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const totalReviews = (await publicClient.readContract({
        address: REVIEWME_CONTRACT_ADDRESS,
        abi: [
          {
            type: "function",
            name: "totalReviews",
            stateMutability: "view",
            inputs: [],
            outputs: [{ type: "uint256" }],
          },
        ],
        functionName: "totalReviews",
      })) as bigint;

      // The review ID is totalReviews - 1 (0-indexed)
      const newReviewId = Number(totalReviews) - 1;
      setSubmittedReviewId(newReviewId);
      console.log("Review ID:", newReviewId);

      // Fetch the actual review data from RPC to get accurate timestamp
      let reviewTimestamp = Date.now().toString();
      try {
        const reviewData = (await publicClient.readContract({
          address: REVIEWME_CONTRACT_ADDRESS,
          abi: REVIEWME_ABI,
          functionName: "reviews",
          args: [BigInt(newReviewId)],
        })) as any;

        // Extract timestamp from contract data (supports both object and array format)
        const timestamp = reviewData?.timestamp || reviewData?.[4];
        if (timestamp) {
          reviewTimestamp = timestamp.toString();
        }
      } catch (error) {
        console.warn(
          "Failed to fetch review timestamp, using current time:",
          error
        );
      }

      // Update IndexedDB cache: delete old cache and set new cache with created review data
      try {
        // 1. Delete any existing cache for this review ID (defensive)
        await deleteCachedReview(newReviewId);

        // 2. Immediately cache the newly created review data
        await setCachedReview(newReviewId, {
          reviewId: newReviewId,
          reviewer: userAddress as `0x${string}`,
          reviewee: reviewee.wallet as `0x${string}`,
          content: content,
          emoji: selectedEmoji,
          timestamp: reviewTimestamp,
        });
        console.log(
          `[Review Create] ✅ Cached review ${newReviewId} to IndexedDB`
        );
      } catch (error) {
        console.error("Failed to update cache for new review:", error);
        // Don't block success flow if cache update fails
      }

      setSuccess(true);

      // Invalidate React Query caches to ensure fresh data
      // This is crucial for newly created reviews to appear immediately
      queryClient.invalidateQueries({ queryKey: ["recentReviews"] });
      queryClient.invalidateQueries({ queryKey: ["reviewsForWallet"] });

      // Trigger notifications (non-blocking)
      // 1. Review received notification
      fetchProfileByWallet(userAddress)
        .then((reviewerProfile) => {
          return fetch("/api/notifications/review-received", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reviewId: newReviewId,
              revieweeFid: reviewee.fid,
              reviewerUsername: reviewerProfile?.username || "Someone",
              emoji:
                EMOJI_OPTIONS.find((e) => e.value === selectedEmoji)?.emoji ||
                "💎",
              transactionHash: hash, // Send hash for verification
            }),
          });
        })
        .catch((error) => {
          console.error("Failed to send review notification:", error);
        });

      // 2. Milestone notification (check total reviews for reviewee)
      fetch(`/api/reviews/tx-hashes?wallet=${reviewee.wallet}`)
        .then((res) => res.json())
        .then((data) => {
          const totalReviews = data.reviews?.length || 0;
          const milestones = [5, 10, 25, 50, 100];

          // Check if this is their first review (friend joined)
          if (totalReviews === 1) {
            fetch("/api/notifications/friend-joined-trigger", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                newUserFid: reviewee.fid,
                newUserUsername: reviewee.username,
              }),
            }).catch((error) => {
              console.error(
                "Failed to trigger friend joined notification:",
                error
              );
            });
          }

          // Check for milestone
          if (milestones.includes(totalReviews)) {
            return fetch("/api/notifications/milestone", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userFid: reviewee.fid,
                reviewCount: totalReviews,
              }),
            });
          }
        })
        .catch((error) => {
          console.error("Failed to send milestone notification:", error);
        });
    } catch (err: any) {
      console.error("Failed to submit review:", err);
      setError(err.message || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setReviewee(null);
    setUsername("");
    setSelectedEmoji(null);
    setContent("");
    setError("");
    setSuccess(false);
    setTxHash("");
    setSubmittedReviewId(null);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-12 text-center border border-gray-700/50 max-w-md"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="w-20 h-20 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle2 className="h-10 w-10 text-green-400" />
          </motion.div>
          <h2 className="text-white text-2xl font-semibold mb-3">
            Review Submitted! 🎉
          </h2>
          <p className="text-gray-400 mb-2">
            Your review has been recorded on-chain
          </p>
          {txHash && (
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-pink-400 text-sm hover:underline"
            >
              View on BaseScan →
            </a>
          )}
          <div className="mt-8 flex flex-col gap-3">
            {submittedReviewId !== null && (
              <Link href={`/review/${submittedReviewId}`} className="w-full">
                <Button className="w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white rounded-xl h-12">
                  View Review Post
                </Button>
              </Link>
            )}
            <Button
              onClick={handleReset}
              variant="outline"
              className="w-full rounded-xl h-12"
            >
              Write Another Review
            </Button>
            <Link href="/" className="w-full">
              <Button variant="outline" className="w-full rounded-xl h-12">
                Back to Home
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 pb-24 md:pb-8">
      <div className="max-w-2xl mx-auto px-6 pt-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-white text-3xl font-bold mb-2">Write a Review</h1>
          <p className="text-gray-400 text-sm">
            Share your authentic feedback and earn ReviewMe tokens
          </p>
        </motion.div>

        {/* Search Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <label className="text-white text-sm font-medium mb-3 block">
            Who do you want to review?
          </label>
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
            <div className="relative">
              <Input
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-full bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-500 rounded-xl h-12 pr-24"
                disabled={searching}
              />
              <Button
                onClick={() => handleSearch()}
                disabled={searching || !username.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white rounded-lg h-8 px-3 flex items-center gap-1.5 text-sm font-medium"
              >
                {searching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Search</span>
                  </>
                )}
              </Button>
            </div>

            {searchError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-center gap-2 text-red-400 text-sm"
              >
                <AlertCircle className="w-4 h-4" />
                {searchError}
              </motion.div>
            )}

            {/* Recent Reviewees List - Show when not searching and no reviewee selected */}
            {!reviewee && !searching && !username.trim() && (
              <AnimatePresence>
                {recentReviewees.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-4"
                  >
                    <div className="text-gray-400 text-xs mb-2 px-1">
                      Trending reviewees
                    </div>
                    <div className="space-y-2">
                      {loadingRecentReviewees ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        </div>
                      ) : (
                        recentReviewees.map((user) => (
                          <motion.button
                            key={user.fid}
                            onClick={() => {
                              setReviewee(user);
                              estimateHuntCost();
                            }}
                            className="w-full flex items-center gap-3 p-3 bg-gray-900/50 hover:bg-gray-900/70 rounded-xl border border-gray-700/50 hover:border-gray-600/50 transition-all text-left"
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                          >
                            <img
                              src={user.pfp?.url || "/default-avatar.png"}
                              alt={user.displayName}
                              className="w-10 h-10 rounded-full"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-white font-medium text-sm truncate">
                                {user.displayName}
                              </div>
                              <div className="text-gray-400 text-xs truncate">
                                @{user.username}
                              </div>
                            </div>
                          </motion.button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {reviewee && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-4 flex items-center gap-4 p-4 bg-gray-900/50 rounded-xl border ${
                  isSelfReview ? 'border-red-500/50' : 'border-gray-700/50'
                }`}
              >
                <img
                  src={reviewee.pfp?.url || "/default-avatar.png"}
                  alt={reviewee.displayName}
                  className="w-12 h-12 rounded-full"
                />
                <div className="flex-1">
                  <div className="text-white font-medium">
                    {reviewee.displayName}
                  </div>
                  <div className="text-gray-400 text-sm">
                    @{reviewee.username}
                  </div>
                  {isSelfReview && (
                    <div className="text-red-400 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Cannot review yourself
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleReset}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white"
                >
                  Change
                </Button>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Review Form */}
        <AnimatePresence>
          {reviewee && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Emoji Selection */}
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
                <label className="text-white text-sm font-medium mb-4 block">
                  Choose your emotion:
                </label>
                <div className="grid grid-cols-5 gap-3 mb-4">
                  {EMOJI_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSelectedEmoji(option.value)}
                      className={`
                        flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all
                        ${
                          selectedEmoji === option.value
                            ? "border-pink-500 bg-pink-500/10 shadow-lg shadow-pink-500/20"
                            : "border-gray-700 bg-gray-900/50 hover:border-gray-600"
                        }
                      `}
                    >
                      <span className="text-3xl">{option.emoji}</span>
                    </button>
                  ))}
                </div>
                {/* Selected emoji description */}
                {selectedEmoji && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="pt-4 border-t border-gray-700/50"
                  >
                    <p className="text-pink-400 text-sm font-medium text-center">
                      {
                        EMOJI_OPTIONS.find((opt) => opt.value === selectedEmoji)
                          ?.label
                      }
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Review Text */}
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-white text-sm font-medium">
                    Write your review
                  </label>
                  <span
                    className={`text-xs ${
                      content.length > MAX_CONTENT_LENGTH
                        ? "text-red-400"
                        : "text-gray-400"
                    }`}
                  >
                    {content.length}/{MAX_CONTENT_LENGTH}
                  </span>
                </div>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Share your honest feedback..."
                  className="bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-500 rounded-xl min-h-[120px] resize-none"
                  maxLength={MAX_CONTENT_LENGTH + 50} // Allow typing past limit to show error
                />
              </div>

              {/* Token Selection */}
              {reviewee && (
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white text-sm font-medium">
                      Pay with:
                    </h3>
                    {tokenPriceLoading ? (
                      <span className="text-gray-400 text-xs">Loading...</span>
                    ) : tokenPrice ? (
                      <span className="text-pink-400 text-sm font-medium">
                        {(() => {
                          // If showing HUNT fallback for non-HUNT token, use HUNT decimals
                          if (isHuntFallback && selectedToken !== "HUNT") {
                            const huntInfo = PAYMENT_TOKENS["HUNT"];
                            return `~${formatUnits(
                              tokenPrice,
                              huntInfo.decimals
                            )} HUNT equivalent`;
                          }
                          const tokenInfo = PAYMENT_TOKENS[selectedToken];
                          return `${formatUnits(
                            tokenPrice,
                            tokenInfo.decimals
                          )} ${selectedToken}`;
                        })()}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {(["HUNT", "MT", "ETH", "USDC"] as PaymentToken[]).map(
                      (token) => (
                        <button
                          key={token}
                          onClick={() => setSelectedToken(token)}
                          disabled={submitting}
                          className={`
                          px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium
                          ${
                            selectedToken === token
                              ? "border-pink-500 bg-pink-500/10 text-pink-400"
                              : "border-gray-700 bg-gray-900/50 text-gray-400 hover:border-gray-600 hover:text-gray-300"
                          }
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                        >
                          {token}
                        </button>
                      )
                    )}
                  </div>
                  {isConnected && userAddress && (
                    <div className="text-xs text-gray-500">
                      Your balance:{" "}
                      {tokenBalanceLoading ? (
                        <span className="text-gray-600">Loading...</span>
                      ) : tokenBalance !== null ? (
                        <span
                          className={
                            tokenBalance < (tokenPrice || 0n)
                              ? "text-red-400"
                              : "text-gray-400"
                          }
                        >
                          {(() => {
                            const tokenInfo = PAYMENT_TOKENS[selectedToken];
                            return `${formatUnits(
                              tokenBalance,
                              tokenInfo.decimals
                            )} ${selectedToken}`;
                          })()}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Token Distribution Info */}
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
                <h3 className="text-white text-sm font-medium mb-4">
                  Review submission process
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-pink-500/20 border border-pink-500/50 flex items-center justify-center flex-shrink-0">
                      <span className="text-pink-400 text-xs font-semibold">
                        1
                      </span>
                    </div>
                    <span className="text-gray-300 text-sm">
                      100 $RM will be minted
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-pink-500/20 border border-pink-500/50 flex items-center justify-center flex-shrink-0">
                      <span className="text-pink-400 text-xs font-semibold">
                        2
                      </span>
                    </div>
                    <span className="text-gray-300 text-sm">
                      Submit review on-chain
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-pink-500/20 border border-pink-500/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-pink-400 text-xs font-semibold">
                        3
                      </span>
                    </div>
                    <div className="flex-1">
                      <span className="text-sm text-gray-300 leading-relaxed">
                        You'll receive{" "}
                        <span className="text-blue-400 font-medium">
                          89 $RM
                        </span>
                        ,{" "}
                        <span className="text-green-400 font-medium">
                          @{reviewee.username || "user"}
                        </span>{" "}
                        will receive{" "}
                        <span className="text-green-400 font-medium">
                          10 $RM
                        </span>
                        , and{" "}
                        <span className="text-orange-400 font-medium">
                          1 $RM
                        </span>{" "}
                        will be burned.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3"
                >
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <span className="text-red-400 text-sm">{error}</span>
                </motion.div>
              )}

              {/* Submit Button */}
              {!isConnected ? (
                <div className="space-y-3">
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                    <span className="text-yellow-400 text-sm">
                      Please connect your wallet to submit the review
                    </span>
                  </div>
                  <Button
                    onClick={() => {}}
                    disabled
                    className="w-full bg-gray-600 text-gray-400 rounded-xl h-14 text-lg cursor-not-allowed"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Connect Wallet to Submit
                  </Button>
                </div>
              ) : !isCorrectNetwork ? (
                <div className="space-y-3">
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                    <span className="text-yellow-400 text-sm">
                      Please switch to Base network to submit the review
                    </span>
                  </div>
                  <Button
                    onClick={() => switchChain?.({ chainId: base.id })}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl h-14 text-lg shadow-lg shadow-blue-500/25"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Switch to Base Network
                  </Button>
                </div>
              ) : (
                <>
                  {isSelfReview && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 mb-3">
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                      <span className="text-red-400 text-sm">
                        Cannot review yourself. Please select a different user.
                      </span>
                    </div>
                  )}
                  {tokenBalance !== null &&
                    tokenPrice !== null &&
                    tokenBalance < tokenPrice && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 mb-3">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                        <span className="text-red-400 text-sm">
                          Insufficient {selectedToken} balance. Please select a
                          different token or add funds to your wallet.
                        </span>
                      </div>
                    )}
                  <Button
                    onClick={handleSubmit}
                    disabled={
                      !selectedEmoji ||
                      !content.trim() ||
                      submitting ||
                      content.length > MAX_CONTENT_LENGTH ||
                      isSelfReview ||
                      (tokenBalance !== null &&
                        tokenPrice !== null &&
                        tokenBalance < tokenPrice)
                    }
                    className="w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white rounded-xl h-14 text-lg shadow-lg shadow-pink-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Submitting Review...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        Submit Review
                      </>
                    )}
                  </Button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
