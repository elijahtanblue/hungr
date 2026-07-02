-- Local trend cards: anonymized, card-ready place insights for a caller's current map/search area.
--
-- The database still does not store place latitude/longitude. "Local" is defined by the caller
-- passing candidate Google place_ids from the current map area. The RPC ranks only those candidates
-- using first-party hungr activity, then returns editorial trend labels instead of raw personal
-- activity rows.

create or replace function get_local_trend_cards(
  candidate_place_ids text[],
  weeks_back int default 1,
  max_rows int default 6,
  min_actor_count int default 2
)
returns table (
  place_id text,
  trend_type text,
  headline text,
  summary text,
  trend_score numeric,
  review_count int,
  check_in_count int,
  save_count int,
  loved_count int,
  liked_count int,
  go_count int,
  disliked_count int,
  actor_count int,
  average_hungr_rating numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select date_trunc('week', now()) - ((greatest(weeks_back, 1) - 1) * interval '1 week') as start_at,
           date_trunc('week', now()) - (greatest(weeks_back, 1) * interval '1 week') as previous_start_at,
           least(greatest(max_rows, 1), 12) as row_limit,
           least(greatest(min_actor_count, 1), 10) as actor_floor
  ),
  current_events as (
    select r.place_id,
           r.user_id,
           7::numeric + greatest(0, coalesce(r.rating, 0)::numeric - 3) as score,
           1 as review_count,
           0 as check_in_count,
           0 as save_count,
           0 as loved_count,
           0 as liked_count,
           0 as go_count,
           0 as disliked_count,
           r.rating::numeric as rating
      from reviews r
     where r.created_at >= (select start_at from bounds)
       and r.place_id = any(candidate_place_ids)
    union all
    select ci.place_id, ci.user_id, 2::numeric, 0, 1, 0, 0, 0, 0, 0, null::numeric
      from check_ins ci
     where ci.created_at >= (select start_at from bounds)
       and ci.place_id = any(candidate_place_ids)
    union all
    select up.place_id,
           up.user_id,
           case up.state::text
             when 'loved' then 8::numeric
             when 'go' then 6::numeric
             when 'liked' then 4::numeric
             when 'disliked' then -7::numeric
             else 0::numeric
           end,
           0,
           0,
           case when up.state::text in ('go', 'liked', 'loved') then 1 else 0 end,
           case when up.state::text = 'loved' then 1 else 0 end,
           case when up.state::text = 'liked' then 1 else 0 end,
           case when up.state::text = 'go' then 1 else 0 end,
           case when up.state::text = 'disliked' then 1 else 0 end,
           null::numeric
      from user_places up
     where up.updated_at >= (select start_at from bounds)
       and up.place_id = any(candidate_place_ids)
       and up.state::text in ('go', 'liked', 'loved', 'disliked')
  ),
  previous_events as (
    select r.place_id, r.user_id, 7::numeric + greatest(0, coalesce(r.rating, 0)::numeric - 3) as score
      from reviews r
     where r.created_at >= (select previous_start_at from bounds)
       and r.created_at < (select start_at from bounds)
       and r.place_id = any(candidate_place_ids)
    union all
    select ci.place_id, ci.user_id, 2::numeric
      from check_ins ci
     where ci.created_at >= (select previous_start_at from bounds)
       and ci.created_at < (select start_at from bounds)
       and ci.place_id = any(candidate_place_ids)
    union all
    select up.place_id,
           up.user_id,
           case up.state::text
             when 'loved' then 8::numeric
             when 'go' then 6::numeric
             when 'liked' then 4::numeric
             when 'disliked' then -7::numeric
             else 0::numeric
           end
      from user_places up
     where up.updated_at >= (select previous_start_at from bounds)
       and up.updated_at < (select start_at from bounds)
       and up.place_id = any(candidate_place_ids)
       and up.state::text in ('go', 'liked', 'loved', 'disliked')
  ),
  current_scored as (
    select e.place_id,
           sum(e.score)::numeric as current_score,
           sum(e.review_count)::int as review_count,
           sum(e.check_in_count)::int as check_in_count,
           sum(e.save_count)::int as save_count,
           sum(e.loved_count)::int as loved_count,
           sum(e.liked_count)::int as liked_count,
           sum(e.go_count)::int as go_count,
           sum(e.disliked_count)::int as disliked_count,
           count(distinct e.user_id)::int as current_actor_count,
           round(avg(e.rating) filter (where e.rating is not null), 1) as average_hungr_rating
      from current_events e
     group by e.place_id
  ),
  previous_scored as (
    select e.place_id,
           sum(e.score)::numeric as previous_score,
           count(distinct e.user_id)::int as previous_actor_count
      from previous_events e
     group by e.place_id
  ),
  scored as (
    select coalesce(c.place_id, p.place_id) as place_id,
           greatest(coalesce(c.current_score, 0), coalesce(p.previous_score, 0) * 0.35)::numeric as trend_score,
           coalesce(c.current_score, 0)::numeric as current_score,
           coalesce(p.previous_score, 0)::numeric as previous_score,
           coalesce(c.review_count, 0)::int as review_count,
           coalesce(c.check_in_count, 0)::int as check_in_count,
           coalesce(c.save_count, 0)::int as save_count,
           coalesce(c.loved_count, 0)::int as loved_count,
           coalesce(c.liked_count, 0)::int as liked_count,
           coalesce(c.go_count, 0)::int as go_count,
           coalesce(c.disliked_count, 0)::int as disliked_count,
           greatest(coalesce(c.current_actor_count, 0), coalesce(p.previous_actor_count, 0))::int as actor_count,
           c.average_hungr_rating
      from current_scored c
      full join previous_scored p on p.place_id = c.place_id
  ),
  labelled as (
    select s.*,
           case
             when s.previous_score >= 12 and s.current_score <= s.previous_score * 0.5 then 'quieter_pick'
             when s.average_hungr_rating >= 4.5 and s.review_count >= 2 then 'consistently_loved'
             when s.loved_count >= 2 or (s.loved_count + s.liked_count) >= 3 then 'consistently_loved'
             when s.current_score >= 18 or s.actor_count >= 4 then 'popping_off'
             else 'up_and_coming'
           end as trend_type
      from scored s
     where s.actor_count >= (select actor_floor from bounds)
       and (s.current_score > 0 or s.previous_score >= 12)
  )
  select l.place_id,
         l.trend_type,
         case l.trend_type
           when 'quieter_pick' then 'A quieter pick right now'
           when 'consistently_loved' then 'Getting strong hungr reviews'
           when 'popping_off' then 'This place is popping off'
           else 'Up and coming nearby'
         end as headline,
         case l.trend_type
           when 'quieter_pick' then 'It had more hungr activity recently and looks calmer this week.'
           when 'consistently_loved' then 'Recent hungr reviews and positive saves are holding up well.'
           when 'popping_off' then 'More people nearby are saving, visiting, or reviewing it this week.'
           else 'Early hungr signals suggest this place is worth keeping an eye on.'
         end as summary,
         l.trend_score,
         l.review_count,
         l.check_in_count,
         l.save_count,
         l.loved_count,
         l.liked_count,
         l.go_count,
         l.disliked_count,
         l.actor_count,
         l.average_hungr_rating
    from labelled l
   order by l.trend_score desc, l.review_count desc, l.check_in_count desc, l.place_id
   limit (select row_limit from bounds);
$$;

grant execute on function get_local_trend_cards(text[], int, int, int) to authenticated;

notify pgrst, 'reload schema';
