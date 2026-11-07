"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase, useAccount } from "@/lib/supabase";

export type Friend = { request_id: number; id: string; username: string; avatar_url: string | null; dir: "friend" | "incoming" | "outgoing"; since: string };
export type Challenge = { id: string; created_by: string; white: string | null; white_name: string; black_name: string; time_ms: number; daily_days: number; created_at: string };

export const findPlayers = async (q: string) => ((await supabase.rpc("find_players", { q })).data ?? []) as { id: string; username: string; avatar_url: string | null }[];
/** Tell every friends list / bell on the page to reload now (not only when a live update arrives). */
export const refreshSocial = () => window.dispatchEvent(new Event("social-refresh"));

// Supabase calls are lazy: they only run when awaited, so every helper awaits and reports errors.
async function call(fn: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  refreshSocial();
  return data;
}
export const addFriend = async (id: string) => (await call("add_friend", { friend: id })) as string;
export const acceptFriend = (request: number) => call("accept_friend", { request });
export const removeFriend = (request: number) => call("remove_friend", { request });

/** Runs `load` now and again whenever a matching row changes (live), for the signed-in user. */
export function useLive<T>(name: string, load: (me: string) => Promise<T>, tables: { table: string; filter: (me: string) => string }[]) {
  const { user } = useAccount();
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const refresh = () => void load(user.id).then((d) => alive && setData(d));
    refresh();
    let ch = supabase.channel(`${name}:${user.id}:${Math.random()}`);
    for (const t of tables) ch = ch.on("postgres_changes", { event: "*", schema: "public", table: t.table, filter: t.filter(user.id) }, refresh);
    ch.subscribe();
    window.addEventListener("social-refresh", refresh);
    return () => {
      alive = false;
      window.removeEventListener("social-refresh", refresh);
      void supabase.removeChannel(ch);
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  return user ? data : null;
}

/** Your friends and friend requests, kept up to date live. */
export function useFriends() {
  return useLive("friends", async () => ((await supabase.rpc("my_friends")).data ?? []) as Friend[], [
    { table: "friend_requests", filter: (me) => `to_user=eq.${me}` },
    { table: "friend_requests", filter: (me) => `from_user=eq.${me}` },
  ]);
}

/** Challenges sent to you that are still waiting for an answer. */
export function useChallenges() {
  return useLive(
    "challenges",
    async (me) => {
      const { data } = await supabase
        .from("online_games")
        .select("id, created_by, white, white_name, black_name, time_ms, daily_days, created_at")
        .eq("invited", me)
        .eq("status", "waiting")
        .order("created_at", { ascending: false });
      return (data ?? []) as Challenge[];
    },
    [{ table: "online_games", filter: (me) => `invited=eq.${me}` }],
  );
}

// Who is on the site right now: one Realtime Presence channel shared by every page.
let online = new Set<string>();
const subs = new Set<() => void>();
let joinedAs: string | null = null;

function join(userId: string) {
  if (joinedAs === userId) return;
  joinedAs = userId;
  const ch = supabase.channel("players", { config: { presence: { key: userId } } });
  ch.on("presence", { event: "sync" }, () => {
    online = new Set(Object.keys(ch.presenceState()));
    subs.forEach((f) => f());
  }).subscribe((status) => {
    if (status === "SUBSCRIBED") void ch.track({ at: Date.now() });
  });
}

/** Set of user ids online now. Also marks you as online while the site is open. */
export function usePresence() {
  const { user } = useAccount();
  useEffect(() => {
    if (user) join(user.id);
  }, [user]);
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => void subs.delete(f);
    },
    () => online,
    () => online,
  );
}

export type Conversation = { id: string; username: string; avatar_url: string | null; last_body: string; last_at: string; last_from_me: boolean; unread: number };

/** Your conversations (newest first) with unread counts, kept up to date live. */
export function useConversations() {
  return useLive("conversations", async () => ((await supabase.rpc("conversations")).data ?? []) as Conversation[], [
    { table: "messages", filter: (me) => `to_user=eq.${me}` },
    { table: "messages", filter: (me) => `from_user=eq.${me}` },
  ]);
}

export type OngoingGame = { id: string; white: string | null; black: string | null; white_name: string; black_name: string; moves: string[]; daily_days: number; time_ms: number; turn_started_at: string | null; status: string };

/** Your online games still being played (live and daily), kept up to date live. */
export function useOngoingGames() {
  return useLive(
    "ongoing",
    async () => {
      const { data } = await supabase
        .from("online_games")
        .select("id, white, black, white_name, black_name, moves, daily_days, time_ms, turn_started_at, status")
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(20);
      return (data ?? []) as OngoingGame[];
    },
    [
      { table: "online_games", filter: (me) => `white=eq.${me}` },
      { table: "online_games", filter: (me) => `black=eq.${me}` },
    ],
  );
}
