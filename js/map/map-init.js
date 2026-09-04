/**
 * Leaflet map setup. Uses OpenStreetMap tiles — no API key required.
 */

export const PERTH_CENTER = { lat: -31.9523, lng: 115.8613 };
export const PERTH_DEFAULT_ZOOM = 11;

export function initMap(elementId) {
  const map = L.map(elementId, {
    center: [PERTH_CENTER.lat, PERTH_CENTER.lng],
    zoom: PERTH_DEFAULT_ZOOM,
    zoomControl: false,
    attributionControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Keep zoom control but move it below the top overlays / out of the way on mobile.
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  return map;
}
