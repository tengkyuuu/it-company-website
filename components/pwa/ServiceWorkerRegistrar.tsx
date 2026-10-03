"use client";

import { useEffect } from "react";
import { whenReady } from "@/components/fx/ready";

/**
 * Registers public/sw.js — production only, public site only (mounted from
 * app/[lang]/layout.tsx; the admin root layout never renders it).
 *
 * Deliberately late: after the opening sequence hands over (whenReady) AND the
 * main thread goes idle. Registration starts the worker's install, which
 * fetches the precache list — none of that may compete with hydration, the
 * hero's WebGL boot or the Preloader (CLAUDE.md, Performance).
 *
 * Updates: the browser re-checks /sw.js on navigations. A new version installs
 * in the background and WAITS — sw.js only calls skipWaiting() when a page
 * posts {type: "SKIP_WAITING"}, and nothing does that automatically — so a new
 * worker never takes over a page mid-session; it activates once every tab of
 * the old one is closed. (A future "update available" prompt can post it.)
 *
 * Renders nothing. No install prompt either — the browser's own install
 * affordance is enough.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // private mode, blocked storage, an old browser — the site works without it
      });
    };

    const off = whenReady(() => {
      // Safari only shipped requestIdleCallback recently
      if (typeof window.requestIdleCallback === "function") {
        idle = window.requestIdleCallback(register, { timeout: 8000 });
      } else {
        timer = setTimeout(register, 3000);
      }
    });

    return () => {
      off();
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);

  return null;
}
