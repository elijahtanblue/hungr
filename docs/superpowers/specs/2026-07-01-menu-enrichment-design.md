# Menu JSON-LD Enrichment Design

Populate `first_party_facts` (price_band, dietary_flags) from the structured menu data restaurants
publish on their own websites (schema.org JSON-LD), so occasion and price and dietary SEARCH
filters work. Non-Google, restaurant-published public data, derived to a band and stored.

Supersedes the 2026-07-01 draft that also proposed a live "Menu tab" from Google `businessMenus`.
That feature is **cut**: verification against Google's official Place Data Fields docs confirmed
`businessMenus` does not exist (only `menuForChildren`, a boolean). Adding an unknown field to the
`place-details` mask would make Google return 400, and our function returns 502 on any non-ok
upstream, which breaks the whole detail page. The Menu tab is now a blocked spike (TODOS item 10).

## Approved Direction

- **JSON-LD only.** Fetch each restaurant's own website (Google gives `websiteUri`, Enterprise SKU
  already paid), parse schema.org `Menu`/`MenuItem`/`Offer`, derive a price band and dietary flags,
  store in `first_party_facts`. No OCR, no LLM, no HTML fallback (deferred, TODOS item 9).
- **Enrichment is a background facts pipeline.** It never sits in a user-facing request path. Search
  reads facts best-effort and non-blocking (already true in Phase 1).
- **Activity-driven, off-peak.** A place is enqueued when surfaced to a user and lacking a fresh
  fact. An hourly cron drains only queued places whose LOCAL time is in the 2 to 5am window. Local
  time is derived from the place's LONGITUDE (we already have lat/lng), so no extra Place Details
  call on the browse path. For the AU-only launch a single fixed off-peak UTC window is acceptable;
  per-timezone windowing is a scale-up refinement.
- **Server-side freshness.** The client cannot tell missing from stale (the read RPC returns only
  the band and flags). So the `enqueue_menu_enrich` RPC itself decides whether a queue row is
  needed, by reading `first_party_facts` provenance server-side.
- **Field-level provenance and precedence.** Provenance is per field: a curated price
  (`price_source='curated'`) is never overwritten by a scrape, but menu enrichment can still add
  dietary flags to that same row, and vice versa.

## SSRF And Crawler Safety (first-class requirement)

The worker fetches `websiteUri`, an attacker-influenceable URL once it enters the system. The fetch
path MUST:

```
1. scheme allow-list        https only
2. resolve DNS, then reject  private / loopback / link-local / multicast / unspecified IPs
                             (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, ::1, fc00::/7, etc.)
3. re-run steps 1-2 on EVERY redirect target (do not blindly follow)
4. redirect cap             <= 3
5. response size cap         <= ~2 MB (stream + abort)
6. timeout                   ~5 s
7. content-type guard        text/html or application/ld+json only
8. identifiable User-Agent   "hungrbot/1.0 (+contact)"
9. robots.txt                fetch and honor Disallow for the menu path; cache per host
```

Without steps 1 to 3 the crawler becomes an internal-network probe. This lives in its own module
so it is unit-tested in isolation.

## Data Model

- **`menu_enrich_queue`**: `place_id text primary key, lng double precision, enqueued_at timestamptz
  default now(), attempts int default 0, last_attempt_at timestamptz, next_attempt_at timestamptz
  default now(), last_error text`. Off-peak selection uses `lng` to compute local hour; retry uses
  `next_attempt_at` (exponential backoff); dead-letter after N attempts (row kept with `last_error`,
  `next_attempt_at` set far future, excluded from selection).
- **`first_party_facts`** gains field-level provenance: `price_source text, price_confirmed_at
  timestamptz, dietary_source text, dietary_confirmed_at timestamptz`. The Phase-1 `source` and
  `confirmed_at` columns are retired in favor of these. The read RPC `get_first_party_facts` is
  unchanged (still returns only `place_id, price_band, dietary_flags` for the engine).
- **`enqueue_menu_enrich(place_id text, lng double precision)`** RPC (SECURITY DEFINER, granted to
  authenticated): validates the place_id format, reads `first_party_facts` provenance, and inserts a
  queue row ONLY if the relevant facts are missing or older than the TTL. Per-user or per-hour caps
  enforced here (or route through the guarded edge function). This is the freshness gate.
- **`select_due_menu_enrich(batch int)`** (service role): returns queued rows where the local hour
  (from `lng`) is in [2,5) and `next_attempt_at <= now()`, ordered oldest first.

## Components

- `supabase/functions/menu-enrich/parseMenu.ts` (pure, the heavy test target):
  - `extractJsonLd(html): unknown[]` parse every `<script type="application/ld+json">` block, each
    guarded so one malformed block does not lose the rest.
  - `menuNodesFrom(objects): { prices: {amount:number,currency:string}[]; diets: string[] }` walk
    the graph (`Restaurant.hasMenu`, `Menu.hasMenuSection`, `MenuItem.offers`, `@graph`) for offers
    and `suitableForDiet`.
  - `derivePriceBand(prices, currency): 1|2|3|4|null` median of item prices to a band via
    currency-aware thresholds. AUD thresholds: `< 20 -> 1`, `< 40 -> 2`, `< 70 -> 3`, `>= 70 -> 4`;
    default to AUD when currency is missing; return null when no priced items.
  - `deriveDietaryFlags(diets, itemNames): string[]` schema.org `RestrictedDiet`
    (`VeganDiet`->vegan, `VegetarianDiet`->vegetarian, `GlutenFreeDiet`->gluten-free) plus a
    name-keyword fallback.
