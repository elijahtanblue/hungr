import fs from "fs";
import path from "path";

const file = path.join(process.cwd(), "supabase", "migrations", "0025_fix_rate_limit_bucket_ambiguity.sql");
const sql = fs.readFileSync(file, "utf8");
const dropLegacyFile = path.join(process.cwd(), "supabase", "migrations", "0026_drop_legacy_rate_limit_rpc.sql");
const dropLegacySql = fs.readFileSync(dropLegacyFile, "utf8");
const conflictTargetFile = path.join(process.cwd(), "supabase", "migrations", "0027_fix_rate_limit_conflict_target.sql");
const conflictTargetSql = fs.readFileSync(conflictTargetFile, "utf8");

test("repairs the per-bucket rate limiter without renaming the public RPC parameter", () => {
  expect(sql).toMatch(/create or replace function bump_rate_limit\(uid uuid, bucket text, max_per_min int\)/);
  expect(sql).toMatch(/rate_bucket alias for \$2/);
  expect(sql).toMatch(/values \(uid, rate_bucket, now\(\), 1\)/);
  expect(sql).not.toMatch(/values \(uid, bucket, now\(\), 1\)/);
});

test("keeps the legacy two-argument limiter delegated to the global bucket", () => {
  expect(sql).toMatch(/create or replace function bump_rate_limit\(uid uuid, max_per_min int\)/);
  expect(sql).toMatch(/return bump_rate_limit\(uid, 'global', max_per_min\)/);
});

test("drops the legacy overloaded RPC so PostgREST can resolve named args", () => {
  expect(dropLegacySql).toMatch(/drop function if exists bump_rate_limit\(uuid, int\)/);
  expect(dropLegacySql).toMatch(/pg_notify\('pgrst', 'reload schema'\)/);
});

test("uses the primary key constraint instead of an ambiguous bucket conflict target", () => {
  expect(conflictTargetSql).toMatch(/on conflict on constraint rate_limits_pkey do update/);
  expect(conflictTargetSql).not.toMatch(/on conflict \(user_id, bucket\)/);
});
