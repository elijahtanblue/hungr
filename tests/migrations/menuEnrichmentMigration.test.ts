import fs from "fs";
import path from "path";

const file = path.join(process.cwd(), "supabase", "migrations", "0022_menu_enrichment.sql");
const sql = fs.readFileSync(file, "utf8");

test("adds field-level provenance and retires the coarse single-source columns", () => {
  expect(sql).toMatch(/add column if not exists price_source text/);
  expect(sql).toMatch(/add column if not exists dietary_source text/);
  expect(sql).toMatch(/add column if not exists price_confirmed_at timestamptz/);
  expect(sql).toMatch(/add column if not exists dietary_confirmed_at timestamptz/);
  expect(sql).toMatch(/drop column if exists source/);
});

test("creates the queue with retry and dead-letter fields", () => {
  expect(sql).toMatch(/create table if not exists menu_enrich_queue/);
  expect(sql).toMatch(/attempts int not null default 0/);
  expect(sql).toMatch(/next_attempt_at timestamptz/);
  expect(sql).toMatch(/last_error text/);
});

test("the queue is RLS-locked with no client policies", () => {
  expect(sql).toMatch(/alter table menu_enrich_queue enable row level security/);
  expect(sql).not.toMatch(/create policy .* on menu_enrich_queue/);
});

test("enqueue validates the place_id shape and is granted to authenticated", () => {
  expect(sql).toMatch(/create or replace function enqueue_menu_enrich/);
  expect(sql).toMatch(/\^\[A-Za-z0-9_-\]\{10,255\}\$/);
  expect(sql).toMatch(/grant execute on function enqueue_menu_enrich\(text, double precision\) to authenticated/);
});

test("enqueue treats curated fields as fresh so a scrape never overwrites them", () => {
  expect(sql).toMatch(/price_source = 'curated'/);
  expect(sql).toMatch(/dietary_source = 'curated'/);
});

test("the batch selector windows on local 2-5am and is service-role only", () => {
  expect(sql).toMatch(/select_due_menu_enrich/);
  expect(sql).toMatch(/lng \/ 15/);
  expect(sql).toMatch(/>= 2/);
  expect(sql).toMatch(/< 5/);
  expect(sql).toMatch(/grant execute on function select_due_menu_enrich\(int\) to service_role/);
});

test("upsert_menu_facts merges per field and never overwrites curated", () => {
  expect(sql).toMatch(/create or replace function upsert_menu_facts/);
  expect(sql).toMatch(/f\.price_source = 'curated' or excluded\.price_band is null/);
  expect(sql).toMatch(/f\.dietary_source = 'curated' or array_length\(excluded\.dietary_flags, 1\) is null/);
  expect(sql).toMatch(/grant execute on function upsert_menu_facts\(text, int, text\[\]\) to service_role/);
});

test("queue completion deletes and failure backs off then dead-letters", () => {
  expect(sql).toMatch(/create or replace function complete_menu_enrich/);
  expect(sql).toMatch(/delete from menu_enrich_queue where place_id = p_place_id/);
  expect(sql).toMatch(/create or replace function fail_menu_enrich/);
  expect(sql).toMatch(/attempts \+ 1 >= 5 then now\(\) \+ interval '100 years'/);
  expect(sql).toMatch(/make_interval\(hours => power\(2, attempts \+ 1\)/);
});
