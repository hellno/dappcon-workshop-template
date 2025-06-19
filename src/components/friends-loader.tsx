"use client";

import { useEffect, useState, useCallback } from "react";
import { useMiniAppSdk } from "~/hooks/use-miniapp-sdk";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Users, RefreshCw, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { devCache } from "~/lib/simple-cache";

export interface FarcasterUser {
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

interface FriendsLoaderProps {
  onFriendsLoaded: (friends: FarcasterUser[]) => void;
  compactMode?: boolean;
}

// Debug helper function for better error visibility
const debugApiCall = async (url: string, description: string) => {
  console.log(`🔍 ${description}: ${url}`);
  try {
    const response = await fetch(url);
    console.log(`📡 ${description} status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ${description} failed:`, response.status, errorText);
      toast.error(`API Error: ${description} (${response.status})`);
      return null;
    }

    const data = await response.json();
    console.log(`✅ ${description} success:`, data);
    return data;
  } catch (error) {
    console.error(`💥 ${description} error:`, error);
    toast.error(`Network Error: ${description}`);
    return null;
  }
};

export function FriendsLoader({
  onFriendsLoaded,
  compactMode = false,
}: FriendsLoaderProps) {
  const { context, isSDKLoaded } = useMiniAppSdk();
  const [allFriends, setAllFriends] = useState<FarcasterUser[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalFollowing, setTotalFollowing] = useState<number | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  // Get cache key for this user's friends
  const getFriendsCacheKey = useCallback(() => {
    if (!context?.user?.fid) return null;
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    return `friends_${context.user.fid}_${today}`;
  }, [context?.user?.fid]);

  // Load friends batch
  const loadFriendsBatch = useCallback(
    async (cursor: string | null = null, batchNumber: number = 1) => {
      console.log(`=== Loading Friends Batch ${batchNumber} ===`);
      console.log("User FID:", context?.user?.fid);
      console.log("Cursor:", cursor);

      if (!context?.user?.fid) {
        console.error("❌ No user FID available");
        toast.error("User not authenticated");
        return false;
      }

      try {
        const params = new URLSearchParams({
          fid: context.user.fid.toString(),
          limit: "100", // Load 100 per batch
        });
        if (cursor) params.append("cursor", cursor);

        const url = `/api/friends?${params}`;
        const data: FriendsData | null = await debugApiCall(
          url,
          `Friends Batch ${batchNumber}`,
        );

        if (!data) {
          console.error("❌ API call failed - no data returned");
          return false;
        }

        console.log("📥 Processing friends data:", {
          friendsReceived: data.friends.length,
          hasStats: !!data.stats,
          hasPagination: !!data.pagination,
        });

        // Return batch result
        return {
          friends: data.friends,
          hasMore: !!data.pagination?.hasMore,
          nextCursor: data.pagination?.nextCursor || null,
        };
      } catch (error) {
        console.error("Error fetching friends batch:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to load friends";
        toast.error(errorMessage);
        return false;
      }
    },
    [context?.user?.fid],
  );

  // Fetch user stats to get total following count
  const fetchUserStats = useCallback(async () => {
    if (!context?.user?.fid) {
      console.error("❌ No user FID for stats");
      return;
    }

    const url = `/api/user-stats?fid=${context.user.fid}`;
    const stats = await debugApiCall(url, "User Stats");

    if (stats?.following_count) {
      setTotalFollowing(stats.following_count);
      console.log("✅ Total following count:", stats.following_count);
    } else {
      console.error("❌ No following_count in stats response:", stats);
    }
  }, [context?.user?.fid]);

  // Load ALL friends with caching
  const loadAllFriends = useCallback(async () => {
    if (loadingFriends) {
      console.log("Loading already in progress, skipping");
      return;
    }

    // Check cache first
    const cacheKey = getFriendsCacheKey();
    if (cacheKey) {
      const cachedFriends = devCache.get<FarcasterUser[]>(cacheKey);
      if (cachedFriends && cachedFriends.length > 0) {
        console.log(`✅ Found ${cachedFriends.length} cached friends`);
        setAllFriends(cachedFriends);
        setIsComplete(true);
        onFriendsLoaded(cachedFriends);
        toast.success(`Loaded ${cachedFriends.length} friends from cache`);
        return;
      }
    }

    console.log("🚀 Starting fresh friends loading");
    setLoadingFriends(true);
    setAllFriends([]);
    setCurrentBatch(0);
    setIsComplete(false);

    // Fetch total following count
    if (totalFollowing === null) {
      console.log("📊 Fetching user stats");
      await fetchUserStats();
    }

    try {
      let cursor: string | null = null;
      let batchNum = 1;
      let allLoadedFriends: FarcasterUser[] = [];

      // Load ALL friends (no limit on batches)
      while (true) {
        console.log(`📦 Loading batch ${batchNum}...`);
        setCurrentBatch(batchNum);

        const result = await loadFriendsBatch(cursor, batchNum);

        if (!result) {
          console.error(`❌ Batch ${batchNum} failed - stopping loading`);
          toast.error(`Failed to load friends batch ${batchNum}`);
          break;
        }

        // Add new friends to our collection
        allLoadedFriends = [...allLoadedFriends, ...result.friends];
        setAllFriends(allLoadedFriends);

        console.log(`✅ Batch ${batchNum} completed:`, {
          batchSize: result.friends.length,
          totalLoaded: allLoadedFriends.length,
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
        });

        if (!result.hasMore) {
          console.log(
            `🎉 Loaded all available friends (${allLoadedFriends.length} total)`,
          );
          break;
        }

        cursor = result.nextCursor;
        batchNum++;

        // Small delay between batches to prevent rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Cache the results
      if (cacheKey && allLoadedFriends.length > 0) {
        console.log(`💾 Caching ${allLoadedFriends.length} friends`);
        devCache.set(cacheKey, allLoadedFriends, 24 * 60 * 60 * 1000); // 24 hours
      }

      setIsComplete(true);
      onFriendsLoaded(allLoadedFriends);

      toast.success(`Successfully loaded ${allLoadedFriends.length} friends!`);
    } catch (error) {
      console.error("💥 Critical error in loading:", error);
      toast.error("Failed to load friends list");
    } finally {
      console.log("🏁 Friends loading complete");
      setLoadingFriends(false);
    }
  }, [
    loadingFriends,
    getFriendsCacheKey,
    totalFollowing,
    fetchUserStats,
    loadFriendsBatch,
    onFriendsLoaded,
  ]);

  // Auto-load friends when SDK and context are ready
  useEffect(() => {
    if (isSDKLoaded && context?.user?.fid && !isComplete && !loadingFriends) {
      console.log("✅ Auto-starting friends loading...");
      loadAllFriends();
    }
  }, [
    isSDKLoaded,
    context?.user?.fid,
    isComplete,
    loadingFriends,
    loadAllFriends,
  ]);

  if (!isSDKLoaded) {
    return (
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Loading Friends
          </CardTitle>
          <CardDescription>
            Getting your Farcaster network ready
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading SDK...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!context?.user?.fid) {
    return (
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Loading Friends
          </CardTitle>
          <CardDescription>
            Getting your Farcaster network ready
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
    );
  }

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Your Farcaster Friends
        </CardTitle>
        <CardDescription>Loading your complete friends network</CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        {/* Status */}
        <div className="mb-4 flex gap-2 flex-wrap">
          {allFriends.length > 0 && (
            <Badge variant="default" className="text-xs">
              {allFriends.length} friends loaded
            </Badge>
          )}
          {totalFollowing && (
            <Badge variant="secondary" className="text-xs">
              Following {totalFollowing} users
            </Badge>
          )}
          {loadingFriends && (
            <Badge variant="outline" className="text-xs">
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Loading batch {currentBatch}...
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

        {/* Progress */}
        {loadingFriends ? (
          <div className="min-h-[300px] flex flex-col justify-center items-center">
            <div className="text-center w-full max-w-md">
              <RefreshCw className="h-12 w-12 mx-auto mb-6 animate-spin text-blue-500" />
              <p className="text-xl font-medium mb-4">
                Loading your friends...
              </p>

              {/* Progress Bar */}
              <div className="w-full bg-muted rounded-full h-3 mb-4">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: totalFollowing
                      ? `${Math.min((allFriends.length / Math.min(totalFollowing, 10000)) * 100, 100)}%`
                      : `${Math.min((currentBatch / 10) * 100, 100)}%`,
                  }}
                />
              </div>

              {/* Progress Stats */}
              <div className="space-y-2">
                <p className="text-base text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {allFriends.length}
                  </span>{" "}
                  friends loaded
                  {totalFollowing && (
                    <span className="text-sm ml-1">
                      of {Math.min(totalFollowing, 10000).toLocaleString()}
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  Batch {currentBatch} • This may take a moment if you have many
                  friends
                </p>
              </div>
            </div>
          </div>
        ) : isComplete ? (
          <div className={compactMode ? "py-3" : "py-6"}>
            <div className="flex items-center gap-3 justify-center">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <p
                className={`${compactMode ? "text-sm" : "text-base"} font-medium`}
              >
                Success! Found {allFriends.length.toLocaleString()} Farcaster
                friends
              </p>
            </div>
          </div>
        ) : allFriends.length === 0 ? (
          <div className="min-h-[200px] flex flex-col justify-center items-center text-center">
            <Users className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">Ready to load friends</p>
            <p className="text-sm text-muted-foreground mb-4">
              We'll fetch your complete Farcaster network
            </p>
            <Button onClick={loadAllFriends} className="mt-2">
              <Users className="h-4 w-4 mr-2" />
              Load My Friends
            </Button>
          </div>
        ) : null}

        {/* Manual refresh button */}
        {isComplete && !compactMode && (
          <div className="mt-4 pt-4 border-t text-center">
            <Button onClick={loadAllFriends} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Friends List
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
