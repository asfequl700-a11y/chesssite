"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { GameScreen } from "@/components/game-screen";
import { LessonPlayer } from "@/components/lesson-player";
import { loadCourses, loadProgress, markDone, type Course } from "@/lib/courses";
import { useAccount } from "@/lib/supabase";

/** Courses + your progress, reloaded when you log in or out. */
function useCourses() {
  const { user, ready } = useAccount();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [done, setDone] = useState<Record<string, number[]>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    loadCourses()
      .then(setCourses)
      .catch(() => setError("Could not load courses. Check your internet and try again."));
  }, []);
  useEffect(() => {
    if (ready) void loadProgress(!!user).then(setDone);
  }, [user, ready]);
  return { courses, done, setDone, error, signedIn: !!user };
}

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-2 overflow-hidden rounded bg-panel" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className="h-full bg-primary" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </div>
  );
}

export function CourseList() {
  const { courses, done, error, signedIn } = useCourses();
  return (
    <>
      <p className="mb-4 text-muted-foreground">
        Step-by-step courses with real positions. Free, like everything here.
        {!signedIn && (
          <>
            {" "}
            <Link href="/signup" className="text-primary hover:underline">
              Sign up
            </Link>{" "}
            to keep your progress on every device.
          </>
        )}
      </p>
      {error && <p className="text-destructive">{error}</p>}
      {!courses && !error && <p className="text-muted-foreground">Loading…</p>}
      <ol className="grid gap-3">
        {courses?.map((c) => {
          const n = done[c.slug]?.length ?? 0;
          return (
            <li key={c.slug}>
              <Link href={`/courses/${c.slug}`} className="block rounded-md bg-card p-4 hover:bg-accent">
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <b className="text-lg">{c.title}</b>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {n} / {c.chapters.length} chapters
                  </span>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">{c.summary}</p>
                <Bar value={n} max={c.chapters.length} />
              </Link>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/** One course: chapter list, or the chapter being played (in the lesson player). */
export function CoursePage({ slug }: { slug: string }) {
  const { courses, done, setDone, error, signedIn } = useCourses();
  const [playing, setPlaying] = useState<number | null>(null);
  const course = courses?.find((c) => c.slug === slug);
  const finished = done[slug] ?? [];

  if (!course)
    return (
      <GameScreen title="Course">
        <p className={error ? "text-destructive" : "text-muted-foreground"}>{error || (courses ? "Course not found." : "Loading…")}</p>
        <Link href="/courses" className="text-sm text-muted-foreground hover:text-white">
          ← All courses
        </Link>
      </GameScreen>
    );

  if (playing !== null) {
    const ch = course.chapters[playing];
    const nextCh = course.chapters[playing + 1];
    return (
      <LessonPlayer
        key={playing}
        lesson={ch}
        title={`${course.title}: ${ch.title}`}
        onFinish={() => {
          void markDone(signedIn, slug, ch.position);
          setDone((d) => ({ ...d, [slug]: [...new Set([...(d[slug] ?? []), ch.position])] }));
        }}
        next={nextCh ? { title: nextCh.title, onClick: () => setPlaying(playing + 1) } : { title: "Back to the course", onClick: () => setPlaying(null) }}
        back={{
          href: `/courses/${slug}`,
          label: "Chapters",
          onClick: (e) => {
            e.preventDefault(); // same page: just close the chapter
            setPlaying(null);
          },
        }}
      />
    );
  }

  return (
    <GameScreen title={course.title}>
      <p className="mb-3 text-muted-foreground">{course.summary}</p>
      <div className="mb-4">
        <Bar value={finished.length} max={course.chapters.length} />
      </div>
      <ol className="mb-4 grid gap-2">
        {course.chapters.map((ch, i) => (
          <li key={ch.position}>
            <button onClick={() => setPlaying(i)} className="flex w-full items-center gap-3 rounded-md bg-card p-3 text-left hover:bg-accent">
              <span className="w-6 text-center text-muted-foreground">{i + 1}</span>
              <span className="flex-1 font-semibold">{ch.title}</span>
              {finished.includes(ch.position) ? (
                <Check className="size-5 text-primary" aria-label="Done" />
              ) : (
                <span className="text-sm text-muted-foreground">{ch.steps.length} {ch.steps.length === 1 ? "step" : "steps"}</span>
              )}
            </button>
          </li>
        ))}
      </ol>
      <Link href="/courses" className="text-sm text-muted-foreground hover:text-white">
        ← All courses
      </Link>
    </GameScreen>
  );
}
