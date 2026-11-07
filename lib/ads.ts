import { createClient } from "@supabase/supabase-js";

export type Ad = { slot: string; image_url: string; link_url: string; alt_text: string };

let running: Promise<Ad[]> | null = null;

/** Ads running today (the database only returns rows whose dates include today). One request per page load. */
export function runningAds() {
  running ??= (async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return [];
    const { data, error } = await createClient(url, key).from("ads").select("slot, image_url, link_url, alt_text");
    if (error) console.warn("Ads could not load:", error.message);
    return data ?? [];
  })();
  return running;
}
