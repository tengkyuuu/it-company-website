"use client";

import { motion } from "framer-motion";

/**
 * Re-mounts on every route change → gives each page a soft fade-in.
 * Opacity-only on purpose: a transform here would break `position: fixed`
 * descendants (the WebGL canvas, sticky panels).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
