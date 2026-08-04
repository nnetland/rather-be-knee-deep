# Ski Reco App — Design Strategy

_Design-strategist · 2026-08-03_
_Authoritative sources: `docs/designpowers/briefs/2026-08-03-scope-revision-1.md` (supersedes
conflicts with the original brief), `2026-08-03-ski-reco-app.md`, `research/competitive-analysis.md`,
`research/resorts-schema.md`, `research/verification-report.md`._

This document formalizes strategy for the three-surface app confirmed in scope-revision-1: **Plan
a trip**, **Chase the snow**, **Nicole's list**. It corrects and extends the provisional
Brief/Personas/Principles design-scout left in `design-state.md`, resolves the architecture
question, specifies the two matching models field-by-field, and makes a final call on the Canada
coverage gap.

Personas: see `docs/designpowers/personas/2026-08-03-ski-reco-personas.md` — five personas
(Priya, Dana, Marcus, Jordan, Nicole), built with the `inclusive-personas` skill, spanning the
full confirmed audience and the ability spectrum woven into real trips rather than carved off.

---

## 1. The two-mode architecture

### 1.1 The entry point is a mode choice, not a default

A cold visitor arriving at the bare app URL sees a splash screen with two large, equal-weight tap
targets — **not** a trip-planner quiz that a powder hound has to click through, and **not** a
ranked snow list that a first-timer lands on with no idea what it means.

```
[ Plan a ski trip ]          [ Chase the snow ]
  Answer 5 quick               See where it's
  questions, get one           dumping this week
  solid pick

            See everywhere Nicole's skied →
```

**Why not let one mode lead:** Jordan (the powder hound persona) bounces off a five-question vibe
quiz — he came to see a ranked list in ten seconds. Priya (first-timer) is lost by a bare
ranked-by-inches list with no explanation of what she's looking at. Defaulting to either mode
correctly serves half the confirmed audience and actively mis-serves the other half. A one-tap
mode choice costs each user a single extra tap; the wrong default costs a chunk of the audience
the whole session. That trade is not close.

**What a cold visitor from an Instagram DM actually sees** depends on which link Nicole sent, and
both paths need to be designed for, not just the happy one:
- **She sends the bare app link** ("just use this") → lands on the mode-choice splash above.
- **She sends (or a friend forwards) a specific result card link** — the far more common real
  path, since the shareable result card *is* the product per principle 1 — the visitor lands
  directly on that result screen. That screen needs its own re-entry path: a small, secondary
  "Make your own" CTA below the fold that routes to the mode-choice splash, not buried inside
  chrome. This is the actual primary cold-start case and design-lead should treat the result
  screen's own re-entry CTA as first-class, not an afterthought bolted onto a page built for
  the person who already has a result.

### 1.2 The two recommendation modes are genuinely separate flows — I agree with scope-revision-1, and I'd push it further

Pressure-testing the brief's claim: is there a version where these share a flow more than the
brief assumes? I looked for one and don't think there is. The two modes differ on every axis that
would normally argue for a shared flow:

| | Plan a trip | Chase the snow |
|---|---|---|
| Time horizon | Weeks–months | 0–7 days |
| Input volume | 5 questions (topic-level) | Near-zero — optional origin, optional filter |
| Output shape | One confident pick, reassurance-forward | Ranked list of 5–8, scan-forward |
| User posture | Considered, anxious-to-confident | Fast, confident-to-decisive |
| Data source | Static dataset only | Static dataset + live NOAA forecast |
| Tone (ties to Principle 4, revised below) | Reassuring | Efficient, respects competence |

Forcing a shared flow would mean either padding the snow-chase mode with questions Jordan doesn't
want to answer, or stripping the trip-planner's reassurance-forward pacing to satisfy a chaser's
need for speed. Both compromises actively damage a primary persona. **Decision: fully separate
flows, fully separate screens, sharing only what's listed below.**

**What they share (and only this):**
- The resort dataset (`resorts.json`) as the single source of truth.
- The result-card visual component and its accessibility rules (shape+label difficulty encoding,
  contrast, generous tap targets) — one component library, two contexts.
