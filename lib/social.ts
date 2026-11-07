"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase, useAccount } from "@/lib/supabase";

export type Friend = { request_id: number; id: string; username: string; dir: "friend" | "incoming" | "outgoing"; since: string };
export type Challenge = { id: string; created_by: string; white: string | null; white_name: string; black_name: string; time_ms: number; created_at: string };

export const findPlayers = async (q: string) => ((await supabase.rpc("find_players", { q })).data ?? []) as { id: string; username: string }[];
export const addFriend = async (id: string) => {
  const { data, error } = await supabase.rpc("add_friend", { friend: id });
  if (error) throw new Error(error.message);
  return data as string;
};
export const acceptFriend = (request: number) => supabase.rpc("accept_friend", { request });
export const removeFriend = (request: number) => supabase.rpc("remove_friend", { request });

/** Runs `load` now and again whenever a matching row changes (live), for the signed-in user. */
function useLive<T>(name: string, load: (me: string) => Promise<T>, tables: { table: string; filter: (me: string) => string }[]) {
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
    return () => {
      alive = false;
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
        .select("id, created_by, white, white_name, black_name, time_ms, created_at")
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
