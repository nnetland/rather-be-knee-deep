# Ski Reco App — Personas

_Design-strategist · 2026-08-03 · Formalizes and supersedes the provisional persona notes in `design-state.md`_

Five personas, spanning the audience confirmed in scope-revision-1: newer skiers, families,
mixed-ability groups (including the person deputised to choose for a group that disagrees), and
powder hounds — with disability and situational constraint woven into each person's actual trip,
not carved off into a separate "accessible persona." Two are primary (Priya, Dana), two are edge
cases that reveal design weakness (Marcus, Jordan), one is a stress case that doubles as the
Director's own success criterion (Nicole).

---

## Priya Chandran — first real trip, needs reassurance more than options

**Context:** 29, works in account management, based in Chicago. Skied twice on a work-trip day
pass in Wisconsin; never planned a trip herself. A friend group chat decided "let's actually do a
proper ski trip this year" and Priya got the "can you look into where we should go" job because
she's the organized one, not because she knows skiing.

**Abilities and conditions:** No permanent disability. English is her second language (grew up
speaking Hindi and English, code-switches, but ski jargon — "vert," "corduroy," "groomers,"
"sidecountry" — is genuinely opaque to her and she won't ask what it means in a group chat).
Situational cognitive load: she's doing this research in fifteen-minute windows between meetings,
half-distracted, on her phone.

**Technology:** iPhone, good connection, comfortable with apps generally, no assistive tech.

**Goals:** Find somewhere the group won't regret, that won't make her look like she picked badly,
and — privately — somewhere she personally won't be miserable on since she's the least experienced
skier in the group.

**Frustrations:** Ski content assumes a baseline of confidence and vocabulary she doesn't have.
Reddit threads read like a foreign language. She doesn't trust a ranked list with a bare score —
she has no way to judge if "82% match" is good.

**Environment:** Phone, mid-afternoon at her desk or on the train home, one eye on Slack.

**User stories:**
- Standard: As Priya, I want to answer a few plain-language questions and get one confident pick, so I can stop second-guessing whether I've done enough research.
- Assisted: As a non-native English speaker, I want jargon translated or removed inline, so I don't have to leave the app to look up what "corduroy" means.
- Stress: As someone doing this in stolen fifteen-minute windows, I need to be able to stop mid-quiz and pick back up without losing my answers, without ever creating an account.

---

## Dana Okafor — family trip, ski school and logistics matter more than vertical drop

**Context:** 41, planning a trip for her family of four — herself, her husband, and two kids (7
and 11). Neither kid has skied before. Dana has, twenty years ago, badly, once.

**Abilities and conditions:** Low vision — wears progressive lenses, and screen contrast/text
size genuinely matters to her, not as a nice-to-have. Her younger child wears a hearing aid, which
shapes how she evaluates ski-school write-ups: she's specifically checking whether instruction
is structured in a way that doesn't rely purely on a instructor shouting group instructions across
a hill (a real, practical filter she runs mentally on any "family_ski_school" claim, though the
app can't know this — it should at least not force her to trust a vague "strong" rating with
nothing behind it).

**Technology:** Android, mid-range phone, reading glasses she doesn't always have on her when she
picks up her phone — so effectively evaluating this at low-vision-equivalent contrast much of the
time regardless of her prescription.

**Goals:** Confidence that the ski school is genuinely good, not just marketed as good; a base
village close enough to the lifts that a meltdown doesn't become a logistics crisis; something to
do if a kid refuses to ski on day two.

**Frustrations:** Marketing copy that says "family-friendly" without evidence. Small light-grey
text on white backgrounds. Sites that bury the one fact she actually needs (is ski school any
good) under acreage and vertical-drop numbers she doesn't care about.

**Environment:** Evenings after the kids are in bed, kitchen table, sometimes outdoors at a
kid's practice glancing at her phone in full sun.

**User stories:**
- Standard: As Dana, I want the family-relevant facts (ski school quality, village proximity, non-ski activities) presented as clearly as the terrain stats, so I don't have to hunt for what matters to me.
- Assisted: As a low-vision user, I want text at sufficient contrast and size by default, and difficulty ratings that don't rely on color alone, so I can read this without switching glasses.
- Stress: As someone evaluating this in bright outdoor light, I need the result screen to stay legible without me shading the screen with my hand.

---

## Marcus Webb — deputised to choose for a group that disagrees

**Context:** 34, part of a five-person friend group with a real internal fault line: two are
strong intermediates who want steeps and trees, one is a near-beginner girlfriend joining her
first real trip, two are "whatever's fine" middle-of-the-roaders. The group chat has stalled for
three weeks. Marcus got voted into deciding because he's the one who'll actually do the research.

**Abilities and conditions:** Tendinitis in both wrists from years of manual work, now
office-based — a permanent-ish motor condition, not episodic. Fine motor precision (small tap
targets, sliders, drag gestures) causes real discomfort and mis-taps. He actively avoids apps with
slider inputs.

**Technology:** iPhone, otherwise unremarkable technical confidence — the wrist issue is the only
real friction point, and it's invisible to anyone who doesn't ask.

**Goals:** A resort that doesn't quietly sacrifice one end of the group's ability range for the
other — he already knows "somewhere in the middle" produces a trip where half the group is bored
and half is scared, because that's what happened last time he picked. He wants to be able to show
the group *why* a pick works for everyone, not just assert it.

**Frustrations:** Tools that force him to pick "one" skill level for the whole group, discarding
the actual spread. Precision-input UI (sliders, drag-to-rank) that costs him physical discomfort
for no real benefit over a tap.

**Environment:** Group chat is the real environment — he's often filling this in while also
relaying answers back to four other people in real time, meaning he needs to move fast and be
able to reference the result later without re-doing the quiz.

**User stories:**
- Standard: As Marcus, I want to enter the group's actual skill spread (not one average number) and get a resort that's genuinely good at both ends, so I'm not the guy who picked a mediocre compromise again.
- Assisted: As someone with wrist tendinitis, I want every input to be a single generous tap — no slider, no drag, no small targets — so using this doesn't cost me discomfort.
- Stress: As the person who has to justify the pick to four other opinions in a group chat, I need the result to explain itself in terms the group will recognize from the questions, so I'm not defending a black-box score.

---

## Jordan Reyes — powder hound, chasing a storm on short notice

**Context:** 37, software engineer in Seattle, skis 25+ days a season, checks snow forecasts
obsessively. When a real storm cycle shows up in the 7-day window, Jordan will book a flight on
two days' notice if the numbers justify it. Not the audience the original brief was written for —
exactly the audience scope-revision-1 added back in.

**Abilities and conditions:** Deuteranopia (red-green color blindness) — the classic
green-circle/blue-square/black-diamond trail-difficulty system is genuinely hard for Jordan to
read by color alone; he relies on shape and label, and has been burned before by apps that only
color-code. Situational: checks forecasts on a cracked-screen phone with cold hands, sometimes
still wearing liner gloves, sometimes on a chairlift with one bar of signal.

**Technology:** Android, high technical confidence, low patience for anything that isn't scannable
in under ten seconds — he is evaluating five to eight resorts, not reading prose.

**Goals:** A ranked list sorted by something better than raw inches — cares whether the snow will
be good (cold and light vs. wet and heavy), whether he can physically get there before it's tracked
out, and whether the terrain is worth a big dump in the first place. Does not want to answer a
vibe quiz to get this.

**Frustrations:** Tools that bury the number he cares about under five unrelated questions.
Forecasts presented without a quality read (12" of Cascade cement is not the same trip as 12" of
Utah cold smoke, and a raw-inches sort treats them as identical). Color-only difficulty coding.

**Environment:** Early morning, checking before deciding whether to request the day off; also
literally on-mountain, cold hands, glare, cross-checking whether next weekend is worth extending
the current trip.

**User stories:**
- Standard: As Jordan, I want a ranked list sorted by a real "worth it" signal — snow quality and terrain, not just raw inches — so I can decide in under a minute whether to book.
- Assisted: As someone with deuteranopia, I want difficulty and status indicators to carry shape and text, not just color, so I'm not guessing at a glance.
- Stress: As someone checking this with cold hands and one bar of signal, I need the list to load and be readable with minimal interaction — no multi-step quiz standing between me and the ranking.

---

## Nicole — the Director, using her own tool mid-storm

**Context:** The Director herself, in her stated own words: "I (a powder hound) should also be
able to use it." This persona exists because success criterion #4 is explicit — if Nicole doesn't
reach for the snow-chasing mode herself in a good storm cycle, that mode has failed regardless of
what anyone else thinks of it. She is also the one person whose relationship to "Nicole's list" is
different from everyone else's: she's the source, not a reader vetting her.

**Abilities and conditions:** No permanent condition modeled here beyond what's already covered by
Jordan; the point of this persona is situational stress layered on deep domain expertise. Checking
this on a lift, gloved hands, cold-numbed fingertips reducing tap precision temporarily (a
temporary, weather-induced motor constraint — the same design response as Marcus's tendinitis:
generous tap targets, no precision gestures). Time-pressured: deciding whether to rearrange a
weekend before a storm window closes.

**Technology:** Whatever's in her pocket, patchy resort wifi/cell signal.

**Goals:** Trust the tool enough to actually act on it — book a flight, rearrange a weekend —
which means the snow-chasing ranking has to hold up against what she, an expert, already knows
about a mountain. She will notice immediately if Whistler or Revelstoke — her home turf — is
either missing without explanation or presented with fabricated live data.

**Frustrations:** Being told "no forecast for Canada" with no explanation reads as broken, not
honest, if it's not labeled clearly. A tool that only works for the audience it was originally
scoped for (beginners/families) and quietly under-serves its own creator is a real failure mode,
not a hypothetical one.

**Environment:** On-mountain, cold, gloved, patchy signal, deciding fast.

**User stories:**
- Standard: As Nicole, I want the snow-chasing list to include or clearly explain the absence of Canadian resorts, so I trust it enough to act on for my own trips, not just recommend to others.
- Assisted: As someone with cold-numbed fingers on a chairlift, I want the same generous, no-precision tap targets as everyone else, so a temporary motor constraint doesn't lock me out of the mode built for me.
- Stress: As someone deciding whether to book a flight before a storm window closes, I need the ranking to be scannable and honest about data confidence (live vs. historical) so I can act on it without a follow-up check elsewhere.

---

## Scenario intersections worth designing for once, not five times

- **Cold/gloved hands (Nicole) and tendinitis (Marcus) and motor-impairment generally** all point
  to the same solution: generous tap targets, no sliders, no drag gestures, no precision-timing
  interactions anywhere in either mode. This is one design decision, not three.
- **Bright outdoor glare (Dana) and low vision (Dana) and colorblindness (Jordan)** all point to
  the same solution: high-contrast-by-default, shape-plus-label difficulty encoding, no
  color-only meaning anywhere, including in the snow-chasing list's status badges.
- **Distracted/interrupted use (Priya, in stolen minutes) and jargon-sensitivity (Priya) and
  scan-speed demand (Jordan, in under ten seconds)** point to the same solution even though the
  personas want opposite paces: every screen must be legible from a cold start, because both
  "picking up after an interruption" and "scanning fast the first time" require the same thing —
  no screen that depends on remembered context from a previous screen to make sense.

## Validation questions for the Director

- Priya and Marcus both represent "planning for others" — does that feel like the right emphasis,
  or is there a genuinely solo trip-planner persona missing?
- Jordan and Nicole overlap by design (both powder hounds) — intentional, so the snow-chasing mode
  is designed against a real expert user twice, once anonymous and once literally the Director.
  Flag if that reads as redundant rather than reinforcing.
- Which of these five makes you most uneasy about the current architecture? That's usually where
  the next design pass should go first.
