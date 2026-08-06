// ---------------------------------------------------------------------------
// Rants & Raves — what skiers on Reddit are complaining about and praising,
// clustered into topics, picked by hand, and dropped after 14 days.
//
// This module is pure — no DOM, no fetch, no clock of its own beyond
// rantsToday(). Everything the surface renders is derived here, which is what
// lets verify_rants.js sweep the whole thing without a browser. app-rants.js
// owns all the rendering.
//
// --- WHAT THIS SURFACE ASSERTS, AND WHAT IT DOES NOT ----------------------
// It asserts nothing about a resort. A topic label is a NOUN PHRASE from a
// closed vocabulary ("Lift wait times"), never a predicate ("Lifts are slow").
// A count is a fact about posts and comments, never a score for the mountain.
// Corroboration compares a topic to the resort's own published lift report and
// says so in both directions; it is not fact-checking, and it carries no hue.
// The quotes are verbatim — never rewritten, never truncated at runtime, never
// cleaned up. Nicole picks the topics; she does not write them, and she does
// not appear anywhere inside this surface except the one chrome link in a
// per-resort empty state.
//
// Every one of those is load-bearing, and every one of them is pinned by an
// assertion in verify_rants.js. See the decisions log (RR-5, RR-13, RR-18,
// RR-35, RR-40, RR-42) before changing any of them.
// ---------------------------------------------------------------------------

// --- THE CLOSED TAXONOMY (RR-13) -------------------------------------------
// A fixed vocabulary is the mechanical guarantee behind "topics assert
// nothing": an emergent label drifts toward assertion, because assertion is
// what the source text contains. Unmatched clusters route to Nicole as
// taxonomy PROPOSALS in an `Other` bucket that can never publish.
//
// INCOMPLETE, DELIBERATELY. RR-13 fixes taxonomy_v1 at 24 labels. Thirteen of
// them are settled and appear below; the remaining eleven live in the pipeline's
// taxonomy table and were not available to this build. They are not invented
// here — a label is content, and guessing one would put an unratified string in
// front of a user. Add them to this object when the table lands; the gate below
// already refuses anything that is not in it, so an unknown category cannot
// reach a render either way.
const RANTS_TAXONOMY_V1 = {
  "lift-wait": "Lift wait times",
  "crowds": "Crowds on the mountain",
  "lift-closures": "Lift breakdowns and closures",
  "parking": "Parking and getting there",
  "pass-rules": "Pass rules for the season",
  "snow-conditions": "Snow and surface conditions",
  "ticket-prices": "Ticket and lodging prices",
  "gear": "Gear",
  "snow-quality": "Snow quality and powder",
  "value": "Value for money",
  "short-lines": "Short lines and space to ski",
  "terrain": "Terrain and difficulty",
  "beginners": "Beginners and families",
};

// --- SCOPES ----------------------------------------------------------------
// A topic is scoped to a resort, to a pass, or to nothing at all. Pass scopes
// were a live crash in the reference build: a pass slug was a real scope_id in
// the data and absent from every name table, so an expired pass-topic share
// rendered `undefined` and then threw. There is now exactly ONE lookup for
// every scope slug the router can ever see, it returns null for anything it
// does not know, and every caller branches on null. Nothing in this feature
// may index a name table directly.
//
// The pass display names come from app.js's PASS_COPY, not from a second table
// written here. Two spellings of "Ikon" in one app is exactly the drift this
// project keeps logging rulings about; the copy deck's title-case "Ikon Pass"
// yields to the shipped string. Flagged for content-writer ratification.
const RANTS_PASS_SCOPE = {
  "ikon-pass": "Ikon",
  "epic-pass": "Epic",
  "indy-pass": "Indy",
  "mountain-collective": "Mountain Collective",
};

function rantsScopeName(scopeId) {
  if (!scopeId || scopeId === "none") return "Not resort-specific";
  const resort = RESORTS_BY_ID[scopeId];
  if (resort) {
    // The house form, identical to app.js, app-chase.js and app-quiver.js:
    // "Alta, Utah" / "Revelstoke Mountain Resort, British Columbia, Canada".
    return resort.country === "Canada"
      ? `${resort.name}, ${resort.state_province}, Canada`
      : `${resort.name}, ${resort.state_province}`;
  }
  const pass = RANTS_PASS_SCOPE[scopeId];
  if (pass) return PASS_COPY[pass] || pass;
  return null;
}

// "Alta, Utah" -> "Alta". Safe on a name with no comma, never called on null.
function rantsShortName(name) { return String(name).split(",")[0]; }

// The ONE permitted crossing from this surface into Nicole's (RR-18) has to
// land somewhere. Only 9 of the 44 rows in NICOLES_LIST carry a written take,
// so "Read Nicole's take on Alta" pointed mostly at nothing — the flag is
// derived from the takes table itself rather than duplicated into this file,
// which is the only way it cannot drift.
function rantsHasTake(resortId) {
  if (!resortId) return false;
  const row = NICOLES_LIST.filter((r) => r.resort_id === resortId)[0];
  return !!(row && row.nicoles_take);
}

