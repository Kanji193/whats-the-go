import { CATEGORIES } from '../data/schema.js';

/**
 * One-line "what's going on" situational summary, shown above the feed.
 * Built from the full incident set (not the filtered view) so it always
 * answers the app's core question regardless of what filters are active.
 */

const SUMMARY_NOUN = {
  [CATEGORIES.EMERGENCY]: 'emergency incident',
  [CATEGORIES.TRAFFIC]: 'road closure',
  [CATEGORIES.POWER]: 'power outage',
  [CATEGORIES.WEATHER]: 'weather warning',
  [CATEGORIES.TRANSPORT]: 'transport disruption',
  [CATEGORIES.SHARK]: 'shark alert',
  [CATEGORIES.OTHER]: 'other incident',
};

// Safety-relevant categories lead the sentence, regardless of count.
const PRIORITY_ORDER = [
  CATEGORIES.EMERGENCY,
  CATEGORIES.WEATHER,
  CATEGORIES.SHARK,
  CATEGORIES.TRAFFIC,
  CATEGORIES.POWER,
  CATEGORIES.TRANSPORT,
  CATEGORIES.OTHER,
];

function pluralize(noun, count) {
  return count === 1 ? noun : `${noun}s`;
}

function joinWithAnd(parts) {
  if (parts.length <= 1) return parts.join('');
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** Returns a plain-English one-liner, e.g. "8 emergency incidents, 118 power outages and 3 road closures right now." */
export function buildSituationSummary(incidents) {
  if (incidents.length === 0) {
    return "Nothing showing on any live feed right now — doesn't mean nothing's happening, just nothing reported.";
  }

  const counts = {};
  incidents.forEach((incident) => {
    counts[incident.category] = (counts[incident.category] || 0) + 1;
  });

  const parts = PRIORITY_ORDER
    .filter((cat) => counts[cat] > 0)
    .map((cat) => `${counts[cat]} ${pluralize(SUMMARY_NOUN[cat], counts[cat])}`);

  return `${joinWithAnd(parts)} right now.`;
}
