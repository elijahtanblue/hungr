# TODOS, hungr

Captured from /plan-eng-review on 2026-06-29. See [docs/DESIGN.md](docs/DESIGN.md) for full context.

---

## 1. UGC cold-start / contribution flywheel  ← THE product risk
**What:** Design how first-party reviews actually take off, what makes you + your ~50 friends
write reviews in the app, and keep doing it.
**Why:** The entire moat is owned content ("for the people, by the people"). Every shortcut to
avoid building this supply (scraping, multi-source, ethnicity inference, creator-authority) was
ruled out by law/ToS/missing data. Contribution is the only thing left, and it's unproven.
**Pros:** Solving it unlocks the differentiator; nothing else matters if this fails.
**Cons:** It's a product/growth problem, not an engineering one, no clean technical fix.
**Context:** Grounding-with-Maps bootstraps a non-empty app on day one, but the community
section stays thin until people contribute. Ideas to explore: seeding (you write the first N),
in-app reasons to post (your review "stands out"), friction-free capture, social pull (v2).
**Depends on / blocked by:** Nothing, can prototype the contribution UX immediately.

## 2. Pre-scale legal review
**What:** Before production/scale, have a lawyer review Google Maps Platform ToS (esp.
§3.2.3(c) "no creating content", caching rules, attribution), Maps Grounding terms, and a
privacy/consent model for v2 self-declared identity (heritage/cuisine) data.
**Why:** The architecture leans on fine distinctions (display vs. derive; Grounding as the only
sanctioned AI-over-Maps path; ethnicity = special-category data). These are load-bearing and
currently rest on research, not counsel.
**Pros:** De-risks the whole product before real users/scale; cheap relative to a takedown.
**Cons:** Costs a legal consult; not needed at the you+friends prototype stage.
**Context:** No `plan-legal` skill exists in the gstack environment, this needs a human lawyer.
Key docs: Maps Platform Terms, Places API policies, Maps Grounding Lite terms, GDPR Art. 9,
Australian Privacy Act (sensitive information).
**Depends on / blocked by:** Do before any public launch or monetization.

## 3. Refresh test-plan + failure-mode docs
**What:** Update the eng-review test artifacts to the LOCKED v1 (Grounding bootstrap +
first-party UGC + Google base display), removing the retracted "authenticity engine over
Google reviews" test cases.
**Why:** Those artifacts were written before the Codex/legal pivot and now describe a design
that was retracted (§3.2.3(c)). Stale test specs actively mislead.
**Pros:** Keeps the test plan trustworthy for when implementation starts.
**Cons:** ~10 min of doc work.
**Context:** Test plan at ~/.gstack/projects/hungr/elija-main-eng-review-test-plan-*.md.
New focus: "food near me" + cuisine filter, Grounding feature (source-links present, separate
block), first-party review/photo/tag flows, compliance assertions (no Google content stored).
**Depends on / blocked by:** Locked architecture (done).

## 4. Verify Grounding / reviewSummary AU support + pricing
**What:** Confirm Maps Grounding-with-Maps regional availability + per-request cost in
Australia, and whether Google's `reviewSummary` field supports AU yet (appears NOT to).
**Why:** The v1 bootstrap AI feature depends on Grounding working in your launch market; the
"display Google's own summary" fallback may be unavailable in AU.
**Pros:** Confirms the bootstrap feature is actually available where you'll launch.
**Cons:** Quick research/spike.
**Context:** Google review summaries docs listed UK/US/India/LatAm/Japan, not Australia.
Grounding-with-Maps is GA but verify AU + pricing tier. Note: Intent Search (item 7) uses AI
as a thin parser only and does NOT use Grounding, so this blocker no longer gates that feature.
It still gates the reviewSummary bootstrap.
**Depends on / blocked by:** Nothing, do before building the Grounding feature.

## 5. V3 cuisine + venue inference (research)
**What:** Fill gaps where neither Google place types nor first party tags know the cuisine or
venue kind. Signals to explore: cuisine from the place name, cuisine from dish mentions in
first party reviews, place-type heuristics (a Singapore hawker centre implies Singaporean),
and identifying home / no-storefront food businesses (clearly not a restaurant or cafe,
residential or no premises).
**Why:** v1 cuisine is coarse (Google types only) and v2 adds community tags, but the most
differentiated supply (fine cuisines, home cooks, hawker stalls) is exactly what Google will
not label. This is the long-tail moat.
**Pros:** Surfaces places competitors and Google miss; reinforces "by the people" positioning.
**Cons:** Hardest to source reliably; inference must be marked as inferred and never derived
from Google review text (ToS §3.2.3(c)).
**Context:** Captured in the cuisine granularity roadmap of
docs/superpowers/plans/2026-06-29-hungr-v1-map-foundation.md. Home businesses likely need
first party "this is a home business" tags plus absence-of-storefront heuristics.
**Depends on / blocked by:** A meaningful base of first party data (depends on item 1).

