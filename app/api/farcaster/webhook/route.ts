import { NextRequest, NextResponse } from 'next/server';
import {
  saveUserNotificationToken,
  disableUserNotifications,
} from '@/lib/notification.server';
import {
  parseWebhookEvent,
  verifyAppKeyWithNeynar,
  type ParseWebhookEvent,
} from '@farcaster/miniapp-node';

/**
 * Webhook endpoint for Farcaster miniapp events
 * Handles: miniapp_added, miniapp_removed, notifications_enabled, notifications_disabled
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Verify and parse the webhook event using the official Farcaster library
    let data;
    try {
      if (process.env.NEYNAR_API_KEY) {
        // Verify signature with Neynar
        data = await parseWebhookEvent(body, verifyAppKeyWithNeynar);
      } else {
        // Parse without verification (development only)
        console.warn(
          '⚠️  Processing webhook without signature verification (NEYNAR_API_KEY not set)'
        );
        data = await parseWebhookEvent(body, async () => ({
          valid: true,
          appFid: 0,
        }));
      }
    } catch (e: unknown) {
      const error = e as ParseWebhookEvent.ErrorType;

      switch (error.name) {
        case 'VerifyJsonFarcasterSignature.InvalidDataError':
        case 'VerifyJsonFarcasterSignature.InvalidEventDataError':
          console.error('Invalid webhook data format:', error);
          return NextResponse.json(
            { error: 'Invalid request data' },
            { status: 400 }
          );

        case 'VerifyJsonFarcasterSignature.InvalidAppKeyError':
          console.error('Invalid app key signature:', error);
          return NextResponse.json(
            { error: 'Invalid signature' },
            { status: 401 }
          );

        case 'VerifyJsonFarcasterSignature.VerifyAppKeyError':
          console.error('Error verifying app key:', error);
          return NextResponse.json(
            { error: 'Verification error' },
            { status: 500 }
          );

        default:
          console.error('Unknown verification error:', error);
          return NextResponse.json(
            { error: 'Verification failed' },
            { status: 500 }
          );
      }
    }

    const { fid, event } = data;
    console.log(`Received Farcaster event: ${event.event} for FID ${fid}`);

    switch (event.event) {
      case 'miniapp_added':
        // When user adds the app, they might have notifications enabled by default
        if (
          event.notificationDetails?.token &&
          event.notificationDetails?.url
        ) {
          await saveUserNotificationToken(
            fid,
            event.notificationDetails.token,
            event.notificationDetails.url
          );
          console.log(`Saved notification token for FID ${fid}`);
        }
        break;

      case 'notifications_enabled':
        // User explicitly enabled notifications
        if (
          event.notificationDetails?.token &&
          event.notificationDetails?.url
        ) {
          await saveUserNotificationToken(
            fid,
            event.notificationDetails.token,
            event.notificationDetails.url
          );
          console.log(`Enabled notifications for FID ${fid}`);
        }
        break;

      case 'notifications_disabled':
        // User disabled notifications
        await disableUserNotifications(fid);
        console.log(`Disabled notifications for FID ${fid}`);
        break;

      case 'miniapp_removed':
        // User removed the app entirely
        await disableUserNotifications(fid);
        console.log(`User ${fid} removed the app`);
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