- The "Nicole's Hot Take" block treatment (quarantined, explicitly labeled, absent-not-fabricated
  when she has no take — per scope-revision-1 §1).
- The reason-not-score philosophy (Principle 2/3 below) — both modes explain themselves in the
  user's own terms, never as a bare percentage.
- The mixed-ability weighting *logic* (§3 below) — a snow-chaser can still be planning a mixed
  group trip; that mode surfaces it as a single optional toggle, not a full question, but the
  underlying "don't average, check both ends" logic in §3 is the same engine.

### 1.3 Moving between modes without losing your place

A slim, persistent nav (three items: Plan / Chase / Nicole's List) sits in the app chrome around
both quiz/list surfaces — but is **not present on the shareable result card itself**, per
Principle 1: the result has to survive being screenshotted with zero app chrome bleeding into it.

In-progress trip-planner answers persist in `sessionStorage`, not an account — if Marcus jumps
from Plan-a-Trip to Chase-the-Snow mid-quiz to check something and comes back, his answers are
still there. This is same-session convenience, not the cross-session personalization the brief
rules out — it clears on tab close, same as `sessionStorage` is designed to. No accounts, no
backend user state.

### 1.4 Nicole's list is a supporting reference, not a peer recommender

It's a third nav item and it's genuinely useful on its own, but it doesn't get its own question
flow or matching logic, for three reasons: (1) the scope-revision brief's own framing puts it on
a different axis — "where have you actually been" is a credibility check, not a recommendation
job; (2) its most valuable integration point is already specified — hot takes join onto resort
records and surface inside both recommendation modes, so its recommendation value is already
delivered *through* the other two surfaces; (3) giving it independent recommendation logic would
create a fourth ranking algorithm to keep consistent with the other two, for a surface whose job
is "browse and trust," not "decide." **It's a browsable, filterable list (by region, by rating)
with each entry showing her hot take where she has one — nothing more architecturally ambitious
than that.** Every result card that has a hot take links back to "Nicole's list" as a way to see
more of her opinions in context — that's its primary traffic path, not the splash screen.

---

## 2. The trip-planner question flow

Five question **topics**, tap-only throughout, no sliders, no free text, no typing anywhere. A few
topics use two related taps on one screen (consistent with the brief's "five questions" being
topics, not a hard tap-count ceiling) — this matches the competitive research finding that
front-loaded *difficulty*, not raw tap count, drives drop-off.

### Q1 — Group composition and mixed-ability (asked first; the differentiator)

**Intent:** Capture the group's skill *spread*, not a single number. This sets a mode flag that
changes how Q2 is asked and how the matching model weights terrain fields — it is the single most
architecturally important answer in the flow.

**Screen copy:** "Who's coming, and does everyone ski about the same?"

**Options (single-select, 4 tappable cards):**
- "Just me" → `solo`
- "We're all about the same level" → `matched`
- "We're mixed — a beginner or two with more experienced skiers" → `mixed`
- "Wide range — true first-timer to expert in one group" → `wide-mixed`

**Maps to:** No direct `resorts.json` field — this is a control-flow input. It determines whether
Q2 is asked as a single-select or multi-select, and it flags the resort's mixed-ability scoring
path (§3) as active.

### Q2 — Skill level(s) and terrain appetite

**Intent:** Get the actual skill level(s) present, and separately, what kind of terrain they're
hoping for — two related taps on one screen.

**Q2a copy:** For `solo`/`matched`: "What's your level?" (single-select). For `mixed`/`wide-mixed`:
"Tap every level in your group" (multi-select). Five pill options either way: Never-ever /
Beginner / Intermediate / Advanced / Expert.

**Maps to:** the min/max of selected levels becomes the group's skill floor and ceiling, used
against `terrain_pct.beginner`, `terrain_pct.advanced_expert`, `beginner_friendliness`, and
`family_ski_school` per the min-max logic in §3.

**Q2b copy:** "What terrain are you hoping for?" (single-select, 4 pills): Groomers & cruising /
A mix of everything / Steep and challenging / Doesn't matter, just here to ski.

**Maps to:** weights toward `terrain_pct.intermediate` (groomers/cruising), a balanced weighting
(mix), `terrain_pct.advanced_expert` + `best_for_tags` containing `steeps`/`tree-skiing`/
`deep-powder` (steep and challenging), or a neutral/low weight on terrain fit generally ("doesn't
matter" — an explicit first-class flexible answer, per the competitive research's Airbnb-flexible
finding).

### Q3 — Budget

**Screen copy:** "What's the budget like?" (single-select, 4 pills, plain-language glosses):
Budget-conscious ($) / Mid-range ($$) / Splurge-friendly ($$$) / Money's no object ($$$$).

**Maps to:** `cost_tier`, direct 1:1 enum match.

### Q4 — Drive or fly, and from where (the hard one, solved without free text)

**The problem:** origin drives real feasibility filtering (§3) and is the one input a naive design
would want to solve with a text box or an address autocomplete — both banned by the tap-only,
motor-accessibility constraint (Marcus, Nicole-gloved-hands) and by the no-typing spirit of the
brief. Solved with a coarse region grid instead of precision geocoding — good enough to filter
"is this realistically reachable," not intended to be routing-precise (the dataset's own
`airport_drive_time_min` is documented as estimated, not routed, so precision here would be false
precision anyway).

**Screen 1 copy:** "Driving or flying?" (single-select, 3 cards): Driving / Flying / Not sure yet
— show me both.

**Screen 2 copy (skipped if "not sure yet"):** "Which is closest to home?" — a grid of ~10 tappable
region chips, each a real hub, not a precise city: Denver & the Rockies / Salt Lake & Utah /
Seattle & Portland / SF Bay Area / LA, SoCal & Vegas / Chicago & the Midwest / NYC, Boston & the
Northeast / DC & the Mid-Atlantic / Toronto & Eastern Canada / Vancouver & Western Canada /
Somewhere else.

**Maps to:**
- **Driving + region selected:** filters/penalizes resorts by matching the region against each
  resort's free-text `drive_to_metro` field (keyword match against the named metro) and treats
  `airport_drive_time_min` as a rough proxy for driveability distance where `drive_to_metro`
  doesn't name the region directly. This is a soft gate, not a hard cutoff — see §3.
- **Flying + region selected:** matches against `nearest_airport` and the `easy-flight` tag;
  `airport_drive_time_min` becomes "time from airport to slopes" rather than "time from home,"
  and is surfaced as a logistics fact on the result card, not used to penalize.
- **"Not sure yet":** travel-feasibility weight in §3 drops to zero for this run, and the result's
  reason text says so plainly ("we didn't factor in how far this is, since you weren't sure yet")
  — honesty over silently guessing.

### Q5 — Vibe: après, town, and scene

**Screen copy:** "What's the scene you want?" (single-select, 4 pills): Lively après & nightlife /
Chill and low-key / Family-friendly, not too wild / Don't care, just here to ski.

**Maps to:** keyword-matches `town_vibe` (free text) and boosts `best_for_tags` containing
`apres-scene`, `quiet`, or `family` respectively; "don't care" is a valid flexible answer with
zero weight on this axis, same pattern as Q2b's "doesn't matter."

---

## 3. The matching model — Plan a Trip

### 3.1 Weight categories

| Category | Weight | Why this weight |
|---|---|---|
| Terrain & skill fit (incl. mixed-ability logic) | 35 | The differentiator and the single biggest driver of whether the trip is actually good — a wrong terrain match ruins a trip no amount of good vibe or budget fit can save |
| Travel feasibility | 20 | Partly a soft gate, not just a weight (see below) — a geographically impossible pick is a wrong answer, not a slightly-lower-scored one |
| Budget fit | 15 | Real constraint, but more forgiving — "a bit more than hoped" beats "wrong terrain for your group" |
| Vibe / town fit | 15 | Matters for satisfaction but is the most substitutable axis — several resorts can satisfy "lively après" |
| Non-ski / family infrastructure | 15 | Only weighted meaningfully when the group includes a beginner or kids (Q1/Q2 signal); near-zero weight for a solo expert |

### 3.2 Mixed-ability groups: the actual differentiator, and why averaging is wrong

**The naive approach — reject it explicitly:** average the group's skill levels (beginner +
expert → "intermediate") and recommend an intermediate-skewed resort. This produces exactly the
outcome Marcus already lived through and is trying to avoid: nobody in the group is actually well
served, because "intermediate" terrain doesn't make a first-timer feel safe *and* doesn't give an
expert anything to do. Averaging discards the one fact that matters — the *spread*.

