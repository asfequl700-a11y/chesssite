// Course text (our own) + a check that every position and answer is legal, then writes the seed SQL.
// Run: node scripts/build-courses.ts  → supabase/migrations/20261107030100_seed_courses.sql
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { Chess } from "chess.js";

type Step = { fen: string; text: string; answers: string[] };
type Course = { slug: string; title: string; summary: string; chapters: { title: string; steps: Step[] }[] };

export const COURSES: Course[] = [
  {
    slug: "opening-principles",
    title: "Opening principles",
    summary: "Five habits for the first ten moves: take the centre, develop, castle, keep the queen home, punish mistakes.",
    chapters: [
      {
        title: "Take the centre",
        steps: [
          { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", text: "The four middle squares matter most. Push a centre pawn two squares to claim them.", answers: ["e4", "d4"] },
          { fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", text: "Black copied you. Now bring a knight out toward the centre.", answers: ["Nf3", "Nc3"] },
        ],
      },
      {
        title: "Develop your pieces",
        steps: [
          { fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", text: "Knights are out. Now put your light-squared bishop on an active square that eyes the centre or Black's king side.", answers: ["Bc4", "Bb5"] },
          { fen: "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", text: "You are Black. White attacks your d5 pawn. Support it with a pawn, or develop your king's knight.", answers: ["e6", "c6", "Nf6"] },
        ],
      },
      {
        title: "Castle early",
        steps: [
          { fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", text: "Your king is safest tucked in the corner, and castling also brings your rook into play. Castle kingside.", answers: ["O-O"] },
          { fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 b kq - 0 5", text: "Now you are Black. Your bishop and knight have left the back rank. Castle too.", answers: ["O-O"] },
        ],
      },
      {
        title: "Keep the queen home",
        steps: [
          { fen: "rnbqkbnr/pppp1ppp/8/4p3/4P2Q/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2", text: "White's queen came out early and attacks your e5 pawn. Defend it by developing a piece.", answers: ["Nc6"] },
          { fen: "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3", text: "Now queen and bishop both hit f7: that's a mate threat. Block it with a pawn move that also attacks the queen.", answers: ["g6"] },
        ],
      },
      {
        title: "Punish early queen moves",
        steps: [
          { fen: "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", text: "Black offers a pawn trade in the centre. Take it.", answers: ["exd5"] },
          { fen: "rnb1kbnr/ppp1pppp/8/3q4/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3", text: "Black's queen took back and sits in the middle. Develop a knight and attack it in one move.", answers: ["Nc3"] },
        ],
      },
    ],
  },
  {
    slug: "basic-tactics",
    title: "Basic tactics",
    summary: "The tricks that win most games: forks, pins, skewers, discovered attacks and the back-rank mate.",
    chapters: [
      {
        title: "Forks",
        steps: [
          { fen: "2r1k3/8/8/1N6/8/8/8/4K3 w - - 0 1", text: "A fork attacks two things at once. Find the knight jump that checks the king and hits the rook.", answers: ["Nd6+"] },
          { fen: "4k3/8/8/8/7b/8/8/1K1Q4 w - - 0 1", text: "Queens fork too. Give check and attack the bishop with the same move.", answers: ["Qa4+", "Qh5+"] },
        ],
      },
      {
        title: "Pins",
        steps: [
          { fen: "4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1", text: "A pin stops a piece from moving because something more valuable stands behind it. Pin the knight to the king.", answers: ["Bb5"] },
          { fen: "3k4/3n4/8/8/8/8/8/R3K3 w - - 0 1", text: "Rooks pin along files. Line your rook up with the knight and the king behind it.", answers: ["Rd1"] },
        ],
      },
      {
        title: "Skewers",
        steps: [
          { fen: "8/8/8/q1k5/8/1K6/8/7R w - - 0 1", text: "A skewer is a pin the other way round: attack the big piece, and when it moves, take what's behind it. Check the king along the rank.", answers: ["Rh5+"] },
        ],
      },
      {
        title: "Discovered attacks",
        steps: [
          { fen: "4k3/8/8/3q4/8/8/4N3/4R1K1 w - - 0 1", text: "Your knight blocks your rook. Move the knight to uncover a check from the rook, and attack the queen at the same time.", answers: ["Nc3", "Nf4"] },
        ],
      },
      {
        title: "The back-rank mate",
        steps: [
          { fen: "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", text: "Black's own pawns box the king in. Checkmate on the back rank.", answers: ["Rd8#"] },
          { fen: "6k1/R7/8/8/8/8/8/1R4K1 w - - 0 1", text: "Two rooks work like a ladder: one guards the 7th rank, the other gives mate on the 8th.", answers: ["Rb8#"] },
        ],
      },
    ],
  },
  {
    slug: "endgame-essentials",
    title: "Endgame essentials",
    summary: "Win the won positions: basic mates, promoting pawns, and dodging stalemate.",
    chapters: [
      {
        title: "Queen and king mate",
        steps: [{ fen: "7k/8/6K1/8/8/8/Q7/8 w - - 0 1", text: "Your king guards the escape squares. Deliver checkmate with the queen.", answers: ["Qa8#"] }],
      },
      {
        title: "Rook and king mate",
        steps: [{ fen: "6k1/8/6K1/8/8/8/8/R7 w - - 0 1", text: "Kings face each other. The rook gives the final check along the back rank.", answers: ["Ra8#"] }],
      },
      {
        title: "Checkmate, not stalemate",
        steps: [
          { fen: "k7/8/1K6/8/8/8/8/2Q5 w - - 0 1", text: "Mate in one. Careful: Qc7 looks strong but leaves Black no moves and no check. That's stalemate, a draw.", answers: ["Qc8#"] },
        ],
      },
      {
        title: "Promote your pawn",
        steps: [
          { fen: "8/6P1/8/8/8/k7/8/K7 w - - 0 1", text: "One step to go. Promote to a queen.", answers: ["g8=Q"] },
          { fen: "8/8/8/8/P7/8/7k/K7 w - - 0 1", text: "Black's king is too far away to catch your pawn. Push it.", answers: ["a5"] },
        ],
      },
      {
        title: "Two rooks mate",
        steps: [{ fen: "k7/7R/8/8/8/8/8/K5R1 w - - 0 1", text: "One rook already guards the 7th rank, so the king can't come up. Mate with the other rook on the 8th, far from the king.", answers: ["Rg8#"] }],
      },
    ],
  },
];

// Check: legal positions (the side not to move isn't in check), legal answers, "#" answers really mate.
for (const c of COURSES) {
  assert.ok(c.chapters.length >= 5 && c.chapters.length <= 8, `${c.slug}: 5 to 8 chapters`);
  for (const ch of c.chapters)
    for (const st of ch.steps) {
      const flipped = st.fen.replace(/ ([wb]) /, (_, s) => ` ${s === "w" ? "b" : "w"} `).replace(/ \S+ (\d+ \d+)$/, " - $1");
      assert.ok(!new Chess(flipped).inCheck(), `${c.slug}/${ch.title}: side not to move is in check`);
      for (const a of st.answers) {
        const g = new Chess(st.fen);
        assert.doesNotThrow(() => g.move(a), `${c.slug}/${ch.title}: ${a} is not legal`);
        if (a.endsWith("#")) assert.ok(g.isCheckmate(), `${c.slug}/${ch.title}: ${a} is not mate`);
      }
      // A "mate in one" step must accept every mating move, not just the one we thought of.
      if (st.answers.every((a) => a.endsWith("#"))) {
        const mates = new Chess(st.fen).moves().filter((m) => m.endsWith("#"));
        assert.deepEqual(mates.sort(), [...st.answers].sort(), `${c.slug}/${ch.title}: mating moves are ${mates.join(", ")}`);
      }
    }
}

const q = (s: string) => `'${s.replaceAll("'", "''")}'`;
const sql = [
  "-- Generated by scripts/build-courses.ts. Edit the script, not this file.",
  ...COURSES.flatMap((c, i) => [
    `insert into public.courses (slug, title, summary, position) values (${q(c.slug)}, ${q(c.title)}, ${q(c.summary)}, ${i}) on conflict (slug) do update set title = excluded.title, summary = excluded.summary, position = excluded.position;`,
    ...c.chapters.map(
      (ch, j) =>
        `insert into public.course_chapters (course_slug, position, title, steps) values (${q(c.slug)}, ${j}, ${q(ch.title)}, ${q(JSON.stringify(ch.steps))}::jsonb) on conflict (course_slug, position) do update set title = excluded.title, steps = excluded.steps;`,
    ),
  ]),
].join("\n");
if (process.argv[2] !== "--check") {
  writeFileSync(new URL("../supabase/migrations/20261107030100_seed_courses.sql", import.meta.url), sql + "\n");
  console.log("courses checked and seed written");
} else console.log("courses checked");

// The stalemate chapter's warning is true: Qc7 is stalemate.
{
  const g = new Chess("k7/8/1K6/8/8/8/8/2Q5 w - - 0 1");
  g.move("Qc7");
  assert.ok(g.isStalemate(), "Qc7 should be stalemate");
}
