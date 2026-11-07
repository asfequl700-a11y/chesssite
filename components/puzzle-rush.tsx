"use client";

import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Check, X } from "lucide-react";
import { Board, type Promo } from "@/components/board";
import { GameScreen } from "@/components/game-screen";
import { clockText } from "@/lib/game";
import { fetchPuzzle, playUci, rushDifficulty, type Puzzle } from "@/lib/puzzles";
import { markActive } from "@/lib/activity";
import { updateProfile, useAccount } from "@/lib/supabase";

const STRIKES = 3;

/** Best rush score per length: profile when logged in, this browser for guests. */
function useBest(minutes: 3 | 5) {
  const { profile } = useAccount();
  const key = minutes === 3 ? "rush_best_3" : "rush_best_5";
  const [guest, setGuest] = useState(0);
  useEffect(() => setGuest(Number(localStorage.getItem(key)) || 0), [key]);
  const best = profile ? profile[key] : guest;
  const save = (score: number) => {
    if (score <= best) return;
    if (profile) void updateProfile({ [key]: score });
    else {
      localStorage.setItem(key, String(score));
      setGuest(score);
    }
  };
  return [best, save] as const;
}

export function PuzzleRush() {
  const [minutes, setMinutes] = useState<3 | 5>(3);
  const [phase, setPhase] = useState<"setup" | "playing" | "over">("setup");
  const [results, setResults] = useState<boolean[]>([]);
  const [left, setLeft] = useState(0);
  const [fen, setFen] = useState(new Chess().fen());
  const [loading, setLoading] = useState(false);
  const deadline = useRef(0);
  const game = useRef(new Chess());
  const puzzle = useRef<(Puzzle & { step: number }) | null>(null);
  const nextUp = useRef<Promise<Puzzle> | null>(null);
  const [best, saveBest] = useBest(minutes);
  const solved = results.filter(Boolean).length;
  const misses = results.length - solved;

  const [newBest, setNewBest] = useState(false);
  const finish = (score: number) => {
    setPhase("over");
    setNewBest(score > best);
    markActive(score);
    saveBest(score);
  };

  // Countdown; time up ends the run.
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      const ms = deadline.current - Date.now();
      setLeft(ms);
      if (ms <= 0) finish(solved);
    }, 100);
    return () => clearInterval(id);
  }, [phase, solved]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Show the next puzzle (fetched ahead of time) and start fetching the one after it. */
  async function next(done: number) {
    setLoading(true);
    try {
      const p = await (nextUp.current ?? fetchPuzzle("", rushDifficulty(done)));
      nextUp.current = fetchPuzzle("", rushDifficulty(done + 1)).catch(() => fetchPuzzle("", rushDifficulty(done + 1)));
      game.current = p.game;
      puzzle.current = { ...p, step: 0 };
      setFen(p.game.fen());
    } catch {
      nextUp.current = null;
      setTimeout(() => void next(done), 1500); // Lichess busy: try again shortly
      return;
    }
    setLoading(false);
  }

  const start = () => {
    setResults([]);
    deadline.current = Date.now() + minutes * 60000;
    setLeft(minutes * 60000);
    nextUp.current = null;
    setPhase("playing");
    void next(0);
  };

  const record = (ok: boolean) => {
    const r = [...results, ok];
    setResults(r);
    const s = r.filter(Boolean).length;
    if (r.length - s >= STRIKES) return finish(s);
    void next(s);
  };

  const onMove = (from: string, to: string, promotion?: Promo) => {
    const g = game.current;
    const p = puzzle.current;
    if (!p || phase !== "playing" || loading) return false;
    let move;
    try {
      move = g.move({ from, to, promotion });
    } catch {
      return false;
    }
    if (move.lan !== p.solution[p.step] && !g.isCheckmate()) {
      setFen(g.fen());
      record(false); // in a rush one wrong move fails the puzzle
      return true;
    }
    p.step++;
    if (p.step < p.solution.length && !g.isCheckmate()) {
      playUci(g, p.solution[p.step]);
      p.step++;
      setFen(g.fen());
    } else {
      setFen(g.fen());
      record(true);
    }
    return true;
  };

  const side = game.current.turn() === "w" ? "white" : "black";

  return (
    <GameScreen
      title="Puzzle Rush"
      board={<Board game={game.current} fen={fen} orientation={phase === "playing" ? side : "white"} onMove={phase === "playing" ? onMove : undefined} />}
    >
      {phase === "setup" && (
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground">Solve as many puzzles as you can before time runs out. They get harder as you go. Three mistakes and the run ends.</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Length">
            {([3, 5] as const).map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={minutes === m}
                onClick={() => setMinutes(m)}
                className={`rounded-md py-4 text-lg font-bold ${minutes === m ? "bg-accent ring-2 ring-primary" : "bg-card hover:bg-accent"}`}
              >
                {m} minutes
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Your best ({minutes} min): {best}</p>
          <button className="btn-green w-full py-4! text-2xl!" onClick={start}>
            Start
          </button>
        </div>
      )}

      {phase !== "setup" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-md bg-card p-3">
              <div className="text-sm text-muted-foreground">Time</div>
              <div className={`text-3xl font-bold tabular-nums ${left < 20000 && phase === "playing" ? "text-[#fa412d]" : ""}`} role="timer">
                {clockText(phase === "over" ? Math.max(0, left) : left)}
              </div>
            </div>
            <div className="rounded-md bg-card p-3">
              <div className="text-sm text-muted-foreground">Score</div>
              <div className="text-3xl font-bold tabular-nums">{solved}</div>
            </div>
          </div>
          <div className="flex items-center gap-2" aria-label={`${misses} of ${STRIKES} mistakes`}>
            {Array.from({ length: STRIKES }, (_, i) => (
              <span key={i} className={`grid size-8 place-items-center rounded-full ${i < misses ? "bg-[#fa412d] text-white" : "bg-card text-muted-foreground"}`}>
                <X className="size-5" aria-hidden />
              </span>
            ))}
            <span className="ml-2 text-sm text-muted-foreground">{phase === "playing" ? (loading ? "Loading…" : `Find the best move for ${side === "white" ? "White" : "Black"}.`) : ""}</span>
          </div>
          <div className="flex flex-wrap gap-1" aria-label="Results">
            {results.map((ok, i) => (
              <span key={i} className={`grid size-7 place-items-center rounded ${ok ? "bg-primary" : "bg-[#fa412d]"} text-white`}>
                {ok ? <Check className="size-4" aria-label="Solved" /> : <X className="size-4" aria-label="Missed" />}
              </span>
            ))}
          </div>
          {phase === "over" && (
            <div className="rounded-md bg-card p-4 text-center" role="status">
              <p className="text-2xl font-bold">Run over: {solved} solved</p>
              <p className="mb-3 text-muted-foreground">
                {newBest ? "New best score!" : `Your best (${minutes} min): ${best}`}
              </p>
              <button className="btn-green" onClick={() => setPhase("setup")}>
                Play again
              </button>
            </div>
          )}
        </div>
      )}
    </GameScreen>
  );
}
