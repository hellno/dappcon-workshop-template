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
  const [showCirclesOnly, setShowCirclesOnly] = useState(true);
  const [hasMoreFriends, setHasMoreFriends] = useState(true);
  const [friendsCursor, setFriendsCursor] = useState<string | null>(null);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
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
            
            // Calculate current circles count from updated map
            finalCirclesCount = Array.from(newMap.values()).filter(
              (f) => f.circlesData?.isActiveV2,
            ).length;
            
            return newMap;
          });
        }

        // Processing complete
        setCirclesProgress(null);
        setAbortController(null);
        setIsProcessing(false);

        if (finalCirclesCount > 0) {
          toast.success(`Found ${finalCirclesCount} friends on Circles!`);
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

  // Progressive friend loading with pagination
  const loadMoreFriends = useCallback(
    async (cursor: string | null = null) => {
      if (loadingFriends) {
        return; // Prevent concurrent calls
      }
      
      if (!context?.user?.fid) {
        toast.error("User not authenticated");
        return;
      }

      setLoadingFriends(true);
      try {
        const params = new URLSearchParams({
          fid: context.user.fid.toString(),
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

        // Update pagination state
        setFriendsCursor(data.pagination?.nextCursor || null);
        setHasMoreFriends(data.pagination?.hasMore || false);

        // Update stats based on actual map size (prevents duplicates)
        setFriendsStats({
          total: newSize,
        });

        // Only show toast for initial load, not pagination
        if (!cursor && newSize === data.friends.length) {
          toast.success(`Found ${data.friends.length} people you follow!`);
        }

        // Start Circles checking for new friends (only if not already processing)
        if (friendsToProcess.length > 0 && !isProcessing) {
          startCirclesProcessing(friendsToProcess);
        }
      } catch (error) {
        console.error("Error fetching friends:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to load friends";
        toast.error(errorMessage);
      } finally {
        setLoadingFriends(false);
      }
    },
    [context?.user?.fid, startCirclesProcessing],
  );

  // Start fresh friend loading
  const fetchFriends = useCallback(async () => {
    // Cancel any ongoing circles processing
    if (abortController) {
      abortController.abort();
      setIsProcessing(false); // Reset immediately after abort
    }

    // Reset state
    setAllFriends(new Map());
    setFriendsStats({ total: 0 });
    setCirclesProgress(null);
    setFriendsCursor(null);
    setHasMoreFriends(true);
    setIsProcessing(false);

    // Load first page
    await loadMoreFriends(null);
  }, [loadMoreFriends]);

  // Scroll detection for auto-loading more friends
  const handleScrollRef = useRef<() => void>();
  
  // Update the scroll handler reference when dependencies change
  handleScrollRef.current = () => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;
    
    if (isNearBottom && hasMoreFriends && !loadingFriends && !circlesProgress && !isProcessing) {
      console.log('Near bottom, loading more friends...');
      loadMoreFriends(friendsCursor);
    }
  };

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      handleScrollRef.current?.();
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []); // Empty dependency array - listener only added once

  useEffect(() => {
    if (isSDKLoaded && context?.user?.fid) {
      fetchFriends();
    }
  }, [isSDKLoaded, context?.user?.fid, fetchFriends]);

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

  // Convert Map to Array and apply filtering
  const allFriendsArray = Array.from(allFriends.values());
  const filteredFriends = allFriendsArray.filter((friend) =>
    showCirclesOnly ? friend.circlesData?.isActiveV2 : true,
  );

  const circlesCount = allFriendsArray.filter(
    (f) => f.circlesData?.isActiveV2,
  ).length;

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

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-medium">
              Show Circles friends only
            </span>
            <Switch
              checked={showCirclesOnly}
              onCheckedChange={setShowCirclesOnly}
            />
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {/* Status Bar - Always visible for consistent layout */}
          <div className="mb-4 min-h-[32px] flex items-center">
            {allFriendsArray.length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                <Badge variant="default" className="text-xs">
                  {showCirclesOnly
                    ? filteredFriends.length
                    : friendsStats.total}{" "}
                  {showCirclesOnly ? "on Circles" : "friends"}
                </Badge>
                {!showCirclesOnly && (
                  <Badge variant="secondary" className="text-xs">
                    {circlesCount} active on Circles
                  </Badge>
                )}
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
                    {friendsCursor ? 'Loading more...' : 'Loading friends...'}
                  </Badge>
                )}
              </div>
            ) : loadingFriends ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading your friends...
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Ready to load your friends
              </div>
            )}
          </div>

          {/* Content Area - Fixed minimum height */}
          <div className="min-h-[400px]">
            <div 
              ref={scrollContainerRef}
              className="space-y-2 max-h-[60vh] overflow-y-auto"
            >
              {filteredFriends.map((friend) => (
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
                      <p className="text-xs text-muted-foreground truncate">
                        @{friend.username}
                      </p>
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

              {/* Empty State - Filtered Results */}
              {filteredFriends.length === 0 && allFriendsArray.length > 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground text-center">
                    {showCirclesOnly
                      ? circlesProgress
                        ? `Found ${allFriendsArray.length} friends, still checking for Circles status...`
                        : `No Circles friends found in ${allFriendsArray.length} friends`
                      : "No friends match current filters"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {showCirclesOnly && !circlesProgress
                      ? "Try toggling to show all friends"
                      : ""}
                  </p>
                </div>
              )}

              {/* Empty State - No Friends Loaded */}
              {allFriendsArray.length === 0 && !loadingFriends && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground text-center">
                    Ready to discover your friends on Circles
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Click "Refresh Friends" to get started
                  </p>
                </div>
              )}

              {/* Load More Button */}
              {hasMoreFriends && allFriendsArray.length > 0 && (
                <div className="text-center py-6 border-t bg-gradient-to-b from-transparent to-muted/20">
                  <Button
                    onClick={() => loadMoreFriends(friendsCursor)}
                    disabled={loadingFriends}
                    variant="default"
                    size="sm"
                    className="text-sm font-medium min-w-[160px] shadow-sm hover:shadow-md transition-all"
                  >
                    {loadingFriends ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Loading more...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Load More Friends
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    {loadingFriends ? 'Fetching more friends...' : 'Or scroll down to auto-load'}
                  </p>
                </div>
              )}

              {/* Auto-loading indicator */}
              {hasMoreFriends && allFriendsArray.length > 0 && loadingFriends && !friendsCursor && (
                <div className="text-center py-4">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Loading more friends automatically...
                  </div>
                </div>
              )}

              {/* All friends loaded indicator */}
              {!hasMoreFriends && allFriendsArray.length > 0 && !loadingFriends && (
                <div className="text-center py-6 border-t bg-muted/20">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    All {allFriendsArray.length} friends loaded
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {showCirclesOnly ? `${filteredFriends.length} on Circles` : `${circlesCount} active on Circles`}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <Button
              onClick={fetchFriends}
              disabled={loadingFriends || !!circlesProgress}
              className="w-full text-sm"
              size="sm"
              variant="outline"
            >
              {loadingFriends || circlesProgress ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {circlesProgress ? "Processing..." : "Loading..."}
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Friends
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
