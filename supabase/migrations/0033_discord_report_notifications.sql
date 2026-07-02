-- Send a Discord message whenever a report is filed (review report, photo report, or bug report),
-- so the founder hears about them instead of having to poll the Supabase dashboard. The webhook URL
-- is read from Vault at call time (never hard-coded in a migration). If the secret is not set, the
-- trigger is a no-op, so this is safe to apply before configuring Discord.
--
-- Setup (run once, see docs/GETTING-STARTED.md section 8j):
--   select vault.create_secret('https://discord.com/api/webhooks/xxx/yyy', 'discord_reports_webhook');

create extension if not exists pg_net;

create or replace function notify_report_discord() returns trigger
language plpgsql security definer set search_path = public, extensions, vault as $$
declare
  webhook text;
  msg text;
begin
  select decrypted_secret into webhook
    from vault.decrypted_secrets
   where name = 'discord_reports_webhook'
   limit 1;
  if webhook is null then
    return new;
  end if;

  if tg_table_name = 'review_reports' then
    msg := format('🚩 **Review reported**%sReview: `%s`%sReason: %s', chr(10), new.review_id, chr(10), coalesce(new.reason, 'none given'));
  elsif tg_table_name = 'review_photo_reports' then
    msg := format('🖼️ **Photo reported**%sPhoto: `%s`%sReason: %s', chr(10), new.photo_id, chr(10), coalesce(new.reason, 'none given'));
  elsif tg_table_name = 'bug_reports' then
    msg := format('🐞 **Bug report**%s%s', chr(10), left(new.message, 1500));
  else
    msg := format('New %s row', tg_table_name);
  end if;

  perform net.http_post(
    url := webhook,
    body := jsonb_build_object('content', left(msg, 1900))
  );
  return new;
end;
$$;

drop trigger if exists trg_review_reports_discord on review_reports;
create trigger trg_review_reports_discord
  after insert on review_reports
  for each row execute function notify_report_discord();

drop trigger if exists trg_review_photo_reports_discord on review_photo_reports;
create trigger trg_review_photo_reports_discord
  after insert on review_photo_reports
  for each row execute function notify_report_discord();

drop trigger if exists trg_bug_reports_discord on bug_reports;
create trigger trg_bug_reports_discord
  after insert on bug_reports
  for each row execute function notify_report_discord();
