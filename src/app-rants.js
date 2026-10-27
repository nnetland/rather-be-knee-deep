// ---------------------------------------------------------------------------
// Rants & Raves — the surface. Feed, detail, filter sheet, empty and expired
// states. rants.js owns the data contract, the expiry clock and every string
// that is a claim; this file owns markup, focus and events.
//
// --- WHAT MUST NOT DRIFT ---------------------------------------------------
//  · The quote block is the ONLY four-sided border on the surface. Cards are
//    unboxed, the frame is rules-not-a-box, corroboration is unboxed, controls
//    are filled. On this surface an outline means "not our words" — learnable
//    from one screenshot without instruction. The search field is the single
//    scoped amendment (see styles.css §Rants & Raves).
//  · Gold is banned here. Gold means Nicole across this app, and Nicole does
//    not speak on this surface.
//  · The frame is re-declared on EVERY view, including both expired states.
//  · Nothing older than 14 days renders, filtered on each quote's own date.
//  · Motion is opacity only, and never on the count, the corroboration glyph,
//    the quote block or the frame.
// ---------------------------------------------------------------------------

// --- ROUTE -----------------------------------------------------------------
// #rants=<tab>[/<scope>[/<topic-suffix>]] — the house's `#prefix=` hash form,
// same as #result=, #quiver= and #quiz=.
//
// The tabs and the cards are REAL LINKS with real hrefs, not buttons and not an
// ARIA tablist. A link with an href already is a route: shareable,
// middle-clickable, back-button correct. An ARIA tab is widget state
// hand-mirrored into the URL, and every mirror is a bug surface. This is the
// only surface in the app with intra-surface history, which is a consequence of
// that choice rather than a separate decision.
function parseRantsHash(hash) {
  const raw = String(hash || "").replace(/^#rants=/, "");
  const p = raw.split("/").filter(Boolean);
  const tab = p[0] === "raves" ? "raves" : "rants";
  const scope = p[1] && p[1] !== "none" ? p[1] : null;
  return { tab, scope, topic: p[2] || null };
}
function rantsHref(tab, scope, suffix) {
  let h = "#rants=" + tab;
  if (suffix) h += "/" + (scope || "none") + "/" + suffix;
  else if (scope) h += "/" + scope;
  return h;
}
function rantsCurrentHref() {
  const r = state.rants;
  return rantsHref(r.tab, r.scope, r.topic);
}

// A route change while the sheet is open closes it. The sheet filters a feed;
// if the feed underneath becomes a different feed, the sheet is describing
// something that is no longer on screen — and an open dialog with a focus trap
// surviving a route change is how a detached-opener bug gets shipped.
window.addEventListener("hashchange", () => {
  const hash = location.hash || "";
  if (hash.startsWith("#rants=")) {
    const next = parseRantsHash(hash);
    const wasFeed = state.route === "rants" && !state.rants.topic;
    const tabChanged = wasFeed && !next.topic && next.tab !== state.rants.tab;
    const viewChanged = state.route !== "rants" || !!next.topic !== !!state.rants.topic;
    closeRantsSheet(true);
    state.rants.tab = next.tab;
    state.rants.scope = next.scope;
    state.rants.topic = next.topic;
    if (state.route !== "rants") { state.route = "rants"; state.routeParams = {}; }
    window.scrollTo(0, 0);
    if (tabChanged) state.rants.focusPanel = true;
    rantsPaint(viewChanged || tabChanged);
  } else if (state.route === "rants") {
    // Back past this surface's own history entries. Every other surface clears
    // the hash with replaceState, so the entry we land on is hash-free and
    // parseInitialRoute() resolves it the same way a cold load would.
    closeRantsSheet(true);
    parseInitialRoute();
    render();
  }
});

// --- MOTION ----------------------------------------------------------------
// The entire budget: opacity, one duration, four places (route change,
// tab-content swap, filter sheet, toast). Zero transforms anywhere.
// prefers-reduced-motion removes it rather than shortening it.
//
// MUST NEVER MOVE: the count (an animating number is a number performing as a
// score), the corroboration glyph (a self-drawing checkmark is a *verified*
// gesture and this feature exists in order not to make that claim), the quote
// block (motion applied to it is the app performing with someone else's
// speech), and the standing frame.
const RANTS_FADE_MS = 160;
function rantsPaint(withFade) {
  const main = mainEl();
  const view = main.querySelector(".rants-view");
  if (!withFade || !view || reduceMotion()) { render(); return; }
  view.dataset.fading = "true";
  setTimeout(() => {
    render();
    const fresh = mainEl().querySelector(".rants-view");
    if (fresh) {
      fresh.dataset.fading = "true";
      requestAnimationFrame(() => { fresh.dataset.fading = "false"; });
    }
  }, RANTS_FADE_MS);
}

// Status messages (SC 4.1.3). Filter and sort both change what the list
// contains; a sighted user watches the feed rebuild, and without this a
// screen-reader user gets silence and a focus ring on a control whose value has
// changed. Separate from the toast so a copy-link confirmation cannot clobber a
// filter outcome.
function rantsAnnounce(msg) {
  const region = document.getElementById("rants-status-announcer");
  if (!region || !msg) return;
  // Clear first: assigning the same text twice running is a no-op in several
  // screen readers, and "3 resorts match" is exactly the kind of string a user
  // produces twice by backspacing and retyping.
  region.textContent = "";
  setTimeout(() => { region.textContent = msg; }, 60);
}

// --- ENTRY POINT -----------------------------------------------------------
function renderRants(main) {
  const r = state.rants;
  const focusPanel = r.focusPanel;
  r.focusPanel = false;

  if (r.topic) {
    const t = rantsTopicById(r.scope, r.topic);
    main.innerHTML = `<div class="page-column rants-view">${
      t && rantsIsLive(t) && rantsLabelOf(t)
        ? rantsDetailHtml(t)
        : rantsExpiredHtml(t && rantsLabelOf(t) ? t : null)
    }</div>`;
    wireRantsView();
    const h = main.querySelector("h1");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    rantsSetMeta(t);
    return;
  }

  main.innerHTML = `<div class="page-column rants-view">${rantsFeedHtml()}</div>`;
  wireRantsView();
  if (focusPanel) {
    // The list bar only exists in the populated branches, so switching INTO an
    // empty tab must fall through to that branch's own heading — otherwise
    // focus drops silently to <body> at the exact moment the user most needs to
    // be told what happened.
    const h = rantsPanelHeading();
    if (h) h.focus({ preventScroll: true });
  } else {
    focusHeading(main);
  }
  rantsSetMeta(null);
}

function rantsPanelHeading() {
  return document.getElementById("rants-listbar") || document.getElementById("rants-empty-h");
}

// document.title travels with the URL — it is what a bookmark, a history entry
// and the preview of a pasted link all read. A detail page is the thing that
// gets shared, so its title carries the polarity the card heading carries only
// in a hidden suffix.
function rantsSetMeta(t) {
  const r = state.rants;
  let head;
  if (r.topic) {
    head = t && rantsLabelOf(t) ? `${rantsPolarityTab(t)} — ${rantsTitle(t)}` : "This topic has dropped off";
  } else if (r.scope) {
    head = `${r.tab === "raves" ? "Raves" : "Rants"} — ${rantsScopeName(r.scope) || r.scope}`;
  } else {
    head = r.tab === "raves" ? "Raves — Buzz" : "Rants — Buzz";
  }
  document.title = `${head} — find your next ski trip`;
  setOgMeta({
    title: "Buzz",
    description: "Complaints and praise from skiers on Reddit, picked by Nicole. Not fact-checked, and nothing older than 14 days.",
  });
}

// --- STANDING FRAME --------------------------------------------------------
// Rules above and below. No box, no tint, no icon, no colour. A rule reads as
// record; a box reads as notice. This is provenance, not a warning, and styling
// it as a warning would be the app editorialising.
//
// The short form is VISIBLE, persistent and undismissable, directly under the
// h1. The five rows sit in a closed <details> beneath it — an ADDITION, never a
// replacement. If any part of the short form ever moves inside the disclosure,
// the frame has become a disclosure and the constraint is breached.
//
// The disclosure state does not persist across routes. There is no stored state
// anywhere in this feature, and a frame that stays open because of something
// you did four screens ago is a frame whose presence depends on history rather
// than on declaration.
function rantsFrameHtml() {
  return `
    <section class="rants-frame" aria-labelledby="rants-frame-h">
      <p class="rants-frame__short body-sm">${escapeHtml(RANTS_FRAME_SHORT)}</p>
      <details class="rants-frame__more">
        <summary id="rants-frame-h" class="data-label">Where this comes from</summary>
        <dl>${RANTS_FRAME_ROWS.map((row) => `
          <div class="rants-frame__row">
            <dt class="data-label">${escapeHtml(row[0])}</dt>
            <dd class="body-sm">${escapeHtml(row[1])}</dd>
          </div>`).join("")}
        </dl>
      </details>
    </section>`;
}

// --- TABS ------------------------------------------------------------------
// Links, not an ARIA tablist. The current resort filter is carried through,
// because the URL is the single source of truth for what the feed is showing —
// a tab link that dropped the filter would change two things at once.
function rantsTabsHtml() {
  const r = state.rants;
  const tab = (id, label) =>
    `<a href="${rantsHref(id, r.scope, null)}"${r.tab === id ? ' aria-current="true"' : ""}>${label}</a>`;
  return `<nav class="rants-tabs" aria-label="Show rants or raves">${tab("rants", "Rants")}${tab("raves", "Raves")}</nav>`;
}

// The help text switches with the selected value and is wired as
// aria-describedby on the select, so it is read whenever the control is
// focused. A static string describing "Unusual first" meant a screen-reader
// user who had chosen Newest heard an explanation of the other option every
// single time they landed on the control.
const RANTS_SORT_HELP = {
  unusual: "“Unusual first” puts topics that are rare for that resort at the top — not the ones with the most posts and comments.",
  newest: "“Newest first” puts the topics with the most recent posts and comments at the top, whatever the count.",
};

// The labels are VISIBLE. A button cannot take a <label>, so "Resort:" lives
// inside the button text and is therefore both the visible label and part of
// the accessible name — there is no screen-reader-only variant left to diverge
// from what is on screen.
function rantsControlsHtml() {
  const r = state.rants;
  // rantsScopeName(), never a raw name-table index. With a pass or an unknown
  // slug in the URL this rendered the literal string "undefined" on the button.
  const filterLabel = r.scope ? (rantsScopeName(r.scope) || r.scope) : "All resorts";
  return `
    <div class="rants-controls">
      <button type="button" class="rants-btn" id="rants-filter-btn" aria-haspopup="dialog" aria-expanded="false">
        Resort: ${escapeHtml(filterLabel)}
      </button>
      <span class="rants-ctl">
        <label for="rants-sort" class="data-label">Sort</label>
        <select class="rants-select" id="rants-sort" aria-describedby="rants-sort-help">
          <option value="unusual"${r.sort === "unusual" ? " selected" : ""}>Unusual first</option>
          <option value="newest"${r.sort === "newest" ? " selected" : ""}>Newest first</option>
        </select>
      </span>
    </div>`;
}
// Rendered after the bracket, not between the controls and the first card:
// it is a persistent explanation relevant only to someone who has decided to
// engage the sort, and at 200% zoom that band of chrome is a real slice of the
// vertical space before any content. aria-describedby does not care about DOM
// order.
function rantsSortHelpHtml() {
  return `<p class="rants-help body-sm" id="rants-sort-help">${escapeHtml(RANTS_SORT_HELP[state.rants.sort] || RANTS_SORT_HELP.unusual)}</p>`;
}

// The three exits, used by every state that is a dead end without them.
const RANTS_APP_EXITS = `
  <div class="rants-exits">
    <a href="#rants-exit-plan" data-rants-go="plan">Plan a trip</a>
    <a href="#rants-exit-chase" data-rants-go="chase">Chase the snow</a>
    <a href="#rants-exit-nicoles" data-rants-go="nicoles">Nicole's list</a>
  </div>`;

// The ONE permitted crossing from this surface into Nicole's, allowed only in a
// per-resort empty state, because an empty resort with no exit is a dead end
// and this exit crosses a navigation event into a re-declared frame.
//
// The label branches on whether a take actually exists. Only 9 of 44 rows carry
// one, so the unconditional form pointed mostly at nothing — and a link that
// promises a take and delivers a list is the same class of small lie this
// surface exists to avoid.
function rantsNicoleExit(resortId, shortName) {
  return rantsHasTake(resortId)
    ? `<a href="#rants-exit-nicoles" data-rants-go="nicoles" data-rants-resort="${escapeHtml(resortId)}">Read Nicole's take on ${escapeHtml(shortName)}</a>`
    : `<a href="#rants-exit-nicoles" data-rants-go="nicoles">See Nicole's list</a>`;
}

// Every empty state's heading is a focus target, because the heading IS the
// explanation.
function rantsEmptyH2(text) {
  return `<h2 id="rants-empty-h" class="display-h2 rants-empty__h" tabindex="-1">${text}</h2>`;
}

// --- CORROBORATION ---------------------------------------------------------
// Hueless by design: no green, no red. Green/red would say that matching is
// good and not-matching is bad, and corroboration has no valence — a green tick
// beside a rant reads as the app endorsing the rant. Distinguishable by
// silhouette at 16px, and a text label is ALWAYS adjacent, so shape is never
// the sole carrier. Never boxed.
const RANTS_GLYPH = {
  matches:
    '<svg class="rants-corrob__glyph" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M2 6h12M2 10h12"/></svg>',
  does_not_match:
    '<svg class="rants-corrob__glyph" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M2 6h12M2 10h12M11.5 2.5 4.5 13.5"/></svg>',
  not_published:
    '<svg class="rants-corrob__glyph" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-dasharray="3 2.2" aria-hidden="true" focusable="false"><rect x="2.5" y="2.5" width="11" height="11"/></svg>',
};

function rantsCorroborationHtml(t) {
  // Omit the row entirely when there is nothing to say. Never reserve space for
  // an absent corroboration — that is a fixed height, and fixed heights are how
  // a short feed starts reading as a broken one.
  if (!t.corroboration) return "";
  const c = t.corroboration;
  const ind = RANTS_CORROB_INDICATOR[c.state] || "";
  // If the pipeline sentence already opens with the indicator words, the <b>
  // wraps them rather than repeating them; if it does not, the indicator is
  // prepended with an em dash. Either way the label is present exactly once.
  let rest = String(c.text);
  rest = rest.slice(0, ind.length).toLowerCase() === ind.toLowerCase()
    ? rest.slice(ind.length)
    : " — " + rest;
  let out = '<div class="rants-corrob">';
  out += `<p class="rants-corrob__line body-sm">${RANTS_GLYPH[c.state] || ""}<span><b>${escapeHtml(ind)}</b>${escapeHtml(rest)}</span></p>`;
  out += `<p class="rants-corrob__note body-sm">${escapeHtml(RANTS_CORROB_NOTE)}</p>`;
  if (c.source_url) {
    // Label in Name (SC 2.5.3): the accessible name is a SUPERSET of the
    // visible run, never a replacement, so a voice-control user saying what is
    // printed in front of them still matches. The arrow is decoration and is
    // hidden — as a live text node it landed in the name as "right arrow".
    const dateFull = c.source_date ? rantsFullDate(c.source_date) : null;
    out += `<a href="${escapeHtml(c.source_url)}" rel="noopener noreferrer">${escapeHtml(c.source_label)}` +
      '<span aria-hidden="true"> →</span>' +
      `<span class="visually-hidden"> — ${escapeHtml(rantsShortName(rantsScopeLabel(t)))}'s ${escapeHtml(String(c.source_label).toLowerCase())}` +
      `${dateFull ? " for " + escapeHtml(dateFull) : ""}, leaves this page</span></a>`;
  }
  return out + "</div>";
}

// --- QUOTE BLOCK -----------------------------------------------------------
// The only four-sided border on the surface. Verbatim, never truncated at
// runtime, with the attribution inside the same bordered block — so there is no
// state in which the words appear without whose words they are.
function rantsQuoteHtml(qt) {
  const isPost = qt.item_type === "post";
  const prefix = isPost ? "Quote from a Reddit post:" : "Quote from a Reddit comment:";
  const attribVis = `${qt.author_handle} · ${isPost ? "post" : "comment"} in ${qt.subreddit} · ${rantsShortDate(qt.posted_at)}`;
  const attribA11y = `${isPost ? "Post" : "Comment"} by ${qt.author_handle} in ${qt.subreddit} on ${rantsFullDate(qt.posted_at)}`;
  const outText = isPost ? "Read the post on Reddit" : "Read the comment on Reddit";
  // Outbound links open in the SAME tab, so the accessible-name suffix says
  // "leaves this page". A link that announces a new tab and does not open one
  // is a 3.2.5 defect. Needs content-writer ratification.
  const outA11y = ` — ${qt.author_handle}'s ${isPost ? "post" : "comment"} in ${qt.subreddit}, leaves this page`;
  return (
    '<figure class="rants-quote">' +
      // figcaption must be the first or last child of <figure>, so the hidden
      // prefix lives inside it rather than ahead of it. It belongs there anyway:
      // prefix and attribution are one caption unit, and a screen-reader user
      // meets both before the slang.
      '<figcaption class="rants-quote__attrib">' +
        `<span class="visually-hidden">${escapeHtml(prefix)} </span>` +
        `<span aria-hidden="true">${escapeHtml(attribVis)}</span>` +
        `<span class="visually-hidden">${escapeHtml(attribA11y)}</span>` +
      "</figcaption>" +
      // cite= is the machine-readable source of the quotation: not rendered,
      // not announced, and the correct home for the permalink.
      `<blockquote class="rants-quote__text" cite="${escapeHtml(qt.permalink)}"><p>${escapeHtml(qt.text)}</p></blockquote>` +
      `<a class="rants-quote__out" href="${escapeHtml(qt.permalink)}" rel="noopener noreferrer">${escapeHtml(outText)}` +
        `<span class="visually-hidden">${escapeHtml(outA11y)}</span></a>` +
    "</figure>"
  );
}

// --- CARD ------------------------------------------------------------------
// DOM order is reading order: scope, label, rule, count, window, threads,
// corroboration, quotes. Rants carry 1 quote on the feed, Raves carry 2 — a
// rant quote is a particular ("75 minutes for Collins") that survives alone; a
// rave quote is a reaction ("best day of the year") that evaporates without its
// referent. Parity of evidence, not decoration.
function rantsCardHtml(t) {
  const nQuotes = t.polarity === "rave" ? 2 : 1;
  const href = rantsHref(state.rants.tab, t.scope_id, rantsTopicSuffix(t));
  return (
    `<li class="rants-card" data-topic="${escapeHtml(t.id)}">` +
      `<p class="rants-card__scope body-sm">${escapeHtml(rantsScopeLabel(t))}</p>` +
      // The hidden suffix carries BOTH the polarity and the scope: "Lift wait
      // times — rant at Alta, Utah". Invisible on screen, because for a sighted
      // user the tab above the list already says which one they are reading;
      // this exists for the heading-navigation route, where the list bar is
      // never encountered.
      `<h3 class="display-h3"><a href="${escapeHtml(href)}" data-rants-card="${escapeHtml(t.id)}">${escapeHtml(rantsLabelOf(t))}` +
        `<span class="visually-hidden">${escapeHtml(rantsTitleTailA11y(t))}</span></a></h3>` +
      // aria-hidden: a drawn rule inside a card, not a thematic break between
      // sections. Announced, it fired "separator" once per card, mid-card.
      '<hr class="rants-card__rule" aria-hidden="true">' +
      rantsMetaHtml(t) +
      `<p class="rants-threads body-sm">` +
        `<span aria-hidden="true">${escapeHtml(rantsThreadsVisual(t.thread_count))}</span>` +
        `<span class="visually-hidden">${escapeHtml(rantsThreadsA11y(t.thread_count))}</span></p>` +
      rantsCorroborationHtml(t) +
      // rantsLiveQuotes(), not t.quotes. A quote past 14 days never renders, on
      // any view, regardless of the state of its topic.
      `<div class="rants-quotes">${rantsLiveQuotes(t).slice(0, nQuotes).map(rantsQuoteHtml).join("")}</div>` +
    "</li>"
  );
}

// Volume renders as WEIGHT CONTRAST inside one string — numeral 700, words 400,
// same size, same line, tabular figures. Bars, dots and size-scaling all detach
// the numeral from its unit and become a score. The aligned column of figures
// down the feed is the imagery: a departures board, not a chart.
//
// No middle dot is emitted between the count and the window. The column-gap IS
// the separator, which is what removes the aria-hidden separator problem
// entirely; they share a line when they fit and stack when they do not.
function rantsMetaHtml(t) {
  return (
    '<div class="rants-meta">' +
      `<span class="visually-hidden">${escapeHtml(rantsMetaA11y(t))}</span>` +
      `<span class="rants-count data-inline" aria-hidden="true"><b>${t.mention_count}</b> ${escapeHtml(rantsUnitWord(t.composition, t.mention_count))}</span>` +
      `<span class="rants-window data-inline" aria-hidden="true">${escapeHtml(rantsWindowVisual(t.window_start, t.window_end))}</span>` +
    "</div>"
  );
}

// --- FEED ------------------------------------------------------------------
function rantsFeedHtml() {
  const r = state.rants;
  const list = rantsSortedTopics(r.tab, r.scope, r.sort);
  const other = r.tab === "rants" ? "raves" : "rants";
  const otherCount = rantsSortedTopics(other, r.scope, r.sort).length;
  const scopeName = r.scope ? rantsScopeName(r.scope) : null;

  // One clause glossing BOTH tabs. "Rave" meaning enthusiastic praise is
  // idiomatic English; the commoner sense for a learner is the dance event, and
  // without this the choice between the only two routes the surface has is a
  // coin toss for a non-native reader.
  const head =
    '<h1 class="display-h1">Buzz</h1>' +
    '<p class="rants-sub body-md">Complaints and praise from skiers on Reddit.</p>' +
    rantsFrameHtml() + rantsTabsHtml() + rantsControlsHtml();

  // UNKNOWN SCOPE SLUG, checked FIRST, before anything reads a name table. This
  // was a white screen: the lookup came back undefined and the name split threw,
  // so nothing was ever assigned and the surface rendered nothing — no error, no
  // recovery, no way back. Two live routes reach it: a mangled or truncated
  // shared URL (and links pasted into group chats are this feature's entire
  // distribution model), and the app generating one itself from a scope slug
  // that has since left the resort list.
  if (r.scope && !scopeName) {
    return head +
      '<section class="rants-empty">' +
        rantsEmptyH2("This link is from an older version of the page") +
        "<p class=\"body-md\">The resort it pointed to is gone. Resort links change when the resort list changes, and older ones stop working.</p>" +
        `<div class="rants-exits"><a href="${rantsHref(r.tab, null, null)}">See all resorts</a></div>` +
      "</section>" + rantsSortHelpHtml();
  }

  // BRANCH ORDER IS LOAD-BEARING. A filtered view must never fall through to the
  // global "Nothing in the last 14 days" — that sentence claims the whole
  // continent is quiet when only one resort is, and it drops "This is not a
  // rating.", the single most important sentence in the feature. Scope-specific
  // emptiness is evaluated FIRST, always.
  if (list.length === 0 && r.scope && otherCount === 0) {
    const shortName = rantsShortName(scopeName);
    return head +
      '<section class="rants-empty">' +
        rantsEmptyH2(`Nothing about ${escapeHtml(shortName)} in the last 14 days`) +
        `<p class="body-md">Not enough people posted about ${escapeHtml(shortName)} for a topic to form. ${escapeHtml(RANTS_FLOOR_RULE)}</p>` +
        // The load-bearing sentence. Without it, an empty resort reads as a
        // verdict the app has delivered on that resort.
        `<p class="rants-emph body-md"><b>This is not a rating.</b> It only means Reddit was quiet about ${escapeHtml(shortName)}.</p>` +
        '<div class="rants-exits">' +
          `<a href="${rantsHref(r.tab, null, null)}">See all resorts</a>` +
          rantsNicoleExit(r.scope, shortName) +
        "</div>" +
      "</section>" + rantsSortHelpHtml();
  }

  // BOTH EMPTY: unfiltered, nothing anywhere. This runs for months at a time in
  // the off-season, so it is a primary state, and it is the one state that must
  // never be a dead end.
  if (list.length === 0 && otherCount === 0) {
    return head +
      '<section class="rants-empty">' +
        rantsEmptyH2("Nothing in the last 14 days") +
        "<p class=\"body-md\">No topic anywhere had enough posts and comments to show. That's common in the off-season. Nothing gets held over &mdash; when Reddit is quiet, this page is empty.</p>" +
        RANTS_APP_EXITS +
      "</section>" + rantsSortHelpHtml();
  }

  // ONE TAB EMPTY. Correct whether or not a resort filter is active — the
  // sibling count is computed over the SAME filter scope, so the sentence is
  // true of the filtered view the user is actually looking at.
  if (list.length === 0) {
    return head +
      '<section class="rants-empty">' +
        rantsEmptyH2(`No ${r.tab === "raves" ? "raves" : "rants"} in the last 14 days.`) +
        `<p class="body-md">${other === "rants" ? "Rants" : "Raves"} has ${escapeHtml(rantsCountPhrase(otherCount))} right now.</p>` +
        `<div class="rants-exits"><a href="${rantsHref(other, r.scope, null)}">See ${other}</a></div>` +
      "</section>" + rantsSortHelpHtml();
  }

  // A FILTERED FEED HAS TO SAY IT IS FILTERED. The h1 is the surface name and
  // the end-of-list marker is a continent-scale sentence; the two cheapest
  // carriers are the two that are already there.
  const tabName = r.tab === "raves" ? "Raves" : "Rants";
  const listbar = r.scope
    ? `<span aria-hidden="true">${escapeHtml(tabName + " · " + scopeName)}</span>` +
      // Not the same string: the visible form leans on a middle dot, which a
      // screen reader announces as "middle dot"; the spoken form says what the
      // dot means.
      `<span class="visually-hidden">${escapeHtml(tabName + ", filtered to " + scopeName)}</span>`
    : tabName;

  const forScope = r.scope ? " for " + escapeHtml(rantsShortName(scopeName)) : "";
  const endOfList = list.length === 1
    ? `That's the only topic${forScope} from the last 14 days.`
    : `That's all ${escapeHtml(rantsCountPhrase(list.length))}${forScope} from the last 14 days.`;

  // The bracket. 2px rules top and bottom close the list into an object; 1px
  // hairlines separate cards inside it. A closed set of three reads as
  // complete; an open column of three reads as truncated. No min-height, no
  // trailing spacer, no skeletons, nothing centred — the feed shrinks rather
  // than ages.
  return head +
    '<div class="rants-bracket">' +
      `<h2 class="rants-listbar data-label" id="rants-listbar" tabindex="-1">${listbar}</h2>` +
      // role="list" is not redundant: the reset sets list-style:none, and Safari
      // strips list semantics from a list with no marker — so VoiceOver
      // announced no "list, 9 items" anywhere. That count is the entire
      // completeness signal for a user who cannot see the 2px bracket closing
      // the set.
      `<ul role="list">${list.map(rantsCardHtml).join("")}</ul>` +
      // Three lines, all unconditional. The third is true of a 15-topic feed
      // and a 3-topic feed alike, so gating it on a threshold was the only
      // thing making it read as a notice about THIS week rather than a
      // statement about how the feed works.
      '<div class="rants-endoflist">' +
        `<p class="body-sm">${endOfList}</p>` +
        '<p class="body-sm">Topics drop off 14 days after the posts and comments they hold.</p>' +
        '<p class="body-sm">This feed shrinks when Reddit is quiet. It never pads itself with anything older.</p>' +
      "</div>" +
    "</div>" +
    rantsSortHelpHtml();
}

// --- DETAIL ----------------------------------------------------------------
function rantsDetailHtml(t) {
  const r = state.rants;
  const qs = rantsLiveQuotes(t);
  const tabName = r.tab === "raves" ? "Raves" : "Rants";
  // No history.back(). On a cold-landed shared link — a fresh tab, or an in-app
  // browser opened from a group chat — back is a no-op or leaves the app
  // entirely, from the one screen whose whole job is to receive a pasted link.
  // The href is a hash route: already back-correct, already middle-clickable.
  const hasHistory = state.rants.hadPrev;
  const backLabel = hasHistory ? `Back to ${tabName}` : `See all ${tabName.toLowerCase()}`;
  const backHref = hasHistory ? rantsHref(r.tab, r.scope, null) : rantsHref(r.tab, null, null);
  return `
    <a class="rants-back" href="${escapeHtml(backHref)}">${backLabel}</a>
    <section class="rants-detail">
      <p class="rants-kicker data-label" aria-hidden="true">${escapeHtml(rantsPolarityKicker(t))}</p>
      <h1 class="display-h1">${escapeHtml(rantsLabelOf(t))}<span class="visually-hidden">${escapeHtml(" — " + rantsPolarityWord(t))}</span>${escapeHtml(rantsTitleTail(t))}</h1>
      ${rantsFrameHtml()}
      ${rantsMetaHtml(t)}
      <p class="rants-threads body-sm">
        <span aria-hidden="true">${escapeHtml(rantsThreadsVisual(t.thread_count))}</span>
        <span class="visually-hidden">${escapeHtml(rantsThreadsA11y(t.thread_count))}</span>
      </p>
      ${t.corroboration ? `<h2 class="rants-detail__h2 data-label">Checked against the resort's own data</h2>${rantsCorroborationHtml(t)}` : ""}
      <h2 class="rants-detail__h2 data-label">What people posted</h2>
      <div class="rants-quotes">${qs.slice(0, 5).map(rantsQuoteHtml).join("")}</div>
      <div class="rants-share">
        <button type="button" class="rants-btn rants-btn--share" data-rants-share="${escapeHtml(t.id)}">Share<span class="visually-hidden"> this topic</span></button>
        <p class="rants-help body-sm" id="rants-share-note">A shared link stops working when this topic drops off, 14 days from the dates above.</p>
      </div>
      ${hasHistory ? `<div class="rants-exits"><a href="${escapeHtml(rantsHref(r.tab, null, null))}">See all ${tabName.toLowerCase()}</a></div>` : ""}
    </section>`;
}

// --- EXPIRED SHARED LINK ---------------------------------------------------
// The single most important state in the feature: it is what a link posted into
// a group chat becomes. It says what the link WAS for without re-displaying
// anything that has expired.
function rantsExpiredHtml(t) {
  const r = state.rants;
  const tabName = r.tab === "raves" ? "Raves" : "Rants";
  const hasHistory = state.rants.hadPrev;
  const back = `<a class="rants-back" href="${escapeHtml(hasHistory ? rantsHref(r.tab, r.scope, null) : rantsHref(r.tab, null, null))}">${hasHistory ? "Back to " + tabName : "See all " + tabName.toLowerCase()}</a>`;

  // THE TOPIC NEVER EXISTED, as distinct from having dropped off. Collapsing the
  // two told a user arriving on a mangled share link that a topic had existed
  // and expired when none ever had. Different causes, different copy, different
  // exits — and a confident false story about why their link is dead is worse
  // than no story.
  if (!t) {
    return back +
      '<section class="rants-empty">' +
        '<h1 class="display-h1" id="rants-empty-h" tabindex="-1">This topic has dropped off</h1>' +
        // The frame is re-declared here too. Without it, "not a rating" is
        // absent from the one page whose entire subject is a rule the user has
        // just been caught by.
        rantsFrameHtml() +
        '<p class="body-md">This link is from an older version of the page. The topic it pointed to is gone.</p>' +
        `<div class="rants-exits"><a href="${rantsHref(r.tab, null, null)}">See all resorts</a></div>` +
      "</section>";
  }

  const name = rantsScopeLabel(t);
  const shortName = rantsShortName(name);
  const n = rantsTopicCountFor(t.scope_id, r.tab);
  // The term is the scope's KIND, and there are three kinds — hardcoding
  // "Resort" labelled a pass scope "Resort — Ikon pass".
  const scopeTerm = t.scope_type === "pass" ? "Pass" : "Resort";

  let out = back +
    '<section class="rants-empty">' +
      '<h1 class="display-h1" id="rants-empty-h" tabindex="-1">This topic has dropped off</h1>' +
      rantsFrameHtml() +
      '<dl class="rants-wasfor">' +
        (t.scope_type === "none" ? "" : `<div><dt class="data-label">${scopeTerm}</dt><dd class="body-sm">${escapeHtml(name)}</dd></div>`) +
        `<div><dt class="data-label">Topic</dt><dd class="body-sm">${escapeHtml(t.scope_type === "none" ? rantsTitle(t) : rantsLabelOf(t))}</dd></div>` +
        `<div><dt class="data-label">Dates</dt><dd class="body-sm">${escapeHtml(rantsWindowVisual(t.window_start, t.window_end))}</dd></div>` +
      "</dl>" +
      `<p class="body-md">It held Reddit posts and comments from ${escapeHtml(rantsWindowVisual(t.window_start, t.window_start))} to ${escapeHtml(rantsWindowVisual(t.window_end, t.window_end))}. Everything here drops off 14 days after it was written, so this one is gone. Nothing on this page is ever older than 14 days.</p>`;

  if (n > 0) {
    out += `<p class="body-md">${escapeHtml(shortName)} has ${escapeHtml(rantsCountPhrase(n))} right now.</p>` +
      '<div class="rants-exits">' +
        `<a href="${rantsHref(r.tab, t.scope_id, null)}">See ${escapeHtml(shortName)}'s ${escapeHtml(rantsCountPhrase(n))}</a>` +
        `<a href="${rantsHref(r.tab, null, null)}">See all resorts</a>` +
      "</div>";
  } else {
    // The harder version of the per-resort empty state: a stranger arrives cold
    // with no feed above them, at a resort the app has nothing whatsoever to say
    // about. A page carrying a resort name, the word "nothing", and no "not a
    // rating" reads as a verdict delivered by the app.
    out += `<p class="body-md">${escapeHtml(shortName)} has nothing right now either. Not enough people have posted about ${escapeHtml(shortName)} in the last 14 days.</p>` +
      '<p class="rants-emph body-md"><b>That\'s not a rating</b> &mdash; it only means Reddit was quiet.</p>' +
      '<div class="rants-exits">' +
        `<a href="${rantsHref(r.tab, null, null)}">See all resorts</a>` +
        (t.scope_type === "resort" ? rantsNicoleExit(t.scope_id, shortName) : "") +
      "</div>";
  }
  return out + "</section>";
}

