"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BroadcastHeader } from "@/components/BroadcastHeader";
import { CommentaryFeed } from "@/components/CommentaryFeed";
import { RevealShowcase } from "@/components/RevealShowcase";
import { SeasonFinale } from "@/components/SeasonFinale";
import { buildMatchSummary } from "@/lib/match-stats";
import { buildMatchReport } from "@/lib/match-report";
import { playersWithMatchContributions } from "@/lib/player-match-stats";
import { useGameStore } from "@/store/game-store";
import { getMultiplayerSession } from "@/lib/multiplayer-session";
import { myMatchSide } from "@/lib/multiplayer-perspective";
import { useMultiplayerSync } from "@/hooks/useMultiplayerSync";
import { useMultiplayerHostLoop } from "@/hooks/useMultiplayerHostLoop";
import { signalMultiplayerRematch } from "@/lib/multiplayer-client";

type PostMatchTab = "report" | "commentary" | "ratings";

function revealPickClass(selected: boolean): string {
  return selected
    ? "border-2 border-broadcast-highlight bg-broadcast-highlight/35 ring-4 ring-broadcast-highlight/60 shadow-[0_0_20px_rgba(234,179,8,0.65)] scale-[1.04] font-bold text-broadcast-highlight"
    : "border border-broadcast-border hover:border-broadcast-highlight/70";
}

