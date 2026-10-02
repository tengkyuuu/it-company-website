/**
 * Create the panel's first (owner) account, bypassing the email flow.
 *
 *   node scripts/create-owner.mjs you@example.com "your-password"
 *
 * The usual route is "First time? Create the owner account" on /admin/login,
 * which appears while OWNER_EMAIL is set and the panel has no owner. This
 * script is the fallback for when that isn't available (no OWNER_EMAIL yet,
 * or you'd rather not expose the form even briefly).
 *
 * The service-role Admin API marks the address confirmed at creation
 * (`email_confirm: true`), so no mail is ever sent and you can sign in at once.
 * The schema's handle_new_user() trigger makes the first account the owner;
 * the script then checks the profile and repairs it if needed.
 *
 * Use the SAME address as OWNER_EMAIL: that variable is what keeps this
 * account the owner even if its profile row is later deleted or changed.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and OWNER_EMAIL
 * from .env.local. Never commit the service-role key.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const [rawEmail, password] = process.argv.slice(2);
if (!rawEmail || !password) {
  console.error('Usage: node scripts/create-owner.mjs <email> "<password>"');
  process.exit(1);
}
const email = rawEmail.trim().toLowerCase();
if (password.length < 8 || password.length > 72) {
  console.error("Password must be 8–72 characters (the panel's rule).");
  process.exit(1);
}

const env = { ...process.env };
try {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (/^'.*'$/.test(v) || /^".*"$/.test(v)) v = v.slice(1, -1);
    env[m[1]] = v;
  }
} catch {
  // no .env.local — fall back to the process environment
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}

const ownerEmail = (env.OWNER_EMAIL || "").trim().toLowerCase();
if (!ownerEmail) {
  console.warn("⚠  OWNER_EMAIL isn't set. Set it to", email, "so this account can never be locked out.");
} else if (ownerEmail !== email) {
  console.warn(`⚠  ${email} is not OWNER_EMAIL (${ownerEmail}).`);
  console.warn("   The panel treats only OWNER_EMAIL as the owner — change one of them so they match.");
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const { count, error: countError } = await sb
  .from("profiles")
  .select("*", { count: "exact", head: true })
  .eq("role", "owner");
if (countError) {
  console.error("✗ Couldn't read profiles:", countError.message, "— has supabase/schema.sql been run?");
  process.exit(1);
}
if (count) {
  console.log("⚠  The panel already has an owner.");
  console.log("   Add teammates by invite from /admin/team instead.");
  process.exit(1);
}

const { data, error } = await sb.auth.admin.createUser({
  email,
  password,
  email_confirm: true, // no confirmation mail, usable right away
});

if (error) {
  console.error("✗ Could not create the user:", error.message);
  if (/registered|exists/i.test(error.message)) {
    console.error("  That account exists already — just sign in; with OWNER_EMAIL set to it, owner");
    console.error("  access is restored automatically.");
  }
  process.exit(1);
}

// handle_new_user() makes the very first profile the owner; if other profiles
// exist (the owner's row was deleted), it makes none — write it either way.
const { data: profile, error: profileError } = await sb
  .from("profiles")
  .upsert({ id: data.user.id, email, role: "owner", disabled: false }, { onConflict: "id" })
  .select("id, role")
  .single();

console.log("✓ Owner account created");
console.log("  email :", data.user.email);
console.log("  id    :", data.user.id);
console.log("  role  :", profile?.role ?? `(profile not written: ${profileError?.message})`);
console.log("\nSign in at /admin/login with that email and password.");
