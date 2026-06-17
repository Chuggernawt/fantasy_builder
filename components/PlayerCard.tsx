import type { Player } from "@/lib/types";
import { StatBars } from "./StatBars";
import { useGameStore } from "@/store/game-store";

interface PlayerCardProps {
  player: Player;
  accent?: string;
  selected?: boolean;
  onClick?: () => void;
  roleBadge?: string;
  disabled?: boolean;
}

export function PlayerCard({
  player,
  accent = "#eab308",
  selected,
  onClick,
  roleBadge,
  disabled,
}: PlayerCardProps) {
  const isPlayerFullyRevealed = useGameStore((s) => s.isPlayerFullyRevealed);
  const fullyRevealed = isPlayerFullyRevealed(player.name);
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`glass-panel w-full p-3 text-left transition animate-slide-in ${
        onClick && !disabled ? "cursor-pointer hover:border-broadcast-highlight" : ""
      } ${selected ? "ring-1" : ""} ${disabled ? "opacity-40" : ""}`}
      style={
        selected
          ? { borderColor: accent, boxShadow: `0 0 0 1px ${accent}` }
          : undefined
      }
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          {roleBadge && (
            <span
              className="mb-1 inline-block px-1.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: accent, color: "#0a0a0a" }}
            >
              {roleBadge}
            </span>
          )}
          <h3 className="font-display text-sm font-semibold uppercase leading-tight tracking-wide md:text-base">
            {player.name}
          </h3>
        </div>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center font-display text-lg font-bold"
          style={{ backgroundColor: accent, color: "#0a0a0a" }}
        >
          {fullyRevealed ? player.ovr : "??"}
        </div>
      </div>
      <StatBars playerName={player.name} stats={player.stats} compact />
    </Tag>
  );
}
