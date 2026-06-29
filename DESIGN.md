# Design System, hungr

This is the VISUAL design system (colour, type, spacing, motion). The product and
engineering source of truth lives separately in `docs/DESIGN.md`. Read this file before
making any visual or UI decision.

## Product Context
- **What this is:** A mobile first food discovery and social app. Find food near you,
  filtered by the cuisines you like and dislike, with reviews you trust because they come
  from people like you and your friends.
- **Who it's for:** Daily foodies first (the engine), the special occasion crowd later.
- **Space:** Social food discovery, peers are Beli, EatClub, Untappd, Zest.
- **Project type:** Mobile app (Expo / React Native), photo heavy.

## Aesthetic Direction
- **Direction:** Floating zen, warm editorial utility.
- **Decoration level:** Minimal to intentional. Type, photos, and whitespace do the work.
- **Mood:** Warm and human, the deliberate opposite of a cold ranking app. A calm full
  screen map, with controls floating over it as soft rounded cards, never heavy bars. The
  food photography is the hero colour.
- **Positioning note:** The category leader (Beli) owns a cool, clinical, leaderboard look
  (teal grey, score numbers). hungr owns the opposite pole, warm appetite, so it feels
  human where Beli feels like a spreadsheet.
- **Reference points:** EatClub (yellow accent on neutral, deliberately moved off red),
  Untappd (amber and charcoal appetite palette), The Infatuation and Resy (confident food
  brand type), Eater (editorial serif). Beli is the foil we differentiate from.

## Typography
Never use Inter, Roboto, system default, or Poppins. The "AI look" is the default neutral
sans, so the system commits to weight and character instead.

- **Brand and hero moments only:** Fraunces, a warm characterful serif, weight 600. Used for
  the `hungr` wordmark and big greetings (for example "What are you hungry for?"). Sparingly.
- **Screen headings, place names, section titles, buttons:** Cabinet Grotesk, bold 700 to 800.
  Confident, app native, legible at small sizes.
- **Body, labels, metadata, ratings, distances:** General Sans, 400 to 600. Numbers use
  tabular figures so ratings and distances align.
- **Loading:** Fraunces via Google Fonts. Cabinet Grotesk and General Sans via Fontshare
  (`https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@700,800&f[]=general-sans@400,500,600,700`).
- **Scale (mobile, px):** Display 32 (Fraunces 600) · H1 26 (Cabinet 800) · H2 20 (Cabinet 700)
  · Place name / title 18 (Cabinet 700) · Body 16 (General 400/500) · Label 13 (General 500)
  · Caption 11 (General 400). Line height roughly 1.05 for display, 1.5 for body.

## Color
- **Approach:** Restrained. One confident yellow accent on a warm neutral canvas, with two
  state colours and one attribution colour. Everything else is neutral, the food photos bring
  the rest of the colour.

Light mode:
- **Canvas (page background):** `#FCF6DF` soft yellow tinted cream
- **Surface (cards):** `#FFFDF4` warm near white
- **Ink (primary text):** `#1C1A17` warm charcoal
- **Muted text:** `#8C8266` warm grey
- **Hairlines / borders:** `#EFE6CE`
- **Accent (primary actions, brand, want to go):** `#FBBF24` golden, pressed `#E8A50C`,
  text on yellow `#241A06`
- **Been state:** `#5C8A5A` sage green
- **Avoid state:** `#C0563D` clay red
- **Third party / Google attribution:** `#3E6B7A` slate

Semantic: success `#5C8A5A`, warning `#E8A50C`, error `#C0563D`, info `#3E6B7A`.

Dark mode (warm, not pure black):
- Canvas `#16140F` · Surface `#211E18` · Ink `#F3EEE4` · Muted `#9C9384` · Hairline `#332E25`
- Accent yellow stays `#FBBF24`, pressed `#FFCC3D` · Been `#79A877` · Avoid `#D77A60` · Slate `#6FA0B2`

Usage rules:
- Golden is for want to go pins and primary actions only, it stays rare and meaningful.
- The three state map pins are the core visual language: golden want to go, sage been, clay avoid.
- Google sourced content uses the slate colour and always carries attribution. Community
  (first party) content uses the golden world. Keep the two visually separate (this mirrors
  the legal boundary in `docs/DESIGN.md`).
- No purple, no blue gradients, no neon.

## Spacing
- **Base unit:** 4px.
- **Density:** Comfortable, generous breathing room (the place card must hold reviews, links,
  and tags without feeling cramped).
- **Scale:** 2, 4, 8, 12, 16, 24, 32, 48, 64.

## Layout
- **Approach:** Mobile first, single column, iPhone proportions. App UI, calm surface hierarchy.
- **Floating zen pattern:** A constant full screen map. Search, filters, actions, and the tab
  bar float over it as soft rounded cards with gentle shadows. Popups and sheets rise over the
  same frame rather than replacing it.
- **Border radius:** sm 10px, md 14px, lg 18px, pill 999px.
- **Touch targets:** at least 44px.

## Motion
- **Approach:** Intentional, restrained. Gentle rises and fades, the living pins do the talking.
- **Easing:** enter ease-out, exit ease-in, move ease-in-out.
- **Duration:** micro 80ms, short 200ms, medium 320ms, long 500ms.

## Core Screens (agreed direction)
- **Map (home, core):** Floating zen full screen map. Floating search bar with a note /
  preferences icon and voice, a "Sydney" location chip, profile avatar, three state pins,
  recenter, and a floating row with "Find food near me" plus quick filter chips and a
  list/map toggle. Bottom tab bar: Map, Friends, Trends, Account.
  - "Find food near me" opens an AI styled popup that drops alive pins onto the map (not a
    one line list, the pins carry the information).
  - The note / preferences icon opens a sheet to set cuisines to Prioritise (golden) and
    Avoid (clay). The map then visibly reflects this, avoided cuisines drop away, prioritised
    ones surface on top.
  - Tapping a pin opens a curated place card (food photo, name, rating, cuisine, price,
    distance, trust tags, want / been / avoid), with generous spacing to hold reviews and
    links, expandable to full place detail.
- **Friends:** A vertical, social media style feed of friend check ins and what they are
  eating. Not a small map, not a horizontal strip.
- **Trends:** Food trends with a toggle between near me and global.
- **Account:** Settings and preferences.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-29 | Accent is golden `#FBBF24` on tinted cream `#FCF6DF` | Founder preference for yellow over amber, plus a soft yellow page tint. Warm appetite as the anti Beli position. EatClub validated yellow over red in this market. |
| 2026-06-29 | Type: Cabinet Grotesk headings, Fraunces brand accents, General Sans body | Competitor analysis showed the "AI look" is the default neutral sans. Premium food brands commit to characterful type. Hybrid gives app native legibility plus editorial warmth at brand moments. |
| 2026-06-29 | Three state map pins (want / been / avoid) as the core colour language | Expresses the single player taste map, the daily foodie core, glanceably. |
| 2026-06-29 | Floating zen aesthetic for the Map | Founder chose image 1 direction. Keeps the map as the constant core under all states. |
