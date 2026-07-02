-- Track when a hungr review was edited, so the UI can label edited reviews. A review is "edited"
-- when it was updated meaningfully after creation. We stamp updated_at on the edit path only, and
-- expose a derived `edited` flag (guarded by a 1s epsilon so the create transaction never counts).

alter table reviews add column if not exists updated_at timestamptz;
-- Existing rows predate editing: treat them as never edited.
update reviews set updated_at = created_at where updated_at is null;
alter table reviews alter column updated_at set default now();
alter table reviews alter column updated_at set not null;

-- Stamp updated_at only when an existing review is edited (insert leaves it equal to created_at).
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
          rating = review_rating,
          updated_at = now()
      where id = review_id
        and user_id = caller
        and place_id = target_place_id
      returning id into saved_id;
  end if;

  return saved_id;
end;
$$;

-- Return type gains an `edited` column, so the function must be dropped and recreated.
drop function if exists get_place_reviews_page(text, int, int, text, text, text, numeric, boolean);

create function get_place_reviews_page(
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
  id uuid, body text, rating numeric, created_at timestamptz, edited boolean, is_mine boolean,
  author_id uuid, author_username text, author_name text, upvotes int, mine_upvoted boolean,
  state text, photos jsonb
)
language sql security definer set search_path = public as $$
  with enriched as (
    select r.id, r.body, r.rating, r.created_at,
           r.updated_at > r.created_at + interval '1 second' as edited,
           auth.uid() = r.user_id as is_mine,
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
  select enriched.id, enriched.body, enriched.rating, enriched.created_at, enriched.edited, enriched.is_mine,
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

grant execute on function get_place_reviews_page(text, int, int, text, text, text, numeric, boolean) to authenticated;
