// ---------------------------------------------------------------------------
// Resort badge system — replaces the old procedural landscape illustration
// generator (design-critic + Director rejected it: soft layered mountain/sun
// scenes, one composition varying only by silhouette, several rendering
// green — "summer, not snow" — and "nothing said place"). See
// design/badge-system.md for the full spec and design/badge-preview.html for
// the working reference this file is ported from.
//
// Architecture (verbatim from the reference preview — frame, palette
// rotation, hand-tuned/rule-driven/fallback tiers, adjacency palette dedupe):
// a fixed-viewBox circular badge (white keyline → flat-colour disc → one
// hand-illustrated character, occasionally + one small accent prop → curved
// resort-name/region type) assigned per resort.id by (1) an explicit
// 41-resort hand-tuned table for resorts whose real character lives in
// free-text fields a tag engine can't parse, then (2) a priority-ordered
// tag/region rule engine for everything else, with (3) a deterministic
// fallback character for resorts with no strong signal.
//
// What's NEW in this build (full 71-resort rollout, badge-system.md §9's
// "open item for design-builder"): the preview's 44-resort set left the
// region→single-motif rules (Midwest→Moose, Southwest→Roadrunner) honestly
// unexercised — every Midwest resort in the preview was hand-tuned instead,
// specifically to sidestep the bug those rules would otherwise cause at
// full scale (badge-system.md §4.2, §0.1). The full 71-resort dataset DOES
// exercise them (12 real Midwest resorts, not 9), so this file implements
// §4.2's option (b): a deterministic per-category motif pool plus a
// region-CLUSTER dedupe pass (structurally identical to the existing
// adjacency-based palette dedupe below, just keyed by region cluster instead
// of render position) that bumps any primary-motif collision within one of
// the six cross-shoppable region clusters to the next available motif —
// first from a curated same-flavour pool, then (if that pool is exhausted)
// from the full 42-character library in a fixed order, walked from a
// deterministic hash offset. Never randomness, never resolved at render
// time — the whole assignment is computed once, here, from the static
// RESORTS dataset, so it's identical on every load and every shared link.
//
// Two documented traps (badge-system.md §0.1, §1) this port preserves
// exactly as authored — do not "clean up" a motif's SVG without
// re-screenshotting at real badge scale first:
//   1. Vanishing detail: a small brightly-coloured shape sitting directly on
//      an ink-filled base needs stroke="none" or it gets eaten by the
//      inherited 4.5px ink outline.
//   2. Rotate-transform trap: rotating a sub-shape without rotating its
//      parent (or with a mismatched pivot) turns a character into a blob.
//      Every rotation in this library is applied to a whole composed layer
//      via the `box` parameter, never to an independent internal sub-shape.
// ---------------------------------------------------------------------------

