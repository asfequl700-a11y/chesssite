// "Geo": our own flat, geometric piece set (drawn here in SVG, nothing copied). Same shape as react-chessboard's pieces.
import type { PieceRenderObject } from "react-chessboard";

const COLORS = { w: { fill: "#f7f5ef", stroke: "#2b2a28" }, b: { fill: "#34322f", stroke: "#0f0f0e" } };

const SHAPES: Record<string, React.ReactNode> = {
  p: (
    <>
      <circle cx="22.5" cy="14.5" r="5" />
      <path d="M17 34 L28 34 L25.5 21.5 H19.5 Z" />
      <rect x="12.5" y="34" width="20" height="4.5" rx="1.5" />
    </>
  ),
  r: (
    <>
      <path d="M12 10 h4.5 v3.5 h2.5 v-3.5 h7 v3.5 h2.5 v-3.5 h4.5 v8 H12 Z" />
      <rect x="14.5" y="18" width="16" height="16" />
      <rect x="11" y="34" width="23" height="4.5" rx="1.5" />
    </>
  ),
  n: (
    <>
      <path d="M14 34 H31 L30.5 23 C30.5 15 26 10.5 19 10 L17.5 13 L13 17.5 L11.5 22.5 L15.5 24 L19 21 L17.5 27 Z" />
      <circle cx="19.5" cy="15.5" r="1.4" style={{ fill: "currentColor" }} />
      <rect x="11.5" y="34" width="22" height="4.5" rx="1.5" />
    </>
  ),
  b: (
    <>
      <circle cx="22.5" cy="9.5" r="2.6" />
      <path d="M22.5 12.5 C16 17.5 16 25 18 28.5 H27 C29 25 29 17.5 22.5 12.5 Z" />
      <path d="M24.8 16.5 L21 21.5" style={{ fill: "none" }} />
      <rect x="18.5" y="28.5" width="8" height="5" />
      <rect x="13" y="33.5" width="19" height="5" rx="1.5" />
    </>
  ),
  q: (
    <>
      <path d="M11 30.5 L13 15 L18 24 L22.5 12 L27 24 L32 15 L34 30.5 Z" />
      <circle cx="13" cy="13.2" r="2.2" />
      <circle cx="22.5" cy="10" r="2.2" />
      <circle cx="32" cy="13.2" r="2.2" />
      <rect x="10.5" y="30.5" width="24" height="5.5" rx="1.5" />
    </>
  ),
  k: (
    <>
      <rect x="21" y="5.5" width="3" height="9.5" />
      <rect x="18" y="8" width="9" height="3" />
      <path d="M14.5 32.5 H30.5 L29 18.5 Q22.5 14.5 16 18.5 Z" />
      <rect x="11.5" y="32.5" width="22" height="5.5" rx="1.5" />
    </>
  ),
};

export const GEO_PIECES: PieceRenderObject = Object.fromEntries(
  (["w", "b"] as const).flatMap((c) =>
    Object.entries(SHAPES).map(([t, shape]) => [
      c + t.toUpperCase(),
      (props?: { svgStyle?: React.CSSProperties }) => (
        <svg viewBox="0 0 45 45" width="100%" height="100%" style={{ ...props?.svgStyle, color: COLORS[c].stroke }}>
          <g fill={COLORS[c].fill} stroke={COLORS[c].stroke} strokeWidth="1.6" strokeLinejoin="round">
            {shape}
          </g>
        </svg>
      ),
    ]),
  ),
);
