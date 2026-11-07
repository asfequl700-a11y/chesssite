"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Swords, UserPlus, Users, X } from "lucide-react";
import { online } from "@/lib/online";
import { acceptFriend, removeFriend, useChallenges, useFriends, usePresence, type Challenge } from "@/lib/social";

const timeText = (ms: number) => (ms ? `${ms / 60000} min` : "no clock");
const from = (c: Challenge) => (c.white === c.created_by ? c.white_name : c.black_name);

/** Accept (join + open the game) or decline a challenge. */
function useAnswer(before: () => void = () => {}) {
  const router = useRouter();
  return {
    accept: async (c: Challenge) => {
      before();
      try {
        await online("join", { id: c.id });
      } catch {} // already started / cancelled: the game page explains
      router.push(`/play/online/${c.id}`);
    },
    decline: (c: Challenge) => void online("decline", { id: c.id }).catch(() => {}),
  };
}

/** Pop-up for each new challenge (mounted once, outside the sidebar, so it shows on phones too). */
export function ChallengeToast() {
  const challenges = useChallenges();
  const [toast, setToast] = useState<Challenge | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const { accept, decline } = useAnswer(() => setToast(null));
  useEffect(() => {
    if (!challenges) return;
    const ids = new Set(challenges.map((c) => c.id));
    if (seen.current) {
      const fresh = challenges.find((c) => !seen.current!.has(c.id));
      if (fresh) setToast(fresh);
    }
    seen.current = ids;
    setToast((t) => (t && ids.has(t.id) ? t : null));
  }, [challenges]);
  if (!toast) return null;
  return (
    <div className="fixed right-4 bottom-4 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-md bg-card p-4 shadow-[0_8px_24px_rgba(0,0,0,.6)]" role="alert">
      <button className="absolute top-2 right-2 text-muted-foreground hover:text-white" onClick={() => setToast(null)} aria-label="Close">
        <X className="size-4" />
      </button>
      <p className="mb-3 pr-4">
        <Swords className="mr-1 inline size-5 text-primary" aria-hidden />
        <b>{from(toast)}</b> challenges you to a game ({timeText(toast.time_ms)})
      </p>
      <div className="flex gap-2">
        <button className="btn-green flex-1 py-2! text-base!" onClick={() => void accept(toast)}>
          Accept
        </button>
        <button
          className="flex-1 rounded-md bg-panel py-2 font-semibold hover:bg-accent"
          onClick={() => {
            setToast(null);
            decline(toast);
          }}
        >
          Decline
        </button>
      </div>
    </div>
  );
}

/** Sidebar icons: Friends + a bell with live challenges and friend requests (chess.com style). */
export function SocialIcons({ close }: { close: () => void }) {
  const challenges = useChallenges() ?? [];
  const requests = (useFriends() ?? []).filter((f) => f.dir === "incoming");
  usePresence(); // marks you online while the site is open
  const [open, setOpen] = useState(false);
  const count = challenges.length + requests.length;
  const { accept, decline } = useAnswer(() => {
    setOpen(false);
    close();
  });

  const icon = "relative grid size-9 place-items-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-white";
  return (
    <div className="relative flex gap-1 px-1">
      <Link href="/friends" onClick={close} className={icon} aria-label="Friends" title="Friends">
        <Users className="size-5" />
      </Link>
      <button className={icon} onClick={() => setOpen(!open)} aria-label={`Notifications${count ? `: ${count} new` : ""}`} aria-expanded={open} title="Notifications">
        <Bell className="size-5" />
        {count > 0 && <span className="absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-[#fa412d] text-[10px] font-bold text-white">{count}</span>}
      </button>

      {open && (
        <div className="absolute bottom-11 left-0 z-50 w-72 rounded-md bg-card p-2 shadow-[0_8px_24px_rgba(0,0,0,.5)] lg:bottom-auto lg:left-full lg:top-0 lg:ml-2" role="dialog" aria-label="Notifications">
          {!count && <p className="p-3 text-sm text-muted-foreground">Nothing new.</p>}
          {challenges.map((c) => (
            <div key={c.id} className="flex flex-col gap-2 rounded p-2 hover:bg-panel">
              <p className="text-sm">
                <Swords className="mr-1 inline size-4 text-primary" aria-hidden />
                <b>{from(c)}</b> challenges you ({timeText(c.time_ms)})
              </p>
              <div className="flex gap-2">
                <button className="btn-green flex-1 py-1.5! text-sm!" onClick={() => void accept(c)}>
                  Accept
                </button>
                <button className="flex-1 rounded-md bg-panel py-1.5 text-sm font-semibold hover:bg-accent" onClick={() => decline(c)}>
                  Decline
                </button>
              </div>
            </div>
          ))}
          {requests.map((f) => (
            <div key={f.request_id} className="flex flex-col gap-2 rounded p-2 hover:bg-panel">
              <p className="text-sm">
                <UserPlus className="mr-1 inline size-4 text-primary" aria-hidden />
                <b>{f.username}</b> wants to be your friend
              </p>
              <div className="flex gap-2">
                <button className="btn-green flex-1 py-1.5! text-sm!" onClick={() => void acceptFriend(f.request_id)}>
                  Accept
                </button>
                <button className="flex-1 rounded-md bg-panel py-1.5 text-sm font-semibold hover:bg-accent" onClick={() => void removeFriend(f.request_id)}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
