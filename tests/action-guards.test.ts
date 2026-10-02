import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * A Server Action is a public POST endpoint. Next gives every exported async
 * function in a "use server" module an action id, and anyone holding that id
 * can call it directly — middleware.ts's /admin gate does not run for it, and
 * the page that renders the form is irrelevant. So every exported action must
 * check the session ITSELF, through requireStaff() / requireOwner() or a local
 * helper that calls one.
 *
 * This is a source scan (TypeScript AST, not regex), so it fails the moment
 * someone adds an action and forgets the guard — the quietest hole there is,
 * because the form still works perfectly for the people who are signed in.
 */

const ROOT = fileURLToPath(new URL("..", import.meta.url));
/**
 * Where to look. The admin panel is where the actions live today, but a
 * "use server" module anywhere in the app is just as POST-able, so the whole
 * source tree is scanned and a new public action has to be allow-listed here.
 */
const SCAN_DIRS = ["app", "components", "lib"].map((d) => path.join(ROOT, d));

/** The functions that actually enforce a session (app/admin/_lib/server.ts). */
const GUARDS = new Set(["requireStaff", "requireOwner"]);

/**
 * Actions that are public ON PURPOSE. Each entry says why it is safe to call
 * without a session — and is checked to still exist, so the list can't rot
 * into a set of names that silently exempt whatever reuses them later.
 */
const PUBLIC_ACTIONS: Record<string, string> = {
  signOut: "ends the caller's own session; with no session it is a no-op",
  requestPasswordReset:
    "the 'forgot password' form — unauthenticated by definition; answers identically for unknown addresses, allow-lists the link origin, rate-limited per IP and per address",
  redeemToken:
    "the POST behind /admin/auth/confirm (invite / reset link): authorised by the one-time hashed token it consumes, not by a session — the redeemer has no account yet, or has lost their password",
  createOwnerAccount:
    "first-run owner bootstrap on /admin/login: only for the OWNER_EMAIL address and only while the panel has no owner, so there is no staff session to check yet",
};

/**
 * A public action is a brute-force target (token guessing, reset spam, owner
 * races), so each one except signOut must hit the shared, cross-instance rate
 * limiter (lib/security's consumeLimit → consume_security_limit).
 */
const RATE_LIMITERS = new Set(["consumeLimit"]);
const NEEDS_NO_LIMIT = new Set(["signOut"]);

type ActionFn = { file: string; name: string; guarded: boolean; limited: boolean };

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

const parse = (file: string) =>
  ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);

const isDirective = (s: ts.Statement | undefined) =>
  !!s &&
  ts.isExpressionStatement(s) &&
  ts.isStringLiteral(s.expression) &&
  s.expression.text === "use server";

/** A file is a server-action module only if "use server" is its prologue. */
function isUseServerModule(sf: ts.SourceFile) {
  for (const s of sf.statements) {
    if (isDirective(s)) return true;
    if (!(ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression))) return false;
  }
  return false;
}

/** Every identifier called anywhere inside `node` (`f()`, `await f()`, `f?.()`). */
function calledNames(node: ts.Node): Set<string> {
  const names = new Set<string>();
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) names.add(n.expression.text);
    ts.forEachChild(n, visit);
  };
  visit(node);
  return names;
}

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) =>
  ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === kind);

