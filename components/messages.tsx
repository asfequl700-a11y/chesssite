"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { OnlineDot } from "@/components/friends";
import { getProfile, type PublicProfile } from "@/lib/profiles";
import { usePresence, useConversations, useFriends } from "@/lib/social";
import { supabase, useAccount } from "@/lib/supabase";

type Message = { id: number; from_user: string; to_user: string; body: string; created_at: string; read_at: string | null };

const when = (iso: string) => {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString();
};

/** Left column: conversations, then friends you haven't messaged yet. */
function Inbox({ active }: { active?: string }) {
  const convs = useConversations();
  const friends = (useFriends() ?? []).filter((f) => f.dir === "friend");
  const here = usePresence();
  const talked = new Set((convs ?? []).map((c) => c.id));
  const fresh = friends.filter((f) => !talked.has(f.id));
  const item = (name: string, url: string | null, id: string, sub: React.ReactNode, unread = 0) => (
    <li key={id}>
      <Link
        href={`/messages/${name}`}
        className={`flex items-center gap-3 border-t border-white/5 p-3 hover:bg-accent ${active?.toLowerCase() === name.toLowerCase() ? "bg-accent" : ""}`}
      >
        <Avatar url={url} name={name} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 font-semibold">
            {name} <OnlineDot on={here.has(id)} />
          </span>
          <span className="block truncate text-sm text-muted-foreground">{sub}</span>
        </span>
        {unread > 0 && <span className="grid size-5 place-items-center rounded-full bg-[#fa412d] text-xs font-bold text-white">{unread}</span>}
      </Link>
    </li>
  );
  return (
    <div className="overflow-hidden rounded-md bg-panel">
      <h2 className="p-4 font-sans text-xl font-bold">Messages</h2>
      {!convs ? (
        <p className="p-4 text-muted-foreground">Loading…</p>
      ) : !convs.length && !fresh.length ? (
        <p className="p-4 text-sm text-muted-foreground">
          You can message your friends.{" "}
          <Link href="/friends" className="text-primary hover:underline">
            Add friends
          </Link>
        </p>
      ) : (
        <ul>
          {convs.map((c) => item(c.username, c.avatar_url, c.id, `${c.last_from_me ? "You: " : ""}${c.last_body}`, c.unread))}
          {fresh.map((f) => item(f.username, f.avatar_url, f.id, "Say hello"))}
        </ul>
      )}
    </div>
  );
}

/** One conversation: messages oldest first, live, marked read when you look at them. */
function Thread({ username }: { username: string }) {
  const { user } = useAccount();
  const [other, setOther] = useState<PublicProfile | null | undefined>(undefined);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void getProfile(username).then(setOther, () => setOther(null));
  }, [username]);

  useEffect(() => {
    if (!user || !other) return;
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(`and(from_user.eq.${user.id},to_user.eq.${other.id}),and(from_user.eq.${other.id},to_user.eq.${user.id})`)
        .order("created_at", { ascending: false })
        .limit(200);
      setMsgs(((data ?? []) as Message[]).reverse());
      // Mark their messages to me as read.
      await supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("from_user", other.id).eq("to_user", user.id).is("read_at", null);
    };
    void load();
    const ch = supabase
      .channel(`dm:${user.id}:${other.id}:${Math.random()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `to_user=eq.${user.id}` }, (p) => {
        if ((p.new as Message).from_user === other.id) void load();
      })
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [user, other]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" }); // braces: newer Chrome returns a Promise here, effects must not
  }, [msgs]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !other || !user) return;
    setError("");
    setText("");
    const { data, error } = await supabase.from("messages").insert({ to_user: other.id, body }).select("*").single();
    if (error) {
      setText(body);
      setError(error.message.includes("row-level security") ? `You can only message friends. Add ${other.username} first.` : error.message);
      return;
    }
    setMsgs((m) => [...m, data as Message]);
  };

  if (other === undefined) return <div className="rounded-md bg-panel p-4 text-muted-foreground">Loading…</div>;
  if (other === null) return <div className="rounded-md bg-panel p-4 text-muted-foreground">Player not found.</div>;
  return (
    <div className="flex h-[min(70dvh,640px)] flex-col overflow-hidden rounded-md bg-panel">
      <header className="flex items-center gap-3 border-b border-white/5 p-3">
        <Link href="/messages" className="text-muted-foreground hover:text-white lg:hidden" aria-label="All messages">
          <ArrowLeft className="size-5" />
        </Link>
        <Avatar url={other.avatar_url} name={other.username} size={36} />
        <Link href={`/member/${other.username}`} className="font-semibold hover:underline">
          {other.username}
        </Link>
      </header>
      <div className="flex-1 overflow-y-auto p-4" aria-live="polite">
        {!msgs.length && <p className="text-center text-sm text-muted-foreground">No messages yet. Say hello!</p>}
        {msgs.map((m) => {
          const mine = m.from_user === user?.id;
          return (
            <div key={m.id} className={`mb-2 flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${mine ? "rounded-br-sm bg-primary text-white" : "rounded-bl-sm bg-card"}`}>
                <p className="break-words whitespace-pre-wrap">{m.body}</p>
                <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-white/70" : "text-muted-foreground"}`}>
                  {when(m.created_at)}
                  {mine && m.read_at ? " · Seen" : ""}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {error && <p className="px-3 text-sm text-destructive">{error}</p>}
      <form onSubmit={send} className="flex gap-2 border-t border-white/5 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder={`Message ${other.username}`}
          aria-label={`Message ${other.username}`}
          className="min-w-0 flex-1 rounded-full bg-card px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary"
        />
        <button className="btn-green rounded-full! px-4! py-2!" aria-label="Send" disabled={!text.trim()}>
          <Send className="size-5" />
        </button>
      </form>
    </div>
  );
}

/** /messages and /messages/[username]: inbox on the left, chat on the right (one at a time on phones). */
export function MessagesPage({ username }: { username?: string }) {
  const { user, ready } = useAccount();
  if (!ready) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!user)
    return (
      <div className="p-6 text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">
          Log in
        </Link>{" "}
        to message your friends.
      </div>
    );
  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:p-6">
      <div className={username ? "hidden lg:block" : ""}>
        <Inbox active={username} />
      </div>
      {username ? (
        <Thread key={username} username={username} />
      ) : (
        <div className="hidden place-items-center rounded-md bg-panel p-10 text-muted-foreground lg:grid">Pick a friend to start chatting.</div>
      )}
    </div>
  );
}
