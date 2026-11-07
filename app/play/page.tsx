import Link from "next/link";
import { Bot, Search, Timer, Users } from "lucide-react";
import { GameScreen } from "@/components/game-screen";

export const metadata = { title: "Play" };

const options = [
  { href: "/play/computer", icon: Bot, title: "Play Bots", text: "10 bots from beginner to master, with an optional coach" },
  { href: "/play/friend", icon: Users, title: "Play a Friend", text: "Two players on one device, with or without a clock" },
  { href: "/puzzles/rush", icon: Timer, title: "Puzzle Rush", text: "Solve as many puzzles as you can in 3 or 5 minutes" },
  { href: "/analysis", icon: Search, title: "Game Review", text: "Unlimited and free: find your best and worst moves" },
];

export default function Page() {
  return (
    <GameScreen title="Play">
      <div className="flex flex-col gap-2">
        {options.map(({ href, icon: Icon, title, text }) => (
          <Link key={href} href={href} className="flex items-center gap-4 rounded-md bg-card p-4 hover:bg-accent">
            <Icon className="size-8 shrink-0 text-primary" aria-hidden />
            <span>
              <b className="block text-lg">{title}</b>
              <small className="text-muted-foreground">{text}</small>
            </span>
          </Link>
        ))}
      </div>
    </GameScreen>
  );
}
