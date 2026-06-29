# hungr v1 Map Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first working hungr vertical: a logged-in user opens a Google Maps based Map screen, searches and filters food near them by cuisine (like and dislike), sees three state pins (want to go, been, avoid), and taps a place to set its state, with all Google data fetched live through a server proxy and never persisted.

**Architecture:** Expo (React Native, TypeScript, Expo Router) app talks to Supabase (Postgres, Auth, Storage). All Google Places and Gemini Grounding calls go through Supabase Edge Functions so secret keys never ship in the client and Google content is never stored. Postgres stores only `place_id` plus first party data, protected by Row Level Security. Cuisine tags for v1 come from Google place types (coarse) and are refined by our own `place_cuisines` tags.

**Tech Stack:** Expo SDK (React Native, TypeScript), Expo Router, Zustand (small client store), react-native-maps (Google provider, native), Supabase JS, Supabase Edge Functions (Deno), Postgres, Jest plus @testing-library/react-native, Maestro (E2E later).

**Assumptions / conventions:**
- Sources of truth: `DESIGN.md` (visual tokens), `docs/DESIGN.md` (product, legal, architecture), `docs/SETUP.md` (guardrails, keys).
- No em dashes anywhere in code, comments, or copy.
- Colours and fonts come from `DESIGN.md`. A `theme.ts` mirrors those tokens.
- Local dev uses the Supabase CLI (`supabase start`) so tests run against a local stack.
- iOS first. Web map is a platform split component (stubbed here, native implemented).
- The Supabase client and session hook are built before any route imports them.
- Supabase auth on React Native uses an AsyncStorage adapter (there is no `localStorage` on native).
- The iOS Google Maps SDK key is injected into native config via `app.config.js` from `EXPO_PUBLIC_MAPS_SDK_KEY`.
- v1 cuisine granularity is coarse (Chinese, Korean, Japanese, Thai, Vietnamese, Indian), matching what Google place types can supply. Finer granularity (for example Sichuan) and inference come later (see deferred work).
- **Testing convention (React Native Testing Library 14 on React 19):** `render`, `renderHook`, and `fireEvent` are all async now. Every component test is an `async` test that does `await render(<C/>)`, queries via the imported `screen` object (the render return no longer carries bound queries), and `await fireEvent.press(...)` / `await fireEvent.changeText(...)`. Hook tests do `const r = await renderHook(...)`, then `r.result.current` and `await r.rerender(...)`, and flush timers with `await act(async () => { jest.advanceTimersByTime(ms); })`.

---

## File structure (locked before tasks)

```
app/
  _layout.tsx              Root layout
  index.tsx                Auth gate, redirects to /map or /sign-in
  sign-in.tsx              Auth screen
  map.tsx                  Map screen (the core)
app.config.js              Dynamic Expo config, injects the iOS Maps SDK key
src/
  theme.ts                 Design tokens from DESIGN.md (colours, fonts, spacing, radius)
  lib/supabase.ts          Supabase client (anon key only) plus useSession hook
  hooks/useDebouncedValue.ts  Debounce hook for search input
  store/useFilters.ts      Zustand store: selected cuisines, suppressed cuisines
  domain/suppression.ts    Pure rule: isSuppressed(placeCuisines, suppressed)
  domain/types.ts          Shared TypeScript types (Place, PlaceState, etc.)
  api/places.ts            Client wrapper: calls places-proxy, refines cuisines, applies filters
  components/SearchBar.tsx
  components/CuisineFilter.tsx
  components/PlacePin.tsx
  components/PlaceSheet.tsx
  components/MapCanvas.native.tsx   react-native-maps (Google provider)
  components/MapCanvas.web.tsx      Google Maps JS (stub for v1)
  components/MapCanvas.d.ts        Shared type so tsc resolves the platform-split import
supabase/
  migrations/0001_init.sql         Tables plus rate-limit function
  migrations/0002_rls.sql          RLS policies
  migrations/0003_profile_trigger.sql  Auto create profile on signup
  functions/places-proxy/index.ts  Google Places proxy (never persists, derives cuisine, rate limited)
  functions/grounding/index.ts     Gemini Grounding proxy
tests/
  domain/suppression.test.ts
  hooks/useDebouncedValue.test.ts
  api/places.test.ts
  components/SignIn.test.tsx
  components/CuisineFilter.test.tsx
  components/PlaceSheet.test.tsx
supabase/tests/rls.test.ts         RLS integration tests (Deno)
supabase/functions/places-proxy/index.test.ts
supabase/functions/grounding/index.test.ts
```

---

## Task 1: Scaffold the Expo app, tooling, and theme

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `jest.config.js`, `src/theme.ts`, `app/_layout.tsx`, `app/index.tsx`
- Test: none yet (scaffold task)

- [ ] **Step 1: Create the Expo TypeScript app in the current directory**

Run:
```bash
npx create-expo-app@latest . --template blank-typescript
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
npm install zustand @supabase/supabase-js
# Test toolchain pinned for Expo SDK 56: jest-expo 56 carries jest 29 internals, so jest
# must be 29 (jest 30 breaks the module mocker). @react-native/jest-preset is jest-expo's
# peer dep. test-renderer is RNTL 14's peer for React 19 (replaces react-test-renderer).
# If npm reports ERESOLVE, append --legacy-peer-deps (the scaffold pins react tightly).
npm install -D jest@^29 @types/jest@^29 jest-expo @react-native/jest-preset test-renderer \
  @testing-library/react-native @testing-library/jest-native
```

- [ ] **Step 2: Configure Expo Router and Jest**

Set `package.json` `"main"` to `"expo-router/entry"` and add scripts:
```json
{
  "scripts": {
    "start": "expo start",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "test": "jest"
  },
  "jest": {
    "preset": "jest-expo",
    "testPathIgnorePatterns": ["/node_modules/", "/supabase/"]
  }
}
```

The Supabase folder holds Deno tests (run with `deno test`), so Jest must ignore it.

Also adjust `tsconfig.json` (create-expo-app generated a minimal one) so `tsc --noEmit`
is a reliable gate: add Jest and Node globals and exclude the Deno tree.
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "types": ["jest", "node"]
  },
  "exclude": ["node_modules", "supabase"]
}
```

In `app.json` add the router plugin and iOS location strings:
```json
{
  "expo": {
    "scheme": "hungr",
    "plugins": ["expo-router"],
    "ios": {
      "supportsTablet": false,
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "hungr uses your location to find food near you."
      }
    }
  }
}
```

- [ ] **Step 3: Write the theme tokens from DESIGN.md**

Create `src/theme.ts`:
```typescript
// Mirrors DESIGN.md. Update both together.
export const colors = {
  canvas: "#FCF6DF",
  surface: "#FFFDF4",
  ink: "#1C1A17",
  muted: "#8C8266",
  hair: "#EFE6CE",
  accent: "#FBBF24",
  accentPress: "#E8A50C",
  onAccent: "#241A06",
  been: "#5C8A5A",
  avoid: "#C0563D",
  slate: "#3E6B7A",
} as const;

