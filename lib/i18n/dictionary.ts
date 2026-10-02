/**
 * Dictionary access.
 *
 *   getDictionary(lang)      SERVER components / generateMetadata — every
 *                            namespace, with a typed `t()`.
 *   getClientMessages(lang)  what the [lang] layout hands SiteChrome →
 *                            I18nProvider: only CLIENT_NAMESPACES, already
 *                            resolved for one locale.
 *
 * NEUTRAL MODULE, but treat it as server-side: importing it from a client
 * component would bundle every language's strings into that chunk. Client
 * components read strings with `useI18n()` (components/i18n/I18nProvider).
 *
 * Fallback order: lang → en → the key itself.
 */
import { defaultLocale, type Locale } from "./config";
import {
  CLIENT_NAMESPACES,
  namespaces,
  type ClientMessages,
  type Messages,
  type NamespaceName,
} from "./messages";
import { createTranslator, mergeMessages, type Leaves, type Translator } from "./translate";

export type MessageKey = Leaves<Messages>;
export type ClientMessageKey = Leaves<ClientMessages>;

function resolve(lang: Locale, names: readonly NamespaceName[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of names) {
    const ns = namespaces[name];
    const merged =
      lang === defaultLocale ? ns.en : mergeMessages<Record<string, unknown>>(ns.en, ns[lang]);
    Object.assign(out, merged);
  }
  return out;
}

const ALL = Object.keys(namespaces) as NamespaceName[];
const cache = new Map<Locale, { messages: Messages; t: Translator<MessageKey> }>();

export type Dictionary = {
  lang: Locale;
  messages: Messages;
  t: Translator<MessageKey>;
};

export function getDictionary(lang: Locale): Dictionary {
  let hit = cache.get(lang);
  if (!hit) {
    const messages = resolve(lang, ALL) as Messages;
    hit = { messages, t: createTranslator<MessageKey>(messages) };
    cache.set(lang, hit);
  }
  return { lang, ...hit };
}

export function getClientMessages(lang: Locale): ClientMessages {
  return resolve(lang, CLIENT_NAMESPACES) as ClientMessages;
}
