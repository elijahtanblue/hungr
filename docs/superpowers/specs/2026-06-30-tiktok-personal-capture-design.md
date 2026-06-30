# TikTok Personal Capture Design

## Goal

Let a user paste a TikTok food video URL, let hungr infer likely Google Places candidates from
TikTok oEmbed metadata, and save the place to Want to go only after the user explicitly confirms
the correct candidate.

## Product Rules

- This is personal capture, not creator ingestion.
- No TikTok link auto-populates the user's map.
- Saving happens only after the user taps a specific Google Place candidate.
- Confidence scores stay internal. The UI uses plain language such as Recommended match.
- MVP uses TikTok oEmbed title/author metadata only. It does not download video files, scrape
  comments, transcribe audio, or crawl creator feeds.
- If no candidate is strong enough, the user sees a manual-search fallback instead of a fake match.

## User Flow

1. Account has a new row, Save from TikTok.
2. User opens the flow and pastes a TikTok URL.
3. The app sends the URL and current location bias to a Supabase Edge Function.
4. The Edge Function validates the URL, fetches TikTok oEmbed metadata, searches Google Places
   with a minimal field mask, and returns up to three strong candidates.
5. The user reviews the candidates and chooses one.
6. The app saves the selected place as Want to go and records the TikTok source context.
7. The user returns to the map, where the saved place appears like other saved pins.

## Backend

Create a `tiktok-import` Edge Function.

Input:

```json
{
  "url": "https://www.tiktok.com/@creator/video/123",
  "lat": -33.87,
  "lng": 151.21
}
```

Output:

```json
{
  "source": {
    "url": "https://www.tiktok.com/@creator/video/123",
    "videoId": "123",
    "creator": "Creator Name",
    "creatorUrl": "https://www.tiktok.com/@creator",
    "title": "Best steak night in Sydney. The Gidley is insane."
  },
  "candidates": [
    {
      "placeId": "ChIJ...",
      "name": "The Gidley",
      "address": "Basement, 161 King St, Sydney NSW",
      "lat": -33.868,
      "lng": 151.208,
      "rating": 4.6,
      "cuisines": ["Steakhouse"],
      "confidence": 0.99,
      "recommended": true,
      "evidence": "TikTok caption mentions The Gidley."
    }
  ]
}
```

The function is auth-gated and rate-limited through the existing shared guard.

## Persistence

Add `user_place_sources`, a first-party table owned by the user. It stores only source context
created by the user's action:

- `user_id`
- `place_id`
- `source = 'tiktok'`
- `source_url`
- `source_video_id`
- `creator_handle`
- `caption`
- `evidence`
- `dish_tags`
- `confidence`

Saving uses a `save_tiktok_source(...)` RPC so state and source context are written through a
single server-side ownership boundary.

## UI

Add `app/tiktok-import.tsx`.

States:

- Input: paste URL, submit.
- Review: show up to three candidate cards. The best 99%+ candidate is marked Recommended match.
- Empty: show "We could not confidently find the place" and guide the user to search manually.
- Done: show the saved place and return to the map.

The UI should feel like the existing list import flow, not like a new product surface.

## Testing

- Edge pure tests validate URL safety, oEmbed shaping, candidate scoring, and top-three filtering.
- API tests validate Edge invocation and confirmation RPC payload.
- UI tests validate that nothing is saved before user confirmation.
- Existing map/import tests continue to pass.

## Deferred

- iOS Share Extension.
- TikTok transcript/audio analysis.
- OCR from screenshots.
- Creator feed ingestion.
- Bulk import.