// Small stable string hash (djb2) — also used by engine.js's session-seeded
// tie-break random (matchTrip's mulberry32 seed) and noaa.js-adjacent code;
// this is the shared deterministic-hash utility for the whole app, formerly
// defined in the illustration generator this file replaces.
function hashStr(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// mulberry32 seeded PRNG — deterministic given a seed. Used by engine.js for
// session-local tie-break randomness; not used by the badge system itself
// (badge assignment has no randomness anywhere in its pipeline — table
// lookup, rule matching, and deterministic hash-offset pool walks only).
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ============================================================
   TOKENS — badge fill tier (see badge-system.md §7 "Token evolution").
   Kept as JS hex constants (not CSS var() references) even though the
   equivalent custom properties are also added to styles.css for the
   project's token-documentation trail — an inline SVG string embedded via
   innerHTML must render identically regardless of stylesheet load timing or
   cascade, and the determinism requirement (byte-identical badge across two
   independent browser contexts) is safest guaranteed by literal values, not
   an indirection through CSS custom-property resolution. Matches the
   existing illustrations.js precedent (ILLUSTRATION_PALETTES was hex, not
   var()) rather than inventing a new pattern.
   ============================================================ */
const INK = '#17102B';
const WHITE = '#FFFFFF';

const PALETTES = {
  indigo:  { bg:'#5B3DF0', meaning:'big-vert / dramatic scale' },
  coral:   { bg:'#FF4C34', meaning:'après / party / high energy' },
  teal:    { bg:'#00B39A', meaning:'deep powder / cold / expert' },
  mint:    { bg:'#16A974', meaning:'tree-skiing / family / quiet' },
  amber:   { bg:'#F0982A', meaning:'Western / budget / rustic / day-trip' },
  cold:    { bg:'#1AA3DC', meaning:'backcountry / remote / alpine' },
};
const PALETTE_ORDER = ['indigo','coral','teal','mint','amber','cold'];

/* ============================================================
   CHARACTER LOCAL PALETTE — fixed per-motif colours, independent of badge bg
   ============================================================ */
const C = {
  ink: INK, white: WHITE,
  sand300:'#F0C89A', sand500:'#E0A868', sand800:'#7A4E28',
  stone300:'#E7E4DE', stone600:'#8D897F',
  coral500:'#FF5A3C', coral600:'#E72400',
  gold:'#FFC22B',
  mint600:'#0F8E63', mint200:'#C9F5DE',
  cold600:'#0F86B6', cold300:'#AEE0F2',
  trailgreen:'#1C8F5A',
  denim:'#2E5C8A',
  brown700:'#6B4423',
};

function outline(w){ return `stroke="${INK}" stroke-width="${w||4.5}" stroke-linejoin="round" stroke-linecap="round"`; }

/* ============================================================
   MOTIF LIBRARY — 52 reusable symbols (42 characters + 10 accents/
   objects, one fallback), 100x100 viewBox. Every shape: flat fill +
   heavy consistent ink outline. No gradients, no shading, no
   photoreal rendering. Every character motif carries a GESTURE and a
   VIEWPOINT (three-quarter or profile, asymmetric pose, off-centre
   gaze) — the core fix of this pass. See badge-system.md §1 for the
   "vanishing detail" trap and §2 for the full authoring rationale.
   ============================================================ */const MOTIFS = {

// ---- Cowboy Skier (Jackson Hole) — tips his hat, leaning into a turn ----
cowboy: `<g ${outline()} fill="none">
  <path d="M14,97 L16,74 Q17,60 30,57 L70,55 Q85,58 86,74 L88,97 Z" fill="${C.denim}"/>
  <rect x="38" y="47" width="20" height="16" rx="7" fill="${C.sand500}" transform="rotate(-6 48 55)"/>
  <path d="M30,56 L48,47 L67,54 L58,68 L41,68 Z" fill="${C.coral500}" transform="rotate(-4 48 58)"/>
  <circle cx="47" cy="40" r="20" fill="${C.sand500}"/>
  <path d="M27,19 Q28,3 48,2 Q68,3 69,20 Q59,12 47,12 Q37,12 27,19 Z" fill="${C.sand800}" transform="rotate(-5 48 12)"/>
  <ellipse cx="47" cy="19" rx="34" ry="6.5" fill="${C.sand800}" transform="rotate(-5 47 19)"/>
  <rect x="28" y="16" width="38" height="4.5" fill="${C.coral600}" transform="rotate(-5 47 18)"/>
  <path d="M35,32 q4,3 8,0" stroke-width="3.5" fill="none"/>
  <path d="M53,29 q6,-4 10,-1" stroke-width="3.5" fill="none"/>
  <circle cx="39" cy="39" r="3.4" fill="${INK}" stroke="none"/>
  <circle cx="58" cy="37" r="2.6" fill="${INK}" stroke="none"/>
  <circle cx="37.6" cy="37.5" r="1.2" fill="${C.white}" stroke="none"/>
  <path d="M44,46 L48,49 L52,45" stroke-width="3" fill="none"/>
  <path d="M36,50 Q48,58 60,49 Q48,55 36,50 Z" fill="${C.sand800}" stroke-width="3"/>
  <path d="M39,57 Q48,62 57,57" stroke-width="3" fill="none"/>
  <path d="M72,58 Q90,52 89,30" fill="none" stroke="${C.denim}" stroke-width="12"/>
  <path d="M72,58 Q90,52 89,30" fill="none" stroke-width="4"/>
  <path d="M83,26 Q89,20 96,26 Q94,32 88,32 Q84,30 83,26 Z" fill="${C.sand500}"/>
  <path d="M85,20 L86,10 M92,21 L95,12" stroke-width="4"/>
</g>`,

// ---- Bro / backwards cap (Breckenridge, Whistler, Stratton) — REDRAWN:
//      fixed "bandit mask" (separate lenses w/ visible bridge + skin gap,
//      not a solid band), 3/4 lean, raised fist ----
bro: `<g ${outline()} fill="none">
  <path d="M16,97 L16,78 Q16,64 30,62 L66,60 Q82,62 84,78 L84,97 Z" fill="${C.trailgreen}"/>
  <ellipse cx="47" cy="42" rx="23" ry="22" fill="${C.sand300}"/>
  <path d="M24,30 Q20,8 48,6 Q76,8 72,30 Q70,20 47,17 Q24,20 24,30 Z" fill="${C.coral500}"/>
  <rect x="38" y="22" width="18" height="10" rx="3" fill="${C.coral600}"/>
  <circle cx="47" cy="7" r="4.5" fill="${C.coral600}"/>
  <path d="M30,37 Q30,32 38,32 L38,42 Q38,47 33,47 Q28,47 28,42 Z" fill="${INK}"/>
  <path d="M56,35 Q56,30 64,30 L64,40 Q64,45 59,45 Q54,45 54,40 Z" fill="${INK}"/>
  <path d="M38,36 L54,33" stroke-width="3"/>
  <path d="M33,60 Q47,72 61,58 Q61,65 47,68 Q33,65 33,60 Z" fill="${INK}" stroke-width="3"/>
  <path d="M37,60 h18 v3.5 h-18 z" fill="${C.white}" stroke="none"/>
  <path d="M70,54 Q86,36 82,14" fill="none" stroke="${C.trailgreen}" stroke-width="12"/>
  <path d="M70,54 Q86,36 82,14" fill="none" stroke-width="4"/>
  <path d="M74,16 L82,4 L92,10 L84,22 Z" fill="${C.sand300}"/>
  <path d="M78,10 L86,8 M76,14 L84,12" stroke-width="2.5"/>
</g>`,

// ---- Selfie Skier (Park City) — the "ninja mask" replacement for Bro's
//      Rockies neighbour: sunglasses (open lenses), phone held up ----
selfieskier: `<g ${outline()} fill="none">
  <path d="M18,97 L18,76 Q18,62 32,60 L68,60 Q82,62 82,97 Z" fill="${C.cold600}"/>
  <ellipse cx="46" cy="40" rx="23" ry="22" fill="${C.sand300}"/>
  <path d="M24,28 Q24,8 46,7 Q68,8 68,28 Q60,18 46,16 Q32,18 24,28 Z" fill="${C.sand800}"/>
  <path d="M23,37 Q23,32 31,32 L31,42 Q31,47 26,47 Q21,47 21,42 Z" fill="${INK}"/>
  <path d="M55,34 Q55,29 63,29 L63,39 Q63,44 58,44 Q53,44 53,39 Z" fill="${INK}"/>
  <path d="M31,38 L53,35" stroke-width="2.6"/>
  <path d="M38,55 Q46,60 56,52" stroke-width="3.2" fill="none"/>
  <path d="M62,52 L90,29" stroke-width="9"/>
  <rect x="80" y="10" width="19" height="27" rx="3" fill="${C.white}" transform="rotate(20 90 24)"/>
  <rect x="83" y="14" width="13" height="17" rx="1.5" fill="${C.cold300}" transform="rotate(20 90 24)"/>
</g>`,

// ---- Snorkel Powder Hound (Alta, Mount Bohemia) ----
snorkel: `<g ${outline()} fill="none">
  <path d="M18,97 L18,80 Q18,66 32,64 L68,64 Q82,66 82,97 Z" fill="${C.cold600}"/>
  <path d="M28,30 Q28,8 50,8 Q72,8 72,30 L72,46 Q72,60 50,60 Q28,60 28,46 Z" fill="${C.sand500}"/>
  <path d="M56,14 Q66,6 76,10 Q86,16 82,28 L74,26 Q78,18 72,16 Q64,14 58,20 Z" fill="${C.mint600}"/>
  <circle cx="76" cy="10" r="6" fill="${C.mint600}"/>
  <rect x="26" y="34" width="48" height="20" rx="10" fill="${INK}"/>
  <circle cx="38" cy="44" r="8.5" fill="${C.cold300}"/>
  <circle cx="62" cy="44" r="7" fill="${C.cold300}"/>
  <circle cx="36.5" cy="43" r="3.6" fill="${INK}" stroke="none"/>
  <circle cx="62" cy="44" r="2.8" fill="${INK}" stroke="none"/>
  <circle cx="34.8" cy="41" r="1.3" fill="${C.white}" stroke="none"/>
  <ellipse cx="48" cy="56" rx="7" ry="5" fill="${C.coral600}"/>
</g>`,

// ---- Yeti (Big Sky) — striding, skis over shoulder, one hand waving ----
yeti: `<g ${outline()} fill="none">
  <path d="M20,98 Q14,58 28,38 Q22,26 32,16 Q40,8 50,8 Q60,8 68,16 Q78,26 72,38 Q86,58 80,98 Z" fill="${C.stone300}"/>
  <circle cx="32" cy="21" r="6" fill="${C.stone300}"/>
  <circle cx="66" cy="19" r="6" fill="${C.stone300}"/>
  <ellipse cx="38" cy="46" rx="7.5" ry="8.5" fill="${C.white}"/>
  <ellipse cx="61" cy="45" rx="6.5" ry="7.5" fill="${C.white}"/>
  <path d="M31,40 Q38,34 45,40" stroke-width="3.5" fill="none"/>
  <path d="M54,39 Q61,33 68,39" stroke-width="3.5" fill="none"/>
  <circle cx="40" cy="47" r="3.6" fill="${INK}" stroke="none"/>
  <circle cx="63" cy="46" r="3" fill="${INK}" stroke="none"/>
  <circle cx="38.4" cy="45" r="1.3" fill="${C.white}" stroke="none"/>
  <path d="M36,59 Q50,71 64,58 Q62,65 50,66 Q38,65 36,59 Z" fill="${INK}"/>
  <rect x="42" y="59" width="6" height="5" rx="1.5" fill="${C.white}" stroke="none"/>
  <rect x="52" y="58" width="6" height="5" rx="1.5" fill="${C.white}" stroke="none"/>
  <path d="M74,50 Q90,38 88,16" fill="none" stroke="${C.stone300}" stroke-width="13"/>
  <path d="M74,50 Q90,38 88,16" fill="none" stroke-width="4"/>
  <path d="M80,20 L88,8 M84,24 L94,14" stroke="${C.sand800}" stroke-width="4.5"/>
  <path d="M18,84 L4,72" stroke="${C.sand800}" stroke-width="6"/>
</g>`,

// ---- Mountain Goat (Telluride, Revelstoke) — REDRAWN: clearer profile,
//      mid-leap onto a ledge, ridged backswept horns, off-centre eye ----
goat: `<g ${outline()} fill="none">
  <path d="M12,97 L12,80 Q12,66 26,64 L64,64 Q80,66 80,97 Z" fill="${C.stone300}"/>
  <path d="M60,18 Q74,2 88,6 Q78,12 76,22 Q84,24 88,34 Q74,32 66,24 Q56,28 52,38 Q50,24 60,18 Z" fill="${C.sand800}"/>
  <ellipse cx="44" cy="40" rx="24" ry="22" fill="${C.stone300}"/>
  <path d="M28,58 Q44,66 60,58 L58,48 Q44,53 30,48 Z" fill="${C.white}"/>
  <path d="M34,36 q4,-4 8,0" stroke-width="3.4" fill="none"/>
  <circle cx="40" cy="40" r="3.2" fill="${INK}" stroke="none"/>
  <circle cx="38.5" cy="38.5" r="1.2" fill="${C.white}" stroke="none"/>
  <path d="M38,50 Q44,54 50,49" stroke-width="3" fill="none"/>
  <ellipse cx="18" cy="93" rx="14" ry="5" fill="${C.stone600}"/>
</g>`,

// ---- Marmot on a tailgate (Arapahoe Basin) — keep, quality bar ----
marmot: `<g ${outline()} fill="none">
  <rect x="6" y="82" width="88" height="15" rx="3" fill="${C.sand800}"/>
  <rect x="6" y="82" width="88" height="5" fill="${C.stone300}"/>
  <ellipse cx="27" cy="46" rx="5.5" ry="8" fill="${C.sand500}"/>
  <ellipse cx="73" cy="46" rx="5.5" ry="8" fill="${C.sand500}"/>
  <ellipse cx="50" cy="64" rx="29" ry="25" fill="${C.sand500}"/>
  <rect x="27" y="58" width="46" height="12" rx="6" fill="${INK}"/>
  <ellipse cx="39" cy="64" rx="7.5" ry="5.5" fill="${C.cold300}"/>
  <ellipse cx="61" cy="64" rx="7.5" ry="5.5" fill="${C.cold300}"/>
  <ellipse cx="50" cy="74" rx="4.5" ry="3.5" fill="${C.sand800}"/>
  <path d="M44,80 Q50,84 56,80" stroke-width="3.5" fill="none"/>
  <path d="M70,64 L82,50" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
  <path d="M70,64 L82,50" stroke="${C.sand500}" stroke-width="6" stroke-linecap="round"/>
  <rect x="76" y="30" width="12" height="22" rx="3" fill="${C.gold}"/>
  <rect x="76" y="38" width="12" height="4" fill="${C.coral500}"/>
  <ellipse cx="82" cy="30" rx="6" ry="2" fill="${C.stone300}"/>
</g>`,

// ---- Penguin, bow tie (Vail) — jaunty salute-wave with cane, head cocked ----
penguin: `<g ${outline()} fill="none">
  <path d="M50,10 Q76,10 76,50 Q76,88 50,96 Q24,88 24,50 Q24,10 50,10 Z" fill="${INK}" stroke="none" transform="rotate(-4 50 50)"/>
  <path d="M50,22 Q68,22 68,52 Q68,82 50,90 Q32,82 32,52 Q32,22 50,22 Z" fill="${C.white}" transform="rotate(-4 50 50)"/>
  <ellipse cx="50" cy="36" rx="24" ry="20" fill="${INK}" transform="rotate(-4 50 36)"/>
  <ellipse cx="41" cy="33" rx="5.5" ry="6.5" fill="${C.white}"/>
  <ellipse cx="59" cy="35" rx="5" ry="6" fill="${C.white}"/>
  <circle cx="40.5" cy="35" r="2.8" fill="${INK}" stroke="none"/>
  <circle cx="60" cy="34" r="2.2" fill="${INK}" stroke="none"/>
  <path d="M39,44 L58,45 L48,57 Z" fill="${C.gold}" stroke="none"/>
  <path d="M40,64 L60,64 L54,80 L46,80 Z" fill="${C.coral600}" stroke-width="3"/>
  <circle cx="50" cy="64" r="6" fill="none" stroke="${C.white}" stroke-width="2.5"/>
  <path d="M28,66 L10,60" stroke="${INK}" stroke-width="9"/>
  <path d="M28,66 L10,60" stroke="${C.sand800}" stroke-width="6"/>
  <circle cx="8" cy="58" r="4" fill="${C.sand800}"/>
</g>`,

// ---- Swan, hand mirror (Deer Valley) — elegant preen, S-neck ----
swan: `<g ${outline()} fill="none">
  <path d="M18,97 L18,78 Q18,64 32,62 L62,62 Q76,64 76,97 Z" fill="${C.white}"/>
  <path d="M46,62 Q30,58 28,40 Q27,24 38,18" fill="none" stroke="${C.white}" stroke-width="16"/>
  <path d="M46,62 Q30,58 28,40 Q27,24 38,18" fill="none" stroke-width="4.5"/>
  <circle cx="40" cy="16" r="9" fill="${C.white}"/>
  <path d="M48,14 L61,11 L49,21 Z" fill="${C.gold}" stroke="none"/>
  <circle cx="38" cy="14" r="2.1" fill="${INK}" stroke="none"/>
  <path d="M80,66 Q94,58 98,68 Q93,78 80,74 Z" fill="${C.gold}" stroke-width="3.5"/>
  <ellipse cx="88" cy="70" rx="6" ry="8" fill="${C.cold300}" stroke-width="3"/>
</g>`,

// ---- Golden Retriever, goggles (Palisades Tahoe, Okemo, Big White) ----
retriever: `<g ${outline()} fill="none">
  <path d="M14,98 L14,78 Q14,64 30,62 L70,62 Q86,64 86,98 Z" fill="${C.gold}"/>
  <path d="M20,30 Q8,44 16,66 Q26,60 26,44 Q28,32 20,30 Z" fill="${C.sand500}"/>
  <path d="M80,30 Q92,44 84,66 Q74,60 74,44 Q72,32 80,30 Z" fill="${C.sand500}"/>
  <ellipse cx="49" cy="44" rx="27" ry="25" fill="${C.sand300}"/>
  <rect x="21" y="35" width="56" height="17" rx="8.5" fill="${INK}" transform="rotate(-3 49 43)"/>
  <circle cx="36" cy="43" r="7" fill="${C.mint600}" transform="rotate(-3 49 43)"/>
  <circle cx="62" cy="45" r="6.2" fill="${C.mint600}" transform="rotate(-3 49 43)"/>
  <path d="M49,41 h0.5" stroke-width="5"/>
  <ellipse cx="50" cy="60" rx="13" ry="10" fill="${C.sand300}"/>
  <ellipse cx="50" cy="56" rx="5" ry="4" fill="${INK}" stroke="none"/>
  <path d="M40,66 Q50,74 60,66" stroke-width="4" fill="none"/>
  <path d="M52,70 L58,86 Q50,92 42,84" fill="${C.coral500}" stroke-width="4"/>
</g>`,

// ---- Fox, beanie (quiet/uncrowded default — reserve in this set) ----
fox: `<g ${outline()} fill="none">
  <path d="M16,98 L16,78 Q16,64 30,62 L70,62 Q84,64 84,98 Z" fill="${C.mint600}"/>
  <path d="M50,20 L26,42 Q26,66 50,68 Q74,66 74,42 Z" fill="${C.coral500}"/>
  <path d="M20,20 L34,32 L18,36 Z" fill="${C.coral500}"/>
  <path d="M80,20 L66,32 L82,36 Z" fill="${C.coral500}"/>
  <path d="M50,42 L38,60 Q50,68 62,60 Z" fill="${C.white}"/>
  <path d="M36,44 q5,-4 9,0" stroke-width="3.5" fill="none"/>
  <path d="M55,44 q5,-4 9,0" stroke-width="3.5" fill="none"/>
  <circle cx="50" cy="54" r="3" fill="${INK}" stroke="none"/>
  <path d="M22,20 Q50,4 78,20 L78,26 Q50,12 22,26 Z" fill="${C.gold}"/>
  <circle cx="50" cy="8" r="7" fill="${C.gold}"/>
</g>`,

// ---- Roadrunner (Taos) — REDRAWN: small head, spiky crest, long neck,
//      long pointed beak, sprinting legs — not the earlier duck-read ----
roadrunner: `<g ${outline()} fill="none">
  <ellipse cx="42" cy="66" rx="30" ry="18" fill="${C.mint600}"/>
  <path d="M14,66 Q-4,60 2,42 Q10,52 22,58 Q16,62 14,66 Z" fill="${C.mint600}"/>
  <path d="M46,50 Q30,26 42,6" fill="none" stroke="${C.mint600}" stroke-width="14"/>
  <circle cx="46" cy="10" r="13" fill="${C.mint600}"/>
  <path d="M38,0 Q34,-8 42,-4 Q42,-12 50,-6 Q54,-10 56,-2" fill="${C.coral600}"/>
  <path d="M58,6 L90,10 L82,17 L58,15 Z" fill="${INK}" stroke="none"/>
  <path d="M58,6 L88,10 L80,16 L58,14 Z" fill="${C.gold}"/>
  <circle cx="41" cy="7" r="3.6" fill="${INK}" stroke="none"/>
  <circle cx="39.8" cy="5.6" r="1.1" fill="${C.white}" stroke="none"/>
  <path d="M28,80 Q22,92 12,96 M26,82 Q26,94 18,98" stroke="${C.sand800}" stroke-width="4.2"/>
  <path d="M56,80 Q64,90 76,92 M58,82 Q54,92 62,98" stroke="${C.sand800}" stroke-width="4.2"/>
  <path d="M12,96 h8 M62,98 h8" stroke="${C.stone300}" stroke-width="3.5"/>
</g>`,

// ---- Polar Bear, parka (Alyeska) — shielding eyes gazing at big terrain ----
polarbear: `<g ${outline()} fill="none">
  <path d="M14,98 L14,76 Q14,60 32,58 Q22,44 30,30 Q40,16 50,16 Q60,16 70,30 Q78,44 68,58 Q86,60 86,98 Z" fill="${C.cold600}"/>
  <ellipse cx="49" cy="48" rx="24" ry="22" fill="${C.white}"/>
  <ellipse cx="39" cy="44" rx="5.5" ry="6.5" fill="${INK}" stroke="none"/>
  <ellipse cx="59" cy="42" rx="5" ry="6" fill="${INK}" stroke="none"/>
  <circle cx="37.5" cy="42" r="1.4" fill="${C.white}" stroke="none"/>
  <ellipse cx="49" cy="56" rx="9" ry="7" fill="${C.white}"/>
  <ellipse cx="49" cy="58" rx="3.5" ry="2.8" fill="${INK}" stroke="none"/>
  <path d="M41,62 Q49,68 57,61" stroke-width="3.5" fill="none"/>
  <path d="M74,50 Q86,44 86,32" stroke="${C.white}" stroke-width="9"/>
  <circle cx="86" cy="30" r="9" fill="${C.white}"/>
  <circle cx="25" cy="88" r="9" fill="${C.white}"/>
</g>`,

// ---- Moose, scarf (Stowe, Lutsen) ----
moose: `<g ${outline()} fill="none">
  <path d="M16,98 L16,80 Q16,66 30,64 L70,64 Q84,66 84,98 Z" fill="${C.trailgreen}"/>
  <path d="M20,30 Q4,18 4,4 Q22,4 28,20 Q34,8 44,10 Q40,22 32,30" fill="${C.sand800}"/>
  <path d="M80,30 Q96,18 96,4 Q78,4 72,20 Q66,8 56,10 Q60,22 68,30" fill="${C.sand800}"/>
  <ellipse cx="50" cy="46" rx="22" ry="20" fill="${C.sand800}"/>
  <path d="M38,60 Q50,80 62,60 Q62,74 50,78 Q38,74 38,60 Z" fill="${C.sand800}"/>
  <ellipse cx="41" cy="43" rx="5" ry="6" fill="${INK}" stroke="none"/>
  <ellipse cx="59" cy="45" rx="4.5" ry="5.5" fill="${INK}" stroke="none"/>
  <circle cx="39.5" cy="41" r="1.3" fill="${C.white}" stroke="none"/>
  <ellipse cx="44" cy="66" rx="3.5" ry="4" fill="${INK}" stroke="none"/>
  <ellipse cx="56" cy="66" rx="3.5" ry="4" fill="${INK}" stroke="none"/>
  <path d="M18,80 Q50,90 82,80" stroke="${C.coral500}" stroke-width="9" fill="none"/>
</g>`,

// ---- Wolf, howling (Wolf Creek) — REDRAWN: head tilted back, open jaw
//      with visible teeth, one eye closed — fixes the earlier walrus-read ----
wolf: `<g ${outline()} fill="none">
  <path d="M18,97 L18,80 Q18,66 32,64 L68,64 Q82,66 82,97 Z" fill="${C.stone600}"/>
  <path d="M28,24 L14,4 L36,20 Z" fill="${C.stone300}"/>
  <path d="M72,24 L86,4 L64,20 Z" fill="${C.stone300}"/>
  <path d="M50,14 Q26,16 26,40 Q26,54 40,58 L60,58 Q74,54 74,40 Q74,16 50,14 Z" fill="${C.stone300}"/>
  <path d="M50,-2 Q60,-14 70,-2" fill="none" stroke-width="3.4"/>
  <path d="M34,34 q4,-4 7,0" stroke-width="3.2" fill="none"/>
  <circle cx="38" cy="38" r="2.8" fill="${INK}" stroke="none"/>
  <path d="M50,38 L36,56 Q50,66 64,56 Z" fill="${C.white}"/>
  <path d="M43,52 L46,60 L50,52 L54,60 L57,52" stroke-width="2.8" fill="none"/>
  <circle cx="16" cy="56" r="2.6" fill="${C.cold300}" stroke="none"/>
  <circle cx="10" cy="68" r="2.2" fill="${C.cold300}" stroke="none"/>
  <circle cx="84" cy="56" r="2.6" fill="${C.cold300}" stroke="none"/>
</g>`,

// ---- Sun Bear (spring-skiing default — reserve in this set) ----
sunbear: `<g ${outline()} fill="none">
  <path d="M16,98 L16,78 Q16,64 30,62 L70,62 Q84,64 84,98 Z" fill="${C.coral500}"/>
  <path d="M20,66 L34,74 L26,80 Z" fill="${C.gold}"/>
  <ellipse cx="50" cy="40" rx="25" ry="23" fill="${C.sand800}"/>
  <circle cx="26" cy="26" r="9" fill="${C.sand800}"/>
  <circle cx="74" cy="26" r="9" fill="${C.sand800}"/>
  <rect x="24" y="32" width="52" height="15" rx="7.5" fill="${INK}"/>
  <path d="M30,36 h18 M52,36 h18" stroke="${C.white}" stroke-width="2.5"/>
  <ellipse cx="50" cy="50" rx="6" ry="5" fill="${C.sand300}"/>
  <path d="M40,56 Q50,64 60,56" stroke-width="4" fill="none"/>
</g>`,

// ---- Woolly Mammoth (Mammoth Mountain, direct pun) — trumpet-call gesture ----
mammoth: `<g ${outline()} fill="none">
  <path d="M12,98 L12,78 Q12,64 28,62 L72,62 Q88,64 88,98 Z" fill="${C.cold300}"/>
  <path d="M28,24 Q4,30 6,52 Q18,50 26,36 L30,26 Z" fill="${C.sand500}"/>
  <path d="M72,24 Q96,30 94,52 Q82,50 74,36 L70,26 Z" fill="${C.sand500}"/>
  <ellipse cx="50" cy="44" rx="28" ry="25" fill="${C.sand800}"/>
  <path d="M10,58 Q4,50 12,42 Q10,54 20,60 Q14,66 10,58 Z" fill="${C.stone300}"/>
  <path d="M90,58 Q96,50 88,42 Q90,54 80,60 Q86,66 90,58 Z" fill="${C.stone300}"/>
  <path d="M38,64 Q28,76 20,72 Q26,86 38,88" fill="none" stroke="${C.sand800}" stroke-width="9"/>
  <rect x="24" y="36" width="52" height="15" rx="7.5" fill="${INK}"/>
  <circle cx="37" cy="43.5" r="6" fill="${C.stone300}"/>
  <circle cx="63" cy="43.5" r="6" fill="${C.stone300}"/>
  <path d="M12,78 Q4,86 12,94 M88,78 Q96,86 88,94" stroke-width="4"/>
</g>`,

// ---- Puffin, snow-gun hero (Sunday River) — keep, quality bar ----
puffin: `<g ${outline()} fill="none">
  <ellipse cx="46" cy="64" rx="26" ry="30" fill="${INK}"/>
  <ellipse cx="46" cy="70" rx="17" ry="20" fill="${C.white}"/>
  <path d="M28,42 Q46,54 64,42 Q60,16 46,14 Q32,16 28,42 Z" fill="${C.white}" stroke="none"/>
  <ellipse cx="36" cy="40" rx="5.5" ry="6.5" fill="${C.white}"/>
  <ellipse cx="56" cy="40" rx="5.5" ry="6.5" fill="${C.white}"/>
  <circle cx="36" cy="41" r="2.6" fill="${INK}" stroke="none"/>
  <circle cx="56" cy="41" r="2.6" fill="${INK}" stroke="none"/>
  <path d="M20,48 L46,44 L20,58 Z" fill="${C.coral500}"/>
  <path d="M14,48 L20,44 L20,58 L14,54 Z" fill="${C.gold}"/>
  <path d="M68,62 L90,42" stroke="${INK}" stroke-width="11"/>
  <path d="M68,62 L90,42" stroke="${C.gold}" stroke-width="7"/>
  <circle cx="92" cy="40" r="5" fill="${C.white}"/>
  <circle cx="99" cy="30" r="4" fill="${C.white}"/>
  <circle cx="100" cy="42" r="3.5" fill="${C.white}"/>
  <circle cx="90" cy="26" r="3" fill="${C.white}"/>
  <circle cx="18" cy="88" r="4" fill="${C.coral500}"/>
  <circle cx="28" cy="92" r="4" fill="${C.coral500}"/>
</g>`,

// ---- The Beast / Bison (Killington) — keep, quality bar ----
beast: `<g ${outline()} fill="none">
  <path d="M14,98 L14,80 Q14,66 30,64 L70,64 Q86,66 86,98 Z" fill="${C.sand800}"/>
  <circle cx="18" cy="40" r="13" fill="${C.sand500}"/>
  <circle cx="16" cy="58" r="12" fill="${C.sand500}"/>
  <circle cx="26" cy="24" r="12" fill="${C.sand500}"/>
  <circle cx="82" cy="40" r="13" fill="${C.sand500}"/>
  <circle cx="84" cy="58" r="12" fill="${C.sand500}"/>
  <circle cx="74" cy="24" r="12" fill="${C.sand500}"/>
  <circle cx="50" cy="16" r="12" fill="${C.sand500}"/>
  <ellipse cx="50" cy="50" rx="22" ry="20" fill="${C.sand800}"/>
  <path d="M30,32 L18,20 M70,32 L82,20" stroke-width="5.5"/>
  <path d="M34,42 h10 M56,42 h10" stroke-width="3.5"/>
  <ellipse cx="50" cy="58" rx="10" ry="8" fill="${INK}"/>
  <path d="M40,66 Q50,62 60,66" stroke-width="3.5" fill="none"/>
  <path d="M20,80 Q50,88 80,80" stroke="${C.coral600}" stroke-width="8" fill="none"/>
</g>`,

// ---- Lasso Cowgirl (Steamboat) — NEW: twirling a lasso, braids, hat back ----
lassocowgirl: `<g ${outline()} fill="none">
  <path d="M18,97 L18,76 Q18,62 32,60 L66,60 Q80,62 80,97 Z" fill="${C.trailgreen}"/>
  <path d="M28,58 Q10,40 22,18 Q30,44 40,52 Z" fill="${C.sand800}"/>
  <path d="M56,52 Q64,40 60,20 Q76,34 64,58 Z" fill="${C.sand800}"/>
  <circle cx="46" cy="40" r="21" fill="${C.sand500}"/>
  <path d="M28,26 Q28,10 46,9 Q64,10 64,26 Q56,17 46,17 Q36,17 28,26 Z" fill="${C.coral500}"/>
  <ellipse cx="46" cy="18" rx="30" ry="6" fill="${C.coral500}"/>
  <path d="M34,32 q4,-3 8,0" stroke-width="3.2" fill="none"/>
  <path d="M50,30 q5,-2 9,1" stroke-width="3.2" fill="none"/>
  <circle cx="38" cy="38" r="2.8" fill="${INK}" stroke="none"/>
  <circle cx="55" cy="37" r="2.4" fill="${INK}" stroke="none"/>
  <circle cx="37" cy="36.5" r="1" fill="${C.white}" stroke="none"/>
  <path d="M36,48 Q46,54 58,45" stroke-width="3.2" fill="none"/>
  <path d="M62,58 Q80,44 96,50 Q98,58 84,58 Q92,64 82,66" stroke-width="4" fill="none"/>
  <circle cx="88" cy="38" r="16" fill="none" stroke-width="4"/>
</g>`,

// ---- Fur-Coat Diva (Aspen Snowmass) — NEW: glam fur collar, sunglasses,
//      champagne flute raised, head tipped back laughing ----
furcoatdiva: `<g ${outline()} fill="none">
  <path d="M20,97 L20,74 Q20,58 36,56 L64,56 Q80,58 80,97 Z" fill="${C.coral600}"/>
  <path d="M14,70 Q10,50 22,40 Q26,56 34,62 L26,70 Z" fill="${C.stone300}"/>
  <path d="M86,70 Q90,50 78,40 Q74,56 66,62 L74,70 Z" fill="${C.stone300}"/>
  <circle cx="50" cy="38" r="22" fill="${C.sand300}"/>
  <path d="M40,10 Q50,2 60,10 Q66,20 60,26 Q50,14 40,26 Q34,20 40,10 Z" fill="${INK}" stroke="none"/>
  <rect x="30" y="32" width="40" height="14" rx="7" fill="${INK}" transform="rotate(-3 50 39)"/>
  <circle cx="41" cy="38" r="7" fill="${C.gold}" transform="rotate(-3 50 39)"/>
  <circle cx="59" cy="40" r="7" fill="${C.gold}" transform="rotate(-3 50 39)"/>
  <path d="M40,52 Q50,58 60,50" stroke-width="3.5" fill="none"/>
  <path d="M64,64 L86,50" stroke-width="8"/>
  <path d="M84,34 L88,50 L80,50 Z" fill="${C.cold300}"/>
  <rect x="83" y="26" width="4" height="10" fill="${C.cold300}"/>
</g>`,

// ---- Silver Fox (Sun Valley) — NEW: old-Hollywood, sunglasses pulled
//      down the snout for a direct over-the-glasses look, fur collar ----
silverfox: `<g ${outline()} fill="none">
  <path d="M18,97 L18,78 Q18,64 32,62 L68,62 Q82,64 82,97 Z" fill="${C.stone600}"/>
  <path d="M50,20 L28,40 Q28,64 50,66 Q72,64 72,40 Z" fill="${C.coral500}"/>
  <path d="M20,20 L34,32 L18,36 Z" fill="${C.coral500}"/>
  <path d="M80,20 L66,32 L82,36 Z" fill="${C.coral500}"/>
  <path d="M50,42 L40,58 Q50,65 60,58 Z" fill="${C.white}"/>
  <circle cx="42" cy="30" r="2.6" fill="${INK}" stroke="none"/>
  <ellipse cx="42" cy="45" rx="8" ry="6" fill="none" stroke-width="3.5"/>
  <ellipse cx="60" cy="45" rx="8" ry="6" fill="none" stroke-width="3.5"/>
  <path d="M50,45 h1.5" stroke-width="3"/>
  <path d="M56,54 q5,-3 9,0" stroke-width="3" fill="none"/>
  <path d="M30,66 h40" stroke="${C.stone300}" stroke-width="6"/>
</g>`,

// ---- Powder Diver (Mt. Baker, Jay Peak) — NEW: only board + boots
//      stick out of a snowdrift, fully submerged, spray flying ----
powderdiver: `<g ${outline()} fill="none">
  <ellipse cx="50" cy="78" rx="46" ry="20" fill="${C.white}"/>
  <path d="M34,78 Q30,44 36,20 Q38,14 44,16 Q48,18 46,26 Q42,48 46,78 Z" fill="${C.denim}"/>
  <path d="M56,78 Q62,46 58,22 Q57,15 51,17 Q47,19 49,27 Q52,48 50,78 Z" fill="${C.denim}"/>
  <rect x="30" y="10" width="20" height="10" rx="4" fill="${C.sand800}" transform="rotate(-8 40 15)"/>
  <rect x="52" y="10" width="20" height="10" rx="4" fill="${C.sand800}" transform="rotate(8 62 15)"/>
  <path d="M14,58 Q4,50 10,36" stroke-width="7" fill="none"/>
  <path d="M86,58 Q96,50 90,36" stroke-width="7" fill="none"/>
  <circle cx="18" cy="34" r="3" fill="${C.white}"/>
  <circle cx="82" cy="32" r="3" fill="${C.white}"/>
  <circle cx="10" cy="46" r="2.4" fill="${C.white}"/>
  <circle cx="90" cy="44" r="2.4" fill="${C.white}"/>
</g>`,

// ---- Black Bear on a Chairlift (Crystal Mountain) — NEW ----
blackbearlift: `<g ${outline()} fill="none">
  <path d="M10,42 L90,34" stroke-width="3.5"/>
  <path d="M44,42 L52,40 L56,50" stroke-width="3"/>
  <ellipse cx="50" cy="44" rx="24" ry="21" fill="${C.stone600}"/>
  <circle cx="32" cy="28" r="8" fill="${C.stone600}"/>
  <circle cx="68" cy="28" r="8" fill="${C.stone600}"/>
  <rect x="32" y="38" width="36" height="13" rx="6.5" fill="${INK}"/>
  <circle cx="42" cy="44.5" r="6" fill="${C.cold300}"/>
  <circle cx="58" cy="44.5" r="6" fill="${C.cold300}"/>
  <ellipse cx="50" cy="58" rx="8" ry="6" fill="${C.stone600}"/>
  <rect x="26" y="66" width="48" height="12" rx="4" fill="${C.coral500}"/>
  <path d="M20,78 Q16,90 26,98" stroke-width="7"/>
  <path d="M80,78 Q84,90 74,98" stroke-width="7"/>
  <ellipse cx="14" cy="72" rx="7" ry="9" fill="${C.stone600}" transform="rotate(-20 14 72)"/>
  <ellipse cx="86" cy="70" rx="7" ry="9" fill="${C.stone600}" transform="rotate(20 86 70)"/>
</g>`,

// ---- Lobster in a scarf (Sugarloaf, ME) — NEW: claws up mid-cheer ----
lobster: `<g ${outline()} fill="none">
  <path d="M50,96 Q30,90 32,70 Q34,50 50,48 Q66,50 68,70 Q70,90 50,96 Z" fill="${C.coral600}"/>
  <path d="M40,52 L20,30 Q14,22 22,16 Q30,14 32,24 L44,44 Z" fill="${C.coral600}" stroke-width="4"/>
  <path d="M60,52 L80,30 Q86,22 78,16 Q70,14 68,24 L56,44 Z" fill="${C.coral600}" stroke-width="4"/>
  <path d="M16,14 Q10,8 18,4 Q24,6 22,14 Z" fill="${C.coral600}"/>
  <path d="M84,14 Q90,8 82,4 Q76,6 78,14 Z" fill="${C.coral600}"/>
  <circle cx="40" cy="34" r="5" fill="${INK}" stroke="none"/>
  <circle cx="60" cy="30" r="5" fill="${INK}" stroke="none"/>
  <path d="M40,60 h20" stroke="${C.mint600}" stroke-width="9"/>
  <path d="M36,60 L30,72 M60,60 L66,74" stroke="${C.mint600}" stroke-width="7"/>
  <path d="M42,74 Q50,80 58,74" stroke-width="3.2" fill="none"/>
</g>`,

// ---- Loon (Loon Mountain, NH — name pun) — NEW: gliding, red eye ----
loon: `<g ${outline()} fill="none">
  <ellipse cx="46" cy="66" rx="34" ry="22" fill="${INK}"/>
  <path d="M58,50 Q66,30 84,26" stroke-width="9" fill="none"/>
  <circle cx="86" cy="24" r="9" fill="${INK}"/>
  <path d="M94,22 L106,26 L94,30 Z" fill="${INK}" stroke="none"/>
  <circle cx="89" cy="21" r="2.4" fill="${C.coral600}" stroke="none"/>
  <path d="M30,56 L40,54 M36,64 L46,62 M26,68 L36,66" stroke="${C.white}" stroke-width="2.6"/>
  <ellipse cx="46" cy="90" rx="36" ry="7" fill="${C.cold600}"/>
</g>`,

// ---- Raccoon in a beanie (Afton Alps) — NEW: mid-heist grin, mask ----
raccoon: `<g ${outline()} fill="none">
  <path d="M18,97 L18,78 Q18,64 32,62 L68,62 Q82,64 82,97 Z" fill="${C.coral500}"/>
  <path d="M22,20 Q14,4 30,6 Q26,16 32,24 Z" fill="${C.stone600}"/>
  <path d="M78,20 Q86,4 70,6 Q74,16 68,24 Z" fill="${C.stone600}"/>
  <ellipse cx="50" cy="42" rx="24" ry="22" fill="${C.stone300}"/>
  <path d="M26,34 Q50,24 74,34 Q74,46 50,48 Q26,46 26,34 Z" fill="${INK}"/>
  <circle cx="40" cy="38" r="4" fill="${C.white}" stroke="none"/>
  <circle cx="60" cy="38" r="4" fill="${C.white}" stroke="none"/>
  <circle cx="41" cy="39" r="1.8" fill="${INK}" stroke="none"/>
  <circle cx="61" cy="39" r="1.8" fill="${INK}" stroke="none"/>
  <ellipse cx="50" cy="52" rx="5" ry="4" fill="${INK}" stroke="none"/>
  <path d="M40,58 Q50,64 60,56" stroke-width="3.2" fill="none"/>
  <path d="M18,10 Q10,6 20,2 Q30,4 26,14 Z" fill="${C.mint600}"/>
  <path d="M70,68 L86,80" stroke="${INK}" stroke-width="9"/>
  <path d="M70,68 L86,80" stroke="${C.stone300}" stroke-width="6"/>
  <path d="M84,72 L90,70 M88,78 L94,78" stroke-width="3"/>
</g>`,

// ---- St. Bernard with a keg (Welch Village) — NEW: tongue out, wagging ----
stbernard: `<g ${outline()} fill="none">
  <path d="M16,97 L16,78 Q16,64 32,62 L68,62 Q84,64 84,97 Z" fill="${C.coral500}"/>
  <path d="M16,26 Q4,34 8,52 Q16,58 24,50 Q26,36 16,26 Z" fill="${C.sand800}"/>
  <path d="M84,26 Q96,34 92,52 Q84,58 76,50 Q74,36 84,26 Z" fill="${C.sand800}"/>
  <ellipse cx="50" cy="42" rx="26" ry="24" fill="${C.sand300}"/>
  <path d="M30,30 Q50,20 70,30 Q68,40 50,40 Q32,40 30,30 Z" fill="${C.sand800}"/>
  <ellipse cx="40" cy="34" rx="4.5" ry="5.5" fill="${INK}" stroke="none"/>
  <ellipse cx="60" cy="34" rx="4.5" ry="5.5" fill="${INK}" stroke="none"/>
  <ellipse cx="50" cy="48" rx="8" ry="6" fill="${INK}"/>
  <path d="M42,58 Q50,70 58,58" stroke-width="3.5" fill="none"/>
  <path d="M46,60 Q50,72 46,80" stroke="${C.coral600}" stroke-width="5" fill="none"/>
  <rect x="38" y="60" width="24" height="16" rx="7" fill="${C.sand800}"/>
  <circle cx="50" cy="68" r="4" fill="${C.gold}" stroke-width="2.5"/>
  <path d="M18,74 Q10,82 20,90 M82,74 Q90,82 80,90" stroke-width="4"/>
</g>`,

// ---- Junior Racer (Buck Hill) — NEW: aero tuck, bib, speed lines ----
juniorracer: `<g ${outline()} fill="none">
  <path d="M20,90 Q30,64 54,58 Q78,54 88,66" fill="none" stroke-width="4"/>
  <ellipse cx="58" cy="56" rx="20" ry="16" fill="${C.coral500}" transform="rotate(-18 58 56)"/>
  <circle cx="40" cy="44" r="14" fill="${C.sand300}"/>
  <path d="M28,38 Q26,24 40,22 Q54,24 52,38 Q46,30 40,30 Q34,30 28,38 Z" fill="${C.cold600}"/>
  <rect x="31" y="39" width="18" height="8" rx="4" fill="${INK}"/>
  <circle cx="36" cy="43" r="3.4" fill="${C.cold300}"/>
  <circle cx="44" cy="43" r="3.4" fill="${C.cold300}"/>
  <path d="M36,50 Q40,53 44,50" stroke-width="2.4" fill="none"/>
  <rect x="46" y="50" width="22" height="16" rx="3" fill="${C.white}" transform="rotate(-18 57 58)"/>
  <path d="M50,54 L64,62" stroke="${C.coral600}" stroke-width="3" transform="rotate(-18 57 58)"/>
  <path d="M78,72 L92,68 M74,80 L90,78" stroke-width="3" opacity="0.85"/>
  <path d="M14,58 L4,60 M18,50 L8,50" stroke-width="3" opacity="0.85"/>
</g>`,

// ---- Kid on a Magic Carpet (Wild Mountain) — NEW: arms up, wheee ----
magiccarpetkid: `<g ${outline()} fill="none">
  <rect x="10" y="78" width="80" height="14" rx="4" fill="${C.cold600}"/>
  <path d="M14,85 h72 M20,80 l0,10 M34,80 l0,10 M48,80 l0,10 M62,80 l0,10 M76,80 l0,10" stroke-width="2" opacity="0.5"/>
  <ellipse cx="50" cy="56" rx="18" ry="20" fill="${C.gold}"/>
  <circle cx="50" cy="34" r="15" fill="${C.sand300}"/>
  <path d="M36,26 Q50,10 64,26 Q60,20 50,18 Q40,20 36,26 Z" fill="${C.coral500}"/>
  <circle cx="50" cy="10" r="4" fill="${C.coral600}"/>
  <circle cx="44" cy="34" r="3" fill="${INK}" stroke="none"/>
  <circle cx="56" cy="34" r="3" fill="${INK}" stroke="none"/>
  <path d="M42,40 Q50,46 58,40" stroke-width="3" fill="none"/>
  <path d="M32,50 L14,32 M68,50 L86,32" stroke-width="7"/>
  <path d="M14,32 L8,20 M14,32 L22,24" stroke-width="4"/>
  <path d="M86,32 L92,20 M86,32 L78,24" stroke-width="4"/>
</g>`,

// ---- Otter (Giants Ridge) — NEW: belly-sliding, whiskers, low & sleek ----
otter: `<g ${outline()} fill="none">
  <path d="M6,74 Q30,86 50,76 Q70,88 94,72" fill="none" stroke-width="3" opacity="0.5"/>
  <path d="M10,60 Q8,38 32,32 Q54,28 68,42 Q80,50 74,64 Q68,76 42,76 Q16,76 10,60 Z" fill="${C.brown700}"/>
  <ellipse cx="32" cy="46" rx="18" ry="16" fill="${C.sand500}"/>
  <path d="M18,38 q4,-7 10,-4 M16,46 q3,-7 9,-5" stroke-width="1.8" fill="none"/>
  <path d="M46,42 q4,-6 9,-3" stroke-width="1.8" fill="none"/>
  <circle cx="27" cy="44" r="3.4" fill="${INK}" stroke="none"/>
  <circle cx="25.8" cy="42.5" r="1.2" fill="${C.white}" stroke="none"/>
  <ellipse cx="20" cy="49" rx="3.6" ry="2.6" fill="${INK}" stroke="none"/>
  <path d="M18,52 Q24,56 30,52" stroke-width="2.4" fill="none"/>
  <path d="M68,54 Q84,56 88,68 Q90,78 78,80" stroke-width="9" fill="none"/>
  <path d="M40,66 Q34,76 20,74 M56,68 Q62,78 74,74" stroke-width="6" fill="none"/>
</g>`,

// ---- Jackalope (Andes Tower Hills) — NEW: mid-bound, sly wink ----
jackalope: `<g ${outline()} fill="none">
  <path d="M18,97 L18,80 Q18,68 30,64 Q20,74 24,88 Q30,96 42,94 L58,94 Q70,96 76,88 Q80,74 70,64 Q82,68 82,80 L82,97 Z" fill="${C.sand500}"/>
  <path d="M34,30 Q26,6 16,4 Q22,20 28,30 Z" fill="${C.sand500}"/>
  <path d="M46,26 Q42,2 34,-2 Q36,16 40,28 Z" fill="${C.sand500}"/>
  <path d="M28,14 Q22,10 18,14 M40,10 Q34,6 30,10" stroke-width="2.4" fill="none"/>
  <circle cx="46" cy="42" r="20" fill="${C.sand500}"/>
  <path d="M56,22 Q68,10 78,16 Q70,24 70,32 M60,26 Q68,20 76,22" stroke-width="3" fill="none"/>
  <path d="M36,38 q4,-3 7,0" stroke-width="3" fill="none"/>
  <path d="M53,36 h1" stroke-width="3"/>
  <circle cx="38" cy="42" r="3" fill="${INK}" stroke="none"/>
  <ellipse cx="46" cy="52" rx="4.5" ry="3.5" fill="${C.sand800}"/>
  <path d="M40,56 Q46,60 52,55" stroke-width="2.8" fill="none"/>
</g>`,

// ---- Beaver (Whitecap Mountains) — NEW: paddle tail, buck teeth, goggles ----
beaver: `<g ${outline()} fill="none">
  <ellipse cx="70" cy="80" rx="22" ry="14" fill="${C.brown700}" transform="rotate(20 70 80)"/>
  <ellipse cx="46" cy="60" rx="30" ry="26" fill="${C.sand800}"/>
  <circle cx="26" cy="34" r="9" fill="${C.sand800}"/>
  <circle cx="54" cy="26" r="9" fill="${C.sand800}"/>
  <circle cx="26" cy="34" r="5" fill="${C.sand500}"/>
  <circle cx="54" cy="26" r="5" fill="${C.sand500}"/>
  <rect x="24" y="46" width="36" height="13" rx="6.5" fill="${INK}"/>
  <circle cx="34" cy="52.5" r="6" fill="${C.cold300}"/>
  <circle cx="50" cy="52.5" r="6" fill="${C.cold300}"/>
  <ellipse cx="40" cy="66" rx="8" ry="6" fill="${C.sand500}"/>
  <rect x="36" y="70" width="4" height="8" fill="${C.white}" stroke-width="2"/>
  <rect x="42" y="70" width="4" height="8" fill="${C.white}" stroke-width="2"/>
</g>`,

// ---- Bighorn Sheep (Fernie) — NEW: stocky, curled ram horns, mid-leap ----
bighorn: `<g ${outline()} fill="none">
  <path d="M14,96 L14,78 Q14,64 30,62 L70,62 Q86,64 86,96 Z" fill="${C.sand800}"/>
  <ellipse cx="48" cy="40" rx="24" ry="22" fill="${C.sand500}"/>
  <path d="M30,30 Q14,26 12,10 Q26,10 32,22 Q34,10 44,12 Q38,22 34,32 Q40,20 40,20" fill="${C.sand800}"/>
  <path d="M30,30 Q16,28 14,14 Q24,14 30,24" fill="none" stroke-width="2.2"/>
  <path d="M18,20 Q22,18 26,22" fill="none" stroke-width="2"/>
  <path d="M66,30 Q82,26 84,10 Q70,10 64,22 Q62,10 52,12 Q58,22 62,32" fill="${C.sand800}"/>
  <path d="M66,30 Q80,28 82,14 Q72,14 66,24" fill="none" stroke-width="2.2"/>
  <path d="M78,20 Q74,18 70,22" fill="none" stroke-width="2"/>
  <path d="M38,38 q4,-4 8,-1" stroke-width="3.2" fill="none"/>
  <circle cx="42" cy="42" r="3" fill="${INK}" stroke="none"/>
  <circle cx="40.7" cy="40.5" r="1" fill="${C.white}" stroke="none"/>
  <path d="M38,54 Q48,60 60,52" stroke-width="3.2" fill="none"/>
  <ellipse cx="18" cy="90" rx="14" ry="5" fill="${C.sand800}"/>
</g>`,

// ---- Elk in ski goggles (Lake Louise) — REPLACES the earlier ghost/larva
//      read: branching antlers, calm raised-eyebrow gaze, majestic ----
elk: `<g ${outline()} fill="none">
  <path d="M16,97 L16,78 Q16,64 32,62 L68,62 Q84,64 84,97 Z" fill="${C.cold600}"/>
  <path d="M42,30 Q36,6 18,4 Q28,14 24,24 M30,16 Q24,8 14,8 M36,24 Q30,16 20,16" stroke-width="4" fill="none"/>
  <path d="M58,30 Q64,6 82,4 Q72,14 76,24 M70,16 Q76,8 86,8 M64,24 Q70,16 80,16" stroke-width="4" fill="none"/>
  <ellipse cx="50" cy="46" rx="23" ry="21" fill="${C.sand800}"/>
  <rect x="29" y="40" width="42" height="13" rx="6.5" fill="${INK}"/>
  <circle cx="39" cy="46.5" r="5.5" fill="${C.gold}"/>
  <circle cx="61" cy="46.5" r="5.5" fill="${C.gold}"/>
  <ellipse cx="50" cy="60" rx="9" ry="7" fill="${C.sand500}"/>
  <ellipse cx="46.5" cy="59" rx="2.2" ry="2.8" fill="${INK}" stroke="none"/>
  <ellipse cx="53.5" cy="59" rx="2.2" ry="2.8" fill="${INK}" stroke="none"/>
  <path d="M41,68 Q50,72 59,68" stroke-width="3" fill="none"/>
</g>`,

// ---- Coyote (Banff Sunshine) — NEW: sitting, one ear up, sideways glance ----
coyote: `<g ${outline()} fill="none">
  <path d="M18,97 L18,80 Q18,66 32,64 L68,64 Q82,66 82,97 Z" fill="${C.sand800}"/>
  <path d="M30,26 L20,4 L38,22 Z" fill="${C.sand500}"/>
  <path d="M66,30 L78,10 L72,32 Z" fill="${C.sand500}"/>
  <path d="M50,16 Q26,18 26,42 Q26,56 40,60 L60,60 Q74,56 74,42 Q74,18 50,16 Z" fill="${C.sand500}"/>
  <path d="M50,42 L38,58 Q50,66 62,58 Z" fill="${C.white}"/>
  <path d="M36,36 q4,-3 7,0" stroke-width="3" fill="none"/>
  <circle cx="40" cy="40" r="2.6" fill="${INK}" stroke="none"/>
  <circle cx="62" cy="38" r="2" fill="${INK}" stroke="none"/>
  <circle cx="50" cy="53" r="2.6" fill="${INK}" stroke="none"/>
  <path d="M40,44 q5,3 8,-1" stroke-width="2.6" fill="none"/>
</g>`,

// ---- Lift-Op with a Shovel (Powder Ridge) — NEW: mid shovel-toss ----
liftopshovel: `<g ${outline()} fill="none">
  <path d="M20,97 L20,76 Q20,62 34,60 L66,60 Q80,62 80,97 Z" fill="${C.gold}"/>
  <circle cx="48" cy="40" r="21" fill="${C.sand500}"/>
  <path d="M28,28 Q28,10 48,9 Q68,10 68,28 Q60,18 48,17 Q36,18 28,28 Z" fill="${C.cold600}"/>
  <path d="M30,32 q4,-3 8,0" stroke-width="3" fill="none"/>
  <path d="M52,30 q5,-2 9,1" stroke-width="3" fill="none"/>
  <circle cx="38" cy="38" r="2.8" fill="${INK}" stroke="none"/>
  <circle cx="57" cy="37" r="2.4" fill="${INK}" stroke="none"/>
  <path d="M38,50 Q48,56 58,48" stroke-width="3" fill="none"/>
  <path d="M64,58 L88,38" stroke-width="8"/>
  <path d="M84,26 L100,34 L88,44 L78,36 Z" fill="${C.stone300}"/>
  <circle cx="94" cy="24" r="3" fill="${C.white}"/>
  <circle cx="100" cy="30" r="2.5" fill="${C.white}"/>
  <circle cx="90" cy="18" r="2.2" fill="${C.white}"/>
</g>`,

// ---- Hockey Player (reserve — MN "State of Hockey" signal) ----
hockeyplayer: `<g ${outline()} fill="none">
  <path d="M18,97 L18,76 Q18,62 34,60 L66,60 Q82,62 82,97 Z" fill="${C.cold600}"/>
  <circle cx="48" cy="40" r="21" fill="${C.sand300}"/>
  <path d="M27,30 Q27,10 48,9 Q69,10 69,30" fill="${C.white}" stroke-width="4"/>
  <rect x="30" y="34" width="36" height="10" fill="none" stroke-width="3.5"/>
  <circle cx="40" cy="42" r="2.6" fill="${INK}" stroke="none"/>
  <circle cx="58" cy="40" r="2.2" fill="${INK}" stroke="none"/>
  <path d="M40,54 Q48,58 58,50" stroke-width="3" fill="none"/>
  <path d="M64,58 L92,44" stroke-width="7"/>
  <path d="M88,38 L100,42 L92,52 L82,50 Z" fill="${INK}" stroke="none"/>
</g>`,

// ---- Ski Patroller with a Dog (reserve) ----
patrollerdog: `<g ${outline()} fill="none">
  <path d="M14,97 L14,78 Q14,64 28,62 L54,62 Q66,64 66,97 Z" fill="${C.coral600}"/>
  <circle cx="38" cy="42" r="18" fill="${C.sand300}"/>
  <circle cx="38" cy="30" r="6" fill="${C.white}" stroke-width="3.5"/>
  <path d="M32,24 L44,24" stroke-width="3"/>
  <circle cx="33" cy="44" r="2.4" fill="${INK}" stroke="none"/>
  <circle cx="45" cy="42" r="2" fill="${INK}" stroke="none"/>
  <path d="M32,52 Q38,56 46,50" stroke-width="2.8" fill="none"/>
  <ellipse cx="78" cy="80" rx="20" ry="14" fill="${C.sand500}"/>
  <circle cx="66" cy="66" r="12" fill="${C.sand500}"/>
  <path d="M58,58 Q54,48 60,46 Q64,54 62,60 Z" fill="${C.sand500}"/>
  <path d="M74,58 Q78,48 84,50 Q82,58 78,62 Z" fill="${C.sand500}"/>
  <circle cx="62" cy="66" r="2" fill="${INK}" stroke="none"/>
  <circle cx="70" cy="66" r="2" fill="${INK}" stroke="none"/>
  <ellipse cx="66" cy="72" rx="3" ry="2.2" fill="${INK}" stroke="none"/>
</g>`,

// ---- Groomer Driver (reserve — night-groomer/long-groomers signal) ----
groomerdriver: `<g ${outline()} fill="none">
  <rect x="10" y="60" width="70" height="30" rx="6" fill="${C.coral500}"/>
  <rect x="18" y="42" width="34" height="24" rx="5" fill="${C.cold600}"/>
  <rect x="24" y="48" width="22" height="12" rx="2" fill="${C.cold300}"/>
  <circle cx="30" cy="52" r="3" fill="${INK}" stroke="none"/>
  <circle cx="20" cy="90" r="10" fill="${INK}"/>
  <circle cx="64" cy="90" r="10" fill="${INK}"/>
  <path d="M74,60 L92,50 L98,66 L80,72 Z" fill="${C.stone300}"/>
</g>`,

// ---- Taco Lift Rider (reserve — apres/food-culture signal) ----
tacolift: `<g ${outline()} fill="none">
  <path d="M8,40 L96,30" stroke-width="3"/>
  <path d="M40,40 L48,38 L52,50" stroke-width="3"/>
  <rect x="26" y="50" width="42" height="12" rx="4" fill="${C.coral500}"/>
  <circle cx="46" cy="34" r="16" fill="${C.sand300}"/>
  <circle cx="40" cy="32" r="2.4" fill="${INK}" stroke="none"/>
  <circle cx="52" cy="32" r="2.4" fill="${INK}" stroke="none"/>
  <path d="M40,68 Q60,58 76,70 Q60,78 40,68 Z" fill="${C.gold}"/>
  <path d="M40,68 Q60,58 76,70" fill="none" stroke-width="3.5"/>
  <path d="M46,66 l4,8 M56,62 l3,9 M66,64 l4,8" stroke="${C.trailgreen}" stroke-width="3"/>
</g>`,

// ---- Beer Can (object accent — inline in Marmot composition) ----
beercan: `<g ${outline(3.5)} fill="none">
  <rect x="34" y="18" width="32" height="64" rx="5" fill="${C.gold}"/>
  <rect x="34" y="30" width="32" height="10" fill="${C.coral500}"/>
  <ellipse cx="50" cy="18" rx="16" ry="5" fill="${C.stone300}"/>
  <path d="M42,16 h16" stroke-width="2.5"/>
  <path d="M78,44 Q90,50 88,64 Q86,74 76,78" stroke-width="6" fill="none"/>
</g>`,

// ---- Gondola Cabin (object accent, reserve) ----
gondola: `<g ${outline(3.5)} fill="none">
  <path d="M6,16 L94,16" stroke-width="3"/>
  <path d="M40,16 L60,16 L64,28 L60,32 L40,32 L36,28 Z" fill="${C.cold600}"/>
  <rect x="42" y="32" width="16" height="34" rx="4" fill="${C.gold}"/>
  <rect x="46" y="38" width="8" height="10" fill="${C.cold300}"/>
</g>`,

// ---- Chairlift (object accent, reserve) ----
chairlift: `<g ${outline(3.5)} fill="none">
  <path d="M4,20 L96,10" stroke-width="3"/>
  <path d="M46,20 L54,18 L58,30" stroke-width="3"/>
  <path d="M32,32 L68,28 L66,44 L34,46 Z" fill="${C.coral500}"/>
  <path d="M34,46 L34,58 M66,44 L66,58" stroke-width="3"/>
</g>`,

// ---- Pine Cluster (object accent) ----
pines: `<g ${outline(3.5)} fill="none">
  <path d="M22,90 L22,80 M22,80 L10,80 L22,60 L34,80 L22,80" fill="${C.trailgreen}"/>
  <path d="M22,66 L14,66 L22,50 L30,66 L22,66" fill="${C.trailgreen}"/>
  <path d="M60,92 L60,78 M60,78 L44,78 L60,52 L76,78 L60,78" fill="${C.mint600}"/>
  <path d="M60,64 L48,64 L60,42 L72,64 L60,64" fill="${C.mint600}"/>
</g>`,

// ---- Powder Plume (object accent) ----
plume: `<g ${outline(3.5)} fill="none">
  <path d="M6,70 Q30,50 50,66 Q70,50 94,70 Q70,86 50,74 Q30,86 6,70 Z" fill="${C.white}"/>
  <circle cx="20" cy="40" r="3.5" fill="${C.white}"/>
  <circle cx="50" cy="30" r="4.5" fill="${C.white}"/>
  <circle cx="78" cy="40" r="3.5" fill="${C.white}"/>
</g>`,

// ---- Corduroy Stripes (background texture accent) ----
corduroy: `<g fill="none" stroke="${C.white}" stroke-width="3" stroke-linecap="round" opacity="0.55">
  <path d="M6,30 Q50,10 94,30"/>
  <path d="M2,46 Q50,22 98,46"/>
  <path d="M2,62 Q50,36 98,62"/>
</g>`,

// ---- Trophy / Medal (object accent) ----
medal: `<g ${outline(4)} fill="none">
  <path d="M22,2 L46,40 L34,42 Z" fill="${C.coral500}"/>
  <path d="M78,2 L54,40 L66,42 Z" fill="${C.white}"/>
  <circle cx="50" cy="62" r="30" fill="${C.gold}"/>
  <circle cx="50" cy="62" r="19" fill="${C.coral500}" stroke-width="3"/>
  <path d="M50,52 L54,60 L63,61 L56,67 L58,76 L50,71 L42,76 L44,67 L37,61 L46,60 Z" fill="${C.gold}" stroke="none"/>
</g>`,

// ---- No-Board Slash (skier-only accent) ----
noboard: `<g ${outline(4)} fill="none">
  <circle cx="50" cy="50" r="42" fill="${C.white}"/>
  <rect x="24" y="42" width="52" height="16" rx="8" fill="${C.cold600}" transform="rotate(20 50 50)"/>
  <line x1="16" y1="84" x2="84" y2="16" stroke="${C.coral600}" stroke-width="7"/>
</g>`,

// ---- Night-Lamp String (object accent) ----
lamps: `<g ${outline(3)} fill="none">
  <path d="M2,20 Q50,44 98,20" stroke-width="2.5"/>
  <circle cx="24" cy="30" r="7" fill="${C.gold}"/>
  <circle cx="50" cy="38" r="7" fill="${C.coral500}"/>
  <circle cx="76" cy="30" r="7" fill="${C.mint600}"/>
</g>`,

// ---- Ribbon Banner (text device accent, reserve, flagged weak — see §9) ----
ribbon: `<g ${outline(3.5)} fill="none">
  <path d="M6,36 L18,50 L6,64 L94,64 L82,50 L94,36 Z" fill="${C.coral600}"/>
</g>`,

// ---- Snowball Buddy (fallback character) ----
snowball: `<g ${outline()} fill="none">
  <circle cx="50" cy="58" r="34" fill="${C.white}"/>
  <path d="M26,34 Q50,14 74,34 L70,40 Q50,24 30,40 Z" fill="${C.cold600}"/>
  <circle cx="50" cy="16" r="7" fill="${C.cold600}"/>
  <ellipse cx="40" cy="52" rx="4" ry="5" fill="${INK}" stroke="none"/>
  <ellipse cx="60" cy="52" rx="4" ry="5" fill="${INK}" stroke="none"/>
  <path d="M44,66 Q50,72 56,66" stroke-width="4" fill="none"/>
  <path d="M16,86 L38,70 M84,86 L62,70" stroke="${C.sand800}" stroke-width="5"/>
  <circle cx="16" cy="86" r="3.5" fill="${C.sand800}" stroke="none"/>
  <circle cx="84" cy="86" r="3.5" fill="${C.sand800}" stroke="none"/>
</g>`,

};let uidCounter = 0;

// Fixed length (in path units) of the frame spec's curved-type arc,
// `M 34,168 A 96,96 0 0 0 206,168` (§1) — computed once via
// SVGPathElement.getTotalLength() and hardcoded, since the arc geometry
// never changes. Re-derive if that path string is ever edited.
const BADGE_ARC_LENGTH = 213.18;

// The character-count font-size tiering below (badge-system.md §1) was
// tuned against the 44-resort preview's own longest labels and is kept as
// the first-pass sizing choice — it's what gives a short name like "Alta"
// a bigger, bolder arc than a long one, which plain length-clamping alone
// wouldn't do. But the real 71-resort dataset has several longer combined
// name+region labels the preview never exercised (e.g. "REVELSTOKE
// MOUNTAIN RESORT · BC, CANADA", "PANORAMA MOUNTAIN RESORT · BC, CANADA")
// that measure wider than the arc even at the smallest tier — confirmed by
// rendering and measuring every one of the 71 real labels, not just eyeballing
// string length (see build-notes.md for the full before/after list). Rather
// than add more brittle character-count thresholds, this measures the
// label's ACTUAL rendered width via a cached offscreen SVG <text> probe and,
// only if it would truly overflow, clamps it to a safe width with SVG's own
// `textLength`/`lengthAdjust="spacingAndGlyphs"` — the correct native tool
// for exactly this problem. Short labels are completely unaffected (no
// textLength attribute is added unless the measured width demands it), so
// this never stretches or otherwise alters any label that already fit.
let _badgeMeasureProbe = null;
function measureBadgeTextLength(label, fontSize, letterSpace) {
  if (typeof document === 'undefined') return null; // no DOM (e.g. non-browser tooling) — caller falls back to the tier alone
  if (!_badgeMeasureProbe) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;';
    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('font-family', 'Manrope, sans-serif');
    text.setAttribute('font-weight', '800');
    svg.appendChild(text);
    (document.body || document.documentElement).appendChild(svg);
    _badgeMeasureProbe = { svg, text };
  }
  const { text } = _badgeMeasureProbe;
  text.setAttribute('font-size', fontSize);
  text.setAttribute('letter-spacing', letterSpace);
  text.textContent = label;
  try { return text.getComputedTextLength(); } catch (e) { return null; }
}

