"use client";

import { useActionState, useTransition } from "react";
import {
  inviteUser,
  removeUser,
  updateRole,
  type ActionResult,
} from "@/app/admin/actions";
import type { ProfileRow, Role } from "@/lib/supabase/types";
import {
  Banner,
  Card,
  CardTitle,
  Field,
  Input,
  Select,
  SubmitButton,
} from "./ui";

export function InviteForm() {
  const [result, action] = useActionState<ActionResult | null, FormData>(
    async (_prev, fd) => inviteUser(fd),
    null
  );

  return (
    <Card>
      <CardTitle hint="They get an email with a link to set their password. Editors can manage projects and settings; admins can also manage the team.">
        Invite a teammate
      </CardTitle>
      <form action={action} className="space-y-4">
        {result && <Banner result={result} />}
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Field label="Email">
            <Input
              name="email"
              type="email"
              required
              placeholder="teammate@mykt.studio"
            />
          </Field>
          <Field label="Role">
            <Select name="role" defaultValue="editor">
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
        </div>
        <Field label="Full name (optional)">
          <Input name="full_name" placeholder="Jhade Banquiao" />
        </Field>
        <SubmitButton pendingLabel="Sending…">Send invite</SubmitButton>
      </form>
    </Card>
  );
}

export function TeamList({
  members,
  me,
  canManage,
}: {
  members: ProfileRow[];
  me: string;
  canManage: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardTitle hint={`${members.length} ${members.length === 1 ? "person" : "people"} with access.`}>
        The team
      </CardTitle>

      <ul className="divide-y divide-mist/70">
        {members.map((m) => {
          const isMe = m.id === me;
          return (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-3 py-3.5 first:pt-0 last:pb-0"
            >
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent font-display text-xs font-bold text-paper"
              >
                {(m.full_name || m.email || "?").slice(0, 1).toUpperCase()}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {m.full_name || m.email}
                  {isMe && <span className="ml-2 text-ink/45">(you)</span>}
                </p>
                {m.full_name && (
                  <p className="truncate font-mono text-[11px] text-slatey">
                    {m.email}
                  </p>
                )}
              </div>

              {canManage && !isMe && m.role !== "owner" ? (
                <div className="flex items-center gap-2">
                  <Select
                    defaultValue={m.role}
                    disabled={pending}
                    aria-label={`Role for ${m.email}`}
                    className="!w-auto !py-1.5 !text-xs"
                    onChange={(e) => {
                      const fd = new FormData();
                      fd.set("id", m.id);
                      fd.set("role", e.target.value as Role);
                      start(async () => {
                        await updateRole(fd);
                      });
                    }}
                  >
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </Select>
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-full border border-red-500/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                    onClick={() => {
                      if (!confirm(`Remove ${m.email} from the team?`)) return;
                      const fd = new FormData();
                      fd.set("id", m.id);
                      start(async () => {
                        await removeUser(fd);
                      });
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <span className="rounded-full border border-mist/70 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ink/55">
                  {m.role}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
