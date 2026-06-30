-- V2 social graph. Two relationship types, both granting visibility of a user's BEEN places
-- (where they have "gone"). Avoid and want-to-go stay private.
--   follows:     directed, one-tap, no approval. You see who you follow.
--   friendships: mutual, request -> accept. On accept, reciprocal follow edges are created so
--                both sides see each other's beens; this is the curated tie for the feed.
--
-- Visibility is exposed ONLY through SECURITY DEFINER accessors below, never by opening up
-- user_places / profiles RLS. That keeps avoid + want-to-go private no matter what, and means
-- a follower can only ever read the single fact "X has been to place Y".

-- Discovery handle. Unique, case-insensitive, set by the user later (nullable for now).
alter table profiles add column username text unique;
create unique index profiles_username_lower_idx on profiles (lower(username));

create table follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create type friendship_status as enum ('pending', 'accepted');

-- One row per unordered pair (user_low < user_high) so a pair can never be duplicated.
-- requested_by records direction; the other party accepts or declines.
create table friendships (
  user_low uuid not null references auth.users(id) on delete cascade,
  user_high uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_low, user_high),
  check (user_low < user_high)
);

alter table follows enable row level security;
alter table friendships enable row level security;

-- You can read follow edges you are part of (your follows and your followers).
create policy "own follows read" on follows for select
  using (auth.uid() = follower_id or auth.uid() = followee_id);
-- You can read friendship rows you are part of.
create policy "own friendships read" on friendships for select
  using (auth.uid() = user_low or auth.uid() = user_high);
-- All writes go through the SECURITY DEFINER functions below (no direct insert/update/delete
-- policies), so the reciprocal-edge invariants can never be bypassed from the client.

grant select on follows to authenticated;
grant select on friendships to authenticated;

-- Helper: canonical ordering for a pair.
create or replace function pair_low(a uuid, b uuid) returns uuid language sql immutable as $$
  select case when a < b then a else b end;
$$;
create or replace function pair_high(a uuid, b uuid) returns uuid language sql immutable as $$
  select case when a < b then b else a end;
$$;

-- Follow (one-directional). Idempotent.
create or replace function follow_user(target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if target = auth.uid() then raise exception 'cannot follow yourself'; end if;
  insert into follows (follower_id, followee_id) values (auth.uid(), target)
    on conflict do nothing;
end;
$$;

create or replace function unfollow_user(target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from follows where follower_id = auth.uid() and followee_id = target;
end;
$$;

-- Send a friend request (does not grant visibility until accepted).
create or replace function request_friend(target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare lo uuid; hi uuid;
begin
  if target = auth.uid() then raise exception 'cannot friend yourself'; end if;
  lo := pair_low(auth.uid(), target);
  hi := pair_high(auth.uid(), target);
  insert into friendships (user_low, user_high, requested_by, status)
  values (lo, hi, auth.uid(), 'pending')
  on conflict (user_low, user_high) do nothing;
end;
$$;

-- Accept or decline a pending request. On accept, create reciprocal follow edges.
create or replace function respond_friend(requester uuid, accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare lo uuid; hi uuid;
begin
  lo := pair_low(auth.uid(), requester);
  hi := pair_high(auth.uid(), requester);
  -- Only the addressee (not the requester) may respond, and only while pending.
  if not exists (
    select 1 from friendships
    where user_low = lo and user_high = hi and status = 'pending' and requested_by = requester
  ) then
    raise exception 'no pending request to respond to';
  end if;

  if accept then
    update friendships set status = 'accepted', updated_at = now()
      where user_low = lo and user_high = hi;
    insert into follows (follower_id, followee_id) values (auth.uid(), requester) on conflict do nothing;
    insert into follows (follower_id, followee_id) values (requester, auth.uid()) on conflict do nothing;
  else
    delete from friendships where user_low = lo and user_high = hi;
  end if;
end;
$$;

-- Remove a friendship and the reciprocal follow edges it created.
create or replace function unfriend(other uuid)
returns void language plpgsql security definer set search_path = public as $$
declare lo uuid; hi uuid;
begin
  lo := pair_low(auth.uid(), other);
  hi := pair_high(auth.uid(), other);
  delete from friendships where user_low = lo and user_high = hi;
  delete from follows where (follower_id = auth.uid() and followee_id = other)
                         or (follower_id = other and followee_id = auth.uid());
end;
$$;

-- The single cross-user read: BEEN places of everyone the caller follows (friends included,
-- since accepting creates a follow edge). Never exposes avoid or want-to-go.
create or replace function friend_beens()
returns table (place_id text, friend_id uuid, friend_name text, friend_username text, visited_at timestamptz)
language sql security definer set search_path = public as $$
  select up.place_id, up.user_id, p.display_name, p.username, up.updated_at
  from follows f
  join user_places up on up.user_id = f.followee_id and up.state = 'been'
  join profiles p on p.id = up.user_id
  where f.follower_id = auth.uid();
$$;

-- Discovery: find users by username/display-name prefix. Returns only public identity fields.
-- A minimum length plus LIKE-metacharacter escaping stops '%'/'_' from being used to page
-- through the entire user directory one wildcard at a time.
create or replace function search_users(q text)
returns table (id uuid, username text, display_name text)
language sql security definer set search_path = public as $$
  with needle as (
    select btrim(q) as raw,
           replace(replace(replace(btrim(q), '\', '\\'), '%', '\%'), '_', '\_') as term
  )
  select p.id, p.username, p.display_name
  from profiles p, needle n
  where p.id <> auth.uid()
    and char_length(n.raw) >= 2
    and (p.username ilike n.term || '%' or p.display_name ilike n.term || '%')
  order by p.username nulls last
  limit 20;
$$;

-- Accepted friends of the caller, with public identity fields, for the friends list.
create or replace function list_friends()
returns table (id uuid, username text, display_name text)
language sql security definer set search_path = public as $$
  select p.id, p.username, p.display_name
  from friendships fr
  join profiles p on p.id = case when fr.user_low = auth.uid() then fr.user_high else fr.user_low end
  where fr.status = 'accepted' and auth.uid() in (fr.user_low, fr.user_high);
$$;

-- Incoming pending requests addressed to the caller.
create or replace function pending_friend_requests()
returns table (id uuid, username text, display_name text)
language sql security definer set search_path = public as $$
  select p.id, p.username, p.display_name
  from friendships fr
  join profiles p on p.id = fr.requested_by
  where fr.status = 'pending'
    and fr.requested_by <> auth.uid()
    and auth.uid() in (fr.user_low, fr.user_high);
$$;

grant execute on function
  follow_user(uuid), unfollow_user(uuid), request_friend(uuid), respond_friend(uuid, boolean),
  unfriend(uuid), friend_beens(), search_users(text), list_friends(), pending_friend_requests()
  to authenticated;
