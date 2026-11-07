import { Suspense } from "react";
import { GameScreen } from "@/components/game-screen";
import { CoursePage } from "@/components/courses";

export const metadata = { title: "Course" };

// The slug is read inside <Suspense> so the shared page shell holds no URL data (Next.js instant-shell-url-data).
export default function Page({ params }: PageProps<"/courses/[slug]">) {
  return (
    <Suspense fallback={<GameScreen title="Course">Loading…</GameScreen>}>
      <Course params={params} />
    </Suspense>
  );
}

async function Course({ params }: { params: PageProps<"/courses/[slug]">["params"] }) {
  const { slug } = await params;
  return <CoursePage key={slug} slug={slug} />;
}
