"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import { BarChart3, Bot, Flame, GraduationCap, Library, Puzzle, Swords, Timer, Users } from "lucide-react";
import { Board } from "@/components/board";
import { BotAvatar } from "@/components/bot-avatar";
import { RESULT } from "@/components/my-games";
import { lastWeek, streak } from "@/lib/activity";
import { BOTS } from "@/lib/bots";
import { loadCourses, loadProgress, type Course } from "@/lib/courses";
import { myGames, type GameRow } from "@/lib/games";
import { LESSONS } from "@/lib/lessons";
import { fetchPuzzleById, type Puzzle as PuzzleData } from "@/lib/puzzles";
import { useAccount, type Profile } from "@/lib/supabase";

// Signed-in home, laid out like chess.com's: name + streak on top, a Play card and three
// "pick up where you left off" cards, then game history on the left and daily puzzle / streak / stats on the right.
// Skipped: online matchmaking, friends and leagues (need online play, v2). No ads on Home.
const PUZZLE_FEN = "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1";
const card = "rounded-md bg-panel";

type Next = { title: string; sub: string; href: string; fen: string };

/** The next lesson, or the next course chapter once the lessons are done. */
function nextUp(courses: Course[], done: Record<string, number[]>): Next | null {
  const lesson = LESSONS.find((l) => !localStorage.getItem(`lesson-done:${l.slug}`));
  if (lesson) return { title: lesson.title, sub: "Lesson", href: `/lessons/${lesson.slug}`, fen: lesson.steps[0].fen };
  for (const c of courses) {
    const ch = c.chapters.find((x) => !(done[c.slug] ?? []).includes(x.position));
    if (ch) return { title: ch.title, sub: c.title, href: `/courses/${c.slug}`, fen: ch.steps[0].fen };
  }
  return null;
}

const finalFen = (pgn: string) => {
  const g = new Chess();
  try {
    g.loadPgn(pgn);
  } catch {}
  return g;
};

function PlayCard({ go }: { go: (href: string, coach?: boolean) => void }) {
  const btn = "flex items-center justify-center gap-3 rounded-lg bg-card py-3 text-lg font-bold text-white shadow-[0_4px_0_#1f1e1b] hover:bg-accent";
  return (
    <section className={`${card} flex flex-col gap-3 p-4`}>
      <h2 className="font-sans text-xl font-bold">Play</h2>
      <button className="btn-green w-full py-4! text-xl!" onClick={() => go("/play/computer")}>
        Start Game
      </button>
      <button className={btn} onClick={() => go("/play/computer")}>
        <Bot className="size-6 text-primary" aria-hidden /> Play Bots
      </button>
      <button className={btn} onClick={() => go("/play/computer", true)}>
        <GraduationCap className="size-6 text-primary" aria-hidden /> Play Coach
      </button>
      <button className={btn} onClick={() => go("/play/friend")}>
        <Users className="size-6 text-primary" aria-hidden /> Play a Friend
      </button>
    </section>
  );
}

/** Board picture + one line + one button, like chess.com's three home cards. */
function PictureCard({ fen, icon, title, sub, cta, onClick, orientation = "white" }: { fen: string; icon: React.ReactNode; title: string; sub?: string; cta: string; onClick: () => void; orientation?: "white" | "black" }) {
  return (
    // Phones: small board beside the text. From tablet width up: big board on top, like chess.com.
    <section className={`${card} flex flex-row overflow-hidden sm:flex-col`}>
      <button onClick={onClick} aria-label={cta} className="block w-32 shrink-0 self-center sm:w-full">
        <div className="pointer-events-none">
          <Board fen={fen} orientation={orientation} />
        </div>
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-4">
        <div className="flex items-center gap-3">
          {icon}
          <div className="min-w-0">
            <p className="truncate font-semibold">{title}</p>
            {sub && <p className="truncate text-sm text-muted-foreground">{sub}</p>}
          </div>
        </div>
        <button className="mt-auto rounded-lg bg-card py-2 font-bold shadow-[0_4px_0_#1f1e1b] hover:bg-accent sm:py-3 sm:text-lg" onClick={onClick}>
          {cta}
        </button>
      </div>
    </section>
  );
}

