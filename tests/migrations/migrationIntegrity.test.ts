import fs from "fs";
import path from "path";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");

function migrationFiles(): string[] {
  return fs.readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();
}

function readMigration(file: string): string {
  return fs.readFileSync(path.join(migrationsDir, file), "utf8");
}

test("migration version prefixes are unique", () => {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];

  for (const file of migrationFiles()) {
    const version = file.split("_")[0];
    const first = seen.get(version);
    if (first) duplicates.push(`${version}: ${first}, ${file}`);
    seen.set(version, file);
  }

  expect(duplicates).toEqual([]);
});

test("pending migrations recreate policies defensively", () => {
  const pending = migrationFiles().filter((file) => file >= "0016_");
  const missingDrops: string[] = [];

  for (const file of pending) {
    const sql = readMigration(file);
    const createPolicyPattern = /create policy "([^"]+)"/gi;
    let match: RegExpExecArray | null;
    while ((match = createPolicyPattern.exec(sql))) {
      const policyName = match[1];
      if (!sql.includes(`drop policy if exists "${policyName}"`)) {
        missingDrops.push(`${file}: ${policyName}`);
      }
    }
  }

  expect(missingDrops).toEqual([]);
});

test("0016 repairs review social tables before review RPCs reference them", () => {
  const sql = readMigration("0016_review_sentiment_state.sql");
  const createVotesAt = sql.indexOf("create table if not exists review_votes");
  const firstReferenceAt = sql.indexOf("from review_votes");

  expect(createVotesAt).toBeGreaterThanOrEqual(0);
  expect(firstReferenceAt).toBeGreaterThan(createVotesAt);
  expect(sql).toContain("create table if not exists review_reports");
  expect(sql).toContain("create or replace function upvote_review");
  expect(sql).toContain("create or replace function get_user_profile");
});
