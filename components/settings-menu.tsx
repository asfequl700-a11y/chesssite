"use client";

import { useState } from "react";
import { Settings as Gear } from "lucide-react";
import { PIECE_SETS, THEMES, setSettings, useSettings } from "@/lib/settings";

/** Gear button with board theme, piece set, sound and coordinates. Saved in localStorage. */
export function SettingsMenu() {
  const s = useSettings();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        className="grid size-10 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-white"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Board settings"
        title="Board settings"
      >
        <Gear className="size-6" />
      </button>
      {open && (
        <div className="absolute top-11 right-0 z-40 w-64 rounded-md bg-card p-4 shadow-[0_8px_24px_rgba(0,0,0,.5)]">
          <p className="mb-2 text-sm font-semibold">Board</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {(Object.keys(THEMES) as (keyof typeof THEMES)[]).map((t) => (
              <button
                key={t}
                onClick={() => setSettings({ theme: t })}
                aria-label={`${t} board`}
                aria-pressed={s.theme === t}
                className={`size-10 overflow-hidden rounded ring-2 ${s.theme === t ? "ring-primary" : "ring-transparent"}`}
                style={{ background: `linear-gradient(135deg, ${THEMES[t].light} 50%, ${THEMES[t].dark} 50%)` }}
              />
            ))}
          </div>
          <label className="mb-3 flex items-center justify-between text-sm">
            Pieces
            <select value={s.pieces} onChange={(e) => setSettings({ pieces: e.target.value as keyof typeof PIECE_SETS })} className="rounded-md bg-panel px-2 py-1 capitalize">
              {Object.keys(PIECE_SETS).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="mb-3 flex items-center justify-between text-sm">
            Sound
            <input type="checkbox" checked={s.sound} onChange={(e) => setSettings({ sound: e.target.checked })} className="size-4 accent-[#81b64c]" />
          </label>
          <label className="flex items-center justify-between text-sm">
            Show coordinates
            <input type="checkbox" checked={s.coords} onChange={(e) => setSettings({ coords: e.target.checked })} className="size-4 accent-[#81b64c]" />
          </label>
        </div>
      )}
    </div>
  );
}
