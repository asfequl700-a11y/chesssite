"use client";

import { useEffect, useRef, useState } from "react";
import { Chessboard, defaultPieces } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { play } from "@/lib/sound";
import { GEO_PIECES } from "@/lib/geo-pieces";
import { PIECE_SETS, THEMES, useSettings, type Settings } from "@/lib/settings";

type Arrow = { startSquare: string; endSquare: string; color: string };
export type Promo = "q" | "r" | "b" | "n";

// Measured on chess.com (analysis.css): yellow #ffff33 at 50%, dots/rings rgba(0,0,0,.14).
const YELLOW = "rgba(255,255,51,.5)";
const MARK = "rgba(235,97,80,.8)"; // right-click square mark
const DOT = "radial-gradient(circle closest-side, rgba(0,0,0,.14) 33%, transparent 35%)";
const RING = "radial-gradient(circle closest-side, transparent 0 90%, rgba(0,0,0,.14) 90% 100%)";
const CHECK = "radial-gradient(circle closest-side, #fa412d 0%, rgba(250,65,45,.6) 60%, transparent 100%)";

/** The chosen piece set; `piece("wQ")` draws one piece. */
export function pieceSet(name: Settings["pieces"]) {
  const fills = PIECE_SETS[name];
  if (!fills) return defaultPieces;
  if (fills === "geo") return GEO_PIECES;
  return Object.fromEntries(
    Object.entries(defaultPieces).map(([k, draw]) => [k, (p?: Parameters<typeof draw>[0]) => draw({ ...p, fill: fills[k[0] as "w" | "b"] })]),
  ) as typeof defaultPieces;
}

/** Screen column/row (0-7, from top-left) of a square for the given orientation. */
function cell(sq: string, orientation: "white" | "black") {
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  return orientation === "white" ? { col: f, row: 7 - r } : { col: 7 - f, row: r };
}

/**
 * Board with drag and click-to-move. `game` decides what is legal; `onMove` plays it (return false to refuse).
 * Leave `onMove` out for a view-only board. With `game`, the last move is highlighted and plays a sound.
 * `side` = the colour the user moves; set it to allow premoves while the other side is to move.
 */
