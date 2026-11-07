// Server helpers shared by the `online` and `sweep` Edge Functions: creating games, finishing them
// (My games rows, ratings, arena scores), Puzzle Battles and the background sweep.
import type { SupabaseClient } from "@supabase/supabase-js";
import { Chess } from "chess.js";
import { applyAction, isTimed, replay, timeLeft, type GameRow, type Side } from "./online-rules.ts";

type Db = SupabaseClient;
type Row = GameRow & Record<string, unknown> & { id: string };
export type Kind = "bullet" | "blitz" | "rapid" | "daily";

/** Rated speed for a time control (no clock = unrated, null). */
export const kindOf = (minutes: number, days: number): Kind | null => (days ? "daily" : minutes === 1 ? "bullet" : minutes === 3 || minutes === 5 ? "blitz" : minutes === 10 ? "rapid" : null);

/** Elo with a bigger step for new players (first 20 games). Returns [new A, new B]. */
export function elo(a: number, b: number, scoreA: number, gamesA: number, gamesB: number) {
  const expA = 1 / (1 + 10 ** ((b - a) / 400));
  const kA = gamesA < 20 ? 40 : 20;
  const kB = gamesB < 20 ? 40 : 20;
  return [Math.round(a + kA * (scoreA - expA)), Math.round(b + kB * (1 - scoreA - (1 - expA)))];
}

/** A player's rating for a speed; first time it's seeded from their welcome-screen level. */
export async function getRating(db: Db, uid: string, kind: Kind | "battle") {
  if (kind === "battle") return ((await db.from("profiles").select("puzzle_rating").eq("id", uid).maybeSingle()).data?.puzzle_rating as number) ?? 1500;
  const { data } = await db.from("ratings").select("rating, games").eq("user_id", uid).eq("kind", kind).maybeSingle();
  if (data) return data.rating as number;
  const skill = (await db.from("profiles").select("skill").eq("id", uid).maybeSingle()).data?.skill as number | null;
  const seed = skill ? 400 + Math.round(((skill - 1) * 1600) / 99) : 1200;
  await db.from("ratings").upsert({ user_id: uid, kind, rating: seed, games: 0 }, { onConflict: "user_id,kind", ignoreDuplicates: true });
  return seed;
}

export const usernameOf = async (db: Db, uid: string) => ((await db.from("profiles").select("username").eq("id", uid).maybeSingle()).data?.username as string) ?? "Player";

