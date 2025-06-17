"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import { Switch } from "~/components/ui/switch";
import { Users, RefreshCw, ExternalLink, Heart, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { streamCirclesStatus, type CirclesData } from "~/lib/circles-lookup";

interface FarcasterUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  profile: {
    bio: {
      text: string;
    };
  };
  follower_count: number;
  following_count: number;
  verified_addresses?: {
    eth_addresses: string[];
  };
  circlesData?: CirclesData;
}

interface FriendsData {
  friends: FarcasterUser[];
  stats: {
    following: number;
  };
  pagination?: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

interface CirclesProgress {
  completed: number;
  total: number;
  percentage: number;
}

export function FriendsList() {
  const { context, sdk, isSDKLoaded } = useMiniAppSdk();
  const [allFriends, setAllFriends] = useState<Map<number, FarcasterUser>>(
    new Map(),
  );
  const [friendsStats, setFriendsStats] = useState({ total: 0 });
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [circlesProgress, setCirclesProgress] =
    useState<CirclesProgress | null>(null);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [maxBatches] = useState(5); // Load 5 batches of 100 = 500 friends
  const [hasMoreFriends, setHasMoreFriends] = useState(true);
  const [friendsCursor, setFriendsCursor] = useState<string | null>(null);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalFollowing, setTotalFollowing] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Progressive Circles status checking
  const startCirclesProcessing = useCallback(
    async (newFriends: FarcasterUser[]) => {
      // Prevent concurrent processing
      if (isProcessing) {
        console.log("Circles processing already running, skipping");
        return;
      }

      console.log(
        "Starting Circles processing for",
        newFriends.length,
        "new friends",
      );

      const controller = new AbortController();
      setAbortController(controller);
      setIsProcessing(true);

      // Get current user's verified addresses for trust checking
      const currentUserAddresses: string[] = [];

      try {
        let finalCirclesCount = 0;
        let finalEarningCount = 0;
        
        for await (const update of streamCirclesStatus(
          newFriends,
          currentUserAddresses,
        )) {
          if (controller.signal.aborted) {
            console.log("Circles processing aborted");
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

          // Update friend's circles data and track circles count
          setAllFriends((prev) => {
            const newMap = new Map(prev);
            const existingFriend = newMap.get(update.fid);
            if (existingFriend) {
              newMap.set(update.fid, {
                ...existingFriend,
                circlesData: update.circlesData,
              });
            }
            
            // Calculate current circles and earning counts from updated map
            finalCirclesCount = Array.from(newMap.values()).filter(
              (f) => f.circlesData?.isActiveV2,
            ).length;
            finalEarningCount = Array.from(newMap.values()).filter(
              (f) => f.circlesData?.isActivelyEarning,
            ).length;
            
            return newMap;
          });
        }

        // Processing complete
        setCirclesProgress(null);
        setAbortController(null);
        setIsProcessing(false);

        if (finalCirclesCount > 0) {
          if (finalEarningCount > 0) {
            toast.success(`Found ${finalCirclesCount} friends on Circles (${finalEarningCount} actively earning)!`);
          } else {
            toast.success(`Found ${finalCirclesCount} friends on Circles!`);
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Error checking Circles status:", error);
          toast.error("Failed to check Circles status");
        }
        setCirclesProgress(null);
        setAbortController(null);
        setIsProcessing(false);
      }
    },
    [],
  );

  // Aggressive batch loading - load multiple batches automatically
  const loadFriendsBatch = useCallback(
    async (cursor: string | null = null, batchNumber: number = 1) => {
      if (!context?.user?.fid) {
        toast.error("User not authenticated");
        return false;
      }

      try {
        const params = new URLSearchParams({
          fid: context.user.fid.toString(),
          limit: "100", // Always load 100 per batch
        });
        if (cursor) params.append("cursor", cursor);

        const response = await fetch(`/api/friends?${params}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("API Error:", errorData);
          throw new Error(errorData.error || "Failed to fetch friends");
        }

        const data: FriendsData = await response.json();

        // Find friends that need Circles processing
        let friendsToProcess: FarcasterUser[] = [];

        // Update friends map (stable ordering) and get new size
        let newSize = 0;
        setAllFriends((prev) => {
          const newMap = new Map(prev);

          friendsToProcess = data.friends.filter(
            (friend) =>
              !prev.has(friend.fid) || !prev.get(friend.fid)?.circlesData,
          );

          data.friends.forEach((friend) => {
            newMap.set(friend.fid, {
              ...friend,
              circlesData: prev.get(friend.fid)?.circlesData, // Preserve existing circles data
            });
          });

          newSize = newMap.size;
          return newMap;
        });

        // Update stats based on actual map size (prevents duplicates)
        setFriendsStats({
          total: newSize,
        });

        // Update batch counter
        setCurrentBatch(batchNumber);

        // Start Circles checking for new friends (only if not already processing)
        if (friendsToProcess.length > 0 && !isProcessing) {
          startCirclesProcessing(friendsToProcess);
        }

        // Return whether there are more friends to load
        return {
          hasMore: !!data.pagination?.hasMore,
          nextCursor: data.pagination?.nextCursor || null,
          loadedCount: newSize
        };
      } catch (error) {
        console.error("Error fetching friends batch:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to load friends";
        toast.error(errorMessage);
        return false;
      }
    },
    [context?.user?.fid, startCirclesProcessing, isProcessing],
  );

  // Fetch user stats to get total following count
  const fetchUserStats = useCallback(async () => {
    if (!context?.user?.fid) return;

    try {
      const response = await fetch(`/api/user-stats?fid=${context.user.fid}`);
      if (response.ok) {
        const stats = await response.json();
        setTotalFollowing(stats.following_count);
        console.log('Total following count:', stats.following_count);
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  }, [context?.user?.fid]);

  // Aggressive auto-loading of 500 friends in batches
  const autoLoadAllFriends = useCallback(async () => {
    // Cancel any ongoing circles processing
    if (abortController) {
      abortController.abort();
      setIsProcessing(false);
    }

    // Reset state
    setAllFriends(new Map());
    setFriendsStats({ total: 0 });
    setCirclesProgress(null);
    setCurrentBatch(0);
    setIsProcessing(false);
    setLoadingFriends(true);

    // Fetch total following count if we don't have it
    if (totalFollowing === null) {
      fetchUserStats();
    }

    try {
      let cursor: string | null = null;
      let batchNum = 1;
      
      // Load up to 5 batches (500 friends) or until no more available
      while (batchNum <= maxBatches) {
        console.log(`Loading batch ${batchNum}/${maxBatches}...`);
        
        const result = await loadFriendsBatch(cursor, batchNum);
        
        if (!result) {
          // Error occurred, stop loading
          break;
        }
        
        if (!result.hasMore) {
          // No more friends available
          console.log(`Loaded all available friends (${result.loadedCount} total)`);
          break;
        }
        
        cursor = result.nextCursor;
        batchNum++;
        
        // Small delay between batches to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (batchNum > maxBatches) {
        console.log(`Loaded maximum ${maxBatches} batches`);
      }
      
    } catch (error) {
      console.error('Error in auto-loading:', error);
    } finally {
      setLoadingFriends(false);
    }
  }, [loadFriendsBatch, totalFollowing, fetchUserStats, maxBatches, abortController, isProcessing]);

  // Remove scroll detection since we auto-load all batches

  useEffect(() => {
    if (isSDKLoaded && context?.user?.fid) {
      autoLoadAllFriends();
    }
  }, [isSDKLoaded, context?.user?.fid, autoLoadAllFriends]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [abortController]);

  const handleViewProfile = async (fid: number) => {
    await sdk.actions.viewProfile({ fid });
  };

  const handleOpenMetri = useCallback(
    (address: string) => {
      sdk.actions.openUrl(`https://app.metri.xyz/${address}`);
    },
    [sdk.actions],
  );

  // Convert Map to Array and filter to only show Circles friends
  const allFriendsArray = Array.from(allFriends.values());
  const circlesFriends = allFriendsArray.filter((friend) => friend.circlesData?.isActiveV2);
  const earningFriends = allFriendsArray.filter((friend) => friend.circlesData?.isActivelyEarning);

  // Count is now just the filtered array length
  const circlesCount = circlesFriends.length;
  const earningCount = earningFriends.length;

  if (!isSDKLoaded) {
    return (
      <div className="w-full max-w-lg mx-auto px-2">
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Your Friends on Circles
            </CardTitle>
            <CardDescription>
              Find which friends are on Circles protocol
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading SDK...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!context?.user?.fid) {
    return (
      <div className="w-full max-w-lg mx-auto px-2">
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Your Friends on Circles
            </CardTitle>
            <CardDescription>
              Find which friends are on Circles protocol
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Please authenticate to view your friends
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto px-2">
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Your Friends on Circles
          </CardTitle>
          <CardDescription>
            Find which friends are on Circles protocol
          </CardDescription>

        </CardHeader>
        <CardContent className="p-4">
          {/* Status Bar - Always visible for consistent layout */}
          <div className="mb-4 min-h-[32px] flex items-center">
            {allFriendsArray.length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                <Badge variant="default" className="text-xs">
                  {circlesFriends.length} friends on Circles
                </Badge>
                {earningCount > 0 && (
                  <Badge variant="default" className="text-xs bg-green-100 text-green-800 border-green-200">
                    💰 {earningCount} actively earning
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  Loaded {friendsStats.total}
                  {totalFollowing && (
                    <span className="ml-1">
                      /{Math.min(totalFollowing, 500)}
                    </span>
                  )}
                  {currentBatch > 0 && (
                    <span className="ml-1 opacity-75">
                      (batch {currentBatch}/{maxBatches})
                    </span>
                  )}
                </Badge>
                {circlesProgress && (
                  <Badge variant="outline" className="text-xs">
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Checking {circlesProgress.completed}/{circlesProgress.total}{" "}
                    ({circlesProgress.percentage}%)
                  </Badge>
                )}
                {loadingFriends && (
                  <Badge variant="outline" className="text-xs">
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Loading batch {currentBatch}/{maxBatches}...
                  </Badge>
                )}
              </div>
            ) : loadingFriends ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Auto-loading friends (batch {currentBatch}/{maxBatches})...
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Searching for friends on Circles...
              </div>
            )}
          </div>

          {/* Content Area - Fixed minimum height */}
          <div className="min-h-[400px]">
            <div 
              ref={scrollContainerRef}
              className="space-y-2 max-h-[70vh] overflow-y-auto"
            >
              {circlesFriends.map((friend) => (
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
                        {/* Show earning status */}
                        {friend.circlesData?.isActivelyEarning && (
                          <Badge variant="default" className="text-xs bg-green-100 text-green-800 border-green-200">
                            💰 Earning
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground truncate">
                          @{friend.username}
                        </p>
                        {/* Show mintable amount if available */}
                        {friend.circlesData?.avatarInfo?.mintableAmount && 
                         friend.circlesData.avatarInfo.mintableAmount > 0n && (
                          <span className="text-xs text-green-600 font-medium">
                            {(Number(friend.circlesData.avatarInfo.mintableAmount) / 1e18).toFixed(2)} CRC
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      {friend.circlesData?.isActiveV2 &&
                        friend.circlesData.mainAddress && (
                          friend.circlesData.isTrustedByCurrentUser ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              className="text-xs bg-red-50 border-red-200 text-red-700"
                              title="You already trust this person on Circles"
                            >
                              <Heart className="h-3 w-3 mr-1 fill-current" />
                              Trusted
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleOpenMetri(friend.circlesData!.mainAddress!)
                              }
                              className="text-xs"
                              title="Trust on Metri.xyz"
                            >
                              <Heart className="h-3 w-3 mr-1" />
                              Trust
                            </Button>
                          )
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

              {/* Empty State - No Circles Friends Yet */}
              {circlesFriends.length === 0 && allFriendsArray.length > 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground text-center">
                    {circlesProgress
                      ? `Checked ${allFriendsArray.length} friends, still searching for Circles accounts...`
                      : `No Circles friends found yet in ${allFriendsArray.length} friends`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {loadingFriends ? "Loading more friends..." : "Circles accounts are rare, but we'll keep searching!"}
                  </p>
                </div>
              )}

              {/* Empty State - No Friends Loaded */}
              {allFriendsArray.length === 0 && !loadingFriends && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground text-center">
                    Auto-loading will start automatically
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    We'll search through your friends to find Circles accounts
                  </p>
                </div>
              )}

              {/* Auto-loading Progress */}
              {loadingFriends && allFriendsArray.length > 0 && (
                <div className="text-center py-6 border-t bg-gradient-to-b from-transparent to-muted/20">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Auto-loading batch {currentBatch}/{maxBatches}...
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Searching for rare Circles accounts in your network
                  </p>
                </div>
              )}


              {/* Loading Complete */}
              {!loadingFriends && allFriendsArray.length > 0 && (
                <div className="text-center py-6 border-t bg-muted/20">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    Searched {allFriendsArray.length} friends
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Found {circlesCount} friends on Circles
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Auto-loading eliminates need for manual refresh */}
          {!loadingFriends && !circlesProgress && (
            <div className="mt-4 pt-4 border-t">
              <Button
                onClick={autoLoadAllFriends}
                className="w-full text-sm"
                size="sm"
                variant="outline"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Search Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
