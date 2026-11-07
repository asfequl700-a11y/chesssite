// Daily streak + puzzle count for the dashboard (signed-in users only).
import { dayKey } from "@/lib/streak";
import { currentProfile, updateProfile } from "@/lib/supabase";

export { lastWeek, streak } from "@/lib/streak";

/** Record today as active (once a day) and optionally count solved puzzles. */
export function markActive(puzzlesSolved = 0) {
  const p = currentProfile();
  if (!p) return;
  const today = dayKey();
  const patch: Parameters<typeof updateProfile>[0] = {};
  if (!p.active_days.includes(today)) patch.active_days = [...p.active_days, today].slice(-60);
  if (puzzlesSolved) patch.puzzles_solved = p.puzzles_solved + puzzlesSolved;
  if (Object.keys(patch).length) void updateProfile(patch);
}
