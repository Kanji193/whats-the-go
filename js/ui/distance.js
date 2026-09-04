/**
 * Haversine great-circle distance between two lat/lng points, in kilometres.
 */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius, km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/** Formats a distance in km for display, e.g. "450 m" or "3.2 km". */
export function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/** Formats an ISO timestamp as a short relative "12 min ago" style string. */
export function formatRelativeTime(isoString) {
  const then = new Date(isoString).getTime();
  const diffMs = Date.now() - then;
  const diffMin = Math.round(diffMs / 60_000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? '' : 's'} ago`;

  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
}

/** Formats an ISO timestamp as an absolute, readable Perth-local string. */
export function formatAbsoluteTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('en-AU', {
    timeZone: 'Australia/Perth',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
