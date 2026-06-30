-- Reviews can display the author's current first-party sentiment for that place when it exists.
-- Missing state returns null so older reviews and plain text reviews render without a chip.
--
-- Recovery note: an earlier duplicate migration version meant some remote databases recorded
-- version 0015 without necessarily applying 0015_review_social.sql. Recreate the review-social
-- prerequisites here idempotently before the review RPCs below reference review_votes.

create table if not exists review_votes (
  review_id uuid not null references reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);
alter table review_votes enable row level security;
drop policy if exists "own review_votes" on review_votes;
create policy "own review_votes" on review_votes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, delete on review_votes to authenticated;

create table if not exists review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);
alter table review_reports enable row level security;
drop policy if exists "own review_reports" on review_reports;
create policy "own review_reports" on review_reports
  for all using (auth.uid() = reporter_id) with check (auth.uid() = reporter_id);
grant select, insert on review_reports to authenticated;

create or replace function upvote_review(target_review_id uuid) returns void
language sql security definer set search_path = public as $$
  insert into review_votes (review_id, user_id) values (target_review_id, auth.uid())
  on conflict do nothing;
$$;

create or replace function remove_review_upvote(target_review_id uuid) returns void
language sql security definer set search_path = public as $$
  delete from review_votes where review_id = target_review_id and user_id = auth.uid();
$$;

create or replace function report_review(target_review_id uuid, reason text) returns void
language sql security definer set search_path = public as $$
  insert into review_reports (review_id, reporter_id, reason) values (target_review_id, auth.uid(), reason);
$$;

create or replace function get_user_profile(target uuid)
returns table (id uuid, username text, display_name text, followers int, following int, is_following boolean)
language sql security definer set search_path = public as $$
  select p.id, p.username, p.display_name,
         (select count(*) from follows where followee_id = p.id)::int,
         (select count(*) from follows where follower_id = p.id)::int,
         exists (select 1 from follows where follower_id = auth.uid() and followee_id = p.id)
  from profiles p where p.id = target;
$$;

grant execute on function upvote_review(uuid), remove_review_upvote(uuid), report_review(uuid, text) to authenticated;
grant execute on function get_user_profile(uuid) to authenticated;

drop function if exists get_place_reviews(text);
create or replace function get_place_reviews(target_place_id text)
returns table (
  id uuid, body text, rating numeric, created_at timestamptz, is_mine boolean,
  author_id uuid, author_username text, author_name text, upvotes int, mine_upvoted boolean,
  state text
)
language sql security definer set search_path = public as $$
  select r.id, r.body, r.rating, r.created_at, auth.uid() = r.user_id,
         r.user_id, p.username, p.display_name,
         (select count(*) from review_votes v where v.review_id = r.id)::int,
         exists (select 1 from review_votes v where v.review_id = r.id and v.user_id = auth.uid()),
         case when up.state::text in ('liked', 'loved', 'disliked') then up.state::text else null end
  from reviews r
  left join profiles p on p.id = r.user_id
  left join user_places up on up.user_id = r.user_id and up.place_id = r.place_id
  where r.place_id = target_place_id
  order by r.created_at desc;
$$;

drop function if exists get_my_reviews();
create or replace function get_my_reviews()
returns table (id uuid, place_id text, body text, rating numeric, state text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select r.id, r.place_id, r.body, r.rating,
         case when up.state::text in ('liked', 'loved', 'disliked') then up.state::text else null end,
         r.created_at
  from reviews r
  left join user_places up on up.user_id = r.user_id and up.place_id = r.place_id
  where r.user_id = auth.uid()
  order by r.created_at desc;
$$;

drop function if exists get_user_reviews(uuid);
create or replace function get_user_reviews(target uuid)
returns table (id uuid, place_id text, body text, rating numeric, state text, created_at timestamptz, upvotes int)
language sql security definer set search_path = public as $$
  select r.id, r.place_id, r.body, r.rating,
         case when up.state::text in ('liked', 'loved', 'disliked') then up.state::text else null end,
         r.created_at,
         (select count(*) from review_votes v where v.review_id = r.id)::int
  from reviews r
  left join user_places up on up.user_id = r.user_id and up.place_id = r.place_id
  where r.user_id = target
  order by r.created_at desc;
$$;
