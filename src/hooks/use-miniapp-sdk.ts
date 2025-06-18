"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import sdk from "@farcaster/frame-sdk";
import type { Context } from "@farcaster/frame-core";

export function useMiniAppSdk() {
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);

  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const [isMiniAppSaved, setIsMiniAppSaved] = useState(false);
  const [lastEvent, setLastEvent] = useState("");
  const [pinFrameResponse, setPinFrameResponse] = useState("");
  const [isMiniApp, setIsMiniApp] = useState(false);
  
  // Ref to track if component is mounted to prevent state updates on unmounted components
  const isMountedRef = useRef(true);

  useEffect(() => {
    if (!sdk) return;

    // Set up event listeners with proper cleanup tracking
    const handleFrameAdded = ({ notificationDetails }: { notificationDetails?: unknown }) => {
      if (!isMountedRef.current) return;
      setLastEvent(
        `frameAdded${notificationDetails ? ", notifications enabled" : ""}`,
      );
      setIsMiniAppSaved(true);
    };

    const handleFrameAddRejected = ({ reason }: { reason: string }) => {
      if (!isMountedRef.current) return;
      setLastEvent(`frameAddRejected, reason ${reason}`);
    };

    const handleFrameRemoved = () => {
      if (!isMountedRef.current) return;
      setLastEvent("frameRemoved");
      setIsMiniAppSaved(false);
    };

    sdk.on("frameAdded", handleFrameAdded);
    sdk.on("frameAddRejected", handleFrameAddRejected);
    sdk.on("frameRemoved", handleFrameRemoved);

    // CRITICAL TO LOAD MINI APP - DON'T REMOVE
    sdk.actions.ready({});
    if (isMountedRef.current) {
      setIsSDKLoaded(true);
    }

    // Clean up on unmount
    return () => {
      sdk.off("frameAdded", handleFrameAdded);
      sdk.off("frameAddRejected", handleFrameAddRejected);
      sdk.off("frameRemoved", handleFrameRemoved);
    };
  }, []); // sdk is imported and stable, no need to include in deps

  useEffect(() => {
    const updateContext = async () => {
      const frameContext = await sdk.context;
      if (frameContext) {
        setContext(frameContext);
        setIsMiniAppSaved(frameContext.client.added);
      }

      const miniAppStatus = await sdk.isInMiniApp();
      setIsMiniApp(miniAppStatus);
    };

    if (isSDKLoaded) {
      updateContext();
    }
  }, [isSDKLoaded]);

  const pinFrame = useCallback(async () => {
    try {
      const result = await sdk.actions.addFrame();
      console.log("addFrame result", result);
      // @ts-expect-error - result type mixup
      if (result.added) {
        setPinFrameResponse(
          result.notificationDetails
            ? `Added, got notificaton token ${result.notificationDetails.token} and url ${result.notificationDetails.url}`
            : "Added, got no notification details",
        );
      }
    } catch (error) {
      setPinFrameResponse(`Error: ${error}`);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    context,
    pinFrame,
    pinFrameResponse,
    isMiniAppSaved,
    lastEvent,
    sdk,
    isSDKLoaded,
    isAuthDialogOpen,
    setIsAuthDialogOpen,
    isMiniApp,
  };
}