- `supabase/functions/_shared/safeFetch.ts` (SSRF-safe fetch, unit-tested): implements the section
  above; returns body text or null.
- `supabase/functions/menu-enrich/index.ts` (cron-triggered worker): `select_due_menu_enrich`,
  then per place: Google Place Details for `websiteUri`, `safeFetch`, `parseMenu`, upsert facts via
  service role with field-level provenance (never overwrite `*_source='curated'`), update queue
  (dequeue on success, backoff on failure, dead-letter after N). Each place in its own try/catch so
  one bad site never fails the batch.
- Migration: `menu_enrich_queue` + provenance columns + the two RPCs; schedule the worker via
  `pg_cron` + `pg_net`. Cron auth: the invocation secret is stored in Vault / a settings row, NOT
  hard-coded in the migration.
- `src/api/menuEnrich.ts`: `enqueueMenuEnrich(places)` called from the map facts effect for
  surfaced places (passes place_id + lng); cheap, fire-and-forget, not awaited. The server RPC does
  the freshness decision.

## Testing

- `parseMenu.ts` (deno): valid / malformed / missing JSON-LD; `Menu>Section>Item`, flat items,
  nested `@graph`, none; `derivePriceBand` median to 1-4, AUD thresholds at each boundary, missing
  currency -> AUD, empty -> null; `deriveDietaryFlags` from `suitableForDiet` and keywords, none.
- `safeFetch.ts` (deno): https-only; rejects loopback / private / link-local after DNS; redirect to
  a private IP is rejected; size cap aborts; timeout; content-type guard.
- `menu-enrich/index.ts` (deno): no websiteUri -> dequeue no-op; fetch failure -> backoff, attempts++
  ; success -> facts upserted + dequeued; never overwrites `price_source='curated'` but still adds
  dietary; dead-letter after N attempts.
- `enqueue_menu_enrich` / `select_due_menu_enrich` (migration test + logic): freshness gate skips
  fresh facts; off-peak window selects only [2,5) local; backoff excludes not-yet-due rows.

## Failure Modes

```
CODEPATH            FAILURE                     HANDLING                     USER SEES
safeFetch           private-IP / SSRF attempt   rejected before connect      nothing (no fact)
safeFetch           timeout / 500 / oversize    null, worker backs off       nothing (no fact)
parseMenu           malformed JSON-LD           block skipped, others parsed nothing (no fact)
derivePriceBand     no priced items             null, no band stored         nothing (no fact)
worker              one bad site in a batch     per-place try/catch          other places still enrich
queue               repeated failures           backoff then dead-letter     no thrash, no silent loss
enqueue             fake / spammed place_id     format-validated + capped    row rejected
enqueue             fresh fact already exists   no queue row (freshness gate) no wasted work
```

No failure blocks a user, corrupts data, or lets the worker probe the internal network.

## What Already Exists (reuse)

- `first_party_facts` + `get_first_party_facts` + `annotateFacts` (the search consumer, Phase 1).
- `place-details` function + field-mask pattern (the worker's `websiteUri` call mirrors it).
- The proxy's `guard` (auth + per-user rate limit) for the enqueue path.
- `NAME_TO_CUISINES` keyword-matching idiom (dietary keyword fallback mirrors it).
- `place_guides` curation precedence (curated facts outrank scraped ones, now per field).

## Deployment (cron auth, no secrets in migrations)

The worker is authenticated by a shared secret passed in the `x-cron-secret` header. Store it in
Supabase Vault (never in a migration) and set the same value as the function's `MENU_CRON_SECRET`
env var. Schedule hourly via pg_cron + pg_net, reading the secret from Vault at call time:

```sql
select vault.create_secret('<random-64-char>', 'menu_cron_secret');

select cron.schedule('menu-enrich-hourly', '0 * * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.functions.supabase.co/menu-enrich',
    headers := jsonb_build_object(
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'menu_cron_secret')
    ),
    timeout_milliseconds := 120000
  );
$$);
```

Deploy: `npx supabase functions deploy menu-enrich menu-enqueue`, set `MENU_CRON_SECRET` (and the
existing `GOOGLE_PLACES_KEY` / service-role env) as function secrets, then run the SQL above once.

## Not In Scope (deferred)

- **Menu tab from Google `businessMenus`** (TODOS item 10): the field does not exist in the Places
  API (New); needs a real menu source (likely first-party UGC menu photos) before any UI work.
- **OCR + LLM + HTML-fallback extraction** (TODOS item 9): the biggest coverage lever, deferred
  until more users and budget. `first_party_facts` already accepts these rows, so it slots in later.
- **Per-timezone precision beyond longitude** and a generalized job/monitoring stack: one queue
  table + hourly cron is enough at this stage.
