import { LiveGame } from "@/components/live-game";

export const metadata = { title: "Play vs Computer" };

export default function Page() {
  return <LiveGame mode="computer" />;
}