// --- EVENTS ----------------------------------------------------------------
function wireRantsView() {
  const main = mainEl();

  main.querySelectorAll("[data-rants-go]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const resortId = a.dataset.rantsResort || null;
      navigate(a.dataset.rantsGo, resortId ? { focusResort: resortId } : {});
    });
  });

  const filterBtn = document.getElementById("rants-filter-btn");
  if (filterBtn) filterBtn.addEventListener("click", () => openRantsSheet(filterBtn));

  const sort = document.getElementById("rants-sort");
  if (sort) {
    sort.addEventListener("change", () => {
      state.rants.sort = sort.value === "newest" ? "newest" : "unusual";
      const label = state.rants.sort === "newest" ? "Newest first" : "Unusual first";
      const n = rantsSortedTopics(state.rants.tab, state.rants.scope, state.rants.sort).length;
      // No fade on sort. A fade on a keystroke-adjacent action is motion the
      // budget does not cover.
      render();
      rantsAnnounce(`Sorted by ${label.toLowerCase()}, ${rantsCountPhrase(n)}`);
      // Re-queried by id AFTER the render — the node the event fired on has
      // been destroyed by the innerHTML assignment.
      const fresh = document.getElementById("rants-sort");
      if (fresh) fresh.focus();
    });
  }

  const share = main.querySelector("[data-rants-share]");
  if (share) share.addEventListener("click", () => rantsShare(share.getAttribute("data-rants-share")));

  // Leaving the feed for a detail view: remember that there is somewhere to go
  // back to, which is what distinguishes an in-app tap from a cold-landed
  // shared link.
  main.querySelectorAll("[data-rants-card]").forEach((a) => {
    a.addEventListener("click", () => { state.rants.hadPrev = true; });
  });
}

