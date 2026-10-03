"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps a server-rendered panel list fresh (/admin/chats): router.refresh()
 * every `ms` while the tab is visible, and once straight away when it becomes
 * visible again. No timer at all while the tab is hidden — the performance
 * rule is "nothing runs while nobody's looking". The refresh re-renders the
 * layout too, so the nav badge follows.
 */
export default function ChatAutoRefresh({ ms = 15_000 }: { ms?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: number | undefined;
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      timer = window.setInterval(() => router.refresh(), ms);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router, ms]);

  return null;
}
