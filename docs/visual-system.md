# Ski Reco App — Visual System

_design-lead · 2026-08-03 · Builds on `docs/designpowers/strategy.md`, the personas doc, and
`design/inspiration-directions.md` (Director's chosen direction: Base Camp Bright). Companion
specimen: `design/visual-system-preview.html`._

---

## 0. The tuning note, resolved — what changed from Base Camp Bright and why

Base Camp Bright was picked for its "well-loved consumer app" energy when the audience was
families and first-timers. That audience is still primary. But Jordan and Nicole are now in the
room, deciding in real time whether to trust a recommendation enough to book a flight or rearrange
a weekend. Untouched, Base Camp Bright's signature moves — ExtraBold rounded type everywhere,
24–32px squirclе radii, fully pill-shaped everything, confetti on reveal, wiggle-on-tap — read as
a game, not an instrument. That's the exact failure mode this pass corrects.

**Kept, because it's genuinely right for this brief:** the rounded geometry (it stays warm and
approachable, never severe), the saturated, disciplined 4–5-colour accent system, the
colour-tinted-shadow signature, Baloo 2 + Manrope as the type pairing, the screenshot-legible
flatness.

**Changed, and why:**

| Base Camp Bright, as drawn | This system | Why |
|---|---|---|
| Baloo 2 ExtraBold used for all display type | Baloo 2 ExtraBold reserved for **one place only** — the hero resort name on the result card. Everywhere else drops to Bold/SemiBold, with tightened (−0.5 to −1%) letter-spacing at large sizes | ExtraBold + loose rounded tracking everywhere is the single biggest driver of "childish." Reserving the heaviest weight for one high-impact moment makes it feel like a considered choice, not a default |
| Numbers set in the display/body face | A dedicated monospace face (IBM Plex Mono, tabular figures) for every numeric readout — vertical drop, acreage, inches, temperatures, ratings | This is the concrete mechanism behind "numbers should look like instruments, not decorations." A mono face with tabular numerals is the same visual language as a weather instrument or a boarding pass — it reads as measured, not decorated |
| 24–32px "squircle" radii on everything, fully pill-shaped buttons | Radii tightened to a 8/12/16/20px scale. Pills reserved for tags, filter chips, and status badges only — **primary buttons and cards are rounded rectangles**, not pills | A pill-shaped primary CTA reads as a toy button. A rounded rectangle with the same corner language elsewhere in the system still feels like one family, but reads as a tool you'd trust with a decision |
| "No hairline strokes — shapes defined by fill and shadow" | Cards and interactive components get a genuine 1.5px border in addition to a tightened shadow | Two reasons: (1) soft shadows wash out in bright outdoor glare — Dana's and Nicole's real condition — while a crisp border still reads as a boundary; (2) hairline borders are an instrument-panel signal (boarding passes, trail maps, dashboards all use them) that a shadow-only card doesn't send |
| Springy, scale-overshoot easing; confetti burst on result reveal; wiggle-on-tap | Confident decelerate easing, no overshoot anywhere; result reveal is a settle-and-arrive, not a celebration burst; tap feedback is a crisp state change (border + fill + icon), not a wiggle | Bounce and confetti are the most legible "cute" signal in the whole direction. A powder hound deciding whether to book a flight should feel like the app just gave them a precise, considered answer — not that they won a mini-game |
| Blob-person mascot as a default illustration element | Human figures removed from the default illustration system entirely — resorts are portraits of *places*, never characters | A mascot is the fastest way to read as "for kids." The resort itself — its terrain, its scale, its town — is the actual subject and the actual credibility signal |
| One consistent "brand voice" of colour — accents used loosely, interchangeably, for decoration | Every accent hue is now tied to exactly **one meaning** and never reused: indigo = primary action, coral = alert/urgency, teal/mint = positive fit, gold = Nicole's voice (and *only* Nicole's voice), cold-blue/warm-amber = snow quality only, trail colours = difficulty only | A colour system where hue is decorative reads as playful. A colour system where hue is a learnable, consistent signal reads as engineered — and it's a genuine accessibility win, since Jordan and Dana can learn "gold always means Nicole" once and rely on it everywhere |

Net effect: still unmistakably warm, rounded, and bright — still Base Camp Bright's DNA — but every
lever that made it read as *simplistic* has been deliberately tightened. A first-timer and a
15,000-vertical-feet-a-season skier should both look at the result card and believe the number
underneath it.

---

## 1. Token architecture

Three layers: **global** (raw values, no meaning attached) → **semantic** (named by role, what
they're *for*) → **component** (specific components reference semantic tokens only, never global
tokens directly). This is the layer discipline that keeps dark mode, contrast fixes, and future
rebrands from requiring a per-component rewrite.

### 1.1 Global tokens — colour primitives

All ratios below computed against real WCAG 2.1 relative-luminance math (sRGB), not eyeballed —
see the specimen page footer for the raw calculation notes.

