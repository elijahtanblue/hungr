-- Rate limiting was a SINGLE per-user counter shared by every Edge Function. Because each function
-- passes its own per-minute cap to that one shared counter, the lowest-cap function would 429 as
-- soon as normal traffic from higher-cap functions pushed the shared count past its cap. Concretely:
-- browsing the map (place-photo cap 120, place-details 60, place-pins 30, ...) drives the shared
-- counter well past 30 within a minute, so the next photo attach (review-photo-moderate, cap 30)
-- was rejected with 429 before any upload or moderation logic ran. Photos never worked in a real
-- session for this reason.
--
-- Fix: key the counter per (user, bucket) so every function gets an independent window. The guard
-- derives the bucket from the function name, so no per-function code changes are needed.

alter table rate_limits add column if not exists bucket text not null default 'global';

alter table rate_limits drop constraint if exists rate_limits_pkey;
alter table rate_limits add primary key (user_id, bucket);

-- Per-bucket limiter: one fixed one-minute window per (user, bucket).
create or replace function bump_rate_limit(uid uuid, bucket text, max_per_min int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  cur rate_limits%rowtype;
begin
  insert into rate_limits (user_id, bucket, window_start, count)
  values (uid, bucket, now(), 1)
  on conflict (user_id, bucket) do update
    set count = case when now() - rate_limits.window_start > interval '1 minute' then 1 else rate_limits.count + 1 end,
        window_start = case when now() - rate_limits.window_start > interval '1 minute' then now() else rate_limits.window_start end
  returning * into cur;
  return cur.count <= max_per_min;
end;
$$;

-- Backward-compatible 2-arg form so any function still running the pre-bucket guard keeps working
-- (all such calls share the 'global' bucket) until it is redeployed with the bucket-aware guard.
create or replace function bump_rate_limit(uid uuid, max_per_min int)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  return bump_rate_limit(uid, 'global', max_per_min);
end;
$$;
