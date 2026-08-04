# Scope Revision 1 — Director's direction, 2026-08-03

_Supersedes conflicting parts of `2026-08-03-ski-reco-app.md`. Read both; this one wins on conflicts._

## What changed

Three Director decisions landed after the first brief was drafted.

### 1. "Nicole's Hot Take" is an explicit, labelled section — not an ambient voice

Direct quote: *"my take is to offer credibility and some point of personal reference, but not to create this fully in my voice as a branded project. My voice should be an explicit section thus 'Nicole's Hot Take.'"*

**Design consequence:** the surrounding app copy is written in a neutral, friendly, plain-language register. Nicole's voice is **quarantined into a visually distinct, explicitly attributed block** titled "Nicole's Hot Take." This is better than diffusing her voice throughout, for three reasons: it makes the personal endorsement legible as an endorsement; it means the app doesn't lie by implication about resorts she hasn't been to; and it lets the neutral data and the subjective take be trusted on separate terms.

**Hard rule for content-writer and design-builder:** a resort with no hot take must show *no* hot take block. Not a placeholder, not a generated one, not "Nicole hasn't been here yet!" in her voice. Absence is honest; fabrication destroys the exact credibility the section exists to create. An unobtrusive neutral line is acceptable if the layout needs it.

### 2. The audience now includes powder hounds — including Nicole herself

Direct quote: *"I don't want this only targeted to families and mixed groups, so let's not exclude data that would satisfy powder hounds. I (a powder hound) should also be able to use it."*

**This reverses a call in the original brief.** Expert terrain, snow quality, steeps, and tree skiing are back as **primary** matching signals, sitting alongside — not beneath — beginner terrain, ski school, and non-ski activities. The dataset serves both. Nothing gets dropped for being too advanced.

The `beginner_friendliness` work stays and stays honest (Jackson, Alta, Kicking Horse and Revelstoke are still correctly flagged weak for beginners) — but that field is now one axis among several, not the dominant one.

### 3. NEW FEATURE — a snow-chasing mode

Direct quote: *"I should also be able to use it to tell me 'best bets for great snow next weekend' if I'm ready to fly to chase it."*

This is a second, genuinely different job with a different time horizon, a different user posture, and a different data source. The Director supplied the API: **https://api.weather.gov** (NOAA / National Weather Service).

## Revised product shape — three surfaces

| Surface | Job | Horizon | Data | Primary user |
|---|---|---|---|---|
| **Plan a trip** | "Where should we go this season?" | Weeks to months out | Static resort dataset (54 resorts) | Newer skiers, families, mixed-ability groups |
| **Chase the snow** | "Where's it dumping, and can I get there?" | 0–7 days | NOAA forecast + dataset | Powder hounds, incl. the Director |
| **Nicole's list** | "Where have you actually been?" | Evergreen | Her Google Sheet | Anyone vetting her credibility |

These share a resort dataset, a result-card component, and the hot-take block — but they are **not the same flow wearing different hats**, and the strategist should not force them into one. The trip planner is a considered, reassurance-seeking flow. The snow chaser is a fast, scannable, ranked-list flow — a powder hound wants to see five options sorted by inches, not answer five questions about vibe.

## NOAA API — verified constraints and one unverified assumption

**Established from NWS documentation:**
- No API key. A descriptive `User-Agent` header is required on every request.
- 7-day forecast horizon — which exactly covers "next weekend." Good fit.
- `/points/{lat},{lon}` resolves a coordinate to a forecast grid; `/gridpoints/{office}/{x},{y}` returns `forecastGridData` including **`snowfallAmount`** (millimetres, in time-stamped periods), plus temperature, wind, and sky cover.
- Rate-limited, unpublished ceiling; retry after ~5s on a 429.

**⚠️ COVERAGE GAP — must be designed for, not discovered later.** NOAA is **United States only.** Eleven of the 54 resorts are Canadian — Whistler Blackcomb, Revelstoke, Kicking Horse, Fernie, Lake Louise, Sunshine Village, Mont Tremblant, Sun Peaks, Panorama, Big White, Red Mountain. **Whistler is arguably the single most important powder destination in the dataset and NOAA cannot see it.** The snow-chasing mode must handle this explicitly and honestly — not silently return a US-only list and let the user assume Canada was considered and rejected.

