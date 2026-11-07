"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Trophy } from "lucide-react";
import { PlainPage } from "@/components/game-screen";
import { Button } from "@/components/ui/button";
import { clockText } from "@/lib/game";
import { online } from "@/lib/online";
import { supabase, useAccount } from "@/lib/supabase";

type Tournament = { id: string; name: string; minutes: number; starts_at: string; ends_at: string; created_by: string | null };
type Player = { user_id: string; username: string; rating: number; score: number; games: number; wins: number; active: boolean; waiting: boolean };

/** Ticks every second (for countdowns). Starts at 0 so server and browser render the same HTML. */
function useNow() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const phase = (t: Tournament, now: number) => (now < Date.parse(t.starts_at) ? "upcoming" : now < Date.parse(t.ends_at) ? "running" : "over");

/** /tournaments: running and upcoming arenas, recent results, and "Create arena". */
export function TournamentList() {
  const router = useRouter();
  const { user } = useAccount();
  const now = useNow();
  const [list, setList] = useState<Tournament[] | null>(null);
  const [form, setForm] = useState({ name: "", minutes: 3, duration: 30, start_in: 5 });
  const [error, setError] = useState("");

  useEffect(() => {
    void supabase
      .from("tournaments")
      .select("*")
      .gt("ends_at", new Date(Date.now() - 86400000).toISOString())
      .order("starts_at")
      .then(({ data }) => setList((data ?? []) as Tournament[]));
  }, []);

  const create = async () => {
    setError("");
    try {
      const { id } = await online<{ id: string }>("arena_create", form);
      router.push(`/tournaments/${id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const group = (p: string) => (list ?? []).filter((t) => phase(t, now) === p);
  const row = (t: Tournament) => {
    const p = phase(t, now);
    return (
      <li key={t.id}>
        <Link href={`/tournaments/${t.id}`} className="flex items-center gap-3 border-t border-white/5 px-4 py-3 first:border-t-0 hover:bg-accent">
          <Trophy className={`size-6 ${p === "running" ? "text-primary" : "text-muted-foreground"}`} aria-hidden />
          <span className="flex-1">
            <b className="block">{t.name}</b>
            <span className="text-sm text-muted-foreground">
              {t.minutes} min games · {Math.round((Date.parse(t.ends_at) - Date.parse(t.starts_at)) / 60000)} minutes
            </span>
          </span>
          <span className="text-sm tabular-nums text-muted-foreground">
            {!now ? "" : p === "upcoming" ? `starts in ${clockText(Date.parse(t.starts_at) - now)}` : p === "running" ? `${clockText(Date.parse(t.ends_at) - now)} left` : "finished"}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <PlainPage title="Tournaments">
      <p className="mb-6 text-muted-foreground">Arenas: play as many games as you can before time runs out. Win = 2 points, draw = 1. You&apos;re paired again as soon as your game ends.</p>
      {!list ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        (["running", "upcoming", "over"] as const).map((p) =>
          group(p).length ? (
            <section key={p} className="mb-6">
              <h2 className="mb-2 text-2xl">{{ running: "Playing now", upcoming: "Starting soon", over: "Finished today" }[p]}</h2>
              <ul className="overflow-hidden rounded-md bg-panel">{group(p).map(row)}</ul>
            </section>
          ) : null,
        )
      )}

      {user && (
        <section className="rounded-md bg-panel p-4">
          <h2 className="mb-3 text-2xl">Create an arena</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Name
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} placeholder="Friday night blitz" className="rounded-md bg-card px-3 py-2" />
            </label>
            {(
              [
                ["minutes", "Game time", [1, 3, 5, 10], (v: number) => `${v} min`],
                ["duration", "Arena length", [15, 30, 60], (v: number) => `${v} min`],
                ["start_in", "Starts", [0, 5, 15, 30], (v: number) => (v ? `in ${v} min` : "now")],
              ] as const
            ).map(([key, label, opts, text]) => (
              <label key={key} className="flex flex-col gap-1 text-sm">
                {label}
                <select value={form[key]} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} className="rounded-md bg-card px-3 py-2">
                  {opts.map((o) => (
                    <option key={o} value={o}>
                      {text(o)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <button className="btn-green mt-4" onClick={() => void create()}>
            Create arena
          </button>
        </section>
      )}
    </PlainPage>
  );
}

/** /tournaments/[id]: countdown, Join/Leave, live standings; while you're in, you're paired automatically. */
export function ArenaPage({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAccount();
  const now = useNow();
  const [t, setT] = useState<Tournament | null | undefined>(undefined);
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const me = players.find((p) => p.user_id === user?.id);
  const joined = !!me?.active;
  const p = t ? phase(t, now) : "upcoming";
  const leaving = useRef(false);

  const loadPlayers = () =>
    void supabase
      .from("tournament_players")
      .select("user_id, username, rating, score, games, wins, active, waiting")
      .eq("tournament_id", id)
      .order("score", { ascending: false })
      .order("wins", { ascending: false })
      .then(({ data }) => setPlayers((data ?? []) as Player[]));

  useEffect(() => {
    void supabase.from("tournaments").select("*").eq("id", id).maybeSingle().then(({ data }) => setT(data as Tournament | null));
    loadPlayers();
    const ch = supabase
      .channel(`arena:${id}:${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_players", filter: `tournament_id=eq.${id}` }, loadPlayers)
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // While joined and the arena runs: ask for a pairing every 2 seconds and jump into the game.
  useEffect(() => {
    if (!joined || p !== "running") return;
    leaving.current = false;
    const tick = async () => {
      try {
        const r = await online<{ game?: string; waiting?: boolean }>("arena_pair", { id });
        if (r.game && !leaving.current) router.push(`/play/online/${r.game}`);
        else setStatus(r.waiting ? "Pairing you with the next free player…" : "");
      } catch (e) {
        setStatus((e as Error).message);
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 2000);
    return () => clearInterval(timer);
  }, [joined, p, id, router]);

  if (t === undefined) return <PlainPage title="Arena">Loading…</PlainPage>;
  if (t === null) return <PlainPage title="Arena">This arena doesn&apos;t exist.</PlainPage>;

  const join = async () => {
    setError("");
    try {
      await online("arena_join", { id });
      loadPlayers();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const leave = async () => {
    leaving.current = true;
    await online("arena_leave", { id }).catch(() => {});
    loadPlayers();
  };

  return (
    <PlainPage title={t.name}>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md bg-panel p-4">
        <Trophy className={`size-8 ${p === "running" ? "text-primary" : "text-muted-foreground"}`} aria-hidden />
        <div className="flex-1">
          <p className="font-semibold">
            {t.minutes} min games · {p === "upcoming" ? "starts in" : p === "running" ? "ends in" : "finished"}{" "}
            <span className="tabular-nums">{now && p !== "over" ? clockText((p === "upcoming" ? Date.parse(t.starts_at) : Date.parse(t.ends_at)) - now) : ""}</span>
          </p>
          <p className="text-sm text-muted-foreground">Win 2 points · draw 1 · rated games</p>
        </div>
        {!user ? (
          <Link href="/login" className="btn-green">
            Log in to join
          </Link>
        ) : p === "over" ? null : joined ? (
          <Button variant="secondary" onClick={() => void leave()}>
            Leave arena
          </Button>
        ) : (
          <button className="btn-green" onClick={() => void join()}>
            Join
          </button>
        )}
      </div>
      {error && <p className="mb-3 text-destructive">{error}</p>}
      {joined && p === "running" && (
        <p className="mb-4 flex items-center gap-2 rounded-md bg-card p-3 font-semibold" role="status">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden /> {status || "You're in. Waiting for a pairing…"}
        </p>
      )}
      {joined && p === "upcoming" && <p className="mb-4 rounded-md bg-card p-3">You&apos;re in! Stay on this page: your first game starts automatically when the arena begins.</p>}

      <section className="overflow-hidden rounded-md bg-panel">
        <h2 className="p-4 font-sans text-xl font-bold">
          Standings <span className="text-base text-muted-foreground">{players.length} players</span>
        </h2>
        {!players.length ? (
          <p className="px-4 pb-4 text-muted-foreground">No one has joined yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-black/15 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-semibold">#</th>
                <th className="px-2 py-2 font-semibold">Player</th>
                <th className="px-2 py-2 text-right font-semibold">Games</th>
                <th className="px-4 py-2 text-right font-semibold">Score</th>
              </tr>
            </thead>
            <tbody>
              {players.map((pl, i) => (
                <tr key={pl.user_id} className={`border-t border-white/5 ${pl.user_id === user?.id ? "bg-primary/10" : ""}`}>
                  <td className="px-4 py-2.5 font-bold">{i === 0 && pl.score > 0 ? "🏆" : i + 1}</td>
                  <td className="px-2 py-2.5">
                    <Link href={`/member/${pl.username}`} className="font-semibold hover:underline">
                      {pl.username}
                    </Link>{" "}
                    <span className="text-muted-foreground">{pl.rating}</span>
                    {!pl.active && <span className="ml-2 text-xs text-muted-foreground">(left)</span>}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{pl.games}</td>
                  <td className="px-4 py-2.5 text-right text-lg font-bold tabular-nums">{pl.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </PlainPage>
  );
}
