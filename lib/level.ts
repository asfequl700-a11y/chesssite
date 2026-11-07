// Self-rated level 1-100 from the welcome screen → a label and a rough rating (first bot: botNear in lib/bots.ts).
const BANDS = [
  { upTo: 15, label: "New to chess", blurb: "Learning how the pieces move." },
  { upTo: 35, label: "Beginner", blurb: "You know the rules and play now and then." },
  { upTo: 60, label: "Intermediate", blurb: "You know some openings and tactics." },
  { upTo: 85, label: "Advanced", blurb: "You play often and win most casual games." },
  { upTo: 100, label: "Expert", blurb: "Club or tournament player." },
];

/** Rough rating for a level: 400 at 1, 2000 at 100 (same formula as the database's finish_onboarding). */
export const levelRating = (level: number) => 400 + Math.round(((level - 1) * 1600) / 99);

export function levelInfo(level: number) {
  const band = BANDS.find((b) => level <= b.upTo) ?? BANDS.at(-1)!;
  return { ...band, rating: levelRating(level) };
}
