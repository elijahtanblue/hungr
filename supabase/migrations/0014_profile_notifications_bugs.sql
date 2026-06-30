-- Profile, notifications, and bug reports.

-- Bug reports: any signed-in user files one; only the author can read their own back. You triage
-- them in the Supabase dashboard.
create table bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);
alter table bug_reports enable row level security;
create policy "own bug_reports" on bug_reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert on bug_reports to authenticated;

-- In-app notifications. Recipients read/update only their own; rows are only ever created by the
-- SECURITY DEFINER trigger below, so they cannot be forged from the client.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete cascade,
  type text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, created_at desc);
alter table notifications enable row level security;
create policy "own notifications read" on notifications for select using (auth.uid() = user_id);
create policy "own notifications update" on notifications for update using (auth.uid() = user_id);
grant select, update on notifications to authenticated;

-- A new follow notifies the person being followed. Fires only on an actual insert (ON CONFLICT DO
-- NOTHING skips fire), so the once-per-user founder follow does not spam.
create or replace function notify_on_follow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, actor_id, type) values (new.followee_id, new.follower_id, 'follow');
  return new;
exception when others then
  return new;
end;
$$;
create trigger on_follow_created_notify after insert on follows
  for each row execute function notify_on_follow();

-- Recent notifications for the caller, with the actor's public identity.
create or replace function get_notifications()
returns table (id uuid, type text, read boolean, created_at timestamptz, actor_username text, actor_name text)
language sql security definer set search_path = public as $$
  select n.id, n.type, n.read, n.created_at, p.username, p.display_name
  from notifications n
  left join profiles p on p.id = n.actor_id
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit 50;
$$;

create or replace function mark_notifications_read() returns void
language sql security definer set search_path = public as $$
  update notifications set read = true where user_id = auth.uid() and not read;
$$;

-- Follower / following / friend counts for the profile header.
create or replace function get_social_counts()
returns table (followers int, following int, friends int)
language sql security definer set search_path = public as $$
  select
    (select count(*) from follows where followee_id = auth.uid())::int,
    (select count(*) from follows where follower_id = auth.uid())::int,
    (select count(*) from friendships where status = 'accepted' and auth.uid() in (user_low, user_high))::int;
$$;

-- The caller's own reviews, for the "Your reviews" list on the profile.
create or replace function get_my_reviews()
returns table (id uuid, place_id text, body text, rating numeric, created_at timestamptz)
language sql security definer set search_path = public as $$
  select id, place_id, body, rating, created_at
  from reviews
  where user_id = auth.uid()
  order by created_at desc;
$$;