| Token | Hex | Role (global, no meaning yet) |
|---|---|---|
| `color.purple.900` | `#17102B` | Near-black indigo — the ink |
| `color.purple.700` | `#564C72` | Muted violet-grey |
| `color.purple.500` | `#9A8ACF` | Mid violet |
| `color.purple.300` | `#DCD6F0` | Pale violet |
| `color.purple.100` | `#F2EFFA` | Faint violet tint |
| `color.indigo.600` | `#5B3DF0` | Brand indigo (fills, both modes) |
| `color.indigo.400` | `#7F68F3` | Brand indigo, lightened for dark-bg text |
| `color.coral.600` | `#E72400` | Coral, text-safe on light |
| `color.coral.500` | `#FF5A3C` | Coral, fill / large-text / dark-bg text |
| `color.teal.700` | `#00695C` | Teal, text-safe on light |
| `color.teal.600` | `#008D7B` | Teal, text-safe on dark |
| `color.teal.400` | `#00B39A` | Teal, bright fill only |
| `color.mint.700` | `#0B6B4B` | Mint, text-safe on light |
| `color.mint.600` | `#0F8E63` | Mint, text-safe on dark |
| `color.mint.200` | `#C9F5DE` | Mint, light fill |
| `color.mint.900` | `#12301F` | Mint, dark fill |
| `color.gold.500` | `#FFC22B` | Gold — reserved for Nicole's voice only |
| `color.cold.700` | `#0E7AA6` | Cold-blue, text-safe on light |
| `color.cold.600` | `#0F86B6` | Cold-blue, text-safe on dark |
| `color.warm.700` | `#AA671A` | Warm-amber, text-safe on light |
| `color.warm.600` | `#C97A1F` | Warm-amber, text-safe on dark |
| `color.trail.green.700` | `#1A8655` | Trail green, text-safe on light |
| `color.trail.green.600` | `#1C8F5A` | Trail green, fill / dark-bg text |
| `color.trail.blue.600` | `#1E6FD9` | Trail blue, text-safe on light |
| `color.trail.blue.500` | `#2E7CE2` | Trail blue, text-safe on dark |
| `color.night.900` | `#14101F` | Dark-mode page background |
| `color.night.800` | `#1E1830` | Dark-mode surface |
| `color.night.700` | `#271F3D` | Dark-mode elevated surface |
| `color.night.500` | `#675797` | Dark-mode interactive border |
| `color.night.300` | `#2B2440` | Dark-mode hairline border |
| `color.snow.000` | `#FFFFFF` | White |
| `color.mist.100` | `#F5F2FF` | Dark-mode primary text (off-white, lavender-tinted) |
| `color.mist.300` | `#B8AED6` | Dark-mode secondary text |

### 1.2 Semantic tokens — light mode

