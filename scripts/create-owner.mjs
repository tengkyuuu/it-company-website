/**
 * Create the panel's first (owner) account, bypassing the email flow.
 *
 *   node scripts/create-owner.mjs you@example.com "your-password"
 *
 * Why this exists: signing up through /admin/login goes through Supabase's
 * mailer, and on a fresh free-tier project that path is usually blocked twice —
 *
 *   1. GoTrue rejects obviously-fake domains outright ("Email address
 *      admin@test.com is invalid"), and
 *   2. `mailer_autoconfirm` is false, so a real address still has to click a
 *      confirmation link — but the built-in email service only delivers to the
 *      project owner's own address and allows a couple of sends per hour
 *      (`over_email_send_rate_limit`).
 *
 * The service-role Admin API sidesteps both: `email_confirm: true` marks the
 * address confirmed at creation, so no mail is ever sent and you can sign in
 * immediately. The schema's handle_new_user() trigger still fires, so the first
 * account created this way becomes `owner` exactly as intended.
 *
 * Reads SUPABASE_SERVICE_ROLE_KEY from .env.local. Never commit that key.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: node scripts/create-owner.mjs <email> "<password>"');
  process.exit(1);
}
if (password.length < 6) {
  console.error("Password must be at least 6 characters (Supabase minimum).");
  process.exit(1);
}

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if (/^'.*'$/.test(v) || /^".*"$/.test(v)) v = v.slice(1, -1);
  env[m[1]] = v;
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const { count } = await sb.from("profiles").select("*", { count: "exact", head: true });
if (count) {
  console.log(`⚠  ${count} profile(s) already exist — the owner slot is taken.`);
  console.log("   Add further teammates by invite from /admin/team instead.");
  process.exit(1);
}

const { data, error } = await sb.auth.admin.createUser({
  email,
  password,
  email_confirm: true, // no confirmation mail, usable right away
});

if (error) {
  console.error("✗ Could not create the user:", error.message);
  process.exit(1);
}

// handle_new_user() should have inserted the matching profile row
const { data: profile } = await sb
  .from("profiles")
  .select("id, role")
  .eq("id", data.user.id)
  .single();

console.log("✓ Owner account created");
console.log("  email :", data.user.email);
console.log("  id    :", data.user.id);
console.log("  role  :", profile?.role ?? "(profile row not found — check handle_new_user)");
console.log("\nSign in at /admin/login with that email and password.");
