import type { MultiplayerRoom } from "./multiplayer-types";

const PENDING_CHALLENGE_KEY = "fb-pending-challenge-room";

export function challengeMessage(challengerUsername: string): string {
  return `${challengerUsername} has challenged you to a game!`;
}

export function buildChallengeUrl(roomId: string, challengerUsername: string): string {
  const params = new URLSearchParams({ room: roomId, from: challengerUsername });
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/multiplayer/join/?${params.toString()}`;
}

export function buildChallengeClipboardText(roomId: string, challengerUsername: string): string {
  return `${challengeMessage(challengerUsername)}\n${buildChallengeUrl(roomId, challengerUsername)}`;
}

export async function copyChallengeLink(
  roomId: string,
  challengerUsername: string
): Promise<void> {
  const text = buildChallengeClipboardText(roomId, challengerUsername);
  await navigator.clipboard.writeText(text);
}

export function storePendingChallengeRoom(roomId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PENDING_CHALLENGE_KEY, roomId);
}

export function peekPendingChallengeRoom(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(PENDING_CHALLENGE_KEY);
}

export function consumePendingChallengeRoom(): string | null {
  if (typeof window === "undefined") return null;
  const roomId = sessionStorage.getItem(PENDING_CHALLENGE_KEY);
  if (roomId) sessionStorage.removeItem(PENDING_CHALLENGE_KEY);
  return roomId;
}

export function roomSupportsChallengeLink(room: MultiplayerRoom): boolean {
  if (room.status !== "waiting") return false;
  if (room.room_mode === "tournament") return true;
  return room.visibility === "private";
}
