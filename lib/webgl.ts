/**
 * Tracks whether `el` is on screen — used to pause anything that animates
 * (the hero's curved reel, the Services header key) the moment it leaves the
 * viewport. Returns a disconnect function.
 *
 * (The file keeps its old name: v1 held the WebGL probe here. The 3D scenes and
 * `wants3D()` were removed in the v2 redesign; nothing on the site uses WebGL.)
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
