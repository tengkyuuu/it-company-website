"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// grouped by what they edit: the work we sell (projects, products, services),
// what we publish (blog, careers), who we are (roster), then panel admin
const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/inbox", label: "Inbox" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/blog", label: "Blog" },
  { href: "/admin/careers", label: "Careers" },
  { href: "/admin/roster", label: "Roster" },
  { href: "/admin/team", label: "Team" },
  { href: "/admin/settings", label: "Site settings" },
];

/**
 * Sidebar on desktop, a horizontally scrolling tab strip on small screens (the
 * strip bleeds to the screen edges and keeps the active tab scrolled into view).
 * `badges` maps an href to a count — the server wrapper (AdminNav) fills in the
 * open-inbox number.
 */
export default function AdminNavLinks({ badges = {} }: { badges?: Record<string, number> }) {
  const pathname = usePathname();
  const listRef = useRef<HTMLElement>(null);

  // keep the active tab visible in the mobile strip — scrollLeft, not
  // scrollIntoView, so it can never nudge the page vertically
  useEffect(() => {
    const nav = listRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollLeft = active.offsetLeft - nav.clientWidth / 2 + active.clientWidth / 2;
  }, [pathname]);

  return (
    <nav
      ref={listRef}
      aria-label="Admin sections"
      className="-mx-5 flex gap-1 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:flex-col md:gap-0.5 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {links.map((l) => {
        // /admin must not light up for every nested route; the others match
        // their own subtree (/admin/projects/123) but not a lookalike prefix
        const active =
          l.href === "/admin"
            ? pathname === "/admin"
            : pathname === l.href || pathname.startsWith(`${l.href}/`);
        const count = badges[l.href] ?? 0;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40 ${
              active
                ? "bg-ink/[0.07] font-medium text-ink"
                : "text-ink/60 hover:bg-ink/[0.04] hover:text-ink"
            }`}
          >
            {l.label}
            {count > 0 && (
              <span className="min-w-[1.25rem] rounded-full bg-ink px-1.5 py-px text-center font-mono text-[10px] tabular-nums text-paper">
                {count > 99 ? "99+" : count}
                <span className="sr-only"> open</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
