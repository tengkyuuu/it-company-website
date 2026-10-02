"use client";

import { Analytics } from "@vercel/analytics/next";

/**
 * Vercel Analytics, minus the admin panel.
 *
 * A client wrapper only because `beforeSend` is a function, and a server
 * component (components/DocumentShell.tsx) can't pass one to a client component.
 *
 * /admin is dropped entirely: panel traffic isn't marketing data, and the
 * invite / reset page carries a one-time token in its URL (`?t=`) that must
 * never reach a third party — even though the page strips it on load.
 */
export default function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        try {
          return new URL(event.url).pathname.startsWith("/admin") ? null : event;
        } catch {
          return event;
        }
      }}
    />
  );
}
