"use client";

import { getUniverse } from "@/lib/squads";
import { formatNewlyUnlockedMessage } from "@/lib/squad-unlocks";

interface SquadUnlockBannerProps {
  squadIds: string[];
}

export function SquadUnlockBanner({ squadIds }: SquadUnlockBannerProps) {
  if (!squadIds.length) return null;

  return (
    <div className="mx-auto mt-4 max-w-md border border-emerald-500/50 bg-emerald-500/10 px-4 py-4 text-left animate-slide-in">
      <p className="broadcast-label mb-1 text-emerald-400">Squad Unlocked</p>
      <ul className="space-y-2">
        {squadIds.map((id) => {
          const uni = getUniverse(id);
          return (
            <li key={id} className="flex items-center gap-3">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: uni?.accentColor ?? "#22c55e" }}
              />
              <span className="font-display text-sm font-bold uppercase text-slate-100">
                {uni?.name ?? id}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-slate-400">{formatNewlyUnlockedMessage(squadIds)}</p>
    </div>
  );
}
