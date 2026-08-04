# Copy Deck — Ski Reco App

_content-writer · 2026-08-03 · Authoritative sources: `docs/designpowers/strategy.md`,
`docs/designpowers/personas/2026-08-03-ski-reco-personas.md`,
`docs/designpowers/briefs/2026-08-03-scope-revision-1.md`_

Every string below is final, ready-to-implement copy with a stable key. Reading level target:
Grade 6–8. Sentence case throughout. No exclamation marks except where genuinely earned (there
are none in this deck — nothing here is that exciting, and Jordan will bounce off forced
enthusiasm).

**A note on the app name:** no product/brand name has been ratified yet (open question, not
mine to resolve). Copy below never depends on one — where a name would help (share metadata),
I've written around Nicole's identity instead, since that's the actual trust signal for a cold
DM recipient. Flag to design-strategist/Director before ship.

---

## Vocabulary — use these words, not their synonyms

| Always use | Not | Why |
|---|---|---|
| your crew | your group, your party, your squad | Matches strategy.md's own reason-line examples ("You said your crew ranges..."); warmer than "group," not cutesy like "squad" |
| your pick | your match, your result, your recommendation | "Match" implies a score (banned — Principle 3/§3.5); "result" is app-internal language; "pick" is what a person says out loud |
| resort | mountain (except inside a direct Nicole quote) | Consistency; "mountain" drifts informal in ways that read inconsistent across 54 different-sized places |
| forecast | prediction, outlook | "Forecast" is the one word that pairs cleanly with "live" and "not live" — don't introduce a second word for the same concept |
| typical season / typical for this time of year | historical average, seasonal average | "Average" reads statistical and cold; "typical" is plain-language and is the word that makes the live/not-live distinction legible to someone skimming |
| hot take (lowercase in body copy) / **Nicole's Hot Take** (title case, section label only) | opinion, review, take | Matches the Director's own naming exactly (scope-revision-1 §1) |
| step | question | Q2 and Q4 are two taps on one topic — "step" avoids lying about the count ("5 questions" holds even when a step has two taps) |

---

## 1. Landing / mode splash

| Key | Copy |
|---|---|
| `splash.eyebrow` | Real ski recommendations from Nicole — pick a way in. |
| `splash.mode.plan.label` | Plan a trip |
| `splash.mode.plan.support` | Answer 5 quick questions. Get one solid pick. |
| `splash.mode.chase.label` | Chase the snow |
| `splash.mode.chase.support` | See where it's dumping this week. |
| `splash.nicoleslist.link` | See everywhere Nicole's actually skied |

`splash.eyebrow` is 10 words. It does three jobs at once: names the source (Nicole, the trust
signal), names the two-part nature of the data ("real" implies grounded, not a black box), and
frames the two buttons below as a choice rather than a form to fill out.

**Screen reader order note:** eyebrow line first, then the two mode buttons in DOM order
matching visual order (Plan / Chase), then the Nicole's-list link last. A screen reader user
landing cold should hear "here's what this is → here are your two choices → here's a third,
lower-commitment option" — the same decision order a sighted user scans.

---

## 2. The five trip-planner questions

Progress and navigation (shared across all steps):

| Key | Copy |
|---|---|
| `quiz.progress` | Step {{n}} of 5 |
| `quiz.back` | Back |
| `quiz.continue` | Continue |
| `quiz.startOver` | Start over |

**Screen reader note:** don't rely on auto-advance-on-tap alone. Every step — single-select and
multi-select — needs an explicit, focusable `Continue` control, even where auto-advance is the
visible/default interaction for sighted mouse/touch users. Marcus and Nicole (temporary
cold-fingers imprecision) both need the option to correct a mis-tap before it silently advances
them.

### Step 1 — group composition (the differentiator, asked first)

| Key | Copy | Maps to |
|---|---|---|
| `q1.title` | Who's coming, and is everyone about the same level? | control flow |
| `q1.opt.solo` | Just me | `solo` |
| `q1.opt.matched` | We're all about the same level | `matched` |
| `q1.opt.mixed` | A mix — some newer, some more experienced | `mixed` |
| `q1.opt.wideMixed` | A wide mix — first-timers to experts | `wide-mixed` |