// --- SAMPLE DATA -----------------------------------------------------------
// 15 live topics + 1 deliberately expired. Scopes: resort, pass, none. Cluster
// compositions: all-posts, all-comments, mixed. All three corroboration states.
//
// THE QUOTES ARE ADVERSARIAL ON PURPOSE. A first pass shipped 31 quotes with
// zero slang, profanity, typos, ALL-CAPS, emoji, raw URLs or sarcasm, every one
// a complete declarative sentence in the same register — which made the
// structural comprehension test pass trivially. This set carries, at minimum:
// profanity, an ALL-CAPS run, emoji, a raw URL, heavy slang, sarcasm whose
// literal meaning inverts, typos, one quote at 199 characters and one at 43.
// Every one still passes the approval gate: names its referent, carries a
// concrete particular, 40-200 characters, standalone syntax, opens on neither a
// pronoun nor a connective. Adversarial is not the same as ineligible.
//
// `rank_score` and `expected_mentions` are BAKED — they are pipeline outputs,
// not client computation. See rantsRankCeiling() for what the client can and
// cannot check about them.
const rq = (text, handle, type, sub, date, link) =>
  ({ text, author_handle: handle, item_type: type, subreddit: sub, posted_at: date, permalink: link, redactions: [] });

const RANTS_TOPICS = [
  { id: "alta-ut-lift-wait-2027-01-18", scope_type: "resort", scope_id: "alta-ut", polarity: "rant",
    category: "lift-wait", taxonomy_version: "taxonomy_v1",
    mention_count: 9, source_count: 9, thread_count: 4, subreddit_count: 3, expected_mentions: 6,
    window_start: "2027-01-04", window_end: "2027-01-18", composition: "mixed",
    corroboration: { state: "matches",
      text: "Matches the lift report at the time — chair 5 was listed as closed on Jan 14.",
      source_url: "https://www.alta.com/conditions/lift-report", source_label: "Lift report", source_date: "2027-01-14" },
    quotes: [
      // 43 characters — at the floor of the 40-200 band. Proves the quote block
      // does not need a paragraph to hold its shape.
      rq("Collins maze was 38 minutes at 9am Saturday.", "u/wasatch_dad", "post", "r/alta", "2027-01-11", "https://reddit.com/r/alta/comments/x2"),
      // Profanity. Renders verbatim — rewriting a quote is forbidden, and the
      // hidden "Quote from a Reddit comment:" prefix is the only thing standing
      // between a screen-reader user jumping by heading and hearing this in app
      // voice.
      rq("Chair 5 sat dead from 9 to noon and nobody said a fucking word over the PA.", "u/skibum42", "comment", "r/skiing", "2027-01-14", "https://reddit.com/r/skiing/comments/x1/c1"),
      // Typos, a missing apostrophe, an uncapitalised proper noun, "prolly".
      rq("Sugarloaf line wrapped past the ticket window twice on sunday, prolly 25 min each ride, its brutal.", "u/pow_hunter88", "comment", "r/skiing", "2027-01-07", "https://reddit.com/r/skiing/comments/x3/c2"),
    ], rank_score: 2.00, status: "approved", approved_by: "nicole", approved_at: "2027-01-18T06:10:00Z", baked_at: "2027-01-18T07:00:00Z" },

  { id: "vail-co-crowds-2027-01-17", scope_type: "resort", scope_id: "vail-co", polarity: "rant",
    category: "crowds", taxonomy_version: "taxonomy_v1",
    mention_count: 23, source_count: 21, thread_count: 6, subreddit_count: 4, expected_mentions: 22,
    window_start: "2027-01-06", window_end: "2027-01-17", composition: "comments",
    corroboration: null,
    quotes: [
      rq("Gondola One was a fucking zoo at 9:15 on a Tuesday in January, 200 people deep.", "u/frontrange_ed", "comment", "r/skiing", "2027-01-13", "https://reddit.com/r/skiing/comments/x4/c1"),
      rq("Two Elk cafeteria had no free table between 11:30 and 1:30, standing room only both days.", "u/coloradocarv", "comment", "r/COsnow", "2027-01-09", "https://reddit.com/r/COsnow/comments/x5/c2"),
    ], rank_score: 1.93, status: "approved", approved_by: "nicole", approved_at: "2027-01-17T06:12:00Z", baked_at: "2027-01-18T07:00:00Z" },

  { id: "palisades-tahoe-ca-lift-closures-2027-01-18", scope_type: "resort", scope_id: "palisades-tahoe-ca",
    polarity: "rant", category: "lift-closures", taxonomy_version: "taxonomy_v1",
    mention_count: 14, source_count: 12, thread_count: 5, subreddit_count: 3, expected_mentions: 7,
    window_start: "2027-01-11", window_end: "2027-01-18", composition: "mixed",
    corroboration: { state: "does_not_match",
      text: "Does not match the lift report at the time — all lifts were listed as open on Jan 14.",
      source_url: "https://www.palisadestahoe.com/mountain-information/lift-and-terrain-status", source_label: "Lift report", source_date: "2027-01-14" },
    quotes: [
      // A shouted run. A screen reader may spell KT-22 and NEVER letter by
      // letter, or switch voice pitch on the caps; both are correct readings of
      // what was written, and neither is a defect.
      rq("KT-22 NEVER OPENED SATURDAY. Wind hold all day and the app still showed it green until 2pm.", "u/tahoe_local_j", "post", "r/tahoe", "2027-01-14", "https://reddit.com/r/tahoe/comments/x6"),
      rq("Siberia stopped four times before 10am, longest stop was about twelve minutes hanging.", "u/granitechief", "comment", "r/skiing", "2027-01-16", "https://reddit.com/r/skiing/comments/x7/c1"),
    ], rank_score: 4.34, status: "approved", approved_by: "nicole", approved_at: "2027-01-18T06:14:00Z", baked_at: "2027-01-18T07:00:00Z" },

  { id: "jackson-hole-wy-parking-2027-01-16", scope_type: "resort", scope_id: "jackson-hole-wy",
    polarity: "rant", category: "parking", taxonomy_version: "taxonomy_v1",
    mention_count: 11, source_count: 11, thread_count: 3, subreddit_count: 2, expected_mentions: 8,
    window_start: "2027-01-08", window_end: "2027-01-16", composition: "posts",
    corroboration: null,
    quotes: [
      rq("Stilson lot was ful by 740am adn the shuttle took another 35 min to reach teton village, its a joke.", "u/tetonpass_kk", "post", "r/JacksonHole", "2027-01-12", "https://reddit.com/r/JacksonHole/comments/x8"),
      rq("Village parking reservation sold out eleven days ahead for the whole holiday week.", "u/wyo_turns", "post", "r/skiing", "2027-01-09", "https://reddit.com/r/skiing/comments/x9"),
    ], rank_score: 1.81, status: "approved", approved_by: "nicole", approved_at: "2027-01-16T06:09:00Z", baked_at: "2027-01-18T07:00:00Z" },

  { id: "ikon-pass-pass-rules-2027-01-18", scope_type: "pass", scope_id: "ikon-pass",
    polarity: "rant", category: "pass-rules", taxonomy_version: "taxonomy_v1",
    mention_count: 31, source_count: 27, thread_count: 8, subreddit_count: 5, expected_mentions: 26,
    window_start: "2027-01-05", window_end: "2027-01-18", composition: "mixed",
    corroboration: null,
    quotes: [
      // 196 characters — one under the ceiling. Over-length is REJECTED at the
      // approval gate, never trimmed; there is no truncation path in the client
      // at all, so this renders at full length and the layout absorbs it.
      rq("Ikon Base blacks out the entire week of Presidents Day at four Colorado resorts this season, up from two last year, and the reservation window for Deer Valley emptied in under nine minutes at 8am MT.", "u/passmath_", "post", "r/icecoast", "2027-01-15", "https://reddit.com/r/icecoast/comments/y1"),
      // Emoji. A screen reader announces "skull skull" mid-sentence. Nothing to
      // fix — that is what the poster wrote.
      rq("Ikon Session went up 60 dollars and lost two of the days it had last season 💀💀", "u/booking_sucks", "comment", "r/skiing", "2027-01-10", "https://reddit.com/r/skiing/comments/y2/c1"),
    ], rank_score: 2.43, status: "approved", approved_by: "nicole", approved_at: "2027-01-18T06:02:00Z", baked_at: "2027-01-18T07:00:00Z" },

  { id: "stowe-vt-snow-conditions-2027-01-14", scope_type: "resort", scope_id: "stowe-vt",
    polarity: "rant", category: "snow-conditions", taxonomy_version: "taxonomy_v1",
    mention_count: 6, source_count: 6, thread_count: 3, subreddit_count: 2, expected_mentions: 5,
    window_start: "2027-01-14", window_end: "2027-01-14", composition: "mixed",
    corroboration: { state: "not_published", text: "No lift report was published for those days.",
      source_url: null, source_label: "Lift report", source_date: null },
    quotes: [
      // Heavy slang. "bulletproof" and "death cookies" are exactly the terms a
      // glossary would have defined; the structural comprehension test replaced
      // the glossary, and this is what it is tested against.
      rq("Nosedive was bulletproof by 11 with death cookies from the groomer the whole way down skier left.", "u/vt_carver", "comment", "r/icecoast", "2027-01-14", "https://reddit.com/r/icecoast/comments/y3/c2"),
      rq("Stowe was scraped to blue ice above the Fourhundred by 11am with maybe 2 inches of new on top.", "u/greenmtn_rider", "comment", "r/icecoast", "2027-01-14", "https://reddit.com/r/icecoast/comments/y3/c1"),
    ], rank_score: 1.54, status: "approved", approved_by: "nicole", approved_at: "2027-01-14T06:20:00Z", baked_at: "2027-01-18T07:00:00Z" },

  { id: "none-gear-2027-01-15", scope_type: "none", scope_id: null, polarity: "rant",
    category: "gear", taxonomy_version: "taxonomy_v1",
    mention_count: 12, source_count: 12, thread_count: 4, subreddit_count: 3, expected_mentions: 14,
    window_start: "2027-01-07", window_end: "2027-01-15", composition: "comments",
    corroboration: null,
    quotes: [
      // A raw URL inside a quote. It renders as TEXT, never as a link — an
      // anchor here would be a stranger's outbound link wearing our chrome, and
      // the only link in this block is the one to the post it came from.
      rq("Boot heater batteries died at minus 18 after three hours, both pairs, same brand — https://imgur.com/a/8kQ2p", "u/coldtoes_mt", "comment", "r/skiing", "2027-01-11", "https://reddit.com/r/skiing/comments/y4/c1"),
      rq("Bindings came back from the shop set to DIN 5 when the card on them clearly said 9.", "u/tuner_pete", "comment", "r/skigear", "2027-01-15", "https://reddit.com/r/skigear/comments/y5/c1"),
    ], rank_score: 1.11, status: "approved", approved_by: "nicole", approved_at: "2027-01-15T06:31:00Z", baked_at: "2027-01-18T07:00:00Z" },

  { id: "mammoth-mountain-ca-ticket-prices-2027-01-13", scope_type: "resort", scope_id: "mammoth-mountain-ca",
    polarity: "rant", category: "ticket-prices", taxonomy_version: "taxonomy_v1",
    mention_count: 17, source_count: 15, thread_count: 5, subreddit_count: 3, expected_mentions: 9,
    window_start: "2027-01-05", window_end: "2027-01-13", composition: "comments",
    corroboration: null,
    quotes: [
      // Sarcasm. The literal meaning is the opposite of the intent, and no
      // markup can carry that. The polarity in the card heading's hidden suffix
      // is the only disambiguator the surface has, which is exactly why the
      // polarity is also in the detail kicker and the page title.
      rq("Great value at Mammoth: 289 dollars for a window ticket and 24 for a cheeseburger at McCoy. Bargain.", "u/eastside395", "comment", "r/skiing", "2027-01-08", "https://reddit.com/r/skiing/comments/y6/c1"),
      rq("Slopeside studio came to 640 a night midweek in January, before the resort fee.", "u/mammoth_annual", "comment", "r/Mammoth", "2027-01-12", "https://reddit.com/r/Mammoth/comments/y7/c1"),
    ], rank_score: 2.14, status: "approved", approved_by: "nicole", approved_at: "2027-01-13T06:44:00Z", baked_at: "2027-01-18T07:00:00Z" },

  { id: "alta-ut-parking-2027-01-16", scope_type: "resort", scope_id: "alta-ut", polarity: "rant",
    category: "parking", taxonomy_version: "taxonomy_v1",
    mention_count: 10, source_count: 10, thread_count: 3, subreddit_count: 2, expected_mentions: 12,
    window_start: "2027-01-09", window_end: "2027-01-16", composition: "posts",
    corroboration: null,
    quotes: [
      rq("Little Cottonwood took 2 hours and 10 minutes from the mouth of the canyon on Saturday morning.", "u/lcc_commuter", "post", "r/SaltLakeCity", "2027-01-10", "https://reddit.com/r/SaltLakeCity/comments/y8"),
      rq("Wasatch Boulevard was stopped from 6:50am and the last parking reservation slot went at 6:15.", "u/upper_bench", "post", "r/skiing", "2027-01-16", "https://reddit.com/r/skiing/comments/y9"),
    ], rank_score: 1.12, status: "approved", approved_by: "nicole", approved_at: "2027-01-16T06:55:00Z", baked_at: "2027-01-18T07:00:00Z" },

  // --- THE WHOLE POINT OF THE DEFAULT SORT ---------------------------------
  // Bridger Bowl, 6 mentions, outranks the Ikon Pass topic at 31 and Vail at 23
  // and takes the top slot on Rants. "Unusual first" is not "loudest first",
  // and until this fixture existed the sample data never demonstrated it —
  // every topic was a major destination and the top slot went to the highest
  // count in the set, which is the exact thing the sort claims not to do.
  // Its baseline lift is at the clamp because expected_mentions for this scope
  // x category is 1; the log on volume flattens the small-count end so three
  // posts still could not top the feed.
  { id: "bridger-bowl-mt-lift-closures-2027-01-18", scope_type: "resort", scope_id: "bridger-bowl-mt",
    polarity: "rant", category: "lift-closures", taxonomy_version: "taxonomy_v1",
    mention_count: 6, source_count: 6, thread_count: 3, subreddit_count: 2, expected_mentions: 1,
    window_start: "2027-01-17", window_end: "2027-01-18", composition: "mixed",
    corroboration: { state: "not_published", text: "No lift report was published for those days.",
      source_url: null, source_label: "Lift report", source_date: null },
    quotes: [
      rq("Bridger chair died at 9:40 with everyone getting sendy off the ridge, gearbox, closed the rest of the day.", "u/gallatin_local", "post", "r/bozeman", "2027-01-18", "https://reddit.com/r/bozeman/comments/b1"),
      rq("Powder Park stayed roped all Sunday and patrol said there was no ETA on the lift at all.", "u/cold_smoke_mt", "comment", "r/skiing", "2027-01-17", "https://reddit.com/r/skiing/comments/b2/c1"),
    ], rank_score: 6.28, status: "approved", approved_by: "nicole", approved_at: "2027-01-18T06:01:00Z", baked_at: "2027-01-18T07:00:00Z" },

  // --- RAVES ---------------------------------------------------------------
  { id: "revelstoke-bc-snow-quality-2027-01-18", scope_type: "resort", scope_id: "revelstoke-bc", polarity: "rave",
    category: "snow-quality", taxonomy_version: "taxonomy_v1",
    mention_count: 19, source_count: 17, thread_count: 6, subreddit_count: 4, expected_mentions: 11,
    window_start: "2027-01-09", window_end: "2027-01-18", composition: "mixed",
    corroboration: null,
    quotes: [
      rq("Revelstoke got 40 centimetres overnight 🤯 and the North Bowl was still untracked at 2pm.", "u/kootenay_kate", "post", "r/skiing", "2027-01-17", "https://reddit.com/r/skiing/comments/z1"),
      rq("Snow on Ripper stayed light all day with no wind crust anywhere above 1800 metres.", "u/bc_deepdays", "comment", "r/britishcolumbia", "2027-01-16", "https://reddit.com/r/britishcolumbia/comments/z2/c1"),
      rq("Three laps off the Stoke before the first tracks crossed each other, about 1500 metres each.", "u/vertical_junkie", "comment", "r/skiing", "2027-01-13", "https://reddit.com/r/skiing/comments/z3/c1"),
    ], rank_score: 3.85, status: "approved", approved_by: "nicole", approved_at: "2027-01-18T06:05:00Z", baked_at: "2027-01-18T07:00:00Z" },

  { id: "whitefish-mt-value-2027-01-17", scope_type: "resort", scope_id: "whitefish-mt", polarity: "rave",
    category: "value", taxonomy_version: "taxonomy_v1",
    mention_count: 13, source_count: 12, thread_count: 4, subreddit_count: 3, expected_mentions: 5,
    window_start: "2027-01-07", window_end: "2027-01-17", composition: "mixed",
    corroboration: null,
    quotes: [
      rq("NINETY SIX DOLLARS walk-up at Whitefish and parking cost nothing at all, still cannot believe it.", "u/flathead_fran", "post", "r/Montana", "2027-01-15", "https://reddit.com/r/Montana/comments/z6"),
      rq("Two beers and a burger in the Base Lodge came to 31 dollars total including tip.", "u/bigmtn_regular", "comment", "r/skiing", "2027-01-11", "https://reddit.com/r/skiing/comments/z7/c1"),
    ], rank_score: 4.12, status: "approved", approved_by: "nicole", approved_at: "2027-01-17T06:27:00Z", baked_at: "2027-01-18T07:00:00Z" },

  { id: "alta-ut-short-lines-2027-01-15", scope_type: "resort", scope_id: "alta-ut", polarity: "rave",
    category: "short-lines", taxonomy_version: "taxonomy_v1",
    mention_count: 12, source_count: 11, thread_count: 4, subreddit_count: 3, expected_mentions: 9,
    window_start: "2027-01-06", window_end: "2027-01-15", composition: "comments",
    corroboration: null,
    quotes: [
      rq("Collins was ski-on all Wednesday morning and the longest wait was maybe four chairs.", "u/midweek_mike", "comment", "r/alta", "2027-01-14", "https://reddit.com/r/alta/comments/z4/c1"),
      rq("Ballroom had about six sets of tracks in it at 1pm on a day with 14 inches reported.", "u/skinnyskis", "comment", "r/skiing", "2027-01-08", "https://reddit.com/r/skiing/comments/z5/c1"),
    ], rank_score: 1.63, status: "approved", approved_by: "nicole", approved_at: "2027-01-15T06:18:00Z", baked_at: "2027-01-18T07:00:00Z" },

  { id: "taos-nm-terrain-2027-01-16", scope_type: "resort", scope_id: "taos-nm", polarity: "rave",
    category: "terrain", taxonomy_version: "taxonomy_v1",
    mention_count: 10, source_count: 10, thread_count: 3, subreddit_count: 2, expected_mentions: 6,
    window_start: "2027-01-08", window_end: "2027-01-16", composition: "posts",
    corroboration: null,
    quotes: [
      rq("Kachina Peak hike took 45 minutes from the lift and dropped into 1400 feet of untouched steeps.", "u/highdesert_ski", "post", "r/skiing", "2027-01-14", "https://reddit.com/r/skiing/comments/z8"),
      rq("West Basin ridge has about twenty separate chutes and no two of them ski the same.", "u/nm_turns", "post", "r/NewMexico", "2027-01-10", "https://reddit.com/r/NewMexico/comments/z9"),
    ], rank_score: 2.12, status: "approved", approved_by: "nicole", approved_at: "2027-01-16T06:33:00Z", baked_at: "2027-01-18T07:00:00Z" },

  { id: "mont-tremblant-qc-beginners-2027-01-14", scope_type: "resort", scope_id: "mont-tremblant-qc",
    polarity: "rave", category: "beginners", taxonomy_version: "taxonomy_v1",
    mention_count: 11, source_count: 11, thread_count: 3, subreddit_count: 2, expected_mentions: 7,
    window_start: "2027-01-05", window_end: "2027-01-14", composition: "comments",
    corroboration: null,
    quotes: [
      rq("Ski school took our four-year-old for three hours and she came back doing linked turns.", "u/laurentides_mom", "comment", "r/skiing", "2027-01-12", "https://reddit.com/r/skiing/comments/w1/c1"),
      rq("Nansen is a two mile green from the summit, wide enough that beginners never felt crowded.", "u/qc_famille", "comment", "r/Quebec", "2027-01-06", "https://reddit.com/r/Quebec/comments/w2/c1"),
    ], rank_score: 1.49, status: "approved", approved_by: "nicole", approved_at: "2027-01-14T06:41:00Z", baked_at: "2027-01-18T07:00:00Z" },

  // --- DELIBERATELY EXPIRED ------------------------------------------------
  // window_end is 2026-12-20. This is what a link posted into a group chat
  // becomes, and it drives the expired-share state — the single most important
  // state in the feature. TWO quotes, not one: the publish gate is >=2 eligible
  // quotes, so a one-quote version could never have published and therefore
  // could never have been shared, which is the entire scenario it exists to
  // produce.
  { id: "alta-ut-lift-wait-2026-12-20", scope_type: "resort", scope_id: "alta-ut", polarity: "rant",
    category: "lift-wait", taxonomy_version: "taxonomy_v1",
    mention_count: 11, source_count: 11, thread_count: 4, subreddit_count: 3, expected_mentions: 6,
    window_start: "2026-12-06", window_end: "2026-12-20", composition: "mixed",
    corroboration: null,
    quotes: [
      rq("Wildcat line ran 30 minutes deep every morning of the holiday week without exception.", "u/holiday_hater", "post", "r/alta", "2026-12-20", "https://reddit.com/r/alta/comments/v1"),
      rq("Collins maze hit 45 minutes on December 18 and the singles line was closed off entirely.", "u/lcc_commuter", "comment", "r/skiing", "2026-12-18", "https://reddit.com/r/skiing/comments/v2/c1"),
    ], rank_score: 2.60, status: "approved", approved_by: "nicole", approved_at: "2026-12-20T06:00:00Z", baked_at: "2026-12-20T07:00:00Z" },
];

