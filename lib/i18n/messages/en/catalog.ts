/**
 * `catalog` namespace — reserved for wave B (products, careers, blog UI
 * strings). Server-only by default: it is NOT in CLIENT_NAMESPACES, so it never
 * ships to the browser as a dictionary — pass rendered strings (or a small
 * slice) as props to any client component that needs them.
 *
 * Add sections as top-level keys, e.g.
 *   products: { eyebrow: "Products", empty: "Nothing here yet." },
 *   careers:  { apply: "Apply" },
 * then use them with `getDictionary(lang).t("products.eyebrow")`.
 *
 * Rules (enforced by tests/i18n.test.ts):
 *  - every key must also exist in `../fil/catalog.ts`;
 *  - top-level section names must not collide with `common` / `site`
 *    (taken: nav, theme, lang, hero, work, galaxy, process, belief, showreel,
 *    preview, contact, chat, notFound, error, meta, footer, home, about,
 *    services, projects, project, location).
 */
const catalog = {};

export default catalog;
