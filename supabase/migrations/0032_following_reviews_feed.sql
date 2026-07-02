-- Social feed: recent reviews (and their approved photos) from people the caller follows. Mirrors
-- the friend_beens visibility model exactly: only accounts you follow, and only those with
-- shares_activity = true. Reviews are already publicly readable per place; this aggregates them
-- into an activity stream, which is precisely what shares_activity governs. Photos are returned as
-- a count plus their storage paths (the client signs on demand); the feed shows the count and the
-- place detail renders the signed images.

create or replace function following_reviews_feed(max_rows int default 30)
returns table (
  review_id uuid,
  place_id text,
  author_id uuid,
  author_username text,
  author_name text,
  body text,
  rating numeric,
  created_at timestamptz,
  photo_count int
)
language sql security definer set search_path = public as $$
  select r.id, r.place_id, r.user_id, p.username, p.display_name,
         r.body, r.rating, r.created_at,
         (select count(*) from review_photos rp where rp.review_id = r.id and rp.status = 'approved')::int as photo_count
  from follows f
  join reviews r on r.user_id = f.followee_id
  join profiles p on p.id = r.user_id
  where f.follower_id = auth.uid()
    and p.shares_activity
  order by r.created_at desc
  limit least(greatest(max_rows, 1), 100);
$$;

grant execute on function following_reviews_feed(int) to authenticated;
