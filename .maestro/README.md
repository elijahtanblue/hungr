# End to end tests (Maestro)

These flows drive the real app on a simulator. They are not run by `npm test` (that is unit
and component tests). Run them after a native build.

## One time setup
1. Install Maestro: `curl -Ls "https://get.maestro.mobile.dev" | bash`
2. Build and launch the app on the iOS simulator: `npx expo run:ios`
   (Maestro drives whatever build is installed, app id `app.usehungr`.)

## Run
```
maestro test .maestro/01-sign-in.yaml
maestro test .maestro/                 # run every flow
```

## Flows
- **01-sign-in.yaml** runnable as is. Checks the sign-in screen and that requesting a magic
  link shows "Check your inbox". Needs the Supabase email provider enabled (local stack works:
  the magic-link email lands in the local inbox at http://localhost:54324).
- **02-map-and-tabs.yaml** needs an authenticated session first (magic link cannot be clicked
  inside Maestro). Get a session by signing in once manually on the simulator (it persists via
  AsyncStorage), then run this flow. It exercises the preferences sheet, the Find food near me
  popup, and the bottom tabs.

## Known limitation
Tapping a specific map pin to set its state (want to go / been / avoid) is not scripted: native
map markers are not addressable by Maestro selectors. Verify the pin tap and the place sheet
actions manually, or add testID-tagged overlay controls if pin-level E2E becomes a priority.
