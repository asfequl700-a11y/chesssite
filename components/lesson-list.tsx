"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LESSONS } from "@/lib/lessons";

export function LessonList() {
  const [done, setDone] = useState<string[]>([]);
  // Progress is saved in this browser only (accounts come in v2).
  useEffect(() => setDone(LESSONS.filter((l) => localStorage.getItem(`lesson-done:${l.slug}`)).map((l) => l.slug)), []);

  return (
    <>
      <p className="mb-4 text-muted-foreground">
        {done.length} of {LESSONS.length} lessons done. Short lessons from how the pieces move to your first endgames.
      </p>
      <ol className="grid gap-2">
        {LESSONS.map((l, n) => (
          <li key={l.slug}>
            <Link href={`/lessons/${l.slug}`} className="flex items-center gap-3 rounded-md bg-card p-3 hover:bg-accent">
              <span className="w-6 text-center text-muted-foreground">{n + 1}</span>
              <span className="flex-1">
                <b className="block">{l.title}</b>
                <small className="text-muted-foreground">{l.summary}</small>
              </span>
              <span className={done.includes(l.slug) ? "text-primary" : "text-muted-foreground"}>
                {done.includes(l.slug) ? "Done" : `${l.steps.length} steps`}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
