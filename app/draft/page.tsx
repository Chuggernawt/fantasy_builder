"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BroadcastHeader } from "@/components/BroadcastHeader";
import { PitchView } from "@/components/PitchView";
import { SquadBench } from "@/components/SquadBench";
import { MatchBenchPicker } from "@/components/MatchBenchPicker";
import { FORMATIONS } from "@/lib/formations";
import { countAssigned, isMatchReady } from "@/lib/lineup";
import { getAllUniverses, getPlayer, getUniverse } from "@/lib/squads";
import { getPlayerFixture } from "@/lib/season";
import { clearMultiplayerSession } from "@/lib/multiplayer-session";
import { useGameStore } from "@/store/game-store";
import type { FormationId } from "@/lib/types";

export default function DraftPage() {
  const router = useRouter();

  useEffect(() => {
    clearMultiplayerSession();
  }, []);

  const {
    selectedUniverseId,
    formationId,
    lineup,
    matchBench,
    opponentUniverseId,
    season,
    seasonActiveFixtureId,
    setFormation,
    setLineupSlot,
    swapLineupSlots,
    autoPickLineup,
    fillLineupRest,
    clearLineup,
    saveLineup,
    loadSavedLineup,
    hasSavedLineup,
    setOpponent,
    startMatch,
  } = useGameStore();

  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const canLoadSaved = hasSavedLineup();

  const universe = selectedUniverseId ? getUniverse(selectedUniverseId) : null;
  const formation = FORMATIONS.find((f) => f.id === formationId)!;
  const assignedCount = countAssigned(lineup);
  const ready = isMatchReady(lineup, matchBench);
  const seasonFixture =
    season?.status === "active" && seasonActiveFixtureId
      ? getPlayerFixture(season)
      : null;
  const isSeasonDraft = !!seasonFixture;
  const opponentUni = opponentUniverseId ? getUniverse(opponentUniverseId) : null;
  const draftBackHref = isSeasonDraft ? "/season" : `/squad/${universe?.id ?? ""}`;
  const draftBackLabel = isSeasonDraft ? "Season" : "Squad";

  const assignedNames = useMemo(
    () => new Set(lineup.map((l) => l.playerName).filter(Boolean)),
    [lineup]
  );

  const activeSlotData = formation.slots.find((s) => s.id === activeSlot);
  const activeAssignment = lineup.find((l) => l.slotId === activeSlot);

  const availablePlayers = useMemo(() => {
    if (!universe) return [];
    return universe.players.filter(
      (p) =>
        !assignedNames.has(p.name) ||
        activeAssignment?.playerName === p.name
    );
  }, [universe, assignedNames, activeAssignment?.playerName]);

  const reserves = useMemo(() => {
    if (!universe) return [];
    return universe.players.filter((p) => !assignedNames.has(p.name));
  }, [universe, assignedNames]);

  if (!universe) {
    return (
      <>
        <BroadcastHeader title="Draft" backHref="/universes" />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-slate-400">Select a universe first.</p>
          <Link href="/universes" className="btn-broadcast-solid mt-6 inline-block">
            Choose Universe
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <BroadcastHeader
        title="Formation & Draft"
        backHref={draftBackHref}
        backLabel={draftBackLabel}
        accent={universe.accentColor}
      />

      <main className="mx-auto flex h-[calc(100dvh-3.25rem)] max-w-7xl flex-col overflow-hidden px-2 py-2 md:px-3">
        <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2">
          {FORMATIONS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFormation(f.id as FormationId);
                setActiveSlot(null);
              }}
              className={`px-2 py-1 font-display text-[10px] font-bold uppercase tracking-wider md:px-3 md:py-1.5 md:text-xs ${
                formationId === f.id
                  ? "bg-broadcast-highlight text-stadium"
                  : "border border-broadcast-border text-slate-400 hover:border-broadcast-highlight"
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="ml-auto font-mono text-[10px] text-broadcast-highlight md:text-xs">
            XI {assignedCount}/11 · Subs {matchBench.length}/5
          </span>
          {isSeasonDraft && seasonFixture && opponentUni ? (
            <span className="font-display text-[10px] uppercase text-slate-300 md:text-xs">
              MD{seasonFixture.matchday}: vs {opponentUni.name} (
              {seasonFixture.homeUniverseId === season?.userUniverseId ? "H" : "A"})
            </span>
          ) : (
            <select
              value={opponentUniverseId ?? ""}
              onChange={(e) => setOpponent(e.target.value)}
              className="border border-broadcast-border bg-black/80 px-2 py-1 text-[10px] md:text-xs"
              aria-label="CPU opponent"
            >
              {getAllUniverses().map((u) => (
                <option key={u.id} value={u.id}>
                  vs {u.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="mb-2 flex shrink-0 flex-wrap gap-1.5">
          <button type="button" className="btn-broadcast px-2 py-1 text-[10px]" onClick={autoPickLineup}>
            Random XI
          </button>
          <button
            type="button"
            className="btn-broadcast px-2 py-1 text-[10px]"
            onClick={fillLineupRest}
          >
            Fill Rest
          </button>
          <button type="button" className="btn-broadcast px-2 py-1 text-[10px]" onClick={clearLineup}>
            Clear
          </button>
          <button
            type="button"
            className="btn-broadcast px-2 py-1 text-[10px]"
            onClick={() => {
              saveLineup();
              setSaveNotice("Saved");
            }}
          >
            Save
          </button>
          <button
            type="button"
            className="btn-broadcast px-2 py-1 text-[10px]"
            disabled={!canLoadSaved}
            onClick={() => {
              if (loadSavedLineup()) {
                setSaveNotice("Loaded");
                setActiveSlot(null);
              }
            }}
          >
            Load
          </button>
          {saveNotice ? (
            <span className="self-center text-[10px] text-broadcast-highlight">{saveNotice}</span>
          ) : null}
          <span className="hidden self-center text-[10px] text-slate-500 lg:inline">
            Drag squad → pitch · × to remove
          </span>
        </div>

        <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(11rem,16rem)]">
          <div className="glass-panel flex min-h-0 flex-1 flex-col overflow-hidden p-2">
            <p className="broadcast-label mb-1 shrink-0 text-[10px]" style={{ color: universe.accentColor }}>
              {universe.name} — {formation.label}
            </p>
            <div className="min-h-0 flex-1">
              <PitchView
                  formation={formation}
                  formationId={formationId}
                  lineup={lineup}
                  accent={universe.accentColor}
                  activeSlotId={activeSlot}
                  interactive
                  compact
                  getPlayer={(name) => getPlayer(universe.id, name)}
                  onSlotClick={(slotId) =>
                    setActiveSlot((prev) => (prev === slotId ? null : slotId))
                  }
                  onAssignPlayer={(slotId, playerName) => {
                    setLineupSlot(slotId, playerName);
                    setActiveSlot(null);
                  }}
                  onClearSlot={(slotId) => {
                    setLineupSlot(slotId, null);
                    if (activeSlot === slotId) setActiveSlot(null);
                  }}
                onSwapSlots={swapLineupSlots}
              />
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-2">
            <div className="min-h-0 flex-1">
              <SquadBench
                draggable
                players={availablePlayers}
                role={activeSlotData?.role}
                roleLabel={activeSlotData?.label}
                accent={universe.accentColor}
                assignedSlotPlayer={activeAssignment?.playerName ?? null}
                onSelect={(name) => {
                  if (!activeSlot) return;
                  setLineupSlot(activeSlot, name);
                }}
                onClearSlot={
                  activeSlot
                    ? () => {
                        setLineupSlot(activeSlot, null);
                      }
                    : undefined
                }
              />
            </div>
            {assignedCount === 11 ? (
              <MatchBenchPicker compact reserves={reserves} accent={universe.accentColor} />
            ) : null}
          </div>
        </div>

        <div className="mt-2 flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            className="btn-broadcast-solid text-xs"
            disabled={!ready}
            onClick={() => {
              startMatch();
              router.push("/match");
            }}
          >
            {ready
              ? "Kick Off"
              : assignedCount < 11
                ? `Need ${11 - assignedCount} in XI`
                : `Need ${5 - matchBench.length} subs`}
          </button>
          <Link href={isSeasonDraft ? "/season" : `/squad/${universe.id}`} className="btn-broadcast text-xs">
            {isSeasonDraft ? "Season Hub" : "Full Squad"}
          </Link>
        </div>
      </main>
    </>
  );
}
