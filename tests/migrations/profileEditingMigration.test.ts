import fs from "fs";
import path from "path";

const sql = fs.readFileSync(
  path.join(process.cwd(), "supabase", "migrations", "0035_profile_editing.sql"),
  "utf8",
);

test("adds editable bio and avatar columns to profiles", () => {
  expect(sql).toMatch(/add column if not exists bio text/);
  expect(sql).toMatch(/add column if not exists avatar_url text/);
});

test("creates a public avatars bucket", () => {
  expect(sql).toMatch(/insert into storage\.buckets/);
  expect(sql).toMatch(/'avatars'/);
  expect(sql).toMatch(/set public = true/);
});

test("restricts avatar writes to the owner's own folder", () => {
  for (const verb of ["upload own avatar", "update own avatar", "delete own avatar"]) {
    expect(sql).toMatch(new RegExp(verb));
  }
  expect(sql).toMatch(/\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/);
});
