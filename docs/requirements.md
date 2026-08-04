# Rather Be Knee Deep — Requirements

_Living document. Director: Nicole. Last updated 2026-08-04._

This is the single record of what this app should do — shipped, agreed, and still wanted.

**How this file works.** Anything Nicole describes in a working session becomes an entry here, whether or not she frames it as a requirement. Claude writes it; Nicole edits. This file is mirrored to `docs/requirements.md` in the GitHub repo, where git versions every change. **Nicole edits the project doc copy only** — Claude propagates to the repo, so the two never disagree about who is right.

Entries are tagged: **SHIPPED** (built and live), **AGREED** (decided, not built), **PROPOSED** (raised, not decided), **DEFERRED** (consciously postponed, with a reason).

---

## The product, in one paragraph

A no-auth, link-shareable web app that recommends a North American ski destination. Three surfaces: a five-question trip planner, a forecast-driven snow chaser, and a browsable list of everywhere Nicole has skied. One self-contained HTML file, works offline, no accounts and no paywall. Live at https://rather-be-knee-deep.web.app.

---

## Foundational requirements

These came from the original brief and are non-negotiable unless Nicole changes them.

**R1 · No auth, no paywall, no install. SHIPPED.** A link that just works, on any device, first tap.

**R2 · Mobile and desktop, mobile primary. SHIPPED.** The app arrives in a text message or an Instagram DM. It works at 320px and at 200% zoom.

**R3 · Shareable via text and Instagram DM. SHIPPED.** The result encodes into the URL, so a shared link reproduces the sender's exact recommendation, badge, and reasoning. Link previews carry a share image.

**R4 · Nicole's ski history is browsable. SHIPPED.** 45 places, sourced from her Google Sheet, filterable.

**R5 · "Nicole's Hot Take" is an explicit labelled section, not an ambient voice. SHIPPED.** The app speaks in a neutral register; her opinions sit in an attributed block. A resort with no take shows no take block — never a fabricated or placeholder one.

**R6 · Hot takes carry zero ranking weight. SHIPPED.** Commentary only. An early build rewarded resorts for merely *having* a take, which recommended Breckenridge while displaying "one of my least favourite places in CO" underneath. Removed entirely rather than replaced with a sentiment penalty.

**R7 · The recommendation carries a generated illustration. SHIPPED.** Circular sticker-style badge — heavy outline, flat saturated fills, curved type. Characters, not landscapes: a cowboy for Jackson, a cigar-smoking penguin for Vail, a marmot with a beer for A-Basin. 52 motifs across 71 resorts, no motif repeating within a region.

**R8 · Data honesty is a hard constraint. SHIPPED.** Historical averages are never presented as live forecasts. Missing data says "not published" rather than being estimated. Editorial judgments are marked as judgment. Canada has no NOAA coverage, so those resorts sit in a separate labelled tier.

**R9 · Recommendations explain themselves in the user's own words. SHIPPED.** "You said your crew ranges from never skied to expert" beats "87% match."

**R10 · Mixed-ability groups are a first-class input. SHIPPED.** Scored as a min-max bottleneck, never an average — which correctly excludes Jackson, Alta, Kicking Horse and Revelstoke from mixed groups despite their prestige. No competitor asks this.

**R11 · Serves both newcomers and powder hounds. SHIPPED.** Beginner terrain, ski school and non-ski activities matter alongside steeps and snow quality. Neither audience is subordinate.

**R12 · Accessible by construction. SHIPPED.** WCAG 2.1 AA. No sliders or drag anywhere. Shape and text on every status indicator, never colour alone. Reduced-motion is a first-class path, not a disable switch.

---

## Outstanding — content

**C1 · Write the remaining hot takes. AGREED, not started.** Nine of 47 written. Every additional one strengthens the app's whole credibility premise. Input is the `nicoles_take_template` Google Sheet; they flow through on rebuild.

**C2 · Sentiment ratings on takes. DEFERRED by Director, explicitly post-launch.** An "Overall Rating" column already exists empty in the sheet. Once populated, the app could surface how strongly Nicole rates a place. Deferred deliberately: takes are commentary, and ranking stays on the data.

**C3 · Copyedit pass on the nine written takes. AGREED.** Typos were corrected ("terrian", "familes", "advenced", "apre") at Nicole's direction; phrasing and bluntness untouched.

**C4 · Europe. DEFERRED.** Nicole's list includes Lech/Arlberg and St. Anton, excluded from v1. A deliberate future addition, not an oversight.

