"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendReport } from "@/lib/profiles";

const REASONS = [
  { id: "cheating", label: "Cheating (using an engine or help)" },
  { id: "abuse", label: "Rude or abusive behaviour" },
  { id: "other", label: "Something else" },
] as const;

/** "Report" button + small form. Reports go to the reports table for Fahim to review. */
export function ReportButton({ userId, username, gameId }: { userId: string; username: string; gameId?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]["id"]>("cheating");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | string>("idle");

  const send = async () => {
    setState("sending");
    try {
      await sendReport({ reported: userId, reason, details, game_id: gameId });
      setState("sent");
    } catch (e) {
      setState((e as Error).message);
    }
  };

  return (
    <div className="relative">
      <Button variant="ghost" onClick={() => setOpen(!open)} aria-expanded={open} className="text-muted-foreground">
        <Flag className="size-4" /> Report
      </Button>
      {open && (
        <div className="absolute top-10 right-0 z-30 w-72 rounded-md bg-card p-4 shadow-[0_8px_24px_rgba(0,0,0,.5)]" role="dialog" aria-label={`Report ${username}`}>
          {state === "sent" ? (
            <p className="text-sm">Thanks, your report was sent. We&apos;ll review {username}&apos;s games and account.</p>
          ) : (
            <>
              <p className="mb-2 font-semibold">Report {username}</p>
              <fieldset className="mb-3 flex flex-col gap-1.5 text-sm">
                <legend className="sr-only">Reason</legend>
                {REASONS.map((r) => (
                  <label key={r.id} className="flex items-center gap-2">
                    <input type="radio" name="reason" checked={reason === r.id} onChange={() => setReason(r.id)} className="accent-[#81b64c]" />
                    {r.label}
                  </label>
                ))}
              </fieldset>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="What happened? (optional)"
                aria-label="Details"
                className="mb-3 w-full rounded-md bg-panel p-2 text-sm"
              />
              {state !== "idle" && state !== "sending" && <p className="mb-2 text-sm text-destructive">{state}</p>}
              <button className="btn-green w-full py-2! text-base!" disabled={state === "sending"} onClick={() => void send()}>
                {state === "sending" ? "Sending…" : "Send report"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
