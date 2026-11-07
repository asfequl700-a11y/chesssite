// Edge Function `online`: the only way to change a live game. Checks who you are, applies the rules
// in ../_shared/online-rules.ts, and saves. Both players get the change through Supabase Realtime.
import { createClient } from "@supabase/supabase-js";
import { applyAction, replay, type Action, type GameRow } from "../_shared/online-rules.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const TIMES = [0, 1, 3, 5, 10];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: auth } = await db.auth.getUser(jwt);
  const user = auth.user;
  if (!user) return json({ error: "Please log in to play online." }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }
  const now = Date.now();
  const id = typeof body.id === "string" ? body.id : "";
  const name = async (uid: string) => ((await db.from("profiles").select("username").eq("id", uid).maybeSingle()).data?.username as string) ?? "Player";
  const load = async () => (await db.from("online_games").select("*").eq("id", id).maybeSingle()).data as (GameRow & Record<string, unknown>) | null;

  switch (body.action) {
    case "create": {
      const minutes = Number(body.minutes);
      if (!TIMES.includes(minutes)) return json({ error: "Pick 1, 3, 5 or 10 minutes, or no clock." }, 400);
      const color = body.color === "random" ? (Math.random() < 0.5 ? "white" : "black") : body.color === "black" ? "black" : "white";
      const ms = minutes * 60000;
      const { data, error } = await db
        .from("online_games")
        .insert({ created_by: user.id, [color]: user.id, [`${color}_name`]: await name(user.id), time_ms: ms, white_ms: ms, black_ms: ms })
        .select("id")
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ id: data.id, now });
    }

    case "peek": {
      // What someone opening an invite link may see before joining.
      const g = await load();
      if (!g) return json({ error: "Game not found. Ask your friend for a new link." }, 404);
      return json({ status: g.status, time_ms: g.time_ms, host: g.white_name || g.black_name, mine: [g.white, g.black, g.created_by].includes(user.id), now });
    }

    case "join": {
      const g = await load();
      if (!g) return json({ error: "Game not found." }, 404);
      if (g.status !== "waiting") return json({ error: "Someone already joined this game." }, 409);
      if (g.created_by === user.id) return json({ error: "Send the link to a friend: you can't play yourself." }, 400);
      const slot = g.white ? "black" : "white";
      const { data, error } = await db
        .from("online_games")
        .update({ [slot]: user.id, [`${slot}_name`]: await name(user.id), status: "active", updated_at: new Date(now).toISOString() })
        .eq("id", id)
        .eq("status", "waiting") // two people joining at once: only the first wins
        .select("id");
      if (error) return json({ error: error.message }, 500);
      if (!data.length) return json({ error: "Someone already joined this game." }, 409);
      return json({ ok: true, now });
    }

    case "cancel": {
      const { error } = await db.from("online_games").update({ status: "over", reason: "cancelled", updated_at: new Date(now).toISOString() }).eq("id", id).eq("created_by", user.id).eq("status", "waiting");
      return error ? json({ error: error.message }, 500) : json({ ok: true, now });
    }

    case "rematch": {
      const g = await load();
      if (!g || g.status !== "over" || ![g.white, g.black].includes(user.id)) return json({ error: "No rematch possible." }, 400);
      if (g.rematch_id) return json({ id: g.rematch_id, now });
      // Swap colours.
      const { data: fresh, error } = await db
        .from("online_games")
        .insert({
          created_by: user.id, white: g.black, black: g.white, white_name: g.black_name, black_name: g.white_name,
          status: "active", time_ms: g.time_ms, white_ms: g.time_ms, black_ms: g.time_ms,
        })
        .select("id")
        .single();
      if (error) return json({ error: error.message }, 500);
      // Both players may click at once: keep only the first rematch.
      const { data: set } = await db.from("online_games").update({ rematch_id: fresh.id }).eq("id", id).is("rematch_id", null).select("rematch_id");
      if (!set?.length) {
        await db.from("online_games").delete().eq("id", fresh.id);
        return json({ id: (await load())?.rematch_id, now });
      }
      return json({ id: fresh.id, now });
    }

    default: {
      const g = await load();
      if (!g) return json({ error: "Game not found." }, 404);
      const out = applyAction(g, { ...(body as object), type: body.action } as Action, user.id, now);
      if ("error" in out) return json({ error: out.error, now }, 400);
      const patch = { ...out.patch, updated_at: new Date(now).toISOString() };
      // Only apply if nobody changed the game in the meantime (two requests at once).
      const { data, error } = await db.from("online_games").update(patch).eq("id", id).eq("updated_at", g.updated_at as string).select("*");
      if (error) return json({ error: error.message }, 500);
      if (!data.length) return json({ error: "The game changed. Try again.", now }, 409);
      const row = data[0];
      if (row.status === "over" && row.result !== null && g.status === "active") await saveForBoth(db, row);
      return json({ game: row, now });
    }
  }
});

/** Finished online games go into both players' My games (accuracy is filled in by their browsers). */
async function saveForBoth(db: ReturnType<typeof createClient>, row: Record<string, unknown>) {
  const g = replay(row.moves as string[]);
  g.setHeader("Event", "ChessSite online game");
  g.setHeader("White", String(row.white_name));
  g.setHeader("Black", String(row.black_name));
  const pgn = g.pgn();
  const tc = row.time_ms ? `${Number(row.time_ms) / 60000} min` : "none";
  const ids: Record<string, number> = {};
  for (const side of ["w", "b"] as const) {
    const uid = side === "w" ? row.white : row.black;
    if (!uid) continue;
    const result = row.result === "draw" ? "draw" : row.result === side ? "win" : "loss";
    const { data } = await db
      .from("games")
      .insert({ user_id: uid, pgn, result, reason: String(row.reason).slice(0, 60), my_color: side, mode: "online", bot: String(side === "w" ? row.black_name : row.white_name).slice(0, 40), time_control: tc })
      .select("id")
      .single();
    if (data) ids[side === "w" ? "white_game_id" : "black_game_id"] = data.id;
  }
  await db.from("online_games").update(ids).eq("id", row.id);
}
