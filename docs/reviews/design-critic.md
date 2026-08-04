# Design Critique — Rather Be Knee Deep

_design-critic · 2026-08-03 · Reviewed against `docs/designpowers/strategy.md`,
`docs/designpowers/briefs/2026-08-03-scope-revision-1.md`, `design/visual-system.md`,
`design/copy-deck.md`, `design-state.md`, `build/build-notes.md`. Verified against the actual
build (`build/rather-be-knee-deep.html`) via Playwright/Chromium — full quiz walkthroughs, Chase
the Snow, Nicole's List, code inspection of `build/src/engine.js` and `build/src/illustrations.js`,
and a 240-run headless simulation of the matching engine — not from the spec alone.

## Summary

The architecture, token system, copy, and honest-data handling are executed with real discipline —
this is a well-built app that gets most of the hard calls right (the min-max Range Readout, the
Canada two-tier list, null-field handling, the zero-chrome result card). But three defects
undermine the two things this product is actually for: **being trustworthy** and **being
screenshotted**. The hot-take tie-break confirmed-and-quantified boosts resorts regardless of
whether Nicole's opinion of them is good or bad — and I found a second, worse instance of the same
failure class where the Range Readout's own generated copy directly contradicts Nicole's Hot Take
on the same card. Separately, Nicole's List — a full surface, not an edge case — overflows
horizontally at every width the spec claims to support, hiding her actual hot takes off-screen.
Verdict: **revise**, not rethink — the fixes are scoped and the foundation underneath them is sound.

---

## 1. Hot-take sentiment is ignored — CONFIRMED, and worse than the reported case

**strategy.md §3.3, tie-break 1:** "Presence of a Nicole hot take — a resort **she's actually
vouched for** outranks one she hasn't." The word "vouched for" is doing real work in that sentence
— it means an endorsement. The implementation does not check for one.

`build/src/engine.js:287`:
```js
const withTake = tied.filter((s) => s.resort.hot_take);
```

This is a pure presence check. There is no sentiment field anywhere in the data model —
`hot_take.rating` is `null` for all 9 resorts that have a take (confirmed by inspecting
`build/src/data.js`) — so there is no signal available to distinguish a vouch from a warning even
if someone wanted to check one.

**Reproduced in the actual app**, not just in theory: the reported case (Breckenridge) screenshots
cleanly in `build/screenshots/result-light-390.png` — three glowing "Why this one" bullets,
immediately followed by Nicole's own words: *"For the bros. BUSY. Cute downtown strip. One of my
least favorite places in CO - just too obvious."* I also reproduced this live via a full quiz
walkthrough for a different answer combination and got a second case (see §2 below).

