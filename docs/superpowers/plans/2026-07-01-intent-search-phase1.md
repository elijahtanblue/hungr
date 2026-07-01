# Intent Search Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship occasion search (date night, birthday, anniversary, etc.) with a deterministic rule engine, no AI, so a named occasion turns intent into ranked results reusing the existing Google + first-party pipeline.

**Architecture:** A pure `runIntentQuery(places, StructuredQuery)` rule engine does filtering, soft price ranking, density-scaled quality, prestige override, and a relaxation ladder. A static `occasionPresets` table maps each occasion to a StructuredQuery. Occasion chips on the map set the search query hint and an active intent; the map applies the engine after the existing filters. A `first_party_facts` table plus name-based dietary tags feed the engine. No AI in Phase 1 (that is Phase 2).

**Tech Stack:** TypeScript, React Native (Expo), Zustand, Supabase (Postgres migrations + SECURITY DEFINER RPC), Jest + @testing-library/react-native.

Full design: `docs/superpowers/specs/2026-07-01-intent-search-design.md`.

---

## Status: IMPLEMENTED (2026-07-01) with corrections from Codex plan review

All 8 tasks are built and green (tsc clean, 238 jest, 34 deno). The code diverged from the
draft below on purpose, per an independent Codex review that caught real issues. Deltas applied:

- **Enrich before ranking (was a real bug):** `annotateGuides` + `annotateFacts` now run inside
  `filterVisible` BEFORE `applyFilters`/`runIntentQuery`, so the engine actually sees `guideAward`
  and first-party facts. The draft ran the engine before guides were annotated.
- **Facts wired into the map:** added a `facts` state + effect (mirrors the guides effect) and
  `annotateFacts` in `filterVisible`. The draft built the reader but never called it.
- **Name-based dietary applied in `shapeProxyPlace`** (client-side, live), so tags actually feed
  the engine without needing seeded rows.