export const radius = { sm: 10, md: 14, lg: 18, pill: 9999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const fonts = {
  brand: "Fraunces_600SemiBold",
  heading: "CabinetGrotesk_700Bold",
  body: "GeneralSans_400Regular",
  bodyMedium: "GeneralSans_500Medium",
} as const;
```

- [ ] **Step 4: Create the root layout and a placeholder index**

Create `app/_layout.tsx`:
```typescript
import { Stack } from "expo-router";
import { colors } from "../src/theme";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />
  );
}
```

Create `app/index.tsx` (placeholder for now, the auth gate is wired in Task 2 once the Supabase client exists):
```typescript
import { View, Text, StyleSheet } from "react-native";
import { colors, space } from "../src/theme";

export default function Index() {
  return (
    <View style={s.wrap}>
      <Text style={s.brand}>hungr</Text>
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas, padding: space.xl },
  brand: { fontSize: 44, color: colors.ink },
});
```

- [ ] **Step 5: Verify it boots, then commit**

Run: `npx expo start --web`
Expected: dev server starts with no TypeScript errors and renders the placeholder. No route imports anything that does not exist yet.

```bash
git add -A && git commit -m "chore: scaffold expo app, router, jest, theme tokens"
```

---

## Task 2: Supabase client, session hook, and native auth/maps config

**Files:**
- Create: `src/lib/supabase.ts`, `app.config.js`, `.env.local`
- Modify: `app/index.tsx`

- [ ] **Step 1: Install auth and storage dependencies**

Run:
```bash
npx expo install react-native-url-polyfill @react-native-async-storage/async-storage expo-web-browser expo-auth-session
```

- [ ] **Step 2: Add public env vars**

Create `.env.local` (client safe values only, never the service_role key):
```
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<local anon key from supabase start>
EXPO_PUBLIC_MAPS_SDK_KEY=<restricted google maps sdk key>
```

- [ ] **Step 3: Write the client and a session hook with an AsyncStorage adapter**

Create `src/lib/supabase.ts`:
```typescript
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

// AsyncStorage is required on native: there is no localStorage, so without this the
// session never persists across app launches.
export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return { session, loading };
}
```

- [ ] **Step 4: Inject the iOS Maps SDK key via dynamic config**

Create `app.config.js` (merges `app.json` and adds the native Google Maps key so `PROVIDER_GOOGLE` renders on a native build):
```javascript
// Injects the restricted iOS Google Maps SDK key into native config at build time.
// Without ios.config.googleMapsApiKey, react-native-maps with PROVIDER_GOOGLE renders blank.
module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    config: {
      ...(config.ios && config.ios.config),
      googleMapsApiKey: process.env.EXPO_PUBLIC_MAPS_SDK_KEY,
    },
  },
});
```

- [ ] **Step 5: Wire the auth gate into the index route**

Replace `app/index.tsx` with the real gate (now that the client exists):
```typescript
import { Redirect } from "expo-router";
import { useSession } from "../src/lib/supabase";

export default function Index() {
  const { session, loading } = useSession();
  if (loading) return null;
  return <Redirect href={session ? "/map" : "/sign-in"} />;
}
```

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no type errors (the `/sign-in` and `/map` routes are added in later tasks, a missing-route warning at runtime is acceptable here).
```bash
git add src/lib/supabase.ts app.config.js app/index.tsx && git commit -m "feat: supabase client with asyncstorage, session hook, ios maps key config"
```

---

## Task 3: Postgres schema and Row Level Security (one task, with leak tests)

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `supabase/migrations/0002_rls.sql`, `supabase/tests/rls.test.ts`
- Note: schema and RLS land together so no un-protected state is ever committed as done (per `docs/SETUP.md`).

- [ ] **Step 1: Initialise Supabase locally**

Run:
```bash
npx supabase init
npx supabase start
```
Expected: prints local API URL, anon key, and service_role key. Put the URL and anon key into `.env.local` from Task 2.

- [ ] **Step 2: Write the schema migration (places holds only place_id, no Google content)**

Create `supabase/migrations/0001_init.sql`:
```sql
-- hungr v1 schema. Stores only place_id plus first party data. No Google content here.
-- Google name, lat, lng, rating are fetched live through the proxy and never persisted.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  suppressed_cuisines text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table cuisines (
  id serial primary key,
  name text unique not null
);

-- places holds ONLY the durable Google place_id. It is a join anchor for first party rows.
create table places (
  place_id text primary key,
  created_at timestamptz not null default now()
);

-- first party cuisine tags, the refinement layer over Google's coarse place type.
create table place_cuisines (
  place_id text references places(place_id) on delete cascade,
  cuisine_id int references cuisines(id) on delete cascade,
  primary key (place_id, cuisine_id)
);

create type place_state as enum ('go', 'been', 'avoid');

create table user_places (
  user_id uuid references auth.users(id) on delete cascade,
  place_id text references places(place_id) on delete cascade,
  state place_state not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  place_id text references places(place_id) on delete cascade,
  body text not null,
  rating int check (rating between 1 and 5),
  cuisine_id int references cuisines(id),
  created_at timestamptz not null default now()
);

create table place_tags (
  id uuid primary key default gen_random_uuid(),
  place_id text references places(place_id) on delete cascade,
  tag text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- per user rate limiting for the Places proxy. Written server side only (security definer).
create table rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  count int not null default 0
);

