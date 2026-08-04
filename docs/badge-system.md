# Resort Badge System

_design-lead · 2026-08-03 · Replaces the generated-landscape illustration system in
`design/visual-system.md` §4, which design-critic and the Director rejected (soft layered
mountain/sun/house scenes, one composition varying only by silhouette, several rendering green —
"summer, not snow" — and "nothing said place"). Reference: the Director's own NYC UX
Summit sticker set (`SummitSticker.jpeg`) — circular die-cut badges, heavy black outline, flat
saturated colour, one character with a joke, curved type around the lower rim. Companion file:
`design/badge-preview.html`, which renders every motif below as real inline SVG for 44 resorts._

_**2026-08-03, character-craft pass:** the architecture (frame, palette rotation, assignment
engine) was approved and stays exactly as built. This revision is entirely about the drawings —
see §0.1 for the diagnosis, §2 for the now-52-motif library, and §4 for how motif repetition
actually got fixed (expanding the hand-tuned tier, not a smarter rule)._

---

## 0. What changed, and why

The old system's failure was architectural, not just aesthetic: it tried to generate *scenery*
(a mountain, a sun, some houses) and vary it parametrically. Scenery has no joke, no attitude, and
— because every resort's terrain silhouette is a triangle with different bumps — it converges on
sameness no matter how many hash salts you throw at it. The Director's reference solves a
different problem: it draws a *character* with a specific posture and a specific piece of
knowledge about the subject (a pigeon in a propeller beanie for a tech conference, the Statue of
Liberty pulling her sunglasses down for a New York audience). That's not generatable from resort
stats either — it has to be authored — but it composes. A pigeon is a reusable asset; so is a
cowboy hat, a snorkel, a beer can. **The fix is a motif library plus assignment rules, not a
smarter mountain generator.**

This system is not procedural in the sense of "draw a triangle whose height maps to
`vertical_drop_ft`." It's a small library of hand-illustrated characters and props, each with a
fixed meaning, composed onto a badge by rules that read the same tags the rest of the app already
uses (`best_for_tags`, `scale`, `crowd_level`, `cost_tier`, region, `town_vibe`/`character_note`
keywords). The output is deterministic per resort — same input, same badge, forever — because nothing
in the pipeline is random; the only "generation" left is table lookup and composition.

### 0.1 The character-craft pass — diagnosis and fix

The Director re-sent the reference sticker set and named the actual gap directly: **the reference
characters have gesture, ours had pose.** The pigeon is mid-sentence with one finger raised. The
apple is walking, mid-stride, glancing sideways. Liberty is pulling her sunglasses down her nose to
look at the viewer over the top of them. Every reference character is caught *doing something*,
with a joke in the action. The first 28-motif pass drew front-facing, bilaterally symmetrical
figures — arms at sides, eyes centred, staring straight out — which read as icons wearing costumes
rather than characters with attitude.

Two concrete failures came out of that gap:

