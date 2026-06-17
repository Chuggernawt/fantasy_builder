"use client";

import { useMemo, useState } from "react";
import { PitchView } from "@/components/PitchView";
import { SquadBench } from "@/components/SquadBench";
import { MatchBenchPicker } from "@/components/MatchBenchPicker";
import { FORMATIONS } from "@/lib/formations";
import { MATCH_BENCH_SIZE } from "@/lib/constants";
import {
  countAssigned,
  fillLineupRestRandom,
  pickRandomBench,
  randomFillLineup,
  remapLineupOnFormationChange,
} from "@/lib/lineup";
import { lobbyTeamReady } from "@/lib/multiplayer-lobby";
import type { PlayerLobbyState } from "@/lib/multiplayer-types";
import { getAllUniverses, getPlayer, getUniverse } from "@/lib/squads";
import type { FormationId, LineupSlot } from "@/lib/types";

interface MultiplayerLobbyBuilderProps {
  lobby: PlayerLobbyState;
  takenUniverseId: string | null;
  onChange: (next: PlayerLobbyState) => void;
  onPersist?: (next: PlayerLobbyState) => void;
}

export function MultiplayerLobbyBuilder({
  lobby,
  takenUniverseId,
  onChange,
  onPersist,
}: MultiplayerLobbyBuilderProps) {
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const universe = lobby.universeId ? getUniverse(lobby.universeId) : null;
  const formation = FORMATIONS.find((f) => f.id === lobby.formationId) ?? FORMATIONS[0];
  const lineup = lobby.lineup as LineupSlot[];
  const assignedCount = countAssigned(lineup);
  const universes = getAllUniverses().filter((u) => u.id !== takenUniverseId);

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
        !assignedNames.has(p.name) || activeAssignment?.playerName === p.name
    );
  }, [universe, assignedNames, activeAssignment?.playerName]);

  const reserves = useMemo(() => {
    if (!universe) return [];
    return universe.players.filter((p) => !assignedNames.has(p.name));
  }, [universe, assignedNames]);

  function emit(next: PlayerLobbyState, persist = false) {
    onChange(next);
    if (persist) onPersist?.(next);
  }

  function patchLobby(patch: Partial<PlayerLobbyState>, persist = false) {
    emit(
      {
        ...lobby,
        ...patch,
        ready: false,
        updatedAt: new Date().toISOString(),
      },
      persist
    );
  }

  function setLineupSlot(slotId: string, playerName: string | null) {
    patchLobby({
      lineup: lobby.lineup.map((slot) =>
        slot.slotId === slotId ? { ...slot, playerName } : slot
      ),
    });
  }

  function swapLineupSlots(slotA: string, slotB: string) {
    const a = lobby.lineup.find((s) => s.slotId === slotA);
    const b = lobby.lineup.find((s) => s.slotId === slotB);
    if (!a || !b) return;
    patchLobby({
      lineup: lobby.lineup.map((slot) => {
        if (slot.slotId === slotA) return { ...slot, playerName: b.playerName };
        if (slot.slotId === slotB) return { ...slot, playerName: a.playerName };
        return slot;
      }),
    });
  }

  function toggleBenchPlayer(playerName: string) {
    const has = lobby.matchBench.includes(playerName);
    if (has) {
      patchLobby({ matchBench: lobby.matchBench.filter((n) => n !== playerName) });
      return;
    }
    if (lobby.matchBench.length >= MATCH_BENCH_SIZE) return;
    patchLobby({ matchBench: [...lobby.matchBench, playerName] });
  }

  if (!universe) {
    return (
      <div className="space-y-3">
        <p className="broadcast-label text-xs">Choose your universe</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {universes.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() =>
                patchLobby(
                  {
                    universeId: u.id,
                    lineup: lobby.lineup.map((slot) => ({ ...slot, playerName: null })),
                    matchBench: [],
                  },
                  true
                )
              }
              className="border border-broadcast-border bg-black/50 px-3 py-3 text-left hover:border-broadcast-highlight"
            >
              <span className="font-display text-sm uppercase" style={{ color: u.accentColor }}>
                {u.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <select
          value={lobby.universeId ?? ""}
          onChange={(e) =>
            patchLobby(
              {
                universeId: e.target.value,
                lineup: lobby.lineup.map((slot) => ({ ...slot, playerName: null })),
                matchBench: [],
              },
              true
            )
          }
          className="border border-broadcast-border bg-black/80 px-2 py-1 text-[10px] md:text-xs"
        >
          {universes.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        {FORMATIONS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              patchLobby({
                formationId: f.id,
                lineup: remapLineupOnFormationChange(lineup, f.id as FormationId),
                matchBench: [],
              });
              setActiveSlot(null);
            }}
            className={`px-2 py-1 font-display text-[10px] font-bold uppercase tracking-wider md:px-3 md:py-1.5 md:text-xs ${
              lobby.formationId === f.id
                ? "bg-broadcast-highlight text-stadium"
                : "border border-broadcast-border text-slate-400 hover:border-broadcast-highlight"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto font-mono text-[10px] text-broadcast-highlight md:text-xs">
          XI {assignedCount}/11 · Subs {lobby.matchBench.length}/{MATCH_BENCH_SIZE}
        </span>
      </div>

      <div className="flex shrink-0 flex-wrap gap-1.5">
        <button
          type="button"
          className="btn-broadcast px-2 py-1 text-[10px]"
          onClick={() => {
            if (!lobby.universeId) return;
            patchLobby({
              lineup: randomFillLineup(lobby.universeId, lobby.formationId as FormationId),
              matchBench: [],
            });
            setActiveSlot(null);
          }}
        >
          Random XI
        </button>
        <button
          type="button"
          className="btn-broadcast px-2 py-1 text-[10px]"
          onClick={() => {
            if (!lobby.universeId) return;
            patchLobby({
              lineup: fillLineupRestRandom(lineup, lobby.universeId),
            });
          }}
        >
          Fill Rest
        </button>
        <button
          type="button"
          className="btn-broadcast px-2 py-1 text-[10px]"
          onClick={() => {
            patchLobby({
              lineup: lineup.map((slot) => ({ ...slot, playerName: null })),
              matchBench: [],
            });
            setActiveSlot(null);
          }}
        >
          Clear
        </button>
        <span className="hidden self-center text-[10px] text-slate-500 lg:inline">
          Drag squad → pitch · click slot to assign
        </span>
      </div>

      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(11rem,16rem)]">
        <div className="glass-panel flex min-h-0 flex-1 flex-col overflow-hidden p-2">
          <p
            className="broadcast-label mb-1 shrink-0 text-[10px]"
            style={{ color: universe.accentColor }}
          >
            {universe.name} — {formation.label}
          </p>
          <div className="min-h-0 flex-1">
            <PitchView
              formation={formation}
              formationId={lobby.formationId as FormationId}
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
                setActiveSlot(null);
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
              matchBench={lobby.matchBench}
              onTogglePlayer={toggleBenchPlayer}
              onAutoPick={() => {
                if (!lobby.universeId) return;
                patchLobby({
                  matchBench: pickRandomBench(lobby.universeId, lineup),
                });
              }}
            />
          ) : null}
        </div>
      </div>

      {lobbyTeamReady(lobby) ? (
        <p className="shrink-0 text-xs text-broadcast-highlight">
          Team complete — click Ready when you are set.
        </p>
      ) : null}
    </div>
  );
}

interface OpponentLobbyPreviewProps {
  username: string;
  lobby: PlayerLobbyState;
  compact?: boolean;
}

export function OpponentLobbyPreview({
  username,
  lobby,
  compact = false,
}: OpponentLobbyPreviewProps) {
  const universe = lobby.universeId ? getUniverse(lobby.universeId) : null;
  const formation = FORMATIONS.find((f) => f.id === lobby.formationId) ?? FORMATIONS[0];
  const lineup = lobby.lineup as LineupSlot[];

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="broadcast-label">{username}</span>
        {!universe ? (
          <span className="text-slate-500">Choosing universe...</span>
        ) : (
          <>
            <span className="font-display uppercase" style={{ color: universe.accentColor }}>
              {universe.name}
            </span>
            <span className="text-slate-500">{formation.label}</span>
            {lobby.ready ? (
              <span className="text-broadcast-highlight">Ready ✓</span>
            ) : (
              <span className="text-amber-400">Building team...</span>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="broadcast-label text-xs">{username}</p>
        {lobby.ready ? (
          <span className="text-xs text-broadcast-highlight">Ready ✓</span>
        ) : universe ? (
          <span className="text-xs text-amber-400">Building team...</span>
        ) : null}
      </div>
      {!universe ? (
        <p className="text-sm text-slate-500">Choosing universe...</p>
      ) : (
        <>
          <p className="font-display text-sm uppercase" style={{ color: universe.accentColor }}>
            {universe.name} · {formation.label}
          </p>
          {lobby.ready ? (
            <div className="glass-panel min-h-[14rem] flex-1 p-2">
              <PitchView
                formation={formation}
                formationId={lobby.formationId as FormationId}
                lineup={lineup}
                accent={universe.accentColor}
                interactive={false}
                compact
                getPlayer={(name) => getPlayer(universe.id, name)}
              />
            </div>
          ) : (
            <p className="text-sm text-slate-500">Lineup hidden until ready.</p>
          )}
        </>
      )}
    </div>
  );
}
