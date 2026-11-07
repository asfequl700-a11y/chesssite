"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Chess } from "chess.js";
import { Swords, X } from "lucide-react";
import { Board, type Promo } from "@/components/board";
import { GameScreen } from "@/components/game-screen";
import { useSeek } from "@/components/quick-play";
import { markActive } from "@/lib/activity";
import { clockText } from "@/lib/game";
import { online, serverNow } from "@/lib/online";
import { supabase, useAccount } from "@/lib/supabase";

type Battle = {
  id: string;
  white: string;
  black: string;
  white_name: string;
  black_name: string;
  starts_at: string;
  ends_at: string;
  white_score: number;
  black_score: number;
  white_strikes: number;
  black_strikes: number;
  white_idx: number;
  black_idx: number;
  status: "active" | "over";
  result: "w" | "b" | "draw" | null;
};

function Strikes({ n }: { n: number }) {
  return (
    <span className="flex gap-1" aria-label={`${n} of 3 mistakes`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`grid size-5 place-items-center rounded-full ${i < n ? "bg-[#fa412d] text-white" : "bg-panel text-muted-foreground"}`}>
          <X className="size-3" aria-hidden />
        </span>
      ))}
    </span>
  );
}

/**
 * Puzzle Battle: you and an opponent get the same puzzles for 3 minutes. Every move is checked by the server
 * (the answers never reach the browser). 3 mistakes and you're out; most solved wins.
 */
