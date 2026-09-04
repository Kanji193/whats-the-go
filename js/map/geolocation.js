/**
 * Wraps the browser Geolocation API with sensible fallbacks.
 * Never throws — callers get null on any failure/denial and can decide
 * what to show (we fall back to distances from central Perth).
 */
export function requestUserLocation() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
    );
  });
}

let userMarker = null;

/** Adds/updates a small dot marker on the map showing the user's location. */
export function showUserLocationMarker(map, { lat, lng }) {
  const icon = L.divIcon({
    html: '<div class="user-location-dot"></div>',
    className: 'user-location-wrap',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  if (userMarker) {
    userMarker.setLatLng([lat, lng]);
  } else {
    userMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000, keyboard: false });
  }
  return userMarker;
}