function History({ games, review }: { games: GameRow[]; review: (g: GameRow) => void }) {
  return (
    <section className={`${card} overflow-hidden`}>
      <h2 className="p-4 font-sans text-xl font-bold">Game History</h2>
      {!games.length ? (
        <p className="px-4 pb-4 text-muted-foreground">
          No games yet.{" "}
          <Link href="/play/computer" className="text-primary hover:underline">
            Play your first game
          </Link>{" "}
          and it shows up here.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/15 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-semibold">Players</th>
                <th className="px-2 py-2 font-semibold">Result</th>
                <th className="hidden px-2 py-2 font-semibold sm:table-cell">Accuracy</th>
                <th className="hidden px-2 py-2 font-semibold sm:table-cell">Moves</th>
                <th className="hidden px-2 py-2 font-semibold md:table-cell">Date</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {games.map((g) => {
                const bot = BOTS.find((b) => b.name === g.bot);
                const opp = g.mode === "computer" ? (g.bot ?? "Computer") : "Friend";
                const moves = Math.ceil(finalFen(g.pgn).history().length / 2);
                return (
                  <tr key={g.id} className="border-t border-white/5">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {bot ? <BotAvatar bot={bot} size={28} /> : <Users className="size-7 rounded-[3px] bg-card p-1 text-muted-foreground" aria-hidden />}
                        <span>
                          <span className="block font-semibold">You ({g.my_color === "w" ? "White" : "Black"})</span>
                          <span className="block text-muted-foreground">vs {opp}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        <span className="grid size-5 place-items-center rounded text-xs font-bold text-white" style={{ background: RESULT[g.result].color }} aria-hidden>
                          {g.result === "win" ? "+" : g.result === "loss" ? "−" : "="}
                        </span>
                        {RESULT[g.result].text}
                      </span>
                    </td>
                    <td className="hidden px-2 py-2.5 tabular-nums sm:table-cell">{g.accuracy?.toFixed(1) ?? "…"}</td>
                    <td className="hidden px-2 py-2.5 tabular-nums sm:table-cell">{moves}</td>
                    <td className="hidden px-2 py-2.5 whitespace-nowrap text-muted-foreground md:table-cell">{new Date(g.played_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button className="rounded bg-card px-3 py-1.5 font-semibold hover:bg-accent" onClick={() => review(g)}>
                        Review
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Link href="/games" className="block border-t border-white/5 py-3 text-center font-semibold text-muted-foreground hover:text-white">
            View All Games ›
          </Link>
        </div>
      )}
    </section>
  );
}

function DailyPuzzle({ puzzle, open }: { puzzle: PuzzleData | null | "error"; open: (id: string) => void }) {
  return (
    <section className={`${card} p-4`}>
      <h2 className="mb-3 font-sans text-xl font-bold">Daily Puzzle</h2>
      {puzzle === "error" ? (
        <p className="text-muted-foreground">Could not load today&apos;s puzzle.</p>
      ) : !puzzle ? (
        <div className="aspect-square w-full animate-pulse rounded bg-card" />
      ) : (
        <>
          <button onClick={() => open(puzzle.id)} aria-label="Solve the daily puzzle" className="block w-full">
            <div className="pointer-events-none">
              <Board fen={puzzle.game.fen()} orientation={puzzle.game.turn() === "w" ? "white" : "black"} />
            </div>
          </button>
          <p className="mt-3 font-semibold">
            {puzzle.game.turn() === "w" ? "White" : "Black"} to move · rated {puzzle.rating}
          </p>
          {puzzle.plays !== undefined && <p className="mb-3 text-sm text-muted-foreground">Played {puzzle.plays.toLocaleString()} times on Lichess</p>}
          <button className="btn-green w-full" onClick={() => open(puzzle.id)}>
            Solve Daily Puzzle
          </button>
        </>
      )}
    </section>
  );
}

function StreakCard({ profile }: { profile: Profile }) {
  const n = streak(profile.active_days);
  return (
    <section className={`${card} flex items-start gap-4 p-4`}>
      <Flame className={`size-10 shrink-0 ${n ? "text-[#ff9b2f]" : "text-muted-foreground"}`} aria-hidden />
      <div>
        <h2 className="font-sans text-xl font-bold">
          {n} Day Streak
        </h2>
        <p className="mb-2 text-xs text-muted-foreground">Play a game, solve a puzzle or finish a lesson each day.</p>
        <ol className="flex gap-1.5" aria-label="Last 7 days">
          {lastWeek(profile.active_days).map((d) => (
            <li key={d.key} className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
              {d.label}
              <span className={`grid size-7 place-items-center rounded ${d.active ? "bg-primary text-white" : "border-2 border-card"}`} aria-label={`${d.key}: ${d.active ? "active" : "not active"}`}>
                {d.active ? "✓" : ""}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function StatsCard({ profile, games, lessons }: { profile: Profile; games: number; lessons: number }) {
  const rows = [
    { icon: Swords, label: "Games", value: games },
    { icon: Puzzle, label: "Puzzles solved", value: profile.puzzles_solved },
    { icon: GraduationCap, label: "Lessons", value: lessons },
    { icon: Puzzle, label: "Puzzle rating", value: profile.puzzle_rating },
    { icon: Timer, label: "Puzzle Rush best", value: Math.max(profile.rush_best_3, profile.rush_best_5) },
    { icon: Bot, label: "Bots beaten", value: `${profile.beaten_bots.length} / ${BOTS.length}` },
  ];
  return (
    <section className={card}>
      <Link href="/stats" className="flex items-center justify-between p-4 hover:text-white">
        <h2 className="font-sans text-xl font-bold">Stats</h2>
        <BarChart3 className="size-5 text-muted-foreground" aria-hidden />
      </Link>
      <ul>
        {rows.map(({ icon: Icon, label, value }) => (
          <li key={label} className="flex items-center gap-3 border-t border-white/5 px-4 py-3">
            <Icon className="size-5 text-muted-foreground" aria-hidden />
            <span className="flex-1">{label}</span>
            <span className="font-semibold tabular-nums">{value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Dashboard() {
  const router = useRouter();
  const { profile } = useAccount();
  const [games, setGames] = useState<GameRow[] | null>(null);
  const [next, setNext] = useState<Next | null | undefined>(undefined);
  const [lessons, setLessons] = useState(0);
  const [daily, setDaily] = useState<PuzzleData | null | "error">(null);

  useEffect(() => {
    myGames().then(setGames, () => setGames([]));
    fetchPuzzleById("daily").then(setDaily, () => setDaily("error"));
    Promise.all([loadCourses(), loadProgress(true)]).then(
      ([courses, done]) => {
        setNext(nextUp(courses, done));
        setLessons(LESSONS.filter((l) => localStorage.getItem(`lesson-done:${l.slug}`)).length + Object.values(done).flat().length);
      },
      () => setNext(nextUp([], {})),
    );
  }, []);

  const go = (href: string, coach = false) => {
    if (coach) sessionStorage.setItem("coach-on", "1");
    router.push(href);
  };
  const review = (g: GameRow) => {
    sessionStorage.setItem("review-pgn", g.pgn);
    router.push("/analysis");
  };
  const openPuzzle = (id: string) => {
    sessionStorage.setItem("puzzle-id", id);
    router.push("/puzzles");
  };

  if (!profile) return <div className="p-6 text-muted-foreground">Loading…</div>;
  const last = games?.[0];
  const lastBot = last && BOTS.find((b) => b.name === last.bot);
  const n = streak(profile.active_days);

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-4 p-4 lg:p-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[3px] bg-primary text-lg font-bold text-white" aria-hidden>
            {profile.username.charAt(0).toUpperCase()}
          </span>
          <h1 className="font-sans text-xl font-bold">{profile.username}</h1>
        </div>
        <span className="flex items-center gap-2 text-xl font-bold">
          <Flame className={`size-7 ${n ? "text-[#ff9b2f]" : "text-muted-foreground"}`} aria-hidden /> {n} Day Streak
        </span>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[300px_repeat(3,minmax(0,1fr))]">
        <PlayCard go={go} />
        <PictureCard
          fen={PUZZLE_FEN}
          icon={<Puzzle className="size-8 shrink-0 text-primary" aria-hidden />}
          title="Puzzles"
          sub={`Rating ${profile.puzzle_rating} · ${profile.puzzles_solved} solved`}
          cta="Solve Puzzles"
          onClick={() => router.push("/puzzles")}
        />
        {next === undefined ? (
          <div className={`${card} animate-pulse`} />
        ) : next ? (
          <PictureCard fen={next.fen} icon={<Library className="size-8 shrink-0 text-primary" aria-hidden />} title={next.title} sub={next.sub} cta="Start" onClick={() => router.push(next.href)} />
        ) : (
          <PictureCard fen={PUZZLE_FEN} icon={<Library className="size-8 shrink-0 text-primary" aria-hidden />} title="All lessons and courses done!" cta="Browse courses" onClick={() => router.push("/courses")} />
        )}
        {last ? (
          <PictureCard
            fen={finalFen(last.pgn).fen()}
            orientation={last.my_color === "w" ? "white" : "black"}
            icon={lastBot ? <BotAvatar bot={lastBot} size={36} /> : <Users className="size-8 shrink-0 text-primary" aria-hidden />}
            title={`vs ${last.mode === "computer" ? (last.bot ?? "Computer") : "Friend"}`}
            sub={`${RESULT[last.result].text} ${last.reason}`}
            cta="Review Game"
            onClick={() => review(last)}
          />
        ) : (
          <PictureCard
            fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
            icon={<Swords className="size-8 shrink-0 text-primary" aria-hidden />}
            title="Your last game"
            sub="Shows up here after you play"
            cta="Play a Game"
            onClick={() => router.push("/play/computer")}
          />
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">{games ? <History games={games.slice(0, 5)} review={review} /> : <div className={`${card} h-48 animate-pulse`} />}</div>
        <div className="flex flex-col gap-4">
          <DailyPuzzle puzzle={daily} open={openPuzzle} />
          <StreakCard profile={profile} />
          <StatsCard profile={profile} games={games?.length ?? 0} lessons={lessons} />
        </div>
      </div>
    </div>
  );
}

/** Home: the dashboard for signed-in players, the marketing page (passed in) for guests and while checking. */
/** "/" for guests is the marketing page; signed-in players are sent to their dashboard at /home (like chess.com). */
export function HomeSwitch({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, ready } = useAccount();
  useEffect(() => {
    if (ready && user) router.replace("/home");
  }, [ready, user, router]);
  return children;
}

/** /home: the dashboard, or off to Log in for guests. Also tidies the "#" Google login leaves on the address. */
export function HomePage() {
  const router = useRouter();
  const { user, ready } = useAccount();
  useEffect(() => {
    // Through Next's router: a plain history.replaceState gets the "#" put back by Next's own address sync.
    if (ready && location.href.endsWith("#")) router.replace(location.pathname + location.search);
  }, [ready, user, router]);
  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);
  return user ? <Dashboard /> : <div className="p-6 text-muted-foreground">Loading…</div>;
}
