"use client";

import { useState } from "react";
import { useMiniAppSdk } from "~/hooks/use-miniapp-sdk";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Users, ArrowRight } from "lucide-react";
import { FriendsLoader, type FarcasterUser } from "./friends-loader";
import { CirclesAnalyzer } from "./circles-analyzer";

export function FriendsList() {
  const { isSDKLoaded } = useMiniAppSdk();
  const [loadedFriends, setLoadedFriends] = useState<FarcasterUser[]>([]);
  const [showCirclesAnalysis, setShowCirclesAnalysis] = useState(false);
  const [friendsComplete, setFriendsComplete] = useState(false);

  const handleFriendsLoaded = (friends: FarcasterUser[]) => {
    console.log("✅ Friends loaded in main component:", friends.length);
    setLoadedFriends(friends);
    setFriendsComplete(true);
    setShowCirclesAnalysis(true);
  };

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
              <Users className="h-4 w-4" />
              Loading SDK...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto px-2 space-y-4">
      {/* Show friends loader first (while loading or if not complete) */}
      {!friendsComplete && <FriendsLoader onFriendsLoaded={handleFriendsLoaded} />}

      {/* Phase 2: Circles Analysis (show after friends loaded) */}
      {showCirclesAnalysis && loadedFriends.length > 0 && (
        <CirclesAnalyzer friends={loadedFriends} />
      )}

      {/* Phase 1 Summary: Show compact completed friends loader at bottom */}
      {friendsComplete && <FriendsLoader onFriendsLoaded={handleFriendsLoaded} compactMode={true} />}
    </div>
  );
}