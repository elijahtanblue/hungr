# Local Trends Backend Handoff

Goal: replace the ranked raw-activity list with a small set of anonymized local insight cards.

## What Backend Now Provides

New migration: `supabase/migrations/0034_local_trend_cards.sql`

New client helper: `getLocalTrendCards` in `src/api/localTrends.ts`

RPC contract:

```ts
get_local_trend_cards(
  candidate_place_ids text[],
  weeks_back int default 1,
  max_rows int default 6,
  min_actor_count int default 2
)
```

The client must provide nearby candidate place IDs from the current map/search area. hungr still
does not store durable Google lat/lng, so locality comes from the visible/candidate place list.

The RPC returns:

```ts
type LocalTrendCard = {
  placeId: string;
  trendType: "popping_off" | "consistently_loved" | "up_and_coming" | "quieter_pick";
  headline: string;
  summary: string;
  trendScore: number;
  reviewCount: number;
  checkInCount: number;
  saveCount: number;
  lovedCount: number;
  likedCount: number;
  goCount: number;
  dislikedCount: number;
  actorCount: number;
  averageHungrRating?: number;
};
```

## Product Intent

Do not render this as a long leaderboard.

Render 4 to 6 cards with the returned `headline` and `summary`, for example:

- This place is popping off
- Getting strong hungr reviews
- Up and coming nearby
- A quieter pick right now

Avoid exposing raw personal-looking copy such as `1 save · 1 review · 1 loved this week`. Those
counts can be used as secondary/debug data, but the user-facing card should read as an area-level
food signal.

## Privacy And Trust Rules

- Local trends are aggregate first-party hungr signals only.
- The RPC is not scoped to `auth.uid()`.
- The default privacy floor is `min_actor_count = 2`, so one account does not create a visible trend.
- Individual people and friend activity belong in the normal Feed tab, not Local trends.
- Do not claim Google review momentum yet. Google gives current `userRatingCount`, not safe weekly
  deltas unless hungr deliberately snapshots that later.

## Suggested Frontend Wiring

On the Feed tab:

1. Keep the `Feed | Local trends` segmented control.
2. When Local trends is selected, build a candidate place list from the current known nearby places,
   recent map results, or a lightweight `food near here` query.
3. Call:

```ts
getLocalTrendCards(candidatePlaceIds, { limit: 6, minActorCount: 2 })
```

4. Resolve names through `getPlaceNames` as the current Feed already does.
5. Render cards, not rows. Tapping a card opens the place detail.

Empty state copy:

`Nothing trending nearby yet. As more people save, review, and check in around here, local food signals will appear.`

## Tests Added

- `tests/migrations/localTrendCardsMigration.test.ts`
- `tests/api/localTrendCards.test.ts`
