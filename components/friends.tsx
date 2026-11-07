"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Swords, UserPlus, X } from "lucide-react";
import { PlainPage } from "@/components/game-screen";
import { Button } from "@/components/ui/button";
import { online } from "@/lib/online";
import { acceptFriend, addFriend, findPlayers, removeFriend, useFriends, usePresence, type Friend } from "@/lib/social";
import { useAccount } from "@/lib/supabase";

const TIMES = [1, 3, 5, 10, 0];

/** Green dot when the player has the site open (Realtime Presence). */
export function OnlineDot({ on }: { on: boolean }) {
  return <span className={`inline-block size-2.5 shrink-0 rounded-full ${on ? "bg-primary" : "bg-white/20"}`} title={on ? "Online" : "Offline"} aria-label={on ? "online" : "offline"} />;
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-[3px] bg-card text-lg font-bold" aria-hidden>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** "Challenge" button: pick a time and colour, then the game waits for them to accept. */
export function ChallengeButton({ id, username }: { id: string; username: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(5);
  const [color, setColor] = useState<"white" | "random" | "black">("random");
  const [error, setError] = useState("");
  const send = async () => {
    setError("");
    try {
      const { id: game } = await online<{ id: string }>("create", { minutes, color, to: id });
      router.push(`/play/online/${game}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="relative">
      <button className="btn-green py-1.5! text-sm!" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Swords className="size-4" aria-hidden /> Challenge
      </button>
      {open && (
        <div className="absolute top-10 right-0 z-30 w-64 rounded-md bg-card p-3 shadow-[0_8px_24px_rgba(0,0,0,.5)]" role="dialog" aria-label={`Challenge ${username}`}>
          <p className="mb-2 font-semibold">Challenge {username}</p>
          <div className="mb-2 grid grid-cols-5 gap-1">
            {TIMES.map((t) => (
              <button key={t} onClick={() => setMinutes(t)} aria-pressed={minutes === t} className={`rounded py-1.5 text-xs font-bold ${minutes === t ? "bg-accent ring-2 ring-primary" : "bg-panel"}`}>
                {t ? `${t}m` : "∞"}
              </button>
            ))}
          </div>
          <div className="mb-3 grid grid-cols-3 gap-1">
            {(["white", "random", "black"] as const).map((c) => (
              <button key={c} onClick={() => setColor(c)} aria-pressed={color === c} className={`rounded py-1.5 text-xs font-semibold capitalize ${color === c ? "bg-accent text-white" : "bg-panel text-muted-foreground"}`}>
                {c}
              </button>
            ))}
          </div>
          {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
          <button className="btn-green w-full py-2! text-base!" onClick={() => void send()}>
            Send challenge
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ f, on, children }: { f: { username: string }; on?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 border-t border-white/5 p-3 first:border-t-0">
      <Avatar name={f.username} />
      <span className="flex min-w-0 flex-1 items-center gap-2 font-semibold">
        {on !== undefined && <OnlineDot on={on} />}
        <span className="truncate">{f.username}</span>
      </span>
      {children}
    </li>
  );
}

export function FriendsPage() {
  const { user, ready } = useAccount();
  const friends = useFriends();
  const here = usePresence();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ id: string; username: string }[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (q.trim().length < 2) return setFound([]);
    const t = setTimeout(() => void findPlayers(q.trim()).then(setFound), 250);
    return () => clearTimeout(t);
  }, [q]);

  if (!ready) return <PlainPage title="Friends" />;
  if (!user)
    return (
      <PlainPage title="Friends">
        <p className="text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            Log in
          </Link>{" "}
          to add friends and challenge them.
        </p>
      </PlainPage>
    );

  const list = friends ?? [];
  const by = (d: Friend["dir"]) => list.filter((f) => f.dir === d);
  const mine = by("friend").sort((a, b) => Number(here.has(b.id)) - Number(here.has(a.id)) || a.username.localeCompare(b.username));
  const known = new Map(list.map((f) => [f.id, f]));
  const add = async (id: string, name: string) => {
    try {
      const r = await addFriend(id);
      setMsg(r === "friends" ? `You and ${name} are now friends.` : r === "sent" ? `Friend request sent to ${name}.` : `${name} is already in your list.`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <PlainPage title="Friends">
      <label className="mb-3 flex items-center gap-2 rounded-md bg-card px-3">
        <Search className="size-5 text-muted-foreground" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find players by username" aria-label="Find players by username" className="w-full bg-transparent py-3 outline-none" />
      </label>
      {msg && (
        <p className="mb-3 text-sm text-primary" role="status">
          {msg}
        </p>
      )}
      {found.length > 0 && (
        <ul className="mb-6 rounded-md bg-panel">
          {found.map((p) => {
            const k = known.get(p.id);
            return (
              <Row key={p.id} f={p} on={here.has(p.id)}>
                {k?.dir === "friend" ? <span className="text-sm text-muted-foreground">Friend</span> : k?.dir === "outgoing" ? <span className="text-sm text-muted-foreground">Request sent</span> : (
                  <Button variant="secondary" onClick={() => void add(p.id, p.username)}>
                    <UserPlus className="size-4" /> {k?.dir === "incoming" ? "Accept" : "Add friend"}
                  </Button>
                )}
                <ChallengeButton id={p.id} username={p.username} />
              </Row>
            );
          })}
        </ul>
      )}
      {q.trim().length >= 2 && !found.length && <p className="mb-6 text-sm text-muted-foreground">No players found.</p>}

      {by("incoming").length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-2xl">Friend requests</h2>
          <ul className="rounded-md bg-panel">
            {by("incoming").map((f) => (
              <Row key={f.request_id} f={f}>
                <button className="btn-green py-1.5! text-sm!" onClick={() => void acceptFriend(f.request_id)}>
                  Accept
                </button>
                <Button variant="secondary" onClick={() => void removeFriend(f.request_id)}>
                  Decline
                </Button>
              </Row>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-2xl">
          Friends <span className="text-base text-muted-foreground">{mine.length}</span>
        </h2>
        {!friends ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !mine.length ? (
          <p className="text-muted-foreground">No friends yet. Find a player above and add them, or send a game link from Play a Friend Online.</p>
        ) : (
          <ul className="rounded-md bg-panel">
            {mine.map((f) => (
              <Row key={f.request_id} f={f} on={here.has(f.id)}>
                <ChallengeButton id={f.id} username={f.username} />
                <button className="text-muted-foreground hover:text-destructive" onClick={() => confirm(`Remove ${f.username} from your friends?`) && void removeFriend(f.request_id)} aria-label={`Remove ${f.username}`}>
                  <X className="size-5" />
                </button>
              </Row>
            ))}
          </ul>
        )}
      </section>

      {by("outgoing").length > 0 && (
        <section>
          <h2 className="mb-2 text-2xl">Sent requests</h2>
          <ul className="rounded-md bg-panel">
            {by("outgoing").map((f) => (
              <Row key={f.request_id} f={f}>
                <Button variant="ghost" onClick={() => void removeFriend(f.request_id)}>
                  Cancel
                </Button>
              </Row>
            ))}
          </ul>
        </section>
      )}
    </PlainPage>
  );
}
