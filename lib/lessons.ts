// shortcut: lessons live in code until Supabase is set up; then move this list to a "lessons" table.
// Each step: a position, what to do, and the move(s) that count as correct (SAN, e.g. "Nf5").

export type Step = { fen: string; text: string; answers: string[] };
export type Lesson = { slug: string; title: string; summary: string; steps: Step[] };

export const LESSONS: Lesson[] = [
  {
    slug: "how-the-pieces-move",
    title: "How the pieces move",
    summary: "Rook, bishop, queen and knight.",
    steps: [
      { fen: "7k/8/8/8/3R4/8/8/K7 w - - 0 1", text: "The rook moves in straight lines, any distance. Move it to d8 and give check.", answers: ["Rd8+"] },
      { fen: "8/7k/8/8/3B4/8/8/K7 w - - 0 1", text: "The bishop moves diagonally. Move it to a7.", answers: ["Ba7"] },
      { fen: "7k/8/8/8/8/8/3Q4/K7 w - - 0 1", text: "The queen moves like a rook and a bishop together. Give check along the long diagonal (a1 to h8).", answers: ["Qb2+", "Qc3+", "Qd4+"] },
      { fen: "7k/8/8/8/3N4/8/8/K7 w - - 0 1", text: "The knight moves in an L: two squares one way, then one to the side. It can jump over pieces. Move it to f5.", answers: ["Nf5"] },
    ],
  },
  {
    slug: "capturing",
    title: "Capturing",
    summary: "Take your opponent's pieces.",
    steps: [
      { fen: "7k/8/8/2r5/8/8/8/K1R5 w - - 0 1", text: "Pieces capture by moving onto the enemy piece. Take the black rook.", answers: ["Rxc5"] },
      { fen: "7k/8/8/3p4/4P3/8/8/K7 w - - 0 1", text: "Pawns move straight but capture diagonally. Take the pawn on d5.", answers: ["exd5"] },
      { fen: "7k/8/8/5q2/8/4N3/8/K7 w - - 0 1", text: "Knights capture where they land. Win the queen!", answers: ["Nxf5"] },
    ],
  },
  {
    slug: "check-and-checkmate",
    title: "Check and checkmate",
    summary: "Attack the king until it has no escape.",
    steps: [
      { fen: "6k1/5ppp/8/8/8/8/8/K3R3 w - - 0 1", text: "Black's pawns trap their own king. Deliver checkmate on the back rank.", answers: ["Re8#"] },
      { fen: "7k/8/6K1/8/8/8/8/5Q2 w - - 0 1", text: "Your king protects your queen. Checkmate in one move.", answers: ["Qf8#"] },
      { fen: "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4", text: "The famous Scholar's Mate. f7 is only defended by the king. Checkmate!", answers: ["Qxf7#"] },
    ],
  },
  {
    slug: "castling",
    title: "Castling",
    summary: "Keep your king safe and wake up your rook.",
    steps: [
      { fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", text: "Castling moves the king two squares toward a rook, and the rook jumps over. Castle kingside: move your king to g1.", answers: ["O-O"] },
      { fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", text: "Now castle queenside: move your king to c1.", answers: ["O-O-O"] },
    ],
  },
  {
    slug: "forks",
    title: "Forks",
    summary: "Attack two things at once.",
    steps: [
      { fen: "r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1", text: "A fork attacks two pieces with one move. Find the knight move that checks the king and attacks the rook.", answers: ["Nc7+"] },
      { fen: "1b4k1/8/8/8/8/8/8/3QK3 w - - 0 1", text: "Queens can fork too. Check the king and attack the bishop at the same time.", answers: ["Qb3+"] },
    ],
  },
  {
    slug: "basic-endgames",
    title: "Basic endgames",
    summary: "Turn an extra queen or rook into a win.",
    steps: [
      { fen: "k7/8/1K6/8/8/8/8/7R w - - 0 1", text: "King and rook: your king takes away squares, the rook gives the final check. Checkmate!", answers: ["Rh8#"] },
      { fen: "k7/2Q5/1K6/8/8/8/8/8 w - - 0 1", text: "King and queen. Careful: if the king can't move but isn't in check, it's stalemate (a draw). Checkmate in one.", answers: ["Qb7#", "Qc8#", "Qa7#"] },
    ],
  },
];
