"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BookOpen, GraduationCap, Menu, Puzzle, Search, Swords, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/play", label: "Play", icon: Swords },
  { href: "/puzzles", label: "Puzzles", icon: Puzzle },
  { href: "/learn", label: "Learn", icon: GraduationCap },
  { href: "/openings", label: "Openings", icon: BookOpen },
  { href: "/analysis", label: "Review", icon: Search },
];

function isActive(pathname: string, href: string) {
  // Lessons live under /lessons but belong to the Learn menu item.
  if (href === "/learn" && pathname.startsWith("/lessons")) return true;
  return pathname === href || pathname.startsWith(href + "/");
}

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const menu = (
    <ul className="flex flex-col gap-1">
      {links.map(({ href, label, icon: Icon }) => (
        <li key={href}>
          <Link
            href={href}
            onClick={() => setOpen(false)}
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

  const logo = (
    <Link href="/" onClick={() => setOpen(false)} className="font-heading text-2xl font-bold text-white">
      ChessSite
    </Link>
  );

  return (
    <>
      {/* Desktop: fixed 170px sidebar */}
      <nav aria-label="Main" className="fixed inset-y-0 left-0 hidden w-[170px] flex-col gap-6 border-r border-sidebar-border bg-sidebar px-2 py-5 lg:flex">
        <div className="px-3">{logo}</div>
        {menu}
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
          </nav>
        )}
      </header>
    </>
  );
}
