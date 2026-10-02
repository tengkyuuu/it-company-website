"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { whenReady } from "@/components/fx/ready";
import type { SearchEntry } from "@/lib/search-score";
import { OPEN_SEARCH_EVENT } from "./open";

/**
 * The ALWAYS-LOADED half of site search: a keydown listener and a window-event
 * listener, nothing else. The palette itself (UI, scoring, highlighting, motion)
 * is a separate chunk fetched the first time someone opens it — most visitors
 * never do, so they never download it.
 *
 * Opens on ⌘K / Ctrl+K (anywhere — it's a chord nobody types by accident), on
 * `/` (only when not typing in a field), and on `openSearch()` from ./open.ts
 * (the Nav button). Mounted by SiteChrome OUTSIDE <SmoothScroll>, like the chat
 * widget: Lenis transforms its wrapper, which would break `position: fixed`.
 *
 * Inert until the opening sequence is done (whenReady), so the palette can never
 * cover the Preloader; a request made during the sequence opens it right after.
 */

const SearchPalette = dynamic(() => import("./SearchPalette"), {
  ssr: false,
  loading: () => null,
});

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export default function SearchLauncher({ index }: { index: SearchEntry[] }) {
  const [loaded, setLoaded] = useState(false); // has the palette chunk been asked for?
  const [open, setOpen] = useState(false);
  const ready = useRef(false);
  const queued = useRef(false);
  const isOpen = useRef(false);

  useEffect(() => {
    isOpen.current = open;
  }, [open]);

  useEffect(() => {
    const openNow = () => {
      setLoaded(true);
      setOpen(true);
    };
    const request = () => {
      if (ready.current) openNow();
      else queued.current = true;
    };

    const onReady = () => {
      if (ready.current) return;
      ready.current = true;
      if (queued.current) {
        queued.current = false;
        openNow();
      }
    };
    const offReady = whenReady(onReady);
    // same backstop as the chat widget, in case mykt:ready never fires
    const backstop = window.setTimeout(onReady, 4000);

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault(); // Ctrl+K would otherwise focus the browser's search bar
        if (isOpen.current) setOpen(false);
        else request();
        return;
      }
      if (
        e.key === "/" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isOpen.current &&
        !isTypingTarget(e.target)
      ) {
        e.preventDefault(); // Firefox: "/" opens quick find
        request();
      }
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, request);
    return () => {
      offReady();
      window.clearTimeout(backstop);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, request);
    };
  }, []);

  if (!loaded) return null;
  return <SearchPalette index={index} open={open} onClose={() => setOpen(false)} />;
}
