import { CATEGORIES, SEVERITIES, STATUSES, CONFIDENCE_LEVELS } from '../js/data/schema.js';

/**
 * Emergency WA (DFES) adapter
 * ---------------------------------------------------------------
 * Source: emergency.wa.gov.au — the WA government's public incidents/
 * warnings site, run by DFES. It's a public, no-key JSON API (found by
 * inspecting the network requests the site itself makes — there is no
 * published API doc, so field names here are confirmed against a live
 * sample response, same approach as the Main Roads WA adapter).
 *
 * Confirmed live and CORS-open from an arbitrary origin (tested from
 * this app's own localhost:8000):
 *   https://api.emergency.wa.gov.au/v1/incidents          → { incidents: [...] }
 *   https://api.emergency.wa.gov.au/v1/warnings            → { warnings: [...] }
 *   https://api.emergency.wa.gov.au/v1/outages-closures    → { outagesClosures: [...] }
 *
 * This one government feed covers THREE of the app's categories:
 *   - fetchEmergencyIncidents() → category: emergency  (bushfire, structure fire, hazmat)
 *   - fetchEmergencyWarnings()  → category: emergency OR weather, routed by the
 *                                  official CAP category on each warning (see
 *                                  CAP_CATEGORY_TO_APP_CATEGORY below)
 *   - fetchEmergencyClosures()  → category: other      (park/facility closures)
 *
 * No dedicated live source was found for the Weather category on its
 * own — BOM's WA warnings page (bom.gov.au/wa/warnings) is a legacy,
 * server-rendered HTML page with no JSON/XML feed behind it, and
 * warnings there are area/polygon-based rather than point incidents,
 * which doesn't fit this app's point-marker map well. This warnings
 * endpoint is the practical substitute: it already carries met/flood/
 * storm-type CAP categories with a point location when Emergency WA
 * chooses to publish one, alongside DFES's own fire/hazmat warnings.
 */

const BASE_URL = 'https://api.emergency.wa.gov.au/v1';
const SOURCE_URL = 'https://emergency.wa.gov.au';

// Roughly the Perth metro area — same bounds used by the Main Roads WA
// adapter, so all sources agree on what counts as "Perth" for this app.
const PERTH_METRO_BOUNDS = {
  minLat: -32.7,
  maxLat: -31.4,
  minLon: 115.5,
  maxLon: 116.3,
};

function inPerthMetro(lat, lon) {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    lat >= PERTH_METRO_BOUNDS.minLat &&
    lat <= PERTH_METRO_BOUNDS.maxLat &&
    lon >= PERTH_METRO_BOUNDS.minLon &&
    lon <= PERTH_METRO_BOUNDS.maxLon
  );
}

// CAP (Common Alerting Protocol) categories are a fixed, standard set
// used across Australian emergency feeds. Route each to the category
// this app actually has. Anything not listed here defaults to
// 'emergency' — a false positive in that category is far safer than a
// warning silently vanishing into a category no one's looking at.
const CAP_CATEGORY_TO_APP_CATEGORY = {
  Met: CATEGORIES.WEATHER,
  Env: CATEGORIES.WEATHER,
  Transport: CATEGORIES.TRANSPORT,
  Infra: CATEGORIES.OTHER,
};

function mapCapCategory(capCategory) {
  return CAP_CATEGORY_TO_APP_CATEGORY[capCategory] || CATEGORIES.EMERGENCY;
}

// cap-severity looks like "Extreme - extraordinary threat" — match on
// the leading word rather than the whole string, since the trailing
// description text isn't standardised as tightly.
function mapCapSeverity(capSeverity) {
  const s = (capSeverity || '').toLowerCase();
  if (s.startsWith('extreme') || s.startsWith('severe')) return SEVERITIES.SEVERE;
  if (s.startsWith('moderate')) return SEVERITIES.SIGNIFICANT;
  if (s.startsWith('minor')) return SEVERITIES.MODERATE;
  return SEVERITIES.NORMAL;
}

// /v1/incidents has no cap-severity field at all — derive a rough
// severity from the incident type instead, since that's all it gives us.
function mapIncidentSeverity(incidentType, incidentStatus) {
  if (incidentStatus === 'Monitoring') return SEVERITIES.MODERATE;
  const t = (incidentType || '').toLowerCase();
  if (t.includes('hazardous')) return SEVERITIES.SEVERE;
  if (t.includes('structure fire') || t.includes('bushfire')) return SEVERITIES.SIGNIFICANT;
  return SEVERITIES.NORMAL;
}

