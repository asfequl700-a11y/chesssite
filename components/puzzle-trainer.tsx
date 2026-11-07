"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Chess } from "chess.js";
import { Swords, Timer } from "lucide-react";
import { Board, type Promo } from "@/components/board";
import { GameScreen } from "@/components/game-screen";
import { Button } from "@/components/ui/button";
import { difficultyFor, eloUpdate, fetchPuzzle, fetchPuzzleById, playUci, THEMES, type Puzzle } from "@/lib/puzzles";
import { markActive } from "@/lib/activity";
import { updateProfile, useAccount } from "@/lib/supabase";

/** Puzzle rating: saved on your profile when logged in, in this browser for guests. */
export function usePuzzleRating() {
  const { profile } = useAccount();
  const [guest, setGuest] = useState(1500);
  useEffect(() => setGuest(Number(localStorage.getItem("puzzle-rating")) || 1500), []);
  const rating = profile?.puzzle_rating ?? guest;
  const save = (r: number) => {
    if (profile) void updateProfile({ puzzle_rating: r });
    else {
      localStorage.setItem("puzzle-rating", String(r));
      setGuest(r);
    }
  };
  return [rating, save] as const;
}

export function PuzzleTrainer() {
  const game = useRef(new Chess());
  const puzzle = useRef<(Puzzle & { step: number; failed: boolean; rated: boolean }) | null>(null);
  const [fen, setFen] = useState(game.current.fen());
  const [side, setSide] = useState<"white" | "black">("white");
  const [msg, setMsg] = useState("Loading puzzle…");
  const [hint, setHint] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const [theme, setTheme] = useState("");
  const [rating, saveRating] = usePuzzleRating();
  const [change, setChange] = useState<number | null>(null);

  async function load(angle = theme) {
    setMsg("Loading puzzle…");
    setHint(null);
    setSolved(false);
    setChange(null);
    try {
      // A puzzle picked elsewhere (e.g. the dashboard's daily puzzle) is opened once, then random ones follow.
      const picked = sessionStorage.getItem("puzzle-id");
      sessionStorage.removeItem("puzzle-id");
      const p = picked ? await fetchPuzzleById(picked) : await fetchPuzzle(angle, difficultyFor(rating));
      game.current = p.game;
      puzzle.current = { ...p, step: 0, failed: false, rated: false };
      const s = p.game.turn() === "w" ? "white" : "black";
      setSide(s);
      setFen(p.game.fen());
      setMsg(`Find the best move for ${s === "white" ? "White" : "Black"}.`);
    } catch {
      setMsg("Could not load a puzzle. Check your internet and try again.");
    }
  }

  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Rate the puzzle once: the first mistake or a hint counts as a fail, a clean solve as a win. */
  const rate = (won: boolean) => {
    const p = puzzle.current;
    if (!p || p.rated) return;
    p.rated = true;
    markActive(won ? 1 : 0);
    const next = eloUpdate(rating, p.rating, won);
    setChange(next - rating);
    saveRating(next);
  };

  const onMove = (from: string, to: string, promotion?: Promo) => {
    const g = game.current;
    const p = puzzle.current;
    if (!p || solved) return false;
    let move;
    try {
      move = g.move({ from, to, promotion });
    } catch {
      return false;
    }
    // Any checkmate counts, even if it isn't the listed solution move.
    if (move.lan !== p.solution[p.step] && !g.isCheckmate()) {
      g.undo();
      rate(false);
      setMsg("Not quite. Try again!");
      setFen(g.fen());
      return false;
    }
    p.step++;
    setHint(null);
    if (p.step < p.solution.length && !g.isCheckmate()) {
      playUci(g, p.solution[p.step]); // opponent's reply
      p.step++;
      setMsg("Correct! Keep going.");
    } else {
      rate(true);
      setSolved(true);
      setMsg("Solved! 🎉");
    }
    setFen(g.fen());
    return true;
  };

  const p = puzzle.current;
  const showHint = () => {
    if (!p || solved) return;
    rate(false);
    setHint(p.solution[p.step].slice(0, 2));
  };

  return (
    <GameScreen
      title="Puzzles"
      board={<Board game={game.current} fen={fen} orientation={side} onMove={onMove} highlight={hint ? { [hint]: "rgba(38,194,163,.6)" } : undefined} />}
    >
      <div className="mb-4 flex items-center justify-between rounded-md bg-card p-3">
        <span className="text-sm text-muted-foreground">Your puzzle rating</span>
        <span className="text-2xl font-bold tabular-nums">
          {rating}
          {change !== null && change !== 0 && (
            <span className={`ml-2 text-base ${change > 0 ? "text-primary" : "text-[#fa412d]"}`}>
              {change > 0 ? "+" : ""}
              {change}
            </span>
          )}
        </span>
      </div>

      <label className="mb-4 flex items-center gap-3 text-sm">
        Theme
        <select
          value={theme}
          onChange={(e) => {
            setTheme(e.target.value);
            void load(e.target.value);
          }}
          className="flex-1 rounded-md bg-card px-3 py-2"
        >
          {THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <p className="mb-2 text-lg font-semibold" aria-live="polite">
        {msg}
      </p>
      {p && (
        <p className="mb-4 text-sm text-muted-foreground">
          Puzzle rating {solved || p.rated ? p.rating : "hidden until you finish"} · {p.themes.slice(0, 3).join(", ")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={showHint} disabled={!p || solved}>
          Hint
        </Button>
        <button className="btn-green" onClick={() => void load()}>
          {solved ? "Next puzzle" : "Skip puzzle"}
        </button>
      </div>

      <Link href="/puzzles/battle" className="mt-6 flex items-center gap-3 rounded-md bg-card p-3 hover:bg-accent">
        <Swords className="size-6 text-primary" aria-hidden />
        <span>
          <b>Puzzle Battle</b>
          <span className="block text-sm text-muted-foreground">Race another player live through the same puzzles for 3 minutes.</span>
        </span>
      </Link>
      <Link href="/puzzles/rush" className="mt-2 flex items-center gap-3 rounded-md bg-card p-3 hover:bg-accent">
        <Timer className="size-6 text-primary" aria-hidden />
        <span>
          <b>Puzzle Rush</b>
          <span className="block text-sm text-muted-foreground">Solve as many as you can in 3 or 5 minutes. 3 mistakes and you&apos;re out.</span>
        </span>
      </Link>
      <p className="mt-6 text-xs text-muted-foreground">Puzzles from the free Lichess puzzle database. A hint or a wrong move counts as a miss.</p>
    </GameScreen>
  );
}
