-- Make founder auto-follow reliable without the seed script. The founder account already exists
-- (the founder has signed in), so resolve its id from the handle and store it in app_config. This
-- runs on `db push` alone; the seed script is only needed to CREATE a founder in a fresh project.
--
-- Change the handle here if the founder handle ever changes.
insert into app_config (key, value)
select 'founder_id', id::text from profiles where lower(username) = 'elijahtanblue'
on conflict (key) do update set value = excluded.value;

-- Back-fill: every existing non-founder user follows the founder.
insert into follows (follower_id, followee_id)
select p.id, (select value::uuid from app_config where key = 'founder_id')
from profiles p
where (select value::uuid from app_config where key = 'founder_id') is not null
  and p.id <> (select value::uuid from app_config where key = 'founder_id')
on conflict do nothing;

-- Idempotent per-user catch-up, called by the client on launch so a user who signed up before the
-- founder id was set (or before the trigger existed) still ends up following the founder.
create or replace function ensure_following_founder() returns void
language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  select value::uuid into fid from app_config where key = 'founder_id';
  if fid is not null and fid <> auth.uid() then
    insert into follows (follower_id, followee_id)
    values (auth.uid(), fid)
    on conflict do nothing;
  end if;
exception when others then
  return;
end;
$$;
