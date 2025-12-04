'use client';

import { useEffect, useState } from 'react';
import { useFrame } from '@/components/providers/FrameProvider';
import { usePlatformDetection } from '@/lib/hooks/usePlatformDetection';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Bell } from 'lucide-react';

export function NotificationModal() {
  const { isAppAdded, hasNotifications, requestAddApp, requestNotifications } = useFrame();
  const { platform, isLoading: platformLoading } = usePlatformDetection();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    // Don't show modal in web browser or Base app
    if (platform === 'web' || platform === 'base' || platformLoading) {
      setIsOpen(false);
      return;
    }

    // Only show in Farcaster app (Warpcast, etc.)
    if (platform !== 'farcaster') {
      setIsOpen(false);
      return;
    }

    // Check localStorage for "don't show again" preference
    const hasDismissed = localStorage.getItem('reviewme-notification-modal-dismissed');
    if (hasDismissed === 'true') {
      setDontShowAgain(true);
      return;
    }

    // Show modal if app is not added or notifications are not enabled
    if (!isAppAdded || !hasNotifications) {
      setIsOpen(true);
    } else {
      // Both conditions met, close modal
      setIsOpen(false);
    }
  }, [isAppAdded, hasNotifications, platform, platformLoading]);

  // Periodically check notification status when modal is open and app is added
  useEffect(() => {
    if (!isOpen || !isAppAdded || hasNotifications) return;

    const interval = setInterval(async () => {
      // Refresh context to check if user enabled notifications manually
      await requestNotifications();
    }, 2000); // Check every 2 seconds

    return () => clearInterval(interval);
  }, [isOpen, isAppAdded, hasNotifications, requestNotifications]);

  const handleAddApp = async () => {
    setIsLoading(true);
    try {
      await requestAddApp();
      // If notifications are now enabled, close modal
      if (hasNotifications) {
        handleClose();
      }
    } catch (error) {
      console.error('Failed to add app:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableNotifications = async () => {
    // Just refresh context - user needs to enable manually via client UI
    setIsLoading(true);
    try {
      await requestNotifications();
      // Check again after a short delay
      setTimeout(async () => {
        await requestNotifications();
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to check notifications:', error);
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    if (dontShowAgain) {
      localStorage.setItem('reviewme-notification-modal-dismissed', 'true');
    }
  };

  const handleDontShowAgain = () => {
    setDontShowAgain(true);
    handleClose();
  };

  // Expose modal control functions to window for testing in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // @ts-ignore
      window.__reviewme_modal = {
        open: () => {
          setDontShowAgain(false);
          setIsOpen(true);
          console.log('✅ Notification modal opened via console');
        },
        close: () => {
          setIsOpen(false);
          console.log('✅ Notification modal closed via console');
        },
        reset: () => {
          localStorage.removeItem('reviewme-notification-modal-dismissed');
          setDontShowAgain(false);
          setIsOpen(true);
          console.log('✅ Notification modal reset via console');
        },
      };
      console.log('🔧 Dev tools: Use window.__reviewme_modal.open() to test the modal');
    }

    return () => {
      if (process.env.NODE_ENV === 'development') {
        // @ts-ignore
        delete window.__reviewme_modal;
      }
    };
  }, []);

  // Don't show modal in web browser or Base app (unless forced open via dev tools)
  if ((platform === 'web' || platform === 'base' || platformLoading) && !isOpen) {
    return null;
  }

  // Don't show in Base app at all
  if (platform === 'base') {
    return null;
  }

  if (dontShowAgain || ((isAppAdded && hasNotifications) && !isOpen)) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm"
          />

          {/* Bottom Sheet Modal */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-[10000] w-full"
          >
            <div className="rounded-t-3xl border-t border-gray-700/50 bg-gray-900/95 backdrop-blur-sm shadow-2xl">
              {/* Drag Handle */}
              <div className="flex justify-center pt-4 pb-3">
                <div className="h-1 w-12 rounded-full bg-gray-600" />
              </div>

              {/* Content */}
              <div className="px-6 pt-4 pb-6">
                {/* Header */}
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-500/20 flex-shrink-0">
                      <Bell className="h-6 w-6 text-pink-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {!isAppAdded ? 'Add ReviewMe' : 'Enable Notifications'}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {!isAppAdded
                          ? 'Add the app to your Farcaster client'
                          : 'Get notified about new reviews'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors flex-shrink-0 ml-2"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Description */}
                <div className="mb-6">
                  <p className="text-sm text-gray-300">
                    {!isAppAdded ? (
                      <>
                        Add ReviewMe to your Farcaster client to stay updated with reviews and
                        notifications.
                      </>
                    ) : (
                      <>
                        Enable notifications to receive alerts when you receive new reviews, reach
                        milestones, and more.
                        <br />
                        <span className="text-xs text-gray-400 mt-2 block">
                          Go to ··· menu → Turn on notifications
                        </span>
                      </>
                    )}
                  </p>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <Button
                    onClick={!isAppAdded ? handleAddApp : handleEnableNotifications}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white rounded-xl h-12 font-semibold"
                  >
                    {isLoading ? (
                      'Processing...'
                    ) : !isAppAdded ? (
                      'Add App'
                    ) : (
                      'Enable Notifications'
                    )}
                  </Button>

                  <button
                    onClick={handleDontShowAgain}
                    className="w-full text-sm text-gray-400 hover:text-gray-300 transition-colors py-2"
                  >
                    Don't show this again
                  </button>
                </div>
              </div>

              {/* Safe area bottom padding for mobile devices */}
              <div className="h-safe-area-inset-bottom" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

