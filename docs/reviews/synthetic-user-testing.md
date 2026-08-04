# Synthetic User Test Results: Rather Be Knee Deep

**Date:** 2026-08-03
**Build tested:** `/home/claude/ski-reco/build/rather-be-knee-deep.html`, driven live with Playwright/Chromium
(`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`), never read as source alone for the walkthroughs below.
**Personas tested:** Priya, Dana, Marcus, Jordan, Nicole, and the cold-stranger scenario — all five from
`docs/designpowers/personas/2026-08-03-ski-reco-personas.md`, at their stated real conditions.
**Conditions simulated:** same-tab reload mid-quiz, mid-multiselect (before Continue); 200% zoom
(root font-size forced to 32px, matching the fix round's own methodology) on the *result* screen
specifically (not just quiz/splash, which is what the fix round verified); network fully aborted vs.
genuinely hung (the more realistic "one bar of signal" case) with CDP-throttled bandwidth as a third
check; deuteranopia colour simulation via an SVG `feColorMatrix` filter over the rendered Chase list;
`prefers-reduced-motion: reduce`; keyboard-only navigation; tap-target auditing for cold/gloved/
tendinitis hands.
**Evidence:** all screenshots and diagnostic scripts in `/home/claude/ski-reco/reviews/sut-screens/`.

## Summary

The fix round's headline claims mostly hold up, and two of them hold up *better* than claimed: Priya's
URL-hash resume survives an interruption even mid-multiselect before she's tapped Continue, and
Marcus's Back-restore and mode-switch-resume are both genuinely fixed on every path tested (single-
and multi-select). Jordan's skip-ahead escape works exactly as designed once a realistic "connection
that hangs" condition is simulated instead of one that fails instantly, and his deuteranopia
experience is clean. Nicole's core need — Whistler/Revelstoke present and honestly labeled, generous
tap targets everywhere, no fabricated live data — is fully met.

But this pass found two things the fix round's own verification didn't reach, and one systemic content
problem the reviews only partly named. First: **the result screen breaks at 200% zoom in a way the
quiz screens don't** — the same class of bug the "critical fix #4" claims to have closed (fixed-px
grid tracks that don't scale with root font-size) still exists one component over, on the exact screen
Dana needs most, producing genuinely illegible, overlapping text. Second: a **focus regression** in the
M1 fix means a keyboard/screen-reader user gets no automatic orientation cue on the very first entry
into the quiz (every subsequent step works correctly — only the splash→Q1 transition is affected).
Third: the dataset's `beginner_note`/`character_note` fields periodically surface **research-register
text verbatim** to end users — "Editorial judgment:", "Confirmed 26%... in the dataset," "(brutal)" —
which is a sharper, more concrete version of the "jargon" debt item already logged, and it lands on
exactly the two personas (Priya, Marcus) who most need clean, confident, plain-language copy.

## Barrier Matrix

| Task | Priya | Dana | Marcus | Jordan | Nicole | Cold stranger |
|---|---|---|---|---|---|---|
| Core task completion | ✓ | ⚠ | ✓ | ✓ | ✓ | ✓ |
| Interruption / resume | ✓ (exceeds claim) | n/a | ✓ (Back + mode-switch both fixed) | n/a | n/a | n/a |
| Access-condition specific check | n/a (no assistive tech) | ✗ (200% zoom result screen) | ✓ (no sliders, ≥56px targets) | ✓ (deuteranopia legible) | ✓ (≥44px targets, reduced motion safe) | ✓ (pronouns, no chrome) |
| Copy/trust quality | ⚠ (raw dataset register bleed) | ⚠ (evidence exists but "Editorial judgment" undistinguished) | ⚠ (same register bleed, undercuts "defend to group") | ✓ | ✓ | ✓ |

Legend: ✓ completes cleanly · ⚠ completes with friction · ✗ fails at the persona's actual condition

## Scenario Walkthroughs

