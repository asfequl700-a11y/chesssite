// Edge Function `sweep`: background job run every 5 minutes by pg_cron (see the lobby migration).
// Ends games whose time ran out while nobody was watching (daily deadlines, abandoned games),
// clears old searches, ends finished Puzzle Battles and keeps an Hourly Blitz Arena scheduled.
// Called without a user, so it checks a shared secret instead (CRON_SECRET, never in git).
import { createClient } from "@supabase/supabase-js";
import { sweep } from "../_shared/server.ts";

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return new Response("forbidden", { status: 403 });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const report = await sweep(db);
  return new Response(JSON.stringify(report), { headers: { "Content-Type": "application/json" } });
});
