-- Curated food guides (Michelin, the SMH/Good Food hats, etc.) surfaced as map badges.
--
-- This is first-party reference data the operator ingests by hand: it stores only a place_id and
-- the curated fact (which guide, which award, which year), never any Google content. It is
-- published reference data, so it is world-readable; only the service role may write it (there is
-- deliberately no insert/update/delete policy, so RLS denies all client writes).

create table if not exists place_guides (
  id uuid primary key default gen_random_uuid(),
  place_id text not null,
  guide text not null,                 -- e.g. 'Michelin', 'Good Food Hats'
  award text not null,                 -- e.g. '1 Star', '2 Hats', 'Bib Gourmand'
  year int,
  created_at timestamptz not null default now(),
  unique (place_id, guide, year)
);

create index if not exists place_guides_place_id_idx on place_guides (place_id);

alter table place_guides enable row level security;

drop policy if exists "place_guides readable by everyone" on place_guides;
create policy "place_guides readable by everyone"
  on place_guides for select
  using (true);

-- Batch lookup for the map: given the visible place_ids, return their current guide awards.
-- For a place listed in several guides, the most recent year wins.
create or replace function get_place_guides(place_ids text[])
returns table (place_id text, guide text, award text, year int)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (g.place_id) g.place_id, g.guide, g.award, g.year
    from place_guides g
   where g.place_id = any(place_ids)
   order by g.place_id, g.year desc nulls last;
$$;

grant execute on function get_place_guides(text[]) to authenticated, anon;
