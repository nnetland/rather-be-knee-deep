// ---------------------------------------------------------------------------
// Quiver Check — which skis to bring, for one resort on one day.
//
// The third primary mode's question is different from the other two. Plan a
// Trip asks "where should I go?"; Chase the Snow asks "where is it dumping?";
// Quiver Check asks "I already know where and when — what do I put on my
// feet?" So it takes a resort and a date as *given* and spends all of its
// reasoning on the one output: a ski type.
//
// This module is pure — no DOM, no fetch, no clock of its own. Everything it
// needs arrives as arguments, which is what makes verify_quiver.js able to
// sweep the whole decision surface (every resort × a grid of synthetic
// conditions) without a browser or a network. app-quiver.js owns all the
// rendering; noaa.js owns all the data acquisition.
//
// --- The honesty boundary, stated up front --------------------------------
// This reads a *forecast*. It cannot see the snow report. It does not know
// the settled base depth, whether the groomers ran last night, whether the
// wind stripped the ridge, or what got tracked out yesterday. NOAA publishes
// none of that. Per R8, the UI says so plainly rather than implying a
// precision the inputs don't support, and every threshold below is expressed
// as a band with a stated "if you don't own that" fallback — because the
// honest answer to "should I ride my 108s or my 118s?" is usually "either,
// here's the difference."
// ---------------------------------------------------------------------------

// --- The taxonomy ----------------------------------------------------------
// Eight calls. Waist widths are the real industry bands, not invented ones:
// a "powder ski" has meant 110mm+ underfoot for about fifteen years and a
// frontside carver has meant sub-85 for longer than that. `rank` orders them
// by width so the copy layer can say "one step wider than" without a lookup
// table of its own. `rock-skis` and `bumps` sit outside the width ladder
// (rank null) because they're chosen for construction, not float.
const SKI_CALLS = {
  "rock-skis": {
    id: "rock-skis",
    label: "Rock Skis",
    tagline: "The beaters.",
    waistLabel: "Whatever you won't cry over",
    plain: "Your oldest pair — the ones already scarred underfoot. Thin cover, exposed rock and spring debris all do real base damage, and this is the day to spend a ski you've already written off.",
    rank: null,
    ifYouDont: "No beaters? Ride your narrowest pair and stay on the groomed runs — and get the bases checked afterwards either way.",
  },
  "skinny": {
    id: "skinny",
    label: "Skinny Skis",
    tagline: "Frontside carvers.",
    waistLabel: "Under 85mm underfoot",
    plain: "A narrow ski with a real edge angle. On firm snow it gets from edge to edge fast and holds a turn instead of skidding — which is the whole game on a groomer day.",
    rank: 1,
    ifYouDont: "If your narrowest is a 90-something, that's fine — just take the first hour to let the edges warm up before you open it up.",
  },
  "bumps": {
    id: "bumps",
    label: "Bump Sticks",
    tagline: "Narrow, soft, quick.",
    waistLabel: "65–80mm underfoot, soft flex",
    plain: "A skinny, forgiving ski that turns in the length of a mogul trough. Width is the enemy here — a wide ski gets hung up on the tops of the bumps instead of dropping into the line.",
    rank: 0,
    ifYouDont: "Dedicated bump skis are a luxury. Anything under about 90mm underfoot will do the job — the flex matters more than the number.",
  },
  "daily": {
    id: "daily",
    label: "The Daily Driver",
    tagline: "One ski, most days.",
    waistLabel: "85–100mm underfoot",
    plain: "The all-mountain middle. Wide enough to handle a few inches of soft snow, narrow enough to still carve when you find yourself back on the corduroy.",
    rank: 2,
    ifYouDont: "This is the one ski almost everybody owns. If you're choosing between a narrower and a wider pair today, take the wider one.",
  },
  "midfat": {
    id: "midfat",
    label: "Mid-Fats",
    tagline: "Float without the boat.",
    waistLabel: "100–112mm underfoot",
    plain: "Enough surface area to stay up in fresh snow, still light enough on edge to be worth riding once the run gets tracked. The most useful ski in most people's quiver on a storm day.",
    rank: 3,
    ifYouDont: "Your daily driver will get down it — you'll just work harder and sit further back. Pick lines with a bit more pitch to keep your speed up.",
  },
  "fatties": {
    id: "fatties",
    label: "The Fatties",
    tagline: "Actual powder skis.",
    waistLabel: "112–120mm underfoot",
    plain: "Genuine float. On a real storm day these keep your tips up and your legs fresh — the width does the work your quads would otherwise be doing.",
    rank: 4,
    ifYouDont: "A 100-something still works — stay on steeper pitches where gravity does the floating for you, and don't be the first one into the flats.",
  },
  "pow-boats": {
    id: "pow-boats",
    label: "Pow Boats",
    tagline: "The silly ones.",
    waistLabel: "120mm+ underfoot",
    plain: "The pair that looks absurd on the rack and gets ridden four days a year. This is one of those four days.",
    rank: 5,
    ifYouDont: "Almost nobody owns these. Take your widest pair, mount up, and pick the steepest thing you're comfortable on.",
  },
  "slush": {
    id: "slush",
    label: "Slush Puppies",
    tagline: "Spring beaters, but fun.",
    waistLabel: "95–110mm, detuned",
    plain: "Soft spring snow is heavy and grabby, and a wider ski planes over it instead of ploughing through. Detuning the tip and tail edges keeps them from catching in the wet stuff.",
    rank: 3,
    ifYouDont: "Anything mid-width is fine. The real spring advice is timing, not equipment — corn skis best from mid-morning until it turns to mashed potatoes.",
  },
};

