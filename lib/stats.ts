/**
 * Statistics Calculation Utilities
 * Frontend functions for calculating review statistics
 */

interface Review {
  reviewer: string;
  reviewee: string;
  content: string;
  emoji: number;
  timestamp: number;
}

/**
 * Calculate average rating from reviews
 * @param reviews Array of reviews
 * @returns Average rating (0-5) or 0 if no reviews
 */
export function calculateAverageRating(reviews: Review[]): number {
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, review) => acc + review.emoji, 0);
  return sum / reviews.length;
}

/**
 * Get rating distribution (count of each emoji)
 * @param reviews Array of reviews
 * @returns Object with counts for each rating (1-5)
 */
export function getRatingDistribution(reviews: Review[]): Record<number, number> {
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  
  reviews.forEach(review => {
    if (review.emoji >= 1 && review.emoji <= 5) {
      const emoji = review.emoji as 1 | 2 | 3 | 4 | 5;
      distribution[emoji]++;
    }
  });
  
  return distribution;
}

/**
 * Get review count for a specific rating
 * @param reviews Array of reviews
 * @param rating Rating to count (1-5)
 * @returns Number of reviews with that rating
 */
export function getReviewCountByRating(reviews: Review[], rating: number): number {
  return reviews.filter(review => review.emoji === rating).length;
}

/**
 * Get percentage of positive reviews (4-5 stars)
 * @param reviews Array of reviews
 * @returns Percentage (0-100)
 */
export function getPositiveReviewPercentage(reviews: Review[]): number {
  if (reviews.length === 0) return 0;
  const positiveCount = reviews.filter(review => review.emoji >= 4).length;
  return (positiveCount / reviews.length) * 100;
}

/**
 * Get recent reviews (last N days)
 * @param reviews Array of reviews
 * @param days Number of days to look back
 * @returns Filtered reviews
 */
export function getRecentReviews(reviews: Review[], days: number): Review[] {
  const cutoffTime = Date.now() / 1000 - (days * 24 * 60 * 60);
  return reviews.filter(review => review.timestamp >= cutoffTime);
}

/**
 * Sort reviews by timestamp (newest first)
 * @param reviews Array of reviews
 * @returns Sorted reviews
 */
export function sortReviewsByNewest(reviews: Review[]): Review[] {
  return [...reviews].sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Sort reviews by rating (highest first)
 * @param reviews Array of reviews
 * @returns Sorted reviews
 */
export function sortReviewsByRating(reviews: Review[]): Review[] {
  return [...reviews].sort((a, b) => b.emoji - a.emoji);
}

/**
 * Format rating for display (e.g., "4.5" or "5.0")
 * @param rating Rating value
 * @returns Formatted string
 */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/**
 * Get rating label from emoji value
 * @param emoji Emoji value (1-5)
 * @returns Label string
 */
export function getRatingLabel(emoji: number): string {
  const labels: Record<number, string> = {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Great',
    5: 'Excellent',
  };
  return labels[emoji] || 'Unknown';
}

/**
 * Get emoji from rating value
 * @param emoji Rating value (1-5)
 * @returns Emoji string
 */
export function getEmojiFromRating(emoji: number): string {
  const emojis: Record<number, string> = {
    1: '😞',
    2: '😕',
    3: '😐',
    4: '😊',
    5: '😍',
  };
  return emojis[emoji] || '😐';
}

