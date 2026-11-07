"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { BotAvatar } from "@/components/bot-avatar";
import { botNear } from "@/lib/bots";
import { levelInfo } from "@/lib/level";
import { refreshProfile, supabase, useAccount } from "@/lib/supabase";

const VALID = /^[A-Za-z0-9_]{3,20}$/;

/** Where to go after the welcome screen: back to an invite link if one is waiting, else the dashboard. */
const next = () => {
  const back = sessionStorage.getItem("after-login");
  sessionStorage.removeItem("after-login");
  return back ?? "/home";
};

/**
 * Welcome screen after sign-up (like chess.com's): 1) pick your username, 2) rate yourself 1-100.
 * Saved by the database function finish_onboarding, which re-checks everything.
 */
export function Welcome() {
  const router = useRouter();
  const { user, profile, ready } = useAccount();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [taken, setTaken] = useState<boolean | null>(null);
  const [level, setLevel] = useState(30);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);
  // Start from the current name (from sign-up or the email) and level.
  useEffect(() => {
    if (!profile) return;
    setName((n) => n || profile.username);
    if (profile.skill) setLevel(profile.skill);
  }, [profile]);

  // Live "is this name free?" check (your own current name counts as free).
  useEffect(() => {
    setTaken(null);
    if (!VALID.test(name) || name.toLowerCase() === profile?.username.toLowerCase()) return;
    const t = setTimeout(async () => setTaken(!!(await supabase.rpc("username_taken", { name })).data), 300);
    return () => clearTimeout(t);
  }, [name, profile]);

  const finish = async () => {
    setBusy(true);
    setError("");
    const { data, error } = await supabase.rpc("finish_onboarding", { name, level });
    if (error || data !== "ok") {
      setBusy(false);
      setError(error?.message ?? data);
      if (String(data).includes("username")) setStep(0);
      return;
    }
    await refreshProfile();
    router.replace(next());
  };

  if (!profile) return <div className="p-6 text-muted-foreground">Loading…</div>;
  const info = levelInfo(level);
  const bot = botNear(info.rating);
  const nameOk = VALID.test(name) && taken !== true;

  return (
    <div className="mx-auto flex min-h-[80dvh] max-w-xl flex-col justify-center px-6 py-10">
      <ol className="mb-8 flex justify-center gap-2" aria-label={`Step ${step + 1} of 2`}>
        {[0, 1].map((i) => (
          <li key={i} className={`h-1.5 w-16 rounded-full transition-colors duration-300 ${i <= step ? "bg-primary" : "bg-card"}`} />
        ))}
      </ol>

      {step === 0 ? (
        <section key="name" className="animate-[rise_.35s_ease-out]">
          <h1 className="mb-2 text-center text-5xl">Welcome to ChessSite!</h1>
          <p className="mb-8 text-center text-muted-foreground">Choose the name other players will see. You can use letters, numbers and _.</p>
          <label className="mb-2 block text-sm font-semibold" htmlFor="username">
            Username
          </label>
          <div className="relative mb-2">
            <input
              id="username"
              value={name}
              onChange={(e) => setName(e.target.value.replace(/\s/g, ""))}
              maxLength={20}
              autoComplete="username"
              autoFocus
              className="w-full rounded-lg bg-card px-4 py-3.5 pr-11 text-lg font-semibold outline-none focus:ring-2 focus:ring-primary"
            />
            {name && (
              <span className="absolute top-1/2 right-3 -translate-y-1/2" aria-hidden>
                {nameOk && taken === false ? <Check className="size-6 text-primary" /> : !nameOk ? <X className="size-6 text-[#fa412d]" /> : null}
              </span>
            )}
          </div>
          <p className={`mb-6 min-h-5 text-sm ${nameOk ? "text-muted-foreground" : "text-[#fa412d]"}`} aria-live="polite">
            {!VALID.test(name) ? "3 to 20 letters, numbers or _." : taken ? "That username is taken. Try another." : taken === false ? "Nice, it's free!" : ""}
          </p>
          {error && <p className="mb-3 text-destructive">{error}</p>}
          <button className="btn-green w-full py-4! text-xl!" disabled={!nameOk} onClick={() => setStep(1)}>
            Continue
          </button>
        </section>
      ) : (
        <section key="level" className="animate-[rise_.35s_ease-out]">
          <h1 className="mb-2 text-center text-5xl">How good are you at chess?</h1>
          <p className="mb-10 text-center text-muted-foreground">Slide to rate yourself from 1 to 100. We use it to pick your first puzzles and bot.</p>

          <div className="level-slider relative mb-4 pt-12" style={{ "--p": `${((level - 1) / 99) * 100}%`, "--pn": (level - 1) / 99 } as React.CSSProperties}>
            {/* Number bubble that follows the thumb */}
            <span className="level-bubble" aria-hidden>
              {level}
            </span>
            <input type="range" min={1} max={100} value={level} onChange={(e) => setLevel(Number(e.target.value))} aria-label="Your chess level" aria-valuetext={`${level}: ${info.label}`} className="w-full" />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground" aria-hidden>
              <span>1</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>

          <div key={info.label} className="mb-8 flex items-center gap-4 rounded-lg bg-card p-4 animate-[pop_.3s_ease-out]">
            <BotAvatar bot={bot} size={64} />
            <div>
              <p className="text-2xl font-bold">{info.label}</p>
              <p className="text-sm text-muted-foreground">{info.blurb}</p>
              <p className="mt-1 text-sm">
                Starting puzzle rating about <b>{info.rating}</b> · first bot: <b>{bot.name}</b> ({bot.rating})
              </p>
            </div>
          </div>

          {error && <p className="mb-3 text-destructive">{error}</p>}
          <div className="flex gap-3">
            <button className="rounded-lg bg-card px-6 font-semibold hover:bg-accent" onClick={() => setStep(0)}>
              Back
            </button>
            <button className="btn-green flex-1 py-4! text-xl!" disabled={busy} onClick={() => void finish()}>
              {busy ? "Saving…" : "Let's play"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