export function PostMatchSummary() {
  const router = useRouter();
  const mpSession = getMultiplayerSession();
  const mySide = myMatchSide() ?? "home";
  const { isHost: isMpHost, pushSnapshot } = useMultiplayerSync({
    enabled: !!mpSession,
  });
  useMultiplayerHostLoop({
    roomId: mpSession?.roomId ?? null,
    enabled: !!mpSession && isMpHost,
    pushSnapshot,
    onRematchReset: () => {
      if (mpSession) router.replace(`/multiplayer/room?id=${mpSession.roomId}`);
    },
  });

  const matchState = useGameStore((s) => s.matchState);
  const mpMatchMeta = useGameStore((s) => s.mpMatchMeta);
  const resetMatch = useGameStore((s) => s.resetMatch);
  const startMatch = useGameStore((s) => s.startMatch);
  const pendingReveal = useGameStore((s) => s.pendingReveal);
  const revealHighlights = useGameStore((s) => s.revealHighlights);
  const chooseDrawReveal = useGameStore((s) => s.chooseDrawReveal);
  const chooseWinReveal = useGameStore((s) => s.chooseWinReveal);
  const clearPendingReveal = useGameStore((s) => s.clearPendingReveal);
  const saveLineup = useGameStore((s) => s.saveLineup);
  const season = useGameStore((s) => s.season);
  const offlineTournament = useGameStore((s) => s.tournament);
  const seasonFinished = season?.status === "finished" && !!matchState?.seasonMeta;
  const seasonActive = !!matchState?.seasonMeta && season?.status === "active";
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<PostMatchTab>("report");
  const [winOwnPick, setWinOwnPick] = useState<string | null>(null);
  const [winAwayPick, setWinAwayPick] = useState<string | null>(null);
  const [drawPick, setDrawPick] = useState<string | null>(null);
  const [rematchPending, setRematchPending] = useState(false);

  const isTournamentMp = !!mpMatchMeta?.tournamentFixture;
  const myRematchReady =
    mySide === "home" ? mpMatchMeta?.rematch.host : mpMatchMeta?.rematch.away;
  const opponentRematchReady =
    mySide === "home" ? mpMatchMeta?.rematch.away : mpMatchMeta?.rematch.host;

  const summary = useMemo(
    () => (matchState?.status === "finished" ? buildMatchSummary(matchState) : null),
    [matchState]
  );

  const report = useMemo(
    () => (matchState && summary ? buildMatchReport(matchState, summary) : null),
    [matchState, summary]
  );

  if (!matchState || matchState.status !== "finished") {
    return (
      <>
        <BroadcastHeader title="Post Match" backHref="/draft" />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-slate-400">No completed match.</p>
          <Link href="/draft" className="btn-broadcast-solid mt-6 inline-block">
            Set up a match
          </Link>
        </main>
      </>
    );
  }

  if (!summary || !report) return null;

  const homeWin = summary.score.home > summary.score.away;
  const awayWin = summary.score.away > summary.score.home;

  return (
    <>
      <BroadcastHeader
        title={seasonFinished ? "Season Complete" : "Full Time"}
        backHref="/"
        backLabel="Home"
      />

      <main className="mx-auto max-w-3xl px-4 py-6">
        {(pendingReveal || revealHighlights) ? (
          <div className="glass-panel mb-6 border border-broadcast-highlight/60 p-4 animate-slide-in">
            <p className="broadcast-label mb-2">Stat Reveal</p>
            {pendingReveal ? (
              <p className="mb-3 text-sm text-slate-300">{pendingReveal.message}</p>
            ) : null}
            {pendingReveal?.result === "draw" ? (
              <>
                <p className="mb-2 text-xs text-slate-400">Pick one used player to fully reveal:</p>
                <div className="flex flex-wrap gap-2">
                  {pendingReveal.ownChoices.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className={`btn-broadcast px-3 py-2 text-xs transition ${revealPickClass(drawPick === name)}`}
                      onClick={() => setDrawPick(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn-broadcast-solid mt-3 text-xs"
                  disabled={!drawPick}
                  onClick={() => {
                    if (!drawPick) return;
                    chooseDrawReveal(drawPick);
                    setDrawPick(null);
                  }}
                >
                  Confirm Reveal
                </button>
              </>
            ) : pendingReveal?.result === "win" ? (
              <>
                <p className="mb-2 text-xs text-slate-400">
                  Pick one of yours and one opponent to fully reveal:
                </p>
                <div className="mb-2 flex flex-wrap gap-2">
                  {pendingReveal.ownChoices.map((name) => (
                    <button
                      key={`own-${name}`}
                      type="button"
                      className={`btn-broadcast px-3 py-2 text-xs transition ${revealPickClass(winOwnPick === name)}`}
                      onClick={() => setWinOwnPick(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <div className="mb-3 flex flex-wrap gap-2">
                  {pendingReveal.awayChoices.map((name) => (
                    <button
                      key={`away-${name}`}
                      type="button"
                      className={`btn-broadcast px-3 py-2 text-xs transition ${revealPickClass(winAwayPick === name)}`}
                      onClick={() => setWinAwayPick(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn-broadcast-solid text-xs"
                  disabled={!winOwnPick || !winAwayPick}
                  onClick={() => {
                    if (!winOwnPick || !winAwayPick) return;
                    chooseWinReveal(winOwnPick, winAwayPick);
                    setWinOwnPick(null);
                    setWinAwayPick(null);
                  }}
                >
                  Confirm Reveals
                </button>
              </>
            ) : null}
            {revealHighlights ? (
              <RevealShowcase highlights={revealHighlights} accent={summary.homeAccent} />
            ) : null}
            {revealHighlights && (pendingReveal?.result === "loss" || !pendingReveal) ? (
              <button
                type="button"
                className="btn-broadcast mt-4 text-xs"
                onClick={clearPendingReveal}
              >
                Continue
              </button>
            ) : null}
          </div>
        ) : null}

        {seasonFinished && season ? <SeasonFinale season={season} /> : null}

        <div className="glass-panel mb-6 p-6 text-center">
          <p className="broadcast-label mb-2">Final Score</p>
          <div className="flex items-center justify-center gap-4 md:gap-8">
            <div className="flex-1">
              <p className="font-display text-sm uppercase" style={{ color: summary.homeAccent }}>
                {summary.homeName}
              </p>
              {homeWin && <p className="text-xs text-broadcast-highlight">WINNER</p>}
            </div>
            <p className="font-display text-5xl font-bold tracking-widest md:text-6xl">
              {summary.score.home}
              <span className="mx-2 text-broadcast-highlight">-</span>
              {summary.score.away}
            </p>
            <div className="flex-1">
              <p className="font-display text-sm uppercase" style={{ color: summary.awayAccent }}>
                {summary.awayName}
              </p>
              {awayWin && <p className="text-xs text-broadcast-highlight">WINNER</p>}
            </div>
          </div>
        </div>

        {summary.manOfTheMatch ? (
          <div className="glass-panel mb-6 border border-broadcast-highlight/50 bg-broadcast-highlight/5 p-5 text-center">
            <p className="broadcast-label mb-1 text-broadcast-highlight">Man of the Match</p>
            <p className="font-display text-2xl font-bold uppercase tracking-wide text-slate-100">
              {summary.manOfTheMatch.playerName}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {summary.manOfTheMatch.team === "home" ? summary.homeName : summary.awayName}
              {" · "}
              <span className="font-mono text-broadcast-highlight">
                {summary.manOfTheMatch.rating.toFixed(1)}
              </span>{" "}
              rating
            </p>
          </div>
        ) : null}

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <GoalList title={summary.homeName} accent={summary.homeAccent} goals={summary.homeGoals} />
          <GoalList title={summary.awayName} accent={summary.awayAccent} goals={summary.awayGoals} />
        </div>

        <PlayerStatsTable
          homeName={summary.homeName}
          awayName={summary.awayName}
          homeAccent={summary.homeAccent}
          awayAccent={summary.awayAccent}
          homeStats={summary.homePlayerStats}
          awayStats={summary.awayPlayerStats}
          manOfTheMatch={summary.manOfTheMatch?.playerName}
        />

        <div className="glass-panel mb-6 grid grid-cols-2 gap-3 p-4 text-center md:grid-cols-4">
          <StatBox label={`${summary.homeName} Poss %`} value={summary.homePossessionPct} suffix="%" />
          <StatBox label={`${summary.awayName} Poss %`} value={summary.awayPossessionPct} suffix="%" />
          <StatBox label="Home Shots" value={summary.homeShots} />
          <StatBox label="Away Shots" value={summary.awayShots} />
          <StatBox label="Home On Target" value={summary.homeShotsOnTarget} />
          <StatBox label="Away On Target" value={summary.awayShotsOnTarget} />
          <StatBox label="Home Chances" value={summary.homeChances} />
          <StatBox label="Away Chances" value={summary.awayChances} />
          <StatBox label="Home Saves" value={summary.homeSaves} />
          <StatBox label="Away Saves" value={summary.awaySaves} />
          <StatBox label="Home Fouls" value={summary.homeFouls} />
          <StatBox label="Away Fouls" value={summary.awayFouls} />
        </div>

        <div className="mb-4 flex gap-2">
          <TabButton active={tab === "report"} onClick={() => setTab("report")}>
            Match Report
          </TabButton>
          <TabButton active={tab === "ratings"} onClick={() => setTab("ratings")}>
            Player Ratings
          </TabButton>
          <TabButton active={tab === "commentary"} onClick={() => setTab("commentary")}>
            Commentary
          </TabButton>
        </div>

        {tab === "report" ? (
          <div className="glass-panel mb-6 p-5">
            <p className="broadcast-label mb-2">Match Report</p>
            <h2 className="font-display text-lg font-bold leading-snug text-broadcast-highlight md:text-xl">
              {report.headline}
            </h2>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-300">
              {report.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            {report.highlights.length > 0 && (
              <div className="mt-5 border-t border-broadcast-border pt-4">
                <p className="broadcast-label mb-2">Key Moments</p>
                <ul className="space-y-1.5 text-xs text-slate-400">
                  {report.highlights.map((h, i) => (
                    <li key={i} className="leading-relaxed">
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : tab === "ratings" ? (
          <div className="mb-6">
            <DetailedRatingsTable
              homeName={summary.homeName}
              awayName={summary.awayName}
              homeAccent={summary.homeAccent}
              awayAccent={summary.awayAccent}
              homeStats={summary.homePlayerStats}
              awayStats={summary.awayPlayerStats}
              manOfTheMatch={summary.manOfTheMatch?.playerName}
            />
          </div>
        ) : (
          <div className="mb-6">
            <CommentaryFeed events={summary.commentary} showAll tall />
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {mpSession ? (
            <>
              {!isTournamentMp ? (
                <>
                  <button
                    type="button"
                    className="btn-broadcast-solid"
                    disabled={rematchPending || !!myRematchReady}
                    onClick={async () => {
                      if (!mpSession.roomId) return;
                      setRematchPending(true);
                      try {
                        await signalMultiplayerRematch(mpSession.roomId, mySide, isMpHost);
                        if (isMpHost) await pushSnapshot();
                      } finally {
                        setRematchPending(false);
                      }
                    }}
                  >
                    {myRematchReady ? "Waiting for opponent…" : "Rematch"}
                  </button>
                  {opponentRematchReady && !myRematchReady ? (
                    <span className="self-center text-xs text-broadcast-highlight">
                      Opponent wants a rematch
                    </span>
                  ) : null}
                </>
              ) : null}
              <button
                type="button"
                className="btn-broadcast-solid"
                onClick={() => {
                  router.push(`/multiplayer/room?id=${mpSession.roomId}`);
                }}
              >
                {isTournamentMp ? "Back to tournament" : "Return to room"}
              </button>
            </>
          ) : offlineTournament && offlineTournament.phase !== "finished" ? (
            <button
              type="button"
              className="btn-broadcast-solid"
              onClick={() => {
                resetMatch();
                router.push("/tournament");
              }}
            >
              Back to tournament
            </button>
          ) : seasonActive ? (
            <button
              type="button"
              className="btn-broadcast-solid"
              onClick={() => {
                resetMatch();
                router.push("/season");
              }}
            >
              Back to Season
            </button>
          ) : seasonFinished ? (
            <button
              type="button"
              className="btn-broadcast-solid"
              onClick={() => {
                resetMatch();
                router.push("/season");
              }}
            >
              View Season Summary
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn-broadcast-solid"
                onClick={() => {
                  startMatch();
                  router.push("/match");
                }}
              >
                Rematch
              </button>
              <button
                type="button"
                className="btn-broadcast"
                onClick={() => {
                  resetMatch();
                  router.push("/draft");
                }}
              >
                New Draft
              </button>
            </>
          )}
          <button
            type="button"
            className="btn-broadcast"
            onClick={() => {
              saveLineup();
              setSaveNotice("Lineup saved for this universe.");
            }}
          >
            Save Lineup
          </button>
          {saveNotice ? (
            <span className="self-center text-xs text-broadcast-highlight">{saveNotice}</span>
          ) : null}
        </div>
      </main>
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-4 py-2 text-xs font-display uppercase tracking-wider transition ${
        active
          ? "border-broadcast-highlight bg-broadcast-highlight/10 text-broadcast-highlight"
          : "border-broadcast-border text-slate-400 hover:border-slate-500"
      }`}
    >
      {children}
    </button>
  );
}

function GoalList({
  title,
  accent,
  goals,
}: {
  title: string;
  accent: string;
  goals: { scorer: string; assist: string | null; minute: number }[];
}) {
  return (
    <div className="glass-panel p-4" style={{ borderTopWidth: 3, borderTopColor: accent }}>
      <p className="broadcast-label mb-2" style={{ color: accent }}>
        {title} Goals
      </p>
      {goals.length === 0 ? (
        <p className="text-sm text-slate-500">No goals</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {goals.map((g, i) => (
            <li key={`${g.scorer}-${i}`}>
              <span className="font-mono text-broadcast-highlight">{g.minute}&apos;</span>{" "}
              {g.scorer}
              {g.assist ? (
                <span className="text-slate-400"> (assist: {g.assist})</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatBox({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-bold text-broadcast-highlight">
        {value}
        {suffix}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}

function PlayerStatsTable({
  homeName,
  awayName,
  homeAccent,
  awayAccent,
  homeStats,
  awayStats,
  manOfTheMatch,
}: {
  homeName: string;
  awayName: string;
  homeAccent: string;
  awayAccent: string;
  homeStats: import("@/lib/types").MatchSummary["homePlayerStats"];
  awayStats: import("@/lib/types").MatchSummary["awayPlayerStats"];
  manOfTheMatch?: string;
}) {
  const homePlayers = playersWithMatchContributions(homeStats);
  const awayPlayers = playersWithMatchContributions(awayStats);
  if (!homePlayers.length && !awayPlayers.length) return null;

  return (
    <div className="glass-panel mb-6 grid gap-4 p-4 md:grid-cols-2">
      <TeamQuickStats
        teamName={homeName}
        accent={homeAccent}
        players={homePlayers}
        motm={manOfTheMatch}
      />
      <TeamQuickStats
        teamName={awayName}
        accent={awayAccent}
        players={awayPlayers}
        motm={manOfTheMatch}
      />
    </div>
  );
}

function TeamQuickStats({
  teamName,
  accent,
  players,
  motm,
}: {
  teamName: string;
  accent: string;
  players: { name: string; stats: import("@/lib/types").PlayerMatchStats }[];
  motm?: string;
}) {
  return (
    <div>
      <p className="broadcast-label mb-2" style={{ color: accent }}>
        {teamName} — Top performers
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="pb-1">Player</th>
            <th className="pb-1 text-center">Rtg</th>
            <th className="pb-1 text-center">G</th>
            <th className="pb-1 text-center">A</th>
          </tr>
        </thead>
        <tbody>
          {players.slice(0, 6).map((p) => (
            <tr
              key={p.name}
              className={`border-t border-broadcast-border/50 ${
                motm === p.name ? "bg-broadcast-highlight/10" : ""
              }`}
            >
              <td className="py-1 font-display uppercase">
                {p.name}
                {motm === p.name ? (
                  <span className="ml-1 text-[9px] text-broadcast-highlight">MOTM</span>
                ) : null}
              </td>
              <td className="py-1 text-center font-mono text-broadcast-highlight">
                {p.stats.matchRating?.toFixed(1) ?? "—"}
              </td>
              <td className="py-1 text-center font-mono">{p.stats.goals || "—"}</td>
              <td className="py-1 text-center font-mono">{p.stats.assists || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailedRatingsTable({
  homeName,
  awayName,
  homeAccent,
  awayAccent,
  homeStats,
  awayStats,
  manOfTheMatch,
}: {
  homeName: string;
  awayName: string;
  homeAccent: string;
  awayAccent: string;
  homeStats: import("@/lib/types").MatchSummary["homePlayerStats"];
  awayStats: import("@/lib/types").MatchSummary["awayPlayerStats"];
  manOfTheMatch?: string;
}) {
  const homePlayers = playersWithMatchContributions(homeStats);
  const awayPlayers = playersWithMatchContributions(awayStats);

  return (
    <div className="glass-panel grid gap-6 p-4 md:grid-cols-2">
      <TeamDetailedStats
        teamName={homeName}
        accent={homeAccent}
        players={homePlayers}
        motm={manOfTheMatch}
      />
      <TeamDetailedStats
        teamName={awayName}
        accent={awayAccent}
        players={awayPlayers}
        motm={manOfTheMatch}
      />
    </div>
  );
}

function TeamDetailedStats({
  teamName,
  accent,
  players,
  motm,
}: {
  teamName: string;
  accent: string;
  players: { name: string; stats: import("@/lib/types").PlayerMatchStats }[];
  motm?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <p className="broadcast-label mb-2" style={{ color: accent }}>
        {teamName}
      </p>
      <table className="w-full min-w-[280px] text-[10px] sm:text-xs">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="pb-1 pr-1">Player</th>
            <th className="pb-1 text-center">Rtg</th>
            <th className="pb-1 text-center">Pass</th>
            <th className="pb-1 text-center">Sh</th>
            <th className="pb-1 text-center">Drb</th>
            <th className="pb-1 text-center">Tkl</th>
            <th className="pb-1 text-center">G</th>
            <th className="pb-1 text-center">A</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const s = p.stats;
            const passPct =
              s.passes > 0 ? Math.round((s.passesCompleted / s.passes) * 100) : null;
            return (
              <tr
                key={p.name}
                className={`border-t border-broadcast-border/50 ${
                  motm === p.name ? "bg-broadcast-highlight/10" : ""
                }`}
              >
                <td className="py-1 pr-1 font-display uppercase">
                  {p.name}
                  {motm === p.name ? (
                    <span className="ml-0.5 text-[8px] text-broadcast-highlight">★</span>
                  ) : null}
                </td>
                <td className="py-1 text-center font-mono font-bold text-broadcast-highlight">
                  {s.matchRating?.toFixed(1) ?? "—"}
                </td>
                <td className="py-1 text-center font-mono">
                  {s.passes > 0 ? `${s.passesCompleted}/${s.passes}` : "—"}
                  {passPct != null ? (
                    <span className="block text-[9px] text-slate-500">{passPct}%</span>
                  ) : null}
                </td>
                <td className="py-1 text-center font-mono">
                  {s.shots > 0 ? `${s.shotsOnTarget}/${s.shots}` : "—"}
                </td>
                <td className="py-1 text-center font-mono">
                  {s.dribbles > 0 ? `${s.dribblesCompleted}/${s.dribbles}` : "—"}
                </td>
                <td className="py-1 text-center font-mono">
                  {s.tackles > 0 ? `${s.tacklesCompleted}/${s.tackles}` : "—"}
                  {s.clearances > 0 ? (
                    <span className="block text-[9px] text-slate-500">clr {s.clearances}</span>
                  ) : null}
                  {s.saves > 0 ? (
                    <span className="block text-[9px] text-slate-500">sv {s.saves}</span>
                  ) : null}
                </td>
                <td className="py-1 text-center font-mono">{s.goals || "—"}</td>
                <td className="py-1 text-center font-mono">{s.assists || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
