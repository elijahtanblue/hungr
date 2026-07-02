-- Taste event tracking.
--
-- This stores first-party behavioral signals as append-only events so taste features can be
-- recomputed later. It deliberately avoids raw search text and raw TikTok captions. TikTok-derived
-- taste input comes from hashtags only, stored in the existing user_place_sources.dish_tags array.

create table if not exists taste_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'place_state',
    'check_in',
    'review_rating',
    'review_text_tag',
    'onboarding_cuisine',
    'search_facet',
    'tiktok_hashtag',
    'ai_memory'
  )),
  place_id text references places(place_id) on delete set null,
  cuisine text check (cuisine is null or char_length(cuisine) between 1 and 80),
  tag text check (tag is null or char_length(tag) between 1 and 80),
  signal text check (signal is null or char_length(signal) between 1 and 80),
  weight numeric(5,2) not null default 0,
  source text not null default 'system' check (source in (
    'place_state',
    'check_in',
    'review',
    'onboarding',
    'search',
    'tiktok',
    'ai',
    'system'
  )),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists taste_events_user_created_idx
  on taste_events (user_id, created_at desc);
create index if not exists taste_events_user_type_idx
  on taste_events (user_id, event_type, created_at desc);
create index if not exists taste_events_user_cuisine_idx
  on taste_events (user_id, lower(cuisine))
  where cuisine is not null;
create index if not exists taste_events_user_tag_idx
  on taste_events (user_id, lower(tag))
  where tag is not null;

alter table taste_events enable row level security;

drop policy if exists "own taste_events read" on taste_events;
create policy "own taste_events read"
  on taste_events for select
  using (auth.uid() = user_id);

grant select on taste_events to authenticated;

