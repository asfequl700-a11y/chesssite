import Link from "next/link";

const links = [
  { href: "/advertise", label: "Advertise" },
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border px-6 py-6 text-sm text-muted-foreground">
      <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-white">
            {l.label}
          </Link>
        ))}
        <span className="ml-auto">© ChessSite. Free chess, forever.</span>
      </nav>
    </footer>
  );
}
