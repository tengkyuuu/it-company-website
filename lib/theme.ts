/**
 * Theme constants shared across the RSC boundary.
 *
 * These MUST live in a module with no "use client" directive: `ThemeScript` is a
 * server component and `ThemeProvider` is a client one, and a server component
 * importing a value out of a client module receives a client-reference proxy —
 * it serialises as `undefined`, which silently broke the persisted preference.
 */
export type Theme = "light" | "dark";

export const THEME_KEY = "mykt-theme";
