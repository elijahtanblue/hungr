# hungr, Getting Started (for a first timer)

This guide assumes you have never built or run an app before. It walks you through every
account, tool, and key you need, in plain language, with the exact commands to type. Follow
it top to bottom. You do not need to understand the code.

If a word is unfamiliar, check the **Glossary** at the very bottom first.

There are two milestones:
- **Milestone A: run hungr on your own Mac** (see the map, sign in, save places). About 1 to 2
  hours the first time, mostly waiting on downloads.
- **Milestone B: put hungr in front of other people** (TestFlight on iPhone, a web link).
  Do this later, once Milestone A works.

A companion file, `docs/SETUP.md`, is the short technical checklist for the same things. This
file is the friendly long version. The product and the rules behind it live in `docs/DESIGN.md`.

---

## 0. The big picture (read this once)

hungr has three parts. You do not build them, they already exist in this project. You just
need to give each part its keys and turn it on.

1. **The app** (what you see on your phone): a map of food near you. It runs on your Mac in a
   simulator, then later on a real iPhone.
2. **The backend** (Supabase): a database that stores your account and your saved places, plus
   small server programs ("Edge Functions") that talk to Google on the app's behalf.
3. **Google** (Maps, Places, Gemini AI): provides the map picture, the list of nearby
   restaurants, and the AI "what is this place known for" answers.

The golden rule: **secret keys never go inside the app.** Anything secret lives on the backend.
This guide tells you exactly which key goes where, so you do not have to guess.

**What it costs:** Running locally is free. Google charges per use once live, but you will set a
spending limit so you cannot get a surprise bill. The Apple Developer account ($99 per year) is
only needed for Milestone B. Everything else has a free tier that is plenty to start.

---

## 1. Install the tools on your Mac

Think of these as the workshop tools. Install them once. Open the **Terminal** app
(press Cmd+Space, type "Terminal", press Enter) and paste each command, pressing Enter after each.

If you already installed one of these, the command will just say so and move on. That is fine.

### 1a. Xcode (the iPhone simulator and build tools)
Open the **App Store** on your Mac, search **Xcode**, click **Get/Install**. It is large
(several GB) and takes a while. After it installs, open it once so it can finish setup, then run
this in Terminal so the command line can use it:
```
sudo xcodebuild -license accept
```
(It will ask for your Mac password. Typing shows nothing on screen, that is normal.)

### 1b. Homebrew (a tool that installs other tools)
Paste this and follow the prompts:
```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
When it finishes it may print two lines starting with `echo` to "add Homebrew to your PATH". Copy
and run those exact lines. To check it worked:
```
brew --version
```

### 1c. Node.js (runs the app's JavaScript) and Git (version control)
```
brew install node git watchman
```
Check:
```
node --version
git --version
```

### 1d. Docker Desktop (runs the local backend)
```
brew install --cask docker
```
Then open the **Docker** app from your Applications folder once, and wait until its whale icon
in the top menu bar stops animating (that means it is running). You must start Docker every time
before you run the local backend.

### 1e. Deno (runs the backend's small server programs in tests)
```
brew install deno
```

You do not need to install the Expo CLI or the Supabase CLI separately. We run those with `npx`,
which downloads them on demand.

**Checkpoint:** you now have Xcode, Homebrew, Node, Git, Docker, and Deno. That is the whole
workshop.

---

## 2. Get the project onto your Mac

If you already have the `hungr` folder (you are reading this file inside it), skip to step 2b.

### 2a. Download the project
```
cd ~/Desktop
git clone <your hungr repo URL> hungr
cd hungr
```

### 2b. Install the app's building blocks
From inside the `hungr` folder:
```
npm install
```
This reads the project's shopping list and downloads everything into a `node_modules` folder. It
can take a few minutes. If it complains with a long red "ERESOLVE" message, run it again as:
```
npm install --legacy-peer-deps
```

**Checkpoint:** run `npm test`. You should see a few test suites pass. That proves the code on
your machine is healthy before you add any keys.

---

## 3. Milestone A, part 1: run the local backend

The backend runs on your own Mac using Docker. No cloud account needed yet.

1. Make sure **Docker Desktop is running** (whale icon steady in the menu bar).
2. Start the local backend:
   ```
   npx supabase start
   ```
   The first time, this downloads several Docker images and takes a few minutes. When it finishes
   it prints a block of values. **Keep this Terminal window open** and copy two values you will
   need in a moment:
   - `API URL` (it is `http://localhost:54321`)
   - `anon key` (a very long string starting with `eyJ...`)

   It also prints a `service_role key`. That one is secret. Do not put it in the app.

