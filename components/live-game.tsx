"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import { Board, type Promo } from "@/components/board";
import { GameScreen } from "@/components/game-screen";
import { MoveList } from "@/components/move-list";
import { GameOver, PlayerBar } from "@/components/player-bar";
import { Button } from "@/components/ui/button";
import { Engine } from "@/lib/engine";
import { ruleResult, type Result } from "@/lib/game";

// Bot levels: Stockfish "Skill Level" (0-20) and thinking time in ms.
const LEVELS = [
  { name: "Easy", skill: 0, ms: 100 },
  { name: "Casual", skill: 4, ms: 200 },
  { name: "Medium", skill: 8, ms: 400 },
  { name: "Hard", skill: 13, ms: 700 },
  { name: "Expert", skill: 17, ms: 1000 },
  { name: "Master", skill: 20, ms: 1500 },
];
// Only called from move handlers, never during render.
const clockNow = () => Date.now();
const TIMES = [0, 1, 3, 5, 10]; // minutes per side, 0 = no clock (vs friend only)
const PREMOVE = "rgba(244,42,50,.5)";

export function statusText(g: Chess) {
  const side = g.turn() === "w" ? "White" : "Black";
  if (g.isCheckmate()) return `Checkmate. ${side === "White" ? "Black" : "White"} wins.`;
  if (g.isDraw()) return "Draw.";
  return `${side} to move${g.inCheck() ? " (check)" : ""}`;
}

/** Saves the game and opens Game Review on it. */
export function useReviewGame() {
  const router = useRouter();
  return (g: Chess) => {
    sessionStorage.setItem("review-pgn", g.pgn());
    router.push("/analysis");
  };
}

const name = (c: "w" | "b") => (c === "w" ? "White" : "Black");
type Move = { from: string; to: string };

