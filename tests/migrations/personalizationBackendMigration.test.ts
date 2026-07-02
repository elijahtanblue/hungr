import fs from "fs";
import path from "path";

const file = path.join(process.cwd(), "supabase", "migrations", "0028_personalization_backend.sql");
const sql = fs.readFileSync(file, "utf8");

test("creates distilled taste memory storage without chat history", () => {
  expect(sql).toMatch(/create table if not exists user_taste_memories/);
  expect(sql).toMatch(/primary key \(user_id, memory_key\)/);
  expect(sql).toMatch(/create or replace function get_taste_memories/);
  expect(sql).toMatch(/create or replace function upsert_taste_memory/);
  expect(sql).not.toMatch(/chat_messages/);
  expect(sql).not.toMatch(/conversation_history/);
});

test("taste profile uses disliked as the only negative place state", () => {
  expect(sql).toMatch(/when 'loved' then 8/);
  expect(sql).toMatch(/when 'go' then 6/);
  expect(sql).toMatch(/when 'liked' then 4/);
  expect(sql).toMatch(/when 'disliked' then -7/);
  expect(sql).not.toMatch(/when 'avoid'/);
});

test("local trends are weekly and first-party only", () => {
  expect(sql).toMatch(/create or replace function get_weekly_place_trends/);
  expect(sql).toMatch(/date_trunc\('week', now\(\)\)/);
  expect(sql).toMatch(/from reviews/);
  expect(sql).toMatch(/from check_ins/);
  expect(sql).toMatch(/from user_places/);
});

test("does not persist Google review-count history", () => {
  expect(sql).not.toMatch(/user_rating_count/i);
  expect(sql).not.toMatch(/google_review/i);
  expect(sql).not.toMatch(/rating_snapshot/i);
});
