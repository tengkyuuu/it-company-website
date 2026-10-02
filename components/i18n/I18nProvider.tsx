"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { ClientMessageKey } from "@/lib/i18n/dictionary";
import type { ClientMessages } from "@/lib/i18n/messages";
import { localizePath } from "@/lib/i18n/paths";
import { createTranslator, type Translator } from "@/lib/i18n/translate";

type I18nValue = {
  lang: Locale;
  /** typed over the `common` namespace — the only one shipped to the client */
  t: Translator<ClientMessageKey>;
  /** localizePath bound to the current locale */
  href: (path: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Hands client components the current locale and its (already resolved,
 * English-backfilled) `common` messages. Rendered by SiteChrome, so it wraps the
 * nav, every page, the footer and the chat widget on the public site. The
 * messages arrive as a prop from the server [lang] layout, so each page ships
 * exactly one language's chrome strings — and the locale is in the HTML from the
 * first byte, no client-side detection, no flash.
 */
export function I18nProvider({
  lang,
  messages,
  children,
}: {
  lang: Locale;
  messages: ClientMessages;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nValue>(
    () => ({
      lang,
      t: createTranslator<ClientMessageKey>(messages),
      href: (path: string) => localizePath(lang, path),
    }),
    [lang, messages]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Locale + `t()` for client components on the public site. Throws outside the
 * provider on purpose (the admin panel has none) — a silent fallback would
 * render raw keys like "nav.home".
 */
export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error(
      "useI18n() needs <I18nProvider> — it is rendered by SiteChrome on public pages only."
    );
  }
  return value;
}
