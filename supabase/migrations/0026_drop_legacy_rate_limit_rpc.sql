-- PostgREST can fail to resolve overloaded RPC functions by named JSON args. All deployed guards
-- now call bump_rate_limit(uid, bucket, max_per_min), so remove the old two-argument overload and
-- reload the REST schema cache. This keeps the live Edge Functions on the repaired per-bucket path.

drop function if exists bump_rate_limit(uuid, int);

select pg_notify('pgrst', 'reload schema');
