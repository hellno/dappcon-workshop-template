"use client";

import { useCallback, useState, useMemo, useEffect } from "react";
import { Input } from "../components/ui/input";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { FrameNotificationDetails, type Context } from "@farcaster/frame-sdk";
import { useMiniAppSdk } from "~/hooks/use-miniapp-sdk";
import {
  useAccount,
  useSendTransaction,
  useSignMessage,
  useSignTypedData,
  useWaitForTransactionReceipt,
  useDisconnect,
  useConnect,
  useSwitchChain,
  useChainId,
} from "wagmi";

import { config } from "~/components/providers/WagmiProvider";
import { Button } from "~/components/ui/button";
import { truncateAddress } from "~/lib/truncateAddress";
import { base, degen, mainnet, optimism, unichain } from "wagmi/chains";
import { BaseError, UserRejectedRequestError } from "viem";
import { Label } from "~/components/ui/label";

export default function Demo(
  { title }: { title?: string } = { title: "Mini App Demo" },
) {
  const { context, sdk, isSDKLoaded, lastEvent, pinFrame, pinFrameResponse } =
    useMiniAppSdk();

  const [notificationDetails, setNotificationDetails] =
    useState<FrameNotificationDetails | null>(null);
  const [sendNotificationResult, setSendNotificationResult] = useState("");

  useEffect(() => {
    setNotificationDetails(context?.client.notificationDetails ?? null);
  }, [context]);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const {
    signTypedData,
    error: signTypedError,
    isError: isSignTypedError,
    isPending: isSignTypedPending,
  } = useSignTypedData();

  const { disconnect } = useDisconnect();
  const { connect } = useConnect();

  const {
    switchChain,
    error: switchChainError,
    isError: isSwitchChainError,
    isPending: isSwitchChainPending,
  } = useSwitchChain();

  const nextChain = useMemo(() => {
    if (chainId === base.id) {
      return optimism;
    } else if (chainId === optimism.id) {
      return degen;
    } else if (chainId === degen.id) {
      return mainnet;
    } else if (chainId === mainnet.id) {
      return unichain;
    } else {
      return base;
    }
  }, [chainId]);

  const handleSwitchChain = useCallback(() => {
    switchChain({ chainId: nextChain.id });
  }, [switchChain, nextChain.id]);

  const close = useCallback(() => {
    sdk.actions.close();
  }, [sdk.actions]);

  const openNFTPage = useCallback(() => {
    sdk.actions.openUrl(`${window.location.origin}/nft`);
  }, [sdk.actions]);

  const openFriendsPage = useCallback(() => {
    sdk.actions.openUrl(`${window.location.origin}/friends`);
  }, [sdk.actions]);

  const sendNotification = useCallback(async () => {
    setSendNotificationResult("");
    if (!notificationDetails || !context) {
      return;
    }

    try {
      const response = await fetch("/api/send-notification", {
        method: "POST",
        mode: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fid: context.user.fid,
          notificationDetails,
        }),
      });

      if (response.status === 200) {
        setSendNotificationResult("Success");
        return;
      } else if (response.status === 429) {
        setSendNotificationResult("Rate limited");
        return;
      }

      const data = await response.text();
      setSendNotificationResult(`Error: ${data}`);
    } catch (error) {
      setSendNotificationResult(`Error: ${error}`);
    }
  }, [context, notificationDetails]);

  const signTyped = useCallback(() => {
    signTypedData({
      domain: {
        name: "Frames v2 Demo",
        version: "1",
        chainId,
      },
      types: {
        Message: [{ name: "content", type: "string" }],
      },
      message: {
        content: "Hello from Frames v2!",
      },
      primaryType: "Message",
    });
  }, [chainId, signTypedData]);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
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
      <div className="w-[300px] mx-auto py-2 px-2">
        <h1 className="text-2xl font-bold text-center mb-4">{title}</h1>

        <div className="mb-4">
          <h2 className="font-2xl font-bold">Context</h2>

          <div className="p-4 mt-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <pre className="text-background font-mono text-md whitespace-pre-wrap break-words max-w-[260px] overflow-x-">
              {JSON.stringify(context, null, 2)}
            </pre>
          </div>
        </div>

        <div>
          <h2 className="font-2xl font-bold">Actions</h2>

          <div className="mb-4">
            <Button onClick={openNFTPage}>
              View NFT Page
            </Button>
          </div>

          <div className="mb-4">
            <Button onClick={openFriendsPage}>
              View Friends
            </Button>
          </div>

          <div className="mb-4">
            <ViewProfile />
          </div>

          <div className="mb-4">
            <Button onClick={close}>Close</Button>
          </div>
        </div>

        <div className="mb-4">
          <h2 className="font-2xl font-bold">Mini App Management</h2>
          <div className="mb-2">
            <Button onClick={pinFrame}>Add Mini App</Button>
            {pinFrameResponse && (
              <div className="mt-2 text-xs text-gray-600">
                {pinFrameResponse}
              </div>
            )}
          </div>
          {lastEvent && (
            <div className="text-xs text-gray-500">Last event: {lastEvent}</div>
          )}
          {notificationDetails && (
            <div className="mb-4">
              <Button onClick={sendNotification}>Send Notification</Button>
              {sendNotificationResult && (
                <div className="mt-2 text-xs text-gray-600">
                  {sendNotificationResult}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <h2 className="font-2xl font-bold">Ethereum</h2>

          {address && (
            <div className="my-2 text-xs">
              Address: <pre className="inline">{truncateAddress(address)}</pre>
            </div>
          )}

          {chainId && (
            <div className="my-2 text-xs">
              Chain ID: <pre className="inline">{chainId}</pre>
            </div>
          )}

          <div className="mb-4">
            <Button
              onClick={() =>
                isConnected
                  ? disconnect()
                  : connect({ connector: config.connectors[0] })
              }
            >
              {isConnected ? "Disconnect" : "Connect"}
            </Button>
          </div>

          <div className="mb-4">
            <SignEthMessage />
          </div>

          {isConnected && (
            <>
              <div className="mb-4">
                <SendEth />
              </div>
              <div className="mb-4">
                <Button
                  onClick={signTyped}
                  disabled={!isConnected || isSignTypedPending}
                >
                  Sign Typed Data
                </Button>
                {isSignTypedError && renderError(signTypedError)}
              </div>
              <div className="mb-4">
                <Button
                  onClick={handleSwitchChain}
                  disabled={isSwitchChainPending}
                >
                  Switch to {nextChain.name}
                </Button>
                {isSwitchChainError && renderError(switchChainError)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SignEthMessage() {
  const { isConnected } = useAccount();
  const { connectAsync } = useConnect();
  const {
    signMessage,
    data: signature,
    error: signError,
    isError: isSignError,
    isPending: isSignPending,
  } = useSignMessage();

  const handleSignMessage = useCallback(async () => {
    if (!isConnected) {
      await connectAsync({
        chainId: base.id,
        connector: config.connectors[0],
      });
    }

    signMessage({ message: "Hello from DappCon!" });
  }, [connectAsync, isConnected, signMessage]);

  return (
    <>
      <Button onClick={handleSignMessage} disabled={isSignPending}>
        Sign Message
      </Button>
      {isSignError && renderError(signError)}
      {signature && (
        <div className="mt-2 text-xs">
          <div>Signature: {signature}</div>
        </div>
      )}
    </>
  );
}

function SendEth() {
  const { isConnected, chainId } = useAccount();
  const {
    sendTransaction,
    data,
    error: sendTxError,
    isError: isSendTxError,
    isPending: isSendTxPending,
  } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: data,
    });

  const toAddr = useMemo(() => {
    // Protocol guild address
    return chainId === base.id
      ? "0x32e3C7fD24e175701A35c224f2238d18439C7dBC"
      : "0xB3d8d7887693a9852734b4D25e9C0Bb35Ba8a830";
  }, [chainId]);

  const handleSend = useCallback(() => {
    sendTransaction({
      to: toAddr,
      value: 100000000000000n, // 0.0001 ETH in wei
    });
  }, [toAddr, sendTransaction]);

  return (
    <>
      <Button onClick={handleSend} disabled={!isConnected || isSendTxPending}>
        Send Transaction (eth)
      </Button>
      {isSendTxError && renderError(sendTxError)}
      {data && (
        <div className="mt-2 text-xs">
          <div>Hash: {truncateAddress(data)}</div>
          <div>
            Status:{" "}
            {isConfirming
              ? "Confirming..."
              : isConfirmed
                ? "Confirmed!"
                : "Pending"}
          </div>
        </div>
      )}
    </>
  );
}

function ViewProfile() {
  const { sdk } = useMiniAppSdk();

  const [fid, setFid] = useState("3");

  return (
    <>
      <div>
        <Label
          className="text-background text-xs font-semibold text-gray-500 dark:text-gray-300 mb-1"
          htmlFor="view-profile-fid"
        >
          Fid
        </Label>
        <Input
          id="view-profile-fid"
          type="number"
          value={fid}
          className="mb-2 text-gray-500"
          onChange={(e) => {
            setFid(e.target.value);
          }}
          step="1"
          min="1"
        />
      </div>
      <Button
        onClick={() => {
          sdk.actions.viewProfile({ fid: parseInt(fid) });
        }}
      >
        View Profile
      </Button>
    </>
  );
}

const renderError = (error: Error | null) => {
  if (!error) return null;
  if (error instanceof BaseError) {
    const isUserRejection = error.walk(
      (e) => e instanceof UserRejectedRequestError,
    );

    if (isUserRejection) {
      return <div className="text-red-500 text-xs mt-1">Rejected by user.</div>;
    }
  }

  return <div className="text-red-500 text-xs mt-1">{error.message}</div>;
};
