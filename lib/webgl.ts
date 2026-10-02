let webglCache: boolean | null = null;

/**
 * Client-side capability check shared by every 3D scene.
 *
 * Probed ONCE per page lifetime and the probe context is released straight
 * away. It used to create a fresh WebGL context on every call (Hero,
 * ServicesGalaxy and ServicesGlyph each asked) and leave it for the GC —
 * a real context per call, against a browser cap of ~16.
 */
export function webglOK(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl") ||
      c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    webglCache = !!(window.WebGLRenderingContext && gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglCache = false;
  }
  return webglCache;
}

/** True when it's worth mounting a WebGL scene at all. */
export function wants3D(): boolean {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const big = window.matchMedia("(min-width: 768px)").matches;
  return big && !reduce && webglOK();
}

/**
 * Tracks whether `el` is on screen. 3D scenes use this to stop rendering the
 * moment their section leaves the viewport — an r3f canvas otherwise keeps
 * drawing at 60fps forever, visible or not. Returns a disconnect function.
 */
export function observeVisible(
  el: Element,
  cb: (visible: boolean) => void,
  rootMargin = "0px"
): () => void {
  const io = new IntersectionObserver(
    (entries) => {
      const e = entries[entries.length - 1];
      if (e) cb(e.isIntersecting);
    },
    { rootMargin }
  );
  io.observe(el);
  return () => io.disconnect();
}