function buildBadgeSVG({ paletteKey, layers, name, region, uid }){
  const pal = PALETTES[paletteKey] || PALETTES.indigo;
  const arcId = `arc-${uid}`;
  const label = region ? `${name.toUpperCase()} · ${region.toUpperCase()}` : name.toUpperCase();
  // dynamic size so long labels never overlap/collide on the ~490-unit arc
  let fontSize = 15.5, letterSpace = 0.5;
  if (label.length > 22) { fontSize = 12.5; letterSpace = 0.1; }
  if (label.length > 30) { fontSize = 10.5; letterSpace = -0.1; }
  if (label.length > 38) { fontSize = 9; letterSpace = -0.2; }

  // Safety net for the handful of real labels the tiering above still
  // doesn't shrink enough (see comment above measureBadgeTextLength).
  // Margin is deliberately generous (not just "a few px of padding"): this
  // measurement can run before the Manrope webfont has finished loading
  // (this app's whole type system is built to be usable on the fallback
  // stack before/without Google Fonts — see shell.html's own comment to
  // that effect), and a fallback system sans-serif's glyph metrics at
  // font-weight 800 won't exactly match Manrope's. textLength itself keeps
  // enforcing its target continuously even if the font swaps in later
  // (it's a live rendering constraint, not a one-time layout snapshot), so
  // any label that DOES get clamped stays correct across a font swap — the
  // real residual risk is a label that measures just-barely-under the
  // threshold on the fallback font but would have measured over it on
  // Manrope, and therefore never gets clamped at all. A ~12% margin
  // absorbs realistic cross-font metric variance for that boundary case.
  const measured = measureBadgeTextLength(label, fontSize, letterSpace);
  const safeWidth = BADGE_ARC_LENGTH - 25;
  const textLengthAttr = (measured != null && measured > safeWidth)
    ? ` textLength="${safeWidth.toFixed(1)}" lengthAdjust="spacingAndGlyphs"`
    : '';

  const layerMarkup = layers.map(l => {
    const [cx, cy, scale, rot] = l.box; // center x/y in badge coords, scale of 100x100 symbol, rotation deg
    const w = 100 * scale;
    return `<g transform="translate(${cx - w/2},${cy - w/2}) scale(${scale}) ${rot ? `rotate(${rot} 50 50)`:''}">${MOTIFS[l.motif]}</g>`;
  }).join('\n');

  return `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="${uid}-title ${uid}-desc">
  <title id="${uid}-title">${name} badge</title>
  <desc id="${uid}-desc">${layers.map(l=>MOTIF_DESC[l.motif]||l.motif).join('; ')} on a ${pal.meaning} background.</desc>
  <defs>
    <path id="${arcId}" d="M 34,168 A 96,96 0 0 0 206,168"/>
    <clipPath id="clip-${uid}"><circle cx="120" cy="120" r="109"/></clipPath>
  </defs>
  <circle cx="120" cy="120" r="119" fill="${WHITE}" stroke="${'#00000014'}" stroke-width="1"/>
  <circle cx="120" cy="120" r="109" fill="${pal.bg}"/>
  <g clip-path="url(#clip-${uid})">
    ${layerMarkup}
    <text font-family="Manrope, sans-serif" font-weight="800" font-size="${fontSize}" letter-spacing="${letterSpace}" fill="${WHITE}" style="paint-order:stroke; stroke:rgba(0,0,0,0.22); stroke-width:2.5px;">
      <textPath href="#${arcId}" startOffset="50%" text-anchor="middle"${textLengthAttr}>${label}</textPath>
    </text>
  </g>
</svg>`;
}
const MOTIF_DESC = {
  cowboy:'a cowboy skier tipping his hat, leaning into a turn', bro:'a bro in a backwards cap giving a fist pump',
  selfieskier:'a skier in sunglasses holding a phone up for a selfie', snorkel:'a wide-eyed skier in ski goggles and a snorkel',
  yeti:'a big friendly yeti striding with skis over one shoulder, waving', goat:'a mountain goat leaping onto a rock ledge, horns back',
  marmot:'a marmot in sunglasses on a tailgate, holding a beer', penguin:'a penguin in a bow tie giving a jaunty wave with a cane',
  swan:'an elegant swan preening with a hand mirror', retriever:'a golden retriever in ski goggles, tongue out',
  fox:'a fox in a knit beanie', roadrunner:'a roadrunner sprinting, crest up, beak forward',
  polarbear:'a polar bear in a parka hood shielding its eyes', moose:'a moose in a scarf',
  wolf:'a wolf, head tilted back, howling with teeth bared', sunbear:'a bear in sunglasses and flip-flops',
  mammoth:'a woolly mammoth trumpeting, tusks raised', puffin:'a puffin heroically wielding a snow gun',
  beast:'a shaggy bison with a tough squint', lassocowgirl:'a cowgirl twirling a lasso overhead',
  furcoatdiva:'a figure in a fur-collar coat and sunglasses, champagne flute raised, laughing',
  silverfox:'a fox in round sunglasses pulled down its snout, old-Hollywood style',
  powderdiver:'a snowboard and boots sticking straight up out of a snowdrift, powder spraying',
  blackbearlift:'a black bear riding a chairlift alone, paws up, goggles on',
  lobster:'a lobster in a scarf with both claws raised in a cheer',
  loon:'a loon gliding across water, red eye, white neck band',
  raccoon:'a raccoon in a beanie, masked, mid-grin, raiding a snack bag',
  stbernard:'a St. Bernard with a keg on its collar, tongue out',
  juniorracer:'a kid ski racer in an aerodynamic tuck with a bib number',
  magiccarpetkid:'a kid riding a magic-carpet lift, arms flung up',
  otter:'an otter belly-sliding across the snow, whiskers out',
  jackalope:'a jackalope mid-bound, winking',
  beaver:'a beaver in ski goggles with buck teeth and a paddle tail',
  bighorn:'a bighorn sheep with curled ram horns, mid-leap between rocks',
  elk:'an elk in ski goggles with branching antlers, calm gaze',
  coyote:'a coyote sitting with one ear up, glancing sideways',
  liftopshovel:'a lift operator in a beanie, mid-toss with a shovel, snow flying',
  hockeyplayer:'a hockey player skating with a stick',
  patrollerdog:'a ski patroller with a rescue dog',
  groomerdriver:'a groomer driver in a snowcat cab',
  tacolift:'a rider eating a taco on a chairlift',
  beercan:'a beer can', gondola:'a gondola cabin', chairlift:'a chairlift chair',
  pines:'a cluster of pine trees', plume:'a plume of powder snow', corduroy:'groomed corduroy texture',
  medal:'a gold medal on a ribbon', noboard:'a no-snowboarding symbol', lamps:'a string of night-skiing lights',
  ribbon:'a ribbon banner', snowball:'a round snowball character in a tiny knit cap',
};/* ============================================================
   REGION LABEL + REGION CLUSTER — ported from badge-preview.html's
   region()/regionCluster(), adapted to read the real resorts.json field
   names (state_province/country) directly instead of the preview's trimmed
   sp/country stand-ins. Region label drives the curved badge type; region
   cluster drives ONLY the repeat-check / cluster-dedupe below (badge-
   system.md §4.1's "six region clusters a user would actually cross-shop on
   one trip") — never palette or motif rule logic, which still key off the
   exact state/country fields, matching the preview's own documented split.
   ============================================================ */