export function Board({
  game,
  fen,
  orientation = "white",
  onMove,
  side,
  highlight,
  arrows,
  badge,
  children,
}: {
  game?: Chess;
  fen: string;
  orientation?: "white" | "black";
  onMove?: (from: string, to: string, promotion?: Promo) => boolean;
  side?: "w" | "b";
  highlight?: Record<string, string>; // square -> colour
  arrows?: Arrow[];
  badge?: { square: string; color: string; sym: string };
  children?: React.ReactNode; // overlays, e.g. the game-over box
}) {
  const settings = useSettings();
  const theme = THEMES[settings.theme];
  const pieces = pieceSet(settings.pieces);
  const [selected, setSelected] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const [marks, setMarks] = useState<string[]>([]);
  const seen = useRef({ game, n: game?.history().length ?? 0 });

  const last = game?.history({ verbose: true }).at(-1);
  useEffect(() => {
    const n = game?.history().length ?? 0;
    // A new game object (next puzzle, new lesson step) arrives with moves already in it: no sound.
    const grew = game === seen.current.game && n > seen.current.n;
    seen.current = { game, n };
    setMarks([]);
    setPromo(null);
    if (!grew || !game || !last) return; // no sound on undo / new game
    if (game.isGameOver()) play("game-end");
    else if (game.inCheck()) play("check");
    else if (last.isKingsideCastle() || last.isQueensideCastle()) play("castle");
    else if (last.isPromotion()) play("promote");
    else play(last.isCapture() ? "capture" : "move");
  }, [fen]); // eslint-disable-line react-hooks/exhaustive-deps

  const pos = new Chess(fen);
  const mover = side ?? game?.turn();
  const targets = selected && game ? game.moves({ square: selected as Square, verbose: true }) : [];
  const styles: Record<string, React.CSSProperties> = {};
  const hl = highlight ?? (last ? { [last.from]: YELLOW, [last.to]: YELLOW } : {});
  for (const [sq, c] of Object.entries(hl)) styles[sq] = { backgroundColor: c };
  if (pos.inCheck()) {
    const king = pos.findPiece({ type: "k", color: pos.turn() })[0];
    if (king) styles[king] = { ...styles[king], backgroundImage: CHECK };
  }
  if (selected) styles[selected] = { ...styles[selected], backgroundColor: YELLOW };
  for (const m of targets) styles[m.to] = { ...styles[m.to], backgroundImage: m.isCapture() ? RING : DOT };
  for (const sq of marks) styles[sq] = { ...styles[sq], backgroundColor: MARK };

  const tryMove = (from: string, to: string) => {
    setSelected(null);
    setMarks([]);
    if (!onMove) return false;
    const legal = game?.moves({ square: from as Square, verbose: true }).find((m) => m.to === to);
    if (legal?.promotion) {
      setPromo({ from, to }); // ask which piece; the move is played from the picker
      return false;
    }
    return onMove(from, to);
  };

  const pick = (p: Promo) => {
    if (promo) onMove?.(promo.from, promo.to, p);
    setPromo(null);
  };

  // Promotion picker: a column over the target file, queen nearest the board edge (chess.com layout).
  let picker = null;
  if (promo) {
    const { col, row } = cell(promo.to, orientation);
    const top = row === 0;
    const color = pos.turn();
    picker = (
      <div className="absolute inset-0 z-20 bg-black/30" onClick={() => setPromo(null)}>
        <div
          className={`absolute flex w-[12.5%] overflow-hidden rounded-[3px] bg-white shadow-[3px_3px_10px_rgba(0,0,0,.65)] ${top ? "top-0 flex-col" : "bottom-0 flex-col-reverse"}`}
          style={{ left: `${col * 12.5}%` }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="Choose a piece to promote to"
        >
          {(["q", "n", "r", "b"] as const).map((p) => (
            <button key={p} className="aspect-square w-full hover:bg-black/10" onClick={() => pick(p)} aria-label={{ q: "Queen", n: "Knight", r: "Rook", b: "Bishop" }[p]}>
              {pieces[color + p.toUpperCase()]()}
            </button>
          ))}
          <button className="h-[1.6em] w-full bg-[#f1f1f1] text-[#8b8987] hover:text-black" onClick={() => setPromo(null)} aria-label="Cancel">
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ containerType: "inline-size" }}>
      <Chessboard
        options={{
          position: fen,
          pieces,
          boardOrientation: orientation,
          allowDragging: !!onMove,
          canDragPiece: ({ piece }) => piece.pieceType[0] === mover,
          arrows: arrows ?? [],
          squareStyles: styles,
          showNotation: settings.coords,
          darkSquareStyle: { backgroundColor: theme.dark },
          lightSquareStyle: { backgroundColor: theme.light },
          // chess.com: coordinates take the other square's colour, weight 600
          darkSquareNotationStyle: { color: theme.light, fontWeight: 600 },
          lightSquareNotationStyle: { color: theme.dark, fontWeight: 600 },
          onPieceDrop: ({ sourceSquare, targetSquare }) => !!targetSquare && tryMove(sourceSquare, targetSquare),
          onSquareRightClick: ({ square }) => setMarks((m) => (m.includes(square) ? m.filter((s) => s !== square) : [...m, square])),
          onSquareClick: ({ piece, square }) => {
            setMarks([]);
            if (!onMove || !game) return;
            const own = !!piece && piece.pieceType[0] === mover;
            const premove = mover !== game.turn();
            if (selected && (targets.some((m) => m.to === square) || (premove && !own))) return void tryMove(selected, square);
            setSelected(own && square !== selected ? square : null);
          },
        }}
      />
      {badge && (() => {
        const { col, row } = cell(badge.square, orientation);
        return (
          <div className="pointer-events-none absolute z-10 aspect-square w-[12.5%]" style={{ left: `${col * 12.5}%`, top: `${row * 12.5}%` }}>
            <span
              className="absolute -top-[14%] -right-[14%] grid aspect-square w-[46%] place-items-center rounded-full font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,.5)]"
              style={{ background: badge.color, fontSize: "2.2cqw" }}
            >
              {badge.sym}
            </span>
          </div>
        );
      })()}
      {picker}
      {children}
    </div>
  );
}
