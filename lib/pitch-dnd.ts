export const FB_DRAG_MIME = "application/x-fb-player";

export type PitchDragPayload =
  | { kind: "slot"; slotId: string; playerName: string }
  | { kind: "bench"; playerName: string };

export function writeDragData(
  e: { dataTransfer: DataTransfer | null },
  payload: PitchDragPayload
) {
  e.dataTransfer?.setData(FB_DRAG_MIME, JSON.stringify(payload));
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
}

export function readDragData(e: { dataTransfer: DataTransfer | null }): PitchDragPayload | null {
  const raw = e.dataTransfer?.getData(FB_DRAG_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PitchDragPayload;
  } catch {
    return null;
  }
}