function badgeRegionLabel(resort) {
  const sp = resort.state_province, country = resort.country;
  const west = { 'California': 'Sierra, CA', 'Oregon': 'Cascades, OR', 'Washington': 'Cascades, WA' };
  const rockies = { 'Colorado': 'Rockies, CO', 'Wyoming': 'Rockies, WY', 'Montana': 'Rockies, MT', 'Idaho': 'Rockies, ID', 'Utah': 'Wasatch, UT', 'New Mexico': 'Rockies, NM' };
  const midwest = { 'Minnesota': 'Midwest, MN', 'Michigan': 'Midwest, MI', 'Wisconsin': 'Midwest, WI' };
  const northeast = { 'Vermont': 'New England, VT', 'Maine': 'New England, ME', 'New Hampshire': 'New England, NH', 'Connecticut': 'New England, CT' };
  const canada = { 'British Columbia': 'BC, Canada', 'Alberta': 'Alberta, Canada', 'Quebec': 'Quebec, Canada' };
  if (sp === 'Alaska') return 'Alaska';
  return west[sp] || rockies[sp] || midwest[sp] || northeast[sp] || canada[sp] || sp || country || '';
}

function badgeRegionCluster(resort) {
  const sp = resort.state_province;
  if (['Colorado', 'Wyoming', 'Montana', 'Idaho', 'Utah', 'New Mexico'].includes(sp)) return 'Rockies + Wasatch';
  if (['California', 'Oregon', 'Washington'].includes(sp)) return 'West Coast (Sierra + Cascades)';
  if (['Minnesota', 'Michigan', 'Wisconsin'].includes(sp)) return 'Midwest';
  if (['Vermont', 'Maine', 'New Hampshire', 'Connecticut'].includes(sp)) return 'New England';
  if (['British Columbia', 'Alberta', 'Quebec'].includes(sp)) return 'Canada';
  if (sp === 'Alaska') return 'Alaska';
  return 'Other';
}

