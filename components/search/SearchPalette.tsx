"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { pauseSmoothScroll, resumeSmoothScroll } from "@/components/fx/SmoothScroll";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  defaultResults,
  groupResults,
  highlightParts,
  search,
  tokenize,
  type SearchEntry,
} from "@/lib/search-score";

/**
 * The Cmd+K palette — loaded on first open by SearchLauncher (next/dynamic), so
 * none of this is in the bundle until someone actually searches.
 *
 * ARIA: a modal dialog holding the combobox pattern — focus stays in the input,
 * which owns the listbox through aria-controls / aria-activedescendant; options
 * are grouped (role=group, labelled by the group heading) and never focusable
 * themselves. Tab is trapped between the input and the close button, Esc
 * closes, focus returns to whatever opened it.
 *
 * While open the page behind is frozen: Lenis is stopped (otherwise the wheel
 * scrolls the page under the veil) and the root overflow is locked for the
 * reduced-motion / native-scroll case. The scrollable list carries
 * data-lenis-prevent so a stopped Lenis doesn't swallow ITS wheel events.
 *
 * Styling: theme tokens only; the single accent moment is the thin gradient bar
 * on the active option. No backdrop-filter (perf rule) — the veil is
 * near-opaque paper instead, which reads as the page receding in both themes.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

type Props = { index: SearchEntry[]; open: boolean; onClose: () => void };

export default function SearchPalette({ index, open, onClose }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const reduce = useReducedMotion();
  const uid = useId();
  const listId = `${uid}-list`;
  const optId = (id: string) => `${uid}-opt-${id}`;

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const tokens = useMemo(() => tokenize(query), [query]);
  const searching = tokens.length > 0;
  const groups = useMemo(
    () => groupResults(searching ? search(index, query) : defaultResults(index)),
    [index, query, searching]
  );
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const rowOf = useMemo(() => new Map(flat.map((e, i) => [e.id, i])), [flat]);
  // the index can change under an open palette (a live update) — stay in range
  const activeIdx = flat.length ? Math.min(active, flat.length - 1) : -1;
  const activeEntry = activeIdx >= 0 ? flat[activeIdx] : undefined;

  const groupLabel: Record<SearchEntry["type"], string> = {
    page: searching ? t("search.groups.page") : t("search.idle"),
    project: t("search.groups.project"),
    service: t("search.groups.service"),
    product: t("search.groups.product"),
    job: t("search.groups.job"),
    post: t("search.groups.post"),
    team: t("search.groups.team"),
  };

  // Open: freeze the page, focus the input. Close: undo all of it, hand focus
  // back to whatever had it (the Nav button, usually) and clear the query for
  // next time — safe mid-exit, because AnimatePresence animates out the last
  // rendered element, not a re-render with the cleared state.
  useEffect(() => {
    if (!open) return;

    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.documentElement;
    const prevOverflow = root.style.getPropertyValue("overflow");
    const prevGutter = root.style.getPropertyValue("scrollbar-gutter");
    // keep the scrollbar's width reserved so the page doesn't shift sideways
    if (window.innerWidth > root.clientWidth) root.style.setProperty("scrollbar-gutter", "stable");
    root.style.setProperty("overflow", "hidden");
    pauseSmoothScroll();
    inputRef.current?.focus({ preventScroll: true });

    return () => {
      root.style.setProperty("overflow", prevOverflow);
      root.style.setProperty("scrollbar-gutter", prevGutter);
      resumeSmoothScroll();
      if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
      setQuery("");
      setActive(0);
    };
  }, [open]);

  // keep the active option in view (manual, so nothing outside the list scrolls)
  useEffect(() => {
    const list = listRef.current;
    if (!open || !list || !activeEntry) return;
    if (activeIdx === 0) {
      list.scrollTop = 0;
      return;
    }
    const el = document.getElementById(`${uid}-opt-${activeEntry.id}`);
    if (!el) return;
    // offsetTop is relative to the list (it's the nearest positioned ancestor)
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top - 8;
    else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight + 8;
    }
  }, [open, activeIdx, activeEntry, uid]);

  function go(entry: SearchEntry) {
    onClose();
    router.push(entry.href);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!flat.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((Math.max(activeIdx, 0) + step + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      if (e.nativeEvent.isComposing) return;
      if (activeEntry) {
        e.preventDefault();
        go(activeEntry);
      }
    }
  }

  // Esc anywhere in the dialog; Tab cycles inside it. stopPropagation keeps Esc
  // from also reaching the chat widget's window listener underneath.
  function onPanelKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusables = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>("input, button:not([disabled])")
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const current = document.activeElement;
    if (e.shiftKey && (current === first || current === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (current === last || current === panelRef.current)) {
      e.preventDefault();
      first.focus();
    }
  }

  // Combobox convention: a press anywhere in the panel other than the input or a
  // button must not take focus away from the input — otherwise typing (and Esc,
  // which is handled on the panel) would stop working after a stray click.
  // Clicks still fire, so options navigate as usual.
  function onPanelMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (!target.closest("input, button")) e.preventDefault();
  }

  const status = !searching
    ? ""
    : flat.length === 0
      ? t("search.noResults", { query: query.trim() })
      : flat.length === 1
        ? t("search.resultOne")
        : t("search.resultCount", { count: flat.length });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="search-palette"
          className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[10vh] sm:pt-[14vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.12 : 0.2, ease: EASE }}
          data-lenis-prevent
        >
          {/* veil — click to dismiss; touch-none so a swipe on it can't move the page */}
          <div className="absolute inset-0 touch-none bg-paper/80" onClick={onClose} aria-hidden />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("search.dialogLabel")}
            tabIndex={-1}
            onKeyDown={onPanelKeyDown}
            onMouseDown={onPanelMouseDown}
            initial={reduce ? false : { y: 10, scale: 0.985 }}
            animate={{ y: 0, scale: 1 }}
            exit={reduce ? undefined : { y: 10, scale: 0.985 }}
            transition={{ duration: 0.26, ease: EASE }}
            className="relative flex max-h-[min(36rem,80svh)] w-full max-w-[38rem] flex-col overflow-hidden rounded-3xl border border-mist/70 bg-surface shadow-[0_28px_70px_-24px_rgba(15,23,42,0.4)] outline-none"
          >
            {/* input row */}
            <div className="flex items-center gap-3 border-b border-mist/70 px-5">
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-[18px] w-[18px] shrink-0 text-slatey"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4 4" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-label={t("search.inputLabel")}
                aria-expanded={flat.length > 0}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={activeEntry ? optId(activeEntry.id) : undefined}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onInputKeyDown}
                placeholder={t("search.placeholder")}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="go"
                className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-slatey"
              />
              <button
                type="button"
                onClick={onClose}
                aria-label={t("search.close")}
                className="shrink-0 rounded-md border border-mist px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-slatey transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to"
              >
                <span aria-hidden className="hidden sm:inline">
                  ESC
                </span>
                <span aria-hidden className="text-xs sm:hidden">
                  ✕
                </span>
              </button>
            </div>

            {/* results */}
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={t("search.resultsLabel")}
              className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2"
            >
              {searching && flat.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slatey">{status}</p>
              ) : (
                groups.map((g) => {
                  const headingId = `${uid}-group-${g.type}`;
                  return (
                    <div key={g.type} role="group" aria-labelledby={headingId} className="pb-1">
                      <div
                        id={headingId}
                        role="presentation"
                        className="px-3 pb-1.5 pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-slatey"
                      >
                        {groupLabel[g.type]}
                      </div>
                      {g.items.map((entry) => {
                        const i = rowOf.get(entry.id) ?? -1;
                        const selected = i === activeIdx;
                        return (
                          <Link
                            key={entry.id}
                            id={optId(entry.id)}
                            href={entry.href}
                            prefetch={false}
                            role="option"
                            aria-selected={selected}
                            tabIndex={-1}
                            onClick={onClose}
                            // mousemove, not mouseenter: keyboard scrolling must not
                            // hand the selection to whatever row slides under a still cursor
                            onMouseMove={() => {
                              if (!selected) setActive(i);
                            }}
                            className="group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors duration-150 aria-selected:bg-mist/40"
                          >
                            <span
                              aria-hidden
                              className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-accent opacity-0 transition-opacity duration-150 group-aria-selected:opacity-100"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-ink">
                                <Highlight text={entry.title} tokens={tokens} />
                              </span>
                              {entry.snippet && (
                                <span className="mt-0.5 block truncate text-xs text-slatey">
                                  <Highlight text={entry.snippet} tokens={tokens} />
                                </span>
                              )}
                            </span>
                            <span
                              aria-hidden
                              className="shrink-0 font-mono text-xs text-slatey opacity-0 transition-opacity duration-150 group-aria-selected:opacity-100"
                            >
                              ↵
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {/* key hints — keyboards only */}
            <div className="hidden items-center gap-4 border-t border-mist/70 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-slatey sm:flex">
              <Hint keys="↑ ↓" label={t("search.navigate")} />
              <Hint keys="↵" label={t("search.open")} />
              <Hint keys="esc" label={t("search.dismiss")} />
            </div>

            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {status}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  return (
    <>
      {highlightParts(text, tokens).map((part, i) =>
        part.match ? (
          <mark key={i} className="rounded-[3px] bg-mist/70 px-px font-semibold text-ink">
            {part.text}
          </mark>
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        )
      )}
    </>
  );
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <kbd className="rounded border border-mist px-1 py-px font-mono normal-case text-[10px] text-slatey">
        {keys}
      </kbd>
      {label}
    </span>
  );
}
