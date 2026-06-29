# hungr, Setup and Guardrails

> New to this, or setting it up for the first time? Read `docs/GETTING-STARTED.md` first. It is
> the plain-language, step-by-step walkthrough. This file is the short technical checklist.

Pre-build checklist. Work through this before and during v1. The stack is locked: Expo
(React Native, TypeScript), Supabase (Postgres, Auth, Storage, Edge Functions), Google
Places plus Gemini Grounding through a server proxy, Google Maps basemap. See `DESIGN.md`
for visuals and `docs/DESIGN.md` for product, legal, and architecture.

## Locked stack decisions
- **Framework:** Expo (React Native). Targets iOS first, web from the same code, Android later.
- **Cloud builds:** EAS is optional convenience, not a dependency. Builds can be done locally
  on the Mac with Xcode. Low lock-in (EAS just runs xcodebuild and Gradle).
- **Basemap:** Google Maps SDK (iOS) and Google Maps JavaScript (web). Required, because
  Google prohibits showing Places content (reviews, ratings, pins) on a non-Google map.
  Apple Maps and Mapbox are not options for any screen that shows Google place data on a map.
- **Web map caveat:** `react-native-maps` is native only. The web build needs Google Maps
  JavaScript as a platform-split map component. Most other code is shared across platforms.

## Guardrail 0, the proxy boundary (build this first)
Route every third-party call (Google Places, Gemini Grounding) through a thin Supabase Edge
Function. Never call them from the app. This single layer:
- Hides secret keys (treat the app bundle as public, keys in it are extractable).
- Is the one chokepoint that enforces "never persist Google content".
- Holds rate limiting, caching, and cost controls.
- Keeps the legal compliance boundary in one auditable place.

## Guardrails checklist
- [ ] **Secrets split.** Client holds only: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, restricted
      `MAPS_SDK_KEY`. Server (Edge Function) holds: `SUPABASE_SERVICE_ROLE`,
      `GOOGLE_PLACES_KEY`, `GEMINI_KEY`. In Expo only `EXPO_PUBLIC_*` vars are bundled, never
      put a secret there.
- [ ] **Row Level Security on every table, default deny, from the first migration.** Write an
      RLS test that proves a user cannot read or write another user's rows.
- [ ] **Legal data wall.** No DB column ever stores Google review text, photos, or AI
      summaries. Store only `place_id` plus first party data. One `GoogleContent` module
      fetches live, never persists, never feeds your own LLM.
- [ ] **AI boundary.** Your own model never runs over Google reviews. AI over Google data
      goes through Gemini Grounding only. Your own model runs only on first party content.
- [ ] **Attribution always renders** on Google content, and Google content (slate) stays in
      separate components from community content (golden).
- [ ] **Cost controls.** Debounce search (no Places call per keystroke), cache within ToS
      limits, per user rate limit in the Edge Function, Google Cloud billing budget alarms.
- [ ] **Location permissions.** Foreground only, graceful denial path, iOS Info.plist usage
      strings. "Food near me" degrades gracefully if denied.
- [ ] **Identity data (v2 rule, set now).** Self declared only, never inferred, treated as
      sensitive, with a deletion and withdrawal path.
- [ ] **Compliance test suite.** Assert no Google content is persisted, assert attribution
      renders, assert Google data never appears on a non-Google map.

## Local testing (no cloud needed)
- [ ] `npx expo start`, open on your iPhone via Expo Go (pure JS) or a development build
      (for native maps), hot reload over Wi-Fi or USB.
- [ ] iOS Simulator via Xcode for fast local iteration.
- [ ] `npx expo start --web` for the browser build locally.
- [ ] `npx expo run:ios` for a local native build, no cloud.
- [ ] Jest plus React Native Testing Library for units, Maestro for E2E against the simulator.

## Distribution testing
- [ ] iOS: EAS Build (or local Xcode archive) then TestFlight, invite your circle.
- [ ] Web: `expo export --platform web`, deploy to Vercel or Netlify, share the link. Fastest
      way to let friends verify without App Store review.
- [ ] Android (later): same code, add Android Maps SDK config and a Play account.

## Accounts and keys to set up
- [ ] **Apple Developer account** (99 USD per year). TestFlight and App Store.
- [ ] **Expo plus EAS account** (free tier to start).
- [ ] **Supabase project.** Note the project URL, anon key (client), service_role key (server
      only). Enable Auth (email magic link plus Google provider). Create a Storage bucket for
      first party photos. Turn on RLS.
- [ ] **Google Cloud project.** Enable: Places API (New), Maps SDK for iOS, Maps JavaScript
      API (web), Maps SDK for Android (later), and Gemini plus Maps Grounding Lite. Create
      restricted keys: one per platform for the Maps SDK (client, restricted by app and
      referrer), one server key for Places and Grounding. Set billing and budget alarms.
- [ ] **Google OAuth client.** Powers Supabase "Sign in with Google" and the Gmail login.
- [ ] **Gemini API access.** Server side only, via the Edge Function.
- [ ] **Vercel or Netlify** for the web build (free tier fine).
- [ ] (later) **Google Play account** (25 USD one time).

## Env layout
```
Client bundle (public):   SUPABASE_URL, SUPABASE_ANON_KEY, MAPS_SDK_KEY (restricted)
Edge Function (secret):   SUPABASE_SERVICE_ROLE, GOOGLE_PLACES_KEY, GEMINI_KEY
```

## Open items deferred to the pre-scale legal check
- Whether any screen may show Google data without a Google map (lists or cards with logo).
- Maps Grounding and reviewSummary availability and pricing in Australia.
- Community fact tags and any review derived extraction.
- Identity and consent model for v2.