**Quantified, not anecdotal.** I classified the 9 existing hot takes by sentiment: Breckenridge,
Beaver Creek, Keystone, Steamboat, Crested Butte, and Big Sky all carry a negative or genuinely
mixed-to-negative caveat ("one of my least favorite," "no real advanced terrain," "a little vanilla
... pretty inefficient," "windy and cold. No major airport access"). Only Aspen Snowmass, A-Basin,
and Copper Mountain read as net-positive. I then ran the actual matching engine (`matchTrip`)
headlessly across 240 varied trip-planner answer combinations (all four group types, all four
budgets, three origins, all four vibes):

- Resorts with **any** hot take are 12.7% of the 71-resort pool (9/71) but won **40.0%** of the 240
  runs (96/240) — a 3.1x overrepresentation driven entirely by the tie-break, since presence alone
  is what's being rewarded.
- Breckenridge alone — the specific resort Nicole calls "one of my least favorite places in CO" —
  won **9.6%** of all 240 runs (23/240). That is not a rare edge case; that is a resort a
  meaningful fraction of real users would see as their "one solid pick," with her own negative take
  attached to it on the same card.

**Severity: critical.** This directly contradicts Principle 2 ("the take gives the numbers a
reason to be trusted") — here the take actively gives the user a reason to *distrust* the pick —
and it undermines success criterion #2 ("recommendations are genuinely good — accuracy over
polish") in a way that's structural, not incidental, since it recurs across roughly 1 in 10 runs of
a common answer shape.

**Recommended fix:** the tie-break needs a real sentiment signal, not a presence check. Two viable
paths, in order of preference:
1. **Cheapest and most honest:** add a lightweight sentiment field to the hot-take data model
   (`hot_take.sentiment: "positive" | "mixed" | "negative"`, hand-tagged by Nicole or
   content-writer against the 9 existing takes — trivial effort at this volume) and filter
   tie-break 1 to `sentiment === "positive"` (or `!== "negative"` at minimum). This keeps the
   "quarantined, never-generated" rule intact — no NLP, no inference, just an editorial field
   alongside the text, exactly the kind of honest metadata the rest of the schema already uses.
2. If no sentiment field ships in time: **drop tie-break 1 entirely** rather than ship a mechanism
   that provably promotes resorts Nicole doesn't rate. A random or anti-repetition-only tie-break
   among comparably-scored resorts is strictly safer than one that's confirmed to sometimes pick
   the resort she likes least.

---

## 2. A second, compounding instance: the Range Readout's own copy contradicts the Hot Take

Not asked for in the brief, but found while verifying finding 1 live: I ran the trip-planner quiz
end-to-end (wide-mixed group, never-skied + expert, mixed terrain, mid-range budget, driving from
Denver, family vibe) and got **Keystone** as the top pick. On that card:

- **Range Readout, "For more experienced skiers": "A real strength."** Body text: *"Experts:
  Colorado's earliest-opening and one of its latest-closing resorts, with the state's largest
  night-skiing operation."*
- **Nicole's Hot Take, same card, a few hundred pixels below:** *"Great for families, tons of
  reasonable lodging, **no advanced terrain**."*

These are not a difference of opinion — they're a direct factual contradiction on the exact same
claim (does Keystone have real expert terrain), generated by two parts of the same card, shown to
the same user in the same view. Root cause, `build/src/app.js:530`:
```js
: `Experts: ${resort.character_note || "Real terrain to push into."}`
```
The Range Readout's "for experts" sentence pulls verbatim from `resort.character_note` whenever the
ceiling tier scores `strong`/`decent` — but `character_note` is a general "one fact about this
place" field (season length, night-skiing volume for Keystone), not necessarily a statement about
terrain difficulty at all. It gets pressed into service as expert-terrain evidence regardless of
whether it actually says anything about terrain, and Keystone's `terrain_pct.advanced_expert: 49%`
is apparently generous enough to score the ceiling as "strong" even though Nicole — someone with
real local knowledge — says flatly there's no advanced terrain there.

This traces back to `design/visual-system.md` §5's own copy pattern ("Experts: [assessment, drawn
from `character_note`/`best_for_tags`]") — the spec itself licenses this misuse, so the fix belongs
partly with design-lead, not only design-builder.

**Severity: critical.** This is the exact scenario Marcus's persona (deputised to justify a pick to
a group that disagrees) would get burned by — he'd screenshot a card that looks confident and
internally coherent, and the first person in the group chat who knows Nicole's take on Keystone
would call it out immediately. That's not a hypothetical; it's what I found on the first live
end-to-end run I did with a mixed-ability answer set.

**Recommended fix:** when a resort has a hot take, the Range Readout's floor/ceiling assessment
sentences should be checked against it — at minimum, never source the ceiling/floor sentence from
`character_note` for a resort that also has a hot take without cross-referencing; better, prefer
`beginner_note`/a dedicated expert-terrain note over the generic `character_note`, since
`character_note` was never scoped as a terrain-quality field. Longer-term: this is the same
underlying problem as finding 1 — the app has no mechanism for detecting when its algorithmic
narrative and Nicole's actual voice disagree — and both should be fixed by the same
sentiment/cross-check pass, not patched independently per surface.

---

## 3. Illustration differentiation — CONFIRMED at the exact resorts that matter most

Assessed against the original brief's requirement #4 ("gave people a feeling of the place") and
against `build/screenshots/illustration-grid.png`. Scale differentiation genuinely works — Buck
Hill and Powder Ridge read immediately as small day-trip hills next to Big Sky and Alyeska. That's
real and worth keeping.

