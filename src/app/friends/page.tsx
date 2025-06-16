import dynamic from "next/dynamic";

const FriendsList = dynamic(() => import("~/components/friends-list").then(mod => ({ default: mod.FriendsList })), {
  ssr: false,
});

export default function FriendsPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <FriendsList />
    </main>
  );
}