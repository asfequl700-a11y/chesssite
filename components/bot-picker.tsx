"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { BotAvatar } from "@/components/bot-avatar";
import { Button } from "@/components/ui/button";
import { BOTS } from "@/lib/bots";

const GROUPS = ["Beginner", "Intermediate", "Advanced", "Master"] as const;
const STYLE = { balanced: "All-rounder", aggressive: "Attacker", defensive: "Defender", trader: "Trader" };

/** Bot list like chess.com's: the chosen bot big with a speech bubble, then avatars grouped by level. */
export function BotPicker({
  selected,
  beaten,
  onSelect,
  onPlay,
  onCancel,
}: {
  selected: string;
  beaten: string[];
  onSelect: (id: string) => void;
  onPlay: (color: "white" | "black") => void;
  onCancel?: () => void;
}) {
  const [color, setColor] = useState<"white" | "random" | "black">("white");
  const bot = BOTS.find((b) => b.id === selected) ?? BOTS[0];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <BotAvatar bot={bot} size={72} />
        <div className="flex-1">
          <p className="text-lg font-semibold">
            {bot.name} <span className="text-muted-foreground">{bot.rating}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {bot.group} · {STYLE[bot.style]}
          </p>
          <p className="mt-2 rounded-lg bg-white px-3 py-2 text-sm text-[#312e2b]">{bot.lines.hello}</p>
        </div>
      </div>

      <div className="flex max-h-[22rem] flex-col gap-3 overflow-y-auto pr-1">
        {GROUPS.map((group) => (
          <section key={group} className="rounded-md bg-card p-3">
            <h2 className="mb-2 font-sans text-sm font-bold">{group}</h2>
            <div className="flex flex-wrap gap-2">
              {BOTS.filter((b) => b.group === group).map((b) => (
                <button
                  key={b.id}
                  onClick={() => onSelect(b.id)}
                  aria-pressed={b.id === selected}
                  title={`${b.name} (${b.rating}): ${b.about}`}
                  className={`relative flex flex-col items-center gap-1 rounded-md p-1.5 text-xs ${b.id === selected ? "bg-primary/25 ring-2 ring-primary" : "hover:bg-accent"}`}
                >
                  <BotAvatar bot={b} size={52} />
                  <span className="font-semibold">{b.name}</span>
                  <span className="text-muted-foreground">{b.rating}</span>
                  {beaten.includes(b.id) && (
                    <span className="absolute top-0.5 right-0.5 grid size-5 place-items-center rounded-full bg-primary text-white" title="Beaten">
                      <Check className="size-3.5" aria-label="Beaten" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-md bg-card p-1" role="radiogroup" aria-label="Play as">
        {(["white", "random", "black"] as const).map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={color === c}
            onClick={() => setColor(c)}
            className={`rounded py-2 text-sm font-semibold capitalize ${color === c ? "bg-accent text-white" : "text-muted-foreground hover:text-white"}`}
          >
            {c}
          </button>
        ))}
      </div>
      <button className="btn-green w-full py-4! text-2xl!" onClick={() => onPlay(color === "random" ? (Math.random() < 0.5 ? "white" : "black") : color)}>
        Play
      </button>
      {onCancel && (
        <Button variant="ghost" onClick={onCancel}>
          Back to my game
        </Button>
      )}
    </div>
  );
}