**The model instead, per resort:**
1. Take the group's skill **floor** (lowest level selected in Q2a) and **ceiling** (highest level
   selected).
2. Score the floor against `beginner_friendliness` (not `terrain_pct.beginner` alone — the schema
   is explicit that a resort can have a good ski school and still be a poor beginner match, e.g.
   Jackson Hole, Kicking Horse; `beginner_friendliness` is the synthesized signal built for
   exactly this) plus `family_ski_school` if the floor implies lessons (`never-ever`/`beginner`).
3. Score the ceiling against `terrain_pct.advanced_expert` and `best_for_tags` membership in
   `steeps` / `tree-skiing` / `deep-powder` for `advanced`/`expert` ceilings.
4. **The resort's mixed-ability subscore is the minimum of the floor-score and the
   ceiling-score — a bottleneck function, not an average.** A resort that's a 9/10 for experts and
   a 2/10 for beginners scores a 2, not a 5.5. This is the concrete mechanism that stops the model
   from recommending famous-but-one-note mountains (Jackson Hole, Alta, Kicking Horse,
   Revelstoke — all correctly flagged `weak` beginner-friendliness in the verified dataset) to a
   mixed group, regardless of how strong their advanced terrain is.
5. Resorts that score well on both ends genuinely exist in this dataset (broad-spectrum resorts
   with both strong beginner terrain and real advanced terrain) — these are exactly what a
   mixed-ability group should see ranked at the top, and the min-max function surfaces them
   without needing to hardcode a "good for mixed groups" list.

