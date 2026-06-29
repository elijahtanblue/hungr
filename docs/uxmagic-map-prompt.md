# UXMagic prompt — hungr Map screen (4 variations)

Paste everything in the code block below into UXMagic.

```
Design the MAP screen (the home screen) of "hungr", a mobile food discovery and social
app. Generate ONE screen in FOUR distinct variations so I can compare overall design
directions. Every variation must use the identical color palette, fonts, and feature set
below. Only the layout, composition, and visual emphasis should change between variations.

PRODUCT IN ONE LINE
Find food near you, filtered by the cuisines you like and dislike, with reviews you can
trust because they come from people like you and your friends. Warm and human, the
opposite of a cold ranking app. Food photos are the hero.

COLOR PALETTE (use these exact hex values, do not invent new ones)
- Canvas / page background: #FCF6DF (soft yellow tinted cream)
- Card / surface: #FFFDF4 (warm near white)
- Primary text / ink: #1C1A17 (warm charcoal)
- Muted text: #8C8266 (warm grey)
- Hairlines / borders: #EFE6CE
- ACCENT (primary actions, brand, "want to go"): #FBBF24 (golden yellow), pressed #E8A50C
- "Been" state: #5C8A5A (sage green)
- "Avoid" state: #C0563D (clay red)
- Third party / Google attribution: #3E6B7A (slate)
Buttons and pins in golden use dark text (#241A06) for contrast. The food photography
provides all other color. Do NOT use purple, blue gradients, or neon.

TYPOGRAPHY
- Headings and brand: Fraunces (a warm characterful serif)
- UI, body, labels, numbers: General Sans (clean grotesque sans), numbers use tabular figures
- No Inter, Roboto, Arial, or system default fonts.

AESTHETIC
Warm editorial utility. Cream canvas, one confident golden accent, generous whitespace,
rounded but restrained corners (12 to 18px), soft shadows. Premium and appetite forward,
not loud. No AI slop: no 3 column icon-in-circle grids, no centered everything, no
decorative blobs, no emoji as UI.

COMPLETE FEATURE LIST FOR THE MAP SCREEN (include all of these)

1. Top search bar (persistent, pinned at top)
   - Placeholder: Food near me, or "reviewed by Jenny"
   - One search box that handles: a place or food ("ramen"), a cuisine ("Sichuan"),
     a person ("reviewed by [name]"), and friend names (to jump to a friend).
   - Shows current area context (e.g. "Sydney") and a clear / voice control.
   - Small profile avatar at top right (links to Account).

2. Cuisine filter row (horizontal scroll, below the search bar)
   - "All cuisines" chip selected by default.
   - Cuisine chips: Sichuan, Korean, Japanese, Thai, Vietnamese, etc.
   - DISLIKE / suppression chips in clay red, e.g. "Avoid: Nepalese x", which removes
     that cuisine from the map.
   - A "Filters" button opening more options: price ($, $$, $$$), Open now, Distance,
     "Friends have been", "Want to go".

3. The map (the main surface)
   - Interactive map centered on the user, restaurant pins placed on it.
   - Current location dot and a recenter button.
   - "Search this area" control when the map is panned.
   - Pin clustering when zoomed out.

4. Three state taste pins (the core visual language)
   - Want to go: golden pin showing the rating number (e.g. 4.6).
   - Been: sage pin showing a star or check.
   - Avoid: clay pin showing an x.
   - Undiscovered / unsaved place: neutral pin.
   - A small legend (Want to go, Been, Avoid).

5. Place bottom sheet (appears when a pin is tapped, draggable)
   - Restaurant name (Fraunces), rating, cuisine, price, distance.
   - A small food photo thumbnail.
   - Trust tags: "3 friends been", "12 reviews in Chinese", "reviewed by people who know".
   - Quick state actions: Want to go / Been / Avoid.
   - Tapping the sheet expands to the full place detail (not part of this screen).

6. List / Map toggle
   - A control to switch between the map and a scrollable ranked list of the same results.

7. Primary action: "Find food near me"
   - A prominent golden action that recenters and surfaces nearby places.

8. Bottom tab navigation (4 tabs)
   - Map (active), Friends, Trends, Account. Active tab uses the golden accent.

INTERACTION AND STATE NOTES
- Touch targets at least 44px. Mobile first, single column, iPhone proportions.
- Show a realistic loading state idea and an empty state idea ("No spots yet, want to add
  the first?") if the variation has room.

THE FOUR VARIATIONS TO GENERATE (same features, same palette, different direction)

Variation 1 — MAP IMMERSIVE: Full bleed map edge to edge. Search bar and cuisine chips
float over the map as translucent warm cards. The place sheet slides up from the bottom.
Minimal chrome, the map and pins dominate.

Variation 2 — LIST + MAP HYBRID (Beli style): Top 45 percent is the map, bottom 55 percent
is a scrollable ranked list of place cards (photo, name, rating, trust tags). The two stay
in sync. Utility forward and information dense.

Variation 3 — EDITORIAL WARM: The map is a rounded inset card near the top under a bold
Fraunces greeting ("What are you hungry for?"). Below it, warm editorial sections like
"Friends ate here this week" and "Trending in your cuisines" as photo led cards. Magazine
feel, lots of warmth and whitespace.

Variation 4 — POWER USER / DENSE: Compact and efficient. Persistent filter bar with many
chips visible, a tight map, and a slim results strip. For the daily foodie who wants speed
and control, minimal decoration, maximum density.

OUTPUT: 4 separate full screen mockups, one per variation, all clearly using the golden on
tinted cream palette, Fraunces plus General Sans, and the complete feature list above.
```
