"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PlayerCareerStatsPanel } from "@/components/PlayerCareerStatsPanel";
import { emptyCareerStats, type PlayerCareerStats } from "@/lib/career-stats";
import { getFriendCareerStats } from "@/lib/multiplayer";
import { useGameStore } from "@/store/game-store";

interface PlayerCareerStatsModalProps {
  open: boolean;
  onClose: () => void;
  username?: string | null;
  /** When set, load stats from the friend's profile instead of the local store. */
  userId?: string | null;
}

export function PlayerCareerStatsModal({
  open,
  onClose,
  username,
  userId = null,
}: PlayerCareerStatsModalProps) {
  const localCareerStats = useGameStore((s) => s.careerStats);
  const [remoteStats, setRemoteStats] = useState<PlayerCareerStats | null>(null);
  const [remoteUsername, setRemoteUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewingFriend = !!userId;
  const displayUsername = viewingFriend ? remoteUsername ?? username : username;
  const displayStats = viewingFriend ? remoteStats : localCareerStats;

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !userId) {
      setRemoteStats(null);
      setRemoteUsername(null);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    setRemoteStats(null);

    void getFriendCareerStats(userId)
      .then(({ username: fetchedUsername, careerStats }) => {
        if (!active) return;
        setRemoteUsername(fetchedUsername);
        setRemoteStats(careerStats);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load stats.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, userId]);

  if (!open || typeof document === "undefined") return null;

  const statsToShow = displayStats ?? emptyCareerStats();

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        aria-label="Close stats"
        onClick={onClose}
      />

      <div
        className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col border-2 border-broadcast-highlight bg-stadium shadow-[0_0_40px_rgba(0,0,0,0.65)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="career-stats-title"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-broadcast-border bg-black/90 px-4 py-3">
          <div className="min-w-0">
            <p className="broadcast-label">Career overview</p>
            <h2
              id="career-stats-title"
              className="truncate font-display text-sm font-bold uppercase tracking-wider text-broadcast-text md:text-base"
            >
              {displayUsername ? `${displayUsername}'s stats` : "Player stats"}
            </h2>
          </div>
          <button
            type="button"
            className="btn-broadcast-solid shrink-0 px-4 py-2 text-xs"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 commentary-scroll">
          {loading ? (
            <p className="text-sm text-slate-400">Loading stats…</p>
          ) : error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : (
            <PlayerCareerStatsPanel
              stats={statsToShow}
              username={displayUsername}
              hideTitle
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
