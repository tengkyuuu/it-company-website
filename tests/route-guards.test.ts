import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileRow } from "@/lib/supabase/types";

/**
 * Route Handlers under app/api/admin/** are the panel's other public POST
 * endpoints (autosave today). Exactly like a Server Action, anyone can call
 * one directly — middleware.ts doesn't even run for /api — so each exported
 * HTTP handler must check the session ITSELF through requireStaffForRoute()
 * (or a local helper that calls it). A forgotten guard is silent: the editor
 * keeps working perfectly for the people who are signed in.
 *
 * Same AST approach as action-guards.test.ts.
 */

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ADMIN_API = path.join(ROOT, "app", "api", "admin");
const METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
const GUARDS = new Set(["requireStaffForRoute"]);

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
  const reach = new Set(GUARDS);
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
    .map((f) => ({
      route: `${rel} → ${f.name}`,
      guarded: [...(calls.get(f.name) ?? [])].some((c) => reach.has(c)),
    }));
}

const routes = walk(ADMIN_API);
const handlers = routes.flatMap(handlersIn);

describe("admin Route Handlers (app/api/admin/**)", () => {
  it("finds them (the scan itself is working)", () => {
    expect(handlers.map((h) => h.route)).toContain("app/api/admin/autosave/route.ts → POST");
  });

  it("every exported HTTP handler calls requireStaffForRoute (or a helper that does)", () => {
    expect(handlers.filter((h) => !h.guarded).map((h) => h.route)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// …and the guard actually refuses
// ---------------------------------------------------------------------------

type Access =
  | { state: "signed-out"; profile: null }
  | { state: "no-access"; profile: null; reason: string }
  | { state: "ok"; profile: ProfileRow };

const getAccess = vi.fn<() => Promise<Access>>();
vi.mock("@/lib/supabase/server", () => ({
  getAccess: () => getAccess(),
  getProfile: async () => (await getAccess()).profile,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const { requireStaffForRoute } = await import("@/app/admin/_lib/server");

beforeEach(() => getAccess.mockReset());

describe("requireStaffForRoute", () => {
  it("answers 401 JSON (not a redirect) when signed out — fetch would follow a redirect to HTML", async () => {
    getAccess.mockResolvedValue({ state: "signed-out", profile: null });
    const gate = await requireStaffForRoute();
    expect("response" in gate).toBe(true);
    if ("response" in gate) {
      expect(gate.response.status).toBe(401);
      expect(gate.response.headers.get("content-type")).toMatch(/application\/json/);
      expect(await gate.response.json()).toMatchObject({ ok: false });
    }
  });

  it("answers 403 for a signed-in account without panel access (disabled, revoked, never invited)", async () => {
    getAccess.mockResolvedValue({ state: "no-access", profile: null, reason: "disabled" });
    const gate = await requireStaffForRoute();
    expect("response" in gate && gate.response.status).toBe(403);
  });

  it("lets staff through with their profile", async () => {
    const profile = { id: "admin-id", email: "a@example.test", full_name: null, role: "admin" } as ProfileRow;
    getAccess.mockResolvedValue({ state: "ok", profile });
    expect(await requireStaffForRoute()).toEqual({ profile });
  });
});
