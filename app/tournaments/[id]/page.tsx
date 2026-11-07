import { Suspense } from "react";
import { ArenaPage } from "@/components/tournaments";

export const metadata = { title: "Arena" };

// The arena id is read inside <Suspense> so the shared page shell holds no URL data (Next.js instant-shell-url-data).
export default function Page({ params }: PageProps<"/tournaments/[id]">) {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Loading…</div>}>
      <Arena params={params} />
    </Suspense>
  );
}

async function Arena({ params }: { params: PageProps<"/tournaments/[id]">["params"] }) {
  const { id } = await params;
  return <ArenaPage key={id} id={id} />;
}