3. Load the database tables and security rules (only needed the first time, or after changes):
   ```
   npx supabase db reset
   ```
   This sets up the tables and confirms the security rules. It is safe to run again, it just
   wipes the local test data.

To stop the backend later: `npx supabase stop`. To see its values again any time:
`npx supabase status`.

---

## 4. Milestone A, part 2: create your Google keys

The map picture and the nearby restaurant data come from Google. You need a Google Cloud account
and two keys. This is the fiddliest part. Go slowly.

> Google's website layout changes over time, so menu names may differ slightly. The goal is
> always: turn on the right "APIs", then create "keys", then restrict them.

### 4a. Create a Google Cloud project
1. Go to https://console.cloud.google.com and sign in with a Google account.
2. At the top, click the project dropdown, then **New Project**. Name it `hungr`. Create it, then
   make sure it is selected in the dropdown.

### 4b. Turn on billing (with a safety limit)
Google requires a billing account even though there is a generous free monthly credit for Maps.
1. In the search bar at the top, type **Billing**, open it, and link or create a billing account
   (you enter a card).
2. Then search for **Budgets & alerts** and create a budget, for example $10 per month, with email
   alerts at 50%, 90%, and 100%. This is your safety net so you cannot get a surprise bill.

### 4c. Turn on the APIs hungr uses
In the top search bar, search and **Enable** each of these (one at a time):
- **Places API (New)** (nearby restaurant search)
- **Maps SDK for iOS** (the map on iPhone)
- **Maps JavaScript API** (the map on the web, for later)
- **Generative Language API** (this is Gemini, the AI "known for" feature)

### 4d. Create the two keys
Go to **APIs & Services**, then **Credentials**, then **Create credentials**, then **API key**.
Do this twice, and rename each one (pencil icon) so you do not mix them up:

1. **hungr maps client key** (this one is safe to ship inside the app)
   - Under **Application restrictions**, choose iOS apps and add the bundle id `app.usehungr`.
   - Under **API restrictions**, restrict it to **Maps SDK for iOS** (and Maps JavaScript API if
     you will do the web later).

2. **hungr server key** (this one is SECRET, it never goes in the app)
   - Under **API restrictions**, restrict it to **Places API (New)** and **Generative Language
     API**.
   - Leave application restrictions as needed for a server (or none for local testing).

Copy both key strings somewhere safe for the next step.

---

## 5. Milestone A, part 3: put the keys in the right places

There are two key files. One is for the app, one is for the backend. Both are private and are
already set to never be uploaded to Git.

### 5a. The app's keys: `.env.local` (in the project root)
This file already exists with placeholder values. Open it (in your code editor) and set:
```
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<paste the anon key from "npx supabase start">
EXPO_PUBLIC_MAPS_SDK_KEY=<paste your "hungr maps client key">
```
The `EXPO_PUBLIC_` prefix means "this is safe to include in the app." Never put a secret key in a
line that starts with `EXPO_PUBLIC_`.

### 5b. The backend's secret keys: `supabase/.env.local`
Create a new file at `supabase/.env.local` (inside the `supabase` folder) with:
```
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<the anon key again>
SUPABASE_SERVICE_ROLE=<the service_role key from "npx supabase start">
GOOGLE_PLACES_KEY=<your "hungr server key">
GEMINI_KEY=<your "hungr server key" again, the same one works>
```
This file holds the secrets. It stays on your machine and is never uploaded.

