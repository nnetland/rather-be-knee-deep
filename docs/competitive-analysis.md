# Competitive & Pattern Analysis: "Where Should I Ski?"

Research pass for the Ski Reco App. Covers existing tools, recommendation-quiz UX patterns
generally, shareable-result-card patterns, and accessibility observations, with concrete
differentiation opportunities at the end.

## 1. How people currently answer "where should I ski?"

**The category is fragmented across three tool types, and none of them do the actual job of
recommending — they filter.**

- **OnTheSnow** ([onthesnow.com/ski-resort](https://www.onthesnow.com/ski-resort)) is a
  directory-plus-snow-report, not a recommender. Its "best resort" content is crowd-voted
  superlative lists (e.g., [users picked Banff Sunshine as best overall for 2025-26](https://www.onthesnow.com/news/onthesnow-users-pick-banff-sunshine-as-best-overall-ski-resort-for-2025-26-season/),
  [Telluride best for après](https://www.onthesnow.com/news/onthesnow-users-rate-telluride-best-ski-resort-for-apres-ski-for-2025-26-season/)) —
  useful as social proof, useless as personalization. There's no "tell me about your trip,
  get one answer" flow anywhere on the site.
- **ZRankings** ([zrankings.com/ski-resorts/perfect-ski-trip](https://zrankings.com/ski-resorts/perfect-ski-trip))
  is the closest thing to a real competitor and the most instructive one to study. Its "Find
  Your Perfect Ski Resort" tool is a single screen where you distribute a 100-point budget of
  importance across five factors — Snow, Ease of Travel, Family Friendliness, Ski Town
  Awesomeness, True Expert Terrain — against their proprietary "Pure Awesomeness Factor"
  ranking of [221 North American resorts](https://www.zrankings.com/methods/). This is a
  power-user tool: it's transparent about its weighting mechanism, but a percentage-allocation
  slider that must sum to exactly 100% is a genuinely high-friction input pattern for a casual
  user on a phone deciding where to send a group chat.
- **Epic Pass's "Pass Finder Quiz"** exists as a URL
  (`epicpass.com/info/pass-finder-quiz.aspx`) but returned a 404 at the time of this research —
  either retired or restructured. Notably, both Epic and Ikon's public tooling
  ([epicorikon.com/tools](https://www.epicorikon.com/tools)) is oriented around **which pass
  product to buy**, not which resort to visit. That's a fundamentally different question from
  the one Nicole's friends are actually asking her.
- **Reddit r/skiing "where should I ski" threads** are the de facto standard for a lot of
  people — this is literally the behavior Nicole's app is meant to replace. The pattern there
  is: post budget/skill/dates/group composition in prose, get 20 conflicting reply threads,
  manually synthesize. It works because a real person (like Nicole) filters for taste and
  context that no directory captures — which is exactly the gap "Nicole's hot take" is
  designed to fill structurally instead of ad hoc.
- **Powder Project / onX Backcountry, Snow-Forecast, Slopes app** are all *in-trip* or
  *terrain-detail* tools (trail maps, snow forecasts, GPS tracking) — none attempt
  pre-trip destination selection. They're irrelevant as direct competitors but useful as a
  reminder that this app's job (pre-trip decision) is genuinely underserved relative to how
  crowded the in-trip tooling space is.
- **Liftopia** is effectively defunct as a discovery tool (folded into resort-direct ticketing
  in recent years) — a reminder that "just list all the resorts and let people compare" has a
  poor survival record as a business/product shape.

**Bottom line: there is no existing tool that takes a short set of personal-trip inputs and
returns one confident, opinionated, shareable answer.** Everything either lists (OnTheSnow),
ranks with a power-user weighting UI (ZRankings), or sells a pass (Epic/Ikon). That gap is the
whole opportunity.

## 2. Recommendation-quiz UX patterns (cross-industry)

- **Question count**: the [Nielsen Norman Group's meta-review of UX quizzes](https://www.nngroup.com/articles/ux-quiz/)
  and general quiz-UX literature converge on a consistent finding: engagement drops sharply
  past 5-7 questions for a casual, low-stakes quiz, and abandonment is disproportionately
  front-loaded — if question 1 or 2 feels effortful or ambiguous, people bail before seeing any
  payoff. **For a ski-recommendation flow specifically, this argues hard for 4-6 questions,
  each answerable in under 3 seconds by tap, not typed or sliders.** ZRankings' 100%-allocation
  slider is the cautionary counter-example: mathematically expressive, but cognitively taxing
  for a "quick, send it in the group chat" use case.
- **Identity language beats assessment language.** Per quiz-result-page best practice
  ([Woobox](https://woobox.com/articles/quiz-result-page-best-practices)), results framed as
  "You're the planner" outperform "You scored 73%" for sharing, because people share things
  that say something about *them*, not their score. Translated to skiing: "Your crew is a
  **Steeps-and-Solitude** group" will get screenshotted; "87% match: Crested Butte" will not.
- **Airbnb's "I'm Flexible"** search pattern is the right mental model for handling
  under-specified trips: instead of forcing a single answer to "where," it lets flexibility
  itself be an input and narrows from there. A ski version of this matters because a real
  chunk of Nicole's audience is asking "we don't know where, just tell us" rather than arriving
  with a pre-formed destination in mind — the quiz needs a graceful path for "I don't care
  about X" answers, not just forced-choice ones.
- **Spotify Wrapped** is the gold-standard reference for the *output* layer, not the input
  layer: multi-card, staged reveal, bold personality-driven copy, and — critically — a design
  built assuming the result will be seen as a screenshot in someone else's feed, not on the
  original site. That assumption should shape the ski app's result screen from the start: high
  contrast, generous margins, no UI chrome bleeding into the shareable card, text legible at
  thumbnail size in a group chat.

## 3. Shareable result-card patterns

The strongest pattern across quiz-UX and Wrapped-style content is **staged reveal +
single dominant image + identity-language headline + one clear CTA**, not a dense results page.
Concretely, for this app that argues for:
1. A single hero card per result (the resort name + Nicole's generated illustration + one-line
   identity statement), sized and margined to look intentional as a raw screenshot — because
   that's how it will actually travel (Instagram DM, group text), not via a shared link click.
2. Supporting detail (why-this-resort, "Nicole's hot take," logistics) available on scroll/tap
   *below* the shareable hero, not competing with it.
3. One CTA, not several — per the quiz-result best practice above, multiple competing CTAs
   measurably underperform a single one.

## 4. Accessibility observations

This is the least-served dimension across every competitor examined, and it's the clearest
differentiation opportunity in this whole research pass.

- **None of the tools reviewed (OnTheSnow's finder, ZRankings' quiz, Epic/Ikon's pass tools)
  publish any accessibility statement, WCAG conformance claim, or visible accessibility
  affordance.** I could not find a single ski-recommendation or pass-finder tool with a
  documented accessibility audit — the entire category appears to treat accessibility as an
  afterthought, which is a real gap relative to general e-commerce quiz UX where it's at least
  discussed.
- **ZRankings' slider-based, must-sum-to-100% input is a specific, testable risk pattern**:
  percentage-allocation sliders are notoriously difficult for keyboard-only and screen-reader
  users to operate precisely (fine-grained value adjustment via arrow keys, unclear live-region
  announcements when the total updates), and they add cognitive load that disproportionately
  affects people with cognitive or attention-related disabilities — exactly the kind of pattern
  the brief and Designpowers' inclusive-design lens should steer this app away from in favor of
  discrete tap/select choices.
- **Color-only encoding is endemic to ski-industry content generally** — trail-difficulty
  systems (green/blue/black) are the entire category's shared visual language, and it is
  extremely common to see them communicated by color alone in trail maps and marketing
  materials without the accompanying shape/symbol convention (circle/square/diamond) being
  reliably present in *digital* UI, even though it's standard on physical trail signage. Any
  place this app surfaces terrain-difficulty data (e.g., from `terrain_pct` in the resort
  dataset) needs shape or label redundancy, not color alone.
- **"Mixed-ability groups" are essentially unhandled everywhere.** Every competitor's model
  implicitly assumes a single skier answering for themselves. None of the reviewed tools ask
  "does your group span different skill levels" as a first-class input, despite this being one
  of the most common real trip-planning constraints (a intermediate parent + beginner kid + an
  expert friend is an extremely normal group, and it's exactly the kind of query Nicole
  personally fields). This is both an accessibility/inclusion gap and a straightforward product
  opportunity — see below.

## 5. Differentiation opportunities (concrete, prioritized)

1. **Ask "how mixed is your group's ability" as a first-class question, not an afterthought.**
   No competitor does this. The resort dataset already carries `family_ski_school` strength and
   `terrain_pct` per resort — a mixed-ability answer can filter directly to resorts with strong
   beginner *and* advanced terrain in the same place (Big Sky, Steamboat, Whitefish, Vail) and
   explicitly deprioritize expert-skewed one-note mountains (Wolf Creek, Kicking Horse, A-Basin)
   for that group type. This is the single clearest gap in the competitive landscape.
2. **Keep the quiz to 4-6 tap-only questions and treat "I don't know / flexible" as a valid,
   first-class answer**, following Airbnb's flexible-search model rather than ZRankings'
   power-user weighting UI. This is both a UX-best-practice fit and an accessibility win
   (discrete choices are far easier for keyboard/screen-reader/motor-impaired users than
   sliders or free text).
3. **Design the result screen to be the artifact, not the app.** Build for the screenshot/DM
   forward-path from day one — staged reveal, one hero card with Nicole's generated
   illustration and an identity-language headline, supporting detail below the fold, single
   CTA. This directly answers requirement #1 in the brief (text/Instagram DM shareability) and
   is exactly the pattern Spotify Wrapped and quiz-result best practice both point to.
4. **Publish (even briefly, in-app) that this tool is accessible** — keyboard-navigable,
   no color-only difficulty encoding, readable at 200% zoom, discrete input controls. Given
   that zero competitors examined make any accessibility claim, this is close to a free
   differentiator: it costs implementation discipline, not novel design work, and it's
   directly on-brand for a Designpowers-built product.
5. **Let "Nicole's hot take" do the job no algorithm can: resolve ties and add credibility
   texture.** Every competitor tool is either a bare directory or a black-box ranking
   algorithm (ZRankings' "Pure Awesomeness Factor" is proprietary and unexplained). None
   combines grounded data with a named, trusted human's point of view. That combination — not
   the quiz mechanics themselves — is the actual product differentiator, and the UX should be
   built to surface it prominently on the result card, not bury it in a footnote.

## Answering the brief's two specific questions

- **How many questions is too many?** Evidence converges on **5-7 as the ceiling** for a
  casual quiz before drop-off accelerates, and front-loaded question difficulty matters more
  than total count — a hard or ambiguous *first* question does more damage than a slightly
  longer flow. Recommend targeting **4-6 tap-based questions** for this app, with the
  mixed-ability question placed early (it's high-signal and low-effort to answer) rather than
  late.
- **How do competitors handle "the group has mixed abilities"?** They largely don't. This is
  the single largest unaddressed gap found in this research pass and should be treated as a
  headline requirement, not a nice-to-have filter.

---

Sources:
- [OnTheSnow: Find a Ski Resort](https://www.onthesnow.com/ski-resort)
- [OnTheSnow: Users Pick Banff Sunshine Best Overall 2025-26](https://www.onthesnow.com/news/onthesnow-users-pick-banff-sunshine-as-best-overall-ski-resort-for-2025-26-season/)
- [OnTheSnow: Users Rate Telluride Best for Après 2025-26](https://www.onthesnow.com/news/onthesnow-users-rate-telluride-best-ski-resort-for-apres-ski-for-2025-26-season/)
- [ZRankings: Find Your Perfect Ski Resort](https://zrankings.com/ski-resorts/perfect-ski-trip)
- [ZRankings: Our Methodology](https://www.zrankings.com/methods/)
- [Epic Pass Tools (Epic or Ikon)](https://www.epicorikon.com/tools)
- [Nielsen Norman Group: UX Quiz, 2025 Year in Review](https://www.nngroup.com/articles/ux-quiz/)
- [Woobox: Quiz Result Page Best Practices](https://woobox.com/articles/quiz-result-page-best-practices)
- [Everyday Industries: Product Personalization Quiz UX Best Practices](https://everydayindustries.com/product-recommendation-quiz-tips/)
- [TADMINT: Product Recommendation Quiz UX Design Patterns](https://www.tadmint.com/blog/product-recommendation-quiz-ux-design-patterns)
- [Rental Scale-Up: Airbnb Flexible Destinations, Dates, Matching](https://www.rentalscaleup.com/airbnb-flexible-destinations-dates-matching/)
- [WebAIM: Contrast and Color Accessibility](https://webaim.org/articles/contrast/)
