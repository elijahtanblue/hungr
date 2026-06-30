// One-shot founder seeding. Creates the founder auth user, claims its handle, registers it as
// the account every new signup auto-follows (app_config.founder_id), and back-fills existing
// users as followers. Safe to re-run: it updates rather than duplicates.
//
// Easiest: copy scripts/.env.seed.example to scripts/.env.seed (gitignored), fill in the values
// (no quotes needed, even for spaces or parentheses), then run:
//   node scripts/seed-founder.mjs
// Real environment variables, if set, take precedence over the file.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Load scripts/.env.seed (KEY=VALUE per line) so there is no shell quoting to get wrong. zsh would
// otherwise treat unquoted "(founder)" as a glob qualifier; a file sidesteps that entirely.
try {
  const raw = readFileSync(new URL("./.env.seed", import.meta.url), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
} catch { /* no .env.seed: fall back to real environment variables */ }

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  FOUNDER_EMAIL,
  FOUNDER_PASSWORD,
  FOUNDER_USERNAME,
  FOUNDER_DISPLAY_NAME = "Founder",
} = process.env;

for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FOUNDER_EMAIL, FOUNDER_PASSWORD, FOUNDER_USERNAME })) {
  if (!v) { console.error(`Missing env var: ${k}`); process.exit(1); }
}
if (!/^[a-z0-9_]{3,20}$/.test(FOUNDER_USERNAME)) {
  console.error("FOUNDER_USERNAME must be 3-20 lowercase letters, numbers, or underscores.");
  process.exit(1);
}

// Preflight: identify the key kind without ever printing the secret. Admin endpoints need the
// service_role (legacy JWT) or a secret key (sb_secret_...). The anon / publishable key gives a
// 401 no_authorization, which is the single most common mistake here.
function describeKey(key) {
  if (key.startsWith("sb_secret_")) return { kind: "secret key (sb_secret_...)", ok: true };
  if (key.startsWith("sb_publishable_")) return { kind: "PUBLISHABLE key (sb_publishable_...)", ok: false };
  if (key.startsWith("eyJ")) {
    try {
      const role = JSON.parse(Buffer.from(key.split(".")[1], "base64").toString()).role;
      return { kind: `legacy JWT, role=${role}`, ok: role === "service_role" };
    } catch { return { kind: "unrecognized JWT", ok: false }; }
  }
  return { kind: "unrecognized key format", ok: false };
}
const keyInfo = describeKey(SUPABASE_SERVICE_ROLE_KEY);
console.log(`URL:  ${SUPABASE_URL}`);
console.log(`Key:  ${keyInfo.kind} (length ${SUPABASE_SERVICE_ROLE_KEY.length})`);
if (!keyInfo.ok) {
  console.error(
    "\nThat is not a service-role / secret key. Use Supabase dashboard > Project Settings > API:\n" +
    "  - new projects: the 'secret' key (starts with sb_secret_)\n" +
    "  - legacy projects: the 'service_role' key (a long JWT, role=service_role)\n" +
    "NOT the anon / publishable key.",
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// 1. Create the founder auth user (or find it if it already exists), with email pre-confirmed.
let founderId;
const created = await admin.auth.admin.createUser({
  email: FOUNDER_EMAIL,
  password: FOUNDER_PASSWORD,
  email_confirm: true,
});
if (created.error) {
  if (!/already/i.test(created.error.message)) throw created.error;
  // Already exists: look it up by paging the user list.
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === FOUNDER_EMAIL.toLowerCase());
    if (found) { founderId = found.id; break; }
    if (data.users.length < 200) throw new Error("Founder email not found in existing users.");
    page += 1;
  }
} else {
  founderId = created.data.user.id;
}
console.log("founder user id:", founderId);

// 2. Claim the handle + display name on the auto-created profile row.
const profile = await admin
  .from("profiles")
  .update({ username: FOUNDER_USERNAME, display_name: FOUNDER_DISPLAY_NAME })
  .eq("id", founderId);
if (profile.error) throw profile.error;

// 3. Register the founder so every new signup auto-follows it (the 0008 trigger reads this).
const config = await admin
  .from("app_config")
  .upsert({ key: "founder_id", value: founderId }, { onConflict: "key" });
if (config.error) throw config.error;

// 4. Back-fill: make every existing user (except the founder) a follower.
const existing = await admin.from("profiles").select("id").neq("id", founderId);
if (existing.error) throw existing.error;
if (existing.data.length > 0) {
  const rows = existing.data.map((p) => ({ follower_id: p.id, followee_id: founderId }));
  const follows = await admin.from("follows").upsert(rows, { onConflict: "follower_id,followee_id" });
  if (follows.error) throw follows.error;
}
console.log(`done. ${existing.data.length} existing user(s) now follow @${FOUNDER_USERNAME}.`);
