# Rather Be Knee Deep — Requirements

_Living document. Director: Nicole. Last updated 2026-10-26._

This is the single record of what this app should do — shipped, agreed, and still wanted.

**How this file works.** Anything Nicole describes in a working session becomes an entry here, whether or not she frames it as a requirement. Claude writes it; Nicole edits. This file is mirrored to `docs/requirements.md` in the GitHub repo, where git versions every change. **Nicole edits the project doc copy only** — Claude propagates to the repo, so the two never disagree about who is right.

Entries are tagged: **SHIPPED** (built and live), **AGREED** (decided, not built), **PROPOSED** (raised, not decided), **DEFERRED** (consciously postponed, with a reason).

---

## The product, in one paragraph

A no-auth, link-shareable web app that recommends a North American ski destination. Four surfaces: a five-question trip planner, a forecast-driven snow chaser, a ski-type recommender for a known resort and day, and a browsable list of everywhere Nicole has skied. One self-contained HTML file, works offline, no accounts and no paywall. Live at https://rather-be-knee-deep.web.app.

---

## Foundational requirements

These came from the original brief and are non-negotiable unless Nicole changes them.

**R1 · No auth, no paywall, no install. SHIPPED.** A link that just works, on any device, first tap.

**R2 · Mobile and desktop, mobile primary. SHIPPED.** The app arrives in a text message or an Instagram DM. It works at 320px and at 200% zoom.

**R3 · Shareable via text and Instagram DM. SHIPPED.** The result encodes into the URL, so a shared link reproduces the sender's exact recommendation, badge, and reasoning. Link previews carry a share image.

**R4 · Nicole's ski history is browsable. SHIPPED.** 44 places, sourced from her Google Sheet, filterable. Renamed **Nicole's picks** (nav: *Picks*) 2026-10-26.

**R5 · "Nicole's Hot Take" is an explicit labelled section, not an ambient voice. SHIPPED.** The app speaks in a neutral register; her opinions sit in an attributed block. A resort with no take shows no take block — never a fabricated or placeholder one.

**R5a · Nicole's List is a documented exception to R5. SHIPPED 2026-08-05.** On that one surface the per-row label is gone at the Director's call — repeated 45 times it was noise, and it ate the space the verdict line needs. Attribution moved to page level instead, and is carried by three things, not one: a first-person standing line ("Everywhere I've skied, and what I *actually* think"), an honest coverage count (since 2026-10-26: "44 places · 9 takes written") in place of 38 per-row apologies, and a visually-hidden per-row prefix so a screen-reader user landing mid-list still hears whose opinion it is. The exception is scoped: the recommendation screen and the quiver keep the labelled, quarantined block, and `RESORTS[].hot_take.text` there still carries the whole opinion (verdict + take) as one string. Known gap: a single row screenshotted into a group chat loses the attribution, since the page header doesn't travel with it.

**R5b · A take is never truncated at runtime. SHIPPED 2026-08-05.** No ellipsis, no `line-clamp`, no `max-height`, no expand control. The previous 58-character preview was not merely tedious — it was *biased*: six of the nine written takes are structured praise-then-caveat, so a left-edge clip deleted the caveat every time, and Breckenridge's pan rendered as "For the bros. BUSY. Cute downt…", which reads as a compliment. Length is an authoring constraint enforced when the take is written — verdict 18–40 characters, take 45–95, combined ≤ 130 — never a rendering one. `verify_responsive.js` asserts this at 320px and 390px.

**R5c · The verdict is the decision; the take is the texture. SHIPPED 2026-08-05.** The two tiers only earn their space if the verdict adjudicates rather than summarises. Eight of the nine written takes already opened with the judgment, so a summarising verdict restates the sentence beneath it. The judgment moves *up* into the verdict and the take keeps only the texture. Test for a new verdict line: cover the take — if the verdict still tells you whether to go, it works; if you need the take to understand it, it is a description, rewrite it.

**R6 · Hot takes carry zero ranking weight. SHIPPED.** Commentary only. An early build rewarded resorts for merely *having* a take, which recommended Breckenridge while displaying "one of my least favourite places in CO" underneath. Removed entirely rather than replaced with a sentiment penalty.

**R7 · The recommendation carries a generated illustration. SHIPPED.** Circular sticker-style badge — heavy outline, flat saturated fills, curved type. Characters, not landscapes: a cowboy for Jackson, a cigar-smoking penguin for Vail, a marmot with a beer for A-Basin. 52 motifs across 71 resorts, no motif repeating within a region.