/* ============================================================
   PALETTE-BY-MOTIF — full mapping for all 42 character motifs (the preview's
   PALETTE_BY_MOTIF only covered the 13 motifs its rule engine could produce;
   the full 71-resort rollout's cluster-dedupe pass below can bump a
   collision to ANY of the 42 characters, so every one needs a meaning-based
   default). Three of these — powderdiver→cold, stbernard→mint,
   juniorracer→amber — are given verbatim in badge-system.md §4.3; the rest
   follow the same principle (the motif's own real-world register: a formal/
   glam character reads indigo or amber depending on old-money vs. Western
   warmth, a cold-climate/ice character reads cold or teal, a scrappy/rustic
   or budget character reads amber, a calm/family character reads mint). This
   is a default only — every hand-tuned resort's palette (badge-system.md §6)
   overrides it explicitly, and the adjacency dedupe pass still runs after.
   ============================================================ */
const BADGE_PALETTE_BY_MOTIF = {
  cowboy: 'indigo', bro: 'coral', selfieskier: 'indigo', snorkel: 'teal', yeti: 'indigo',
  goat: 'cold', marmot: 'amber', penguin: 'indigo', swan: 'indigo', retriever: 'mint',
  fox: 'mint', roadrunner: 'amber', polarbear: 'cold', moose: 'amber', wolf: 'cold',
  sunbear: 'amber', mammoth: 'amber', puffin: 'cold', beast: 'amber', lassocowgirl: 'mint',
  furcoatdiva: 'coral', silverfox: 'amber', powderdiver: 'cold', blackbearlift: 'teal',
  lobster: 'cold', loon: 'mint', raccoon: 'coral', stbernard: 'mint', juniorracer: 'amber',
  magiccarpetkid: 'mint', otter: 'cold', jackalope: 'amber', beaver: 'teal', bighorn: 'mint',
  elk: 'indigo', coyote: 'cold', liftopshovel: 'amber', hockeyplayer: 'cold',
  patrollerdog: 'mint', groomerdriver: 'amber', tacolift: 'coral', snowball: 'teal',
};