---

## Outstanding — design

**D1 · Two badges read tonally soft. AGREED (debt DD-9).** Bridger Bowl and Beaver Creek got weaker characters because the regional dedupe pass used the better-fitting motifs on neighbours. Both render correctly; neither is wrong, both are duller than they should be.

**D2 · Several badges still read as ambiguous shapes. PROPOSED.** Big Sky, Telluride and Wolf Creek were flagged in review as reading like blobs rather than characters at a glance. Nicole deferred this: *"I'll come back to any revisions on the badges."*

**D3 · Most badges are busts rather than characters mid-gesture. PROPOSED.** The reference stickers work because each subject is caught doing something — the pigeon mid-point, the apple mid-stride, Liberty lowering her sunglasses. Ours improved but remain largely front-facing. This is the gap between good and memorable.

**D4 · Nicole's List sort-by-rating control is absent. DEFERRED (debt DD-1).** Depends on C2 — there's nothing to sort by until ratings exist.

**D5 · Chase-the-Snow reason strings are coarsely bucketed. AGREED (debt DD-2).** Several differently-scoring resorts share identical text like "Cold, light snow + terrain to match", so the ranking's gradation isn't legible in the copy. Would be noticed by exactly the data-literate powder hounds the mode serves.

**D6 · The Range Readout has never been persona-tested against Marcus. AGREED.** Genuinely novel UI with no precedent. It carries the app's main differentiator, and its motion and labelling have not been validated with the motor-impairment persona it was designed around.

**D7 · A proper `design-taste` calibration never ran. PROPOSED.** The visual direction was synthesised from Nicole's chosen direction plus her tuning note, which was specific enough to build from. A real calibration pass would sharpen it.

**D8 · New copy strings await content-writer ratification. AGREED.** The off-season screen, the sanitised dataset prose, the "show typical-season data now" escape and several badge alt-text fragments were written by the builder in the copy deck's register but never reviewed.

---

## Outstanding — data

**T1 · Verify the live NOAA forecast actually works. AGREED, blocked until winter.** A custom `User-Agent` header was triggering a CORS preflight api.weather.gov rejects; removed 2026-08-04. The fix follows NWS maintainers' own guidance but has never been confirmed against the live API, because the build environment can't reach it and the off-season screen now prevents the app from trying. Settle it with the browser-console one-liner, or wait for November.

**T2 · `timberline-or` remains low-confidence. AGREED.** The operator publishes irreconcilable vertical-drop figures and its site 404s. Needs a direct call.

**T3 · Reconfirm pass affiliations before each season. AGREED, recurring.** Epic/Ikon/Indy rosters shift annually — 13 of 54 were wrong when first checked. Wolf Creek's Indy status specifically needs a direct call.

**T4 · Deer Valley acreage is a moving target. AGREED, recurring.** The multi-year Mayflower buildout means this needs rechecking every season, not once.

**T5 · `terrain_pct` is null for 17 resorts. ACCEPTED, not a gap to close.** The matching model falls back to editorial fields rather than treating this as required input. Documented as permanent partial coverage.

---

## Outstanding — infrastructure

**I1 · Custom domain. PROPOSED.** Currently `rather-be-knee-deep.web.app`. Firebase provisions and renews SSL free for a custom domain; it needs buying one and a DNS change.

**I2 · Snowriver split. PROPOSED.** Michigan's Indianhead and Blackjack merged into one resort in 2022 and are stored as one record carrying both names. Nicole chose to keep them separate; per-base-area stats are already sourced and the change is unimplemented.

---

## Explicitly out of scope

Booking, live pricing, or inventory. Accounts, saved trips, or cross-session personalisation. Backcountry, cat-skiing and heli operations. International resorts in the recommender.

---

## How work gets done

**Lane 1 — a specific known change.** No agents. Claude edits the source, runs the test suite, writes the files to Nicole's Mac; she commits and pushes. Minutes.

**Lane 2 — something feels wrong but isn't diagnosed.** The `design-review` skill runs the critic, accessibility reviewer and heuristic evaluator in parallel against what exists, reconciles the findings, and returns one prioritised fix list. No discovery, no re-litigating strategy.

**Lane 3 — a net-new feature.** The full pipeline, but with discovery scoped to just the new thing, since personas, principles, the visual system, tokens, badges and the copy register already exist.

Deploy is the same in all three: commit and push in GitHub Desktop, GitHub Actions rebuilds and deploys, live in about 90 seconds.
