import { AdSlot } from "@/components/ad-slot";
import { SettingsMenu } from "@/components/settings-menu";

// Shared layout for every game screen (play, puzzles, review, learn, lessons, openings):
// board | 448px panel | 300px ad column. Columns stack on smaller screens.
export function GameScreen({ title, board, children }: { title: string; board?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-[1600px] gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_448px] 3xl:grid-cols-[minmax(0,1fr)_448px_300px]">
      <div className="flex flex-col items-center gap-4 lg:col-start-1 lg:row-start-1 lg:row-span-2 3xl:row-span-1">
        {/* Height-capped so board + ad fit on screen. */}
        <div className="w-full max-w-[min(100%,calc(100dvh-170px))]">
          {board ?? (
            <div
              role="img"
              aria-label="Chess board"
              className="aspect-square w-full rounded-sm"
              style={{ background: "repeating-conic-gradient(var(--color-square-dark) 0 25%, var(--color-square-light) 0 50%) 0 0 / 25% 25%" }}
            />
          )}
        </div>
        <AdSlot slot="under-board" />
      </div>

      <section className="min-h-64 rounded-md bg-panel p-5 lg:col-start-2 lg:row-start-1">
        <div className="mb-3 flex items-start justify-between gap-2">
          <h1 className="text-3xl">{title}</h1>
          <SettingsMenu />
        </div>
        {children ?? <p className="text-muted-foreground">Coming soon.</p>}
      </section>

      <div className="flex items-start justify-center lg:col-start-2 lg:row-start-2 3xl:col-start-3 3xl:row-start-1">
        <AdSlot slot="sidebar" />
      </div>
    </div>
  );
}

// Plain page for screens without ads (Home, Advertise, About, Privacy, Terms, 404).
export function PlainPage({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-4 text-5xl">{title}</h1>
      {children ?? <p className="text-muted-foreground">Coming soon.</p>}
    </div>
  );
}
