import { Chess } from "chess.js";
import type { Engine } from "./engine";
import { coachText, fenKey, labelMove, moveAccuracy, uciToSan, winChance, type ReviewedMove } from "./review";

export type Review = { moves: (ReviewedMove & { coach: string })[]; startCp: number; startFen: string };

let openings: Promise<Set<string>> | null = null;
/** Positions from the Lichess opening list (public/openings.json, built by scripts/build-openings.mjs). */
export function openingSet() {
  openings ??= fetch("/openings.json")
    .then((r) => r.json())
    .then((rows: string[][]) => new Set(rows.map((r) => r[3])))
    .catch(() => new Set<string>());
  return openings;
}

/** Score the position for a review. Checkmate/stalemate are scored by the rules, not the engine. */
async function score(engine: Engine, g: Chess, depth: number) {
  if (g.isCheckmate()) return { cp: g.turn() === "w" ? -10000 : 10000, best: "", second: undefined };
  if (g.isDraw() || g.isStalemate()) return { cp: 0, best: "", second: undefined };
  const { lines } = await engine.evaluate(g.fen(), depth, 2);
  return { cp: lines[0].cp, best: lines[0].best, second: lines[1]?.cp };
}

export async function runReview(pgn: string, engine: Engine, onProgress: (done: number, total: number) => void, depth = 12): Promise<Review> {
  const game = new Chess();
  game.loadPgn(pgn);
  const history = game.history({ verbose: true });
  const book = await openingSet();
  const g = new Chess(history[0]?.before);
  let prev = await score(engine, g, depth);
  const startCp = prev.cp;
  let inBook = true;
  const moves: Review["moves"] = [];

  for (let i = 0; i < history.length; i++) {
    const m = history[i];
    const fenBefore = g.fen();
    g.move(m.san);
    const now = await score(engine, g, depth);
    inBook = inBook && book.has(fenKey(g.fen()));
    const played = m.from + m.to + (m.promotion ?? "");
    const label = labelMove({ played, m, after: g, cpBefore: prev.cp, cpAfter: now.cp, best: prev.best, cpSecond: prev.second, book: inBook });
    const sign = m.color === "w" ? 1 : -1;
    const r: ReviewedMove = {
      san: m.san,
      from: m.from,
      to: m.to,
      color: m.color,
      fenAfter: g.fen(),
      cpAfter: now.cp,
      label,
      bestSan: prev.best && prev.best !== played ? uciToSan(fenBefore, prev.best) : "",
      accuracy: label === "book" ? 100 : moveAccuracy(winChance(sign * prev.cp), winChance(sign * now.cp)),
    };
    moves.push({ ...r, coach: coachText(r, m, g) });
    prev = now;
    onProgress(i + 1, history.length);
  }
  return { moves, startCp, startFen: history[0]?.before ?? g.fen() };
}