/** Start a game between two players right away (matchmaking, arenas). Colours are random. */
export async function startGame(db: Db, a: string, b: string, o: { minutes: number; days: number; rated: boolean; tournament_id?: string }) {
  const [white, black] = Math.random() < 0.5 ? [a, b] : [b, a];
  const kind = kindOf(o.minutes, o.days);
  const ms = o.days ? 0 : o.minutes * 60000;
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("online_games")
    .insert({
      created_by: a, white, black, white_name: await usernameOf(db, white), black_name: await usernameOf(db, black),
      status: "active", time_ms: ms, white_ms: ms, black_ms: ms, daily_days: o.days,
      rated: o.rated && !!kind, kind,
      white_rating: kind ? await getRating(db, white, kind) : null, black_rating: kind ? await getRating(db, black, kind) : null,
      tournament_id: o.tournament_id ?? null,
      ...(o.days ? { turn_started_at: now } : {}),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** Everything that happens once when a game ends: My games rows, ratings, arena scores. */
export async function finishGame(db: Db, row: Row) {
  if (row.result === null) return; // aborted / cancelled: nothing to record
  const g = replay(row.moves as string[]);
  g.setHeader("Event", row.tournament_id ? "ChessSite arena game" : "ChessSite online game");
  g.setHeader("White", String(row.white_name));
  g.setHeader("Black", String(row.black_name));
  const pgn = g.pgn();
  const tc = row.daily_days ? `${row.daily_days} days/move` : row.time_ms ? `${Number(row.time_ms) / 60000} min` : "none";
  const patch: Record<string, unknown> = {};

  // Ratings (rated games only).
  if (row.rated && row.kind && row.white && row.black) {
    const get = async (uid: string) => (await db.from("ratings").select("rating, games").eq("user_id", uid).eq("kind", row.kind).maybeSingle()).data ?? { rating: 1200, games: 0 };
    const [w, b] = [await get(String(row.white)), await get(String(row.black))];
    const score = row.result === "w" ? 1 : row.result === "b" ? 0 : 0.5;
    const [nw, nb] = elo(w.rating, b.rating, score, w.games, b.games);
    await db.from("ratings").upsert([
      { user_id: row.white, kind: row.kind, rating: nw, games: w.games + 1 },
      { user_id: row.black, kind: row.kind, rating: nb, games: b.games + 1 },
    ]);
    Object.assign(patch, { white_change: nw - w.rating, black_change: nb - b.rating });
  }

  // My games for both players.
  for (const side of ["w", "b"] as Side[]) {
    const uid = side === "w" ? row.white : row.black;
    if (!uid) continue;
    const result = row.result === "draw" ? "draw" : row.result === side ? "win" : "loss";
    const { data } = await db
      .from("games")
      .insert({ user_id: uid, pgn, result, reason: String(row.reason).slice(0, 60), my_color: side, mode: "online", bot: String(side === "w" ? row.black_name : row.white_name).slice(0, 40), time_control: tc })
      .select("id")
      .single();
    if (data) patch[side === "w" ? "white_game_id" : "black_game_id"] = data.id;
  }
  await db.from("online_games").update(patch).eq("id", row.id);

  // Arena: win 2, draw 1, loss 0; both players go back to waiting while the arena runs.
  if (row.tournament_id) {
    const { data: t } = await db.from("tournaments").select("ends_at").eq("id", row.tournament_id).maybeSingle();
    const running = !!t && Date.parse(t.ends_at) > Date.now();
    for (const side of ["w", "b"] as Side[]) {
      const uid = side === "w" ? row.white : row.black;
      const { data: p } = await db.from("tournament_players").select("score, games, wins, active").eq("tournament_id", row.tournament_id).eq("user_id", uid).maybeSingle();
      if (!p) continue;
      const pts = row.result === "draw" ? 1 : row.result === side ? 2 : 0;
      await db
        .from("tournament_players")
        .update({ score: p.score + pts, games: p.games + 1, wins: p.wins + (pts === 2 ? 1 : 0), waiting: running && p.active })
        .eq("tournament_id", row.tournament_id)
        .eq("user_id", uid);
    }
  }
}

/** Apply a rules action and save it (only if nobody changed the game meanwhile); finish the game if it ended. */
export async function act(db: Db, g: Row, action: Parameters<typeof applyAction>[1], user: string, now: number) {
  const out = applyAction(g, action, user, now);
  if ("error" in out) return out;
  const patch = { ...out.patch, updated_at: new Date(now).toISOString() };
  const { data, error } = await db.from("online_games").update(patch).eq("id", g.id).eq("updated_at", g.updated_at as string).select("*");
  if (error) return { error: error.message };
  if (!data.length) return { error: "The game changed. Try again.", conflict: true };
  const row = data[0] as Row;
  if (row.status === "over" && g.status === "active") await finishGame(db, row);
  return { game: row };
}

// ── Puzzle Battle ────────────────────────────────────────────────────────────────────────────────
const BATTLE_MS = 180000;

async function lichessBatch(difficulty: string, nb: number) {
  const res = await fetch(`https://lichess.org/api/puzzle/batch/mix?nb=${nb}&difficulty=${difficulty}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Lichess puzzles: ${res.status}`);
  return ((await res.json()).puzzles ?? []) as { game: { pgn: string }; puzzle: { solution: string[]; rating: number } }[];
}

/** New battle: 40 puzzles getting harder, starting in 3 seconds, 3 minutes long. */
export async function startBattle(db: Db, a: string, b: string) {
  const sets = await Promise.all([lichessBatch("easiest", 10), lichessBatch("normal", 15), lichessBatch("harder", 15)]);
  const puzzles = sets.flat().map((p) => {
    const g = new Chess();
    g.loadPgn(p.game.pgn);
    return { fen: g.fen(), solution: p.puzzle.solution, rating: p.puzzle.rating };
  });
  const starts = Date.now() + 3000;
  const [white, black] = Math.random() < 0.5 ? [a, b] : [b, a];
  const { data, error } = await db
    .from("battles")
    .insert({ white, black, white_name: await usernameOf(db, white), black_name: await usernameOf(db, black), starts_at: new Date(starts).toISOString(), ends_at: new Date(starts + BATTLE_MS).toISOString() })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await db.from("battle_puzzles").insert(puzzles.map((p, idx) => ({ battle_id: data.id, idx, ...p })));
  return data.id as string;
}

type Battle = Record<string, unknown> & { id: string; white: string; black: string; status: string; ends_at: string; starts_at: string };

/** End the battle if time is up or both players have 3 strikes. */
async function settleBattle(db: Db, b: Battle) {
  if (b.status !== "active") return b;
  const out = Date.now() > Date.parse(b.ends_at) || (Number(b.white_strikes) >= 3 && Number(b.black_strikes) >= 3);
  if (!out) return b;
  const ws = Number(b.white_score), bs = Number(b.black_score);
  const result = ws > bs ? "w" : bs > ws ? "b" : "draw";
  const { data } = await db.from("battles").update({ status: "over", result }).eq("id", b.id).eq("status", "active").select("*");
  return (data?.[0] as Battle) ?? { ...b, status: "over", result };
}

/** The position I'm looking at right now (puzzle start + the moves I've already got right). */
async function myPosition(db: Db, b: Battle, side: Side) {
  const idx = Number(b[side === "w" ? "white_idx" : "black_idx"]);
  const step = Number(b[side === "w" ? "white_step" : "black_step"]);
  const { data: p } = await db.from("battle_puzzles").select("fen, solution").eq("battle_id", b.id).eq("idx", idx).maybeSingle();
  if (!p) return null;
  const g = new Chess(p.fen);
  for (const m of (p.solution as string[]).slice(0, step)) g.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
  return { idx, step, g, solution: p.solution as string[] };
}

export async function battleState(db: Db, id: string, user: string) {
  const { data } = await db.from("battles").select("*").eq("id", id).maybeSingle();
  if (!data) return { error: "Battle not found." };
  const b = await settleBattle(db, data as Battle);
  const side: Side | null = b.white === user ? "w" : b.black === user ? "b" : null;
  if (!side) return { error: "Not your battle." };
  const pos = await myPosition(db, b, side);
  return { battle: b, fen: pos?.g.fen() ?? null, idx: pos?.idx ?? 0 };
}

/** Check one move: right → next step / next puzzle (+1); wrong → strike and next puzzle. */
export async function battleMove(db: Db, id: string, user: string, uci: string) {
  const { data } = await db.from("battles").select("*").eq("id", id).maybeSingle();
  if (!data) return { error: "Battle not found." };
  const b = await settleBattle(db, data as Battle);
  const side: Side | null = b.white === user ? "w" : b.black === user ? "b" : null;
  if (!side) return { error: "Not your battle." };
  if (b.status !== "active" || Date.now() < Date.parse(b.starts_at)) return { error: "The battle isn't running." };
  const k = side === "w" ? "white" : "black";
  if (Number(b[`${k}_strikes`]) >= 3) return { error: "You're out: 3 mistakes." };
  const pos = await myPosition(db, b, side);
  if (!pos) return { error: "No more puzzles." };
  let correct = uci === pos.solution[pos.step];
  try {
    pos.g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    if (pos.g.isCheckmate()) correct = true; // any mate counts
  } catch {
    return { error: "Illegal move." };
  }
  // Right move: solved if it mates or was the last move, else the puzzle's reply comes next.
  let step = pos.step + 1;
  let reply: string | null = null;
  let solved = false;
  if (correct) {
    if (pos.g.isCheckmate() || step >= pos.solution.length) solved = true;
    else {
      reply = pos.solution[step];
      step++;
      solved = step >= pos.solution.length;
    }
  }
  const done = !correct || solved;
  const patch: Record<string, unknown> = done
    ? { [`${k}_idx`]: pos.idx + 1, [`${k}_step`]: 0, ...(correct ? { [`${k}_score`]: Number(b[`${k}_score`]) + 1 } : { [`${k}_strikes`]: Number(b[`${k}_strikes`]) + 1 }) }
    : { [`${k}_step`]: step };
  const { data: up } = await db.from("battles").update(patch).eq("id", id).select("*");
  const after = await settleBattle(db, (up?.[0] as Battle) ?? b);
  const next = done ? await myPosition(db, after, side) : null;
  return { correct, solved, reply, battle: after, fen: done ? (next?.g.fen() ?? null) : null };
}

// ── Background sweep (every 5 minutes via pg_cron) ───────────────────────────────────────────────
export async function sweep(db: Db) {
  const now = Date.now();
  const report = { timedOut: 0, seeks: 0, battles: 0, arenas: 0 };

  // Games whose side to move ran out of time while nobody was watching (daily deadlines, abandoned games).
  const { data: games } = await db.from("online_games").select("*").eq("status", "active").not("turn_started_at", "is", null).limit(500);
  for (const g of (games ?? []) as Row[]) {
    if (!isTimed(g)) continue;
    const turn: Side = (g.moves as string[]).length % 2 === 0 ? "w" : "b";
    if (timeLeft(g, turn, now) > 0) continue;
    const winner = String(turn === "w" ? g.black : g.white);
    const out = await act(db, g, { type: "flag" }, winner, now);
    if ("game" in out) report.timedOut++;
  }

  // Searches nobody is waiting on any more.
  const { count } = await db.from("seeks").delete({ count: "exact" }).lt("last_seen", new Date(now - 60000).toISOString());
  report.seeks = count ?? 0;

  // Finished Puzzle Battles.
  const { data: battles } = await db.from("battles").select("*").eq("status", "active").lt("ends_at", new Date(now).toISOString());
  for (const b of (battles ?? []) as Battle[]) {
    await settleBattle(db, b);
    report.battles++;
  }

  // Always have an Hourly Blitz Arena coming up (3 min games, 30 minutes long).
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  const { data: soon } = await db.from("tournaments").select("id").gte("starts_at", new Date(now).toISOString()).lte("starts_at", next.toISOString()).is("created_by", null);
  if (!soon?.length) {
    await db.from("tournaments").insert({ name: "Hourly Blitz Arena", minutes: 3, starts_at: next.toISOString(), ends_at: new Date(next.getTime() + 30 * 60000).toISOString(), created_by: null });
    report.arenas++;
  }
  return report;
}
