import fs from "fs";
import path from "path";

const file = path.join(process.cwd(), "supabase", "migrations", "0029_taste_events_tracking.sql");
const sql = fs.readFileSync(file, "utf8");

test("creates append-only taste events with own-row read policy", () => {
  expect(sql).toMatch(/create table if not exists taste_events/);
  expect(sql).toMatch(/event_type text not null check/);
  expect(sql).toMatch(/alter table taste_events enable row level security/);
  expect(sql).toMatch(/drop policy if exists "own taste_events read"/);
  expect(sql).toMatch(/create policy "own taste_events read"/);
  expect(sql).not.toMatch(/grant insert on taste_events to authenticated/);
});

test("tracks first-party behavior from backend triggers", () => {
  expect(sql).toMatch(/track_user_place_taste_event/);
  expect(sql).toMatch(/track_check_in_taste_event/);
  expect(sql).toMatch(/track_review_taste_event/);
  expect(sql).toMatch(/track_profile_cuisine_taste_event/);
  expect(sql).toMatch(/track_tiktok_hashtag_taste_event/);
  expect(sql).toMatch(/track_taste_memory_event/);
});

test("does not store raw search text or raw TikTok captions as taste data", () => {
  expect(sql).not.toMatch(/raw_query/i);
  expect(sql).not.toMatch(/raw_caption/i);
  expect(sql).not.toMatch(/caption.*taste_events/i);
  expect(sql).toMatch(/dish_tags/);
});

test("adds explicit RPCs for safe search facets and feature scores", () => {
  expect(sql).toMatch(/create or replace function record_search_taste_event/);
  expect(sql).toMatch(/create or replace function record_taste_event/);
  expect(sql).toMatch(/create or replace function get_taste_feature_scores/);
  expect(sql).toMatch(/create or replace function delete_my_taste_events/);
});

test("backfills existing first-party behavior", () => {
  expect(sql).toMatch(/from user_places up/);
  expect(sql).toMatch(/from check_ins ci/);
  expect(sql).toMatch(/from reviews r/);
  expect(sql).toMatch(/from profiles p/);
  expect(sql).toMatch(/from user_place_sources ups/);
  expect(sql).toMatch(/from user_taste_memories m/);
});
