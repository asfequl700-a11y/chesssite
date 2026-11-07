// Our own move sounds, generated in the browser (no audio files, nothing copied).
import { getSettings } from "./settings";

export type Sound = "move" | "capture" | "check" | "castle" | "promote" | "game-end";

const TONES: Record<Sound, [freq: number, ms: number][]> = {
  move: [[520, 60]],
  capture: [[300, 90]],
  check: [[880, 70], [660, 90]],
  castle: [[520, 50], [440, 60]],
  promote: [[660, 60], [880, 80]],
  "game-end": [[440, 120], [330, 200]],
};

let ctx: AudioContext | null = null;

export function play(sound: Sound) {
  if (typeof window === "undefined" || !getSettings().sound) return;
  ctx ??= new AudioContext();
  let t = ctx.currentTime;
  for (const [freq, ms] of TONES[sound]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + ms / 1000);
    t += ms / 1000;
  }
}
