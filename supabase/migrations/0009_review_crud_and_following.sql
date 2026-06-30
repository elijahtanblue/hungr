-- Tester-ready first-party UGC controls.
-- Users can edit/delete only their own reviews. One-way follows can be listed through an RPC
-- instead of loosening profile RLS.

create policy "own reviews delete" on reviews for delete using (auth.uid() = user_id);
grant delete on reviews to authenticated;

create or replace function list_following()
returns table (id uuid, username text, display_name text)
language sql security definer set search_path = public as $$
  select p.id, p.username, p.display_name
  from follows f
  join profiles p on p.id = f.followee_id
  where f.follower_id = auth.uid()
  order by p.username nulls last, p.display_name nulls last;
$$;

grant execute on function list_following() to authenticated;