1. **Motif repetition defeated the brief.** Moose appeared on Lutsen, Afton Alps, *and* Welch
   Village — three Minnesota resorts a user would directly compare, all wearing the same face. The
   root cause was architectural, not a drawing problem: the rule-driven tier's `Region: Midwest →
   Moose` rule (§4.2, prior revision) applied one motif to an entire multi-state region regardless
   of how many resorts in that region actually got shown together. Penguin had the same problem
   across Deer Valley, Sun Valley, and Vail; Mountain Goat across Telluride and Aspen Snowmass; Bro
   across Breckenridge and Park City.
2. **Seven characters didn't read in one second.** Breckenridge and Park City's Bro had a solid
   dark band across the eyes that read as a bandit mask, not sunglasses. Aspen Snowmass's Mountain
   Goat was an ambiguous white blob with rabbit-like ears. Lake Louise read as a larva or a ghost.
   Wolf Creek was unidentifiable. Mt. Baker and Fernie shared a figure with an odd red nose. Taos's
   Roadrunner read as a duck.

**The fix, in order:**

- **Redraw every motif with a gesture and a viewpoint** — three-quarter or profile angles,
  asymmetric poses, off-centre pupils, mid-action framing, props being *used* rather than held.
  Applied throughout §2.
- **Roughly double the motif count** (28 → 52: see §2) so genuinely distinct characters exist for
  genuinely distinct resorts, instead of stretching one moose across an entire region.
- **Promote most repetition-prone resorts into the hand-tuned tier.** This is the actual repair for
  problem #1 above, and it is not a new mechanism — the prior spec's own §9 said "any resort where
  the rule engine's output feels wrong or generic [is] a candidate for promotion into the
  hand-tuned tier." Regional motif repetition is exactly that case, systematically. The assignment
  engine's code is otherwise untouched: same priority-ordered rules, same accent composition, same
  adjacency-based palette dedupe. See §4 for what stayed rule-driven and why.
- **Redraw the seven named-unclear motifs from scratch**, verified against real screenshots at
  badge scale, not just reviewed as authored SVG. See §2 and the per-motif notes there.

**A second-order lesson from this pass, worth flagging for whoever authors motif #53:** several
early redraws applied a CSS `rotate()` transform to *some* sub-shapes of a motif (e.g. a goggle
band) but not others (e.g. the head it sits on), using slightly different pivot points for each, to
cheaply simulate a "tilted head" gesture. This reliably broke the drawing — the goggles drifted
relative to the face and the result read as a solid dark mask or a formless blob, which is a worse
failure than the plain symmetrical pose it was meant to fix. The examples that actually work in
this library get their gesture from the *drawing itself* (an asymmetric limb, an off-centre pupil,
a genuinely different pose) or from a single rotation applied to the *entire composed layer* via
the existing `box` rotation parameter (see §1), never from independently rotating a subset of a
motif's internal shapes. This is now consistent across the library, but it cost several redraw
cycles to find — screenshot-check any future motif at real badge scale before trusting it, exactly
as §1's existing "vanishing detail" warning already advises for a different failure mode.

---

## 1. Frame spec

Everything lives in a `viewBox="0 0 240 240"` badge, built in three layers:

1. **Outer keyline** — a solid white circle, `r=119`, with a 1px `rgba(0,0,0,0.08)` hairline stroke.
   This is the die-cut sticker edge. The hairline exists purely so the white ring doesn't disappear
   against a white page in light mode — on its own a pure white-on-white edge has zero separation;
   the reference photo gets this for free because it's sitting on a grey marble countertop, we
   don't have that luxury on a white app background. In dark mode the white ring needs no help — it
   separates from a near-black page on contrast alone.
2. **Background disc** — solid flat fill, `r=109`, one colour from the six-hue rotation (§3). No
   gradient, no texture, no vignette.
3. **Motif layer**, clipped to the background disc (`clip-path`, `r=109` circle) so nothing bleeds
   past the keyline: one primary character (occasionally plus one small accent prop, positioned in
   a corner, never more than one accent unless the rules explicitly compose two), then the curved
   type on top of everything.

**Safe area:** the primary motif is authored in a 100×100 local grid and placed centred around
badge-coordinate (120, 106) at ~1.85× scale — deliberately a little above true centre, because the
bottom ~30% of the circle is reserved for the type arc and a character whose feet/base sit at true
centre reads as visually low and cramped against the curved text. Accent props (medals, no-board
slashes, corduroy texture) are placed in the upper-right or lower-right quadrant at roughly half
scale so they never compete with the primary motif for attention.

**Curved type:** resort name + region, uppercase, set along a `path` arc across the lower third of
the circle (`M 34,168 A 96,96 0 0 0 206,168`), Manrope ExtraBold 800, white fill with a soft dark
paint-order stroke halo (`rgba(0,0,0,0.22)`, 2.5px) so it stays legible regardless of which of the
six background hues it lands on — amber and teal are light enough that plain white text loses a
little contrast without the halo; indigo and coral don't need it but get it anyway for one
consistent rule rather than a hue-dependent special case.

- Font size steps down for longer labels so nothing collides with itself around the arc: 15.5px
  under 22 characters, 12.5px up to 30, 10.5px up to 38, 9px beyond that. This is a real bug I hit
  building the preview — "ARAPAHOE BASIN · ROCKIES, CO" at a fixed 15.5px very nearly overlaps its
  own tail — and it's exactly the kind of thing a spec has to state explicitly rather than leave to
  "should be fine," because the dataset has resort names from four characters (Alta) to over thirty
  (Whistler Blackcomb · BC, Canada).
- Label format is `RESORT NAME · REGION`. Region is the short form already used elsewhere in the
  app's region grid (e.g. "Rockies, CO", "BC, Canada"), not the full `state_province`/`country`
  pair, to keep the arc shorter.

**Outline weight:** every motif shape carries a single consistent ink stroke —
`stroke-width: 4.5` at the 100×100 authoring scale, round joins and caps, colour `#17102B` (the
existing `color.purple.900` ink token, reused as-is — see §7 on why this didn't need a new "true
black" token). This is deliberately heavier than anything else in the app's line-weight vocabulary;
it's the single most important lever copied from the reference, and it's what makes a badge read at
a glance as "sticker" rather than "app icon."