// Canonical order of all 42 character motifs (excludes the 10 accent/object
// motifs — beercan, gondola, chairlift, pines, plume, corduroy, medal,
// noboard, lamps, ribbon — which only ever compose onto a primary character,
// never stand alone). This is the generic last-resort scan order for the
// cluster dedupe below, when a resort's semantic pool (BADGE_MOTIF_POOLS) is
// itself exhausted within one region cluster.
// Ordered so the most place-neutral characters (a fox, a cowboy, a bear in a
// parka — read fine anywhere) are tried first, and the most literally
// region/name-specific ones (a Maine lobster, a desert roadrunner) are tried
// only once everything else in a cluster is genuinely exhausted — a real
// worked example this ordering fixes: without it, Bridger Bowl, Montana (a
// landlocked resort) fell through to "Lobster in a Scarf" purely because it
// was next in an alphabetical-ish list, which is exactly the kind of
// "generic and wrong" the region-repeat check exists to catch. See
// build-notes.md for the before/after.
const BADGE_CHARACTER_ORDER = [
  'fox', 'coyote', 'elk', 'bighorn', 'otter', 'beaver', 'cowboy', 'marmot', 'wolf',
  'yeti', 'goat', 'penguin', 'retriever', 'bro', 'sunbear', 'moose', 'swan', 'silverfox',
  'furcoatdiva', 'selfieskier', 'lassocowgirl', 'powderdiver', 'blackbearlift', 'beast',
  'puffin', 'stbernard', 'raccoon', 'juniorracer', 'magiccarpetkid', 'liftopshovel',
  'hockeyplayer', 'patrollerdog', 'groomerdriver', 'tacolift', 'polarbear', 'mammoth',
  'snowball', 'jackalope', 'loon', 'roadrunner', 'lobster',
];

