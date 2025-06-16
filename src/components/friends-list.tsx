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
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Users,
  RefreshCw,
  ExternalLink,
  Heart,
} from "lucide-react";
import { toast } from "sonner";
import {
  batchCheckCirclesStatus,
  type CirclesData,
} from "~/lib/circles-lookup";

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
}

export function FriendsList() {
  const { context, sdk, isSDKLoaded } = useMiniAppSdk();
  const [friends, setFriends] = useState<FriendsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [circlesLoading, setCirclesLoading] = useState(false);

  const fetchFriends = useCallback(async () => {
    if (!context?.user?.fid) {
      toast.error("User not authenticated");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/friends?fid=${context.user.fid}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("API Error:", errorData);
        throw new Error(errorData.error || "Failed to fetch friends");
      }

      const data: FriendsData = await response.json();
      setFriends(data);
      toast.success(`Found ${data.friends.length} people you follow!`);

      // Now check Circles status for each friend
      if (data.friends.length > 0) {
        setCirclesLoading(true);
        try {
          console.log(
            "Starting Circles lookup for",
            data.friends.length,
            "friends",
          );
          
          const circlesResults = await batchCheckCirclesStatus(data.friends);

          // Update friends with Circles data and debug info
          const enrichedFriends = data.friends.map((friend) => {
            const result = circlesResults.get(friend.fid);
            return {
              ...friend,
              circlesData: result?.circlesData || { isOnCircles: false },
            };
          });

          const circlesCount = enrichedFriends.filter(
            (f) => f.circlesData?.isOnCircles,
          ).length;

          setFriends({
            friends: enrichedFriends,
            stats: data.stats,
          });

          if (circlesCount > 0) {
            toast.success(`Found ${circlesCount} friends on Circles!`);
          }
        } catch (error) {
          console.error("Error checking Circles status:", error);
          toast.error("Failed to check Circles status");
        } finally {
          setCirclesLoading(false);
        }
      }
    } catch (error) {
      console.error("Error fetching friends:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load friends";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [context?.user?.fid]);

  useEffect(() => {
    if (isSDKLoaded && context?.user?.fid) {
      fetchFriends();
    }
  }, [isSDKLoaded, context?.user?.fid, fetchFriends]);

  const handleViewProfile = async (fid: number) => {
    await sdk.actions.viewProfile({ fid });
  };

  const handleOpenMetri = useCallback(
    (address: string) => {
      sdk.actions.openUrl(`https://app.metri.xyz/${address}`);
    },
    [sdk.actions],
  );

  if (!isSDKLoaded) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading SDK...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!context?.user?.fid) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="text-center">
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
    <div className="w-full max-w-lg mx-auto px-2 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            People You Follow
          </CardTitle>
          <CardDescription>Your Farcaster following list</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {friends && (
            <div className="flex gap-2 mb-4 flex-wrap">
              <Badge variant="default" className="text-xs">
                {friends.stats.following} following
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {
                  friends.friends.filter((f) => f.circlesData?.isOnCircles)
                    .length
                }{" "}
                on Circles
              </Badge>
              {circlesLoading && (
                <Badge variant="outline" className="text-xs">
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Checking...
                </Badge>
              )}
            </div>
          )}

          <Button
            onClick={fetchFriends}
            disabled={loading}
            className="w-full mb-4 text-sm"
            size="sm"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Following
              </>
            )}
          </Button>

          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {friends?.friends.map((friend) => (
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
                      {friend.circlesData?.isOnCircles && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-green-50 text-green-700 border-green-200 shrink-0"
                          title={`Circles address: ${friend.circlesData.mainAddress}${friend.circlesData.signerAddress ? ` (via signer: ${friend.circlesData.signerAddress})` : ""}`}
                        >
                          🔗 Circles
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      @{friend.username}
                    </p>
                    {friend.profile?.bio?.text && (
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {friend.profile.bio.text}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {friend.circlesData?.isOnCircles &&
                      friend.circlesData.mainAddress && (
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
                      )}

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleViewProfile(friend.username)}
                      className="shrink-0"
                      title="View Farcaster profile"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {friends?.friends.length === 0 && (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  You&apos;re not following anyone yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Start following people on Farcaster to see them here
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
