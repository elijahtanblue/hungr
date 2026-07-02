-- Personalization backend.
--
-- Stores distilled taste memories only, never chat transcripts. Local trends are computed from
-- first-party hungr events. Google place IDs remain the only durable Google identifier stored here.

create table if not exists user_taste_memories (
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_key text not null check (memory_key ~ '^[a-z0-9_]{3,64}$'),
  memory_value text not null check (char_length(memory_value) between 1 and 240),
  confidence numeric(3,2) not null default 0.60 check (confidence >= 0 and confidence <= 1),
  source text not null default 'chat' check (source in ('chat', 'behavioral', 'system')),
  updated_at timestamptz not null default now(),
  primary key (user_id, memory_key)
);

create index if not exists user_taste_memories_user_updated_idx
  on user_taste_memories (user_id, updated_at desc);

alter table user_taste_memories enable row level security;

drop policy if exists "own user_taste_memories read" on user_taste_memories;
create policy "own user_taste_memories read"
  on user_taste_memories for select
  using (auth.uid() = user_id);

grant select on user_taste_memories to authenticated;

create or replace function get_taste_memories()
returns table (memory_key text, memory_value text, confidence numeric, source text, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.memory_key, m.memory_value, m.confidence, m.source, m.updated_at
    from user_taste_memories m
   where m.user_id = auth.uid()
   order by m.confidence desc, m.updated_at desc
   limit 50;
$$;

create or replace function upsert_taste_memory(
  input_key text,
  input_value text,
  input_confidence numeric default 0.60,
  input_source text default 'chat'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  clean_key text := lower(btrim(coalesce(input_key, '')));
  clean_value text := left(btrim(coalesce(input_value, '')), 240);
  clean_source text := lower(btrim(coalesce(input_source, 'chat')));
  clean_confidence numeric := least(1, greatest(0, coalesce(input_confidence, 0.60)));
begin
  if caller is null or clean_key !~ '^[a-z0-9_]{3,64}$' or clean_value = '' then
    return false;
  end if;

  if clean_key ~ '(ethnic|ethnicity|heritage|religion|health|medical|race|racial)' then
    return false;
  end if;

  if clean_source not in ('chat', 'behavioral', 'system') then
    clean_source := 'chat';
  end if;

  insert into user_taste_memories (user_id, memory_key, memory_value, confidence, source, updated_at)
  values (caller, clean_key, clean_value, clean_confidence, clean_source, now())
  on conflict (user_id, memory_key) do update
    set memory_value = excluded.memory_value,
        confidence = greatest(user_taste_memories.confidence, excluded.confidence),
        source = excluded.source,
        updated_at = now();

  return true;
end;
$$;

create or replace function get_taste_profile()
returns table (favorite_cuisines text[], state_counts jsonb, cuisine_scores jsonb)
language sql
stable
security definer
set search_path = public
as $$
  with caller_profile as (
    select coalesce(p.favorite_cuisines, '{}') as favorite_cuisines
      from profiles p
     where p.id = auth.uid()
  ),
  states as (
    select up.state::text as state, count(*)::int as count
      from user_places up
     where up.user_id = auth.uid()
       and up.state::text in ('go', 'liked', 'loved', 'disliked')
     group by up.state::text
  ),
  cuisine_rows as (
    select c.name as cuisine,
           sum(case up.state::text
             when 'loved' then 8
             when 'go' then 6
             when 'liked' then 4
             when 'disliked' then -7
             else 0
           end)::numeric as score,
           count(*)::int as sample_count
      from user_places up
      join place_cuisines pc on pc.place_id = up.place_id
      join cuisines c on c.id = pc.cuisine_id
     where up.user_id = auth.uid()
       and up.state::text in ('go', 'liked', 'loved', 'disliked')
     group by c.name
  )
  select coalesce((select favorite_cuisines from caller_profile), '{}'),
         coalesce((select jsonb_object_agg(state, count) from states), '{}'::jsonb),
         coalesce((
           select jsonb_agg(
             jsonb_build_object('cuisine', cuisine, 'score', score, 'sampleCount', sample_count)
             order by score desc, cuisine asc
           )
           from cuisine_rows
         ), '[]'::jsonb);
$$;

create index if not exists reviews_created_place_idx on reviews (created_at desc, place_id);
create index if not exists check_ins_created_place_idx on check_ins (created_at desc, place_id);
create index if not exists user_places_updated_state_place_idx on user_places (updated_at desc, state, place_id);

create or replace function get_weekly_place_trends(weeks_back int default 1, max_rows int default 25)
returns table (
  place_id text,
  trend_score numeric,
  review_count int,
  check_in_count int,
  save_count int,
  loved_count int,
  liked_count int,
  go_count int,
  disliked_count int
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select date_trunc('week', now()) - ((greatest(weeks_back, 1) - 1) * interval '1 week') as start_at,
           least(greatest(max_rows, 1), 100) as row_limit
  ),
  events as (
    select r.place_id, 5::numeric as score, 1 as review_count, 0 as check_in_count,
           0 as save_count, 0 as loved_count, 0 as liked_count, 0 as go_count, 0 as disliked_count
      from reviews r
     where r.created_at >= (select start_at from bounds)
    union all
    select ci.place_id, 2::numeric, 0, 1, 0, 0, 0, 0, 0
      from check_ins ci
     where ci.created_at >= (select start_at from bounds)
    union all
    select up.place_id,
           case up.state::text
             when 'loved' then 8::numeric
             when 'go' then 6::numeric
             when 'liked' then 4::numeric
             when 'disliked' then -7::numeric
             else 0::numeric
           end,
           0,
           0,
           1,
           case when up.state::text = 'loved' then 1 else 0 end,
           case when up.state::text = 'liked' then 1 else 0 end,
           case when up.state::text = 'go' then 1 else 0 end,
           case when up.state::text = 'disliked' then 1 else 0 end
      from user_places up
     where up.updated_at >= (select start_at from bounds)
       and up.state::text in ('go', 'liked', 'loved', 'disliked')
  ),
  scored as (
    select e.place_id,
           sum(e.score)::numeric as trend_score,
           sum(e.review_count)::int as review_count,
           sum(e.check_in_count)::int as check_in_count,
           sum(e.save_count)::int as save_count,
           sum(e.loved_count)::int as loved_count,
           sum(e.liked_count)::int as liked_count,
           sum(e.go_count)::int as go_count,
           sum(e.disliked_count)::int as disliked_count
      from events e
     group by e.place_id
  )
  select s.place_id,
         s.trend_score,
         s.review_count,
         s.check_in_count,
         s.save_count,
         s.loved_count,
         s.liked_count,
         s.go_count,
         s.disliked_count
    from scored s
   where s.trend_score > 0
   order by s.trend_score desc, s.review_count desc, s.check_in_count desc, s.place_id
   limit (select row_limit from bounds);
$$;

grant execute on function get_taste_memories() to authenticated;
grant execute on function upsert_taste_memory(text, text, numeric, text) to authenticated;
grant execute on function get_taste_profile() to authenticated;
grant execute on function get_weekly_place_trends(int, int) to authenticated;

notify pgrst, 'reload schema';