// Not a primary call — an aside, because the park is a choice you make on top
// of the conditions rather than instead of them.
const PARK_ASIDE = {
  label: "Park Twinnies",
  text: "If you're spending the day in the park, take the twin-tips instead — soft snow means the landings are forgiving today.",
};

// --- Snow density ----------------------------------------------------------
// Snow-to-liquid ratio is the real, measurable thing behind every "is it
// blower or is it cement" argument in a lift line, and both halves of it come
// back in the same NOAA gridpoint response (`snowfallAmount` and
// `quantitativePrecipitation`). 10:1 is the textbook average; interior
// continental snowpacks routinely run 15–20:1, and maritime Cascade and
// Sierra storms run 6–9:1. Using the ratio rather than temperature alone
// matters because it captures the thing temperature only proxies for.
//
// Counter-intuitively for anyone who hasn't skied both, LIGHT snow demands
// MORE float, not less: at 20:1 a foot of new snow holds a fraction of the
// water a foot at 8:1 does, so it stays unconsolidated and unsupportive and
// you sink straight through it. Dense maritime snow packs down and holds you
// up. That's why `factor` runs above 1 for light snow and below 1 for heavy.
const DENSITY = {
  blower: { key: "blower", factor: 1.35, word: "cold and dry", long: "Very light, dry snow — it won't support you, so you need surface area." },
  light: { key: "light", factor: 1.15, word: "light", long: "Light snow that'll stay soft rather than setting up." },
  medium: { key: "medium", factor: 1.0, word: "average-density", long: "Ordinary snow — about ten inches of it to an inch of water." },
  heavy: { key: "heavy", factor: 0.85, word: "dense", long: "Dense snow. It packs down, so it skis shallower than it measures." },
  wet: { key: "wet", factor: 0.7, word: "wet and heavy", long: "Wet, heavy snow. It sets up fast and takes real effort to turn in." },
};

function densityFromRatio(slr) {
  if (slr >= 15) return DENSITY.blower;
  if (slr >= 12) return DENSITY.light;
  if (slr >= 9) return DENSITY.medium;
  if (slr >= 6) return DENSITY.heavy;
  return DENSITY.wet;
}

// Temperature fallback, used only when there's no usable liquid-equivalent
// figure to divide by (a dry day, or a gridpoint response missing QPF).
// Deliberately coarser than the ratio path, and the UI never claims the
// ratio when it came from here.
function densityFromTemp(tempF) {
  if (tempF == null) return DENSITY.medium;
  if (tempF < 10) return DENSITY.blower;
  if (tempF < 20) return DENSITY.light;
  if (tempF < 28) return DENSITY.medium;
  if (tempF < 34) return DENSITY.heavy;
  return DENSITY.wet;
}

