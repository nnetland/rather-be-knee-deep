// ---------------------------------------------------------------------------
// Opening days, 2026–27. Researched 2026-10-26 from each resort's own site or
// press coverage. One source of truth for "is it open?" across Chase and
// Quiver, replacing the per-page "not every resort is open yet" explainer
// with the fact itself: Open, or Opens Nov 20.
//
// status:
//   "opened"    — confirmed open for the season on `date`.
//   "scheduled" — a published target date. Once it passes, the resort is
//                 treated as open. Resorts do slip a day or a week; the
//                 bottom-of-page "About this data" says so once, rather than
//                 every row hedging.
//   unknown     — no published date (entry absent or date null). Falls back
//                 to the dataset's typical window ("Usually mid-Nov") and to
//                 seasonFraction() for the open/closed call.
//
// Refresh before each season (alongside requirements T3).
// ---------------------------------------------------------------------------

const OPENINGS_SEASON = "2026-27";
const OPENINGS = /*__OPENINGS_JSON__*/{};

function parseIsoDay(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0);
}

function shortDate(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * { open, label, date, known } for a resort right now.
 *   label: "Open" | "Opens Nov 20" | "Usually mid-Nov"
 * `open` drives filtering; `label` is the only copy the UI prints.
 */
function resortOpening(resort, now) {
  now = now || appNow();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const entry = OPENINGS[resort.id];
  const date = entry && entry.date ? parseIsoDay(entry.date) : null;
  if (date) {
    if (date <= today) return { open: true, label: "Open", date, known: true };
    return { open: false, label: `Opens ${shortDate(date)}`, date, known: true };
  }
  const typical = typicalOpenDate(resort, now);
  if (entry) {
    // Researched this season, nothing announced. Not open — until two weeks
    // past its usual opening day, after which an unannounced resort is far
    // more likely open than closed and a stale "TBA" would be the bigger lie.
    if (typical && today.getTime() > typical.getTime() + 14 * 864e5 && seasonFraction(resort, now) >= SEASON_OPEN_FRACTION) {
      return { open: true, label: "Open", date: null, known: false };
    }
    return { open: false, label: typical && typical > today ? `Usually ${typicalPhrase(resort)}` : "Opening TBA", date: null, known: false };
  }
  // Not in this season's research at all: the typical window decides.
  const open = seasonFraction(resort, now) >= SEASON_OPEN_FRACTION;
  if (open) return { open: true, label: "Open", date: null, known: false };
  return { open: false, label: typicalPhrase(resort) ? `Usually ${typicalPhrase(resort)}` : "Opening TBA", date: null, known: false };
}

function typicalPhrase(resort) {
  const t = String(resort.season_open || "").replace(/\s*\(.*\)\s*$/, "").trim();
  if (!t) return "";
  return t.replace(/^Mid-/, "mid-").replace(/^Early /, "early ").replace(/^Late /, "late ");
}

/** The dataset's typical opening ("Mid-Nov") as a date in the coming season. */
function typicalOpenDate(resort, now) {
  const b = parseSeasonBoundary(resort.season_open);
  if (!b) return null;
  now = now || appNow();
  // Season year: Jul–Dec belongs to the season starting this year.
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(startYear + (b.month < 6 ? 1 : 0), b.month, b.day);
}

/** Sort key for not-yet-open resorts: published date first, then typical. */
function openingSortKey(resort, now) {
  const o = resortOpening(resort, now);
  if (o.date) return o.date.getTime();
  const t = typicalOpenDate(resort, now);
  return t ? t.getTime() + 1 : Number.MAX_SAFE_INTEGER; // after any same-day published date
}

/** "9:42 PM" today, "Yesterday 9:42 PM", or "Oct 24, 9:42 PM". */
function updatedStamp(ms, now) {
  if (!ms) return null;
  now = now || appNow();
  const d = new Date(ms);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, now)) return time;
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (sameDay(d, y)) return `Yesterday ${time}`;
  return `${shortDate(d)}, ${time}`;
}

// ---------------------------------------------------------------------------
// Page chrome shared by every surface: a fact line under the h1, and one
// "About this data" disclosure at the bottom. The pattern is
//   title → one line of facts → content → (details, if you want them)
// Facts render as a list so a screen reader hears separate items, not a run
// of middle dots.
// ---------------------------------------------------------------------------
function pageMetaHtml(items, id) {
  const parts = items.filter(Boolean);
  if (!parts.length) return "";
  return `<ul class="page-meta body-sm"${id ? ` id="${id}"` : ""}>${parts.map((p) => `<li>${p}</li>`).join("")}</ul>`;
}

function pageAboutHtml(title, bodyHtml, id) {
  return `
    <details class="page-about"${id ? ` id="${id}"` : ""}>
      <summary class="body-sm">${escapeHtml(title)}</summary>
      <div class="page-about__body body-sm">${bodyHtml}</div>
    </details>`;
}
