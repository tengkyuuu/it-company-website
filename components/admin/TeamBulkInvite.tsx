"use client";

import { useRef, useState, useTransition } from "react";
import { inviteTeam, type BulkResult } from "@/app/admin/team-actions";
import { Banner, Card, CardTitle, Input, Pill, Textarea } from "./ui";
import { LinkBox, RowButton } from "./TeamParts";

/** One person from the public roster, and whether they're already on the panel. */
export type RosterRow = {
  name: string;
  /** e.g. "admin · active" when a profile or pending invite matched this name, else null */
  onPanel: string | null;
};

type Row = { key: number; name: string; email: string };

const tokens = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/** "Jhade Banquiao" ≈ "Jhade Japhet Banquiao": first and last names agree. */
function sameName(a: string, b: string) {
  const x = tokens(a);
  const y = tokens(b);
  if (!x.length || !y.length) return false;
  return x[0] === y[0] && x[x.length - 1] === y[y.length - 1];
}

const EMAIL_RE = /[^\s<>,;:"'()[\]]+@[^\s<>,;:"'()[\]]+\.[a-z]{2,}/i;

/** One person per line: `Name <email>`, `email, name`, `name, email` or `email`. */
function parseList(text: string) {
  const out: { name: string; email: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const m = line.match(EMAIL_RE);
    if (!m) continue;
    const name = line
      .replace(m[0], " ")
      .replace(/[<>,;"]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    out.push({ name, email: m[0].toLowerCase() });
  }
  return out;
}

const STATUS: Record<
  BulkResult["results"][number]["status"],
  { label: string; tone: "live" | "draft" | "muted" }
> = {
  sent: { label: "Emailed", tone: "live" },
  link: { label: "Link to share", tone: "draft" },
  skipped: { label: "Skipped", tone: "muted" },
  error: { label: "Failed", tone: "muted" },
};

/**
 * "Invite the Rally's Tech team" — one row per person on the public roster
 * (getTeam()), minus anyone already on the panel or invited. Fill in emails and
 * send once; everyone joins as an admin (the only invitable role). Rows that
 * went through drop off; failures stay for another try.
 */
export default function TeamBulkInvite({ roster }: { roster: RosterRow[] }) {
  const already = roster.filter((r) => r.onPanel);
  const [rows, setRows] = useState<Row[]>(() => {
    const todo = roster.filter((r) => !r.onPanel);
    const seed = todo.length ? todo.map((r) => r.name) : [""];
    return seed.map((name, i) => ({ key: i, name, email: "" }));
  });
  const nextKey = useRef(rows.length);
  const [showPaste, setShowPaste] = useState(false);
  const [paste, setPaste] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);
  const [pending, start] = useTransition();

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addRow = (name = "", email = "") => {
    const key = nextKey.current++;
    setRows((rs) => [...rs, { key, name, email }]);
  };

  function applyPaste() {
    const people = parseList(paste);
    if (!people.length) return;
    setRows((rs) => {
      const next = rs.map((r) => ({ ...r }));
      for (const p of people) {
        if (next.some((r) => r.email.trim().toLowerCase() === p.email)) continue;
        // fill the matching roster row if there is one, else append
        const match = p.name
          ? next.find((r) => !r.email.trim() && sameName(r.name, p.name))
          : undefined;
        if (match) match.email = p.email;
        else next.push({ key: nextKey.current++, name: p.name, email: p.email });
      }
      return next;
    });
    setPaste("");
    setShowPaste(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = rows
      .filter((r) => r.email.trim())
      .map(({ name, email }) => ({ name: name.trim(), email: email.trim() }));
    if (!payload.length) {
      setResult({ ok: false, message: "Add an email address to at least one row.", results: [] });
      return;
    }
    start(async () => {
      try {
        const res = await inviteTeam(payload);
        setResult(res);
        const done = new Set(
          res.results.filter((r) => r.status !== "error").map((r) => r.email.toLowerCase())
        );
        setRows((rs) => {
          const left = rs.filter((r) => !done.has(r.email.trim().toLowerCase()));
          return left.length ? left : [{ key: nextKey.current++, name: "", email: "" }];
        });
      } catch {
        setResult({ ok: false, message: "Something went wrong — please try again.", results: [] });
      }
    });
  }

  const filled = rows.filter((r) => r.email.trim()).length;

  return (
    <Card>
      <CardTitle hint="Everyone on the public roster who isn’t on the panel yet. Add their emails and send — each gets their own link and chooses their own password. Leave a row’s email blank to skip it.">
        Invite the Rally’s Tech team
      </CardTitle>

      {already.length > 0 && (
        <p className="mb-5 text-sm leading-relaxed text-ink/60">
          <span className="text-ink/80">Already on the panel:</span>{" "}
          {already.map((r, i) => (
            <span key={r.name}>
              {r.name} <span className="font-mono text-[11px] text-slatey">({r.onPanel})</span>
              {i < already.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-3">
          <div className="hidden grid-cols-[1fr_1.3fr_auto] gap-3 sm:grid">
            {["Name", "Email", ""].map((h) => (
              <span key={h} className="font-mono text-[11px] uppercase tracking-widest text-slatey">
                {h}
              </span>
            ))}
          </div>
          {rows.map((r) => (
            <div
              key={r.key}
              className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-mist/50 p-3 sm:grid-cols-[1fr_1.3fr_auto] sm:gap-3 sm:border-0 sm:p-0"
            >
              <Input
                aria-label="Name"
                placeholder="Name"
                value={r.name}
                maxLength={120}
                onChange={(e) => update(r.key, { name: e.target.value })}
                className="col-span-2 sm:col-span-1"
              />
              <Input
                aria-label={`Email for ${r.name || "this row"}`}
                type="email"
                placeholder="name@example.com"
                autoComplete="off"
                value={r.email}
                onChange={(e) => update(r.key, { email: e.target.value })}
              />
              <button
                type="button"
                aria-label={`Remove row ${r.name}`}
                onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : rs))}
                className="justify-self-end rounded-full px-2 text-lg leading-none text-ink/40 transition-colors hover:text-ink"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <RowButton onClick={() => addRow()}>+ Add another row</RowButton>
          <RowButton onClick={() => setShowPaste((v) => !v)} aria-expanded={showPaste}>
            {showPaste ? "Hide paste box" : "Paste a list"}
          </RowButton>
        </div>

        {showPaste && (
          <div className="space-y-2">
            <Textarea
              rows={4}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={"Jhade Banquiao <jhade@example.com>\nharon@example.com, Haron Diniay"}
              aria-label="Paste one person per line"
            />
            <div className="flex items-center gap-3">
              <RowButton onClick={applyPaste}>Add to the list</RowButton>
              <span className="text-xs text-ink/45">
                One per line — matching names fill their row.
              </span>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={pending || filled === 0}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending && (
            <span
              aria-hidden
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
          )}
          {pending
            ? "Sending invites…"
            : filled
              ? `Send ${filled} invite${filled === 1 ? "" : "s"}`
              : "Send invites"}
        </button>
      </form>

      {result && (
        <div className="mt-6 space-y-3">
          <Banner result={result} />
          {result.results.length > 0 && (
            <ul className="divide-y divide-mist/70 rounded-xl border border-mist/70">
              {result.results.map((r, i) => (
                <li key={`${r.email}-${i}`} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="truncate">{r.name || r.email}</span>
                    {r.name && <span className="truncate font-mono text-[11px] text-slatey">{r.email}</span>}
                    <span className="ml-auto">
                      <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill>
                    </span>
                  </div>
                  {r.status !== "sent" && (
                    <p
                      className={`text-xs leading-relaxed ${r.status === "error" ? "text-red-700 dark:text-red-300" : "text-ink/55"}`}
                    >
                      {r.message}
                    </p>
                  )}
                  {r.status === "link" && r.link && <LinkBox link={r.link} />}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
