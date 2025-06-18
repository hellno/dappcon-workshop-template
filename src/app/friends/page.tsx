"use client";

import { FriendsList } from "~/components/friends-list";

// Force dynamic rendering to ensure client-side execution for Farcaster SDK context
export const dynamic = 'force-dynamic';

export default function FriendsPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background">
      <FriendsList />
    </main>
  );
}
