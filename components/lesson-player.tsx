"use client";

import { useState } from "react";
import Link from "next/link";
import { Chess } from "chess.js";
import { Board, type Promo } from "@/components/board";
import { GameScreen } from "@/components/game-screen";
import { Button } from "@/components/ui/button";
import { LESSONS, type Lesson } from "@/lib/lessons";
import { markActive } from "@/lib/activity";

/** A lesson from lib/lessons.ts, by its URL name. */
export function LessonPage({ slug }: { slug: string }) {
  const index = LESSONS.findIndex((l) => l.slug === slug);
  const nextLesson = LESSONS[index + 1];
  return (
    <LessonPlayer
      key={slug}
      lesson={LESSONS[index]}
      onFinish={() => {
        localStorage.setItem(`lesson-done:${slug}`, "1");
        markActive();
      }}
      next={nextLesson && { href: `/lessons/${nextLesson.slug}`, title: nextLesson.title }}
      back={{ href: "/learn", label: "All lessons" }}
    />
  );
}

/**
 * Plays a lesson step by step: each step is a position, an instruction and the accepted answer moves.
 * Also used for course chapters. Give it a new `key` to start over with another lesson.
 */
export function LessonPlayer({
  lesson,
  onFinish,
  next,
  back,
  title = lesson.title,
}: {
  lesson: Pick<Lesson, "title" | "steps">;
  onFinish?: () => void;
  next?: { href?: string; onClick?: () => void; title: string };
  back: { href: string; label: string; onClick?: (e: React.MouseEvent) => void };
  title?: string;
}) {
  const [i, setI] = useState(0);
  const [game, setGame] = useState(() => new Chess(lesson.steps[0].fen));
  const [fen, setFen] = useState(game.fen());
  const [msg, setMsg] = useState(lesson.steps[0].text);
  const [done, setDone] = useState(false);

  const step = lesson.steps[i];
  const finished = i >= lesson.steps.length;

  const load = (n: number) => {
    setI(n);
    setDone(false);
    if (n >= lesson.steps.length) {
      setMsg("Lesson complete! Well done.");
      onFinish?.();
      return;
    }
    const g = new Chess(lesson.steps[n].fen);
    setGame(g);
    setFen(g.fen());
    setMsg(lesson.steps[n].text);
  };

  const onMove = (from: string, to: string, promotion?: Promo) => {
    // One try at a time: a wrong move is taken back after 600ms, block moves until then.
    if (done || finished || game.history().length > 0) return false;
    try {
      const m = game.move({ from, to, promotion });
      setFen(game.fen());
      if (step.answers.includes(m.san)) {
        setDone(true);
        setMsg(`${m.san}: correct!`);
      } else {
        setMsg(`${m.san} is not it. Try again.`);
        setTimeout(() => {
          game.undo();
          setFen(game.fen());
        }, 600);
      }
      return true;
    } catch {
      return false;
    }
  };

  return (
    <GameScreen title={title} board={<Board game={game} fen={fen} onMove={finished ? undefined : onMove} />}>
      <p className="mb-2 text-sm text-muted-foreground">
        {finished ? "Done" : `Step ${i + 1} of ${lesson.steps.length}`}
      </p>
      <div className="mb-4 h-2 overflow-hidden rounded bg-card">
        <div className="h-full bg-primary transition-[width]" style={{ width: `${(Math.min(i + (done ? 1 : 0), lesson.steps.length) / lesson.steps.length) * 100}%` }} />
      </div>
      <p className="mb-4 rounded-md bg-card p-3" aria-live="polite">
        {msg}
      </p>
      <div className="flex flex-wrap gap-2">
        {done && (
          <button className="btn-green" onClick={() => load(i + 1)}>
            Continue
          </button>
        )}
        {finished &&
          next &&
          (next.href ? (
            <Link className="btn-green" href={next.href} onClick={next.onClick}>
              Next: {next.title}
            </Link>
          ) : (
            <button className="btn-green" onClick={next.onClick}>
              Next: {next.title}
            </button>
          ))}
        {!finished && (
          <Button variant="secondary" onClick={() => load(i)}>
            Reset
          </Button>
        )}
        <Link href={back.href} onClick={back.onClick} className="self-center px-2 text-sm text-muted-foreground hover:text-white">
          ← {back.label}
        </Link>
      </div>
    </GameScreen>
  );
}
