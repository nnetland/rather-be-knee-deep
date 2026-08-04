# Build Notes — Rather Be Knee Deep

_design-builder · 2026-08-03_

Single self-contained deliverable: `/home/claude/ski-reco/build/rather-be-knee-deep.html`
(everything inlined — CSS, JS, the full 71-resort dataset, Nicole's 44-row reference list — the
only external resource is the Google Fonts CDN, which degrades gracefully to system fonts when
unreachable, verified below).

Source is authored as separate modules under `build/src/` and stitched into the single file by
`build/assemble.py` (which reads `build/src/data.js`, itself generated from `research/resorts.json`
+ `research/nicoles-list.json` by `build/prep_data.py`). Regenerate with:
```
python3 build/prep_data.py && python3 build/assemble.py
```

## What I built

- **Three surfaces + splash**: mode-choice splash, Plan-a-Trip (5-topic tap-only quiz), Chase the
  Snow (near-zero-input ranked list with NOAA + historical fallback), Nicole's List (browsable
  reference table). Shared result-card component between the splash's "make your own" re-entry
  and a cold-start shared link.
- **Matching engine** (`build/src/engine.js`) implementing strategy.md §3/§4 literally: mixed-ability
  scoring is `Math.min(floorScore, ceilingScore)` — never an average. Null `terrain_pct` (21 of 71
  resorts, up from 17 since the dataset now has 71 not 54) falls back to a renormalized blend of
  `beginner_friendliness`/`family_ski_school`/`best_for_tags` rather than a guess or a zero.
  Tie-breaking follows §3.3 exactly: hot-take presence → anti-repetition → session-seeded weighted
  random among the genuinely-tied set.
- **Procedural SVG illustrations** (`build/src/illustrations.js`), seeded on `hash(resort.id)` via a
  mulberry32 PRNG so a given resort's art is byte-identical every render. Geometry is driven by
  `vertical_drop_ft`/`summit_elevation_ft` (peak height/jaggedness), `scale` (massing — day-trip
  hills render distinctly small), `base_elevation_ft`/region (tree line/conifers), `town_vibe`/
  `scale` (village vs. lodge vs. nothing), `avg_annual_snowfall_in` (snow texture/sky), and
  `best_for_tags` (couloir lines for steeps, terrain-park feature, extra powder texture).
- **NOAA integration** (`build/src/noaa.js`), built fallback-first per the brief: `historicalEstimate()`
  is a complete, offline-capable path tested before the live path was written. `fetchLiveForecast()`
  implements the `/points` → `/gridpoints/.../forecastGridData` chain reading `snowfallAmount`
  (mm→in) and `temperature`, with a descriptive `User-Agent`, per-request timeout, and a
  state-machine loader (`loadChaseForecasts`) matching motion-spec §4.1 exactly: nothing before
  300ms, "still checking" at 4s, hard historical fallback at 10s.
- **Canada two-tier list** per strategy.md §5(d): live-ranked US resorts in the primary list, all 10
  Canadian resorts in a visually distinct, explicitly labeled "no live forecast" section below,
  sorted by `avg_annual_snowfall_in`, never blended into the ranked-by-inches list.
- **Sharing**: result state (resort id + the exact reason bullets + Range Readout data) is encoded
  as base64url JSON in the URL hash (`#result=...`). A cold-loaded share link decodes and renders
  directly — no re-run of the matching engine's session-seeded tie-break — so the receiver sees
  byte-identical resort, illustration, and reason text to what the sender saw. Web Share API with a
  clipboard-copy + toast fallback. OG/Twitter meta tags updated per route via JS.
- **Motion**: reveal choreography, quiz step transitions, progress-fill, tap-chip state change,
  skeleton shimmer, toast, and the Range Readout bridge sweep all implemented from motion-spec.md's
  literal durations/easings/WAAPI code, each with its full §9 reduced-motion counterpart built from
  day one (verified below, not bolted on after).
- **Accessibility**: semantic HTML throughout (real `<button>`s, a real `<table>` for Nicole's List
  with `scope="col"` headers and a caption, `role="progressbar"` with `aria-valuetext`,
  `role="img"` + descriptive `aria-label` on every illustration with the inner SVG `aria-hidden`),
  shape+label on every difficulty/status indicator, ≥44px touch targets (chips ship at 56px), two
  `aria-live="polite"` announcers wired to the reveal and forecast-fallback moments, focus moved to
  each new quiz step's heading, visible focus ring recipe from visual-system.md §7 verbatim, no
  sliders/drag anywhere.
- **Dark mode** via `prefers-color-scheme`, both palettes lifted verbatim from visual-system.md §1.2/
  §1.3 (re-derived dark accents, not an inverted filter).

## Verified, with evidence

All verification scripts live in `build/` (`test.js`, `verify_a11y.js`, `verify_engine.js`,
`verify_share_and_offline.js`) and run against the final assembled HTML file via Playwright
Chromium (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). Screenshots in `build/screenshots/`.

1. **Full quiz walk → result, screenshotted at 390px and 1280px, light and dark** —
   `screenshots/result-{light,dark}-{390,1280}.png`, plus `splash-*`, `chase-*`, `nicoles-*` at the
   same four combinations (16 screenshots total). Zero console/page errors across all 8 runs
   (`test.js`, exit 0) — the only console output filtered out is the browser's own
   "Failed to load resource" log for font/NOAA requests the test deliberately aborts to prove
   offline resilience, not an application error.
2. **Matching engine exercised across 5,184 input combinations** (`verify_engine.js`): 0 empty
   results, 0 crashes, 0 no-match states, 0 instances of Jackson Hole/Alta/Kicking Horse/Revelstoke
   being recommended to a mixed group with a first-timer (checked both broadly across the full
   sweep and in a dedicated strict check that pins `wide-mixed` + `never-skied`+`expert` across
   every budget/travel/vibe permutation — 0/36 violations). 67 of 71 resorts appeared as a top pick
   somewhere in the sweep (diversity, not "always the same three"). 619 of the winning picks had a
   null `terrain_pct`, confirming the renormalized fallback isn't quietly excluding those resorts.
   `levelScore()` was also called directly against every resort × every skill level (355 calls) with
   0 crashes, covering the null-field robustness requirement directly.
3. **Fully offline functionality** (`verify_share_and_offline.js`): a Playwright context with
   `route('**/*')` aborting every non-`file://` request (fonts, NOAA — everything) still renders a
   full Chase-the-Snow ranked list with the historical-fallback badge, a fully populated Nicole's
   List table, and a working Plan-a-Trip quiz, with 0 JS errors.
4. **Share round-trip, cold**: built a result in one browser context, extracted its `#result=`
   share hash, and opened that exact URL in a brand-new, separate browser context (no shared state,
   simulating the real recipient). Verified byte-identical resort name, byte-identical illustration
   SVG markup, and byte-identical reason bullets, plus confirmed zero nav chrome renders on the
   result screen (Principle 1).
5. **Illustration spot-check** across scale and region (`screenshots/illustration-grid.png`, 12
   resorts): Buck Hill/Welch Village (MN, day-trip) render as small, low, village-less rolling
   hills; Big Sky/Jackson Hole/Vail/Whistler (destination, big-vert) render as tall, dramatic peaks
   with villages and (where tagged `steeps`) visible couloir lines; Mount Bohemia/Lutsen (regional)
   land visually in between with heavier tree cover; Powder Ridge (CT, day-trip) reads as a small
   local hill. Confirmed a Minnesota day-trip hill and Big Sky are meaningfully, immediately visually
   distinct — not scaled copies of one template.
6. **23 accessibility assertions** (`verify_a11y.js`), covering: skip link, both `aria-live`
   announcers present, `role="progressbar"` with correct `aria-valuemin/max/now/text`, radio vs.
   checkbox role split for single- vs. multi-select, keyboard focus landing on real interactive
   elements, the explicit `Continue` control existing independent of auto-advance, focus moving to
   each new step's heading, the illustration's `role="img"`/`aria-label`/inner `aria-hidden` pattern,
   nav chrome absent on the result screen, the Range Readout's summarizing `aria-label`, and — under
   `reducedMotion: 'reduce'` — that the reveal still fires the `aria-live` announcement and the card
   ends fully opaque (never stuck mid-fade).
7. **320px width and 200% zoom**: `document.documentElement.scrollWidth > clientWidth` asserted
   `false` at 320px through the splash → quiz → multi-select flow, and again with root font-size
   forced to 32px (≈200% of the 16px base) on the splash. No horizontal overflow in either case.
   Screenshots: `w320-*.png`, `zoom200-splash.png`.

## Copy-deck fidelity — corrections made during build

Cross-checking the implementation against `design/copy-deck.md`'s literal strings caught several
places where I'd initially drifted (mostly toward visual-system.md's illustrative prose examples
instead of content-writer's actual final strings) — corrected before handoff:

- Result headline was initially "`{{Resort}}` is your pick." — copy-deck's `result.headline` key is
  literally just `{{resort_name}}` (the "Your pick" framing is carried entirely by the `result.eyebrow`
  line above it). Fixed to render just the resort name.
