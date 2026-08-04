// ---------------------------------------------------------------------------
// Matching engines — implements docs/designpowers/strategy.md §3 (Plan a Trip)
// and §4 (Chase the Snow) exactly as specified. Mixed-ability scoring is a
// min-max bottleneck function, never an average (§3.2) — this is the app's
// differentiator and it is implemented literally as Math.min(floor, ceiling).
// ---------------------------------------------------------------------------

const SKILL_LEVELS = ["never-skied", "beginner", "intermediate", "advanced", "expert"];
const SKILL_LABEL = {
  "never-skied": "never skied before",
  "beginner": "beginner",
  "intermediate": "intermediate",
  "advanced": "advanced",
  "expert": "expert",
};
const COST_TIERS = ["$", "$$", "$$$", "$$$$"];
const FIELD_STRENGTH = { strong: 10, decent: 6, weak: 2 };

function haversineMiles(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// --- Null-safe terrain scoring (strategy.md §3.6) ---------------------------
// Never treats a null terrain_pct as zero or a negative signal. When null,
// the level score falls back entirely to editorial fields (renormalized to
// 100% weight instead of the usual blend), never guessed or interpolated.
function editorialLevelScore(resort, level) {
  const bf = FIELD_STRENGTH[resort.beginner_friendliness] ?? 5;
  const fs = FIELD_STRENGTH[resort.family_ski_school] ?? 5;
  const tags = resort.best_for_tags || [];
  const expertTagHits = ["steeps", "tree-skiing", "deep-powder", "big-vert", "backcountry-access"]
    .filter((t) => tags.includes(t)).length;

  if (level === "never-skied") return clamp(bf * 0.65 + fs * 0.35, 0, 10);
  if (level === "beginner") return clamp(bf * 0.7 + fs * 0.3, 0, 10);
  if (level === "intermediate") {
    const groomerBonus = tags.includes("long-groomers") ? 1.5 : 0;
    return clamp(bf * 0.35 + fs * 0.15 + 4 + groomerBonus, 0, 10);
  }
  // advanced / expert
  const tagWeight = level === "expert" ? 0.4 : 0.25;
  return clamp(4 + expertTagHits * 1.6 * (1 + tagWeight), 0, 10);
}

function terrainPctLevelScore(resort, level) {
  if (!resort.terrain_pct) return null;
  const { beginner, intermediate, advanced_expert } = resort.terrain_pct;
  if (level === "never-skied" || level === "beginner") return clamp((beginner / 25) * 10, 0, 10);
  if (level === "intermediate") return clamp((intermediate / 45) * 10, 0, 10);
  return clamp((advanced_expert / 50) * 10, 0, 10); // advanced / expert
}

/** How well a resort serves a skier at a given level, 0-10. Null-safe. */
function levelScore(resort, level) {
  const editorial = editorialLevelScore(resort, level);
  const pct = terrainPctLevelScore(resort, level);
  if (pct === null) return editorial; // renormalized basis — no zero penalty for missing data
  return clamp(pct * 0.6 + editorial * 0.4, 0, 10);
}

// --- Terrain & skill fit (35 pts) — the differentiator ----------------------
function terrainSkillScore(resort, answers) {
  const levels = answers.skillLevels && answers.skillLevels.length
    ? answers.skillLevels
    : ["intermediate"];
  const sorted = [...levels].sort((a, b) => SKILL_LEVELS.indexOf(a) - SKILL_LEVELS.indexOf(b));
  const floor = sorted[0];
  const ceiling = sorted[sorted.length - 1];

  const floorScore = levelScore(resort, floor);
  const ceilingScore = levelScore(resort, ceiling);
  // The bottleneck function — the minimum, never the average.
  const bottleneck = Math.min(floorScore, ceilingScore);
  const abilityFit = (bottleneck / 10) * 25;

  let appetiteScore; // 0-10
  const tp = resort.terrain_pct;
  switch (answers.terrain) {
    case "groomers":
      appetiteScore = tp ? clamp((tp.intermediate / 45) * 10, 0, 10) : editorialLevelScore(resort, "intermediate");
      break;
    case "steep":
      appetiteScore = levelScore(resort, "expert");
      break;
    case "mix": {
      const b = levelScore(resort, "beginner"), i = levelScore(resort, "intermediate"), a = levelScore(resort, "expert");
      appetiteScore = (b + i + a) / 3;
      break;
    }
    default: // noPreference — flexible answer, zero weight on this axis
      appetiteScore = 10;
  }

  return {
    total: clamp(abilityFit + appetiteScore, 0, 35),
    floor, ceiling, floorScore, ceilingScore, bottleneck,
  };
}

// --- Budget fit (15 pts) -----------------------------------------------------
function budgetScore(resort, answers) {
  if (!answers.budget) return 15;
  const userIdx = COST_TIERS.indexOf(answers.budget);
  const resortIdx = COST_TIERS.indexOf(resort.cost_tier);
  if (userIdx < 0 || resortIdx < 0) return 10;
  const diff = resortIdx - userIdx;
  if (diff <= 0) return 15;
  return clamp(15 - diff * 6, 0, 15);
}

// --- Vibe / town fit (15 pts) ------------------------------------------------
function vibeScore(resort, answers) {
  if (!answers.vibe || answers.vibe === "noPreference") return 15;
  const vibe = (resort.town_vibe || "").toLowerCase();
  const tags = resort.best_for_tags || [];
  if (answers.vibe === "lively") {
    if (tags.includes("apres-scene") || /lively|nightlife|bar|busy|party|younger/.test(vibe)) return 15;
    if (/quiet|low-key/.test(vibe)) return 3;
    return 8;
  }
  if (answers.vibe === "chill") {
    if (tags.includes("quiet") || /quiet|low-key|laid-back|uncrowded/.test(vibe)) return 15;
    if (tags.includes("apres-scene") || /busy|brutal|nightlife/.test(vibe)) return 4;
    return 9;
  }
  if (answers.vibe === "family") {
    if (tags.includes("family") || /family/.test(vibe)) return 15;
    return 6;
  }
  return 10;
}

// --- Non-ski / family infrastructure (15 pts, only meaningfully weighted for
// groups with a beginner/kid signal) ------------------------------------------
function familyInfraScore(resort, answers) {
  const floorLevel = answers.skillLevels && answers.skillLevels.length
    ? [...answers.skillLevels].sort((a, b) => SKILL_LEVELS.indexOf(a) - SKILL_LEVELS.indexOf(b))[0]
    : null;
  const needsWeight = floorLevel === "never-skied" || floorLevel === "beginner" || answers.vibe === "family";
  if (!needsWeight) return 7.5; // near-zero differentiating weight for a solo expert
  const fs = FIELD_STRENGTH[resort.family_ski_school] ?? 5;
  const nonSki = { strong: 10, decent: 6, thin: 2 }[resort.non_ski_activities] ?? 5;
  return clamp((fs * 0.6 + nonSki * 0.4) * 1.5, 0, 15);
}

// --- Travel feasibility (20 pts, soft-gate for driving per §3.4) -------------
function regionById(id) {
  return REGIONS.find((r) => r.id === id) || null;
}

function travelScore(resort, answers) {
  if (!answers.travelMode || answers.travelMode === "unsure") {
    return { score: 20, excluded: false, distanceMiles: null, mode: "unsure" };
  }
  const region = answers.region ? regionById(answers.region) : null;
  const distanceMiles = region && region.lat != null
    ? haversineMiles(region.lat, region.lon, resort.lat, resort.lon)
    : null;

  if (answers.travelMode === "driving") {
    if (distanceMiles == null) return { score: 12, excluded: false, distanceMiles: null, mode: "driving" };
    const HARD_GATE = 700;
    if (distanceMiles > HARD_GATE) {
      return { score: 0, excluded: true, distanceMiles, mode: "driving" };
    }
    const score = 20 * clamp(1 - distanceMiles / HARD_GATE, 0.1, 1);
    return { score, excluded: false, distanceMiles, mode: "driving" };
  }

  // flying
  const tags = resort.best_for_tags || [];
  let score = 14;
  if (tags.includes("easy-flight")) score += 6;
  else if (distanceMiles != null && distanceMiles < 1200) score += 3;
  let excluded = false;
  if (resort.scale === "day-trip") { score *= 0.2; excluded = true; } // never worth flying to a day-trip hill
  return { score: clamp(score, 0, 20), excluded, distanceMiles, mode: "flying" };
}

// --- Reason bullets (strategy.md §3.5 — never a bare score) -----------------
function pluralize(n, unit) { return `${n} ${unit}${n === 1 ? "" : "s"}`; }

function buildReasonBullets(resort, answers, breakdown) {
  const bullets = [];

  // Bullet 1: group / terrain fit
  if (answers.groupType === "mixed" || answers.groupType === "wide-mixed") {
    const floorWord = SKILL_LABEL[breakdown.terrain.floor];
    const ceilingWord = SKILL_LABEL[breakdown.terrain.ceiling];
    if (breakdown.terrain.bottleneck >= 6) {
      bullets.push(`You said your crew ranges from ${floorWord} to ${ceilingWord} — ${resort.name} has real beginner terrain and genuine advanced terrain, so nobody's stuck on the easy runs or bored on the harder ones.`);
    } else {
      bullets.push(`You said your crew ranges from ${floorWord} to ${ceilingWord} — ${resort.name} is the strongest realistic fit for that spread among what's actually available.`);
    }
  } else if (answers.skillLevels && answers.skillLevels.length) {
    const lvl = SKILL_LABEL[answers.skillLevels[0]];
    if (answers.terrain === "steep") {
      bullets.push(`You said steep and challenging — ${resort.name} delivers real advanced terrain to match your ${lvl} level.`);
    } else if (answers.terrain === "groomers") {
      bullets.push(`You said smooth, groomed trails — ${resort.name} has the cruising terrain to back it up.`);
    } else {
      bullets.push(`You said ${lvl} — ${resort.name} is a genuine fit for that level.`);
    }
  }

  // Bullet 2: travel
  if (breakdown.travel.mode === "unsure") {
    bullets.push("We didn't factor in how far this is, since you weren't sure yet.");
  } else if (breakdown.travel.mode === "driving" && breakdown.travel.distanceMiles != null) {
    const hours = Math.round((breakdown.travel.distanceMiles / 55) * 10) / 10;
    const region = regionById(answers.region);
    bullets.push(`You're driving from ${region ? region.label : "your area"} — this is around ${pluralize(Math.max(1, Math.round(hours)), "hour")}, no flight needed.`);
  } else if (breakdown.travel.mode === "flying") {
    bullets.push(`You're flying in — ${resort.nearest_airport} gets you close, about ${resort.airport_drive_time_min != null ? pluralize(resort.airport_drive_time_min, "minute") : "a short drive"} from the airport to the mountain.`);
  }

  // Bullet 3: budget
  const budgetLabel = { "$": "budget-conscious", "$$": "mid-range", "$$$": "splurge-friendly", "$$$$": "money's no object" }[answers.budget];
  if (answers.budget) {
    if (COST_TIERS.indexOf(resort.cost_tier) <= COST_TIERS.indexOf(answers.budget)) {
      bullets.push(`You said ${budgetLabel} — this comes in at ${resort.cost_tier}, right in that range.`);
    } else {
      bullets.push(`You said ${budgetLabel} — this runs a bit higher (${resort.cost_tier}), but it's the strongest overall fit for everything else you said.`);
    }
  }

  return bullets.slice(0, 3);
}

// --- Session-seeded weighted random (§3.3 tie-break step 3) -----------------
// Identical answers within the same session return the same result; different
// sessions with similar inputs can surface different, comparably-good picks.
let SESSION_SEED = Math.floor(Math.random() * 2 ** 31);
function answersHash(answers) {
  return hashStr(JSON.stringify(answers));
}

// In-memory (JS-variable, not localStorage — see build notes) anti-repetition
// memory of resorts recently surfaced on this device/session.
const recentlyShownResortIds = [];
function noteShown(id) {
  recentlyShownResortIds.unshift(id);
  if (recentlyShownResortIds.length > 5) recentlyShownResortIds.pop();
}

/**
 * Scores every resort in the pool against the trip-planner answers and
 * returns a ranked result, or null if nothing clears the hard gates.
 */
function matchTrip(answers, pool) {
  pool = pool || RESORTS;
  const scored = [];

  for (const resort of pool) {
    const terrain = terrainSkillScore(resort, answers);
    const budget = budgetScore(resort, answers);
    const vibe = vibeScore(resort, answers);
    const family = familyInfraScore(resort, answers);
    const travel = travelScore(resort, answers);

    if (travel.excluded) continue; // hard gate — genuinely wrong answer, not just lower-scored

    const total = terrain.total + budget + vibe + family + travel.score;
    scored.push({ resort, total, breakdown: { terrain, budget, vibe, family, travel } });
  }

  if (!scored.length) return null;

  scored.sort((a, b) => b.total - a.total);

  const TIE_BAND = 4;
  const topScore = scored[0].total;
  const tied = scored.filter((s) => topScore - s.total <= TIE_BAND);

  // Tie-break 1: anti-repetition nudge (device/session-local).
  // NOTE: strategy.md §3.3's original tie-break 1 ("presence of a Nicole hot
  // take") has been removed per Director ruling (2026-08-03): "just stop
  // boosting them." Her takes are pure commentary with no effect on the pick,
  // either way — presence-only was never a sentiment check (hot_take.rating
  // is null for every resort that has a take), so it silently promoted
  // resorts regardless of whether her take was positive or a warning. No
  // sentiment-based substitute was requested — Nicole explicitly deferred
  // sentiment scoring to a post-launch feature. This step is now the first
  // tie-break, exactly as strategy.md's own ordering falls back to once step
  // 1 is removed, so anti-repetition still does real diversifying work.
  const notRecent = tied.filter((s) => !recentlyShownResortIds.includes(s.resort.id));
  const pickPool = notRecent.length ? notRecent : tied;

  // Tie-break 2: session-seeded weighted-random among the remaining tied set
  const seed = (SESSION_SEED ^ answersHash(answers)) >>> 0;
  const rng = mulberry32(seed);
  const idx = Math.floor(rng() * pickPool.length);
  const winner = pickPool[idx];

  const reasonBullets = buildReasonBullets(winner.resort, answers, winner.breakdown);
  noteShown(winner.resort.id);

  return {
    resort: winner.resort,
    score: winner.total,
    breakdown: winner.breakdown,
    reasonBullets,
    showRangeReadout: answers.groupType === "mixed" || answers.groupType === "wide-mixed",
  };
}

// ---------------------------------------------------------------------------
// Chase the Snow — strategy.md §4
// ---------------------------------------------------------------------------

function normalizeField(values) {
  const nums = values.filter((v) => v != null);
  if (!nums.length) return () => 0.5;
  const min = Math.min(...nums), max = Math.max(...nums);
  if (max === min) return () => 0.5;
  return (v) => (v == null ? 0.5 : clamp01((v - min) / (max - min)));
}

function terrainWorthItRaw(resort) {
  const tags = resort.best_for_tags || [];
  const tagHits = ["deep-powder", "steeps", "tree-skiing"].filter((t) => tags.includes(t)).length;
  const pctScore = resort.terrain_pct ? resort.terrain_pct.advanced_expert / 100 : editorialLevelScore(resort, "expert") / 10;
  return clamp01(pctScore * 0.6 + (tagHits / 3) * 0.4);
}

const CROWD_PENALTY = { low: 0, moderate: 0.3, high: 0.6, brutal: 1 };

/**
 * Ranks US resorts by the Chase-the-Snow formula (§4.2). `forecasts` maps
 * resort id -> { totalInches, avgTempF, isLive } (already resolved, live or
 * historical fallback — this function is agnostic to the data source, which
 * is exactly what keeps the honesty rule enforceable in one place: the UI
 * layer decides how to label the source, this layer only ranks).
 */
function rankChaseTheSnow(forecasts, answers, pool) {
  pool = pool || RESORTS;
  answers = answers || {};
  const usResorts = pool.filter((r) => r.country === "USA" && forecasts[r.id]);

  const snowValues = usResorts.map((r) => forecasts[r.id].totalInches);
  const normSnow = normalizeField(snowValues);

  const scored = usResorts.map((resort) => {
    const fc = forecasts[resort.id];
    const snowQuality = fc.avgTempF != null ? clamp01(1 - (fc.avgTempF - 10) / 45) : 0.6;
    const terrainWorth = terrainWorthItRaw(resort);
    const crowdPenalty = CROWD_PENALTY[resort.crowd_level] ?? 0.3;

    let score =
      0.45 * normSnow(fc.totalInches) +
      0.20 * snowQuality +
      0.20 * terrainWorth -
      0.10 * crowdPenalty;

    if (!answers.includeBeginnerFriendly) {
      if (resort.scale === "day-trip") return null; // leans toward serious terrain by default
      if (terrainWorth < 0.22) score *= 0.5;
    } else if (resort.beginner_friendliness === "strong") {
      score += 0.05;
    }

    let feasibility = null;
    if (answers.region) {
      const region = regionById(answers.region);
      if (region && region.lat != null) {
        const distanceMiles = haversineMiles(region.lat, region.lon, resort.lat, resort.lon);
        feasibility = { distanceMiles };
        const tags = resort.best_for_tags || [];
        const reachable = distanceMiles != null && (distanceMiles < 700 || tags.includes("easy-flight"));
        score *= reachable ? 1 : 0.35;
      }
    }

    return {
      resort, score, snowQuality, terrainWorth, crowdPenalty,
      totalInches: fc.totalInches, avgTempF: fc.avgTempF, isLive: fc.isLive,
      feasibility,
    };
  }).filter(Boolean);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 8);
}

function rankCanadaTypicalSeason(pool) {
  pool = pool || RESORTS;
  return pool
    .filter((r) => r.country === "Canada")
    .slice()
    .sort((a, b) => (b.avg_annual_snowfall_in || 0) - (a.avg_annual_snowfall_in || 0));
}