// --- THE EXPIRY CLOCK ------------------------------------------------------
// 14 days, and it is absolute. It runs against each topic's own window_end (its
// newest item) and against each quote's own posted_at — NEVER against baked_at.
// A build that fails on day 15 must produce an EMPTY page, not a stale one:
// every string on this surface depends on that being true, and the frame prints
// the rule where the user can check it against the dates on the cards.
const RANTS_MAX_AGE_DAYS = 14;

// appNow(), never `new Date()` — the same clock every other season-aware code
// path in this app reads. demo.js freezes it to a mid-season date whenever the
// real calendar says nothing is open, which is the only way a 14-day feed is
// reviewable in August; with demo mode off it IS `new Date()`. The sample
// corpus below is stamped to sit inside the demo clock's window, so both the
// live feed and the expired-link state are reachable out of season.
//
// The consequence is deliberate and worth stating: move the demo date more than
// 14 days past this corpus and the surface goes empty. That is not a bug to
// work around — it is the 14-day ceiling doing exactly what the frame promises,
// visible in a review build.
function rantsToday() {
  return typeof appNow === "function" ? appNow() : new Date();
}
function rantsParseISO(d) { return new Date(d + "T12:00:00Z"); }
function rantsAgeInDays(iso) {
  return Math.floor((rantsToday() - rantsParseISO(iso)) / 86400000);
}

