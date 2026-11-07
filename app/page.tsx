import Link from "next/link";
import { BarChart3, Bot, GraduationCap, Library, Puzzle, Search, Timer, Users } from "lucide-react";
import { BotAvatar } from "@/components/bot-avatar";
import { BOTS } from "@/lib/bots";
import { Board } from "@/components/board";

// Layout from docs/prototype.html and chess.com's home: hero board + headline + two big buttons,
// then one block per feature, each with a single button. No ads on Home.
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const PUZZLE = "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1"; // back-rank mate in one

const features: { title: string; text: string; href: string; cta: string; icon: typeof Bot; board?: string; bots?: boolean }[] = [
  {
    title: "Ten bots with their own style",
    text: "From Pip, who just learned how the knight moves, to Atlas at full engine strength. Attackers, defenders and traders, each with something to say.",
    href: "/play/computer",
    cta: "Pick a bot",
    icon: Bot,
    bots: true,
  },
  {
    title: "A coach while you play",
    text: "Turn on Play Coach against any bot: every move gets a label and a plain-English reason, hints when you're stuck, and a warning before you blunder.",
    href: "/play/computer",
    cta: "Play with the coach",
    icon: GraduationCap,
  },
  {
    title: "Puzzles and Puzzle Rush",
    text: "Real positions from the free Lichess puzzle database, picked near your rating. Filter by theme, or race the clock in Puzzle Rush.",
    href: "/puzzles",
    cta: "Solve a puzzle",
    icon: Puzzle,
    board: PUZZLE,
  },
  {
    title: "Unlimited game review",
    text: "The engine labels every move from Brilliant to Blunder, explains why, shows the best move and lets you retry your mistakes. No limits, no paywall.",
    href: "/analysis",
    cta: "Review a game",
    icon: Search,
  },
  {
    title: "Lessons and courses",
    text: "Short lessons for beginners, then courses on opening principles, basic tactics and endgames.",
    href: "/courses",
    cta: "Start a course",
    icon: Library,
  },
  {
    title: "Your stats",
    text: "Sign up free and every game is saved: accuracy over time, results by opening, colour and bot.",
    href: "/stats",
    cta: "See your stats",
    icon: BarChart3,
  },
];

// Things other sites put behind a paid plan; all free here.
const free = [
  { icon: Search, text: "Unlimited game review" },
  { icon: GraduationCap, text: "Play Coach and move explanations" },
  { icon: Bot, text: "All 10 bots" },
  { icon: Timer, text: "Puzzle Rush and unlimited puzzles" },
  { icon: Library, text: "Courses and lessons" },
  { icon: BarChart3, text: "Advanced stats" },
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

      <section aria-label="Free features" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {free.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-3 rounded-md bg-card p-3 text-sm font-semibold">
            <Icon className="size-5 shrink-0 text-primary" aria-hidden />
            {text}
          </div>
        ))}
      </section>

      {features.map(({ title, text, href, cta, icon: Icon, board, bots }) => (
        <section key={title} className="grid items-center gap-10 rounded-[10px] bg-black/15 p-8 md:grid-cols-2">
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
          ) : bots ? (
            <div className="mx-auto grid grid-cols-5 gap-2">
              {BOTS.map((b) => (
                <div key={b.id} className="flex flex-col items-center text-xs">
                  <BotAvatar bot={b} size={56} />
                  <span className="mt-1 font-semibold">{b.name}</span>
                  <span className="text-muted-foreground">{b.rating}</span>
                </div>
              ))}
            </div>
          ) : (
            <Icon className="mx-auto size-32 text-primary/70" aria-hidden />
          )}
        </section>
      ))}
    </div>
  );
}
