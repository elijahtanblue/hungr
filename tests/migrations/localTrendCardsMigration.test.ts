import fs from "fs";
import path from "path";

const file = path.join(process.cwd(), "supabase", "migrations", "0034_local_trend_cards.sql");
const sql = fs.readFileSync(file, "utf8");

test("creates a local trend cards RPC scoped by candidate place ids", () => {
  expect(sql).toMatch(/create or replace function get_local_trend_cards/);
  expect(sql).toMatch(/candidate_place_ids text\[\]/);
  expect(sql).toMatch(/r\.place_id = any\(candidate_place_ids\)/);
  expect(sql).toMatch(/ci\.place_id = any\(candidate_place_ids\)/);
  expect(sql).toMatch(/up\.place_id = any\(candidate_place_ids\)/);
  expect(sql).toMatch(/limit \(select row_limit from bounds\)/);
});

test("returns card-ready anonymized trend fields", () => {
  expect(sql).toMatch(/trend_type text/);
  expect(sql).toMatch(/headline text/);
  expect(sql).toMatch(/summary text/);
  expect(sql).toMatch(/actor_count int/);
  expect(sql).toMatch(/average_hungr_rating numeric/);
});

test("does not scope local trends to the caller's own account", () => {
  expect(sql).not.toMatch(/auth\.uid\(\)\s*=\s*(r|ci|up)\.user_id/);
  expect(sql).not.toMatch(/(r|ci|up)\.user_id\s*=\s*auth\.uid\(\)/);
});

test("uses a privacy threshold so one account does not read as a trend", () => {
  expect(sql).toMatch(/min_actor_count int default 2/);
  expect(sql).toMatch(/actor_count >= \(select actor_floor from bounds\)/);
});

test("grants the RPC to authenticated users", () => {
  expect(sql).toMatch(/grant execute on function get_local_trend_cards\(text\[\], int, int, int\) to authenticated/);
});
