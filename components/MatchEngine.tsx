"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CommentaryFeed } from "@/components/CommentaryFeed";
import { BroadcastHeader } from "@/components/BroadcastHeader";
import { SubstitutionPanel } from "@/components/HalftimePanel";
import { MatchSquadPanel } from "@/components/MatchSquadPanel";
import { MatchInfluenceBar } from "@/components/MatchInfluenceBar";
import { MatchPossessionBar } from "@/components/MatchPossessionBar";
import { MpPauseBanner } from "@/components/MpPauseBanner";
import { useMultiplayerSync } from "@/hooks/useMultiplayerSync";
import { useMultiplayerHostLoop } from "@/hooks/useMultiplayerHostLoop";
import { getAwaySetup, getHomeSetup, useGameStore } from "@/store/game-store";
import { getUniverse } from "@/lib/squads";
import { processTick, TICK_MS } from "@/lib/simulation";
import { MAX_MATCH_SUBS } from "@/lib/constants";
import { getMultiplayerSession } from "@/lib/multiplayer-session";
import { getMyTeamView, myMatchSide } from "@/lib/multiplayer-perspective";
import { SetPiecePanel } from "@/components/SetPiecePanel";
import { updateMyMpAction } from "@/lib/multiplayer";
import { resolveMyMatchSide } from "@/lib/player-side";
import {
  cpuSetPieceChoice,
  finalizeSetPieceReveal,
  mergeSetPiecePick,
  setPieceChooseExpired,
  setPieceRevealExpired,
} from "@/lib/set-piece-interactive";
import {
  confirmMultiplayerHalftimePause,
  confirmMultiplayerSubsPause,
  hostForceResumePause,
  requestMultiplayerSubs,
  signalMultiplayerCaptain,
  signalMultiplayerTactic,
} from "@/lib/multiplayer-client";

