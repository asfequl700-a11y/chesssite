"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { BarChart3, BookOpen, GraduationCap, History, Library, LogOut, Menu, Puzzle, Search, Swords, Trophy, Tv, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import { ChallengeToast, SocialIcons } from "@/components/notifications";
import { supabase, useAccount } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const links = [
  { href: "/play", label: "Play", icon: Swords },
  { href: "/puzzles", label: "Puzzles", icon: Puzzle },
  { href: "/learn", label: "Learn", icon: GraduationCap },
  { href: "/courses", label: "Courses", icon: Library },
  { href: "/openings", label: "Openings", icon: BookOpen },
  { href: "/analysis", label: "Review", icon: Search },
  { href: "/tournaments", label: "Tournaments", icon: Trophy },
  { href: "/watch", label: "Watch", icon: Tv },
];

function isActive(pathname: string, href: string) {
  // Lessons live under /lessons but belong to the Learn menu item.
  if (href === "/learn" && pathname.startsWith("/lessons")) return true;
  return pathname === href || pathname.startsWith(href + "/");
}

/** Menu links; the current page is highlighted once its address is known. */
function Links({ close, pathname = "" }: { close: () => void; pathname?: string }) {
  return (
    <ul className="flex flex-col gap-1">
      {links.map(({ href, label, icon: Icon }) => (
        <li key={href}>
          <Link
            href={href}
            onClick={close}
            aria-current={isActive(pathname, href) ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 font-semibold text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
              isActive(pathname, href) && "bg-sidebar-accent text-white",
            )}
          >
            <Icon className="size-5 text-primary" aria-hidden />
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ActiveLinks({ close }: { close: () => void }) {
  return <Links close={close} pathname={usePathname()} />;
}

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const signedIn = !!useAccount().user;
  const close = () => setOpen(false);
  // The address is URL data: read it inside <Suspense> so pages can still be prerendered.
  const menu = (
    <Suspense fallback={<Links close={close} />}>
      <ActiveLinks close={close} />
    </Suspense>
  );

  const account = <Account close={() => setOpen(false)} />;

  const logo = (
    <Link href={signedIn ? "/home" : "/"} onClick={() => setOpen(false)} className="font-heading text-2xl font-bold text-white">
      ChessSite
    </Link>
  );

  return (
    <>
      <ChallengeToast />
      {/* Desktop: fixed 170px sidebar */}
      <nav aria-label="Main" className="fixed inset-y-0 left-0 hidden w-[170px] flex-col gap-6 border-r border-sidebar-border bg-sidebar px-2 py-5 lg:flex">
        <div className="px-3">{logo}</div>
        {menu}
        <div className="mt-auto">{account}</div>
      </nav>

      {/* Phone / tablet: top bar with a menu button */}
      <header className="sticky top-0 z-40 border-b border-sidebar-border bg-sidebar lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          {logo}
          <Button
            variant="ghost"
            size="icon"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </Button>
        </div>
        {open && (
          <nav id="mobile-menu" aria-label="Main" className="px-2 pb-3">
            {menu}
            <div className="mt-3 border-t border-sidebar-border pt-3">{account}</div>
          </nav>
        )}
      </header>
    </>
  );
}

/** Avatar + username with account links, or Sign up / Log in for guests. Hidden until the session check ends. */
function Account({ close }: { close: () => void }) {
  const { user, profile, ready } = useAccount();
  if (!ready) return <div className="h-24" />;
  if (!user)
    return (
      <div className="flex flex-col gap-2 px-1">
        <Link href="/signup" onClick={close} className="btn-green py-2! text-base!">
          Sign up
        </Link>
        <Link href="/login" onClick={close} className="rounded-lg bg-sidebar-accent py-2 text-center font-semibold text-white hover:bg-accent">
          Log in
        </Link>
      </div>
    );
  const name = profile?.username ?? user.email ?? "";
  const item = "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-sidebar-foreground hover:bg-sidebar-accent hover:text-white";
  return (
    <div className="flex flex-col gap-1">
      <Link href={`/member/${profile?.username ?? ""}`} onClick={close} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-sidebar-accent" title="Your profile">
        <Avatar url={profile?.avatar_url} name={name} size={32} />
        <span className="truncate text-sm font-semibold text-white">{name}</span>
      </Link>
      <SocialIcons close={close} />
      <Link href="/games" onClick={close} className={item}>
        <History className="size-4 text-primary" aria-hidden /> My games
      </Link>
      <Link href="/stats" onClick={close} className={item}>
        <BarChart3 className="size-4 text-primary" aria-hidden /> Stats
      </Link>
      <button
        className={cn(item, "text-left")}
        onClick={() => {
          close();
          void supabase.auth.signOut();
        }}
      >
        <LogOut className="size-4 text-primary" aria-hidden /> Log out
      </button>
    </div>
  );
}