**R8 · Data honesty is a hard constraint. SHIPPED.** Historical averages are never presented as live forecasts. Missing data says "not published" rather than being estimated. Editorial judgments are marked as judgment. Canada has no NOAA coverage, so those resorts sit in a separate labelled tier.

**R8a · Honesty is shown with facts, not explained in paragraphs. SHIPPED 2026-10-26, Director's call.** *"Instead of explaining 'not a live forecast' simply indicate opening dates for resorts and the last time the forecast was updated."* R8 still holds in full; what changed is how it's met. A live forecast says its source and NWS's own update time ("NWS 7-day forecast · Updated 8:41 PM today"). A resort that isn't open says when it opens. The fallback still says "Not a live forecast", in one line with a retry. Longer explanations live in one closed "About this data" disclosure at the bottom of the page. See *Content-first headers* below.

**R9 · Recommendations explain themselves in the user's own words. SHIPPED.** "You said your crew ranges from never skied to expert" beats "87% match."

**R10 · Mixed-ability groups are a first-class input. SHIPPED.** Scored as a min-max bottleneck, never an average — which correctly excludes Jackson, Alta, Kicking Horse and Revelstoke from mixed groups despite their prestige. No competitor asks this.

**R11 · Serves both newcomers and powder hounds. SHIPPED.** Beginner terrain, ski school and non-ski activities matter alongside steeps and snow quality. Neither audience is subordinate.

**R12a · The toast was intercepting taps. FIXED 2026-08-05.** The toast element sits in the DOM permanently at opacity 0, fixed just above the nav bar, and was a live pointer target the whole time. Nothing sat underneath it until Quiver Check made the splash screen taller and pushed "See everywhere Nicole's actually skied" into exactly that band, at which point that link became untappable on a 390×844 phone. `pointer-events: none` — a status message should never be a pointer target. Caught by `verify_contrast.js` failing to click the link.

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

**T1 · Verify the live NOAA forecast actually works. FIXED 2026-10-27.** Second root cause found on the Director's device ("Still says not a live forecast"): the grid URL carried a bogus `/forecastGridData` suffix and 404'd for every resort. Fixed to use the URL `/points` returns; verified end-to-end against the live API from GitHub Actions (58/58 grid requests OK). Test mocks now 404 the bad path, so this can't silently regress.

**T2 · `timberline-or` remains low-confidence. AGREED.** The operator publishes irreconcilable vertical-drop figures and its site 404s. Needs a direct call.

**T3 · Reconfirm pass affiliations before each season. AGREED, recurring.** Epic/Ikon/Indy rosters shift annually — 13 of 54 were wrong when first checked. Wolf Creek's Indy status specifically needs a direct call.

**T4 · Deer Valley acreage is a moving target. AGREED, recurring.** The multi-year Mayflower buildout means this needs rechecking every season, not once.

**T6 · Refresh opening dates before each season. AGREED, recurring.** `research/openings-2026-27.json` holds each resort's published 2026–27 opening day with its source, researched 2026-10-26: 45 of 71 published, 26 not yet announced, none confirmed open. Several dates came from Ikon/Vail press lists or local news because resort sites blocked fetching; conflicts are noted per row. A scheduled date flips the resort to Open on that day automatically. A slipped opening isn't modelled yet (see H5).

**T5 · `terrain_pct` is null for 17 resorts. ACCEPTED, not a gap to close.** The matching model falls back to editorial fields rather than treating this as required input. Documented as permanent partial coverage.

---

## Outstanding — infrastructure

**I1 · Custom domain. PROPOSED.** Currently `rather-be-knee-deep.web.app`. Firebase provisions and renews SSL free for a custom domain; it needs buying one and a DNS change.

**I2 · Snowriver split. PROPOSED.** Michigan's Indianhead and Blackjack merged into one resort in 2022 and are stored as one record carrying both names. Nicole chose to keep them separate; per-base-area stats are already sourced and the change is unimplemented.

---

## Content-first headers

Added 2026-10-26, Director's call: *"The app has way too much explaining at the top of each page. Don't take yourself that seriously, we aren't representing medical data… Less explaining, more letting the content tell the story. Find a pattern, test it, and deploy it."* Reference: OpenSnow's favourites list.

**N1 · Nav order by expected use. SHIPPED.** Chase · Quiver · Buzz · Plan · Picks. "Rants & Raves" became **Buzz** (the two tabs keep the names Rants and Raves); "Nicole's List" became **Nicole's picks** (nav: *Picks*). Screen-reader names start with the visible word (SC 2.5.3).

