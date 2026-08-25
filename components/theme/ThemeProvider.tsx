"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { THEME_KEY, type Theme } from "@/lib/theme";

export type { Theme };

type Ctx = {
  /** the theme currently painted, or null until mounted */
  theme: Theme | null;
  /** true once the client has read the stored/system preference */
  mounted: boolean;
  /** writes <html data-theme> synchronously, then syncs React + storage */
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<Ctx>({
  theme: null,
  mounted: false,
  setTheme: () => {},
});

/**
 * Owns the site's light/dark state. The *paint* is driven by a `data-theme`
 * attribute on <html> (stamped pre-hydration by ThemeScript), so this provider
 * is only the bookkeeping: it mirrors that attribute into React for the few
 * components that need to branch on it (the WebGL scenes), and persists the
 * choice. `setTheme` mutates the DOM synchronously so it can be called from
 * inside a View Transition callback.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme | null>(null);

  useEffect(() => {
    const attr = document.documentElement.dataset.theme;
    setThemeState(attr === "dark" ? "dark" : "light");
  }, []);

  // follow the OS while the visitor hasn't made an explicit choice
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(THEME_KEY);
      } catch {}
      if (stored === "light" || stored === "dark") return;
      const next: Theme = mq.matches ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      setThemeState(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    // synchronous DOM write — this is what a View Transition snapshots
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
    setThemeState(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, mounted: theme !== null, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
