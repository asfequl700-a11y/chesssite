"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Tv } from "lucide-react";
import { Board } from "@/components/board";
import { GameScreen } from "@/components/game-screen";
import { PlayerBar } from "@/components/player-bar";

// Top live games from Lichess TV (free, open API), drawn on our own board.
const CHANNELS = [
  { id: "best", name: "Top rated" },
  { id: "bullet", name: "Bullet" },
  { id: "blitz", name: "Blitz" },
  { id: "rapid", name: "Rapid" },
  { id: "classical", name: "Classical" },
] as const;

type Player = { color: "white" | "black"; user?: { name: string; title?: string }; rating?: number; seconds?: number };
type Live = { id: string; orientation: "white" | "black"; players: Player[]; fen: string; lm?: string; wc?: number; bc?: number; at: number };
const YELLOW = "rgba(255,255,51,.5)";

/** Reads the Lichess TV stream (one JSON object per line) and keeps the latest position. */
function useTv(channel: string) {
  const [live, setLive] = useState<Live | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const ctrl = new AbortController();
    setLive(null);
    setError("");
    (async () => {
      try {
        const res = await fetch(`https://lichess.org/api/tv/${channel}/feed`, { signal: ctrl.signal });
        if (!res.ok || !res.body) throw new Error(String(res.status));
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const msg = JSON.parse(line);
            const at = Date.now();
            if (msg.t === "featured") setLive({ ...msg.d, at });
            else if (msg.t === "fen") setLive((l) => (l ? { ...l, fen: msg.d.fen, lm: msg.d.lm, wc: msg.d.wc, bc: msg.d.bc, at } : l));
          }
        }
      } catch (e) {
        if (!ctrl.signal.aborted) setError("Lichess TV isn't reachable right now. Try again in a minute.");
        void e;
      }
    })();
    return () => ctrl.abort();
  }, [channel]);
  return { live, error };
}

export function Watch() {
  const [channel, setChannel] = useState<string>("best");
  const { live, error } = useTv(channel);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const turn = live?.fen.split(" ")[1] === "w" ? "white" : "black";
  const player = (c: "white" | "black") => live?.players.find((p) => p.color === c);
  const secs = (c: "white" | "black") => {
    const base = c === "white" ? live?.wc : live?.bc;
    if (base === undefined || !live) return undefined;
    return (base - (turn === c && now ? Math.max(0, now - live.at) / 1000 : 0)) * 1000;
  };
  const bar = (c: "white" | "black") => {
    const p = player(c);
    const ms = secs(c);
    return (
      <PlayerBar
        name={`${p?.user?.title ? `${p.user.title} ` : ""}${p?.user?.name ?? "Anonymous"}${p?.rating ? ` (${p.rating})` : ""}`}
        color={c === "white" ? "w" : "b"}
        fen={live?.fen ?? "8/8/8/8/8/8/8/8 w - - 0 1"}
        clock={ms !== undefined ? { ms, running: turn === c } : undefined}
      />
    );
  };
  const orientation = live?.orientation ?? "white";
  const top = orientation === "white" ? "black" : "white";
  const lm = live?.lm;

  const board = (
    <div className="flex w-full flex-col gap-2">
      {bar(top)}
      <Board fen={live?.fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"} orientation={orientation} highlight={lm ? { [lm.slice(0, 2)]: YELLOW, [lm.slice(2, 4)]: YELLOW } : undefined} />
      {bar(top === "white" ? "black" : "white")}
    </div>
  );

  return (
    <GameScreen title="Watch" board={board}>
      <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Tv className="size-4 text-primary" aria-hidden /> Live top games from Lichess TV
      </p>
      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Channel">
        {CHANNELS.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={channel === c.id}
            onClick={() => setChannel(c.id)}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${channel === c.id ? "bg-accent text-white ring-2 ring-primary" : "bg-card text-muted-foreground hover:text-white"}`}
          >
            {c.name}
          </button>
        ))}
      </div>
      {error ? (
        <p className="text-destructive">{error}</p>
      ) : !live ? (
        <p className="text-muted-foreground" aria-live="polite">
          Tuning in…
        </p>
      ) : (
        <div className="flex flex-col gap-3" aria-live="polite">
          <p className="font-semibold">
            {player("white")?.user?.name ?? "White"} vs {player("black")?.user?.name ?? "Black"}
          </p>
          <a href={`https://lichess.org/${live.id}`} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-sm text-primary hover:underline">
            Open this game on Lichess <ExternalLink className="size-4" aria-hidden />
          </a>
          <p className="text-xs text-muted-foreground">A new game appears automatically when this one ends. Games and players are from lichess.org.</p>
        </div>
      )}
    </GameScreen>
  );
}
