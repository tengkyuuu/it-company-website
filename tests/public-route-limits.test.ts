import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * The visitor-facing Route Handlers — the chat (send, poll, "talk to a
 * person"), the contact form and job applications — are public endpoints
 * anyone can script. Each exported HTTP handler must charge the durable,
 * cross-instance limiter (lib/security's consumeLimit), directly or through
 * a helper in the same file. A forgotten limit is silent: the form keeps
 * working, and so does whoever is hammering it.
 *
 * Scoped to these directories on purpose (other public routes authenticate
 * differently, e.g. a CI bearer token); a new route under any of them is
 * picked up automatically. Same AST approach as action-guards.test.ts.
 */

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIRS = ["chat", "contact", "apply"].map((d) => path.join(ROOT, "app", "api", d));
const METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]);
const LIMITERS = new Set(["consumeLimit"]);

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /^route\.tsx?$/.test(name) ? [full] : [];
  });
}

function calledNames(node: ts.Node): Set<string> {
  const names = new Set<string>();
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) names.add(n.expression.text);
    ts.forEachChild(n, visit);
  };
  visit(node);
  return names;
}

const isExported = (node: ts.Node) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

function handlersIn(file: string) {
  const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const fns: { name: string; body: ts.Node; exported: boolean }[] = [];
  for (const s of sf.statements) {
    if (ts.isFunctionDeclaration(s) && s.body && s.name) {
      fns.push({ name: s.name.text, body: s.body, exported: isExported(s) });
    } else if (ts.isVariableStatement(s)) {
      for (const d of s.declarationList.declarations) {
        const init = d.initializer;
        if (ts.isIdentifier(d.name) && init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          fns.push({ name: d.name.text, body: init.body, exported: isExported(s) });
        }
      }
    }
  }
  const calls = new Map(fns.map((f) => [f.name, calledNames(f.body)]));
  const reach = new Set(LIMITERS);
  for (let changed = true; changed; ) {
    changed = false;
    for (const f of fns) {
      if (!reach.has(f.name) && [...(calls.get(f.name) ?? [])].some((c) => reach.has(c))) {
        reach.add(f.name);
        changed = true;
      }
    }
  }
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  return fns
    .filter((f) => f.exported && METHODS.has(f.name))
    .map((f) => ({ route: `${rel} → ${f.name}`, limited: [...(calls.get(f.name) ?? [])].some((c) => reach.has(c)) }));
}

const handlers = DIRS.flatMap(walk).flatMap(handlersIn);

describe("public visitor routes are rate-limited", () => {
  it("finds them (the scan itself is working)", () => {
    const routes = handlers.map((h) => h.route);
    expect(routes).toEqual(
      expect.arrayContaining([
        "app/api/chat/route.ts → POST",
        "app/api/chat/messages/route.ts → GET",
        "app/api/chat/human/route.ts → POST",
        "app/api/contact/route.ts → POST",
        "app/api/apply/route.ts → POST",
      ])
    );
  });

  it("every exported handler calls consumeLimit (or a local helper that does)", () => {
    expect(handlers.filter((h) => !h.limited).map((h) => h.route)).toEqual([]);
  });
});
