// Rules for live online games, run on the server (Edge Function `online`) so a player can't cheat by
// editing the page. Pure: takes the game row + an action, returns the changes or an error.
// Tested in scripts/check-game.ts. "chess.js" maps to npm:chess.js in Deno (see ../online/deno.json).
import { Chess } from "chess.js";

export type Side = "w" | "b";
export type GameRow = {
  status: "waiting" | "active" | "over";
  white: string | null;
  black: string | null;
  time_ms: number;
  white_ms: number;
  black_ms: number;
  turn_started_at: string | null;
  moves: string[];
  result: Side | "draw" | null;
  reason: string;
  draw_offer: Side | null;
};
export type Action =
  | { type: "move"; uci: string }
  | { type: "resign" }
  | { type: "offer_draw" }
  | { type: "accept_draw" }
  | { type: "decline_draw" }
  | { type: "abort" }
  | { type: "flag" };
export type Outcome = { patch: Partial<GameRow> & { fen?: string } } | { error: string };

const other = (s: Side): Side => (s === "w" ? "b" : "w");
const msKey = (s: Side) => (s === "w" ? "white_ms" : "black_ms");

/** The game replayed from its moves (keeps the history, so repetition draws are detected). */
export function replay(moves: string[]) {
  const g = new Chess();
  for (const m of moves) g.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
  return g;
}

/** Time left for a side right now (the side to move loses time since its clock started). */
export function timeLeft(row: GameRow, side: Side, now: number) {
  const base = row[msKey(side)];
  if (!row.time_ms || row.status !== "active" || !row.turn_started_at) return base;
  const turn: Side = row.moves.length % 2 === 0 ? "w" : "b";
  return turn === side ? base - (now - Date.parse(row.turn_started_at)) : base;
}

/** Can this side still checkmate? (Lone king, or king + one knight/bishop, can't.) */
function canMate(g: Chess, side: Side) {
  const pieces = g.board().flat().filter((p) => p && p.color === side && p.type !== "k");
  return !(pieces.length === 0 || (pieces.length === 1 && "nb".includes(pieces[0]!.type)));
}

/** Result when `loser` runs out of time: a loss, unless the other side can't checkmate (then a draw). */
function timeout(row: GameRow, loser: Side, now: number): Outcome {
  const g = replay(row.moves);
  const winner = other(loser);
  return {
    patch: {
      status: "over",
      result: canMate(g, winner) ? winner : "draw",
      reason: canMate(g, winner) ? "on time" : "timeout vs insufficient material",
      [msKey(loser)]: 0,
      [msKey(winner)]: timeLeft(row, winner, now),
      draw_offer: null,
    },
  };
}

/** Freeze both clocks at the moment the game ends. */
const frozen = (row: GameRow, now: number) => ({ white_ms: Math.max(0, timeLeft(row, "w", now)), black_ms: Math.max(0, timeLeft(row, "b", now)) });

export function applyAction(row: GameRow, action: Action, user: string, now: number): Outcome {
  const me: Side | null = row.white === user ? "w" : row.black === user ? "b" : null;
  if (!me) return { error: "You are not playing in this game." };
  if (row.status !== "active") return { error: "This game is not being played." };
  const turn: Side = row.moves.length % 2 === 0 ? "w" : "b";

  switch (action.type) {
    case "move": {
      if (turn !== me) return { error: "It's not your turn." };
      if (row.time_ms && timeLeft(row, me, now) <= 0) return timeout(row, me, now);
      if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(action.uci)) return { error: "Bad move format." };
      const g = replay(row.moves);
      try {
        g.move({ from: action.uci.slice(0, 2), to: action.uci.slice(2, 4), promotion: action.uci[4] });
      } catch {
        return { error: "Illegal move." };
      }
      const patch: Outcome & { patch: Record<string, unknown> } = {
        patch: {
          moves: [...row.moves, action.uci],
          fen: g.fen(),
          // The clock starts after White's first move, like over the board.
          [msKey(me)]: row.time_ms && row.turn_started_at ? timeLeft(row, me, now) : row[msKey(me)],
          turn_started_at: new Date(now).toISOString(),
          // Moving answers a draw offer with "no"; your own offer stays open.
          draw_offer: row.draw_offer === me ? me : null,
        },
      };
      const over = g.isCheckmate()
        ? { result: me, reason: "by checkmate" }
        : g.isStalemate()
          ? { result: "draw" as const, reason: "by stalemate" }
          : g.isInsufficientMaterial()
            ? { result: "draw" as const, reason: "by insufficient material" }
            : g.isThreefoldRepetition()
              ? { result: "draw" as const, reason: "by repetition" }
              : g.isDrawByFiftyMoves()
                ? { result: "draw" as const, reason: "by the 50-move rule" }
                : null;
      if (over) Object.assign(patch.patch, { status: "over", draw_offer: null, ...over });
      return patch as Outcome;
    }
    case "flag": {
      // Either player can ask the server to check the clock of the side to move.
      if (!row.time_ms || timeLeft(row, turn, now) > 0) return { error: "No one has run out of time." };
      return timeout(row, turn, now);
    }
    case "resign":
      return { patch: { status: "over", result: other(me), reason: "by resignation", draw_offer: null, ...frozen(row, now) } };
    case "abort":
      if (row.moves.length >= 2) return { error: "Too late to abort: resign instead." };
      return { patch: { status: "over", result: null, reason: "aborted", draw_offer: null, ...frozen(row, now) } };
    case "offer_draw":
      if (row.draw_offer === other(me)) return applyAction(row, { type: "accept_draw" }, user, now);
      return { patch: { draw_offer: me } };
    case "accept_draw":
      if (row.draw_offer !== other(me)) return { error: "There is no draw offer to accept." };
      return { patch: { status: "over", result: "draw", reason: "by agreement", draw_offer: null, ...frozen(row, now) } };
    case "decline_draw":
      if (row.draw_offer !== other(me)) return { error: "There is no draw offer." };
      return { patch: { draw_offer: null } };
    default:
      return { error: "Unknown action." };
  }
}
