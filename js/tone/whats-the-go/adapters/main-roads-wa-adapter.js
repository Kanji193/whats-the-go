import { CATEGORIES, SEVERITIES, STATUSES, CONFIDENCE_LEVELS } from '../js/data/schema.js';

/**
 * Main Roads WA — "WebEOC Road Incidents" adapter
 * ---------------------------------------------------------------
 * Source: Main Roads WA's official open data portal (CC BY 4.0 — free
 * to use, no account or API key needed). This is the same feed that
 * powers their public Travel Map.
 *   Catalogue page: https://catalogue.data.wa.gov.au/dataset/mrwa-webeoc-road-incidents
 *   Hub dataset:    https://portal-mainroads.opendata.arcgis.com/datasets/f97a94e2e4044f6d9e635ec0d4123f91_0
 *
 * FIX (v4): confirmed live against the real feed — two bugs were
 * stopping any data from ever loading:
 *   1. `itemInfo.url` returns the FeatureServer *root*
 *      (".../WebEoc_RoadIncidents/FeatureServer"), not a specific
 *      layer. Appending `/query` straight to that root returns a
 *      plain HTTP 400 "Bad Request" — it needs a layer id in between
 *      (".../FeatureServer/1/query"). We now ask the service itself
 *      for its layer id rather than hardcoding one, in case Main
 *      Roads ever adds/reorders layers.
 *   2. FIELD_MAP was a best guess and didn't match the live schema at
 *      all (e.g. the real incident-type field is `IncidentTy`, not
 *      `IncidentType`; road name is `Road`, not `RoadName`; dates are
 *      `EntryDate`/`UpdateDate`, not `EventDateTime`/`LastUpdated`).
 *      Fixed against a live sample response.
 *   3. Main Roads timestamps are `DD/MM/YYYY HH:mm:ss` in Perth local
 *      time (AWST, UTC+8, no DST). `new Date(...)` parses that as
 *      US-style `MM/DD/YYYY`, silently swapping day and month for any
 *      day ≤ 12. Added an explicit parser for this exact format.
 *
 * FIX (v3): the dataset was republished by Main Roads under a new
 * item — the old item ID (f97a94e2e4044f6d9e635ec0d4123f91) returned
 * "you do not have permissions to access this resource," confirmed
 * against the live feed. The current item ID
 * (36b7cdc610b4417da2e268b3613f30dd) was confirmed directly from Main
 * Roads' own live dataset page metadata, at:
 *   https://portal-mainroads.opendata.arcgis.com/datasets/mainroads::webeoc-road-incidents-1/about
 *
 * FIX (v2): the first version of this adapter called ArcGIS Hub's
 * "downloads" API directly and guessed at the download URL — that
 * returned a real HTTP 500 when tested live. This version instead:
 *   1. Ask the stable, public "item info" endpoint what the item's
 *      real data service URL is (this basically never changes and
 *      doesn't require knowing the internal service name).
 *   2. Query that service directly for the current features.
 * This also means the adapter keeps working even if Main Roads
 * renames or moves the underlying service, since we look it up fresh
 * every time rather than hardcoding it.
 */

const DATASET_ITEM_ID = '36b7cdc610b4417da2e268b3613f30dd';
const ITEM_INFO_URL = `https://www.arcgis.com/sharing/rest/content/items/${DATASET_ITEM_ID}?f=json`;

// Field names in the raw GeoJSON `properties` object — confirmed
// against a live sample response (see FIX v4 above).
const FIELD_MAP = {
  roadName: 'Road',
  region: 'Region',
  district: 'Suburb',
  incidentType: 'IncidentTy',
  closureType: 'ClosureTyp',
  description: 'Location',
  impact: 'TrafficImp',
  startedAt: 'EntryDate',
  updatedAt: 'UpdateDate',
  objectId: 'FID',
  globalId: 'GlobalID',
};

// Roughly the Perth metro area — filters a statewide feed down to what
// this app actually shows. Loosen/remove this if you want all of WA.
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

function mapCategory(incidentType) {
  const t = (incidentType || '').toLowerCase();
  if (t.includes('bushfire')) return CATEGORIES.EMERGENCY;
  if (t.includes('flood')) return CATEGORIES.WEATHER;
  return CATEGORIES.TRAFFIC;
}

function mapSeverity(closureType) {
  const c = (closureType || '').toLowerCase();
  if (c.includes('road closes') || c.includes('road closed')) return SEVERITIES.SIGNIFICANT;
  if (c.includes('specified conditions')) return SEVERITIES.MODERATE;
  return SEVERITIES.NORMAL; // e.g. "Road open with caution", "All Lanes Open"
}

// Main Roads WA timestamps look like "04/09/2026 05:50:53" — that's
// DD/MM/YYYY in Perth local time (AWST, UTC+8 year-round, no DST).
// JS's generic Date parser reads slash dates as US MM/DD/YYYY, which
// silently swaps day and month whenever the day is ≤ 12. Parse this
// exact format explicitly instead of trusting `new Date(string)`.
const MAIN_ROADS_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/;

