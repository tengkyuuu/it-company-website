/*
 * R Ally's Tech — service worker. A SHELL-ONLY PWA: it makes the site
 * installable and gives it an offline page, and otherwise stays out of the way.
 * Registered by components/pwa/ServiceWorkerRegistrar.tsx (production, public
 * site only, after the opening sequence). Pinned by tests/service-worker.test.ts.
 *
 *  /_next/static/**   cache-first. Content-hashed, so a URL never changes
 *                     meaning; capped so old builds' chunks age out.
 *  navigations        network-first with a timeout → /offline.html when the
 *                     network fails. Pages are NEVER cached: a stale HTML
 *                     document from an older build would reference chunks and
 *                     RSC data that no longer match.
 *  shell              /offline.html, the icons and the wordmark masks are
 *                     precached; the icons/masks are served stale-while-
 *                     revalidate so a rebrand heals itself on the next load.
 *  never touched      /admin/**, /api/**, RSC requests (RSC: 1 header, ?_rsc,
 *                     Next-Router-* / Next-Action headers), /_next/image (CMS
 *                     images stay with the browser's HTTP cache), /_vercel/**,
 *                     anything cross-origin (Supabase, maps, CMS hosts), and
 *                     every non-GET. "Not touched" = no respondWith, so the
 *                     browser fetches it exactly as if there were no worker.
 *
 * Updates: bump VERSION when this file's behaviour or the shell list changes.
 * A new worker installs and then WAITS; it calls skipWaiting() only when a page
 * posts {type: "SKIP_WAITING"} — so it never swaps behaviour under an open page
 * mid-session — and on activation deletes every older "rat-" cache.
 */
"use strict";

var VERSION = "2026-10-03.1";
var PREFIX = "rat-";
var SHELL_CACHE = PREFIX + "shell-" + VERSION;
var STATIC_CACHE = PREFIX + "static-" + VERSION;
var STATIC_MAX_ENTRIES = 250;
var NAV_TIMEOUT_MS = 6000;
var OFFLINE_URL = "/offline.html";
var SHELL = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/brand/wordmark.svg",
  "/brand/wordmark-outline.svg",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      // cache: "reload" — the shell must come from the server, not a stale HTTP cache
      return cache.addAll(
        SHELL.map(function (url) {
          return new Request(url, { cache: "reload" });
        })
      );
    })
  );
  // no skipWaiting() here: see the message handler
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key.indexOf(PREFIX) === 0 && key !== SHELL_CACHE && key !== STATIC_CACHE;
            })
            .map(function (key) {
              return caches.delete(key);
            })
        );
      })
      .then(function () {
        // lets the navigation request start while the worker boots
        if (self.registration.navigationPreload) {
          return self.registration.navigationPreload.enable().catch(function () {});
        }
      })
  );
});

self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

/** Requests the worker must leave to the network, untouched. */
function bypass(request, url) {
  var p = url.pathname;
  if (p === "/admin" || p.indexOf("/admin/") === 0) return true;
  if (p === "/api" || p.indexOf("/api/") === 0) return true;
  if (p.indexOf("/_vercel/") === 0 || p.indexOf("/_next/image") === 0 || p.indexOf("/_next/data/") === 0) {
    return true;
  }
  if (p === "/sw.js") return true;
  // React Server Component payloads: serving one cached from another build (or
  // for another router state) breaks hydration and client navigation
  var h = request.headers;
  if (
    h.get("RSC") === "1" ||
    h.has("Next-Router-State-Tree") ||
    h.has("Next-Router-Prefetch") ||
    h.has("Next-Router-Segment-Prefetch") ||
    h.has("Next-Action") ||
    url.searchParams.has("_rsc")
  ) {
    return true;
  }
  return false;
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;
  // a devtools quirk: only-if-cached outside same-origin mode throws
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (bypass(request, url)) return;

  if (url.pathname.indexOf("/_next/static/") === 0) {
    event.respondWith(cacheFirst(event, request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(navigate(event));
    return;
  }
  if (!url.search && SHELL.indexOf(url.pathname) !== -1 && url.pathname !== OFFLINE_URL) {
    event.respondWith(staleWhileRevalidate(event, request));
  }
  // everything else: the browser's own HTTP cache, as if there were no worker
});

function cacheable(response) {
  return response && response.status === 200 && response.type === "basic";
}

function cacheFirst(event, request) {
  return caches.open(STATIC_CACHE).then(function (cache) {
    return cache.match(request).then(function (hit) {
      if (hit) return hit;
      return fetch(request).then(function (response) {
        if (cacheable(response)) {
          event.waitUntil(
            cache
              .put(request, response.clone())
              .then(function () {
                return trim(cache);
              })
              .catch(function () {})
          );
        }
        return response;
      });
    });
  });
}

/** Oldest first (Cache keys keep insertion order) until under the cap. */
function trim(cache) {
  return cache.keys().then(function (keys) {
    var extra = keys.length - STATIC_MAX_ENTRIES;
    var jobs = [];
    for (var i = 0; i < extra; i++) jobs.push(cache.delete(keys[i]));
    return Promise.all(jobs);
  });
}

function withTimeout(promise, ms) {
  return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () {
      reject(new Error("timeout"));
    }, ms);
    promise.then(
      function (value) {
        clearTimeout(timer);
        resolve(value);
      },
      function (err) {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function navigate(event) {
  var attempt = Promise.resolve(event.preloadResponse).then(function (preloaded) {
    return preloaded || fetch(event.request);
  });
  return withTimeout(attempt, NAV_TIMEOUT_MS).catch(function () {
    return caches.open(SHELL_CACHE).then(function (cache) {
      return cache.match(OFFLINE_URL).then(function (offline) {
        return offline || Response.error();
      });
    });
  });
}

function staleWhileRevalidate(event, request) {
  return caches.open(SHELL_CACHE).then(function (cache) {
    return cache.match(request, { ignoreVary: true }).then(function (hit) {
      var refresh = fetch(request).then(function (response) {
        if (cacheable(response)) {
          return cache.put(request, response.clone()).then(function () {
            return response;
          });
        }
        return response;
      });
      if (hit) {
        event.waitUntil(refresh.catch(function () {}));
        return hit;
      }
      return refresh;
    });
  });
}
