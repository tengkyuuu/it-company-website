/**
 * The translator: dotted-key lookup + `{placeholder}` interpolation.
 * NEUTRAL MODULE — used by `getDictionary` on the server and by
 * `components/i18n/I18nProvider` on the client.
 */

/** Every dotted path to a string leaf: { nav: { home: "" } } → "nav.home". */
export type Leaves<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${Leaves<T[K]>}`;
    }[keyof T & string];

/** Same shape, every level optional — what a non-default locale may provide. */
export type DeepPartial<T> = T extends string ? string : { [K in keyof T]?: DeepPartial<T[K]> };

export type Vars = Record<string, string | number>;

export type Translator<K extends string> = (key: K, vars?: Vars) => string;

/** Read a dotted key out of a nested message object. */
export function lookup(messages: unknown, key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    if (!node || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

/** "{count} projects" + { count: 5 } → "5 projects". Unknown names are kept. */
export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole
  );
}

/**
 * Build `t()` over an already-resolved message object. The locale → English
 * fallback happens earlier, when the messages are merged (see `dictionary.ts`),
 * so a key missing here is missing in English too — and then the key itself is
 * returned, which is loud on purpose (tests/i18n.test.ts stops it shipping).
 */
export function createTranslator<K extends string>(messages: unknown): Translator<K> {
  return (key, vars) => interpolate(lookup(messages, key) ?? key, vars);
}

/**
 * Deep-merge `override` onto `base`, keeping ONLY base's keys (English is the
 * source of truth for the shape). Empty / non-string overrides fall back to the
 * base value — that is the lang → en half of the fallback chain.
 */
export function mergeMessages<T>(base: T, override: unknown): T {
  if (typeof base === "string") {
    return (typeof override === "string" && override.trim() !== "" ? override : base) as T;
  }
  if (!base || typeof base !== "object") return base;
  const src = override && typeof override === "object" ? (override as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(base as Record<string, unknown>)) {
    out[k] = mergeMessages(v, src[k]);
  }
  return out as T;
}
