import { useSyncExternalStore } from "react";

// Board colour themes (our own picks; green is the measured chess.com default).
export const THEMES = {
  green: { light: "#ebecd0", dark: "#739552" },
  brown: { light: "#f0d9b5", dark: "#b58863" },
  blue: { light: "#dee3e6", dark: "#8ca2ad" },
  gray: { light: "#dcdcdc", dark: "#8f8f8f" },
  ice: { light: "#e8f1f8", dark: "#7aa3c7" },
  purple: { light: "#ede4f5", dark: "#8c6bb3" },
  coral: { light: "#f7e7dc", dark: "#cf7f6c" },
  night: { light: "#c7ccd3", dark: "#4f5d70" },
  tournament: { light: "#ededed", dark: "#5e8460" },
  sand: { light: "#f3e6c8", dark: "#c19a5b" },
} as const;

// Piece sets: the board library's MIT pieces, recoloured (our own sets only, nothing from chess.com).
export const PIECE_SETS = {
  classic: null,
  cream: { w: "#f3e7c9", b: "#4a3f35" },
  geo: "geo", // our own flat set, drawn in lib/geo-pieces.tsx
} as const;

export type Settings = { theme: keyof typeof THEMES; pieces: keyof typeof PIECE_SETS; sound: boolean; coords: boolean };

const DEFAULT: Settings = { theme: "green", pieces: "classic", sound: true, coords: true };
const KEY = "settings";
const subs = new Set<() => void>();
let cache: Settings | null = null;

export function getSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT;
  if (!cache) {
    try {
      const saved = { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
      // Drop values from older versions that no longer exist.
      if (!(saved.theme in THEMES)) saved.theme = DEFAULT.theme;
      if (!(saved.pieces in PIECE_SETS)) saved.pieces = DEFAULT.pieces;
      cache = saved;
    } catch {
      cache = DEFAULT;
    }
  }
  return cache!;
}

export function setSettings(patch: Partial<Settings>) {
  cache = { ...getSettings(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(cache));
  subs.forEach((f) => f());
}

export function useSettings() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    getSettings,
    () => DEFAULT,
  );
}
