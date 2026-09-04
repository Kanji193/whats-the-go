# What's The Go?

**"What's going on around me right now?"** — a map of Perth showing local
incidents (fires, traffic, power outages, weather warnings, transport
disruptions, shark sightings and more) at a glance.

> **This is a V1 prototype running on real, live government data** for
> Traffic, Emergency and Power (plus Weather/Other when active) — see
> [Live data sources](#live-data-sources) below. Shark and Transport
> don't have a real feed wired up yet.

## What this V1 does

- Shows an interactive map centred on Perth, WA (OpenStreetMap tiles, no API key needed).
- Plots incidents as colour-coded markers by category, with clustering when things are close together.
- Tapping a marker (or a row in the feed) opens a card with the full details: title, category, location, when it was reported, when it last updated, description, severity, source and a link to the source.
- A sidebar (desktop) / bottom sheet (mobile) shows a **feed** of nearby incidents, sorted by distance (if you share your location) or severity + recency otherwise.
- Filter the map/feed by category, or search by suburb/road/title.
- If you allow location access, you get a "how far away" filter and everything sorts by distance.
- Every incident has its own shareable page/URL (`incident.html?id=...`), and you can deep-link straight into the map view of one incident too (`index.html?incident=...`).
- Works on both desktop and mobile — mobile uses a full-screen map with a draggable bottom sheet.
- A one-line situational summary ("8 emergency incidents, 4 road closures and 118 power outages right now") sits above the feed, always reflecting everything loaded regardless of active filters.
- Feed rows carry a **NEW** badge for incidents that weren't showing the last time this browser visited (tracked per-device in `localStorage`, see `js/ui/last-visit.js`).
- Installable as a PWA (desktop and mobile "Add to Home Screen" / "Install app") via `manifest.json` + `sw.js`. The service worker only caches the app shell (HTML/CSS/JS/icons) as an offline fallback — it never touches live data requests, so you always see current incidents when online. **Note:** service worker registration doesn't work against Python's `http.server` (a limitation of that dev server, confirmed by testing — even a trivial worker fails to register against it) — it registers fine once deployed to a real static host (Netlify/Vercel/GitHub Pages all serve proper HTTPS), or if you swap the local dev server for `npx serve .`.

## What this V1 deliberately does NOT do yet

No logins/accounts, no payments, no ads, no community reporting, and no
AI-generated summaries or push notifications turned on. It's a proof of
the core experience first — "open the site, understand what's happening
within ~5 seconds" — before we add anything else. See
[`adapters/README.md`](adapters/README.md) for the adapter pattern used
to plug in each live source, and how to add the next one.

## How to run it

This is a plain HTML/CSS/JavaScript app — **no build step, no
`npm install` required.** The only thing to be careful of is that
browsers won't let JavaScript modules load from a `file://` URL, so you
need a tiny local web server (any will do):

```bash
# from the project folder
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

or, if you have Node installed:

```bash
npx serve .
```

To put it online, you can drag-and-drop the folder onto Netlify, or
connect the repo to Netlify/Vercel/GitHub Pages/Cloudflare Pages — since
it's static files, any of these work for free.

## Project structure

```
whats-the-go/
├── index.html              # main app: map + sidebar/feed
├── incident.html           # standalone shareable single-incident page
├── manifest.json           # PWA install metadata (name, icons, theme colour)
├── sw.js                   # service worker — app-shell cache only, never caches live data
├── icons/                  # PWA/OG icons (192 & 512, regular + maskable)
├── css/styles.css          # all styling (design tokens at the top)
├── js/
│   ├── app.js               # wires everything together for index.html
│   ├── incident-page.js     # wires everything together for incident.html
│   ├── data/
│   │   ├── schema.js               # the incident data shape + category/severity enums
│   │   ├── mock-incidents.js       # demo Perth incidents
│   │   ├── dedupe.js               # collapses near-duplicate incidents across sources
│   │   └── incident-repository.js  # the ONE place the app asks for incident data
│   ├── map/
│   │   ├── map-init.js       # sets up the Leaflet map, centred on Perth
│   │   ├── markers.js        # marker icons + clustering
│   │   └── geolocation.js    # "where am I" handling
│   ├── ui/
│   │   ├── incident-card.js  # renders the detail card (used in popups & the incident page)
│   │   ├── filters.js        # category/search/distance filter state + chip UI
│   │   ├── feed.js           # the nearby-incidents list
│   │   ├── distance.js       # distance & time formatting helpers
│   │   ├── summary.js        # builds the one-line situational summary banner
│   │   └── last-visit.js     # tracks which incidents are new since the last visit
│   └── tone/
│       └── summary-modes.js  # architecture for the future "Unfiltered Mode" (off in V1)
└── adapters/                # live data source adapters — see its README
    ├── main-roads-wa-adapter.js   # traffic
    ├── emergency-wa-adapter.js    # emergency, weather, other
    └── western-power-adapter.js   # power
```

## Environment variables

**None needed for V1.** The map uses OpenStreetMap tiles, which are free
and don't require an API key or account. When real data sources are
added later, each adapter will likely need its own API key/credentials
at that point (documented in `adapters/README.md` as they're built).

## How incident data works

Every incident in the app — no matter where it eventually comes from —
has to match one shape, defined in `js/data/schema.js`:

```js
{
  id, title, description, category, latitude, longitude, location_name,
  severity, started_at, updated_at, source_name, source_url, status,
  confidence, is_demo_data, is_sensitive
}
```

- **category**: `emergency | traffic | power | weather | transport | shark | other`
- **severity**: `normal | moderate | significant | severe`
- **status**: `active | monitoring | resolved`
- **confidence**: `official | likely | unverified` — how sure we are the report is accurate
- **is_demo_data**: a safety rail so a made-up demo incident can never be mistaken for a real one. Always `false` now — every live adapter sets it, and `mock-incidents.js` (which always set it `true`) is no longer used anywhere.
- **is_sensitive**: `true` for anything involving death, injury, missing people, violence or evacuation. Sensitive incidents always render in plain, neutral, respectful language — this is enforced in `js/tone/summary-modes.js` and doesn't change even if a more casual "Unfiltered Mode" is switched on later.

The **only** place in the whole app that fetches incident data is
`js/data/incident-repository.js`. It calls every live adapter in
parallel and merges the results. Every other file (the map, the feed,
the filters, the incident page) asks *that file* for data — never an
adapter directly. That's what makes it possible to add the next real
source without touching anything else.

### The "Unfiltered Mode" architecture

The brief asked for the plumbing for an optional, casual/blunt 18+ tone
mode to exist without turning it on. `js/tone/summary-modes.js` is that
plumbing: an incident *can* carry a `summary: { standard_summary,
unfiltered_summary }` object, and `getDisplaySummary()` is the single
function every card goes through to decide what to show. It's hardcoded
to `standard` for all of V1, and sensitive incidents always bypass tone
mode entirely and show the plain description. No mock incidents currently
use the `summary` field, since the feature isn't live yet.

## How to add another data source later

1. Read `adapters/README.md` — it documents the adapter interface and the pipeline (source → adapter → normalised incident → dedupe → database → API → map/feed).
2. Write a new file in `adapters/` that fetches the source's raw data and converts each item into the common incident schema above.
3. Update `js/data/incident-repository.js` to call your new adapter (alongside or instead of the mock data) and return the combined, normalised list.
4. Nothing in `js/map/`, `js/ui/`, `index.html` or `incident.html` should need to change — they only ever depend on the schema, not on where the data came from.

## Live data sources

| Category | Source | Status |
|---|---|---|
| Traffic | Main Roads WA (`adapters/main-roads-wa-adapter.js`) | Live |
| Emergency | DFES / Emergency WA incidents (`adapters/emergency-wa-adapter.js`) | Live |
| Weather | Emergency WA warnings, routed by CAP category (`adapters/emergency-wa-adapter.js`) | Live when a warning is active — usually empty |
| Other | Emergency WA closures (`adapters/emergency-wa-adapter.js`) | Live when a closure is active — usually empty |
| Power | Western Power outages, via their ArcGIS mirror (`adapters/western-power-adapter.js`) | Live |
| Shark | — | Not wired up — SharkSmart WA has no public API right now |
| Transport | — | Not wired up — Transperth's service-updates page has no JSON feed or coordinates |

This app has no backend of its own — every adapter fetches its source
directly from the browser, so it only works with sources whose API
allows cross-origin requests. `adapters/western-power-adapter.js` has a
worked example of that constraint: Western Power's own first-party API
blocks it, so that adapter uses their ArcGIS-hosted mirror instead,
which allows it.

**This app should never be relied on for real safety decisions.** For
authoritative information always use the official sources directly:
[Emergency WA](https://www.emergency.wa.gov.au/), [DFES](https://www.dfes.wa.gov.au/),
the [Bureau of Meteorology](https://www.bom.gov.au/wa/), or
[Western Power](https://www.westernpower.com.au/outages/).

## Tech choices, in plain English

- **No framework, no build step**: plain HTML/CSS/JavaScript. This keeps things simple to understand and free to host, and it's genuinely testable without needing to install anything. When we add accounts/a real database later, this can be rebuilt into a small Next.js app without throwing away the schema, data layer or component logic — just the HTML shell changes.
- **Leaflet + OpenStreetMap** for the map: free, no API key, no billing risk, and the standard choice for exactly this kind of project. Explained in more detail earlier in our conversation.
- **Git**, with a commit after every working milestone, so we can always roll back to the last known-good state.
