import Link from "next/link";
import type { ActivityItem } from "@/app/admin/_lib/history";

/*
 * The activity feed's rows — shared by /admin/activity and the overview's
 * "Recent activity" card. Server-safe (no hooks, no "use client"): every
 * string, including both times, was formatted on the server in Asia/Manila,
 * so nothing here can hydrate differently in the browser.
 */

const DOT: Record<ActivityItem["group"], string> = {
  content: "bg-ink",
  team: "bg-accent-to",
  auth: "bg-slatey",
  other: "bg-mist",
};

function Sentence({ item }: { item: ActivityItem }) {
  return (
    <>
      {item.actor && <span className="font-medium text-ink">{item.actor} </span>}
      {item.parts.map((p, i) =>
        typeof p === "string" ? (
          <span key={i}>{p}</span>
        ) : item.href ? (
          <Link
            key={i}
            href={item.href}
            className="font-medium text-ink underline decoration-mist underline-offset-2 transition-colors hover:decoration-ink"
          >
            “{p.label}”
          </Link>
        ) : (
          <span key={i} className="font-medium text-ink">
            “{p.label}”
          </span>
        )
      )}
    </>
  );
}

export default function ActivityList({
  items,
  compact = false,
}: {
  items: ActivityItem[];
  /** overview card: one line per row, absolute time only on hover */
  compact?: boolean;
}) {
  return (
    <ul className="divide-y divide-mist/70">
      {items.map((item) => (
        <li key={item.id} className={`flex items-start gap-3 ${compact ? "py-2.5" : "py-3.5"}`}>
          <span aria-hidden className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${DOT[item.group]}`} />
          <p className={`min-w-0 flex-1 text-sm leading-relaxed text-ink/70 ${compact ? "truncate" : ""}`}>
            <Sentence item={item} />
            {/* the label link already points at the item; a team/storage row links as a whole */}
            {item.href && !item.parts.some((p) => typeof p !== "string") && (
              <>
                {" "}
                <Link
                  href={item.href}
                  className="text-ink/45 transition-colors hover:text-ink"
                  aria-label="Open the related page"
                >
                  →
                </Link>
              </>
            )}
          </p>
          <time
            dateTime={item.at}
            title={`${item.when} (Manila time)`}
            className="shrink-0 text-right font-mono text-[11px] leading-relaxed text-ink/45"
          >
            {item.ago}
            {!compact && <span className="hidden sm:block">{item.when}</span>}
          </time>
        </li>
      ))}
    </ul>
  );
}
