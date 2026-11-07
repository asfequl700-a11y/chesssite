import { PlainPage } from "@/components/game-screen";

export const metadata = { title: "About" };

export default function Page() {
  return (
    <PlainPage title="About">
      <div className="space-y-4 text-lg text-muted-foreground">
        <p>ChessSite is a free chess site. Play, puzzles, lessons and unlimited game review cost nothing.</p>
        <p>
          The chess engine is Stockfish, running in your own browser. Puzzles and opening names come from the free
          Lichess database. Because Stockfish is open source (GPL), this site&apos;s code is open source too.
        </p>
        <p>The only money comes from ad slots that advertisers book directly.</p>
      </div>
    </PlainPage>
  );
}
