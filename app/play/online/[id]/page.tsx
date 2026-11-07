import { Suspense } from "react";
import { GameScreen } from "@/components/game-screen";
import { OnlineGame } from "@/components/online-game";

export const metadata = { title: "Online game" };

// The game id is read inside <Suspense> so the shared page shell holds no URL data (Next.js instant-shell-url-data).
export default function Page({ params }: PageProps<"/play/online/[id]">) {
  return (
    <Suspense fallback={<GameScreen title="Online game">Loading…</GameScreen>}>
      <Game params={params} />
    </Suspense>
  );
}

async function Game({ params }: { params: PageProps<"/play/online/[id]">["params"] }) {
  const { id } = await params;
  return <OnlineGame key={id} id={id} />;
}
