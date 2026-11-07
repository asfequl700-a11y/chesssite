import { Chess } from "chess.js";

export type Puzzle = { id: string; game: Chess; solution: string[]; rating: number; themes: string[] };
export type Difficulty = "easiest" | "easier" | "normal" | "harder" | "hardest";

// Theme ids from the Lichess puzzle database (sent as the API's `angle` option).
export const THEMES: { id: string; name: string }[] = [
  { id: "", name: "Any theme" },
  { id: "mateIn1", name: "Mate in 1" },
  { id: "mateIn2", name: "Mate in 2" },
  { id: "mateIn3", name: "Mate in 3" },
  { id: "fork", name: "Fork" },
  { id: "pin", name: "Pin" },
  { id: "skewer", name: "Skewer" },
  { id: "hangingPiece", name: "Hanging piece" },
  { id: "discoveredAttack", name: "Discovered attack" },
  { id: "sacrifice", name: "Sacrifice" },
  { id: "endgame", name: "Endgame" },
  { id: "rookEndgame", name: "Rook endgame" },
  { id: "opening", name: "Opening" },
];

/** A random puzzle from the free Lichess API. The board after the game's moves is the puzzle start. */
export async function fetchPuzzle(angle = "", difficulty: Difficulty = "normal"): Promise<Puzzle> {
  const q = new URLSearchParams({ difficulty, ...(angle ? { angle } : {}) });
  const res = await fetch(`https://lichess.org/api/puzzle/next?${q}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  const game = new Chess();
  game.loadPgn(data.game.pgn);
  return { id: data.puzzle.id, game, solution: data.puzzle.solution, rating: data.puzzle.rating, themes: data.puzzle.themes };
}

/** Lichess `difficulty` is relative to 1500 for guests (±300 / ±600 steps): pick the step nearest your rating. */
export function difficultyFor(rating: number): Difficulty {
  const steps: [number, Difficulty][] = [
    [-600, "easiest"],
    [-300, "easier"],
    [0, "normal"],
    [300, "harder"],
    [600, "hardest"],
  ];
  return steps.reduce((best, s) => (Math.abs(s[0] - (rating - 1500)) < Math.abs(best[0] - (rating - 1500)) ? s : best))[1];
}

/** Simple Elo: your new rating after a puzzle (solved = 1, failed = 0). K = 32. */
export function eloUpdate(rating: number, puzzleRating: number, solved: boolean, k = 32) {
  const expected = 1 / (1 + 10 ** ((puzzleRating - rating) / 400));
  return Math.round(rating + k * ((solved ? 1 : 0) - expected));
}

/** Puzzle Rush gets harder as you go: 5 puzzles per step. */
export const rushDifficulty = (solved: number): Difficulty => (["easiest", "easier", "normal", "harder", "hardest"] as const)[Math.min(4, Math.floor(solved / 5))];

/** Play a UCI move on the game. */
export const playUci = (g: Chess, uci: string) => g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
