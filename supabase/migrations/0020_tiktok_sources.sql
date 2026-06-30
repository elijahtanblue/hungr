-- First-party source context for places a user personally saves from TikTok.
-- Nothing here is Google content; Google display fields are still fetched live.

create table if not exists user_place_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null references places(place_id) on delete cascade,
  source text not null check (source in ('tiktok')),
  source_url text not null check (source_url ~ '^https://[^[:space:]]{1,500}$'),
  source_video_id text,
  creator_handle text,
  caption text check (caption is null or char_length(caption) <= 500),
  evidence text check (evidence is null or char_length(evidence) <= 240),
  dish_tags text[] not null default '{}',
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now(),
  unique (user_id, source_url)
);

alter table user_place_sources enable row level security;

drop policy if exists "own user_place_sources" on user_place_sources;
create policy "own user_place_sources" on user_place_sources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on user_place_sources to authenticated;

create or replace function save_tiktok_source(
  target_place_id text,
  input_source_url text,
  input_source_video_id text,
  input_creator_handle text,
  input_caption text,
  input_evidence text,
  input_dish_tags text[],
  input_confidence numeric
)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  caller uuid := auth.uid();
  clean_url text := left(btrim(input_source_url), 500);
  clean_caption text := nullif(left(btrim(coalesce(input_caption, '')), 500), '');
  clean_evidence text := nullif(left(btrim(coalesce(input_evidence, '')), 240), '');
begin
  if caller is null or target_place_id is null or clean_url = '' then
    return false;
  end if;

  insert into places (place_id) values (target_place_id)
    on conflict (place_id) do nothing;

  insert into user_places (user_id, place_id, state, updated_at)
  values (caller, target_place_id, 'go', now())
  on conflict (user_id, place_id) do update
    set state = 'go',
        updated_at = now();

  insert into user_place_sources (
    user_id,
    place_id,
    source,
    source_url,
    source_video_id,
    creator_handle,
    caption,
    evidence,
    dish_tags,
    confidence
  )
  values (
    caller,
    target_place_id,
    'tiktok',
    clean_url,
    nullif(left(btrim(coalesce(input_source_video_id, '')), 80), ''),
    nullif(left(btrim(coalesce(input_creator_handle, '')), 80), ''),
    clean_caption,
    clean_evidence,
    coalesce(input_dish_tags, '{}'),
    input_confidence
  )
  on conflict (user_id, source_url) do update
    set place_id = excluded.place_id,
        source_video_id = excluded.source_video_id,
        creator_handle = excluded.creator_handle,
        caption = excluded.caption,
        evidence = excluded.evidence,
        dish_tags = excluded.dish_tags,
        confidence = excluded.confidence;

  return true;
end;
$$;

grant execute on function save_tiktok_source(text, text, text, text, text, text, text[], numeric)
  to authenticated;
