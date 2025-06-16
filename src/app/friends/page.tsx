"use client";

import { FriendsList } from "~/components/friends-list";

export default function FriendsPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <FriendsList />
    </main>
  );
}