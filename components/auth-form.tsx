"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlainPage } from "@/components/game-screen";
import { supabase } from "@/lib/supabase";

const input = "w-full rounded-md bg-card px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary";

/** Log in, sign up, or ask for a password-reset email. Email + password only (Supabase Auth). */
export function AuthForm({ mode: start }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(start);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return setMsg({ ok: false, text: "Username: 3 to 20 letters, numbers or _." });
        const { data: taken } = await supabase.rpc("username_taken", { name: username });
        if (taken) return setMsg({ ok: false, text: "That username is taken. Try another." });
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username }, emailRedirectTo: `${location.origin}/` },
        });
        if (error) return setMsg({ ok: false, text: error.message });
        if (!data.session) return setMsg({ ok: true, text: "Check your email and click the link to confirm your account." });
        router.push("/");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return setMsg({ ok: false, text: error.message === "Invalid login credentials" ? "Wrong email or password." : error.message });
        router.push("/");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/reset-password` });
        if (error) return setMsg({ ok: false, text: error.message });
        setMsg({ ok: true, text: "If that email has an account, a reset link is on its way." });
      }
    } finally {
      setBusy(false);
    }
  }

  const title = { login: "Log in", signup: "Sign up", forgot: "Reset password" }[mode];
  return (
    <PlainPage title={title}>
      <form onSubmit={submit} className="flex max-w-sm flex-col gap-3">
        {mode === "signup" && (
          <label className="flex flex-col gap-1 text-sm">
            Username
            <input className={input} name="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input className={input} type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        {mode !== "forgot" && (
          <label className="flex flex-col gap-1 text-sm">
            Password
            <input
              className={input}
              type="password"
              name="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
            />
          </label>
        )}
        {msg && (
          <p role="alert" className={msg.ok ? "text-primary" : "text-destructive"}>
            {msg.text}
          </p>
        )}
        <button className="btn-green mt-1" disabled={busy}>
          {busy ? "Please wait…" : title}
        </button>

        {/* Google sign-in: Google Cloud OAuth client, switched on in Supabase → Authentication → Sign In / Providers → Google. */}
        {mode !== "forgot" && (
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-lg bg-white py-2.5 font-semibold text-[#1f1f1f] hover:bg-white/90"
            onClick={async () => {
              setMsg(null);
              // The button leaves the site at once, so check first that Google is switched on in Supabase.
              const settings = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
                headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" },
              })
                .then((r) => r.json())
                .catch(() => null);
              if (!settings?.external?.google) return setMsg({ ok: false, text: "Google sign-in isn't switched on yet. Use email for now." });
              const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/` } });
              if (error) setMsg({ ok: false, text: error.message });
            }}
          >
            <GoogleG /> Continue with Google
          </button>
        )}

        <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
          {mode === "login" && (
            <>
              <button type="button" className="text-left hover:text-white" onClick={() => setMode("forgot")}>
                Forgot your password?
              </button>
              <Link href="/signup" className="hover:text-white">
                New here? Sign up, it&apos;s free
              </Link>
            </>
          )}
          {mode !== "login" && (
            <Link href="/login" onClick={() => setMode("login")} className="hover:text-white">
              Already have an account? Log in
            </Link>
          )}
          <p className="mt-2">You don&apos;t need an account to play. Accounts save your games, stats, puzzle rating and course progress.</p>
        </div>
      </form>
    </PlainPage>
  );
}

/** Page opened from the reset email: Supabase signs the user in from the link, then they pick a new password. */
export function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return setMsg({ ok: false, text: error.message.includes("session") ? "This link has expired. Ask for a new one on the Log in page." : error.message });
    setMsg({ ok: true, text: "Password changed. Taking you home…" });
    setTimeout(() => router.push("/"), 1200);
  }
  return (
    <PlainPage title="Choose a new password">
      <form onSubmit={submit} className="flex max-w-sm flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          New password
          <input className={input} type="password" name="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
        </label>
        {msg && (
          <p role="alert" className={msg.ok ? "text-primary" : "text-destructive"}>
            {msg.text}
          </p>
        )}
        <button className="btn-green">Save password</button>
      </form>
    </PlainPage>
  );
}

/** Google's "G" mark, as Google's sign-in branding rules ask for on Google buttons. */
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.8 6.1C12.3 13.6 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z" />
      <path fill="#FBBC05" d="M10.4 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.8-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.7l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.4 0-11.7-4.1-13.6-9.8l-7.8 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}
