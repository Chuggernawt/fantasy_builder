const RETURN_ROOM_KEY = "fb_tournament_return_room";

/** Parent tournament hub — used while playing a local CPU fixture without an MP session. */
export function setTournamentReturnRoom(roomId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(RETURN_ROOM_KEY, roomId);
}

export function getTournamentReturnRoom(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(RETURN_ROOM_KEY);
}

export function clearTournamentReturnRoom(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(RETURN_ROOM_KEY);
}
