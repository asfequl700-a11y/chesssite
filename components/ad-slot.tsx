"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { runningAds, type Ad } from "@/lib/ads";

const sizes = {
  sidebar: { w: 300, h: 635 },
  "under-board": { w: 728, h: 90 },
  "review-loading": { w: 300, h: 250 },
};

// Booked ads live in the Supabase "ads" table (slot, image, link, start/end dates). Empty slot = "Advertise here".
export function AdSlot({ slot, className }: { slot: keyof typeof sizes; className?: string }) {
  const { w, h } = sizes[slot];
  const [ad, setAd] = useState<Ad | null>(null);
  useEffect(() => {
    runningAds().then((all) => {
      const mine = all.filter((a) => a.slot === slot);
      setAd(mine[Math.floor(Math.random() * mine.length)] ?? null); // several bookings share a slot by rotation
    });
  }, [slot]);
  const box = { maxWidth: w, aspectRatio: `${w} / ${h}` };
  if (ad)
    return (
      <a href={ad.link_url} target="_blank" rel="noopener sponsored" aria-label={ad.alt_text || "Advertisement"} style={box} className={cn("block w-full overflow-hidden rounded-md", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- advertiser images can be any size/host */}
        <img src={ad.image_url} alt={ad.alt_text || "Advertisement"} className="size-full object-cover" />
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
