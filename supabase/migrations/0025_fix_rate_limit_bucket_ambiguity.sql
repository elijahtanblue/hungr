-- Repair 0024's per-bucket limiter. The original function parameter was named "bucket",
-- which conflicts with rate_limits.bucket inside the INSERT ... ON CONFLICT statement and makes
-- every guarded Edge Function fail closed as a 429. Keep the public RPC parameter name for the
-- deployed guards, but alias $2 internally so SQL never references the ambiguous identifier.

create or replace function bump_rate_limit(uid uuid, bucket text, max_per_min int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  rate_bucket alias for $2;
  cur rate_limits%rowtype;
begin
  insert into rate_limits (user_id, bucket, window_start, count)
  values (uid, rate_bucket, now(), 1)
  on conflict (user_id, bucket) do update
    set count = case when now() - rate_limits.window_start > interval '1 minute' then 1 else rate_limits.count + 1 end,
        window_start = case when now() - rate_limits.window_start > interval '1 minute' then now() else rate_limits.window_start end
  returning * into cur;
  return cur.count <= max_per_min;
end;
$$;

create or replace function bump_rate_limit(uid uuid, max_per_min int)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  return bump_rate_limit(uid, 'global', max_per_min);
end;
$$;