export function MatchEngine() {
  const router = useRouter();
  const mpSession = getMultiplayerSession();
  const isMp = !!mpSession;
  const mySide = myMatchSide() ?? "home";
  const myTeam = getMyTeamView();

  const { isClient: isMpClient, isHost: isMpHost, pushSnapshot } = useMultiplayerSync({
    enabled: !!mpSession,
  });

  useMultiplayerHostLoop({
    roomId: mpSession?.roomId ?? null,
    enabled: isMpHost,
    pushSnapshot,
    onRematchReset: () => {
      if (mpSession) router.replace(`/multiplayer/room?id=${mpSession.roomId}`);
    },
  });

  const matchState = useGameStore((s) => s.matchState);
  const mpMatchMeta = useGameStore((s) => s.mpMatchMeta);
  const lineup = useGameStore((s) => s.lineup);
  const opponentLineup = useGameStore((s) => s.opponentLineup);
  const setMatchState = useGameStore((s) => s.setMatchState);
  const confirmHalftime = useGameStore((s) => s.confirmHalftime);
  const confirmSubs = useGameStore((s) => s.confirmSubs);
  const setHomeTactic = useGameStore((s) => s.setHomeTactic);
  const callHomeCaptain = useGameStore((s) => s.callHomeCaptain);
  const resetMatch = useGameStore((s) => s.resetMatch);
  const [mySetPiecePick, setMySetPiecePick] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [goalFlash, setGoalFlash] = useState(false);
  const prevScore = useRef({ home: 0, away: 0 });
  const didStartWhistle = useRef(false);
  const prevStatus = useRef(matchState?.status);

  const home = getUniverse(matchState?.homeUniverseId ?? "");
  const away = getUniverse(matchState?.awayUniverseId ?? "");

  useEffect(() => {
    if (!matchState) return;
    if (!didStartWhistle.current && matchState.status === "running" && matchState.tick <= 1) {
      didStartWhistle.current = true;
      window.dispatchEvent(new CustomEvent("fb:sfx", { detail: { kind: "whistle_start" } }));
    }
    if (prevStatus.current !== "finished" && matchState.status === "finished") {
      window.dispatchEvent(new CustomEvent("fb:sfx", { detail: { kind: "whistle_end" } }));
    }
    prevStatus.current = matchState.status;
  }, [matchState]);

  useEffect(() => {
    if (matchState?.status === "finished") {
      router.replace("/post-match");
    }
  }, [matchState?.status, router]);

  useEffect(() => {
    if (!matchState) return;
    const total = matchState.score.home + matchState.score.away;
    const prev = prevScore.current.home + prevScore.current.away;
    if (total > prev) {
      setGoalFlash(true);
      const t = setTimeout(() => setGoalFlash(false), 800);
      prevScore.current = { ...matchState.score };
      return () => clearTimeout(t);
    }
    prevScore.current = { ...matchState.score };
  }, [matchState?.score.home, matchState?.score.away, matchState]);

  useEffect(() => {
    if (matchState?.status !== "set_piece_pause") {
      setMySetPiecePick(null);
    }
  }, [matchState?.status, matchState?.interactiveSetPiece?.chooseEndsAt]);

  useEffect(() => {
    if (!matchState || matchState.status !== "set_piece_pause") return;
    if (isMp && !isMpHost) return;
    const piece = matchState.interactiveSetPiece;
    if (!piece) return;

    const timer = setInterval(() => {
      const state = useGameStore.getState().matchState;
      if (!state?.interactiveSetPiece) return;
      const p = state.interactiveSetPiece;
      let next = state;

      if (p.phase === "choose") {
        const attacking = p.attacking;
        const playerSide = resolveMyMatchSide();
        const playerIsAttacker = playerSide === attacking;
        const needAtk = !p.attackerPick;
        const needDef = !p.defenderPick;

        if (isMp) {
          if (setPieceChooseExpired(p)) {
            if (!next.interactiveSetPiece?.attackerPick) {
              next = mergeSetPiecePick(next, true, cpuSetPieceChoice());
            }
            if (!next.interactiveSetPiece?.defenderPick) {
              next = mergeSetPiecePick(next, false, cpuSetPieceChoice());
            }
          }
        } else {
          if (playerIsAttacker && needAtk) {
            /* player picks via UI */
          } else if (!playerIsAttacker && needDef) {
            /* player picks via UI */
          } else if (needAtk) {
            next = mergeSetPiecePick(next, true, cpuSetPieceChoice());
          } else if (needDef) {
            next = mergeSetPiecePick(next, false, cpuSetPieceChoice());
          }
        }

        if (!isMp && setPieceChooseExpired(p)) {
          if (!next.interactiveSetPiece?.attackerPick) {
            next = mergeSetPiecePick(next, true, cpuSetPieceChoice());
          }
          if (!next.interactiveSetPiece?.defenderPick) {
            next = mergeSetPiecePick(next, false, cpuSetPieceChoice());
          }
        }

        if (next !== state) {
          setMatchState(next);
          if (isMpHost) void pushSnapshot();
        }
        return;
      }

      if (p.phase === "reveal" && setPieceRevealExpired(p)) {
        const resumed = finalizeSetPieceReveal(state);
        setMatchState(resumed);
        if (isMpHost) void pushSnapshot();
      }
    }, 500);

    return () => clearInterval(timer);
  }, [
    matchState?.status,
    matchState?.interactiveSetPiece,
    isMpHost,
    isMp,
    setMatchState,
    pushSnapshot,
  ]);

  useEffect(() => {
    if (
      isMpClient ||
      !matchState ||
      matchState.status === "finished" ||
      matchState.status === "halftime" ||
      matchState.status === "sub_window" ||
      matchState.status === "set_piece_pause" ||
      matchState.status === "idle"
    ) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      const homeSetup = getHomeSetup();
      const awaySetup = getAwaySetup();
      const current = useGameStore.getState().matchState;
      if (!homeSetup || !awaySetup || !current || current.status !== "running") return;
      const { state } = processTick(current, homeSetup, awaySetup);
      setMatchState(state);
      if (isMpHost) {
        void pushSnapshot();
      }
    }, TICK_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [matchState?.status, matchState?.half, setMatchState, isMpClient, isMpHost, pushSnapshot]);

  if (!matchState || !home || !away || !myTeam) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-slate-400">No match in progress.</p>
        <button className="btn-broadcast mt-4" onClick={() => router.push("/draft")}>
          Set up a match
        </button>
      </div>
    );
  }

  const minute =
    matchState.half === 1
      ? Math.round((matchState.tick / matchState.ticksPerHalf) * 45)
      : 45 + Math.round((matchState.tick / matchState.ticksPerHalf) * 45);

  const statusLabel =
    matchState.status === "halftime"
      ? "HALF TIME"
      : matchState.status === "sub_window"
        ? "SUB WINDOW"
        : matchState.status === "set_piece_pause"
          ? matchState.interactiveSetPiece?.kind === "penalty"
            ? "PENALTY"
            : "CORNER"
          : matchState.status === "finished"
            ? "FULL TIME"
            : `${minute}' · H${matchState.half}`;

  const hs = matchState.homeStats;
  const as = matchState.awayStats;
  const totalPoss = hs.possessionPhases + as.possessionPhases || 1;
  const homePossPct = Math.round((hs.possessionPhases / totalPoss) * 100);
  const awayPossPct = 100 - homePossPct;

  const pause = isMp ? mpMatchMeta?.pause : null;
  const myReady = pause ? (mySide === "home" ? pause.homeReady : pause.awayReady) : false;
  const opponentReady = pause ? (mySide === "home" ? pause.awayReady : pause.homeReady) : false;
  const mySubsUsed = mySide === "home" ? matchState.homeSubsUsed : matchState.awaySubsUsed;
  const myStamina = mySide === "home" ? matchState.homeStamina : matchState.awayStamina;
  const myTacticHalf = mySide === "home" ? matchState.homeTacticHalf : matchState.awayTacticHalf;
  const myTactic = mySide === "home" ? matchState.homeTactic : matchState.awayTactic;
  const myCaptainHalf = mySide === "home" ? matchState.homeCaptainHalf : matchState.awayCaptainHalf;
  const myCaptain = mySide === "home" ? matchState.homeCaptain : matchState.awayCaptain;

  const roomId = mpSession?.roomId ?? "";

  async function handleOpenSubs() {
    if (isMp && roomId) {
      await requestMultiplayerSubs(roomId, mySide, isMpHost);
      if (isMpHost) void pushSnapshot();
      return;
    }
    useGameStore.getState().openSubWindow();
  }

  async function handleSetTactic(tactic: Parameters<typeof setHomeTactic>[0]) {
    if (isMp && roomId) {
      await signalMultiplayerTactic(roomId, mySide, isMpHost, tactic);
      if (isMpHost) void pushSnapshot();
      return;
    }
    if (mySide === "home") setHomeTactic(tactic);
    else useGameStore.getState().setAwayTactic(tactic);
  }

  async function handleCallCaptain(name: string) {
    if (isMp && roomId) {
      await signalMultiplayerCaptain(roomId, mySide, isMpHost, name);
      if (isMpHost) void pushSnapshot();
      return;
    }
    if (mySide === "home") callHomeCaptain(name);
    else useGameStore.getState().callAwayCaptain(name);
  }

  async function handleSetPiecePick(choice: number) {
    const piece = matchState.interactiveSetPiece;
    if (!piece || piece.phase !== "choose" || mySetPiecePick !== null) return;
    const isAttacker = mySide === piece.attacking;
    setMySetPiecePick(choice);

    if (isMp && roomId && !isMpHost) {
      await updateMyMpAction(roomId, {
        type: "set_piece_pick",
        choice,
        role: isAttacker ? "attack" : "defend",
      });
      return;
    }

    const next = mergeSetPiecePick(matchState, isAttacker, choice);
    setMatchState(next);
    if (isMpHost) void pushSnapshot();
  }

  return (
    <>
      <BroadcastHeader
        title="Live Match"
        backHref={mpSession ? `/multiplayer/room?id=${mpSession.roomId}` : "/draft"}
        backLabel={mpSession ? "Room" : "Draft"}
      />

      <main className="mx-auto flex h-[calc(100dvh-3.25rem)] max-w-7xl flex-col overflow-hidden px-2 py-2 md:px-3">
        {isMpClient ? (
          <p className="mb-2 shrink-0 text-center text-[10px] uppercase tracking-wider text-fuchsia-300">
            Live sync — host simulation
          </p>
        ) : null}

        <div
          className={`glass-panel mb-3 shrink-0 border-t-4 px-3 py-3 md:px-4 ${goalFlash ? "animate-goal-flash" : ""}`}
          style={{ borderTopColor: home.accentColor }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="broadcast-label text-[10px]" style={{ color: home.accentColor }}>
                Home
              </p>
              <p className="truncate font-display text-xs font-semibold uppercase md:text-sm">
                {home.name}
              </p>
            </div>
            <div className="shrink-0 px-2 text-center">
              <p className="font-display text-3xl font-bold tracking-widest md:text-5xl">
                {matchState.score.home}
                <span className="mx-1 text-broadcast-highlight md:mx-2">-</span>
                {matchState.score.away}
              </p>
              <p className="font-mono text-[10px] text-slate-400 md:text-xs">{statusLabel}</p>
              <MatchPossessionBar
                compact
                homePct={homePossPct}
                awayPct={awayPossPct}
                homeAccent={home.accentColor}
                awayAccent={away.accentColor}
              />
            </div>
            <div className="min-w-0 flex-1 text-right">
              <p className="broadcast-label text-[10px]" style={{ color: away.accentColor }}>
                Away
              </p>
              <p className="truncate font-display text-xs font-semibold uppercase md:text-sm">
                {away.name}
              </p>
            </div>
          </div>
        </div>

        {pause ? (
          <MpPauseBanner
            pause={pause}
            myReady={myReady}
            opponentReady={opponentReady}
            isHost={isMpHost}
            onHostStart={() => {
              hostForceResumePause();
              void pushSnapshot();
            }}
          />
        ) : null}

        {matchState.status === "set_piece_pause" && matchState.interactiveSetPiece ? (
          <SetPiecePanel
            piece={matchState.interactiveSetPiece}
            isAttacker={mySide === matchState.interactiveSetPiece.attacking}
            myPick={mySetPiecePick}
            onPick={(choice) => {
              void handleSetPiecePick(choice);
            }}
          />
        ) : null}

        {matchState.status === "halftime" ? (
          <SubstitutionPanel
            key="halftime"
            universeId={myTeam.universeId}
            formationId={myTeam.formationId}
            accent={myTeam.accent}
            lineup={myTeam.lineup}
            matchBench={myTeam.matchBench}
            stamina={myStamina}
            subsUsed={mySubsUsed}
            maxSubs={MAX_MATCH_SUBS}
            title="Half Time"
            heading={`${myTeam.name} — Team Talk & Subs`}
            confirmLabel={isMp ? "Ready for second half" : "Start Second Half"}
            showSecondHalfInfluence
            currentTactic={myTacticHalf === 2 ? myTactic : null}
            currentCaptain={myCaptainHalf === 2 ? myCaptain : null}
            onConfirm={(newLineup, subsMade, tactic, captain) => {
              if (isMp && roomId) {
                void confirmMultiplayerHalftimePause(
                  roomId,
                  mySide,
                  isMpHost,
                  newLineup,
                  subsMade,
                  tactic,
                  captain
                ).then(() => {
                  if (isMpHost) void pushSnapshot();
                });
                return;
              }
              confirmHalftime(newLineup, subsMade, tactic, captain);
            }}
          />
        ) : matchState.status === "sub_window" ? (
          <SubstitutionPanel
            key="subs"
            universeId={myTeam.universeId}
            formationId={myTeam.formationId}
            accent={myTeam.accent}
            lineup={myTeam.lineup}
            matchBench={myTeam.matchBench}
            stamina={myStamina}
            subsUsed={mySubsUsed}
            maxSubs={MAX_MATCH_SUBS}
            title="Substitutions"
            heading={`${myTeam.name} — Make Your Changes`}
            confirmLabel={isMp ? "Confirm & Ready" : "Confirm & Resume"}
            onConfirm={(newLineup, subsMade) => {
              if (isMp && roomId) {
                void confirmMultiplayerSubsPause(roomId, mySide, isMpHost, newLineup, subsMade).then(
                  () => {
                    if (isMpHost) void pushSnapshot();
                  }
                );
                return;
              }
              confirmSubs(newLineup, subsMade);
            }}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <MatchInfluenceBar
              matchState={matchState}
              side={mySide}
              universeId={myTeam.universeId}
              lineup={myTeam.lineup}
              accent={myTeam.accent}
              onOpenSubs={handleOpenSubs}
              onSetTactic={handleSetTactic}
              onCallCaptain={handleCallCaptain}
            />

            <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,11rem)_1fr_minmax(0,11rem)] xl:grid-cols-[minmax(0,13rem)_1fr_minmax(0,13rem)]">
              <div className="order-2 hidden min-h-0 lg:order-1 lg:flex lg:flex-col">
                <MatchSquadPanel
                  title={home.name}
                  accent={home.accentColor}
                  lineup={lineup}
                  stamina={matchState.homeStamina}
                  playerStats={matchState.homePlayerStats}
                  captain={
                    matchState.homeCaptainHalf === matchState.half ? matchState.homeCaptain : null
                  }
                />
              </div>

              <div className="order-1 flex min-h-0 flex-col lg:order-2">
                <CommentaryFeed live events={matchState.commentary} />
              </div>

              <div className="order-3 hidden min-h-0 lg:flex lg:flex-col">
                <MatchSquadPanel
                  title={away.name}
                  accent={away.accentColor}
                  lineup={opponentLineup}
                  stamina={matchState.awayStamina}
                  playerStats={matchState.awayPlayerStats}
                  captain={
                    matchState.awayCaptainHalf === matchState.half ? matchState.awayCaptain : null
                  }
                />
              </div>
            </div>

            <div className="mt-2 grid max-h-36 grid-cols-2 gap-2 lg:hidden">
              <MatchSquadPanel
                compact
                title={home.name}
                accent={home.accentColor}
                lineup={lineup}
                stamina={matchState.homeStamina}
                playerStats={matchState.homePlayerStats}
                captain={
                  matchState.homeCaptainHalf === matchState.half ? matchState.homeCaptain : null
                }
              />
              <MatchSquadPanel
                compact
                title={away.name}
                accent={away.accentColor}
                lineup={opponentLineup}
                stamina={matchState.awayStamina}
                playerStats={matchState.awayPlayerStats}
                captain={
                  matchState.awayCaptainHalf === matchState.half ? matchState.awayCaptain : null
                }
              />
            </div>

            <button
              type="button"
              className="btn-broadcast mt-3 shrink-0 text-xs"
              onClick={() => {
                resetMatch();
                router.push(mpSession ? "/multiplayer" : "/");
              }}
            >
              Abandon Match
            </button>
          </div>
        )}
      </main>
    </>
  );
}