**Which key goes where, at a glance:**

| Key | Where it goes | Secret? |
|-----|---------------|---------|
| Supabase URL | both files | no |
| Supabase anon key | both files | no (safe to ship) |
| Supabase service_role key | `supabase/.env.local` only | YES |
| Google maps client key | `.env.local` (`EXPO_PUBLIC_MAPS_SDK_KEY`) | no (locked to your app) |
| Google server key (Places + Gemini) | `supabase/.env.local` only | YES |

---

## 6. Milestone A, part 4: run the app

You need two Terminal windows open at the same time, both inside the `hungr` folder.

**Terminal 1, the backend's Google bridge:**
```
npx supabase functions serve --env-file supabase/.env.local
```
Leave it running. This is what safely talks to Google using your secret key.

**Terminal 2, the app:**
```
npx expo run:ios
```
The first time this compiles the app and opens the iPhone Simulator. It takes several minutes.
When it is done, the simulator shows hungr. It will ask for location permission (tap Allow), then
you should see the map with a search bar and cuisine chips.

> Why `run:ios` and not the simpler "Expo Go" app? hungr uses a real Google map, which needs a
> full build. Expo Go (the quick preview app) cannot show the Google map, so always use
> `npx expo run:ios` for hungr.

**Try it:** tap a pin to open the place card, then tap "Want to go". That saves the place to your
account in the local database. You just used the whole stack end to end.

If the map is grey or blank, your `EXPO_PUBLIC_MAPS_SDK_KEY` is missing or wrong, or the Maps SDK
for iOS is not enabled. Recheck step 4c and 5a.

---

## 7. Sign in with Google (optional for local, needed later)

Email sign-in works out of the box locally (the magic-link email shows up at
`http://localhost:54324`, a fake inbox the local backend provides). To enable the "Continue with
Google" button you need a Google OAuth client:

1. In Google Cloud, go to **APIs & Services**, then **OAuth consent screen**, and fill in the
   basics (app name hungr, your email). 
2. Then **Credentials**, **Create credentials**, **OAuth client ID**, type **Web application**.
3. Add the authorized redirect URL that Supabase gives you (see step 8b), and your site
   `https://usehungr.app`.
4. Copy the client ID and secret into Supabase (step 8b).

---

## 8. Milestone B: going live (do this later)

Milestone A runs everything on your Mac. To let other people use hungr, you move the backend to
Supabase's cloud and build a real app. Here is the map of what that involves.

### 8a. Create a Supabase cloud project
1. Go to https://supabase.com, sign up, create a project named `hungr`. Pick a region near your
   users and save the database password.
2. In the project, find **Project Settings**, then **API**. Note the **Project URL**, the
   **anon key**, and the **service_role key** (secret).
3. Push your database tables to the cloud:
   ```
   npx supabase link --project-ref <your project ref>
   npx supabase db push
   ```
4. Deploy the Google bridge functions and give them their secret keys:
   ```
   npx supabase functions deploy places-proxy
   npx supabase functions deploy grounding
   npx supabase secrets set GOOGLE_PLACES_KEY=... GEMINI_KEY=... SUPABASE_SERVICE_ROLE=...
   ```

### 8b. Turn on authentication
In the Supabase dashboard, under **Authentication**:
- Enable **Email** (magic link).
- Enable the **Google** provider and paste the OAuth client ID and secret from step 7.
- Set the **Site URL** to `https://usehungr.app` and add your redirect URLs.

### 8c. Point the app at the cloud
For the real build, set the app's `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
to the cloud project's values (instead of localhost), and set `EXPO_PUBLIC_MAPS_SDK_KEY` as an
EAS build environment variable.

