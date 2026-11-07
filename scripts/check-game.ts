// Self-check for lib/game.ts. Run: node scripts/check-game.ts
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { captured, clockText, ruleResult } from "../lib/game.ts";
import { LESSONS } from "../lib/lessons.ts";
import { accuracySeries, tally, totals } from "../lib/stats.ts";
import { explainBad, explainGood } from "../lib/explain.ts";
import { BOTS, botMove, styleScore } from "../lib/bots.ts";

// White takes a pawn: 1. e4 d5 2. exd5
const g = new Chess();
for (const m of ["e4", "d5", "exd5"]) g.move(m);
assert.deepEqual(captured(g.fen(), "w"), { taken: ["p"], lead: 1 });
assert.deepEqual(captured(g.fen(), "b"), { taken: [], lead: 0 });

assert.equal(clockText(300000), "5:00");
assert.equal(clockText(42000), "0:42");
assert.equal(clockText(9400), "0:09.4");
assert.equal(clockText(-5), "0:00.0");

const mate = new Chess();
for (const m of ["f3", "e5", "g4", "Qh4#"]) mate.move(m);
assert.deepEqual(ruleResult(mate), { winner: "b", reason: "by checkmate" });
assert.equal(ruleResult(new Chess()), null);

// Promotion: a white pawn on a7 can become a knight
const p = new Chess("8/P6k/8/8/8/8/8/K7 w - - 0 1");
assert.equal(p.move({ from: "a7", to: "a8", promotion: "n" }).san, "a8=N");
// Every lesson position is legal (the side not to move is not in check) and every answer is a legal move.
for (const l of LESSONS)
  for (const st of l.steps) {
    const flipped = st.fen.replace(/ ([wb]) /, (_, c) => ` ${c === "w" ? "b" : "w"} `).replace(/ \S+ (\d+ \d+)$/, " - $1");
    assert.ok(!new Chess(flipped).inCheck(), `${l.slug}: side not to move is in check in ${st.fen}`);
    for (const a of st.answers) assert.doesNotThrow(() => new Chess(st.fen).move(a), `${l.slug}: ${a} is not legal in ${st.fen}`);
  }
// Stats: tallies per group, "Other" folding, accuracy order.
const row = (result: "win" | "loss" | "draw", bot: string, accuracy: number | null, played_at: string) =>
  ({ result, bot, accuracy, played_at, my_color: "w" as const, mode: "computer", opening: null });
const games = [row("win", "Ana", 80, "2026-01-02"), row("loss", "Ana", null, "2026-01-01"), row("draw", "Bo", 60, "2026-01-01")];
assert.deepEqual(tally(games, (g) => g.bot)[0], { key: "Ana", win: 1, draw: 0, loss: 1, total: 2 });
assert.equal(tally(games, (g) => g.bot, 1).at(-1)!.key, "Other");
assert.deepEqual(accuracySeries(games).map((p) => p.accuracy), [60, 80]);
assert.equal(totals(games).accuracy, 70);
// Move explanations: one position per rule, with the sentence the coach should say.
const play = (start: string, ...sans: string[]) => {
  const g = start.includes("/") ? new Chess(start) : new Chess();
  if (!start.includes("/") && start) g.move(start);
  let m = null;
  for (const s of sans) m = g.move(s);
  return { m: m!, after: g };
};
const bad = (x: ReturnType<typeof play>, best = "") => explainBad(x.m, x.after, best)?.text;
const good = (x: ReturnType<typeof play>) => explainGood(x.m, x.after);
assert.equal(bad(play("f3", "e5", "g4")), "This lets Black checkmate with Qh4#.");
assert.equal(bad(play("r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4", "Qxe5+"), "Qxf7#"), "You had checkmate with Qxf7#!");
assert.equal(bad(play("e4", "e5", "Ba6")), "Your bishop on a6 can now be taken for free.");
assert.equal(bad(play("rnbqkb1r/pppp1ppp/8/4n3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1", "h3"), "Nxe5"), "Nxe5 wins the knight on e5 for free.");
assert.equal(good(play("r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1", "Nc7+")), "Nc7+ forks the king and the rook.");
assert.equal(bad(play("r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1", "Kd2"), "Nc7+"), "Nc7+ would fork the king and the rook.");
assert.equal(good(play("3k4/3n4/8/8/8/8/8/R3K3 w - - 0 1", "Rd1")), "Rd1 pins the knight to the king.");
assert.equal(good(play("8/8/8/q1k5/8/1K6/8/7R w - - 0 1", "Rh5+")), "Rh5+ skewers the king and the queen.");
assert.equal(bad(play("8/8/8/q1k5/8/1K6/8/7R w - - 0 1", "Rh2"), "Rh5+"), "Rh5+ would skewer the king and the queen.");
assert.equal(bad(play("e4", "e5", "Ke2"), "Nf3"), "Moving your king gives up castling, so your king may get stuck in the middle.");
assert.equal(bad(play("rnb1kbnr/ppp2ppp/3p4/4q3/8/8/PPPPQPPP/RNB1KBN1 w Qkq - 0 1", "Qxe5+")), "You're behind in material, so trading pieces makes it harder to come back.");
assert.equal(good(play("rnb1kbn1/ppp2ppp/3p4/4q3/8/8/PPPPQPPP/RNB1KBNR w KQq - 0 1", "Qxe5+")), "Trading pieces when you're ahead is smart: fewer pieces make the win easier.");
// Bots: 10 characters, styles rank moves as intended, a "slip" plays a legal random move.
assert.equal(BOTS.length, 10);
assert.equal(new Set(BOTS.map((b) => b.id)).size, 10);
const tactical = "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
assert.ok(styleScore("aggressive", tactical, "h5f7") > styleScore("aggressive", tactical, "d2d3"));
assert.ok(styleScore("defensive", tactical, "d2d3") > styleScore("defensive", tactical, "h5f7"));
const slip = await botMove(null as never, { ...BOTS[0], slip: 1 }, new Chess().fen(), () => 0);
assert.doesNotThrow(() => new Chess().move({ from: slip.slice(0, 2), to: slip.slice(2, 4) }));
console.log("game checks passed");