// THE CEILING RUNS ON QUOTES TOO, NOT JUST ON TOPICS. window_end is the topic's
// NEWEST item, so a topic can sit comfortably inside 14 days while individual
// quotes inside it have aged past — and a quote stamped "· Jan 10" rendering
// directly below a frame that says "Anything older than 14 days drops off" is a
// visible self-contradiction of the page's own provenance statement. That is
// the worst defect this feature can carry, because the frame IS the product and
// the date is printed right there on the attribution line for anyone to check.
// Both gates run.
function rantsLiveQuotes(t) {
  return t.quotes.filter((qt) => rantsAgeInDays(qt.posted_at) <= RANTS_MAX_AGE_DAYS);
}

// The publish gate re-runs against the SURVIVORS. A topic that drops below two
// live quotes stops publishing — it does not publish with one. The gate was
// never "had 2 at bake time", it is "shows 2 now", for the same reason the
// expiry clock runs client-side: a build is a snapshot and the rule is not. A
// topic can therefore expire BETWEEN builds by quote attrition rather than by
// window_end, and the pipeline cannot be assumed to have caught it.
function rantsIsLive(t) {
  return rantsAgeInDays(t.window_end) <= RANTS_MAX_AGE_DAYS && rantsLiveQuotes(t).length >= 2;
}

