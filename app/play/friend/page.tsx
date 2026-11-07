import { LiveGame } from "@/components/live-game";

export const metadata = { title: "Play vs Friend" };

export default function Page() {
  return <LiveGame mode="friend" />;
}
