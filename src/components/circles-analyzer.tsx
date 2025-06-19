"use client";

import { useState, useCallback, useRef } from "react";
import { useMiniAppSdk } from "~/hooks/use-miniapp-sdk";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Users,
  RefreshCw,
  ExternalLink,
  Heart,
  Search,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { streamCirclesStatus, type CirclesData } from "~/lib/circles-lookup";
import { devCache } from "~/lib/simple-cache";
import type { FarcasterUser } from "./friends-loader";

interface CirclesAnalyzerProps {
  friends: FarcasterUser[];
}

interface FriendWithCircles extends FarcasterUser {
  circlesData?: CirclesData;
}

interface CirclesProgress {
  completed: number;
  total: number;
  percentage: number;
}

export function CirclesAnalyzer({ friends }: CirclesAnalyzerProps) {
  const { sdk } = useMiniAppSdk();
  const [friendsWithCircles, setFriendsWithCircles] = useState<
    Map<number, FriendWithCircles>
  >(new Map());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [circlesProgress, setCirclesProgress] =
    useState<CirclesProgress | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  // Remove activity filter - only show active users

  // Cache friends by address for deduplication
  const addressCache = useRef<Map<string, CirclesData>>(new Map());

  // Get cache key for circles data by address
  const getCirclesCacheKey = (address: string) =>
    `circles_${address.toLowerCase()}`;

  // Load cached circles data for addresses
  const loadCachedCirclesData = useCallback(() => {
    console.log("🔍 Loading cached circles data...");
    let cacheHits = 0;

    friends.forEach((friend) => {
      if (friend.verified_addresses?.eth_addresses) {
        for (const address of friend.verified_addresses.eth_addresses) {
          const cacheKey = getCirclesCacheKey(address);
          const cachedData = devCache.get<CirclesData>(cacheKey);

          if (cachedData) {
            cacheHits++;
            addressCache.current.set(address.toLowerCase(), cachedData);

            setFriendsWithCircles((prev) => {
              const newMap = new Map(prev);
              newMap.set(friend.fid, { ...friend, circlesData: cachedData });
              return newMap;
            });
            break; // Use first cached address
          }
        }
      }
    });

    console.log(`📦 Loaded ${cacheHits} cached circles entries`);
    return cacheHits;
  }, [friends]);

  // Start circles analysis
  const startCirclesAnalysis = useCallback(async () => {
    if (isAnalyzing) {
      console.log("Analysis already in progress");
      return;
    }

    console.log("🚀 Starting Circles analysis for", friends.length, "friends");

    // Cancel any previous analysis
    if (abortController) {
      abortController.abort();
    }

    const controller = new AbortController();
    setAbortController(controller);
    setIsAnalyzing(true);
    setIsComplete(false);

    // Initialize with friends data
    const initialMap = new Map<number, FriendWithCircles>();
    friends.forEach((friend) => {
      initialMap.set(friend.fid, { ...friend });
    });
    setFriendsWithCircles(initialMap);

    // Load any cached data first
    const cacheHits = loadCachedCirclesData();

    // Find friends that need analysis (not in cache)
    const friendsToAnalyze = friends.filter((friend) => {
      if (!friend.verified_addresses?.eth_addresses) return false;

      // Check if any address is already cached
      return !friend.verified_addresses.eth_addresses.some((address) =>
        addressCache.current.has(address.toLowerCase()),
      );
    });

    console.log(
      `📊 Analysis plan: ${friends.length} total, ${cacheHits} cached, ${friendsToAnalyze.length} to analyze`,
    );

    if (friendsToAnalyze.length === 0) {
      console.log("✅ All friends already analyzed via cache");
      setIsAnalyzing(false);
      setIsComplete(true);
      toast.success("Analysis complete - all data loaded from cache!");
      return;
    }

    try {
      // Get current user's verified addresses for trust checking
      const currentUserAddresses: string[] = [];

      let finalCirclesCount = 0;
      let finalEarningCount = 0;
      let finalActiveCount = 0;

      for await (const update of streamCirclesStatus(
        friendsToAnalyze,
        currentUserAddresses,
      )) {
        if (controller.signal.aborted) {
          console.log("Circles analysis aborted");
          break;
        }

        // Update progress
        setCirclesProgress({
          completed: update.progress.completed,
          total: update.progress.total,
          percentage: Math.round(
            (update.progress.completed / update.progress.total) * 100,
          ),
        });

        // Cache the circles data by address
        const friend = friendsToAnalyze.find((f) => f.fid === update.fid);
        if (friend?.verified_addresses?.eth_addresses) {
          for (const address of friend.verified_addresses.eth_addresses) {
            const cacheKey = getCirclesCacheKey(address);
            // Cache for 7 days
            devCache.set(cacheKey, update.circlesData, 7 * 24 * 60 * 60 * 1000);
            addressCache.current.set(address.toLowerCase(), update.circlesData);
            break; // Cache on first address
          }
        }

        // Update friend's circles data
        setFriendsWithCircles((prev) => {
          const newMap = new Map(prev);
          const existingFriend = newMap.get(update.fid);
          if (existingFriend) {
            newMap.set(update.fid, {
              ...existingFriend,
              circlesData: update.circlesData,
            });
          }

          // Calculate current counts
          const allUpdatedFriends = Array.from(newMap.values());
          finalCirclesCount = allUpdatedFriends.filter(
            (f) => f.circlesData?.isOnCircles && !f.circlesData?.shouldSkip,
          ).length;
          finalEarningCount = allUpdatedFriends.filter(
            (f) => f.circlesData?.isActivelyEarning,
          ).length;
          finalActiveCount = allUpdatedFriends.filter(
            (f) => f.circlesData?.isActiveByActivity,
          ).length;

          return newMap;
        });
      }

      // Analysis complete
      setCirclesProgress(null);
      setAbortController(null);
      setIsAnalyzing(false);
      setIsComplete(true);

      if (finalCirclesCount > 0) {
        const statusParts = [];
        if (finalEarningCount > 0)
          statusParts.push(`${finalEarningCount} earning`);
        if (finalActiveCount > 0)
          statusParts.push(`${finalActiveCount} active`);

        const statusText =
          statusParts.length > 0 ? ` (${statusParts.join(", ")})` : "";
        toast.success(
          `Found ${finalCirclesCount} friends on Circles${statusText}!`,
        );
      } else {
        toast.success("Analysis complete - no friends found on Circles yet");
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("Error in Circles analysis:", error);
        toast.error("Failed to analyze Circles data");
      }
      setCirclesProgress(null);
      setAbortController(null);
      setIsAnalyzing(false);
    }
  }, [friends, isAnalyzing, abortController, loadCachedCirclesData]);

  // Stop analysis
  const stopAnalysis = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setIsAnalyzing(false);
    setCirclesProgress(null);
    toast.info("Analysis stopped");
  }, [abortController]);

  // Helper functions for UI
  const handleViewProfile = async (fid: number) => {
    await sdk.actions.viewProfile({ fid });
  };

  const handleOpenMetri = useCallback(
    (address: string) => {
      sdk.actions.openUrl(`https://app.metri.xyz/${address}`);
    },
    [sdk.actions],
  );

  // Filter to only show active users on Circles
  const activeFriends = Array.from(friendsWithCircles.values()).filter(
    (friend) =>
      friend.circlesData?.isOnCircles &&
      !friend.circlesData?.shouldSkip &&
      friend.circlesData?.isActiveByActivity,
  );

  const earningCount = activeFriends.filter(
    (f) => f.circlesData?.isActivelyEarning,
  ).length;

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Your friends on Circles
        </CardTitle>
        <CardDescription>Find farcasters you know on Circles</CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        {/* Status */}
        <div className="mb-4 flex gap-2 flex-wrap">
          <Badge variant="default" className="text-xs">
            {friends.length} friends to analyze
          </Badge>
          {activeFriends.length > 0 && (
            <Badge
              variant="default"
              className="text-xs bg-blue-100 text-blue-800 border-blue-200"
            >
              🔥 {activeFriends.length} active on Circles
            </Badge>
          )}
          {earningCount > 0 && (
            <Badge
              variant="default"
              className="text-xs bg-green-100 text-green-800 border-green-200"
            >
              💰 {earningCount} earning
            </Badge>
          )}
          {circlesProgress && (
            <Badge variant="outline" className="text-xs">
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Analyzing {circlesProgress.completed}/{circlesProgress.total} (
              {circlesProgress.percentage}%)
            </Badge>
          )}
          {isComplete && (
            <Badge
              variant="outline"
              className="text-xs bg-green-50 border-green-200 text-green-700"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Complete
            </Badge>
          )}
        </div>

        {/* Main Content */}
        {!isAnalyzing && !isComplete && activeFriends.length === 0 ? (
          <div className="min-h-[300px] flex flex-col justify-center items-center text-center">
            <Search className="h-8 w-8 mx-auto mb-4 text-blue-500" />
            <p className="text-xl font-medium mb-1">
              Ready to find Circles friends
            </p>
            <p className="mx-auto text-sm text-muted-foreground mb-4">
              We&apos;ll analyze your {friends.length} friends
              <br /> to see who&apos;s on Circles
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              this may take a few minutes if you have many friends
            </p>
            <Button onClick={startCirclesAnalysis} size="lg">
              <Search className="h-4 w-4 mr-2" />
              Find Friends on Circles
            </Button>
          </div>
        ) : isAnalyzing ? (
          <div className="min-h-[300px] flex flex-col justify-center items-center text-center">
            <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-blue-500" />
            <p className="text-lg font-medium mb-2">
              Looking for your friends on Circles...
            </p>
            {circlesProgress && (
              <p className="text-sm text-muted-foreground mb-4">
                {circlesProgress.completed} of {circlesProgress.total} analyzed
                ({circlesProgress.percentage}%)
              </p>
            )}
            <p className="text-lg text-muted-foreground mb-6">
              This may take a few minutes
            </p>
            <Button onClick={stopAnalysis} variant="outline">
              Stop Analysis
            </Button>
          </div>
        ) : (
          <div>
            {/* Verification Message */}
            {activeFriends.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  ⚠️ Verify that this user is actually your Farcaster friend
                  before trusting
                </p>
              </div>
            )}

            {/* Results */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {activeFriends.map((friend) => (
                <div key={friend.fid} className="rounded-lg border">
                  <div className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={friend.pfp_url}
                        alt={friend.display_name}
                      />
                      <AvatarFallback>
                        {friend.display_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">
                          {friend.display_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground truncate">
                          @{friend.username}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      {friend.circlesData?.isActiveV2 &&
                        friend.circlesData.mainAddress && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleOpenMetri(friend.circlesData!.mainAddress!)
                            }
                            className="text-xs"
                            title="View on Metri.xyz"
                          >
                            <Heart className="h-3 w-3 mr-1" />
                            Trust
                          </Button>
                        )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewProfile(friend.fid)}
                        className="shrink-0"
                        title="View Farcaster profile"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Empty state */}
              {activeFriends.length === 0 && isComplete && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground text-center">
                    No active friends found on Circles yet
                  </p>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="mt-4 pt-4 border-t flex gap-2">
              <Button
                onClick={startCirclesAnalysis}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Re-analyze
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
