// Bot characters: our own names, looks and lines. Strength = Stockfish skill + think time + depth,
// plus a "slip" chance (a random legal move) for the weakest bots. Ratings are rough guides, not measured.
import { Chess } from "chess.js";
import type { Engine } from "@/lib/engine";

export type Style = "balanced" | "aggressive" | "defensive" | "trader";

export type Bot = {
  id: string;
  name: string;
  rating: number;
  group: "Beginner" | "Intermediate" | "Advanced" | "Master";
  style: Style;
  about: string;
  skill: number; // Stockfish Skill Level 0-20
  ms: number; // think time for balanced bots
  depth: number; // search depth for style bots (they pick among the engine's top moves)
  slip: number; // chance of a random legal move (0-1)
  look: { bg: string; skin: string; hair: string; hairStyle: 0 | 1 | 2 | 3; glasses?: boolean };
  lines: { hello: string; blunder: string; win: string; lose: string };
};

export const BOTS: Bot[] = [
  {
    id: "pip", name: "Pip", rating: 250, group: "Beginner", style: "balanced", skill: 0, ms: 50, depth: 1, slip: 0.45,
    about: "Just learned how the horsey moves.",
    look: { bg: "#7fb3d5", skin: "#f1c27d", hair: "#6b4423", hairStyle: 0 },
    lines: { hello: "Hi! Is the castle the one that goes sideways?", blunder: "Ooh, I think I can take that!", win: "I won?! I'm telling everyone!", lose: "Good game! Can we play again?" },
  },
  {
    id: "rosa", name: "Rosa", rating: 450, group: "Beginner", style: "aggressive", skill: 1, ms: 80, depth: 2, slip: 0.3,
    about: "Attacks first, asks questions later.",
    look: { bg: "#e59866", skin: "#e0ac69", hair: "#a93226", hairStyle: 1 },
    lines: { hello: "Charge! Watch out for my queen.", blunder: "Thank you! Free piece!", win: "Attack always works. Mostly.", lose: "Next time I'll attack even harder." },
  },
  {
    id: "otto", name: "Otto", rating: 650, group: "Beginner", style: "defensive", skill: 2, ms: 100, depth: 3, slip: 0.2,
    about: "Builds a wall and waits.",
    look: { bg: "#a9cce3", skin: "#c68642", hair: "#2c3e50", hairStyle: 2, glasses: true },
    lines: { hello: "Safety first. Let's take it slow.", blunder: "Hmm, I believe that piece is loose.", win: "Patience pays off.", lose: "My wall had a hole. Well played." },
  },
  {
    id: "bruno", name: "Bruno", rating: 900, group: "Intermediate", style: "trader", skill: 4, ms: 150, depth: 5, slip: 0.1,
    about: "Loves trading pieces down to an endgame.",
    look: { bg: "#82e0aa", skin: "#8d5524", hair: "#1b1b1b", hairStyle: 3 },
    lines: { hello: "Let's swap some pieces and see who's left.", blunder: "That one's mine, thanks.", win: "Fewer pieces, more fun.", lose: "You traded better than me today." },
  },
  {
    id: "mei", name: "Mei", rating: 1100, group: "Intermediate", style: "balanced", skill: 6, ms: 250, depth: 6, slip: 0.05,
    about: "Solid, steady, rarely gives anything away.",
    look: { bg: "#d7bde2", skin: "#f1c27d", hair: "#17202a", hairStyle: 1 },
    lines: { hello: "Hello! Good luck, have fun.", blunder: "Careful, that looked like a mistake.", win: "Thanks for the game!", lose: "Nice! You found good moves." },
  },
  {
    id: "kofi", name: "Kofi", rating: 1300, group: "Intermediate", style: "aggressive", skill: 8, ms: 350, depth: 8, slip: 0.02,
    about: "Goes straight for your king.",
    look: { bg: "#f7dc6f", skin: "#6b3e26", hair: "#111111", hairStyle: 0 },
    lines: { hello: "I hope your king likes company.", blunder: "Oh, now we're attacking!", win: "Checkmate is my favourite move.", lose: "You defended like a pro." },
  },
  {
    id: "ines", name: "Inês", rating: 1500, group: "Advanced", style: "defensive", skill: 11, ms: 500, depth: 10, slip: 0,
    about: "Very hard to break down.",
    look: { bg: "#76d7c4", skin: "#e0ac69", hair: "#784212", hairStyle: 2 },
    lines: { hello: "Let's see if you can get through.", blunder: "I'll take that, thank you.", win: "A quiet win is still a win.", lose: "You cracked my defence. Impressive." },
  },
  {
    id: "viktor", name: "Viktor", rating: 1800, group: "Advanced", style: "balanced", skill: 14, ms: 700, depth: 12, slip: 0,
    about: "Club player. Punishes loose pieces.",
    look: { bg: "#aeb6bf", skin: "#f1c27d", hair: "#7b7d7d", hairStyle: 3, glasses: true },
    lines: { hello: "Shall we? I play to win.", blunder: "That was a mistake. I'll show you why.", win: "Study that endgame. Good game.", lose: "Well played. I'll remember that." },
  },
  {
    id: "zara", name: "Zara", rating: 2100, group: "Master", style: "aggressive", skill: 17, ms: 1000, depth: 14, slip: 0,
    about: "Sharp attacker. Loves sacrifices.",
    look: { bg: "#ec7063", skin: "#c68642", hair: "#1c2833", hairStyle: 1 },
    lines: { hello: "I don't do quiet games.", blunder: "There it is. Now it gets fun.", win: "That attack was too much.", lose: "You survived my attack? Respect." },
  },
  {
    id: "atlas", name: "Atlas", rating: 2500, group: "Master", style: "balanced", skill: 20, ms: 1500, depth: 16, slip: 0,
    about: "Full-strength engine. Good luck.",
    look: { bg: "#5d6d7e", skin: "#d5d8dc", hair: "#212f3c", hairStyle: 2, glasses: true },
    lines: { hello: "Calculating… ready.", blunder: "Advantage detected.", win: "Game over. Want to review it?", lose: "Remarkable. You beat full strength." },
  },
];

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** How much a style likes a move (higher = better). Only used to choose among near-equal engine moves. */
export function styleScore(style: Style, fen: string, uci: string) {
  const g = new Chess(fen);
  const m = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  const forward = m.color === "w" ? Number(m.to[1]) - Number(m.from[1]) : Number(m.from[1]) - Number(m.to[1]);
  switch (style) {
    case "aggressive":
      return (g.inCheck() ? 3 : 0) + (m.captured ? 2 : 0) + forward * 0.3;
    case "defensive":
      return -forward * 0.5 - (m.captured ? 0.5 : 0) + (m.isKingsideCastle() || m.isQueensideCastle() ? 2 : 0);
    case "trader":
      return m.captured && VALUE[m.captured] === VALUE[m.piece] ? 3 : m.captured ? 1 : 0;
    default:
      return 0;
  }
}

/** The bot's move in UCI form. */
export async function botMove(engine: Engine, bot: Bot, fen: string, rand = Math.random): Promise<string> {
  const g = new Chess(fen);
  const moves = g.moves({ verbose: true });
  if (!moves.length) return "(none)";
  if (rand() < bot.slip) {
    const m = moves[Math.floor(rand() * moves.length)];
    return m.from + m.to + (m.promotion ?? "");
  }
  if (bot.style === "balanced") return engine.bestMove(fen, bot.skill, bot.ms);
  // Style bots: look at the engine's top 4 moves and pick the one the style likes best,
  // among those within 60 centipawns (0.6 pawns) of the best.
  const { lines } = await engine.evaluate(fen, bot.depth, 4);
  const sign = g.turn() === "w" ? 1 : -1;
  const top = sign * lines[0].cp;
  const ok = lines.filter((l) => l?.best && top - sign * l.cp <= 60);
  ok.sort((a, b) => styleScore(bot.style, fen, b.best) - styleScore(bot.style, fen, a.best));
  return ok[0]?.best ?? lines[0].best;
}
