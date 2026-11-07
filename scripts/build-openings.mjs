// Builds public/openings.json from the Lichess opening list (CC0): https://github.com/lichess-org/chess-openings
// Usage: node scripts/build-openings.mjs <folder with a.tsv..e.tsv>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Chess } from "chess.js";

const dir = process.argv[2];
const rows = [];
for (const f of ["a", "b", "c", "d", "e"]) {
  for (const line of readFileSync(join(dir, `${f}.tsv`), "utf8").trim().split("\n").slice(1)) {
    const [eco, name, pgn] = line.trim().split("\t");
    const g = new Chess();
    g.loadPgn(pgn);
    // Board + side to move identifies the position (used for "Book" moves in review).
    rows.push([eco, name, g.history().join(" "), g.fen().split(" ").slice(0, 2).join(" ")]);
  }
}
writeFileSync("public/openings.json", JSON.stringify(rows));
console.log(`${rows.length} openings written`);