Character differentiation does not hold up, and I traced the specific mechanism in
`build/src/illustrations.js`. Palette rotation is `hash(id) % 3`, silhouette variant is
`hash(id) % 6` — two outputs of the *same* hash on the *same* input, so any resort pair whose IDs
collide on both moduli renders as visually the same illustration template. I confirmed this is not
rare among exactly the resorts most likely to be recommended and screenshotted:

```
rotation-silhouette 2-2: Vail, Palisades Tahoe, Crystal Mountain, Whistler Blackcomb, Alyeska Resort
rotation-silhouette 0-3: Aspen Snowmass, Park City Mountain, Revelstoke, Kicking Horse, Copper Mountain
rotation-silhouette 0-0: Telluride, Winter Park, Jackson Hole, Heavenly, Lake Louise
```
Five of the dataset's most recognizable destination names — Vail, Whistler, Palisades Tahoe,
Crystal Mountain, Alyeska — share the literal same palette *and* the literal same peak-count/
arrangement. Beyond the hash collisions, `massingFor()` clamps `heightFactor` to 0.82 for any
destination resort with `vertical_drop_ft > ~2900`, and `jaggedness` is a binary 1-or-0.4 switch —
so most "big-vert" destination resorts (the category a user is most likely to land on and most
likely to recognize by name) converge toward the same silhouette geometry even before the hash
collision compounds it.

The remaining differentiators (tree density: 3 buckets, town: village/lodge/none, a couloir-line
flourish gated on the `steeps` tag) are real but thin, and none of them touch the thing that would
actually distinguish "Vail" from "Whistler" to someone who's skied both. The aesthetic itself —
translucent overlapping triangle fills, a flat solid-circle sun, identical grey rectangle-plus-
triangle "houses" — reads as a diagrammatic system chart, not a place portrait. It's competent
token-system output, not something a person screenshots into a group chat *because of* the art.

**Severity: major**, not critical — the illustration doesn't break trust or correctness the way
findings 1–2 do, but it is explicitly named as the shareable centrepiece and it's the weakest
element relative to the rest of the system's craft bar.

**Concrete fixes, not "improve the illustrations":**
1. **Decorrelate the two hashes.** Use `hash(id) % 3` for palette and `hash(id + "-shape")` (a
   second, differently-salted hash) `% 6` for silhouette — trivial change, immediately breaks the
   Vail/Whistler/Palisades/Crystal/Alyeska collision without touching the visual language.
2. **Widen the massing range for destination big-vert resorts specifically** — right now
   `vertical_drop_ft` differences above ~2900ft are invisible (clamped to the same 0.82 ceiling).
   Raise the ceiling or switch to a log/percentile scale against the dataset's own vertical-drop
   distribution so a 3,450ft resort and a 5,280ft resort (Vail vs. Whistler, respectively) are
   visibly different mountains, not the same clamped shape.
3. **Add one more real differentiator tied to a field nobody's using yet** — `best_for_tags`
   already distinguishes `deep-powder`/`steeps`/`tree-skiing`/`terrain-park`, but nothing in the
   illustration currently reads `luxury` (Vail, Whistler, Jackson Hole, Deer Valley all carry this
   tag) vs. `budget`/`skier-only` (Alta) — a village-density or architectural-refinement cue tied to
   `luxury` vs. plain lodge shapes for `budget`/`skier-only` resorts would do real work distinguishing
   exactly the pairs currently colliding.
4. **Retire the flat solid-circle sun and the identical grey-box houses** as the two most
   "diagram, not portrait" signals — even a two-tone sun (disc + thin ring) and 2-3 varied roofline
   silhouettes (already partially parameterized via `roofCount`, underused) would move this further
   from "chart" toward "illustration."

---

## 4. "The numbers" section — CONFIRMED ragged, and worse than one screenshot suggests

Confirmed at `build/screenshots/result-light-390.png`, and it's not isolated to that one instance —
I found the same raggedness independently in `build/screenshots/final-result-nohottake-check.png`
(Mont Tremblant) and `build/screenshots/weak-tier-visual.png` (Jackson Hole), and in a fresh live
run (Keystone). The pattern is structural, not a one-off content collision:

