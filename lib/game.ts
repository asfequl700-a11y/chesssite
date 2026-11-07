import type { Chess } from "chess.js";

const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 } as const;
const START = { p: 8, n: 2, b: 2, r: 2, q: 1 } as const;
type Kind = keyof typeof VALUE;

/** Pieces `color` has taken from the other side (weakest first) and its material lead (0 if behind). */
export function captured(fen: string, color: "w" | "b") {
  const board = fen.split(" ")[0];
  const theirs = color === "w" ? "pnbrq" : "PNBRQ";
  const count = (ch: string) => board.split(ch).length - 1;
  const taken: Kind[] = [];
  let mine = 0;
  let other = 0;
  for (const k of Object.keys(VALUE) as Kind[]) {
    const t = theirs["pnbrq".indexOf(k)];
    const o = t === k ? k.toUpperCase() : k; // my own piece letter
    taken.push(...Array<Kind>(Math.max(0, START[k] - count(t))).fill(k));
    mine += count(o) * VALUE[k];
    other += count(t) * VALUE[k];
  }
  return { taken, lead: Math.max(0, mine - other) };
}

/** Clock text like chess.com: 5:00, 0:42, tenths under 20 seconds (0:09.4); daily games: "2 days", "5 h 10 m". */
export function clockText(ms: number) {
  const t = Math.max(0, ms);
  if (t >= 86400000) return `${Math.floor(t / 86400000)} day${t >= 172800000 ? "s" : ""}${t % 86400000 >= 3600000 ? ` ${Math.floor((t % 86400000) / 3600000)} h` : ""}`;
  if (t >= 3600000) return `${Math.floor(t / 3600000)} h ${Math.floor((t % 3600000) / 60000)} m`;
  const m = Math.floor(t / 60000);
  const s = Math.floor(t / 1000) % 60;
  const base = `${m}:${String(s).padStart(2, "0")}`;
  return t < 20000 ? `${base}.${Math.floor(t / 100) % 10}` : base;
}

export type Result = { winner: "w" | "b" | null; reason: string };

/** Result from the rules alone (checkmate and the draw rules), or null while the game goes on. */
export function ruleResult(g: Chess): Result | null {
  if (g.isCheckmate()) return { winner: g.turn() === "w" ? "b" : "w", reason: "by checkmate" };
  if (g.isStalemate()) return { winner: null, reason: "by stalemate" };
  if (g.isInsufficientMaterial()) return { winner: null, reason: "by insufficient material" };
  if (g.isThreefoldRepetition()) return { winner: null, reason: "by repetition" };
  if (g.isDrawByFiftyMoves()) return { winner: null, reason: "by the 50-move rule" };
  return null;
}