**⚠️ UNVERIFIED — flagged for verification-before-shipping.** This container's network egress to `api.weather.gov` is blocked (403 at the sandbox proxy) and `WebFetch` is refused by the domain's robots.txt. **We therefore could not empirically confirm the live response shape, the CORS headers, or the `snowfallAmount` field.** Prior knowledge says the API sends `Access-Control-Allow-Origin: *` and is browser-callable, and that is why this design proceeds — but *we have not proven it here.*

**Mandatory design consequence:** the snow-chasing mode must **degrade gracefully and visibly**. If the live call fails for any reason — CORS, rate limit, offline, non-US resort — the mode falls back to the dataset's historical average snowfall and **says so in plain words on screen**. It must never present stale or historical data as if it were a live forecast. Build the fallback first and the live path second.

## Nicole's list — structure

Source: synced Google Sheet `nicoles_take_template`. Columns: Region/State, Resort/Place, Already in Draft?, Overall Rating, Best For, Nicole's Take, Property/Hotel Notes. 47 rows, **9 hot takes written so far** — enough to design against and to establish the voice.

Sample of the established voice, for content-writer to match but not imitate:
> *Breckenridge* — "For the bros. BUSY. Cute downtown strip. One of my least favorite places in CO - just too obvious."
> *Beaver Creek* — "Bougie (hello escalators), less crowded, good for families, but no real advanced terrain. Great ski school."
> *A-Basin* — "One of my CO favorites. Extreme terrain, a skiers-ski area (parking lot après still has vibes)."

Note the register: short, declarative, unhedged, willing to be negative, specific detail over adjective. **Content-writer must not write new takes in this voice.** These are first-person claims of lived experience; inventing them is a fabrication, and the Director's whole credibility premise rests on them being real.

### Two datasets, not one

Her sheet contains places that are not destination resorts — seven Minnesota hills, four Michigan, Whitecap in Wisconsin, Powder Ridge in Connecticut — plus two Austrian entries flagged as belonging to a separate Europe draft. These should **not** enter the recommender.

Resolution:
- **`resorts.json`** — the 54-resort recommendation pool. Destination-worthy North American resorts.
- **Nicole's list** — a separate reference dataset containing *everywhere she has been*, including day-trip hills and international. Displayed in the "Nicole's list" surface. Requirement #3 of the original spec is a *reference* requirement, not a recommender requirement.
- Where a resort appears in both, the hot take joins onto the resort record and surfaces in recommendations.

**Data flag:** the sheet lists "Squaw Valley Resort." That resort was renamed **Palisades Tahoe** in 2021. Use the current name in the app and match on both. Worth mentioning to the Director rather than silently correcting.

## Confirmed visual direction

**Base Camp Bright.** Director: *"Base Camp Bright is on track."* Baloo 2 + Manrope, contemporary rounded consumer-app energy, the most screenshot-legible of the three — which directly serves the shareability success criterion.

**Tuning note for design-lead — take this seriously.** Base Camp Bright was selected when the audience was understood as families and beginners. The audience has since expanded to include powder hounds. The risk is now real that the direction reads as *childish* to a skier evaluating whether to trust the recommendation. Push it toward **confident and energetic** rather than *cute*: keep the rounded geometry and the saturated accents, but tighten the type, cut any bounce that reads as juvenile, and let the data presentation feel precise and well-engineered. Bright should signal *approachable*, never *simplistic*. A serious skier and a first-timer both need to trust this screen.

## Revised success criteria

Unchanged in priority, with one addition:
1. Nicole stops repeating herself in DMs.
2. The recommendations are genuinely good — accuracy over polish.
3. People share the result onward under its own steam.
4. **(New)** Nicole uses it herself to chase snow. If she doesn't reach for it in a good storm cycle, the snow-chasing mode failed.

## Revised out of scope

- Booking, live pricing, inventory
- Accounts, saved trips, cross-session personalisation
- International resorts in the *recommender* (Europe appears only in Nicole's reference list)
- Backcountry, cat-skiing, heli operations
- ~~Expert-first features~~ — **struck.** Expert terrain is in scope per Director.
