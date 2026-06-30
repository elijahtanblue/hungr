-- First-party review photos, moderation reports, and searchable/paged hungr reviews.
-- Google photos remain live-only via the Places API; this bucket stores only user-uploaded hungr
-- review photos after SafeSearch approval.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-photos',
  'review-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists review_photos (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null references places(place_id) on delete cascade,
  storage_path text not null unique,
  width int,
  height int,
  status text not null default 'approved' check (status in ('approved', 'rejected', 'reported', 'hidden')),
  moderation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists review_photos_review_id_idx on review_photos (review_id);
create index if not exists review_photos_place_id_status_idx on review_photos (place_id, status, created_at desc);

alter table review_photos enable row level security;
drop policy if exists "approved review_photos readable" on review_photos;
create policy "approved review_photos readable" on review_photos
  for select using (status = 'approved' or auth.uid() = user_id);

grant select on review_photos to authenticated;

create table if not exists review_photo_reports (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references review_photos(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

alter table review_photo_reports enable row level security;
drop policy if exists "own review_photo_reports" on review_photo_reports;
create policy "own review_photo_reports" on review_photo_reports
  for all using (auth.uid() = reporter_id) with check (auth.uid() = reporter_id);

grant select, insert on review_photo_reports to authenticated;

drop policy if exists "upload own review photos" on storage.objects;
create policy "upload own review photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'review-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "read approved review photos" on storage.objects;
create policy "read approved review photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'review-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from review_photos rp
        where rp.storage_path = storage.objects.name
          and rp.status = 'approved'
      )
    )
  );

create or replace function save_place_review_v2(
  target_place_id text,
  review_id uuid,
  review_body text,
  review_rating numeric
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  caller uuid := auth.uid();
  saved_id uuid;
  cleaned_body text := left(trim(review_body), 2000);
begin
  if caller is null or cleaned_body = '' then
    return null;
  end if;

  insert into places (place_id) values (target_place_id)
    on conflict (place_id) do nothing;

  if review_id is null then
    insert into reviews (user_id, place_id, body, rating)
    values (caller, target_place_id, cleaned_body, review_rating)
    returning id into saved_id;
  else
    update reviews
      set body = cleaned_body,
          rating = review_rating
      where id = review_id
        and user_id = caller
        and place_id = target_place_id
      returning id into saved_id;
  end if;

  return saved_id;
end;
$$;

create or replace function get_place_reviews_page(
  target_place_id text,
  page_limit int default 26,
  page_offset int default 0,
  search_query text default null,
  sort_by text default 'newest',
  state_filter text default null,
  min_rating numeric default null,
  photos_only boolean default false
)
returns table (
  id uuid, body text, rating numeric, created_at timestamptz, is_mine boolean,
  author_id uuid, author_username text, author_name text, upvotes int, mine_upvoted boolean,
  state text, photos jsonb
)
language sql security definer set search_path = public as $$
  with enriched as (
    select r.id, r.body, r.rating, r.created_at, auth.uid() = r.user_id as is_mine,
           r.user_id as author_id, p.username as author_username, p.display_name as author_name,
           (select count(*) from review_votes v where v.review_id = r.id)::int as upvotes,
           exists (select 1 from review_votes v where v.review_id = r.id and v.user_id = auth.uid()) as mine_upvoted,
           case when up.state::text in ('liked', 'loved', 'disliked') then up.state::text else null end as state,
           coalesce((
             select jsonb_agg(jsonb_build_object(
               'id', rp.id,
               'review_id', rp.review_id,
               'storage_path', rp.storage_path,
               'width', rp.width,
               'height', rp.height,
               'created_at', rp.created_at
             ) order by rp.created_at desc)
             from review_photos rp
             where rp.review_id = r.id and rp.status = 'approved'
           ), '[]'::jsonb) as photos
    from reviews r
    left join profiles p on p.id = r.user_id
    left join user_places up on up.user_id = r.user_id and up.place_id = r.place_id
    where r.place_id = target_place_id
      and (search_query is null or r.body ilike '%' || search_query || '%')
      and (min_rating is null or r.rating >= min_rating)
      and (
        state_filter is null
        or case when up.state::text in ('liked', 'loved', 'disliked') then up.state::text else null end = state_filter
      )
      and (
        photos_only = false
        or exists (select 1 from review_photos rp where rp.review_id = r.id and rp.status = 'approved')
      )
  )
  select enriched.id, enriched.body, enriched.rating, enriched.created_at, enriched.is_mine,
         enriched.author_id, enriched.author_username, enriched.author_name, enriched.upvotes,
         enriched.mine_upvoted, enriched.state, enriched.photos
  from enriched
  order by
    case when sort_by = 'popular' then enriched.upvotes end desc nulls last,
    case when sort_by = 'rating' then enriched.rating end desc nulls last,
    enriched.created_at desc
  limit least(greatest(page_limit, 1), 51)
  offset greatest(page_offset, 0);
$$;

create or replace function report_review_photo(target_photo_id uuid, reason text) returns void
language sql security definer set search_path = public as $$
  insert into review_photo_reports (photo_id, reporter_id, reason)
  values (target_photo_id, auth.uid(), reason);

  update review_photos
    set status = case when status = 'approved' then 'reported' else status end
    where id = target_photo_id;
$$;

grant execute on function save_place_review_v2(text, uuid, text, numeric) to authenticated;
grant execute on function get_place_reviews_page(text, int, int, text, text, text, numeric, boolean) to authenticated;
grant execute on function report_review_photo(uuid, text) to authenticated;
