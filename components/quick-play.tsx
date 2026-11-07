"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Timer, Zap } from "lucide-react";
import { online } from "@/lib/online";
import { useMyRatings, useOpenSeeks, usePresence } from "@/lib/social";
import { useAccount } from "@/lib/supabase";

export const SPEEDS = [
  { label: "1 min", sub: "Bullet", kind: "bullet", minutes: 1, days: 0 },
  { label: "3 min", sub: "Blitz", kind: "blitz", minutes: 3, days: 0 },
  { label: "5 min", sub: "Blitz", kind: "blitz", minutes: 5, days: 0 },
  { label: "10 min", sub: "Rapid", kind: "rapid", minutes: 10, days: 0 },
  { label: "1 day", sub: "Daily", kind: "daily", minutes: 0, days: 1 },
  { label: "3 days", sub: "Daily", kind: "daily", minutes: 0, days: 3 },
] as const;
export const speedName = (minutes: number, days: number) => (days ? `${days} day${days > 1 ? "s" : ""}` : `${minutes} min`);

/**
 * Search for a rated game (or Puzzle Battle) and wait: asks the server every 2 seconds, which pairs you with
 * the closest rating (the range widens while you wait). Returns { search, cancel, state }.
 */
export function useSeek(onFound: (r: { game?: string; battle?: string }) => void) {
  const [state, setState] = useState<{ seconds: number; label: string } | null>(null);
  const [error, setError] = useState("");
  const params = useRef<Record<string, unknown> | null>(null);
  const found = useRef(onFound);
  found.current = onFound;

  useEffect(() => {
    if (!state) return;
    let stop = false;
    const tick = async () => {
      if (stop || !params.current) return;
      try {
        const r = await online<{ game?: string; battle?: string; seconds?: number }>("seek", params.current);
        if (stop) return;
        if (r.game || r.battle) {
          params.current = null;
          setState(null);
          return found.current(r);
        }
        setState((s) => (s ? { ...s, seconds: r.seconds ?? s.seconds } : s));
      } catch (e) {
        setError((e as Error).message);
        setState(null);
      }
    };
    void tick();
    const t = setInterval(() => void tick(), 2000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [state === null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving the page cancels the search.
  useEffect(() => () => void (params.current && online("seek_cancel").catch(() => {})), []);

  return {
    state,
    error,
    search: (p: Record<string, unknown>, label: string) => {
      setError("");
      params.current = p;
      setState({ seconds: 0, label });
    },
    cancel: () => {
      params.current = null;
      setState(null);
      void online("seek_cancel").catch(() => {});
    },
  };
}

/** chess.com-style "Play Online": pick a speed, get paired with someone near your rating. */
export function QuickPlay() {
  const router = useRouter();
  const { user } = useAccount();
  const ratings = useMyRatings();
  const seeks = useOpenSeeks();
  const here = usePresence();
  const [pick, setPick] = useState(2);
  const seek = useSeek((r) => r.game && router.push(`/play/online/${r.game}`));
  const s = SPEEDS[pick];
  const others = (seeks ?? []).filter((x) => x.user_id !== user?.id && x.kind !== "battle");

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-sans text-xl font-bold">Rated game</h2>
        <span className="text-xs text-muted-foreground">
          <span className="mr-1 inline-block size-2 rounded-full bg-primary" aria-hidden /> {here.size} online now
        </span>
      </div>

      {seek.state ? (
        <div className="flex flex-col items-center gap-3 rounded-md bg-card p-6 text-center" role="status">
          <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
          <p className="text-lg font-semibold">Searching for a {seek.state.label} opponent…</p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {seek.state.seconds}s · rating {ratings?.[s.kind]?.rating ?? "new"} (range widens while you wait)
          </p>
          <button className="rounded-md bg-panel px-5 py-2 font-semibold hover:bg-accent" onClick={seek.cancel}>
            Cancel
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Speed">
            {SPEEDS.map((sp, i) => (
              <button
                key={sp.label}
                role="radio"
                aria-checked={pick === i}
                onClick={() => setPick(i)}
                className={`flex flex-col items-center rounded-md py-2.5 ${pick === i ? "bg-accent ring-2 ring-primary" : "bg-card hover:bg-accent"}`}
              >
                <span className="font-bold">{sp.label}</span>
                <span className="text-xs text-muted-foreground">
                  {sp.sub} · {ratings?.[sp.kind]?.rating ?? "new"}
                </span>
              </button>
            ))}
          </div>
          {seek.error && <p className="text-sm text-destructive">{seek.error}</p>}
          <button className="btn-green w-full py-4! text-2xl!" onClick={() => seek.search({ minutes: s.minutes, days: s.days }, s.label)}>
            <Zap className="size-6" aria-hidden /> Play
          </button>
        </>
      )}

      <div>
        <h3 className="mb-1.5 text-sm font-semibold text-muted-foreground">Open games ({others.length})</h3>
        {!others.length ? (
          <p className="text-sm text-muted-foreground">No one is waiting right now. Press Play and others will see your game here.</p>
        ) : (
          <ul className="max-h-48 overflow-y-auto rounded-md bg-card">
            {others.map((o) => (
              <li key={o.user_id}>
                <button
                  className="flex w-full items-center gap-3 border-t border-white/5 px-3 py-2 text-left text-sm first:border-t-0 hover:bg-accent"
                  onClick={() => seek.search({ minutes: o.minutes, days: o.days, target: o.user_id }, speedName(o.minutes, o.days))}
                >
                  <Timer className="size-4 text-primary" aria-hidden />
                  <span className="flex-1 truncate font-semibold">{o.username}</span>
                  <span className="text-muted-foreground tabular-nums">{o.rating}</span>
                  <span className="w-16 text-right text-muted-foreground">{speedName(o.minutes, o.days)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
