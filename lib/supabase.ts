"use client";

import { useEffect, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";

// One browser client for the whole site. The login session is kept in localStorage by supabase-js.
// Row level security in the database decides what each user may read or write.
export const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "missing");

export type Profile = {
  id: string;
  username: string;
  created_at: string;
  puzzle_rating: number;
  beaten_bots: string[];
  rush_best_3: number;
  rush_best_5: number;
};

let current: { user: User | null; profile: Profile | null; ready: boolean } = { user: null, profile: null, ready: false };
const subs = new Set<(s: typeof current) => void>();
const emit = () => subs.forEach((f) => f(current));

async function loadProfile(user: User | null) {
  const profile = user ? ((await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()).data as Profile | null) : null;
  current = { user, profile, ready: true };
  emit();
}

let started = false;
function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  supabase.auth.onAuthStateChange((event, session) => {
    // Profile only changes on sign-in/out, not on token refresh.
    if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED")
      setTimeout(() => void loadProfile(session?.user ?? null)); // outside the callback, per supabase-js docs
  });
}

/** Signed-in user and profile (both null for guests). `ready` = the session check has finished. */
export function useAccount() {
  const [s, setS] = useState(current);
  useEffect(() => {
    start();
    subs.add(setS);
    setS(current);
    return () => void subs.delete(setS);
  }, []);
  return s;
}

/** Change profile fields of the signed-in user and update every screen that shows them. */
export async function updateProfile(patch: Partial<Pick<Profile, "puzzle_rating" | "beaten_bots" | "rush_best_3" | "rush_best_5">>) {
  const { user, profile } = current;
  if (!user || !profile) return;
  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return console.warn("Profile not saved:", error.message);
  current = { ...current, profile: { ...profile, ...patch } };
  emit();
}
