# TODOS — hungr

Captured from /plan-eng-review on 2026-06-29. See [docs/DESIGN.md](docs/DESIGN.md) for full context.

---

## 1. UGC cold-start / contribution flywheel  ← THE product risk
**What:** Design how first-party reviews actually take off — what makes you + your ~50 friends
write reviews in the app, and keep doing it.
**Why:** The entire moat is owned content ("for the people, by the people"). Every shortcut to
avoid building this supply (scraping, multi-source, ethnicity inference, creator-authority) was
ruled out by law/ToS/missing data. Contribution is the only thing left, and it's unproven.
**Pros:** Solving it unlocks the differentiator; nothing else matters if this fails.
**Cons:** It's a product/growth problem, not an engineering one — no clean technical fix.
**Context:** Grounding-with-Maps bootstraps a non-empty app on day one, but the community
section stays thin until people contribute. Ideas to explore: seeding (you write the first N),
in-app reasons to post (your review "stands out"), friction-free capture, social pull (v2).
**Depends on / blocked by:** Nothing — can prototype the contribution UX immediately.

## 2. Pre-scale legal review
**What:** Before production/scale, have a lawyer review Google Maps Platform ToS (esp.
§3.2.3(c) "no creating content", caching rules, attribution), Maps Grounding terms, and a
privacy/consent model for v2 self-declared identity (heritage/cuisine) data.
**Why:** The architecture leans on fine distinctions (display vs. derive; Grounding as the only
sanctioned AI-over-Maps path; ethnicity = special-category data). These are load-bearing and
currently rest on research, not counsel.
**Pros:** De-risks the whole product before real users/scale; cheap relative to a takedown.
**Cons:** Costs a legal consult; not needed at the you+friends prototype stage.
**Context:** No `plan-legal` skill exists in the gstack environment — this needs a human lawyer.
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
**Context:** Google review summaries docs listed UK/US/India/LatAm/Japan — not Australia.
Grounding-with-Maps is GA but verify AU + pricing tier.
**Depends on / blocked by:** Nothing — do before building the Grounding feature.

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