// An unknown category can never render. This is the taxonomy gate from RR-13
// made mechanical rather than editorial: whatever the pipeline sends, the
// client publishes only what is in taxonomy_v1, so a proposal in the `Other`
// bucket cannot leak onto the surface by accident.
function rantsLabelOf(t) { return RANTS_TAXONOMY_V1[t.category] || null; }

function rantsLiveTopics() {
  return RANTS_TOPICS.filter((t) => t.status === "approved" && rantsLabelOf(t) && rantsIsLive(t));
}

// --- RANKING ---------------------------------------------------------------
// S = V x R x B x D. Volume ln(1+n); recency half-life 5 days; baseline lift
// clamped 0.5-3.0 against a trailing 28-day median; source spread 1.0/1.15/1.25.
//
// THE CLIENT DOES NOT COMPUTE THIS, AND DELIBERATELY SO. R is a mean over the
// individual mention timestamps relative to bake time, and those timestamps are
// not in the client payload — only the window bounds are. `rank_score` is a
// pipeline output, baked alongside `expected_mentions` so it stays auditable.
//
// What the client CAN check is the ceiling, and that is the check that matters:
// a first pass shipped values from 18.9 to 52.6 against a formula whose ceiling
// for the largest cluster here (n=31) is 13.00, so fourteen of fifteen were
// mathematically impossible and the feed order could not be checked against the
// model it claims to implement. rantsRankCeiling() is what caught that, and
// verify_rants.js runs it over every topic.
const RANTS_R_MAX = 1.0, RANTS_B_MAX = 3.0, RANTS_D_MAX = 1.25;
function rantsRankCeiling(t) {
  return Math.log(1 + t.mention_count) * RANTS_R_MAX * RANTS_B_MAX * RANTS_D_MAX;
}

