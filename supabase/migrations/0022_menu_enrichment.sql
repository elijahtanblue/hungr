-- Menu JSON-LD enrichment: an activity-driven queue drained by an off-peak cron worker that
-- populates first_party_facts from restaurants' own schema.org menu markup. See
-- docs/superpowers/specs/2026-07-01-menu-enrichment-design.md.

-- Field-level provenance so a curated price is never clobbered by a scrape, yet menu enrichment can
-- still fill in dietary flags on the same row (and vice versa). Replaces the coarse single-source
-- columns from 0021.
alter table first_party_facts drop column if exists source;
alter table first_party_facts drop column if exists confirmed_at;
alter table first_party_facts add column if not exists price_source text;
alter table first_party_facts add column if not exists price_confirmed_at timestamptz;
alter table first_party_facts add column if not exists dietary_source text;
alter table first_party_facts add column if not exists dietary_confirmed_at timestamptz;

-- The work queue. lng lets the worker pick only places in their local off-peak window without an
-- extra Place Details call. Retry uses next_attempt_at (backoff); dead-lettered rows keep their
-- last_error and a far-future next_attempt_at so they drop out of selection without being lost.
create table if not exists menu_enrich_queue (
  place_id text primary key,
  lng double precision not null,
  enqueued_at timestamptz not null default now(),
  attempts int not null default 0,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  last_error text
);

alter table menu_enrich_queue enable row level security;
-- No client policies: only SECURITY DEFINER RPCs and the service-role worker touch the queue.

-- Enqueue a place for enrichment IF a non-curated fact is missing or stale. The freshness decision
-- lives here (server-side) because the read RPC does not expose provenance to clients. Validates the
-- place_id shape to blunt spam with fabricated ids.
create or replace function enqueue_menu_enrich(p_place_id text, p_lng double precision)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fresh interval := interval '30 days';
  f first_party_facts%rowtype;
  price_ok boolean;
  dietary_ok boolean;
begin
  if p_place_id is null or p_place_id !~ '^[A-Za-z0-9_-]{10,255}$' then
    return;
  end if;
  if p_lng is null or p_lng < -180 or p_lng > 180 then
    return;
  end if;

  select * into f from first_party_facts where place_id = p_place_id;
  price_ok := f.price_source = 'curated' or (f.price_confirmed_at is not null and f.price_confirmed_at > now() - fresh);
  dietary_ok := f.dietary_source = 'curated' or (f.dietary_confirmed_at is not null and f.dietary_confirmed_at > now() - fresh);
  if price_ok and dietary_ok then
    return; -- everything current or operator-owned; nothing to do
  end if;

  insert into menu_enrich_queue (place_id, lng)
  values (p_place_id, p_lng)
  on conflict (place_id) do update set lng = excluded.lng;
end;
$$;

grant execute on function enqueue_menu_enrich(text, double precision) to authenticated;

-- The worker's batch selector: queued places whose LOCAL time (from lng) is in the 2 to 5am
-- off-peak window and whose backoff has elapsed. lng / 15 = hours offset from UTC.
create or replace function select_due_menu_enrich(p_batch int)
returns setof menu_enrich_queue
language sql
security definer
set search_path = public
as $$
  select *
    from menu_enrich_queue q
   where q.next_attempt_at <= now()
     and extract(hour from (now() at time zone 'UTC') + make_interval(mins => round(q.lng / 15.0 * 60)::int)) >= 2
     and extract(hour from (now() at time zone 'UTC') + make_interval(mins => round(q.lng / 15.0 * 60)::int)) < 5
   order by q.enqueued_at asc
   limit greatest(p_batch, 0);
$$;

grant execute on function select_due_menu_enrich(int) to service_role;

