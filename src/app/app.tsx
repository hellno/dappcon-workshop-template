"use client";

import dynamic from "next/dynamic";
import ReactDOM from "react-dom";

const FriendsList = dynamic(
  () =>
    import("~/components/friends-list").then((mod) => ({
      default: mod.FriendsList,
    })),
  {
    ssr: false,
  },
);

export default function App() {
  ReactDOM.preconnect("https://auth.farcaster.xyz");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background">
      <FriendsList />
    </main>
  );
}
