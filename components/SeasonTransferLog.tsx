"use client";

import { getUniverse } from "@/lib/squads";
import { SEASON_TRANSFER_LOG_LIMIT } from "@/lib/season-saves";
import type { SeasonTransferRecord } from "@/lib/season-types";

interface SeasonTransferLogProps {
  transfers: SeasonTransferRecord[] | undefined;
}

export function SeasonTransferLog({ transfers }: SeasonTransferLogProps) {
  const rows = (transfers ?? []).slice(-SEASON_TRANSFER_LOG_LIMIT).reverse();
  if (!rows.length) return null;

  return (
    <div className="glass-panel mb-6 p-4 text-left">
      <p className="broadcast-label mb-3">Recent Transfers</p>
      <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
        {rows.map((t) => {
          const partner = getUniverse(t.partnerTeamId);
          const outUni = getUniverse(t.out.universeId);
          const inUni = getUniverse(t.in.universeId);
          return (
            <li
              key={`${t.completedAt}-${t.out.playerName}-${t.in.playerName}`}
              className="rounded border border-broadcast-border/50 bg-black/20 px-3 py-2"
            >
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                MD {t.matchday} · vs {partner?.name ?? t.partnerTeamId}
              </p>
              <p className="mt-1 text-slate-300">
                <span className="font-display uppercase text-red-400/90">{t.out.playerName}</span>
                <span className="text-slate-500"> ({outUni?.name ?? t.out.universeId})</span>
                <span className="mx-2 text-slate-500">↔</span>
                <span className="font-display uppercase text-emerald-400/90">{t.in.playerName}</span>
                <span className="text-slate-500"> ({inUni?.name ?? t.in.universeId})</span>
              </p>
            </li>
          );
        })}
      </ul>
      {(transfers?.length ?? 0) >= SEASON_TRANSFER_LOG_LIMIT ? (
        <p className="mt-2 text-[10px] text-slate-500">
          Showing latest {SEASON_TRANSFER_LOG_LIMIT} transfers
        </p>
      ) : null}
    </div>
  );
}
