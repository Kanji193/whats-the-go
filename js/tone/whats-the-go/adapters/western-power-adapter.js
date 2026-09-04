import { CATEGORIES, SEVERITIES, STATUSES, CONFIDENCE_LEVELS } from '../js/data/schema.js';

/**
 * Western Power outage adapter
 * ---------------------------------------------------------------
 * Source: Western Power's public power-outage map. Western Power's own
 * first-party API (www.westernpower.com.au/api/corp/outage/all-outages)
 * returns clean point coordinates, but — confirmed live, tested from
 * this app's own localhost:8000 origin — it blocks cross-origin fetch
 * with no CORS headers, so a browser-only app like this one can never
 * call it directly (a server-side proxy could, but that's a different
 * architecture — see note at the bottom of this file).
 *
 * Instead, the same outage data is hosted on ArcGIS Online (like Main
 * Roads WA), which DOES allow cross-origin requests:
 *   https://services2.arcgis.com/tBLxde4cxSlNUxsM/ArcGIS/rest/services/WP_Outage_Prod/FeatureServer/0
 *
 * Two differences from that first-party API, both handled below:
 *   1. Geometry here is the outage-area POLYGON, not a point — this
 *      app places single pins, so we compute each polygon's
 *      bounding-box centre as a stand-in marker location.
 *   2. Timestamps are `DD/MM/YYYY hh:mm AM/PM` in Perth local time
 *      (AWST, UTC+8, no DST) — a different format again from both the
 *      Main Roads (`DD/MM/YYYY HH:mm:ss`) and Emergency WA (proper
 *      ISO 8601) adapters. Parsed explicitly, same reasoning as those.
 */

const QUERY_URL =
  'https://services2.arcgis.com/tBLxde4cxSlNUxsM/ArcGIS/rest/services/WP_Outage_Prod/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson';
const SOURCE_URL = 'https://www.westernpower.com.au/outages/';

const PERTH_METRO_BOUNDS = {
  minLat: -32.7,
  maxLat: -31.4,
  minLon: 115.5,
  maxLon: 116.3,
};

function inPerthMetro(lat, lon) {
  return (
    lat >= PERTH_METRO_BOUNDS.minLat &&
    lat <= PERTH_METRO_BOUNDS.maxLat &&
    lon >= PERTH_METRO_BOUNDS.minLon &&
    lon <= PERTH_METRO_BOUNDS.maxLon
  );
}

/** Bounding-box centre of a Polygon or MultiPolygon's outer ring(s). */
function centroidOf(geometry) {
  if (!geometry) return null;
  const rings =
    geometry.type === 'Polygon'
      ? geometry.coordinates
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates.flat()
        : null;
  if (!rings) return null;

  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  if (!Number.isFinite(minLon) || !Number.isFinite(minLat)) return null;
  return { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 };
}

// "31/05/2026 12:08 PM" — DD/MM/YYYY hh:mm AM/PM, Perth local time.
const WP_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i;

function parseWesternPowerDate(value) {
  const match = typeof value === 'string' ? WP_DATE_RE.exec(value.trim()) : null;
  if (!match) return null;
  const [, dd, mm, yyyy, hh12, min, ampm] = match;
  let hh = Number(hh12) % 12;
  if (ampm.toUpperCase() === 'PM') hh += 12;
  const hhStr = String(hh).padStart(2, '0');
  const d = new Date(`${yyyy}-${mm}-${dd}T${hhStr}:${min}:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeIso(value) {
  const parsed = parseWesternPowerDate(value);
  if (parsed) return parsed.toISOString();
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function mapSeverity(plannedOutage, customersImpacted) {
  const isPlanned = (plannedOutage || '').toLowerCase() === 'planned';
  const n = Number(customersImpacted) || 0;
  if (isPlanned) return SEVERITIES.NORMAL;
  if (n >= 500) return SEVERITIES.SEVERE;
  if (n >= 100) return SEVERITIES.SIGNIFICANT;
  if (n >= 10) return SEVERITIES.MODERATE;
  return SEVERITIES.NORMAL;
}

function normaliseOutage(feature) {
  const p = feature.properties ?? {};
  const centre = centroidOf(feature.geometry);
  if (!centre || !inPerthMetro(centre.lat, centre.lon)) return null;

  const areas = (p.AFFECTED_AREA || '').split(',').map((s) => s.trim()).filter(Boolean);
  const isPlanned = (p.PLANNEDOUTAGE || '').toLowerCase() === 'planned';
  const customers = Number(p.NOCUSTOMERSIMPACTED) || 0;

  return {
    id: `westernpower-${p.OBJECTID ?? p.INCIDENTREF}`,
    title: `${isPlanned ? 'Planned power outage' : 'Power outage'} — ${areas[0] || 'Perth metro'}`,
    description: `${customers} customer${customers === 1 ? '' : 's'} affected${areas.length ? ' in ' + areas.slice(0, 3).join(', ') : ''}.${
      p.ESTIMATEDRESTORATIONTIME ? ` Estimated restoration: ${p.ESTIMATEDRESTORATIONTIME} (Perth time).` : ''
    }`,
    category: CATEGORIES.POWER,
    latitude: centre.lat,
    longitude: centre.lon,
    location_name: areas.slice(0, 2).join(', ') || 'Perth metro',
    severity: mapSeverity(p.PLANNEDOUTAGE, customers),
    started_at: safeIso(p.OUTAGESTARTTIME),
    updated_at: safeIso(p.OUTAGESTARTTIME),
    source_name: 'Western Power',
    source_url: SOURCE_URL,
    status: STATUSES.ACTIVE,
    confidence: CONFIDENCE_LEVELS.OFFICIAL,
    is_demo_data: false,
    is_sensitive: false, // outage counts/areas — not a safety-sensitive category
  };
}

export async function fetchPowerOutages() {
  const res = await fetch(QUERY_URL);
  if (!res.ok) throw new Error(`Western Power outage query failed: HTTP ${res.status}`);
  const geojson = await res.json();
  if (geojson.error) throw new Error(`Western Power outage query error: ${geojson.error.message || 'unknown error'}`);
  const features = Array.isArray(geojson.features) ? geojson.features : [];
  return features.map(normaliseOutage).filter(Boolean);
}

/*
 * If Western Power's ArcGIS mirror ever goes away, the first-party API
 * (richer data, real point coordinates, no polygon math needed) is:
 *   https://www.westernpower.com.au/api/corp/outage/all-outages
 * It just needs a same-origin request — e.g. a one-line serverless
 * function that fetches it server-side and re-serves the JSON with
 * permissive CORS headers, since this app has no backend of its own today.
 */