**Delicate call, explained:** the strategy doc's draft option ("a beginner or two with more
experienced skiers") puts "beginner" on one person like a label. I rewrote both mixed options as
descriptions of the *group's range*, not descriptions of *a person in it* — "some newer, some
more experienced" and "first-timers to experts" describe a spread, not a member. Nobody
answering this question is naming themselves or a friend as the weak link; they're describing a
fact about the trip. Same information reaches the matching model (still cleanly maps to
`mixed`/`wide-mixed`), zero shame reaches the screen.

### Step 2a — skill level(s)

| Key | Copy | Maps to |
|---|---|---|
| `q2a.title.single` | What's your level? | shown for `solo`/`matched` |
| `q2a.title.multi` | Tap every skill level in your group | shown for `mixed`/`wide-mixed` |
| `q2a.helper.multi` | Select as many as apply. | multi-select instruction (visible + programmatic) |
| `q2a.opt.neverSkied` | Never skied before | floor input |
| `q2a.opt.beginner` | Beginner | floor input |
| `q2a.opt.intermediate` | Intermediate | floor/ceiling input |
| `q2a.opt.advanced` | Advanced | ceiling input |
| `q2a.opt.expert` | Expert | ceiling input |

**Jargon note:** the strategy draft used "Never-ever" — real industry shorthand for a total
first-timer, but it's shorthand a non-native speaker (Priya) or anyone outside ski culture has no
way to parse from the words alone. "Never skied before" says the same thing and needs no
glossary.

### Step 2b — terrain appetite

| Key | Copy | Maps to |
|---|---|---|
| `q2b.title` | What terrain are you hoping for? | — |
| `q2b.opt.groomers` | Smooth, groomed trails | `terrain_pct.intermediate` weighting |
| `q2b.opt.mix` | A mix of everything | balanced weighting |
| `q2b.opt.steep` | Steep and challenging | `terrain_pct.advanced_expert` + steep tags |
| `q2b.opt.noPreference` | Doesn't matter, just here to ski | flexible, zero weight on this axis |

"Groomers" (industry shorthand for machine-smoothed trails) becomes "smooth, groomed trails" —
keeps the real word "groomed" since it's genuinely useful vocabulary to learn once, but doesn't
make it load-bearing for comprehension.

### Step 3 — budget

| Key | Copy | Maps to |
|---|---|---|
| `q3.title` | What's the budget like? | — |
| `q3.opt.budget` | Budget-conscious ($) | `$` |
| `q3.opt.mid` | Mid-range ($$) | `$$` |
| `q3.opt.splurge` | Splurge-friendly ($$$) | `$$$` |
| `q3.opt.noLimit` | Money's no object ($$$$) | `$$$$` |

### Step 4a — driving or flying

| Key | Copy | Maps to |
|---|---|---|
| `q4a.title` | Driving or flying? | — |
| `q4a.opt.driving` | Driving | branches to 4b, hard travel gate |
| `q4a.opt.flying` | Flying | branches to 4b, soft travel weight |
| `q4a.opt.unsure` | Not sure yet — show me both | skips 4b, travel weight drops to zero |

### Step 4b — home region (skipped if "not sure yet")

| Key | Copy |
|---|---|
| `q4b.title` | Which is closest to home? |
| `q4b.opt.*` | Denver & the Rockies · Salt Lake & Utah · Seattle & Portland · SF Bay Area · LA, SoCal & Vegas · Chicago & the Midwest · NYC, Boston & the Northeast · DC & the Mid-Atlantic · Toronto & Eastern Canada · Vancouver & Western Canada · Somewhere else |

These are already plain-language, named real hubs — no rewrite needed.

### Step 5 — vibe

| Key | Copy | Maps to |
|---|---|---|
| `q5.title` | What's the scene you want? | — |
| `q5.opt.lively` | Buzzing nightlife and bars | `apres-scene` tag, `town_vibe` keyword |
| `q5.opt.chill` | Chill and low-key | `quiet` tag |
| `q5.opt.family` | Family-friendly, not too wild | `family` tag |
| `q5.opt.noPreference` | Doesn't matter, just here to ski | flexible, zero weight on this axis |

