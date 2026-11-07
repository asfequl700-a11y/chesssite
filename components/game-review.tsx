"use client";

import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { GraduationCap } from "lucide-react";
import { Board, type Promo } from "@/components/board";
import { MoveList } from "@/components/move-list";
import { GameScreen } from "@/components/game-screen";
import { AdSlot } from "@/components/ad-slot";
import { Button } from "@/components/ui/button";
import { Engine } from "@/lib/engine";
import { LABELS, sideAccuracy, winChance, type Label } from "@/lib/review";
import { runReview, type Review } from "@/lib/run-review";

const START = new Chess().fen();
const ORDER: Label[] = ["brilliant", "great", "best", "excellent", "good", "book", "inaccuracy", "mistake", "blunder"];

function EvalBar({ cp }: { cp: number }) {
  const white = winChance(cp);
  const text = Math.abs(cp) >= 9000 ? "M" : (Math.abs(cp) / 100).toFixed(1);
  return (
    <div className="relative w-6 shrink-0 overflow-hidden rounded-sm bg-[#403d39]" aria-label={`Evaluation ${cp >= 0 ? "+" : "-"}${text}`}>
      <div className="absolute inset-x-0 bottom-0 bg-white transition-[height] duration-300" style={{ height: `${white}%` }} />
      <span className={`absolute inset-x-0 text-center text-[10px] font-bold ${cp >= 0 ? "bottom-1 text-black" : "top-1 text-white"}`}>{text}</span>
    </div>
  );
}

function Graph({ review, ply, go }: { review: Review; ply: number; go: (n: number) => void }) {
  const pts = [review.startCp, ...review.moves.map((m) => m.cpAfter)].map(winChance);
  const n = pts.length - 1 || 1;
  const d = `M0,100 ` + pts.map((w, i) => `L${(i / n) * 300},${100 - w}`).join(" ") + ` L300,100 Z`;
  return (
    <svg
      viewBox="0 0 300 100"
      preserveAspectRatio="none"
      className="mb-4 h-20 w-full cursor-pointer rounded-md bg-[#403d39]"
      role="img"
      aria-label="Evaluation graph. Click to jump to a move."
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        go(Math.round(((e.clientX - r.left) / r.width) * n));
      }}
    >
      <path d={d} fill="#fff" />
      <line x1="0" x2="300" y1="50" y2="50" stroke="#888" strokeWidth=".5" />
      <line x1={(ply / n) * 300} x2={(ply / n) * 300} y1="0" y2="100" stroke="#81b64c" strokeWidth="1.5" />
      {review.moves.map((m, i) =>
        ["blunder", "mistake", "brilliant", "great"].includes(m.label) ? (
          <circle key={i} cx={((i + 1) / n) * 300} cy={100 - pts[i + 1]} r="2.5" fill={LABELS[m.label].color} />
        ) : null,
      )}
    </svg>
  );
}

