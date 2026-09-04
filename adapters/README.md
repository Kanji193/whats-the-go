# Data source adapters

## Status: 3 live sources wired in, confirmed against the real feeds

| Adapter | Source | Categories | CORS |
|---|---|---|---|
| `main-roads-wa-adapter.js` | Main Roads WA (ArcGIS-hosted, CC BY 4.0) | traffic | Open |
| `emergency-wa-adapter.js` | Emergency WA / DFES (`api.emergency.wa.gov.au`, undocumented but open) | emergency, weather, other | Open |
| `western-power-adapter.js` | Western Power outages, via their ArcGIS mirror | power | Open (their first-party API is not — see file header) |

All three were tested against live responses (not just built against
guessed field names) and are wired into `js/data/incident-repository.js`,
which calls them all in parallel and merges whatever comes back.
`mock-incidents.js` is no longer used anywhere.

**Not wired up, and why:**
- **Shark** — SharkSmart WA (`sharksmart.com.au`) has no public API;
  its site is "under construction" and only offers a mobile app.
- **Transport** — Transperth's service-updates page is legacy
  server-rendered HTML (DotNetNuke) with no JSON/XML feed and no
  per-disruption coordinates.
- **Council notices** — no unified feed exists across WA's ~30 Perth
  metro councils; would need one scraper per council.

If any of these change (SharkSmart ships a real site, a council
publishes open data, etc.), re-check with the same approach used for
the three live ones: load the source's own public page, inspect what
API calls its own frontend makes (`performance.getEntriesByType
('resource')` in the browser console is the fastest way), and confirm
whatever endpoint you find actually allows cross-origin requests from
a different origin — several promising-looking APIs during this pass
turned out to block that (see the Western Power adapter's file header
for a worked example, including the ArcGIS-mirror workaround).

---

This note describes the general shape adapters should take for any
future source beyond this first one.

## The pipeline

```
SOURCE DATA  →  SOURCE ADAPTER  →  NORMALISED INCIDENT  →  DEDUPLICATION  →  DATABASE  →  API  →  MAP / FEED
```

Each real source (DFES, Main Roads WA, Western Power, BOM, Transperth,
SharkSmart, local councils, ...) gets its **own adapter**. An adapter's
only job is: fetch that source's raw data, and convert it into the common
incident schema defined in `js/data/schema.js`. Nothing downstream cares
what the raw source format looked like.

## Adapter interface (planned)

```js
// adapters/dfes-adapter.js  (example, not yet implemented)
export async function fetchIncidents() {
  const raw = await fetch('https://<dfes-source>');
  return raw.map(normalise);
}

function normalise(rawItem) {
  return {
    id: `dfes-${rawItem.someStableId}`,
    title: ...,
    description: ...,
    category: 'emergency',
    latitude: ...,
    longitude: ...,
    location_name: ...,
    severity: mapDfesSeverity(rawItem.level),
    started_at: ...,
    updated_at: ...,
    source_name: 'DFES',
    source_url: rawItem.link,
    status: ...,
    confidence: 'official',
    is_demo_data: false,   // real sources always set this to false
    is_sensitive: ...,      // true for anything involving death/injury/missing/violence/evacuation
  };
}
```

Every adapter must:

1. Only ever output the common schema shape — never leak source-specific fields upstream.
2. Set `is_demo_data: false` and `is_sensitive` correctly (default to `true` if unsure — safer to be cautious with tone/sensitivity than not).
3. Preserve `source_name` and `source_url` so the original can always be traced.
4. Never invent a field it doesn't actually have — leave it `null`/omitted rather than guessing.

## Wiring an adapter in

Once an adapter exists, `js/data/incident-repository.js` is the **only**
file that needs to change — swap `getAll()` from returning the mock array
to calling the adapter(s), merging results, and (eventually) running them
through a deduplication step before returning. The map, feed, filters and
incident pages don't need to know or care.

## Deduplication

Built: `js/data/dedupe.js`, wired into `incident-repository.js`'s
`getAll()`. Matches on category + rough geographic proximity (≤500m) +
overlapping time window (≤90 min apart) — no text/title similarity
matching, as scoped below. Uses union-find so duplicate chains merge
correctly, then keeps the single most trustworthy/informative incident
from each group (highest confidence, then longest description, then most
recently updated) rather than merging fields together.

Confirmed live: of 136 raw incidents pulled across all 5 sources, 7 were
caught as duplicates, leaving 129 shown on the map.