// --- COPY ------------------------------------------------------------------
const RANTS_MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const RANTS_MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

// A count is a fact about ITEMS, never about the resort — so the unit word says
// what was counted, and there is no bare numeral anywhere on this surface.
function rantsUnitWord(composition, n) {
  const one = n === 1;
  if (composition === "posts") return one ? "post" : "posts";
  if (composition === "comments") return one ? "comment" : "comments";
  return one ? "post" : "posts and comments"; // a mixed cluster of 1 cannot occur
}

// US date order. Same month uses a TIGHT en dash (Jan 4–18); cross month uses a
// SPACED en dash (Jan 28 – Feb 4). Months abbreviated visually and spelled in
// full for screen readers. Nothing here truncates, ever.
function rantsWindowVisual(start, end) {
  const s = rantsParseISO(start), e = rantsParseISO(end);
  const sm = s.getUTCMonth(), em = e.getUTCMonth();
  const sd = s.getUTCDate(), ed = e.getUTCDate();
  if (sm === em && sd === ed) return RANTS_MONTHS_SHORT[sm] + " " + sd;
  if (sm === em) return RANTS_MONTHS_SHORT[sm] + " " + sd + "–" + ed;
  return RANTS_MONTHS_SHORT[sm] + " " + sd + " – " + RANTS_MONTHS_SHORT[em] + " " + ed;
}
function rantsShortDate(iso) {
  const d = rantsParseISO(iso);
  return RANTS_MONTHS_SHORT[d.getUTCMonth()] + " " + d.getUTCDate();
}
function rantsFullDate(iso) {
  const d = rantsParseISO(iso);
  return RANTS_MONTHS_FULL[d.getUTCMonth()] + " " + d.getUTCDate();
}
function rantsWindowA11y(start, end, n) {
  const s = rantsParseISO(start), e = rantsParseISO(end);
  const sm = s.getUTCMonth(), em = e.getUTCMonth();
  const sd = s.getUTCDate(), ed = e.getUTCDate();
  const sameDay = sm === em && sd === ed;
  if (sameDay && n === 1) return "on " + RANTS_MONTHS_FULL[sm] + " " + sd;
  if (sameDay) return "all on " + RANTS_MONTHS_FULL[sm] + " " + sd;
  return "from " + RANTS_MONTHS_FULL[sm] + " " + sd + " to " + RANTS_MONTHS_FULL[em] + " " + ed;
}
function rantsMetaA11y(t) {
  return t.mention_count + " " + rantsUnitWord(t.composition, t.mention_count) + ", " +
    rantsWindowA11y(t.window_start, t.window_end, t.mention_count);
}

