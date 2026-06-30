-- Half-star first-party ratings and server-side check-in throttling.

alter table reviews drop constraint if exists reviews_rating_check;
alter table reviews alter column rating type numeric(2,1) using rating::numeric;
alter table reviews add constraint reviews_rating_half_step
  check (
    rating is null
    or (rating >= 0.5 and rating <= 5 and rating * 2 = floor(rating * 2))
  );

alter table user_places drop constraint if exists user_places_rating_check;
alter table user_places alter column rating type numeric(2,1) using rating::numeric;
alter table user_places add constraint user_places_rating_half_step
  check (
    rating is null
    or (rating >= 0.5 and rating <= 5 and rating * 2 = floor(rating * 2))
  );

create or replace function check_in_place(target_place_id text)
returns table (visit_count bigint, checked_in boolean, checked_in_recently boolean)
language plpgsql security definer set search_path = public as $$
declare
  caller uuid := auth.uid();
  latest timestamptz;
begin
  if caller is null then
    return query select 0::bigint, false, false;
    return;
  end if;

  insert into places (place_id) values (target_place_id)
    on conflict (place_id) do nothing;

  select max(created_at) into latest
  from check_ins
  where user_id = caller and place_id = target_place_id;

  if latest is null or latest <= now() - interval '2 hours' then
    insert into check_ins (user_id, place_id) values (caller, target_place_id);
    return query
      select count(*)::bigint, true, true
      from check_ins
      where user_id = caller and place_id = target_place_id;
  end if;

  return query
    select count(*)::bigint, false, true
    from check_ins
    where user_id = caller and place_id = target_place_id;
end;
$$;

revoke insert on check_ins from authenticated;
grant execute on function check_in_place(text) to authenticated;