// --- Terrain character -----------------------------------------------------
// The same eight inches is a different ski at different mountains. Somewhere
// with steeps, trees and a deep-powder reputation holds soft snow in places
// you can actually use it, and rewards float. A low-angle groomer hill
// pushes new snow around into piles by 10am and never asks anything of a
// wide ski — and a 300-foot Midwest day-trip hill (which this dataset
// deliberately includes, per the `scale` field) never does, at any depth.
//
// Bounded to ±25% on purpose: terrain modulates the call, it never drives
// it. Twenty inches is a powder day at Buck Hill too.
function quiverTerrainFactor(resort) {
  const tags = resort.best_for_tags || [];
  const softSnowTags = ["deep-powder", "steeps", "tree-skiing", "big-vert", "backcountry-access"];
  const hits = softSnowTags.filter((t) => tags.includes(t)).length;
  const advPct = resort.terrain_pct ? resort.terrain_pct.advanced_expert : null;

  let f = 1;
  if (hits >= 3) f += 0.12;
  else if (hits >= 1) f += 0.06;

  // terrain_pct is null for 17 of 71 resorts (requirements T5 — documented
  // permanent partial coverage, not a gap to close). Absent, this term
  // simply doesn't contribute, rather than defaulting to a guess.
  if (advPct != null) {
    if (advPct >= 45) f += 0.06;
    else if (advPct <= 15) f -= 0.1;
  }
  if (tags.includes("long-groomers") && hits === 0) f -= 0.08;
  if (resort.scale === "day-trip") f -= 0.12;
  return clamp(f, 0.75, 1.25);
}

// --- Season phase ----------------------------------------------------------
// Reuses noaa.js's already-audited free-text season parser rather than a
// second, differently-wrong one. Returns null when the resort's published
// window can't be confidently parsed — callers then skip the early-season
// and spring branches for that resort instead of guessing at a date.
function quiverSeasonPhase(resort, now) {
  const open = parseSeasonBoundary(resort.season_open);
  const close = parseSeasonBoundary(resort.season_close);
  if (!open || !close) return null;
  const openDay = shiftedSeasonDay(open.month, open.day);
  const closeDay = shiftedSeasonDay(close.month, close.day);
  if (closeDay <= openDay) return null;
  const nowDay = shiftedSeasonDay(now.getMonth(), now.getDate());
  if (nowDay < openDay || nowDay > closeDay) return "closed";
  const through = (nowDay - openDay) / (closeDay - openDay);
  if (through <= 0.14) return "early";
  if (through >= 0.72) return "spring";
  return "mid";
}

