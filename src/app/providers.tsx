"use client";

import dynamic from "next/dynamic";

import SolanaProvider from '~/components/providers/SolanaProvider'

const WagmiProvider = dynamic(
  () => import("~/components/providers/WagmiProvider"),
  {
    ssr: false,
  }
);

const CirclesSDK = dynamic(
  () => import("~/components/providers/CirclesSdkProvider").then(mod => ({ default: mod.CirclesSDK })),
  {
    ssr: false,
  }
);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider>
      <SolanaProvider>
        <CirclesSDK>
          {children}
        </CirclesSDK>
      </SolanaProvider>
    </WagmiProvider>
  );
}
