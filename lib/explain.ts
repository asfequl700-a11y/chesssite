// Plain-English reasons for a move, from simple rules about the position (no engine needed).
// Used by coachText in lib/review.ts. Tests: scripts/check-game.ts.
import { Chess, type Move, type Square } from "chess.js";

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
export const PIECE: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const FILES = "abcdefgh";
const other = (c: "w" | "b") => (c === "w" ? "b" : "w");

function squares(g: Chess, color: "w" | "b") {
  return g.board().flat().filter((p): p is NonNullable<typeof p> => !!p && p.color === color);
}

/** Can `color` lose the piece on `sq`? Attacked and either undefended or attacked by something cheaper. */
function inDanger(g: Chess, sq: Square) {
  const p = g.get(sq);
  if (!p || p.type === "k") return false;
  const attackers = g.attackers(sq, other(p.color));
  if (!attackers.length) return false;
  const cheapest = Math.min(...attackers.map((a) => VALUE[g.get(a)!.type]));
  return g.attackers(sq, p.color).length === 0 || cheapest < VALUE[p.type];
}

/** A move that checkmates right away, or "". */
export function mateInOne(g: Chess) {
  for (const m of g.moves({ verbose: true })) {
    const t = new Chess(g.fen());
    t.move(m.san);
    if (t.isCheckmate()) return m.san;
  }
  return "";
}

/** Enemy pieces worth more than the piece on `sq` (or the king, if checked) that it attacks. */
function forkTargets(g: Chess, sq: Square) {
  const me = g.get(sq);
  if (!me) return [];
  return squares(g, other(me.color))
    .filter((t) => g.attackers(t.square, me.color).includes(sq))
    .filter((t) => t.type === "k" || VALUE[t.type] > VALUE[me.type] || (VALUE[t.type] >= 3 && !g.attackers(t.square, t.color).length))
    .map((t) => t.type);
}

/** A sliding piece on `sq` lines up two enemy pieces: pin (front one shields a bigger piece) or skewer. */
function lineTactic(g: Chess, sq: Square): { kind: "pin" | "skewer"; front: string; back: string } | null {
  const me = g.get(sq);
  if (!me || !"brq".includes(me.type)) return null;
  const dirs = [
    ...(me.type !== "b" ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : []),
    ...(me.type !== "r" ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : []),
  ];
  for (const [df, dr] of dirs) {
    let f = FILES.indexOf(sq[0]);
    let r = Number(sq[1]);
    const hit: { type: string; color: string }[] = [];
    while (hit.length < 2) {
      f += df;
      r += dr;
      if (f < 0 || f > 7 || r < 1 || r > 8) break;
      const p = g.get(`${FILES[f]}${r}` as Square);
      if (!p) continue;
      if (p.color === me.color) break;
      hit.push(p);
    }
    if (hit.length < 2) continue;
    const [front, back] = hit.map((p) => p.type);
    if (front !== "k" && (back === "k" || VALUE[back] > VALUE[front]) && VALUE[back] >= 5) return { kind: "pin", front, back };
    if ((front === "k" || VALUE[front] > VALUE[back]) && VALUE[back] >= 3) return { kind: "skewer", front, back };
  }
  return null;
}

/** Material balance from `color`'s side (pawn = 1). */
export function material(g: Chess, color: "w" | "b") {
  const sum = (c: "w" | "b") => squares(g, c).reduce((s, p) => s + (p.type === "k" ? 0 : VALUE[p.type]), 0);
  return sum(color) - sum(other(color));
}

/** Tactic created by the move just played (g = position after it), as a sentence fragment. */
function tacticOf(m: Move, g: Chess, verb: "does" | "would") {
  const fork = forkTargets(g, m.to as Square);
  if (fork.length >= 2 && !inDanger(g, m.to as Square)) {
    const [a, b] = fork.sort((x, y) => VALUE[y] - VALUE[x]);
    return `${m.san} ${verb === "does" ? "forks" : "would fork"} the ${PIECE[a]} and the ${PIECE[b]}.`;
  }
  const line = lineTactic(g, m.to as Square);
  if (line?.kind === "pin") return `${m.san} ${verb === "does" ? "pins" : "would pin"} the ${PIECE[line.front]} to the ${PIECE[line.back]}.`;
  if (line?.kind === "skewer") return `${m.san} ${verb === "does" ? "skewers" : "would skewer"} the ${PIECE[line.front]} and the ${PIECE[line.back]}.`;
  return "";
}

export type Reason = { text: string; namesBest: boolean };

/**
 * The best reason a move was bad (or good), or null. `bestSan` = engine's better move ("" if the move was best).
 * Checked in order of importance: allowed mate, missed mate, hanging piece, missed capture,
 * missed fork/pin/skewer, castling given up, trading when behind.
 */
export function explainBad(m: Move, after: Chess, bestSan: string): Reason | null {
  const before = new Chess(m.before);
  const opp = m.color === "w" ? "Black" : "White";

  const mate = mateInOne(after);
  if (mate) return { text: `This lets ${opp} checkmate with ${mate}.`, namesBest: false };

  const myMate = mateInOne(before);
  if (myMate) return { text: `You had checkmate with ${myMate}!`, namesBest: myMate === bestSan };

  // A piece of mine is now loose: the moved piece first, else the most valuable one that wasn't loose before.
  const trade = !!m.captured && VALUE[m.captured] >= VALUE[m.piece]; // capturing back is the opponent's normal reply
  const loose = squares(after, m.color)
    .filter((p) => inDanger(after, p.square) && (p.square === m.to ? !trade : !inDanger(before, p.square)))
    .sort((a, b) => Number(b.square === m.to) - Number(a.square === m.to) || VALUE[b.type] - VALUE[a.type])[0];
  if (loose) return { text: `Your ${PIECE[loose.type]} on ${loose.square} can now be taken for free.`, namesBest: false };

  if (bestSan) {
    const t = new Chess(m.before);
    const best = t.move(bestSan);
    if (best.captured && inDanger(before, best.to as Square)) return { text: `${bestSan} wins the ${PIECE[best.captured]} on ${best.to} for free.`, namesBest: true };
    const tactic = tacticOf(best, t, "would");
    if (tactic) return { text: tactic, namesBest: true };
  }

  const rights = (fen: string) => fen.split(" ")[2];
  const mine = m.color === "w" ? /[KQ]/g : /[kq]/g;
  const had = (rights(m.before).match(mine) ?? []).length;
  const has = (rights(after.fen()).match(mine) ?? []).length;
  if ((m.piece === "k" || m.piece === "r") && !m.isKingsideCastle() && !m.isQueensideCastle() && has < had)
    return { text: `Moving your ${PIECE[m.piece]} gives up castling${has ? " on one side" : ""}, so your king may get stuck in the middle.`, namesBest: false };

  if (m.captured && material(before, m.color) <= -2 && VALUE[m.captured] === VALUE[m.piece])
    return { text: "You're behind in material, so trading pieces makes it harder to come back.", namesBest: false };

  return null;
}

/** Something good the move did: a tactic, or a trade while ahead. */
export function explainGood(m: Move, after: Chess): string {
  const tactic = tacticOf(m, after, "does");
  if (tactic) return tactic;
  const before = new Chess(m.before);
  if (m.captured && material(before, m.color) >= 2 && VALUE[m.captured] === VALUE[m.piece])
    return "Trading pieces when you're ahead is smart: fewer pieces make the win easier.";
  return "";
}
