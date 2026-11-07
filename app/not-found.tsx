import Link from "next/link";
import { PlainPage } from "@/components/game-screen";

export default function NotFound() {
  return (
    <PlainPage title="Page not found">
      <p className="mb-8 text-muted-foreground">This square is empty. Let&apos;s get you back to the board.</p>
      <Link href="/" className="btn-green">Go home</Link>
    </PlainPage>
  );
}
