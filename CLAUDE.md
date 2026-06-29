# hungr, project instructions

## Design System
Always read `DESIGN.md` before making any visual or UI decision. All colours, fonts,
spacing, radius, motion, and aesthetic direction are defined there. Do not deviate without
explicit approval. In QA or review, flag any code that does not match `DESIGN.md`.

Quick reference: golden `#FBBF24` accent on tinted cream `#FCF6DF`; Cabinet Grotesk for
headings and buttons, Fraunces for brand and hero moments only, General Sans for body and
numbers; three state map pins golden (want to go) / sage `#5C8A5A` (been) / clay `#C0563D`
(avoid); slate `#3E6B7A` for Google attribution. Floating zen aesthetic.

## Product and engineering
The product, legal, and architecture source of truth is `docs/DESIGN.md` (Google base
display plus Gemini Grounding bootstrap, first party UGC as the moat, never run your own
model over Google reviews, store only place_id plus first party data).

## Writing style
Never use em dashes in any file, doc, comment, or message. Use commas, colons, parentheses,
or separate sentences. Use middots for inline separators where a separator is wanted.