// MANDATORY on every card. This line is the card's only crop defence: any crop
// tight enough to lose the word "Reddit" also loses the count above it.
function rantsThreadsVisual(n) {
  return n === 1 ? "All from one Reddit thread." : "From " + n + " separate Reddit threads.";
}
function rantsThreadsA11y(n) {
  return n === 1
    ? "These posts and comments all came from one Reddit thread."
    : "These posts and comments came from " + n + " separate Reddit threads.";
}
// Never a bare number beside a resort name — a bare figure there is a score.
function rantsCountPhrase(n) { return n === 1 ? "1 topic" : n + " topics"; }

// The scope line on a card. Falls back to the scope slug rather than to
// undefined: a slug on screen is ugly and diagnosable; `undefined` on screen is
// a bug wearing a word, and `undefined` in a name table crashed this surface.
function rantsScopeLabel(t) { return rantsScopeName(t.scope_id) || String(t.scope_id); }

// Titles are NOT the scope line with the label glued on. The cross-scope branch
// is explicit — "Gear (not resort-specific)", never "Gear at Not
// resort-specific" — and under the taxonomy's cross-scope categories that is
// the state the surface spends a lot of its life in.
function rantsTitleTail(t) {
  return t.scope_type === "none" ? " (not resort-specific)" : " at " + rantsScopeLabel(t);
}
function rantsTitle(t) { return rantsLabelOf(t) + rantsTitleTail(t); }

// POLARITY IS NEVER WITHHELD AT THE POINT OF READING. Sorting a topic into
// Rants or Raves is the only valence claim this feature makes, and the feed
// carries it in the tab, the list bar and the end-of-list line — all three of
// which sit ABOVE the cards. So the default sort can put a sarcastic card well
// past every one of them, and a reader meets "Great value at Mammoth… Bargain."
// under a neutral "Ticket and lodging prices" label and learns the opposite of
// the truth. A screen-reader user navigating by heading has it worse: the list
// bar is never on that route.
//
// Four strings and one word. No badge, no hue, no colour-coding.
function rantsPolarityWord(t) { return t.polarity === "rave" ? "rave" : "rant"; }
function rantsPolarityKicker(t) { return t.polarity === "rave" ? "Rave" : "Rant"; }
function rantsPolarityTab(t) { return t.polarity === "rave" ? "Raves" : "Rants"; }
// Spoken form: the polarity goes in the MIDDLE, so a heading reads "Lift wait
// times — rant at Alta, Utah". Interleaved rather than duplicated, so nothing
// is announced twice.
function rantsTitleTailA11y(t) { return " — " + rantsPolarityWord(t) + rantsTitleTail(t); }

