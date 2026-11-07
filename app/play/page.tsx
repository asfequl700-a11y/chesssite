import Link from "next/link";
import { GameScreen } from "@/components/game-screen";

export const metadata = { title: "Play" };

export default function Page() {
  return (
    <GameScreen title="Play">
      <div className="flex flex-col gap-4">
        <Link href="/play/computer" className="btn-green">Play vs Computer</Link>
        <Link href="/play/friend" className="btn-green">Play vs Friend</Link>
      </div>
    </GameScreen>
  );
}