-- Fixed one minute window. Returns true if the call is allowed, false if over the cap.
create or replace function bump_rate_limit(uid uuid, max_per_min int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  cur rate_limits%rowtype;
begin
  insert into rate_limits (user_id, window_start, count)
  values (uid, now(), 1)
  on conflict (user_id) do update
    set count = case when now() - rate_limits.window_start > interval '1 minute' then 1 else rate_limits.count + 1 end,
        window_start = case when now() - rate_limits.window_start > interval '1 minute' then now() else rate_limits.window_start end
  returning * into cur;
  return cur.count <= max_per_min;
end;
$$;

-- seed the coarse v1 cuisines that map cleanly from Google place types.
insert into cuisines (name) values
  ('Chinese'), ('Korean'), ('Japanese'), ('Thai'), ('Vietnamese'), ('Indian');
```

- [ ] **Step 3: Write the failing RLS test (multiple cases)**

Create `supabase/tests/rls.test.ts` (Deno, run with the local stack up):
```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

async function makeUser(email: string) {
  const c = createClient(URL, ANON);
  await c.auth.signUp({ email, password: "test-pass-123" });
  const { data } = await c.auth.signInWithPassword({ email, password: "test-pass-123" });
  return { client: c, uid: data.user!.id };
}

Deno.test("user_places is isolated for read and write", async () => {
  const a = await makeUser(`a_${crypto.randomUUID()}@t.dev`);
  const b = await makeUser(`b_${crypto.randomUUID()}@t.dev`);

  // a seeds a place anchor and its own state. The anchor is insert-or-ignore:
  // places is immutable (place_id only), so on conflict do nothing (no UPDATE needed).
  await a.client.from("places").upsert({ place_id: "p1" }, { onConflict: "place_id", ignoreDuplicates: true });
  const ins = await a.client.from("user_places").upsert({ user_id: a.uid, place_id: "p1", state: "go" });
  if (ins.error) throw new Error("a should be able to write its own user_places: " + ins.error.message);

  // b must not READ a's row
  const read = await b.client.from("user_places").select("*").eq("place_id", "p1");
  if (read.data && read.data.length > 0) throw new Error("RLS leak: b read a's user_places");

  // b must not WRITE a row owned by a
  const write = await b.client.from("user_places").upsert({ user_id: a.uid, place_id: "p1", state: "avoid" });
  if (!write.error) throw new Error("RLS leak: b wrote a's user_places");
});

Deno.test("profiles are private to their owner", async () => {
  const a = await makeUser(`pa_${crypto.randomUUID()}@t.dev`);
  const b = await makeUser(`pb_${crypto.randomUUID()}@t.dev`);
  // Create a's own profile here so this test does not depend on the signup trigger
  // (that trigger is added in a later task). This test only proves RLS isolation.
  const created = await a.client.from("profiles").upsert({ id: a.uid, display_name: "A" });
  if (created.error) throw new Error("a should be able to write its own profile: " + created.error.message);
  const mine = await a.client.from("profiles").select("*").eq("id", a.uid);
  if (!mine.data || mine.data.length !== 1) throw new Error("a should read its own profile");
  const theirs = await b.client.from("profiles").select("*").eq("id", a.uid);
  if (theirs.data && theirs.data.length > 0) throw new Error("RLS leak: b read a's profile");
});

Deno.test("reviews cannot be written as another user", async () => {
  const a = await makeUser(`ra_${crypto.randomUUID()}@t.dev`);
  const b = await makeUser(`rb_${crypto.randomUUID()}@t.dev`);
  await a.client.from("places").upsert({ place_id: "p2" }, { onConflict: "place_id", ignoreDuplicates: true });
  const forged = await b.client.from("reviews").insert({ user_id: a.uid, place_id: "p2", body: "x", rating: 5 });
  if (!forged.error) throw new Error("RLS leak: b forged a review as a");
});

Deno.test("places and cuisines are publicly readable", async () => {
  const a = await makeUser(`ca_${crypto.randomUUID()}@t.dev`);
  const cuisines = await a.client.from("cuisines").select("*");
  if (!cuisines.data || cuisines.data.length < 6) throw new Error("cuisines should be public read");
});
```

- [ ] **Step 4: Apply the schema and run the test to verify it fails**

Run:
```bash
npx supabase migration up
SUPABASE_URL=http://localhost:54321 SUPABASE_ANON_KEY=<anon> \
  deno test --allow-net --allow-env supabase/tests/rls.test.ts
```
Expected: FAIL, because RLS is not enabled yet so b can read and write a's rows.

- [ ] **Step 5: Write the RLS migration**

Create `supabase/migrations/0002_rls.sql`:
```sql
alter table profiles enable row level security;
alter table places enable row level security;
alter table cuisines enable row level security;
alter table place_cuisines enable row level security;
alter table user_places enable row level security;
alter table reviews enable row level security;
alter table place_tags enable row level security;
alter table rate_limits enable row level security;
-- rate_limits gets no policies, so it is default deny to all clients. Only the
-- security-definer bump_rate_limit function (called server side) touches it.

-- public read: places, cuisines, place_cuisines, reviews, place_tags
create policy "public read places" on places for select using (true);
create policy "public read cuisines" on cuisines for select using (true);
create policy "public read place_cuisines" on place_cuisines for select using (true);
create policy "public read reviews" on reviews for select using (true);
create policy "public read place_tags" on place_tags for select using (true);

-- any authenticated user may anchor a place_id (place_id only, no Google content)
create policy "auth upsert places" on places for insert with check (auth.role() = 'authenticated');

-- profiles: a user reads and writes only their own
create policy "own profile read" on profiles for select using (auth.uid() = id);
create policy "own profile write" on profiles for insert with check (auth.uid() = id);
create policy "own profile update" on profiles for update using (auth.uid() = id);

-- user_places: a user reads and writes only their own rows
create policy "own user_places" on user_places
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- reviews and tags: write only as yourself
create policy "own reviews write" on reviews for insert with check (auth.uid() = user_id);
create policy "own reviews update" on reviews for update using (auth.uid() = user_id);
create policy "own tags write" on place_tags for insert with check (auth.uid() = created_by);

-- Table privileges. RLS decides WHICH rows; these GRANTs decide table-level access.
-- Supabase local does not auto-grant DML to anon/authenticated, so we grant explicitly.
-- rate_limits intentionally gets no grant: only the security-definer function touches it.
grant usage on schema public to anon, authenticated;

-- public read tables: readable by everyone (anon and signed in)
grant select on places, cuisines, place_cuisines, reviews, place_tags to anon, authenticated;

-- writes are for signed in users only; the policies above restrict to their own rows
grant insert on places to authenticated;
grant select, insert, update on profiles to authenticated;
grant select, insert, update, delete on user_places to authenticated;
grant insert, update on reviews to authenticated;
grant insert on place_tags to authenticated;
```

- [ ] **Step 6: Apply and run the test to verify it passes**

Run: `npx supabase migration up` then re-run the deno test from Step 4.
Expected: PASS (all four tests green).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0001_init.sql supabase/migrations/0002_rls.sql supabase/tests/rls.test.ts
git commit -m "feat: schema (place_id only) plus RLS default deny with isolation leak tests"
```

---

## Task 4: Auth screen (email magic link plus Google OAuth)

**Files:**
- Create: `app/sign-in.tsx`, `tests/components/SignIn.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/SignIn.test.tsx`:
```typescript
import { render, screen, fireEvent } from "@testing-library/react-native";
import SignIn from "../../app/sign-in";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: { auth: { signInWithOtp: jest.fn().mockResolvedValue({ error: null }) } },
}));

test("submitting an email requests a magic link", async () => {
  await render(<SignIn />);
  await fireEvent.changeText(screen.getByPlaceholderText("you@email.com"), "test@hungr.app");
  await fireEvent.press(screen.getByText("Email me a link"));
  expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({ email: "test@hungr.app" });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- SignIn`
Expected: FAIL (module `app/sign-in` not found).

- [ ] **Step 3: Write the screen with a real OAuth deep-link flow**

Create `app/sign-in.tsx`:
```typescript
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { supabase } from "../src/lib/supabase";
import { colors, radius, space } from "../src/theme";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function emailLink() {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (!error) setSent(true);
  }

  // Expo OAuth: open the provider URL in a browser session, then set the session from
  // the returned redirect. signInWithOAuth alone does not complete auth on native.
  async function google() {
    const redirectTo = makeRedirectUri({ scheme: "hungr" });
    const { data } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (!data?.url) return;
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success") return;
    const fragment = result.url.split("#")[1] ?? "";
    const params = new URLSearchParams(fragment);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token });
    }
  }

  return (
    <View style={s.wrap}>
      <Text style={s.brand}>hungr</Text>
      <Text style={s.tag}>Find food worth the trip.</Text>
      <TextInput
        style={s.input}
        placeholder="you@email.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholderTextColor={colors.muted}
      />
      <Pressable style={s.primary} onPress={emailLink}>
        <Text style={s.primaryTxt}>{sent ? "Check your inbox" : "Email me a link"}</Text>
      </Pressable>
      <Pressable style={s.ghost} onPress={google}>
        <Text style={s.ghostTxt}>Continue with Google</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", padding: space.xl, backgroundColor: colors.canvas, gap: space.md },
  brand: { fontSize: 44, color: colors.ink },
  tag: { fontSize: 16, color: colors.muted, marginBottom: space.lg },
  input: { backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, padding: space.md, color: colors.ink, minHeight: 48 },
  primary: { backgroundColor: colors.accent, borderRadius: radius.md, padding: space.md, alignItems: "center", minHeight: 48 },
  primaryTxt: { color: colors.onAccent, fontWeight: "600" },
  ghost: { borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, padding: space.md, alignItems: "center", minHeight: 48 },
  ghostTxt: { color: colors.ink, fontWeight: "600" },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- SignIn`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/sign-in.tsx tests/components/SignIn.test.tsx
git commit -m "feat: sign-in screen, email magic link and Google OAuth deep link"
```

---

## Task 5: Auto create profile on signup (trigger)

**Files:**
- Create: `supabase/migrations/0003_profile_trigger.sql`

- [ ] **Step 1: Write the trigger migration**

Create `supabase/migrations/0003_profile_trigger.sql`:
```sql
-- Every new auth user gets a profile row so RLS-protected reads have a home.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

- [ ] **Step 2: Apply and verify**

Run: `npx supabase migration up`
Then sign up a user (via the app or `supabase.auth.signUp`) and confirm a matching `profiles` row exists.
Expected: one profile row per new user. Re-running the Task 3 profile test still passes.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_profile_trigger.sql
git commit -m "feat: auto create profile row on signup"
```

---

## Task 6: Cuisine suppression rule (pure function, TDD)

**Files:**
- Create: `src/domain/types.ts`, `src/domain/suppression.ts`, `tests/domain/suppression.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/domain/suppression.test.ts`:
```typescript
import { isSuppressed } from "../../src/domain/suppression";

test("hidden only when ALL cuisines are suppressed", () => {
  // multi cuisine place stays visible if at least one cuisine is not suppressed
  expect(isSuppressed(["Chinese", "Thai"], ["Thai"])).toBe(false);
  // place hidden only when every tag is suppressed
  expect(isSuppressed(["Thai"], ["Thai"])).toBe(true);
  expect(isSuppressed(["Thai", "Indian"], ["Thai", "Indian"])).toBe(true);
  // no suppression, or no cuisines, never hidden
  expect(isSuppressed(["Thai"], [])).toBe(false);
  expect(isSuppressed([], ["Thai"])).toBe(false);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- suppression`
Expected: FAIL with "Cannot find module '../../src/domain/suppression'".

- [ ] **Step 3: Write the types and the rule**

Create `src/domain/types.ts`:
```typescript
export type PlaceState = "go" | "been" | "avoid";

export type Place = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  rating?: number;       // live from Google, never persisted
  cuisines: string[];    // coarse from Google place type, refined by first party tags
  state?: PlaceState;     // first party, from user_places
};
```

Create `src/domain/suppression.ts`:
```typescript
// A place is hidden only when every one of its cuisines is in the suppressed list.
// Suppressing "Thai" never hides a place that is also "Chinese".
export function isSuppressed(placeCuisines: string[], suppressed: string[]): boolean {
  if (placeCuisines.length === 0 || suppressed.length === 0) return false;
  const blocked = new Set(suppressed);
  return placeCuisines.every((c) => blocked.has(c));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- suppression`
Expected: PASS (5 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/domain/types.ts src/domain/suppression.ts tests/domain/suppression.test.ts
git commit -m "feat: cuisine suppression rule, hide only when all cuisines suppressed"
```

---

## Task 7: Edge Function places-proxy (never persists, derives cuisine, rate limited)

**Files:**
- Create: `supabase/functions/places-proxy/index.ts`, `supabase/functions/places-proxy/index.test.ts`

- [ ] **Step 1: Write the failing test (contract: display-safe fields plus a coarse cuisine, no review text)**

Create `supabase/functions/places-proxy/index.test.ts`:
```typescript
import { shapePlace } from "./index.ts";

Deno.test("shapePlace keeps display-safe fields, derives a coarse cuisine, drops review text", () => {
  const raw = {
    id: "p1",
    displayName: { text: "Spicy World" },
    location: { latitude: -33.8, longitude: 151.2 },
    rating: 4.6,
    primaryType: "chinese_restaurant",
    types: ["chinese_restaurant", "restaurant"],
    reviews: [{ text: { text: "secret review body" } }],
    attributions: ["Listing by Google"],
  };
  const out = shapePlace(raw);
  if (out.placeId !== "p1") throw new Error("placeId missing");
  if (out.rating !== 4.6) throw new Error("rating missing");
  if (!out.cuisines.includes("Chinese")) throw new Error("coarse cuisine must be derived from place type");
  if (!out.attribution) throw new Error("attribution must be present");
  if (JSON.stringify(out).includes("secret review body")) {
    throw new Error("review text must never leave the proxy");
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `deno test --allow-net --allow-env supabase/functions/places-proxy/index.test.ts` (the flags are needed: the module imports from esm.sh and reads Deno.env at load)
Expected: FAIL with "Module not found ./index.ts" or "shapePlace is not exported".

- [ ] **Step 3: Write the Edge Function**

Create `supabase/functions/places-proxy/index.ts`:
```typescript
// Server side only. Holds GOOGLE_PLACES_KEY. Fetches Google Places live and returns
// only display-safe fields plus a coarse cuisine derived from the Google place type.
// NEVER returns or stores review text. Per-user rate limited and auth gated.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const KEY = Deno.env.get("GOOGLE_PLACES_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE")!;
const MAX_PER_MIN = 60;

// Google place types are coarse. Map the ones we support to a v1 cuisine label.
const TYPE_TO_CUISINE: Record<string, string> = {
  chinese_restaurant: "Chinese",
  korean_restaurant: "Korean",
  japanese_restaurant: "Japanese",
  sushi_restaurant: "Japanese",
  ramen_restaurant: "Japanese",
  thai_restaurant: "Thai",
  vietnamese_restaurant: "Vietnamese",
  indian_restaurant: "Indian",
};

type SafePlace = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  rating?: number;
  cuisines: string[];
  attribution: string;
};

export function shapePlace(raw: any): SafePlace {
  const types: string[] = [raw.primaryType, ...(raw.types ?? [])].filter(Boolean);
  const cuisines = Array.from(
    new Set(types.map((t) => TYPE_TO_CUISINE[t]).filter(Boolean) as string[]),
  );
  return {
    placeId: raw.id,
    name: raw.displayName?.text ?? "",
    lat: raw.location?.latitude,
    lng: raw.location?.longitude,
    rating: raw.rating,
    cuisines,
    attribution: (raw.attributions && raw.attributions[0]) || "Listing by Google",
  };
}

export default async function handler(req: Request): Promise<Response> {
  // 1. Authenticate the caller from the forwarded bearer token.
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "");
  const anon = createClient(SUPABASE_URL, ANON);
  const { data: userData } = await anon.auth.getUser(jwt);
  if (!userData?.user) return new Response("Unauthorized", { status: 401 });

  // 2. Per-user rate limit (durable, server side).
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: allowed } = await admin.rpc("bump_rate_limit", {
    uid: userData.user.id,
    max_per_min: MAX_PER_MIN,
  });
  if (allowed === false) return new Response("Rate limited", { status: 429 });

  // 3. Fetch Google Places live, asking only for fields we are allowed to display.
  const { lat, lng, query } = await req.json();
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": KEY,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.location,places.rating,places.primaryType,places.types,places.attributions",
    },
    body: JSON.stringify({
      textQuery: query ?? "food",
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 1500 } },
    }),
  });
  const data = await res.json();
  const places = (data.places ?? []).map(shapePlace);
  return new Response(JSON.stringify({ places }), {
    headers: { "Content-Type": "application/json" },
  });
}