**One real bug worth flagging for design-builder:** a small, brightly-coloured detail (the
penguin's beak, originally an 8×10-unit triangle) sitting directly on the ink-filled head all but
disappeared in the first build pass — the inherited 4.5-width ink stroke, drawn centred on the
shape's own edge, ate almost the entire tiny fill area and visually fused it into the black head
behind it. Fix: any motif detail smaller than roughly 12 units across that sits on an ink-filled
base needs `stroke="none"` explicitly, or needs enlarging so the fill survives its own outline.
This is now correct in every motif in `badge-preview.html`, but it's a real trap for anyone adding
a 29th motif later — screenshot-check new details at actual badge scale, not just in isolation.

---

## 2. Motif library (52 motifs — 42 characters incl. fallback + 10 accents)

Every motif is authored with its **own fixed local colour palette** (skin/fur tones, one or two
garment colours, ink, white), independent of the badge background hue — exactly like the
reference, where the pigeon is always grey/blue/orange no matter which colour badge it's on. Only
the *background disc* cycles through the six-hue rotation (§3). This is what keeps a badge
recognisable and consistent as a character rather than a colour-swapped template.

**What's new this pass:** every character below now has a stated gesture and viewpoint (three-
quarter, profile, tilted head, off-centre gaze), not just a static front-facing pose. Seven motifs
were fully redrawn because they didn't read at a glance (marked **REDRAWN**); the rest of the
original 18 were either kept as-is (already at the quality bar) or had a gesture/asymmetry added
without changing their identity. 24 motifs are entirely new, most drawn to a specific Director
request (marked **Director's request**) or a specific resort's real character_note/town_vibe.

### Characters carried over from the first pass (18)

| Motif | Reads as (gesture updated) | Status |
|---|---|---|
| **Cowboy Skier** | Tips his hat, leaning into a turn, one arm out for balance | Kept, gesture strengthened |
| **Bro** (backwards cap) | Fist pump, 3/4 lean | **REDRAWN** — the dark goggle band read as a bandit mask (Breckenridge, Park City). Now two separate lens shapes with a visible skin gap and nose bridge |
| **Snorkel Powder Hound** | Wide "whoa" mouth, asymmetric goggle eyes | Kept (Director's own Mount Bohemia example), minor asymmetry added |
| **Yeti** | Striding, one arm raised in a wave | Gesture added; arm previously read as an unclear smear, simplified to one clear stroke |
| **Mountain Goat** | Bust with a ridged backswept horn and a visible chin-tuft beard | **REDRAWN twice** — the first redraw (a leaping multi-shape composition) was less legible than the original; the second redraw uses the same proven bust template as Coyote/Wolf and reads clearly |
| **Marmot** (tailgate) | Sunglasses, holding a beer, sitting on a tailgate | Kept verbatim — quality bar, see below |
| **Penguin** (bow tie) | Jaunty wave with a cane, head cocked | Gesture added |
| **Golden Retriever** (goggles) | Tongue out, ears mid-flop | Kept, minor asymmetry |
| **Fox** (beanie) | Content half-closed eyes | Kept in reserve (unused in this 44-resort set; still the "quiet default") |
| **Roadrunner** | Small head, spiky topknot crest, long S-neck, long pointed beak, sprinting legs | **REDRAWN** — read as a duck (Taos). The old version's rounded body and short neck were the problem; a roadrunner's silhouette is *defined* by the crest + long neck + long legs, none of which were legible before |
| **Polar Bear** (parka) | Shielding its eyes, gazing at big terrain | Gesture added |
| **Moose** (flannel/scarf) | Reused across Stowe (New England) and Lutsen (Midwest) — different, non-adjacent region clusters, so this is the *good* kind of reuse (§0.1) | Kept |
| **Wolf** (howling) | Head tilted back, open jaw with visible teeth, pointed ears | **REDRAWN** — read as a walrus (Wolf Creek); the earlier "head thrown back" silhouette collapsed into an ambiguous round shape. Now built on the same bust template as Coyote |
| **Sun Bear** | Sunglasses, relaxed | Kept in reserve (unused in this 44-resort set) |
| **Woolly Mammoth** (Mammoth Mtn pun) | Trumpeting, tusks raised | Gesture added |
| **Puffin** (snow-gun hero, Sunday River) | Wielding a snow gun like a firehose | Kept verbatim — quality bar, see below |
| **The Beast** (bison, Killington) | Tough squint | Kept verbatim — quality bar, see below |
| **Snowball Buddy** (fallback) | Crossed ski poles | Kept verbatim — quality bar, see below |

### New characters this pass (24)

| Motif | Reads as | Why it exists |
|---|---|---|
| **Selfie Skier** | Sunglasses, phone held up for a selfie mid-turn | Park City — needed its own identity so it stopped sharing Bro with Breckenridge |
| **Lasso Cowgirl** | Twirling a lasso overhead, hat pushed back | Steamboat — a second real Western/ranching town that needed to stop sharing Cowboy with Jackson Hole |
| **Fur-Coat Diva** | Sunglasses, champagne flute raised, laughing | Aspen Snowmass — glamorous/après energy, replaces a shared Mountain Goat with Telluride |
| **Swan** | S-curve neck, orange beak, a small hand mirror | Deer Valley — skier-only manicured luxury, replaces a three-way shared Penguin (Vail/Deer Valley/Sun Valley) |
| **Silver Fox** | Round sunglasses on the snout, one eye peeking over the top | Sun Valley — direct homage to the reference's own "glasses pulled down the nose" gag; old-Hollywood/old-money |
| **Powder Diver** | Only two booted legs sticking straight up out of a snowdrift | Mt. Baker and Jay Peak — a snowboarder buried headfirst in powder, reused across two non-adjacent deep-powder cult mountains |
| **Black Bear on a Chairlift** | Riding alone, goggles on, legs dangling | Crystal Mountain — Director's own requested motif |
| **Lobster in a Scarf** | Both claws raised in a cheer | Sugarloaf, ME — Director's own requested Maine regional fauna |
| **Loon** | Gliding, red eye, white neck band, dagger beak | Loon Mountain, NH — direct name pun |
| **Raccoon in a Beanie** | Masked, mid-grin, raiding a snack bag | Afton Alps — Director's own requested motif; fits the scrappy suburban night-ski-hill energy |
| **St. Bernard with a Keg** | Tongue out, tail wagging | Welch Village — Director's own requested motif |
| **Junior Racer** | Aerodynamic tuck, bib number, speed lines | Buck Hill — its real reputation as a US Ski Team racer feeder |
| **Kid on a Magic Carpet** | Arms flung up, riding a conveyor lift | Wild Mountain — Director's own requested motif |
| **Otter** | Belly-sliding, whiskers out | Giants Ridge |
| **Jackalope** | Mid-bound, winking | Andes Tower Hills — Director's own requested motif |
| **Beaver** | Goggles, buck teeth, paddle tail | Whitecap Mountains — Director's own requested motif |
| **Bighorn Sheep** | Curled ram horns (distinct silhouette from Mountain Goat's backswept blades) | Fernie — needed to stop sharing a figure with Mt. Baker |
| **Elk in Ski Goggles** | Branching antlers, calm raised-eyebrow gaze | Lake Louise — Director's own requested motif; replaces the earlier ambiguous larva/ghost read entirely |
| **Coyote** | Sitting, one ear up, sideways glance | Banff Sunshine |
| **Lift-Op with a Shovel** | Mid-toss, snow flying | Powder Ridge — Director's own requested motif |
| **Hockey Player** | Skating with a stick | Reserve — Minnesota "State of Hockey" signal, not yet assigned |
| **Ski Patroller with a Dog** | Rescue-dog pairing | Reserve — safety/rescue signal, not yet assigned |
| **Groomer Driver** | In a snowcat cab | Reserve — night-groomer/long-groomers signal, not yet assigned |
| **Taco Lift Rider** | Eating on a chairlift | Reserve — après/food-culture signal, not yet assigned |

### Objects / accents (10 — compose with a primary character, never stand alone; unchanged)

| Motif | Purpose |
|---|---|
| **Beer Can** | Referenced inside the Marmot's own composition, not used loose |
| **Gondola Cabin** | Reserve — big-vert/large-scale infrastructural accent |
| **Chairlift** | Reserve — family/groomer accent |
| **Pine Cluster** | Tree-skiing accent, composes onto any primary motif when `tree-skiing` is tagged and the primary motif isn't already Moose (which implies trees) |
| **Powder Plume** | Deep-powder accent for primary motifs that aren't already snow-themed |
| **Corduroy Stripes** | Long-groomers background texture, sits *behind* the primary motif |
| **Trophy/Medal** | Olympic-heritage accent (Whistler 2010, Palisades Tahoe 1960) |
| **No-Board Slash** | Skier-only fact accent (Alta, Deer Valley, and any rule-matched `skier-only` resort) |
| **Night-Lamp String** | Night-skiing accent (Afton Alps, Welch Village in this set) |
| **Ribbon Banner** | Reserve — still flagged weak without literal text, see §9 |

**52 total** (18 carried over + 24 new + fallback, = 42 characters, + 10 accents).

### The quality bar (unchanged, still the standard every motif above is checked against)

Sunday River's Puffin with the snow gun, Killington's Beast (bison), A-Basin's Marmot on the
tailgate, and the fallback Snowball Buddy — these four were untouched this pass because they
already had what everything else needed: a specific pose, a prop being used rather than just held,
and a silhouette a stranger names correctly in one second.

---

## 3. Palette rotation

Six saturated background hues, each carrying a fixed meaning rather than being arbitrary — this is
the direct fix for the specific criticism the old system drew ("arbitrary purple-vs-green" palette
assignment).

| Hue | Hex | Meaning |
|---|---|---|
| **Indigo** | `#5B3DF0` | Big-vert, dramatic scale |
| **Coral** | `#FF4C34` | Après / party / high energy |
| **Teal** | `#00B39A` | Deep powder / cold / expert |
| **Mint** | `#16A974` | Tree-skiing / family / quiet |
| **Amber** | `#F0982A` | Western / sun-warmed / rustic / budget / laid-back |
| **Cold-blue** | `#1AA3DC` | Backcountry / remote / alpine |

Assignment logic: **meaning first, adjacency-collision second.** Each resort's palette is chosen by
its primary motif's category meaning (e.g. Snorkel Powder Hound → teal, Penguin → indigo, Bro →
coral). Reuse across *non-adjacent* resorts is expected and fine — two deep-powder cult resorts
(Alta, Mount Bohemia) both landing on teal is a feature, not a bug, since it's the palette doing
its meaning-carrying job consistently. The rule that actually governs is: **no two resorts adjacent
in the render/presentation order share a palette.** The assignment engine runs a deterministic
dedupe pass after meaning-based assignment — if resort *i* and *i-1* collide, *i* is bumped forward
through the six-hue rotation to the next hue that doesn't also collide with *i+1*, never resolved
by randomness. `badge-preview.html`'s engine log shows every bump explicitly (e.g. Taos Ski Valley
bumped from its meaning-default to `cold` because the resort immediately before it in the render
order also landed on the same hue) — nothing is silently reassigned.

---

## 4. Assignment rules

### 4.1 Hand-tuned tier (41 of 44 resorts in this preview) — explicit, not rule-derived

This tier grew from 18 resorts to 41 this pass — see §0.1 for why. Full per-resort motif + palette
+ rationale table in §6. Two things are true at once about this growth:

- These resorts are hand-tuned because their real character signal lives in free-text fields
  (`town_vibe`, `character_note`) and cultural reputation that a tag-based rule engine can't reliably
  parse — "Jackson Hole is a cowboy" isn't derivable from `best_for_tags` containing `steeps`, it's
  derivable from knowing what Jackson, Wyoming actually is. That was always the reason the tier
  existed, for the original 18.
- The *new* 23 additions (everything in §6 not in the original 18) are hand-tuned for a second,
  equally important reason: **regional motif repetition can only be fixed by looking at a whole
  region's resorts together and deliberately assigning each one something different**, which is
  exactly what a first-match-wins rule engine, evaluated one resort at a time with no memory of its
  neighbours, structurally cannot do. Every Midwest resort in this set (9 of them) is hand-tuned for
  this reason — the old `Region: Midwest → Moose` rule (§4.2) would have handed all nine the same
  face otherwise.

Only Okemo, Big White, and Loveland Ski Area are left running through the live rule engine in this
44-resort set, deliberately, so §4.2 still has real, checkable examples (§3 of this document).

### Region repeat-check

`badge-preview.html` runs a live check after assignment: it groups all 44 resorts into six
"region clusters" (Rockies + Wasatch, West Coast, New England, Midwest, Canada, Alaska — the
groupings a user would actually cross-shop on one trip, not the fine-grained state-level `region`
string used for display and rule-matching) and flags any motif used twice within one cluster. As of
this pass: **zero repeats in all six clusters** (15/15, 4/4, 9/9, 9/9, 6/6, 1/1 distinct motifs).
See the `#region-check` panel in the preview, rendered live from the same `ASSIGNED` array the
badges themselves come from, so it can't drift out of sync with what's actually on screen.

### 4.2 Rule-driven tier — priority-ordered, first match wins for the primary motif

Applied to every resort *not* in the hand-tuned table, in this order:

1. **Name pun** — `id` contains "wolf" → **Wolf**. (Wolf Creek, CO.)
2. **Region: high desert Southwest** — `state_province === 'New Mexico'` → **Roadrunner**.
3. **Region: Alaska** — `state_province === 'Alaska'` → **Polar Bear**.
4. **Region: Midwest/Great Lakes** — `state_province` in {Michigan, Minnesota, Wisconsin} →
   **Moose**.
5. **Deep-powder cult signal** — tag `deep-powder` AND (`crowd_level === 'low'` OR
   `scale === 'regional'`) → **Snorkel Powder Hound**.
6. **Steeps + backcountry** — tags `steeps` AND `backcountry-access` → **Mountain Goat**.
7. **Luxury + exclusivity** — tag `luxury` AND (tag `skier-only` OR `cost_tier === '$$$$'`) →
   **Penguin**.
8. **Approachable/family** — tag `beginner-friendly`, OR (tag `family` AND `scale === 'day-trip'`)
   → **Golden Retriever**.
9. **Party energy** — tag `apres-scene` AND `crowd_level` in {high, brutal} → **Bro**.
10. **Quiet default** — tags `quiet` AND `uncrowded` → **Fox**.
11. **Spring-skiing** — tag `spring-skiing` → **Sun Bear**.
12. **Big and dramatic** — tag `big-vert` AND `scale === 'destination'` → **Yeti**.
13. **No match** → **Snowball Buddy** (fallback, §5).

A **Western/ranching-town free-text rule** (matching keywords like "ranch"/"western" in
`town_vibe`/`character_note`) is documented here as part of the full system but is *not* implemented
in `badge-preview.html`'s live engine, which only carries the trimmed tag/scale/region fields — the
preview's rule list is honest about this omission (see its footer note) rather than faking a rule it
can't actually run. At full build time, with the complete `resorts.json` record available,
design-builder should add this as priority-0 (before the name-pun check), since it's exactly the
kind of signal Jackson Hole and Steamboat needed and got via hand-tuning instead. Its absence from
the live rule engine is itself evidence for why the hand-tuned tier exists — free-text character
signal is precisely what a tag-only rule engine can't catch.

**On rule 4 (`Region: Midwest/Great Lakes → Moose`) specifically:** this rule is the one that
caused the repetition failure documented in §0.1, and it is left unchanged in the code for this
pass because every Midwest resort in this 44-resort preview is hand-tuned (§4.1) and never reaches
it. It is **not safe to leave as-is for the full 71-resort rollout** — Michigan/Minnesota/Wisconsin
alone have more resorts in `resorts.json` than this preview shows, and any of them left on the pure
rule engine will collide. design-builder has two real options, not a hard requirement to pick one
here: (a) keep promoting every Midwest resort into the hand-tuned tier as it's added, which is more
work but guarantees a considered choice per resort, matching how this pass fixed the problem; or
(b) replace the single-motif region rules (Midwest, and rule 2's Southwest → Roadrunner, which has
the same latent issue at smaller scale) with a small deterministic **motif pool** per region — e.g.
`[Moose, Raccoon, Beaver, Otter, Jackalope, Loon, St. Bernard]` for the Midwest — selected by a
hash of `resort.id`, with a second dedupe pass (structurally identical to `dedupeAdjacentPalettes`
in §3, but keyed by region cluster instead of render adjacency) bumping any collision to the next
pool motif. Option (b) is the more scalable fix and is the recommended one if the Midwest/Southwest
resort count keeps growing, but it wasn't built for this pass because nothing in the current
44-resort set would exercise it — building an untested code path isn't better than documenting the
fix clearly, which is what this note is.

**Accent composition** (independent of primary-motif rule, all can stack, but keep to one accent
per badge in practice — see §1 on visual crowding):

- tag `night-skiing` → **+ Night-Lamp String**
- tag `skier-only` (and primary motif isn't already Penguin, which implies it) → **+ No-Board
  Slash**
- tag `tree-skiing` (and primary motif isn't already Moose) → **+ Pine Cluster**
- tag `deep-powder` (and primary motif isn't already Snorkel Powder Hound) → **+ Powder Plume**
- `character_note` mentions "Olympic" → **+ Trophy/Medal**

### 4.3 Palette-by-motif default mapping

`snorkel→teal, goat→cold, penguin→indigo, retriever→mint, bro→coral, fox→mint, sunbear→amber,
yeti→indigo, polarbear→cold, moose→amber, roadrunner→amber, wolf→cold, snowball→teal` for the
carried-over motifs; new motifs each got a single meaning-based default chosen the same way (e.g.
`powderdiver→cold`, `stbernard→mint`, `juniorracer→amber` — full mapping in
`badge-preview.html`'s `PALETTE_BY_MOTIF`, and per-resort choices with rationale in §6) — then the
adjacency dedupe pass (§3) runs over the final presentation order exactly as before.

---

## 5. Fallback

A resort with no strong tag/region/name signal gets **Snowball Buddy** — a round white snowball
character with two dot eyes, a small closed smile, a tiny knit cap in the badge's own accent
colour, and crossed ski poles beneath. It is never empty, never a generic mountain silhouette, and
never visually "less" than a rule-matched badge — it's a fully realised character, just a more
universal one, on the same frame, same outline weight, same curved type. Palette defaults to teal
but is still subject to the adjacency dedupe pass like every other badge.

This is deliberately **rare by design**, not a common case papered over. In the 44-badge preview
set, only one real resort (Loveland Ski Area — big-vert, budget, uncrowded, long-groomers,
easy-flight, `scale: regional`) genuinely fell through every rule un-staged; a second badge
("Example Ridge") is included purely as a synthetic worked example so the fallback path is visible
without having to go hunting for a second thin-signal resort in the live data. That rarity is
itself a signal the rule set is doing real work — most resorts in this dataset earn a real
character, which is the point.

---

## 6. Hand-tuned assignments (41)

Grouped by region cluster (§4.1) so the "no repeat within a cluster" claim is checkable by reading
straight down this table, not just by trusting the live repeat-check panel.

### Rockies + Wasatch (14 hand-tuned; Loveland runs the rule engine — see §5)

| Resort | Motif | Palette | Why |
|---|---|---|---|
| Jackson Hole | Cowboy Skier | Indigo | One of the largest continuous verticals in North America — big-vert/dramatic |
| Alta | Snorkel Powder Hound + No-Board Slash accent | Teal | Deep-powder cult flagship, skier-only since founding — a real, citable fact |
| Arapahoe Basin | Marmot (tailgate, holding a beer) | Amber | Scrappy, budget, "The Beach" — the Director's own "beer on a tailgate" example |
| Big Sky | Yeti | Indigo | 4,350 ft vertical yet cited as uncrowded relative to CO/UT peers |
| Vail | Penguin | Coral | America's largest single mountain, but coral for its lively, crowded après scene rather than a colder "quiet luxury" read |
| Telluride | Mountain Goat | Cold | One of the most remote major US resorts — genuinely backcountry-feeling despite being lift-served |
| Steamboat | **Lasso Cowgirl** | Mint | A second real Western/ranching town — a distinct character (cowgirl, not cowboy) so it stops sharing Cowboy Skier with Jackson Hole, differentiated further by pose, palette, and label |
| Aspen Snowmass | **Fur-Coat Diva** | Coral | Glamorous, `apres-scene`-tagged, four-mountain grandeur — a wholly new motif so it stops sharing Mountain Goat with Telluride |
| Breckenridge | Bro (redrawn) | Coral | "For the bros" — the Director's own hot take, taken literally; redrawn to fix the earlier bandit-mask read (§0.1) |
| Wolf Creek | Wolf (redrawn) | Teal | Independently owned, most consistent natural snowfall in CO — redrawn so it reads as wolf, not walrus |
| Taos Ski Valley | Roadrunner (redrawn) | Amber | High-desert Southwest region rule, redrawn with a real crest/neck/beak so it reads as roadrunner, not duck |
| Park City Mountain | **Selfie Skier** | Indigo | Largest US resort by acreage, shortest major-resort airport drive — a distinct "here for the 'gram" character so it stops sharing Bro with Breckenridge |
| Deer Valley | **Swan** + No-Board Slash accent | Indigo | Utah's only skier-only Epic-to-Ikon defector, manicured/ski-valet luxury — new motif so it stops sharing Penguin with Vail and Sun Valley |
| Sun Valley | **Silver Fox** | Amber | America's first destination resort (1936), old-Hollywood/old-money — direct homage to the reference's own "glasses pulled down the nose" gag |

### West Coast: Sierra + Cascades (4 hand-tuned)

| Resort | Motif | Palette | Why |
|---|---|---|---|
| Palisades Tahoe | Golden Retriever + Medal accent | Coral | Family/terrain-park/après energy, plus its own 1960 Olympic heritage |
| Mammoth Mountain | Woolly Mammoth | Amber | The direct name pun; also genuinely sun-warmed, laid-back spring-skiing energy |
| Mt. Baker | **Powder Diver** | Cold | World snowfall record, deliberately undeveloped, cult favourite — a snowboarder buried to the boots so it stops sharing Snorkel Powder Hound with Alta/Mount Bohemia |
| Crystal Mountain | **Black Bear on a Chairlift** | Teal | Big-vert, deep-powder, family + terrain-park — the Director's own requested motif |

### New England (8 hand-tuned; Okemo runs the rule engine — see §5)

| Resort | Motif | Palette | Why |
|---|---|---|---|
| Stowe | Moose (scarf) | Mint | Quiet, tree-skiing, historic New England charm |
| Killington | The Beast (bison) | Amber | "Beast of the East" — Killington's actual nickname, illustrated literally |
| Sunday River | Puffin (snow-gun hero) | Cold | One of the East's most extensive snowmaking systems — heroics as a literal cold/ice joke |
| Jay Peak | Powder Diver | Teal | Vermont's snowiest, most cult deep-powder mountain — same joke as Mt. Baker, different (non-adjacent) region cluster, differentiated by palette/label |
| Sugarloaf | **Lobster in a Scarf** | Cold | Remote, uncrowded, big-vert Maine backcountry — Maine regional fauna, the Director's own request |
| Loon Mountain | **Loon** | Mint | The direct name pun; family/budget/easy-flight |
| Stratton | Bro (redrawn) | Coral | Après-scene, terrain-park, easy-flight — same energy as Breckenridge, different (non-adjacent) region cluster |
| Powder Ridge | **Lift-Op with a Shovel** | Amber | Small, scrappy, reopened-after-closure day hill — the Director's own requested motif |

### Midwest (9 hand-tuned — see §0.1 for why this cluster needed the most attention)

| Resort | Motif | Palette | Why |
|---|---|---|---|
| Lutsen Mountains | Moose (flannel) | Amber | Budget, regional, drive-to Midwest charm on Lake Superior's North Shore |
| Mount Bohemia | Snorkel Powder Hound | Teal | The Director's own example — "wild-eyed in a snorkel" — ungroomed, expert-only, no-snowmaking cult mountain |
| Afton Alps | **Raccoon in a Beanie** + Night-Lamp accent | Coral | Twin Cities suburban night-ski hill, scrappy/budget — a raccoon "raiding" a cooler is exactly that energy |
| Welch Village | **St. Bernard with a Keg** + Night-Lamp accent | Mint | Family-owned, unpretentious, locally loved day hill — the Director's own requested motif |
| Buck Hill | **Junior Racer** | Amber | A tiny (45-acre) hill with an outsized reputation as a US Ski Team racer feeder |
| Wild Mountain | **Kid on a Magic Carpet** | Mint | Family day hill that doubles as a summer waterpark — the Director's own requested motif |
| Giants Ridge | **Otter** | Cold | Quiet, remote Iron Range recreation area — Minnesota's state bird (loon) was already claimed by Loon Mountain, NH, so this cluster gets the otter |
| Andes Tower Hills | **Jackalope** | Amber | Small, remote, unusually steep west-central MN hill — the Director's own requested motif |
| Whitecap Mountains | **Beaver** | Teal | Wisconsin's snowiest resort by its own marketing, near Lake Superior — the Director's own requested motif |

### Canada: BC + Alberta (5 hand-tuned; Big White runs the rule engine — see §5)

| Resort | Motif | Palette | Why |
|---|---|---|---|
| Whistler Blackcomb | Bro (redrawn) + Medal accent | Cold | North America's largest resort by acreage and lift-served vertical, 2010 Olympic host |
| Fernie Alpine Resort | **Bighorn Sheep** | Mint | Five alpine bowls, real non-corporate mountain-town feel — a distinct silhouette from Mountain Goat via curled ram horns, so it stops sharing a figure with Mt. Baker |
| Lake Louise | **Elk in Ski Goggles** | Indigo | Some of the most photographed alpine scenery in North America, inside Banff National Park — replaces the earlier ambiguous larva/ghost read entirely; the Director's own requested motif |
| Revelstoke Mountain Resort | Mountain Goat | Cold | Steeps, big-vert, deep-powder, genuinely backcountry — the same meaning as Telluride's Goat, different (non-adjacent) region cluster |
| Banff Sunshine | **Coyote** | Cold | Deep-powder, quiet, big-vert in the Banff backcountry |

### Alaska (1 hand-tuned)

| Resort | Motif | Palette | Why |
|---|---|---|---|
| Alyeska Resort | Polar Bear | Cold | Alaska's only full-scale destination resort — literal extreme cold, remote, backcountry-adjacent |

**Note on intentional motif reuse across (never within) a region cluster:** Bro appears three times
(Breckenridge, Stratton, Whistler Blackcomb), Golden Retriever twice more via the rule engine
(Okemo, Big White), Moose twice (Stowe, Lutsen), Snorkel Powder Hound twice (Alta, Mount Bohemia),
Mountain Goat twice (Telluride, Revelstoke), Powder Diver twice (Mt. Baker, Jay Peak). Every one of
these pairs is non-adjacent *and* in a different region cluster — no user comparing "resorts near
me" would ever see two of them side by side — and every pair shares a real, correct truth (both are
genuinely après/party towns, both are genuinely family-friendly, both are genuinely deep-powder cult
mountains). That is the system working as intended, per §3's original principle. The failure mode
this pass fixed was never reuse itself — it was reuse *within* a cluster a user would actually
cross-shop, which now checks out at zero across all six (§4.1).

---

## 7. Token evolution

The reference's flat saturation and heavy outline are bolder than `visual-system.md`'s existing
palette, which was tuned for **AA text contrast** (body copy, links, small UI). A badge background
is a **large solid fill**, not text, so it can and should run more saturated than any of the
existing `accent.*.text` tokens — those are deliberately darkened/desaturated to pass 4.5:1 as
running text and would look muddy as a sticker background. Rather than invent an unrelated colour
system, the badge tier borrows hue families that already exist and adds exactly what's missing:

**Reused as-is (no change):** `color.indigo.600` (`#5B3DF0`) for the Indigo badge fill, `color.
coral.500`-adjacent (`#FF4C34`, a hair more red than the existing `#FF5A3C` fill token — see below)
for Coral, `color.teal.400` (`#00B39A`, already documented as "bright fill only") for Teal, ink
(`color.purple.900`, `#17102B`) for every outline, unchanged.

**New global primitives added, all in the existing naming convention:**

| New token | Hex | Why it didn't already exist |
|---|---|---|
| `color.mint.500` | `#16A974` | Existing mint tokens are either a pale fill (`mint.200`) or a dark fill (`mint.900`) — nothing in the *saturated mid-green* register a bold sticker background needs |
| `color.warm.500` | `#F0982A` | Existing warm-amber tokens (`warm.600`/`700`) are text-safe-on-dark shades, intentionally muted; badges needed a genuinely punchy amber |
| `color.cold.500` | `#1AA3DC` | Existing cold-blue tokens are a deeper, more muted glacier-blue; badges needed a brighter sky-blue with more energy |
| `color.coral.450` | `#FF4C34` | A hair more red than `coral.500` (`#FF5A3C`), so Coral doesn't read as near-identical to Amber at badge scale — the two needed to separate more than they do as text tokens |
| `color.sand.300` / `.500` / `.800` | `#F0C89A` / `#E0A868` / `#7A4E28` | New neutral family for skin tones and warm fur/wood (cowboy, bro, marmot, moose, mammoth, roadrunner beak/legs) — nothing in the existing palette covers warm neutral tones at all, since the app previously had no illustrated figures |
| `color.stone.300` / `.600` | `#E7E4DE` / `#8D897F` | New neutral family for cool fur/snow tones (yeti, goat, polar bear, wolf) — same gap, cool register |
| `color.brown.700` | `#6B4423` | Added this pass — a darker warm-brown than `sand.800` covers, needed for otter and beaver's slick/dark fur (both read as muddy-tan and lost their silhouette against `sand.800`-toned props when first tried at that lighter value) |

This is a deliberate, scoped addition — nine new primitives, all neutrals or badge-fill variants,
none replacing or conflicting with an existing semantic token. Nothing about the in-app token
system (§1–§3 of `visual-system.md`) changes; `accent.gold` still means "Nicole's voice only"
everywhere in the app proper. The badge system is a self-contained subsystem exactly the way the
old illustration system was scoped in `visual-system.md` §4 — it borrows the family, not the rules.

---

## 8. Accessibility

- **Alt text / screen-reader description, never colour-only:** every badge SVG carries a `role="img"`
  with a `<title>` (`"{Resort Name} badge"`) and a `<desc>` that states the actual character content
  in plain language plus the background's *meaning*, not its hex — e.g. *"a wide-eyed skier in ski
  goggles and a snorkel on a deep powder / cold / expert background."* This is generated from the
  same `MOTIF_DESC` table that drives the visual, so the text and the picture can never drift apart.
  See `badge-preview.html`'s `MOTIF_DESC` object and `buildBadgeSVG()`.
- **Contrast:** curved type is white with a soft dark stroke halo (§1) so it clears legibility
  against all six backgrounds without needing per-hue special-casing. The white keyline plus subtle
  hairline stroke keeps the badge's own edge legible against both a white page and a near-black
  dark-mode page — verified in both themes in `badge-preview.html` (theme toggle in the header).
- **Never relies on hue alone for identity:** the curved resort name + region text is present on
  every badge regardless of palette, so identity never depends on being able to distinguish teal
  from mint — a genuinely useful redundancy for deuteranopia (Jordan's persona), not just a nice-to-have.
- **Legibility at scale:** verified at 72px (group-chat thumbnail), 96px (list row), and 200px (hero
  card) using the same unredrawn SVG — see `badge-preview.html` §1 "Frame spec, at real thumbnail
  scale." The heavy 4.5-unit outline and large flat colour fields are exactly what survives
  down-scaling that fine detail wouldn't; that's a second, independent reason (beyond matching the
  reference) to keep the outline this heavy rather than tastefully thinning it. This pass's redraws
  were verified the same way, at real badge scale via rendered screenshots, not just reviewed as
  authored SVG — see §0.1 for what that caught that source review alone missed.

---

## 9. Open items for design-builder / next pass

- **The Midwest/Southwest single-motif region rules need a real fix before the full rollout**, not
  just more hand-tuning — see the detailed note under §4.2. This is the single most important open
  item from this pass: the *symptom* (Lutsen/Afton Alps/Welch Village all wearing Moose) is fixed
  for the 44 resorts shown here, but the *rule* that caused it is still in the code, unexercised
  rather than repaired, because nothing in this preview's data reaches it. Do not add a 45th Midwest
  or New Mexico resort to the live rule engine without either promoting it to hand-tuned or building
  the motif-pool-plus-dedupe fix described in §4.2.
- **Four character motifs are drawn but not yet assigned to any resort in this set** — Hockey
  Player, Ski Patroller with a Dog, Groomer Driver, and Taco Lift Rider — kept in reserve for
  resorts whose strongest signal matches them once the full 71 are assigned (a hockey-culture
  Minnesota hill, a resort whose `character_note` foregrounds ski patrol/rescue, a long-groomers
  resort where "the groomer driver" is genuinely part of local lore, an après-heavy resort with a
  strong food-truck/lift-dining reputation).
- **Gondola Cabin and Chairlift motifs are drawn but unused** as accents in the current 44-badge set
  — kept in reserve for resorts whose strongest signal is genuinely infrastructural (a famous
  tram/gondola) rather than a character. A couple of destination resorts (Jackson's tram, Palisades'
  gondola-to-Alpine-Meadows) could arguably carry one of these as a *second* accent rather than
  relying on character alone — not done here to keep each badge to one clear read.
- **Ribbon Banner motif is drawn but flagged weak** — without literal legible text at thumbnail
  scale it reads as a generic decorative flourish rather than communicating anything ("EXPERT ONLY,"
  "EST. 1938"). Either commit to it with real (larger, higher-contrast) inline text and accept the
  space cost, or retire it from the library. Still not used.
- **The Western/ranching-town free-text rule** (§4.2) is specified but not implemented in the
  preview's simplified engine, which only has trimmed tag/scale/region fields available. Needs
  wiring against the real `town_vibe`/`character_note` strings in `resorts.json` when this moves
  from preview to production — see the note in §4.2 for exactly why this matters and isn't just a
  nice-to-have.
- **Full 71-resort rollout:** this spec and preview now cover 44 resorts (41 hand-tuned + 2
  rule-driven + 1 genuine fallback + 1 synthetic fallback demo), chosen specifically to include
  every named-failing resort from the Director's brief and a full 9-resort Midwest cluster. The
  remaining ~27 resorts should run through the same process this pass used: try the rule engine
  first, and treat any resort where its output feels wrong, generic, *or collides with another
  resort in the same region cluster* as a candidate for hand-tuning — the region repeat-check panel
  in `badge-preview.html` is built to make that last case impossible to miss as more resorts are
  added, not just a one-time check for this pass.
- **Motion:** badges are static in this spec. If motion-designer wants a share/reveal treatment
  (e.g. a badge "stamping" into place on the result card), the frame's three-layer structure (ring →
  disc → motif+type) is already separable and would support a staged reveal without redesign — flagged
  as a handoff opportunity, not specified here.
