import { CATEGORY_META, SEVERITY_META, SEVERITY_RANK } from '../data/schema.js';
import { distanceKm, formatDistance, formatRelativeTime } from './distance.js';

/**
 * Sorts incidents by relevance: closer + more severe + more recent first.
 * When we don't know the user's location, falls back to severity + recency.
 */
export function sortByRelevance(incidents, userLocation) {
  return [...incidents].sort((a, b) => {
    if (userLocation) {
      const da = distanceKm(userLocation.lat, userLocation.lng, a.latitude, a.longitude);
      const db = distanceKm(userLocation.lat, userLocation.lng, b.latitude, b.longitude);
      // Bucket distance into ~2km bands so severity still matters for nearby ties.
      const bucketA = Math.floor(da / 2);
      const bucketB = Math.floor(db / 2);
      if (bucketA !== bucketB) return bucketA - bucketB;
    }

    const sevDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (sevDiff !== 0) return sevDiff;

    return new Date(b.updated_at) - new Date(a.updated_at);
  });
}

/**
 * Renders the feed list into `listEl`. Returns nothing; wires row clicks via onSelect.
 * `newIncidentIds` (optional Set) marks rows with a "NEW" badge — incidents
 * that weren't on screen the last time this browser visited.
 */
export function renderFeed(listEl, emptyEl, incidents, userLocation, onSelect, newIncidentIds) {
  listEl.innerHTML = '';

  if (incidents.length === 0) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  incidents.forEach((incident) => {
    const cat = CATEGORY_META[incident.category];
    const sev = SEVERITY_META[incident.severity];
    const isNew = newIncidentIds?.has(incident.id);

    const li = document.createElement('li');
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'incident-row';
    row.dataset.incidentId = incident.id;

    const distanceLabel = userLocation
      ? formatDistance(distanceKm(userLocation.lat, userLocation.lng, incident.latitude, incident.longitude))
      : null;

    row.innerHTML = `
      <div class="incident-row__top">
        <span class="sev-dot" style="background:${sev.color}"></span>
        <span class="incident-row__category" style="color:${cat.color}">${cat.label}</span>
        ${isNew ? '<span class="new-badge">NEW</span>' : ''}
        <span class="incident-row__time">${formatRelativeTime(incident.updated_at)}</span>
      </div>
      <p class="incident-row__title">${incident.title}</p>
      <p class="incident-row__loc">${distanceLabel ? `${distanceLabel} · ` : ''}${incident.location_name}</p>
    `;

    row.addEventListener('click', () => onSelect(incident));
    li.appendChild(row);
    listEl.appendChild(li);
  });
}

export function setActiveRow(listEl, incidentId) {
  listEl.querySelectorAll('.incident-row').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.incidentId === incidentId);
  });
}