function mapIncidentStatus(incidentStatus) {
  return incidentStatus === 'Monitoring' ? STATUSES.MONITORING : STATUSES.ACTIVE;
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function safeIso(value) {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function locationName(item) {
  const parts = [item.location?.value, ...(item.suburbs || [])];
  // location.value often repeats a suburb already in `suburbs` — dedupe.
  return [...new Set(parts.filter(Boolean))].slice(0, 2).join(', ');
}

function normaliseIncident(item) {
  const lat = item.location?.latitude;
  const lon = item.location?.longitude;
  if (typeof lat !== 'number' || typeof lon !== 'number' || !inPerthMetro(lat, lon)) return null;

  const type = item['incident-type'] || 'Incident';
  const status = item['incident-status'];

  return {
    id: `dfes-incident-${item.id || item['cad-id']}`,
    title: `${type}${item.location?.value ? ' — ' + item.location.value : ''}`,
    description: `${type} reported${item.location?.value ? ' at ' + item.location.value : ''}${item.suburbs?.length ? ', ' + item.suburbs.join(', ') : ''}. Status: ${status || 'unknown'}.`,
    category: CATEGORIES.EMERGENCY,
    latitude: lat,
    longitude: lon,
    location_name: locationName(item),
    severity: mapIncidentSeverity(type, status),
    started_at: safeIso(item['start-date-time'] || item['issued-date-time']),
    updated_at: safeIso(item['updated-date-time'] || item['updatedAt']),
    source_name: 'DFES / Emergency WA',
    source_url: SOURCE_URL,
    status: mapIncidentStatus(status),
    confidence: CONFIDENCE_LEVELS.OFFICIAL,
    is_demo_data: false,
    is_sensitive: true, // active fire/hazmat incidents — always treat as sensitive
  };
}

function normaliseWarning(item) {
  const lat = item.location?.latitude;
  const lon = item.location?.longitude;
  if (typeof lat !== 'number' || typeof lon !== 'number' || !inPerthMetro(lat, lon)) return null;

  return {
    id: `dfes-warning-${item.id}`,
    title: item.headline || item.name || item['warning-type'] || 'Emergency warning',
    description: stripHtml(item['alert-line']) || 'No further details provided.',
    category: mapCapCategory(item['cap-category']),
    latitude: lat,
    longitude: lon,
    location_name: locationName(item),
    severity: mapCapSeverity(item['cap-severity']),
    started_at: safeIso(item['issued-date-time']),
    updated_at: safeIso(item['updatedAt'] || item['published-date-time']),
    source_name: 'Emergency WA',
    source_url: SOURCE_URL,
    status: STATUSES.ACTIVE,
    confidence: CONFIDENCE_LEVELS.OFFICIAL,
    is_demo_data: false,
    is_sensitive: true, // warnings are inherently about risk to people/property
  };
}

function normaliseClosure(item) {
  const lat = item.location?.latitude;
  const lon = item.location?.longitude;
  if (typeof lat !== 'number' || typeof lon !== 'number' || !inPerthMetro(lat, lon)) return null;

  return {
    id: `dfes-closure-${item.id}`,
    title: item.headline || item.name || 'Closure',
    description: stripHtml(item['what-to-do-note']) || item.headline || 'No further details provided.',
    category: CATEGORIES.OTHER,
    latitude: lat,
    longitude: lon,
    location_name: locationName(item),
    severity: mapCapSeverity(item['cap-severity']),
    started_at: safeIso(item['issued-date-time']),
    updated_at: safeIso(item['updatedAt'] || item['published-date-time']),
    source_name: 'Emergency WA',
    source_url: SOURCE_URL,
    status: STATUSES.ACTIVE,
    confidence: CONFIDENCE_LEVELS.OFFICIAL,
    is_demo_data: false,
    is_sensitive: false, // park/facility closures — not a safety-sensitive category
  };
}

async function fetchJson(path) {
  const res = await fetch(`${BASE_URL}/${path}`);
  if (!res.ok) throw new Error(`Emergency WA ${path} lookup failed: HTTP ${res.status}`);
  return res.json();
}

export async function fetchEmergencyIncidents() {
  const data = await fetchJson('incidents');
  const list = Array.isArray(data.incidents) ? data.incidents : [];
  return list.map(normaliseIncident).filter(Boolean);
}

export async function fetchEmergencyWarnings() {
  const data = await fetchJson('warnings');
  const list = Array.isArray(data.warnings) ? data.warnings : [];
  return list.map(normaliseWarning).filter(Boolean);
}

export async function fetchEmergencyClosures() {
  const data = await fetchJson('outages-closures');
  const list = Array.isArray(data.outagesClosures) ? data.outagesClosures : [];
  return list.map(normaliseClosure).filter(Boolean);
}
