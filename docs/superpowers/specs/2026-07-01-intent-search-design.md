# Intent Search Design

Occasion and natural-language search for hungr ("date night", "birthday", "somewhere exotic
to impress a date near the water where we can talk"). Turns a person's intent into ranked
results without running our own model over Google reviews.

## Approved Direction

AI is a thin parser, not an oracle. It translates natural language into a structured query and
writes a one-line reason per result. It never asserts facts. A deterministic rule engine does
all retrieval, filtering, and ranking against Google plus first-party data. Named occasions
(date night, birthday, anniversary) run the same engine from a static preset table with no AI
in the path at all.

```
  free text  ---> [ intent-parse fn ] --\
                                          >-- StructuredQuery --> [ RULE ENGINE ] --> [ intent-reasons fn ] --> results
  occasion chip -> [ occasionPresets ] --/                         (deterministic)      (1-line, cached)
```

Because the AI only parses and phrases, it needs no Grounding with Maps. That removes the
Australia grounding-availability blocker (TODO 4) for this feature and drops cost to roughly
0.002 USD per query (pure tokens), most of which caches away.

## Locked Decisions

- **AI role:** parse natural language to a StructuredQuery, plus a one-line reason per result.
  Never asserts facts. On any AI failure, degrade to plain rule-based text search.
- **Named occasions:** rule presets (queryHint plus guardrails), roughly zero marginal cost.
- **Open-ended intent:** AI parser feeds the same rule engine.
- **Unknown facts (null not equal to false):** keep the place, label the constraint
  "unconfirmed". Missing data never silently excludes a place.
- **Price:** soft ranking signal, never a hard drop. Google has no per-person price, only the
  coarse band. Unpriced places stay visible.
- **"New":** curated first-party flag now (same manual path as Michelin and hats). First-seen
  timestamp becomes a valid "emerging" signal later, and only for areas where hungr has been
  systematically indexing long enough that first-seen means "recently appeared" rather than
  "a user just touched it".
- **Michelin price:** curated `price_band` on the guide row. Auto-infer high price only for
  places with 2 or more stars, where it is reliably true.
- **Dietary:** name-based flags now (a place named "Gigi's Vegetarian" tags vegetarian).
  Review-mining is deferred and legal-gated (see Not In Scope).
- **Enrichment:** a `first_party_facts` table plus the rule-engine consumer are built now and
  seeded with the free sources. The menu scraper is its own separate project.
- **Quality gate:** density-scaled from the result set distribution, never a fixed review count.
  A small town is not held to a big-city bar.
- **Prestige:** `place_guides` (Michelin and hats) overrides review-count entirely.

## The Dimensions (what a person means, and who serves it)

1. **Vibe / occasion** (romantic, classy, lively, casual): Google textQuery ranking encodes the
   ambiance for free; AI parses fuzzy or compound vibe into a queryHint plus type include and
   exclude. Known-weak: "quiet / good for talking" has no Google attribute (best effort by
   excluding bar, night_club, sports_bar types).
2. **Cuisine / food** (italian, "exotic", "comfort food"): existing type-to-cuisine map plus
   first-party tags plus name matching; AI expands fuzzy words into concrete cuisine sets.
3. **Price / budget:** soft rank, never drop. Infer band from type and prestige when missing.
   Per-person dollar is not available from Google.
4. **Prestige / quality / freshness:** multi-axis merge. `place_guides` overrides count.
   Density-scaled quality from the result distribution. "Hidden gem" inverts the count logic
   (high rating, low count). "New" is curated now, first-seen later.
5. **Location / geography:** existing distance, radius, and region machinery. AI parses fuzzy
   location language ("near the harbour", "not the CBD", "in the city") into a center and radius
   or bounds with exclusions. Same-name streets across cities are already resolved by Google
   location bias to the current region; cross-city intent triggers a geocode and recenter.
6. **Hard constraints (facts):** serves alcohol, reservable, outdoor, open-at-time, dog-friendly,
   groups, accessible, takeout and dine-in and delivery. Always rules, never AI. Precise signals
   are Atmosphere SKU; coarse signals (alcohol from bar or pub type) are free. Null is kept and
   labeled, never treated as false.
7. **Free-form compound:** the orchestrator. AI parses the whole utterance into the structured
   query; rules execute; AI writes the reason line.

## Cross-Cutting Policies

```
1. null not equal to false   unknown attributes never hard-exclude (price and all atmosphere)
2. density-scaled quality     count threshold from result distribution, not a fixed number
3. first-party override        Michelin and hats and curated-new beat rating-count
4. relaxation ladder           empty set drops soft constraints in order (price, count, radius,
                               soft vibe) and tells the user what was relaxed
5. AI never asserts facts     facts only from Google or first-party; AI parses and phrases
6. SKU gating                  atmosphere fields only on the occasion path, only when needed
7. deterministic core          StructuredQuery to results is pure and unit-testable
```

## Data Model

- **`first_party_facts(place_id, price_band, dietary_flags[], confirmed_at, source)`** plus a
  batch-read RPC that mirrors `get_place_guides`. Seeded by name-based flags and curated prices.
  The future menu scraper writes here without touching search.
- **`place_guides`** gains a `price_band` column (curated Michelin and hat price).
- **First-seen:** log a timestamp when a `place_id` first enters the database. "New" reads it
  only where area coverage is mature; otherwise "new" falls back to the curated flag.
- **`places-proxy`** field mask gains `userRatingCount` (free, same Enterprise tier already
  paid) and, only on the occasion path when the intent needs them, atmosphere fields.
- **`StructuredQuery`** type is the contract between parser or presets and the engine:
  `{ queryHint, cuisines[], priceBand, prestige[], location{ center or bounds, exclude },
  hardConstraints{}, sort }`.

## What Already Exists (reuse)

- `applyFilters` for rating, budget, distance, and sort machinery.
- `places-proxy` text search plus the type-to-cuisine map.
- `NAME_TO_CUISINES` matcher, which extends to name-based dietary flags.
- `place_guides` table plus its batch RPC pattern.
- `openStatus` and `openingHours` domain for open-at-time checks.
- `useFilters` store.
- The photo 24-hour cache pattern, reused for parse and reason caching.

## Components To Build

Phase 1 (no AI, no Australia dependency, fully shippable on its own):
- `src/domain/intentQuery.ts`: the pure rule engine (StructuredQuery plus places to ranked
  results). The heavy coverage target.
- `src/domain/occasionPresets.ts`: the named-occasion preset table.
- `first_party_facts` migration plus batch RPC; `place_guides.price_band` migration.
- `places-proxy` field-mask change (userRatingCount; atmosphere on the occasion path).
- Name-based dietary flag seeding; curated price entry path.
- UI: occasion chip row and the "unconfirmed" badges.

Phase 2 (thin AI layer):
- `supabase/functions/intent-parse`: Gemini text to StructuredQuery JSON, schema-validated,
  rate-limited, cached.
- `supabase/functions/intent-reasons`: Gemini one-line reason over place name, type, and facts.
- Free-text search entry; per-user rate limit; reason line on cards.

## Failure Modes

```
CODEPATH               REALISTIC FAILURE          HANDLING            USER SEES
intent-parse (Gemini)  bad JSON, timeout          validate, fallback  plain text search
intent-parse           prompt injection in query  schema clamp        ignored, treated as text
rule engine            empty result set           relaxation ladder   "showing results without X"
first_party_facts read RPC error                  best effort         facts omitted, place shows
atmosphere SKU path    null attribute             keep and label      "unconfirmed" badge
intent-reasons         timeout or over budget      optional            card shows, no reason line
per-user rate limit    scripted abuse             hard cap            "try again shortly"
```

No failure is silent-and-wrong. Every AI failure degrades to plain rule-based search, and
facts never come from AI.

## Testing

- `intentQuery.ts`: hard constraint present, null (keep and label), and false (drop); price
  sparse (not dropped) and band inference (2 stars only); density-scaled quality across a dense
  and a sparse area; prestige override (hatted low-count wins); relaxation ladder ordering;
  location within-region and cross-city recenter.
- `occasionPresets.ts`: each preset produces the expected StructuredQuery.
- `first_party_facts` merge: name flags and curated price applied.
- `intent-parse` (Deno): valid natural language to JSON; bad output to fallback; injection
  clamped.
- `intent-reasons` (Deno): budget and timeout degrade gracefully.
- End-to-end: chip tap and free-text box produce results that render with reasons and badges.

## Not In Scope

- **Menu scraper and OCR:** its own subsystem and spec. The `first_party_facts` interface is
  built now so it slots in later.
- **Review-mining for dietary or any signal:** conflicts with the locked "no model over Google
  reviews" principle; legal-gated (TODO 2).
- **Exact per-person price:** Google has no data; only bands.
- **"Trending":** needs time-series not yet collected.
- **Live reservation availability:** needs OpenTable or Resy; `reservable` is a boolean only.
- **Noise level / "quiet":** no Google attribute; best effort via type exclusion.
- **Transit-proximity and precise neighborhood polygons:** approximated by radius and viewport.
