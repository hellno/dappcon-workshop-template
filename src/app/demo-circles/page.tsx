"use client";

import { useState, useContext, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Loader2 } from "lucide-react";
import CirclesSDKContext from "~/components/providers/CirclesSdkProvider";
import { toast } from "sonner";
import { useEnsAddress } from "wagmi";

interface CirclesProfile {
  address: string;
  name?: string;
  avatar?: string;
  bio?: string;
  isRegistered: boolean;
  hasAvatar: boolean;
  trustConnections?: number;
}

export default function DemoCirclesPage() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<CirclesProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const circlesContext = useContext(CirclesSDKContext);
  const { sdk, isConnected } = circlesContext || {
    sdk: null,
    isConnected: false,
  };

  // ENS resolution
  const isENS = address.endsWith(".eth");
  const {
    data: ensAddress,
    isLoading: ensLoading,
    error: ensError,
  } = useEnsAddress({
    name: isENS ? address : undefined,
    enabled: isENS && address.length > 0,
  });

  const lookupProfile = async () => {
    if (!address.trim()) {
      toast.error("Please enter an address or ENS name");
      return;
    }

    if (!sdk || !isConnected) {
      toast.error("Circles SDK not connected");
      return;
    }

    setLoading(true);
    setError(null);
    setProfile(null);

    try {
      // Basic address validation
      const isENSName = address.endsWith(".eth");
      const isAddress = address.startsWith("0x") && address.length === 42;

      if (!isENSName && !isAddress) {
        throw new Error(
          "Please enter a valid Ethereum address (0x...) or ENS name (.eth)",
        );
      }

      // Resolve ENS to address if needed
      let resolvedAddress = address;
      if (isENSName) {
        if (ensLoading) {
          toast.info("Resolving ENS name...");
          return;
        }

        if (ensError) {
          throw new Error(`ENS resolution failed: ${ensError.message}`);
        }

        if (!ensAddress) {
          throw new Error(
            "ENS name not found or does not resolve to an address",
          );
        }

        resolvedAddress = ensAddress;
        console.log(`🔗 ENS resolved: ${address} → ${resolvedAddress}`);
        toast.success(
          `ENS resolved: ${address} → ${resolvedAddress.slice(0, 8)}...`,
        );
      }

      // Check if user exists on Circles
      // Note: These are placeholder methods - actual SDK methods may differ
      const isRegistered = await checkUserExists(sdk, resolvedAddress);

      // Fetch profile data if user exists
      let profileData: CirclesProfile = {
        address: resolvedAddress,
        isRegistered,
        hasAvatar: false,
      };

      if (isRegistered) {
        // Fetch additional profile data
        profileData = await fetchProfileData(sdk, resolvedAddress);
      }

      setProfile(profileData);
      toast.success(
        isRegistered
          ? "Circles profile found!"
          : "Address checked - not on Circles",
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to lookup profile";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to check if user exists using multiple strategies
  const checkUserExists = async (
    sdk: any,
    address: string,
  ): Promise<boolean> => {
    try {
      console.log("🔍 Checking user existence for:", address);
      console.log("🔗 SDK instance:", sdk);
      console.log("🌐 SDK connected:", isConnected);

      // Strategy 1: Direct lookup (address is main Circles account)
      const directUrl = `https://rpc.aboutcircles.com/profiles/search?address=${address}`;
      console.log("📡 Strategy 1 - Direct lookup:", directUrl);

      const directResponse = await fetch(directUrl);
      console.log("📊 Direct response status:", directResponse.status);

      if (directResponse.ok) {
        const data = await directResponse.json();
        console.log("📄 Direct response data:", data);

        if (data && Array.isArray(data) && data.length > 0) {
          console.log("✅ Found via direct lookup!");
          return true;
        }
      }

      // Strategy 2: Signer reverse lookup using circles_events
      console.log("🔄 Strategy 2 - Signer reverse lookup via circles_events");
      console.log(
        "💡 Checking if address is a signer/owner of any Circles account",
      );

      const eventsResponse = await fetch("https://rpc.aboutcircles.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "circles_events",
          params: [address, 0, null],
        }),
      });

      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        console.log("📊 Events response:", eventsData);

        if (eventsData.result && Array.isArray(eventsData.result)) {
          // Look for Safe_AddedOwner events where this address was added as owner
          const ownerEvents = eventsData.result.filter(
            (event: any) =>
              event.event === "Safe_AddedOwner" &&
              event.values.owner.toLowerCase() === address.toLowerCase(),
          );

          console.log("🔑 Found owner events:", ownerEvents);

          if (ownerEvents.length > 0) {
            // Found Safes where this address is an owner
            const safeAddresses = ownerEvents.map(
              (event: any) => event.values.safeAddress,
            );
            console.log(
              "🏦 Safe addresses where this is an owner:",
              safeAddresses,
            );

            // Check if any of these Safes are Circles accounts
            for (const safeAddress of safeAddresses) {
              const safeProfileUrl = `https://rpc.aboutcircles.com/profiles/search?address=${safeAddress}`;
              console.log(
                "📡 Checking Safe for Circles profile:",
                safeProfileUrl,
              );

              const safeResponse = await fetch(safeProfileUrl);
              if (safeResponse.ok) {
                const safeData = await safeResponse.json();
                console.log("📄 Safe profile data:", safeData);

                if (
                  safeData &&
                  Array.isArray(safeData) &&
                  safeData.length > 0
                ) {
                  console.log("✅ Found Circles account via signer lookup!");
                  console.log(
                    "🎯 Signer",
                    address,
                    "→ Circles account",
                    safeAddress,
                  );
                  return true;
                }
              }
            }
          }
        }
      }

      // Strategy 3: TODO - Gnosis Safe owner lookup
      console.log(
        "🔄 Strategy 3 - Gnosis Safe owner lookup (not implemented yet)",
      );
      console.log(
        "💡 This is where we'd find Safes owned by this address on Gnosis Chain",
      );

      console.log("❌ No Circles account found via any strategy");
      return false;
    } catch (error) {
      console.error("❌ Error checking user existence:", error);
      return false;
    }
  };

  // Helper function to fetch profile data using Circles API
  const fetchProfileData = async (
    sdk: any,
    address: string,
  ): Promise<CirclesProfile> => {
    try {
      console.log("📋 Fetching profile data for:", address);

      // First, try direct lookup
      let profileApiUrl = `https://rpc.aboutcircles.com/profiles/search?address=${address}`;
      console.log("📡 Strategy 1 - Direct profile lookup:", profileApiUrl);

      let response = await fetch(profileApiUrl);
      console.log("📊 Direct profile response status:", response.status);

      let mainCirclesAddress = address;

      if (response.ok) {
        const data = await response.json();
        console.log("📄 Direct profile response data:", data);

        if (data && Array.isArray(data) && data.length > 0) {
          // Found direct profile
          const profileData = data[0];
          return {
            address: mainCirclesAddress,
            name: profileData.name || "Circles User",
            bio: profileData.description || "Circles protocol user",
            avatar:
              profileData.imageUrl ||
              profileData.previewImageUrl ||
              `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`,
            isRegistered: true,
            hasAvatar: !!(profileData.imageUrl || profileData.previewImageUrl),
            trustConnections: undefined,
          };
        }
      }

      // If no direct profile, try signer lookup
      console.log("📋 Strategy 2 - Signer lookup for profile data");
      const eventsResponse = await fetch("https://rpc.aboutcircles.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "circles_events",
          params: [address, 0, null],
        }),
      });

      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();

        if (eventsData.result && Array.isArray(eventsData.result)) {
          const ownerEvents = eventsData.result.filter(
            (event: any) =>
              event.event === "Safe_AddedOwner" &&
              event.values.owner.toLowerCase() === address.toLowerCase(),
          );

          if (ownerEvents.length > 0) {
            const safeAddresses = ownerEvents.map(
              (event: any) => event.values.safeAddress,
            );

            // Check each Safe for a Circles profile
            for (const safeAddress of safeAddresses) {
              const safeProfileUrl = `https://rpc.aboutcircles.com/profiles/search?address=${safeAddress}`;
              console.log("📡 Checking Safe profile:", safeProfileUrl);

              const safeResponse = await fetch(safeProfileUrl);
              if (safeResponse.ok) {
                const safeData = await safeResponse.json();

                if (
                  safeData &&
                  Array.isArray(safeData) &&
                  safeData.length > 0
                ) {
                  const profileData = safeData[0];
                  console.log("✅ Found profile via signer lookup!");

                  return {
                    address: safeAddress, // Return the main Circles address, not the signer
                    name: profileData.name || "Circles User",
                    bio:
                      profileData.description ||
                      `Circles user (accessed via signer ${address.slice(0, 8)}...)`,
                    avatar:
                      profileData.imageUrl ||
                      profileData.previewImageUrl ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${safeAddress}`,
                    isRegistered: true,
                    hasAvatar: !!(
                      profileData.imageUrl || profileData.previewImageUrl
                    ),
                    trustConnections: undefined,
                  };
                }
              }
            }
          }
        }
      }

      // If no profile data found via any method, throw error
      console.log("❌ No profile data found via any lookup method");
      throw new Error("No profile found for this address");
    } catch (error) {
      console.error("❌ Error fetching profile data:", error);
      throw new Error("Failed to fetch profile data");
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Circles Profile Lookup</h1>
          <p className="text-muted-foreground">
            Enter an Ethereum address or ENS name to check their Circles profile
          </p>
        </div>

        {/* SDK Status */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={isConnected ? "default" : "destructive"}>
                {isConnected ? "SDK Connected" : "SDK Disconnected"}
              </Badge>
              {!isConnected && (
                <span className="text-sm text-muted-foreground">
                  Circles SDK is initializing...
                </span>
              )}
              {isENS && (
                <Badge
                  variant={
                    ensLoading
                      ? "outline"
                      : ensAddress
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {ensLoading
                    ? "Resolving ENS..."
                    : ensAddress
                      ? `ENS: ${ensAddress.slice(0, 8)}...`
                      : "ENS Failed"}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle>Lookup Profile</CardTitle>
            <CardDescription>
              Enter a wallet address (0x...) or ENS name (.eth)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="0x... or name.eth"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && lookupProfile()}
                disabled={loading}
              />
              <Button
                onClick={lookupProfile}
                disabled={loading || !isConnected}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lookup
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="p-4">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Profile Display */}
        {profile && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Profile Results
                <Badge variant={profile.isRegistered ? "default" : "secondary"}>
                  {profile.isRegistered ? "On Circles" : "Not on Circles"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div>
                  <strong>Address:</strong>
                  <p className="font-mono text-sm break-all">
                    {profile.address}
                  </p>
                </div>

                {profile.isRegistered && (
                  <>
                    {profile.name && (
                      <div>
                        <strong>Name:</strong>
                        <p>{profile.name}</p>
                      </div>
                    )}

                    {profile.bio && (
                      <div>
                        <strong>Bio:</strong>
                        <p>{profile.bio}</p>
                      </div>
                    )}

                    {profile.avatar && (
                      <div>
                        <strong>Avatar:</strong>
                        <img
                          src={profile.avatar}
                          alt="Profile avatar"
                          className="w-16 h-16 rounded-full mt-2"
                        />
                      </div>
                    )}

                    {profile.trustConnections !== undefined && (
                      <div>
                        <strong>Trust Connections:</strong>
                        <p>{profile.trustConnections}</p>
                      </div>
                    )}
                  </>
                )}

                {!profile.isRegistered && (
                  <p className="text-muted-foreground">
                    This address is not registered on the Circles protocol.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        {/* Demo Info */}
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2">Demo Notes:</h3>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• ✅ Real ENS resolution via wagmi</li>
              <li>• ✅ Real Circles API integration (profiles + events)</li>
              <li>• ✅ Signer → Main account mapping via circles_events</li>
              <li>• ✅ Multi-strategy lookup: direct, signer reverse lookup</li>
              <li>• 🔍 Check browser console for detailed flow logs</li>
            </ul>
          </CardContent>
        </Card>

        {/* Technical Details */}
        <Card className="bg-blue-50 dark:bg-blue-900/20">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2">How It Works:</h3>
            <div className="text-sm space-y-2 text-muted-foreground">
              <div>
                <strong>Strategy 1:</strong> Direct lookup - check if address
                has Circles profile
              </div>
              <div>
                <strong>Strategy 2:</strong> Signer lookup - use circles_events
                to find Safes owned by address, then check those for profiles
              </div>
              <div>
                <strong>ENS Resolution:</strong> Automatically resolves .eth
                names to addresses first
              </div>
              <div>
                <strong>Profile Data:</strong> Returns actual Circles profile
                with name, bio, avatar from main account
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
