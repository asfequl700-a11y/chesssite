"use client";

import { supabase } from "@/lib/supabase";

// Talks to the `online` Edge Function, which owns every change to a live game.
// `offset` = server clock minus this computer's clock, so both players see the same times.
export let offset = 0;

export async function online<T = Record<string, unknown>>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("online", { body: { action, ...body } });
  let out = data;
  if (error) {
    // Non-2xx: the reason is in the response body.
    out = await (error as { context?: Response }).context?.json?.().catch(() => null);
    if (!out?.error) throw new Error("Could not reach the game server. Check your internet.");
  }
  if (typeof out?.now === "number") offset = out.now - Date.now();
  if (out?.error) throw new Error(out.error);
  return out as T;
}

export const serverNow = () => Date.now() + offset;
