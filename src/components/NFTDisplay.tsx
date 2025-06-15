"use client";

import { useMiniAppSdk } from "~/hooks/use-miniapp-sdk";
import { NFTCard } from "~/components/nft-card";
import { NFTMintFlow } from "~/components/nft-mint-flow";
import { useState } from "react";
import { type Address } from "viem";
import { toast } from "sonner";

const NFT_CONTRACT_ADDRESS =
  "0x4DAcD59ed95C11a85Ff9262BeE63Aa4Bb821DcEB" as Address;
const BASE_CHAIN_ID = 8453; // Base mainnet

export default function NFTDisplay() {
  const { context, isSDKLoaded } = useMiniAppSdk();
  const [mintAmount] = useState(1);

  const handleMintSuccess = (txHash: string) => {
    console.log("Mint successful:", txHash);
    toast.success("NFT minted successfully!", {
      description: `Transaction: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`,
      duration: 5000,
    });
  };

  const handleMintError = (error: string) => {
    console.error("Mint error:", error);
    toast.error("Mint failed", {
      description: error,
      duration: 5000,
    });
  };

  if (!isSDKLoaded) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading SDK...
      </div>
    );
  }

  return (
    <div
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}
    >
      <div className="w-[300px] mx-auto py-4 px-4">
        <h1 className="text-2xl font-bold text-center mb-6">
          Base NFT Collection
        </h1>

        {/* NFT Display Card */}
        <div className="mb-6">
          <NFTCard
            contractAddress={NFT_CONTRACT_ADDRESS}
            tokenId="1" // Display token #1 as example
            network="base"
            alt="Base NFT"
            className="w-full"
            width={268} // Fits within 300px container with padding
            height={268}
            rounded="lg"
            shadow={true}
            showTitle={true}
            showNetwork={true}
            titlePosition="outside"
            networkPosition="outside"
            layout="detailed"
            onLoad={(metadata) => {
              console.log("NFT metadata loaded:", metadata);
              toast.success("NFT metadata loaded!", {
                description: metadata.name || "NFT data successfully retrieved",
                duration: 3000,
              });
            }}
            onError={(error) => {
              console.error("Failed to load NFT:", error);
              toast.error("Failed to load NFT", {
                description: error.message,
                duration: 4000,
              });
            }}
          />
        </div>
        {/* Action Buttons */}
        <div className="space-y-3">
          {/* NFT Mint Flow Button */}
          <NFTMintFlow
            amount={mintAmount}
            chainId={BASE_CHAIN_ID}
            contractAddress={NFT_CONTRACT_ADDRESS}
            buttonText="Mint NFT"
            onMintSuccess={handleMintSuccess}
            onMintError={handleMintError}
          />
        </div>
      </div>
    </div>
  );
}
