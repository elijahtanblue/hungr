-- Intent search first-party facts: price band and dietary flags the operator curates or derives
-- (name matching now, curated Michelin/hat prices and menu enrichment later). This is first-party
-- derived data: it stores only a place_id plus facts we own, never Google content. World-readable
-- reference data; only the service role may write it (no insert/update/delete policy, so RLS
-- denies all client writes).
--
-- Curated prices (e.g. from the Michelin guide) go here in price_band rather than on place_guides,
-- because the get_place_guides RPC does not return a price and first_party_facts is what the intent
-- rule engine already reads. Keeping one facts source avoids a dead, unread column.

create table if not exists first_party_facts (
  place_id text primary key,
  price_band int check (price_band between 1 and 4),  -- 1..4, curated; bad seed data fails here
  dietary_flags text[] not null default '{}',         -- e.g. {'vegetarian'}
  source text,                                        -- 'curated' | 'name' | 'menu'
  confirmed_at timestamptz not null default now()
);

alter table first_party_facts enable row level security;

drop policy if exists "first_party_facts readable by everyone" on first_party_facts;
create policy "first_party_facts readable by everyone"
  on first_party_facts for select
  using (true);

-- Batch lookup for the visible place_ids.
create or replace function get_first_party_facts(place_ids text[])
returns table (place_id text, price_band int, dietary_flags text[])
language sql
stable
security definer
set search_path = public
as $$
  select f.place_id, f.price_band, f.dietary_flags
    from first_party_facts f
   where f.place_id = any(place_ids);
$$;

grant execute on function get_first_party_facts(text[]) to authenticated, anon;