// ---------------------------------------------------------------------------
// Conditions assessment
//
// `day` and `priorDays` are the per-day shape noaa.js produces:
//   { dateKey, snowIn, precipIn, highF, lowF, isLive }
// `priorDays` is in chronological order and may be SHORTER than three — the
// forecast horizon starts today, so for today or tomorrow there simply is no
// lead-in data. `leadDaysObserved` reports that honestly rather than letting
// a missing lead-in read as a dry one, and the UI surfaces it.
// ---------------------------------------------------------------------------
function assessQuiverConditions(resort, day, priorDays, now) {
  priorDays = priorDays || [];
  const lead = priorDays.slice(-2); // the 48h ahead of the chosen day
  const leadSnow = lead.reduce((s, d) => s + (d.snowIn || 0), 0);
  const newSnow = day.snowIn || 0;
  const stormTotal = Math.round((newSnow + leadSnow) * 10) / 10;

  // Only a live day carries a real per-day snowfall AND a real liquid figure;
  // the typical-season fallback's liquid figure is an assumed 10:1.
  const forecastShaped = !!day.isLive;
  const precipTotal = (day.precipIn || 0) + lead.reduce((s, d) => s + (d.precipIn || 0), 0);
  // Only trust the ratio when there's enough of both sides of it to divide
  // meaningfully — a trace of each produces a wild, meaningless number — and
  // only on the live path.
  //
  // That second condition is load-bearing and was added after
  // verify_quiver_visual.js caught the alternative in the act: the
  // typical-season fallback derives its liquid figure by ASSUMING a textbook
  // 10:1, so dividing snow by liquid there returns exactly 10:1 every time
  // and the copy layer would then present that assumption back to the reader
  // as "the forecast works out to about 10:1 snow-to-water" — a measurement
  // the app never made, on a path that has no forecast at all. Withholding
  // it drops the fallback onto the coarser temperature read, which is what
  // it actually knows. R8: never present derived history as measurement.
  const slr = (forecastShaped && stormTotal >= 1 && precipTotal >= 0.1) ? stormTotal / precipTotal : null;
  const density = slr != null ? densityFromRatio(slr) : densityFromTemp(day.highF);

  const terrain = quiverTerrainFactor(resort);
  const floatScore = Math.round(stormTotal * density.factor * terrain * 10) / 10;

  // A dry streak we can actually see: consecutive forecast days before the
  // chosen one with essentially nothing falling. Capped by what the horizon
  // covers, which is exactly why `leadDaysObserved` travels alongside it.
  let dryStreak = 0;
  for (let i = priorDays.length - 1; i >= 0; i--) {
    if ((priorDays[i].snowIn || 0) < 0.5) dryStreak += 1;
    else break;
  }
  if (newSnow < 0.5) dryStreak += 0; // the chosen day's own dryness is `newSnow`, kept separate

  // A storm visible earlier in the window that has since stopped — the
  // precondition for moguls forming, which need snow plus a few days of
  // traffic to build up.
  const priorStorm = priorDays.reduce((max, d) => Math.max(max, d.snowIn || 0), 0);

  const phase = quiverSeasonPhase(resort, now);
  const baseElev = resort.base_elevation_ft;
  // Rain, not snow, at the base. Two independent signals have to agree: it's
  // warm, and precipitation is actually falling as something other than snow
  // (measurable liquid, negligible accumulation).
  const rainRisk = day.highF != null && day.highF >= 36 && (day.precipIn || 0) >= 0.1 && newSnow < 1;

  return {
    resort,
    dateKey: day.dateKey,
    isLive: !!day.isLive,
    forecastShaped,
    newSnow: Math.round(newSnow * 10) / 10,
    stormTotal,
    leadDaysObserved: lead.length,
    slr: slr != null ? Math.round(slr * 10) / 10 : null,
    density,
    terrainFactor: terrain,
    floatScore,
    dryStreak,
    priorStorm: Math.round(priorStorm * 10) / 10,
    highF: day.highF,
    lowF: day.lowF,
    phase,
    baseElev,
    rainRisk,
  };
}

// --- Float thresholds ------------------------------------------------------
// floatScore is inches of new snow, scaled by density and by how much the
// mountain rewards float. The bands are the widths people actually reach
// for at those depths; they're deliberately generous at the bottom (two
// inches is not a powder day, whatever the marketing says) and conservative
// at the top (a 120mm ski is a genuinely bad choice on anything less than a
// proper storm).
// Calibrated against the multiplier, not against raw inches — an early
// version used raw-inch thresholds (18/12/6/2) and then multiplied the input
// by up to 1.6, which pushed a 12-inch Alta day onto a 120mm ski. Twelve
// inches of Utah blower is a 115 day; boats come out at eighteen and up.
// These bands are set so that, at a deep-snow destination in light snow (the
// combination that produces the largest multiplier), the call lands where
// the raw depth says it should:
//     ~6-8"  -> mid-fats      ~8-14" -> fatties      ~18"+ -> boats
const FLOAT_BANDS = [
  { min: 24, call: "pow-boats" },
  { min: 15, call: "fatties" },
  { min: 7, call: "midfat" },
  { min: 2, call: "daily" },
];
// The float score at which a day stops being about the surface and starts
// being about depth. Kept as one named constant because the override
// branches (rock skis, spring slush) and the caveats both need to agree with
// the ladder about where that line is.
const POWDER_DAY_FLOAT = 7;