### 8d. Accounts you will need for distribution
- **Apple Developer Program** ($99 per year, https://developer.apple.com): required to put the app
  on a real iPhone via TestFlight and the App Store.
- **Expo account** (free, https://expo.dev): runs the cloud builds.

### 8e. Build for your iPhone (TestFlight)
```
npm install -g eas-cli      # one time
eas login
eas build --platform ios --profile production
```
This builds hungr in the cloud, then you submit it to TestFlight and invite testers by email. The
app's id is `app.usehungr`.

### 8f. The web version
hungr can also run as a website at your domain:
```
npx expo export --platform web
```
Deploy the result to a free host like Vercel or Netlify, then point `usehungr.app` at it.

---

## 9. Your domain: usehungr.app

You own `usehungr.app`. It is used in a few places:
- The app's id is `app.usehungr` (the domain spelled backwards, the standard convention).
- Supabase Auth "Site URL" and the Google sign-in redirects use `https://usehungr.app`.
- The web version is served from `usehungr.app`.
- Later, "universal links" (tapping a hungr link opens the app) use `usehungr.app`.

You configure where the domain points at your domain registrar (where you bought it) once you have
a web host in step 8f.

---

## 10. Everyday commands (cheat sheet)

Run these from inside the `hungr` folder. Start Docker first for anything backend.

| I want to... | Command |
|--------------|---------|
| Start the local backend | `npx supabase start` |
| Reset the local database | `npx supabase db reset` |
| Run the Google bridge | `npx supabase functions serve --env-file supabase/.env.local` |
| Run the app on the simulator | `npx expo run:ios` |
| Run the JavaScript-only preview | `npx expo start` |
| Run the app's tests | `npm test` |
| Run the database security tests | `npx supabase status` then `deno test --allow-net --allow-env supabase/tests/rls.test.ts` |
| Stop the local backend | `npx supabase stop` |

---

## 11. Troubleshooting

- **The map is blank or grey.** The maps client key is missing or wrong, or "Maps SDK for iOS" is
  not enabled in Google Cloud. Recheck steps 4c and 5a, then rerun `npx expo run:ios`.
- **"No nearby places" or search does nothing.** The Google bridge is not running, or the server
  key is wrong, or "Places API (New)" is not enabled. Make sure Terminal 1 (step 6) is running and
  recheck steps 4c and 5b.
- **`npx supabase start` fails.** Docker Desktop is not running. Open the Docker app and wait for
  the whale icon to go steady, then try again.
- **`npm install` shows a long red ERESOLVE error.** Run `npm install --legacy-peer-deps`.
- **The simulator build fails the first time.** Open Xcode once, let it finish installing
  components, run `sudo xcodebuild -license accept`, then try `npx expo run:ios` again.
- **I get a surprise about money.** You set a budget in step 4b, so check **Budgets & alerts** in
  Google Cloud. Local development does not call Google unless the app actually searches.

---

## 12. Glossary

- **Terminal:** the app where you type commands. Comes with your Mac.
- **Repo / repository:** the project's folder, tracked by Git.
- **Git:** software that tracks changes to the project. You mostly do not touch it directly.
- **Node / npm:** Node runs JavaScript on your Mac, npm installs the project's building blocks.
- **Expo:** the framework hungr is built with. `npx expo ...` runs its commands.
- **Simulator:** a fake iPhone on your Mac screen, for testing without a real phone.
- **Supabase:** the backend service (database, accounts, and small server programs).
- **Edge Function:** a small server program (the "Google bridge") that talks to Google for the app.
- **Docker:** software that runs the local backend in a contained environment.
- **API:** a service you call over the internet, like Google Maps or Gemini.
- **API key:** a password-like string that identifies you to an API.
- **anon key vs service_role key:** the anon key is safe to ship in the app, the service_role key
  is a secret master key that stays on the backend only.
- **Bundle id / package (`app.usehungr`):** the app's unique name on the app stores.
- **EAS:** Expo's cloud build service, used to make the real iPhone app.
- **TestFlight:** Apple's way to share a pre-release app with testers by email.
