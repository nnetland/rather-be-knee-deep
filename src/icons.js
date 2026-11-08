// Small inline icon set — every icon used in the app is paired with a visible
// text label somewhere adjacent (never icon-only meaning), per copy-deck §8.
const ICONS = {
  mountain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19h18L14.5 6 10 13l-2.5-3L3 19z"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
  checkCircle: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.5 2.5L16 9" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  crystal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2l6 6-6 14L6 8z"/><path d="M6 8h12M12 2v18"/></svg>`,
  droplet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3s7 7.5 7 12a7 7 0 01-14 0c0-4.5 7-12 7-12z"/></svg>`,
  warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M12 3L2 20h20L12 3z"/><path d="M12 10v4M12 17.5v.01"/></svg>`,
  signalSlash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 20h.01M7 20v-4M12 20v-8M17 20V6M22 20V2"/><path d="M3 3l18 18"/></svg>`,
  live: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M22 12h-3M5 12H2"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>`,
  snow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M4.9 5l14.2 14M4.9 19L19.1 5"/></svg>`,
  list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>`,
  crowd: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-3-3.87M9 21v-2a4 4 0 013-3.87"/><circle cx="12" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-2.5-3.7M2 21v-2a4 4 0 012.5-3.7"/><circle cx="19" cy="9" r="2"/><circle cx="5" cy="9" r="2"/></svg>`,
  circleGlyph: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9"/></svg>`,
  squareGlyph: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`,
  diamondGlyph: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="1" transform="rotate(45 12 12)"/></svg>`,
  doubleDiamondGlyph: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="5" width="11" height="11" rx="1" transform="rotate(45 8.5 10.5)"/><rect x="10" y="8" width="11" height="11" rx="1" transform="rotate(45 15.5 13.5)"/></svg>`,
  arrowRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>`,
  chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`,
  // A pair of skis stood tips-up in the snow: two straight shafts, each with
  // a pronounced hooked tip. An earlier version added a binding crossbar
  // between them and read unmistakably as an italic letter H at nav size —
  // the crossbar is what did it. Paired with a visible "Quiver" label
  // everywhere it's used, per this file's own icon-never-carries-meaning-
  // alone rule.
  skis: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 21V8.6c0-2.2 1.1-3.6 2.7-3.6"/><path d="M14.8 21V8.6c0-2.2 1.1-3.6 2.7-3.6"/></svg>`,
  // External link: an arrow leaving a box. Always paired with visible link text
  // and a visually-hidden "opens in a new tab" note; the icon never carries it alone.
  external: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20.5 20.5L16.7 16.7"/></svg>`,
  // A speech bubble with a tail, for Buzz. Nothing in the library
  // fitted: `crowd` is people (it means crowding, not talking), `share` is the
  // three-node share graph, and `list` is already Nicole's List in the nav.
  //
  // THE PATH BELOW IS DUPLICATED VERBATIM IN shell.html, on both nav buttons.
  // That is the established pattern here — mountain, snow, skis and list are
  // each literal inline SVG in the nav and an ICONS entry for the splash — and
  // it matters more than usual for this one: the splash card and the nav item
  // are the two entry points to the same surface, and if the marks drift they
  // stop reading as the same destination. Change one, change the other.
  speech: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v12h-9l-5 4v-4H4z"/></svg>`,
};

const LEVEL_GLYPH = {
  "never-skied": "circleGlyph",
  "beginner": "circleGlyph",
  "intermediate": "squareGlyph",
  "advanced": "diamondGlyph",
  "expert": "doubleDiamondGlyph",
};

// The app's own sticker, in the resort-badge style (badge-system.md): the
// mountain from the app icon as a wry character, goggles pushed up, standing
// knee deep in powder. Home page hero. Decorative: the h1 carries the meaning.
const BRAND_STICKER_SVG = `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <title id="bdg-rbkd-title">Rather Be Knee Deep sticker</title>
  <desc id="bdg-rbkd-desc">A wry cartoon mountain with goggles pushed up on its snowcap, standing knee deep in a powder drift, on an indigo circle.</desc>
  <defs>
    <path id="arc-bdg-rbkd" d="M 34,168 A 96,96 0 0 0 206,168"/>
    <clipPath id="clip-bdg-rbkd"><circle cx="120" cy="120" r="109"/></clipPath>
  </defs>
  <circle cx="120" cy="120" r="119" fill="#FFFFFF" stroke="#00000014" stroke-width="1"/>
  <circle cx="120" cy="120" r="109" fill="#5B3DF0"/>
  <g clip-path="url(#clip-bdg-rbkd)">
    <g transform="translate(27.5,8) scale(1.85)"><g stroke="#17102B" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
      <path d="M50,12 Q53,12 55,16 L84,74 Q86,80 80,80 L20,80 Q14,80 16,74 L45,16 Q47,12 50,12 Z" fill="#C6C7CA"/>
      <path d="M45,16 Q47,12 50,12 Q53,12 55,16 L65,36 Q60,32 56,37 Q52,31 48,37 Q43,31 36,35 Z" fill="#FFFFFF"/>
      <rect x="31" y="35" width="38" height="8" rx="4" fill="#FF5A3C"/>
      <rect x="38" y="31" width="24" height="13" rx="6.5" fill="#FFC22B"/>
      <path d="M50,31 L50,44" stroke-width="3"/>
      <path d="M32,55 Q38,49 44,55 Q38,59 32,55 Z" fill="#FFFFFF" stroke-width="3"/>
      <path d="M56,55 Q62,49 68,55 Q62,59 56,55 Z" fill="#FFFFFF" stroke-width="3"/>
      <ellipse cx="41.2" cy="55.3" rx="2.4" ry="2.6" fill="#17102B" stroke="none"/>
      <ellipse cx="65.2" cy="55.3" rx="2.4" ry="2.6" fill="#17102B" stroke="none"/>
      <path d="M31,53.5 Q38,50 45,53.5" stroke-width="4.2" fill="none"/>
      <path d="M55,53.5 Q62,50 69,53.5" stroke-width="4.2" fill="none"/>
      <path d="M44,67 Q51,70 57,65" stroke-width="3" fill="none"/>
      <path d="M4,83 L6,72 Q14,64 22,70 Q32,62 42,70 Q52,63 62,70 Q72,62 82,70 Q90,64 96,72 L98,83 Q50,88 4,83 Z" fill="#FFFFFF"/>
      <path d="M14,73 Q18,71 22,73" stroke-width="2.5" fill="none" stroke="#9A8ACF"/>
      <path d="M70,73 Q74,71 78,73" stroke-width="2.5" fill="none" stroke="#9A8ACF"/>
    </g></g>
    <text font-family="Manrope, sans-serif" font-weight="800" font-size="12.5" letter-spacing="0.1" fill="#FFFFFF" style="paint-order:stroke; stroke:rgba(0,0,0,0.22); stroke-width:2.5px;">
      <textPath href="#arc-bdg-rbkd" startOffset="50%" text-anchor="middle" textLength="170" lengthAdjust="spacingAndGlyphs">RATHER BE KNEE DEEP</textPath>
    </text>
  </g>
</svg>`;