export function PuzzleBattle() {
  const { user, ready } = useAccount();
  const [battle, setBattle] = useState<Battle | null>(null);
  const [fen, setFen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const [, tick] = useState(0);
  const game = useRef(new Chess());
  const counted = useRef(false);

  async function start(id: string) {
    counted.current = false;
    const r = await online<{ battle: Battle; fen: string | null }>("battle_state", { id });
    setBattle(r.battle);
    show(r.fen);
  }
  const show = (f: string | null) => {
    setFen(f);
    if (f) game.current = new Chess(f);
  };
  const seek = useSeek((r) => r.battle && void start(r.battle));

  // Live scores: the opponent's progress is pushed through Realtime; clocks tick locally.
  useEffect(() => {
    if (!battle) return;
    const ch = supabase
      .channel(`battle:${battle.id}:${Math.random()}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "battles", filter: `id=eq.${battle.id}` }, (p) => setBattle(p.new as Battle))
      .subscribe();
    const t = setInterval(() => tick((n) => n + 1), 200);
    return () => {
      void supabase.removeChannel(ch);
      clearInterval(t);
    };
  }, [battle?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Time up: ask the server to settle the result once.
  const ended = battle && (battle.status === "over" || serverNow() > Date.parse(battle.ends_at));
  useEffect(() => {
    if (!ended || !battle || battle.status === "over") return;
    void online<{ battle: Battle }>("battle_state", { id: battle.id }).then((r) => r.battle && setBattle(r.battle));
  }, [ended]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (battle?.status === "over" && !counted.current) {
      counted.current = true;
      markActive(battle.white === user?.id ? battle.white_score : battle.black_score);
    }
  }, [battle?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return <GameScreen title="Puzzle Battle">Loading…</GameScreen>;
  if (!user)
    return (
      <GameScreen title="Puzzle Battle">
        <p className="mb-3 text-muted-foreground">Race another player through the same puzzles. You need a free account so scores are fair.</p>
        <Link href="/login" className="btn-green">
          Log in
        </Link>
      </GameScreen>
    );

  const me = battle ? (battle.white === user.id ? "white" : "black") : "white";
  const them = me === "white" ? "black" : "white";
  const now = serverNow();
  const countdown = battle ? Math.ceil((Date.parse(battle.starts_at) - now) / 1000) : 0;
  const running = !!battle && battle.status === "active" && countdown <= 0 && !ended;
  const out = !!battle && battle[`${me}_strikes`] >= 3;

  const onMove = (from: string, to: string, promotion?: Promo) => {
    if (!battle || !running || busy || out) return false;
    try {
      game.current.move({ from, to, promotion });
    } catch {
      return false;
    }
    const uci = from + to + (promotion ?? "");
    setFen(game.current.fen());
    setBusy(true);
    void online<{ correct: boolean; solved: boolean; reply: string | null; battle: Battle; fen: string | null; error?: string }>("battle_move", { id: battle.id, uci })
      .then((r) => {
        if (r.battle) setBattle(r.battle);
        if (r.correct && !r.solved && r.reply) {
          // The puzzle's answer move, then it's your turn again.
          setTimeout(() => {
            game.current.move({ from: r.reply!.slice(0, 2), to: r.reply!.slice(2, 4), promotion: r.reply![4] });
            setFen(game.current.fen());
          }, 250);
        } else {
          setFlash(r.correct ? "ok" : "bad");
          setTimeout(() => {
            setFlash(null);
            show(r.fen);
          }, 450);
        }
      })
      .catch(() => show(fen))
      .finally(() => setBusy(false));
    return true;
  };

  const side = game.current.turn() === "w" ? "white" : "black";
  const board = (
    <div className="relative w-full">
      <Board game={game.current} fen={fen ?? new Chess().fen()} orientation={fen ? side : "white"} onMove={running && fen ? onMove : undefined} />
      {flash && (
        <div className={`pointer-events-none absolute inset-0 grid place-items-center text-7xl font-bold ${flash === "ok" ? "bg-primary/30 text-white" : "bg-[#fa412d]/30 text-white"}`} aria-hidden>
          {flash === "ok" ? "✓" : "✗"}
        </div>
      )}
      {battle && countdown > 0 && <div className="absolute inset-0 grid place-items-center bg-black/50 text-8xl font-bold text-white">{countdown}</div>}
    </div>
  );

  return (
    <GameScreen title="Puzzle Battle" board={board}>
      {!battle ? (
        seek.state ? (
          <div className="flex flex-col items-center gap-3 rounded-md bg-card p-6 text-center" role="status">
            <p className="text-lg font-semibold">Finding an opponent… {seek.state.seconds}s</p>
            <button className="rounded-md bg-panel px-5 py-2 font-semibold hover:bg-accent" onClick={seek.cancel}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-muted-foreground">You and another player get the same puzzles. 3 minutes, 3 mistakes and you&apos;re out. Most solved wins.</p>
            {seek.error && <p className="text-destructive">{seek.error}</p>}
            <button className="btn-green w-full py-4! text-2xl!" onClick={() => seek.search({ battle: true }, "Puzzle Battle")}>
              <Swords className="size-6" aria-hidden /> Find opponent
            </button>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-md bg-card p-3 text-center">
            <div className="text-sm text-muted-foreground">Time</div>
            <div className="text-3xl font-bold tabular-nums" role="timer">
              {clockText(Math.max(0, Date.parse(battle.ends_at) - Math.max(now, Date.parse(battle.starts_at))))}
            </div>
          </div>
          {[me, them].map((s) => (
            <div key={s} className={`flex items-center gap-3 rounded-md p-3 ${s === me ? "bg-primary/15" : "bg-card"}`}>
              <span className="flex-1 truncate font-semibold">
                {battle[`${s}_name` as "white_name"]} {s === me && <span className="text-xs text-muted-foreground">(you)</span>}
              </span>
              <Strikes n={battle[`${s}_strikes` as "white_strikes"]} />
              <span className="w-10 text-right text-3xl font-bold tabular-nums">{battle[`${s}_score` as "white_score"]}</span>
            </div>
          ))}
          {running && !out && <p className="text-sm text-muted-foreground">{busy ? "Checking…" : `Find the best move for ${side === "white" ? "White" : "Black"}.`}</p>}
          {out && battle.status === "active" && <p className="font-semibold text-[#fa412d]">3 mistakes: you&apos;re out. Waiting for the timer…</p>}
          {battle.status === "over" && (
            <div className="rounded-md bg-card p-4 text-center" role="status">
              <p className="text-2xl font-bold">
                {battle.result === "draw" ? "Draw!" : battle.result === (me === "white" ? "w" : "b") ? "You won! 🏆" : "You lost"}
              </p>
              <p className="mb-3 text-muted-foreground">
                {battle[`${me}_score`]} – {battle[`${them}_score`]}
              </p>
              <button
                className="btn-green"
                onClick={() => {
                  setBattle(null);
                  setFen(null);
                  seek.search({ battle: true }, "Puzzle Battle");
                }}
              >
                Play again
              </button>
            </div>
          )}
        </div>
      )}
    </GameScreen>
  );
}
