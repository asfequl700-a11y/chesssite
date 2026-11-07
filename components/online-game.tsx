"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import { Copy, Share2, Wifi } from "lucide-react";
import { Board, type Promo } from "@/components/board";
import { GameScreen } from "@/components/game-screen";
import { MoveList } from "@/components/move-list";
import { GameOver, PlayerBar } from "@/components/player-bar";
import { Button } from "@/components/ui/button";
import { markActive } from "@/lib/activity";
import { fillAccuracy } from "@/lib/games";
import { online, serverNow } from "@/lib/online";
import { supabase, useAccount } from "@/lib/supabase";
import { replay, timeLeft, type GameRow, type Side } from "@/supabase/functions/_shared/online-rules";

type Row = GameRow & {
  id: string;
  created_by: string;
  white_name: string;
  black_name: string;
  fen: string;
  rematch_id: string | null;
  white_game_id: number | null;
  black_game_id: number | null;
  updated_at: string;
};

const TIMES = [1, 3, 5, 10, 0];

/** Sends a guest to log in and brings them back here afterwards. */
function LoginToPlay({ what }: { what: string }) {
  const remember = () => sessionStorage.setItem("after-login", location.pathname);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground">You need a free account to {what}, so games are fair and saved for both players.</p>
      <Link href="/signup" onClick={remember} className="btn-green">
        Sign up free
      </Link>
      <Link href="/login" onClick={remember} className="rounded-lg bg-card py-2.5 text-center font-semibold hover:bg-accent">
        Log in
      </Link>
    </div>
  );
}

/** /play/online: choose a time and colour, get an invite link. */
export function OnlineLobby() {
  const router = useRouter();
  const { user, ready } = useAccount();
  const [minutes, setMinutes] = useState(5);
  const [color, setColor] = useState<"white" | "random" | "black">("random");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const { id } = await online<{ id: string }>("create", { minutes, color });
      router.push(`/play/online/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <GameScreen title="Play a Friend Online">
      {!ready ? null : !user ? (
        <LoginToPlay what="play online" />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground">Create a game, send the link to a friend, and play live from two devices.</p>
          <div>
            <p className="mb-2 text-sm font-semibold">Time per player</p>
            <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Time per player">
              {TIMES.map((t) => (
                <button
                  key={t}
                  role="radio"
                  aria-checked={minutes === t}
                  onClick={() => setMinutes(t)}
                  className={`rounded-md py-3 text-sm font-bold ${minutes === t ? "bg-accent ring-2 ring-primary" : "bg-card hover:bg-accent"}`}
                >
                  {t ? `${t} min` : "No clock"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">I play</p>
            <div className="grid grid-cols-3 gap-1 rounded-md bg-card p-1" role="radiogroup" aria-label="I play">
              {(["white", "random", "black"] as const).map((c) => (
                <button
                  key={c}
                  role="radio"
                  aria-checked={color === c}
                  onClick={() => setColor(c)}
                  className={`rounded py-2 text-sm font-semibold capitalize ${color === c ? "bg-accent text-white" : "text-muted-foreground hover:text-white"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-destructive">{error}</p>}
          <button className="btn-green w-full py-4! text-xl!" onClick={() => void create()} disabled={busy}>
            {busy ? "Creating…" : "Create game link"}
          </button>
        </div>
      )}
    </GameScreen>
  );
}

/** Keeps one chess.js game in step with the server's move list, so the board plays move sounds. */
function useSyncedGame(moves: string[]) {
  const ref = useRef(new Chess());
  const g = ref.current;
  const have = g.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));
  const isPrefix = have.length <= moves.length && have.every((m, i) => m === moves[i]);
  if (!isPrefix) ref.current = replay(moves);
  else for (const m of moves.slice(have.length)) ref.current.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
  return ref.current;
}