// Same-flavour alternates per rule-engine primary motif, tried before the
// generic full-library scan — badge-system.md §4.2 option (b)'s "small
// deterministic motif pool per region", generalised to every rule category
// that can produce a within-cluster collision, not just Midwest/Southwest
// (the real 71-resort dataset collides on goat/yeti/fox/snorkel/penguin too
// — see build-notes.md for the worked example).
const BADGE_MOTIF_POOLS = {
  moose: ['moose', 'otter', 'beaver', 'raccoon', 'stbernard', 'jackalope', 'loon', 'magiccarpetkid', 'juniorracer', 'hockeyplayer', 'patrollerdog', 'groomerdriver', 'tacolift'],
  roadrunner: ['roadrunner', 'jackalope', 'coyote', 'bighorn'],
  polarbear: ['polarbear', 'wolf', 'yeti', 'goat'],
  snorkel: ['snorkel', 'powderdiver', 'blackbearlift', 'coyote', 'otter'],
  goat: ['goat', 'bighorn', 'elk', 'wolf', 'coyote'],
  penguin: ['penguin', 'swan', 'silverfox', 'furcoatdiva'],
  retriever: ['retriever', 'magiccarpetkid', 'stbernard', 'juniorracer', 'otter'],
  bro: ['bro', 'selfieskier', 'lassocowgirl', 'furcoatdiva', 'tacolift'],
  fox: ['fox', 'coyote', 'elk', 'bighorn', 'silverfox', 'otter'],
  sunbear: ['sunbear', 'mammoth', 'silverfox'],
  yeti: ['yeti', 'cowboy', 'elk', 'mammoth', 'beast'],
  snowball: ['snowball', 'fox', 'otter', 'patrollerdog', 'groomerdriver'],
  wolf: ['wolf', 'coyote', 'polarbear'],
  lassocowgirl: ['lassocowgirl', 'cowboy', 'selfieskier'],
};

/* ============================================================
   ASSIGNMENT ENGINE (rule-driven tier) — priority-ordered, first match wins
   for the PRIMARY motif, ported from badge-preview.html's
   assignRuleBased(), adapted to the real resorts.json field names
   (best_for_tags/state_province/cost_tier/crowd_level/scale in place of the
   preview's trimmed tags/sp/cost/crowd stand-ins).

   One rule ADDED for the full build that the preview's simplified engine
   explicitly couldn't run (badge-system.md §4.2: "design-builder should add
   this as priority-0... at full build time, with the complete resorts.json
   record available"): a free-text ranching/Western-town signal, matched
   against the real town_vibe/character_note strings. It is priority-0 (runs
   before every other rule, including the name-pun check) because it's the
   same kind of signal that got Jackson Hole and Steamboat hand-tuned rather
   than rule-matched. Checked against the actual 71-resort dataset before
   shipping: it does not misfire on any non-hand-tuned resort (Big Powderhorn
   Mountain's "western Upper Peninsula" is a false-positive risk for a bare
   /western/ match, which is why this only matches the tighter
   ranch/rodeo/cowboy word-boundary set, not "western" alone — see
   build-notes.md).
   ============================================================ */
function badgeAssignRuleBased(r) {
  const t = r.best_for_tags || [];
  const has = (...xs) => xs.every((x) => t.includes(x));
  const vibeText = ((r.town_vibe || '') + ' ' + (r.character_note || '')).toLowerCase();
  let primary, rule;

  if (/\b(ranch|rodeo|cowboy)\b/.test(vibeText)) { primary = 'lassocowgirl'; rule = 'free-text: ranching/Western-town signal (town_vibe/character_note)'; }
  else if (r.id.includes('wolf')) { primary = 'wolf'; rule = 'name pun: "Wolf" in resort name'; }
  else if (r.state_province === 'New Mexico') { primary = 'roadrunner'; rule = 'region: high desert Southwest'; }
  else if (r.state_province === 'Alaska') { primary = 'polarbear'; rule = 'region: Alaska'; }
  else if (['Michigan', 'Minnesota', 'Wisconsin'].includes(r.state_province)) { primary = 'moose'; rule = 'region: Midwest / Great Lakes'; }
  else if (t.includes('deep-powder') && (r.crowd_level === 'low' || r.scale === 'regional')) { primary = 'snorkel'; rule = 'deep-powder + low crowd/regional'; }
  else if (has('steeps', 'backcountry-access')) { primary = 'goat'; rule = 'steeps + backcountry-access'; }
  else if (t.includes('luxury') && (t.includes('skier-only') || r.cost_tier === '$$$$')) { primary = 'penguin'; rule = 'luxury + skier-only/$$$$'; }
  else if (t.includes('beginner-friendly') || (t.includes('family') && r.scale === 'day-trip')) { primary = 'retriever'; rule = 'beginner-friendly, or family + day-trip'; }
  else if (t.includes('apres-scene') && (r.crowd_level === 'high' || r.crowd_level === 'brutal')) { primary = 'bro'; rule = 'apres-scene + high/brutal crowd'; }
  else if (has('quiet', 'uncrowded')) { primary = 'fox'; rule = 'quiet + uncrowded'; }
  else if (t.includes('spring-skiing')) { primary = 'sunbear'; rule = 'spring-skiing'; }
  else if (t.includes('big-vert') && r.scale === 'destination') { primary = 'yeti'; rule = 'big-vert + destination scale'; }
  else { primary = 'snowball'; rule = 'no strong signal → fallback'; }

  const layers = [{ motif: primary, box: P }];
  const accentNotes = [];
  if (t.includes('night-skiing')) { layers.push({ motif: 'lamps', box: [120, 26, 0.85, 0] }); accentNotes.push('+ night-skiing lamps'); }
  if (t.includes('skier-only') && primary !== 'penguin') { layers.push({ motif: 'noboard', box: [182, 166, 0.42, 0] }); accentNotes.push('+ no-board slash'); }
  if (t.includes('tree-skiing') && primary !== 'moose') { layers.push({ motif: 'pines', box: [186, 150, 0.5, 0] }); accentNotes.push('+ pines'); }
  if (t.includes('deep-powder') && primary !== 'snorkel') { layers.push({ motif: 'plume', box: [120, 182, 0.85, 0] }); accentNotes.push('+ powder plume'); }
  if (/\bolympic\b/i.test(r.character_note || '')) { layers.push({ motif: 'medal', box: [182, 70, 0.5, -8] }); accentNotes.push('+ Olympic medal'); }

  return { paletteKey: BADGE_PALETTE_BY_MOTIF[primary] || 'indigo', layers, rule, primary, accentNotes };
}

/* ============================================================
   REGION-CLUSTER MOTIF DEDUPE — badge-system.md §4.2 option (b), built for
   real: after every resort has a primary motif (hand-tuned entries fixed,
   rule-driven entries from badgeAssignRuleBased above), walk each of the six
   region clusters and make sure no character motif appears twice within it.

   Hand-tuned entries are processed FIRST (in dataset order) to seed each
   cluster's "already used" set — their motifs are the spec's own explicit,
   considered choices (badge-system.md §6) and are never themselves bumped.
   Rule-driven/fallback entries are then processed in the same fixed dataset
   order and, on collision, bumped to the next available motif: first from a
   same-flavour BADGE_MOTIF_POOLS pool, then (if that pool is exhausted
   within this cluster) from the full BADGE_CHARACTER_ORDER library, walked
   starting at a deterministic hash-of-resort-id offset. Never randomness,
   never resolved at render time — this runs once, over the static dataset,
   exactly like the adjacency palette dedupe it's modelled on.
   ============================================================ */
function badgeDedupeClusterMotifs(list) {
  const usedByCluster = {};
  const markUsed = (cluster, motif) => {
    if (!usedByCluster[cluster]) usedByCluster[cluster] = new Set();
    usedByCluster[cluster].add(motif);
  };
  const isUsed = (cluster, motif) => !!(usedByCluster[cluster] && usedByCluster[cluster].has(motif));

  list.forEach((x) => { if (x.category === 'hand-tuned') markUsed(x.cluster, x.layers[0].motif); });

  list.forEach((x) => {
    if (x.category === 'hand-tuned') return;
    const original = x.layers[0].motif;
    if (!isUsed(x.cluster, original)) { markUsed(x.cluster, original); return; }

    let chosen = null;
    const pool = BADGE_MOTIF_POOLS[original] || [];
    for (const cand of pool) { if (!isUsed(x.cluster, cand)) { chosen = cand; break; } }
    if (!chosen) {
      const offset = hashStr(x.resort.id + '-cluster-dedupe') % BADGE_CHARACTER_ORDER.length;
      for (let k = 0; k < BADGE_CHARACTER_ORDER.length; k++) {
        const cand = BADGE_CHARACTER_ORDER[(offset + k) % BADGE_CHARACTER_ORDER.length];
        if (!isUsed(x.cluster, cand)) { chosen = cand; break; }
      }
    }
    if (chosen && chosen !== original) {
      x.layers = [{ ...x.layers[0], motif: chosen }, ...x.layers.slice(1)];
      x.paletteKey = BADGE_PALETTE_BY_MOTIF[chosen] || x.paletteKey;
      x.clusterBumped = true;
      x.clusterBumpFrom = original;
    }
    markUsed(x.cluster, x.layers[0].motif);
  });
}