-- Field-level upsert of derived menu facts. Each field is written only when the scrape produced a
-- value AND that field is not operator-curated, so a curated price survives a scrape that only found
-- dietary info (and vice versa). A null band / empty dietary leaves the existing value untouched.
create or replace function upsert_menu_facts(p_place_id text, p_price_band int, p_dietary text[])
returns void
language sql
security definer
set search_path = public
as $$
  insert into first_party_facts as f (
    place_id,
    price_band, price_source, price_confirmed_at,
    dietary_flags, dietary_source, dietary_confirmed_at
  )
  values (
    p_place_id,
    p_price_band,
    case when p_price_band is null then null else 'menu-jsonld' end,
    case when p_price_band is null then null else now() end,
    coalesce(p_dietary, '{}'),
    case when p_dietary is null or array_length(p_dietary, 1) is null then null else 'menu-jsonld' end,
    case when p_dietary is null or array_length(p_dietary, 1) is null then null else now() end
  )
  on conflict (place_id) do update set
    price_band = case when f.price_source = 'curated' or excluded.price_band is null then f.price_band else excluded.price_band end,
    price_source = case when f.price_source = 'curated' or excluded.price_band is null then f.price_source else 'menu-jsonld' end,
    price_confirmed_at = case when f.price_source = 'curated' or excluded.price_band is null then f.price_confirmed_at else now() end,
    dietary_flags = case when f.dietary_source = 'curated' or array_length(excluded.dietary_flags, 1) is null then f.dietary_flags else excluded.dietary_flags end,
    dietary_source = case when f.dietary_source = 'curated' or array_length(excluded.dietary_flags, 1) is null then f.dietary_source else 'menu-jsonld' end,
    dietary_confirmed_at = case when f.dietary_source = 'curated' or array_length(excluded.dietary_flags, 1) is null then f.dietary_confirmed_at else now() end;
$$;

grant execute on function upsert_menu_facts(text, int, text[]) to service_role;

-- Remove a place from the queue once enriched (or once we know there is nothing to enrich).
create or replace function complete_menu_enrich(p_place_id text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from menu_enrich_queue where place_id = p_place_id;
$$;

grant execute on function complete_menu_enrich(text) to service_role;

-- Record a failed attempt: exponential-ish backoff, then dead-letter after 5 tries (kept for
-- inspection but pushed far into the future so it drops out of select_due_menu_enrich).
create or replace function fail_menu_enrich(p_place_id text, p_error text)
returns void
language sql
security definer
set search_path = public
as $$
  update menu_enrich_queue
     set attempts = attempts + 1,
         last_attempt_at = now(),
         last_error = left(coalesce(p_error, ''), 500),
         next_attempt_at = case
           when attempts + 1 >= 5 then now() + interval '100 years'
           else now() + make_interval(hours => power(2, attempts + 1)::int)
         end
   where place_id = p_place_id;
$$;

grant execute on function fail_menu_enrich(text, text) to service_role;

-- Stamp a place as "checked, no menu found" so the freshness gate stops re-enqueueing it every time
-- it is browsed. Only stamps fields that are currently empty and not curated; after the TTL it
-- becomes eligible again (the site may have added a menu since).
create or replace function mark_menu_checked(p_place_id text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into first_party_facts as f (place_id, price_source, price_confirmed_at, dietary_source, dietary_confirmed_at)
  values (p_place_id, 'menu-empty', now(), 'menu-empty', now())
  on conflict (place_id) do update set
    price_source = case when f.price_confirmed_at is null and f.price_source is distinct from 'curated' then 'menu-empty' else f.price_source end,
    price_confirmed_at = case when f.price_confirmed_at is null and f.price_source is distinct from 'curated' then now() else f.price_confirmed_at end,
    dietary_source = case when f.dietary_confirmed_at is null and f.dietary_source is distinct from 'curated' then 'menu-empty' else f.dietary_source end,
    dietary_confirmed_at = case when f.dietary_confirmed_at is null and f.dietary_source is distinct from 'curated' then now() else f.dietary_confirmed_at end;
$$;

grant execute on function mark_menu_checked(text) to service_role;
