import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  asAnon,
  asService,
  asUser,
  createAuthUser,
  createStaff,
  createTestDb,
  epoch,
  one,
  type Claims,
} from "./helpers/db";

/**
 * Who can see what, with the anon key that ships in every visitor's browser.
 *
 * Supabase grants anon ALL on public tables by default (the harness does the
 * same), so "can't read" has to come from RLS or an explicit revoke. Every
 * private table is seeded with a row first, so "sees nothing" means the gate
 * held — not that the table happened to be empty.
 */

/** Tables nobody outside the staff may read. */
const STAFF_TABLES = [
  "leads",
  "auth_tokens",
  "activity_log",
  "content_revisions",
  "chat_sessions",
  "chat_messages",
  "lead_replies",
  "security_limits",
  "invitations",
  "profiles",
] as const;

/** Never readable through the client keys at all, staff included. */
const SERVICE_ONLY = ["auth_tokens", "security_limits"] as const;

/** Content with a draft state: the world sees published rows only. */
const PUBLISHABLE = ["projects", "products", "jobs", "posts", "services", "team_members"] as const;

/** Rows visible to the current role, or "denied" if the table is closed to it. */
async function visible(db: PGlite, table: string): Promise<number | "denied"> {
  try {
    const res = await db.query<{ n: number }>(`select count(*)::int as n from public.${table}`);
    return res.rows[0].n;
  } catch (e) {
    if (/permission denied/i.test(String(e))) return "denied";
    throw e;
  }
}

async function seedPrivateRows(db: PGlite) {
  const owner = await createStaff(db, "owner", { fullName: "Olive Owner" });
  const sessionId = randomUUID();
  await db.exec(`
    insert into public.leads (kind, name, email, message, ip_hash)
      values ('contact', 'Visitor', 'visitor@example.test', 'Hello', 'h1');
    insert into public.lead_replies (lead_id, to_email, subject, body, status, sent_at)
      select id, 'visitor@example.test', 'Re: your enquiry', 'Thanks!', 'sent', now()
        from public.leads limit 1;
    insert into public.auth_tokens (token_hash, purpose, email, expires_at)
      values ('${"a".repeat(64)}', 'invite', 'new@example.test', now() + interval '1 day');
    insert into public.activity_log (action, entity_type, entity_id)
      values ('auth.login', 'profiles', '${owner.id}');
    insert into public.content_revisions (entity_type, entity_id, snapshot)
      values ('projects', '${randomUUID()}', '{"name":"x"}');
    insert into public.chat_sessions (id, ip_hash) values ('${sessionId}', 'h1');
    insert into public.chat_messages (session_id, role, content)
      values ('${sessionId}', 'visitor', 'hi there');
    insert into public.security_limits (key, hits, window_ends_at)
      values ('seed', 1, now() + interval '1 hour');
    insert into public.invitations (email, full_name) values ('invitee@example.test', 'In Vitee');
  `);
  return { owner, sessionId };
}

async function seedPublishable(db: PGlite) {
  // one published + one draft in every table that has a draft state
  await db.exec(`
    insert into public.projects (slug, name, published) values ('pub-p', 'Pub', true), ('draft-p', 'Draft', false);
    insert into public.products (slug, name, published) values ('pub-pr', 'Pub', true), ('draft-pr', 'Draft', false);
    insert into public.jobs     (slug, title, published) values ('pub-j', 'Pub', true), ('draft-j', 'Draft', false);
    insert into public.posts    (slug, title, published) values ('pub-po', 'Pub', true), ('draft-po', 'Draft', false);
    insert into public.services (slug, title, published) values ('pub-s', 'Pub', true), ('draft-s', 'Draft', false);
    insert into public.team_members (name, published) values ('Pub', true), ('Draft', false);
  `);
}

