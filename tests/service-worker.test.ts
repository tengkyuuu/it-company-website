import { readFileSync } from "node:fs";
import vm from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * public/sw.js runs in a ServiceWorkerGlobalScope no type-checker sees, and its
 * mistakes are the silent, sticky kind: a cached HTML page or RSC payload from
 * an older build breaks hydration for a returning visitor until they clear site
 * data. So the worker is executed here inside a fake worker global (node:vm)
 * with an in-memory CacheStorage and a scripted fetch, and its routing is pinned.
 */

const ORIGIN = "https://mykt.studio";
const CODE = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

type FakeRequest = {
  url: string;
  method: string;
  mode: string;
  cache: string;
  headers: Headers;
};

const req = (
  path: string,
  { mode = "cors", method = "GET", headers = {} as Record<string, string> } = {}
): FakeRequest => ({
  url: new URL(path, ORIGIN).href,
  method,
  mode,
  cache: "default",
  headers: new Headers(headers),
});

const urlOf = (r: string | FakeRequest | Request) => (typeof r === "string" ? new URL(r, ORIGIN).href : r.url);

function loadWorker(fetchImpl: (r: FakeRequest | Request) => Promise<Response>) {
  const listeners: Record<string, (e: unknown) => void> = {};
  const stores = new Map<string, Map<string, Response>>();
  const fetched: string[] = [];
  const fetchSpy = (r: FakeRequest | Request) => {
    fetched.push(urlOf(r));
    return fetchImpl(r);
  };

  const store = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  };
  const caches = {
    open: async (name: string) => {
      const m = store(name);
      return {
        match: async (r: string | FakeRequest) => m.get(urlOf(r))?.clone(),
        put: async (r: string | FakeRequest, res: Response) => void m.set(urlOf(r), res),
        addAll: async (list: Request[]) => {
          for (const r of list) {
            const res = await fetchSpy(r);
            if (!res.ok) throw new TypeError(`addAll: ${r.url} → ${res.status}`);
            m.set(r.url, res);
          }
        },
        keys: async () => [...m.keys()].map((u) => ({ url: u })),
        delete: async (r: string | { url: string }) => m.delete(typeof r === "string" ? urlOf(r) : r.url),
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };

  // relative URLs resolve against the worker's location, as in a real worker
  class SwRequest extends Request {
    constructor(input: string, init?: RequestInit) {
      super(new URL(input, ORIGIN).href, init);
    }
  }

  const skipWaiting = vi.fn();
  const self = {
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      listeners[type] = fn;
    },
    location: new URL(`${ORIGIN}/sw.js`),
    registration: { navigationPreload: { enable: vi.fn(async () => {}) } },
    skipWaiting,
  };
  vm.runInContext(
    CODE,
    vm.createContext({
      self,
      caches,
      fetch: fetchSpy,
      Request: SwRequest,
      Response,
      URL,
      Promise,
      // looked up at call time, so vi.useFakeTimers() applies
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
      clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    })
  );

  /** Dispatch a fetch event; `responded` is undefined when the worker left it to the network. */
  function dispatchFetch(request: FakeRequest, preloadResponse?: Promise<Response | undefined>) {
    let responded: Promise<Response> | undefined;
    const waits: Promise<unknown>[] = [];
    listeners.fetch({
      request,
      preloadResponse: preloadResponse ?? Promise.resolve(undefined),
      respondWith: (p: Promise<Response>) => {
        responded = Promise.resolve(p);
      },
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    });
    return { responded, settled: async () => Promise.all(waits) };
  }

  async function lifecycle(type: "install" | "activate") {
    const waits: Promise<unknown>[] = [];
    listeners[type]({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
  }

  return { listeners, stores, fetched, skipWaiting, self, dispatchFetch, lifecycle };
}

const okText = (body: string, type = "text/html") => {
  const res = new Response(body, { status: 200, headers: { "content-type": type } });
  // a same-origin fetch in a worker yields a "basic" response; Node's are "default"
  Object.defineProperty(res, "type", { value: "basic" });
  return res;
};
const network = (body = "net") => vi.fn(async () => okText(body));

afterEach(() => {
  vi.useRealTimers();
});

describe("install / activate / update", () => {
  it("precaches the shell — from the server, not the HTTP cache — and does NOT skip waiting", async () => {
    const w = loadWorker(network());
    await w.lifecycle("install");
    const shell = [...w.stores.entries()].find(([name]) => name.startsWith("rat-shell-"))?.[1];
    expect([...(shell?.keys() ?? [])].map((u) => new URL(u).pathname).sort()).toEqual(
      [
        "/brand/wordmark-outline.svg",
        "/brand/wordmark.svg",
        "/icons/apple-touch-icon.png",
        "/icons/icon-192.png",
        "/icons/icon-512.png",
        "/icons/maskable-512.png",
        "/offline.html",
      ].sort()
    );
    expect(w.skipWaiting).not.toHaveBeenCalled();
  });

  it("every precached file exists in public/ (a 404 would fail the whole install)", () => {
    const list = [...CODE.matchAll(/"(\/(?:offline\.html|icons\/[^"]+|brand\/[^"]+))"/g)].map((m) => m[1]);
    expect(list.length).toBeGreaterThanOrEqual(7);
    for (const p of list) {
      expect(() => readFileSync(new URL(`../public${p}`, import.meta.url)), p).not.toThrow();
    }
  });

  it("activation deletes older rat- caches only, and enables navigation preload", async () => {
    const w = loadWorker(network());
    w.stores.set("rat-shell-2020-01-01", new Map());
    w.stores.set("rat-static-2020-01-01", new Map());
    w.stores.set("someone-elses-cache", new Map());
    await w.lifecycle("install");
    await w.lifecycle("activate");
    const names = [...w.stores.keys()];
    expect(names).toContain("someone-elses-cache");
    expect(names.filter((n) => n.includes("2020-01-01"))).toEqual([]);
    expect(names.some((n) => n.startsWith("rat-shell-"))).toBe(true);
    expect(w.self.registration.navigationPreload.enable).toHaveBeenCalled();
  });

  it("skipWaiting only on an explicit message", () => {
    const w = loadWorker(network());
    w.listeners.message({ data: { type: "something-else" } });
    w.listeners.message({ data: null });
    expect(w.skipWaiting).not.toHaveBeenCalled();
    w.listeners.message({ data: { type: "SKIP_WAITING" } });
    expect(w.skipWaiting).toHaveBeenCalledTimes(1);
  });
});

describe("never touched (network-only, as if there were no worker)", () => {
  const cases: [string, FakeRequest][] = [
    ["a POST (server actions, forms)", req("/projects", { method: "POST" })],
    ["cross-origin (Supabase)", req("https://abc.supabase.co/rest/v1/site_revision")],
    ["cross-origin (a CMS image host)", req("https://cdn.example.com/a.webp")],
    ["the admin", req("/admin", { mode: "navigate" })],
    ["an admin page", req("/admin/projects/123", { mode: "navigate" })],
    ["an admin asset request", req("/admin/projects")],
    ["the API", req("/api/chat")],
    ["optimised images", req("/_next/image?url=%2Fwork%2Fa.webp&w=1080&q=90")],
    ["Vercel insights", req("/_vercel/insights/script.js")],
    ["the worker itself", req("/sw.js")],
    ["an RSC payload (RSC: 1)", req("/projects", { headers: { RSC: "1" } })],
    ["an RSC payload (?_rsc)", req("/projects?_rsc=abc12")],
    ["a router prefetch", req("/projects", { headers: { "Next-Router-Prefetch": "1" } })],
    ["a router state request", req("/projects", { headers: { "Next-Router-State-Tree": "%5B%5D" } })],
    ["a segment prefetch", req("/projects", { headers: { "Next-Router-Segment-Prefetch": "/_tree" } })],
    ["a server action", req("/projects", { headers: { "Next-Action": "abc" } })],
    ["ordinary public files (HTTP cache)", req("/work/famecrm-landing.webp")],
    ["the reel frames", req("/brand/reel/frame-001.webp")],
  ];
  it.each(cases)("%s", (_, request) => {
    const w = loadWorker(network());
    expect(w.dispatchFetch(request).responded).toBeUndefined();
  });

  it("…even an RSC navigation-mode request is left alone", () => {
    const w = loadWorker(network());
    expect(w.dispatchFetch(req("/projects", { mode: "navigate", headers: { RSC: "1" } })).responded).toBeUndefined();
  });
});

describe("/_next/static — cache-first", () => {
  it("fetches once, then serves from cache", async () => {
    const fetchImpl = network("chunk");
    const w = loadWorker(fetchImpl);
    const first = w.dispatchFetch(req("/_next/static/chunks/app-abc123.js"));
    expect(await (await first.responded!).text()).toBe("chunk");
    await first.settled();
    const second = w.dispatchFetch(req("/_next/static/chunks/app-abc123.js"));
    expect(await (await second.responded!).text()).toBe("chunk");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("doesn't cache failures", async () => {
    const w = loadWorker(vi.fn(async () => new Response("nope", { status: 404 })));
    const r = w.dispatchFetch(req("/_next/static/chunks/missing.js"));
    expect((await r.responded!).status).toBe(404);
    await r.settled();
    const cached = [...w.stores.values()].some((m) => [...m.keys()].some((u) => u.includes("missing.js")));
    expect(cached).toBe(false);
  });
});

describe("navigations — network-first, offline page on failure, never cached", () => {
  it("serves the network response and caches nothing", async () => {
    const w = loadWorker(network("<html>projects</html>"));
    const r = w.dispatchFetch(req("/projects", { mode: "navigate" }));
    expect(await (await r.responded!).text()).toBe("<html>projects</html>");
    await r.settled();
    const cachedPages = [...w.stores.values()].flatMap((m) => [...m.keys()]).filter((u) => u.endsWith("/projects"));
    expect(cachedPages).toEqual([]);
  });

  it("uses the navigation-preload response when there is one", async () => {
    const fetchImpl = network("from fetch");
    const w = loadWorker(fetchImpl);
    const r = w.dispatchFetch(req("/about", { mode: "navigate" }), Promise.resolve(okText("from preload")));
    expect(await (await r.responded!).text()).toBe("from preload");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("falls back to /offline.html when the network fails", async () => {
    let online = true;
    const w = loadWorker(async (r) => {
      if (!online) throw new TypeError("Failed to fetch");
      return okText(new URL(urlOf(r)).pathname === "/offline.html" ? "OFFLINE PAGE" : "page");
    });
    await w.lifecycle("install");
    online = false;
    const r = w.dispatchFetch(req("/fil/projects", { mode: "navigate" }));
    expect(await (await r.responded!).text()).toBe("OFFLINE PAGE");
  });

  it("…and when the network hangs past the timeout", async () => {
    // the page request hangs forever; the shell (precached at install) answers
    const w = loadWorker(async (r) => {
      const p = new URL(urlOf(r)).pathname;
      if (p === "/projects") return new Promise<Response>(() => {});
      return okText(p === "/offline.html" ? "OFFLINE PAGE" : "asset");
    });
    await w.lifecycle("install");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const r = w.dispatchFetch(req("/projects", { mode: "navigate" }));
    await vi.advanceTimersByTimeAsync(10_000);
    const res = await r.responded!;
    vi.useRealTimers(); // undici reads bodies on real timers
    expect(await res.text()).toBe("OFFLINE PAGE");
  });
});

describe("shell assets — stale-while-revalidate", () => {
  it("serves the precached wordmark and refreshes it in the background", async () => {
    let version = "v1";
    const w = loadWorker(async () => okText(`<svg>${version}</svg>`, "image/svg+xml"));
    await w.lifecycle("install");
    version = "v2";
    const r = w.dispatchFetch(req("/brand/wordmark.svg"));
    expect(await (await r.responded!).text()).toBe("<svg>v1</svg>");
    await r.settled();
    const again = w.dispatchFetch(req("/brand/wordmark.svg"));
    expect(await (await again.responded!).text()).toBe("<svg>v2</svg>");
  });

  it("a direct visit to /offline.html is a normal navigation, not a cache lookup", () => {
    const w = loadWorker(network());
    expect(w.dispatchFetch(req("/offline.html")).responded).toBeUndefined();
  });
});
