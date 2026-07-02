import fs from "fs";
import path from "path";

const file = path.join(process.cwd(), "supabase", "migrations", "0030_taste_tracking_opt_out.sql");
const sql = fs.readFileSync(file, "utf8");

test("adds an opt-out flag without deleting existing taste events", () => {
  expect(sql).toMatch(/alter table profiles add column if not exists taste_tracking_enabled boolean not null default true/);
  expect(sql).toMatch(/create or replace function get_taste_tracking_settings/);
  expect(sql).toMatch(/create or replace function set_taste_tracking_enabled/);
  expect(sql).toMatch(/toggling this flag never deletes rows/);
  expect(sql).not.toMatch(/delete from taste_events[\s\S]*taste_tracking_enabled/i);
});

test("gates every taste event write path behind the opt-out flag", () => {
  expect(sql).toMatch(/create or replace function taste_tracking_enabled_for/);
  expect(sql).toMatch(/not taste_tracking_enabled_for\(caller\)/);
  expect(sql).toMatch(/not taste_tracking_enabled_for\(target_user_id\)/);
  expect(sql).toMatch(/create or replace function record_taste_event/);
  expect(sql).toMatch(/create or replace function record_search_taste_event/);
  expect(sql).toMatch(/create or replace function insert_taste_event_for_user/);
});

test("keeps destructive deletion as a separate explicit path", () => {
  expect(sql).toMatch(/delete_my_taste_events\(\) remains the separate destructive path/);
});

test("does not expose the internal tracking gate helper to clients", () => {
  expect(sql).toMatch(/revoke all on function taste_tracking_enabled_for\(uuid\) from public/);
  expect(sql).not.toMatch(/grant execute on function taste_tracking_enabled_for\(uuid\) to authenticated/);
  expect(sql).toMatch(/grant execute on function get_taste_tracking_settings\(\) to authenticated/);
  expect(sql).toMatch(/grant execute on function set_taste_tracking_enabled\(boolean\) to authenticated/);
});