- The strip splits into two visually separate grid blocks (3-col "headline stats + cost" block,
  then a second 3-4-col block for crowds/pass/ski-school/off-mountain), and the second block
  regularly has an **empty trailing cell** — Keystone's live render has 7 stats in an 8-slot 2×4
  grid, leaving a visible blank box bottom-right. An "instrument panel" that has a gap in it reads
  as broken, not precise.
- Cell height is entirely at the mercy of caption length with no equalization: "CROWDS — Usually
  crowded" (2 words) sits directly beside "OFF THE MOUNTAIN — A few solid options beyond skiing" (7
  words, wraps to 3 lines) in the same row, so row height is set by the longest cell and every
  short cell around it has large uneven whitespace. The null-terrain case is the worst version of
  this: "TERRAIN MIX — Terrain breakdown not published by the resort" (Mont Tremblant) produces a
  visibly taller cell than every numeric neighbor in the same row.
- The "COST" stat is orphaned as its own single-cell second row below the first 3-column block at
  390px rather than integrated into one consistent grid — a visible seam in what's supposed to read
  as "one continuous panel" per `visual-system.md` §2.5.

This directly contradicts the section's own design intent: §2.5 explicitly asks for tiles
"separated by 1px border-hairline dividers rather than each tile being its own bordered/shadowed
card — reads as one continuous panel," and the scope-revision tuning note asks for data
presentation that feels "precise and well-engineered." An uneven grid with a visible gap and
wildly inconsistent row heights is the opposite signal — it reads as a CSS grid that auto-wrapped
without a content strategy, not an instrument panel.

**Severity: major.**

**Concrete fix:** stop mixing numeric single-line stats and prose-length stats (crowds, ski school,
off-mountain, terrain-not-published) in the same `auto-fit` grid tier. Split into two tiers with
different column behavior: (1) a fixed-height numeric tier (vertical drop, acres, snowfall, cost,
terrain %) where every cell is genuinely one line plus one caption line, sized identically; (2) a
second "notes" tier for the prose-length fields (crowds, pass, ski school, off-mountain) laid out
as a simple 2-column label/value list, not a symmetrical grid — prose doesn't belong in a grid built
for numbers. This also solves the orphan-cell problem, since a label/value list doesn't need to
resolve to a clean rectangle the way a grid does.

---

## 5. Nicole's List — horizontal overflow, not caught by the build's own verification

Found while checking whether Nicole's List "earns its place" as a browsable, trustworthy surface.
The build's `test.js` asserts zero horizontal overflow at 320px "through the splash → quiz →
multi-select flow" (`build-notes.md`) — that check never touches Nicole's List. I ran it directly:

```
viewport 320px: scrollWidth − clientWidth = 112px overflow
viewport 390px: scrollWidth − clientWidth =  42px overflow
```

Screenshot at 320px (`/tmp/rv-nicoles-overflow-320.png`, reproduced from a fresh run) shows the
table's fourth column — **"Nicole's Take," the entire reason this surface exists** — pushed
entirely off the right edge of the viewport, with no visible scroll affordance. A user on a small
phone sees "PLACE / REGION / BEST FOR" column headers and has no on-screen cue that a fourth column
exists at all.

This is a direct, confirmed violation of `visual-system.md` §6's explicit floor requirement ("320px
(floor): must render without horizontal scroll or clipped text... Horizontal scrolling is banned as
a required interaction anywhere in the app... must have a visible scroll affordance and a non-scroll
fallback"), and it undercuts this surface's entire job (§1.4: "browse and trust") for exactly the
personas most likely to hit it on a phone — Priya (stolen fifteen-minute windows, would give up
rather than hunt for a hidden column) and Dana (low vision — a narrow, silently-clipped column is
the worst-case failure mode for her).

**Severity: critical** — this isn't a cosmetic nit, it's a whole surface's core content becoming
inaccessible at the floor breakpoint the design system explicitly commits to supporting.