// A FAILED WRITE MUST NOT REPORT SUCCESS. This app runs from file:// in review
// builds, where the clipboard API is commonly absent or rejects outright, so
// the lying path is the likely path rather than the edge case. On a surface
// whose entire product is honesty about where information came from, an action
// that reports a result it did not achieve is the worst bug available.
async function rantsShare(id) {
  const t = RANTS_TOPICS.filter((x) => x.id === id)[0];
  if (!t) return;
  const url = `${location.origin}${location.pathname}${rantsShareHash(t)}`;
  const text = rantsShareText(t);
  if (navigator.share) {
    try { await navigator.share({ title: "Buzz", text, url }); return; }
    catch (e) { /* cancelled or unsupported — fall through to the clipboard */ }
  }
  try {
    if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error("no clipboard");
    await navigator.clipboard.writeText(url);
    showToast("Link copied");
  } catch (e) {
    showToast("Couldn't copy the link. Copy it from your browser's address bar instead.");
  }
}

// --- FILTER SHEET ----------------------------------------------------------
// Full-screen at narrow widths, a left panel above 480px. 48px rows. Close
// button AND Escape. Focus trapped while open and returned to the control that
// opened it. No swipe, no drag — there is no gesture-only affordance anywhere
// in this feature.
let rantsSheetOpener = null;
let rantsSearchTimer = null;