**H1 · One pattern on every surface. SHIPPED.** Title → one line of facts → compact filters → content → one closed "About this data" disclosure at the bottom. Facts, not sentences. Nothing explanatory sits above the content. `verify_content_first.js` measures it: the first resort, mountain, tab or place starts in the top third of a 390×844 screen (Picks: top half). Before → after, first content: Chase 521px → 224px, Quiver 366 → 195, Buzz 226 → 116, Picks 574 → 215.

**H2 · Opening status on every resort row. SHIPPED.** "Opens Nov 6" (announced), "Usually mid-Nov" (no announcement; typical window), "Opening TBA" (past its typical date, still unannounced). Colour marks the exception: only an opening inside the next week is coral; announced dates are strong text; estimates are quiet. When nothing is open, Chase lists what's opening soon, most forecast snow first (by opening day when there's no live forecast).

**H3 · Buzz keeps its provenance visible. SHIPPED.** The legal frame is unchanged in substance: the five facts stay visible under the h1 on every view, now as one line, not a ruled block. The five explained rows moved to the bottom disclosure. Cutting the visible line further was considered and rejected — it's what keeps strangers' words from reading as Nicole's.

**N2 · Bottom-nav tap targets: 56px → 66px. SHIPPED 2026-10-27, Director's call.** *"The tap targets on the bottom main nav are tight from a vertical height POV."* 56px cleared WCAG's 44px floor but not platform norms (iOS tab bar 49pt plus home indicator; Material 3, 80dp), and in mobile Safari the bottom strip sits against the browser toolbar. Now 66px: fixed parts in px, the label line in rem, so 200% zoom grows the bar to 106px rather than eating the screen. The icon sits in a 56×28 pill that fills on the current page (a non-colour "you are here", SC 1.4.1) and flashes on press. Labels 11px → 12px, icons 22px → 24px. `viewport-fit=cover` turns on `env(safe-area-inset-bottom)`, so home-screen mode clears the iPhone home indicator. `verify_nav_targets.js` measures it at 320/390/430px, light and dark, and at 200%. **Follow-up 2026-10-27 (on device):** in iOS Safari's browser mode, taps near the bottom edge are taken by Safari's toolbar, and Safari 26 gives no bottom inset in portrait (WebKit bug 306465). An iOS-only rule lifts icon and label 12px; the button still fills the bar.

**H4 · Debt from review, logged not fixed.** Buzz's filled-purple filter controls don't match the outlined chips elsewhere. Buzz has no "updated" stamp (the Reddit pipeline isn't live, so there's nothing to stamp). Plan's result card could show the resort's opening status.

**H5 · A slipped opening isn't modelled. PROPOSED.** A resort that misses its published date still flips to Open that day. Fix: an optional `delayed`/`confirmed_open` field in the openings file.

## Quiver Check

Added 2026-08-05. The 2.0 draft's third item, and the first of that list to be built. Its question is different from the other two modes': Plan a Trip asks *where should I go*, Chase the Snow asks *where is it dumping*, Quiver Check asks *I already know where and when — what do I put on my feet?*

**Q1 · Pick a resort and a day, get a ski type. SHIPPED.** Two steps, one question each, matching the trip planner's idiom. Searchable resort list grouped by state; seven-day picker; then the call.

**Q2 · Not personalised. SHIPPED, Director's call.** It does not ask what's in your quiver and does not store one. Most skiers own a general range, so the app names the ideal ski and — on every card — what to do if you don't own it. Revisit only if the un-personalised version proves too generic in use.

**Q3 · Single day, not a week-at-a-glance. SHIPPED, Director's call.** One day in, one answer out. A day-by-day strip was considered and scoped out: it would answer the question before it's asked and turn a shareable call into a dashboard. The known cost is that the mode won't tell you Thursday is the day unless you ask about Thursday.

**Q4 · Off-season behaviour matches Chase the Snow exactly. SHIPPED, Director's call. AMENDED 2026-10-26:** in the shoulder season, mountains that aren't open now list under "Opening soon" with their dates instead of disappearing behind an explainer. A mountain opening inside the 7-day forecast window can be picked, and the day picker starts on opening day. The rule itself stands: no ski call for a day the lifts aren't turning. Original entry: When nothing in the pool is realistically open, the mode does not render a picker, does not fetch, and does not recommend a ski for a mountain that isn't spinning lifts. The same per-resort shoulder-season filter applies in October and May. Consequence: the feature is invisible from roughly May to November, including right now — `verify_quiver_visual.js` exists to make it reviewable anyway.