- **Field mask keeps `places.photos.name`** (Codex's latency work); `userRatingCount` was added
  alongside it, not as a replacement.
- **`place_guides.price_band` dropped:** the `get_place_guides` RPC does not return it, so it
  would be dead. Curated prices live in `first_party_facts.price_band`, which is actually read.
- **CHECK (price_band between 1 and 4)** added to `first_party_facts`.
- **`OccasionChips` uses real theme tokens** (`colors.hair`, `colors.ink`, `fonts.bodyMedium`);
  the draft's `colors.border`/`colors.text`/`font` do not exist.
- **`score()` "top"** documented as the base rating behavior (with a test); **relaxation ladder**
  simplified and made accurate: the density floor can never empty a non-empty set, so only
  `cuisine` is relaxable and only reported when dropping it actually recovers results.
- **`hidden-gem` exempts the noise floor** (a design conflict surfaced by tests: the floor was
  dropping the very low-count gems that intent asks for).
- **`pickOccasion` mirrors `submitTypedSearch`** (clears pins, resets `lastSearchText`, opens the
  list), so old pins do not linger under a new occasion search.

---

## File Structure

- Create `src/domain/dietaryTags.ts` — name-based dietary flag matcher (mirrors the proxy's NAME_TO_CUISINES idea).
- Create `src/domain/intentQuery.ts` — `StructuredQuery` type + `runIntentQuery` rule engine (the heavy coverage target).
- Create `src/domain/occasionPresets.ts` — the static occasion preset table.
- Create `src/api/firstPartyFacts.ts` — client reader + `annotateFacts` (mirrors `src/api/guides.ts`).
- Create `supabase/migrations/0021_intent_search.sql` — `first_party_facts` table + `get_first_party_facts` RPC + `place_guides.price_band` column.
- Create `src/components/OccasionChips.tsx` — the horizontal occasion chip row.
- Modify `src/domain/types.ts` — add `userRatingCount`, `dietaryTags`, `priceBand` to `Place`.
- Modify `supabase/functions/places-proxy/index.ts` — add `userRatingCount` to the field mask and shape.
- Modify `src/api/places.ts` — carry `userRatingCount` through `shapeProxyPlace`.
- Modify `app/(tabs)/map.tsx` — add `activeIntent` state, render `OccasionChips`, apply the engine in `filterVisible`.

## NOT in this plan (Phase 1 scope guards)

- Atmosphere hard constraints (dineIn, serves alcohol, reservable, outdoor) are NOT enforced in the engine yet: that data is not fetched at list time in Phase 1. The engine's keep-and-label path is exercised by dietary tags only.
- "Unconfirmed" badge rendering on the card is deferred: the engine returns the `unconfirmed` list, but wiring it into `PlaceSheet` is a later task.
- The AI free-text parser and reason lines are Phase 2.

---

### Task 1: Extend the Place type with fact fields

**Files:**
- Modify: `src/domain/types.ts:4-16`

- [ ] **Step 1: Add the fields**

In `src/domain/types.ts`, replace the `Place` type with:

```typescript
export type Place = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  rating?: number;       // live from Google, never persisted
  userRatingCount?: number; // live from Google, used for density-scaled quality
  priceLevel?: PriceLevel;
  priceBand?: 1 | 2 | 3 | 4; // curated/first-party price band (overrides priceLevel when set)
  photoName?: string;    // live Google photo resource name, resolved to a display URL on demand
  distanceMeters?: number;
  cuisines: string[];    // coarse from Google place type, refined by first party tags
  dietaryTags?: string[]; // first-party dietary flags, e.g. ["vegetarian"], never from Google reviews
  state?: PlaceState;     // first party, from user_places
  guideAward?: string;    // curated guide badge, e.g. "Michelin · 1 Star" (display only)
};
```

- [ ] **Step 2: Verify the type compiles**

Run: `npx tsc --noEmit`
Expected: no new errors (all new fields are optional, so existing code is unaffected).

- [ ] **Step 3: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat: add userRatingCount, priceBand, dietaryTags to Place"
```

---

### Task 2: Name-based dietary tags

**Files:**
- Create: `src/domain/dietaryTags.ts`
- Test: `tests/domain/dietaryTags.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/domain/dietaryTags.test.ts`:

```typescript
import { dietaryTagsFromName } from "../../src/domain/dietaryTags";

test("tags a place literally named vegetarian", () => {
  expect(dietaryTagsFromName("Gigi's Vegetarian Kitchen")).toEqual(["vegetarian"]);
});

test("tags vegan places", () => {
  expect(dietaryTagsFromName("Smith & Daughters Vegan")).toEqual(["vegan"]);
});

test("is case and accent insensitive", () => {
  expect(dietaryTagsFromName("VEGAN Bar")).toEqual(["vegan"]);
});

test("does not tag places that merely mention veg in a word", () => {
  expect(dietaryTagsFromName("Las Vegas Diner")).toEqual([]);
});

test("returns an empty array when nothing matches", () => {
  expect(dietaryTagsFromName("Joe's Steakhouse")).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/domain/dietaryTags.test.ts`
Expected: FAIL with "Cannot find module '../../src/domain/dietaryTags'".

- [ ] **Step 3: Write the implementation**

Create `src/domain/dietaryTags.ts`:

```typescript
// Derive first-party dietary flags from a place NAME only (never from Google review content).
// This mirrors the proxy's NAME_TO_CUISINES approach: a place literally named "X Vegetarian"
// is a vegetarian place. Word boundaries stop "Vegas" matching "vegan".
const DIETARY_PATTERNS: { tag: string; pattern: RegExp }[] = [
  { tag: "vegan", pattern: /\bvegan\b/ },
  { tag: "vegetarian", pattern: /\bvegetarian\b/ },
];

export function dietaryTagsFromName(name: string): string[] {
  const normalized = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const tags: string[] = [];
  for (const { tag, pattern } of DIETARY_PATTERNS) {
    if (pattern.test(normalized)) tags.push(tag);
  }
  return tags;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/domain/dietaryTags.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/dietaryTags.ts tests/domain/dietaryTags.test.ts
git commit -m "feat: name-based dietary tag matcher"
```

---

### Task 3: The rule engine (intentQuery)

**Files:**
- Create: `src/domain/intentQuery.ts`
- Test: `tests/domain/intentQuery.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/domain/intentQuery.test.ts`:

```typescript
import { runIntentQuery, type StructuredQuery } from "../../src/domain/intentQuery";
import type { Place } from "../../src/domain/types";

function place(p: Partial<Place> & { placeId: string }): Place {
  return { name: p.placeId, lat: 0, lng: 0, cuisines: [], ...p };
}

test("cuisine filter keeps only intersecting places", () => {
  const places = [
    place({ placeId: "a", cuisines: ["Italian"], rating: 4.5, userRatingCount: 300 }),
    place({ placeId: "b", cuisines: ["Thai"], rating: 4.5, userRatingCount: 300 }),
  ];
  const q: StructuredQuery = { queryHint: "x", cuisines: ["Italian"] };
  expect(runIntentQuery(places, q).results.map((r) => r.place.placeId)).toEqual(["a"]);
});

test("price band is soft: an out-of-band place is kept, just ranked lower", () => {
  const places = [
    place({ placeId: "cheap", priceLevel: "PRICE_LEVEL_INEXPENSIVE", rating: 4.5, userRatingCount: 300 }),
    place({ placeId: "pricey", priceLevel: "PRICE_LEVEL_VERY_EXPENSIVE", rating: 4.5, userRatingCount: 300 }),
  ];
  const q: StructuredQuery = { queryHint: "x", priceBand: { min: 3 } };
  const ids = runIntentQuery(places, q).results.map((r) => r.place.placeId);
  expect(ids).toContain("cheap");          // never dropped
  expect(ids[0]).toBe("pricey");           // in-band ranks first
});

test("unpriced places are kept when a price band is set", () => {
  const places = [place({ placeId: "unpriced", rating: 4.5, userRatingCount: 300 })];
  const q: StructuredQuery = { queryHint: "x", priceBand: { min: 3 } };
  expect(runIntentQuery(places, q).results.map((r) => r.place.placeId)).toEqual(["unpriced"]);
});

test("density-scaled quality drops noise (tiny review count) but keeps modest-but-real", () => {
  const places = [
    place({ placeId: "noise", rating: 4.9, userRatingCount: 8 }),
    place({ placeId: "modest", rating: 4.3, userRatingCount: 300 }),
    place({ placeId: "popular", rating: 4.5, userRatingCount: 900 }),
  ];
  const q: StructuredQuery = { queryHint: "x" };
  const ids = runIntentQuery(places, q).results.map((r) => r.place.placeId);
  expect(ids).not.toContain("noise");      // 8 reviews is below 10% of the median
  expect(ids).toEqual(expect.arrayContaining(["modest", "popular"]));
});

test("a guide award overrides the quality floor and ranks first", () => {
  const places = [
    place({ placeId: "hatted", rating: 4.2, userRatingCount: 8, guideAward: "Good Food · 1 Hat" }),
    place({ placeId: "modest", rating: 4.3, userRatingCount: 300 }),
    place({ placeId: "popular", rating: 4.6, userRatingCount: 900 }),
  ];
  const q: StructuredQuery = { queryHint: "x", prestige: ["guide"] };
  const ids = runIntentQuery(places, q).results.map((r) => r.place.placeId);
  expect(ids).toContain("hatted");         // not dropped despite 8 reviews
  expect(ids[0]).toBe("hatted");           // guide boost puts it first
});

test("dietary is keep-and-label: non-matching places stay but are flagged unconfirmed", () => {
  const places = [
    place({ placeId: "veg", dietaryTags: ["vegetarian"], rating: 4.4, userRatingCount: 300 }),
    place({ placeId: "unknown", rating: 4.4, userRatingCount: 300 }),
  ];
  const q: StructuredQuery = { queryHint: "x", dietary: ["vegetarian"] };
  const out = runIntentQuery(places, q).results;
  expect(out.map((r) => r.place.placeId)).toEqual(expect.arrayContaining(["veg", "unknown"]));
  expect(out.find((r) => r.place.placeId === "veg")!.unconfirmed).toEqual([]);
  expect(out.find((r) => r.place.placeId === "unknown")!.unconfirmed).toEqual(["vegetarian"]);
});

test("relaxation ladder: over-constrained cuisine drops and is reported", () => {
  const places = [place({ placeId: "a", cuisines: ["Thai"], rating: 4.5, userRatingCount: 300 })];
  const q: StructuredQuery = { queryHint: "x", cuisines: ["Italian"] };
  const out = runIntentQuery(places, q);
  expect(out.results.map((r) => r.place.placeId)).toEqual(["a"]); // relaxed to non-empty
  expect(out.relaxed).toContain("cuisine");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/domain/intentQuery.test.ts`
Expected: FAIL with "Cannot find module '../../src/domain/intentQuery'".

- [ ] **Step 3: Write the implementation**

Create `src/domain/intentQuery.ts`:

```typescript
import type { Place, PriceLevel } from "./types";

export type Band = 1 | 2 | 3 | 4;
export type Prestige = "top" | "guide" | "hidden-gem";

export type StructuredQuery = {
  queryHint: string;                        // text sent to Google Text Search
  cuisines?: string[];                      // include filter (any-match), relaxable
  dietary?: string[];                       // keep-and-label: never drops, flags unconfirmed
  priceBand?: { min?: Band; max?: Band };   // soft: nudges rank, never drops
  prestige?: Prestige[];                    // quality axis
};

export type IntentResult = { place: Place; unconfirmed: string[] };
export type IntentOutcome = { results: IntentResult[]; relaxed: string[] };

// Below this fraction of the set's median review count, a place is treated as statistical
// noise (e.g. 4.9 from 8 reviews) and dropped unless it carries a curated guide award.
const NOISE_FRACTION = 0.1;

const PRICE_RANK: Record<PriceLevel, Band> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

function bandOf(p: Place): Band | null {
  if (p.priceBand) return p.priceBand;
  return p.priceLevel && p.priceLevel in PRICE_RANK ? PRICE_RANK[p.priceLevel] : null;
}

function medianCount(counts: number[]): number {
  if (counts.length === 0) return 0;
  const s = [...counts].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function score(p: Place, q: StructuredQuery): number {
  let s = p.rating ?? 0;
  if (q.prestige?.includes("guide") && p.guideAward) s += 5;
  if (q.prestige?.includes("hidden-gem")) {
    const c = p.userRatingCount ?? 0;
    s += c > 0 ? Math.max(0, 1 - c / 1000) : 0;
  }
  const band = bandOf(p);
  if (q.priceBand && band !== null) {
    const within =
      (q.priceBand.min === undefined || band >= q.priceBand.min) &&
      (q.priceBand.max === undefined || band <= q.priceBand.max);
    s += within ? 0.5 : -0.5; // soft nudge, never a drop
  }
  return s;
}

export function runIntentQuery(places: Place[], q: StructuredQuery): IntentOutcome {
  const relaxed: string[] = [];
  const stages = { cuisine: true, quality: true };

  const build = (): IntentResult[] => {
    let list = places;

    if (stages.cuisine && q.cuisines && q.cuisines.length > 0) {
      list = list.filter((p) => p.cuisines.some((c) => q.cuisines!.includes(c)));
    }

    if (stages.quality) {
      const counts = list
        .map((p) => p.userRatingCount)
        .filter((n): n is number => typeof n === "number");
      const noiseFloor = medianCount(counts) * NOISE_FRACTION;
      list = list.filter((p) => {
        if (p.guideAward) return true;                       // prestige override
        if (typeof p.userRatingCount !== "number") return true; // unknown => keep
        return p.userRatingCount >= noiseFloor;
      });
    }

    return list
      .map((p) => {
        const unconfirmed: string[] = [];
        for (const tag of q.dietary ?? []) {
          if (!(p.dietaryTags ?? []).includes(tag)) unconfirmed.push(tag);
        }
        return { place: p, unconfirmed };
      })
      .sort((a, b) => score(b.place, q) - score(a.place, q));
  };

  let results = build();
  // Relaxation ladder: only when empty, drop soft-to-hard in order (quality, then cuisine).
  if (results.length === 0 && stages.quality) {
    stages.quality = false;
    relaxed.push("quality");
    results = build();
  }
  if (results.length === 0 && stages.cuisine && q.cuisines && q.cuisines.length > 0) {
    stages.cuisine = false;
    relaxed.push("cuisine");
    results = build();
  }
  return { results, relaxed };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/domain/intentQuery.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/intentQuery.ts tests/domain/intentQuery.test.ts
git commit -m "feat: deterministic intent-search rule engine"
```

---

### Task 4: Occasion presets

**Files:**
- Create: `src/domain/occasionPresets.ts`
- Test: `tests/domain/occasionPresets.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/domain/occasionPresets.test.ts`:

```typescript
import { OCCASIONS, occasionById } from "../../src/domain/occasionPresets";

test("every occasion has a label and a non-empty query hint", () => {
  for (const o of OCCASIONS) {
    expect(o.label.length).toBeGreaterThan(0);
    expect(o.query.queryHint.length).toBeGreaterThan(0);
  }
});

test("occasion ids are unique", () => {
  const ids = OCCASIONS.map((o) => o.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test("date night is a mid-to-high price, guide-aware occasion", () => {
  const dn = occasionById("date-night");
  expect(dn).toBeDefined();
  expect(dn!.query.priceBand?.min).toBe(2);
  expect(dn!.query.prestige).toContain("guide");
});

test("occasionById returns undefined for an unknown id", () => {
  expect(occasionById("nope")).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/domain/occasionPresets.test.ts`
Expected: FAIL with "Cannot find module '../../src/domain/occasionPresets'".

- [ ] **Step 3: Write the implementation**

Create `src/domain/occasionPresets.ts`:

```typescript
import type { StructuredQuery } from "./intentQuery";

export type Occasion = {
  id: string;
  label: string;      // chip text
  query: StructuredQuery;
};

// Named occasions map to a fixed structured query. queryHint steers Google's ranking (a free
// ambiance proxy); the rest are the deterministic guardrails the rule engine applies.
export const OCCASIONS: Occasion[] = [
  {
    id: "date-night",
    label: "Date night",
    query: { queryHint: "romantic date night dinner", priceBand: { min: 2 }, prestige: ["guide", "top"] },
  },
  {
    id: "anniversary",
    label: "Anniversary",
    query: { queryHint: "romantic fine dining anniversary", priceBand: { min: 3 }, prestige: ["guide", "top"] },
  },
  {
    id: "birthday",
    label: "Birthday",
    query: { queryHint: "birthday group dinner celebration", prestige: ["top"] },
  },
  {
    id: "impress",
    label: "Impress",
    query: { queryHint: "impressive upscale dining", priceBand: { min: 3 }, prestige: ["guide", "top"] },
  },
  {
    id: "classy-simple",
    label: "Classy & simple",
    query: { queryHint: "elegant intimate restaurant", priceBand: { min: 2, max: 3 }, prestige: ["top"] },
  },
  {
    id: "cheap-eats",
    label: "Cheap eats",
    query: { queryHint: "best value cheap eats", priceBand: { max: 2 }, prestige: ["top"] },
  },
  {
    id: "hidden-gem",
    label: "Hidden gem",
    query: { queryHint: "hidden gem underrated restaurant", prestige: ["hidden-gem"] },
  },
];

export function occasionById(id: string): Occasion | undefined {
  return OCCASIONS.find((o) => o.id === id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/domain/occasionPresets.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/occasionPresets.ts tests/domain/occasionPresets.test.ts
git commit -m "feat: occasion preset table"
```

---

### Task 5: Migration for first_party_facts + place_guides.price_band

**Files:**
- Create: `supabase/migrations/0021_intent_search.sql`
- Test: `tests/migrations/intentSearchMigration.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/migrations/intentSearchMigration.test.ts`:

```typescript
import fs from "fs";
import path from "path";

const file = path.join(process.cwd(), "supabase", "migrations", "0021_intent_search.sql");
const sql = fs.readFileSync(file, "utf8");

test("creates the first_party_facts table", () => {
  expect(sql).toMatch(/create table if not exists first_party_facts/);
});

test("adds a price_band column to place_guides", () => {
  expect(sql).toMatch(/alter table place_guides[\s\S]*price_band/);
});

test("exposes a batch read RPC granted to anon and authenticated", () => {
  expect(sql).toMatch(/create or replace function get_first_party_facts/);
  expect(sql).toMatch(/grant execute on function get_first_party_facts\(text\[\]\) to authenticated, anon/);
});

test("facts are world-readable but not client-writable (no write policy)", () => {
  expect(sql).toMatch(/enable row level security/);
  expect(sql).toMatch(/for select\s+using \(true\)/);
  expect(sql).not.toMatch(/for insert/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/migrations/intentSearchMigration.test.ts`
Expected: FAIL with "ENOENT: no such file ... 0021_intent_search.sql".

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0021_intent_search.sql`:

```sql
-- Intent search first-party facts: price band and dietary flags the operator curates or derives
-- (name matching now, menu enrichment later). This is first-party derived data: it stores only a
-- place_id plus facts we own, never Google content. World-readable reference data; only the
-- service role may write it (no insert/update/delete policy, so RLS denies all client writes).

create table if not exists first_party_facts (
  place_id text primary key,
  price_band int,                      -- 1..4, curated (e.g. from the Michelin guide)
  dietary_flags text[] not null default '{}',  -- e.g. {'vegetarian'}
  source text,                         -- 'curated' | 'name' | 'menu'
  confirmed_at timestamptz not null default now()
);

alter table first_party_facts enable row level security;

drop policy if exists "first_party_facts readable by everyone" on first_party_facts;
create policy "first_party_facts readable by everyone"
  on first_party_facts for select
  using (true);

-- Curated price band on guide rows, so a Michelin/hatted place carries the guide's own price
-- rather than a bad type-based inference (cheap Michelin exists).
alter table place_guides add column if not exists price_band int;

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/migrations/intentSearchMigration.test.ts tests/migrations/migrationIntegrity.test.ts`
Expected: PASS (both the new file and the existing integrity checks, since 0021 has a unique prefix and recreates its policy defensively).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0021_intent_search.sql tests/migrations/intentSearchMigration.test.ts
git commit -m "feat: first_party_facts table, RPC, and place_guides.price_band"
```

---

### Task 6: Client facts reader

**Files:**
- Create: `src/api/firstPartyFacts.ts`
- Test: `tests/api/firstPartyFacts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/firstPartyFacts.test.ts`:

```typescript
import { getFirstPartyFacts, annotateFacts } from "../../src/api/firstPartyFacts";
import type { Place } from "../../src/domain/types";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: { rpc: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

function place(id: string): Place {
  return { placeId: id, name: id, lat: 0, lng: 0, cuisines: [] };
}

test("getFirstPartyFacts maps rows keyed by place_id", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({
    data: [{ place_id: "a", price_band: 3, dietary_flags: ["vegetarian"] }],
    error: null,
  });
  const out = await getFirstPartyFacts(["a"]);
  expect(out.a).toEqual({ priceBand: 3, dietaryFlags: ["vegetarian"] });
});

test("getFirstPartyFacts is best effort: an error returns an empty map", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: new Error("rls") });
  expect(await getFirstPartyFacts(["a"])).toEqual({});
});

test("getFirstPartyFacts skips the round trip for an empty id list", async () => {
  expect(await getFirstPartyFacts([])).toEqual({});
  expect(supabase.rpc).not.toHaveBeenCalled();
});

test("annotateFacts applies price band and unions dietary tags", () => {
  const places = [place("a")];
  const out = annotateFacts(places, { a: { priceBand: 3, dietaryFlags: ["vegetarian"] } });
  expect(out[0].priceBand).toBe(3);
  expect(out[0].dietaryTags).toEqual(["vegetarian"]);
});

test("annotateFacts leaves places without facts untouched", () => {
  const out = annotateFacts([place("a")], {});
  expect(out[0].priceBand).toBeUndefined();
  expect(out[0].dietaryTags).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/api/firstPartyFacts.test.ts`
Expected: FAIL with "Cannot find module '../../src/api/firstPartyFacts'".

- [ ] **Step 3: Write the implementation**

Create `src/api/firstPartyFacts.ts`:

```typescript
import { supabase } from "../lib/supabase";
import type { Place } from "../domain/types";

export type FirstPartyFact = { priceBand?: number; dietaryFlags: string[] };

// Curated/derived first-party facts (price band, dietary flags) for a set of places. Best-effort
// and display-only, exactly like getPlaceGuides: a failure just means no enrichment this round.
export async function getFirstPartyFacts(placeIds: string[]): Promise<Record<string, FirstPartyFact>> {
  if (placeIds.length === 0) return {};
  const { data, error } = await supabase.rpc("get_first_party_facts", { place_ids: placeIds });
  if (error || !data) return {};
  const out: Record<string, FirstPartyFact> = {};
  for (const row of data as any[]) {
    if (typeof row.place_id === "string") {
      out[row.place_id] = {
        priceBand: typeof row.price_band === "number" ? row.price_band : undefined,
        dietaryFlags: Array.isArray(row.dietary_flags) ? row.dietary_flags : [],
      };
    }
  }
  return out;
}

// Merge facts onto places for the rule engine: curated price band wins, dietary tags are unioned.
export function annotateFacts(places: Place[], facts: Record<string, FirstPartyFact>): Place[] {
  return places.map((p) => {
    const f = facts[p.placeId];
    if (!f) return p;
    const band = f.priceBand === 1 || f.priceBand === 2 || f.priceBand === 3 || f.priceBand === 4 ? f.priceBand : undefined;
    const dietaryTags = f.dietaryFlags.length > 0
      ? Array.from(new Set([...(p.dietaryTags ?? []), ...f.dietaryFlags]))
      : p.dietaryTags;
    return { ...p, ...(band ? { priceBand: band } : {}), ...(dietaryTags ? { dietaryTags } : {}) };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/api/firstPartyFacts.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/api/firstPartyFacts.ts tests/api/firstPartyFacts.test.ts
git commit -m "feat: first-party facts client reader"
```

---

### Task 7: Carry userRatingCount through the search pipeline

**Files:**
- Modify: `supabase/functions/places-proxy/index.ts:251-261` (SafePlace type), `:279-308` (shapePlace), `:340-341` (field mask)
- Modify: `src/api/places.ts:80-96` (shapeProxyPlace)
- Test: `tests/api/places.test.ts` (add one case)

- [ ] **Step 1: Write the failing test**

Add to `tests/api/places.test.ts` (after the "searchNearby carries the coarse cuisine" test):

```typescript
test("searchNearby carries userRatingCount from the proxy", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: { places: [{ placeId: "x", name: "X", lat: 1.01, lng: 2.01, rating: 4.5, userRatingCount: 320, cuisines: ["Thai"] }] },
    error: null,
  });
  const out = await searchNearby(1, 2, "food");
  expect(out[0].userRatingCount).toBe(320);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/api/places.test.ts -t "userRatingCount"`
Expected: FAIL (`out[0].userRatingCount` is undefined because `shapeProxyPlace` drops it).

- [ ] **Step 3: Wire userRatingCount through the client shaper**

In `src/api/places.ts`, in `shapeProxyPlace` (the returned object, around line 84-95), add the field after `rating`:

```typescript
    rating: p.rating,
    userRatingCount: typeof p.userRatingCount === "number" ? p.userRatingCount : undefined,
```

- [ ] **Step 4: Wire userRatingCount through the proxy**

In `supabase/functions/places-proxy/index.ts`:

4a. Add to the `SafePlace` type (after `rating?: number;` at line 256):
```typescript
  userRatingCount?: number;
```

4b. Add to the `shapePlace` return object (after `rating: raw.rating,` at line 303):
```typescript
    userRatingCount: raw.userRatingCount,
```

4c. Add `places.userRatingCount` to the field mask string (line 340-341), so it reads:
```typescript
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.location,places.rating,places.userRatingCount,places.priceLevel,places.primaryType,places.primaryTypeDisplayName,places.types,places.attributions",
```

Note: `userRatingCount` is in the same Enterprise SKU tier already triggered by `rating`/`priceLevel`, so this adds no billing tier cost.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest tests/api/places.test.ts`
Expected: PASS (all existing tests plus the new userRatingCount case).

If the repo runs Deno tests for the proxy, run: `deno test supabase/functions` and expect the existing proxy tests still pass (the new field is additive).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/places-proxy/index.ts src/api/places.ts tests/api/places.test.ts
git commit -m "feat: carry userRatingCount from places-proxy to the client"
```

---

### Task 8: Occasion chips UI + map wiring

**Files:**
- Create: `src/components/OccasionChips.tsx`
- Test: `tests/components/OccasionChips.test.tsx`
- Modify: `app/(tabs)/map.tsx` (state, render near line 402, filterVisible at 362-365)

- [ ] **Step 1: Write the failing component test**

Create `tests/components/OccasionChips.test.tsx`:

```typescript
import { render, fireEvent, screen } from "@testing-library/react-native";
import { OccasionChips } from "../../src/components/OccasionChips";
import { occasionById } from "../../src/domain/occasionPresets";

test("renders a chip per occasion and reports the picked occasion", () => {
  const onPick = jest.fn();
  render(<OccasionChips activeId={null} onPick={onPick} />);
  fireEvent.press(screen.getByText("Date night"));
  expect(onPick).toHaveBeenCalledWith(occasionById("date-night"));
});

test("re-tapping the active occasion clears it", () => {
  const onPick = jest.fn();
  render(<OccasionChips activeId="date-night" onPick={onPick} />);
  fireEvent.press(screen.getByText("Date night"));
  expect(onPick).toHaveBeenCalledWith(null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/components/OccasionChips.test.tsx`
Expected: FAIL with "Cannot find module '../../src/components/OccasionChips'".

- [ ] **Step 3: Write the component**

Create `src/components/OccasionChips.tsx`:

```typescript
import { ScrollView, Pressable, Text, StyleSheet } from "react-native";
import { OCCASIONS, type Occasion } from "../domain/occasionPresets";
import { colors, space, radius, font } from "../theme";

type Props = {
  activeId: string | null;
  onPick: (occasion: Occasion | null) => void;
};

// Horizontal row of occasion chips. Tapping a chip picks that occasion; tapping the active
// chip again clears it. Sits under the search bar, next to the cuisine filter.
export function OccasionChips({ activeId, onPick }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
      keyboardShouldPersistTaps="handled"
    >
      {OCCASIONS.map((o) => {
        const on = o.id === activeId;
        return (
          <Pressable
            key={o.id}
            onPress={() => onPick(on ? null : o)}
            style={[s.chip, on && s.chipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
          >
            <Text style={[s.txt, on && s.txtOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { gap: space.xs, paddingVertical: space.xs, paddingRight: space.md },
  chip: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  txt: { fontFamily: font.body, fontSize: 13, color: colors.text },
  txtOn: { color: colors.onAccent },
});
```

Note: if any imported theme token name differs in this repo, open `src/theme` (or wherever `CuisineFilter` imports its tokens from) and match the exact names used there. Do NOT invent tokens.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/components/OccasionChips.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire into the map screen**

In `app/(tabs)/map.tsx`:

5a. Add imports near the other domain/component imports (top of file):
```typescript
import { OccasionChips } from "../../src/components/OccasionChips";
import { runIntentQuery, type StructuredQuery } from "../../src/domain/intentQuery";
import type { Occasion } from "../../src/domain/occasionPresets";
```

5b. Add state near the other `useState` hooks (around line 34 where `query` is declared):
```typescript
  const [activeIntent, setActiveIntent] = useState<StructuredQuery | null>(null);
  const [activeOccasionId, setActiveOccasionId] = useState<string | null>(null);
```

5c. Add a handler next to the other handlers (near `submitTypedSearch`):
```typescript
  function pickOccasion(occasion: Occasion | null) {
    setActiveOccasionId(occasion?.id ?? null);
    setActiveIntent(occasion?.query ?? null);
    if (occasion) {
      setQuery(occasion.query.queryHint);
      setActiveSearchText(occasion.query.queryHint);
    }
  }
```
(`setActiveSearchText` is the existing setter that drives the search effect; confirm its exact name at line ~262 and match it. If the search is triggered differently, call the same path `submitTypedSearch` uses.)

5d. Apply the engine in `filterVisible` (replace lines 362-365):
```typescript
  const filterVisible = (list: Place[]) => {
    const base = applyFilters(list, { selected: sel, suppressed, budgetMax, withinKm, minRating, sortBy, showState });
    const intent = activeIntent ? runIntentQuery(base, activeIntent).results.map((r) => r.place) : base;
    return friendsOnly ? intent.filter((p) => friendsBeen.has(p.placeId)) : intent;
  };
```

5e. Render the chips under `<CuisineFilter />` (after line 402):
```tsx
        <CuisineFilter />
        <OccasionChips activeId={activeOccasionId} onPick={pickOccasion} />
```

- [ ] **Step 6: Verify the whole suite and types**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx jest`
Expected: all suites pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/OccasionChips.tsx tests/components/OccasionChips.test.tsx "app/(tabs)/map.tsx"
git commit -m "feat: occasion chips wired into map search"
```

---

## Final verification

- [ ] Run `npx tsc --noEmit` — no errors.
- [ ] Run `npx jest` — all suites pass.
- [ ] If the repo has Deno tests: `deno test supabase/functions` — pass.
- [ ] Manual smoke (optional, needs migration pushed): tap "Date night" chip, confirm the search runs the queryHint and results are re-ranked. Note that curated price bands and dietary tags only appear after `first_party_facts` is seeded and `npx supabase db push` is run.

## Self-review notes

- Spec coverage: rule engine (Task 3), occasion presets (Task 4), first_party_facts + RPC + place_guides.price_band (Task 5), userRatingCount (Task 7), name-based dietary flags (Task 2), occasion chip UI (Task 8). Density-scaled quality, prestige override, price soft-rank, keep-and-label, and the relaxation ladder are all tested in Task 3.
- Deferred per spec: AI parser/reasons (Phase 2), atmosphere hard constraints, unconfirmed badge rendering, menu enrichment (TODO 8).
- Type consistency: `StructuredQuery`, `runIntentQuery`, `IntentResult.unconfirmed`, `getFirstPartyFacts`/`annotateFacts`, and `Occasion.query` names are used identically across tasks.