if (import.meta.main) Deno.serve(handler);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `deno test --allow-net --allow-env supabase/functions/places-proxy/index.test.ts` (the flags are needed: the module imports from esm.sh and reads Deno.env at load)
Expected: PASS (the `import.meta.main` guard means importing the module does not start a server).

- [ ] **Step 5: Serve locally and smoke test**

Run:
```bash
npx supabase functions serve places-proxy --env-file supabase/.env.local
# With a valid user JWT in $JWT:
curl -s localhost:54321/functions/v1/places-proxy \
  -H "Content-Type: application/json" -H "Authorization: Bearer $JWT" \
  -d '{"lat":-33.8,"lng":151.2,"query":"ramen"}'
```
Expected: JSON with a `places` array of safe fields including a coarse `cuisines` array, no review text.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/places-proxy
git commit -m "feat: places-proxy, display-safe fields plus coarse cuisine, auth gated and rate limited"
```

---

## Task 8: Edge Function grounding (Gemini, server side)

**Files:**
- Create: `supabase/functions/grounding/index.ts`, `supabase/functions/grounding/index.test.ts`

- [ ] **Step 1: Write the failing test (contract: passes through Google source links)**

Create `supabase/functions/grounding/index.test.ts`:
```typescript
import { shapeGrounded } from "./index.ts";

