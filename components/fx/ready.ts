/**
 * "Has the opening sequence finished?" — as state, not just an event.
 *
 * `mykt:ready` fires once per full load. Anything that mounts AFTER it (a
 * client-side navigation back to `/`) would otherwise wait on an event that
 * already happened and fall through to its multi-second backstop. Preloader
 * calls `markReady()`; consumers use `whenReady()`, which runs immediately if
 * the splash is already gone. Module state, so it survives route changes.
 *
 * Deliberately not a "use client" module: it holds no React, and keeping
 * shared values out of client modules avoids the RSC-boundary trap noted in
 * lib/theme.ts.
 */
let ready = false;

export function markReady() {
  if (ready) return;
  ready = true;
  window.dispatchEvent(new Event("mykt:ready"));
}

export function isReady() {
  return ready;
}

/** Runs `cb` once the splash is done (now, if it already is). Returns an unsubscribe. */
export function whenReady(cb: () => void): () => void {
  if (ready) {
    cb();
    return () => {};
  }
  window.addEventListener("mykt:ready", cb, { once: true });
  return () => window.removeEventListener("mykt:ready", cb);
}