// --- CORROBORATION ---------------------------------------------------------
// Three states, and the indicator is derived from the `state` enum rather than
// sniffed out of the pipeline's prose. That matters for `not_published`: "No
// lift report was published for those days" contains the string "Not published"
// nowhere, so deriving the label from the sentence left that glyph with no text
// label at all — and glyph AND text is a must-honour on this surface, because
// the glyphs are hueless by design and shape can never be the sole carrier.
const RANTS_CORROB_INDICATOR = {
  matches: "Matches",
  does_not_match: "Does not match",
  not_published: "Not published",
};
// The second sentence is mandatory. Without it, corroboration reads as
// fact-checking and the whole frame collapses.
const RANTS_CORROB_NOTE =
  "We compared this topic to the resort's own published lift report. " +
  "We did not check the posts and comments themselves.";

// --- THE STANDING FRAME ----------------------------------------------------
// The surface declares its provenance on EVERY view — feed, detail, and all
// four empty states. A detail page reached from a shared link has no feed above
// it to carry the provenance, and the expired-link state is the one a
// cold-landed link is most likely to reach.
//
// "Not a rating" is the fifth row and it is also in the short form. It used to
// live only where a resort had NOTHING, so every populated state was missing
// it: a newcomer opened Rants, saw a resort name beside a topic and a count of
// 23, and read a verdict. "Fact-checked by no one" answers *is it true*, which
// is a different question from *is this a score*.
const RANTS_FRAME_ROWS = [
  ["Written by", "Skiers on Reddit, in their own words."],
  ["Picked by", "Nicole, by hand, before it goes live."],
  ["Fact-checked by", "No one. Nobody checked if any of it is true."],
  ["Not a rating", "Counts are about posts and comments, not about the resort."],
  ["Age limit", "14 days. Anything older drops off and doesn't come back."],
];
// The short form is the floor. It is never shortened, never truncated, never
// made a tooltip; it wraps.
const RANTS_FRAME_SHORT =
  "Written by skiers on Reddit. Picked by Nicole. Fact-checked by no one. " +
  "Not a rating. Nothing older than 14 days.";

// --- THE FLOOR -------------------------------------------------------------
// SHIPS AS A RULE, WITH NO FIGURE. A published floor figure is calibrated
// inference rather than evidence, it is expensive to move once published, it
// reads as goalpost-shifting on a personally-branded site — and the previous
// numeric version ("at least 10 different people, across at least 3 separate
// conversations") was flatly contradicted by this file's own sample data, where
// the Bridger Bowl topic publishes on 6 accounts across 2 subreddits. That
// contradiction would have shipped to a user.
//
// NO NUMERALS IN THIS SENTENCE except the 14-day ceiling, which is a published
// rule the whole feature rests on. The figure lands at v1.1 after 30 days of
// measurement; when it does, it is one string, changed here.
const RANTS_FLOOR_RULE =
  "A topic needs several different people, posting in separate conversations. " +
  "Anything older than 14 days drops off.";

// --- SORT AND FILTER -------------------------------------------------------
// "Unusual first" is the default and it is the point of the feature: raw count
// puts the biggest resort on top every day forever, which carries no
// information at all.
function rantsSortedTopics(tab, scopeId, sort) {
  const polarity = tab === "raves" ? "rave" : "rant";
  let list = rantsLiveTopics().filter((t) => t.polarity === polarity);
  if (scopeId) list = list.filter((t) => t.scope_id === scopeId);
  return list.slice().sort((a, b) =>
    sort === "newest"
      ? rantsParseISO(b.window_end) - rantsParseISO(a.window_end)
      : b.rank_score - a.rank_score);
}

// SCOPED TO A TAB, and it must be. The unscoped version counted every live
// topic for a resort across both polarities, so the filter sheet offered
// "Alta — 3 topics", the user picked it, and landed in Rants holding 2. A count
// printed next to a name is a promise about the thing one tap away; if it does
// not survive the tap it is not a count, it is a number. Pass tab=null only
// where the phrase itself says "across both".
function rantsTopicCountFor(scopeId, tab) {
  const polarity = tab === "raves" ? "rave" : "rant";
  return rantsLiveTopics().filter((t) =>
    t.scope_id === scopeId && (!tab || t.polarity === polarity)).length;
}

// --- SHARE COMPOSITION -----------------------------------------------------
// The provenance travels with the link. A shared card is this surface speaking
// with every frame stripped off, so the footer is the only thing that answers
// "who is saying this?" for someone who meets it cold in a group chat — and it
// is the last thing that may ever be cut.
//
// NO QUOTE IN THE SHARE TEXT. A verbatim quote outside the surface has no
// attribution container to sit in.
const RANTS_SHARE_FOOTER = "Reddit posts and comments, picked by Nicole. Not fact-checked.";

function rantsShareText(t) {
  return rantsPolarityTab(t) + " — " + rantsTitle(t) + ". " + RANTS_SHARE_FOOTER;
}
function rantsShareHash(t) {
  const tab = t.polarity === "rave" ? "raves" : "rants";
  return "#rants=" + tab + "/" + (t.scope_id || "none") + "/" + rantsTopicSuffix(t);
}
// The detail route carries {category}-{window_end}; the scope is already the
// previous segment, so it is not repeated inside the suffix.
function rantsTopicSuffix(t) { return t.id.replace((t.scope_id || "none") + "-", ""); }
function rantsTopicById(scopeId, suffix) {
  const wanted = (scopeId || "none") + "-" + suffix;
  return RANTS_TOPICS.filter((t) => t.id === wanted)[0] || null;
}
