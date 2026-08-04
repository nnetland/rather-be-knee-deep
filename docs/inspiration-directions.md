# Three Visual Directions — Ski Reco App

_Inspiration Scout · 2026-08-03 · Companion to `/home/claude/ski-reco/design/inspiration-directions.html`_

Nicole asked to see options before committing to a direction, rather than choosing from a
written list of adjectives. This document (and its companion HTML page, which renders these
three directions visually — colour swatches, live type specimens, an SVG approximation of
each illustration style, and a mock of the actual result card) presents three genuinely
different ways to make the app feel "modern and playful," aimed at the real audience: newer
skiers, families, and mixed-ability groups — not expert powder hounds.

**Taste profile note:** No formal taste-calibration pass has run yet for this project
(`design-taste` hasn't been invoked). These directions are built against the Director's one
clear stated signal — "modern and playful" — plus the brief's explicit non-negotiables: no
black-and-white powder photography, no Jackson Hole "you must be this good" energy, no
colour-only difficulty encoding. Once a direction is chosen, run `design-taste` to calibrate
more precisely before the full build.

---

## Direction 01 — Chairlift Poster

**Core idea:** Borrow the flat-colour, confident-silhouette language of vintage national-park
and ski-resort travel posters, but swap their forest-green/maroon palette and stern typography
for something brighter and rounder. **Feeling:** being handed a postcard from a trip you
already want to take — nostalgic enough to feel special, friendly enough to feel like an app.

### Colour palette
| Hex | Role | Contrast note |
|---|---|---|
| `#FBF3E7` | Background (warm cream) | — |
| `#FFFFFF` | Surface / card | — |
| `#2B2320` | Ink | 14:1 on bg (AAA) |
| `#D65F3B` | Accent — poppy (headlines, CTA) | AA-large on cream; white-on-poppy AA-large — reserve for bold/large text |
| `#2E6E62` | Accent — pine (secondary) | 5.4:1 on cream (AA), safe for body-sized text |
| `#4C7A9E` | Accent — sky | AA-large on cream; white-on-sky AA |
| `#F2B705` | Accent — gold (tag fills) | ink-on-gold is 8.5:1 (AAA); never used as text colour itself |
| `#C9B79C` | Hairline / border | — |

### Typography
- **Display / resort name:** Bevan, Regular, 56/60 (36/40 mobile) — a slab serif cut for
  vintage packaging and travel-poster lettering; carries the era without tipping into pastiche.
- **H2:** Bevan, Regular, 32/38
- **H3 / stat labels:** Nunito Sans, ExtraBold, 15/20, +2% tracking
- **Body:** Nunito Sans, Regular, 17/26
- **Small / caption:** Nunito Sans, SemiBold, 13/18

Both load free from Google Fonts CDN with a light payload.

### Shape language
Flat geometric mountain silhouettes (triangular peaks, 2–3 layered ridgelines). Cards: 14–16px
corner radius (softened, not sharp, not fully rounded). No blurred drop shadows — depth comes
from a hard 6px flat-colour offset behind the card, like a screenprint registration trick. 2px
ink outline around card edges. Subtle paper-grain texture; light halftone dots allowed only in
sky areas.

### Motion character
**Settled, deliberate.** Cards ease in like a poster being pinned to a board — no bounce, no
overshoot. Gentle parallax drift of layered mountain silhouettes on scroll. Quiz transitions:
unhurried cross-fade with a slight upward settle, never a spring.

### Illustration style — resort avatar (prompt-template-ready)
> A flat vector travel-poster illustration of [RESORT], in the style of 1930s–50s American
> ski and national-park travel posters, softened and warmed for a contemporary audience.
> **Palette:** exactly 4–5 flat colours drawn only from #FBF3E7, #D65F3B, #2E6E62, #4C7A9E,
> #F2B705, #2B2320 (outlines only). No gradients. **Linework:** bold 3–4px ink outline on every
> shape. **Abstraction:** geometric, simplified mountain silhouettes; 2-tone flat shading only
> (one darker plane per shape, no soft blends); if a human figure appears, it's 3–4 clean
> shapes with no facial detail — this reads as a *place*, not a scene with characters.
> **Composition:** horizontal, generous negative space at top for text overlay, no cliffs /
> storm clouds / exposed rock — slopes stay rounded and inviting, deliberately excluding
> extreme-terrain visual cues.

### Reference points
- **Anderson Design Group** — contemporary National Park poster revival. Take: proof this idiom
  translates to a modern, mass-market audience without feeling like a museum piece; their
  warmer, slightly playful colour choices over strict WPA orthodoxy are the model.
- **Vintage Sun Valley & Alta ski posters** (1930s–50s ski-travel poster tradition). Take: the
  flat mountain silhouette plus bold poster type lockup, and the "come ski here" invitational
  tone. Leave: the era's exclusivity — these posters sold ski trips to the wealthy; our version
  needs to feel accessible to a first-timer, not aspirational-elite.
- **Charley Harper** — geometric wildlife illustration, National Park Service commissions.
  Take: his discipline of reducing a subject to the fewest possible flat geometric shapes while
  staying instantly recognisable. Leave: his palette is often muted/earthy; run warmer and
  brighter here.

### Who it serves / risks
**Serves best:** first-timers and families — the reassurance persona. Inherently
non-intimidating, needs zero ski expertise to appreciate, cleanly avoids every
hardcore-ski-culture trap. **Risks:** executed too literally, can skew "grandpa's ski lodge"
instead of modern; carries a faint aspirational-travel association that can sit oddly against
a quick tap-only quiz; needs real distinctiveness to avoid looking like every WPA-poster Etsy
shop.

---

## Direction 02 — Base Camp Bright

**Core idea:** Borrow the shape and colour discipline of the best 2020s consumer apps
(Duolingo, Headspace, Cash App) — bold, rounded, confidently few colours, legible at a
thumbnail. **Feeling:** a well-loved app you already trust, applied to a fun subject instead
of a chore. This is the safest, most unmistakably "modern app" of the three.

### Colour palette
| Hex | Role | Contrast note |
|---|---|---|
| `#FFFFFF` | Background | — |
| `#F1ECFF` | Surface — lavender tint | — |
| `#1B1035` | Ink | 17.9:1 on white, 15.5:1 on lavender (AAA) |
| `#6C4DF6` | Accent — brand purple | white-on-purple 5.2:1 (AA) |
| `#FF5A5F` | Accent — coral (energy) | large/bold text or fills only |
| `#B6F0D1` | Accent — mint (positive) | ink-on-mint AAA |
| `#FFD23F` | Accent — yellow (highlight) | ink-on-yellow AAA |
| `#00786B` | Accent — teal, darkened for text use | white-on-teal 5.4:1 (AA). Brighter decorative teal `#00A896` reserved for fills only, not text |

### Typography
- **Display / resort name:** Baloo 2, ExtraBold (800), 44/48 (32/36 mobile) — a rounded
  display face popular across ed-tech, friendly at large sizes without reading childish.
- **H2:** Baloo 2, Bold (700), 28/34
- **H3 / stat labels:** Manrope, Bold (700), 13/18
- **Body:** Manrope, Regular (400), 16/24
- **Small / caption:** Manrope, Medium (500), 13/18

### Shape language
Very rounded corners — 24–32px "squircle" superellipses, fully pill-shaped buttons/tags. Soft,
colour-tinted drop shadows (never plain grey) instead of borders. Organic blob shapes behind
hero content for depth. No hairline strokes — shapes defined by fill and shadow.

### Motion character
**Springy, bouncy.** Elements pop in with scale-overshoot easing. Small confetti-burst moment
on the result reveal. Tags/icons wiggle subtly on tap. The one direction where a celebratory
micro-animation feels native rather than gimmicky.

### Illustration style — resort avatar (prompt-template-ready)
> A bold, flat digital illustration of [RESORT] in the style of contemporary consumer-app
> brand illustration (Duolingo / Headspace / Cash App lineage). **Palette:** exactly 4 colours
> — #1B1035 as the only dark/outline colour, plus 2–3 of #6C4DF6, #FF5A5F, #B6F0D1, #FFD23F —
> against white or #F1ECFF. **Linework:** none, or a single consistent thin 2px outline; pick
> one rule and hold it everywhere. **Abstraction:** mountains as soft-cornered rounded shapes,
> no sharp points; 2–4 recognisable elements max, rendered as friendly icons rather than a
> literal landscape; an optional tiny rounded "blob person" with dot eyes, Headspace-style,
> never a realistic figure. Flat fills only, one soft 2-stop sky gradient permitted as the sole
> exception. **Composition:** centred, icon-like, must work cropped to a square or circle —
> doubles as a small avatar thumbnail as well as a hero image.

### Reference points
- **Duolingo brand & illustration system** (design.duolingo.com). Take: the discipline of a
  tiny, consistent colour palette and bold rounded shapes legible from app-icon to billboard
  size. Leave: the mascot-forward, slightly chaotic maximalism — this app's goal is
  credibility, not "reads as a mascot brand."
- **Headspace illustration system** — the rounded "blob people." Take: how simplified,
  nearly-faceless rounded figures make a topic feel human without looking like clip art. Leave:
  Headspace's palette is soft/pastel; run brighter and more saturated to hit "playful."
- **Cash App visual identity** (BUCK-designed system). Take: bold colour-blocking built to be
  endlessly remixable across many small illustrated moments — useful across 54 resort avatars
  that need to read as one family. Leave: the intentionally loud, meme-driven tone; dial back
  for "reassure, don't hype."

### Who it serves / risks
**Serves best:** screenshot virality — most legible-at-thumbnail-size direction, most
unmistakably "modern app," inherently avoids hardcore-ski-culture imagery by being a different
visual category entirely. **Risks:** genericness — this exact rounded/bright/blob language is
extremely common across fintech, ed-tech, and wellness apps right now; risks disappearing into
that crowd. Overused mascot elements can read a little young for an audience planning a
grown-up trip.

---

## Direction 03 — Chalet Riso

**Core idea:** Constrain every illustration to what a real risograph press could actually
print — two ink colours, an overprint third tone, visible grain — and let that constraint be
the whole personality. **Feeling:** a small-batch zine or a screenprinted ticket stub someone
made by hand for you specifically. The most distinctive and least "app-shaped" of the three,
closest to "keepsake object."

### Colour palette
| Hex | Role | Contrast note |
|---|---|---|
| `#F4F1EA` | Background — uncoated paper | — |
| `#EDE6D6` | Surface — card stock | — |
| `#221F26` | Ink | 14.4:1 on paper (AAA) |
| `#0078BF` | Riso — blue | white-on-blue 4.7:1 (AA), safe for buttons/tags |
| `#FF48B0` | Riso — fluorescent pink | fill behind dark ink text only (AA-large), never small text colour |
| `#FFE800` | Riso — yellow | ink-on-yellow 13:1 (AAA) |
| `#FF6C2F` | Riso — orange | ink-on-orange 5.8:1 (AA); white text only at large/bold sizes on the darkened variant `#D14A18` |

This is the one direction where bright-sunlight legibility needs active, ongoing attention —
see risks below.

### Typography
- **Display / resort name:** Fraunces, Italic 600, high optical size, 46/50 (32/36 mobile) — a
  variable "soft serif" with real wonkiness at large sizes; carries handmade character without
  sacrificing legibility.
- **H2:** Fraunces, Regular 500, 26/32
- **Labels / stat chips:** Space Mono, Bold, 12/16, uppercase, +4% tracking — stamped-ticket,
  typewriter feel.
- **Body:** Karla, Regular, 16/24 — carries all actual reading; legibility wins over vibe here.
- **Small / caption:** Karla, Medium, 13/18

All three are free-weight Google Fonts.

### Shape language
Low corner radius (4–8px), mostly square, with one deliberately clipped corner as a signature
detail. No drop shadows — depth from layered flat shapes and visible ink overprint. Dashed
hairline borders imitate a die-cut or deckle edge. Heavy, consistent film-grain texture across
every fill — this texture is load-bearing, never optional.

### Motion character
**Drifting, unhurried.** Elements float and settle like paper cutouts landing on a table —
gentle parallax, staggered fade-and-rise reveals, no bounce, no spring. Page transitions feel
like turning a page in a zine.

### Illustration style — resort avatar (prompt-template-ready)
> A risograph-print-style illustration of [RESORT], built as if hand-separated into exactly 2
> riso ink layers (choose 2 from #0078BF, #FF48B0, #FFE800, #FF6C2F) printed on cream paper
> #F4F1EA, with visible grain, speckle, and a 2–3px registration offset between layers. Where
> the two ink layers overlap, render a third mixed tone (e.g. blue+yellow=green) to simulate
> real overprinting. **Shapes:** cut-paper flat silhouettes with slightly irregular, hand-cut
> (not vector-perfect) edges; one signature clipped/angled corner on the overall composition.
> **Linework:** none — layers are defined by colour and overlap, not stroke. Heavy visible
> halftone/grain on every fill (load-bearing, never omit). No gradients ever — shading is
> halftone dot-density only. **Composition:** slightly off-kilter, asymmetric, framed by a
> rough deckle-edge paper border — reads as a zine cover or ticket stub, not a landscape
> painting.

### Reference points
- **Risotto Studio** (London riso print studio) — public ink swatch library. Take: design
  against their real, published ink colours and let overprint create the third tone — the
  actual constraint that keeps this credible as craft rather than a filter. Leave: adding more
  colours digitally than a real riso press could produce in one run (2–3 max).
- **National Park Print Shop** — risograph outdoor/travel poster collection. Take: proof this
  exact combination (riso + outdoors/travel subject) already reads as premium and collectible,
  not budget. Leave: many of these skew dark, moody forest palettes; this direction needs to
  stay light and bright given the sunlight-legibility constraint.
- **Contemporary zine / small-press editorial design** (deckle edges, stamped tickets,
  staple-bound covers). Take: the "keepsake object" feeling — a card worth printing and pinning
  up, directly serving the brief's "gets screenshotted into a group chat" success criterion.
  Leave: zine culture's sometimes artfully-illegible type; legibility must win over vibe here.

### Who it serves / risks
**Serves best:** differentiation and "share-ability as an object" — the most distinctive and
memorable of the three; its handmade, small-batch quality pairs naturally with "one trusted
human's voice." **Risks:** grain and misregistration can reduce legibility at small size or in
bright sunlight — a real conflict with the brief's "used outdoors on a chairlift" constraint;
needs active taming (lower grain opacity, higher-contrast ink pairs), not left at full
craft-authenticity. Executed too moody, it can undercut the warmth a first-timer needs.

---

## Cross-domain wild card (applicable to all three)

**Airline boarding-pass and ticket-stub design** — not tied to any single direction above, but
worth considering regardless of which visual direction wins. Boarding passes pack dense,
credibility-carrying information (flight, seat, gate) into a small, scannable, good-looking
card with a clear hierarchy and a perforated "stub" motif. That's a strong structural model for
the result card's core problem: combining Nicole's grounded stats with the identity-headline
hot take in one compact, warm object — not a data table with a quote bolted on.

## Accessibility observations carried forward from every direction

All three keep ink-on-background contrast at AAA and never use colour alone to encode
difficulty — shape/word redundancy for terrain ratings still applies regardless of which
direction is chosen, per the brief. Chalet Riso is the one direction whose signature texture
actively works against outdoor/bright-sunlight legibility; if chosen, plan a "toned down" grain
variant for the shareable result card specifically, distinct from the full-craft treatment used
elsewhere in the app.

## What was intentionally not duplicated

Spotify Wrapped, Airbnb's "I'm Flexible," and the staged-reveal / single-hero-card /
identity-language pattern are already covered by design-scout's competitive analysis
(`/home/claude/ski-reco/research/competitive-analysis.md`) as *structural* references. This
document stays in the aesthetic/illustration/type lane and does not re-cover that ground.
