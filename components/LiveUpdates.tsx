"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { whenReady } from "@/components/fx/ready";
import { createLiveController, FETCH_TIMEOUT_MS, parseRev } from "@/lib/live-updates";

/**
 * Brings a published edit to pages that are already open, within seconds,
 * without a reload: when `site_revision.rev` goes up, `router.refresh()`
 * re-fetches the RSC payload (client state — a half-typed contact form, an open
 * chat — survives). Decision logic lives in lib/live-updates.ts; this file is
 * only the wiring. Three layers, all cheap:
 *
 *  1. POLL every 30 s, only while the tab is visible — straight at Supabase's
 *     REST API with the public anon key, so it costs no Vercel invocation.
 *     One tiny row, 5 s timeout, no retries; backs off on failure.
 *  2. RE-CHECK on visibilitychange / focus — instant catch-up for someone who
 *     just published from the admin tab and switched back.
 *  3. REALTIME, lazily: after the opening sequence AND an idle callback, the
 *     Supabase client is import()ed (a separate chunk — never on the critical
 *     path) and subscribes to UPDATEs on public.site_revision. The payload is
 *     treated as a ping only; we re-read rev. Disconnected while the tab is
 *     hidden (no heartbeat timers, no connection slot held). On CHANNEL_ERROR /
 *     TIMED_OUT / CLOSED — e.g. the free plan's 200-connection cap — it gives
 *     up for this page view and polling carries on alone.
 *
 * Costs nothing per frame: no rAF, no timers while hidden, nothing at all during
 * the opening sequence, and nothing whatsoever when NEXT_PUBLIC_SUPABASE_URL is
 * unset (static-content mode).
 *
 * Mounted from SiteChrome; renders nothing.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function timeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  if (typeof AbortController === "undefined") return undefined;
  const ac = new AbortController();
  setTimeout(() => ac.abort(), ms);
  return ac.signal;
}

/** requestIdleCallback with a fallback; returns a canceller. */
function onIdle(fn: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(fn, { timeout: 5000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(fn, 1500);
  return () => window.clearTimeout(id);
}

export default function LiveUpdates() {
  const router = useRouter();

  useEffect(() => {
    const url = SUPABASE_URL?.replace(/\/+$/, "");
    const key = SUPABASE_KEY;
    if (!url || !key) return; // no database configured → nothing to watch

    const endpoint = `${url}/rest/v1/site_revision?select=rev&id=eq.1`;
    const fetchRev = async (): Promise<number | null> => {
      try {
        const res = await fetch(endpoint, {
          headers: { apikey: key, Accept: "application/json" },
          cache: "no-store",
          credentials: "omit",
          signal: timeoutSignal(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) return null;
        return parseRev(await res.json());
      } catch {
        return null; // offline, timed out, paused project — just a failed read
      }
    };

    const live = createLiveController({ fetchRev, refresh: () => router.refresh() });
    const visible = () => document.visibilityState === "visible";

    /* ---- Realtime (layer 3) ------------------------------------------- */
    let disposed = false;
    let realtimeOff = false; // gave up for this page view — polling only
    let client: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;

    const disconnect = () => {
      const c = client;
      const ch = channel;
      channel = null; // first, so the CLOSED this causes is ignored below
      if (c && ch) {
        // removing the last channel also closes the socket (and its heartbeat)
        void c.removeChannel(ch).catch(() => {});
      }
    };

    const connect = async () => {
      if (disposed || realtimeOff || channel || !visible()) return;
      try {
        if (!client) {
          const { createClient } = await import("@supabase/supabase-js");
          if (disposed) return;
          // a bare anon client: no session, no storage, no token refresh timers
          client = createClient(url, key, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          });
        }
        if (disposed || realtimeOff || channel || !visible()) return; // changed during the import
        const ch = client.channel("site-revision");
        channel = ch;
        ch.on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "site_revision" },
          () => live.ping()
        ).subscribe((status) => {
          if (channel !== ch) return; // one we already let go of
          if (status === "SUBSCRIBED") {
            live.ping(); // close the gap between the last read and the subscription
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            realtimeOff = true;
            disconnect();
          }
        });
      } catch {
        realtimeOff = true;
        disconnect();
      }
    };

    /* ---- visibility / focus (layers 1 + 2) ---------------------------- */
    let started = false;
    let cancelIdle: (() => void) | null = null;

    const onVisibility = () => {
      if (visible()) {
        live.resume();
        void connect();
      } else {
        live.pause();
        disconnect();
      }
    };
    const onFocus = () => {
      if (visible()) void live.check();
    };

    const start = () => {
      if (started || disposed) return;
      started = true;
      if (visible()) live.resume();
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("focus", onFocus);
      cancelIdle = onIdle(() => {
        cancelIdle = null;
        void connect();
      });
    };

    // nothing during the opening sequence; the backstop matches the other
    // whenReady consumers in case mykt:ready never fires
    const offReady = whenReady(start);
    const backstop = window.setTimeout(start, 5000);

    return () => {
      disposed = true;
      offReady();
      window.clearTimeout(backstop);
      cancelIdle?.();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      live.dispose();
      disconnect();
    };
  }, [router]);

  return null;
}
