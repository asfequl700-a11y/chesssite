import { Suspense } from "react";
import { notFound } from "next/navigation";
import { GameScreen } from "@/components/game-screen";
import { LessonPage } from "@/components/lesson-player";
import { LESSONS } from "@/lib/lessons";

export function generateStaticParams() {
  return LESSONS.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: PageProps<"/lessons/[slug]">) {
  const { slug } = await params;
  return { title: LESSONS.find((l) => l.slug === slug)?.title };
}

// The slug is read inside <Suspense> so the shared page shell holds no URL data (Next.js instant-shell-url-data).
export default function Page({ params }: PageProps<"/lessons/[slug]">) {
  return (
    <Suspense fallback={<GameScreen title="Lesson">Loading…</GameScreen>}>
      <Lesson params={params} />
    </Suspense>
  );
}

async function Lesson({ params }: { params: PageProps<"/lessons/[slug]">["params"] }) {
  const { slug } = await params;
  if (!LESSONS.some((l) => l.slug === slug)) notFound();
  return <LessonPage slug={slug} />;
}
