'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { useTxHash } from '@/lib/hooks/useReview';

interface TxHashLinkProps {
  reviewId: number;
  initialTxHash?: string | null;
}

export function TxHashLink({ reviewId, initialTxHash }: TxHashLinkProps) {
  // Use client-side RPC hook with caching
  // Falls back to API route if NEXT_PUBLIC_USE_CLIENT_RPC=false
  const { data: txHash, isLoading } = useTxHash(reviewId);

  // Use initialTxHash if provided (from server-side fetch)
  const displayTxHash = initialTxHash ?? txHash ?? null;

  if (!displayTxHash) {
    return (
      <span className="text-sm text-gray-500">
        {isLoading ? 'Loading tx…' : 'Tx pending'}
      </span>
    );
  }

  return (
    <Link
      href={`https://basescan.org/tx/${displayTxHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-sm text-pink-400 hover:text-pink-300 transition-colors"
    >
      View Tx
      <ExternalLink className="w-3 h-3" />
    </Link>
  );
}

