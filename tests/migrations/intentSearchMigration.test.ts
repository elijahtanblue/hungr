import fs from "fs";
import path from "path";

const file = path.join(process.cwd(), "supabase", "migrations", "0021_intent_search.sql");
const sql = fs.readFileSync(file, "utf8");

test("creates the first_party_facts table", () => {
  expect(sql).toMatch(/create table if not exists first_party_facts/);
});

test("constrains price_band to 1..4 at the database boundary", () => {
  expect(sql).toMatch(/price_band int check \(price_band between 1 and 4\)/);
});

test("exposes a batch read RPC granted to anon and authenticated", () => {
  expect(sql).toMatch(/create or replace function get_first_party_facts/);
  expect(sql).toMatch(/grant execute on function get_first_party_facts\(text\[\]\) to authenticated, anon/);
});

test("facts are world-readable but not client-writable (no write policy)", () => {
  expect(sql).toMatch(/enable row level security/);
  expect(sql).toMatch(/for select\s+using \(true\)/);
  expect(sql).not.toMatch(/for insert/);
});

test("does not add a dead price_band column to place_guides", () => {
  // Curated prices live in first_party_facts; get_place_guides does not return a price, so a
  // place_guides.price_band column would be unread. Guard against reintroducing it.
  expect(sql).not.toMatch(/alter table place_guides/);
});
