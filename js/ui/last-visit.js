/**
 * "Since you last looked" — tracks which incident ids were already on
 * screen last time this browser opened the app, so the feed can badge
 * genuinely new ones.
 * ---------------------------------------------------------------
 * Deliberately ID-diffing rather than a time threshold: source timestamps
 * (updated_at especially) get touched by upstream re-polls even when
 * nothing about the incident actually changed, so comparing against a
 * "last visit" clock would badge things that aren't really new. Comparing
 * the actual set of ids we showed last time is simpler and correct.
 *
 * Lives in localStorage, so it's per-browser/per-device, not synced
 * anywhere — that's fine for what this is.
 */

const SEEN_IDS_KEY = 'wtg:lastSeenIncidentIds';
const LAST_VISIT_KEY = 'wtg:lastVisitAt';
const MAX_STORED_IDS = 500; // guard against unbounded growth of the stored list

function readPreviousSeenIds() {
  try {
    const raw = localStorage.getItem(SEEN_IDS_KEY);
    if (!raw) return null; // null = "no prior visit recorded", distinct from an empty set
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? new Set(ids) : null;
  } catch {
    return null; // storage unavailable/corrupt — just treat as first visit
  }
}

/**
 * Computes which of `incidents` are new since the last visit, then
 * records the current set for next time. Returns a Set of new incident
 * ids — empty on a browser's very first visit (nothing to compare against
 * yet, so nothing is badged "new").
 */
export function diffAndRecordVisit(incidents) {
  const previousIds = readPreviousSeenIds();
  const currentIds = incidents.map((i) => i.id);

  const newIds = previousIds
    ? new Set(currentIds.filter((id) => !previousIds.has(id)))
    : new Set(); // first-ever visit: nothing to badge

  try {
    localStorage.setItem(SEEN_IDS_KEY, JSON.stringify(currentIds.slice(0, MAX_STORED_IDS)));
    localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
  } catch {
    // best-effort — a private window or full storage just means next visit badges everything again
  }

  return newIds;
}

/** ISO timestamp of the previous visit, or null if this is the first one. */
export function getLastVisitAt() {
  try {
    return localStorage.getItem(LAST_VISIT_KEY);
  } catch {
    return null;
  }
}
