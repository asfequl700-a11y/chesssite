"use client";

import { Chess } from "chess.js";
import { Engine } from "@/lib/engine";
import { fenKey, sideAccuracy } from "@/lib/review";
import { runReview } from "@/lib/run-review";
import { markActive } from "@/lib/activity";
import { supabase } from "@/lib/supabase";

export type GameRow = {
  id: number;
  pgn: string;
  result: "win" | "loss" | "draw";
  reason: string;
  my_color: "w" | "b";
  mode: "computer" | "friend";
  bot: string | null;
  time_control: string;
  accuracy: number | null;
  opening: string | null;
  played_at: string;
};

let names: Promise<Map<string, string>> | null = null;
/** Opening name for each known position (Lichess opening list in public/openings.json). */
function openingNames() {
  names ??= fetch("/openings.json")
    .then((r) => r.json())
    .then((rows: string[][]) => new Map(rows.map((r) => [r[3], r[1]])))
    .catch(() => new Map<string, string>());
  return names;
}

/** Name of the deepest known opening position reached in the game ("" if none). */
export async function openingName(g: Chess) {
  const map = await openingNames();
  const replay = new Chess();
  let name = "";
  for (const san of g.history()) {
    replay.move(san);
    name = map.get(fenKey(replay.fen())) ?? name;
  }
  return name;
}

/**
 * Save a finished game for the signed-in user (does nothing for guests), then work out the
 * player's accuracy in the background with a quick engine review and store it on the row.
 */
export async function saveGame(
  g: Chess,
  info: { result: GameRow["result"]; reason: string; my_color: "w" | "b"; mode: GameRow["mode"]; bot?: string; time_control: string },
) {
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session || g.history().length < 2) return;
  const { data, error } = await supabase
    .from("games")
    .insert({ ...info, pgn: g.pgn(), opening: (await openingName(g)) || null })
    .select("id")
    .single();
  if (error) return console.warn("Game not saved:", error.message);
  markActive();
  const engine = new Engine();
  try {
    const review = await runReview(g.pgn(), engine, () => {}, 10);
    const accuracy = Math.round(sideAccuracy(review.moves, info.my_color) * 10) / 10;
    await supabase.from("games").update({ accuracy }).eq("id", data.id);
  } catch (e) {
    console.warn("Accuracy not saved:", e);
  } finally {
    engine.quit();
  }
}

/** The signed-in user's games, newest first. */
export async function myGames() {
  const { data, error } = await supabase.from("games").select("*").order("played_at", { ascending: false }).limit(1000);
  if (error) throw error;
  return data as GameRow[];
}
