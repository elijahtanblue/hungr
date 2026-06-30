# TikTok Personal Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a confirmation-first TikTok personal capture flow that saves a Google Place to Want to go only after the user chooses the correct candidate.

**Architecture:** Use a Supabase Edge Function to validate the TikTok URL, fetch oEmbed metadata, search Google Places with a minimal field mask, and return candidate matches. Use a client API wrapper plus a new Expo Router screen for the paste/review/confirm flow. Save confirmed imports through a Postgres RPC that writes `user_places` and first-party source context together.

**Tech Stack:** Expo Router, React Native, Supabase JS, Supabase Edge Functions on Deno, Postgres RLS/RPC, Jest, Deno tests.

---

### Task 1: Data Boundary

**Files:**
- Create: `supabase/migrations/0014_tiktok_sources.sql`
- Test: `supabase/tests/rls.test.ts`

- [ ] **Step 1: Write the migration**

Create `user_place_sources` with own-row RLS and a `save_tiktok_source(...)` RPC. The RPC must use `auth.uid()`, insert the place anchor, upsert `user_places` to `go`, and upsert one TikTok source row for the confirmed URL.

- [ ] **Step 2: Verify SQL references**

Run: `rg -n "user_place_sources|save_tiktok_source" supabase/migrations supabase/tests`
Expected: the table, policies, grants, and RPC are present.

### Task 2: Edge Function

**Files:**
- Create: `supabase/functions/tiktok-import/index.ts`
- Create: `supabase/functions/tiktok-import/index.test.ts`

- [ ] **Step 1: Write failing Deno tests**

Cover safe TikTok URL validation, video ID extraction, title cleanup, candidate scoring, and top-three candidate filtering.

- [ ] **Step 2: Run tests red**

Run: `deno test --allow-env supabase/functions/tiktok-import/index.test.ts`
Expected: failure because the function file does not exist yet.

- [ ] **Step 3: Implement the Edge Function**

Use `guard(req, 20)` and `readJsonObject(req)`. Fetch `https://www.tiktok.com/oembed?url=...`, search Google Places Text Search with field mask `places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.primaryType,places.types`, score candidates, and return only candidates with internal confidence >= 0.9.

- [ ] **Step 4: Run tests green**

Run: `deno test --allow-env supabase/functions/tiktok-import/index.test.ts`
Expected: pass.

### Task 3: Client API

**Files:**
- Create: `src/api/tiktokImport.ts`
- Create: `tests/api/tiktokImport.test.ts`

- [ ] **Step 1: Write failing Jest tests**

Cover invoking `tiktok-import`, rejecting invalid responses, and calling `save_tiktok_source` only when confirmation occurs.

- [ ] **Step 2: Run tests red**

Run: `npm test -- tests/api/tiktokImport.test.ts --runInBand`
Expected: failure because the API file does not exist yet.

- [ ] **Step 3: Implement API wrapper**

Export `resolveTikTokLink(url, bias)` and `saveTikTokCandidate(source, candidate)`.

- [ ] **Step 4: Run tests green**

Run: `npm test -- tests/api/tiktokImport.test.ts --runInBand`
Expected: pass.

### Task 4: UI Flow

**Files:**
- Create: `app/tiktok-import.tsx`
- Modify: `app/(tabs)/account.tsx`
- Create: `tests/components/TikTokImport.test.tsx`
- Modify: `tests/components/Account.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Render the TikTok import screen, paste a link, show candidates, and verify no save happens until the user presses Save this place.

- [ ] **Step 2: Run tests red**

Run: `npm test -- tests/components/TikTokImport.test.tsx --runInBand`
Expected: failure because the route does not exist.

- [ ] **Step 3: Implement route and account link**

Add a Save from TikTok row to Account. The route follows input, review, empty, and done states and uses existing colors/spacing.

- [ ] **Step 4: Run tests green**

Run: `npm test -- tests/components/TikTokImport.test.tsx tests/components/Account.test.tsx --runInBand`
Expected: pass.

### Task 5: Integration Verification

**Files:**
- Modify: `src/domain/types.ts` if the current branch needs `go` restored to `PlaceState`.

- [ ] **Step 1: Run typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 2: Run focused tests**

Run: `npm test -- tests/api/tiktokImport.test.ts tests/components/TikTokImport.test.tsx tests/components/Account.test.tsx --runInBand`
Expected: pass.

- [ ] **Step 3: Run Edge tests**

Run: `deno test --allow-env supabase/functions/tiktok-import/index.test.ts`
Expected: pass.

- [ ] **Step 4: Run full Jest suite if focused tests pass**

Run: `npm test -- --runInBand`
Expected: pass.

### Self-Review

- Spec coverage: personal capture, no auto-save, top-three candidates, 99% recommended marker, no visible confidence percentage, and deferred creator ingestion are covered.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: `TikTokImportSource`, `TikTokPlaceCandidate`, `resolveTikTokLink`, and `saveTikTokCandidate` are the names used by the plan.