## 6. V3 product analytics (PostHog)
**What:** Add PostHog to measure how people actually use hungr: which screens they open, where
the "find food near me" funnel drops off, how many places get saved per session, retention
(do they come back and keep contributing). Client SDK `posthog-react-native`, the project API
key shipped as `EXPO_PUBLIC_POSTHOG_KEY` (write-only, safe in the app).
**Why:** Item 1 (the contribution flywheel) is the whole product risk, and right now it is
unmeasured. Analytics turns "I think people save places" into numbers, so the contribution UX
can be tuned against real funnels instead of guesses.
**Pros:** Cheap to add (free tier is generous), turns the flywheel from a hunch into a dashboard,
session replay and funnels are strong for a solo founder with no analytics team.
**Cons:** One more SDK and consent surface; must respect the privacy model (no PII or place
content in events, identify users by their Supabase id only, honour the privacy policy and any
v2 consent gate). Autocapture should stay off so nothing sensitive leaks by default.
**Context:** Self-declared identity data (v2/v3) is special-category, so analytics must never
carry it. Use EU cloud if launching into GDPR markets. Wire it once there is real usage to
measure, not before. Beginner setup steps captured in docs/GETTING-STARTED.md (section 8g).
**Depends on / blocked by:** Real users (Milestone B shipped); ideally after item 2 legal review
confirms the consent model.

## 7. Intent Search (occasion + natural-language search)
**What:** Turn a person's intent ("date night", "somewhere exotic to impress a date near the
water where we can talk") into ranked results. AI is a thin parser (natural language to a
structured query, plus a one-line reason per result); a deterministic rule engine does all
retrieval, filtering, and ranking against Google plus first-party data. Named occasions run the
same engine from a static preset table with no AI in the path.
**Why:** High-intent discovery ("plan my evening") that Google's flat search does not serve, and
it leans on the rule engine and first-party data rather than a model over Google content.
**Pros:** Cheap (~0.002 USD/query, mostly cached), no Grounding so no AU blocker, deterministic
core is fully testable, facts never come from AI.
**Cons:** Rule tuning (queryHint wording, thresholds, type lists) is empirical and must be
validated against the launch city; two new edge functions plus a new facts table.
**Context:** Full design in docs/superpowers/specs/2026-07-01-intent-search-design.md. Phase 1
is the rule engine, occasion presets, first_party_facts table, and UI (no AI). Phase 2 adds the
intent-parse and intent-reasons functions and the free-text box.
**Depends on / blocked by:** Phase 2 review-mining ideas are blocked by item 2 (legal).

## 8. Menu enrichment: JSON-LD facts + Menu tab (SCOPED, spec written)
**What:** Two features. (1) JSON-LD extractor: fetch each restaurant's own website (Google gives
`websiteUri`), parse schema.org Menu/MenuItem/Offer, derive price_band + dietary_flags into
first_party_facts (first-party, storable) to power search filters. (2) Menu tab: display Google
`businessMenus` live on the detail screen (view-only, never stored). Enrichment runs via an
activity-driven queue drained by an hourly cron that only processes places in their local 2-5am
window (off-peak per timezone via Google `utcOffsetMinutes`).
**Why:** Google lacks per-person price and precise dietary. JSON-LD gives structured prices for
the subset of sites that publish it; the Menu tab lets users read the menu regardless.
**Pros:** Deterministic (no OCR/LLM), first-party for search, compliant for view; amortized cost;
freshness-gated and never overwrites curated prices.
**Cons:** Partial coverage (structured sites only); a queue table + cron worker is real infra;
`businessMenus` availability is unverified.
**Context:** Full design in docs/superpowers/specs/2026-07-01-menu-enrichment-design.md. The
first_party_facts consumer is already built (item 7). OCR/LLM/HTML fallback deferred (item 9).
**Depends on / blocked by:** Item 7 shipped. Feature 2 depends on the item 10 businessMenus spike.

## 9. Menu OCR + LLM extraction (deferred until more users/budget)
**What:** Extend menu enrichment (item 8) to the sites JSON-LD does not cover: parse raw HTML,
OCR image and PDF menus, and use an LLM to extract prices + dietary from messy layouts into
first_party_facts. This is the biggest coverage lever for price/dietary SEARCH.
**Why:** Most restaurant menus are images or unstructured pages, so JSON-LD alone leaves a large
gap in search coverage. OCR/LLM fills it.
**Pros:** Pushes search coverage from the structured-site subset toward most restaurants.
**Cons:** Fragile, ongoing maintenance, OCR infra + LLM per-place cost, third-party site ToS and
robots exposure. Not worth it pre-scale.
**Context:** Deferred from item 8 on the founder's call ("figure out OCR and LLM later for search").
The first_party_facts interface already accepts these rows, so this slots in without touching the
search or consumer code.
**Depends on / blocked by:** Item 8 shipped; meaningful user base + budget.

## 10. Verify Google businessMenus field (spike)
**What:** Confirm the Place Details (New) `businessMenus` field is real in Google's official Place
Data Fields docs, its availability in Australia, and its SKU tier + per-call cost.
**Why:** The Menu tab (item 8, Feature 2) displays businessMenus live. The field is currently a
third-party-blog claim, not confirmed in Google's own docs, so the Menu tab must degrade to empty
until this is verified.
**Pros:** Confirms the view feature is buildable in the launch market before relying on it.
**Cons:** Quick research/spike.
**Context:** Google Place Data Fields docs: https://developers.google.com/maps/documentation/places/web-service/data-fields
**Depends on / blocked by:** Nothing; do before relying on the Menu tab.