| Semantic token | Value | Contrast (verified) |
|---|---|---|
| `bg.page` | `color.snow.000` (#FFFFFF) | — |
| `bg.tint` | `color.purple.100` (#F2EFFA) | — |
| `bg.surface` | `color.snow.000` | — |
| `text.primary` | `color.purple.900` (#17102B) | 18.33:1 on `bg.page`, 16.15:1 on `bg.tint` (AAA) |
| `text.secondary` | `color.purple.700` (#564C72) | 7.86:1 on `bg.page`, 6.92:1 on `bg.tint` (AAA) |
| `text.on-brand` | `#FFFFFF` | 6.23:1 on `brand.primary` (AA) |
| `border.hairline` | `color.purple.300` (#DCD6F0) | Decorative only — never sole indicator of a boundary |
| `border.interactive` | `color.purple.500` (#9A8ACF) | 3.04:1 on `bg.page` (AA, non-text UI) |
| `border.selected` | `brand.primary` | 3:1+ per below |
| `brand.primary` | `color.indigo.600` (#5B3DF0) | 6.23:1 white-on-brand; 6.23:1 as text on white |
| `accent.coral.text` | `color.coral.600` (#E72400) | 4.52:1 on `bg.page` (AA body text) |
| `accent.coral.fill` | `color.coral.500` (#FF5A3C) | 3.10:1 — fills/large-text/icons only, never body text colour |
| `accent.gold` | `color.gold.500` (#FFC22B) | ink-on-gold 11.35:1 (AAA) — reserved for Nicole's Hot Take only |
| `accent.teal.text` | `color.teal.700` (#00695C) | 6.61:1 on `bg.page` (AAA) |
| `accent.mint.text` | `color.mint.700` (#0B6B4B) | 6.52:1 on `bg.page` (AAA) |
| `accent.mint.fill` | `color.mint.200` (#C9F5DE) | ink-on-mint-fill 15.36:1 |
| `accent.cold.text` | `color.cold.700` (#0E7AA6) | 4.82:1 (AA) |
| `accent.warm.text` | `color.warm.700` (#AA671A) | 4.50:1 (AA) |
| `trail.beginner` | `color.trail.green.700` (#1A8655) | 4.58:1 (AA) |
| `trail.intermediate` | `color.trail.blue.600` (#1E6FD9) | 4.85:1 (AA) |
| `trail.advanced` / `trail.expert` | `text.primary` (#17102B) | 18.33:1 — "black diamond" convention, uses ink itself |

### 1.3 Semantic tokens — dark mode

| Semantic token | Value | Contrast (verified) |
|---|---|---|
| `bg.page` | `color.night.900` (#14101F) | — |
| `bg.tint` | `color.night.800` (#1E1830) | — |
| `bg.surface` | `color.night.800`, elevated cards use `color.night.700` | — |
| `text.primary` | `color.mist.100` (#F5F2FF) | 16.93:1 on `bg.page`, 14.10:1 on elevated surface (AAA) |
| `text.secondary` | `color.mist.300` (#B8AED6) | 8.96:1 on `bg.page` (AAA) |
| `border.hairline` | `color.night.300` (#2B2440) | Decorative only |
| `border.interactive` | `color.night.500` (#675797) | 3.01:1 on `bg.page` (AA, non-text UI) |
| `brand.primary` | `color.indigo.600` (#5B3DF0) fill; `color.indigo.400` (#7F68F3) for brand-coloured text/links | Fill: 6.23:1 white text on it, works unchanged in dark mode. Text-on-dark-bg variant: 4.61:1 |
| `accent.coral.text` | `color.coral.500` (#FF5A3C) | 6.03:1 on dark `bg.page` (AAA) — brighter coral is *already* text-safe on dark, no further shift needed |
| `accent.teal.text` | `color.teal.600` (#008D7B) | 4.54:1 (AA) |
| `accent.mint.text` | `color.mint.600` (#0F8E63) | 4.51:1 (AA) |
| `accent.gold` | `color.gold.500` (#FFC22B) unchanged | 11.57:1 on dark `bg.page` (AAA) |
| `accent.cold.text` | `color.cold.600` (#0F86B6) | 4.54:1 (AA) |
| `accent.warm.text` | `color.warm.600` (#C97A1F) | 5.60:1 (AA) |
| `trail.beginner` | `color.trail.green.600` (#1C8F5A) | 4.56:1 (AA) — unchanged from fill token, already dark-safe |
| `trail.intermediate` | `color.trail.blue.500` (#2E7CE2) | 4.54:1 (AA) |
| `trail.advanced` / `trail.expert` | `text.primary` (#F5F2FF) | 16.93:1 — inverts to a light diamond glyph on dark |

**Why dark mode gets real design attention, not just an inverted filter:** Nicole checks this at
6am before first chair, gloved, screen brightness low. A naively inverted palette (light tokens
run through a CSS filter) reliably produces washed-out, low-contrast accent colours on dark
backgrounds — exactly what happened to the raw fill tokens above when tested (several accents that
pass comfortably on white fell under 3:1 on `#14101F` before retuning). Every accent above was
independently re-verified against the dark background, not assumed.

### 1.4 Typography

Google Fonts, three families, one job each:

- **Baloo 2** (700/600/500 weights loaded; 800 loaded but scoped to one use) — display/identity.
  Rounded, warm, the direction's signature. Used sparingly and with tightened tracking so it reads
  confident rather than bubbly.
- **Manrope** (400/500/700) — everything you read: body copy, labels, UI text, reasons, hot takes.
- **IBM Plex Mono** (500/600) — every number. Tabular figures on. This is the "instrument" move —
  it gives stat readouts a different visual register from the friendly prose around them, on
  purpose, so numbers read as measured fact rather than as more decoration.

| Token | Family / weight | Size / line-height (mobile → desktop) | Tracking | Use |
|---|---|---|---|---|
| `type.display.hero` | Baloo 2 ExtraBold 800 | 32/36 → 44/48 | −1% | Resort name on the result card. **Only** here. |
| `type.display.h1` | Baloo 2 Bold 700 | 26/32 → 34/40 | −0.5% | Page headline ("Chase the Snow") |
| `type.display.h2` | Baloo 2 Bold 700 | 21/26 → 25/30 | −0.25% | Section headers, question copy |
| `type.display.h3` | Baloo 2 SemiBold 600 | 17/22 → 19/24 | 0 | Card titles, resort-row names |
| `type.body.md` | Manrope Regular 400 | 16/24 | 0 | Body copy, reasons, descriptions |
| `type.body.sm` | Manrope Medium 500 | 13/18 | 0 | Captions, sublabels |
| `type.label` | Manrope Bold 700 | 12/16 | +6% uppercase | Eyebrows, attribution labels, tags |
| `type.data.stat` | IBM Plex Mono SemiBold 600, tabular-nums | 22/26 → 26/30 | 0 | Hero stat values (vertical drop, snowfall, etc.) |
| `type.data.inline` | IBM Plex Mono Medium 500, tabular-nums | 14/18 | 0 | Inline numbers in list rows, badges |
| `type.data.label` | Manrope Bold 700 | 10/13 → 11/14 | +8% uppercase | Labels under stat values |

### 1.5 Spacing, radii, elevation, borders, motion

**Spacing** (4px base): `space.1`=4, `space.2`=8, `space.3`=12, `space.4`=16, `space.5`=20,
`space.6`=24, `space.8`=32, `space.10`=40, `space.12`=48, `space.16`=64, `space.20`=80 — all in px,
consumed as rem in code (`space.4` = `1rem`) so user font-size overrides and browser zoom scale
spacing proportionally.

**Radii:** `radius.sm`=8px (small badges), `radius.md`=12px (buttons, tap-chips, inputs),
`radius.lg`=16px (standard cards), `radius.xl`=20px (hero result card, modals), `radius.pill`=999px
(tags, filter chips, status badges **only** — never primary buttons or cards, see §0).

**Elevation** (colour-tinted, tightened blur vs. the original direction — precise, not soft):
- `shadow.sm`: `0 1px 2px rgba(23,16,43,0.06), 0 1px 1px rgba(91,61,240,0.05)`
- `shadow.md`: `0 4px 12px rgba(23,16,43,0.09), 0 2px 4px rgba(91,61,240,0.06)`
- `shadow.lg`: `0 12px 28px rgba(23,16,43,0.16), 0 4px 10px rgba(91,61,240,0.08)`
- Dark mode: same structure, black-based shadow at slightly higher opacity
  (`rgba(0,0,0,0.4)` / `rgba(0,0,0,0.5)`) since colour-tinted shadows disappear against a dark page —
  shadows in dark mode do their job through a subtle top inner highlight border instead
  (`border-top: 1px solid rgba(245,242,255,0.06)`) plus the elevation shadow.

**Borders:** `border.width.hairline`=1px (decorative dividers), `border.width.default`=1.5px (card
and chip resting-state boundary — thicker than a typical hairline on purpose, for outdoor
legibility), `border.width.selected`=2px, `border.width.focus`=3px (see focus ring recipe below).

**Motion tokens** (constraints for `motion-designer` to choreograph within — see handoff):
- `duration.instant`=100ms, `duration.fast`=160ms, `duration.base`=220ms, `duration.slow`=360ms
- `easing.standard` = `cubic-bezier(0.2, 0, 0, 1)` — confident decelerate, no overshoot
- `easing.entrance` = `cubic-bezier(0.16, 1, 0.3, 1)` — smooth settle, no spring
- **Explicitly banned system-wide:** scale-overshoot/"pop" easing, confetti or particle bursts,
  wiggle/shake-on-tap, any animation whose primary purpose is celebration rather than feedback.
  Selection feedback is a state change (border, fill, icon), not a gesture.
- `prefers-reduced-motion: reduce` → all transform/scale/parallax animation is removed; only
  opacity cross-fades remain, at `duration.fast`.

---

## 2. Component specs

### 2.1 Tap-chip / option-card (the workhorse)

Used throughout both quiz flows. Every state must be distinguishable without colour.

- **Anatomy:** optional leading glyph → label (+ optional sublabel/gloss, e.g. "$$ — Mid-range") →
  trailing selection indicator (a circle for single-select "radio" semantics, a square for
  multi-select "check" semantics — shape itself communicates select-one vs. select-many, before any
  state is applied).
- **Sizing:** min-height 56px (well above the 44px floor — generous for Marcus/Nicole's gloved or
  cold hands), padding `space.4` horizontal / `space.3` vertical, `radius.md`, min 12px gap between
  adjacent chips in a grid.
- **Default/unselected:** `bg.surface`, `border.interactive` at `border.width.default`, no shadow —
  deliberately flat and calm at rest.
- **Hover** (pointer only): border shifts to `brand.primary`, `bg.tint` wash, `shadow.sm` appears.
  No scale change.
- **Focus-visible:** independent of selection state — a 3px ring in `brand.primary`, offset 2px
  from the chip edge, using the double-box-shadow recipe in §6 so it's visible against any adjacent
  background.
- **Selected — five redundant signals, none of them colour alone:** (1) border widens to 2px
  `brand.primary`, (2) fill washes to a 10% `brand.primary` tint, (3) the indicator shape fills
  solid (radio dot / check square), (4) a check glyph (✓) appears inside the indicator, (5) label
  weight steps up from Regular to SemiBold. Any one of these alone would be enough for most users;
  all five together mean a user relying on shape, a user relying on weight, and a user relying on
  the icon all get the same information.
- **Disabled:** `bg.tint` at 60% opacity, `text.secondary`, `border.hairline`, no hover response,
  `cursor: not-allowed`.

### 2.2 Progress indicator

Five discrete waypoint segments, not a continuous bar — each segment represents one question topic
so a user always knows exactly where they are in a five-topic flow, not an abstract percentage.

- Track: five `radius.pill` segments, 6px tall, 4px gap. Completed = `brand.primary` fill. Current
  = `brand.primary` fill + a small marker dot above it. Upcoming = `bg.tint` fill.
- **Always paired with text**, never the bar alone: "Step 2 of 5 · Skill level" in `type.body.sm`,
  positioned to the left of the track, both updating together.
- `role="progressbar"`, `aria-valuemin=1 aria-valuemax=5 aria-valuenow` + `aria-valuetext="Step 2 of
  5: Skill level"` — screen-reader users get the same information sighted users get from the label.

### 2.3 Hero result card

See §3 — treated as its own section given its centrality.

### 2.4 Nicole's Hot Take block

Quarantined per scope-revision-1 §1 — visually its own object, never blended into neutral copy.

- Container: `bg.tint` (dark mode: `bg.surface` at the elevated tone), `radius.lg`, 1.5px
  `accent.gold` border.
- Attribution header row: a filled `accent.gold` circle with "N" (Baloo 2 SemiBold, ink-coloured)
  as a lightweight avatar-glyph, then `type.label` "NICOLE'S HOT TAKE" in `text.secondary`, then —
  if her sheet has an Overall Rating for this resort — a small mono rating readout right-aligned
  (`type.data.inline`, e.g. "8.5/10").
- Body: `type.body.md` at 17/26 (one step larger than standard body, so the quote reads as the
  centrepiece of the block), `text.primary`, opened with an oversized `accent.gold` quotation glyph
  at 15% opacity behind the first line (decorative, `aria-hidden="true"`) rather than a speech-bubble
  shape — texture without cuteness.
- **Hard rule, enforced at the component level, not just in content:** if a resort has no hot take,
  this component does not render — not a placeholder, not an empty state, not conditional copy in
  Nicole's voice claiming absence. Nothing. The layout around it (result card stat strip, spacing)
  must look complete with or without it — verified in the specimen page (see the two result-card
  states rendered there).

### 2.5 Stat / data readout

The concrete answer to "numbers should look like instruments." A tight strip, not a scatter of
individually-shadowed bubble cards.

- Layout: `auto-fit, minmax(84px, 1fr)` grid (2 columns at 320px, up to 4 on desktop), tiles
  separated by 1px `border.hairline` dividers rather than each tile being its own bordered/shadowed
  card — reads as one continuous panel.
- Per tile: `type.data.label` above (e.g. "VERTICAL DROP"), `type.data.stat` value below in
  `text.primary` mono with tabular figures, unit suffix in a smaller mono weight
  (`type.data.inline`) immediately after the number, not on its own line.
- **Null-field state** (17 of 54 resorts have null `terrain_pct` — strategy.md §3.6): value renders
  as an em dash "—" in `text.secondary` mono, sublabel below reads "Not published by the resort" in
  `type.body.sm` — never blank, never "0%," never interpolated.

### 2.6 Ranked-list row (Chase the Snow)

Full-row tap target, generous height, everything scannable in the ten seconds Jordan actually gives it.

- min-height 72px, 1px `border.hairline` divider between rows, whole row is the tap target
  (`role="link"`), `bg.tint` wash + focus ring on `:focus-visible`.
- Left: rank number in a filled `bg.tint` circle (mono numeral). Centre: resort name
  (`type.display.h3`) + region (`type.body.sm`, `text.secondary`). Right-aligned: forecast badge.
- **Forecast badge:** never colour-only. A crystal glyph (cold/light) or a droplet glyph
  (heavier/wetter) sits beside the mono inches value and the plain-word descriptor —
  `"18in · cold & light"` — glyph, number, and word all present together.
- Below the name: one-line reason (`type.body.sm`). Conditionally present: a feasibility chip
  ("2.5hr drive"), a crowd-flag glyph + "Gets crowded" in `accent.warm.text` (icon + text, not a
  coloured dot alone), and a small `accent.gold` dot + "Nicole's been here" chip if a hot take
  exists for that resort.
- **Feasibility-excluded rows** (only shown in the deferred "here's what else fit" secondary list,
  if that ships): rendered at 55% opacity with an explicit "✕ Not realistically reachable" label —
  dimmed *and* labelled, never silently omitted, never dimmed without explanation.

### 2.7 Two-tier Canada section divider

Not a subtle rule — a full-width, unmissable banner block between the live US list and the Canada
section, implementing Principle 5 (absence is honest) at the component level.

- Full-bleed-within-container band: `bg.tint` fill, `radius.lg`, `space.5` padding.
- Icon: a signal-with-slash glyph (reads as "no live signal," shape-based, not colour-based).
- Heading: "Canada — no live forecast available" (`type.display.h3`).
- Subtext: "Sorted by typical season snowfall, not this week's storm. Check the resort's own snow
  report for live conditions." (`type.body.sm`, `text.secondary`).
- Every Canadian resort row below this divider additionally carries an inline
  `type.data.label`-styled tag reading "TYPICAL SEASON" next to its snowfall stat, so the honesty
  signal survives even if a row gets screenshotted in isolation, away from the divider itself.

### 2.8 Resort row — Nicole's list

Calmer register than the ranked-list row — this is "browse and trust," not "decide fast."

- Resort name + region, a mono rating readout if present ("8.5/10" — never stars, which would imply
  a different rating system than her own sheet's), a row of `radius.pill` "Best For" tag chips
  (`bg.tint` fill, `text.secondary`, drawn only from the controlled `best_for_tags` vocabulary), and
  if a hot take exists, a single-line truncated preview with the same gold quote-glyph mark used on
  the full block, tapping through to the expanded view.
- Filter/sort controls above the list (region, rating) reuse the tap-chip component — one component
  doing this job everywhere in the app, not a second filter-UI invented for this one screen.

---

## 3. The result card — centrepiece treatment

This *is* the product per Principle 1. It has to be legible and persuasive with zero surrounding
chrome, screenshotted into a group chat at whatever crop the sender happens to take.

**Structure, top to bottom:**

1. **Tiny attribution mark**, top-left, always present: a small mountain-glyph icon +
   "SKI RECO" wordmark (`type.label`, `text.secondary`). This is what lets the card still identify
   its source after three forwards in a group chat with no other context.
2. **Illustration panel** — 4:3, contained *within* the card with padding around it (not full-bleed
   to the card edges). This is a deliberate departure from a travel-poster "photo fills the card"
   treatment: containing the image inside a bordered panel makes it read as one instrument among
   several on the card (alongside the stat strip), not as the card's whole identity. `radius.lg`,
   200px tall mobile / 260px tablet+, `object-fit: cover`. Full spec in §4.
3. **Identity headline** directly below the panel: `type.display.hero` (Baloo 2 ExtraBold, the one
   place this weight is used). The resort's name is set in `brand.primary`; the rest of the sentence
   in `text.primary`. E.g. *"Big Sky is your **Steeps-and-Solitude** Match."*
4. **2–3 reason bullets** (strategy.md §3.5 — never a bare score): each a small filled
   check-circle glyph in `brand.primary` + `type.body.md`, phrased back in the user's own answer
   language.
5. **Stat readout strip** (§2.5): 3–4 stats most relevant to *this* result — vertical drop, skiable
   acres, avg. annual snowfall, cost tier (rendered as a count of `$` glyphs in mono, not a word).
6. **Range Readout** (§5) — present only when the query was flagged `mixed`/`wide-mixed` at Q1.
7. **Nicole's Hot Take block** (§2.4) — present only if she has one for this resort. Absent, not
   placeholder, when she doesn't.
8. **Footer CTA row:** primary button "Plan your own trip →" (routes to the mode-choice splash —
   the first-class re-entry path per strategy.md §1.1) + a secondary text link "See more of
   Nicole's picks →" (routes to Nicole's list).

**The crop-survival rule, stated explicitly for design-builder:** items 1–5 (attribution through
stat strip) must form a complete, persuasive, self-explanatory unit on their own. Many real
screenshots crop right after the visible content on a phone screen, before the fold. The hot-take
block and CTA footer are additive, not load-bearing — the card must not depend on being scrolled to
make its case.

**Container:** `bg.surface`, `radius.xl`, `shadow.lg`, 1.5px `border.hairline`, `space.5` padding
mobile / `space.8` desktop, `max-width: 30rem` (480px) even on desktop — the card stays
phone-card-shaped everywhere, so a desktop screenshot still crops into the same recognisable object
a phone screenshot would. This is a deliberate structural echo of a boarding pass — dense,
credibility-carrying facts in one compact, warm, non-tabular object (the cross-domain reference
design-scout flagged in the inspiration doc).

---

## 4. Illustration spec

### 4.1 Constraint: generated art must sit inside the token system, not fight it

Three fixed **palette rotations**, each built only from system accent tokens (fill-strength
variants, not the AA-darkened text variants), assigned deterministically per resort by hashing the
resort's `id` (`hash(id) % 3`) — the same hashing mechanism the CSS/SVG fallback uses (§4.3), so a
resort's fallback and its eventual generated art land in the same colour family and the swap is
invisible.

| Rotation | Ink | Primary | Secondary | Highlight | Best for |
|---|---|---|---|---|---|
| A — "Alpine Cold" | `#17102B` | `#00B39A` (teal) | `#0E7AA6` (cold-blue) | `#FFC22B` (gold) | Big-vert, alpine, exposed terrain |
| B — "Treed Rolling" | `#17102B` | `#0F8E63` (mint-deep) | `#5B3DF0` (indigo, as dusk sky) | `#FF5A3C` (coral, as light catch) | Tree-skiing, rolling, town-based resorts |
| C — "Big Vert Dramatic" | `#17102B` | `#5B3DF0` (indigo) | `#0E7AA6` (cold-blue) | `#FFC22B` (gold) | Isolated, high-alpine, backcountry-adjacent |

### 4.2 Image-generation prompt template

```
A bold, flat digital illustration of {RESORT_NAME}, a {CHARACTER_SCALE} ski resort with
{TERRAIN_TYPE} terrain in a {SETTING} setting. Style: a confident modern outdoor-brand
illustration system — the precision of a trail map crossed with a contemporary app icon.
NOT a cute mascot illustration, NOT a children's book, NOT a travel poster.

Palette: exactly 4 colours — {INK_HEX} as the only outline/dark colour, {PRIMARY_HEX} and
{SECONDARY_HEX} for terrain and sky, {HIGHLIGHT_HEX} used once, sparingly, as a single light
catch (a sun, a groomed trail line, light on a ridge) — against a white or very pale
background. No gradients except one optional soft 2-stop sky gradient. No pastel tones, no
candy saturation — accents should read like technical outdoor-gear colour, not toy colour.

Linework: one consistent 2px outline in {INK_HEX} on every major shape edge. Confident and
geometric. Not sketchy, not wobbly, not hand-wavy.

Shapes: peaks and ridgelines as {PEAK_STYLE}. {TREE_DENSITY} simple repeated
triangular/rounded conifer shapes — never individually detailed. {TOWN_ELEMENT}. Optional:
1–2 thin offset contour-line paths tracing a ridge, echoing a topographic trail map — the
system's signature graphic device.

NO human figures, NO mascots, NO faces. This is a portrait of a place, not a character.

Composition: horizontal 4:3. Peak(s) fill the upper two-thirds. A flat, undetailed
negative-space band across the very top, reserved for UI overlay — do not paint detail
there. Simple flat foreground plane across the bottom third. No storm clouds, no exposed
cliffs shot from a dramatic angle, no photographic realism anywhere — flat vector throughout.

Slot values —
CHARACTER_SCALE: big-vert | rolling | mid-size
TERRAIN_TYPE: alpine/exposed | tree-skiing | mixed
SETTING: isolated/backcountry-feel | classic mountain town | purpose-built village
PEAK_STYLE: "tall angular faceted peaks with visible rock/couloir lines" (big-vert/alpine) OR
  "rolling layered ridgelines with rounded tree-covered slopes" (tree-skiing/rolling)
TREE_DENSITY: heavy | sparse | none above treeline
TOWN_ELEMENT: "a small cluster of 2–4 simple geometric roofline shapes at the base" (if a real
  base village exists) OR omit entirely (isolated/backcountry-adjacent resorts — an empty,
  quiet base is the correct read for these)
```

**Worked examples:**
- *Big Sky, MT* → Rotation C. CHARACTER_SCALE=big-vert, TERRAIN_TYPE=alpine/exposed,
  SETTING=isolated/backcountry-feel, TREE_DENSITY=sparse, TOWN_ELEMENT=small village cluster
  (Big Sky has a real, if compact, base village).
- *Wilmot Mountain, WI* (a Nicole's-list day-trip hill, not in the recommender pool, but useful as
  a contrast case) → Rotation B. CHARACTER_SCALE=mid-size, TERRAIN_TYPE=mixed,
  SETTING=purpose-built village (or omit town element if none), TREE_DENSITY=sparse,
  PEAK_STYLE=rolling.

### 4.3 CSS/SVG fallback — the app must look complete with zero generated images

Every resort gets a deterministic inline-SVG placeholder before any generated art exists, built
from the same rotation logic as §4.1 so nothing ever looks broken or generic-grey.

- `hash(resort.id) % 3` picks the palette rotation. `hash(resort.id) % 6` picks one of six fixed
  silhouette variants (peak count/arrangement — alternating single-peak, twin-peak, and
  layered-ridge SVG paths).
- Each fallback: 2–3 flat layered triangular/rounded peak shapes in `Primary`/`Secondary` at
  90%/60% opacity, a single `Highlight`-coloured light-catch accent on the tallest peak, and 2 thin
  offset contour-line paths (the same "signature device" called out in the prompt template) so the
  fallback and the generated art share a visual signature, not just a palette.
- Rendered inline (not an `<img>`) so it inherits `currentColor` where useful and needs no network
  request — this is what keeps the app "complete" offline or before an illustration pipeline exists.
  See the specimen page for a working implementation across all three rotations.

---

## 5. Mixed-ability display — the "Range Readout"

Strategy.md §3.2 is explicit: mixed-ability scoring is a **min-max bottleneck**, not an average —
the resort's score is the *worse* of its floor-fit and ceiling-fit, deliberately never smoothed into
a middling number. No existing UI pattern shows this well (a single slider or score would silently
re-introduce the averaging the whole model exists to reject), so this is original component work.

**Concept:** two labelled endpoints on a static, read-only spectrum — never an interactive
slider or drag control (this is *output*, not input; Marcus's and Nicole's "no sliders, no drag"
constraint governs *inputs*, but the component is still built to be unambiguously non-interactive —
no drag handle affordance, no hover-grab cursor — so nobody mistakes it for a control they're meant
to operate).

- **Track:** a flat horizontal bar, 5 segments matching the difficulty spectrum
  (never-ever → beginner → intermediate → advanced → expert), each segment tinted with a
  low-opacity version of its `trail.*` colour, each with a small shape glyph (circle / circle /
  square / diamond / double-diamond) beneath it — same shape-plus-label system as every other
  difficulty indicator in the app, applied here too.
- **Two markers:** a filled circle pin at the group's *floor* (lowest selected skill level from
  Q2a) and a filled diamond pin at the group's *ceiling* (highest selected level), each with a text
  flag above it stating the level in words ("Beginner" / "Expert") — position on the track is
  never the only signal.
- **The bridge — the actual differentiator:** a filled bracket shape spans from floor to ceiling.
  Where the underlying min-max logic found strong support (both `beginner_friendliness`/
  `family_ski_school` for the floor, and `terrain_pct.advanced_expert`/`best_for_tags` for the
  ceiling), the bridge renders **solid**, in `brand.primary` at full strength. Where either end is
  weak — the actual bottleneck the scoring model is built to catch — that half of the bridge
  renders **dashed and desaturated**, with a small warning glyph (▲!) and an inline label right at
  the weak end (e.g. "thin beginner terrain here"). A resort with a strong ceiling and a weak floor
  shows a confident solid line collapsing into a visibly broken one exactly where the group's
  weakest member would feel it — the visual literally mirrors the "minimum of the two" logic instead
  of hiding it behind a single blended number.
- **Two plain-language sentences below the bridge, always present regardless of how the graphic
  renders** (redundant, never graphic-only): "Beginners: [assessment, drawn from `beginner_note`]."
  / "Experts: [assessment, drawn from `character_note`/`best_for_tags`]." When the floor is weak,
  this sentence is written honestly negative — "Beginners: This mountain leans expert — the green
  terrain is mostly base-area connector runs, not real learning terrain" — never softened into false
  reassurance (Principle 5).
- **Accessibility:** the whole component carries one `aria-label` stating both ends as a sentence
  for screen-reader users, so the information is never visual-only: *"Group range: floor is
  beginner, well served — strong ski school and dedicated learning terrain. Ceiling is expert, well
  served — real advanced and tree terrain."*
- **Placement:** inside the result card, directly below the stat strip, whenever Q1 was answered
  `mixed` or `wide-mixed`. A compact single-line variant (just the two sentences, no graphic bridge)
  appears in Chase-the-Snow ranked-list rows when the optional mixed-ability toggle is used there.

---

## 6. Responsive behaviour

Mobile-first throughout — the real cold-start path is a link opened inside a DM, on a phone.

**Breakpoints (min-width, content-driven not device-driven):**
- **320px (floor):** must render without horizontal scroll or clipped text. Single-column
  everything. Tap-chip grids stack to 1 column. Region grid (Q4) stacks to 1 column with generous
  row height rather than shrinking to fit.
- **380px:** tap-chip 4-option screens go to a 2×2 grid. Region grid goes to 2 columns.
- **600px:** region grid goes to 3 columns. Stat readout strip goes to 3 columns.
- **768px (tablet):** bottom tab nav becomes a top horizontal nav. Stat readout strip goes to 4
  columns. Quiz/list surfaces get a centred `max-width: 40rem` (640px) reading column instead of
  stretching edge-to-edge.
- **1024px+ (desktop):** the result card itself does **not** grow past `max-width: 30rem` (480px) —
  it stays phone-card-shaped and centred, so a desktop screenshot crops into the same recognisable
  object a phone screenshot does. Everything *around* the card (page chrome, nav) uses the extra
  width; the card itself never does.

**200% zoom / 320px-width survival, concretely:**
- All type and spacing tokens are consumed in `rem`, never fixed `px`, so both OS-level zoom and a
  user's own base-font-size preference scale type *and* spacing together — a stat tile at 200% zoom
  gets proportionally more padding, not clipped text in a fixed box.
- Grids use `grid-template-columns: repeat(auto-fit, minmax(...))`, not hardcoded column counts, so
  a 4-column stat strip collapses to 2 or 1 column automatically as effective viewport shrinks under
  zoom — never overflows, never needs a horizontal scrollbar.
- No fixed-height text containers anywhere — `min-height` only, so reflowed text at 200% zoom pushes
  a card taller instead of clipping.
- Touch targets stay ≥44px in real terms at any zoom level, since they're defined in `rem` against
  the same root as everything else.
- Horizontal scrolling is banned as a required interaction anywhere in the app. The one place a
  scrollable row is used (an optional filter-chip carousel, if design-builder needs one for the
  region grid on very narrow viewports) must have a visible scroll affordance and a non-scroll
  "more filters" fallback — scrolling is never the only way to reach an option.

**Navigation:** a 3-item bottom tab bar (Plan / Chase / Nicole's List) below 768px, each tab
icon-plus-label always (never icon-only — redundant labelling matters for Priya's jargon-sensitivity
and for anyone under cognitive load), each tab ≥44px tall with safe-area-inset padding for notch
devices. Moves to a top horizontal bar ≥768px. **Never present on the result screen itself**, per
Principle 1 — confirmed structural rule, carried through responsive spec.

---

## 7. Accessibility, integrated

- **Contrast:** every foreground/background pairing in §1.2/1.3 is independently computed and meets
  WCAG AA at minimum (most hit AAA); dark-mode accents were re-verified against the dark background
  directly, not derived by inverting the light-mode values.
- **Colour is never the sole indicator of meaning, anywhere:** difficulty (shape + label, §2.1's
  radio/check shape distinction, the Range Readout's solid/dashed bridge + warning glyph), status
  (crowd flag = glyph + text, feasibility = dimming + explicit label, Canada tier = banner + inline
  tag), selection (border + fill + shape + icon + weight, five redundant signals per chip).
- **Touch targets:** 44×44px absolute floor; tap-chips ship at 56px min-height in practice, with a
  12px minimum gutter between adjacent targets. No sliders, no drag gestures, no precision-timing
  interactions anywhere in either quiz flow — confirmed against Marcus's tendinitis and Nicole's
  cold-gloved-hands scenarios. The Range Readout, which visually resembles a slider, is explicitly
  built and styled as a non-interactive, read-only display (no drag handle, no grab cursor) so it
  never gets mistaken for an input.
- **Focus indicators — the recipe (dark/light-mode safe):**
  ```css
  :focus-visible {
    outline: none;
    box-shadow:
      0 0 0 2px var(--bg-page),      /* cutout ring, matches whatever the surrounding bg is */
      0 0 0 5px var(--brand-primary); /* 3px visible ring in brand indigo */
  }
  ```
  This two-layer technique guarantees the ring is visible against any adjacent background colour,
  light or dark, since the inner ring always matches the immediate page background token and the
  outer ring uses `brand.primary`, independently verified at 6.23:1 (light) / 4.61:1 (dark) —
  comfortably clears the 3:1 non-text UI-component contrast minimum against both.
- **200% zoom:** see §6 — rem-based type/spacing, `auto-fit` grids, `min-height` not `height`.
- **Motion:** `prefers-reduced-motion: reduce` strips all transform/scale/parallax; only
  opacity cross-fades remain, at the fast (160ms) duration.
- **Screen readers:** progress indicator carries `role="progressbar"` with a live `aria-valuetext`;
  the Range Readout carries one summarising `aria-label`; every icon-only glyph (crystal/droplet,
  crowd-flag, signal-slash, warning-triangle) has an adjacent text equivalent already in the visible
  layout — nothing is icon-only even for sighted users, so nothing needs an invisible-only
  `aria-label` to carry meaning alone.
- **Cognitive load (Priya, stolen fifteen-minute windows):** every screen is legible from a cold
  start — no screen depends on remembered context from a previous screen. Jargon ("vert,"
  "corduroy," "groomers") is a content-writer concern but the visual system supports it: stat labels
  are always paired with the raw value *and* enough surrounding context (unit, comparison) that a
  first-timer doesn't need outside knowledge to read the number as good or bad news — this is a
  handoff note for content-writer, not something the token system alone solves.

---

## 8. Open questions / flags carried forward

- The Range Readout (§5) is genuinely new UI with no direct precedent — worth a synthetic-user-test
  pass specifically with the Marcus persona ("does this actually make you feel like you can justify
  the pick to four other opinions in a group chat?") before it's treated as final.
- No formal product name exists yet — "Ski Reco" is used as a placeholder wordmark in the
  attribution mark (§3), matching the project's own working title. Flag for the Director: worth a
  real name before the attribution mark ships, since it's the thing that survives every screenshot.
- Dark mode is spec'd to trigger on `prefers-color-scheme` by default; a manual in-app toggle is not
  required for v1 but the token architecture supports one without rework if design-builder wants it.
- The three illustration palette rotations (§4.1) are a first pass tuned for the resort character
  spread actually in `resorts.json` (alpine/exposed, tree-skiing/rolling, isolated/backcountry) —
  worth spot-checking against a wider sample of the 54 resorts once real illustrations start
  generating, in case a fourth "purpose-built village / groomer-heavy" rotation turns out to be
  needed.