function rantsSheetEl() { return document.getElementById("rants-sheet"); }

// The visible count on a row and the feed one tap away must be the same number,
// so both are tab-scoped. "Alta — 3 topics" followed by a two-topic Rants feed
// is a number the surface did not keep.
function rantsSheetCounts(filterText) {
  const tab = state.rants.tab;
  const ft = (filterText || "").trim().toLowerCase();
  const withTopics = [], without = [];
  RESORTS.forEach((resort) => {
    const name = rantsScopeName(resort.id);
    if (ft && name.toLowerCase().indexOf(ft) === -1) return;
    const n = rantsTopicCountFor(resort.id, tab);
    (n > 0 ? withTopics : without).push([resort.id, name, n]);
  });
  return { tab, ft, withTopics, without, matched: withTopics.length + without.length };
}

function rantsSheetRowsHtml(filterText) {
  const c = rantsSheetCounts(filterText);
  const tabName = c.tab === "raves" ? "Raves" : "Rants";

  if (c.matched === 0) {
    return `<p class="rants-sheet__nomatch body-md">No resort matches “${escapeHtml(filterText)}”. Try the full name, like “Jackson Hole”.</p>`;
  }

  let html = '<ul role="list">' +
    `<li><button type="button" data-pick=""${state.rants.scope ? "" : ' aria-current="true"'}>All resorts</button></li>` +
    c.withTopics.map(([id, name, n]) =>
      `<li><button type="button" data-pick="${escapeHtml(id)}"${state.rants.scope === id ? ' aria-current="true"' : ""}>` +
        `<span>${escapeHtml(name)}</span>` +
        // Counts render as "9 topics", never a bare number — a bare figure
        // beside a resort name is a score.
        `<span class="rants-sheet__count data-inline" aria-hidden="true">${escapeHtml(rantsCountPhrase(n))}</span>` +
        `<span class="visually-hidden">, ${escapeHtml(rantsCountPhrase(n))} in ${tabName}</span>` +
      "</button></li>").join("") +
    "</ul>";

  if (c.without.length) {
    const n = c.without.length;
    // Under a search this counts the MATCHES, so the wording switches to name
    // what it is counting rather than claiming a global fact while a search is
    // narrowing it.
    const summaryVis = c.ft
      ? `${n} ${n === 1 ? "match has" : "matches have"} nothing in ${tabName} right now`
      : `${n} ${n === 1 ? "resort has" : "resorts have"} nothing in ${tabName} right now`;
    const summaryA11y = `Show the ${n} ${c.ft ? "matching " : ""}${n === 1 ? "resort" : "resorts"} with no topics in ${tabName} in the last 14 days`;
    html += "<details><summary>" +
      `<span aria-hidden="true">${escapeHtml(summaryVis)}</span>` +
      `<span class="visually-hidden">${escapeHtml(summaryVis + ". " + summaryA11y)}</span></summary>` +
      '<p class="body-sm">Not enough people posted about these for a topic to form in the last 14 days. <b>That is not a rating.</b></p>' +
      '<ul role="list">' +
      c.without.map(([id, name]) => `<li><button type="button" data-pick="${escapeHtml(id)}">${escapeHtml(name)}</button></li>`).join("") +
      "</ul></details>";
  }
  return html;
}

