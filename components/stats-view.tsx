"use client";

import { useState } from "react";
import Link from "next/link";
import { PlainPage } from "@/components/game-screen";
import { LoginFirst, RESULT, useMyGames } from "@/components/my-games";
import { accuracySeries, tally, totals, type Tally } from "@/lib/stats";

// Win / draw / loss read as two poles with a neutral middle (validated on the #262421 panel with the
// dataviz palette checker). Every bar also carries text labels, so colour is never the only cue.
const ORDER = ["win", "draw", "loss"] as const;

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-panel p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex gap-4 text-xs text-muted-foreground">
      {ORDER.map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: RESULT[k].color }} aria-hidden />
          {RESULT[k].text}
        </span>
      ))}
    </div>
  );
}

/** One row per group: a 100% stacked bar (2px gaps between segments) with the counts written out. */
function ResultBars({ title, rows }: { title: string; rows: Tally[] }) {
  if (!rows.length) return null;
  return (
    <section className="rounded-md bg-panel p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl">{title}</h2>
        <Legend />
      </div>
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.key}>
            <div className="mb-1 flex justify-between gap-3 text-sm">
              <span className="truncate">{r.key}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {r.win}W · {r.draw}D · {r.loss}L
              </span>
            </div>
            <div className="flex h-3 gap-[2px]" role="img" aria-label={`${r.key}: ${r.win} won, ${r.draw} drawn, ${r.loss} lost`}>
              {ORDER.filter((k) => r[k]).map((k) => (
                <div
                  key={k}
                  title={`${RESULT[k].text}: ${r[k]} of ${r.total} (${Math.round((r[k] / r.total) * 100)}%)`}
                  className="first:rounded-l last:rounded-r"
                  style={{ width: `${(r[k] / r.total) * 100}%`, background: RESULT[k].color }}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Accuracy per game over time: one 2px line, recessive grid, crosshair + tooltip on hover. */
function AccuracyChart({ points }: { points: { date: string; accuracy: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2)
    return (
      <section className="rounded-md bg-panel p-5">
        <h2 className="mb-2 text-2xl">Accuracy over time</h2>
        <p className="text-muted-foreground">Finish at least two games to see your accuracy trend.</p>
      </section>
    );
  const W = 600;
  const H = 200;
  const pad = { l: 32, r: 12, t: 10, b: 22 };
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (a: number) => pad.t + (1 - a / 100) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.accuracy).toFixed(1)}`).join("");
  const h = hover === null ? null : points[hover];
  return (
    <section className="rounded-md bg-panel p-5">
      <h2 className="mb-3 text-2xl">Accuracy over time</h2>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Accuracy over your last ${points.length} games, from ${points[0].accuracy.toFixed(1)} to ${points.at(-1)!.accuracy.toFixed(1)}`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const fx = ((e.clientX - r.left) / r.width) * W;
            setHover(Math.max(0, Math.min(points.length - 1, Math.round(((fx - pad.l) / (W - pad.l - pad.r)) * (points.length - 1)))));
          }}
        >
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,.08)" />
              <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="rgba(255,255,255,.5)">
                {v}
              </text>
            </g>
          ))}
          <path d={path} fill="none" stroke="#81b64c" strokeWidth="2" strokeLinejoin="round" />
          {h && hover !== null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,.3)" />
              <circle cx={x(hover)} cy={y(h.accuracy)} r="5" fill="#81b64c" stroke="#262421" strokeWidth="2" />
            </>
          )}
        </svg>
        {h && hover !== null && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded bg-card px-2 py-1 text-xs whitespace-nowrap shadow"
            style={{ left: `${(x(hover) / W) * 100}%` }}
          >
            <b>{h.accuracy.toFixed(1)}</b> · {new Date(h.date).toLocaleDateString()}
          </div>
        )}
      </div>
    </section>
  );
}

export function StatsView() {
  const { user, ready, games, error } = useMyGames();
  if (!ready) return <PlainPage title="Stats" />;
  if (!user)
    return (
      <PlainPage title="Stats">
        <LoginFirst what="your stats" />
      </PlainPage>
    );
  if (error)
    return (
      <PlainPage title="Stats">
        <p className="text-destructive">{error}</p>
      </PlainPage>
    );
  if (!games)
    return (
      <PlainPage title="Stats">
        <p className="text-muted-foreground">Loading…</p>
      </PlainPage>
    );
  const t = totals(games);
  return (
    <PlainPage title="Stats">
      {!games.length ? (
        <p className="text-muted-foreground">
          No games yet.{" "}
          <Link href="/play" className="text-primary hover:underline">
            Play a game
          </Link>{" "}
          and your stats start here.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Tile label="Games" value={String(t.total)} />
            <Tile label="Won" value={String(t.win)} />
            <Tile label="Drawn" value={String(t.draw)} />
            <Tile label="Lost" value={String(t.loss)} />
            <Tile label="Avg accuracy" value={t.accuracy === null ? "—" : t.accuracy.toFixed(1)} />
          </div>
          <AccuracyChart points={accuracySeries(games).slice(-100)} />
          <ResultBars title="By colour" rows={tally(games, (g) => (g.my_color === "w" ? "As White" : "As Black"))} />
          <ResultBars title="By bot" rows={tally(games, (g) => (g.mode === "computer" ? (g.bot ?? "Computer") : null))} />
          <ResultBars title="By opening" rows={tally(games, (g) => g.opening ?? "Unknown opening")} />
        </div>
      )}
    </PlainPage>
  );
}
