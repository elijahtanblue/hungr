-- Taste tracking opt-out.
--
-- The opt-out preserves existing taste_events and derived taste profile reads. It only stops new
-- tracking from this point forward. delete_my_taste_events() remains the separate destructive path;
-- toggling this flag never deletes rows.

alter table profiles add column if not exists taste_tracking_enabled boolean not null default true;

create or replace function get_taste_tracking_settings()
returns table (taste_tracking_enabled boolean)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.taste_tracking_enabled from profiles p where p.id = auth.uid()),
    true
  ) as taste_tracking_enabled;
$$;

create or replace function set_taste_tracking_enabled(enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    return false;
  end if;

  insert into profiles (id, taste_tracking_enabled)
  values (caller, coalesce(enabled, true))
  on conflict (id) do update
    set taste_tracking_enabled = excluded.taste_tracking_enabled;

  return true;
end;
$$;

create or replace function taste_tracking_enabled_for(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when target_user_id is null then false
    else coalesce(
      (select p.taste_tracking_enabled from profiles p where p.id = target_user_id),
      true
    )
  end;
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
  if caller is null or not taste_tracking_enabled_for(caller) then
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
  if caller is null or not taste_tracking_enabled_for(caller) then
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
language plpgsql
security definer
set search_path = public
as $$
begin
  if not taste_tracking_enabled_for(target_user_id) then
    return;
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
end;
$$;

revoke all on function get_taste_tracking_settings() from public;
revoke all on function set_taste_tracking_enabled(boolean) from public;
revoke all on function taste_tracking_enabled_for(uuid) from public;
revoke all on function record_taste_event(text, text, text, text, text, numeric, text, jsonb) from public;
revoke all on function record_search_taste_event(text[], text[], int, int, text) from public;

grant execute on function get_taste_tracking_settings() to authenticated;
grant execute on function set_taste_tracking_enabled(boolean) to authenticated;
grant execute on function record_taste_event(text, text, text, text, text, numeric, text, jsonb) to authenticated;
grant execute on function record_search_taste_event(text[], text[], int, int, text) to authenticated;

notify pgrst, 'reload schema';
