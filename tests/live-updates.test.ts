import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLiveController,
  MAX_POLL_MS,
  MIN_CHECK_GAP_MS,
  observe,
  parseRev,
  PING_COALESCE_MS,
  POLL_MS,
  pollDelay,
  REFRESH_DEBOUNCE_MS,
  REFRESH_MAX_WAIT_MS,
} from "@/lib/live-updates";

/**
 * Live updates (lib/live-updates.ts) — the parts that fail SILENTLY:
 *  - a timer left running while the tab is hidden (the "nothing may run while
 *    the visitor is doing nothing" rule), or polling that hammers a paused
 *    database instead of backing off;
 *  - a refresh storm from one admin save (bursts must collapse to one), or a
 *    refresh that never comes (an update seen while hidden must be delivered);
 *  - a refresh on the very first read (the baseline) — every page view would
 *    reload itself once.
 */

describe("parseRev", () => {
  it.each([
    [[{ rev: 5 }], 5],
    [[{ rev: 0 }], 0],
    [[{ rev: "42" }], 42], // bigint as a string
    [{ rev: 3 }, 3],
    [[], null],
    [null, null],
    [{ message: "JWT expired" }, null],
    [[{ rev: -1 }], null],
    [[{ rev: 1.5 }], null],
    [[{ rev: "abc" }], null],
    [[{ rev: "" }], null],
    [[{ other: 1 }], null],
  ])("%j → %s", (body, expected) => {
    expect(parseRev(body)).toBe(expected);
  });
});

describe("pollDelay — 30 s, doubling per failure, capped", () => {
  it.each([
    [0, 30_000],
    [1, 60_000],
    [2, 120_000],
    [3, 240_000],
    [4, MAX_POLL_MS],
    [99, MAX_POLL_MS],
    [-3, POLL_MS],
  ])("%i failures → %i ms", (f, ms) => {
    expect(pollDelay(f)).toBe(ms);
  });
});

describe("observe", () => {
  it("the first value is the baseline, never a refresh", () => {
    expect(observe(null, 9)).toEqual({ baseline: 9, changed: false });
  });
  it("an increase is a change", () => {
    expect(observe(9, 10)).toEqual({ baseline: 10, changed: true });
  });
  it("the same value is not", () => {
    expect(observe(9, 9)).toEqual({ baseline: 9, changed: false });
  });
  it("a decrease re-baselines quietly, so the next edit is still caught", () => {
    expect(observe(9, 2)).toEqual({ baseline: 2, changed: false });
    expect(observe(2, 3).changed).toBe(true);
  });
});

/* ------------------------------------------------------------------------- */

type Deferred = { promise: Promise<number | null>; resolve: (v: number | null) => void };
const deferred = (): Deferred => {
  let resolve!: (v: number | null) => void;
  const promise = new Promise<number | null>((r) => (resolve = r));
  return { promise, resolve };
};

function setup(revs: (number | null | "throw")[] = []) {
  let current: number | null = revs.length ? null : 1;
  const queue = [...revs];
  const fetchRev = vi.fn(async () => {
    if (queue.length) {
      const next = queue.shift()!;
      if (next === "throw") throw new Error("network down");
      current = next;
      return next;
    }
    return current;
  });
  const refresh = vi.fn();
  const live = createLiveController({ fetchRev, refresh });
  return {
    live,
    fetchRev,
    refresh,
    /** what the next reads return from now on */
    setRev: (r: number | null) => {
      queue.length = 0;
      current = r;
    },
  };
}