function floatBandCall(floatScore) {
  for (const band of FLOAT_BANDS) if (floatScore >= band.min) return band.call;
  return null;
}

// ---------------------------------------------------------------------------
// The call itself.
//
// Returns { call, conditions, reasons[], aside, caveats[], headline }.
// `reasons` are full sentences built from the specific numbers that drove
// the decision — never a bare score, per R9, and deliberately varied by the
// actual inputs rather than bucketed into a handful of shared strings
// (the D5 debt already logged against Chase the Snow's reason copy).
// ---------------------------------------------------------------------------
function quiverCheck(resort, day, priorDays, now) {
  now = now || new Date();
  const c = assessQuiverConditions(resort, day, priorDays, now);
  const reasons = [];
  const caveats = [];
  let callId = null;

  const floatCall = floatBandCall(c.floatScore);
  const isPowderDay = c.floatScore >= POWDER_DAY_FLOAT;

  // --- Hard overrides, in priority order -----------------------------------
  // Each of these describes a day where the surface, not the depth, decides
  // what you ride. They're checked before the float ladder because on these
  // days float is the wrong question.
  if (c.rainRisk && !isPowderDay) {
    callId = "rock-skis";
    reasons.push(`It's forecast to hit ${Math.round(c.highF)}°F with ${c.newSnow < 0.5 ? "precipitation" : "mixed precipitation"} in it — at the ${fmtElev(c.baseElev)} base that's rain, not snow.`);
    reasons.push("Wet snow over a firm surface strips down to whatever's underneath, and that's where bases get hurt.");
  } else if (c.phase === "early" && !isPowderDay) {
    callId = "rock-skis";
    reasons.push(`${resort.name} typically opens ${lowerFirst(resort.season_open)}, so this is early-season cover — thin, with more underneath it than under it.`);
    reasons.push(c.newSnow >= 1
      ? `${fmtInches(c.newSnow)} of new snow isn't enough to bury early-season hazards, it just hides them.`
      : "Nothing new in the forecast to build on what's there.");
  } else if (c.phase === "spring" && c.highF != null && c.highF >= 38 && !isPowderDay) {
    callId = "slush";
    reasons.push(`${Math.round(c.highF)}°F and late in ${resort.name}'s season — that's a corn cycle, not a powder day.`);
    reasons.push("The snow refreezes overnight and softens through the morning, so it skis firm early and heavy by mid-afternoon.");
  } else if (floatCall) {
    // --- The float ladder --------------------------------------------------
    callId = floatCall;
    reasons.push(stormSentence(c));
    reasons.push(densitySentence(c));
    const t = terrainSentence(c);
    if (t) reasons.push(t);
  } else {
    // --- Firm day ----------------------------------------------------------
    // Nothing meaningful falling. The question becomes what the surface has
    // had time to turn into.
    const advPct = resort.terrain_pct ? resort.terrain_pct.advanced_expert : null;
    const hasBumpTerrain = (resort.best_for_tags || []).includes("steeps") || (advPct != null && advPct >= 35);
    // Moguls are built by traffic, not by weather, so no forecast can observe
    // them — which is exactly why an earlier, stricter version of this rule
    // (a visible storm PLUS three visible dry days) was effectively dead
    // code: it could only ever fire on days five through seven of the
    // window. What a forecast CAN establish is the precondition, and the
    // precondition is most of the answer: a mountain with enough steep
    // ungroomed terrain, in the middle of its season, that hasn't been reset
    // by new snow for a couple of days. Groomers get reset every night;
    // ungroomed runs don't, and they bump up.
    //
    // The dry stretch has to be one we can actually see (`dryStreak` is
    // counted from real forecast days, never assumed), the inference is
    // stated as an inference in the caveats, and early season is excluded
    // because there isn't enough base to build a mogul out of yet.
    const bumpsLikely = hasBumpTerrain && (c.phase === "mid" || c.phase === "spring") && c.dryStreak >= 2;

    if (bumpsLikely) {
      callId = "bumps";
      reasons.push(c.priorStorm >= 2
        ? `${fmtInches(c.priorStorm)} fell earlier in the week and nothing since — ${pluralize(c.dryStreak, "day")} of traffic on that is how moguls get built.`
        : `${pluralize(c.dryStreak, "day")} without new snow before yours. The groomed runs get reset every night; the ungroomed ones don't, and they bump up.`);
      reasons.push(`${resort.name} has the pitch for it${advPct != null ? ` — ${advPct}% of the terrain is rated advanced or expert` : ""}, and steep ungroomed terrain is where moguls form.`);
      caveats.push("Nobody can see moguls in a weather forecast — this is an inference from a dry stretch plus the terrain, not a snow report. If you'd rather stay on the groomed runs, take something narrower with a sharp edge instead.");
    } else {
      callId = "skinny";
      reasons.push(c.stormTotal < 0.5
        ? (c.forecastShaped ? "Nothing in the forecast — this is a groomer day." : "No meaningful snow typical for this time of year — plan on a groomer day.")
        : `Only ${fmtInches(c.stormTotal)} ${c.forecastShaped ? "in the forecast" : "typical for this stretch of the season"}, which is a dusting on a firm surface rather than something to float in.`);
      reasons.push(c.highF != null && c.highF < 20
        ? `At ${Math.round(c.highF)}°F that surface will stay firm and fast all day, and a sharp edge is what holds on it.`
        : "On firm snow, edge grip beats surface area — a narrower ski gets from edge to edge faster.");
      if (hasBumpTerrain && c.leadDaysObserved < 2) {
        caveats.push("If it snowed here a few days ago, the ungroomed runs may have bumped up — the forecast can't see backwards, so throw the bump skis in the car if you have them.");
      }
    }
  }

  // --- Caveats — things that don't change the call but change the day ------
  if (!c.isLive) {
    caveats.push("This is typical snowfall for this time of year, not a live forecast — treat it as a starting point and check the resort's own snow report before you pack.");
  }
  if (c.leadDaysObserved < 2 && c.forecastShaped) {
    caveats.push(`The forecast only runs forward, so this counts ${c.leadDaysObserved === 0 ? "no" : pluralize(c.leadDaysObserved, "day")} of snow before your day. If there's already fresh snow on the ground, size up.`);
  }
  if (isPowderDay && (resort.crowd_level === "brutal" || resort.crowd_level === "high")) {
    caveats.push(`${resort.name} gets crowded on a powder day — plan on it being tracked out by mid-morning, and pick your first lap accordingly.`);
  }
  if (c.phase === "early" && isPowderDay) {
    caveats.push(`It's early in ${resort.name}'s season, so the base underneath all that is still thin. Great day, wrong day to straight-line something unfamiliar.`);
  }
  if ((c.density.key === "wet" || c.density.key === "heavy") && isPowderDay) {
    caveats.push("Heavy snow is hard work. A stiffer ski will hold a line through it better than a soft one of the same width.");
  }

  const aside = shouldSuggestPark(resort, c) ? PARK_ASIDE : null;

  return {
    call: SKI_CALLS[callId],
    conditions: c,
    reasons,
    caveats,
    aside,
  };
}

