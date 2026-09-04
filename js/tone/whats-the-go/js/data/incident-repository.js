import { fetchMainRoadsIncidents } from '../../adapters/main-roads-wa-adapter.js';
import { fetchEmergencyIncidents, fetchEmergencyWarnings, fetchEmergencyClosures } from '../../adapters/emergency-wa-adapter.js';
import { fetchPowerOutages } from '../../adapters/western-power-adapter.js';
import { dedupeIncidents } from './dedupe.js';

/**
 * IncidentRepository
 * ---------------------------------------------------------------
 * This is the ONLY place in the app that knows where incident data
 * comes from. Every UI component asks this repository for data —
 * never a source adapter directly.
 *
 * Live sources wired in so far:
 *   - Main Roads WA        → traffic
 *   - Emergency WA (DFES)  → emergency (incidents + warnings),
 *                             weather (warnings routed by CAP category),
 *                             other (park/facility closures)
 *   - Western Power        → power outages
 *
 * Not covered by a live source yet:
 *   - Shark: SharkSmart WA has no public API right now (site is
 *     "under construction" as of this check) — nothing to wire up.
 *   - Transport: Transperth's service-updates page is legacy
 *     server-rendered HTML (DotNetNuke) with no JSON/XML feed and no
 *     per-disruption coordinates, so it doesn't fit this app's
 *     point-marker map without a lot more scraping work.
 *   - Council notices: no unified feed exists across WA's ~30 Perth
 *     metro councils — would mean one scraper per council.
 *
 * MOCK_INCIDENTS is no longer used anywhere — this app only ever shows
 * real, live data. ./mock-incidents.js is left on disk, unused, in
 * case it's useful again for local development later.
 *
 * Each source is fetched independently and wrapped in its own
 * try/catch: if one feed is unreachable or changes shape, it logs a
 * warning and simply contributes nothing, rather than taking down
 * every other source or the app itself.
 *
 * Adding the next real source later means adding another
 * fetchXAdapter() call here, in the same try/catch pattern. Nothing
 * outside this file needs to change, because everything returned is
 * already in the common schema defined in schema.js.
 *
 * After every source is merged, dedupeIncidents() (./dedupe.js) collapses
 * near-duplicates — same category, close together, close in time — down
 * to one representative each. This matters most for Emergency WA, whose
 * own /incidents and /warnings endpoints can both carry an entry for the
 * same real-world event.
 */

const SOURCES = [
  { label: 'Main Roads WA', fetch: fetchMainRoadsIncidents },
  { label: 'Emergency WA incidents', fetch: fetchEmergencyIncidents },
  { label: 'Emergency WA warnings', fetch: fetchEmergencyWarnings },
  { label: 'Emergency WA closures', fetch: fetchEmergencyClosures },
  { label: 'Western Power', fetch: fetchPowerOutages },
];

class IncidentRepository {
  async getAll() {
    const results = await Promise.all(
      SOURCES.map(async ({ label, fetch: fetchSource }) => {
        try {
          return await fetchSource();
        } catch (err) {
          console.warn(`[incident-repository] Could not load the live ${label} feed — it will contribute no incidents. Reason:`, err);
          return [];
        }
      })
    );

    return dedupeIncidents(results.flat());
  }

  async getById(id) {
    const all = await this.getAll();
    return all.find((incident) => incident.id === id) ?? null;
  }
}

export const incidentRepository = new IncidentRepository();
