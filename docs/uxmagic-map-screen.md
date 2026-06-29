# UXMagic prompt, hungr Map screen (final direction, fonts locked)

This replaces the earlier 4-variation prompt. It describes ONE screen, the Map, plus the
states that appear when the user taps things. Paste the code block into UXMagic.

```
Design the MAP screen of "hungr", a mobile food discovery and social app. This is ONE screen
(the home screen) shown in several states: the base map, plus the popups and sheets that
appear when the user taps things. Keep the map as the constant core under every state.

PRODUCT IN ONE LINE
Find food near you, filtered by the cuisines you like and dislike, with reviews you trust
because they come from people like you and your friends. Warm and human, the opposite of a
cold ranking app. Food photos are the hero.

COLOR PALETTE (exact hex, do not invent new ones)
- Page background: #FCF6DF (soft yellow tinted cream)
- Card / surface: #FFFDF4 (warm near white)
- Primary text / ink: #1C1A17 (warm charcoal)
- Muted text: #8C8266 (warm grey)
- Hairlines / borders: #EFE6CE
- ACCENT (primary actions, brand, "want to go" pins): #FBBF24 golden, pressed #E8A50C
- "Been" state: #5C8A5A sage green
- "Avoid" state: #C0563D clay red
- Third party / Google attribution: #3E6B7A slate
Golden buttons and pins use dark text (#241A06). Food photography supplies all other colour.
No purple, no blue gradients, no neon.

TYPOGRAPHY (locked, do NOT use Inter, Roboto, system default, or Poppins)
- Brand and hero moments only (the "hungr" wordmark, a big greeting): Fraunces, warm serif, 600.
- Screen headings, place names, section titles, buttons: Cabinet Grotesk, bold 700 to 800.
- Body, labels, metadata, ratings, distances: General Sans, tabular figures for numbers.

AESTHETIC
Floating zen. A calm full screen map. Controls float over the map as soft rounded cards with
gentle shadows, never heavy bars. Generous breathing room, rounded corners 14 to 18px. Premium
and appetite forward, not loud. No AI slop: no 3 column icon-in-circle grids, no centered
everything, no decorative blobs, no emoji as UI.

STATE 1, BASE MAP (the resting screen)
- Full bleed interactive map.
- Floating search bar near the top: rounded card, magnifier icon, placeholder
  'Find food near me…', a small NOTE / preferences icon on the right of the bar, and a
  microphone. A small "Sydney" location chip top left, a profile avatar top right.
- Three state taste pins on the map, each a rounded teardrop:
    Want to go = golden pin showing the rating number (e.g. 4.8).
    Been = sage pin showing a check.
    Avoid = clay pin showing an x.
    A blue dot for the user's current location.
- A floating recenter button bottom right.
- A floating control row near the bottom above the tab bar: a primary golden
  "Find food near me" action, plus quick filter chips "Highly Rated" and "Friends Been",
  and a small list/map toggle icon.
- Bottom tab bar (floating, soft): Map (active, golden), Friends, Trends, Account.

STATE 2, FIND FOOD NEAR ME POPUP (when the golden "Find food near me" is tapped)
- A soft popup card rises over the map, AI styled (a subtle sparkle mark, warm tone).
- It does NOT show a one line list. Instead it animates fresh alive pins onto the map, the
  pins carry the information (rating, state colour). The popup gives a one line summary like
  "12 spots you'll probably love nearby" and a "show me" affordance, then recedes to let the
  living pins do the talking.

STATE 3, PREFERENCES SHEET (when the NOTE icon in the search bar is tapped)
- A bottom sheet to set taste preferences: two clear groups.
    "Prioritise" cuisines (golden chips) that float to the top of results.
    "Avoid" cuisines (clay chips) that get hidden or dimmed on the map.
- After saving, the map updates: avoided cuisines drop away, prioritised ones surface on top.
  Make this visibly reflected, the user should see what is being avoided and what is being
  shown on top.

STATE 4, PLACE CARD (when a pin is tapped)
- A curated bottom card, editorial and calm, generous spacing (this card must comfortably
  hold reviews, links, and tags later, so design for breathing room now).
  Top: a food photo. Then the place name (Cabinet Grotesk), rating, cuisine, price, distance.
  Trust tags: "3 friends been", "12 reviews in Chinese", "reviewed by people who know".
  Quick state actions: Want to go (golden) / Been / Avoid.
  A hint that tapping expands to the full place detail.

NOT ON THIS SCREEN
- The "Friends ate here" social feed lives in the FRIENDS tab, not here. It is a vertical,
  social-media style scroll of friend check-ins, not a small map and not a horizontal strip.

INTERACTION NOTES
- Mobile first, single column, iPhone proportions. Touch targets at least 44px.
- Everything floats over the constant map. Transitions are gentle rises and fades.

OUTPUT: the Map screen in the four states above (base, find-food popup, preferences sheet,
place card), all using the golden on tinted cream palette and the locked Cabinet Grotesk plus
Fraunces plus General Sans type system.
```
