-- Review social layer: upvotes (no downvotes), reports for founder moderation, public author
-- attribution, and read accessors for visiting another user's profile.

-- One upvote per user per review.
create table review_votes (
  review_id uuid not null references reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);
alter table review_votes enable row level security;
create policy "own review_votes" on review_votes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, delete on review_votes to authenticated;

-- Reports go to a table only the founder reads (in the dashboard). Reporters see only their own.
create table review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);
alter table review_reports enable row level security;
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

-- get_place_reviews now exposes the author (public attribution, so reviews link to a profile) plus
-- the upvote count and whether the caller has upvoted.
create or replace function get_place_reviews(target_place_id text)
returns table (
  id uuid, body text, rating numeric, created_at timestamptz, is_mine boolean,
  author_id uuid, author_username text, author_name text, upvotes int, mine_upvoted boolean
)
language sql security definer set search_path = public as $$
  select r.id, r.body, r.rating, r.created_at, auth.uid() = r.user_id,
         r.user_id, p.username, p.display_name,
         (select count(*) from review_votes v where v.review_id = r.id)::int,
         exists (select 1 from review_votes v where v.review_id = r.id and v.user_id = auth.uid())
  from reviews r
  left join profiles p on p.id = r.user_id
  where r.place_id = target_place_id
  order by r.created_at desc;
$$;

grant execute on function upvote_review(uuid), remove_review_upvote(uuid), report_review(uuid, text) to authenticated;

-- Public-ish profile view for visiting someone from a review: identity, follower/following counts,
-- and whether the caller already follows them.
create or replace function get_user_profile(target uuid)
returns table (id uuid, username text, display_name text, followers int, following int, is_following boolean)
language sql security definer set search_path = public as $$
  select p.id, p.username, p.display_name,
         (select count(*) from follows where followee_id = p.id)::int,
         (select count(*) from follows where follower_id = p.id)::int,
         exists (select 1 from follows where follower_id = auth.uid() and followee_id = p.id)
  from profiles p where p.id = target;
$$;

create or replace function get_user_reviews(target uuid)
returns table (id uuid, place_id text, body text, rating numeric, created_at timestamptz, upvotes int)
language sql security definer set search_path = public as $$
  select r.id, r.place_id, r.body, r.rating, r.created_at,
         (select count(*) from review_votes v where v.review_id = r.id)::int
  from reviews r where r.user_id = target
  order by r.created_at desc;
$$;

grant execute on function get_user_profile(uuid), get_user_reviews(uuid) to authenticated;
