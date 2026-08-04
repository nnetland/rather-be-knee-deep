# Design Brief: Ski Reco App

_Director: Nicole · Drafted 2026-08-03 · Status: awaiting approval_

## Problem Statement

Nicole is repeatedly asked, by text and Instagram DM, "do you have any recommendations for where we should ski?" She answers well — she has skied widely and has real opinions — but she answers the same question over and over, and the answer is only as good as the paragraph she has time to type that day.

The wider problem this sits inside: deciding where to ski is genuinely hard for people who aren't already dialled in. The market is split between bare directories (OnTheSnow) that list facts without judgment, black-box ranking engines (ZRankings) that produce a number without a reason, and Reddit threads where the advice is good but buried and unaccountable. Nobody pairs grounded data with one trusted human's point of view. That pairing is the product.

## Users

The people asking Nicole are, in her words, three overlapping groups — and notably **none of them are experts chasing steeps**:

1. **Newer skiers planning their first real trip.** They've done a day at a local hill. They need reassurance as much as recommendation: will there be enough green terrain, is ski school any good, will I be miserable.
2. **Families with kids.** Ski school quality, lodging proximity to the lifts, and what to do on a non-ski day matter as much as vertical drop.
3. **Mixed groups planning together.** Couples and friend groups where abilities differ and someone has been deputised to find a place that works for everyone. This is the hardest case and the most common one.

This audience definition has teeth: it means terrain quality for advanced skiers is a **secondary** matching signal, and beginner terrain share, ski-school strength, and non-ski activities are **primary** ones. A dataset tuned to delight powder hounds will actively mis-serve these people.

### Ability spectrum

- **Screen reader users** — the result card must carry its meaning in text, not only in the generated illustration. Alt text for the avatar is a content deliverable, not an afterthought.
- **Low vision / bright sunlight** — this gets opened on a phone, outdoors, possibly on a chairlift. Contrast must survive glare; nothing may be encoded by colour alone (difficulty ratings are the obvious trap — green circle / blue square / black diamond is a colour-and-shape system and we must carry the shape and the word).
- **Motor control** — tap-only inputs, generous targets. No sliders. ZRankings' must-sum-to-100% allocation UI is the anti-pattern.
- **Cognitive load** — people use this while distracted, mid-group-chat. Short questions, plain language, no jargon without a plain gloss ("vert," "corduroy," "sidecountry" all need translation or removal).
- **Non-native English speakers** — plain language throughout; Nicole's voice can be casual without being idiomatic to the point of opacity.

## Design Direction

A short tap-only quiz — five questions, no more — that produces a single confident recommendation, presented as a self-contained shareable card with a generated illustration of the place, Nicole's hot take, and the grounded numbers that justify the pick. Plus a browsable reference list of everywhere Nicole has skied and stayed.

Three principles, ratified from research:

1. **The result screen is the product.** It has to work as a standalone artifact — screenshotted into a group chat, stripped of all context, still legible and still persuasive. Everything else in the app is scaffolding to get someone there.
2. **Grounded data and one trusted human's voice, never either alone.** The numbers give it credibility; the hot take gives it a reason to trust the numbers. Neither works without the other. Nicole's voice is load-bearing structure, not decoration.
3. **Ask about the group, not just the asker.** Mixed-ability is the norm in Nicole's real requests and no competitor asks about it. This is our headline differentiator and it falls directly out of the actual audience.

A fourth, from the audience definition:

4. **Reassure, don't just rank.** For a first-timer, "you'll be fine here, and here's why" is more valuable than a match percentage. The copy should answer the anxiety underneath the question.

## Inputs (confirmed by Director)

Five questions, tap-only:
- Who's going / how mixed is the group *(the differentiator — asked early)*
- Skill level and terrain appetite
- Budget
- Drive or fly, and from where
- Vibe: après, town, and scene

## Constraints

- **No auth, no paywall, no install.** A link that just works.
- **Mobile and desktop.** Mobile is primary — this arrives in a DM.
- **Shareable via text and Instagram DM.** Implies a real URL, decent link preview metadata, and a result that survives being screenshotted.
- **Generated illustration** for the final recommendation, in an approachable, fun style. Shareable on its own.
- **Nicole's ski history** must be included as a browsable reference list, and her hot takes must appear on recommendations where she has one.
- **Data credibility is a hard constraint.** Nicole's friends include people who ski. Wrong acreage in front of someone who'd know is worse than no acreage.

## Existing Design System

None. Building from scratch. Aesthetic direction deferred to `design-taste` and `inspiration-scout` — the Director has asked to see options before committing.

## Taste Direction (Early Signal)

Director's stated target: "modern and playful, given it's about a fun subject." She declined to pick a direction from a written list and asked to see visual options first — so inspiration-scout is running now and will bring back references before any visual decisions are made.

Known: the generated illustration should be "approachable and fun," and should give a *feeling of the place* rather than a literal depiction.

## Success Criteria

In the Director's priority order:

1. **She stops repeating herself.** One link answers the DM better than a paragraph she types for the fifth time.
2. **The recommendations are genuinely good.** People book the place and come back saying she nailed it. Accuracy over polish — this is the one that can't be faked.
3. **People share it onward.** The result card gets screenshotted into a group chat under its own steam. The illustration does that work.

Notably the Director did *not* rank "it reads as unmistakably me" as a success criterion. Read this carefully: personality is a **means to credibility**, not an end in itself. The hot takes exist to make the recommendation trustworthy, not to make the app feel like Nicole's personal brand project. Design accordingly — voice in service of the recommendation, not on top of it.

## Out of Scope

- Booking, pricing lookups, or any live inventory
- Accounts, saved trips, history, or personalisation across sessions
- Live snow conditions or forecasts (the data is seasonal averages; implying live conditions would be a credibility trap)
- International resorts (North America only for v1 — ~54 resorts)
- Backcountry, cat-skiing, and heli operations
- Expert-first features: steeps ranking, couloir guides, avalanche terrain

## Open Risks

- **Dataset confidence.** ~25 of 54 resorts have unverified hard numbers; `terrain_pct` is null for ~30; `family_ski_school` is null for **all 54** — which is a direct hit to a primary audience. A verification pass is running.
- **Nicole's ski history and hot takes are not yet supplied.** The team designs around a clearly-marked placeholder; the structure must make her real data easy to drop in.
- **Pass affiliations shift season to season** and will need reconfirming near launch.
