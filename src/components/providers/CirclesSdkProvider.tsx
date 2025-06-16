import React, { createContext, useState, useEffect, useCallback, ReactNode } from "react";
import { BrowserProviderContractRunner } from "@circles-sdk/adapter-ethers";
import { Sdk } from "@circles-sdk/sdk";

interface CirclesSDKContextType {
    sdk: Sdk | null;
    isConnected: boolean;
    setIsConnected: (connected: boolean) => void;
    adapter: BrowserProviderContractRunner | null;
    circlesProvider: any | null;
    circlesAddress: string | null;
    initSdk: () => Promise<void>;
}

// Create a context for the Circles SDK
const CirclesSDKContext = createContext<CirclesSDKContextType | null>(null);

// Provider component to wrap around your application
export const CirclesSDK = ({ children }: { children: ReactNode }) => {
    const [sdk, setSdk] = useState<Sdk | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [adapter, setAdapter] = useState<BrowserProviderContractRunner | null>(null);
    const [circlesProvider, setCirclesProvider] = useState<any | null>(null);
    const [circlesAddress, setCirclesAddress] = useState<string | null>(null);

    // Configuration for the Circles SDK on Gnosis Chain
    const circlesConfig = {
        circlesRpcUrl: "https://rpc.aboutcircles.com/",
        pathfinderUrl: "https://pathfinder.aboutcircles.com",
        v1HubAddress: "0x29b9a7fbb8995b2423a71cc17cf9810798f6c543" as `0x${string}`,
        v2HubAddress: "0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8" as `0x${string}`,
        nameRegistryAddress: "0xA27566fD89162cC3D40Cb59c87AAaA49B85F3474" as `0x${string}`,
        migrationAddress: "0xD44B8dcFBaDfC78EA64c55B705BFc68199B56376" as `0x${string}`,
        profileServiceUrl: "https://rpc.aboutcircles.com/profiles/",
        baseGroupFactory: "0xD0B5Bd9962197BEaC4cbA24244ec3587f19Bd06d" as `0x${string}`,
        coreMembersGroupDeployer: "0xFEca40Eb02FB1f4F5F795fC7a03c1A27819B1Ded" as `0x${string}`,
    };

    // Function to initialize the SDK
    const initSdk = useCallback(async () => {
        try {
            // Check if we're in a browser environment with ethereum provider
            if (typeof window === 'undefined' || !(window as any).ethereum) {
                console.log("No ethereum provider found, skipping Circles SDK initialization");
                setIsConnected(false);
                return;
            }

            // Create and initialize the adapter
            const adapter = new BrowserProviderContractRunner();
            await adapter.init(); // Initialize the adapter before using it

            setAdapter(adapter);

            // Get the provider and address
            const provider = adapter.provider;
            setCirclesProvider(provider);

            const address = await adapter.address;
            setCirclesAddress(address || null);

            // Create the SDK instance with the config and adapter
            const sdk = new Sdk(adapter, circlesConfig);
            setSdk(sdk);
            setIsConnected(true);
            console.log("Circles SDK initialized successfully");
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log("Circles SDK initialization failed (this is OK for friends list functionality):", errorMessage);
            setIsConnected(false);
        }
    }, []);

    useEffect(() => {
        // Delay SDK initialization to give Frame environment time to set up
        const timer = setTimeout(() => {
            initSdk();
        }, 1000); // 1 second delay

        return () => clearTimeout(timer);
    }, [initSdk]);

    return (
        <CirclesSDKContext.Provider value={{
            sdk,
            isConnected,
            setIsConnected,
            adapter,
            circlesProvider,
            circlesAddress,
            initSdk,
        }}>
            {children}
        </CirclesSDKContext.Provider>
    );
};

export default CirclesSDKContext;