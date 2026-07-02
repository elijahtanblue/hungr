import fs from "fs";
import path from "path";

const sql = fs.readFileSync(
  path.join(process.cwd(), "supabase", "migrations", "0033_discord_report_notifications.sql"),
  "utf8",
);

test("reads the Discord webhook from Vault, never hard-coded", () => {
  expect(sql).toMatch(/from vault\.decrypted_secrets/);
  expect(sql).toMatch(/where name = 'discord_reports_webhook'/);
  expect(sql).not.toMatch(/https:\/\/discord\.com\/api\/webhooks\/\d/);
});

test("is a no-op when the webhook secret is not configured", () => {
  expect(sql).toMatch(/if webhook is null then\s*return new;/);
});

test("posts via pg_net and fires on all three report tables", () => {
  expect(sql).toMatch(/create extension if not exists pg_net/);
  expect(sql).toMatch(/perform net\.http_post/);
  expect(sql).toMatch(/after insert on review_reports/);
  expect(sql).toMatch(/after insert on review_photo_reports/);
  expect(sql).toMatch(/after insert on bug_reports/);
});
