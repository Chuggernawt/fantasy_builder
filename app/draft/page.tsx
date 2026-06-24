"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BroadcastHeader } from "@/components/BroadcastHeader";
import { PitchView } from "@/components/PitchView";
import { SquadBench } from "@/components/SquadBench";
import { MatchBenchPicker } from "@/components/MatchBenchPicker";
import { PersistentMatchKey } from "@/components/PlayerFormLegend";
import { UniverseTraitDisplay } from "@/components/UniverseTraitDisplay";
import { TacticsPreMatchSelect } from "@/components/TacticsPreMatchSelect";
import { FORMATIONS } from "@/lib/formations";
import { countAssigned, isMatchReady } from "@/lib/lineup";
import { getAllUniverses, getPlayer, getUniverse } from "@/lib/squads";
import { isSquadUnlocked } from "@/lib/squad-unlocks";
import { getPlayerFixture } from "@/lib/season";
import { getSeasonTeamRoster, rosterEntriesToPlayers } from "@/lib/season-rosters";
import { injuryKey, returnTimelineLabel } from "@/lib/injuries";
import { getPlayerFormValue } from "@/lib/instance-form";
import { getSeasonTeamStamina, getTournamentSquadStamina } from "@/lib/squad-stamina";
import { seasonInjuries } from "@/lib/season-injuries";
import { clearMultiplayerSession } from "@/lib/multiplayer-session";
import { useGameStore } from "@/store/game-store";
import type { FormationId, Player } from "@/lib/types";

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
    tournamentActiveFixtureId,
    tournamentInstance,
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
    plannedTactics,
    setPlannedTactics,
  } = useGameStore();
  const unlockedSquads = useGameStore((s) => s.careerStats.unlockedSquads ?? []);

  useEffect(() => {
    if (!selectedUniverseId) return;
    if (!isSquadUnlocked(selectedUniverseId, unlockedSquads)) {
      router.replace(`/squad/${selectedUniverseId}`);
    }
  }, [selectedUniverseId, unlockedSquads, router]);

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
  const isTournamentDraft = !!tournamentActiveFixtureId && !isSeasonDraft;
  const isPersistentDraft = isSeasonDraft || isTournamentDraft;
  const opponentUni = opponentUniverseId ? getUniverse(opponentUniverseId) : null;

  const squadPlayers = useMemo(() => {
    if (isSeasonDraft && season?.rosters && selectedUniverseId) {
      return rosterEntriesToPlayers(getSeasonTeamRoster(season, selectedUniverseId));
    }
    return universe?.players ?? [];
  }, [isSeasonDraft, season, selectedUniverseId, universe]);

  const draftBackHref = isSeasonDraft ? "/season" : isTournamentDraft ? "/tournament" : `/squad/${universe?.id ?? ""}`;
  const draftBackLabel = isSeasonDraft ? "Season" : isTournamentDraft ? "Tournament" : "Squad";

  const playerFormMap = useMemo(() => {
    if (!isPersistentDraft || !selectedUniverseId) return undefined;
    if (isSeasonDraft && season) {
      const map: Record<string, number> = {};
      for (const p of squadPlayers) {
        map[p.name] = getPlayerFormValue(season.playerForm, selectedUniverseId, p.name);
      }
      return map;
    }
    if (isTournamentDraft && tournamentInstance) {
      return { ...tournamentInstance.playerForm };
    }
    return undefined;
  }, [isPersistentDraft, isSeasonDraft, isTournamentDraft, season, selectedUniverseId, squadPlayers, tournamentInstance]);

  const playerStaminaMap = useMemo(() => {
    if (!isPersistentDraft || !selectedUniverseId) return undefined;
    if (isSeasonDraft && season) {
      return getSeasonTeamStamina(season, selectedUniverseId);
    }
    if (isTournamentDraft && tournamentInstance) {
      return getTournamentSquadStamina(
        tournamentInstance,
        squadPlayers.map((p) => p.name)
      );
    }
    return undefined;
  }, [isPersistentDraft, isSeasonDraft, isTournamentDraft, season, selectedUniverseId, squadPlayers, tournamentInstance]);

  const injuryLabelMap = useMemo(() => {
    if (!isPersistentDraft) return undefined;
    const labels: Record<string, string> = {};
    if (isSeasonDraft && season && selectedUniverseId) {
      const roster = getSeasonTeamRoster(season, selectedUniverseId);
      const injuries = seasonInjuries(season);
      for (const e of roster) {
        const row = injuries[injuryKey(e.universeId, e.playerName)];
        if (row && row.gamesOut > 0) {
          labels[e.playerName] = returnTimelineLabel(row.gamesOut);
        }
      }
    } else if (isTournamentDraft && tournamentInstance) {
      for (const row of Object.values(tournamentInstance.injuries)) {
        if (row.gamesOut > 0) labels[row.playerName] = returnTimelineLabel(row.gamesOut);
      }
    }
    return labels;
  }, [isPersistentDraft, isSeasonDraft, isTournamentDraft, season, selectedUniverseId, tournamentInstance]);

  const assignedNames = useMemo(
    () => new Set(lineup.map((l) => l.playerName).filter(Boolean)),
    [lineup]
  );

  const activeSlotData = formation.slots.find((s) => s.id === activeSlot);
  const activeAssignment = lineup.find((l) => l.slotId === activeSlot);

  const squadPlayerByName = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of squadPlayers) map.set(p.name, p);
    return map;
  }, [squadPlayers]);

  const resolveDraftPlayer = useMemo(() => {
    const uniId = universe?.id ?? "";
    return (name: string) => squadPlayerByName.get(name) ?? getPlayer(uniId, name);
  }, [squadPlayerByName, universe?.id]);

  const availablePlayers = useMemo(() => {
    return squadPlayers.filter(
      (p) =>
        (!injuryLabelMap?.[p.name]) &&
        (!assignedNames.has(p.name) ||
        activeAssignment?.playerName === p.name)
    );
  }, [squadPlayers, assignedNames, activeAssignment?.playerName, injuryLabelMap]);

  const reserves = useMemo(() => {
    return squadPlayers.filter(
      (p) => !assignedNames.has(p.name) && !injuryLabelMap?.[p.name]
    );
  }, [squadPlayers, assignedNames, injuryLabelMap]);

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
          <TacticsPreMatchSelect value={plannedTactics} onChange={setPlannedTactics} />
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

        {universe ? (
          <div className="mb-2 grid shrink-0 gap-1.5 sm:grid-cols-2">
            <UniverseTraitDisplay
              universeId={universe.id}
              accent={universe.accentColor}
              variant="strip"
              prefix="Your trait"
            />
            {opponentUni ? (
              <UniverseTraitDisplay
                universeId={opponentUni.id}
                accent={opponentUni.accentColor}
                variant="strip"
                prefix="Opponent"
              />
            ) : null}
          </div>
        ) : null}

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
            {isPersistentDraft ? (
              <div className="mb-2 shrink-0 border border-broadcast-border bg-black/40 px-2 py-1.5">
                <PersistentMatchKey />
              </div>
            ) : null}
            <div className="min-h-0 flex-1">
              <PitchView
                  formation={formation}
                  formationId={formationId}
                  lineup={lineup}
                  accent={universe.accentColor}
                  activeSlotId={activeSlot}
                  interactive
                  compact
                  getPlayer={resolveDraftPlayer}
                  playerForm={playerFormMap}
                  squadFitness={playerStaminaMap}
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
                playerForm={playerFormMap}
                playerStamina={playerStaminaMap}
                injuryLabels={injuryLabelMap}
                showFormLegend={false}
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
              <MatchBenchPicker
                compact
                reserves={reserves}
                accent={universe.accentColor}
                playerForm={playerFormMap}
                playerStamina={playerStaminaMap}
                injuryLabels={injuryLabelMap}
              />
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
