"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BroadcastHeader } from "@/components/BroadcastHeader";
import { SeasonHubCommentary } from "@/components/SeasonHubCommentary";
import { SeasonTransferLog } from "@/components/SeasonTransferLog";
import { SeasonTransferModal } from "@/components/SeasonTransferModal";
import { getUniverse } from "@/lib/squads";
import { partitionUniversesByLock } from "@/lib/squad-unlocks";
import { ensureSeasonRosters } from "@/lib/season-rosters";
import { getTransferHubStatus } from "@/lib/season-transfers";
import {
  canContinueSeasonCampaign,
  formatRelegationAnnouncement,
  isUserInRelegationZone,
  relegationZoneStartIndex,
} from "@/lib/season-continue";
import {
  seasonSaveSlotSummary,
  type SeasonSaveSlotIndex,
} from "@/lib/season-saves";
import {
  getMatchdayFixtures,
  getPlayerFixture,
  sortTable,
  topAssists,
  topCards,
  topScorers,
} from "@/lib/season";
import type { SeasonLength } from "@/lib/season-types";
import { useGameStore } from "@/store/game-store";

type StatsTab = "scorers" | "assists" | "yellows" | "reds";

function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

export default function SeasonPage() {
  const router = useRouter();
  const season = useGameStore((s) => s.season);
  const seasonHonours = useGameStore((s) => s.seasonHonours);
  const seasonSaveSlots = useGameStore((s) => s.seasonSaveSlots);
  const activeSeasonSlot = useGameStore((s) => s.activeSeasonSlot);
  const startSeasonInSlot = useGameStore((s) => s.startSeasonInSlot);
  const loadSeasonSlot = useGameStore((s) => s.loadSeasonSlot);
  const saveSeasonSlot = useGameStore((s) => s.saveSeasonSlot);
  const continueSeason = useGameStore((s) => s.continueSeason);
  const abandonSeason = useGameStore((s) => s.abandonSeason);
  const prepareSeasonMatch = useGameStore((s) => s.prepareSeasonMatch);

  const [pickLength, setPickLength] = useState<SeasonLength | null>(null);
  const [pendingUniverseId, setPendingUniverseId] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [statsTab, setStatsTab] = useState<StatsTab>("scorers");
  const [transferOpen, setTransferOpen] = useState(false);

  useEffect(() => {
    if (season && !season.rosters) {
      useGameStore.setState({ season: ensureSeasonRosters(season) });
    }
  }, [season]);

  const careerStats = useGameStore((s) => s.careerStats);
  const { available: universes } = partitionUniversesByLock(careerStats.unlockedSquads ?? []);
  const userUniverse = season ? getUniverse(season.userUniverseId) : null;
  const nextFixture = season ? getPlayerFixture(season) : null;
  const sortedTable = useMemo(
    () => (season ? sortTable(season.table) : []),
    [season]
  );

  const lastMatchday = season
    ? season.status === "finished"
      ? season.length
      : Math.max(0, season.currentMatchday - 1)
    : 0;

  const matchdayResults = useMemo(() => {
    if (!season || lastMatchday < 1) return [];
    return getMatchdayFixtures(season, lastMatchday).filter((f) => f.played);
  }, [season, lastMatchday]);

  const statRows = useMemo(() => {
    if (!season) return [];
    switch (statsTab) {
      case "assists":
        return topAssists(season.playerStats, 15);
      case "yellows":
        return topCards(season.playerStats, "yellow", 15);
      case "reds":
        return topCards(season.playerStats, "red", 15);
      default:
        return topScorers(season.playerStats, 15);
    }
  }, [season, statsTab]);

  function handlePlayNext() {
    if (!prepareSeasonMatch()) return;
    router.push("/draft");
  }

  function handleSave() {
    saveSeasonSlot();
    setSaveNotice("Saved");
    window.setTimeout(() => setSaveNotice(null), 2000);
  }

  function confirmStartInSlot(slot: SeasonSaveSlotIndex) {
    if (!pendingUniverseId || !pickLength) return;
    const occupied = seasonSaveSlots[slot];
    if (occupied && !window.confirm(`Overwrite save slot ${slot + 1}?`)) return;
    startSeasonInSlot(slot, pendingUniverseId, pickLength);
    setPendingUniverseId(null);
    setPickLength(null);
  }

  if (!season) {
    const hasAnySave = seasonSaveSlots.some((s) => s != null);
    return (
      <>
        <BroadcastHeader title="Season Mode" backHref="/" backLabel="Home" />
        <main className="mx-auto max-w-4xl px-4 py-6">
          <p className="mb-6 text-sm text-slate-400">
            A random draw of 20 universes each season. Win the title to earn trophy honours and squad
            reveals — 38-game champions unlock every stat; 19-game champions get 11 random reveals.
            Bottom three are relegated each campaign; carry your squad into the next season if you
            stay up.
          </p>

          {hasAnySave ? (
            <section className="glass-panel mb-8 p-4">
              <p className="broadcast-label mb-3">Load Save</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {([0, 1, 2] as const).map((slot) => {
                  const data = seasonSaveSlots[slot];
                  const uni = data ? getUniverse(data.season.userUniverseId) : null;
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={!data}
                      onClick={() => loadSeasonSlot(slot)}
                      className="glass-panel p-3 text-left transition enabled:hover:border-broadcast-highlight disabled:opacity-40"
                      style={
                        uni
                          ? { borderLeftWidth: 4, borderLeftColor: uni.accentColor }
                          : undefined
                      }
                    >
                      <p className="font-display text-xs font-bold uppercase">Slot {slot + 1}</p>
                      {data ? (
                        <>
                          <p className="mt-1 text-sm" style={{ color: uni?.accentColor }}>
                            {uni?.name}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {seasonSaveSlotSummary(data)}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-600">
                            Saved {new Date(data.savedAt).toLocaleString()}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 text-xs text-slate-600">Empty</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className="mb-8 flex flex-wrap gap-3">
            <button
              type="button"
              className={`btn-broadcast px-4 py-2 ${pickLength === 19 ? "border-broadcast-highlight bg-broadcast-highlight/15" : ""}`}
              onClick={() => {
                setPickLength(19);
                setPendingUniverseId(null);
              }}
            >
              19 Games — each opponent once
            </button>
            <button
              type="button"
              className={`btn-broadcast px-4 py-2 ${pickLength === 38 ? "border-broadcast-highlight bg-broadcast-highlight/15" : ""}`}
              onClick={() => {
                setPickLength(38);
                setPendingUniverseId(null);
              }}
            >
              38 Games — home &amp; away
            </button>
          </div>

          {pickLength && !pendingUniverseId ? (
            <section>
              <p className="broadcast-label mb-3">Choose your universe</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {universes.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setPendingUniverseId(u.id)}
                    className="glass-panel p-4 text-left transition hover:border-broadcast-highlight"
                    style={{ borderLeftWidth: 4, borderLeftColor: u.accentColor }}
                  >
                    <p className="font-display text-sm font-bold uppercase">{u.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{u.tagline}</p>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {pickLength && pendingUniverseId ? (
            <section>
              <p className="broadcast-label mb-1">Save slot</p>
              <p className="mb-3 text-sm text-slate-400">
                Choose where to store this {pickLength}-game campaign (
                {getUniverse(pendingUniverseId)?.name}).
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {([0, 1, 2] as const).map((slot) => {
                  const occupied = seasonSaveSlots[slot];
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => confirmStartInSlot(slot)}
                      className="glass-panel p-4 text-left transition hover:border-broadcast-highlight"
                    >
                      <p className="font-display text-sm font-bold uppercase">Slot {slot + 1}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {occupied ? seasonSaveSlotSummary(occupied) : "Empty — new save"}
                      </p>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="btn-broadcast mt-4 text-xs"
                onClick={() => setPendingUniverseId(null)}
              >
                Back to universe pick
              </button>
            </section>
          ) : null}

          {!pickLength ? (
            <p className="text-sm text-slate-500">Pick a season length to start a new campaign.</p>
          ) : null}
        </main>
      </>
    );
  }

  const championUni =
    season.status === "finished" && season.championId
      ? getUniverse(season.championId)
      : null;
  const userWon =
    season.status === "finished" && season.championId === season.userUniverseId;
  const userRelegated = isUserInRelegationZone(season);
  const canContinue = canContinueSeasonCampaign(season);
  const relegateFrom = relegationZoneStartIndex(sortedTable.length);
  const transferHub = getTransferHubStatus(season);

  return (
    <>
      <BroadcastHeader
        title={`Season ${season.seasonNumber}`}
        backHref="/"
        backLabel="Home"
        accent={userUniverse?.accentColor}
      />

      <main className="mx-auto max-w-6xl px-4 py-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="broadcast-label">
              {userUniverse?.name} · {season.length}-game league
            </p>
            <p className="font-mono text-sm text-slate-400">
              {season.status === "finished"
                ? "Season complete"
                : `Matchday ${season.currentMatchday} of ${season.length}`}
              {activeSeasonSlot != null ? ` · Save slot ${activeSeasonSlot + 1}` : null}
            </p>
            {saveNotice ? (
              <p className="mt-1 text-[11px] text-broadcast-highlight">{saveNotice}</p>
            ) : null}
            {season.status === "active" ? (
              <p className="mt-1 text-[11px] text-slate-500">{transferHub.shortLabel}</p>
            ) : null}
          </div>
          {season.status === "active" && nextFixture ? (
            <button type="button" className="btn-broadcast-solid" onClick={handlePlayNext}>
              Draft for next match
            </button>
          ) : null}
          {season.status === "active" ? (
            <button
              type="button"
              className={`btn-broadcast text-xs ${
                transferHub.open
                  ? "border-broadcast-highlight/60 bg-broadcast-highlight/10"
                  : "opacity-80"
              }`}
              onClick={() => setTransferOpen(true)}
            >
              {transferHub.buttonLabel}
            </button>
          ) : null}
          {season.status === "active" ? (
            <button type="button" className="btn-broadcast text-xs" onClick={handleSave}>
              Save game
            </button>
          ) : null}
          {season.status === "active" ? (
            <button type="button" className="btn-broadcast text-xs" onClick={abandonSeason}>
              Abandon season
            </button>
          ) : canContinue ? (
            <button type="button" className="btn-broadcast-solid" onClick={() => continueSeason()}>
              Continue season {season.seasonNumber + 1}
            </button>
          ) : (
            <button
              type="button"
              className="btn-broadcast-solid"
              onClick={() => {
                abandonSeason();
              }}
            >
              New season
            </button>
          )}
        </div>

        {season.status === "finished" ? (
          userRelegated ? (
            <div className="glass-panel mb-6 border-t-4 border-red-500 p-4">
              <p className="broadcast-label mb-1 text-red-400">Relegated</p>
              <p className="font-display text-xl font-bold uppercase text-red-400">
                {userUniverse?.name} finish in the bottom three
              </p>
              <p className="mt-2 text-sm text-slate-400">
                This save cannot continue. Start a new campaign in an empty slot when you are ready.
              </p>
              {championUni ? (
                <p className="mt-2 text-sm text-slate-500">League champions: {championUni.name}</p>
              ) : null}
            </div>
          ) : (
            <div
              className="glass-panel mb-6 border-t-4 p-4"
              style={{ borderTopColor: championUni?.accentColor ?? "#eab308" }}
            >
              <p className="broadcast-label mb-1">Champions</p>
              <p className="font-display text-xl font-bold uppercase text-broadcast-highlight">
                {championUni?.name ?? "—"}
              </p>
              {userWon ? (
                <p className="mt-2 text-sm text-slate-300">
                  Trophy won!{" "}
                  {season.length === 38
                    ? "Your full 22-man squad stats are now revealed."
                    : "11 random squad members have been fully revealed."}
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  {canContinue
                    ? "Continue into the next season with your current squad and league transfers."
                    : "Better luck next season."}
                </p>
              )}
              {season.lastRelegatedIds?.length && season.lastPromotedIds?.length ? (
                <p className="mt-2 text-[11px] text-slate-500">
                  {formatRelegationAnnouncement(
                    season.lastRelegatedIds,
                    season.lastPromotedIds,
                    (id) => getUniverse(id)?.name ?? id
                  )}
                </p>
              ) : null}
            </div>
          )
        ) : null}

        <div className="mb-6 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <section className="glass-panel overflow-x-auto p-4">
            <p className="broadcast-label mb-3">League Table</p>
            <table className="w-full min-w-[28rem] text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2">#</th>
                  <th className="pb-2">Team</th>
                  <th className="pb-2 text-center">P</th>
                  <th className="pb-2 text-center">W</th>
                  <th className="pb-2 text-center">D</th>
                  <th className="pb-2 text-center">L</th>
                  <th className="pb-2 text-center">GF</th>
                  <th className="pb-2 text-center">GA</th>
                  <th className="pb-2 text-center">GD</th>
                  <th className="pb-2 text-center font-bold text-broadcast-highlight">Pts</th>
                </tr>
              </thead>
              <tbody>
                {sortedTable.map((row, i) => {
                  const uni = getUniverse(row.universeId);
                  const isUser = row.universeId === season.userUniverseId;
                  const inRelegationZone = i >= relegateFrom;
                  return (
                    <Fragment key={row.universeId}>
                      {i === relegateFrom ? (
                        <tr>
                          <td colSpan={10} className="py-0">
                            <div
                              className="my-1 border-t-2 border-dashed border-red-400/60"
                              title="Relegation zone"
                            />
                          </td>
                        </tr>
                      ) : null}
                      <tr
                        className={`border-t border-broadcast-border/40 ${
                          isUser ? "bg-broadcast-highlight/10" : ""
                        } ${inRelegationZone ? "text-red-300/80" : ""}`}
                      >
                        <td className="py-1.5 font-mono text-slate-500">{i + 1}</td>
                        <td
                          className="py-1.5 font-display uppercase"
                          style={{ color: uni?.accentColor }}
                        >
                          {uni?.name ?? row.universeId}
                        </td>
                        <td className="py-1.5 text-center font-mono">{row.played}</td>
                        <td className="py-1.5 text-center font-mono">{row.won}</td>
                        <td className="py-1.5 text-center font-mono">{row.drawn}</td>
                        <td className="py-1.5 text-center font-mono">{row.lost}</td>
                        <td className="py-1.5 text-center font-mono">{row.goalsFor}</td>
                        <td className="py-1.5 text-center font-mono">{row.goalsAgainst}</td>
                        <td className="py-1.5 text-center font-mono">
                          {row.goalsFor - row.goalsAgainst}
                        </td>
                        <td className="py-1.5 text-center font-mono font-bold text-broadcast-highlight">
                          {row.points}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="glass-panel flex h-full flex-col p-4">
            <p className="broadcast-label mb-2 shrink-0">Next Fixture</p>
            {nextFixture ? (
              <div className="mb-3 shrink-0 text-sm">
                <p className="font-display font-bold uppercase text-broadcast-highlight">
                  {getUniverse(
                    nextFixture.homeUniverseId === season.userUniverseId
                      ? nextFixture.awayUniverseId
                      : nextFixture.homeUniverseId
                  )?.name ?? "Opponent"}
                </p>
                <p className="text-slate-400">
                  {nextFixture.homeUniverseId === season.userUniverseId ? "Home" : "Away"} ·
                  Matchday {nextFixture.matchday}
                </p>
              </div>
            ) : (
              <p className="mb-3 shrink-0 text-sm text-slate-500">No fixture remaining.</p>
            )}

            <SeasonHubCommentary season={season} className="mb-3 min-h-[6rem] flex-1" />

            {matchdayResults.length > 0 ? (
              <div className="shrink-0 border-t border-broadcast-border/40 pt-3">
                <p className="broadcast-label mb-2">
                  Latest Matchday{lastMatchday > 0 ? ` ${lastMatchday}` : ""}
                </p>
                <ul className="space-y-1 text-[11px]">
                  {matchdayResults.map((f) => {
                    const involvesUser =
                      f.homeUniverseId === season.userUniverseId ||
                      f.awayUniverseId === season.userUniverseId;
                    return (
                      <li
                        key={f.id}
                        className={`flex justify-between gap-2 ${
                          involvesUser ? "font-semibold text-slate-200" : "text-slate-400"
                        }`}
                      >
                        <span className="min-w-0 truncate">
                          {getUniverse(f.homeUniverseId)?.name} vs{" "}
                          {getUniverse(f.awayUniverseId)?.name}
                        </span>
                        <span className="shrink-0 font-mono text-broadcast-highlight">
                          {f.homeScore}–{f.awayScore}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </section>
        </div>

        <section className="glass-panel mb-6 p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {(
              [
                ["scorers", "Top Scorers"],
                ["assists", "Assists"],
                ["yellows", "Yellow Cards"],
                ["reds", "Red Cards"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setStatsTab(id)}
                className={`px-3 py-1 text-[10px] font-display uppercase tracking-wide ${
                  statsTab === id
                    ? "bg-broadcast-highlight text-stadium"
                    : "border border-broadcast-border text-slate-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {statRows.length === 0 ? (
            <p className="text-sm text-slate-500">No stats yet — play your first match.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2">Player</th>
                  <th className="pb-2">Team</th>
                  <th className="pb-2 text-center">
                    {statsTab === "assists"
                      ? "A"
                      : statsTab === "yellows"
                        ? "YC"
                        : statsTab === "reds"
                          ? "RC"
                          : "G"}
                  </th>
                  {statsTab === "scorers" ? <th className="pb-2 text-center">A</th> : null}
                </tr>
              </thead>
              <tbody>
                {statRows.map((row) => (
                  <tr key={row.key} className="border-t border-broadcast-border/40">
                    <td className="py-1.5 font-display uppercase">{row.playerName}</td>
                    <td className="py-1.5 text-slate-400">
                      {getUniverse(row.universeId)?.name ?? row.universeId}
                    </td>
                    <td className="py-1.5 text-center font-mono text-broadcast-highlight">
                      {statsTab === "assists"
                        ? row.assists
                        : statsTab === "yellows"
                          ? row.yellowCards
                          : statsTab === "reds"
                            ? row.redCards
                            : row.goals}
                    </td>
                    {statsTab === "scorers" ? (
                      <td className="py-1.5 text-center font-mono">{row.assists}</td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {season.transferHistory?.length ? (
          <SeasonTransferLog transfers={season.transferHistory} />
        ) : null}

        {seasonHonours.length > 0 ? (
          <section className="glass-panel p-4">
            <p className="broadcast-label mb-3">Season History</p>
            <ul className="space-y-4">
              {seasonHonours.map((h, i) => (
                <li
                  key={`${h.universeId}-${h.seasonNumber}-${h.seasonLength}-${i}`}
                  className="border-t border-broadcast-border/40 pt-3 first:border-t-0 first:pt-0"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm">
                      {h.wonLeague ? (
                        <span className="text-broadcast-highlight">🏆 </span>
                      ) : null}
                      <span className="font-display uppercase">{h.universeName}</span>
                      <span className="text-slate-500">
                        {" "}
                        — {h.seasonLength}-game season {h.seasonNumber}
                      </span>
                    </p>
                    {h.finalPosition != null ? (
                      <span className="font-mono text-xs text-broadcast-highlight">
                        {h.finalPosition === 1 ? "Champions" : `${h.finalPosition}${ordinalSuffix(h.finalPosition)}`}
                      </span>
                    ) : null}
                  </div>
                  {h.points != null ? (
                    <p className="mt-1 font-mono text-xs text-slate-400">
                      {h.won}W {h.drawn}D {h.lost}L · {h.points} pts · {h.goalsFor}–{h.goalsAgainst}
                    </p>
                  ) : null}
                  {h.topScorers && h.topScorers.length > 0 ? (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Top scorers:{" "}
                      {h.topScorers
                        .slice(0, 3)
                        .map((s) => `${s.playerName} (${s.goals})`)
                        .join(", ")}
                    </p>
                  ) : null}
                  {!h.wonLeague && h.championName ? (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Champions: {h.championName}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
      {season.status === "active" ? (
        <SeasonTransferModal
          open={transferOpen}
          onClose={() => setTransferOpen(false)}
          season={season}
        />
      ) : null}
    </>
  );
}