export function GameReview() {
  const [pgn, setPgn] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [error, setError] = useState("");
  const [ply, setPly] = useState(0);
  const [flip, setFlip] = useState(false);
  const [retry, setRetry] = useState<Chess | null>(null);
  const [retryMsg, setRetryMsg] = useState("");
  const engine = useRef<Engine | null>(null);

  async function start(text: string) {
    setError("");
    try {
      new Chess().loadPgn(text);
    } catch {
      return setError("That doesn't look like a valid PGN. Copy the whole game text and try again.");
    }
    engine.current?.quit();
    const e = new Engine();
    engine.current = e;
    setReview(null);
    setProgress([0, 1]);
    try {
      const r = await runReview(text, e, (d, t) => engine.current === e && setProgress([d, t]));
      if (engine.current !== e) return;
      sessionStorage.removeItem("review-pgn");
      setReview(r);
      setPly(0);
    } catch {
      setError("The review stopped unexpectedly. Please try again.");
    }
    setProgress(null);
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("review-pgn");
    // Kept until the review finishes: React dev mode mounts twice and the first engine gets quit.
    if (saved) {
      setPgn(saved);
      void start(saved);
    }
    return () => engine.current?.quit();
  }, []);

  const total = review?.moves.length ?? 0;
  const go = (n: number) => {
    setRetry(null);
    setPly(Math.max(0, Math.min(total, n)));
  };

  const cur = review && ply > 0 ? review.moves[ply - 1] : null;
  const fenBefore = review ? (ply > 1 ? review.moves[ply - 2].fenAfter : review.startFen) : START;
  const canRetry = !!cur?.bestSan && ["inaccuracy", "mistake", "blunder"].includes(cur.label);
  const fen = retry ? retry.fen() : (cur?.fenAfter ?? review?.startFen ?? START);

  // "Retry": play the position before the mistake again until you find the engine's move.
  const onRetry = (from: string, to: string, promotion?: Promo) => {
    if (!retry || !cur) return false;
    try {
      const m = retry.move({ from, to, promotion });
      if (m.san === cur.bestSan) {
        setRetryMsg(`${m.san} is the best move. Well done!`);
        setRetry(new Chess(retry.fen()));
        return true;
      }
      retry.undo();
      setRetryMsg(`${m.san} isn't the best move. Try again.`);
    } catch {}
    return false;
  };
  const cp = cur?.cpAfter ?? review?.startCp ?? 0;
  const highlight = cur ? { [cur.from]: LABELS[cur.label].color + "88", [cur.to]: LABELS[cur.label].color + "cc" } : undefined;
  const bestArrow =
    cur && cur.bestSan && review && !retry
      ? (() => {
          const before = new Chess(fenBefore);
          try {
            const m = before.move(cur.bestSan);
            return [{ startSquare: m.from, endSquare: m.to, color: "rgba(129,182,76,.85)" }];
          } catch {
            return undefined;
          }
        })()
      : undefined;

  // Biggest swings: the moves that lost the most win chance for the mover.
  const swings = review
    ? review.moves
        .map((m, i) => {
          const before = winChance(i ? review.moves[i - 1].cpAfter : review.startCp);
          const after = winChance(m.cpAfter);
          return { i, loss: m.color === "w" ? before - after : after - before };
        })
        .filter((s) => s.loss >= 10)
        .sort((a, b) => b.loss - a.loss)
        .slice(0, 4)
    : [];

  const boardEl = (
    <div className="flex w-full gap-2">
      <EvalBar cp={cp} />
      <div className="min-w-0 flex-1">
        {retry ? (
          <Board game={retry} fen={fen} orientation={flip ? "black" : "white"} onMove={retry.fen() === fenBefore ? onRetry : undefined} />
        ) : (
          <Board
            fen={fen}
            orientation={flip ? "black" : "white"}
            highlight={highlight}
            arrows={bestArrow}
            badge={cur ? { square: cur.to, color: LABELS[cur.label].color, sym: LABELS[cur.label].sym } : undefined}
          />
        )}
      </div>
    </div>
  );

  return (
    <GameScreen title="Game Review" board={boardEl}>
      {progress && (
        <div className="mb-4 flex flex-col items-center gap-3">
          <p aria-live="polite">
            Reviewing move {progress[0]} of {progress[1]}…
          </p>
          <div className="h-2 w-full overflow-hidden rounded bg-card">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${(progress[0] / progress[1]) * 100}%` }} />
          </div>
          <AdSlot slot="review-loading" />
        </div>
      )}

      {!review && !progress && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void start(pgn);
          }}
        >
          <p className="mb-3 text-muted-foreground">Paste a game (PGN) from anywhere, or finish a game on this site and press “Review this game”. Free and unlimited.</p>
          <label htmlFor="pgn" className="sr-only">
            PGN
          </label>
          <textarea
            id="pgn"
            value={pgn}
            onChange={(e) => setPgn(e.target.value)}
            rows={8}
            placeholder="1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 …"
            className="mb-3 w-full rounded-md bg-card p-3 font-mono text-sm"
          />
          {error && (
            <p role="alert" className="mb-3 text-destructive">
              {error}
            </p>
          )}
          <button type="submit" className="btn-green w-full" disabled={!pgn.trim()}>
            Start review
          </button>
        </form>
      )}

      {review && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 text-center">
            {(["w", "b"] as const).map((c) => (
              <div key={c} className="rounded-md bg-card p-3">
                <div className="text-sm text-muted-foreground">{c === "w" ? "White" : "Black"} accuracy</div>
                <div className="text-2xl font-bold">{sideAccuracy(review.moves, c).toFixed(1)}</div>
              </div>
            ))}
          </div>

          <Graph review={review} ply={ply} go={go} />

          {/* Coach panel: round coach icon + speech bubble with the move's label, like chess.com's review coach. */}
          <div className="mb-4 flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-card text-primary">
              <GraduationCap className="size-7" aria-hidden />
            </span>
            <div className="relative flex-1 rounded-lg bg-white p-3 text-[#312e2b] before:absolute before:top-4 before:-left-2 before:border-y-8 before:border-r-8 before:border-y-transparent before:border-r-white" aria-live="polite">
              {retry ? (
                <p className="font-semibold">{retryMsg}</p>
              ) : cur ? (
                <>
                  <p className="mb-1 flex items-center gap-2 font-bold" style={{ color: LABELS[cur.label].color }}>
                    <span className="grid size-6 place-items-center rounded-full text-xs text-white" style={{ background: LABELS[cur.label].color }}>
                      {LABELS[cur.label].sym}
                    </span>
                    {cur.san} · {LABELS[cur.label].name}
                    <span className="ml-auto rounded bg-[#312e2b] px-1.5 text-xs text-white">
                      {Math.abs(cur.cpAfter) >= 9000 ? "M" : (cur.cpAfter >= 0 ? "+" : "") + (cur.cpAfter / 100).toFixed(2)}
                    </span>
                  </p>
                  <p className="text-sm">{cur.coach}</p>
                </>
              ) : (
                "Start position. Press Next (or the → key) to step through the game."
              )}
            </div>
          </div>
          {(canRetry || retry) && (
            <div className="mb-4 flex gap-2">
              {retry ? (
                <Button variant="secondary" onClick={() => setRetry(null)}>
                  Back to review
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setRetry(new Chess(fenBefore));
                    setRetryMsg(`Find a better move than ${cur!.san}.`);
                  }}
                >
                  Retry this move
                </Button>
              )}
            </div>
          )}

          <table className="mb-4 w-full text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left font-normal">Move type</th>
                <th className="font-normal">White</th>
                <th className="font-normal">Black</th>
              </tr>
            </thead>
            <tbody>
              {ORDER.map((l) => (
                <tr key={l}>
                  <td style={{ color: LABELS[l].color }}>
                    {LABELS[l].sym} {LABELS[l].name}
                  </td>
                  {(["w", "b"] as const).map((c) => (
                    <td key={c} className="text-center">
                      {review.moves.filter((m) => m.label === l && m.color === c).length}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {swings.length > 0 && (
            <div className="mb-4">
              <h2 className="mb-2 text-xl">Key moments</h2>
              <div className="flex flex-wrap gap-2">
                {swings.map(({ i }) => {
                  const m = review.moves[i];
                  return (
                    <button key={i} onClick={() => go(i + 1)} className="rounded-md bg-card px-2 py-1 text-sm hover:bg-accent">
                      {Math.floor(i / 2) + 1}
                      {m.color === "w" ? "." : "…"} {m.san} <span style={{ color: LABELS[m.label].color }}>{LABELS[m.label].sym}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <MoveList
            sans={review.moves.map((m) => m.san)}
            ply={ply}
            go={go}
            sym={(j) => (
              <span className="mr-1 inline-block w-5 text-center text-xs font-bold" style={{ color: LABELS[review.moves[j].label].color }}>
                {LABELS[review.moves[j].label].sym}
              </span>
            )}
          />

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setFlip(!flip)}>
              Flip
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setReview(null);
                setPly(0);
              }}
            >
              New review
            </Button>
          </div>
        </>
      )}
    </GameScreen>
  );
}
