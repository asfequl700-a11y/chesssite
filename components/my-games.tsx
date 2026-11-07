"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlainPage } from "@/components/game-screen";
import { myGames, type GameRow } from "@/lib/games";
import { supabase, useAccount } from "@/lib/supabase";

export const RESULT = { win: { text: "Won", color: "#5d9948" }, draw: { text: "Draw", color: "#8b8987" }, loss: { text: "Lost", color: "#fa412d" } };

/** Loads the signed-in user's games; shows a log-in prompt for guests. */
export function useMyGames() {
  const { user, ready } = useAccount();
  const [games, setGames] = useState<GameRow[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    myGames()
      .then(setGames)
      .catch((e) => setError(e.message ?? "Could not load your games."));
  }, [user]);
  return { user, ready, games, setGames, error };
}

export function LoginFirst({ what }: { what: string }) {
  return (
    <p className="text-muted-foreground">
      <Link href="/login" className="text-primary hover:underline">
        Log in
      </Link>{" "}
      or{" "}
      <Link href="/signup" className="text-primary hover:underline">
        sign up free
      </Link>{" "}
      to see {what}. Games you finish while logged in are saved automatically.
    </p>
  );
}

export function MyGames() {
  const router = useRouter();
  const { user, ready, games, setGames, error } = useMyGames();

  const review = (g: GameRow) => {
    sessionStorage.setItem("review-pgn", g.pgn);
    router.push("/analysis");
  };
  const remove = async (g: GameRow) => {
    if (!confirm("Delete this game?")) return;
    const { error } = await supabase.from("games").delete().eq("id", g.id);
    if (!error) setGames((list) => list?.filter((x) => x.id !== g.id) ?? null);
  };

  return (
    <PlainPage title="My games">
      {!ready ? null : !user ? (
        <LoginFirst what="your saved games" />
      ) : error ? (
        <p className="text-destructive">{error}</p>
      ) : !games ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !games.length ? (
        <p className="text-muted-foreground">
          No games yet.{" "}
          <Link href="/play" className="text-primary hover:underline">
            Play one
          </Link>{" "}
          and it shows up here.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md bg-panel">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="p-3 font-normal">Date</th>
                <th className="p-3 font-normal">Opponent</th>
                <th className="p-3 font-normal">Result</th>
                <th className="hidden p-3 font-normal sm:table-cell">Opening</th>
                <th className="p-3 font-normal">Accuracy</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {games.map((g) => (
                <tr key={g.id} className="border-t border-white/5">
                  <td className="p-3 whitespace-nowrap">{new Date(g.played_at).toLocaleDateString()}</td>
                  <td className="p-3">
                    {g.mode === "friend" ? "Friend" : (g.bot ?? "Computer")}{g.mode === "online" && <span className="ml-1 text-xs text-primary">online</span>}
                    <span className="ml-1 text-muted-foreground">as {g.my_color === "w" ? "White" : "Black"}</span>
                  </td>
                  <td className="p-3 font-semibold whitespace-nowrap">
                    <span className="mr-1.5 inline-block size-2.5 rounded-full" style={{ background: RESULT[g.result].color }} aria-hidden />
                    {RESULT[g.result].text}
                    <span className="block text-xs font-normal text-muted-foreground">{g.reason}</span>
                  </td>
                  <td className="hidden p-3 text-muted-foreground sm:table-cell">{g.opening ?? "—"}</td>
                  <td className="p-3">{g.accuracy?.toFixed(1) ?? "…"}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button className="mr-2 rounded bg-card px-2 py-1 font-semibold hover:bg-accent" onClick={() => review(g)}>
                      Review
                    </button>
                    <button className="text-muted-foreground hover:text-destructive" onClick={() => void remove(g)} aria-label="Delete game">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PlainPage>
  );
}
