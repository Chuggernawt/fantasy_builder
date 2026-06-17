"use client";

import { useEffect } from "react";

type FxKind = "click" | "whistle_start" | "whistle_end" | "reveal";

function beepSequence(kind: FxKind) {
  const ctx = new (window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext)();
  const now = ctx.currentTime;
  const sequence: Array<[number, number, number]> =
    kind === "click"
      ? [[880, 0.015, 0]]
      : kind === "whistle_start"
        ? [
            [740, 0.09, 0],
            [980, 0.11, 0.1],
          ]
        : kind === "whistle_end"
          ? [
              [980, 0.08, 0],
              [760, 0.14, 0.09],
            ]
          : [
              [600, 0.06, 0],
              [780, 0.06, 0.07],
              [980, 0.08, 0.14],
            ];

  sequence.forEach(([freq, dur, offset]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.11, now + offset + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + dur);
  });
}

export function SoundEffectsProvider() {
  useEffect(() => {
    let lastClick = 0;
    const onPointer = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest("button,a,[role='button'],select")) return;
      const now = Date.now();
      if (now - lastClick < 45) return;
      lastClick = now;
      beepSequence("click");
    };

    const onFx = (e: Event) => {
      const detail = (e as CustomEvent<{ kind?: FxKind }>).detail?.kind;
      if (!detail) return;
      beepSequence(detail);
    };

    document.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("fb:sfx", onFx as EventListener);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("fb:sfx", onFx as EventListener);
    };
  }, []);

  return null;
}
