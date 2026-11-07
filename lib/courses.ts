"use client";

import type { Step } from "@/lib/lessons";
import { supabase } from "@/lib/supabase";

export type Course = { slug: string; title: string; summary: string; chapters: { position: number; title: string; steps: Step[] }[] };

/** All courses with their chapters (public data, readable without an account). */
export async function loadCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("slug, title, summary, chapters:course_chapters(position, title, steps)")
    .order("position")
    .order("position", { referencedTable: "course_chapters" });
  if (error) throw error;
  return data as Course[];
}

const local = (slug: string) => `course-done:${slug}`;

/** Finished chapter numbers per course: from the database when logged in, this browser for guests. */
export async function loadProgress(signedIn: boolean): Promise<Record<string, number[]>> {
  if (!signedIn) {
    const out: Record<string, number[]> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith("course-done:")) out[k.slice(12)] = JSON.parse(localStorage.getItem(k) ?? "[]");
    }
    return out;
  }
  const { data } = await supabase.from("course_progress").select("course_slug, chapter");
  const out: Record<string, number[]> = {};
  for (const r of data ?? []) (out[r.course_slug] ??= []).push(r.chapter);
  return out;
}

export async function markDone(signedIn: boolean, slug: string, chapter: number) {
  if (!signedIn) {
    const done: number[] = JSON.parse(localStorage.getItem(local(slug)) ?? "[]");
    if (!done.includes(chapter)) localStorage.setItem(local(slug), JSON.stringify([...done, chapter]));
    return;
  }
  const { error } = await supabase.from("course_progress").upsert({ course_slug: slug, chapter }, { ignoreDuplicates: true });
  if (error) console.warn("Progress not saved:", error.message);
}
