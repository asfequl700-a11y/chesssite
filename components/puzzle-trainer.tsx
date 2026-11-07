"use client";

import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Board, type Promo } from "@/components/board";
import { GameScreen } from "@/components/game-screen";
import { Button } from "@/components/ui/button";

type Puzzle = { solution: string[]; step: number; rating: number; themes: string[] };

const play = (g: Chess, uci: string) => g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });

export function PuzzleTrainer() {
  const game = useRef(new Chess());
  const puzzle = useRef<Puzzle | null>(null);
  const [fen, setFen] = useState(game.current.fen());
  const [side, setSide] = useState<"white" | "black">("white");
  const [msg, setMsg] = useState("Loading puzzle…");
  const [hint, setHint] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);

  async function load() {
    setMsg("Loading puzzle…");
    setHint(null);
    setSolved(false);
    try {
      const res = await fetch("https://lichess.org/api/puzzle/next", { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const g = new Chess();
      g.loadPgn(data.game.pgn); // the board after these moves is the puzzle start
      game.current = g;
      puzzle.current = { solution: data.puzzle.solution, step: 0, rating: data.puzzle.rating, themes: data.puzzle.themes };
      const s = g.turn() === "w" ? "white" : "black";
      setSide(s);
      setFen(g.fen());
      setMsg(`Find the best move for ${s === "white" ? "White" : "Black"}.`);
    } catch {
      setMsg("Could not load a puzzle. Check your internet and try again.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

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
      setMsg("Not quite. Try again!");
      setFen(g.fen());
      return false;
    }
    p.step++;
    setHint(null);
    if (p.step < p.solution.length && !g.isCheckmate()) {
      play(g, p.solution[p.step]); // opponent's reply
      p.step++;
      setMsg("Correct! Keep going.");
    } else {
      setSolved(true);
      setMsg("Solved! 🎉");
    }
    setFen(g.fen());
    return true;
  };

  const p = puzzle.current;
  const showHint = () => p && !solved && setHint(p.solution[p.step].slice(0, 2));

  return (
    <GameScreen
      title="Puzzles"
      board={<Board game={game.current} fen={fen} orientation={side} onMove={onMove} highlight={hint ? { [hint]: "rgba(38,194,163,.6)" } : undefined} />}
    >
      <p className="mb-2 text-lg font-semibold" aria-live="polite">
        {msg}
      </p>
      {p && (
        <p className="mb-4 text-sm text-muted-foreground">
          Rating {p.rating} · {p.themes.slice(0, 3).join(", ")}
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
      <p className="mt-6 text-xs text-muted-foreground">Puzzles from the free Lichess puzzle database.</p>
    </GameScreen>
  );
}
