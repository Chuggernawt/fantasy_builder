"use client";

import Link from "next/link";
import { AccountBar } from "@/components/AccountBar";

interface BroadcastHeaderProps {
  title?: string;
  backHref?: string;
  backLabel?: string;
  accent?: string;
}

export function BroadcastHeader({
  title = "Fantasy Build",
  backHref,
  backLabel = "Back",
  accent,
}: BroadcastHeaderProps) {
  return (
    <header
      className="glass-panel border-b-2 px-4 py-3 md:px-6"
      style={accent ? { borderBottomColor: accent } : undefined}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="broadcast-label">Live Simulator</p>
          <h1 className="truncate font-display text-xl font-bold uppercase tracking-wider md:text-2xl">
            {title}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AccountBar />
          {backHref ? (
            <Link href={backHref} className="btn-broadcast text-xs md:text-sm">
              {backLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
