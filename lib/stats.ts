// Numbers for the /stats page, worked out from the user's saved games.
type G = { result: "win" | "loss" | "draw"; accuracy: number | null; played_at: string; my_color: "w" | "b"; bot: string | null; mode: string; opening: string | null };

export type Tally = { key: string; win: number; draw: number; loss: number; total: number };

/** Win/draw/loss counts per group, biggest group first. Groups past `top` fold into "Other". */
export function tally<T extends G>(games: T[], keyOf: (g: T) => string | null, top = 8): Tally[] {
  const map = new Map<string, Tally>();
  for (const g of games) {
    const key = keyOf(g);
    if (key === null) continue;
    const t = map.get(key) ?? { key, win: 0, draw: 0, loss: 0, total: 0 };
    t[g.result]++;
    t.total++;
    map.set(key, t);
  }
  const rows = [...map.values()].sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
  if (rows.length <= top) return rows;
  const other = rows.slice(top).reduce((o, t) => ({ ...o, win: o.win + t.win, draw: o.draw + t.draw, loss: o.loss + t.loss, total: o.total + t.total }), {
    key: "Other",
    win: 0,
    draw: 0,
    loss: 0,
    total: 0,
  });
  return [...rows.slice(0, top), other];
}

/** Accuracy per game, oldest first (games still being analysed are left out). */
export function accuracySeries<T extends G>(games: T[]) {
  return games
    .filter((g) => g.accuracy !== null)
    .map((g) => ({ date: g.played_at, accuracy: g.accuracy as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function totals<T extends G>(games: T[]) {
  const t = tally(games, () => "all")[0] ?? { win: 0, draw: 0, loss: 0, total: 0 };
  const acc = accuracySeries(games);
  return { ...t, accuracy: acc.length ? acc.reduce((s, a) => s + a.accuracy, 0) / acc.length : null };
}
