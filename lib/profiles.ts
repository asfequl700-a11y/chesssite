"use client";

import { refreshProfile, supabase } from "@/lib/supabase";

export type PublicProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string;
  joined: string;
  level: number | null;
  puzzle_rating: number;
  puzzles_solved: number;
  bots_beaten: number;
  rush_best: number;
  online: { games: number; won: number; lost: number; drawn: number };
  recent: { opponent: string; result: "win" | "loss" | "draw"; reason: string; time_control: string; played_at: string }[];
  friend: "friend" | "incoming" | "outgoing" | null;
  request_id: number | null;
};

/** Anyone's public profile by username (null if there's no such player). */
export async function getProfile(name: string) {
  const { data, error } = await supabase.rpc("public_profile", { name });
  if (error) throw new Error(error.message);
  return data as PublicProfile | null;
}

/** Shrink a photo to a 256px square WebP in the browser (small uploads, same look everywhere). */
async function toSquareWebp(file: File) {
  const img = await createImageBitmap(file);
  const side = Math.min(img.width, img.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  canvas.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
  return new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("Could not read that image."))), "image/webp", 0.85));
}

/** Upload a new profile photo to Storage (your own folder only) and save its address on your profile. */
export async function uploadAvatar(userId: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Pick an image file.");
  if (file.size > 10_000_000) throw new Error("That image is too big (10 MB max).");
  const blob = await toSquareWebp(file);
  // shortcut: old photos stay in the bucket (tiny files); clean them up if storage ever matters.
  const path = `${userId}/avatar-${Date.now()}.webp`;
  const { error } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/webp" });
  if (error) throw new Error(error.message);
  const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  const { error: e2 } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
  if (e2) throw new Error(e2.message);
  await refreshProfile();
  return url;
}

export async function saveBio(userId: string, bio: string) {
  const { error } = await supabase.from("profiles").update({ bio: bio.slice(0, 160) }).eq("id", userId);
  if (error) throw new Error(error.message);
  await refreshProfile();
}

export async function sendReport(r: { reported: string; reason: "cheating" | "abuse" | "other"; details: string; game_id?: string }) {
  const { error } = await supabase.from("reports").insert({ ...r, details: r.details.slice(0, 500) });
  if (error) throw new Error(error.message);
}
