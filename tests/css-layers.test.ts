import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Tailwind v4 puts utilities in `@layer utilities`, and UNLAYERED CSS beats
 * every layer. So a component class that sets `display` or `position`
 * unlayered silently overrides any `hidden` / `sm:block` / `absolute` a caller
 * passes in className — no warning, it just doesn't apply. That shipped: ten
 * KeySwitches meant to hide on phones showed anyway, and /location's never
 * left the text flow (found 2026-10-25).
 *
 * The rule: a class a component puts on its ROOT next to the caller's
 * className must keep display/position inside `@layer components`.
 */

const CSS = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");

/** Every top-level-or-layered rule as { selectors, body, layered }. */
function rules(css: string) {
  const out: { selectors: string[]; body: string; layered: boolean }[] = [];
  const stack: string[] = [];
  let i = 0;
  let buf = "";
  while (i < css.length) {
    const ch = css[i];
    if (css.startsWith("/*", i)) {
      i = css.indexOf("*/", i + 2) + 2;
      continue;
    }
    if (ch === "{") {
      const prelude = buf.trim();
      buf = "";
      if (prelude.startsWith("@")) {
        stack.push(prelude);
        i++;
        continue;
      }
      const end = css.indexOf("}", i);
      out.push({
        selectors: prelude.split(",").map((s) => s.trim()),
        body: css.slice(i + 1, end),
        layered: stack.some((s) => s.startsWith("@layer")),
      });
      i = end + 1;
      continue;
    }
    if (ch === "}") {
      stack.pop();
      buf = "";
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  return out;
}

describe("component root classes yield to Tailwind utilities", () => {
  // components/fx/KeySwitch.tsx → `keyswitch ${className}`
  // components/Logo.tsx → `wm|wm-outline ${className}`
  const ROOT_CLASSES = ["keyswitch", "wm", "wm-outline"];

  it.each(ROOT_CLASSES)(".%s keeps display/position inside a layer", (cls) => {
    const offending = rules(CSS).filter(
      (r) =>
        !r.layered &&
        r.selectors.includes(`.${cls}`) &&
        /(^|[;\s])(display|position)\s*:/.test(r.body)
    );
    expect(offending.map((r) => r.selectors.join(", "))).toEqual([]);
  });

  it("the parser sees the layered rules (guards against a vacuous pass)", () => {
    const found = rules(CSS).filter((r) => r.layered && r.selectors.includes(".keyswitch"));
    expect(found.length).toBeGreaterThan(0);
  });
});
