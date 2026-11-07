import Link from "next/link";
import { cn } from "@/lib/utils";
import ads from "@/public/ads.json";

const sizes = {
  sidebar: { w: 300, h: 635 },
  "under-board": { w: 728, h: 90 },
  "review-loading": { w: 300, h: 250 },
};

// shortcut: booked ads live in public/ads.json (put the image in public/ads/, fill image + link, redeploy).
// Move to Supabase (with start/end dates) when there are more advertisers than you can swap by hand.
export function AdSlot({ slot, className }: { slot: keyof typeof sizes; className?: string }) {
  const { w, h } = sizes[slot];
  const ad = (ads as Record<string, { image: string; link: string; text: string }>)[slot];
  const box = { maxWidth: w, aspectRatio: `${w} / ${h}` };
  if (ad?.image)
    return (
      <a href={ad.link} target="_blank" rel="noopener sponsored" aria-label={ad.text || "Advertisement"} style={box} className={cn("block w-full overflow-hidden rounded-md", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- advertiser images can be any size/host */}
        <img src={ad.image} alt={ad.text || "Advertisement"} className="size-full object-cover" />
      </a>
    );
  return (
    <aside
      aria-label="Advertisement"
      style={box}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-panel text-center text-xs text-muted-foreground",
        className,
      )}
    >
      <span>
        Ad slot {w}×{h}
      </span>
      <Link href="/advertise" className="text-primary hover:underline">
        Advertise here
      </Link>
    </aside>
  );
}
