import { PlainPage } from "@/components/game-screen";

export const metadata = { title: "Terms" };

// Draft only: needs real legal text before launch (PLAN.md).
export default function Page() {
  return (
    <PlainPage title="Terms">
      <div className="space-y-4 text-muted-foreground">
        <p className="text-sm">Draft. Final legal text comes before launch.</p>
        <p>The site is free and provided as is. Engine scores and move labels are a guide, not a guarantee.</p>
      </div>
    </PlainPage>
  );
}
