import fs from "fs";
import path from "path";

const sql = fs.readFileSync(
  path.join(process.cwd(), "supabase", "migrations", "0032_following_reviews_feed.sql"),
  "utf8",
);

test("following_reviews_feed only shows reviews from people you follow", () => {
  expect(sql).toMatch(/create or replace function following_reviews_feed\(max_rows int/);
  expect(sql).toMatch(/join reviews r on r\.user_id = f\.followee_id/);
  expect(sql).toMatch(/where f\.follower_id = auth\.uid\(\)/);
});

test("following_reviews_feed honors the shares_activity visibility flag", () => {
  expect(sql).toMatch(/p\.shares_activity/);
});

test("following_reviews_feed counts only approved photos and is granted to authenticated", () => {
  expect(sql).toMatch(/rp\.status = 'approved'/);
  expect(sql).toMatch(/grant execute on function following_reviews_feed\(int\) to authenticated/);
});
