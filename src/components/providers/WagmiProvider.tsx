import { createConfig, http, injected, WagmiProvider } from "wagmi";
import { base, degen, mainnet, optimism, unichain } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { farcasterFrame } from "@farcaster/frame-wagmi-connector";

const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_KEY;

export const config = createConfig({
  chains: [optimism, base, mainnet, degen, unichain],
  transports: {
    [optimism.id]: http(),
    [mainnet.id]: http(),
    [degen.id]: http(),
    [unichain.id]: http(),
    [base.id]: http(
      alchemyApiKey
        ? `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`
        : undefined,
    ),
  },
  connectors: [farcasterFrame(), injected()],
});

const queryClient = new QueryClient();

export default function Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
