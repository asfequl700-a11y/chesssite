"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Check, MessageSquare, UserPlus } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ChallengeButton, OnlineDot } from "@/components/friends";
import { RESULT } from "@/components/my-games";
import { ReportButton } from "@/components/report-dialog";
import { Button } from "@/components/ui/button";
import { levelInfo } from "@/lib/level";
import { getProfile, saveBio, uploadAvatar, type PublicProfile } from "@/lib/profiles";
import { acceptFriend, addFriend, usePresence } from "@/lib/social";
import { supabase, useAccount } from "@/lib/supabase";

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-card p-3 text-center">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/** Public profile like chess.com/member/name: photo, bio, stats, recent online games, actions. */
export function ProfilePage({ username }: { username: string }) {
  const { user, profile: mine } = useAccount();
  const here = usePresence();
  const [p, setP] = useState<PublicProfile | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [bio, setBio] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ratings, setRatings] = useState<Record<string, { rating: number; games: number }>>({});
  const file = useRef<HTMLInputElement>(null);

  const load = () =>
    getProfile(username).then(
      (x) => {
        setP(x);
        if (x) void supabase.rpc("player_ratings", { uid: x.id }).then(({ data }) => setRatings((data ?? {}) as typeof ratings));
      },
      (e) => setError(e.message),
    );
  useEffect(() => {
    void load();
  }, [username, user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="mx-auto max-w-4xl p-6 text-destructive">{error}</div>;
  if (p === undefined) return <div className="mx-auto max-w-4xl p-6 text-muted-foreground">Loading…</div>;
  if (p === null)
    return (
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="mb-2 text-4xl">Player not found</h1>
        <p className="text-muted-foreground">
          No one is called &quot;{username}&quot;.{" "}
          <Link href="/friends" className="text-primary hover:underline">
            Search players
          </Link>
        </p>
      </div>
    );

  const own = user?.id === p.id;
  const avatar = own ? (mine?.avatar_url ?? p.avatar_url) : p.avatar_url;
  const o = p.online;

  const pickPhoto = async (f: File | undefined) => {
    if (!f || !user) return;
    setBusy(true);
    setError("");
    try {
      await uploadAvatar(user.id, f);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 lg:p-6">
      <section className="flex flex-col gap-4 rounded-md bg-panel p-5 sm:flex-row sm:items-start">
        <div className="relative self-start">
          <Avatar url={avatar} name={p.username} size={120} />
          {own && (
            <>
              <button
                className="absolute right-1 bottom-1 grid size-9 place-items-center rounded-full bg-black/70 text-white hover:bg-black"
                onClick={() => file.current?.click()}
                aria-label="Change photo"
                title="Change photo"
                disabled={busy}
              >
                <Camera className="size-5" />
              </button>
              <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => void pickPhoto(e.target.files?.[0])} />
            </>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 font-sans text-3xl font-bold">
            {p.username} <OnlineDot on={here.has(p.id)} />
          </h1>
          <p className="text-sm text-muted-foreground">
            Joined {new Date(p.joined).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
            {p.level ? ` · ${levelInfo(p.level).label}` : ""}
          </p>
          {busy && <p className="text-sm text-primary">Uploading photo…</p>}

          {own && bio !== null ? (
            <div className="mt-3 flex flex-col gap-2">
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={2} aria-label="About you" className="w-full rounded-md bg-card p-2" />
              <div className="flex gap-2">
                <button
                  className="btn-green py-1.5! text-sm!"
                  onClick={async () => {
                    await saveBio(user!.id, bio);
                    setBio(null);
                    void load();
                  }}
                >
                  Save
                </button>
                <Button variant="ghost" onClick={() => setBio(null)}>
                  Cancel
                </Button>
                <span className="ml-auto self-center text-xs text-muted-foreground">{bio.length}/160</span>
              </div>
            </div>
          ) : (
            <p className="mt-3 whitespace-pre-wrap">
              {p.bio || (own ? <span className="text-muted-foreground">Add a short line about yourself.</span> : null)}
              {own && (
                <button className="ml-2 text-sm text-primary hover:underline" onClick={() => setBio(p.bio)}>
                  Edit
                </button>
              )}
            </p>
          )}

          {user && !own && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <ChallengeButton id={p.id} username={p.username} />
              {p.friend === "friend" ? (
                <>
                  <span className="flex items-center gap-1 text-sm text-primary">
                    <Check className="size-4" /> Friends
                  </span>
                  <Link href={`/messages/${p.username}`} className="flex items-center gap-1.5 rounded-md bg-card px-3 py-1.5 text-sm font-semibold hover:bg-accent">
                    <MessageSquare className="size-4" /> Message
                  </Link>
                </>
              ) : p.friend === "outgoing" ? (
                <span className="text-sm text-muted-foreground">Friend request sent</span>
              ) : (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    if (p.friend === "incoming" && p.request_id) await acceptFriend(p.request_id);
                    else await addFriend(p.id).catch((e) => setError(e.message));
                    void load();
                  }}
                >
                  <UserPlus className="size-4" /> {p.friend === "incoming" ? "Accept friend request" : "Add friend"}
                </Button>
              )}
              <div className="ml-auto">
                <ReportButton userId={p.id} username={p.username} />
              </div>
            </div>
          )}
          {!user && (
            <p className="mt-4 text-sm text-muted-foreground">
              <Link href="/login" className="text-primary hover:underline">
                Log in
              </Link>{" "}
              to add {p.username} as a friend or challenge them.
            </p>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Online ratings">
        {(["bullet", "blitz", "rapid", "daily"] as const).map((k) => (
          <Tile key={k} label={`${k[0].toUpperCase()}${k.slice(1)}${ratings[k] ? ` · ${ratings[k].games} games` : ""}`} value={ratings[k]?.rating ?? "—"} />
        ))}
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Online games" value={o.games} />
        <Tile label="Won / drawn / lost" value={`${o.won}/${o.drawn}/${o.lost}`} />
        <Tile label="Puzzle rating" value={p.puzzle_rating} />
        <Tile label="Puzzles solved" value={p.puzzles_solved} />
        <Tile label="Puzzle Rush best" value={p.rush_best} />
        <Tile label="Bots beaten" value={`${p.bots_beaten} / 15`} />
      </section>

      <section className="rounded-md bg-panel">
        <h2 className="p-4 font-sans text-xl font-bold">Recent online games</h2>
        {!p.recent.length ? (
          <p className="px-4 pb-4 text-muted-foreground">No online games yet.</p>
        ) : (
          <ul>
            {p.recent.map((g, i) => (
              <li key={i} className="flex items-center gap-3 border-t border-white/5 px-4 py-2.5 text-sm">
                <span className="grid size-5 place-items-center rounded text-xs font-bold text-white" style={{ background: RESULT[g.result].color }} aria-label={RESULT[g.result].text}>
                  {g.result === "win" ? "+" : g.result === "loss" ? "−" : "="}
                </span>
                <span className="flex-1">
                  vs{" "}
                  <Link href={`/member/${g.opponent}`} className="font-semibold hover:underline">
                    {g.opponent}
                  </Link>{" "}
                  <span className="text-muted-foreground">{g.reason}</span>
                </span>
                <span className="hidden text-muted-foreground sm:inline">{g.time_control === "none" ? "No clock" : g.time_control}</span>
                <span className="text-muted-foreground">{new Date(g.played_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
