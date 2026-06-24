"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CommentaryFeed } from "@/components/CommentaryFeed";
import { BroadcastHeader } from "@/components/BroadcastHeader";
import { SubstitutionPanel } from "@/components/HalftimePanel";
import { MatchSquadPanel } from "@/components/MatchSquadPanel";
import { MatchInfluenceBar } from "@/components/MatchInfluenceBar";
import { OpponentScoutSheet } from "@/components/OpponentScoutSheet";
import { MatchPossessionBar } from "@/components/MatchPossessionBar";
import { MpPauseBanner } from "@/components/MpPauseBanner";
import { useMultiplayerSync } from "@/hooks/useMultiplayerSync";
import { useMultiplayerHostLoop } from "@/hooks/useMultiplayerHostLoop";
import { getAwaySetup, getHomeSetup, useGameStore } from "@/store/game-store";
import { getUniverse } from "@/lib/squads";
import { FORMATIONS } from "@/lib/formations";
import { formatScoutGlance } from "@/lib/tactics";
import {
  extractMatchGoals,
  extractRedCards,
  formatGoalMinuteTags,
  goalsForTeam,
  groupGoalsByScorer,
  redCardsForTeam,
} from "@/lib/match-goals";
import { processTick, TICK_MS } from "@/lib/simulation";
import { MAX_MATCH_SUBS } from "@/lib/constants";
import { getMultiplayerSession } from "@/lib/multiplayer-session";
import { getTournamentReturnRoom } from "@/lib/tournament-match-session";
import { getMyTeamView } from "@/lib/multiplayer-perspective";
import { resolveMyMatchSide, getDisplayLineups } from "@/lib/player-side";
import { SetPiecePanel } from "@/components/SetPiecePanel";
import { PenaltyShootoutBoard } from "@/components/PenaltyShootoutBoard";
import { ExtraTimePanel } from "@/components/ExtraTimePanel";
import { updateMyMpAction } from "@/lib/multiplayer";
import { formatMatchClock } from "@/lib/stoppage-time";
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
  confirmMultiplayerExtraTimePause,
  hostForceResumePause,
  requestMultiplayerSubs,
  signalMultiplayerCaptain,
  signalMultiplayerTactic,
} from "@/lib/multiplayer-client";

