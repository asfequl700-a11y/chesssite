// Self-check for lib/game.ts. Run: node scripts/check-game.ts
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { captured, clockText, ruleResult } from "../lib/game.ts";
import { LESSONS } from "../lib/lessons.ts";
import { accuracySeries, tally, totals } from "../lib/stats.ts";
import { explainBad, explainGood } from "../lib/explain.ts";
import { BOTS, botMove, botNear, styleScore } from "../lib/bots.ts";
import { levelInfo, levelRating } from "../lib/level.ts";
import { difficultyFor, eloUpdate, rushDifficulty } from "../lib/puzzles.ts";
import { lastWeek, streak } from "../lib/streak.ts";
import { applyAction, timeLeft, type GameRow } from "../supabase/functions/_shared/online-rules.ts";

// White takes a pawn: 1. e4 d5 2. exd5
const g = new Chess();
for (const m of ["e4", "d5", "exd5"]) g.move(m);
assert.deepEqual(captured(g.fen(), "w"), { taken: ["p"], lead: 1 });
assert.deepEqual(captured(g.fen(), "b"), { taken: [], lead: 0 });

assert.equal(clockText(300000), "5:00");
assert.equal(clockText(42000), "0:42");
assert.equal(clockText(9400), "0:09.4");
assert.equal(clockText(-5), "0:00.0");
assert.equal(clockText(2 * 86400000 + 5 * 3600000), "2 days 5 h");
assert.equal(clockText(86400000), "1 day");
assert.equal(clockText(5 * 3600000 + 10 * 60000), "5 h 10 m");

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
// Puzzle rating: even match moves 16 points, upsets move more; difficulty follows your rating.
assert.equal(eloUpdate(1500, 1500, true), 1516);
assert.equal(eloUpdate(1500, 1500, false), 1484);
assert.ok(eloUpdate(1500, 1900, true) - 1500 > 16);
assert.equal(difficultyFor(1500), "normal");
assert.equal(difficultyFor(800), "easiest");
assert.equal(difficultyFor(1850), "harder");
assert.deepEqual([0, 5, 12, 40].map(rushDifficulty), ["easiest", "easier", "normal", "hardest"]);
// Streak: counts back from today, survives until the end of today if you were active yesterday, crosses months.
assert.equal(streak(["2026-11-05", "2026-11-06", "2026-11-07"], "2026-11-07"), 3);
assert.equal(streak(["2026-11-05", "2026-11-06"], "2026-11-07"), 2);
assert.equal(streak(["2026-11-04"], "2026-11-07"), 0);
assert.equal(streak(["2026-10-31", "2026-11-01"], "2026-11-01"), 2);
assert.deepEqual(lastWeek(["2026-11-07"], "2026-11-07").map((d) => d.active), [false, false, false, false, false, false, true]);
assert.equal(lastWeek([], "2026-11-07").at(-1)!.label, "S"); // 7 Nov 2026 is a Saturday
// Online rules (server side): turns, legality, clocks, time-outs, draws, abort.
const W = "white-user", Bk = "black-user", T0 = Date.parse("2026-11-07T10:00:00Z");
const orow = (o: Partial<GameRow> = {}): GameRow => ({ status: "active", white: W, black: Bk, time_ms: 60000, white_ms: 60000, black_ms: 60000, turn_started_at: null, moves: [], result: null, reason: "", draw_offer: null, ...o });
const ok = (o: ReturnType<typeof applyAction>) => { assert.ok("patch" in o, "error" in o ? o.error : ""); return (o as { patch: Partial<GameRow> }).patch; };
const err = (o: ReturnType<typeof applyAction>) => ("error" in o ? o.error : "no error");
assert.equal(err(applyAction(orow(), { type: "move", uci: "e7e5" }, Bk, T0)), "It's not your turn.");
assert.equal(err(applyAction(orow(), { type: "move", uci: "e2e5" }, W, T0)), "Illegal move.");
assert.equal(err(applyAction(orow(), { type: "move", uci: "e2e4" }, "stranger", T0)), "You are not playing in this game.");
const p1 = ok(applyAction(orow(), { type: "move", uci: "e2e4" }, W, T0));
assert.equal(p1.white_ms, 60000); // White's first move is free: the clock starts after it
const r2 = orow({ ...p1 } as Partial<GameRow>);
const p2 = ok(applyAction(r2, { type: "move", uci: "e7e5" }, Bk, T0 + 5000));
assert.equal(p2.black_ms, 55000); // Black thought for 5 seconds
assert.equal(timeLeft(orow({ ...r2 } as Partial<GameRow>), "b", T0 + 61000), -1000);
assert.equal(err(applyAction(r2, { type: "flag" }, W, T0 + 30000)), "No one has run out of time.");
assert.deepEqual([ok(applyAction(r2, { type: "flag" }, W, T0 + 61000)).result, ok(applyAction(r2, { type: "flag" }, W, T0 + 61000)).reason], ["w", "on time"]);
// Fool's mate ends the game by checkmate.
let fool = orow();
for (const [u, m] of [[W, "f2f3"], [Bk, "e7e5"], [W, "g2g4"], [Bk, "d8h4"]] as const) fool = orow({ ...fool, ...ok(applyAction(fool, { type: "move", uci: m }, u, T0)) } as Partial<GameRow>);
assert.deepEqual([fool.status, fool.result, fool.reason], ["over", "b", "by checkmate"]);
// Draws: offer, then the other side accepts; moving declines it.
const off = ok(applyAction(orow(), { type: "offer_draw" }, W, T0));
assert.equal(off.draw_offer, "w");
assert.equal(ok(applyAction(orow({ draw_offer: "w" }), { type: "accept_draw" }, Bk, T0)).reason, "by agreement");
assert.equal(err(applyAction(orow({ draw_offer: "w" }), { type: "accept_draw" }, W, T0)), "There is no draw offer to accept.");
// Abort only in the first two moves; resign any time.
assert.equal(ok(applyAction(orow({ moves: ["e2e4"] }), { type: "abort" }, Bk, T0)).reason, "aborted");
assert.equal(err(applyAction(orow({ moves: ["e2e4", "e7e5"] }), { type: "abort" }, W, T0)), "Too late to abort: resign instead.");
assert.equal(ok(applyAction(orow(), { type: "resign" }, W, T0)).result, "b");
assert.equal(err(applyAction(orow({ status: "over" }), { type: "move", uci: "e2e4" }, W, T0)), "This game is not being played.");
// Welcome-screen level: 1 → 400, 100 → 2000; labels by band; nearest bot.
assert.deepEqual([levelRating(1), levelRating(100), levelRating(50)], [400, 2000, 1192]);
assert.deepEqual([1, 15, 16, 60, 61, 100].map((l) => levelInfo(l).label), ["New to chess", "New to chess", "Beginner", "Intermediate", "Advanced", "Expert"]);
assert.deepEqual([botNear(400).id, botNear(1192).id, botNear(2000).id], ["rosa", "mei", "zara"]);
// Daily chess: 1 day per move, resets after each move; time-out after the deadline; move times recorded.
const daily = (o: Partial<GameRow> = {}) => orow({ time_ms: 0, daily_days: 1, turn_started_at: new Date(T0).toISOString(), ...o });
assert.equal(timeLeft(daily(), "w", T0 + 3600000), 86400000 - 3600000);
const d1 = ok(applyAction(daily(), { type: "move", uci: "e2e4" }, W, T0 + 3600000));
assert.deepEqual(d1.move_times, [3600000]);
assert.equal(timeLeft(daily({ ...d1 } as Partial<GameRow>), "b", T0 + 3600000), 86400000); // Black gets a full day
assert.equal(ok(applyAction(daily(), { type: "flag" }, Bk, T0 + 86400001)).reason, "on time");
assert.equal(err(applyAction(daily(), { type: "flag" }, Bk, T0 + 86399000)), "No one has run out of time.");
console.log("game checks passed");
