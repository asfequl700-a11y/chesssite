import { PlainPage } from "@/components/game-screen";

export const metadata = { title: "Advertise with us" };

const slots = [
  { name: "Sidebar", size: "300×635", where: "Right column on every game screen" },
  { name: "Under board", size: "728×90", where: "Below the board on every game screen" },
  { name: "Review loading", size: "300×250", where: "Shown while a game review runs (20 to 60 s)" },
];

export default function Page() {
  return (
    <PlainPage title="Advertise with us">
      <p className="mb-8 text-lg text-muted-foreground">
        The site is free because advertisers book ad slots directly with us. No ad networks, no tracking. Your ad
        shows only on game screens, never on the home page.
      </p>
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {slots.map((s) => (
          <div key={s.name} className="rounded-lg bg-card p-5">
            <h2 className="text-2xl">{s.name}</h2>
            <p className="mb-2 font-mono text-primary">{s.size}</p>
            <p className="text-sm text-muted-foreground">{s.where}</p>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground">
        Prices and booking form are coming soon. Until then, get in touch through the About page.
      </p>
    </PlainPage>
  );
}