/** Top-level functions (declarations and `const f = async () => …`) of a module. */
function topLevelFunctions(sf: ts.SourceFile) {
  const fns: { name: string; body: ts.Node; exported: boolean; async: boolean }[] = [];
  for (const s of sf.statements) {
    if (ts.isFunctionDeclaration(s) && s.body) {
      const exported = hasModifier(s, ts.SyntaxKind.ExportKeyword);
      const name = s.name?.text ?? (hasModifier(s, ts.SyntaxKind.DefaultKeyword) ? "default" : "");
      fns.push({ name, body: s.body, exported, async: hasModifier(s, ts.SyntaxKind.AsyncKeyword) });
    } else if (ts.isVariableStatement(s)) {
      const exported = hasModifier(s, ts.SyntaxKind.ExportKeyword);
      for (const d of s.declarationList.declarations) {
        const init = d.initializer;
        if (
          ts.isIdentifier(d.name) &&
          init &&
          (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
        ) {
          fns.push({
            name: d.name.text,
            body: init.body,
            exported,
            async: hasModifier(init, ts.SyntaxKind.AsyncKeyword),
          });
        }
      }
    }
  }
  return fns;
}

/**
 * Exported actions of one "use server" module, each resolved against a set of
 * root functions: does it call one, directly or through local helpers?
 */
function actionsIn(file: string): ActionFn[] {
  const sf = parse(file);
  const fns = topLevelFunctions(sf);
  const calls = new Map(fns.map((f) => [f.name, calledNames(f.body)]));

  // fixpoint: a local helper counts if it calls a root (transitively)
  const closure = (roots: Set<string>) => {
    const reach = new Set(roots);
    for (let changed = true; changed; ) {
      changed = false;
      for (const f of fns) {
        if (reach.has(f.name)) continue;
        if ([...(calls.get(f.name) ?? [])].some((c) => reach.has(c))) {
          reach.add(f.name);
          changed = true;
        }
      }
    }
    return (name: string) => [...(calls.get(name) ?? [])].some((c) => reach.has(c));
  };
  const callsGuard = closure(GUARDS);
  const callsLimiter = closure(RATE_LIMITERS);

  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  return fns
    .filter((f) => f.exported)
    .map((f) => ({ file: rel, name: f.name, guarded: callsGuard(f.name), limited: callsLimiter(f.name) }));
}

/** Inline `"use server"` inside a function body — also a POST-able action. */
function inlineActions(file: string) {
  const sf = parse(file);
  const found: { file: string; line: number; guarded: boolean }[] = [];
  const visit = (n: ts.Node) => {
    if (
      (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n)) &&
      n.body &&
      ts.isBlock(n.body) &&
      isDirective(n.body.statements[0])
    ) {
      const names = calledNames(n.body);
      found.push({
        file: path.relative(ROOT, file).split(path.sep).join("/"),
        line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
        guarded: [...names].some((c) => GUARDS.has(c)),
      });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
}

const files = SCAN_DIRS.flatMap((d) => walk(d));
const relRoot = (f: string) => path.relative(ROOT, f).split(path.sep).join("/");
const modules = files.filter((f) => isUseServerModule(parse(f)));
const actions = modules.flatMap(actionsIn);

describe("server actions (\"use server\" anywhere in app/, components/, lib/)", () => {
  it("finds the action modules (the scan itself is working)", () => {
    const rel = modules.map(relRoot);
    expect(rel).toEqual(expect.arrayContaining(["app/admin/actions.ts", "app/admin/content-actions.ts"]));
    expect(actions.length).toBeGreaterThan(5);
  });

  it("does not mistake a module that merely mentions \"use server\" for one", () => {
    // _lib/server.ts talks about "use server" modules in a comment
    const rel = modules.map(relRoot);
    expect(rel).not.toContain("app/admin/_lib/server.ts");
  });

  it("every exported action calls requireStaff / requireOwner (or a helper that does)", () => {
    const unguarded = actions
      .filter((a) => !a.guarded && !(a.name in PUBLIC_ACTIONS))
      .map((a) => `${a.file} → ${a.name}()`);
    expect(unguarded).toEqual([]);
  });

  it("every allow-listed public action still exists (no stale exemptions)", () => {
    const names = new Set(actions.map((a) => a.name));
    const stale = Object.keys(PUBLIC_ACTIONS).filter((n) => !names.has(n));
    expect(stale).toEqual([]);
  });

  it("every intentionally public action (bar signOut) is rate-limited", () => {
    const unlimited = actions
      .filter((a) => a.name in PUBLIC_ACTIONS && !NEEDS_NO_LIMIT.has(a.name) && !a.limited)
      .map((a) => `${a.file} → ${a.name}()`);
    expect(unlimited).toEqual([]);
  });

  it("allow-listed names are not reused by a second, different action", () => {
    const dupes = Object.keys(PUBLIC_ACTIONS).filter(
      (n) => actions.filter((a) => a.name === n).length > 1
    );
    expect(dupes).toEqual([]);
  });

  it("inline \"use server\" functions are guarded too", () => {
    const bad = files
      .flatMap(inlineActions)
      .filter((a) => !a.guarded)
      .map((a) => `${a.file}:${a.line}`);
    expect(bad).toEqual([]);
  });
});