**Jargon note:** "après" (untranslated in the strategy draft's "Lively après & nightlife") is one
of the four terms the brief names explicitly as needing translation. "Buzzing nightlife and bars"
carries the same meaning with a word every reader already owns.

---

## 3. Snow-chase mode

| Key | Copy |
|---|---|
| `chase.title` | Where's it dumping? |
| `chase.origin.prompt` | Closest to home? (optional) |
| `chase.origin.skip` | Skip |
| `chase.beginnerToggle.label` | Include beginner-friendly options |
| `chase.beginnerToggle.helper` | Off by default — this list leans toward serious terrain. |

No title-screen preamble, no "here's how this works" copy — the list loads immediately per §4.1.
Anything more than the title and the two optional refinements above the list fails Jordan's
ten-second test.

**Freshness (how fresh is this forecast):**

| Key | Copy |
|---|---|
| `chase.freshness.live` | Live forecast · updated {{minutes}} min ago |
| `chase.freshness.stale` | Forecast delayed — last updated {{time}} |

**Ranked list row:**

| Key | Copy |
|---|---|
| `chase.row.forecast` | {{inches}}" forecast · next 7 days |
| `chase.row.quality.cold` | Cold, light snow |
| `chase.row.quality.wet` | Heavier, wetter snow |
| `chase.row.reason` | (data-bound: quality descriptor + terrain descriptor, e.g. "Cold, light snow + steep terrain to use it") |
| `chase.row.feasibility.driving` | {{hours}} drive from {{region}} |
| `chase.row.feasibility.flying` | Fly into {{airport}} · {{time}} to the mountain |
| `chase.row.feasibility.none` | (nothing shown — no origin means no invented distance) |
| `chase.row.crowd` | Heads up — this gets crowded on a powder day |
| `chase.row.hotTakeChip` | Nicole's take → |

---

## 4. Result screen (trip planner)

| Key | Copy |
|---|---|
| `result.eyebrow` | Your pick |
| `result.headline` | {{resort_name}} |
| `result.location` | {{state_or_province}}{{", Canada" if applicable}} |
| `result.reasonHeading` | Why this one |
| `result.reasonBullet.pattern` | You said {{answer, in the user's own words}} — {{resort fact, plain language}}. |
| `result.reasonBullet.noOrigin` | We didn't factor in how far this is, since you weren't sure yet. |
| `result.stats.heading` | The numbers |
| `result.share.cta` | Share this pick |
| `result.share.helper` | Copies a link with the picture and the why. |
| `result.reentry.cta` | Make your own pick |
| `result.hotTake.label` | Nicole's Hot Take |
| `result.hotTake.attribution` | — Nicole, on {{resort_name}} |

Reason bullets follow §3.5's exact examples — three per result, each tracing to a specific
question the user answered, never a bare score. Sample set (data-bound, not to be written by
content-writer per resort, shown here as the pattern to replicate):

> You said your crew ranges from first-timer to expert — {{resort}} has real beginner terrain
> *and* genuine advanced terrain, so nobody's stuck on the easy runs or bored on the harder ones.
>
> You're driving from {{region}} — this is under {{n}} hours, no flight needed.
>
> You said budget-conscious — this comes in cheaper than most of {{comparison region}}.

**Stat labels and plain-language translations:**

| Field | Label | Plain-language note (tooltip/caption if space allows) |
|---|---|---|
| `skiable_acres` | Skiable acres | — |
| `vertical_drop_ft` | Vertical drop | Top to bottom, in one run |
| `base_elevation_ft` / `summit_elevation_ft` | Base elevation / Summit elevation | Where the mountain starts and tops out |
| `avg_annual_snowfall_in` | Average snowfall | A typical season, not this week |
| `terrain_pct` | Terrain mix | Beginner / Intermediate / Advanced & expert |
| `terrain_pct` (null) | — | **"Terrain breakdown not published by the resort"** (verbatim, per strategy.md §3.6 — never blank, never 0%, never guessed) |
| `cost_tier` | Cost | $ / $$ / $$$ / $$$$ |
| `crowd_level: low` | Crowds | Rarely crowded |
| `crowd_level: moderate` | Crowds | Can get busy |
| `crowd_level: high` | Crowds | Usually crowded |
| `crowd_level: brutal` | Crowds | Expect crowds, especially on powder days |
| `pass_affiliation` | Pass | Epic pass / Ikon pass / Mountain Collective / Indy pass / Independent (no multi-resort pass) |
| `family_ski_school: strong` | Ski school | Highly rated |
| `family_ski_school: decent` | Ski school | Solid |
| `family_ski_school: weak` | Ski school | Limited — check details before booking |
| `non_ski_activities: strong` | Off the mountain | Plenty to do beyond skiing |
| `non_ski_activities: decent` | Off the mountain | A few solid options beyond skiing |
| `non_ski_activities: thin` | Off the mountain | Not much beyond skiing — plan for that |

Any other unpublished/null field not covered above follows the same honest pattern: **"{{Field
label}} not published by the resort."** Never a blank cell, never a dash standing in for zero.

**Absent hot take on the result card:** show nothing. No block, no neutral line, no icon. The
result card's whole credibility model (Principle 2) is "grounded data, plus her voice where it
exists" — data alone is already a complete, honest result. Adding a neutral placeholder line here
adds visual weight to an absence for no reader benefit; the screenshotted card should look
identical in structure whether or not a take exists, just shorter by one block. (Contrast with
Nicole's List below, where the same absence needs a line — see rationale there.)

---

## 5. Mixed-ability floor/ceiling display

| Key | Copy |
|---|---|
| `mixed.heading` | How this works for your whole group |
| `mixed.subline` | We didn't average your group into one middle score — here's how this resort holds up at both ends. |
| `mixed.floor.label` | For newer skiers |
| `mixed.ceiling.label` | For more experienced skiers |
| `mixed.tier.strong` | A real strength |
| `mixed.tier.decent` | Solid — not the mountain's specialty, but you'll be fine |
| `mixed.tier.weak` | The weaker end — {{specific caveat, data-bound}} |

**The honesty call, explained:** the brief's hard requirement is "honest that it's a compromise,
without sounding like a downgrade." The trap is the word "compromise" itself — it frames the
resort as having failed to be excellent, when the actual truth is closer to "no single mountain
on Earth is the best possible place for both a first-timer and an expert at once, and this is how
the pick you got holds up at each end anyway." So the copy never uses "compromise," "settle," or
"average" as verbs applied to the resort. Instead: two separate, specific, factual statements —
one per end of the group — each free-standing enough to be true on its own. `mixed.subline`
states plainly that this *isn't* a blended score (which itself builds trust — Marcus specifically
distrusts black-box averaging, per his persona), and `mixed.tier.decent` is written so "not the
specialty" reads as an honest fact about mountain character, not a defect. `mixed.tier.weak`
should rarely surface for a top-ranked mixed-group pick — the min-max bottleneck logic is
supposed to exclude those before they'd ever reach this screen — but the string exists for the
edge case where it's still the best available option (see the no-good-match state below for when
nothing clears the bar at all).

