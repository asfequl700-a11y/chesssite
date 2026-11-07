// Edge Function `online`: the only way to change a live game. Checks who you are, applies the rules
// in ../_shared/online-rules.ts, and saves. Both players get the change through Supabase Realtime.
import { createClient } from "@supabase/supabase-js";
import { type Action, type GameRow } from "../_shared/online-rules.ts";
import { act, battleMove, battleState, getRating, kindOf, startBattle, startGame } from "../_shared/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const TIMES = [0, 1, 3, 5, 10];
const DAYS = [1, 2, 3, 5, 7]; // daily chess: days per move

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
  // Fair-play ban (set by hand in the Table Editor): no new games or moves.
  const { data: me } = await db.from("profiles").select("banned").eq("id", user.id).maybeSingle();
  if (me?.banned && ["create", "join", "rematch", "move", "seek", "arena_join", "arena_pair", "battle_move"].includes(String(body.action)))
    return json({ error: "Your account is under fair-play review, so online play is paused." }, 403);
  const id = typeof body.id === "string" ? body.id : "";
  const name = async (uid: string) => ((await db.from("profiles").select("username").eq("id", uid).maybeSingle()).data?.username as string) ?? "Player";
  const load = async () => (await db.from("online_games").select("*").eq("id", id).maybeSingle()).data as (GameRow & Record<string, unknown>) | null;

  switch (body.action) {
    case "create": {
      const minutes = Number(body.minutes ?? 0);
      const days = Number(body.days ?? 0);
      if (days ? !DAYS.includes(days) : !TIMES.includes(minutes)) return json({ error: "Pick 1, 3, 5 or 10 minutes, no clock, or 1-7 days per move." }, 400);
      const color = body.color === "random" ? (Math.random() < 0.5 ? "white" : "black") : body.color === "black" ? "black" : "white";
      const ms = days ? 0 : minutes * 60000;
      // Optional direct challenge: only this player may join (they get a notification).
      const to = typeof body.to === "string" ? body.to : null;
      if (to === user.id) return json({ error: "You can't challenge yourself." }, 400);
      const invitedName = to ? await name(to) : "";
      if (to && invitedName === "Player") return json({ error: "Player not found." }, 404);
      // One open challenge per player: a new one replaces any earlier challenge you sent them (no double taps piling up).
      if (to)
        await db.from("online_games").update({ status: "over", reason: "cancelled", updated_at: new Date(now).toISOString() })
          .eq("created_by", user.id).eq("invited", to).eq("status", "waiting");
      const { data, error } = await db
        .from("online_games")
        .insert({ created_by: user.id, [color]: user.id, [`${color}_name`]: await name(user.id), time_ms: ms, white_ms: ms, black_ms: ms, daily_days: days, invited: to, invited_name: invitedName })
        .select("id")
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ id: data.id, now });
    }

    case "peek": {
      // What someone opening an invite link may see before joining.
      const g = await load();
      if (!g) return json({ error: "Game not found. Ask your friend for a new link." }, 404);
      return json({ status: g.status, time_ms: g.time_ms, daily_days: g.daily_days, host: g.white_name || g.black_name, invited_name: g.invited_name, for_me: !g.invited || g.invited === user.id, mine: [g.white, g.black, g.created_by].includes(user.id), now });
    }

    case "join": {
      const g = await load();
      if (!g) return json({ error: "Game not found." }, 404);
      if (g.status !== "waiting") return json({ error: "Someone already joined this game." }, 409);
      if (g.created_by === user.id) return json({ error: "Send the link to a friend: you can't play yourself." }, 400);
      if (g.invited && g.invited !== user.id) return json({ error: `This challenge is for ${g.invited_name}.` }, 403);
      const slot = g.white ? "black" : "white";
      const { data, error } = await db
        .from("online_games")
        .update({
          [slot]: user.id, [`${slot}_name`]: await name(user.id), status: "active", updated_at: new Date(now).toISOString(),
          // Daily games: White's first move is on the clock too (from the moment the game starts).
          ...(g.daily_days ? { turn_started_at: new Date(now).toISOString() } : {}),
        })
        .eq("id", id)
        .eq("status", "waiting") // two people joining at once: only the first wins
        .select("id");
      if (error) return json({ error: error.message }, 500);
      if (!data.length) return json({ error: "Someone already joined this game." }, 409);
      return json({ ok: true, now });
    }

    case "decline": {
      const { error } = await db.from("online_games").update({ status: "over", reason: "declined", updated_at: new Date(now).toISOString() }).eq("id", id).eq("invited", user.id).eq("status", "waiting");
      return error ? json({ error: error.message }, 500) : json({ ok: true, now });
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
          status: "active", time_ms: g.time_ms, white_ms: g.time_ms, black_ms: g.time_ms, daily_days: g.daily_days,
          rated: g.rated, kind: g.kind,
          ...(g.rated && g.kind ? { white_rating: await getRating(db, String(g.black), g.kind as never), black_rating: await getRating(db, String(g.white), g.kind as never) } : {}),
          ...(g.daily_days ? { turn_started_at: new Date(now).toISOString() } : {}),
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

    case "fairplay": {
      // Sent by the OPPONENT's browser after reviewing the finished game: the other player's accuracy.
      const g = await load();
      const accuracy = Number(body.accuracy);
      if (!g || g.status !== "over" || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) return json({ error: "Bad fair-play report." }, 400);
      const side = g.white === user.id ? "w" : g.black === user.id ? "b" : null;
      if (!side) return json({ error: "Not your game." }, 403);
      const player = side === "w" ? g.black : g.white;
      const start = side === "w" ? 1 : 0; // the other player's moves: odd indices for Black, even for White
      const times = ((g.move_times as number[]) ?? []).filter((_, i) => i % 2 === start && i > 1);
      const moves = (g.moves as string[]).filter((_, i) => i % 2 === start).length;
      if (player && moves >= 5)
        await db.from("fair_play").upsert(
          { game_id: id, player, accuracy, moves, avg_move_ms: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null },
          { onConflict: "game_id,player", ignoreDuplicates: true },
        );
      return json({ ok: true, now });
    }

    // ── Matchmaking: search for an opponent near your rating (the range widens the longer you wait) ──
    case "seek": {
      const battle = body.battle === true;
      const minutes = battle ? 3 : Number(body.minutes ?? 0);
      const days = battle ? 0 : Number(body.days ?? 0);
      const kind = battle ? "battle" : kindOf(minutes, days);
      if (!kind) return json({ error: "Pick a time: 1, 3, 5 or 10 minutes, or 1 or 3 days per move." }, 400);
      // Already matched? (the other player found me since my last check)
      const { data: mine } = await db.from("seeks").select("*").eq("user_id", user.id).maybeSingle();
      if (mine?.status === "matched" && mine.game_id) {
        await db.from("seeks").delete().eq("user_id", user.id);
        return json({ [mine.kind === "battle" ? "battle" : "game"]: mine.game_id, now });
      }
      if (mine?.status === "matched") return json({ waiting: true, seconds: 0, now }); // being set up right now
      const rating = await getRating(db, user.id, kind);
      const same = mine && mine.status === "open" && mine.kind === kind && mine.minutes === minutes && mine.days === days;
      const since = same ? Date.parse(mine.created_at) : now;
      await db.from("seeks").upsert({ user_id: user.id, username: await name(user.id), kind, minutes, days, rating, status: "open", game_id: null, created_at: new Date(since).toISOString(), last_seen: new Date(now).toISOString() });
      // Candidates: same time control, still waiting, closest rating first. A clicked lobby seek ("target") is taken directly.
      let q = db.from("seeks").select("*").eq("status", "open").eq("kind", kind).eq("minutes", minutes).eq("days", days).neq("user_id", user.id).gt("last_seen", new Date(now - 15000).toISOString());
      if (typeof body.target === "string") q = q.eq("user_id", body.target);
      const { data: others } = await q.limit(30);
      const ranked = (others ?? []).sort((x, y) => Math.abs(x.rating - rating) - Math.abs(y.rating - rating));
      for (const o of ranked) {
        const waited = (now - Math.min(since, Date.parse(o.created_at))) / 1000;
        if (typeof body.target !== "string" && Math.abs(o.rating - rating) > Math.min(1000, 150 + 25 * waited)) continue;
        // Claim them (only one searcher can win this), and take myself out of the queue.
        const { data: got } = await db.from("seeks").update({ status: "matched" }).eq("user_id", o.user_id).eq("status", "open").select("user_id");
        if (!got?.length) continue;
        await db.from("seeks").delete().eq("user_id", user.id);
        const gameId = battle ? await startBattle(db, user.id, o.user_id) : await startGame(db, user.id, o.user_id, { minutes, days, rated: true });
        await db.from("seeks").update({ game_id: gameId }).eq("user_id", o.user_id);
        return json({ [battle ? "battle" : "game"]: gameId, now });
      }
      return json({ waiting: true, seconds: Math.round((now - since) / 1000), rating, now });
    }

    case "seek_cancel": {
      await db.from("seeks").delete().eq("user_id", user.id).eq("status", "open");
      return json({ ok: true, now });
    }

    // ── Arenas ──
    case "arena_create": {
      const minutes = Number(body.minutes);
      const duration = Number(body.duration);
      const startIn = Number(body.start_in ?? 0);
      const title = String(body.name ?? "").trim().slice(0, 60);
      if (![1, 3, 5, 10].includes(minutes) || ![15, 30, 60].includes(duration) || ![0, 5, 15, 30].includes(startIn) || title.length < 3)
        return json({ error: "Name (3+ letters), 1/3/5/10 min games, 15/30/60 minutes long, start now or in 5/15/30 minutes." }, 400);
      const { count } = await db.from("tournaments").select("id", { count: "exact", head: true }).eq("created_by", user.id).gt("ends_at", new Date(now).toISOString());
      if ((count ?? 0) >= 2) return json({ error: "You already have 2 arenas coming up. Wait for one to finish." }, 400);
      const starts = now + startIn * 60000;
      const { data, error } = await db
        .from("tournaments")
        .insert({ name: title, minutes, starts_at: new Date(starts).toISOString(), ends_at: new Date(starts + duration * 60000).toISOString(), created_by: user.id })
        .select("id")
        .single();
      return error ? json({ error: error.message }, 500) : json({ id: data.id, now });
    }

    case "arena_join": {
      const { data: t } = await db.from("tournaments").select("*").eq("id", id).maybeSingle();
      if (!t || Date.parse(t.ends_at) < now) return json({ error: "This arena has finished." }, 400);
      const kind = kindOf(t.minutes, 0)!;
      const running = Date.parse(t.starts_at) <= now;
      await db.from("tournament_players").upsert(
        { tournament_id: id, user_id: user.id, username: await name(user.id), rating: await getRating(db, user.id, kind), active: true, waiting: running, last_seen: new Date(now).toISOString() },
        { onConflict: "tournament_id,user_id" },
      );
      return json({ ok: true, now });
    }

    case "arena_leave": {
      await db.from("tournament_players").update({ active: false, waiting: false }).eq("tournament_id", id).eq("user_id", user.id);
      return json({ ok: true, now });
    }

    case "arena_pair": {
      // Called every few seconds by players on the arena page: returns a game when one is ready.
      const { data: t } = await db.from("tournaments").select("*").eq("id", id).maybeSingle();
      if (!t) return json({ error: "Arena not found." }, 404);
      const { data: me2 } = await db.from("tournament_players").select("*").eq("tournament_id", id).eq("user_id", user.id).maybeSingle();
      if (!me2) return json({ joined: false, now });
      await db.from("tournament_players").update({ last_seen: new Date(now).toISOString() }).eq("tournament_id", id).eq("user_id", user.id);
      const { data: live } = await db.from("online_games").select("id").eq("tournament_id", id).eq("status", "active").or(`white.eq.${user.id},black.eq.${user.id}`).limit(1);
      if (live?.length) return json({ joined: true, game: live[0].id, now });
      const running = Date.parse(t.starts_at) <= now && Date.parse(t.ends_at) > now;
      if (!running || !me2.active) return json({ joined: true, running, now });
      if (!me2.waiting) await db.from("tournament_players").update({ waiting: true }).eq("tournament_id", id).eq("user_id", user.id);
      const { data: pool } = await db
        .from("tournament_players")
        .select("user_id, rating")
        .eq("tournament_id", id)
        .eq("active", true)
        .eq("waiting", true)
        .neq("user_id", user.id)
        .gt("last_seen", new Date(now - 15000).toISOString());
      // Prefer someone you didn't just play, then the closest rating.
      const pick = (pool ?? []).sort((a, b) => Number(a.user_id === me2.last_opponent) - Number(b.user_id === me2.last_opponent) || Math.abs(a.rating - me2.rating) - Math.abs(b.rating - me2.rating))[0];
      if (!pick) return json({ joined: true, running, waiting: true, now });
      const { data: got } = await db.from("tournament_players").update({ waiting: false, last_opponent: user.id }).eq("tournament_id", id).eq("user_id", pick.user_id).eq("waiting", true).select("user_id");
      if (!got?.length) return json({ joined: true, running, waiting: true, now });
      await db.from("tournament_players").update({ waiting: false, last_opponent: pick.user_id }).eq("tournament_id", id).eq("user_id", user.id);
      const gameId = await startGame(db, user.id, pick.user_id, { minutes: t.minutes, days: 0, rated: true, tournament_id: id });
      return json({ joined: true, game: gameId, now });
    }

    // ── Puzzle Battle ──
    case "battle_state":
      return json({ ...(await battleState(db, id, user.id)), now });
    case "battle_move":
      return json({ ...(await battleMove(db, id, user.id, String(body.uci ?? ""))), now });

    default: {
      const g = await load();
      if (!g) return json({ error: "Game not found." }, 404);
      const out = await act(db, g as GameRow & Record<string, unknown> & { id: string }, { ...(body as object), type: body.action } as Action, user.id, now);
      if ("error" in out) return json({ error: out.error, now }, "conflict" in out ? 409 : 400);
      return json({ game: out.game, now });
    }
  }
});