const P = [120,106,1.85,0]; // standard primary-motif box
const HAND_TUNED = {
  'jackson-hole-wy':      { paletteKey:'indigo', why:'one of the largest continuous verticals in NA — big-vert / dramatic', layers:[{motif:'cowboy', box:P}] },
  'alta-ut':              { paletteKey:'teal',   why:'deep powder / cold / expert — skier-only since founding, a real citable fact', layers:[{motif:'snorkel', box:P},{motif:'noboard', box:[182,166,0.42,0]}] },
  'arapahoe-basin-co':    { paletteKey:'amber',  why:'scrappy, budget, legendary tailgate culture in "The Beach"', layers:[{motif:'marmot', box:P}] },
  'big-sky-mt':           { paletteKey:'indigo', why:'4,350 ft vertical yet cited as uncrowded relative to CO/UT peers', layers:[{motif:'yeti', box:P}] },
  'vail-co':               { paletteKey:'coral',  why:'après / high energy — the biggest, liveliest après scene in CO', layers:[{motif:'penguin', box:P}] },
  'telluride-co':          { paletteKey:'cold',   why:'one of the most remote major US resorts — genuinely backcountry-feeling', layers:[{motif:'goat', box:P}] },
  'steamboat-co':          { paletteKey:'mint',   why:'a second real Western/ranching town, differentiated from Jackson by a distinct character (cowgirl, not cowboy), pose, palette, and label', layers:[{motif:'lassocowgirl', box:P}] },
  'aspen-snowmass-co':     { paletteKey:'coral',  why:'glamorous, apres-scene-tagged, four-mountain grandeur — a wholly new motif so it stops sharing Goat with Telluride', layers:[{motif:'furcoatdiva', box:P}] },
  'breckenridge-co':       { paletteKey:'coral',  why:'"for the bros" — the Director’s own hot take, taken literally; redrawn to fix the earlier bandit-mask read', layers:[{motif:'bro', box:P}] },
  'wolf-creek-co':         { paletteKey:'teal',   why:'independently owned, most consistent natural snowfall in CO — redrawn so it reads as wolf, not walrus', layers:[{motif:'wolf', box:P}] },
  'taos-nm':               { paletteKey:'amber',  why:'high-desert Southwest region rule, redrawn with a real crest/neck/beak so it reads as roadrunner, not duck', layers:[{motif:'roadrunner', box:P}] },
  'park-city-ut':          { paletteKey:'indigo', why:'largest US resort by acreage, shortest major-resort airport drive — a distinct "here for the ’gram" character so it stops sharing Bro with Breckenridge', layers:[{motif:'selfieskier', box:P}] },
  'deer-valley-ut':        { paletteKey:'indigo', why:'Utah’s only skier-only Epic-to-Ikon defector, manicured/ski-valet luxury — new motif so it stops sharing Penguin with Vail and Sun Valley', layers:[{motif:'swan', box:P},{motif:'noboard', box:[182,166,0.42,0]}] },
  'sun-valley-id':         { paletteKey:'amber',  why:'America’s first destination resort (1936), old-Hollywood/old-money — direct homage to the reference’s own "glasses pulled down the nose" gag', layers:[{motif:'silverfox', box:P}] },
  'palisades-tahoe-ca':    { paletteKey:'coral',  why:'après / terrain-park energy, plus its own 1960 Olympic heritage', layers:[{motif:'retriever', box:P},{motif:'medal', box:[182,70,0.5,-8]}] },
  'mammoth-mountain-ca':   { paletteKey:'amber',  why:'the direct name pun; also genuinely sun-warmed, laid-back spring-skiing energy', layers:[{motif:'mammoth', box:P}] },
  'mt-baker-wa':           { paletteKey:'cold',   why:'world snowfall record, deliberately undeveloped, cult favourite — a snowboarder buried to the boots so it stops sharing Snorkel with Alta/Bohemia', layers:[{motif:'powderdiver', box:P}] },
  'crystal-mountain-wa':   { paletteKey:'teal',   why:'big-vert, deep-powder, family + terrain-park — the Director’s own requested "black bear on a chairlift"', layers:[{motif:'blackbearlift', box:P}] },
  'stowe-vt':              { paletteKey:'mint',   why:'quiet, tree-skiing, historic New England charm', layers:[{motif:'moose', box:P}] },
  'killington-vt':         { paletteKey:'amber',  why:'"Beast of the East" — Killington’s actual nickname, illustrated literally', layers:[{motif:'beast', box:P}] },
  'sunday-river-me':       { paletteKey:'cold',   why:'one of the East’s most extensive snowmaking systems — heroics as a literal cold/ice joke', layers:[{motif:'puffin', box:P}] },
  'jay-peak-vt':           { paletteKey:'teal',   why:'Vermont’s snowiest, most cult deep-powder mountain — same joke as Mt. Baker, different (non-adjacent) region, differentiated by palette/label', layers:[{motif:'powderdiver', box:P}] },
  'sugarloaf-me':          { paletteKey:'cold',   why:'remote, uncrowded, big-vert Maine backcountry — Maine regional fauna, per the Director’s own request', layers:[{motif:'lobster', box:P}] },
  'loon-mountain-nh':      { paletteKey:'mint',   why:'the direct name pun, family/budget/easy-flight', layers:[{motif:'loon', box:P}] },
  'stratton-vt':           { paletteKey:'coral',  why:'apres-scene, terrain-park, easy-flight — same energy as Breckenridge, different (non-adjacent) region', layers:[{motif:'bro', box:P}] },
  'powder-ridge-ct':       { paletteKey:'amber',  why:'small, scrappy, reopened-after-closure day hill — the Director’s own requested "lift-op with a shovel"', layers:[{motif:'liftopshovel', box:P}] },
  'lutsen-mn':             { paletteKey:'amber',  why:'budget, regional, drive-to Midwest charm on Lake Superior’s North Shore', layers:[{motif:'moose', box:P}] },
  'mount-bohemia-mi':      { paletteKey:'teal',   why:'ungroomed, expert-only, no-snowmaking cult mountain — the Director’s own "wild-eyed in a snorkel" example', layers:[{motif:'snorkel', box:P}] },
  'afton-alps-mn':         { paletteKey:'coral',  why:'Twin Cities suburban night-ski hill, scrappy/budget — a raccoon "raiding" a cooler is exactly that energy', layers:[{motif:'raccoon', box:P},{motif:'lamps', box:[120,26,0.85,0]}] },
  'welch-village-mn':      { paletteKey:'mint',   why:'family-owned, unpretentious, locally loved day hill — the Director’s own requested "St. Bernard with a keg"', layers:[{motif:'stbernard', box:P},{motif:'lamps', box:[120,26,0.85,0]}] },
  'buck-hill-mn':          { paletteKey:'amber',  why:'a tiny (45-acre) hill with an outsized reputation as a US Ski Team racer feeder', layers:[{motif:'juniorracer', box:P}] },
  'wild-mountain-mn':      { paletteKey:'mint',   why:'family day hill that doubles as a summer waterpark — the Director’s own requested "kid on a magic carpet"', layers:[{motif:'magiccarpetkid', box:P}] },
  'giants-ridge-mn':       { paletteKey:'cold',   why:'quiet, remote Iron Range recreation area — Minnesota’s state bird was already claimed by Loon Mountain, so this one gets the otter', layers:[{motif:'otter', box:P}] },
  'andes-tower-hills-mn':  { paletteKey:'amber',  why:'small, remote, unusually steep west-central MN hill — the Director’s own requested jackalope', layers:[{motif:'jackalope', box:P}] },
  'whitecap-mountains-wi': { paletteKey:'teal',   why:'Wisconsin’s snowiest resort by its own marketing, near Lake Superior — the Director’s own requested beaver', layers:[{motif:'beaver', box:P}] },
  'whistler-blackcomb-bc': { paletteKey:'cold',   why:'North America’s largest resort by acreage and lift-served vertical, 2010 Olympic host', layers:[{motif:'bro', box:P},{motif:'medal', box:[184,68,0.5,-8]}] },
  'fernie-bc':             { paletteKey:'mint',   why:'five alpine bowls, real non-corporate mountain-town feel — Canadian Rockies fauna, distinct silhouette from Mountain Goat via curled ram horns', layers:[{motif:'bighorn', box:P}] },
  'lake-louise-ab':        { paletteKey:'indigo', why:'some of the most photographed alpine scenery in North America, inside Banff National Park — replaces the earlier ambiguous ghost/larva read entirely with the Director’s own requested "elk in ski goggles"', layers:[{motif:'elk', box:P}] },
  'revelstoke-bc':         { paletteKey:'cold',   why:'steeps, big-vert, deep-powder, genuinely backcountry — the same meaning as Telluride’s Goat, different (non-adjacent) region', layers:[{motif:'goat', box:P}] },
  'banff-sunshine-ab':     { paletteKey:'cold',   why:'deep-powder, quiet, big-vert in the Banff backcountry — a sly, sitting coyote', layers:[{motif:'coyote', box:P}] },
  'alyeska-ak':            { paletteKey:'cold',   why:'Alaska’s only full-scale destination resort — literal extreme cold, remote, backcountry-adjacent', layers:[{motif:'polarbear', box:P}] },
};function dedupeAdjacentPalettes(list){
  for (let i=1;i<list.length;i++){
    if (list[i].paletteKey === list[i-1].paletteKey){
      const idx = PALETTE_ORDER.indexOf(list[i].paletteKey);
      for (let k=1;k<PALETTE_ORDER.length;k++){
        const cand = PALETTE_ORDER[(idx+k)%PALETTE_ORDER.length];
        const nextClash = list[i+1] && list[i+1].paletteKey===cand;
        if (cand !== list[i-1].paletteKey && !nextClash){ list[i].paletteKey = cand; list[i].bumped = true; break; }
      }
    }
  }
}/* ============================================================
   BUILD full assignment list, in fixed dataset (RESORTS) order — this is
   the canonical "presentation order" badge-system.md §3 refers to for the
   adjacency palette dedupe, and it is deliberately NOT any dynamic in-app
   list order (e.g. Chase-the-Snow's forecast-ranked order changes with live
   data and the user's answers). A badge's palette and motif must be the
   same regardless of which screen or context it's rendered in — the dataset
   order is the one order that's always available and never changes.
   ============================================================ */
const BADGE_ASSIGNED = RESORTS.map((r) => {
  const cluster = badgeRegionCluster(r);
  if (HAND_TUNED[r.id]) {
    const h = HAND_TUNED[r.id];
    return { resort: r, cluster, category: 'hand-tuned', paletteKey: h.paletteKey, layers: h.layers.map((l) => ({ ...l })), why: h.why };
  }
  const a = badgeAssignRuleBased(r);
  const cat = a.primary === 'snowball' ? 'fallback' : 'rule';
  return { resort: r, cluster, category: cat, paletteKey: a.paletteKey, layers: a.layers, why: a.rule, accentNotes: a.accentNotes };
});

badgeDedupeClusterMotifs(BADGE_ASSIGNED);
dedupeAdjacentPalettes(BADGE_ASSIGNED);

const BADGE_ASSIGNMENTS = Object.fromEntries(BADGE_ASSIGNED.map((a) => [a.resort.id, a]));

/* ============================================================
   PUBLIC API used by app.js / app-chase.js / app-nicoles.js
   ============================================================ */

// Deterministic per resort+context uid — NOT a running counter (the preview
// used `uidCounter++`, which is fine for a one-shot static page but would
// break the byte-identical-across-two-browser-contexts requirement here,
// since a counter's value depends on how many other badges happened to
// render earlier on that particular page load). `context` only needs to be
// unique per *distinct simultaneous usage* of the same resort's badge on one
// page (e.g. a Chase row vs. that same resort's hero card) — it never
// varies with session, load order, or shared-link vs. fresh-render state.
// `decorative` (default true) matches this app's existing illustration
// convention (see the old illustrations.js's own `aria-hidden="true"
// focusable="false"` on its <svg>, and verify_a11y.js's check for it): the
// containing element carries the accessible name/description
// (role="img" + aria-label — hero card — or aria-hidden entirely on a
// decorative list-row avatar), and the inner SVG is hidden from the
// accessibility tree so a screen reader doesn't encounter the badge's own
// <title>/<desc> AND the wrapper's label as two separate, redundant stops.
// Pass { decorative: false } to keep the SVG's own role="img"
// aria-labelledby (its <title>/<desc>) live — used by the verification
// suite to check the title/desc content directly.
function badgeSvg(resort, context, opts) {
  const a = BADGE_ASSIGNMENTS[resort.id];
  if (!a) return '';
  const uid = `bdg-${resort.id}-${context || 'default'}`;
  const svg = buildBadgeSVG({ paletteKey: a.paletteKey, layers: a.layers, name: resort.name, region: badgeRegionLabel(resort), uid });
  const decorative = !opts || opts.decorative !== false;
  if (!decorative) return svg;
  return svg.replace(`role="img" aria-labelledby="${uid}-title ${uid}-desc"`, 'aria-hidden="true" focusable="false"');
}

// Alt text / screen-reader description — badge-system.md §8: states the
// actual character content in plain language plus the background's
// *meaning*, never its hex, generated from the same MOTIF_DESC table that
// drives the visual so text and picture can never drift apart. Pattern
// matches copy-deck.md §8 (describes what the picture is *for*, carries the
// resort's character, not a literal shape-by-shape inventory).
function badgeAltText(resort) {
  const a = BADGE_ASSIGNMENTS[resort.id];
  if (!a) return `${resort.name} badge.`;
  const parts = a.layers.map((l) => MOTIF_DESC[l.motif] || l.motif);
  const pal = PALETTES[a.paletteKey] || PALETTES.indigo;
  return `${resort.name} badge: ${parts.join('; ')} — on a ${pal.meaning} background.`;
}

// Short, non-repetitive alt text for dense repeated contexts (Chase-the-Snow
// list rows) — see build-notes.md for why the full badgeAltText() sentence
// is used on the hero result card (one badge, one reveal moment) but this
// shorter form is used where the badge is decorative-adjacent to already-
// present row text. Currently unused directly (Chase rows mark the avatar
// aria-hidden, per the same reasoning as the row's own rank number and
// forecast icon — see build-notes.md's accessibility section) but kept
// available for any future context that wants a mid-length description
// without the full character+background sentence.
function badgeShortAltText(resort) {
  const a = BADGE_ASSIGNMENTS[resort.id];
  if (!a) return `${resort.name} badge.`;
  return `${resort.name} badge: ${MOTIF_DESC[a.layers[0].motif] || a.layers[0].motif}.`;
}