---

## 6. Honest failure and limitation copy

### Forecast fallback (live → historical)

| Key | Copy |
|---|---|
| `fallback.forecast.badge` | Not a live forecast |
| `fallback.forecast.body` | We couldn't reach the live forecast right now. This is the typical snowfall for this time of year, not what's coming this week. |
| `fallback.forecast.retry` | Try again |

The badge is deliberately its own visible element, not just prose — Jordan and Nicole are both
explicitly named personas who scan fast and skim past body text. A skimmed badge that says "not a
live forecast" is the one piece of copy on this screen that must survive being read alone, at
speed, with cold hands.

### Canada — no NOAA coverage

| Key | Copy |
|---|---|
| `canada.section.heading` | Canada — no live forecast |
| `canada.section.body` | The live forecast service only covers the US. These are ranked by typical season snowfall, not this week's — check the resort's own snow report for real-time numbers. |

No apology, no "sorry" — per the strategy doc's own framing, this needs to read as honest and
matter-of-fact, not broken. An apologetic tone here would actually undersell the honesty; it would
read like the app is embarrassed about a limitation, when the actual message is "we're telling you
exactly what this is and isn't."

### No good match found

| Key | Copy |
|---|---|
| `noMatch.heading` | We couldn't find a confident match |
| `noMatch.body` | Nothing cleared the bar for every answer you gave. Budget and travel are usually the easiest to loosen. |
| `noMatch.cta` | Adjust my answers |

