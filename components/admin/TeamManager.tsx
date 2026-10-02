"use client";

import { useActionState, useState, useTransition } from "react";
import {
  copyInviteLink,
  disableMember,
  enableMember,
  inviteMember,
  removeMember,
  resendInvite,
  revokeInvite,
  sendMemberReset,
  type InviteOutcome,
} from "@/app/admin/team-actions";
import { Card, CardTitle, Field, Input, Pill, SubmitButton } from "./ui";
import { OutcomeNotice, RowButton } from "./TeamParts";

/**
 * One row on /admin/team, built server-side in the page. Members are profiles
 * (keyed by id); pending invites have no account yet (keyed by email).
 */
export type TeamRowView = {
  key: string;
  kind: "member" | "invite";
  /** profile id — members only */
  id: string | null;
  email: string | null;
  full_name: string | null;
  role: "owner" | "admin";
  status: "active" | "disabled" | "pending";
  /** preformatted on the server, so the client can't hydrate a different date */
  detail: string;
};

export function InviteForm() {
  const [outcome, action] = useActionState<InviteOutcome | null, FormData>(
    async (_prev, fd) => inviteMember(fd),
    null
  );

  return (
    <Card>
      <CardTitle hint="They get a link to choose their own password — you never see it. Teammates join as admins: they can edit all of the site’s content; only you manage the team. Links last 7 days.">
        Invite a teammate
      </CardTitle>
      <form action={action} className="space-y-4">
        <OutcomeNotice outcome={outcome} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <Input
              name="email"
              type="email"
              required
              autoComplete="off"
              placeholder="teammate@example.com"
            />
          </Field>
          <Field label="Full name (optional)">
            <Input name="full_name" maxLength={120} placeholder="Jhade Banquiao" />
          </Field>
        </div>
        <SubmitButton pendingLabel="Sending…">Send invite</SubmitButton>
      </form>
    </Card>
  );
}

type RowAction = (fd: FormData) => Promise<InviteOutcome>;

const STATUS_PILL: Record<TeamRowView["status"], { label: string; tone: "live" | "draft" | "muted" }> = {
  active: { label: "Active", tone: "live" },
  pending: { label: "Pending", tone: "draft" },
  disabled: { label: "Disabled", tone: "muted" },
};

export function TeamList({
  rows,
  me,
  canManage,
  hasServiceKey,
}: {
  rows: TeamRowView[];
  me: string;
  /** the owner — the only one who manages the team */
  canManage: boolean;
  hasServiceKey: boolean;
}) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<InviteOutcome | null>(null);
  const [copied, setCopied] = useState(false);

  function run(row: TeamRowView, fn: RowAction, copy = false) {
    const fd = new FormData();
    if (row.id) fd.set("id", row.id);
    if (row.email) fd.set("email", row.email);
    setBusy(row.key);
    start(async () => {
      try {
        setOutcome(await fn(fd));
        setCopied(copy);
      } catch {
        setOutcome({ ok: false, message: "Something went wrong — please try again." });
      } finally {
        setBusy(null);
      }
    });
  }

  const count = (s: TeamRowView["status"]) => rows.filter((r) => r.status === s).length;
  const summary = [
    `${count("active")} active`,
    count("pending") && `${count("pending")} invite${count("pending") === 1 ? "" : "s"} pending`,
    count("disabled") && `${count("disabled")} disabled`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card>
      <CardTitle hint={`${summary}.`}>The team</CardTitle>

      {outcome && (
        <div className="mb-5">
          <OutcomeNotice outcome={outcome} autoCopy={copied} />
        </div>
      )}

      <ul className="divide-y divide-mist/70">
        {rows.map((r) => {
          const isMe = r.id === me;
          const manageable = canManage && hasServiceKey && !isMe && r.role !== "owner";
          const rowBusy = pending && busy === r.key;
          const label = r.full_name || r.email || "Unknown";
          const pill = STATUS_PILL[r.status];

          return (
            <li
              key={r.key}
              className="flex flex-wrap items-center gap-x-3 gap-y-2.5 py-3.5 first:pt-0 last:pb-0"
            >
              <span
                aria-hidden
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold ${
                  r.status === "active"
                    ? "bg-accent text-paper"
                    : "border border-mist/70 text-ink/50"
                }`}
              >
                {label.slice(0, 1).toUpperCase()}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="truncate">{label}</span>
                  {isMe && <span className="text-ink/45">(you)</span>}
                  <Pill tone={pill.tone}>{pill.label}</Pill>
                </p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-slatey">
                  {r.full_name && r.email ? `${r.email} · ` : ""}
                  {r.detail}
                </p>
              </div>

              {manageable && r.kind === "invite" && (
                <div className="flex flex-wrap items-center gap-2">
                  <RowButton disabled={rowBusy} onClick={() => run(r, resendInvite)}>
                    Resend
                  </RowButton>
                  <RowButton
                    disabled={rowBusy}
                    title="Make a fresh link to send by chat — it replaces any earlier one"
                    onClick={() => run(r, copyInviteLink, true)}
                  >
                    Copy link
                  </RowButton>
                  <RowButton
                    danger
                    disabled={rowBusy}
                    onClick={() => {
                      if (!confirm(`Revoke the invite for ${r.email}? Their link stops working.`)) return;
                      run(r, revokeInvite);
                    }}
                  >
                    Revoke
                  </RowButton>
                </div>
              )}

              {manageable && r.kind === "member" && (
                <div className="flex flex-wrap items-center gap-2">
                  <Pill>{r.role}</Pill>
                  {r.status === "active" && (
                    <RowButton
                      disabled={rowBusy}
                      title="Email them a link to choose a new password — you never see it"
                      onClick={() => {
                        if (!confirm(`Send ${r.email} a password reset link? Saving a new password signs them out everywhere.`)) return;
                        run(r, sendMemberReset);
                      }}
                    >
                      Send reset
                    </RowButton>
                  )}
                  {r.status === "disabled" ? (
                    <RowButton disabled={rowBusy} onClick={() => run(r, enableMember)}>
                      Enable
                    </RowButton>
                  ) : (
                    <RowButton
                      disabled={rowBusy}
                      onClick={() => {
                        if (!confirm(`Disable ${r.email}? They’re signed out everywhere straight away and can’t sign in until you re-enable them.`)) return;
                        run(r, disableMember);
                      }}
                    >
                      Disable
                    </RowButton>
                  )}
                  <RowButton
                    danger
                    disabled={rowBusy}
                    onClick={() => {
                      if (!confirm(`Remove ${r.email} from the panel? Their account is deleted. (Disable keeps it and can be undone.)`)) return;
                      run(r, removeMember);
                    }}
                  >
                    Remove
                  </RowButton>
                </div>
              )}

              {!manageable && <Pill>{r.kind === "invite" ? "invited" : r.role}</Pill>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
