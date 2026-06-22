"use client";

import { useMemo } from "react";
import {
  buildModeStatsSummary,
  formatBiggestLoss,
  formatBiggestWin,
  formatTopAssists,
  formatTopScorer,
  formatUniverseStat,
  formatWinLoss,
  type CareerStatsMode,
  type PlayerCareerStats,
} from "@/lib/career-stats";
import {
  countUnlockedLockableSquads,
  TOTAL_LOCKABLE_SQUADS,
} from "@/lib/squad-unlocks";

interface PlayerCareerStatsPanelProps {
  stats: PlayerCareerStats;
  username?: string | null;
  hideTitle?: boolean;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border border-broadcast-border/40 px-2 py-1.5 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="truncate text-right font-display text-broadcast-highlight">{value}</span>
    </div>
  );
}

function ModeSection({
  title,
  stats,
  mode,
  tournamentWins,
  seasonWins,
}: {
  title: string;
  stats: PlayerCareerStats;
  mode: CareerStatsMode;
  tournamentWins?: number;
  seasonWins?: number;
}) {
  const summary = useMemo(() => buildModeStatsSummary(stats[mode]), [stats, mode]);
  const bucket = stats[mode];

  return (
    <div>
      <p className="broadcast-label mb-2">{title}</p>
      <div className="grid gap-1 sm:grid-cols-2">
        {tournamentWins != null ? (
          <StatRow label="Tournament wins" value={String(tournamentWins)} />
        ) : null}
        {seasonWins != null ? <StatRow label="Season wins" value={String(seasonWins)} /> : null}
        <StatRow label="Total wins / losses" value={formatWinLoss(bucket)} />
        <StatRow label="Biggest win" value={formatBiggestWin(bucket.biggestWin)} />
        <StatRow label="Biggest loss" value={formatBiggestLoss(bucket.biggestLoss)} />
        <StatRow
          label="Most picked universe"
          value={formatUniverseStat(stats, mode, summary.mostPickedUniverseId, "played")}
        />
        <StatRow
          label="Most wins universe"
          value={formatUniverseStat(stats, mode, summary.mostWinsUniverseId, "wins")}
        />
        <StatRow
          label="Most losses universe"
          value={formatUniverseStat(stats, mode, summary.mostLossesUniverseId, "losses")}
        />
        <StatRow
          label="Most draws universe"
          value={formatUniverseStat(stats, mode, summary.mostDrawsUniverseId, "draws")}
        />
        <StatRow label="Top scorer" value={formatTopScorer(summary)} />
        <StatRow label="Top assists" value={formatTopAssists(summary)} />
      </div>
    </div>
  );
}

export function PlayerCareerStatsPanel({
  stats,
  username,
  hideTitle = false,
}: PlayerCareerStatsPanelProps) {
  const unlockedCount = countUnlockedLockableSquads(stats.unlockedSquads ?? []);

  return (
    <div className="space-y-4">
      {!hideTitle ? (
        <p className="broadcast-label">
          {username ? `${username}'s stats` : "Player stats"}
        </p>
      ) : null}
      <StatRow
        label="Squads unlocked"
        value={`${unlockedCount}/${TOTAL_LOCKABLE_SQUADS}`}
      />
      <ModeSection
        title="Online"
        stats={stats}
        mode="online"
        tournamentWins={stats.onlineTournamentWins}
      />
      <ModeSection
        title="Offline"
        stats={stats}
        mode="offline"
        tournamentWins={stats.offlineTournamentWins}
        seasonWins={stats.offlineSeasonWins}
      />
    </div>
  );
}