Names a specific next action (which answers to reconsider) rather than a generic "try again" —
per the error-message pattern, "what to do next" has to be actionable, not just present.

### Data we don't have

| Key | Copy |
|---|---|
| `dataGap.terrain` | Terrain breakdown not published by the resort |
| `dataGap.generic.pattern` | {{Field label}} not published by the resort |

### Loading states

| Key | Copy |
|---|---|
| `loading.planner` | Finding your pick… |
| `loading.chase` | Checking today's snow… |
| `loading.forecast` | Checking the forecast… |
| `error.generic` | Something didn't load. Check your connection and try again. |

---

## 7. Nicole's list surface

| Key | Copy |
|---|---|
| `nicoleslist.intro` | Everywhere Nicole has actually skied — not a ranked list, just her record. |
| `nicoleslist.col.place` | Place |
| `nicoleslist.col.region` | Region |
| `nicoleslist.col.rating` | Her rating |
| `nicoleslist.col.bestFor` | Best for |
| `nicoleslist.col.take` | Nicole's Hot Take |
| `nicoleslist.col.stay` | Where she stayed |
| `nicoleslist.emptyTake` | No hot take yet |
| `nicoleslist.badge.dayTrip` | Day-trip hill |
| `nicoleslist.badge.international` | International |
| `nicoleslist.badge.helper` | Not part of the trip-planner or snow-chase matches — just her record |

**`nicoleslist.intro`, explained:** "not a ranked list, just her record" does the framing work the
whole surface needs in six words — it pre-empts the exact misreading strategy.md warns against
(this could look like a fourth ranking algorithm) before the user has scrolled past the first
line.

**Absent-take handling here, and why it differs from the result card:** Nicole's List is a table —
every row needs the same shape for the layout to scan correctly, so an empty cell in the "take"
column reads as broken (did the data fail to load?) rather than as "she hasn't been vocal about
this one." `nicoleslist.emptyTake` — "No hot take yet" — is Register A: third person, factual,
zero voice, zero fabricated sentiment. It is explicitly *not* "Nicole hasn't been here yet!" —
that phrasing is banned for two reasons, not one: it's first-person-adjacent enough to be mistaken
for her voice, and it's also frequently untrue (she *has* been to places where she just hasn't
written up a take yet, per scope-revision-1's "47 rows, 9 hot takes written so far" — conflating
"no take" with "hasn't been" would be its own small fabrication).

**Day-trip hills and international entries:** both get a badge plus the shared helper line
(`nicoleslist.badge.helper`) so a Minnesota hill or an Austrian resort never silently reads as
"one of the 54 resorts this app can recommend." This matters because Nicole's List is the one
surface where destination-worthy and not-destination-worthy entries sit in the same table —
without the badge, a user could reasonably assume every row here is fair game for the trip
planner, and it isn't.

---

## 8. Alt text and ARIA patterns

| Pattern | Template | Example |
|---|---|---|
| Generated resort illustration | "Illustrated ski scene for {{resort_name}}, {{state_or_province}}: {{one distinguishing detail}}." | "Illustrated ski scene for Big Sky, Montana: wide-open bowls under a clear sky." |
| Stat readout (any icon+number pairing) | "{{Stat label}}: {{value}}{{unit}}." | "Vertical drop: 3,050 feet." |
| Terrain-mix / difficulty segment | Visible label always shown as text next to the shape, never color-only: "{{shape icon}} {{Level label}} {{percent}}%"; `aria-label`: "{{Level label}} terrain: {{percent}} percent." | Visible: "● Beginner 20%" · aria-label: "Beginner terrain: 20 percent." |
| Crowd/status flag icon | `aria-label`: "{{status word}}, {{plain description}}." | "Brutal, expect crowds especially on powder days." |
| Hot-take chip (collapsed state) | `aria-label`: "Nicole's hot take on {{resort_name}} — expand to read." | — |

