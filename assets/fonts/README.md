# Fonts

hungr uses three typefaces (see `DESIGN.md`):

- **Fraunces** (brand and hero moments). Loaded automatically from the
  `@expo-google-fonts/fraunces` package. Nothing to do.
- **Cabinet Grotesk** (screen headings, place names, buttons). Fontshare font, add the file.
- **General Sans** (body, labels, numbers). Fontshare font, add the file.

## Adding Cabinet Grotesk and General Sans (about 2 minutes)

1. Download both families from Fontshare:
   - Cabinet Grotesk: https://www.fontshare.com/fonts/cabinet-grotesk
   - General Sans: https://www.fontshare.com/fonts/general-sans

2. Put these `.otf` files in this folder (`assets/fonts/`) with exactly these names:
   - `CabinetGrotesk-Bold.otf`
   - `GeneralSans-Regular.otf`
   - `GeneralSans-Medium.otf`

3. In `src/hooks/useAppFonts.ts`, uncomment the three `require(...)` lines so they load
   under the family names the theme already references (`CabinetGrotesk_700Bold`,
   `GeneralSans_400Regular`, `GeneralSans_500Medium`).

4. Apply them where the design calls for it, using the tokens already in `src/theme.ts`:
   - Headings and buttons: `fontFamily: fonts.heading`
   - Body and labels: `fontFamily: fonts.body` (or `fonts.bodyMedium`)

Until these files are added, headings and body text fall back to the system sans. Fraunces
brand moments already render correctly.