**Q5 · No new illustration. SHIPPED, Director's call.** No sticker per ski type; the call is typographic. Deferred deliberately, not skipped — see D9 below.

**Q6 · Eight ski types, labelled in real slang. SHIPPED.** Rock Skis, Skinny Skis, Bump Sticks, The Daily Driver, Mid-Fats, The Fatties, Pow Boats, Slush Puppies — each with the industry waist-width band, a plain-English explanation of what the ski does, and a fallback line for people who don't own it. Park twin-tips appear as an aside rather than a primary call, because the park is a choice made on top of the conditions rather than instead of them.

**Q7 · The call is derived, not looked up. SHIPPED.** Forecast snowfall over the 72 hours ending on the chosen day, scaled by snow density and by how much the resort's terrain rewards float. Density comes from the real snow-to-liquid ratio — NOAA returns both snowfall and liquid-equivalent precipitation in the same response — which is what separates 12 inches of Utah blower from 12 inches of Cascade cement. Light snow demands *more* float, not less: it holds less water, so it stays unconsolidated and unsupportive. Terrain modulates the answer by at most ±25% and never drives it.

**Q8 · Shared links re-read the forecast rather than freezing an answer. SHIPPED.** `#quiver=` carries only the resort and the date. A ski call is true only as long as the forecast behind it is, so a recipient opening it tomorrow may correctly see a different answer, and a day that has passed says so plainly instead of confidently reporting last week's weather. This is deliberately different from `#result=`, which does freeze its payload — a trip-planner match doesn't decay.

**Q9 · The honesty boundary is stated on every card. SHIPPED.** It reads a weather forecast, not a snow report. It cannot see settled base depth, last night's grooming, or what's already been tracked out. When the live forecast is unreachable — or for the 10 Canadian resorts NOAA doesn't cover — the card carries the same "typical season, not a forecast" treatment used elsewhere, the reasoning switches to typical-season phrasing rather than saying "forecast", and it withholds the snow-to-liquid ratio entirely, because on that path the ratio is an assumption the app made rather than a measurement.

### Known limits, logged

**Q10 · It cannot see backwards. ACCEPTED.** The forecast horizon starts today, so a day chosen for today or tomorrow has no observable lead-in. The card says so and tells you to size up if there's already fresh snow down. Closing this would mean adding the observations API — a second network surface, for a question the user can answer by looking out of the window.

**Q11 · Moguls are inferred, not observed. ACCEPTED.** No weather model can see a mogul field. The bump call fires on a visible dry stretch of two or more days, mid-season, at a mountain with the pitch to bump up, and the card explicitly labels itself an inference. 40 of 71 resorts qualify on the terrain test; the other 31 fall back to a groomer call.

**Q12 · 17 resorts have no `terrain_pct`. ACCEPTED (see T5).** Those resorts get the call from tags and scale alone, and are excluded from the bump inference. Killington is the notable casualty — it has one of the most famous mogul runs in the east and no published terrain breakdown in this dataset, so it reads as a groomer day.

**D9 · A sticker per ski type. DEFERRED by Director.** *"No new visuals for now, just an answer, we can get to visuals later."* Eight badges in the SummitSticker style would make the call as shareable as a resort match is. Sits behind the open badge debt (D1–D3).

---

## Demo snow — a temporary invented dataset

Added 2026-08-05, Director's call: *"Let's make a call to use an invented data set for now. You can flag it in the site UI for clarity. But that will unlock iterating on Chase the Snow and Quiver Check."*

Both forecast-driven modes read a live 7-day NOAA forecast, and from roughly May to November there is nothing to read — every resort is closed and both modes correctly render an off-season screen. That is right, and it made the two most data-heavy features impossible to iterate on for half the year. This fills the dead window.

**S1 · Invented, not last season's real numbers. SHIPPED.** Real per-day history was the preferred option and isn't reachable: NOAA's forecast API is forward-only, and the archives that do carry daily snowfall (NCEI, SNOTEL) have no egress from the build environment. So the season is generated — but generated *from* the real dataset. Each resort's invented season is scaled to sum to its own published annual snowfall, runs between its own published open and close dates, takes its temperatures from its own base elevation and latitude, and takes its snow-to-liquid ratio from its region's real character. Alta generates a deep dry season averaging 16.9:1; Mt. Baker a deeper wetter one at 9.3:1; interior BC separates from the coast range. Snowfall arrives in clustered storms with dry spells between, not as uniform daily drizzle — a model tuned against uniform noise is tuned against nothing.