describe("row level security", () => {
  let db: PGlite;
  let owner: { id: string; email: string };
  let sessionId: string;

  beforeAll(async () => {
    db = await createTestDb();
    ({ owner, sessionId } = await seedPrivateRows(db));
    await seedPublishable(db);
  });

  afterAll(async () => {
    await db?.close();
  });

  describe("anon (the public key)", () => {
    it("the seed really is there (as postgres)", async () => {
      for (const t of STAFF_TABLES) expect(await visible(db, t), t).toBeGreaterThan(0);
    });

    it.each(STAFF_TABLES)("can't read %s", async (table) => {
      const seen = await asAnon(db, () => visible(db, table));
      expect(["denied", 0]).toContain(seen);
    });

    it.each(PUBLISHABLE)("reads only published %s", async (table) => {
      const drafts = await asAnon(db, async () => {
        const res = await db.query<{ n: number }>(
          `select count(*) filter (where not published)::int as n from public.${table}`
        );
        return res.rows[0].n;
      });
      const total = await asAnon(db, () => visible(db, table));
      expect(drafts).toBe(0);
      expect(total).toBeGreaterThanOrEqual(1);
    });

    it("can't insert a lead (only the service-role API routes may)", async () => {
      await expect(
        asAnon(db, () =>
          db.query("insert into public.leads (kind, name, message) values ('contact', 'spam', 'buy now')")
        )
      ).rejects.toThrow(/row-level security|permission denied/);
    });

    it("can't write content", async () => {
      await expect(
        asAnon(db, () => db.query("insert into public.projects (slug, name, published) values ('x', 'x', true)"))
      ).rejects.toThrow(/row-level security|permission denied/);

      // an UPDATE that RLS filters is a silent zero-row success, so check the effect
      await asAnon(db, () => db.query("update public.projects set name = 'pwned' where slug = 'pub-p'")).catch(
        () => undefined
      );
      const { name } = await one<{ name: string }>(db, "select name from public.projects where slug = 'pub-p'");
      expect(name).toBe("Pub");
    });

    it("can read the public singletons (settings, status, site revision)", async () => {
      for (const t of ["site_settings", "status_reports", "site_revision"]) {
        expect(await asAnon(db, () => visible(db, t)), t).not.toBe("denied");
      }
      expect(await asAnon(db, () => visible(db, "site_settings"))).toBe(1);
      expect(await asAnon(db, () => visible(db, "site_revision"))).toBe(1);
    });

    it("can't bump the site revision or forge a status report", async () => {
      await expect(
        asAnon(db, () => db.query("update public.site_revision set rev = rev + 1000"))
      ).rejects.toThrow(/permission denied/);
      await expect(
        asAnon(db, () =>
          db.query(`insert into public.status_reports (kind, payload) values ('tests', '{"passed": 999}')`)
        )
      ).rejects.toThrow(/permission denied/);
    });

    it("can't call revoke_user_sessions", async () => {
      await expect(
        asAnon(db, () => db.query("select public.revoke_user_sessions($1)", [owner.id]))
      ).rejects.toThrow(/permission denied/);
    });

    it("can't upload to the work bucket", async () => {
      await expect(
        asAnon(db, () =>
          db.query("insert into storage.objects (bucket_id, name) values ('work', 'evil.png')")
        )
      ).rejects.toThrow(/row-level security|permission denied/);
    });
  });

  describe("a signed-in user with no profile (an uninvited sign-up)", () => {
    it.each(STAFF_TABLES)("can't read %s", async (table) => {
      const stranger = await createAuthUser(db);
      const seen = await asUser(db, { sub: stranger.id }, () => visible(db, table));
      expect(["denied", 0]).toContain(seen);
    });

    it("can't read draft content", async () => {
      const stranger = await createAuthUser(db);
      const n = await asUser(db, { sub: stranger.id }, async () => {
        const res = await db.query<{ n: number }>(
          "select count(*)::int as n from public.projects where not published"
        );
        return res.rows[0].n;
      });
      expect(n).toBe(0);
    });

    it("can't create a profile for itself", async () => {
      const stranger = await createAuthUser(db);
      await expect(
        asUser(db, { sub: stranger.id }, () =>
          db.query("insert into public.profiles (id, email, role) values ($1, $2, 'admin')", [
            stranger.id,
            stranger.email,
          ])
        )
      ).rejects.toThrow(/row-level security|permission denied/);
    });
  });

  describe("staff", () => {
    it.each(SERVICE_ONLY)("even the owner can't read %s through the client key", async (table) => {
      const seen = await asUser(db, { sub: owner.id }, () => visible(db, table));
      expect(["denied", 0]).toContain(seen);
    });

    it("an admin reads leads and drafts", async () => {
      const admin = await createStaff(db, "admin");
      const leads = await asUser(db, { sub: admin.id }, () => visible(db, "leads"));
      expect(leads).toBeGreaterThan(0);
      const drafts = await asUser(db, { sub: admin.id }, async () => {
        const res = await db.query<{ n: number }>(
          "select count(*)::int as n from public.projects where not published"
        );
        return res.rows[0].n;
      });
      expect(drafts).toBeGreaterThan(0);
    });

    it("an admin reads live chats and inbox replies", async () => {
      const admin = await createStaff(db, "admin");
      for (const t of ["chat_sessions", "chat_messages", "lead_replies"]) {
        expect(await asUser(db, { sub: admin.id }, () => visible(db, t)), t).toBeGreaterThan(0);
      }
    });

    it("only the owner reads invitations", async () => {
      const admin = await createStaff(db, "admin");
      expect(await asUser(db, { sub: admin.id }, () => visible(db, "invitations"))).toBe(0);
      expect(await asUser(db, { sub: owner.id }, () => visible(db, "invitations"))).toBeGreaterThan(0);
    });

    it("a disabled admin sees no leads", async () => {
      const admin = await createStaff(db, "admin");
      await db.query("update public.profiles set disabled = true where id = $1", [admin.id]);
      expect(await asUser(db, { sub: admin.id }, () => visible(db, "leads"))).toBe(0);
    });

    it("a token minted before revoke_user_sessions sees no leads", async () => {
      const admin = await createStaff(db, "admin");
      const oldToken: Claims & { sub: string } = { sub: admin.id, iat: epoch(-120) };
      expect(await asUser(db, oldToken, () => visible(db, "leads"))).toBeGreaterThan(0);
      await asService(db, () => db.query("select public.revoke_user_sessions($1)", [admin.id]));
      expect(await asUser(db, oldToken, () => visible(db, "leads"))).toBe(0);
    });

    it("can reply in a chat only as themselves, only as 'human'", async () => {
      const admin = await createStaff(db, "admin");
      const insert = (role: string, author: string | null) =>
        asUser(db, { sub: admin.id }, () =>
          db.query(
            "insert into public.chat_messages (session_id, role, content, author_id) values ($1, $2, 'reply', $3)",
            [sessionId, role, author]
          )
        );

      await expect(insert("human", admin.id)).resolves.toBeDefined();
      // putting words in the AI's / visitor's mouth, or signing as a colleague
      await expect(insert("ai", admin.id)).rejects.toThrow(/row-level security/);
      await expect(insert("visitor", null)).rejects.toThrow(/row-level security/);
      await expect(insert("human", owner.id)).rejects.toThrow(/row-level security/);
    });
  });
});