function shouldSuggestPark(resort, c) {
  if (!(resort.best_for_tags || []).includes("terrain-park")) return false;
  return c.floatScore >= 2 || (c.phase === "spring" && c.highF != null && c.highF >= 38);
}

// --- Reason sentence builders ---------------------------------------------
// Kept as separate functions so each one can vary on its own inputs. The
// alternative — a lookup table of pre-written strings keyed by band — is
// exactly what produced Chase the Snow's coarse, repetitive reason copy
// (requirements D5), where several differently-scoring resorts render
// identical text and the ranking's gradation stops being legible.
// The word "forecast" is not available on the typical-season path — there is
// no forecast there, only an annual average divided down. An earlier version
// used the live phrasing on both paths and produced sentences like "4"
// forecast on your day" underneath a badge reading "Not a live forecast",
// which is precisely the contradiction R8 exists to prevent. The two paths
// therefore get genuinely different sentences, not the same sentence with a
// disclaimer bolted on.
function stormSentence(c) {
  if (!c.forecastShaped) {
    return c.stormTotal >= 1
      ? `A typical week at ${c.resort.name} at this point in the season brings around ${fmtInches(c.stormTotal * (7 / Math.max(1, c.leadDaysObserved + 1)))} of snow — roughly ${fmtInches(c.newSnow)} on any given day.`
      : `${c.resort.name} doesn't typically get meaningful snow at this point in the season.`;
  }
  if (c.newSnow >= 0.5 && c.stormTotal > c.newSnow + 0.4) {
    return `${fmtInches(c.newSnow)} forecast on your day, on top of ${fmtInches(Math.round((c.stormTotal - c.newSnow) * 10) / 10)} in the ${pluralize(c.leadDaysObserved, "day")} before it — ${fmtInches(c.stormTotal)} of new snow in total.`;
  }
  if (c.newSnow >= 0.5) {
    return `${fmtInches(c.newSnow)} of new snow forecast for your day.`;
  }
  return `${fmtInches(c.stormTotal)} fell in the ${pluralize(c.leadDaysObserved, "day")} before your day, and it's forecast to be clear once you're there.`;
}

