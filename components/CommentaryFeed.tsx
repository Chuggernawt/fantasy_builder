"use client";

import { useEffect, useRef } from "react";
import type { CommentaryEvent } from "@/lib/types";

const TYPE_COLORS: Record<CommentaryEvent["type"], string> = {
  goal: "text-broadcast-highlight font-bold",
  save: "text-cyan-300",
  chance: "text-slate-200",
  miss: "text-slate-400",
  tackle: "text-orange-300",
  foul: "text-red-400",
  freekick: "text-yellow-200",
  turnover: "text-slate-400",
  corner: "text-yellow-300",
  cross: "text-sky-300",
  clearance: "text-orange-200",
  pressure: "text-amber-200",
  header: "text-violet-300",
  offside: "text-rose-300",
  yellowcard: "text-yellow-400 font-semibold",
  redcard: "text-red-500 font-bold",
  penalty: "text-yellow-300 font-semibold",
  longball: "text-slate-300",
  stamina: "text-amber-500",
  special: "text-fuchsia-300",
  substitution: "text-emerald-300",
  halftime: "text-broadcast-highlight font-bold",
  fulltime: "text-broadcast-highlight font-bold",
  stoppage: "text-amber-300 font-semibold",
  injury: "text-red-300 font-semibold",
  info: "text-slate-300",
};

/** ~14 lines visible at text-sm + leading-relaxed */

interface CommentaryFeedProps {
  events: CommentaryEvent[];
  showAll?: boolean;
  live?: boolean;
  tall?: boolean;
  className?: string;
}

export function CommentaryFeed({
  events,
  showAll = false,
  live = false,
  tall = false,
  className = "",
}: CommentaryFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const visible = showAll ? events : live ? events : events.slice(-30);

  useEffect(() => {
    if (!live || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [events.length, live]);

  const shellClass = live
    ? "h-[21.5rem] shrink-0"
    : tall
      ? "h-96 md:h-[28rem]"
      : "h-48 md:h-64";

  return (
    <div className={`glass-panel flex flex-col overflow-hidden ${shellClass} ${className}`}>
      <div className="shrink-0 border-b border-broadcast-border px-3 py-2">
        <p className="broadcast-label">Live Commentary</p>
      </div>
      <div
        ref={scrollRef}
        className="commentary-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-2"
      >
        {visible.length === 0 ? (
          <p className="text-sm text-slate-500">Waiting for kick-off...</p>
        ) : (
          visible.map((e) => (
            <p
              key={e.id}
              className={`mb-2 text-sm leading-relaxed md:text-base ${TYPE_COLORS[e.type]}`}
            >
              <span className="mr-2 font-mono text-xs text-slate-500">{e.minute}&apos;</span>
              {e.text}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