**S2 · It only fills a window it cannot be wrong about. SHIPPED.** Demo data activates solely when the real calendar says the season is over — the one state in which there is no true answer to displace. It never overrides a live forecast, and it never replaces the honest typical-season fallback *during* the season: Canada's no-NOAA-coverage tier and a February NOAA outage both still behave exactly as shipped.

**S3 · It switches itself off. SHIPPED.** There is no flag to remember. Once enough of the pool is open for the season classifier to stop reporting "off-season" — around mid-November — demo mode goes false on its own and the real path takes over untouched. Verified across all twelve months.

**S4 · Nothing it generates can render unlabelled. SHIPPED.** Every value carries `isDemo: true`, a banner sits at the top of every screen, and each card carries its own badge. The banner names what is *not* affected ("Trip planning and Nicole's list are unaffected") so it can't be read as casting doubt on the planner's real data. The ski model attaches an explicit invented-data caveat to every call.

**S5 · Demo data exercises the real code path, not a degraded one. SHIPPED.** Because the generated data carries a genuine liquid-equivalent figure — unlike the typical-season fallback, whose ratio is an assumed 10:1 — demo days take the live reasoning path in full, including the measured snow-to-liquid ratio. That is the point: iterating on copy and models means running the code that actually ships.

**S6 · Dev controls. SHIPPED.** A collapsed strip on the banner sets the date (bounded to the season) and forces a condition — deep and cold, heavy and wet, dry spell, spring slush, thin early season. The two season-gated conditions move the date with them, because forcing warm temperatures in January produced a bump call rather than the slush the control named.

**S7 · Removal. AGREED.** Delete `src/demo.js` and its two tokens from `assemble.py`, or set `DEMO_ENABLED = false`. Every call site is guarded. Nothing else references it. No deadline — it disables itself in November either way.

**S8 · Side effect: the test suite is fully green again. NOTED.** `verify_contrast.js`, `verify_share_and_offline.js` and `verify_zoom_overlap.js` had all been failing since the season ended, because they navigate into Chase the Snow and assert on a ranked list that off-season correctly refuses to render. With demo data present they pass — 10/10, 14/14 and 76/76.

**S9 · One test goes the other way. NOTED 2026-08-06.** `verify_fixround.js` drops to 28/29 while demo mode is on. Its final assertion throttles `api.weather.gov` to force Chase the Snow's 4-second escalated loading state and check that the skip-ahead control appears. Demo mode short-circuits `resolveForecast` *before* any network call, so there is no wait to escalate and no skip button — the test asserts a behaviour that correctly cannot occur while demo data is active. It passes again the moment demo mode switches itself off in November. Not fixed, because the alternative is making the demo path do a pointless network round-trip.

**S10 · Two verify scripts have been pointing at a path that does not exist. NOTED 2026-08-06.** `verify_dom_prose_sweep.js` and `verify_focus_entry.js` both load `build/rather-be-knee-deep.html`; the bundle has lived at the repo root since the build was reorganised, so both have been failing with `ERR_FILE_NOT_FOUND` rather than actually testing anything. Predates the demo work. One-line fix in each, not yet applied.

**R12b · The demo banner was occluding taps beneath it. FIXED 2026-08-05.** Built as a sticky bar, which overlays whatever scrolls under it — and with the controls panel open it is roughly 500px tall, swallowing taps on the resort picker below. Now in normal flow. Second instance of this defect class in two days (see R12a); `verify_demo.js` now asserts directly that the banner occludes no interactive element beneath it.

---

## Explicitly out of scope

Booking, live pricing, or inventory. Accounts, saved trips, or cross-session personalisation. Backcountry, cat-skiing and heli operations. International resorts in the recommender.

---

## How work gets done

**Lane 1 — a specific known change.** No agents. Claude edits the source, runs the test suite, writes the files to Nicole's Mac; she commits and pushes. Minutes.

**Lane 2 — something feels wrong but isn't diagnosed.** The `design-review` skill runs the critic, accessibility reviewer and heuristic evaluator in parallel against what exists, reconciles the findings, and returns one prioritised fix list. No discovery, no re-litigating strategy.

**Lane 3 — a net-new feature.** The full pipeline, but with discovery scoped to just the new thing, since personas, principles, the visual system, tokens, badges and the copy register already exist.

Deploy is the same in all three: commit and push in GitHub Desktop, GitHub Actions rebuilds and deploys, live in about 90 seconds.
