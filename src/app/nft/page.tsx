import { Metadata } from "next";
import NFTApp from "./nft-app";

const appUrl = process.env.NEXT_PUBLIC_URL;

const frame = {
  version: "next",
  imageUrl: `${appUrl}/opengraph-image`,
  button: {
    title: "View NFT",
    action: {
      type: "launch_frame",
      name: "Base NFT Mint",
      url: `${appUrl}/nft`,
      splashImageUrl: `${appUrl}/splash.png`,
      splashBackgroundColor: "#0052FF",
    },
  },
};

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Base NFT Mint - DappCon Workshop",
    openGraph: {
      title: "Base NFT Mint",
      description: "Mint an exclusive NFT on Base network",
    },
    other: {
      "fc:frame": JSON.stringify(frame),
    },
  };
}

export default function NFTPage() {
  return <NFTApp />;
}