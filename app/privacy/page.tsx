import { PlainPage } from "@/components/game-screen";

export const metadata = { title: "Privacy" };

// Draft only: needs real legal text before launch (PLAN.md).
export default function Page() {
  return (
    <PlainPage title="Privacy">
      <div className="space-y-4 text-muted-foreground">
        <p className="text-sm">Draft. Final legal text comes before launch.</p>
        <p>No account is needed. Games run in your browser. Lesson progress is saved in your browser only.</p>
        <p>Puzzles are loaded from lichess.org. Ads are images we host ourselves; we do not use ad networks or tracking cookies.</p>
      </div>
    </PlainPage>
  );
}
