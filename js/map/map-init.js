/**
 * Leaflet map setup. Uses OpenStreetMap tiles (light) or CARTO's free
 * Dark Matter tiles (dark) — no API key required for either.
 */

export const PERTH_CENTER = { lat: -31.9523, lng: 115.8613 };
export const PERTH_DEFAULT_ZOOM = 11;

const TILE_LAYERS = {
  light: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
};

/** Reads the theme <html data-theme="..."> is currently set to. */
export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function createTileLayer(theme) {
  const cfg = TILE_LAYERS[theme] || TILE_LAYERS.light;
  return L.tileLayer(cfg.url, { maxZoom: 19, attribution: cfg.attribution });
}

export function initMap(elementId) {
  const map = L.map(elementId, {
    center: [PERTH_CENTER.lat, PERTH_CENTER.lng],
    zoom: PERTH_DEFAULT_ZOOM,
    zoomControl: false,
    attributionControl: true,
  });

  // Stashed on the map instance (rather than a module-level variable) so
  // this still works correctly if more than one map is on the page at
  // once — e.g. the main map and the incident page's mini-map both
  // import this module, which is a singleton.
  map.__tileLayer = createTileLayer(currentTheme());
  map.__tileLayer.addTo(map);

  // Keep zoom control but move it below the top overlays / out of the way on mobile.
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  return map;
}

/** Swaps a map's base tile layer to match the given theme ('light' | 'dark'). */
export function setMapTheme(map, theme) {
  if (!map) return;
  if (map.__tileLayer) {
    map.removeLayer(map.__tileLayer);
  }
  map.__tileLayer = createTileLayer(theme);
  map.__tileLayer.addTo(map);
}