export function LiveGame({ mode }: { mode: "computer" | "friend" }) {
  const game = useRef(new Chess());
  const engine = useRef<Engine | null>(null);
  const [fen, setFen] = useState(game.current.fen());
  const [side, setSide] = useState<"white" | "black">("white");
  const [flip, setFlip] = useState(false);
  const [level, setLevel] = useState(2);
  const [thinking, setThinking] = useState(false);
  const [view, setView] = useState<number | null>(null); // ply being looked at, null = live position
  const [ended, setEnded] = useState<Result | null>(null); // resign, draw agreed, time out
  const [closed, setClosed] = useState(false);
  const [minutes, setMinutes] = useState(0);
  const premove = useRef<Move | null>(null);
  const [pm, setPm] = useState<Move | null>(null); // premove, for display
  const clock = useRef({ w: 0, b: 0, since: 0 }); // ms left; `since` = when the running clock started
  const [now, setNow] = useState(0);
  const review = useReviewGame();
  const g = game.current;
  const me = side[0] as "w" | "b";
  const result = ended ?? ruleResult(g);
  const history = g.history();
  const timed = mode === "friend" && minutes > 0;
  const running = timed && !result && history.length > 0;

  useEffect(() => {
    if (mode !== "computer") return;
    engine.current = new Engine();
    return () => engine.current?.quit();
  }, [mode]);

  // Tick the clock; flag a loss on time.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const c = clock.current;
      const turn = game.current.turn();
      // shortcut: a flag always loses, even if the winner has no mating material (chess.com calls that a draw)
      if (c[turn] - (t - c.since) <= 0) {
        c[turn] = 0;
        c.since = t;
        setEnded({ winner: turn === "w" ? "b" : "w", reason: "on time" });
      }
    }, 100);
    return () => clearInterval(id);
  }, [running]);

  const left = (c: "w" | "b") => {
    const k = clock.current;
    return k[c] - (running && g.turn() === c ? Math.max(0, now - k.since) : 0);
  };

  const setPremove = (m: Move | null) => {
    premove.current = m;
    setPm(m);
  };

  /** Call after every move: charge the mover's clock and start the other one. */
  const moved = (ng: Chess) => {
    if (timed) {
      const t = clockNow();
      const c = clock.current;
      const mover = ng.turn() === "w" ? "b" : "w";
      if (c.since) c[mover] -= t - c.since; // the clock starts after White's first move
      c.since = t;
      setNow(t);
    }
    setView(null);
    setFen(ng.fen());
  };

  const botMove = async (ng: Chess) => {
    const e = engine.current;
    if (!e || ng.isGameOver()) return;
    setThinking(true);
    const startFen = ng.fen();
    const { skill, ms } = LEVELS[level];
    const uci = await e.bestMove(startFen, skill, ms);
    setThinking(false);
    // Skip if the position changed (undo / new game) while the engine was thinking.
    if (game.current !== ng || ng.fen() !== startFen || uci === "(none)") return;
    ng.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    const p = premove.current;
    setPremove(null);
    if (p) {
      try {
        ng.move({ ...p, promotion: "q" }); // shortcut: a premoved promotion becomes a queen
        moved(ng);
        return void botMove(ng);
      } catch {} // the premove became illegal: drop it
    }
    moved(ng);
  };

  const onMove = (from: string, to: string, promotion?: Promo) => {
    if (result) return false;
    if (mode === "computer" && (thinking || g.turn() !== me)) {
      setPremove({ from, to });
      return false;
    }
    try {
      g.move({ from, to, promotion });
    } catch {
      return false;
    }
    moved(g);
    if (mode === "computer") void botMove(g);
    return true;
  };

  const reset = (m = minutes) => {
    const ng = new Chess();
    game.current = ng;
    clock.current = { w: m * 60000, b: m * 60000, since: 0 };
    setEnded(null);
    setClosed(false);
    setPremove(null);
    setView(null);
    setFen(ng.fen());
    return ng;
  };

  const newGame = (s: "white" | "black") => {
    const ng = reset();
    setSide(s);
    setFlip(false);
    if (mode === "computer" && s === "black") void botMove(ng);
  };

  const undo = () => {
    g.undo();
    if (mode === "computer" && g.turn() !== me) g.undo(); // also take back the computer's move
    setPremove(null);
    setView(null);
    setFen(g.fen());
  };

  const resign = () => {
    const loser = mode === "computer" ? me : g.turn();
    if (confirm(mode === "computer" ? "Resign this game?" : `${name(loser)}, resign?`))
      setEnded({ winner: loser === "w" ? "b" : "w", reason: "by resignation" });
  };

  const offerDraw = () => {
    const other = g.turn() === "w" ? "b" : "w";
    if (confirm(`${name(other)}: ${name(g.turn())} offers a draw. Accept?`)) setEnded({ winner: null, reason: "by agreement" });
  };

  // Looking back through the game: replay up to `view`.
  const shown = useMemo(() => {
    if (view === null) return null;
    const v = new Chess();
    for (const san of history.slice(0, view)) v.move(san);
    return v;
  }, [view, fen]); // eslint-disable-line react-hooks/exhaustive-deps

  const orientation = (side === "white") !== flip ? "white" : "black";
  const top = orientation === "white" ? "b" : "w";
  const bottom = top === "w" ? "b" : "w";
  const player = (c: "w" | "b") => (mode === "computer" ? (c === me ? "You" : `Computer (${LEVELS[level].name})`) : name(c));
  const bar = (c: "w" | "b") => (
    <PlayerBar
      name={player(c)}
      color={c}
      fen={fen}
      bot={mode === "computer" && c !== me}
      clock={timed ? { ms: left(c), running: running && g.turn() === c } : undefined}
    />
  );
  const title = !result
    ? ""
    : result.winner === null
      ? "Draw"
      : mode === "computer"
        ? result.winner === me
          ? "You won!"
          : "You lost"
        : `${name(result.winner)} won`;

  const board = (
    <div className="flex w-full flex-col gap-2">
      {bar(top)}
      <Board
        game={shown ?? g}
        fen={shown?.fen() ?? fen}
        orientation={orientation}
        onMove={shown || result ? undefined : onMove}
        side={mode === "computer" ? me : undefined}
        highlight={pm ? { [pm.from]: PREMOVE, [pm.to]: PREMOVE } : undefined}
      >
        {result && !closed && (
          <GameOver
            result={result}
            title={title}
            onReview={() => review(g)}
            onNew={() => newGame(side)}
            onRematch={() => newGame(side === "white" ? "black" : "white")}
            onClose={() => setClosed(true)}
          />
        )}
      </Board>
      {bar(bottom)}
    </div>
  );

  return (
    <GameScreen title={mode === "computer" ? "Play vs Computer" : "Play vs Friend"} board={board}>
      <p className="mb-4 text-lg font-semibold" aria-live="polite">
        {result ? `${title} ${result.reason}.` : thinking ? "Computer is thinking…" : statusText(g)}
      </p>

      {mode === "computer" ? (
        <label className="mb-4 flex items-center gap-3">
          Level
          <select value={level} onChange={(e) => setLevel(Number(e.target.value))} className="rounded-md bg-card px-3 py-2">
            {LEVELS.map((l, i) => (
              <option key={l.name} value={i}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="mb-4 flex items-center gap-3">
          Clock
          <select
            value={minutes}
            onChange={(e) => {
              const m = Number(e.target.value);
              setMinutes(m);
              reset(m);
            }}
            className="rounded-md bg-card px-3 py-2"
          >
            {TIMES.map((t) => (
              <option key={t} value={t}>
                {t ? `${t} min` : "No clock"}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">(starts a new game)</span>
        </label>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <Button onClick={() => newGame("white")}>New game as White</Button>
        <Button onClick={() => newGame("black")}>New game as Black</Button>
        <Button variant="secondary" onClick={undo} disabled={!history.length || !!result || timed}>
          Undo
        </Button>
        <Button variant="secondary" onClick={() => setFlip(!flip)}>
          Flip board
        </Button>
        <Button variant="secondary" onClick={resign} disabled={!history.length || !!result}>
          Resign
        </Button>
        {mode === "friend" && (
          <Button variant="secondary" onClick={offerDraw} disabled={!history.length || !!result}>
            Offer draw
          </Button>
        )}
      </div>

      <MoveList sans={history} ply={view ?? history.length} go={(n) => setView(n >= history.length ? null : n)} />

      {history.length > 0 && (
        <button className="btn-green w-full" onClick={() => review(g)}>
          Review this game
        </button>
      )}
    </GameScreen>
  );
}
