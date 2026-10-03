import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CHAT_SESSION_COLUMNS } from "@/app/admin/_lib/chats";
import { hashVisitorKey } from "@/lib/chat-session";
import { asAnon, asService, asUser, columns, createStaff, createTestDb, one } from "./helpers/db";

/**
 * The live-chat + inbox-reply contract in the real supabase/schema.sql
 * (PGlite): the trigger that keeps the console's columns honest, what staff
 * may and may not change on a session, and who can write a reply record.
 */

describe("live chat + inbox replies (schema)", () => {
  let db: PGlite;
  let admin: { id: string; email: string };

  beforeAll(async () => {
    db = await createTestDb();
    admin = await createStaff(db, "admin", { fullName: "Ada Admin" });
  });

  afterAll(async () => {
    await db?.close();
  });

  async function newSession(over: Record<string, unknown> = {}) {
    const id = randomUUID();
    await asService(db, () =>
      db.query(
        "insert into public.chat_sessions (id, visitor_key_hash, ip_hash) values ($1, $2, 'h')",
        [id, (over.hash as string) ?? hashVisitorKey("K".repeat(43))]
      )
    );
    return id;
  }

  const add = (sid: string, role: string, content: string, author: string | null = null) =>
    asService(db, () =>
      db.query("insert into public.chat_messages (session_id, role, content, author_id) values ($1, $2, $3, $4)", [
        sid,
        role,
        content,
        author,
      ])
    );

  it("has every column the console selects (app ↔ schema drift)", async () => {
    const cols = await columns(db, "chat_sessions");
    const wanted = CHAT_SESSION_COLUMNS.split(",").map((c) => c.trim());
    expect(wanted.filter((c) => !cols.has(c))).toEqual([]);
    for (const c of ["visitor_key_hash", "wants_human_at"]) expect(cols.has(c), c).toBe(true);
  });

  it("only accepts a sha256-hex visitor key hash", async () => {
    await expect(
      asService(db, () =>
        db.query("insert into public.chat_sessions (id, visitor_key_hash) values ($1, 'the-raw-key')", [randomUUID()])
      )
    ).rejects.toThrow(/visitor_key_hash_check|check constraint/);
  });

  it("the trigger keeps opening / last_visitor_at / preview / count honest", async () => {
    const sid = await newSession();
    await add(sid, "visitor", "Do you build mobile apps?");
    await add(sid, "ai", "Yes — iOS and Android.");
    const afterAi = await one<{
      opening: string;
      last_preview: string;
      last_role: string;
      message_count: number;
      last_visitor_at: string;
      last_message_at: string;
    }>(db, "select * from public.chat_sessions where id = $1", [sid]);
    expect(afterAi.opening).toBe("Do you build mobile apps?");
    expect(afterAi.last_preview).toBe("Yes — iOS and Android.");
    expect(afterAi.last_role).toBe("ai");
    expect(afterAi.message_count).toBe(2);

    // a staff reply moves last_message_at but NOT last_visitor_at (so it can't look unread)
    await asUser(db, { sub: admin.id }, () =>
      db.query(
        "insert into public.chat_messages (session_id, role, content, author_id) values ($1, 'human', 'Hi, Ada here', $2)",
        [sid, admin.id]
      )
    );
    const afterHuman = await one<{ last_visitor_at: string; last_role: string; message_count: number; opening: string }>(
      db,
      "select * from public.chat_sessions where id = $1",
      [sid]
    );
    expect(afterHuman.last_visitor_at).toEqual(afterAi.last_visitor_at);
    expect(afterHuman.last_role).toBe("human");
    expect(afterHuman.message_count).toBe(3);
    expect(afterHuman.opening).toBe("Do you build mobile apps?");
  });

  it("staff can take over, hand back and mark read…", async () => {
    const sid = await newSession();
    await asUser(db, { sub: admin.id }, () =>
      db.query(
        "update public.chat_sessions set mode = 'human', taken_over_by = $2, taken_over_at = now(), admin_read_at = now(), wants_human_at = null where id = $1",
        [sid, admin.id]
      )
    );
    const { mode } = await one<{ mode: string }>(db, "select mode from public.chat_sessions where id = $1", [sid]);
    expect(mode).toBe("human");
  });

  it("…but can't rewrite the visitor key (that would let a panel account post AS the visitor)", async () => {
    const sid = await newSession();
    await expect(
      asUser(db, { sub: admin.id }, () =>
        db.query("update public.chat_sessions set visitor_key_hash = $2 where id = $1", [sid, "a".repeat(64)])
      )
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, { sub: admin.id }, () =>
        db.query("update public.chat_sessions set opening = 'forged' where id = $1", [sid])
      )
    ).rejects.toThrow(/permission denied/);
  });

  it("nobody but the service role creates a session or posts as visitor / AI", async () => {
    await expect(
      asAnon(db, () => db.query("insert into public.chat_sessions (id) values ($1)", [randomUUID()]))
    ).rejects.toThrow(/permission denied|row-level security/);
    const sid = await newSession();
    await expect(
      asAnon(db, () =>
        db.query("insert into public.chat_messages (session_id, role, content) values ($1, 'visitor', 'x')", [sid])
      )
    ).rejects.toThrow(/permission denied|row-level security/);
    await expect(
      asUser(db, { sub: admin.id }, () =>
        db.query("insert into public.chat_messages (session_id, role, content) values ($1, 'ai', 'x')", [sid])
      )
    ).rejects.toThrow(/row-level security/);
  });

  describe("lead_replies", () => {
    let leadId: string;
    beforeAll(async () => {
      ({ id: leadId } = await one<{ id: string }>(
        db,
        "insert into public.leads (kind, name, email, message) values ('contact', 'Maria', 'maria@example.test', 'hi') returning id"
      ));
    });

    const insertReply = (status = "sent") =>
      db.query(
        "insert into public.lead_replies (lead_id, author_id, to_email, subject, body, status) values ($1, $2, 'maria@example.test', 'Re: x', 'Thanks', $3)",
        [leadId, admin.id, status]
      );

    it("staff can't write one — not even 'sent' for an email that never left", async () => {
      await expect(asUser(db, { sub: admin.id }, () => insertReply())).rejects.toThrow(/permission denied/);
      await expect(asAnon(db, () => insertReply())).rejects.toThrow(/permission denied/);
    });

    it("the service role records sent and failed attempts; staff read them", async () => {
      await asService(db, () => insertReply("sent"));
      await asService(db, () => insertReply("failed"));
      const n = await asUser(db, { sub: admin.id }, async () => {
        const r = await db.query<{ n: number }>(
          "select count(*)::int as n from public.lead_replies where lead_id = $1",
          [leadId]
        );
        return r.rows[0].n;
      });
      expect(n).toBe(2);
    });

    it("status is sent | failed only", async () => {
      await expect(asService(db, () => insertReply("maybe"))).rejects.toThrow(/check constraint/);
    });

    it("deleting the lead deletes its replies", async () => {
      await db.query("delete from public.leads where id = $1", [leadId]);
      const { n } = await one<{ n: number }>(db, "select count(*)::int as n from public.lead_replies where lead_id = $1", [
        leadId,
      ]);
      expect(n).toBe(0);
    });
  });
});
