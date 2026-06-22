"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BroadcastHeader } from "@/components/BroadcastHeader";
import { PlayerCard } from "@/components/PlayerCard";
import { getUniverse } from "@/lib/squads";
import {
  isSquadUnlocked,
  unlockRequirementForSquad,
} from "@/lib/squad-unlocks";
import { useGameStore } from "@/store/game-store";

export default function SquadPage() {
  const params = useParams();
  const id = params.id as string;
  const universe = getUniverse(id);
  const unlockedSquads = useGameStore((s) => s.careerStats.unlockedSquads ?? []);
  const locked = universe ? !isSquadUnlocked(universe.id, unlockedSquads) : false;
  const unlockReq = unlockRequirementForSquad(id);
  const [query, setQuery] = useState("");

  const players = useMemo(() => {
    if (!universe) return [];
    let list = [...universe.players].sort((a, b) => a.name.localeCompare(b.name));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [universe, query]);

  if (!universe) {
    return (
      <div className="p-8 text-center">
        <p>Universe not found.</p>
        <Link href="/universes" className="btn-broadcast mt-4 inline-block">
          Back
        </Link>
      </div>
    );
  }

  return (
    <>
      <BroadcastHeader
        title={universe.name}
        backHref="/universes"
        backLabel="Universes"
        accent={universe.accentColor}
      />

      <main className="mx-auto max-w-6xl px-4 py-6">
        {locked && unlockReq ? (
          <div className="mb-6 border border-amber-500/40 bg-amber-500/10 px-4 py-4">
            <p className="broadcast-label text-amber-400">Squad locked</p>
            <p className="mt-1 text-sm text-slate-300">{unlockReq.title}</p>
            <p className="mt-1 text-xs text-slate-500">{unlockReq.description}</p>
            <p className="mt-2 text-xs text-slate-500">
              You can preview the roster, but drafting is disabled until you unlock this squad.
            </p>
          </div>
        ) : null}

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="broadcast-label" style={{ color: universe.accentColor }}>
              Squad Overview
            </p>
            <p className="text-sm text-slate-400">{universe.tagline}</p>
            <p className="mt-1 font-mono text-broadcast-highlight">Team OVR ??? · 22 players · A–Z</p>
          </div>
          <input
            type="search"
            placeholder="Search player..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border border-broadcast-border bg-black/80 px-3 py-2 text-sm outline-none focus:border-broadcast-highlight"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((p) => (
            <PlayerCard key={p.name} player={p} accent={universe.accentColor} />
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {locked ? (
            <span
              className="btn-broadcast-solid cursor-not-allowed opacity-50"
              title={unlockReq?.title ?? "Squad locked"}
            >
              Draft Starting XI (Locked)
            </span>
          ) : (
            <Link
              href="/draft"
              className="btn-broadcast-solid"
              onClick={() => useGameStore.getState().selectUniverse(id)}
            >
              Draft Starting XI
            </Link>
          )}
          <Link href="/universes" className="btn-broadcast">
            Change Universe
          </Link>
        </div>
      </main>
    </>
  );
}
