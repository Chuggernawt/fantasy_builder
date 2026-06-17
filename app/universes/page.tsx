"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BroadcastHeader } from "@/components/BroadcastHeader";
import { PageInstructions } from "@/components/PageInstructions";
import { getAllUniverses } from "@/lib/squads";
import { useGameStore } from "@/store/game-store";

export default function UniversesPage() {
  const router = useRouter();
  const selectUniverse = useGameStore((s) => s.selectUniverse);
  const universes = getAllUniverses();

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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {universes.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                selectUniverse(u.id);
                router.push(`/squad/${u.id}`);
              }}
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

        <div className="mt-8">
          <Link href="/" className="btn-broadcast">
            Back to Home
          </Link>
        </div>
      </main>
    </>
  );
}
