"use client";

import { useEffect, useRef } from "react";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Numbered move pairs; `ply` = moves shown on the board (0 = start). Click a move, use the buttons,
 * or the keys ← → (step) and ↑ ↓ / Home End (start / end) to move through the game.
 */
export function MoveList({
  sans,
  ply,
  go,
  sym,
  empty = "No moves yet.",
}: {
  sans: string[];
  ply: number;
  go: (n: number) => void;
  sym?: (i: number) => React.ReactNode; // e.g. a review label before move i
  empty?: string;
}) {
  const list = useRef<HTMLOListElement>(null);
  const to = (n: number) => go(Math.max(0, Math.min(sans.length, n)));
  const latest = useRef(to);
  latest.current = to;
  const plyRef = useRef(ply);
  plyRef.current = ply;

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
      const jump = { ArrowUp: 0, Home: 0, ArrowDown: Infinity, End: Infinity }[e.key];
      if (step === undefined && jump === undefined) return;
      e.preventDefault();
      latest.current(step !== undefined ? plyRef.current + step : jump!);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  // Keep the selected move in view without scrolling the page.
  useEffect(() => {
    const ol = list.current;
    const el = ol?.querySelector<HTMLElement>(".selected");
    if (ol && el) ol.scrollTop = el.offsetTop - ol.clientHeight / 2;
  }, [ply]);

  const move = (j: number) =>
    sans[j] !== undefined ? (
      <button key={j} onClick={() => to(j + 1)} className={`move ${ply === j + 1 ? "selected" : ""}`}>
        {sym?.(j)}
        {sans[j]}
      </button>
    ) : (
      <span key={j} />
    );

  return (
    <>
      <ol ref={list} className="move-list relative mb-2 max-h-64 overflow-y-auto rounded-md bg-card">
        {sans.map((_, i) =>
          i % 2 === 0 ? (
            <li key={i}>
              <span className="text-muted-foreground">{i / 2 + 1}.</span>
              {move(i)}
              {move(i + 1)}
            </li>
          ) : null,
        )}
        {!sans.length && <li className="text-muted-foreground" style={{ display: "flex" }}>{empty}</li>}
      </ol>
      <div className="mb-4 grid grid-cols-4 gap-1">
        {[
          { n: 0, label: "First move", Icon: ChevronFirst },
          { n: ply - 1, label: "Previous move", Icon: ChevronLeft },
          { n: ply + 1, label: "Next move", Icon: ChevronRight },
          { n: sans.length, label: "Last move", Icon: ChevronLast },
        ].map(({ n, label, Icon }) => (
          <Button key={label} variant="secondary" className="h-10" onClick={() => to(n)} aria-label={label} title={label}>
            <Icon className="size-6" />
          </Button>
        ))}
      </div>
    </>
  );
}
