// Stockfish runs in a Web Worker (background thread) in the player's browser, so the page doesn't freeze
// and there is no server cost. Commands go one at a time through a queue.

export type Line = { cp: number; best: string }; // cp = centipawns from White's view (100 = one pawn)
export type Eval = { lines: Line[] }; // lines[0] = engine's best line, lines[1] = second best (if asked)

const MATE = 10000;

export class Engine {
  private w: Worker;
  private queue: Promise<unknown> = Promise.resolve();

  constructor() {
    this.w = new Worker("/stockfish-19-lite-single.js");
    this.w.postMessage("uci");
  }

  private run<T>(cmds: string[], onLine: (line: string) => T | undefined): Promise<T> {
    const job = this.queue.then(
      () =>
        new Promise<T>((resolve) => {
          this.w.onmessage = (e: MessageEvent<string>) => {
            const out = onLine(e.data);
            if (out !== undefined) resolve(out);
          };
          cmds.forEach((c) => this.w.postMessage(c));
        }),
    );
    this.queue = job.catch(() => {});
    return job;
  }

  /** Best move in UCI form (e.g. "e2e4"). skill 0-20 = Stockfish "Skill Level". */
  bestMove(fen: string, skill: number, movetime: number): Promise<string> {
    return this.run(
      [`setoption name MultiPV value 1`, `setoption name Skill Level value ${skill}`, `position fen ${fen}`, `go movetime ${movetime}`],
      (l) => /^bestmove (\S+)/.exec(l)?.[1],
    );
  }

  /** Score the position. multipv 2 also returns the second-best move (used to spot "Great" moves). */
  evaluate(fen: string, depth: number, multipv = 1): Promise<Eval> {
    const white = fen.split(" ")[1] === "w";
    const lines: Line[] = [];
    return this.run(
      [`setoption name Skill Level value 20`, `setoption name MultiPV value ${multipv}`, `position fen ${fen}`, `go depth ${depth}`],
      (l) => {
        const m = /multipv (\d+) score (cp|mate) (-?\d+).* pv (\S+)/.exec(l);
        if (m) {
          const n = Number(m[3]);
          // Engine scores are from the side to move; flip to White's view. Mate in N becomes a huge score.
          const cp = m[2] === "mate" ? Math.sign(n || -1) * (MATE - Math.abs(n)) : n;
          lines[Number(m[1]) - 1] = { cp: white ? cp : -cp, best: m[4] };
        }
        if (l.startsWith("bestmove")) {
          // No legal moves (mate/stalemate): the caller scores these with chess.js.
          if (!lines.length) lines.push({ cp: 0, best: "" });
          return { lines };
        }
      },
    );
  }

  quit() {
    this.w.terminate();
  }
}