// inert removes everything behind the sheet from hit-testing, from the tab
// order and from the accessibility tree in one declaration. aria-modal is a
// promise to a screen reader and nothing at all to a pointer: above 480px the
// sheet is a left panel, so without this the rest of the viewport stayed
// clickable, and a click "behind" the modal ran the router, replaced the view,
// and left the sheet open with its focus trap installed.
function rantsSetBackgroundInert(on) {
  const shell = document.querySelector(".app-shell");
  if (!shell) return;
  if (on) shell.setAttribute("inert", "");
  else shell.removeAttribute("inert");
}

function openRantsSheet(opener) {
  const sheet = rantsSheetEl();
  const scrim = document.getElementById("rants-sheet-scrim");
  if (!sheet || !scrim) return;
  // Stored as an ID, not as a node: picking a resort navigates, which rebuilds
  // the view and destroys the opener, so a live reference would be focused
  // after detaching and focus would fall to <body>.
  rantsSheetOpener = opener && opener.id ? opener.id : null;
  if (opener) opener.setAttribute("aria-expanded", "true");
  sheet.hidden = false;
  scrim.hidden = false;
  document.getElementById("rants-sheet-q").value = "";
  document.getElementById("rants-sheet-body").innerHTML = rantsSheetRowsHtml("");
  rantsSetBackgroundInert(true);
  requestAnimationFrame(() => {
    sheet.dataset.open = "true";
    scrim.dataset.open = "true";
    // Focus the dialog's own heading, not the search field. Autofocusing a text
    // input at 320px throws the on-screen keyboard over most of the list the
    // user opened the sheet to read, and it skips the dialog's accessible name
    // so nothing announces WHAT opened. The heading is the name.
    const h = document.getElementById("rants-sheet-title");
    if (h) h.focus();
  });
  document.addEventListener("keydown", rantsSheetKeys, true);
}