Deno.test("shapeGrounded keeps the answer and required source links", () => {
  const raw = {
    candidates: [{ content: { parts: [{ text: "Known for mapo tofu." }] } }],
    groundingMetadata: { sourceLinks: ["https://maps.google.com/?cid=1"] },
  };
  const out = shapeGrounded(raw);
  if (!out.text.includes("mapo tofu")) throw new Error("answer missing");
  if (out.sources.length !== 1) throw new Error("source links are required and must pass through");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `deno test --allow-net --allow-env supabase/functions/grounding/index.test.ts` (`--allow-env` is needed: the module reads Deno.env at load; `--allow-net` is harmless)
Expected: FAIL (module or export missing).

- [ ] **Step 3: Write the Edge Function**

Create `supabase/functions/grounding/index.ts`:
```typescript
// Server side only. Holds GEMINI_KEY. The ONLY sanctioned way to use AI over Google Maps
// data. Returns the grounded answer plus the required Google source links. Output is
// shown in its own block in the UI, never interspersed with community content.
const KEY = Deno.env.get("GEMINI_KEY")!;

export function shapeGrounded(raw: any): { text: string; sources: string[] } {
  const text = raw.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const sources = raw.groundingMetadata?.sourceLinks ?? [];
  return { text, sources };
}

export default async function handler(req: Request): Promise<Response> {
  const { placeQuery } = await req.json();
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `What is ${placeQuery} known for?` }] }],
        tools: [{ googleMaps: {} }],
      }),
    },
  );
  const data = await res.json();
  return new Response(JSON.stringify(shapeGrounded(data)), {
    headers: { "Content-Type": "application/json" },
  });
}

if (import.meta.main) Deno.serve(handler);
```
Note: confirm the exact Grounding request shape against the current Gemini docs during the SETUP.md pre-scale legal check (the tool key may be `googleMaps` or via Maps Grounding Lite). The `shapeGrounded` contract and the source-link passthrough do not change.

- [ ] **Step 4: Run the test to verify it passes**

Run: `deno test --allow-net --allow-env supabase/functions/grounding/index.test.ts` (`--allow-env` is needed: the module reads Deno.env at load; `--allow-net` is harmless)
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/grounding
git commit -m "feat: grounding edge function, the only AI-over-Google path, keeps source links"
```

---

## Task 9: Places API client wrapper and filter store

**Files:**
- Create: `src/api/places.ts`, `src/store/useFilters.ts`, `tests/api/places.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/places.test.ts`:
```typescript
import { applyFilters, searchNearby } from "../../src/api/places";
import type { Place } from "../../src/domain/types";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

const places: Place[] = [
  { placeId: "a", name: "Chinese A", lat: 0, lng: 0, cuisines: ["Chinese"] },
  { placeId: "b", name: "Indian B", lat: 0, lng: 0, cuisines: ["Indian"] },
  { placeId: "c", name: "Mixed C", lat: 0, lng: 0, cuisines: ["Indian", "Chinese"] },
];

test("applyFilters hides places whose every cuisine is suppressed", () => {
  const out = applyFilters(places, { suppressed: ["Indian"], selected: [] });
  expect(out.map((p) => p.placeId)).toEqual(["a", "c"]); // b hidden, c stays (also Chinese)
});

test("applyFilters with a selected cuisine keeps only matching places", () => {
  const out = applyFilters(places, { suppressed: [], selected: ["Chinese"] });
  expect(out.map((p) => p.placeId)).toEqual(["a", "c"]);
});

test("searchNearby carries the coarse cuisine returned by the proxy", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: { places: [{ placeId: "x", name: "X", lat: 1, lng: 2, rating: 4.5, cuisines: ["Thai"] }] },
    error: null,
  });
  const out = await searchNearby(1, 2, "food");
  expect(out[0].cuisines).toEqual(["Thai"]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- places`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the filter store and the api wrapper**

Create `src/store/useFilters.ts`:
```typescript
import { create } from "zustand";

type FilterState = {
  selected: string[];      // cuisines the user is filtering to (empty = all)
  suppressed: string[];    // cuisines to hide (the avoid list)
  toggleSelected: (c: string) => void;
  toggleSuppressed: (c: string) => void;
};

export const useFilters = create<FilterState>((set) => ({
  selected: [],
  suppressed: [],
  toggleSelected: (c) =>
    set((s) => ({ selected: s.selected.includes(c) ? s.selected.filter((x) => x !== c) : [...s.selected, c] })),
  toggleSuppressed: (c) =>
    set((s) => ({ suppressed: s.suppressed.includes(c) ? s.suppressed.filter((x) => x !== c) : [...s.suppressed, c] })),
}));
```

Create `src/api/places.ts`:
```typescript
import { supabase } from "../lib/supabase";
import { isSuppressed } from "../domain/suppression";
import type { Place } from "../domain/types";

export function applyFilters(
  places: Place[],
  f: { selected: string[]; suppressed: string[] },
): Place[] {
  return places.filter((p) => {
    if (isSuppressed(p.cuisines, f.suppressed)) return false;
    if (f.selected.length > 0 && !p.cuisines.some((c) => f.selected.includes(c))) return false;
    return true;
  });
}

// Calls the places-proxy Edge Function. Cuisines are the coarse labels Google place
// types supply. They are refined with first party tags by withFirstPartyCuisines.
export async function searchNearby(lat: number, lng: number, query: string): Promise<Place[]> {
  const { data, error } = await supabase.functions.invoke("places-proxy", {
    body: { lat, lng, query },
  });
  if (error) throw error;
  return (data.places ?? []).map((p: any) => ({
    placeId: p.placeId,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    rating: p.rating,
    cuisines: p.cuisines ?? [],
  }));
}

// Union our first party place_cuisines tags onto the coarse Google cuisines.
// This is the refinement layer: a place tagged "Sichuan" by the community in v2
// gains that tag on top of Google's coarse "Chinese".
export async function withFirstPartyCuisines(places: Place[]): Promise<Place[]> {
  if (places.length === 0) return places;
  const ids = places.map((p) => p.placeId);
  const { data } = await supabase
    .from("place_cuisines")
    .select("place_id, cuisines(name)")
    .in("place_id", ids);
  if (!data) return places;
  const byPlace = new Map<string, Set<string>>();
  for (const row of data as any[]) {
    const set = byPlace.get(row.place_id) ?? new Set<string>();
    if (row.cuisines?.name) set.add(row.cuisines.name);
    byPlace.set(row.place_id, set);
  }
  return places.map((p) => {
    const extra = byPlace.get(p.placeId);
    if (!extra) return p;
    return { ...p, cuisines: Array.from(new Set([...p.cuisines, ...extra])) };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- places`
Expected: PASS (three tests).

- [ ] **Step 5: Commit**

```bash
git add src/api/places.ts src/store/useFilters.ts tests/api/places.test.ts
git commit -m "feat: places api wrapper (coarse cuisine plus first party refine) and filter store"
```

---

## Task 10: Search bar, debounce hook, and cuisine filter

**Files:**
- Create: `src/hooks/useDebouncedValue.ts`, `tests/hooks/useDebouncedValue.test.ts`, `src/components/SearchBar.tsx`, `src/components/CuisineFilter.tsx`, `tests/components/CuisineFilter.test.tsx`

- [ ] **Step 1: Write the failing test for the debounce hook**

Create `tests/hooks/useDebouncedValue.test.ts`:
```typescript
import { renderHook, act } from "@testing-library/react-native";
import { useDebouncedValue } from "../../src/hooks/useDebouncedValue";

jest.useFakeTimers();

test("debounced value updates only after the delay", async () => {
  const r = await renderHook(({ v }: { v: string }) => useDebouncedValue(v, 300), {
    initialProps: { v: "a" },
  });
  expect(r.result.current).toBe("a");
  await r.rerender({ v: "ab" });
  expect(r.result.current).toBe("a"); // not yet
  await act(async () => { jest.advanceTimersByTime(300); });
  expect(r.result.current).toBe("ab"); // now
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- useDebouncedValue`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the debounce hook**

Create `src/hooks/useDebouncedValue.ts`:
```typescript
import { useEffect, useState } from "react";

// Returns value, but only after it has stopped changing for `delay` ms.
// Used to avoid a Places proxy call on every keystroke (cost control, per docs/SETUP.md).
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- useDebouncedValue`
Expected: PASS.

- [ ] **Step 5: Write the failing test for the cuisine filter**

Create `tests/components/CuisineFilter.test.tsx`:
```typescript
import { render, screen, fireEvent } from "@testing-library/react-native";
import { CuisineFilter } from "../../src/components/CuisineFilter";
import { useFilters } from "../../src/store/useFilters";

test("long pressing a cuisine chip moves it to the avoid list", async () => {
  await render(<CuisineFilter cuisines={["Indian", "Chinese"]} />);
  await fireEvent(screen.getByText("Indian"), "onLongPress");
  expect(useFilters.getState().suppressed).toContain("Indian");
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm test -- CuisineFilter`
Expected: FAIL (module not found).

- [ ] **Step 7: Write the components**

Create `src/components/SearchBar.tsx`:
```typescript
import { View, TextInput, Pressable, Text, StyleSheet } from "react-native";
import { colors, radius, space } from "../theme";

export function SearchBar({
  value, onChange, onPreferences,
}: { value: string; onChange: (t: string) => void; onPreferences: () => void }) {
  return (
    <View style={s.bar}>
      <Text style={s.icon}>{"⌕"}</Text>
      <TextInput
        style={s.input}
        placeholder='Food near me, or "reviewed by Jenny"'
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={onChange}
      />
      <Pressable onPress={onPreferences} accessibilityLabel="Taste preferences">
        <Text style={s.note}>{"✎"}</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: colors.surface,
    borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: 48 },
  icon: { color: colors.muted, fontSize: 18 },
  input: { flex: 1, color: colors.ink, paddingVertical: space.md },
  note: { color: colors.muted, fontSize: 18, padding: space.xs },
});
```

Create `src/components/CuisineFilter.tsx`:
```typescript
import { ScrollView, Pressable, Text, StyleSheet } from "react-native";
import { colors, radius, space } from "../theme";
import { useFilters } from "../store/useFilters";

export function CuisineFilter({ cuisines }: { cuisines: string[] }) {
  const { selected, suppressed, toggleSelected, toggleSuppressed } = useFilters();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
      {cuisines.map((c) => {
        const isOn = selected.includes(c);
        const isOff = suppressed.includes(c);
        return (
          <Pressable
            key={c}
            onPress={() => toggleSelected(c)}
            onLongPress={() => toggleSuppressed(c)}
            style={[s.chip, isOn && s.on, isOff && s.off]}
          >
            <Text style={[s.txt, isOn && s.onTxt, isOff && s.offTxt]}>
              {isOff ? `Avoid: ${c}` : c}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  row: { gap: space.sm, paddingVertical: space.sm },
  chip: { borderColor: colors.hair, borderWidth: 1, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.sm },
  on: { backgroundColor: colors.accent, borderColor: colors.accent },
  off: { borderColor: colors.avoid },
  txt: { color: colors.ink, fontSize: 13, fontWeight: "500" },
  onTxt: { color: colors.onAccent },
  offTxt: { color: colors.avoid },
});
```

- [ ] **Step 8: Run the cuisine filter test to verify it passes**

Run: `npm test -- CuisineFilter`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useDebouncedValue.ts tests/hooks/useDebouncedValue.test.ts \
  src/components/SearchBar.tsx src/components/CuisineFilter.tsx tests/components/CuisineFilter.test.tsx
git commit -m "feat: search bar, debounce hook, cuisine filter (tap to select, long press to avoid)"
```

---

## Task 11: Map screen, pins, and place sheet (the core)

**Files:**
- Create: `src/components/MapCanvas.native.tsx`, `src/components/MapCanvas.web.tsx`, `src/components/MapCanvas.d.ts`, `src/components/PlacePin.tsx`, `src/components/PlaceSheet.tsx`, `app/map.tsx`, `tests/components/PlaceSheet.test.tsx`

- [ ] **Step 1: Write the failing test for the place sheet state action**

Create `tests/components/PlaceSheet.test.tsx`:
```typescript
import { render, screen, fireEvent } from "@testing-library/react-native";
import { PlaceSheet } from "../../src/components/PlaceSheet";

test("tapping Want to go calls onSetState with go", async () => {
  const onSetState = jest.fn();
  const place = { placeId: "p1", name: "Spicy World", lat: 0, lng: 0, rating: 4.6, cuisines: ["Chinese"] };
  await render(<PlaceSheet place={place} onSetState={onSetState} />);
  await fireEvent.press(screen.getByText("Want to go"));
  expect(onSetState).toHaveBeenCalledWith("p1", "go");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- PlaceSheet`
Expected: FAIL (module not found).

- [ ] **Step 3: Install maps and write the pin and sheet**

Run: `npx expo install react-native-maps expo-location`

Create `src/components/PlacePin.tsx`:
```typescript
import { View, Text, StyleSheet } from "react-native";
import { colors, radius } from "../theme";
import type { PlaceState } from "../domain/types";

const stateColor: Record<PlaceState, string> = {
  go: colors.accent, been: colors.been, avoid: colors.avoid,
};
export function PlacePin({ state, label }: { state?: PlaceState; label: string }) {
  const bg = state ? stateColor[state] : colors.muted;
  return (
    <View style={[s.pin, { backgroundColor: bg }]}>
      <Text style={[s.txt, state === "go" || !state ? { color: colors.onAccent } : { color: "#fff" }]}>{label}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  pin: { minWidth: 34, height: 28, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  txt: { fontSize: 12, fontWeight: "700" },
});
```

Create `src/components/PlaceSheet.tsx`:
```typescript
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, radius, space } from "../theme";
import type { Place, PlaceState } from "../domain/types";

export function PlaceSheet({
  place, onSetState,
}: { place: Place; onSetState: (placeId: string, state: PlaceState) => void }) {
  return (
    <View style={s.sheet}>
      <View style={s.grab} />
      <View style={s.row}>
        <Text style={s.name}>{place.name}</Text>
        {place.rating !== undefined && <Text style={s.rate}>{"★"} {place.rating}</Text>}
      </View>
      <Text style={s.meta}>{place.cuisines.join(" · ")}</Text>
      <View style={s.actions}>
        <Pressable style={[s.btn, s.primary]} onPress={() => onSetState(place.placeId, "go")}>
          <Text style={s.primaryTxt}>Want to go</Text>
        </Pressable>
        <Pressable style={s.btn} onPress={() => onSetState(place.placeId, "been")}>
          <Text style={s.btnTxt}>Been</Text>
        </Pressable>
        <Pressable style={s.btn} onPress={() => onSetState(place.placeId, "avoid")}>
          <Text style={s.btnTxt}>Avoid</Text>
        </Pressable>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  sheet: { position: "absolute", left: space.sm, right: space.sm, bottom: space.sm, backgroundColor: colors.surface,
    borderColor: colors.hair, borderWidth: 1, borderRadius: radius.lg, padding: space.md },
  grab: { width: 34, height: 4, borderRadius: 99, backgroundColor: colors.hair, alignSelf: "center", marginBottom: space.sm },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 18, color: colors.ink, fontWeight: "700" },
  rate: { color: colors.accentPress, fontWeight: "600" },
  meta: { color: colors.muted, marginTop: 2 },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  btn: { borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, paddingVertical: space.sm, paddingHorizontal: space.md },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  primaryTxt: { color: colors.onAccent, fontWeight: "600" },
  btnTxt: { color: colors.ink, fontWeight: "600" },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- PlaceSheet`
Expected: PASS.

- [ ] **Step 5: Write the map canvas (native), a web stub, and a shared type declaration**

`MapCanvas` is a platform-split component (`.native.tsx` for iOS, `.web.tsx` for web).
Metro picks the right file at bundle time by extension, but TypeScript (moduleResolution
`bundler`) cannot resolve a bare `./MapCanvas` import to a `.native.tsx` file, so `tsc`
would error. Add a type-only declaration that gives `tsc` the shared signature. Metro
ignores `.d.ts`, so this changes nothing at runtime.

Create `src/components/MapCanvas.d.ts`:
```typescript
import type { ReactElement } from "react";
import type { Place } from "../domain/types";

type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

// Type surface for the platform-split MapCanvas. The real implementations live in
// MapCanvas.native.tsx and MapCanvas.web.tsx. This only exists so tsc can resolve the
// bare import; the bundler selects the platform file.
export declare function MapCanvas(props: {
  region: Region;
  places: Place[];
  onSelect: (p: Place) => void;
}): ReactElement;
```

Create `src/components/MapCanvas.native.tsx`:
```typescript
import MapView, { PROVIDER_GOOGLE, Marker } from "react-native-maps";
import { StyleSheet } from "react-native";
import { PlacePin } from "./PlacePin";
import type { Place } from "../domain/types";

export function MapCanvas({
  region, places, onSelect,
}: {
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  places: Place[];
  onSelect: (p: Place) => void;
}) {
  return (
    <MapView provider={PROVIDER_GOOGLE} style={StyleSheet.absoluteFill} initialRegion={region} showsUserLocation>
      {places.map((p) => (
        <Marker key={p.placeId} coordinate={{ latitude: p.lat, longitude: p.lng }} onPress={() => onSelect(p)}>
          <PlacePin state={p.state} label={p.state === "avoid" ? "✕" : p.rating ? String(p.rating) : "★"} />
        </Marker>
      ))}
    </MapView>
  );
}
```

Create `src/components/MapCanvas.web.tsx` (stub, real Google Maps JS wired in a later web task):
```typescript
import { View, Text } from "react-native";
import { colors } from "../theme";
import type { Place } from "../domain/types";

// Web uses Google Maps JavaScript (react-native-maps does not run on web).
// Stubbed for v1 iOS-first. Implemented in the web map task.
export function MapCanvas(_: { region: any; places: Place[]; onSelect: (p: Place) => void }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }}>
      <Text style={{ color: colors.muted }}>Map on web is wired in the web task.</Text>
    </View>
  );
}
```

- [ ] **Step 6: Write the Map screen with debounced, race-safe search**

Create `app/map.tsx`:
```typescript
import { useEffect, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import * as Location from "expo-location";
import { MapCanvas } from "../src/components/MapCanvas";
import { SearchBar } from "../src/components/SearchBar";
import { CuisineFilter } from "../src/components/CuisineFilter";
import { PlaceSheet } from "../src/components/PlaceSheet";
import { searchNearby, withFirstPartyCuisines, applyFilters } from "../src/api/places";
import { useFilters } from "../src/store/useFilters";
import { useDebouncedValue } from "../src/hooks/useDebouncedValue";
import { supabase } from "../src/lib/supabase";
import { colors, space } from "../src/theme";
import type { Place, PlaceState } from "../src/domain/types";

const CUISINES = ["Chinese", "Korean", "Japanese", "Thai", "Vietnamese", "Indian"];

export default function Map() {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState({ latitude: -33.87, longitude: 151.21, latitudeDelta: 0.05, longitudeDelta: 0.05 });
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place | null>(null);
  const { selected: sel, suppressed } = useFilters();

  // Debounce the query so we do not hit the Places proxy on every keystroke.
  const debouncedQuery = useDebouncedValue(query, 300);
  // Monotonic request id so a slow earlier response cannot overwrite a newer one.
  const reqId = useRef(0);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        setRegion((r) => ({ ...r, latitude: loc.coords.latitude, longitude: loc.coords.longitude }));
      }
      // graceful denial: keep the default Sydney region
    })();
  }, []);

  useEffect(() => {
    const id = ++reqId.current;
    searchNearby(region.latitude, region.longitude, debouncedQuery || "food")
      .then(withFirstPartyCuisines)
      .then((result) => {
        if (id === reqId.current) setPlaces(result); // ignore stale responses
      })
      .catch(() => {
        if (id === reqId.current) setPlaces([]);
      });
  }, [region.latitude, region.longitude, debouncedQuery]);

  async function setState(placeId: string, state: PlaceState) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    // anchor place_id only (no Google content). Insert-or-ignore: places is immutable,
    // so on conflict do nothing, which needs only INSERT privilege.
    await supabase.from("places").upsert({ place_id: placeId }, { onConflict: "place_id", ignoreDuplicates: true });
    await supabase.from("user_places").upsert({ user_id: data.user.id, place_id: placeId, state });
    setPlaces((ps) => ps.map((p) => (p.placeId === placeId ? { ...p, state } : p)));
    setSelected(null);
  }

  const visible = applyFilters(places, { selected: sel, suppressed });

  return (
    <View style={s.wrap}>
      <MapCanvas region={region} places={visible} onSelect={setSelected} />
      <View style={s.top}>
        <SearchBar value={query} onChange={setQuery} onPreferences={() => { /* preferences sheet is deferred, see Remaining work */ }} />
        <CuisineFilter cuisines={CUISINES} />
      </View>
      {selected && <PlaceSheet place={selected} onSetState={setState} />}
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas },
  top: { position: "absolute", top: space.xxl, left: space.sm, right: space.sm, gap: space.xs },
});
```

- [ ] **Step 7: Run all tests, typecheck, and smoke test on iOS**

Run:
```bash
npm test
npx tsc --noEmit
npx expo run:ios
```
Expected: all unit tests pass, no type errors, the app launches in the iOS simulator, asks for location, shows the Google basemap with the search bar and cuisine chips. With the local proxy running and a signed-in user, tapping a pin opens the sheet and setting a state persists to `user_places`. Typing in the search bar issues at most one proxy call per 300 ms pause.

- [ ] **Step 8: Commit**

```bash
git add src/components app/map.tsx tests/components/PlaceSheet.test.tsx
git commit -m "feat: map screen with google basemap, three-state pins, place sheet, debounced race-safe search"
```

---

## Remaining v1 work (out of scope for this plan, captured so it is not lost)
These are real v1 features deferred to follow-on plans to keep this one shippable and testable on its own:
- Web map component (Google Maps JavaScript) to replace the `MapCanvas.web.tsx` stub.
- Preferences bottom sheet wired to the note icon (prioritise and avoid groups, persisted to `profiles.suppressed_cuisines`).
- The AI "Find food near me" popup that drops alive pins, using the grounding function.
- Place detail screen with the three blocks (Google reviews displayed live with attribution, grounded "about this place", community section).
- Friends, Trends, and Account tabs and the bottom tab bar.
- Font loading (Fraunces, Cabinet Grotesk, General Sans) via expo-font.
- Maestro E2E for the sign-in to set-state journey.

## Cuisine granularity roadmap (why v1 is coarse)
- **v1 (this plan):** cuisine comes from Google place types, a coarse set (Chinese, Korean, Japanese, Thai, Vietnamese, Indian), refined by any first party `place_cuisines` tags.
- **v2:** community first party tags add finer cuisines (for example Sichuan, Hunan) on top of the Google coarse type. The `place_cuisines` table and `withFirstPartyCuisines` already support this.
- **v3:** inference to fill gaps where neither Google nor the community has tagged. Candidate signals:
  - assume cuisine from the place name (for example "Sichuan House" implies Sichuan),
  - assume cuisine from dish mentions in first party reviews,
  - place-type heuristics (for example a Singapore hawker centre implies Singaporean),
  - identify home / no-storefront food businesses: places that are clearly not a restaurant or cafe (no premises, residential address, operating from home). Approach to explore: lean on Google place types and the absence of storefront signals, plus first party "this is a home business" tags, since Google will not label these directly. These are the hardest to source and the most differentiated, so they are explicitly a v3 research item.
  All inferred tags are clearly marked as inferred and never derived from Google review text.

## What already exists
Nothing in code (greenfield). This plan reuses the locked decisions in `DESIGN.md`,
`docs/DESIGN.md`, and `docs/SETUP.md` rather than re-deriving them.

## NOT in scope (deferred, with reason)
- Android config: iOS first per `docs/SETUP.md`, Android is a later pass.
- Self-declared identity weighting and social graph: v2 in `docs/DESIGN.md`.
- TTL caching of proxy responses: a cost optimisation, not needed at v1 volume. If added later it must be a server-only cache table with `expires_at`, never the `places` anchor table.
- Persisting any Google content: forbidden by design, never in scope.
