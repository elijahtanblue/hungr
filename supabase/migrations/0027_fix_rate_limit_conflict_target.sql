-- Finish the per-bucket limiter repair. In PL/pgSQL, the bare "bucket" in
-- ON CONFLICT (user_id, bucket) can still be confused with the function parameter. Use the primary
-- key constraint name instead so no SQL clause references the ambiguous identifier.

create or replace function bump_rate_limit(uid uuid, bucket text, max_per_min int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  rate_bucket alias for $2;
  cur rate_limits%rowtype;
begin
  insert into rate_limits (user_id, bucket, window_start, count)
  values (uid, rate_bucket, now(), 1)
  on conflict on constraint rate_limits_pkey do update
    set count = case when now() - rate_limits.window_start > interval '1 minute' then 1 else rate_limits.count + 1 end,
        window_start = case when now() - rate_limits.window_start > interval '1 minute' then now() else rate_limits.window_start end
  returning * into cur;
  return cur.count <= max_per_min;
end;
$$;

select pg_notify('pgrst', 'reload schema');