- Canada section heading was "Canada — no live forecast **available**" (visual-system §2.7's prose) —
  copy-deck's `canada.section.heading` is "Canada — no live forecast" (no "available"). Fixed.
- Final quiz step's Continue button read "See my pick" (my invention) — copy-deck defines exactly one
  string, `quiz.continue` = "Continue", for every step including the last. Fixed to "Continue"
  throughout; the transition into the result screen itself communicates completion.
- `quiz.startOver` ("Start over") was defined in the copy deck but unused — added as a
  restart-the-quiz control, visible from step 2 onward.
- `mixed.tier.weak`'s copy-deck pattern is "The weaker end — {{specific caveat, data-bound}}" — I had
  the caveat only in the separate always-present sentence below, not inline in the tier label itself.
  Added a `shortCaveat()` helper that pulls from `beginner_note`/`character_note` to complete the
  pattern literally (verified against Jackson Hole: "The weaker end — this is the dataset's clearest
  case of a famous resort that is NOT a…").

## Strings I could not implement as literally specified, and why

- **`nicoleslist.col.rating`** ("Her rating") — I dropped this as a dedicated table column. Every
  one of the 44 rows in `nicoles-list.json` has `overall_rating: null` (the copy deck's own "8.5/10"
  example in visual-system.md §2.4 is illustrative, not present in the actual synced sheet data). A
  column that is empty in literally every row reads as broken, not as an honest absence, and there's
  no single-column analog to the result card's "don't show the block at all" rule for a table
  structure. I instead surface the rating inline inside the expanded hot-take view on the rare
  chance a future sheet sync adds one, and flagged this for the Director rather than fabricating
  placeholder ratings.
- **`loading.planner`** ("Finding your pick…") — unused. Trip-matching runs entirely against the
  in-memory dataset and completes in well under a millisecond; per motion-spec §4.1's own "no loader
  before 300ms" rule, a loading state would never actually have a chance to appear, so building one
  would only be dead code with no honest occasion to show it.
- **`loading.forecast`** ("Checking the forecast…") — unused. I used `loading.chase` ("Checking
  today's snow…") for the one real loading moment in Chase-the-Snow (the whole-list NOAA fetch); I
  couldn't find a second, distinct "checking a single forecast" moment in the architecture that
  `loading.forecast` would describe without being a duplicate of `loading.chase`.
- **OG/Twitter metadata for the Nicole's List route** — copy-deck §9 doesn't define
  `og.title.nicoles`/`og.description.nicoles`. I reused `og.title.app` and wrote a placeholder
  description in the same register ("Everywhere Nicole's actually skied, with her real hot takes
  where she has one.") — marked here for content-writer sign-off, not silently invented as final.

## Deliberate deviations from the written specs, and why

- **`sessionStorage`/`localStorage` → in-memory JS variables.** strategy.md §1.3 specifies
  `sessionStorage` for in-progress quiz answers surviving a mode switch, and §3.3 specifies
  `localStorage` for the device-local anti-repetition nudge. The build brief explicitly overrides
  both: this environment has neither API available, and state must live in JS variables instead. I
  implemented both behaviors with module-level JS state (`state.quizAnswers` persists across route
  changes within the page session; `recentlyShownResortIds` is an in-memory array). This delivers
  the same practical behavior *within a single page load* but does not survive a tab close/reopen
  the way real `sessionStorage`/`localStorage` would. Flagging for the Director in case a future
  hosting environment does support them and this should be upgraded.
- **Auto-advance timing.** copy-deck requires an explicit, always-functional `Continue` control
  (never auto-advance-only) but describes auto-advance-on-tap as the expected sighted/touch default.
  I implemented a 420ms cancelable auto-advance after a single-select tap (any further interaction
  cancels it), which gives Marcus/Nicole's cold-hands mis-tap scenario a real correction window while
  still matching the "one-tap feels responsive" expectation for everyone else. Multi-select and
  keyboard-only paths always require the explicit Continue tap.
- **Chase-the-Snow feasibility and Plan-a-Trip travel gating use real haversine distance** from
  curated resort/region coordinates rather than pure keyword matching against `drive_to_metro` text.
  strategy.md §4 describes keyword matching as the mechanism; I layered real geometry underneath it
  because the dataset's own schema doc says `drive_to_metro`/`airport_drive_time_min` are estimates,
  not routed distances, so a coarse-but-real distance calculation is at least as honest as string
  matching and produces a materially better hard-gate (§3.4's "genuinely wrong answer" exclusion)
  than keyword matching alone could.
- **Resort coordinates were not in `resorts.json`** and the schema doc confirms none exist anywhere
  in the source data. Per the build brief's explicit instruction, I did not invent precision I
  couldn't source — I curated approximate (town/base-area-level, sufficient for NOAA's ~2.5km grid
  resolution and for coarse region-distance estimates) coordinates for all 71 resorts from general
  geographic knowledge of these named, well-documented ski areas, rather than guessing at street-level
  precision. All 71 resolved with reasonable confidence; none were marked forecast-unavailable for
  lack of a coordinate. This is a build-time judgment call worth a real geocoding pass before
  production launch — flagging rather than presenting as verified-precise.
- **Weighting formulas inside each scoring category** (e.g., the exact 0.65/0.35 blend for a
  never-skied floor score, the terrain_pct saturation points) are my own reasonable-but-invented
  constants — strategy.md specifies the *structure* (min-max bottleneck, category weights, null
  fallback behavior) precisely but doesn't hand down every internal coefficient. I tuned these
  against the dataset's known cases (verified Jackson Hole/Alta/Kicking Horse/Revelstoke score low
  on the beginner end, verified broad-spectrum resorts like Steamboat/Park City score well on both
  ends) rather than against a formal spec, since none exists at that level of detail.

## Uncertain / worth a second look

- The Range Readout component (genuinely new UI per design-lead's own flag) would benefit from the
  synthetic-user-testing pass against Marcus that's already flagged in `design-state.md` — I built
  and verified it renders and animates correctly, but "does it read as your group's span without
  narration" is a usability question this build can't answer on its own.
- NOAA's actual live response shape is still unverified from any environment I have access to
  (network egress to `api.weather.gov` is blocked here too). The parsing code
  (`fetchLiveForecast` in `noaa.js`) is written directly against NWS's documented schema
  (`snowfallAmount`/`temperature` as `{values: [{validTime, value}]}` arrays in `forecastGridData`)
  but has never executed against a real response. The fallback path is what's actually verified end
  to end; the live path should be smoke-tested against the real API the first time this is deployed
  somewhere with network access.
- `nicoles-list.json` contains one duplicate row (`park-city-ut` appears twice with identical null
  data) — deduplicated in `prep_data.py` (44 rows after dedup, from 45 raw). Worth confirming with
  the Director whether that's a real duplicate in her source sheet or two distinct visits that
  should both be represented.
- I did not implement the deferred "here's what else fit" secondary list for travel-excluded resorts
  (strategy.md §3.4/§7 flags this as likely-deferred, design-strategist's default recommendation) —
  a single confident result stays true to Principle 1 for v1.

## Regenerating / editing

- Edit source in `build/src/*.js` / `build/src/styles.css` / `build/src/shell.html`, then run
  `python3 build/assemble.py`.
- To pick up dataset changes, re-run `python3 build/prep_data.py` first (regenerates
  `build/src/data.js` from `research/resorts.json` + `research/nicoles-list.json`), then assemble.
- Verification: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node build/test.js` (visual + console),
  `build/verify_a11y.js`, `build/verify_engine.js`, `build/verify_share_and_offline.js`.

---

# Reconciled Fix Round — 2026-08-03

Source of truth for this round: `reviews/design-critic.md`, `reviews/accessibility-review.md`,
`reviews/heuristic-evaluation.md`, plus a direct Director ruling on the hot-take tie-break. All
fixes below are made in `build/src/*` and reassembled — the bundled `rather-be-knee-deep.html` is
never hand-edited. Every fix below has a corresponding Playwright check; scripts are `build/verify_*.js`
and `build/test.js`. Screenshots regenerated this round are all in `build/screenshots/` with this
round's timestamp.

## Criticals — all five fixed

1. **Hot-take tie-break removed entirely** (`build/src/engine.js`). Director's verbatim ruling:
   "just stop boosting them" — no sentiment-scoring substitute, no partial credit. Tie-break 1
   (presence of a hot take) is deleted outright; the anti-repetition nudge is now tie-break 1, and
   session-seeded weighted-random among the remaining tied set is tie-break 2, per strategy.md
   §3.3's own next-in-line ordering. **Verified**: `verify_hottake_sweep.js` reproduces
   design-critic's 240-run fixed-combo methodology (192 runs) plus a broader 2,000-run random
   sample. Fixed-192 win rate: 22.4% (down from the reported 40%). Broad random-2000 sample: 12.1%
   — statistically indistinguishable from the pool's actual 12.7% share (9/71 resorts have a hot
   take). Breckenridge specifically: 5.7% (fixed-192) / 3.95% (random-2000), down from the reported
   9.6%. Zero banned-resort violations across both samples (Jackson Hole/Alta/Kicking
   Horse/Revelstoke never recommended to a mixed group with a first-timer). The residual gap
   between the fixed-192 and random-2000 numbers is expected, not a bug: the fixed-192 replication
   deliberately holds terrain/travel-mode constant (matching the original narrower methodology), so
   it concentrates wins on whichever resorts are genuinely strongest across that narrower slice —
   that's real merit, not a hot-take artifact, since the tie-break no longer touches hot-take
   status at all.
2. **`character_note` self-contradiction fixed** (`build/src/app.js`). The Range Readout's
   "for more experienced skiers" sentence and tier label are now derived exclusively from
   `terrain_pct.advanced_expert` and `best_for_tags` (new `expertAssessmentSentence()` /
   `expertWeakCaveat()` functions) — never from `character_note`, which is a general "one
   interesting fact" field (season length, night-skiing volume, trademark snow name) not scoped to
   terrain difficulty, and was previously being misappropriated into a terrain-difficulty claim.
   The floor ("for newer skiers") sentence already correctly used the purpose-built
   `beginner_note` field and needed no change. **Audited every other `character_note` usage in the
   codebase** (one remaining call site, `app-chase.js`'s Chase-the-Snow row-detail reason list) —
   confirmed it surfaces the field as one neutral "why this one" fact among several (forecast
   number, crowd level), never as a skill-fit or terrain-difficulty claim, so it's correctly out of
   scope for this fix and was left unchanged. **Verified**: `verify_fixround.js` renders Keystone
   live and confirms the ceiling sentence now reads "49% of the terrain is rated advanced or
   expert" (real data) with no mention of night-skiing/season-length facts. Note for the record: the
   Range Readout's claim and Nicole's Hot Take ("no advanced terrain") can still read as being in
   tension for Keystone specifically — but that tension is now honest, not a bug: the Range Readout
   states the resort's own published trail-rating percentage (objective, attributed to the data),
   and the Hot Take is clearly quarantined as Nicole's personal, explicitly-attributed opinion,
   which may reasonably differ from the resort's own trail-rating conventions. That's the intended
   information architecture (objective stats vs. attributed subjective opinion, never blended) —
   flagging for the Director in case she wants to revisit Keystone's hot-take wording specifically,
   but it is not an app defect.
3. **Nicole's List horizontal overflow at 320px/390px fixed** (`build/src/app-nicoles.js`,
   `build/src/styles.css`). Rebuilt as a real `<table role="table">` with explicit
   `role="row"/"columnheader"/"cell"` at every level (so semantics survive even when CSS
   restyles it), wrapped in a horizontally-scrollable container above 600px and restyled to a
   card-per-row layout below 600px via `data-label`/`content: attr()` (thead visually hidden, not
   removed). Hot-take preview text is now `overflow: hidden; text-overflow: ellipsis; white-space:
   nowrap` for a genuine single-line truncation instead of jagged wrapping. "Best for" tags now
   render as a real `<ul role="list"><li role="listitem">` instead of zero-separator concatenated
   `<span>`s (this doubles as the M6 fix below). **Verified**: `verify_responsive.js` — zero
   page-level horizontal overflow at both 320px and 390px, hot-take column content confirmed
   on-screen (not just "page doesn't scroll" — the original bug specifically pushed that column
   past the viewport edge), table/row/columnheader/cell roles all present in the card layout,
   preview text measured at exactly one rendered line height (not read from CSS alone).
   Screenshots: `screenshots/nicoles-list-320.png`, `screenshots/nicoles-list-390.png`.
4. **200% zoom quiz occlusion fixed** (`build/src/styles.css`). `.chip-grid--2col`/`.region-grid`
   moved from fixed-`px` `@media` breakpoints to `grid-template-columns: repeat(auto-fit,
   minmax(8.75rem, 1fr))` (content-driven, scales with zoom). `.app-main`'s bottom-nav clearance
   and `.toast`'s bottom offset both moved from hardcoded `72px` to `calc(4.5rem + var(--space-*))`
   so clearance scales with the root font-size the same way the rest of the spacing system does.
   **Verified**: `verify_responsive.js`, reproducing accessibility-review.md's own methodology
   (root font-size forced to 32px ≈ 200% at a 390px viewport) — zero horizontal overflow, every Q1
   option's text fully within the viewport width, and critically: after scrolling all the way to
   the bottom of the (now-taller, single-column-stacked) page, the last option clears the fixed nav
   — this was the actual bug (permanently covered no matter how far the user scrolled, since the
   old clearance was a fixed pixel value that didn't grow with zoom). Same check repeated on the
   Q4b region grid. Screenshots: `screenshots/quiz-zoom200-q1.png`,
   `screenshots/quiz-zoom200-q4b-regions.png`.
5. **Quiz progress survives reload** (`build/src/app.js`, `build/src/shell.html`). Since
   `sessionStorage`/`localStorage` are unavailable in this environment (documented constraint from
   the original build), quiz progress is now serialized into the URL hash as base64url JSON
   (`#quiz=...`), written via `history.replaceState` on every answer (never pushes a new history
   entry) and cleared the moment the user leaves the quiz for any reason other than a mode switch.
   On load, `parseInitialRoute()` checks for `#quiz=` before falling back to the splash, restores
   `quizAnswers`/`quizStepIdx`, and shows a one-time toast ("Welcome back — picking up where you
   left off."). This is a genuinely different hash namespace from the existing `#result=` share
   format, so the two can never collide or be misread as each other. **Verified**:
   `verify_fixround.js` — reload lands back on the quiz route (not the splash), restores both the
   answer and the exact step left off (not step 1), the welcome-back toast renders, and completing
   the quiz after a resume still produces a clean `#result=` hash (no leftover `#quiz=` state
   bleeding into the share format).

## Majors — all fixed

- **Illustration diversity** (`build/src/illustrations.js`). Silhouette-variant hash decorrelated
  from the palette hash (`hashStr(resort.id + "-shape") % 6` instead of reusing the unsalted
  `hashStr(resort.id) % 6`). Massing range widened for destination big-vert resorts specifically —
  height factor is now log-scaled across the real vertical-drop range (~1,550–5,700ft) instead of
  a linear formula that saturated (clamped to the same max) for anything above ~2,900ft, which is
  most of the "famous" tier. Added a luxury-vs-budget visual cue (a small pennant flag atop the
  roofline for `luxury`-tagged resorts; flat-top, no-peaked-roof buildings for `budget`/
  `skier-only`-tagged resorts). **Verified**: new `verify_illustration_diversity.js` regenerates
  the diversity grid for the exact 12 resorts named in design-critic's collision report (Vail,
  Whistler Blackcomb, Palisades Tahoe, Crystal Mountain, Alyeska Resort, Aspen Snowmass, Park City
  Mountain, Revelstoke Mountain Resort, Kicking Horse, Copper Mountain, Telluride, Jackson Hole) —
  **zero full structural-signature collisions** (palette + shape-count + fill-set) among all 12,
  down from the reported 5-way collision (Vail/Whistler/Palisades/Crystal/Alyeska were byte-for-byte
  identical). Palette *rotation* (color family) is unchanged by design — the fix specifically
  targeted the silhouette collapsing to the same shape, and it no longer does: Whistler (5,280ft
  vertical) now renders as a visibly wider twin-massif than Vail (3,450ft); Alyeska renders as one
  dominant single peak; Revelstoke (5,620ft) and Kicking Horse (4,314ft) are now visually distinct
  in width/complexity rather than interchangeable. Screenshots:
  `screenshots/illustration-diversity-grid-named12.png` (the 12-up grid), `illustration-diversity-grid-all71.png`
  (full dataset for reference).
- **"The numbers" ragged grid split** (`build/src/app.js`, `build/src/styles.css`). Numeric fields
  (vertical drop, skiable acres, snowfall, cost, terrain-mix percentages) stay in the
  monospace-tabular `stat-strip` grid. Prose-length fields (crowds, pass, ski school, off-mountain
  notes) moved to a new `<dl class="notes-list">` label/value list, which never tries to force
  variable-length prose into a fixed-height grid cell — eliminating both the empty trailing cell
  and the uneven row heights design-critic flagged.
- **M1 — focus no longer forced to the heading on every tap.** `renderQuizStep()`'s
  unconditional `heading.focus()` only fires now on a real step transition (`direction` truthy);
  an in-place re-render after an option tap keeps focus on the tapped chip. **Verified**:
  `verify_fixround.js` — first and second multi-select taps both keep focus on the tapped chip.
- **M2 — ARIA radiogroup pattern added.** Single-select quiz steps now render as a real
  `role="radiogroup"` (`aria-labelledby` pointing at the question heading) containing
  `role="radio"` chips with roving `tabindex` (exactly one radio in the Tab sequence) and
  ArrowLeft/ArrowRight moving *and* selecting focus per the platform convention. **Verified**:
  `verify_fixround.js` — all five assertions (radiogroup role, aria-labelledby, roving tabindex,
  ArrowRight moves focus, ArrowRight also selects).
- **M3 — Range Readout no longer vanishes under reduced motion.** The reduced-motion branch in
  `revealResultCard()` now adds `.is-revealed` to the bridge and both pins before its early return
  (previously it returned first, leaving the bridge permanently `scaleX(0)` and the pins at
  `opacity: 0`). **Verified**: `verify_fixround.js` under `reducedMotion: 'reduce'` — bridge is not
  permanently zero-width, both pins render at full opacity.
- **M4 — contrast fixed against the real rendered background, not the token table's assumed one.**
  New tokens: `--indigo-350` (dark-mode primary-text accent, replacing `--indigo-400` — measured
  4.98:1 on `night-800`, 5.45:1 on both `night-700` and `night-900`) and `--accent-warm-text-tint`
  (separate token for the freshness-badge-on-`bg.tint` case specifically, since that's a genuinely
  different surface than the badge's other contexts). **Verified**: new `verify_contrast.js`,
  written to walk up the DOM and test against the actual painted background an element sits on
  (matching accessibility-review.md's own stated methodology) rather than assuming from the token
  table — dark-mode nav active-tab label, "Make your own pick" button, "See more of Nicole's
  picks" link, Nicole's List selected filter chip (both modes), and the light-mode "Not a live
  forecast" badge all clear 4.5:1. One test-authoring wrinkle worth recording: `color-mix()`
  results serialize in Chromium's computed style as CSS Color 4 `color(srgb r g b)` (0–1 range),
  not `rgb()` (0–255) — the test's color parser needed to handle both forms; this is a Chromium
  serialization detail of a `color-mix()` call the design system uses deliberately
  (`styles.css`), not an app bug.
- **M5 — `--accent-gold-text` fixed, and a second, previously-unverified defect in the same area
  caught and fixed.** The token itself was defined in both light (`--gold-700`) and dark
  (`--gold-300`) semantic layers. But writing `verify_contrast.js`'s "chip colours are distinct"
  check surfaced that the actual "Nicole's take" chip markup in `app-chase.js` (two call sites)
  still had the *old* inline `style="color:var(--accent-warm-text)"` — the same warm/amber token
  as the crowd-warning chip — instead of the `chase-flag--nicole` class that the CSS-side fix had
  been written against. The token fix alone was therefore inert; the markup was never wired to it.
  Fixed both call sites to use `class="chase-flag chase-flag--nicole"`. **Verified**:
  `verify_contrast.js` — chip color is defined in both modes and confirmed distinct (not
  string-equal) from the crowd-warning chip's color, using an injected probe element rather than
  depending on a hot-take resort happening to land in that day's random top-forecast rows (only
  9/71 resorts have one, so relying on the live list would be flaky by construction).
- **M6 — Nicole's List tags no longer concatenate unparseable.** Covered by the critical-fix-#3
  rebuild above: tags are now `<ul role="list"><li role="listitem">`, not zero-separator
  `<span>`s.
- **M7 — touch targets brought up to the 44px/12px floor.** Nicole's List filter chips:
  `min-height: 56px` (was 40px). Filter row gap: `var(--space-3)` / 12px (was 8px). **Verified**:
  `verify_responsive.js` — filter chips measured ≥44px tall at both 320px and 390px.
- **M9 — result screen now moves focus on arrival.** `renderResult()` calls `focusHeading(main)`
  at the end, matching every other route. **Verified**: `verify_share_and_offline.js` — a
  cold-loaded shared result link (the highest-risk path, since it's the one case an `aria-live`
  announcement could race a screen reader that hasn't finished attaching) confirms
  `document.activeElement` is the result headline on arrival.

## Heuristic findings — all fixed

- **Back navigation now correctly restores Q2a's single-select answer.** `optionListHtml()` was
  always passed the raw `skillLevels` array regardless of whether the step was single- or
  multi-select; fixed to pass `a.skillLevels && a.skillLevels[0]` for single-select. **Verified**:
  `verify_fixround.js` — tapping Back to Q2a after answering visually restores the previously
  selected chip (was always false before the fix).
- **Shared-result "you said" language fixed for cold strangers.** New `toColdViewBullet()`
  transforms reason-bullet pronouns ("You're" → "They're", "You said" → "They said", "your" →
  "their") and the eyebrow switches "Your pick" → "Their pick" whenever `state.routeParams.fresh`
  is falsy — i.e. whenever the viewer is a cold recipient of a shared link, not the person who ran
  the quiz. This also fixes the OG-preview title/description, which pull from the same
  cold/fresh-aware path. **Verified**: `verify_share_and_offline.js` — a cold-loaded share link's
  bullets contain no "you"/"your", eyebrow reads "Their pick", while the sender's own live session
  still reads "You said"/"Your pick".
- **Chase-the-Snow 4s "still checking" escalation now has a skip control.** `loadChaseForecasts()`
  (`build/src/noaa.js`) now returns a `{ skip }` handle; once the loader reaches the escalated
  (4s) state, a "Show typical-season data now" button appears and calling `skip()` immediately
  resolves to the historical-fallback list rather than making the user wait out the full 10s hard
  timeout. **Verified**: `verify_fixround.js` — the skip control appears at the escalated state
  and clicking it resolves well under 10s.
- **Dana can now evaluate ski-school quality, not just a bare label.** The dataset's
  `family_ski_school_basis` field (a sourcing/evidence note) existed but was unused. Ski school is
  now an expandable disclosure control (`aria-expanded`, collapsed by default) that reveals the
  real sourcing text on click, reusing the same interaction pattern for any other "notes" field
  that has evidence worth surfacing. **Verified**: `verify_fixround.js` — starts collapsed, click
  reveals the sourcing text, `aria-expanded` updates to `true`.

## Two latent bugs found and fixed during this round's verification (not flagged in any review)

- **Stale ghost-element DOM corruption under rapid/reduced-motion quiz transitions.** The
  forward/backward step-transition animation clones the outgoing step into a `.quiz-step--ghost`
  for its fade-out, relying on an `animationend` listener to remove itself. Under
  `prefers-reduced-motion` (and potentially just fast successive interactions), that event didn't
  reliably fire before the next render, so the next in-place render's `querySelector('.quiz-step')`
  could match the still-present ghost instead of the live element, remove the ghost, and leave the
  real live element orphaned — producing two elements with the same id (`#quiz-continue`) in the
  DOM. Fixed by explicitly marking ghosts (`.quiz-step--ghost`), scoping the "current step"
  selector to exclude them, and proactively sweeping any stale ghost at the top of every
  `renderQuizStep()` call. Found via a temporary debug harness instrumenting step-container state
  after a `page.click('#quiz-continue')` timeout; the harness was deleted once the fix was
  confirmed.
- **Continue/Back/Start-over didn't cancel a pending auto-advance timer.** Only a chip click
  cleared the 420ms single-select auto-advance timer; clicking Continue, Back, or Start Over
  explicitly did not, which could race a second `submitQuiz()` call. Extracted a
  `clearPendingAutoAdvance()` helper and wired it into all three controls.

## Deferred (explicitly out of the required fix list, logged as design debt)

- A jargon-gloss layer for domain terms surfaced in `beginner_note`/`character_note` prose
  (Corbet's Couloir, mogul terrain, etc.) — copy-deck's Grade 6–8 target covers the app's own
  authored strings, but these two fields pass through raw dataset text that occasionally exceeds
  that bar. Not in the required fix list; flagged as design debt.
- A confirmation dialog before "Start over" discards in-progress quiz answers — currently
  immediate/irreversible. Not flagged by any of the three reviews; flagged as design debt.
- The reveal choreography's ~700–750ms timing window creates a small race between "animation
  finished" and "screenshot/assertion fires" in a couple of verification scripts (worked around
  with explicit `waitForTimeout` in the test scripts themselves) — not a product-facing issue, but
  worth a `waitForFunction`-based rewrite of those specific waits if this test suite grows.
- Nicole's List sort-by-rating control remains absent (unchanged from the original build — every
  `overall_rating` is still `null` in the current data sync; see Design Debt Register DD-1).

## New copy strings introduced this round — need content-writer ratification

These were written in copy-deck.md's register (neutral, plain, Grade 6, sentence case) but are new
strings the content-writer hasn't seen:

- `"Their pick"` (cold-view eyebrow, paired with the existing `"Your pick"`)
- The `toColdViewBullet()` pronoun-transform pattern itself (You're→They're, You said→They said,
  your→their) — mechanical, but worth the content-writer confirming it doesn't produce anything
  awkward against the actual bullet library, not just the test fixtures exercised here.
- `"Show typical-season data now"` (Chase-the-Snow skip-ahead button)
- `"Welcome back — picking up where you left off."` (quiz-resume toast)
- The expert-terrain sentence pattern: `"{{pct}}% of the terrain is rated advanced or expert[,
  including {{tag phrase}}]."` / weak-caveat `"only {{pct}}% of the terrain is rated advanced or
  expert — not the strong side here"` / no-data fallback `"Terrain breakdown not published by the
  resort[, but it's known for {{tag phrase}}]."`
- Two new illustration alt-text fragments: `"a polished, upscale feel"` (luxury-tagged resorts),
  `"a no-frills, skiers-first feel"` (budget/skier-only-tagged resorts).

# Targeted Fix Round — 2026-08-03 (200% zoom, quiz-entry focus, dataset-prose leakage)

Source: `reviews/synthetic-user-testing.md`. Three assigned fixes (one Critical, two Major) plus
one additional bug found during the required zoom sweep. Scope: `build/src/` only — illustration
code and `/home/claude/ski-reco/design/` (mid-redesign of the badge/motif system, 28→52 motifs,
not this round's concern) were not touched.

## Fix 1 (CRITICAL) — 200% zoom: overlapping/illegible stat tiles and Range Readout pin labels

**Root cause, generalised**: several grid tracks and box widths used a fixed-px (or rem-floor +
percentage) sizing scheme where the px/rem component doesn't shrink relative to a fixed-width
viewport as root font-size grows, while a sibling percentage component does — at 200% zoom the two
compete and the browser resolves in favour of the non-scaling one, so content is squeezed into a
box far narrower than the (now much larger) text needs. A previous round fixed two instances of
this same bug class; this round swept for the rest of it. Found and fixed, in `build/src/styles.css`
unless noted:

- `.stat-strip` grid track: `minmax(84px, 1fr)` → `minmax(5.25rem, 1fr)` (the original Critical
  finding — stat tiles overlapped/collided at 200% zoom).
- Range Readout pin flags (`.range-pin__flag`): went through three iterations. `max-width` +
  `word-break: break-word` first fixed the overlap but collapsed the edge-anchored "Expert" flag
  to one letter per line (shrink-to-fit degenerates near-zero at `left: 100%` with no `right` set).
  Final fix: explicit `width: 6.5rem` (bypasses shrink-to-fit) + gentler `overflow-wrap: break-word`
  + new `.range-pin--edge-start`/`--edge-end` modifier classes (computed in `app.js`'s
  `buildRangeReadoutHtml`, via new `floorAtEdge`/`ceilingAtEdge` booleans) that counter-shift only
  the flag's text so it doesn't bleed past the viewport at the track's 0%/100% anchor points. The
  outer `.range-pin` also got an explicit `width: 14px` — its own shrink-wrapped box was still
  contributing to page `scrollWidth` even after the flag's rendered text was correctly positioned,
  since a child's `transform` doesn't resize the parent's own layout box. A new `range-track--tight`
  modifier (`app.js`: `tightRange = (ceilingIdx - floorIdx) <= 1`) stacks the ceiling pin below the
  track instead of beside it when the range is narrow, so the two flags never compete for the same
  horizontal space at all.
- `.notes-row` grid track: `minmax(5.5rem, 30%) 1fr` → plain `30% 1fr`. The rem floor doesn't scale
  proportionally with the row's roughly-fixed pixel width, so at 200% zoom the value column
  (ski-school disclosure button, icon + text) was squeezed to 44px and its child escaped the box by
  60px. A percentage-only track scales cleanly at any zoom and lets the label wrap onto multiple
  lines instead (already an accepted pattern for "Off the mountain").
- `.filter-chip` (Chase region `<select>`): added `max-width: 100%`, plus `#chase-origin-control {
  flex: 1 1 100%; min-width: 0 }` to break a circular-sizing dependency (native `<select>` sizes to
  its widest `<option>`; its flex-item ancestor was itself shrink-to-fit, so the percentage had
  nothing stable to resolve against). Was growing to 483px at 200% zoom, 125px of page overflow.
- **Chase list row alignment (found during this round's sweep, not in the original three)**:
  `.chase-row { align-items: center }` vertically centred the rank/badge against a row that grows
  tall when a long resort name wraps to two lines at 200% zoom, letting a short badge land on top
  of the wrapped second line. Root cause went one level deeper than the alignment itself:
  `.chase-row__badge` had no `max-width`, so at 200% zoom "next 7 days" / "TYPICAL SEASON" claimed
  ~140–200px unconstrained, squeezing the name column (`min-width: 0`) down to ~34px — narrow enough
  that even a single word overflowed its own container into the badge. Fixed with `align-items:
  flex-start` plus `.chase-row__badge { max-width: 6rem }` (caps the badge's claim, forces its own
  text to wrap) plus defensive `overflow-wrap: break-word` on `.chase-row__name`,
  `.chase-row__region`, `.chase-row__reason`, `.forecast-badge__desc`. Confirmed via screenshot
  (`build/screenshots/chase-light-390.png` and a dedicated measurement pass) that the badge's own
  text ("Typical season") still renders on one line at normal zoom — the `max-width: 6rem` cap only
  bites at 200% zoom, no visual regression at 100%.

**Verified**: new `build/verify_zoom_overlap.js` — forces `html { font-size: 32px !important }` at
a 390px viewport (matching the project's existing 200%-zoom test methodology exactly), sweeps every
surface (Splash, Quiz Q1–Q5 including the wide-mixed multi-select path, Result for both a tight and
a wide skill range with the ski-school disclosure expanded, Chase list + row detail, Nicole's List)
in both light and dark themes, with a `getClientRects()`-per-line-fragment overlap detector (not
`getBoundingClientRect()`, which produces false positives on wrapped inline siblings sharing a
visual line) plus a dedicated Range Readout pin check using `document.createRange()` on the flag's
text node for glyph-accurate measurement (the flag elements' own boxes are intentionally
oversized/padded and will falsely appear to overlap if measured directly). **76/76 checks passing.**

## Fix 2 (MAJOR) — Q1 heading didn't receive focus on first quiz entry

Root cause: a previous round's fix for focus-stealing on every option tap (M1) removed the
`focusHeading(main)` call from `renderPlan()` entirely, rather than only from the option-tap path —
correct for the "don't steal focus on every tap" requirement, but it also silently broke the one
case where focus SHOULD move: entering the quiz for the first time from the splash. Every other
route calls `focusHeading(main)` once on entry; `renderPlan()` was the only exception. Fixed by
restoring a single `focusHeading(main)` call at the end of `renderPlan()` — this only runs once, on
initial entry into the Plan route; it does not run on the in-place re-renders that option taps and
step transitions trigger via `renderQuizStep()`, so M1's behaviour is untouched.

**Verified**: new `build/verify_focus_entry.js`, keyboard-only throughout — (1) Tab to the Plan
entry point and activate with Enter: focus lands on `#quiz-step-heading` (H2). (2) A real pointer
click on an option chip does NOT move focus to the heading immediately (M1 baseline intact,
confirmed at +50ms, well before the 420ms auto-advance timer). (3) After the auto-advance timer
fires and the next step renders, focus DOES land on that step's heading (matches every other
route's existing convention). (4) Same check via the explicit Continue button. **4/4 passing.**

## Fix 3 (MAJOR) — raw dataset research notes leaking into the interface

Root cause: `family_ski_school_basis`, `beginner_note`, and `character_note` are dataset fields
containing research/editorial working notes (`"Editorial judgment:"`, `"Sourced:"`,
`"(brutal)"`, `"...in the dataset"`, `"Confirmed 4..."`) written for internal use, not for display —
but all three are rendered close to verbatim (ski-school disclosure, Range Readout floor sentence,
Chase row detail respectively). Audited every dataset free-text field for a render site:
`pass_note` is never rendered anywhere (confirmed via a full grep of `build/src/*.js` — safe as-is,
no fix needed). `town_vibe` is used only internally by the matching engine (`engine.js`, lowercase
substring match), never rendered — safe as-is. `crowd_level` is already an enum translated through
the existing `CROWD_COPY` lookup table before display — never rendered raw — safe as-is.

Fix: added one shared `sanitizeDatasetProse(text)` function in `app.js` (near the existing
`SCHOOL_COPY`/`ACTIVITIES_COPY` enum-translation tables, same pattern) that strips the known
research-framing prefixes/suffixes (`"Editorial judgment:"`, optionally with `", tempered"`,
`"Sourced:"`, `"Confirmed "` before a leading number, `" in this/the dataset('s own tags)"`,
parenthetical severity asides like `" (brutal)"`), cleans up resulting double-spaces/dangling
commas, and re-capitalises the result. Wired into all three render sites: the ski-school
disclosure's `skiSchoolNotesValue()`, the Range Readout's floor sentence (new `beginnerNote`
variable in `buildRangeReadoutHtml`), and `app-chase.js`'s `showChaseRowDetail()` character-note
bullet. New user-facing strings are transforms of existing data, not hand-authored copy, but the
transform's OUTPUT should still get a content-writer pass (see below) since it's now user-facing
prose that didn't exist as such before.

**Verified two ways**: (1) a Python sweep of the full 71-resort dataset × the three fields through
the same regex logic — 0 remaining contamination, 0 new formatting artefacts (dangling punctuation,
double spaces, lowercase sentence starts) across all 71 resorts. (2) new
`build/verify_dom_prose_sweep.js` — the required rendered-DOM check: navigates to the Result screen
(ski-school disclosure expanded, Range Readout showing a never-skied→expert range so the
`beginner_note`-bearing floor sentence renders) and the Chase row detail panel, for six resorts
whose source data is known-contaminated across all three patterns (Vail and Breckenridge use
`"Sourced:"`/`"(brutal)"`; Crested Butte, Arapahoe Basin, Wolf Creek, and Alta use `"Editorial
judgment:"`), asserting zero matches for any of the five contamination regexes in
`document.body.innerText`. **12/12 checks passing (zero artefacts).**

## No-regression pass (final)

Re-ran the full existing verify suite after all source changes, against the freshly-reassembled
bundle:

| Check | Result |
|---|---|
| `build/test.js` (console/page errors) | 0 errors |
| `verify_responsive.js` | 23/23 |
| `verify_a11y.js` | 23/23 |
| `verify_engine.js` | 0 crashes, 0 empty results, 68 distinct resorts recommended across the sweep |
| `verify_fixround.js` | 29/29 |
| `verify_share_and_offline.js` | 14/14 (offline operation confirmed intact) |
| `verify_hottake_sweep.js` | 0 banned-word violations |
| `verify_illustration_diversity.js` | 0 structural-signature collisions |
| `verify_contrast.js` | 10/10 |
| `verify_zoom_overlap.js` (new) | 76/76 |
| `verify_focus_entry.js` (new) | 4/4 |
| `verify_dom_prose_sweep.js` (new) | 12/12 |

The four items design-critic called out as excellent — the Range Readout bridge, honest
null-`terrain_pct` handling, the Canada two-tier Chase presentation, and token discipline — were
not touched by any fix in this round and remain intact per the above (no visual/behavioural test in
this suite regressed).

## New copy strings this round — need content-writer ratification

`sanitizeDatasetProse()` doesn't introduce hand-authored strings, but it changes what users actually
see for three previously-contaminated fields. Worth a content-writer pass over a sample of its
output (not just the pattern-matching correctness already verified) to confirm register — Grade
6–8, neutral, sentence case — holds up across the full 71-resort spread, not just the six
worst-offender resorts exercised in this round's tests. Example transforms, before → after:

- `"Sourced: Vail Resorts' EpicKids programming and Golden Peak/Bachelor Gulch dedicated beginner
  terrain are heavily marketed and consistently reviewed well..."` → `"Vail Resorts' EpicKids
  programming and Golden Peak/Bachelor Gulch dedicated beginner terrain are heavily marketed and
  consistently reviewed well..."`
- `"Editorial judgment: real, professional ski school exists, but Crested Butte's br[and]..."` →
  `"Real, professional ski school exists, but Crested Butte's br[and]..."`
- `"...the town's size, crowds (brutal), and the r[esort]..."` → `"...the town's size, crowds, and
  the r[esort]..."`

---

# Badge system integration (this round) — design-builder, 2026-08-03

Replaced the procedural landscape illustration generator (`build/src/illustrations.js`, described
above) with design-lead's badge system (`design/badge-system.md`, reference implementation
`design/badge-preview.html`) across all 71 resorts, and re-verified the full app against it.

## What changed

- **New module `build/src/badges.js`** replaces `build/src/illustrations.js` in the build pipeline
  (`build/assemble.py`'s `/*__ILLUSTRATIONS_JS__*/` token renamed to `/*__BADGES_JS__*/`; same load
  position, still before `engine.js`, since `engine.js` depends on `hashStr`/`mulberry32`, which
  this file now defines instead of the old one). `illustrations.js` itself is deleted.
- The motif library (52 SVGs), frame spec (`buildBadgeSVG`), palette rotation, `MOTIF_DESC`, and the
  41-resort `HAND_TUNED` table are ported **verbatim** (programmatically extracted from
  `badge-preview.html`, not retyped, to eliminate transcription risk on hand-authored SVG path
  data) — badge-system.md's own two documented traps (vanishing detail on small ink-adjacent
  shapes; the rotate-transform trap on sub-shapes) were already fixed in the preview and the port
  preserves that as-is.
- **Full 71-resort rollout, per badge-system.md §9's open item.** 41 resorts use the spec's
  hand-tuned table unchanged. The remaining 30 (27 genuinely new to this dataset + Okemo/Big
  White/Loveland, which the preview deliberately left on the live rule engine) run through the
  ported rule engine, adapted to the real `resorts.json` field names
  (`best_for_tags`/`state_province`/`cost_tier`/`crowd_level`/`scale` in place of the preview's
  trimmed stand-ins), plus one new priority-0 rule the spec asked for explicitly: a free-text
  ranching/Western-town signal matched against real `town_vibe`/`character_note` strings (checked
  against the tighter `/\b(ranch|rodeo|cowboy)\b/` word-boundary set, not a bare "western" match,
  after confirming a bare match would have false-positived on Big Powderhorn Mountain's "western
  Upper Peninsula" location description — it does not currently fire on any of the 71, which is
  itself expected: every real ranching town in this dataset is already hand-tuned).

## The region-repeat problem, and the fix actually built (badge-system.md §4.2 option (b))

The spec named this the single most important open item: the preview's own region→single-motif
rules (Midwest→Moose, Southwest→Roadrunner) were left in the code but structurally untested,
because every Midwest resort in the 44-resort preview was hand-tuned specifically to dodge them.
The real 71-resort dataset **does** exercise them — 12 real Midwest resorts, not 9 — and, worse,
running the unmodified rule engine against the full dataset surfaces the *same class* of collision
in categories the preview never hit at all: `goat` (steeps+backcountry), `yeti` (big-vert), `fox`
(quiet+uncrowded), `snorkel` (deep-powder cult), and `penguin` (luxury) all produced 2–4-way
same-cluster collisions once real data was run through them (see the worked example below).

Implemented §4.2's option (b) — "a small deterministic motif pool per region... with a second
dedupe pass... bumping any collision to the next pool motif" — generalised from "per region" to
"per rule-category", since the real collisions weren't limited to the two region rules:

1. `BADGE_PALETTE_BY_MOTIF` (`badges.js`) extends the preview's 13-entry palette-by-motif map to
   cover all 42 character motifs, so a bumped resort's new motif always has a coherent palette
   default.
2. `BADGE_MOTIF_POOLS` gives each rule-engine output motif a short list of same-flavour alternates
   (e.g. `goat` → `[goat, bighorn, elk, wolf, coyote]`) to try first.
3. `BADGE_CHARACTER_ORDER` is the full 42-character library in a fixed order, used as the last-resort
   scan when a resort's pool is itself exhausted within its cluster — ordered so genuinely
   place-neutral characters (fox, coyote, elk, a cowboy, a bear in a parka) are tried well before
   literally region/name-specific ones (a Maine lobster, a desert roadrunner). This ordering is
   itself a fix: the first version of this scan put Lobster and Roadrunner earlier, and Bridger
   Bowl, Montana (landlocked, real backcountry resort) fell through to **Lobster in a Scarf** purely
   because it was next in the list — exactly the "generic and wrong" failure the repeat-check exists
   to catch, just relocated one level down. Screenshotted and caught before shipping; see
   `screenshots/badge-closeup-check.png` for the corrected assignment (Bridger Bowl → Sun Bear).
4. `badgeDedupeClusterMotifs()` processes all 41 hand-tuned resorts first (seeding each cluster's
   "used" set with the spec's own fixed choices, never touched), then every rule-driven/fallback
   resort in fixed dataset order, bumping on collision via steps 2 then 3 above. Never randomness —
   the only "choice" involved is a deterministic hash-of-`resort.id` offset into the fallback scan,
   exactly mirroring the existing `dedupeAdjacentPalettes` mechanism it's modelled on.

**Verified**: `build/verify_badge_system.js` ports the preview's own region-check panel logic against
the live `BADGE_ASSIGNED` array. Result — **zero within-cluster repeats across all six clusters,
71/71 resorts**: Rockies + Wasatch 29/29 distinct, West Coast 9/9, New England 10/10, Canada 10/10,
Midwest 12/12, Alaska 1/1. 19 of the 30 non-hand-tuned resorts needed a bump; 11 didn't collide at
all. Full per-resort bump list is in the verification script's own output and in
`screenshots/badge-contact-sheet-all71.png`'s per-badge caption (`category/motif (bumped)`).

## A second real bug this pass caught — curved-type overflow on long labels

Screenshotting (not just reading source) the new long resort+region combinations the full 71-resort
dataset introduces — several the 44-resort preview never had reason to test, e.g. "REVELSTOKE
MOUNTAIN RESORT · BC, CANADA" (39 chars), "PANORAMA MOUNTAIN RESORT · BC, CANADA" (37) — showed the
curved type clipped at both ends: the label overflowed the arc path's length even at the smallest
existing font-size tier (9px), and SVG's `textPath` doesn't wrap — it just continues placing glyphs
past the path's end, which the badge's own circular clip-path then cuts off. Measured precisely
(not eyeballed): the frame spec's arc (`M 34,168 A 96,96 0 0 0 206,168`) is 213.18 units long
(`SVGPathElement.getTotalLength()`); 12 of the 71 real labels, at their tiered font-size, measured
wider than that via `getComputedTextLength()`.

Fix: `buildBadgeSVG` now measures each label's actual rendered width against a cached offscreen SVG
probe and, only when it would genuinely overflow, adds `textLength`/`lengthAdjust="spacingAndGlyphs"`
to the `<textPath>` — the native SVG mechanism for exactly this, which keeps enforcing its target
width live even across a webfont swap (Manrope loading in after an initial fallback-font layout),
unlike a one-time measurement would. Margin is deliberately generous (25 of 213 units, ~12%) to
absorb the fact that this measurement can and does run before Google Fonts finishes loading in a
network-constrained environment — confirmed in this very sandbox, where Google Fonts is unreachable
(`ERR_TUNNEL_CONNECTION_FAILED`) and every badge in every screenshot here was actually measured and
rendered against the fallback system font stack, not Manrope. Short labels are completely
unaffected — no `textLength` attribute is emitted unless the measured width demands it, confirmed
by checking "ALTA · WASATCH, UT" (short, never clamped) stayed visually identical before/after.
**Verified**: re-measured all 71 real labels post-fix — 0 overflowing (was 12). See
`screenshots/badge-longlabel-check.png` (broken, before) vs.
`screenshots/badge-longlabel-fixed-check.png` / `badge-margin-recheck.png` (fixed, after).

## Determinism

`badgeSvg(resort, context)` builds its internal SVG element ids from `resort.id` + a fixed context
string (`"hero"`, `"chase-row"`, etc.) — **not** a running counter, which is what the preview used
and which would have broken determinism here (a counter's value depends on how many other badges
happened to render earlier on a given page load, which differs between a sender's live session and
a receiver's fresh page load). Verified three ways in `build/verify_badge_system.js`:

1. All 71 badges are byte-identical when rendered in two fully separate `chromium` browser contexts.
2. A cold `#result=` share link reproduces the sender's exact badge `outerHTML`, checked for 4
   resorts spanning hand-tuned/rule/fallback/cluster-bumped categories.
3. The existing `verify_share_and_offline.js`'s own sender/receiver check (renamed from
   `illustrationSvg` to `badgeSvg` in that script, selector `.illustration-panel svg` →
   `.badge-panel svg`) passes end-to-end through the real share flow, not just a synthetic harness.

## Layout integration — three scales

- **Hero result card (~200px)**: `.illustration-panel` (a cropped 4:3 landscape, `object-fit:
  cover`) is replaced by `.badge-panel` — a centered flex stage on a soft tint background, sized to
  the badge's actual circular proportions rather than force-cropping a circle into a rectangle. This
  is a real composition change, not a class rename: the old panel assumed a wide image filling its
  box; a die-cut circle needed a stage to sit *on*, matching how the Director's own reference
  sticker photo has visible countertop around it. `clamp(148px, 42vw, 200px)` keeps the badge from
  crowding a 320px-wide card while hitting the spec's 200px target from ~360px up.
- **Chase-the-Snow list rows (~96px)**: new — the old rows had no resort visual at all, just a
  numbered circle. `.chase-row__avatar` replaces that circle as the row's leading visual; the rank
  number moves into a small pill overlaid on the avatar's own corner rather than disappearing, so
  "row 1 vs. row 2" stays a glance-able visual distinction. Scales responsively: 44px under 480px
  (see the zoom-round fix below for why not 56px), 72px from 480px, the spec's full 96px from 700px.
  Both the US (live/historical) and Canada (typical-season) row builders got the same treatment.
- **Share thumbnail (~72px)**: wired as best-effort via `og:image`/`twitter:image` meta tags, set to
  a `data:image/svg+xml;base64,` URI of the resort's own badge on both a freshly-generated and a
  cold-loaded shared result. This is an honest, not a guaranteed, fix — a static single-file app
  with no backend can't render a per-resort raster image, and while some link-preview crawlers
  (Slack, Discord) do render an SVG `og:image` fine, others silently ignore a non-raster one and
  show no image at all. Flagged in the code comment at the call site
  (`build/src/app.js`, `renderResult`) rather than papering over the gap. The 72px scale itself is
  verified the one way that's actually checkable without a real chat client — a real screenshot at
  72px alongside 96/200, see `screenshots/badge-scale-check-{light,dark}.png`.
- **Nicole's List**: deliberately **not** given a badge. The task named three scales (200/96/72px);
  Nicole's List is a real `<table>`, explicitly "not a ranked list, just her record"
  (copy-deck.md §7), and adding a fourth badge scale/placement wasn't specified. Re-screenshotted in
  both themes at both widths to confirm the new badge-system CSS tokens (below) don't regress it —
  they don't (`screenshots/final-nicoles-*.png`). Flagging this as a judgment call under ambiguous
  instructions, not a silent scope cut — happy to add it if design-critic/Nicole wants a small badge
  in the Place column.

## Accessibility

- Alt text: `badgeAltText(resort)` follows copy-deck.md §8's established pattern — states what the
  picture actually shows and what the background colour means, never a hex value, e.g. *"Jackson
  Hole badge: a cowboy skier tipping his hat, leaning into a turn — on a big-vert / dramatic scale
  background."* Generated from the same `MOTIF_DESC` table that drives the visual (badge-system.md
  §8's own requirement), so text and picture can't drift apart. **New strings — need
  content-writer ratification**, same as any generated-from-data copy in this app: the sentence
  template is mine, not content-writer's, and the register (does "big-vert / dramatic scale" read
  naturally as spoken alt text, vs. a more sentence-like rephrase?) is worth a pass.
- Decorative-by-default pattern matches the app's existing convention exactly (the old
  illustration SVG carried `aria-hidden="true" focusable="false"` on itself, with the description
  living on the wrapping `role="img"` div) rather than introducing a different pattern: the hero
  card's `.badge-panel` div carries `role="img"` + the full `badgeAltText()` sentence, and the badge
  SVG inside it gets `aria-hidden="true"` (via `badgeSvg(resort, context)`'s default
  `decorative: true`, which swaps the SVG's own `role="img" aria-labelledby=...` for
  `aria-hidden="true" focusable="false"`). `verify_a11y.js` updated to check `.badge-panel`/`.badge-panel
  svg` (was `.illustration-panel`) — same three assertions as before, still passing.
- Chase-row avatars are `aria-hidden="true"` on their wrapping span — a deliberate choice, not an
  oversight: the row's own `aria-label` already states resort name, region, forecast inches, and
  reason in full sentences, and the row is one of a long repeated list where a second, verbose
  badge description per row would add real listening time without new information for a screen
  reader user. Matches how the row's own rank number and forecast-badge icon are already
  `aria-hidden`. Flagging for accessibility-reviewer explicitly since it's a judgment call, not an
  obvious default — `badgeShortAltText()` (a one-clause version) is built and ready in `badges.js`
  if the call should go the other way.
- Dark mode: verified per badge-system.md §8's own claim — the white keyline plus its hairline
  stroke read clearly against both a white page and the app's near-black dark surface at all three
  scales, no separate dark-mode styling needed (screenshots above).

## New color tokens (styles.css)

Added the nine badge-fill primitives badge-system.md §7 specifies (`--mint-500`, `--warm-500`,
`--cold-500`, `--coral-450`, `--sand-300/500/800`, `--stone-300/600`, `--brown-700`) to `:root` for
the project's token-documentation trail. The badge SVG library itself (`badges.js`) uses literal hex
constants, not `var()` references, matching the precedent the old `illustrations.js` set
(`ILLUSTRATION_PALETTES` was hex too) — an inline SVG string built via `innerHTML` should render
identically regardless of stylesheet cascade/load timing, which matters directly for the
byte-identical-across-two-contexts determinism requirement above.

## Verification suite

New: `build/verify_badge_system.js` (292 checks — 71-resort structural sanity, the region-repeat
check, both determinism checks, plus a full 71-badge contact-sheet screenshot and a 72/96/200px
light+dark scale-check screenshot for human review). Retired: `verify_illustration_diversity.js`
(tested `generateResortIllustration`, which no longer exists — its 12-named-resort collision check
is superseded by the new suite's much stronger all-71/six-cluster guarantee). Updated for the
badge-panel rename: `verify_a11y.js`, `verify_share_and_offline.js`.

Full existing suite re-run against the final rebuilt bundle, all green:

| Check | Result |
|---|---|
| `test.js` (console/page errors) | 0 errors |
| `verify_zoom_overlap.js` | 76/76 (see the Chase-row avatar-width fix below — this caught a real regression) |
| `verify_focus_entry.js` | 4/4 |
| `verify_dom_prose_sweep.js` | 12/12 |
| `verify_responsive.js` | 23/23 |
| `verify_a11y.js` | 23/23 |
| `verify_engine.js` | 0 crashes, 71 resorts |
| `verify_fixround.js` | 29/29 |
| `verify_share_and_offline.js` | 14/14 |
| `verify_hottake_sweep.js` | 0 banned-word violations |
| `verify_contrast.js` | 10/10 |
| `verify_badge_system.js` (new) | 292/292 |

**One real regression caught and fixed by re-running this suite, not assumed clean:**
`verify_zoom_overlap.js` initially failed 2/76 — at 200% zoom (root font-size 32px), the new
Chase-row avatar at its original 56px narrowest-viewport size took just enough extra flex-row width
to push the pre-existing `.chase-row__badge` ("Typical season" tag, already the tightest element in
that row before the avatar existed) 2px past the 390px viewport. Fixed by shrinking the narrowest
breakpoint's avatar to 44px (and its rank-pill overlay proportionally); re-verified 76/76.

## Honest read on badge quality

Screenshotted all 71 at real scale (`screenshots/badge-contact-sheet-all71.png`, plus targeted
closeups of every cluster-bumped resort) rather than trusting source review, per badge-system.md's
own stated lesson from the character-craft pass. Nothing reads blank, clipped, or blob-like. Two
places still read a little soft, worth a second look from design-lead:

- **Bridger Bowl, MT** (steeps + backcountry-access, real serious-terrain signal) landed on **Sun
  Bear** — a relaxed, sunglasses-and-flip-flops spring character — after its natural pool (`goat`,
  `bighorn`, `elk`, `wolf`, `coyote`) was fully claimed by earlier resorts in the same 29-resort
  Rockies + Wasatch cluster. It's not wrong or absurd (unlike the pre-fix Lobster placement above),
  just tonally softer than the resort's real character. A candidate for hand-tuning promotion if
  Bridger Bowl ever gets its own Director-reviewed pass.
- **Beaver Creek, CO** (luxury) similarly lost its entire natural pool (`penguin`, `swan`,
  `silverfox`, `furcoatdiva` all already claimed within the same cluster) and landed on **Elk in Ski
  Goggles** via the generic fallback scan — a fine badge on its own, but the "glamorous luxury"
  signal that drove the rule match doesn't especially come through in the final character. Same
  candidate-for-hand-tuning note as above.

Every other cluster-bumped resort (17 of the 19) reads as a genuine, coherent character choice — see
the full list and rationale in the `verify_badge_system.js` output and the "What's new" note in
`badges.js`'s header comment.

---

# Regression investigation — "Why this one" bullets + two layout notes (this round) — design-builder, 2026-08-03

## The reported regression

Director flagged `screenshots/final-result-light-390.png`: "Why this one" showing "Glamorous
apres-scene energy." / "Four-mountain grandeur." instead of the required user-answer-anchored
pattern (strategy.md §3.5, copy-deck.md §4 — "because you said X" is the app's core
differentiator against a black-box match score).

**Root cause, determined by direct investigation, not assumption:**

1. Read `buildReasonBullets()` (`engine.js`) end to end — it already builds exclusively from
   `answers.skillLevels`/`groupType`/`terrain`/`travelMode`/`region`/`budget`, with no code path
   that falls back to `best_for_tags` or any tag-derived adjective phrase. No `sanitizeDatasetProse`
   call anywhere near it either — that function only touches `character_note`/`beginner_note`/
   `family_ski_school_basis`, never `reasonBullets`.
2. **Exhaustive verification the bug does not exist in the shipped engine**: a direct Node sweep of
   `matchTrip()` across 13,248 answer combinations (every `groupType`, representative skill-level
   sets, every `terrain`/`budget`/`travelMode`/`region`/`vibe` combination) found **0 bullets**
   failing an anchor check (`/you said|you're driving|you're flying|we didn't factor/i`) — every
   single generated bullet traced to a real answer. Cross-checked live in a real browser across the
   personas named in the ask (mixed-ability group, solo expert, family with kids, budget-constrained,
   drive vs. fly, travel-unsure) — see before/after table below; every live run already produced
   correctly anchored bullets on the current `build/src/*` before any change was made to
   `buildReasonBullets()` itself.
3. Traced the exact phrase "glamorous, apres-scene-tagged, four-mountain grandeur" to its real
   source: it's the internal `why` rationale string on Aspen Snowmass's hand-tuned badge entry
   (`badges.js`/`design/badge-preview.html` — "a wholly new motif so it stops sharing Goat with
   Telluride"), a dev-facing comment explaining a *badge* design choice, never wired to
   `reasonBullets` rendering anywhere in `app.js`/`engine.js`/`app-chase.js` (confirmed via a full
   grep for `.why` — one call site, and it's the badge-metadata assignment, not the result card).
   `final-result-light-390.png`'s mtime (07:24) predates this round's own bundle rebuild and no
   script in the repo currently produces a "final-result-*" filename — meaning that screenshot was
   captured via a one-off/manual payload during the badge-system round's own screenshot pass
   (likely to showcase the new Aspen Snowmass "Fur-Coat Diva" badge specifically), using
   hand-written placeholder bullets paraphrased from the badge rationale instead of a real quiz run.
   It reflected a documentation artifact, not a defect in `build/src/engine.js`.

**Conclusion: no source change was needed in `buildReasonBullets()` — the shipped matching engine
was never generating unanchored bullets.** The stale screenshot has been replaced (below) with one
generated from an actual quiz run through the real bundle, and a permanent regression guard has
been added (see Verification, below) so this exact failure class — an unanchored bullet reaching a
real screenshot or share link — can't recur silently, whether the cause would be a real future bug
in the engine or another manual-payload shortcut in a screenshot script.

**Blast radius, as tested:** universal coverage, zero exceptions — mixed-ability, solo, family,
budget-constrained, driving, flying, and travel-unsure paths (both the live sweep and the 13,248-
combo engine sweep) all produced correctly anchored bullets. Chase-the-Snow's row-detail bullets
(`showChaseRowDetail`, `app-chase.js`) are a different, near-zero-input surface by design
(strategy.md §4.1 — no quiz to draw an anchor from) and were checked separately for the *other*
named risk (raw dataset prose leaking through) via the existing `verify_dom_prose_sweep.js`, which
still passes 12/12 — `sanitizeDatasetProse()` remains intact and untouched.

**Before/after, three combinations** (in this case "before" is what the stale screenshot showed;
"after" is the real, unchanged engine output confirmed live):

| Case | Before (stale screenshot) | After (live, verified) |
|---|---|---|
| Solo expert, driving from Denver, $$$$, lively (→ Aspen Snowmass) | "Glamorous apres-scene energy." / "Four-mountain grandeur." | "You said expert — Aspen Snowmass is a genuine fit for that level." / "You're driving from Denver & the Rockies — this is around 2 hours, no flight needed." / "You said money's no object — this comes in at $$$$, right in that range." |
| Wide-mixed (never-skied→expert), driving from Denver, mid-range | *(not shown — this exact combo wasn't in the stale screenshot; included here as the mixed-ability case named in the ask)* | "You said your crew ranges from never skied before to expert — Winter Park is the strongest realistic fit for that spread among what's actually available." / "You're driving from Denver & the Rockies — this is around 1 hour, no flight needed." / "You said mid-range — this comes in at $$, right in that range." |
| Mixed (beginner+intermediate), family vibe, budget-conscious, travel unsure | *(not shown — included as the family-with-kids case named in the ask)* | "You said your crew ranges from beginner to intermediate — Loon Mountain has real beginner terrain and genuine advanced terrain, so nobody's stuck on the easy runs or bored on the harder ones." / "We didn't factor in how far this is, since you weren't sure yet." / "You said budget-conscious — this runs a bit higher ($$), but it's the strongest overall fit for everything else you said." |

## Two layout fixes (real, in `build/src/styles.css` + `build/src/app.js`)

- **Badge panel dead space.** `.badge-panel svg` was sized `clamp(148px, 42vw, 200px)` — a
  viewport-relative unit sized against the *screen*, not the panel it actually renders inside,
  which is narrower than the viewport by the wrap+card padding. At 390px that put the badge at
  roughly half the panel's width. Changed to `clamp(168px, 78%, 200px)` — a percentage of the
  panel's own content box (the correct relative unit here) plus `aspect-ratio: 1/1` to match the
  badge's 240×240 viewBox without a second independently-guessed height clamp. Ceiling stays at
  badge-system.md §8's own 200px hero-card spec — this reaches that size sooner/more reliably, it
  doesn't exceed it. Also tightened `.badge-panel`'s own vertical padding (`--space-5` → `--space-4`).
- **"COST $$$$" orphan row.** The header numeric strip (`vertical drop`/`skiable acres`/
  `average snowfall`/`cost` — always exactly 4 tiles) shared `.stat-strip`'s
  `auto-fit(minmax(5.25rem,1fr))` with the terrain-mix strip below it (1 or 3 tiles), and a fixed
  `repeat(3,1fr)`/`repeat(4,1fr)` breakpoint override forced *every* `.stat-strip` onto the same
  column count regardless of actual item count — 4 items in a 3-column grid orphans one tile;
  discovered while re-screenshotting at 1280px that the *same* bug class also orphaned the
  terrain-mix strip's 3 items once the generic rule pushed it into 4 columns at 768px+. Fixed with
  a new `.stat-strip--quad` modifier (2 cols mobile → 4 cols from 600px, wired onto the header strip
  only in `app.js`) and removed the terrain strip's now-redundant fixed-column overrides so its
  plain `auto-fit` collapses genuinely-empty tracks instead of stretching into them.
- **Zoom regression caught by re-running the suite, not assumed clean**: the quad grid's initial
  `repeat(2, 1fr)`/`repeat(4, 1fr)` used bare `1fr` tracks, which default to `minmax(auto, 1fr)` —
  at 200% zoom the header stat tiles' text grows past its rem-based clamp floor and forced the
  track wider than the viewport, 4 real overflow failures in `verify_zoom_overlap.js`. Fixed with
  `minmax(0, 1fr)` on the quad tracks, `min-width: 0` on `.stat-tile` (a grid item's automatic
  minimum size is its content size, not zero, unless told otherwise — same fix class already used
  elsewhere in this file), and `overflow-wrap: anywhere` on `.stat-tile__value` so an unbreakable
  token like "3,000" can wrap as a last resort instead of overflowing. Re-verified 76/76.

## Permanent regression guard added

New `build/verify_reason_anchor_sweep.js` — walks six real quiz combinations spanning every case
named in the ask (mixed-ability, solo expert, family with kids, budget-constrained, driving,
flying, travel-unsure) plus a cold-shared-link case (pronoun-transformed "They said…" bullets)
through the actual rendered DOM, and asserts every "Why this one" bullet matches a user-answer
anchor pattern. Sanity-checked that it actually catches the reported regression class by injecting
the exact reported strings ("Glamorous apres-scene energy.", "Four-mountain grandeur.") as a
share payload — both flagged as violations, confirming the guard isn't a tautology. **7/7 passing**
against the real bundle. Chase-the-Snow's row-detail bullets are explicitly out of scope for this
guard (near-zero-input mode by design, strategy.md §4.1 — no quiz answer exists to anchor to).

## No-regression pass (final, this round)

Re-ran the entire required suite against the freshly-reassembled bundle:

| Check | Result |
|---|---|
| `test.js` | 0 console/page errors |
| `verify_dom_prose_sweep.js` | 12/12 |
| `verify_zoom_overlap.js` | 76/76 |
| `verify_badge_system.js` | 292/292 |
| `verify_responsive.js` | 23/23 |
| `verify_a11y.js` | 23/23 |
| `verify_engine.js` | 0 crashes, 0 empty results, 0 banned/strict violations |
| `verify_focus_entry.js` | 4/4 |
| `verify_fixround.js` | 29/29 |
| `verify_share_and_offline.js` | 14/14 |
| `verify_hottake_sweep.js` | 0 banned-word violations |
| `verify_contrast.js` | 10/10 |
| `verify_reason_anchor_sweep.js` (new) | 7/7 |

Re-shot the result card at 390px and 1280px, light and dark (`screenshots/final-result-{light,dark}-{390,1280}.png`), this time from a real quiz run through the live bundle rather than a hand-built payload.

---

# Production Fix Round — 2026-08-04

Two Director-reported bugs, both hit in production at https://rather-be-knee-deep.web.app, both
confirmed real. Fixed in `build/src/noaa.js`, `build/src/app-chase.js`, `build/src/styles.css`;
reassembled via `python3 build/assemble.py`. New evidence: `build/verify_noaa_headers.js` (9/9),
`build/verify_season_state.js` (61/61), plus the full pre-existing 13-script suite re-run green
(zero regressions).

## Fix 1 (CRITICAL) — live NOAA forecast never worked in a browser

**Root cause, confirmed by NWS maintainers**
(https://github.com/weather-gov/api/discussions/312): setting a custom `User-Agent` in browser
`fetch()` triggers a CORS preflight, and api.weather.gov's preflight response doesn't allow-list
`User-Agent`, so every live request failed before it ever reached the API — the exact bug the
Director hit. NWS's own guidance is that the descriptive-User-Agent recommendation is for
server-side callers only; browser code should let the browser set its own default. Fixed in
`fetchLiveForecast()` (`noaa.js`): the custom `User-Agent` and the `Accept:
application/geo+json` override are both removed from the browser fetch path entirely (a bare
fetch with no header overrides is a CORS "simple request" — no preflight risk at all, not just
avoiding the one confirmed-bad header). Deleted the now-unused `NOAA_USER_AGENT` constant. The
module's header comment, which previously said the live path was "unverified because sandbox
egress is blocked," is rewritten to state the real, confirmed root cause and fix instead — that
framing was accurate for the earlier build round but actively misleading now that the actual bug
is known.

**Diagnosability, per the brief's ask**: every live-fetch failure now runs through
`classifyFetchError()` and logs `console.warn('[NOAA live forecast failed] resort=<id>
reason=<timeout|http-error|network-or-cors|unknown> message=<raw>')`. This can't recover the
specific reason a browser withholds for security (a CORS rejection and a plain network outage
both surface to JS as the identical opaque `TypeError: Failed to fetch` — that's a browser
platform limitation, not something app code can see around), but it does distinguish the cases
that *are* distinguishable (timeout vs. an HTTP status vs. everything else) and names the CORS
possibility explicitly in the "network-or-cors" label, so it's the first thing a developer checks
from devtools instead of a guess they have to arrive at independently. The Director previously had
no way to tell "CORS is blocking us" from "there's just no snow"; now there's a retrievable,
per-resort log line either way.

**Verified**: `build/verify_noaa_headers.js` — freezes the clock to a deep-in-season date (so the
live path is actually attempted), intercepts every outgoing `api.weather.gov` request via
Playwright's `page.route()` (which fires at the browser's network layer *before* dispatch, so it
inspects the real request Chromium built regardless of whether this sandbox's own egress could
ever complete it), and asserts: at least one live request fires, it targets the documented
`/points` endpoint, no request carries the old app-authored `User-Agent` string, every captured
`User-Agent` looks like an untouched browser default (`Mozilla`/`Chrome` present), no request
carries the old `Accept: application/geo+json` override, zero uncaught page errors, the fallback
badge still renders honestly once every live call is aborted, and the new `console.warn`
diagnostics fire with the resort id and a classified reason. **9/9 passing.**

## Fix 2 (MAJOR) — Chase-the-Snow had no off-season state

It was August 4th in production. `historicalEstimate()` computed `annual_snowfall / 18` regardless
of the calendar, so an August lookup reported a mid-winter figure as "typical" — the Director's own
example, Mt. Baker at 35.6" (641 annual / 18 = 35.6 exactly), reported in a month with zero snow
anywhere in North America. Two parts, per the brief.

### (a) `historicalEstimate()` is now season-aware (`noaa.js`)

Every resort carries `season_open`/`season_close` free-text fields (confirmed in
`research/resorts-schema.md` and present on all 71 resorts in `data.js` — e.g. `"Mid-Nov"`/`"Late
Apr"`). `parseSeasonBoundary()` extracts the first `"{Early|Mid|Late} {Month}"` match from that
text (handles all six of the dataset's messier free-text cases — `"Late Apr/early May"`, `"Early
Dec (snow-dependent; no snowmaking)"`, etc. — since the regex only needs the leading, well-formed
part of the string). `seasonFraction(resort, now)` returns 1 inside the resort's own published
window, ramps linearly to 0 over `SEASON_RAMP_DAYS = 21` (~3 weeks) on either side of open/close —
so October and May land somewhere in between, never a hard flip on a single calendar day, per the
brief's explicit boundary requirement — and 0 well outside it. `historicalEstimate()` now
multiplies its weekly figure by this fraction. When a resort's season text can't be confidently
parsed, the function falls back to **no discount** (the old always-on behavior) rather than
guessing at a date it doesn't have — audited against the full dataset, the only resort this
actually affects is Timberline (Mt. Hood), whose close field reads `"Year-round on the Palmer
snowfield (seasonal closures vary)"`, which is honestly the correct outcome: it genuinely does ski
into summer, so "no seasonal discount" is the accurate answer for that one specific record, not a
gap.

**Verified directly**: `verify_season_state.js` calls `historicalEstimate()` against Mt. Baker for
three dates: August 4 → 0.6" (was 35.6" before the fix; `seasonFraction` ≈0.016), January 15 →
35.6" (confirming the fix is season-aware, not "always zero" — a real mid-winter figure still comes
through), and November 1 (three weeks before Baker's own Mid-Nov open date) → a value strictly
between zero and the January figure, confirming the ramp, not a hard flip, at the function level
directly.

### (b) Chase-the-Snow's three states

`classifySeasonState(pool, now)` (`noaa.js`) classifies "right now" against the full 61-resort US
pool's season windows *before* any forecast fetch is attempted — a calendar judgment, not a
network one. A resort counts as "meaningfully open" (`SEASON_OPEN_FRACTION = 0.5`) at 1
(in-season) or past halfway through its own pre-season ramp (within ~10 days of its published
open date). The share of the pool that clears that bar decides the app-level state:
`SEASON_STATE_OFF_MAX = 0.10`, `SEASON_STATE_IN_MIN = 0.70`, shoulder in between. These thresholds
were tuned against the real dataset's actual day-by-day spread, not a formal spec (none exists at
this granularity) — worked numbers: Aug 4 → openShare 0.016 (off-season), Oct 28 → 0.148
(shoulder), Nov 15 → 0.738 (in-season), Jan 15 → 1.0 (in-season), May 1 → 0.246 (shoulder), Jun 10
→ 0.033 (off-season). Full day-by-day sweep was computed via a throwaway probe script against the
real `RESORTS` dataset before picking these numbers, not guessed.

- **Off-season** (`renderChaseOffSeason()`, `app-chase.js`): replaces the ranked list entirely —
  no controls (region/beginner-friendly have nothing to act on with no ranking shown), no near-zero
  forecast list. Shows: a plain heading ("Nothing's open right now"), a body naming when to come
  back and what to do meanwhile ("Most resorts open in November. Plan a trip now, then come back to
  chase the snow once the season starts."), a `<button>` CTA that routes straight into the trip
  planner (`navigate("plan")` — the one genuinely useful action for an August visitor), and an
  optional, collapsed-by-default disclosure ("See where it typically dumps in mid-winter") that
  reveals the top 5 resorts by published `avg_annual_snowfall_in`, explicitly labelled "Typical
  season, not a forecast" with a helper line reinforcing it's a normal-season figure, not current
  conditions. Reused the existing `notes-row__expand-btn` `aria-expanded`/`aria-controls`
  disclosure pattern verbatim (same one that drives the ski-school evidence disclosure) rather than
  inventing new interaction — and reused the existing Canada section's `typical-season-tag`/
  `canada-divider` honesty-labeling visual language, generalized `canadaRowHtml()` into a shared
  `typicalSeasonRowHtml()` used by both surfaces, since they're the same underlying idea (labelled
  historical data, never dressed as a forecast). Tapping into a preview row still opens a real
  detail view — since there's no forecast fetch at all in this state, `showChaseRowDetail()` now
  falls back to an honest annual-average bullet ("Averages about {{n}}\" a year in a typical
  season.") instead of a forecast-shaped sentence it has no data to back.
- **Shoulder** (October, May): the normal ranked list still renders, but the candidate pool fed
  into the fetch/ranking step is filtered to only resorts individually at/above
  `SEASON_OPEN_FRACTION` — a resort three weeks from its own published open date isn't made "open"
  by NOAA having a coordinate for it. A quiet, honest banner ("Not every resort is open yet this
  time of year. This list only includes places that are typically running by now.") explains why
  the list is shorter, reusing the `canada-divider` visual pattern again rather than a new banner
  style. Controls stay visible — ranking is still meaningful here, just over a smaller pool. A
  safety net: if the aggregate classification says "shoulder" but literally zero resorts
  individually clear the bar yet (the very start of the ramp), it falls back to the same honest
  off-season screen rather than rendering an empty list.
- **In-season**: unchanged from before this fix.

**Design decision, stated plainly** (per the brief's "design this properly" ask): the off-season
screen is not a banner bolted onto the existing ranked list — it fully replaces it, because a
ranked list of near-zero numbers is the dishonest thing being fixed, not a cosmetic complaint about
it. The mid-winter preview is the one piece of content judged worth surfacing in August, and it's
worth it specifically *because* it's clearly labelled as typical-season, not current — an unlabeled
version of the same list would recreate the original bug in a different location.

**Verified**: `verify_season_state.js` controls the clock via a `context.addInitScript()` `Date`
override (not `page.clock`, which also freezes real timers this app's loading-state escalation
depends on — a plain `Date` override leaves `setTimeout`/animation timing untouched while still
faking the calendar) for August 4, January 15, and October 28, both light and dark themes, 61
checks total: correct state classification, correct heading/body/CTA/banner content and honest
labelling, controls shown/hidden correctly per state, the off-season CTA actually routes to the
trip planner, the preview expands and is properly labelled, tapping a preview row opens a real
detail view with an honest bullet, the shoulder state's *candidate pool* (not just the
display-truncated row count, which is always capped at 8 regardless of pool size) is a genuine
subset of the full US pool while January's is the full pool, and zero uncaught page errors in every
case. Screenshots: `screenshots/chase-offseason-aug-{light,dark}.png`,
`screenshots/chase-offseason-aug-preview-expanded-{light,dark}.png`,
`screenshots/chase-shoulder-oct-{light,dark}.png`, `screenshots/chase-inseason-jan-{light,dark}.png`.

## Test-suite fallout from freezing "today" as a variable, not a constant

Five existing verify scripts (`test.js`, `verify_contrast.js`, `verify_share_and_offline.js`,
`verify_zoom_overlap.js`, `verify_fixround.js`) navigate to Chase-the-Snow and assert on the normal
ranked-list surface (screenshots, freshness-badge contrast, offline-resilience row counts, 200%-zoom
overlap checks, the skip-ahead escalation flow) — all written before the off-season state existed,
when "today" was implicitly always in-season. Run for real on 2026-08-04, all five would have
landed in the new (correct) off-season screen instead of the ranked list they're actually testing,
and either failed outright (elements they expect don't exist) or silently stopped testing what they
were written to test. Each got a small `freezeToInSeasonDate()` helper (`context.addInitScript()`
pinning `Date` to 2026-01-15, deep in-season, applied only to the specific `context`/page that
touches Chase) added right before the relevant `page.goto()` — noted inline in each file's own
comment, not a silent change. This is the correct fix, not a workaround: those five scripts'
*actual* intent (ranked-list layout/contrast/offline/escalation behavior) is orthogonal to the
off-season feature, which now has its own dedicated coverage in `verify_season_state.js`. Two
scripts that also touch Chase needed no change: `verify_dom_prose_sweep.js` calls
`showChaseRowDetail()` directly against `RESORTS_BY_ID`, which doesn't depend on Chase's list state
at all; `verify_engine.js` calls `rankChaseTheSnow()` with synthetic forecast data directly, never
through the season-classification/date-dependent path.

## No-regression pass (production fix round)

| Check | Result |
|---|---|
| `test.js` | 0 console/page errors |
| `verify_zoom_overlap.js` | 76/76 |
| `verify_badge_system.js` | 292/292 |
| `verify_responsive.js` | 23/23 |
| `verify_a11y.js` | 23/23 |
| `verify_engine.js` | 0 crashes, 0 empty results, 0 banned/strict violations |
| `verify_fixround.js` | 29/29 |
| `verify_share_and_offline.js` | 14/14 |
| `verify_hottake_sweep.js` | 0 banned-word violations |
| `verify_contrast.js` | 10/10 |
| `verify_reason_anchor_sweep.js` | 7/7 |
| `verify_focus_entry.js` | 4/4 |
| `verify_dom_prose_sweep.js` | 12/12 |
| `verify_noaa_headers.js` (new) | 9/9 |
| `verify_season_state.js` (new) | 61/61 |

Offline operation re-confirmed intact by `verify_share_and_offline.js`'s existing fully-blocked-
network check (now pinned to an in-season date so it's still testing the ranked-list offline path,
not the off-season screen). Zero console errors across the full re-shot screenshot sweep in `test.js`.

## What this environment could and couldn't prove about the live NOAA path

**Proven, from the actual outgoing browser request**: the app no longer sets a custom `User-Agent`
or `Accept` header on the live NOAA fetch — `verify_noaa_headers.js` intercepts the real request
Chromium builds (via Playwright's `page.route()`, which operates at the browser's network layer
before dispatch) and asserts this directly, not by reading the source and trusting it matches what
ships.

**Not provable from here, and worth saying plainly since the Director is the one who'll find out**:
this sandbox's own network egress to `api.weather.gov` is blocked, the same constraint noted in
every prior round of this build. That means:
- The fix is believed-correct against NWS's own documented, publicly-confirmed explanation of the
  bug (a real GitHub discussion from the API's maintainers, not a guess) — but it has never been
  proven against a real response from the live API, from any environment available to this build.
- `fetchLiveForecast()`'s parsing logic (`snowfallAmount`/`temperature` as `{values: [{validTime,
  value}]}` arrays inside `forecastGridData`) is written directly against NWS's documented schema
  and has been true since the very first build round, unchanged by this fix — it remains
  unconfirmed against a real payload.
- There could in principle be a second, different failure mode on the live path that a header fix
  doesn't touch (a rate limit, a different CORS wrinkle on the second `/gridpoints` call
  specifically, a schema drift from what's documented) — nothing in this environment can rule that
  out.

**The honest bottom line**: the specific, confirmed bug the Director hit (CORS preflight from a
custom `User-Agent`) is fixed and proven fixed at the request level. Whether the live forecast
*fully* works end-to-end in production — reaching api.weather.gov, getting a 200, parsing correctly
— can only be confirmed by loading the deployed app from a real network and checking. That's the
one claim in this round that's a strong inference from NWS's own public documentation, not a
verified fact from this build.