function densitySentence(c) {
  if (c.slr != null) {
    return `The forecast works out to about ${c.slr}:1 snow-to-water — ${c.density.word}. ${c.density.long}`;
  }
  if (c.highF != null && !c.forecastShaped) {
    return `Temperatures here typically sit around ${Math.round(c.highF)}°F at this time of year, which usually means ${c.density.word} snow. ${c.density.long}`;
  }
  if (c.highF != null) {
    return `Around ${Math.round(c.highF)}°F, which usually means ${c.density.word} snow. ${c.density.long}`;
  }
  return c.density.long;
}

function terrainSentence(c) {
  const r = c.resort;
  const tags = r.best_for_tags || [];
  const advPct = r.terrain_pct ? r.terrain_pct.advanced_expert : null;
  if (c.terrainFactor >= 1.1) {
    const named = ["deep-powder", "steeps", "tree-skiing"].filter((t) => tags.includes(t));
    const phrase = named.length
      ? named.map((t) => ({ "deep-powder": "deep snow", "steeps": "steep terrain", "tree-skiing": "tree skiing" }[t])).join(" and ")
      : "terrain that holds soft snow";
    return `${r.name} is known for ${phrase}, which is terrain that rewards float rather than punishing it.`;
  }
  if (r.scale === "day-trip") {
    return `${r.name} is a day-trip hill${r.vertical_drop_ft != null ? ` with ${qNum(r.vertical_drop_ft)} feet of vertical` : ""} — fun in fresh snow, but not somewhere you need a powder ski to get down.`;
  }
  if (c.terrainFactor <= 0.92) {
    return advPct != null
      ? `${r.name} skis mostly groomed — ${advPct}% of the terrain is rated advanced or expert — so the new snow gets pushed around rather than staying deep.`
      : `${r.name} skis mostly groomed, so the new snow gets pushed around rather than staying deep.`;
  }
  return null;
}

// --- Small formatters ------------------------------------------------------
// fmtInches keeps a half-inch of precision below an inch and rounds to whole
// numbers above it, because "7.4 inches" implies a forecast accuracy that
// doesn't exist.
function fmtInches(n) {
  if (n == null) return "—";
  if (n < 1) return `${Math.round(n * 10) / 10}"`;
  return `${Math.round(n)}"`;
}
function fmtElev(ft) {
  return ft != null ? `${qNum(ft)}-foot` : "base";
}
// A local thousands-separator rather than app.js's fmtNum: this module is
// deliberately free of any dependency on the UI layer so verify_quiver.js can
// load it with only data.js, engine.js and noaa.js and still exercise every
// sentence the model can produce.
function qNum(n) { return n == null ? null : n.toLocaleString("en-US"); }
function lowerFirst(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}
