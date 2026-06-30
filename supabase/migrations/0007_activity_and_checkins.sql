-- V2 visibility control + private visit tracking.
--
-- shares_activity lets a user decide whether followers see where they have been. It defaults to
-- true (the social loop is the point), but when a user turns it off, friend_beens stops returning
-- their places to anyone, so a follow no longer leaks their beens.
alter table profiles add column if not exists shares_activity boolean not null default true;

-- friend_beens now also honours the sharer's choice. Everything else about it is unchanged: still
-- BEEN-only, still scoped to the caller's follows, still the single cross-user read.
create or replace function friend_beens()
returns table (place_id text, friend_id uuid, friend_name text, friend_username text, visited_at timestamptz)
language sql security definer set search_path = public as $$
  select up.place_id, up.user_id, p.display_name, p.username, up.updated_at
  from follows f
  join user_places up on up.user_id = f.followee_id and up.state = 'been'
  join profiles p on p.id = up.user_id
  where f.follower_id = auth.uid() and p.shares_activity;
$$;

-- Lightweight check-ins. One row per visit, private to the owner (own-row RLS, no cross-user
-- accessor exists), so the visit count is for the user's own memory and personalization only and
-- is never shown to other users. Reuses the places anchor so we still store only place_id.
create table check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null references places(place_id) on delete cascade,
  created_at timestamptz not null default now()
);
create index check_ins_user_place_idx on check_ins (user_id, place_id);

alter table check_ins enable row level security;
create policy "own check_ins" on check_ins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert on check_ins to authenticated;
