import { distanceKm } from '../ui/distance.js';

/**
 * Incident deduplication
 * ---------------------------------------------------------------
 * Deliberately simple, exactly as scoped in adapters/README.md: match
 * on category + rough geographic proximity + overlapping time window,
 * nothing fancier (no text/title similarity matching).
 *
 * Real case this catches today: the Emergency WA adapter's own
 * `/incidents` and `/warnings` endpoints can both carry an entry for
 * the same real-world fire — same category, same spot, issued minutes
 * apart. Also guards against two *different* sources (e.g. Main Roads
 * and DFES) both reporting the same event, if that ever happens.
 *
 * Doesn't merge fields from the duplicates together — just picks the
 * single best representative from each group and drops the rest. That
 * keeps the result trustworthy: every incident on the map still came
 * from exactly one place, traceable via its own source_name/source_url.
 */

const MAX_DISTANCE_KM = 0.5; // ~500m — "the same spot" for a city-wide map
const MAX_TIME_DIFF_MS = 90 * 60 * 1000; // 90 minutes apart still counts as the same event

const CONFIDENCE_RANK = { official: 2, likely: 1, unverified: 0 };

function isLikelyDuplicate(a, b) {
  if (a.category !== b.category) return false;
  if (distanceKm(a.latitude, a.longitude, b.latitude, b.longitude) > MAX_DISTANCE_KM) return false;
  const timeDiff = Math.abs(new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
  return timeDiff <= MAX_TIME_DIFF_MS;
}

/** Of a group of duplicates, keep the most trustworthy / most informative one. */
function pickBest(group) {
  return group.reduce((best, candidate) => {
    const bestRank = CONFIDENCE_RANK[best.confidence] ?? 0;
    const candidateRank = CONFIDENCE_RANK[candidate.confidence] ?? 0;
    if (candidateRank !== bestRank) return candidateRank > bestRank ? candidate : best;

    const bestLen = (best.description || '').length;
    const candidateLen = (candidate.description || '').length;
    if (candidateLen !== bestLen) return candidateLen > bestLen ? candidate : best;

    return new Date(candidate.updated_at) > new Date(best.updated_at) ? candidate : best;
  }, group[0]);
}

/**
 * Collapses near-duplicate incidents (same category, close together,
 * close in time) into one representative incident each. Union-find
 * over all pairs so duplicate *chains* (A~B, B~C) still merge into one
 * group even if A and C alone wouldn't have matched.
 */
export function dedupeIncidents(incidents) {
  const n = incidents.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(i) {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }
  function union(i, j) {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent[ri] = rj;
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (isLikelyDuplicate(incidents[i], incidents[j])) union(i, j);
    }
  }

  const groups = new Map();
  incidents.forEach((incident, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(incident);
  });

  return [...groups.values()].map(pickBest);
}