function closeRantsSheet(silent) {
  const sheet = rantsSheetEl();
  const scrim = document.getElementById("rants-sheet-scrim");
  if (!sheet || sheet.hidden) return;
  // NO CLOSE FADE, for anyone. The budget permits opacity fades; it does not
  // require them. Deferring the teardown is what creates a window in which an
  // invisible full-screen dialog is still in the layout eating taps. The OPEN
  // fade stays: opening is where the transition does orientation work, and
  // nothing is waiting on it.
  sheet.dataset.open = "false";
  scrim.dataset.open = "false";
  sheet.hidden = true;
  scrim.hidden = true;
  rantsSetBackgroundInert(false);
  document.removeEventListener("keydown", rantsSheetKeys, true);
  const openerId = rantsSheetOpener;
  rantsSheetOpener = null;
  if (silent) return;
  // Re-queried by id AFTER the render, for the same reason the sort control is.
  const el = openerId && document.getElementById(openerId);
  if (el) { el.setAttribute("aria-expanded", "false"); el.focus(); }
  else { const h = rantsPanelHeading(); if (h) h.focus(); }
}

function rantsSheetKeys(e) {
  const sheet = rantsSheetEl();
  if (!sheet || sheet.hidden) return;
  if (e.key === "Escape") { e.preventDefault(); closeRantsSheet(); return; }
  if (e.key !== "Tab") return;
  const f = Array.prototype.slice.call(
    sheet.querySelectorAll('a[href],button:not([disabled]),input,select,summary,[tabindex]:not([tabindex="-1"])')
  ).filter((el) => el.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  const i = f.indexOf(document.activeElement);
  // Focus starts on the sheet heading, which is tabindex="-1" and therefore not
  // in the list. Without this branch the first Shift+Tab walked straight out of
  // the dialog.
  if (i === -1) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function wireRantsSheet() {
  const sheet = rantsSheetEl();
  if (!sheet || sheet.dataset.wired === "true") return;
  sheet.dataset.wired = "true";

  document.getElementById("rants-sheet-close").addEventListener("click", () => closeRantsSheet());
  document.getElementById("rants-sheet-scrim").addEventListener("click", () => closeRantsSheet());

  const q = document.getElementById("rants-sheet-q");
  const body = document.getElementById("rants-sheet-body");

  q.addEventListener("input", () => {
    // Rebuilding on every keystroke collapsed an open <details> under the
    // user's fingers. It still rebuilds — the list is short and virtualising it
    // would be worse — but the disclosure's open state is carried across, and
    // the result count is announced once the typing settles rather than once
    // per character.
    const wasOpen = !!body.querySelector("details[open]");
    body.innerHTML = rantsSheetRowsHtml(q.value);
    const d = body.querySelector("details");
    if (d && wasOpen) d.setAttribute("open", "");
    clearTimeout(rantsSearchTimer);
    rantsSearchTimer = setTimeout(() => {
      const c = rantsSheetCounts(q.value);
      rantsAnnounce(c.matched === 0
        ? `No resort matches "${q.value}"`
        : `${c.matched} ${c.matched === 1 ? "resort matches" : "resorts match"}`);
    }, 400);
  });

  body.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pick]");
    if (!b) return;
    const id = b.getAttribute("data-pick") || null;
    const tabName = state.rants.tab === "raves" ? "Raves" : "Rants";
    closeRantsSheet(true);
    state.rants.scope = id;
    // Navigate rather than mutating state alone, so the filtered view is a
    // real, shareable, back-button-correct URL. hashchange does not fire when
    // the hash is unchanged, so the render is done here either way.
    const next = rantsCurrentHref();
    if (location.hash !== next) history.pushState(null, "", next);
    render();
    // Announce the OUTCOME, not the action. "Filter applied" tells a
    // screen-reader user nothing they could not infer; the count is the thing
    // that changed and the thing they cannot see.
    const label = id ? (rantsScopeName(id) || id) : "All resorts";
    const n = rantsSortedTopics(state.rants.tab, state.rants.scope, state.rants.sort).length;
    rantsAnnounce(`${tabName}, ${label} — ${rantsCountPhrase(n)}`);
    const btn = document.getElementById("rants-filter-btn");
    if (btn) { btn.setAttribute("aria-expanded", "false"); btn.focus(); }
  });
}
