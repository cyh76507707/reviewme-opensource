"use client";

import { useEffect, useState, useCallback } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import React from "react";

interface FrameContextType {
  isSDKLoaded: boolean;
  openUrl: (url: string) => Promise<void>;
  close: () => Promise<void>;
  isAppAdded: boolean;
  hasNotifications: boolean;
  requestAddApp: () => Promise<void>;
  requestNotifications: () => Promise<void>;
}

const FrameContext = React.createContext<FrameContextType | undefined>(undefined);

export function useFrame() {
  const context = React.useContext(FrameContext);
  if (!context) {
    throw new Error('useFrame must be used within FrameProvider');
  }
  return context;
}

function useFrameInternal() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [isAppAdded, setIsAppAdded] = useState(false);
  const [hasNotifications, setHasNotifications] = useState(false);

  // SDK actions only work in mini app clients, so this pattern supports browser actions as well
  const openUrl = useCallback(async (url: string) => {
    try {
      await sdk.actions.openUrl(url);
    } catch (error) {
      // Fallback to browser
      window.open(url, '_blank');
    }
  }, []);

  const close = useCallback(async () => {
    try {
      await sdk.actions.close();
    } catch (error) {
      // Fallback to browser
      window.close();
    }
  }, []);

  // Check context and update state
  const checkContext = useCallback(async () => {
    try {
      const context = await sdk.context;
      if (context?.client) {
        setIsAppAdded(context.client.added || false);
        setHasNotifications(!!context.client.notificationDetails);
      }
    } catch (error) {
      console.error('Failed to check SDK context:', error);
    }
  }, []);

  // Request to add the mini app
  const requestAddApp = useCallback(async () => {
    try {
      const result = await sdk.actions.addMiniApp();
      
      // Check if notificationDetails were included
      // Note: result might be undefined if user rejects or in web environment
      if (result && result.notificationDetails) {
        setHasNotifications(true);
        setIsAppAdded(true);
      } else if (result) {
        // App added but notifications not enabled
        setIsAppAdded(true);
        await checkContext();
      } else {
        // Result is undefined, check context to see current state
        await checkContext();
      }
      
      // Refresh context to ensure state is up to date
      await checkContext();
    } catch (error) {
      console.error('Failed to add mini app:', error);
      // User might have rejected, still check context
      await checkContext();
    }
  }, [checkContext]);

  // Request notifications (user needs to enable manually via client UI)
  const requestNotifications = useCallback(async () => {
    // Note: Farcaster SDK doesn't have requestNotifications action
    // Users need to enable notifications manually via the client UI (··· menu)
    // This function just refreshes the context to check if they've enabled it
    await checkContext();
  }, [checkContext]);

  useEffect(() => {
    const load = async () => {
      try {
        // Call ready() to hide splash screen and display content
        await sdk.actions.ready();

        // Check initial context state
        await checkContext();

        // Only try to add mini app if not already added
        // Check result and update state accordingly
        const context = await sdk.context;
        if (!context?.client?.added) {
          sdk.actions.addMiniApp()
            .then(async (result) => {
              // Note: result might be undefined in web environment
              if (result && result.notificationDetails) {
                setHasNotifications(true);
                setIsAppAdded(true);
              } else if (result) {
                // App added but notifications not enabled
                setIsAppAdded(true);
                await checkContext();
              } else {
                // Result is undefined, check context
                await checkContext();
              }
            })
            .catch(async () => {
              // User rejected or error, check context to see current state
              await checkContext();
            });
        }

        setIsSDKLoaded(true);
      } catch (error) {
        // Continue even if error occurs (e.g., not in mini app environment)
        setIsSDKLoaded(true);
      }
    };

    load();
  }, [checkContext]); // Include checkContext in dependencies

  return {
    isSDKLoaded,
    openUrl,
    close,
    isAppAdded,
    hasNotifications,
    requestAddApp,
    requestNotifications,
  };
}

export function FrameProvider({ children }: { children: React.ReactNode }) {
  const frameContext = useFrameInternal();

  if (!frameContext.isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <FrameContext.Provider value={frameContext}>
      {children}
    </FrameContext.Provider>
  );
}