/** /play/online/[id]: waiting room, then the live game. */
export function OnlineGame({ id }: { id: string }) {
  const router = useRouter();
  const { user, ready } = useAccount();
  const [row, setRow] = useState<Row | null>(null);
  const [peek, setPeek] = useState<{ status: string; time_ms: number; host: string } | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [view, setView] = useState<number | null>(null);
  const [flip, setFlip] = useState(false);
  const [closed, setClosed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [, tick] = useState(0);
  const flagged = useRef("");
  const finished = useRef(false);

  // Load the game (only players can read it), else ask the server what the invite is.
  async function load() {
    const { data } = await supabase.from("online_games").select("*").eq("id", id).maybeSingle();
    if (data) return setRow(data as Row);
    try {
      setPeek(await online("peek", { id }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    if (!user) return;
    void load();
    // Live: every change the server saves is pushed here (row level security still applies).
    const channel = supabase
      .channel(`online:${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "online_games", filter: `id=eq.${id}` }, (p) => {
        setRow(p.new as Row);
        setPending(null);
      })
      .subscribe();
    // Safety net if a live update is missed (sleeping phone, bad Wi-Fi).
    const poll = setInterval(() => void load(), 10000);
    const wake = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", wake);
    return () => {
      void supabase.removeChannel(channel);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [user, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const moves = row ? (pending ? [...row.moves, pending] : row.moves) : [];
  const g = useSyncedGame(moves);
  const me: Side | null = !row || !user ? null : row.white === user.id ? "w" : row.black === user.id ? "b" : null;
  const turn: Side = moves.length % 2 === 0 ? "w" : "b";
  const active = row?.status === "active";
  const timed = !!row?.time_ms;

  // Clock ticks; when the side to move hits zero, ask the server to confirm the time-out.
  useEffect(() => {
    if (!active || !timed) return;
    const t = setInterval(() => {
      tick((n) => n + 1);
      if (row && timeLeft(row, turn, serverNow()) <= 0 && flagged.current !== row.updated_at) {
        flagged.current = row.updated_at;
        online("flag", { id }).catch(() => {});
      }
    }, 100);
    return () => clearInterval(t);
  }, [active, timed, row, turn, id]);

  // Game over: fill in my accuracy and count today for the streak (once).
  useEffect(() => {
    if (!row || row.status !== "over" || !me || finished.current) return;
    const myId = me === "w" ? row.white_game_id : row.black_game_id;
    if (!myId) return;
    finished.current = true;
    markActive();
    void fillAccuracy(myId, replay(row.moves).pgn(), me);
  }, [row, me]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setNote("");
    try {
      const out = await online<{ game?: Row }>(action, { id, ...extra });
      if (out.game) setRow(out.game);
    } catch (e) {
      setNote((e as Error).message);
      void load();
    } finally {
      setPending(null);
    }
  };

  const onMove = (from: string, to: string, promotion?: Promo) => {
    if (!row || !active || me !== turn || pending) return false;
    const t = new Chess(g.fen());
    try {
      t.move({ from, to, promotion });
    } catch {
      return false;
    }
    const uci = from + to + (promotion ?? "");
    setPending(uci); // show it at once; the server confirms (or we put the piece back)
    setView(null);
    void act("move", { uci });
    return true;
  };

  const share = async () => {
    const url = location.href;
    if (navigator.share) await navigator.share({ title: "Play chess with me on ChessSite", url }).catch(() => {});
    else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    }
  };

  if (!ready) return <GameScreen title="Online game">Loading…</GameScreen>;
  if (!user)
    return (
      <GameScreen title="Online game">
        <LoginToPlay what="join this game" />
      </GameScreen>
    );
  if (error)
    return (
      <GameScreen title="Online game">
        <p className="mb-3 text-destructive">{error}</p>
        <Link href="/play/online" className="btn-green">
          Create a new game
        </Link>
      </GameScreen>
    );

  // Invite link opened by the friend: show who invited them and a Join button.
  if (!row && peek)
    return (
      <GameScreen title="Join game">
        {peek.status === "waiting" ? (
          <div className="flex flex-col gap-3">
            <p className="text-lg">
              <b>{peek.host}</b> invited you to a game ({peek.time_ms ? `${peek.time_ms / 60000} min` : "no clock"}).
            </p>
            {note && <p className="text-destructive">{note}</p>}
            <button
              className="btn-green w-full py-4! text-xl!"
              onClick={async () => {
                try {
                  await online("join", { id });
                  await load();
                } catch (e) {
                  setNote((e as Error).message);
                }
              }}
            >
              Join game
            </button>
          </div>
        ) : (
          <p className="text-muted-foreground">This game has already started or finished.</p>
        )}
      </GameScreen>
    );
  if (!row) return <GameScreen title="Online game">Loading…</GameScreen>;

  const shownGame = view === null ? g : replay(moves.slice(0, view));
  const orientation = (me ?? "w") === "w" !== flip ? "white" : "black";
  const top: Side = orientation === "white" ? "b" : "w";
  const nameOf = (s: Side) => (s === "w" ? row.white_name : row.black_name) || "Waiting…";
  const bar = (s: Side) => (
    <PlayerBar
      name={`${nameOf(s)}${s === me ? " (you)" : ""}`}
      color={s}
      fen={g.fen()}
      clock={timed ? { ms: Math.max(0, timeLeft(row, s, serverNow())), running: active && turn === s && moves.length > 0 } : undefined}
    />
  );
  const result = row.status === "over" && row.reason !== "cancelled" ? { winner: row.result === "draw" ? null : row.result, reason: row.reason } : null;
  const title = !result ? "" : row.reason === "aborted" ? "Game aborted" : result.winner === null ? "Draw" : result.winner === me ? "You won!" : "You lost";
  const theyOffered = active && row.draw_offer && row.draw_offer !== me;

  const board = (
    <div className="flex w-full flex-col gap-2">
      {bar(top)}
      <Board game={shownGame} fen={shownGame.fen()} orientation={orientation} onMove={view === null && active ? onMove : undefined} side={me ?? undefined}>
        {result && !closed && (
          <GameOver
            result={{ winner: result.winner ?? null, reason: result.reason }}
            title={title}
            onReview={() => {
              sessionStorage.setItem("review-pgn", replay(row.moves).pgn());
              router.push("/analysis");
            }}
            onNew={() => router.push("/play/online")}
            onRematch={async () => {
              try {
                const { id: next } = await online<{ id: string }>("rematch", { id });
                router.push(`/play/online/${next}`);
              } catch (e) {
                setNote((e as Error).message);
              }
            }}
            onClose={() => setClosed(true)}
          />
        )}
      </Board>
      {bar(top === "w" ? "b" : "w")}
    </div>
  );

  return (
    <GameScreen title="Online game" board={board}>
      <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Wifi className="size-4 text-primary" aria-hidden /> Live · {timed ? `${row.time_ms / 60000} min` : "no clock"}
      </p>

      {row.status === "waiting" && (
        <div className="mb-4 flex flex-col gap-3 rounded-md bg-card p-4">
          <p className="font-semibold">Send this link to your friend. The game starts when they join.</p>
          <div className="flex gap-2">
            <input readOnly value={typeof location === "undefined" ? "" : location.href} className="min-w-0 flex-1 rounded-md bg-panel px-3 py-2 text-sm" aria-label="Invite link" onFocus={(e) => e.target.select()} />
            <Button variant="secondary" onClick={() => void share()} aria-label="Share link">
              {copied ? "Copied!" : <><Share2 className="size-4" /> <Copy className="size-4" /></>}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Waiting for your friend…
          </p>
          <Button variant="ghost" onClick={() => void act("cancel").then(() => router.push("/play/online"))}>
            Cancel game
          </Button>
        </div>
      )}

      {row.status === "over" && row.reason === "cancelled" && <p className="mb-4 text-muted-foreground">This game was cancelled.</p>}

      {active && (
        <p className="mb-3 text-lg font-semibold" aria-live="polite">
          {pending ? "Sending move…" : turn === me ? "Your move" : `Waiting for ${nameOf(turn)}…`}
        </p>
      )}
      {result && (
        <p className="mb-3 text-lg font-semibold">
          {title} {row.reason !== "aborted" && row.reason}.
        </p>
      )}
      {note && (
        <p className="mb-3 text-sm text-destructive" role="alert">
          {note}
        </p>
      )}

      {theyOffered && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-card p-3">
          <span className="mr-auto font-semibold">{nameOf(row.draw_offer as Side)} offers a draw.</span>
          <button className="btn-green py-2! text-base!" onClick={() => void act("accept_draw")}>
            Accept
          </button>
          <Button variant="secondary" onClick={() => void act("decline_draw")}>
            Decline
          </Button>
        </div>
      )}

      {active && (
        <div className="mb-4 flex flex-wrap gap-2">
          {moves.length < 2 ? (
            <Button variant="secondary" onClick={() => void act("abort")}>
              Abort
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => confirm("Resign this game?") && void act("resign")}>
              Resign
            </Button>
          )}
          <Button variant="secondary" onClick={() => void act("offer_draw")} disabled={row.draw_offer === me || moves.length < 2}>
            {row.draw_offer === me ? "Draw offered" : "Offer draw"}
          </Button>
          <Button variant="secondary" onClick={() => setFlip(!flip)}>
            Flip board
          </Button>
        </div>
      )}

      {row.rematch_id && row.status === "over" && (
        <button className="btn-green mb-4 w-full" onClick={() => router.push(`/play/online/${row.rematch_id}`)}>
          Rematch ready: play
        </button>
      )}

      <MoveList sans={g.history()} ply={view ?? g.history().length} go={(n) => setView(n >= g.history().length ? null : n)} />
    </GameScreen>
  );
}
