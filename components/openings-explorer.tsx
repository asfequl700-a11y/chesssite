"use client";

import { useEffect, useState } from "react";
import { Chess } from "chess.js";
import { Board } from "@/components/board";
import { GameScreen } from "@/components/game-screen";
import { MoveList } from "@/components/move-list";

type Row = [eco: string, name: string, pgn: string, fen: string];

const START = new Chess().fen();

export function OpeningsExplorer() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<Row | null>(null);
  const [ply, setPly] = useState(0);

  useEffect(() => {
    fetch("/openings.json")
      .then((r) => r.json())
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = rows.filter((r) => words.every((w) => `${r[0]} ${r[1]}`.toLowerCase().includes(w))).slice(0, 100);

  const sans = pick ? pick[2].split(" ").filter((t) => !/^\d+\.$/.test(t)) : [];
  const g = new Chess();
  let last: { from: string; to: string } | null = null;
  for (const san of sans.slice(0, ply)) last = g.move(san);
  const fen = pick ? g.fen() : START;
  const highlight = last ? { [last.from]: "rgba(255,255,51,.5)", [last.to]: "rgba(255,255,51,.5)" } : undefined;

  return (
    <GameScreen title="Openings" board={<Board fen={fen} highlight={highlight} />}>
      {pick && (
        <div className="mb-4 rounded-md bg-card p-3">
          <p className="text-sm text-muted-foreground">{pick[0]}</p>
          <h2 className="mb-2 text-xl">{pick[1]}</h2>
        </div>
      )}
      {pick && <MoveList sans={sans} ply={ply} go={setPly} />}
      <label htmlFor="q" className="sr-only">
        Search openings
      </label>
      <input
        id="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`Search ${rows.length || ""} openings, e.g. "sicilian najdorf" or "C50"`}
        className="mb-3 w-full rounded-md bg-card px-3 py-2"
      />
      <ul className="max-h-[28rem] overflow-y-auto rounded-md bg-card">
        {shown.map((r) => (
          <li key={r[0] + r[1] + r[2]}>
            <button
              onClick={() => {
                setPick(r);
                setPly(r[2].split(" ").filter((t) => !/^\d+\.$/.test(t)).length);
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-accent ${pick === r ? "bg-accent" : ""}`}
            >
              <span className="mr-2 text-muted-foreground">{r[0]}</span>
              {r[1]}
            </button>
          </li>
        ))}
        {!rows.length && <li className="p-3 text-muted-foreground">Loading…</li>}
      </ul>
      <p className="mt-4 text-xs text-muted-foreground">Opening names from the free Lichess opening list.</p>
    </GameScreen>
  );
}