### Priya — first real trip, interrupted mid-quiz, phone, stolen minutes

**Task:** Plan a trip for a mixed group, get pulled away mid-quiz, resume later.

Walked as: splash → Plan a trip → Q1 "mixed" → Q2a multi-select, tapped "Beginner" and
"Intermediate" but **never tapped Continue** → reload (the realistic "phone locked / app switched"
interruption) → resume → complete the quiz → read the result.

- **Reload mid-multiselect, before Continue is committed** (`priya-05-after-reload-mid-multiselect.png`):
  both chips are restored **visibly checked** ("Beginner" and "Intermediate," `aria-checked="true"`),
  on the correct step ("Tap every skill level in your group," Step 2 of 5), with the "Welcome back —
  picking up where you left off" toast visible (`display:block; opacity:1`, positioned above the nav,
  not obscuring the question). This is a genuinely strong result — the build-notes description implied
  the hash only commits on answer *completion*; in practice it's live-writing on every tap via
  `history.replaceState`, so even an in-progress, uncommitted multi-select survives. **Better than
  claimed, not just as claimed.**
- **Reload after a committed answer, mid-Q2b** (`priya-07-after-reload-at-q2b.png`): same result —
  correct step, correct prior answer, toast visible, and — importantly for comprehensibility, not just
  function — the bottom nav (Plan/Chase/Nicole's List) is still present, so she's not landing in a
  context-free void; she can tell this is still the same app mid-flow, not a broken page.
- **Jargon scan on the result screen:** the fixed quiz copy itself is clean (no "vert," "corduroy,"
  "sidecountry" found — the one hit for "vert" was inside "Vertical drop," a legitimate, already-plain
  label, not slang). But the mixed-ability "For newer skiers" line surfaced this verbatim for Loon
  Mountain: *"Beginners: Confirmed 26% beginner / 47% intermediate / 27% advanced-expert -- one of the
  more balanced, non-intimidating terrain mixes **in the dataset**, plus easy drive/flight access from
  Boston."* That's the resort's raw `beginner_note` field, written in analyst register for an internal
  audience ("Confirmed," "in the dataset") — not jargon in the ski-vocabulary sense the copy-deck
  targeted, but a register break that would read as odd or unfinished to a non-native English speaker
  parsing every word carefully. See Major finding below — this is systemic, not a one-off.

**Result: ✓ core task, ⚠ on copy quality.** The interruption-and-resume promise — Priya's single
most load-bearing user story — is met and exceeds the claim. The remaining friction is a content
problem, not a broken mechanism.

### Dana — low vision, 200% zoom, evaluating ski school

**Task:** Plan a family trip (mixed group, two kids never skied), reach the result, and judge whether
the ski school is genuinely good — at 200% zoom, the condition her persona explicitly requires, not a
nice-to-have.

Walked the full quiz at 200% zoom (root font-size forced to 32px, replicating the fix round's own
`verify_responsive.js` methodology), landed on the result screen (Loon Mountain), and inspected the
ski-school disclosure.

- **Horizontal overflow confirmed on the result screen at 200% zoom**
  (`page.evaluate` walk of every element's `getBoundingClientRect()`): six elements extend past the
  390px viewport by 4–61px, concentrated in the new `.notes-list` prose rows (Crowds, Pass, Ski
  school) and the ski-school disclosure button itself. `verify_responsive.js`'s zoom-200 check
  (critical fix #4) tested the splash, the quiz chip grid, and the Q4b region grid — it never tested
  the *result* screen, which is the one screen Dana's task requires her to read carefully.
- **The stat-tile grid is genuinely illegible at 200% zoom, not just overflowing**
  (`dana-crop-statstrip2.png`): "2,100ft" (Vertical Drop's value) renders **directly on top of**
  "SKIABLE ACRES" (the neighboring tile's label) — text-on-text overlap, not a wrapping issue. Root
  cause, confirmed in source: `.stat-strip` (`styles.css:389`) uses
  `grid-template-columns: repeat(auto-fit, minmax(84px, 1fr))` — a **fixed-pixel** minimum that
  doesn't grow with root font-size. This is the *exact* bug class critical fix #4 closed for
  `.chip-grid--2col`/`.region-grid` (`styles.css:262-263`, now `minmax(8.75rem, 1fr)`, rem-based and
  zoom-responsive) — but the fix wasn't applied to the result card's stat strip, a sibling component
  built the same round.
- **The Range Readout's pin labels overlap at 200% zoom too**
  (`dana-crop-range.png`): "Never skied" and "Beginner" render as a single garbled string
  ("Never skBieginner") directly on top of each other. Confirmed via a targeted diagnostic
  (`diag-range-pin-overlap.js`) that this is **zoom-specific, not a general narrow-track bug** — the
  same adjacent-tier pair ("never-skied"/"beginner," the narrowest possible floor-ceiling gap) renders
  with a clean 24px gap at default (100%) zoom. The `.range-pin__flag` label is `white-space: nowrap`
  and positioned via `transform: translateX(-50%)` off a percentage-based anchor; at 32px root
  font-size the label text outgrows the space between adjacent anchor points before the anchors
  themselves move.
- **The ski-school disclosure itself works** (`dana-02`/`dana-03-ski-school-*-200pct.png`): starts
  collapsed ("Highly rated" + chevron), the disclosure button is a real 138×74px tap target even at
  200% zoom, and expanding it reveals genuine sourcing text: *"Editorial judgment: well-established
  Boston-area weekend family destination with a balanced, moderate terrain mix; inferred from its
  accessibility and long-standing reputation rather than a specific cited award."* — this is the H2/H6/
  H10 fix from the heuristic evaluation, and mechanically it does work.
- **But the evidence itself undercuts her stated trust bar for nearly half the dataset.** Checked
  across all 71 resorts: 47 of 71 `family_ski_school_basis` entries are prefixed "Editorial judgment:"
  (i.e., an admitted inference, not a citation) versus "Sourced:" for the rest. The data itself
  encodes this distinction thoughtfully — but the UI renders both prefixes as identical plain
  `body-sm` text inside the same disclosure pattern, with no visual distinction (no badge, no bolding,
  no icon) between "here's a citation" and "here's our best guess." Dana's whole persona is built
  around distrusting "a vague 'strong' rating with nothing behind it" — an inferred-not-cited
  disclosure, indistinguishable at a glance from a sourced one, is a *better* answer than the old bare
  label, but not the confident answer her user story asks for.

**Result: ✗ at her actual condition.** Dana can technically complete the quiz and technically reach
the ski-school disclosure, but the screen she needs to read carefully — vertical drop, skiable acres,
and the Range Readout floor/ceiling pins sitting directly adjacent to the ski-school section — is
visibly broken at 200% zoom, in a way that would read as "this app is broken," not "this app respects
my eyes," at the exact moment she's trying to build confidence in a pick for her kids. This is the
single most severe finding in this pass because it contradicts a fix explicitly claimed as verified
for "the result screen" in spirit, even though the verification script's literal scope stopped one
screen short.

### Marcus — wide-mixed group, wrist tendinitis, defending the pick to a group chat

**Task:** Get a result for a true first-timer-to-expert group with zero sliders/drag, correct one
answer via Back without losing the rest, switch modes and come back, and get a card he can screenshot
to defend the pick.

- **No sliders or drag anywhere, confirmed in the DOM**, not just visually:
  `document.querySelectorAll('input[type="range"]')` and `[draggable="true"]` both return zero on the
  wide-mixed multi-select screen.
- **Tap targets:** all five Q2a chips measured 173×56–64px — comfortably over the 44px floor his
  persona requires.
- **Back-restore, both variants — confirmed fixed:**
  - Multi-select (his actual path, wide-mixed): selected "Never skied before" + "Expert," advanced,
    tapped Back — both chips render `aria-checked="true"` and visually selected
    (`marcus-04-back-to-q2a-multiselect.png`).
  - Single-select (the solo/matched path the heuristic evaluation specifically flagged as broken):
    selected "Intermediate," let it auto-advance, tapped Back — "Intermediate" renders correctly
    checked (`marcus-06-back-to-q2a-singleselect.png`). **This is the exact bug heuristic-evaluation.md
    called out by name, and it's genuinely fixed, not just claimed fixed.**
- **Mode-switch resume — confirmed fixed:** answered Q1 (solo) and Q2a (Intermediate), switched to
  Chase, switched back to Plan. The quiz resumed at "What's your level?" (Q2a, the step actually left
  off), not "Who's coming..." (Q1/Step 1). Heuristic-evaluation.md's exact complaint — "resets to Step
  1 of 5 rather than resuming at the step left off at" — no longer reproduces.
- **Range Readout, at his actual default zoom** (`marcus-03-result.png`): clean, legible, no overlap.
  It states plainly, without requiring inference: *"How this works for your whole group / We didn't
  average your group into one middle score — here's how this resort holds up at both ends,"* then
  shows both pins on a segmented track labeled "Never skied — Expert," followed by explicit
  "For newer skiers: Solid..." / "For more experienced skiers: A real strength" statements. The
  `aria-label` independently confirms the same content ("floor is never skied before, solidly served.
  Ceiling is expert, well served."). **This directly answers his stated need — he does not have to
  infer that the pick works for everyone; the component says so.**
- **But the supporting sentence under the tier label can undercut his "quotable" need.** For
  Breckenridge: *"For newer skiers: Solid... Beginners: Good dedicated learning terrain, but the
  town's size, crowds (brutal), and the resort's expert-heavy upper mountain (55%) add real
  intimidation on a busy day."* "(brutal)" is `crowd_level`'s raw internal enum value, inserted
  parenthetically rather than translated to the same friendly copy used elsewhere on the same card
  ("Expect crowds, especially on powder days"). For Copper Mountain: *"Beginners: Editorial judgment:
  25% beginner terrain and the mountain's naturally segmented ability-based layout..."* — the
  "Editorial judgment:" prefix (meant as an internal sourcing flag, see Dana's finding above) bleeds
  through here too. If Marcus screenshots this card to settle his group chat, one of these sentences
  reads as an internal note left in by mistake — undermining exactly the "not a black-box score"
  confidence the Range Readout is otherwise doing a good job building.

**Result: ✓ mechanically, ⚠ on the text a skeptical friend would actually read.** Every navigational
and structural claim in the fix round holds up under direct testing. The remaining gap is the same
content-register problem found in Priya's walkthrough, confirmed here as systemic rather than a
one-off.

### Jordan — powder hound, deuteranopia, cold hands, bad connection, impatient

**Task:** Get a ranked, scannable snow list under a genuinely bad connection, without waiting out a
10-second timeout, and without relying on colour to read difficulty/status/freshness.

Two network conditions were tested, because they produce meaningfully different (and both realistic)
behavior:

- **Connection refused / DNS failure (`route.abort()`):** the fetch rejects immediately. The app's
  catch path falls straight to the historical fallback in well under 1 second (`467ms` to a fully
  rendered list in one measured run) — faster than the loading state even has a chance to escalate.
  This is a legitimate real-world case (airplane mode, resort wifi actively down) and the app handles
  it well.
- **Connection that hangs (route handler that never resolves) — the more realistic "one bar of
  signal, patchy, but not fully dead" case:** timed polling every 300ms confirmed the exact
  documented state machine: nothing before 300ms, no skip control through ~3.7s, **the "Show
  typical-season data now" skip button genuinely appears at ~4.07–4.5s** across three separate runs,
  and clicking it resolves to the full historical list in **~130–500ms more** (4.6s total from tap to
  usable list — well under the 10s hard timeout). The skip button itself measures 282×48px, comfortably
  tappable with cold or gloved fingers. **This is a real, working fix, not a claim that only holds up
  against an idealized test.**
- **CDP-throttled bandwidth (2000ms latency, 5KB/s)** was also tried as a third, even-more-realistic
  condition and reached the same escalated/skip state on the same timeline.
- **Deuteranopia simulation** (`feColorMatrix` filter over the fully rendered list,
  `jordan2-03-deuteranopia-full-list.png`): rank numbers stay legible as numerals-in-circles, every
  status flag ("Heads up — this gets crowded on a powder day," "Not a live forecast") carries full
  text alongside its icon, and the US/Canada boundary is a distinct icon-plus-heading section break,
  not a colour cue. Nothing on the list depends on distinguishing red from green.
- **Canada's honesty rule held under direct inspection:** zero rows anywhere in the Canada section
  carry the "next 7 days" live-forecast framing — all ten are labeled "TYPICAL SEASON" with a distinct
  icon, and the section heading/copy ("Canada — no live forecast... typical season snowfall, not this
  week's") renders exactly as strategy.md §5(d) specifies.

**Result: ✓ cleanly, under the condition that actually matters.** The one nuance worth flagging to the
Director: the "10-second wait" framing in the original heuristic evaluation was accurate for a *hung*
connection but never actually applies to a fully *dead* one, which resolves almost instantly by a
different code path. Both are now good outcomes; worth knowing they're different mechanisms so a future
regression in one doesn't get masked by the other still working.

### Nicole — mid-storm, cold/gloved/numbed fingers, deciding whether to fly

**Task:** Reach for the app on a chairlift, patchy signal, and get a scannable, honest answer that
includes her own home turf (Whistler, Revelstoke) without fabricated data — fast enough, and with
tap targets forgiving enough for numbed fingers, to actually act on.

- **Whistler and Revelstoke both present**, confirmed via direct text search on the rendered list,
  and confirmed **not** carrying any fabricated "next 7 days" framing (0 matches across every
  Canadian row for that phrase) — they render exactly like every other Canadian resort, honestly
  labeled "typical season."
- **Every interactive control on the Chase screen audited for size** (`diag-nicole-targets.js`): the
  origin `<select>` is 253×44px, the "Include beginner-friendly options" checkbox is wrapped in a
  358×74px `<label>` (the checkbox itself may be small, but the entire tappable area is the full row
  — genuinely one generous tap, no precision needed), the "Try again" link is exactly 44×44px, and
  all three bottom-nav items are 130×56px. **Zero controls under the 44px floor.**
  Nothing required a slider or drag gesture, consistent with the shared design decision for
  cold/gloved/tendinitis hands.
- **`prefers-reduced-motion: reduce` tested on this exact flow** — the list renders and completes
  normally with no stuck/half-animated states.

**Result: ✓ cleanly.** Nicole's own named fear — "no forecast for Canada with no explanation reads as
broken, not honest" — does not reproduce; the app treats her home mountains exactly as designed. She
would reach for this.

### Cold stranger — shared link, never took the quiz

**Task:** Receive a forwarded result link with zero context, understand it, trust it, and find a way
to make an independent pick.

Generated a real result (Whitefish Mountain Resort, wide-mixed group) in one browser context, captured
its exact `#result=` hash, and cold-loaded that literal URL in a brand-new, fully isolated context —
no shared storage, no prior navigation, simulating exactly what a friend tapping a forwarded link
experiences.

- **The pronoun rewrite is fully verified, not just spot-checked:**
  - Sender's own fresh view: *"YOUR PICK... You said your crew ranges from never skied before to
    expert... We didn't factor in how far this is, since **you** weren't sure yet."*
  - Cold recipient's view of the identical hash: *"THEIR PICK... **They** said their crew ranges from
    never skied before to expert... We didn't factor in how far this is, since **they** weren't sure
    yet."* A programmatic scan of the reason section found **zero** instances of "you"/"your" in the
    cold view.
- **OG/Twitter link-preview text — the moment before the tap, arguably higher-stakes than the page
  itself — is also correctly rewritten:** sender's preview reads "Whitefish Mountain Resort — your ski
  trip match" / "Matched to your answers: You said...", the cold-share preview reads "Whitefish
  Mountain Resort — **a** ski trip match" / "**Matched on:** They said...". This wasn't just fixed on
  the rendered page — it reaches the meta tags a group-chat link-preview actually pulls from.
- **The double-period bug** (`"...bored on the harder ones.. See the full pick."`) flagged as Minor in
  the heuristic evaluation **did not reproduce** — the OG description builder now strips a trailing
  `[.!?]+` before appending "See the full pick.," confirmed in source at `app.js:895`.
- **Zero app chrome on the cold-loaded result** — both `#bottom-nav` and `#top-nav` render `hidden`.
  Principle 1 holds on the highest-risk path (cold load, not a same-session navigation).
- **"Make your own pick" CTA present and appropriately sized** (316×48px) — the re-entry path
  strategy.md calls "the actual primary cold-start case" works as specified.
- **The Range Readout's `aria-label` was already pronoun-neutral** ("floor is... well served") and
  needed no separate fix — confirmed it reads identically for the cold viewer.

**Result: ✓ cleanly.** This was the heuristic evaluation's headline Major finding, and on direct,
adversarial re-testing (cold context, real extracted hash, not a mocked route param) it holds up
completely, including in the part of the experience (link preview) that happens before anyone
even reaches the app.

## Findings by Severity

### Critical

- **[Dana, 200% zoom] The result screen's stat-tile grid and Range Readout pin labels both produce
  illegible, overlapping text at 200% zoom — the exact condition Dana's persona requires and the exact
  screen her core task depends on.** Root cause for the stat strip: `.stat-strip`
  (`build/src/styles.css:389`) still uses `grid-template-columns: repeat(auto-fit, minmax(84px, 1fr))`
  — a fixed-pixel track that doesn't grow with root font-size — while the sibling fix in the same
  round (`.chip-grid--2col`/`.region-grid`, `styles.css:262-263`) correctly moved to
  `minmax(8.75rem, 1fr)`. Root cause for the Range Readout: `.range-pin__flag` is `white-space: nowrap`
  positioned off a percentage anchor via `translateX(-50%)`; at 32px root font-size, adjacent-tier
  labels (e.g., "Never skied" / "Beginner") outgrow the space between their anchors before the anchors
  themselves reposition — confirmed zoom-specific (clean 24px gap at 100% zoom on the identical
  adjacent-tier pair). → **Fix:** apply the same rem-based `minmax()` pattern from critical fix #4 to
  `.stat-strip`; give `.range-pin__flag` either a max-width with wrapping/truncation or reflow the
  track to stack pins vertically past a zoom/width threshold. Add the result screen (not just quiz
  screens) to the 200% zoom regression check going forward — this is a component-coverage gap in
  `verify_responsive.js`, not a one-off miss.

### Major

- **[Priya, Marcus] Raw dataset editorial/research-register text bleeds verbatim into consumer-facing
  copy on the Range Readout, undermining both the plain-language need and the "defend this to my
  group" need.** Confirmed across three independent resorts encountered in normal walkthroughs — not
  a cherry-picked edge case: Loon Mountain ("Confirmed 26%... one of the more balanced,
  non-intimidating terrain mixes **in the dataset**"), Copper Mountain ("**Editorial judgment:** 25%
  beginner terrain..."), Breckenridge ("crowds **(brutal)**" — the raw `crowd_level` enum value in
  parens, un-translated, right next to the friendly "Expect crowds, especially on powder days" copy
  used for the same field elsewhere on the identical card). This is a sharper, more concrete version
  of the "jargon-gloss layer" item already logged as deferred design debt in build-notes.md — that
  framing understates it. It isn't unglossed ski vocabulary (the deferred item's own examples,
  "Corbet's Couloir," "mogul terrain," are real instances of that narrower problem); it's meta-
  commentary written for an internal research audience, landing on the exact component built to
  reassure Priya and arm Marcus. → **Fix:** either lightly edit `beginner_note`/`character_note` at
  the data layer to strip register markers ("Editorial judgment:", "Confirmed X%... in the dataset")
  and expand raw enum values inline before they're authored, or add a thin render-time substitution
  pass consistent with how `SCHOOL_COPY`/`CROWD_COPY` already translate other enum fields — this
  should be pulled forward from "deferred" given how often normal-path walkthroughs hit it.

- **[Accessibility, cross-cutting] Focus does not move to the Q1 heading on the very first entry into
  the quiz from the splash — a regression introduced by the M1 fix, and not caught by
  `verify_a11y.js`'s existing keyboard check.** Confirmed directly: `renderPlan()` calls
  `renderQuizStep(null)` with no `direction` and no `focusValue`; the M1 fix
  (`build/src/app.js:449-455`) only calls `heading.focus()` when `direction` is truthy, and only
  falls back to focusing the tapped chip when `focusValue != null` — neither branch fires on the
  initial call, so `document.activeElement` stays on `<body>` after tapping "Plan a trip." Every
  subsequent step-to-step transition (which does pass `direction`) correctly moves focus and works as
  designed — this is isolated to the splash→Q1 boundary. `verify_a11y.js`'s "keyboard focus lands on a
  real interactive element" check doesn't catch this because Tab order still eventually reaches a
  button regardless of where focus started; it isn't testing whether focus *moved automatically*, the
  actual screen-reader-orientation property the M1 fix's own code comment says it's for. → **Fix:**
  pass a synthetic `direction` (or call `focusHeading` explicitly) on the quiz's first render from
  `renderPlan()`, and add an assertion to `verify_a11y.js` that checks `document.activeElement` (not
  just Tab-then-check) immediately after clicking `#mode-plan`, before any Tab presses.

### Minor

- **[Dana] The ski-school evidence disclosure doesn't distinguish sourced citations from inferred
  guesses.** 47 of 71 resorts' `family_ski_school_basis` text is prefixed "Editorial judgment:" (an
  admitted inference) versus "Sourced:" for the rest — a distinction the data models thoughtfully but
  the UI renders identically, as plain `body-sm` text inside the same disclosure pattern. This is a
  real improvement over the pre-fix bare label and not a regression, but it falls short of the
  "genuinely good, not just marketed as good" bar Dana's persona sets when nearly two-thirds of the
  disclosures she'll expand are self-described guesses. → **Fix:** a small visual distinction (a
  "Nicole's team's read" vs. "Cited" tag, or simply leading with which kind of evidence it is before
  the detail) would let her calibrate trust at a glance instead of having to parse the sentence.

- **[Jordan/general] The documented "10-second wait" only actually applies to a hung connection, not
  a dead one — worth knowing these are different code paths.** Not a defect — both outcomes are good
  (a fully dead connection resolves in well under a second via the fetch-rejects-immediately path,
  which never triggers or needs the skip button) — but the distinction wasn't previously verified as
  separate mechanisms, and a future regression in either path could hide behind the other one still
  working in ad hoc manual testing.

## What Works Well (confirmed under real conditions, not just plausible from source)

- **Priya's interruption-and-resume is the standout result of this pass.** It doesn't just survive a
  reload after a committed answer — it survives mid-multiselect, before Continue is even tapped, with
  a visible, plain-language acknowledgment and full app context retained. This is better than the
  build notes' own framing suggested.
- **Marcus's Back-restore and mode-switch-resume are both genuinely fixed**, on every path tested
  (single-select, multi-select, and the Plan→Chase→Plan round trip) — the exact mechanisms his user
  story names, confirmed via DOM state, not just visual screenshot comparison.
- **The Range Readout, at normal zoom, is a real success** — it states explicitly, in both visible
  copy and `aria-label`, that the pick is "well served"/"solidly served" at both ends, which is
  precisely what Marcus's persona asks for: not having to infer it.
- **Jordan's skip-ahead escape hatch works under the condition it was built for** — a genuinely hung
  connection, not an idealized instant one — appearing reliably at ~4.1–4.5s and resolving in under 5s
  total, well inside the 10s hard ceiling. Combined with a clean deuteranopia pass on the full list,
  this mode is in good shape for exactly the persona it exists to serve.
- **The cold-stranger pronoun fix is complete, including the part that happens before the tap** — the
  OG/Twitter link-preview text, which is what a friend actually reads in a group chat before deciding
  whether to open the link, is correctly rewritten alongside the page itself.
- **No sliders, no drag, and no sub-44px tap target were found anywhere tested** — across Marcus's
  wide-mixed quiz path and Nicole's entire Chase-mode screen, confirmed via direct DOM measurement,
  not visual inspection alone.

## Recommendation: Polish, not ship as-is

This is close, and closer than a fresh read of the fix round's own claims would suggest — several
things that sound merely "claimed fixed" on paper are demonstrably, robustly fixed under adversarial
testing (Priya's resume, Marcus's Back-restore, the cold-stranger pronouns, Jordan's skip control).
But there is one Critical finding — the 200% zoom regression on the result screen — that directly
contradicts Dana's core need on the exact screen her task requires, using the exact zoom level the
fix round explicitly tested for on other screens. That should block putting this in front of real
users until fixed; it's a narrow, well-understood fix (the same rem-based grid-track pattern already
proven elsewhere in this codebase), not a redesign.

The two Major findings (dataset-register bleed-through, first-entry focus regression) are real but
narrower — they degrade trust and orientation rather than blocking task completion, and both have
concrete, contained fixes. I'd fix the zoom regression before any user testing, and strongly recommend
fixing the register bleed-through in the same pass since it recurs across two of the five personas'
core walkthroughs and is cheap to fix at the data layer. The focus regression can reasonably ship
alongside a note to accessibility-reviewer, since no persona in this pass uses a screen reader as their
primary interface — but it should not go untracked.

Everything else — the interruption/resume mechanics, the Back/mode-switch fixes, the Chase-mode skip
control, the deuteranopia legibility, the Canada honesty framing, and the cold-stranger pronoun
rewrite — is genuinely solid and verified, not just claimed. Those don't need another look before real
users see them.

## Handoff

**synthetic-user-testing → design-builder:** Two things before this goes in front of real people.
First, critical: the result screen breaks at 200% zoom — `.stat-strip` (styles.css:389) needs the same
`minmax(8.75rem, 1fr)` treatment that `.chip-grid--2col`/`.region-grid` already got in this round, and
the Range Readout's pin labels need a wrap/reflow strategy for the same zoom level — both confirmed via
direct screenshot, not inference, and both isolated to the result screen specifically. Second, major:
Q1's heading doesn't receive focus on the very first quiz entry (only on step-to-step transitions) —
a one-line fix to `renderPlan()`'s initial `renderQuizStep()` call. Third, worth pulling forward from
the design-debt register rather than leaving deferred: the `beginner_note`/`character_note` raw-text
bleed-through ("Editorial judgment:", "(brutal)", "in the dataset") is more consequential than the
existing "jargon-gloss" debt item suggests — it hit three different resorts across two independent
persona walkthroughs in this pass alone.

**synthetic-user-testing → design-debt-tracker:** Log the Dana "Sourced vs. Editorial judgment"
visual-distinction gap and the Jordan dead-vs-hung-connection dual-path note as Minor design debt —
neither blocks shipping, both are worth a future look.
