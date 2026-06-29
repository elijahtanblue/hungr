alter table profiles enable row level security;
alter table places enable row level security;
alter table cuisines enable row level security;
alter table place_cuisines enable row level security;
alter table user_places enable row level security;
alter table reviews enable row level security;
alter table place_tags enable row level security;
alter table rate_limits enable row level security;
-- rate_limits gets no policies, so it is default deny to all clients. Only the
-- security-definer bump_rate_limit function (called server side) touches it.

-- public read: places, cuisines, place_cuisines, reviews, place_tags
create policy "public read places" on places for select using (true);
create policy "public read cuisines" on cuisines for select using (true);
create policy "public read place_cuisines" on place_cuisines for select using (true);
create policy "public read reviews" on reviews for select using (true);
create policy "public read place_tags" on place_tags for select using (true);

-- any authenticated user may anchor a place_id (place_id only, no Google content)
create policy "auth upsert places" on places for insert with check (auth.role() = 'authenticated');

-- profiles: a user reads and writes only their own
create policy "own profile read" on profiles for select using (auth.uid() = id);
create policy "own profile write" on profiles for insert with check (auth.uid() = id);
create policy "own profile update" on profiles for update using (auth.uid() = id);

-- user_places: a user reads and writes only their own rows
create policy "own user_places" on user_places
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- reviews and tags: write only as yourself
create policy "own reviews write" on reviews for insert with check (auth.uid() = user_id);
create policy "own reviews update" on reviews for update using (auth.uid() = user_id);
create policy "own tags write" on place_tags for insert with check (auth.uid() = created_by);

-- Table privileges. RLS decides WHICH rows; these GRANTs decide table-level access.
-- Supabase local does not auto-grant DML to anon/authenticated, so we grant explicitly.
-- rate_limits intentionally gets no grant: only the security-definer function touches it.
grant usage on schema public to anon, authenticated;

-- public read tables: readable by everyone (anon and signed in)
grant select on places, cuisines, place_cuisines, reviews, place_tags to anon, authenticated;

-- writes are for signed in users only; the policies above restrict to their own rows
grant insert on places to authenticated;
grant select, insert, update on profiles to authenticated;
grant select, insert, update, delete on user_places to authenticated;
grant insert, update on reviews to authenticated;
grant insert on place_tags to authenticated;
