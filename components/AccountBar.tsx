"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/hooks/useAccount";
import { signOut } from "@/lib/multiplayer";
import { clearMultiplayerSession } from "@/lib/multiplayer-session";
import { PlayerCareerStatsModal } from "@/components/PlayerCareerStatsModal";

export function AccountBar() {
  const router = useRouter();
  const { signedIn, username, loading } = useAccount();
  const [statsOpen, setStatsOpen] = useState(false);

  if (loading || !signedIn) return null;

  async function handleSignOut() {
    const confirmed = window.confirm(
      "Sign out and return to the home screen?\n\nYou will leave any active multiplayer room or match."
    );
    if (!confirmed) return;

    try {
      clearMultiplayerSession();
      await signOut();
      router.push("/");
    } catch {
      window.alert("Could not sign out. Please try again.");
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 border border-broadcast-border/60 bg-black/40 px-2 py-1">
        <span className="max-w-[10rem] truncate font-display text-[10px] font-semibold uppercase tracking-wide text-broadcast-highlight md:max-w-[14rem] md:text-xs">
          {username ?? "No profile"}
        </span>
        <button
          type="button"
          className="btn-broadcast px-2 py-0.5 text-[10px] md:text-xs"
          onClick={() => setStatsOpen(true)}
        >
          Stats
        </button>
        <button
          type="button"
          className="btn-broadcast px-2 py-0.5 text-[10px] md:text-xs"
          onClick={() => {
            void handleSignOut();
          }}
        >
          Sign out
        </button>
      </div>
      <PlayerCareerStatsModal
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        username={username}
      />
    </>
  );
}
