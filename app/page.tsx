import Link from "next/link";
import { Bot, GraduationCap, Puzzle, Search, Users } from "lucide-react";
import { Board } from "@/components/board";

// Layout from docs/prototype.html and chess.com's home: hero board + headline + two big buttons,
// then one block per feature, each with a single button. No ads on Home.
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const PUZZLE = "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1"; // back-rank mate in one

const features = [
  {
    title: "Solve puzzles from real games",
    text: "Positions from the free Lichess puzzle database. Find the winning move, get a hint if you're stuck.",
    href: "/puzzles",
    cta: "Solve a puzzle",
    icon: Puzzle,
    board: PUZZLE,
  },
  {
    title: "Unlimited game review",
    text: "The engine labels every move from Brilliant to Blunder, shows the best move and lets you retry your mistakes. No limits, no paywall.",
    href: "/analysis",
    cta: "Review a game",
    icon: Search,
  },
  {
    title: "Learn step by step",
    text: "Short lessons from how the pieces move to your first endgames.",
    href: "/learn",
    cta: "Start a lesson",
    icon: GraduationCap,
  },
];

export default function Home() {
  return (
    <div className="mx-auto grid max-w-[1000px] gap-12 px-6 py-12">
      <section className="grid items-center gap-10 md:grid-cols-2">
        <div className="mx-auto w-full max-w-[460px] overflow-hidden rounded-md">
          <Board fen={START} />
        </div>
        <div>
          <h1 className="mb-5 text-[clamp(36px,5vw,58px)] leading-[1.05] text-balance">Play chess for free. Review every game, as often as you like.</h1>
          <p className="mb-6 text-muted-foreground">No paywall on game review. Bots, puzzles and lessons, all free. No account needed.</p>
          <div className="grid max-w-[340px] gap-3.5">
            <Link href="/play/computer" className="btn-green gap-3! py-5! text-2xl!">
              <Bot className="size-8" aria-hidden /> Play Bots
            </Link>
            <Link href="/play/friend" className="flex items-center justify-center gap-3 rounded-lg bg-card py-5 text-2xl font-bold text-white shadow-[0_4px_0_#1f1e1b] hover:bg-accent">
              <Users className="size-8" aria-hidden /> Play a Friend
            </Link>
          </div>
        </div>
      </section>

      {features.map(({ title, text, href, cta, icon: Icon, board }) => (
        <section key={href} className="grid items-center gap-10 rounded-[10px] bg-black/15 p-8 md:grid-cols-2">
          <div>
            <h2 className="mb-3 text-4xl text-balance">{title}</h2>
            <p className="mb-5 leading-relaxed text-muted-foreground">{text}</p>
            <Link href={href} className="btn-green inline-block">
              {cta}
            </Link>
          </div>
          {board ? (
            <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-md">
              <Board fen={board} />
            </div>
          ) : (
            <Icon className="mx-auto size-32 text-primary/70" aria-hidden />
          )}
        </section>
      ))}
    </div>
  );
}
