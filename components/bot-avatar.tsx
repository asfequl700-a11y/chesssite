import type { Bot } from "@/lib/bots";

// Simple face drawn in SVG from each bot's colours (our own art, nothing copied).
const HAIR = [
  "M14 26c0-12 8-18 18-18s18 6 18 18c-4-6-10-9-18-9s-14 3-18 9z", // short
  "M12 30c0-14 8-22 20-22s20 8 20 22v14h-5V28c-4-5-9-7-15-7s-11 2-15 7v16h-5z", // long
  "M16 22c2-8 8-13 16-13s14 5 16 13c-5-3-10-4-16-4s-11 1-16 4z", // neat
  "M13 27c1-12 9-19 19-19 7 0 13 3 16 9-6 0-12 2-17 2s-12-1-18 8z", // side part
];

export function BotAvatar({ bot, size = 40 }: { bot: Bot; size?: number }) {
  const { bg, skin, hair, hairStyle, glasses } = bot.look;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label={`${bot.name} avatar`} className="shrink-0 rounded-[3px]">
      <rect width="64" height="64" fill={bg} />
      <path d="M10 64c2-12 10-18 22-18s20 6 22 18z" fill="#ffffff" opacity=".85" />
      <circle cx="32" cy="30" r="16" fill={skin} />
      <path d={HAIR[hairStyle]} fill={hair} />
      <circle cx="26" cy="31" r="2" fill="#222" />
      <circle cx="38" cy="31" r="2" fill="#222" />
      <path d="M26 38q6 5 12 0" stroke="#222" strokeWidth="2" fill="none" strokeLinecap="round" />
      {glasses && (
        <g stroke="#222" strokeWidth="1.6" fill="none">
          <circle cx="26" cy="31" r="5" />
          <circle cx="38" cy="31" r="5" />
          <path d="M31 31h2" />
        </g>
      )}
    </svg>
  );
}