export function MatchEngine() {
  const router = useRouter();
  const mpSession = getMultiplayerSession();
  const isMp = !!mpSession;
  const mpMatchMeta = useGameStore((s) => s.mpMatchMeta);
  const localTournamentCpu = !!mpMatchMeta?.tournamentFixture?.localCpuMatch;
  const sharedMp = isMp && !localTournamentCpu;
  const mySide = isMp
    ? (getMultiplayerSession()?.matchSide ??
      (getMultiplayerSession()?.role === "away" ? "away" : "home"))
    : resolveMyMatchSide();
  const myTeam = getMyTeamView();
  const { homeLineup: displayHomeLineup, awayLineup: displayAwayLineup } = getDisplayLineups();

  const {
    roomId: syncRoomId,
    isClient: isMpClientRaw,
    isHost: isMpHostRaw,
    pushSnapshot,
  } = useMultiplayerSync({
    enabled: sharedMp,
  });
  const isMpClient = sharedMp && isMpClientRaw;
  const isMpHost = sharedMp && isMpHostRaw;

  useMultiplayerHostLoop({
    roomId: syncRoomId,
    enabled: isMpHost && sharedMp,
    pushSnapshot,
    onRematchReset: () => {
      const hubId = mpMatchMeta?.parentTournamentRoomId ?? mpSession?.roomId;
      if (hubId) router.replace(`/multiplayer/room?id=${hubId}`);
    },
  });

  const matchState = useGameStore((s) => s.matchState);
  const setMatchState = useGameStore((s) => s.setMatchState);
  const confirmHalftime = useGameStore((s) => s.confirmHalftime);
  const confirmExtraTime = useGameStore((s) => s.confirmExtraTime);
  const confirmSubs = useGameStore((s) => s.confirmSubs);
  const setHomeTactic = useGameStore((s) => s.setHomeTactic);
  const callHomeCaptain = useGameStore((s) => s.callHomeCaptain);
  const resetMatch = useGameStore((s) => s.resetMatch);
  const [mySetPiecePick, setMySetPiecePick] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [goalFlash, setGoalFlash] = useState(false);
  const [scoutOpen, setScoutOpen] = useState(false);
  const prevScore = useRef({ home: 0, away: 0 });
  const didStartWhistle = useRef(false);
  const prevStatus = useRef(matchState?.status);
  const prevHalf = useRef<number | null>(null);
  const prevInStoppage = useRef(false);

  const home = getUniverse(matchState?.homeUniverseId ?? "");
  const away = getUniverse(matchState?.awayUniverseId ?? "");

  const matchEvents = useMemo(() => {
    if (!matchState) {
      return {
        homeGoals: [] as ReturnType<typeof groupGoalsByScorer>,
        awayGoals: [] as ReturnType<typeof groupGoalsByScorer>,
        homeReds: [] as ReturnType<typeof extractRedCards>,
        awayReds: [] as ReturnType<typeof extractRedCards>,
      };
    }
    const goals = extractMatchGoals(matchState.commentary);
    const reds = extractRedCards(matchState.commentary);
    return {
      homeGoals: groupGoalsByScorer(goalsForTeam(goals, "home")),
      awayGoals: groupGoalsByScorer(goalsForTeam(goals, "away")),
      homeReds: redCardsForTeam(reds, "home"),
      awayReds: redCardsForTeam(reds, "away"),
    };
  }, [matchState]);

  useEffect(() => {
    if (!matchState) {
      didStartWhistle.current = false;
      prevStatus.current = undefined;
      prevHalf.current = null;
      prevInStoppage.current = false;
      return;
    }

    const { status, half, tick, inStoppageTime: inStoppage } = matchState;

    if (!didStartWhistle.current && status === "running" && half === 1 && tick <= 1) {
      didStartWhistle.current = true;
      window.dispatchEvent(new CustomEvent("fb:sfx", { detail: { kind: "whistle_start" } }));
    } else if (prevHalf.current === 1 && half === 2 && status === "running" && tick <= 1) {
      window.dispatchEvent(new CustomEvent("fb:sfx", { detail: { kind: "whistle_start" } }));
    } else if (!prevInStoppage.current && inStoppage && status === "running") {
      window.dispatchEvent(new CustomEvent("fb:sfx", { detail: { kind: "whistle_start" } }));
    }

    if (prevStatus.current !== "halftime" && status === "halftime") {
      window.dispatchEvent(new CustomEvent("fb:sfx", { detail: { kind: "whistle_end" } }));
    } else if (prevStatus.current !== "extra_time_choice" && status === "extra_time_choice") {
      window.dispatchEvent(new CustomEvent("fb:sfx", { detail: { kind: "whistle_end" } }));
    } else if (prevStatus.current !== "finished" && status === "finished") {
      window.dispatchEvent(new CustomEvent("fb:sfx", { detail: { kind: "whistle_end" } }));
    } else if (
      prevInStoppage.current &&
      !inStoppage &&
      status === "set_piece_pause" &&
      matchState.interactiveSetPiece?.shootoutDecider
    ) {
      window.dispatchEvent(new CustomEvent("fb:sfx", { detail: { kind: "whistle_end" } }));
    }

    prevStatus.current = status;
    prevHalf.current = half;
    prevInStoppage.current = !!inStoppage;
  }, [matchState]);

  useEffect(() => {
    if (matchState?.status !== "finished") return;
    router.replace("/post-match");
  }, [matchState?.status, router]);

  useEffect(() => {
    if (!matchState) return;
    const total = matchState.score.home + matchState.score.away;
    const prev = prevScore.current.home + prevScore.current.away;
    if (total > prev) {
      setGoalFlash(true);
      window.dispatchEvent(new CustomEvent("fb:sfx", { detail: { kind: "goal" } }));
      const t = setTimeout(() => setGoalFlash(false), 800);
      prevScore.current = { ...matchState.score };
      return () => clearTimeout(t);
    }
    prevScore.current = { ...matchState.score };
  }, [matchState?.score.home, matchState?.score.away, matchState]);

  useEffect(() => {
    if (matchState?.status !== "set_piece_pause") {
      setMySetPiecePick(null);
      return;
    }
    const piece = matchState.interactiveSetPiece;
    if (!piece || piece.phase !== "choose") {
      setMySetPiecePick(null);
    }
  }, [
    matchState?.status,
    matchState?.interactiveSetPiece?.phase,
    matchState?.interactiveSetPiece?.chooseEndsAt,
    matchState?.interactiveSetPiece?.attackerPick,
    matchState?.interactiveSetPiece?.defenderPick,
  ]);

  useEffect(() => {
    if (!matchState || matchState.status !== "set_piece_pause") return;
    if (sharedMp && !isMpHost) return;
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

        if (sharedMp) {
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

        if (!sharedMp && setPieceChooseExpired(p)) {
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
    sharedMp,
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
  }, [matchState?.status, matchState?.half, setMatchState, isMpClient, isMpHost, pushSnapshot, sharedMp]);

  const tournamentReturnRoomId = getTournamentReturnRoom();
  const matchBackHref = tournamentReturnRoomId
    ? `/multiplayer/room?id=${tournamentReturnRoomId}`
    : mpSession
      ? `/multiplayer/room?id=${mpSession.roomId}`
      : "/draft";
  const matchBackLabel = tournamentReturnRoomId || mpSession ? "Tournament" : "Draft";

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
  const clockLabel = formatMatchClock(matchState);

  const statusLabel =
    matchState.status === "halftime"
      ? "HALF TIME"
      : matchState.status === "extra_time_choice"
        ? `90:00 · +${matchState.stoppageMinutes} ADDED`
        : matchState.status === "sub_window"
          ? "SUB WINDOW"
          : matchState.status === "set_piece_pause"
            ? matchState.interactiveSetPiece?.shootoutDecider
              ? "PENALTY SHOOTOUT"
              : matchState.interactiveSetPiece?.kind === "penalty"
                ? "PENALTY"
                : "CORNER"
            : matchState.status === "finished"
              ? "FULL TIME"
              : matchState.inStoppageTime
                ? `${clockLabel} · ADDED TIME`
                : `${minute}' · H${matchState.half}`;

  const hs = matchState.homeStats;
  const as = matchState.awayStats;
  const totalPoss = hs.possessionPhases + as.possessionPhases || 1;
  const homePossPct = Math.round((hs.possessionPhases / totalPoss) * 100);
  const awayPossPct = 100 - homePossPct;

  const pause = sharedMp ? mpMatchMeta?.pause : null;
  const roomId = sharedMp ? (syncRoomId ?? "") : "";
  const myReady = pause ? (mySide === "home" ? pause.homeReady : pause.awayReady) : false;
  const opponentReady = pause ? (mySide === "home" ? pause.awayReady : pause.homeReady) : false;
  const mySubsUsed = mySide === "home" ? matchState.homeSubsUsed : matchState.awaySubsUsed;
  const myStamina = mySide === "home" ? matchState.homeStamina : matchState.awayStamina;
  const myPlayerStats =
    (mySide === "home" ? matchState.homePlayerStats : matchState.awayPlayerStats) ?? {};
  const myGoalsConceded = mySide === "home" ? matchState.score.away : matchState.score.home;
  const myTeamGoals = mySide === "home" ? matchState.score.home : matchState.score.away;
  const myTactics = mySide === "home" ? matchState.homeTactics : matchState.awayTactics;
  const myCaptainHalf = mySide === "home" ? matchState.homeCaptainHalf : matchState.awayCaptainHalf;
  const myCaptain = mySide === "home" ? matchState.homeCaptain : matchState.awayCaptain;

  const opponentSide = mySide === "home" ? "away" : "home";
  const opponentUni = opponentSide === "home" ? home : away;
  const opponentSetup = opponentSide === "home" ? getHomeSetup() : getAwaySetup();
  const opponentLineup = opponentSide === "home" ? displayHomeLineup : displayAwayLineup;
  const opponentTactics =
    opponentSide === "home" ? matchState.homeTactics : matchState.awayTactics;
  const opponentCaptain =
    opponentSide === "home"
      ? matchState.homeCaptainHalf === matchState.half
        ? matchState.homeCaptain
        : null
      : matchState.awayCaptainHalf === matchState.half
        ? matchState.awayCaptain
        : null;
  const opponentFormation =
    FORMATIONS.find((f) => f.id === opponentSetup?.formationId) ?? FORMATIONS[0];
  const opponentScoutGlance = formatScoutGlance(opponentFormation.label, opponentTactics);
  const openOpponentScout = () => setScoutOpen(true);

  async function handleOpenSubs() {
    if (sharedMp && roomId) {
      await requestMultiplayerSubs(roomId, mySide, isMpHost);
      if (isMpHost) void pushSnapshot();
      return;
    }
    useGameStore.getState().openSubWindow();
  }

  async function handleSetTactic(tactic: Parameters<typeof setHomeTactic>[0]) {
    if (sharedMp && roomId) {
      await signalMultiplayerTactic(roomId, mySide, isMpHost, tactic);
      if (isMpHost) void pushSnapshot();
      return;
    }
    if (mySide === "home") setHomeTactic(tactic);
    else useGameStore.getState().setAwayTactic(tactic);
  }

  async function handleCallCaptain(name: string) {
    if (sharedMp && roomId) {
      await signalMultiplayerCaptain(roomId, mySide, isMpHost, name);
      if (isMpHost) void pushSnapshot();
      return;
    }
    if (mySide === "home") callHomeCaptain(name);
    else useGameStore.getState().callAwayCaptain(name);
  }

  async function handleSetPiecePick(choice: number) {
    const state = matchState;
    if (!state) return;
    const piece = state.interactiveSetPiece;
    if (!piece || piece.phase !== "choose" || mySetPiecePick !== null) return;
    const isAttacker = mySide === piece.attacking;
    setMySetPiecePick(choice);

    if (sharedMp && roomId && !isMpHost) {
      await updateMyMpAction(roomId, {
        type: "set_piece_pick",
        choice,
        role: isAttacker ? "attack" : "defend",
      });
      return;
    }

    const next = mergeSetPiecePick(state, isAttacker, choice);
    setMatchState(next);
    if (isMpHost) void pushSnapshot();
  }

  return (
    <>
      <BroadcastHeader
        title="Live Match"
        backHref={matchBackHref}
        backLabel={matchBackLabel}
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
              {mySide === "away" ? (
                <button
                  type="button"
                  onClick={openOpponentScout}
                  className="w-full truncate text-left font-display text-xs font-semibold uppercase hover:text-broadcast-highlight md:text-sm"
                  title="Open scout report"
                >
                  {home.name}
                </button>
              ) : (
                <p className="truncate font-display text-xs font-semibold uppercase md:text-sm">
                  {home.name}
                </p>
              )}
              {matchEvents.homeGoals.length ? (
                <ul className="mt-1 space-y-0.5 font-mono text-[9px] text-slate-400">
                  {matchEvents.homeGoals.map((g) => (
                    <li key={`h-${g.scorer}`}>
                      <span className="text-slate-300">{g.scorer}</span>{" "}
                      {formatGoalMinuteTags(g.goals)}
                    </li>
                  ))}
                </ul>
              ) : null}
              {matchEvents.homeReds.length ? (
                <ul className="mt-1 space-y-0.5 font-mono text-[9px] text-red-400/90">
                  {matchEvents.homeReds.map((c) => (
                    <li key={c.id}>
                      {c.minute}&apos; {c.playerName}{" "}
                      <span className="text-red-500">(red)</span>
                    </li>
                  ))}
                </ul>
              ) : null}
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
              {mySide === "home" ? (
                <button
                  type="button"
                  onClick={openOpponentScout}
                  className="w-full truncate text-right font-display text-xs font-semibold uppercase hover:text-broadcast-highlight md:text-sm"
                  title="Open scout report"
                >
                  {away.name}
                </button>
              ) : (
                <p className="truncate font-display text-xs font-semibold uppercase md:text-sm">
                  {away.name}
                </p>
              )}
              {matchEvents.awayGoals.length ? (
                <ul className="mt-1 space-y-0.5 font-mono text-[9px] text-slate-400">
                  {matchEvents.awayGoals.map((g) => (
                    <li key={`a-${g.scorer}`}>
                      <span className="text-slate-300">{g.scorer}</span>{" "}
                      {formatGoalMinuteTags(g.goals)}
                    </li>
                  ))}
                </ul>
              ) : null}
              {matchEvents.awayReds.length ? (
                <ul className="mt-1 space-y-0.5 font-mono text-[9px] text-red-400/90">
                  {matchEvents.awayReds.map((c) => (
                    <li key={c.id}>
                      {c.minute}&apos; {c.playerName}{" "}
                      <span className="text-red-500">(red)</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>

        {matchState.penaltyShootout ? (
          <PenaltyShootoutBoard
            shootout={matchState.penaltyShootout}
            homeLabel={home.name}
            awayLabel={away.name}
            homeAccent={home.accentColor}
            awayAccent={away.accentColor}
            activeSide={
              matchState.interactiveSetPiece?.shootoutDecider
                ? matchState.interactiveSetPiece.attacking
                : null
            }
          />
        ) : null}

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
            attackingLabel={
              matchState.interactiveSetPiece.attacking === "home" ? home.name : away.name
            }
            defendingLabel={
              matchState.interactiveSetPiece.attacking === "home" ? away.name : home.name
            }
            myPick={mySetPiecePick}
            onPick={(choice) => {
              void handleSetPiecePick(choice);
            }}
          />
        ) : null}

        {matchState.status === "extra_time_choice" ? (
          <>
            {sharedMp && pause?.kind === "extra_time" ? (
              <MpPauseBanner
                pause={pause}
                myReady={myReady}
                opponentReady={opponentReady}
                isHost={isMpHost}
              />
            ) : null}
            <ExtraTimePanel
              accent={myTeam.accent}
              teamName={myTeam.name}
              addedMinutes={matchState.stoppageMinutes}
              confirmLabel={sharedMp ? "Lock in approach" : "Start added time"}
              onConfirm={(approach) => {
                if (sharedMp && roomId) {
                  void confirmMultiplayerExtraTimePause(roomId, mySide, isMpHost, approach).then(
                    () => {
                      if (isMpHost) void pushSnapshot();
                    }
                  );
                  return;
                }
                confirmExtraTime(approach);
              }}
            />
          </>
        ) : matchState.status === "halftime" ? (
          <SubstitutionPanel
            key="halftime"
            universeId={myTeam.universeId}
            formationId={myTeam.formationId}
            accent={myTeam.accent}
            lineup={myTeam.lineup}
            matchBench={myTeam.matchBench}
            stamina={myStamina}
            playerStats={myPlayerStats}
            teamGoals={myTeamGoals}
            goalsConceded={myGoalsConceded}
            subsUsed={mySubsUsed}
            maxSubs={MAX_MATCH_SUBS}
            title="Half Time"
            heading={`${myTeam.name} — Team Talk & Subs`}
            confirmLabel={sharedMp ? "Ready for second half" : "Start Second Half"}
            showSecondHalfInfluence
            currentTactics={myTactics}
            currentCaptain={myCaptainHalf === 2 ? myCaptain : null}
            onConfirm={(newLineup, subsMade, tactics, captain) => {
              if (sharedMp && roomId) {
                void confirmMultiplayerHalftimePause(
                  roomId,
                  mySide,
                  isMpHost,
                  newLineup,
                  subsMade,
                  tactics,
                  captain
                ).then(() => {
                  if (isMpHost) void pushSnapshot();
                });
                return;
              }
              confirmHalftime(newLineup, subsMade, tactics, captain);
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
            playerStats={myPlayerStats}
            teamGoals={myTeamGoals}
            goalsConceded={myGoalsConceded}
            subsUsed={mySubsUsed}
            maxSubs={MAX_MATCH_SUBS}
            title="Substitutions"
            heading={`${myTeam.name} — Make Your Changes`}
            confirmLabel={sharedMp ? "Confirm & Ready" : "Confirm & Resume"}
            onConfirm={(newLineup, subsMade) => {
              if (sharedMp && roomId) {
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
              opponentName={opponentUni?.name}
              opponentUniverseId={opponentUni?.id}
              onOpenOpponentScout={openOpponentScout}
            />

            {opponentUni && opponentSetup ? (
              <OpponentScoutSheet
                open={scoutOpen}
                onClose={() => setScoutOpen(false)}
                teamName={opponentUni.name}
                accent={opponentUni.accentColor}
                universeId={opponentSetup.universeId}
                formationId={opponentSetup.formationId}
                lineup={opponentLineup}
                tactics={opponentTactics}
                captain={opponentCaptain}
              />
            ) : null}

            <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,11rem)_1fr_minmax(0,11rem)] xl:grid-cols-[minmax(0,13rem)_1fr_minmax(0,13rem)]">
              <div className="order-2 hidden min-h-0 lg:order-1 lg:flex lg:flex-col">
                <MatchSquadPanel
                  title={home.name}
                  accent={home.accentColor}
                  lineup={displayHomeLineup}
                  stamina={matchState.homeStamina}
                  playerStats={matchState.homePlayerStats}
                  teamGoals={matchState.score.home}
                  goalsConceded={matchState.score.away}
                  captain={
                    matchState.homeCaptainHalf === matchState.half ? matchState.homeCaptain : null
                  }
                  subtitle={mySide === "away" ? opponentScoutGlance : undefined}
                  scoutUniverseId={mySide === "away" ? opponentUni?.id : undefined}
                  scoutAccent={mySide === "away" ? opponentUni?.accentColor : undefined}
                  onOpenScout={mySide === "away" ? openOpponentScout : undefined}
                />
              </div>

              <div className="order-1 flex min-h-0 flex-col lg:order-2">
                <CommentaryFeed live events={matchState.commentary} />
              </div>

              <div className="order-3 hidden min-h-0 lg:flex lg:flex-col">
                <MatchSquadPanel
                  title={away.name}
                  accent={away.accentColor}
                  lineup={displayAwayLineup}
                  stamina={matchState.awayStamina}
                  playerStats={matchState.awayPlayerStats}
                  teamGoals={matchState.score.away}
                  goalsConceded={matchState.score.home}
                  captain={
                    matchState.awayCaptainHalf === matchState.half ? matchState.awayCaptain : null
                  }
                  subtitle={mySide === "home" ? opponentScoutGlance : undefined}
                  scoutUniverseId={mySide === "home" ? opponentUni?.id : undefined}
                  scoutAccent={mySide === "home" ? opponentUni?.accentColor : undefined}
                  onOpenScout={mySide === "home" ? openOpponentScout : undefined}
                />
              </div>
            </div>

            <div className="mt-2 grid max-h-36 grid-cols-2 gap-2 lg:hidden">
              <MatchSquadPanel
                compact
                title={home.name}
                accent={home.accentColor}
                lineup={displayHomeLineup}
                stamina={matchState.homeStamina}
                playerStats={matchState.homePlayerStats}
                teamGoals={matchState.score.home}
                goalsConceded={matchState.score.away}
                captain={
                  matchState.homeCaptainHalf === matchState.half ? matchState.homeCaptain : null
                }
                subtitle={mySide === "away" ? opponentScoutGlance : undefined}
                scoutUniverseId={mySide === "away" ? opponentUni?.id : undefined}
                scoutAccent={mySide === "away" ? opponentUni?.accentColor : undefined}
                onOpenScout={mySide === "away" ? openOpponentScout : undefined}
              />
              <MatchSquadPanel
                compact
                title={away.name}
                accent={away.accentColor}
                lineup={displayAwayLineup}
                stamina={matchState.awayStamina}
                playerStats={matchState.awayPlayerStats}
                teamGoals={matchState.score.away}
                goalsConceded={matchState.score.home}
                captain={
                  matchState.awayCaptainHalf === matchState.half ? matchState.awayCaptain : null
                }
                subtitle={mySide === "home" ? opponentScoutGlance : undefined}
                scoutUniverseId={mySide === "home" ? opponentUni?.id : undefined}
                scoutAccent={mySide === "home" ? opponentUni?.accentColor : undefined}
                onOpenScout={mySide === "home" ? openOpponentScout : undefined}
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
