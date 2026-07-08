/** Client-side capability check shared by every 3D scene. */
export function webglOK(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl") || c.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

/** True when it's worth mounting a WebGL scene at all. */
export function wants3D(): boolean {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const big = window.matchMedia("(min-width: 768px)").matches;
  return big && !reduce && webglOK();
}