**Concrete fix:** the resort-row table needs its own responsive treatment distinct from the
splash/quiz flow's — either (a) collapse to a stacked card layout below ~600px (name, region, tags,
then the take preview as its own full-width block beneath, matching the "resort row" description in
§2.8's prose rather than a literal 4-column `<table>`), or (b) keep the table but make the container
horizontally scrollable with a visible affordance and pin the "Place" column, per the spec's own
carve-out for "the one place a scrollable row is used." Given the take-preview truncation issue in
finding 6 below, (a) is the better fix — it solves both problems in the same layout change.

---

## 6. Nicole's List hot-take preview renders as a jagged single-word column, not the spec'd "single-line truncated preview"

Related to, but distinct from, finding 5. Inspecting the DOM directly for the Breckenridge row: the
JS-level truncation is correct (`"For the bros. BUSY. Cute downtown strip. One of my least f…"` —
a proper word-safe ellipsis). But the containing table cell is `max-width: 220px` with no
`white-space: nowrap` / `text-overflow` handling, so that already-truncated string wraps across
5–6 lines inside the narrow column, each holding roughly one word ("For t / bros / BUS / Cute /
dow / strip..." as rendered). The screenshot in `build/screenshots/nicoles-light-390.png` shows this
directly.

This defeats the purpose of doing string-level truncation at all — `visual-system.md` §2.8 asks for
"a single-line truncated preview," and what's shipped is a tall, ragged, hard-to-scan column that's
worse for scanning than either a true single line or the full untruncated text would be.

**Severity: major**, compounding finding 5 — both point to the same root cause (the table layout
wasn't tested at real mobile widths with real content lengths) and should be fixed together via the
card-layout change recommended in finding 5.

---

## Craft assessment against the taste profile

The taste direction (Base Camp Bright, tightened toward "confident/energetic, never cute") is
executed with real fidelity in the parts of the system I could verify directly: ExtraBold is
genuinely reserved for the one specified use (result-card hero name), IBM Plex Mono tabular figures
give the numeric readouts the "instrument" read the spec asks for, hairline borders read crisp in
both light and dark screenshots, the colour-to-meaning discipline (gold = only Nicole, trail colours
= only difficulty) holds up across every screen I checked, and motion/reveal restraint is evident
(no bounce, no confetti, visible in every screenshot). The Range Readout's solid/dashed bridge
mechanism (`build/screenshots/weak-tier-visual.png`) is genuinely excellent, original component
work — it makes an abstract scoring rule (min-max, never averaged) visually legible without
resorting to a blended number, and the honest, unhedged copy at the weak end ("This is the dataset's
clearest case of a famous resort that is NOT a good beginner match...") is exactly the register the
copy deck asks for. This is the best single component in the build.

Against that same bar, the illustration system (finding 3) and the numbers grid (finding 4) are
the two places craft visibly drops — not broken, but flatter and less considered than the token
system around them, and in the illustration's case, falling short of a brief requirement rather than
just an aesthetic preference. Would this sit next to Duolingo/Cash App/Headspace-tier execution
(the Base Camp Bright lineage)? The result card's typographic and colour discipline would. The
numbers grid and the illustration grid, as currently shipped, would not.

---

## Persona walkthrough

- **Priya** (first-timer, non-native speaker, cognitive load): the primary trip-planner path is
  genuinely well-paced — plain language throughout, one decision per screen, generous tap targets,
  clear progress. She succeeds on the primary journey. She would struggle on Nicole's List
  specifically (findings 5–6) if she followed a "See more of Nicole's picks" link off a result card.
- **Dana** (family organiser, low vision/glare): the token system's contrast work and shape+label
  redundancy genuinely serve her on the core flow. Nicole's List's silent horizontal clipping
  (finding 5) is closer to a worst-case failure for her than for most other personas — content
  disappearing off-screen with no affordance is exactly the kind of failure a screen-magnification
  or low-vision user hits hardest.
- **Marcus** (deputised to justify a pick to a disagreeing group, motor constraint): the Range
  Readout is built for exactly his use case and mostly delivers — but finding 2 (Keystone's
  contradiction between the Range Readout's "a real strength" and Nicole's "no advanced terrain")
  is precisely the failure mode that would burn him in front of the group he's trying to convince.
  This is the single sharpest persona-specific risk in the build.
- **Jordan** (powder hound, deuteranopia): Chase the Snow passes his ten-second test — immediate
  ranked list, no preamble, shape+text forecast badges, honest fallback badge. He succeeds. Minor
  note: several rows share near-identical reason text ("Cold, light snow + terrain to match")
  across resorts with different scores, which is a small tell against the "precise, engineered"
  read Jordan would notice and value.
- **Nicole** (Director, success criterion #4): the Canada two-tier list works exactly as specified
  and would show her real home resorts honestly. But finding 1 is the scenario most likely to
  actually reach her personally — if she runs her own trip planner and gets Breckenridge with her
  own dismissive quote attached as a "solid pick," that's a direct hit to the credibility premise
  the whole product exists to protect, from the one person whose trust in it matters most.

---

## What's genuinely good — don't break this in the fix round

- The min-max Range Readout component (`build/src/app.js`, the bridge rendering logic) — original,
  correctly honest at the weak end, and the single strongest piece of craft in the build.
- Null `terrain_pct` handling — confirmed in the live app (Mont Tremblant) as an honest em-dash +
  "not published by the resort" caption, never a blank or a zero.
- Canada two-tier list — confirmed live, clearly labeled, correctly separated, matches spec.
- Historical-forecast fallback badge and copy — matter-of-fact, non-alarming, exactly per the
  content-writer's "no apology" rule.
- Zero nav chrome on the result screen — confirmed absent across every result screenshot, Principle
  1 holds.
- Per-row day-trip/international badges on Nicole's List, with correct `aria-label` — confirmed in
  the DOM, matches spec including the accessibility requirement.
- Token/type/colour discipline overall — ExtraBold reserved correctly, mono tabular numerals,
  colour-to-meaning restraint, all verified directly in screenshots, not just claimed.

---

## Minor / Notes (log to Design Debt Register, not blocking)

- **Minor:** Nicole's List's sort-by-rating control (visual-system.md §2.8) is entirely absent, not
  just the rating column — build-notes.md documents dropping the *column* (defensible, since
  `overall_rating` is null in 100% of rows) but doesn't mention dropping the *sort control* itself.
  Should be explicitly flagged to the Director as a documented deviation, ready to reactivate if the
  sheet sync ever adds ratings.
- **Note:** Chase-the-Snow reason text is coarsely bucketed (several distinct-scoring resorts share
  literally the same reason string, e.g. "Cold, light snow + terrain to match") — the underlying
  scores differ but the descriptor language doesn't reflect that gradation. Not misleading, just a
  slightly flatter read than the "precise, engineered" ambition for this mode.

---

## Verdict: **Revise**

Not rethink — the strategy, architecture, token system, copy discipline, and most of the honest-data
handling are sound and well-executed; nothing here requires reworking the brief or the flows. Not
proceed — three critical, confirmed, reproducible defects sit directly on top of this product's two
central claims (trustworthy recommendations, screenshot-worthy results): the hot-take tie-break
promotes resorts by presence not sentiment (quantified at 9.6% of runs for the reported case alone),
the Range Readout can flatly contradict Nicole's own words on the same card, and Nicole's List loses
its core content off-screen at the floor breakpoint the design system commits to supporting. All
three have scoped, concrete fixes above and don't require new strategy or new visual direction —
this is a fix round, not a redesign.

**Priority order for the fix round:**
1. Hot-take sentiment field + tie-break fix (finding 1) — blocks credibility, affects every mode
   that surfaces a hot-take-bearing resort.
2. Range Readout / hot-take cross-check (finding 2) — same root cause class as #1, fix together.
3. Nicole's List responsive layout (findings 5–6) — one layout change (card-based, not table-forced)
   solves both the overflow and the truncation problem.
4. Numbers-grid split into numeric/prose tiers (finding 4).
5. Illustration hash decorrelation + massing range widening (finding 3) — highest effort, lower
   urgency than 1–2, but should not slip past this round given it's the named shareable centrepiece.
