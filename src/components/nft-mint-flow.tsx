"use client";

import * as React from "react";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { useMiniAppSdk } from "~/hooks/use-miniapp-sdk";
import {
  useAccount,
  useConnect,
  useWaitForTransactionReceipt,
  useWriteContract,
  useReadContract,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { formatEther, type Address } from "viem";
import { farcasterFrame } from "@farcaster/frame-wagmi-connector";
import { Coins, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";

type NFTMintFlowProps = {
  amount: number;
  chainId: number;
  contractAddress: Address;
  className?: string;
  variant?: "default" | "destructive" | "secondary" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
  buttonText?: string;
  disabled?: boolean;
  onMintSuccess?: (txHash: string) => void;
  onMintError?: (error: string) => void;
};

type MintStep =
  | "initial"
  | "sheet"
  | "connecting"
  | "switching"
  | "minting"
  | "waiting"
  | "success"
  | "error";

// Common NFT contract ABI for price reading
const priceAbi = [
  {
    inputs: [],
    name: "mintPrice",
    outputs: [{ type: "uint256", name: "price" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "price",
    outputs: [{ type: "uint256", name: "price" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MINT_PRICE",
    outputs: [{ type: "uint256", name: "price" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getMintPrice",
    outputs: [{ type: "uint256", name: "price" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "protocolFee",
    outputs: [{ type: "uint256", name: "fee" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "amount", type: "uint256" }],
    name: "mintFee",
    outputs: [{ type: "uint256", name: "fee" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export function NFTMintFlow({
  amount,
  chainId,
  contractAddress,
  className,
  variant = "default",
  size = "default",
  buttonText = "Mint NFT",
  disabled = false,
  onMintSuccess,
  onMintError,
}: NFTMintFlowProps) {
  const [step, setStep] = React.useState<MintStep>("initial");
  const [error, setError] = React.useState<string>("");
  const [txHash, setTxHash] = React.useState<string>("");
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const { isSDKLoaded } = useMiniAppSdk();
  const { isConnected } = useAccount();
  const { connect } = useConnect();
  const currentChainId = useChainId();
  const { switchChain, isPending: isSwitchChainPending } = useSwitchChain();
  const {
    writeContract,
    isPending: isWritePending,
    data: writeData,
    error: writeError,
  } = useWriteContract();

  // Read mint price from contract with proper configuration
  const {
    data: mintPrice,
    isError: isPriceError,
    isLoading: isMintPriceLoading,
  } = useReadContract({
    address: contractAddress,
    abi: priceAbi,
    functionName: "mintPrice",
    chainId,
    query: {
      enabled: !!contractAddress && !!chainId,
      retry: 3,
      retryDelay: 1000,
    },
  });

  // Fallback to other price function names if mintPrice fails
  const {
    data: price,
    isLoading: isPriceLoading,
    isError: isPriceError2,
  } = useReadContract({
    address: contractAddress,
    abi: priceAbi,
    functionName: "price",
    chainId,
    query: {
      enabled:
        !!contractAddress &&
        !!chainId &&
        isPriceError &&
        (isPriceError || mintPrice === undefined),
      retry: 3,
      retryDelay: 1000,
    },
  });

  const {
    data: MINT_PRICE,
    isLoading: isMintPriceConstLoading,
    isError: isMintPriceConstError,
  } = useReadContract({
    address: contractAddress,
    abi: priceAbi,
    functionName: "MINT_PRICE",
    chainId,
    query: {
      enabled:
        !!contractAddress &&
        !!chainId &&
        isPriceError2 &&
        (isPriceError2 || price === undefined),
      retry: 3,
      retryDelay: 1000,
    },
  });

  const { data: getMintPrice, isLoading: isGetMintPriceLoading } =
    useReadContract({
      address: contractAddress,
      abi: priceAbi,
      functionName: "getMintPrice",
      chainId,
      query: {
        enabled:
          !!contractAddress &&
          !!chainId &&
          isMintPriceConstError &&
          (isMintPriceConstError || MINT_PRICE === undefined),
        retry: 3,
        retryDelay: 1000,
      },
    });

  // Additional fee reads for fallback pricing
  const { data: protocolFee, isLoading: isProtocolFeeLoading } =
    useReadContract({
      address: contractAddress,
      abi: priceAbi,
      functionName: "protocolFee",
      chainId,
      query: {
        enabled: !!contractAddress && !!chainId,
        retry: 3,
        retryDelay: 1000,
      },
    });

  const { data: mintFee, isLoading: isMintFeeLoading } =
    useReadContract({
      address: contractAddress,
      abi: priceAbi,
      functionName: "mintFee",
      args: [BigInt(amount)],
      chainId,
      query: {
        enabled: !!contractAddress && !!chainId,
        retry: 3,
        retryDelay: 1000,
      },
    });

  // Calculate final contract price with fallback to protocolFee + mintFee
  const contractPrice = (() => {
    // Try standard price functions first
    if (mintPrice && mintPrice > BigInt(0)) return mintPrice;
    if (price && price > BigInt(0)) return price;
    if (MINT_PRICE && MINT_PRICE > BigInt(0)) return MINT_PRICE;
    if (getMintPrice && getMintPrice > BigInt(0)) return getMintPrice;
    
    // Fallback to fee-based calculation: protocolFee + mintFee(amount)
    if (protocolFee !== undefined && mintFee !== undefined) {
      return protocolFee + mintFee; // mintFee already accounts for amount
    }
    
    // Handle zero prices
    if (mintPrice === BigInt(0)) return BigInt(0);
    if (price === BigInt(0)) return BigInt(0);
    if (MINT_PRICE === BigInt(0)) return BigInt(0);
    if (getMintPrice === BigInt(0)) return BigInt(0);
    if (protocolFee === BigInt(0) && mintFee === BigInt(0)) return BigInt(0);
    
    return undefined; // No price data available
  })();

  const isLoadingPrice =
    isMintPriceLoading ||
    isPriceLoading ||
    isMintPriceConstLoading ||
    isGetMintPriceLoading ||
    isProtocolFeeLoading ||
    isMintFeeLoading;

  const {
    isSuccess: isTxSuccess,
    isError: isTxError,
    error: txError,
  } = useWaitForTransactionReceipt({
    hash: writeData,
  });

  // Calculate total cost
  const totalCost = (() => {
    if (!contractPrice) return "0";
    
    // If using fee-based pricing (protocolFee + mintFee), mintFee already accounts for amount
    const isUsingFeePricing = protocolFee !== undefined && mintFee !== undefined && 
                             !mintPrice && !price && !MINT_PRICE && !getMintPrice;
    
    if (isUsingFeePricing) {
      return Number(formatEther(contractPrice)).toFixed(4);
    } else {
      // For regular pricing, multiply by amount
      return (Number(formatEther(contractPrice)) * amount).toFixed(4);
    }
  })();

  // Reset error when step changes
  React.useEffect(() => {
    if (step !== "error") {
      setError("");
    }
  }, [step]);

  // Handle transaction success
  React.useEffect(() => {
    if (writeError) {
      if (
        writeError.message.toLowerCase().includes("user rejected the request")
      ) {
        handleClose();
        return;
      }
      setStep("error");
      setError(writeError.message);
      onMintError?.(writeError.message);
    }
    if (isTxError && txError) {
      setStep("error");
      setError(txError.message);
      onMintError?.(txError.message);
    }
    if (isTxSuccess && writeData) {
      setStep("success");
      setTxHash(writeData);
      onMintSuccess?.(writeData);
    }
  }, [
    isTxSuccess,
    writeData,
    onMintSuccess,
    isTxError,
    txError,
    onMintError,
    writeError,
  ]);

  // Handle writeContract data update
  React.useEffect(() => {
    if (writeData && step === "waiting") {
      setTxHash(writeData);
    }
  }, [writeData, step]);

  const handleInitialMint = () => {
    if (!isSDKLoaded) {
      setError("Farcaster SDK not loaded");
      setStep("error");
      setIsSheetOpen(true);
      return;
    }
    setStep("sheet");
    setIsSheetOpen(true);
  };

  const handleConnectWallet = async () => {
    try {
      setStep("connecting");
      const connector = farcasterFrame();
      connect({ connector });
      // Connection handled by wagmi hooks
    } catch (err) {
      console.error("Failed to connect wallet:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to connect wallet";

      // For other errors, show error state
      setError(errorMessage);
      setStep("error");
    }
  };

  const handleMint = async () => {
    if (!isConnected) {
      await handleConnectWallet();
      return;
    }

    if (contractPrice === undefined) {
      setError("Could not fetch mint price from contract");
      setStep("error");
      return;
    }

    // Check if we're on the correct chain
    if (currentChainId !== chainId) {
      console.log(`Chain mismatch: current ${currentChainId}, target ${chainId}`);
      try {
        setStep("switching");
        console.log("Switching to chain:", chainId);
        await switchChain({ chainId });
        // Wait a moment for chain switch to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (switchError) {
        console.error("Failed to switch chain:", switchError);
        setError(
          `Please switch to the correct network in your wallet. ` +
          `Current: Chain ${currentChainId}, Required: Chain ${chainId}`
        );
        setStep("error");
        return;
      }
    }

    try {
      setStep("minting");

      // Calculate the correct value to send
      const isUsingFeePricing = protocolFee !== undefined && mintFee !== undefined && 
                               !mintPrice && !price && !MINT_PRICE && !getMintPrice;
      
      const valueToSend = isUsingFeePricing 
        ? contractPrice // mintFee already accounts for amount
        : contractPrice * BigInt(amount); // multiply for regular pricing

      // Simple mint function call - adjust ABI based on your NFT contract
      writeContract({
        address: contractAddress,
        abi: [
          {
            name: "mint",
            type: "function",
            inputs: [{ name: "amount", type: "uint256" }],
            outputs: [],
            stateMutability: "payable",
          },
        ] as const,
        functionName: "mint",
        args: [BigInt(amount)],
        value: valueToSend,
        chainId,
      });

      // Transaction initiated, will be handled by wagmi hooks
      setStep("waiting");
    } catch (err) {
      console.error("Mint failed:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Mint transaction failed";

      // Check if user rejected
      if (err instanceof Error && err.name === "UserRejectedRequestError") {
        handleClose(); // Close the sheet on user rejection
        return;
      }

      // For other errors, show error state
      setError(errorMessage);
      setStep("error");
      onMintError?.(errorMessage);
    }
  };

  const handleClose = () => {
    setIsSheetOpen(false);
    setStep("initial");
    setError("");
    setTxHash("");
  };

  const handleRetry = () => {
    setError("");
    setStep("sheet");
  };

  return (
    <Sheet
      open={isSheetOpen}
      onOpenChange={(open) => {
        setIsSheetOpen(open);
        if (!open) {
          handleClose();
        }
      }}
    >
      <Button
        variant={variant}
        size={size}
        onClick={handleInitialMint}
        disabled={disabled || !isSDKLoaded}
        className={cn("w-full", className)}
      >
        <Coins className="h-4 w-4 mr-2" />
        {buttonText}
      </Button>

      <SheetContent
        side="bottom"
        onClose={handleClose}
        className="!bottom-0 !rounded-t-xl !rounded-b-none !max-h-[90vh] !h-auto"
      >
        <SheetHeader className="mb-6">
          <SheetTitle>
            {step === "sheet" && "Mint NFT"}
            {step === "connecting" && "Connecting Wallet"}
            {step === "switching" && "Switching Network"}
            {step === "minting" && "Preparing Mint"}
            {step === "waiting" && "Minting..."}
            {step === "success" && "Mint Successful!"}
            {step === "error" && "Mint Failed"}
          </SheetTitle>
        </SheetHeader>

        {/* Step 2: Sheet Content */}
        {step === "sheet" && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-neutral-500 dark:text-neutral-400">Contract</span>
                <span className="font-mono text-sm">
                  {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-neutral-500 dark:text-neutral-400">Quantity</span>
                <span className="font-semibold">{amount}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-neutral-500 dark:text-neutral-400">Price per NFT</span>
                <span className="font-semibold">
                  {isLoadingPrice
                    ? "Loading..."
                    : contractPrice === BigInt(0)
                      ? "0 ETH"
                      : contractPrice
                        ? `${Number(formatEther(contractPrice)).toFixed(4)} ETH`
                        : "Error loading price"}
                </span>
              </div>
              
              {/* Show fee breakdown if using protocolFee + mintFee */}
              {protocolFee !== undefined && mintFee !== undefined && 
               !mintPrice && !price && !MINT_PRICE && !getMintPrice && (
                <div className="py-2 text-sm text-neutral-500 dark:text-neutral-400">
                  <div className="flex justify-between">
                    <span>Protocol Fee:</span>
                    <span>{Number(formatEther(protocolFee)).toFixed(4)} ETH</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mint Fee ({amount}):</span>
                    <span>{Number(formatEther(mintFee)).toFixed(4)} ETH</span>
                  </div>
                </div>
              )}
              <div className="flex justify-between items-center py-3 text-lg font-semibold">
                <span>Total Cost</span>
                <span>{totalCost} ETH</span>
              </div>
            </div>

            <Button
              onClick={isConnected ? handleMint : handleConnectWallet}
              size="lg"
              className="w-full"
              disabled={isWritePending}
            >
              {isConnected ? (
                <>
                  <Coins className="h-5 w-5 mr-2" />
                  Mint {amount} NFT{amount > 1 ? "s" : ""}
                </>
              ) : (
                "Connect Wallet to Mint"
              )}
            </Button>
          </div>
        )}

        {/* Step 3: Connecting */}
        {step === "connecting" && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-neutral-900 dark:text-neutral-50" />
            </div>
            <p className="text-neutral-500 dark:text-neutral-400">
              Connecting to your Farcaster wallet...
            </p>
          </div>
        )}

        {/* Step 3.5: Switching Network */}
        {step === "switching" && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-neutral-900 dark:text-neutral-50" />
            </div>
            <div>
              <p className="font-semibold">Switching to correct network</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Please approve the network switch in your wallet
              </p>
              <p className="text-xs text-neutral-400 mt-2">
                Chain ID: {chainId}
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Minting */}
        {step === "minting" && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-neutral-900 dark:text-neutral-50" />
            </div>
            <div>
              <p className="font-semibold">Preparing mint transaction</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Please approve the transaction in your wallet
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Waiting for Transaction */}
        {step === "waiting" && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-neutral-900 dark:text-neutral-50" />
            </div>
            <div>
              <p className="font-semibold">Transaction submitted</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Waiting for confirmation on the blockchain...
              </p>
              {txHash && (
                <p className="text-xs font-mono mt-2 px-3 py-1 bg-neutral-100 rounded dark:bg-neutral-800">
                  {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 5: Success */}
        {step === "success" && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <div>
              <p className="font-semibold text-green-600">Mint successful!</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Your {amount} NFT{amount > 1 ? "s have" : "has"} been minted
                successfully
              </p>
              {txHash && (
                <p className="text-xs font-mono mt-2 px-3 py-1 bg-neutral-100 rounded dark:bg-neutral-800">
                  {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </p>
              )}
            </div>
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          </div>
        )}

        {/* Error State */}
        {step === "error" && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <AlertCircle className="h-12 w-12 text-red-500" />
            </div>
            <div>
              <p className="font-semibold text-red-600">Mint failed</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {error || "An unexpected error occurred"}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                Close
              </Button>
              {/* Show switch network button if it's a chain mismatch error */}
              {error && error.includes("Chain") && currentChainId !== chainId ? (
                <Button 
                  onClick={async () => {
                    try {
                      setStep("switching");
                      await switchChain({ chainId });
                      setStep("sheet");
                    } catch {
                      setError("Failed to switch network. Please switch manually in your wallet.");
                    }
                  }}
                  className="flex-1"
                  disabled={isSwitchChainPending}
                >
                  Switch Network
                </Button>
              ) : (
                <Button onClick={handleRetry} className="flex-1">
                  Try Again
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
