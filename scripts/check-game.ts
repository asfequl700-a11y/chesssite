// Self-check for lib/game.ts. Run: node scripts/check-game.ts
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { captured, clockText, ruleResult } from "../lib/game.ts";
import { LESSONS } from "../lib/lessons.ts";

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
console.log("game checks passed");
