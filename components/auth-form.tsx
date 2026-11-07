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

        {/* Continue with Google: not enabled yet. Needs a Google Cloud OAuth client added in Supabase → Auth → Providers.
            Then: supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin } }). */}
        {mode !== "forgot" && (
          <button type="button" disabled className="rounded-lg bg-card py-2.5 font-semibold text-muted-foreground" title="Coming soon">
            Continue with Google (coming soon)
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
