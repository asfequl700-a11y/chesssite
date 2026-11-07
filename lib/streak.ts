// Streak maths on "YYYY-MM-DD" day lists (pure, tested in scripts/check-game.ts).
/** Local date as YYYY-MM-DD (the streak follows the player's own calendar day). */
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + n));
};

/** Days in a row with activity, ending today (or yesterday, so the streak survives until you play today). */
export function streak(days: string[], today = dayKey()) {
  const set = new Set(days);
  let day = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** The last 7 days, oldest first, with whether you were active. */
export function lastWeek(days: string[], today = dayKey()) {
  const set = new Set(days);
  return Array.from({ length: 7 }, (_, i) => {
    const key = addDays(today, i - 6);
    const [y, m, d] = key.split("-").map(Number);
    return { key, label: "SMTWTFS"[new Date(y, m - 1, d).getDay()], active: set.has(key) };
  });
}
