import fs from "fs";
import path from "path";

const sql = fs.readFileSync(
  path.join(process.cwd(), "supabase", "migrations", "0031_report_photo_insert_only.sql"),
  "utf8",
);

test("report_review_photo only inserts a report", () => {
  expect(sql).toMatch(/insert into review_photo_reports/);
  expect(sql).toMatch(/grant execute on function report_review_photo\(uuid, text\) to authenticated/);
});

test("report_review_photo no longer changes photo status (no censorship vector)", () => {
  // The function body must not mutate review_photos; a single report can never hide a photo.
  expect(sql).not.toMatch(/update review_photos/);
  expect(sql).not.toMatch(/set status/);
});
