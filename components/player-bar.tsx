"use client";

import { Bot, User, X } from "lucide-react";
import { pieceSet } from "@/components/board";
import { captured, clockText, type Result } from "@/lib/game";
import { useSettings } from "@/lib/settings";

/**
 * Name strip above/below the board (chess.com: 40px tall, 40px avatar, 14px semibold name),
 * pieces this side has taken with the material lead, and an optional clock.
 */
export function PlayerBar({
  name,
  color,
  fen,
  bot,
  clock,
}: {
  name: string;
  color: "w" | "b";
  fen: string;
  bot?: boolean;
  clock?: { ms: number; running: boolean };
}) {
  const { taken, lead } = captured(fen, color);
  const pieces = pieceSet(useSettings().pieces);
  const Icon = bot ? Bot : User;
  const low = !!clock && clock.ms < 20000;
  return (
    <div className="flex h-10 w-full items-center gap-2">
      <span className="grid size-10 shrink-0 place-items-center rounded-[3px] bg-card text-muted-foreground">
        <Icon className="size-6" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">{name}</div>
        <div className="flex h-4 items-center" aria-label={`${taken.length} pieces captured${lead ? `, up ${lead}` : ""}`}>
          {taken.map((k, i) => (
            <span key={i} className={`inline-block size-4 ${i && taken[i - 1] === k ? "-ml-2" : ""}`}>
              {pieces[(color === "w" ? "b" : "w") + k.toUpperCase()]()}
            </span>
          ))}
          {lead > 0 && <span className="ml-1 text-xs text-white/50">+{lead}</span>}
        </div>
      </div>
      {clock && (
        // chess.com clock: 134×40, radius 3px, white/dark face, dimmed when not running, red when low.
        <div
          className={`flex h-10 w-[134px] shrink-0 items-center justify-end rounded-[3px] px-3 text-2xl font-semibold tabular-nums transition-opacity ${
            clock.running && low ? "bg-[#ad1f24] text-white" : color === "w" ? "bg-white text-[#262421]" : "bg-[#262421] text-white"
          } ${clock.running ? "" : "opacity-50"}`}
          role="timer"
          aria-label={`${name} clock`}
        >
          {clockText(clock.ms)}
        </div>
      )}
    </div>
  );
}

/** Game-over box shown over the board. */
export function GameOver({
  result,
  title,
  onReview,
  onRematch,
  onNew,
  onClose,
}: {
  result: Result;
  title: string;
  onReview: () => void;
  onRematch: () => void;
  onNew: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/40 p-4">
      <div role="dialog" aria-labelledby="game-over-title" className="relative w-full max-w-[19rem] overflow-hidden rounded-[10px] bg-panel shadow-[0_8px_24px_rgba(0,0,0,.5)]">
        <button className="absolute top-2 right-2 text-white/60 hover:text-white" onClick={onClose} aria-label="Close">
          <X className="size-5" />
        </button>
        <div className="bg-white/10 px-6 py-6 text-center">
          <h2 id="game-over-title" className="text-3xl font-bold text-white">
            {title}
          </h2>
          <p className="text-sm text-white/70">{result.reason}</p>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <button className="btn-green w-full" onClick={onReview}>
            Game Review
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button className="rounded-md bg-card py-2 font-semibold hover:bg-accent" onClick={onNew}>
              New game
            </button>
            <button className="rounded-md bg-card py-2 font-semibold hover:bg-accent" onClick={onRematch}>
              Rematch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