create or replace function taste_state_weight(input_state text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case input_state
    when 'loved' then 8::numeric
    when 'go' then 6::numeric
    when 'liked' then 4::numeric
    when 'disliked' then -7::numeric
    else 0::numeric
  end;
$$;

create or replace function clean_taste_token(input text, max_len int default 80)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(left(lower(btrim(regexp_replace(coalesce(input, ''), '\s+', ' ', 'g'))), max_len), '');
$$;

create or replace function taste_tags_from_text(input text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_agg(tag order by tag), '{}') from (
    values
      ('bbq', '(bbq|barbecue|brisket|smoked meat)'),
      ('steak', '(steak|rib eye|ribeye|wagyu)'),
      ('burger', '(burger|cheeseburger|smash burger)'),
      ('plant_forward', '(vegan|vegetarian|plant based|plant-based|tofu|salad)'),
      ('coffee', '(coffee|espresso|latte|cappuccino|flat white)'),
      ('dessert', '(dessert|cake|ice cream|gelato|pastry|croissant)'),
      ('spicy', '(spicy|chilli|chili|hotpot|sichuan|mala)'),
      ('noodles', '(ramen|noodle|pho|laksa|udon|soba)'),
      ('value', '(cheap|value|affordable|well priced|good price)'),
      ('price_sensitive', '(expensive|overpriced|pricey)'),
      ('service', '(service|staff|waiter|waitress)')
  ) as patterns(tag, pattern)
  where coalesce(input, '') ~* pattern;
$$;

create or replace function record_taste_event(
  input_event_type text,
  input_place_id text default null,
  input_cuisine text default null,
  input_tag text default null,
  input_signal text default null,
  input_weight numeric default 0,
  input_source text default 'system',
  input_metadata jsonb default '{}'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  clean_event text := clean_taste_token(input_event_type, 80);
  clean_source text := clean_taste_token(input_source, 80);
  clean_cuisine text := clean_taste_token(input_cuisine, 80);
  clean_tag text := clean_taste_token(input_tag, 80);
  clean_signal text := clean_taste_token(input_signal, 80);
  clean_metadata jsonb := coalesce(input_metadata, '{}'::jsonb);
begin
  if caller is null then
    return false;
  end if;

  if clean_event not in (
    'place_state',
    'check_in',
    'review_rating',
    'review_text_tag',
    'onboarding_cuisine',
    'search_facet',
    'tiktok_hashtag',
    'ai_memory'
  ) then
    return false;
  end if;

  if clean_source not in ('place_state', 'check_in', 'review', 'onboarding', 'search', 'tiktok', 'ai', 'system') then
    clean_source := 'system';
  end if;

  if jsonb_typeof(clean_metadata) <> 'object' then
    clean_metadata := '{}'::jsonb;
  end if;

  if clean_metadata ?| array['query', 'caption', 'body', 'review_text', 'message'] then
    clean_metadata := '{}'::jsonb;
  end if;

  if input_place_id is not null and btrim(input_place_id) <> '' then
    insert into places (place_id) values (left(btrim(input_place_id), 220))
    on conflict (place_id) do nothing;
  end if;

  insert into taste_events (
    user_id,
    event_type,
    place_id,
    cuisine,
    tag,
    signal,
    weight,
    source,
    metadata
  )
  values (
    caller,
    clean_event,
    nullif(left(btrim(coalesce(input_place_id, '')), 220), ''),
    clean_cuisine,
    clean_tag,
    clean_signal,
    coalesce(input_weight, 0),
    clean_source,
    clean_metadata
  );

  return true;
end;
$$;

create or replace function record_search_taste_event(
  input_cuisines text[] default '{}',
  input_dietary text[] default '{}',
  input_price_min int default null,
  input_price_max int default null,
  input_occasion text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  inserted int := 0;
  item text;
  clean_item text;
  clean_occasion text := clean_taste_token(input_occasion, 80);
begin
  if caller is null then
    return 0;
  end if;

  foreach item in array coalesce(input_cuisines, '{}') loop
    clean_item := clean_taste_token(item, 80);
    if clean_item is not null then
      insert into taste_events (user_id, event_type, cuisine, signal, weight, source)
      values (caller, 'search_facet', clean_item, 'searched_cuisine', 1, 'search');
      inserted := inserted + 1;
    end if;
  end loop;

  foreach item in array coalesce(input_dietary, '{}') loop
    clean_item := clean_taste_token(item, 80);
    if clean_item is not null then
      insert into taste_events (user_id, event_type, tag, signal, weight, source)
      values (caller, 'search_facet', clean_item, 'searched_dietary', 1, 'search');
      inserted := inserted + 1;
    end if;
  end loop;

  if input_price_min is not null or input_price_max is not null then
    insert into taste_events (user_id, event_type, signal, weight, source, metadata)
    values (
      caller,
      'search_facet',
      'searched_price',
      1,
      'search',
      jsonb_build_object('priceMin', input_price_min, 'priceMax', input_price_max)
    );
    inserted := inserted + 1;
  end if;

  if clean_occasion is not null then
    insert into taste_events (user_id, event_type, tag, signal, weight, source)
    values (caller, 'search_facet', clean_occasion, 'searched_occasion', 1, 'search');
    inserted := inserted + 1;
  end if;

  return inserted;
end;
$$;

create or replace function insert_taste_event_for_user(
  target_user_id uuid,
  input_event_type text,
  input_place_id text default null,
  input_cuisine text default null,
  input_tag text default null,
  input_signal text default null,
  input_weight numeric default 0,
  input_source text default 'system',
  input_metadata jsonb default '{}',
  input_created_at timestamptz default now()
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into taste_events (
    user_id,
    event_type,
    place_id,
    cuisine,
    tag,
    signal,
    weight,
    source,
    metadata,
    created_at
  )
  values (
    target_user_id,
    input_event_type,
    input_place_id,
    clean_taste_token(input_cuisine, 80),
    clean_taste_token(input_tag, 80),
    clean_taste_token(input_signal, 80),
    coalesce(input_weight, 0),
    input_source,
    case
      when jsonb_typeof(coalesce(input_metadata, '{}'::jsonb)) = 'object'
        and not (coalesce(input_metadata, '{}'::jsonb) ?| array['query', 'caption', 'body', 'review_text', 'message'])
      then coalesce(input_metadata, '{}'::jsonb)
      else '{}'::jsonb
    end,
    coalesce(input_created_at, now())
  );
$$;

create or replace function track_user_place_taste_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.state is distinct from old.state then
    perform insert_taste_event_for_user(
      new.user_id,
      'place_state',
      new.place_id,
      null,
      null,
      new.state::text,
      taste_state_weight(new.state::text),
      'place_state',
      '{}'::jsonb,
      new.updated_at
    );
  end if;
  return new;
end;
$$;

drop trigger if exists user_places_taste_event on user_places;
create trigger user_places_taste_event
after insert or update of state on user_places
for each row execute function track_user_place_taste_event();

create or replace function track_check_in_taste_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform insert_taste_event_for_user(
    new.user_id,
    'check_in',
    new.place_id,
    null,
    null,
    'checked_in',
    2,
    'check_in',
    '{}'::jsonb,
    new.created_at
  );
  return new;
end;
$$;

drop trigger if exists check_ins_taste_event on check_ins;
create trigger check_ins_taste_event
after insert on check_ins
for each row execute function track_check_in_taste_event();

create or replace function track_review_taste_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tag text;
begin
  if new.rating is not null then
    perform insert_taste_event_for_user(
      new.user_id,
      'review_rating',
      new.place_id,
      null,
      null,
      'review_rating',
      least(5, greatest(0, new.rating::numeric)),
      'review',
      '{}'::jsonb,
      new.created_at
    );
  end if;

  foreach tag in array taste_tags_from_text(new.body) loop
    perform insert_taste_event_for_user(
      new.user_id,
      'review_text_tag',
      new.place_id,
      null,
      tag,
      'review_keyword',
      3,
      'review',
      '{}'::jsonb,
      new.created_at
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists reviews_taste_event on reviews;
create trigger reviews_taste_event
after insert or update of body, rating on reviews
for each row execute function track_review_taste_event();

create or replace function track_profile_cuisine_taste_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cuisine text;
begin
  if tg_op = 'INSERT' or new.favorite_cuisines is distinct from old.favorite_cuisines then
    foreach cuisine in array coalesce(new.favorite_cuisines, '{}') loop
      perform insert_taste_event_for_user(
        new.id,
        'onboarding_cuisine',
        null,
        cuisine,
        null,
        'favorite_cuisine',
        5,
        'onboarding',
        '{}'::jsonb,
        coalesce(new.onboarded_at, now())
      );
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_taste_event on profiles;
create trigger profiles_taste_event
after insert or update of favorite_cuisines on profiles
for each row execute function track_profile_cuisine_taste_event();

create or replace function track_tiktok_hashtag_taste_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tag text;
begin
  foreach tag in array coalesce(new.dish_tags, '{}') loop
    perform insert_taste_event_for_user(
      new.user_id,
      'tiktok_hashtag',
      new.place_id,
      null,
      tag,
      'tiktok_hashtag',
      3,
      'tiktok',
      '{}'::jsonb,
      new.created_at
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists user_place_sources_taste_event on user_place_sources;
create trigger user_place_sources_taste_event
after insert or update of dish_tags on user_place_sources
for each row execute function track_tiktok_hashtag_taste_event();

create or replace function track_taste_memory_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform insert_taste_event_for_user(
    new.user_id,
    'ai_memory',
    null,
    null,
    new.memory_key,
    'taste_memory',
    greatest(0, least(3, new.confidence * 3)),
    case when new.source = 'chat' then 'ai' else 'system' end,
    '{}'::jsonb,
    new.updated_at
  );
  return new;
end;
$$;

drop trigger if exists user_taste_memories_taste_event on user_taste_memories;
create trigger user_taste_memories_taste_event
after insert or update of memory_key, memory_value, confidence on user_taste_memories
for each row execute function track_taste_memory_event();

create or replace function get_taste_feature_scores(max_rows int default 50)
returns table (feature text, score numeric, evidence_count int, last_seen_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with features as (
    select case
             when cuisine is not null then 'cuisine:' || lower(cuisine)
             when tag is not null then 'tag:' || lower(tag)
             when signal is not null then 'signal:' || lower(signal)
             else 'event:' || event_type
           end as feature,
           weight,
           created_at
      from taste_events
     where user_id = auth.uid()
  )
  select feature,
         round(sum(weight), 2) as score,
         count(*)::int as evidence_count,
         max(created_at) as last_seen_at
    from features
   group by feature
   having count(*) > 0
   order by score desc, evidence_count desc, feature asc
   limit least(greatest(max_rows, 1), 100);
$$;

create or replace function delete_my_taste_events()
returns boolean
language sql
security definer
set search_path = public
as $$
  delete from taste_events where user_id = auth.uid();
  select true;
$$;

-- Backfill existing first-party behavior once. These are derived signals, not profile archetypes.
insert into taste_events (user_id, event_type, place_id, signal, weight, source, created_at)
select up.user_id, 'place_state', up.place_id, up.state::text, taste_state_weight(up.state::text), 'place_state', up.updated_at
from user_places up
where up.state::text in ('go', 'liked', 'loved', 'disliked');

insert into taste_events (user_id, event_type, place_id, signal, weight, source, created_at)
select ci.user_id, 'check_in', ci.place_id, 'checked_in', 2, 'check_in', ci.created_at
from check_ins ci;

insert into taste_events (user_id, event_type, place_id, signal, weight, source, created_at)
select r.user_id, 'review_rating', r.place_id, 'review_rating', least(5, greatest(0, r.rating::numeric)), 'review', r.created_at
from reviews r
where r.rating is not null;

insert into taste_events (user_id, event_type, place_id, tag, signal, weight, source, created_at)
select r.user_id, 'review_text_tag', r.place_id, tag, 'review_keyword', 3, 'review', r.created_at
from reviews r
cross join lateral unnest(taste_tags_from_text(r.body)) as tag;

insert into taste_events (user_id, event_type, cuisine, signal, weight, source, created_at)
select p.id, 'onboarding_cuisine', cuisine, 'favorite_cuisine', 5, 'onboarding', coalesce(p.onboarded_at, p.created_at)
from profiles p
cross join lateral unnest(coalesce(p.favorite_cuisines, '{}')) as cuisine;

insert into taste_events (user_id, event_type, place_id, tag, signal, weight, source, created_at)
select ups.user_id, 'tiktok_hashtag', ups.place_id, tag, 'tiktok_hashtag', 3, 'tiktok', ups.created_at
from user_place_sources ups
cross join lateral unnest(coalesce(ups.dish_tags, '{}')) as tag;

insert into taste_events (user_id, event_type, tag, signal, weight, source, created_at)
select m.user_id,
       'ai_memory',
       m.memory_key,
       'taste_memory',
       greatest(0, least(3, m.confidence * 3)),
       case when m.source = 'chat' then 'ai' else 'system' end,
       m.updated_at
from user_taste_memories m;

grant execute on function record_taste_event(text, text, text, text, text, numeric, text, jsonb) to authenticated;
grant execute on function record_search_taste_event(text[], text[], int, int, text) to authenticated;
grant execute on function get_taste_feature_scores(int) to authenticated;
grant execute on function delete_my_taste_events() to authenticated;

notify pgrst, 'reload schema';
