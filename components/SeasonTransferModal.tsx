"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getUniverse } from "@/lib/squads";
import {
  evaluateSeasonSwap,
  getTransferHubStatus,
  isTransferWindowOpen,
  MAX_SWAPS_PER_WINDOW,
  transferWindowLabel,
  transfersRemainingThisWindow,
} from "@/lib/season-transfers";
import {
  getSeasonTeamRoster,
  rosterEntriesToPlayers,
  rosterEntryKey,
  type RosterPlayerView,
} from "@/lib/season-rosters";
import type { SeasonRosterEntry, SeasonState } from "@/lib/season-types";
import { useGameStore } from "@/store/game-store";

type RevealFilter = "all" | "revealed" | "hidden";
type MarketTab = "your_squad" | "league";

interface SeasonTransferModalProps {
  open: boolean;
  onClose: () => void;
  season: SeasonState;
}

function PlayerRow({
  entry,
  player,
  selected,
  onSelect,
  disabled,
  subtitle,
}: {
  entry: SeasonRosterEntry;
  player: RosterPlayerView;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  subtitle?: string;
}) {
  const isPlayerFullyRevealed = useGameStore((s) => s.isPlayerFullyRevealed);
  const revealed = isPlayerFullyRevealed(player.name);
  const origin = getUniverse(entry.universeId);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`w-full border px-2 py-2 text-left text-xs transition ${
        selected
          ? "border-broadcast-highlight bg-broadcast-highlight/15"
          : "border-broadcast-border/50 hover:border-broadcast-highlight/60"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display font-semibold uppercase text-slate-100">
            {player.name}
          </p>
          <p className="truncate text-[10px] text-slate-500">
            {subtitle ?? origin?.name ?? entry.universeId}
            {revealed ? "" : " · Hidden stats"}
          </p>
        </div>
        <span className="shrink-0 font-mono text-broadcast-highlight">
          {revealed ? player.ovr : "??"}
        </span>
      </div>
    </button>
  );
}

export function SeasonTransferModal({ open, onClose, season: seasonProp }: SeasonTransferModalProps) {
  const season = useGameStore((s) => s.season) ?? seasonProp;
  const executeSeasonTransfer = useGameStore((s) => s.executeSeasonTransfer);
  const isPlayerFullyRevealed = useGameStore((s) => s.isPlayerFullyRevealed);

  const [tab, setTab] = useState<MarketTab>("league");
  const [query, setQuery] = useState("");
  const [universeFilter, setUniverseFilter] = useState<string>("all");
  const [revealFilter, setRevealFilter] = useState<RevealFilter>("all");
  const [partnerTeamId, setPartnerTeamId] = useState<string>("");
  const [outgoing, setOutgoing] = useState<SeasonRosterEntry | null>(null);
  const [incoming, setIncoming] = useState<SeasonRosterEntry | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const windowOpen = isTransferWindowOpen(season);
  const hubStatus = getTransferHubStatus(season);
  const remaining = transfersRemainingThisWindow(season);
  const previewMode = !windowOpen;

  const leagueTeams = useMemo(() => {
    const ids = season.leagueUniverseIds ?? Object.keys(season.rosters ?? {});
    return ids.filter((id) => id !== season.userUniverseId);
  }, [season]);

  const userRoster = useMemo(
    () => getSeasonTeamRoster(season, season.userUniverseId),
    [season]
  );

  const partnerRoster = useMemo(
    () => (partnerTeamId ? getSeasonTeamRoster(season, partnerTeamId) : []),
    [season, partnerTeamId]
  );

  const evaluation = useMemo(() => {
    if (!outgoing || !incoming || !partnerTeamId) return null;
    return evaluateSeasonSwap(season, partnerTeamId, outgoing, incoming);
  }, [season, partnerTeamId, outgoing, incoming]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setUniverseFilter("all");
      setRevealFilter("all");
      setPartnerTeamId("");
      setOutgoing(null);
      setIncoming(null);
      setStatus(null);
      setTab("league");
    }
  }, [open]);

  function matchesFilters(entry: SeasonRosterEntry, player: RosterPlayerView): boolean {
    if (universeFilter !== "all" && entry.universeId !== universeFilter) return false;
    const revealed = isPlayerFullyRevealed(player.name);
    if (revealFilter === "revealed" && !revealed) return false;
    if (revealFilter === "hidden" && revealed) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const uniName = getUniverse(entry.universeId)?.name.toLowerCase() ?? "";
      if (!player.name.toLowerCase().includes(q) && !uniName.includes(q)) return false;
    }
    return true;
  }

  const filteredUser = useMemo(() => {
    return rosterEntriesToPlayers(userRoster).filter((p) => {
      const entry = userRoster.find((e) => e.playerName === p.name)!;
      return matchesFilters(entry, p);
    });
  }, [userRoster, universeFilter, revealFilter, query, isPlayerFullyRevealed]);

  const filteredPartner = useMemo(() => {
    return rosterEntriesToPlayers(partnerRoster).filter((p) => {
      const entry = partnerRoster.find((e) => e.playerName === p.name)!;
      return matchesFilters(entry, p);
    });
  }, [partnerRoster, universeFilter, revealFilter, query, isPlayerFullyRevealed]);

  async function confirmSwap() {
    if (!outgoing || !incoming || !partnerTeamId || !evaluation?.accepted) return;
    setBusy(true);
    setStatus(null);
    const result = executeSeasonTransfer(partnerTeamId, outgoing, incoming);
    setBusy(false);
    if (result.ok) {
      setStatus("Swap complete.");
      setOutgoing(null);
      setIncoming(null);
      const fresh = useGameStore.getState().season;
      if (fresh && transfersRemainingThisWindow(fresh) <= 0) {
        setTimeout(onClose, 800);
      }
      return;
    }
    setStatus(result.error ?? "Swap failed.");
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 md:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        aria-label="Close transfers"
        onClick={onClose}
      />

      <div
        className="relative z-10 flex max-h-[min(92vh,780px)] w-full max-w-4xl flex-col border-2 border-broadcast-highlight bg-stadium shadow-[0_0_40px_rgba(0,0,0,0.65)]"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-broadcast-border bg-black/90 px-4 py-3">
          <div>
            <p className="broadcast-label">Transfer hub</p>
            <h2 className="font-display text-sm font-bold uppercase tracking-wider md:text-base">
              {windowOpen ? transferWindowLabel(season) : "Preview · window closed"}
            </h2>
            <p className="text-[10px] text-slate-500">
              {windowOpen
                ? `Swap-only · ${remaining}/${MAX_SWAPS_PER_WINDOW} left this window`
                : hubStatus.shortLabel}
            </p>
          </div>
          <button type="button" className="btn-broadcast-solid px-4 py-2 text-xs" onClick={onClose}>
            Close
          </button>
        </div>

        {previewMode ? (
          <div className="shrink-0 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-200/90">
            Preview only — swaps unlock {hubStatus.shortLabel.toLowerCase()}. Browse the layout
            below; deals cannot be made until the window opens.
          </div>
        ) : null}

        <div className={`flex min-h-0 flex-1 flex-col ${previewMode ? "opacity-50" : ""}`}>
          <div className="shrink-0 border-b border-broadcast-border/60 px-4 py-3">
            <div className="flex flex-wrap gap-2">
              <input
                type="search"
                value={query}
                placeholder="Search player or universe…"
                disabled={previewMode}
                onChange={(e) => setQuery(e.target.value)}
                className="min-w-[10rem] flex-1 border border-broadcast-border bg-black/70 px-2 py-1.5 text-xs"
              />
              <select
                value={universeFilter}
                disabled={previewMode}
                onChange={(e) => setUniverseFilter(e.target.value)}
                className="border border-broadcast-border bg-black/70 px-2 py-1.5 text-xs"
              >
                <option value="all">All origins</option>
                {leagueTeams.map((id) => (
                  <option key={id} value={id}>
                    {getUniverse(id)?.name ?? id}
                  </option>
                ))}
              </select>
              <select
                value={revealFilter}
                disabled={previewMode}
                onChange={(e) => setRevealFilter(e.target.value as RevealFilter)}
                className="border border-broadcast-border bg-black/70 px-2 py-1.5 text-xs"
              >
                <option value="all">All players</option>
                <option value="revealed">Revealed stats</option>
                <option value="hidden">Hidden stats</option>
              </select>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-2">
            <div className="flex min-h-0 flex-col border-b border-broadcast-border/60 md:border-b-0 md:border-r">
              <div className="flex shrink-0 gap-1 border-b border-broadcast-border/40 px-3 py-2">
                <button
                  type="button"
                  disabled={previewMode}
                  className={`px-2 py-1 text-[10px] uppercase ${tab === "your_squad" ? "bg-broadcast-highlight/20 text-broadcast-highlight" : "text-slate-500"}`}
                  onClick={() => setTab("your_squad")}
                >
                  Your squad (out)
                </button>
                <button
                  type="button"
                  disabled={previewMode}
                  className={`px-2 py-1 text-[10px] uppercase ${tab === "league" ? "bg-broadcast-highlight/20 text-broadcast-highlight" : "text-slate-500"}`}
                  onClick={() => setTab("league")}
                >
                  League (in)
                </button>
              </div>

              {tab === "your_squad" ? (
                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3 commentary-scroll">
                  {filteredUser.map((p) => {
                    const entry = userRoster.find((e) => e.playerName === p.name)!;
                    return (
                      <PlayerRow
                        key={rosterEntryKey(entry)}
                        entry={entry}
                        player={p}
                        selected={outgoing ? rosterEntryKey(outgoing) === rosterEntryKey(entry) : false}
                        onSelect={() => setOutgoing(entry)}
                        disabled={previewMode}
                        subtitle="Your squad"
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col p-3">
                  <select
                    value={partnerTeamId}
                    disabled={previewMode}
                    onChange={(e) => {
                      setPartnerTeamId(e.target.value);
                      setIncoming(null);
                    }}
                    className="mb-2 shrink-0 border border-broadcast-border bg-black/70 px-2 py-1.5 text-xs"
                  >
                    <option value="">Select club…</option>
                    {leagueTeams.map((id) => (
                      <option key={id} value={id}>
                        {getUniverse(id)?.name ?? id}
                      </option>
                    ))}
                  </select>
                  <div className="min-h-0 flex-1 space-y-1 overflow-y-auto commentary-scroll">
                    {partnerTeamId ? (
                      filteredPartner.map((p) => {
                        const entry = partnerRoster.find((e) => e.playerName === p.name)!;
                        return (
                          <PlayerRow
                            key={rosterEntryKey(entry)}
                            entry={entry}
                            player={p}
                            selected={
                              incoming ? rosterEntryKey(incoming) === rosterEntryKey(entry) : false
                            }
                            onSelect={() => setIncoming(entry)}
                            disabled={previewMode}
                          />
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-500">Pick a club to browse their squad.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex min-h-0 flex-col p-4">
              <p className="broadcast-label mb-3">Proposed swap</p>
              <div className="space-y-3 text-xs">
                <div className="border border-broadcast-border/50 bg-black/30 p-3">
                  <p className="text-[10px] uppercase text-slate-500">You send</p>
                  <p className="font-display uppercase text-slate-200">
                    {outgoing?.playerName ?? "—"}
                  </p>
                  {outgoing ? (
                    <p className="text-[10px] text-slate-500">
                      {getUniverse(outgoing.universeId)?.name}
                    </p>
                  ) : null}
                </div>
                <div className="border border-broadcast-border/50 bg-black/30 p-3">
                  <p className="text-[10px] uppercase text-slate-500">You receive</p>
                  <p className="font-display uppercase text-slate-200">
                    {incoming?.playerName ?? "—"}
                  </p>
                  {incoming && partnerTeamId ? (
                    <p className="text-[10px] text-slate-500">
                      from {getUniverse(partnerTeamId)?.name} · origin{" "}
                      {getUniverse(incoming.universeId)?.name}
                    </p>
                  ) : null}
                </div>
              </div>

              {previewMode ? (
                <p className="mt-4 text-xs text-slate-500">
                  Pick one player from your squad and one from a league club, then confirm when the
                  window opens.
                </p>
              ) : evaluation ? (
                <p
                  className={`mt-4 text-xs ${evaluation.accepted ? "text-emerald-400" : "text-amber-400"}`}
                >
                  {evaluation.reason}
                  {!evaluation.accepted && evaluation.inValue > 0 ? (
                    <span className="block text-slate-500">
                      Values: offer {Math.round(evaluation.outValue)} · target{" "}
                      {Math.round(evaluation.inValue)}
                    </span>
                  ) : null}
                </p>
              ) : (
                <p className="mt-4 text-xs text-slate-500">
                  Select one player from your squad and one from a league club.
                </p>
              )}

              {status ? <p className="mt-3 text-xs text-slate-300">{status}</p> : null}

              <button
                type="button"
                className="btn-broadcast-solid mt-auto pt-4 text-xs disabled:opacity-40"
                disabled={previewMode || !evaluation?.accepted || busy || remaining <= 0}
                onClick={() => void confirmSwap()}
              >
                Confirm swap
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
