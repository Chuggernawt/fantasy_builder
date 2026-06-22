import Link from "next/link";
import { BroadcastHeader } from "@/components/BroadcastHeader";
import { PageInstructions } from "@/components/PageInstructions";
import { getAllUniverses } from "@/lib/squads";

export default function HomePage() {
  const universes = getAllUniverses();

  return (
    <>
      <BroadcastHeader title="Fantasy Build" />

      <main className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <PageInstructions>
          <ol className="list-inside list-decimal space-y-1.5">
            <li>Select your universe — one fictional roster per team, no mixed squads.</li>
            <li>Review the 22-player squad and draft your starting XI.</li>
            <li>Pick a formation, assign players (or roll a random XI), then face a CPU opponent.</li>
            <li>Win matches to learn who&apos;s good — stats reveal through play, not spreadsheets.</li>
          </ol>
        </PageInstructions>

        <section className="mb-12 text-center">
          <p className="broadcast-label mb-2">Universe Draft & Simulator</p>
          <h2 className="broadcast-title mb-4">Build Your Squad</h2>
          <p className="mx-auto max-w-xl text-sm text-slate-400 md:text-base">
            Pick a fictional universe, draft 11 from 22, choose your formation, and
            simulate head-to-head matches — Gandalf in goal, Tyson up front, chaos
            guaranteed.
          </p>
          <Link href="/universes" className="btn-broadcast-solid mt-8 inline-block">
            Friendly Match
          </Link>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link href="/multiplayer" className="btn-broadcast-solid px-5 py-2">
              Multiplayer
            </Link>
            <Link href="/season" className="btn-broadcast px-5 py-2">
              Season Mode
            </Link>
            <Link href="/tournament" className="btn-broadcast px-5 py-2">
              Tournament
            </Link>
          </div>
          <p className="mx-auto mt-3 max-w-md text-xs text-slate-500">
            Season: 20-team league (random draw) — 19 or 38 games, full stats, lite sim for other fixtures, trophy
            rewards for winning the title.
          </p>
        </section>

        <section>
          <p className="broadcast-label mb-4">Available Universes</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {universes.map((u) => (
              <Link
                key={u.id}
                href={`/squad/${u.id}`}
                className="glass-panel group p-4 transition hover:border-broadcast-highlight"
                style={{ borderLeftWidth: 4, borderLeftColor: u.accentColor }}
              >
                <p className="font-display text-sm font-bold uppercase tracking-wide group-hover:text-broadcast-highlight">
                  {u.name}
                </p>
                <p className="mt-1 text-xs text-slate-500">{u.tagline}</p>
                <p className="mt-2 font-mono text-lg text-broadcast-highlight">OVR ???</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
