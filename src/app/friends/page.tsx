"use client";

import { FriendsList } from "~/components/friends-list";

export default function FriendsPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background">
      <FriendsList />
    </main>
  );
}
