import { prisma } from './db.server';

/**
 * Save or update user notification settings
 */
export async function saveUserNotificationToken(
  fid: number,
  token: string,
  url: string
) {
  await prisma.user.upsert({
    where: { fid },
    update: {
      notificationToken: token,
      notificationUrl: url,
      updatedAt: new Date(),
    },
    create: {
      fid,
      notificationToken: token,
      notificationUrl: url,
    },
  });
}

/**
 * Disable notifications for a user
 */
export async function disableUserNotifications(fid: number) {
  await prisma.user.updateMany({
    where: { fid },
    data: {
      notificationToken: null,
      notificationUrl: null,
      updatedAt: new Date(),
    },
  });
}

/**
 * Send notifications to all users with the given tokens
 */
export async function sendNotificationsToAllUsers(params: {
  notificationId: string;
  title: string;
  body: string;
  targetUrl: string;
  tokens: { token: string; url: string }[];
}): Promise<{
  successful: number;
  failed: number;
}> {
  const { notificationId, title, body, targetUrl, tokens } = params;

  // Group tokens by URL (different Farcaster clients may have different URLs)
  const tokensByUrl = new Map<string, string[]>();
  for (const { token, url } of tokens) {
    if (!tokensByUrl.has(url)) {
      tokensByUrl.set(url, []);
    }
    tokensByUrl.get(url)!.push(token);
  }

  let successful = 0;
  let failed = 0;

  // Send to each URL endpoint
  for (const [url, urlTokens] of tokensByUrl.entries()) {
    // Split into batches of 100 (API limit)
    for (let i = 0; i < urlTokens.length; i += 100) {
      const batch = urlTokens.slice(i, i + 100);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notificationId,
            title,
            body,
            targetUrl,
            tokens: batch,
          }),
        });

        if (response.ok) {
          const result = await response.json();

          // Handle different response formats
          const successfulTokens =
            result.successfulTokens || result.result?.successfulTokens || [];
          const invalidTokens =
            result.invalidTokens || result.result?.invalidTokens || [];

          // If no explicit success count, assume all tokens in batch succeeded
          const batchSuccessful =
            successfulTokens.length || batch.length - invalidTokens.length;
          successful += batchSuccessful;

          // Clean up invalid tokens
          if (invalidTokens.length > 0) {
            await prisma.user.updateMany({
              where: {
                notificationToken: { in: invalidTokens },
              },
              data: {
                notificationToken: null,
                notificationUrl: null,
              },
            });
          }
        } else {
          failed += batch.length;
        }
      } catch (error) {
        console.error('Error sending notification batch:', error);
        failed += batch.length;
      }
    }
  }

  return { successful, failed };
}

/**
 * Send notification for a new review
 */
export async function notifyReviewReceived(params: {
  reviewId: number;
  revieweeFid: number;
  reviewerUsername: string;
  emoji: string;
}): Promise<{ notified: number }> {
  const { reviewId, revieweeFid, reviewerUsername, emoji } = params;

  // Check if notification was already sent for this review
  const existing = await prisma.notificationLog.findUnique({
    where: { reviewId },
  });

  if (existing) {
    return { notified: 0 };
  }

  // Create the notification log entry
  try {
    await prisma.notificationLog.create({
      data: {
        notificationId: `review-${reviewId}`,
        reviewId,
      },
    });
  } catch (error: any) {
    // If unique constraint fails, another concurrent request created it
    if (error.code === 'P2002') {
      return { notified: 0 };
    }
    throw error;
  }

  // Get the reviewee's notification settings
  const user = await prisma.user.findUnique({
    where: { fid: revieweeFid },
  });

  if (!user || !user.notificationToken || !user.notificationUrl) {
    return { notified: 0 };
  }

  // Send notification
  const bodyText = reviewerUsername && reviewerUsername !== 'Someone'
    ? `@${reviewerUsername} left you a ${emoji} review`
    : `Someone left you a ${emoji} review`;
  
  const result = await sendNotificationsToAllUsers({
    notificationId: `review-${reviewId}`,
    title: '💎 New Review Received!',
    body: bodyText,
    targetUrl: `https://reviewme.fun/review/${reviewId}`,
    tokens: [
      {
        token: user.notificationToken,
        url: user.notificationUrl,
      },
    ],
  });

  // Update the log with the count
  await prisma.notificationLog.update({
    where: { reviewId },
    data: { receivedCount: result.successful },
  });

  console.log(
    `[NOTIFICATION_SENT] ReviewId: ${reviewId} / FID: ${revieweeFid} / Successful: ${result.successful}`
  );

  return { notified: result.successful };
}

/**
 * Get notification stats
 */
export async function getNotificationStats() {
  const [totalUsers, enabledUsers, totalNotifications] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { notificationToken: { not: null } } }),
    prisma.notificationLog.count(),
  ]);

  return {
    totalUsers,
    enabledUsers,
    totalNotifications,
  };
}

