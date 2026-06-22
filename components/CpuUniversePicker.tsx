"use client";

import { useState } from "react";
import { getAllUniverses } from "@/lib/squads";

interface CpuUniversePickerProps {
  takenUniverseIds: string[];
  onAdd: (universeId: string) => void | Promise<void>;
  busy?: boolean;
}

export function CpuUniversePicker({ takenUniverseIds, onAdd, busy }: CpuUniversePickerProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const taken = new Set(takenUniverseIds);
  const available = getAllUniverses().filter((u) => !taken.has(u.id));

  if (!open) {
    return (
      <button
        type="button"
        className="btn-broadcast ml-2 px-2 py-0.5 text-[10px]"
        disabled={busy || !available.length}
        onClick={() => {
          setSelected(available[0]?.id ?? "");
          setOpen(true);
        }}
      >
        + CPU
      </button>
    );
  }

  return (
    <span className="ml-2 flex flex-wrap items-center gap-1">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="max-w-[8rem] border border-broadcast-border bg-black/80 px-1 py-0.5 text-[10px]"
      >
        {available.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn-broadcast-solid px-2 py-0.5 text-[10px]"
        disabled={busy || !selected}
        onClick={() => {
          void Promise.resolve(onAdd(selected)).then(() => {
            setOpen(false);
          });
        }}
      >
        Add
      </button>
      <button
        type="button"
        className="btn-broadcast px-2 py-0.5 text-[10px]"
        disabled={busy}
        onClick={() => setOpen(false)}
      >
        Cancel
      </button>
    </span>
  );
}