**A named data gap, flagged rather than faked:** whether a resort's beginner and advanced terrain
are physically *proximate* (same base area, easy to regroup for lunch) matters to a mixed group
and isn't reliably inferable from the current schema (`character_note` and `town_vibe` sometimes
hint at it, but not consistently or structurally). **Recommendation: this is a future data
enrichment (a `terrain_connected` or `easy_to_regroup` boolean), not something to fake by
overloading an existing field.** Flagging to design-scout/data owner rather than quietly guessing.

### 3.3 Tie-breaking and avoiding "always the same three famous resorts"

When top-scoring resorts land within a narrow band (near-tie), break ties in this order:
1. **Presence of a Nicole hot take** — a resort she's actually vouched for outranks one she
   hasn't, among otherwise-comparable options. This is a deliberate, principled tiebreaker, not a
   hidden bias — it's Principle 2 made concrete.
2. **Anti-repetition nudge** — a lightweight, device-local (not account-based) memory of the last
   few resorts shown on *this device* nudges away from repeats. `localStorage`, not a user
   profile — same device remembering, not personalization across identity, so it doesn't violate
   the no-accounts constraint.
3. **Weighted-random selection among the remaining tied set**, seeded per-session so identical
   answers *within the same session* return the same result (a user re-checking their answer
   shouldn't see it change under them), but different sessions with similar-but-not-identical
   inputs can surface different, comparably-good resorts. This is the direct fix for "always
   Vail/Whistler/Park City": the model only randomizes among resorts that are *actually* tied on
   merit — it never trades away quality for variety, but it stops treating a 0.3-point score gap
   as a real difference worth always resolving the same way.

Note that the min-max mixed-ability logic and the travel-feasibility gate (§3.4) already do most
of the diversifying work structurally — a famous resort is only "the answer" when it genuinely
fits this specific group's spread, budget, and origin, not by default.

### 3.4 Travel feasibility: soft gate, not just a weight

Unlike the other four categories, travel feasibility can produce genuinely wrong answers, not just
lower-quality ones — recommending Vail to someone in Seattle who said "driving, under 2 hours" is
a wrong answer, not a 15th-percentile one. So: when a driving-distance answer implies a resort is
unreasonably far (using the coarse region-match from Q4), that resort is **excluded from the
top-ranked result**, not merely down-weighted — though it may still appear lower in a "here's what
else fit your other answers" secondary list if the design allows one. Flying and "not sure yet"
answers use the 20-point weight as a normal soft signal, not a gate.

### 3.5 Producing a reason, not a score

**Never show a bare percentage or score to the user.** The result explains itself using 2–3
bullets built from the resort's highest-weighted categories, phrased back in the user's own
answer language:

> "You said your crew ranges from first-timer to expert — Big Sky has real beginner terrain *and*
> genuine advanced/expert terrain, so nobody's stuck on the bunny hill or bored on the blues."
>
> "You're driving from Denver — this is under two hours, no flight needed."
>
> "You said budget-conscious — this comes in at $ compared to most of Colorado's $$$$ crowd."

Each bullet must trace to a specific question the user actually answered — this is the concrete
mechanism behind Principle 3 below ("because you said X beats 87% match").

### 3.6 Null-field handling — never silently penalize

17 of 54 resorts have `terrain_pct: null`. The model must **never** treat a null as zero or as a
negative signal, and must never divide a score by an assumed-present field. Concretely: when
`terrain_pct` is null, the terrain & skill fit subscore falls back to `beginner_friendliness` /
`family_ski_school` / `best_for_tags` (all non-null for all 54 resorts) and is computed on a
renormalized basis, as if the missing field simply isn't part of the sum for that resort. On the
result card's supporting-detail panel, if terrain breakdown is shown and it's null, the copy reads
**"Terrain breakdown not published by the resort"** — never a blank, never a fabricated "0%",
never an interpolated guess. This is a content rule for content-writer and a data-binding rule for
design-builder, both inherited from this model.

---

## 4. The matching model — Chase the Snow

### 4.1 Inputs: near-zero, on purpose

Loading the mode with zero input immediately shows a ranked list across all US resorts (Canada
handled separately, §5), because Jordan and Nicole both want speed over configuration. Two
**optional** single-tap refinements sit above the list, not gating it:
- **Origin** (same ~10-chip region grid as Q4, reused from the trip-planner's session state if the
  user came from there) — enables the feasibility discount described below; skippable, and the
  list works fully without it.
- **"Include beginner-friendly options"** toggle, off by default — the mode's default audience is
  powder hounds, so beginner-friendliness is opt-in here rather than a full question, reusing the
  same underlying weighting logic as §3 rather than a new system.

### 4.2 Ranking formula

Raw forecasted inches is a bad sole sort key — a powder hound doesn't treat 8" of wet Cascade
cement the same as 8" of cold Utah smoke, and doesn't want to fly toward terrain that can't use a
big dump anyway. Score per resort:

```
score = (0.45 × normalized_snowfall)
      + (0.20 × snow_quality_multiplier)
      + (0.20 × terrain_worth_it_multiplier)
      − (0.10 × crowd_penalty)
      [then: feasibility discount/gate applied if origin given]
```

- **`normalized_snowfall`** — summed NOAA `snowfallAmount` (mm→in) across the 7-day gridpoint
  forecast, normalized against the current field of results so the scale is relative to this
  week's storm distribution, not an absolute inches threshold that would be meaningless in a
  low-snow week.
- **`snow_quality_multiplier`** — derived from the average temperature during the forecasted snow
  event (also in NOAA's gridpoint data): colder average temp → higher multiplier. Surfaced to the
  user as a plain descriptor ("cold and light" / "heavier, wetter snow"), never as an internal
  number — this is a transparency requirement, not just a nice tone choice.
- **`terrain_worth_it_multiplier`** — boosts resorts whose `best_for_tags` include `deep-powder`,
  `steeps`, or `tree-skiing`, and whose `terrain_pct.advanced_expert` is high; a groomer-heavy
  resort's raw inches are discounted relative to a terrain-rich resort's, because the same storm
  is worth more at the second resort.
- **`crowd_penalty`** — a small negative weight when `crowd_level` is `brutal`, surfaced in the
  reason text ("heads up — this gets crowded on a powder day") rather than hidden.
- **Feasibility** — if an origin was given, resorts unreachable within a realistic window (driving
  distance too far, or no easy-flight path per `easy-flight` tag / `airport_drive_time_min`) are
  discounted heavily or excluded, same soft-gate logic as §3.4. If no origin was given, this step
  is skipped and the UI says so, same honesty rule as the trip planner.

### 4.3 Output shape

A scannable ranked list (5–8 resorts), each row: resort name, forecast-inches badge (shape + text,
never color-only per Jordan's persona), one-line reason ("Cold, light snow + steep terrain to use
it"), feasibility note when origin is set, crowd flag when relevant, hot-take chip when Nicole has
one for that resort. No quiz, no multi-screen flow — this list is closer to the entry screen than
the trip-planner's result is.

---

## 5. The Canada gap — required decision

NOAA is US-only; 11 of 54 resorts are Canadian, including Whistler, Revelstoke, Kicking Horse, and
Lake Louise — arguably the most powder-relevant names in the whole dataset, and exactly the
resorts Nicole (the persona) would notice missing first.

**Evaluating the three named options plus a fourth:**

- **(a) Exclude Canada entirely, with a visible explanation.** Simplest, cheapest, and fully
  honest — zero risk of ever showing stale data as live. But it fails success criterion #4 in a
  specific, avoidable way: Nicole herself, chasing a storm at her own home resorts, gets nothing.
  Whistler being invisible from the mode built to serve powder hounds is a real product cost, not
  a hypothetical one.
- **(b) Show Canadian resorts using historical averages, clearly labeled not-a-forecast.** Keeps
  Canada visible, but blending a genuinely different data type (season-long average) into a list
  whose whole premise is "what's happening in the next 7 days" risks confusing exactly the users
  who are moving fastest and reading least carefully (Jordan, Nicole under time pressure) — even
  with a label, a historical-average number sitting in a "next weekend" ranked list is a trap for
  skimming.
- **(c) Environment Canada's MSC GeoMet as a second live source.** I looked at what's knowable
  without live network access (this container cannot reach it, so **this is explicitly
  unverified**): GeoMet is real and is generally described as not requiring an API key, but it's
  built around OGC WMS/WFS/geospatial-tile access rather than NOAA's simple per-point JSON
  gridpoint lookup — getting a clean "7-day snowfall at this lat/lon" equivalent likely means
  sampling a raster/grid product or parsing a forecast-bulletin feed, a materially harder
  integration than NOAA's `/points` → `/gridpoints` flow, and CORS/browser-callability is
  unconfirmed. Recommending this as the *v1* answer would mean shipping on an unverified
  assumption twice (we already have one unverified assumption on NOAA itself, per
  scope-revision-1's flag) — too much unverified surface for a launch dependency.
- **(d) What I'm actually recommending — a two-tier list, not a single blended one.** Show US
  resorts ranked by the live NOAA-driven score from §4 as the primary list. Show Canadian resorts
  in a **clearly separate section below it**, titled plainly — "Canada — no live forecast
  available" — sorted not by a fabricated "this week" number but by `avg_annual_snowfall_in` and
  powder-relevant tags, explicitly relabeled in copy as **"typical season, not this week"**, with
  a line pointing to checking the resort's own snow report or Environment Canada directly for
  this week's actual number. This satisfies the brief's hard rule (never present historical as
  live) while still surfacing Whistler/Revelstoke/Lake Louise somewhere Nicole will actually see
  them, rather than making them disappear.

**Decision: (d), which is closer to a disciplined version of (a)+(b) together than either alone —
never blended into one ranked-by-inches list (that's the (b) risk I'm avoiding), never simply
absent (that's the (a) cost I'm avoiding).** (c) is the right longer-term fix and should be a
flagged fast-follow research task once network access allows real verification — **not** a v1
dependency, per the brief's explicit requirement that any unverified-API recommendation carry a
fallback. The fallback here *is* the v1: the two-tier list doesn't change if GeoMet later ships: it
just gets a live top tier for Canada instead of a historical-average one.

---

## 6. Design principles — ratified

Design-scout's three candidates are sound and are ratified as-is. The original brief's fourth
principle ("reassure, don't just rank") is corrected — it was true for the original beginner/
family-only audience and is now incomplete now that powder hounds are explicitly in scope: Jordan
does not want to be reassured, he wants to be respected as competent and shown a fast answer. A
fifth principle is added, ratifying something that already appears three separate times across the
source material (the hot-take absence rule, the null-`terrain_pct` rule, the NOAA-fallback
honesty rule) as one explicit, testable design principle rather than three unconnected footnotes.

### 1. The result screen is the product
**What it means in practice:** the trip-planner's result card and the snow-chase list both have
to work as standalone artifacts, screenshotted into a group chat, stripped of all app chrome.
**What it rules out:** nav bars, mode switchers, or any app chrome baked into the shareable
surfaces themselves.
**How to test:** screenshot the result with zero context and hand it to someone cold — does it
still make sense and still persuade?

### 2. Grounded data and one trusted human's voice, never either alone
**What it means in practice:** every result pairs the dataset's numbers with Nicole's Hot Take
where she has one — the numbers give it credibility, the take gives the numbers a reason to be
trusted, and neither substitutes for the other.
**What it rules out:** a numbers-only result that reads like a black-box score; a Nicole's-voice
that appears without the grounded data backing it up.
**How to test:** for any resort with a hot take, could you delete either the numbers or the take
and still have a persuasive result? If yes, they're not actually load-bearing together.

### 3. Ask about the group, not just the asker
**What it means in practice:** mixed-ability composition is asked first, weighted at 35 points,
and scored with the min-max bottleneck logic in §3.2 — not averaged into mediocrity.
**What it rules out:** any single-skill-level input as the only skill signal; any resort scoring
well by being merely "fine" at both ends rather than genuinely strong at both.
**How to test:** feed the model a true first-timer + expert pair — does it exclude the famous
one-note mountains (Jackson Hole, Alta) even though they'd win on raw prestige?

### 4. Match the pace and tone to the job, not one voice for both modes _(revised)_
**What it means in practice:** Plan-a-Trip is unhurried and reassurance-forward — it answers the
anxiety under the question ("will I be miserable," "will there be enough green terrain"). Chase-
the-Snow is fast, scannable, and assumes competence — no hand-holding copy standing between Jordan
and a ranked list he's going to read in ten seconds.
**What it rules out:** a single uniform "brand voice" applied identically to both modes;
reassurance copy in the snow-chase list; terse data-only copy in the trip-planner result.
**How to test:** read the Chase-the-Snow screen aloud to a powder hound persona — if it sounds
like it's talking down to them, it's wrong. Read the Plan-a-Trip result to a first-timer persona —
if it doesn't answer "will I be fine here," it's wrong.

### 5. Absence is honest; fabrication is the one unforgivable move _(new — ratifying a rule that already recurs three times)_
**What it means in practice:** a resort with no hot take shows no hot take block, not a
placeholder or a generated one (scope-revision-1 §1). A null `terrain_pct` shows "not published,"
not a guessed number or a blank read as zero (§3.6). A Canada snow-chase entry with no live
forecast is labeled "typical season, not this week," never presented as if it were live (§5).
**What it rules out:** any invented hot take, any interpolated null, any historical number
dressed up as a live forecast anywhere in either mode.
**How to test:** for every null or missing field surfaced anywhere in the UI, confirm the state
shown is an honest absence, not a fabricated or ambiguous value.

---

## 7. Summary of open decisions carried forward

- The `terrain_connected`/"easy to regroup" data enrichment flagged in §3.2 — not built, worth a
  future research pass.
- Environment Canada MSC GeoMet (§5, option c) — a real fast-follow, explicitly unverified, needs
  live network access to confirm CORS and response shape before it can replace the v1 two-tier
  Canada list.
- `timberline-or` remains the one low-confidence resort in the dataset (per verification-report.md)
  — worth a direct resort check before it's load-bearing in either matching model.
- Whether the trip-planner's secondary "here's what else fit" list (mentioned in §3.4, travel
  feasibility gate) ships in v1 or is deferred — I'd default to deferring it (one confident result
  is Principle 1) unless design-lead finds the single-result-only version tests badly for
  Marcus's "justify it to the group chat" use case.
