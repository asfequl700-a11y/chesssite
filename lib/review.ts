// Game review math. Win chance + accuracy use Lichess's open formulas (lichess.org/page/accuracy).
import { Chess, type Move } from "chess.js";
import { explainBad, explainGood } from "./explain";

export type Label = "brilliant" | "great" | "best" | "excellent" | "good" | "book" | "inaccuracy" | "mistake" | "blunder";

export const LABELS: Record<Label, { name: string; color: string; sym: string }> = {
  brilliant: { name: "Brilliant", color: "#26c2a3", sym: "!!" },
  great: { name: "Great", color: "#5c8bb0", sym: "!" },
  best: { name: "Best", color: "#81b64c", sym: "★" },
  excellent: { name: "Excellent", color: "#96bc4b", sym: "👍" },
  good: { name: "Good", color: "#77915f", sym: "✓" },
  book: { name: "Book", color: "#a88865", sym: "📖" },
  inaccuracy: { name: "Inaccuracy", color: "#f7c631", sym: "?!" },
  mistake: { name: "Mistake", color: "#ffa459", sym: "?" },
  blunder: { name: "Blunder", color: "#fa412d", sym: "??" },
};

/** White's chance to win (0-100) from a centipawn score in White's view. */
export const winChance = (cp: number) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);

/** Accuracy (0-100) of one move from the mover's win chance before and after. */
export const moveAccuracy = (before: number, after: number) =>
  Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * Math.max(0, before - after)) - 3.1669));

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** True if the moved piece now sits where the opponent can win it (a sacrifice). */
function isSacrifice(after: Chess, m: Move) {
  if (m.piece === "p" || m.piece === "k") return false;
  const them = after.turn();
  const attackers = after.attackers(m.to, them);
  if (!attackers.length) return false;
  const gained = m.captured ? VALUE[m.captured] : 0;
  const cheapest = Math.min(...attackers.map((sq) => VALUE[after.get(sq)?.type ?? "q"] || 9));
  const defended = after.attackers(m.to, m.color).length > 0;
  return VALUE[m.piece] > gained && (!defended || cheapest < VALUE[m.piece]);
}

export type ReviewedMove = {
  san: string;
  from: string;
  to: string;
  color: "w" | "b";
  fenAfter: string;
  cpAfter: number; // White's view
  label: Label;
  bestSan: string; // engine's best move in the position before ("" if the played move was best)
  accuracy: number;
};

/**
 * Label one move. `before`/`after` are White-view scores (cp); `best`/`second` are the engine's
 * top two moves in the position before (UCI); `book` = the position after is a known opening.
 */
export function labelMove(o: {
  played: string; // UCI
  m: Move;
  after: Chess;
  cpBefore: number;
  cpAfter: number;
  best: string;
  cpSecond?: number; // score of 2nd-best move, White view
  book: boolean;
}): Label {
  const sign = o.m.color === "w" ? 1 : -1;
  const wBefore = winChance(sign * o.cpBefore);
  const wAfter = winChance(sign * o.cpAfter);
  const loss = wBefore - wAfter;
  if (o.book) return "book";
  const isBest = o.played === o.best || loss <= 1;
  if (isBest && loss <= 2 && wBefore < 90 && wAfter > 30 && isSacrifice(o.after, o.m)) return "brilliant";
  if (isBest && o.cpSecond !== undefined && wBefore - winChance(sign * o.cpSecond) >= 20 && wAfter < 95) return "great";
  if (isBest) return "best";
  if (loss < 3) return "excellent";
  if (loss < 6) return "good";
  if (loss < 10) return "inaccuracy";
  if (loss < 20) return "mistake";
  return "blunder";
}

/** Average accuracy for one side. shortcut: plain mean; Lichess also weights by volatility. */
export function sideAccuracy(moves: ReviewedMove[], color: "w" | "b") {
  const mine = moves.filter((m) => m.color === color);
  return mine.length ? mine.reduce((s, m) => s + m.accuracy, 0) / mine.length : 100;
}

const piece: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

/** Coach line for a move: our own rules and templates (reasons come from lib/explain.ts). */
export function coachText(r: ReviewedMove, m: Move, after: Chess): string {
  const name = piece[m.piece];
  if (after.isCheckmate()) return `${r.san} is checkmate. Game over.`;
  const good = () => {
    const why = explainGood(m, after);
    return why ? ` ${why}` : "";
  };
  switch (r.label) {
    case "book":
      return `${r.san} is a known opening move. Thousands of players have played it.`;
    case "brilliant":
      return `${r.san} is brilliant! You gave up your ${name} and the engine says it works.${good()}`;
    case "great":
      return `${r.san} is great. It was the only move that keeps your position.${good()}`;
    case "best":
      return `${r.san} is the best move here.${good()}`;
    case "excellent":
    case "good": {
      const missed = r.bestSan ? explainBad(m, after, r.bestSan) : null;
      const base = `${r.san} is ${r.label === "good" ? "a good" : "an excellent"} move.`;
      return missed?.namesBest ? `${base} ${missed.text}` : `${base}${good()} The engine liked ${r.bestSan} a little more.`;
    }
    default: {
      const why = explainBad(m, after, r.bestSan);
      const a = r.label === "inaccuracy" ? "an" : "a";
      const better = r.bestSan && !why?.namesBest ? ` Better was ${r.bestSan}.` : "";
      return `${r.san} is ${a} ${r.label}.${why ? ` ${why.text}` : ""}${better}`;
    }
  }
}

/** Board + side to move part of a FEN, used to match opening positions. */
export const fenKey = (fen: string) => fen.split(" ").slice(0, 2).join(" ");

/** Convert a UCI move to SAN in the given position ("" if not legal). */
export function uciToSan(fen: string, uci: string) {
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return "";
  }
}