describe("createLiveController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("first read only sets the baseline", async () => {
    const { live, fetchRev, refresh } = setup([7]);
    live.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchRev).toHaveBeenCalledTimes(1);
    expect(live.snapshot().baseline).toBe(7);
    await vi.advanceTimersByTimeAsync(REFRESH_DEBOUNCE_MS * 2);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("polls every 30 s while visible and refreshes once, debounced, when rev rises", async () => {
    const { live, fetchRev, refresh, setRev } = setup();
    setRev(1);
    live.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchRev).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(POLL_MS - 1);
    expect(fetchRev).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchRev).toHaveBeenCalledTimes(2);
    expect(refresh).not.toHaveBeenCalled();

    setRev(2);
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(fetchRev).toHaveBeenCalledTimes(3);
    expect(refresh).not.toHaveBeenCalled(); // still debouncing
    await vi.advanceTimersByTimeAsync(REFRESH_DEBOUNCE_MS);
    expect(refresh).toHaveBeenCalledTimes(1);

    // no further change → no further refresh
    await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    expect(refresh).toHaveBeenCalledTimes(1);
    live.dispose();
  });

  it("a burst of Realtime pings becomes one read-chain and one refresh", async () => {
    const { live, fetchRev, refresh, setRev } = setup();
    setRev(10);
    live.resume();
    await vi.advanceTimersByTimeAsync(0);
    const before = fetchRev.mock.calls.length;

    // an admin reorder: five bumps within ~half a second
    for (let i = 1; i <= 5; i++) {
      setRev(10 + i);
      live.ping();
      await vi.advanceTimersByTimeAsync(100);
    }
    await vi.advanceTimersByTimeAsync(PING_COALESCE_MS + REFRESH_DEBOUNCE_MS + 100);
    expect(fetchRev.mock.calls.length - before).toBeLessThanOrEqual(2);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(live.snapshot().baseline).toBe(15);
    live.dispose();
  });

  it("a steady stream of bumps can't postpone the refresh past the max wait", async () => {
    const { live, refresh, setRev } = setup();
    setRev(1);
    live.resume();
    await vi.advanceTimersByTimeAsync(0);

    let rev = 1;
    // a bump every 1.5 s — shorter than the debounce, forever
    for (let t = 0; t < REFRESH_MAX_WAIT_MS + 3000; t += 1500) {
      setRev(++rev);
      live.ping();
      await vi.advanceTimersByTimeAsync(1500);
    }
    expect(refresh).toHaveBeenCalled();
    live.dispose();
  });

  it("hidden = zero timers and zero reads; visible again = read at once", async () => {
    const { live, fetchRev } = setup();
    live.resume();
    await vi.advanceTimersByTimeAsync(0);
    live.pause();
    expect(vi.getTimerCount()).toBe(0);

    const reads = fetchRev.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    live.ping(); // a Realtime ping while hidden is ignored, not queued as a timer
    expect(vi.getTimerCount()).toBe(0);
    expect(fetchRev.mock.calls.length).toBe(reads);

    live.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchRev.mock.calls.length).toBe(reads + 1);
    live.dispose();
  });

  it("a refresh that came due while hidden is delivered on return, not dropped", async () => {
    const { live, refresh, setRev } = setup();
    setRev(1);
    live.resume();
    await vi.advanceTimersByTimeAsync(0);

    setRev(2);
    await vi.advanceTimersByTimeAsync(POLL_MS); // detects the change, starts debouncing
    expect(live.snapshot().owed).toBe(true);
    live.pause(); // tab hidden before the debounce fired
    await vi.advanceTimersByTimeAsync(REFRESH_DEBOUNCE_MS * 5);
    expect(refresh).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    live.resume();
    await vi.advanceTimersByTimeAsync(REFRESH_DEBOUNCE_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(live.snapshot().owed).toBe(false);
    live.dispose();
  });

  it("backs off on failures (30 → 60 → 120 s) and recovers on success", async () => {
    const { live, fetchRev, setRev } = setup();
    setRev(null); // every read fails
    live.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(live.snapshot().failures).toBe(1);

    await vi.advanceTimersByTimeAsync(60_000 - 1);
    expect(fetchRev).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchRev).toHaveBeenCalledTimes(2);
    expect(live.snapshot().failures).toBe(2);

    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchRev).toHaveBeenCalledTimes(3);

    setRev(4); // the database is back
    await vi.advanceTimersByTimeAsync(240_000);
    expect(fetchRev).toHaveBeenCalledTimes(4);
    expect(live.snapshot().failures).toBe(0);
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(fetchRev).toHaveBeenCalledTimes(5);
    live.dispose();
  });

  it("a rejected read counts as a failure, never an unhandled rejection", async () => {
    const { live } = setup(["throw"]);
    live.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(live.snapshot()).toMatchObject({ failures: 1, baseline: null });
    live.dispose();
  });

  it("focus + visibilitychange back-to-back read once", async () => {
    const { live, fetchRev } = setup();
    live.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchRev).toHaveBeenCalledTimes(1);
    await live.check();
    await live.check();
    expect(fetchRev).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(MIN_CHECK_GAP_MS);
    await live.check();
    expect(fetchRev).toHaveBeenCalledTimes(2);
    live.dispose();
  });

  it("never two reads in flight; a ping during a read gets exactly one follow-up", async () => {
    const pending: Deferred[] = [];
    const fetchRev = vi.fn(() => {
      const d = deferred();
      pending.push(d);
      return d.promise;
    });
    const refresh = vi.fn();
    const live = createLiveController({ fetchRev, refresh });

    live.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchRev).toHaveBeenCalledTimes(1);

    live.ping();
    await vi.advanceTimersByTimeAsync(PING_COALESCE_MS * 3); // ping fires while read #1 hangs
    live.ping();
    await vi.advanceTimersByTimeAsync(PING_COALESCE_MS * 3);
    expect(fetchRev).toHaveBeenCalledTimes(1);

    pending[0].resolve(1); // baseline
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchRev).toHaveBeenCalledTimes(2); // the single follow-up
    pending[1].resolve(2);
    await vi.advanceTimersByTimeAsync(REFRESH_DEBOUNCE_MS);
    expect(fetchRev).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(1);
    live.dispose();
  });

  it("dispose clears every timer and ignores a read still in flight", async () => {
    const d = deferred();
    const fetchRev = vi.fn(() => d.promise);
    const refresh = vi.fn();
    const live = createLiveController({ fetchRev, refresh });
    live.resume();
    live.ping();
    live.dispose();
    expect(vi.getTimerCount()).toBe(0);
    d.resolve(99);
    await vi.advanceTimersByTimeAsync(POLL_MS * 2);
    expect(live.snapshot().baseline).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
