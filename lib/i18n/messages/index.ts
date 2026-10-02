/**
 * Namespace registry. Each namespace is a pair of files, `en/<ns>.ts` (source of
 * truth) and `fil/<ns>.ts` (may lag; falls back to English per key).
 *
 *   common  — client chrome; shipped to the browser (CLIENT_NAMESPACES)
 *   site    — server-rendered chrome (footer, page eyebrows/titles, meta titles)
 *   catalog — wave B (products / careers / blog); server-only
 *
 * Namespaces are merged flat by top-level section, so keys read `nav.home`, not
 * `common.nav.home`. tests/i18n.test.ts fails on a section-name collision.
 */
import enCommon from "./en/common";
import filCommon from "./fil/common";
import enSite from "./en/site";
import filSite from "./fil/site";
import enCatalog from "./en/catalog";
import filCatalog from "./fil/catalog";

export const namespaces = {
  common: { en: enCommon, fil: filCommon },
  site: { en: enSite, fil: filSite },
  catalog: { en: enCatalog, fil: filCatalog },
} as const;

export type NamespaceName = keyof typeof namespaces;

/** Namespaces resolved into SiteChrome's I18nProvider (i.e. sent to the client). */
export const CLIENT_NAMESPACES = ["common"] as const satisfies readonly NamespaceName[];

export type CommonMessages = typeof enCommon;
export type SiteMessages = typeof enSite;
export type CatalogMessages = typeof enCatalog;

/** Every message, all namespaces — the server dictionary's shape. */
export type Messages = CommonMessages & SiteMessages & CatalogMessages;
/** What the client receives. */
export type ClientMessages = CommonMessages;
