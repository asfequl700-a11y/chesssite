# ChessSite

A free chess site: play the computer or a friend, puzzles, lessons, openings and **unlimited game review**.

- Next.js + TypeScript, Tailwind + shadcn/ui
- Board: react-chessboard, rules: chess.js
- Engine: Stockfish 19 (WASM, runs in the browser)
- Puzzles and opening names: Lichess open data

## Run it
```bash
npm install
npm run dev   # http://localhost:3000
```

## License
GPL-3.0, because the site ships Stockfish (GPL). See `LICENSE`.
