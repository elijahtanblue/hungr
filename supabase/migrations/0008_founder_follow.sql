-- Seed every new user as a follower of the founder account, so the founder's check-ins and beens
-- appear in each new user's feed from day one. The founder id is data, not code: until it is set
-- in app_config the trigger is a no-op, so this migration is safe to apply before the founder
-- account exists.

-- Tiny server-only settings table. No RLS policies and no client grant, so it is default-deny to
-- anon/authenticated; only SECURITY DEFINER functions below can read it.
create table app_config (
  key text primary key,
  value text not null
);
alter table app_config enable row level security;

-- After a profile is created (i.e. a new signup), follow the configured founder.
create or replace function follow_founder() returns trigger
language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  select value::uuid into fid from app_config where key = 'founder_id';
  if fid is not null and fid <> new.id then
    insert into follows (follower_id, followee_id)
    values (new.id, fid)
    on conflict do nothing;
  end if;
  return new;
exception when others then
  return new;  -- never block signup
end;
$$;

create trigger on_profile_created_follow_founder
  after insert on profiles
  for each row execute function follow_founder();

-- To activate after the founder account exists, run once (replace the uuid):
--   insert into app_config (key, value) values ('founder_id', '<FOUNDER_AUTH_UID>')
--   on conflict (key) do update set value = excluded.value;
-- To back-fill the handful of users who signed up before this was set:
--   insert into follows (follower_id, followee_id)
--   select p.id, (select value::uuid from app_config where key = 'founder_id') from profiles p
--   where p.id <> (select value::uuid from app_config where key = 'founder_id')
--   on conflict do nothing;
