"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BroadcastHeader } from "@/components/BroadcastHeader";
import { PageInstructions } from "@/components/PageInstructions";
import {
  countUnlockedLockableSquads,
  partitionUniversesByLock,
  TOTAL_LOCKABLE_SQUADS,
  unlockRequirementForSquad,
} from "@/lib/squad-unlocks";
import { useGameStore } from "@/store/game-store";

export default function UniversesPage() {
  const router = useRouter();
  const careerStats = useGameStore((s) => s.careerStats);
  const unlockedSquads = careerStats.unlockedSquads ?? [];
  const { available, locked } = partitionUniversesByLock(unlockedSquads);
  const unlockedCount = countUnlockedLockableSquads(unlockedSquads);

  return (
    <>
      <BroadcastHeader title="Select Universe" backHref="/" backLabel="Home" />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <PageInstructions label="Before you pick">
          <p>
            One universe per team — no mixed rosters. Choose a squad, review all 22 players,
            then draft your XI. You&apos;ll discover who fits where by playing matches, not by
            auto-optimizing lineups.
          </p>
        </PageInstructions>

        <p className="mb-4 font-mono text-xs text-slate-400">
          Locked squads unlocked: {unlockedCount}/{TOTAL_LOCKABLE_SQUADS}
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {available.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => router.push(`/squad/${u.id}`)}
              className="glass-panel group p-5 text-left transition hover:border-broadcast-highlight"
              style={{ borderTopWidth: 3, borderTopColor: u.accentColor }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-bold uppercase tracking-wide">
                    {u.name}
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">{u.tagline}</p>
                </div>
                <span
                  className="font-display text-2xl font-bold"
                  style={{ color: u.accentColor }}
                >
                  ???
                </span>
              </div>
              <p className="mt-4 text-xs uppercase tracking-wider text-slate-500 group-hover:text-broadcast-highlight">
                View Squad →
              </p>
            </button>
          ))}
        </div>

        {locked.length > 0 ? (
          <section className="mt-10">
            <p className="broadcast-label mb-1">Locked Squads</p>
            <p className="mb-4 text-sm text-slate-500">
              Win tournaments and seasons to unlock these squads for drafting.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {locked.map((u) => {
                const req = unlockRequirementForSquad(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => router.push(`/squad/${u.id}`)}
                    className="glass-panel group relative overflow-hidden p-5 text-left opacity-90 transition hover:border-slate-500"
                    style={{ borderTopWidth: 3, borderTopColor: u.accentColor }}
                  >
                    <div
                      className="pointer-events-none absolute inset-0 bg-black/45"
                      aria-hidden
                    />
                    <div className="relative">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-slate-500">
                            🔒 Locked
                          </p>
                          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-slate-300">
                            {u.name}
                          </h2>
                          <p className="mt-1 text-xs text-slate-500">{u.tagline}</p>
                        </div>
                        <span className="font-display text-2xl font-bold text-slate-600">???</span>
                      </div>
                      {req ? (
                        <div className="mt-4 border border-slate-600/60 bg-black/40 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wider text-amber-400/90">
                            Unlock requirement
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-300">{req.title}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">{req.description}</p>
                        </div>
                      ) : null}
                      <p className="mt-4 text-xs uppercase tracking-wider text-slate-500 group-hover:text-slate-400">
                        Preview squad →
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className="mt-8">
          <Link href="/" className="btn-broadcast">
            Back to Home
          </Link>
        </div>
      </main>
    </>
  );
}