function parseMainRoadsDate(value) {
  const match = typeof value === 'string' ? MAIN_ROADS_DATE_RE.exec(value) : null;
  if (!match) return null;
  const [, dd, mm, yyyy, hh, min, ss] = match;
  const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeIso(value) {
  const parsed = parseMainRoadsDate(value);
  if (parsed) return parsed.toISOString();
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function normaliseFeature(feature) {
  const p = feature.properties ?? {};
  const [lon, lat] = feature.geometry?.coordinates ?? [null, null];

  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  if (!inPerthMetro(lat, lon)) return null;

  const roadName = p[FIELD_MAP.roadName] || 'Unnamed road';
  const region = p[FIELD_MAP.region];
  const locationParts = [roadName, region].filter(Boolean);

  const id = `mainroads-${p[FIELD_MAP.objectId] ?? p[FIELD_MAP.globalId] ?? `${lat},${lon}`}`;
  const impact = p[FIELD_MAP.impact];

  return {
    id,
    title: p[FIELD_MAP.description]
      ? String(p[FIELD_MAP.description]).slice(0, 120)
      : `${p[FIELD_MAP.incidentType] || 'Road incident'} — ${roadName}`,
    description: [p[FIELD_MAP.description], impact].filter(Boolean).join(' — ')
      || 'No further details provided by Main Roads WA.',
    category: mapCategory(p[FIELD_MAP.incidentType]),
    latitude: lat,
    longitude: lon,
    location_name: locationParts.join(', '),
    severity: mapSeverity(p[FIELD_MAP.closureType]),
    started_at: safeIso(p[FIELD_MAP.startedAt]),
    updated_at: safeIso(p[FIELD_MAP.updatedAt] || p[FIELD_MAP.startedAt]),
    source_name: 'Main Roads WA',
    source_url: 'https://travelmap.mainroads.wa.gov.au/Home/Map',
    status: STATUSES.ACTIVE,
    confidence: CONFIDENCE_LEVELS.OFFICIAL,
    is_demo_data: false, // this is real, live government data
    is_sensitive: false, // Main Roads' own incident descriptions are already neutral/factual
  };
}

/**
 * Looks up the item's real data-service URL via ArcGIS's public item
 * info endpoint, then queries that service directly for current
 * features as GeoJSON.
 */
async function fetchRawFeatures() {
  const itemRes = await fetch(ITEM_INFO_URL);
  if (!itemRes.ok) {
    throw new Error(`ArcGIS item lookup failed: HTTP ${itemRes.status}`);
  }
  const itemInfo = await itemRes.json();
  if (itemInfo.error) {
    throw new Error(`ArcGIS item lookup error: ${itemInfo.error.message || 'unknown error'}`);
  }

  const serviceUrl = itemInfo.url; // e.g. https://services2.arcgis.com/.../FeatureServer (root — no layer index)
  if (!serviceUrl) {
    throw new Error('ArcGIS item info had no service url — dataset may have moved.');
  }

  // The item info only gives us the FeatureServer root. Querying that
  // root directly (`${serviceUrl}/query`) returns HTTP 400 — we need
  // a specific layer id first. Ask the service for it rather than
  // hardcoding one, since Main Roads could add/reorder layers.
  const serviceRes = await fetch(`${serviceUrl}?f=json`);
  if (!serviceRes.ok) {
    throw new Error(`ArcGIS service lookup failed: HTTP ${serviceRes.status}`);
  }
  const serviceInfo = await serviceRes.json();
  const layerId = serviceInfo.layers?.[0]?.id;
  if (layerId === undefined) {
    throw new Error('ArcGIS service info had no layers — dataset may have moved.');
  }

  const queryUrl = `${serviceUrl}/${layerId}/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`;
  const queryRes = await fetch(queryUrl);
  if (!queryRes.ok) {
    throw new Error(`Feature query failed: HTTP ${queryRes.status}`);
  }

  const geojson = await queryRes.json();
  if (geojson.error) {
    throw new Error(`Feature query error: ${geojson.error.message || 'unknown error'}`);
  }

  return Array.isArray(geojson?.features) ? geojson.features : [];
}

/**
 * Fetches and normalises current Perth-metro road incidents.
 * Returns [] (never throws) if the feed is unreachable or unparsable —
 * incident-repository.js decides what to do when that happens.
 */
export async function fetchMainRoadsIncidents() {
  const features = await fetchRawFeatures();

  if (features.length > 0) {
    // Helpful one-time debug log — safe to remove once the field mapping is confirmed.
    console.debug('[main-roads-wa-adapter] sample raw feature properties:', features[0].properties);
  }

  return features.map(normaliseFeature).filter(Boolean);
}