The illustration alt text describes what the picture is *for* (identifying the resort and its
character) rather than its literal composition ("a cartoon mountain with snow") — per the
functional-description rule, and because this is the one image on the shareable card that a
screen reader user needs full parity on: the card's whole job is persuasion, and persuasion lives
in the words either way, but the alt text should carry the same *mood* the illustration is meant
to carry, not just confirm an image exists.

Difficulty and status indicators never rely on color alone anywhere in either mode — this is
Jordan's (deuteranopia) and Dana's (bright-glare, low-vision) shared requirement, and it's cheap
to get right everywhere at once rather than case-by-case.

---

## 9. Share and metadata copy

| Key | Copy |
|---|---|
| `og.title.result` | {{resort_name}} — your ski trip match |
| `og.description.result` | Matched to your answers: {{top reason, ~8–10 words}}. See the full pick. |
| `og.title.app` | Find your next ski trip |
| `og.description.app` | Answer a few quick questions, or see where it's dumping this week — plus everywhere Nicole's actually skied. |
| `og.title.chase` | Where it's dumping this week |
| `og.description.chase` | Ranked by real snow quality, not just inches — updated from live forecasts. |

These three cover the actual distribution path (strategy.md §1.1: a shared result link is the
primary cold-start case, more common than the bare app link). The result-card OG description
deliberately reuses one real reason bullet rather than generic marketing language — the preview
card pasted into a DM should read like a fact about *this specific pick*, not an ad for the app.

---

## Reading level and screen-reader check

- **Target Grade 6–8**, hit throughout. The only vocabulary that sits above that band by
  necessity is domain terms with no plain substitute (vertical drop, terrain, groomed) — each of
  those either carries a short plain-language caption (§4 stat table) or is defined by context
  (the terrain question's own answer options).
- **Screen reader dry-run, quiz flow:** progress ("Step 2 of 5") → question title → options in
  visual order → continue control. Nothing depends on a previous screen's visual layout to make
  sense in isolation.
- **Screen reader dry-run, result screen:** eyebrow ("Your pick") → resort name → location → why
  heading → three reason bullets → stats → hot take (if present) → share/re-entry CTAs. This
  order matches what a sighted person scans top-to-bottom, so nothing is reordered by sight that
  isn't also reordered in the DOM.
- **Screen reader dry-run, Nicole's List:** intro line → table caption (needed: "Nicole's ski
  history, {{n}} places") → column headers with `scope="col"` → rows. Day-trip/international
  badges need to be announced per-row (`aria-label` on the badge, not just a visual chip), not
  only visible to sighted scanners — otherwise a screen reader user loses exactly the "this isn't
  a recommendation" signal a sighted user gets for free.

---

## Dynamic content and pluralization notes for design-builder

- `{{n}} of 5` (progress), `{{minutes}} min ago` (freshness), `{{hours}} drive` (feasibility),
  and `{{percent}}%` (terrain mix) are all singular/plural-sensitive at the low end (1 min ago, 1
  hour drive) — needs standard pluralization handling, not string concatenation.
- Reason bullets (`result.reasonBullet.pattern`) are the one place where content-writer is
  specifying a *pattern*, not a fixed string — the resort-fact half is data-bound per §3.5's
  rules and must always trace to an actual answered question. Never auto-generate a fourth bullet
  from a field the user didn't provide input on.
- `mixed.tier.weak`'s caveat and `chase.row.reason` are similarly patterns, not fixed strings —
  both pull from resort-specific fields (`beginner_note`, `best_for_tags`) that content-writer
  doesn't author per-resort.
