import { CATEGORY_META, SEVERITY_META } from '../data/schema.js';
import { renderIncidentCard } from '../ui/incident-card.js';

const CATEGORY_GLYPH = {
  emergency: '🔥',
  traffic: '🚗',
  power: '⚡',
  weather: '☁️',
  transport: '🚆',
  shark: '🦈',
  other: '•',
};

function buildDivIcon(incident) {
  const cat = CATEGORY_META[incident.category];
  const sev = SEVERITY_META[incident.severity];
  const isSevere = incident.severity === 'severe';

  const html = `
    <div class="incident-marker ${isSevere ? 'incident-marker--pulse' : ''}"
         style="--marker-color:${cat.color}; --marker-ring:${sev.color};">
      <span class="incident-marker__glyph">${CATEGORY_GLYPH[incident.category] ?? '•'}</span>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'incident-marker-wrap',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14],
  });
}

/**
 * Builds a clustered marker layer for the given incidents.
 * `onMarkerClick(incident)` fires whenever a marker (or its popup) is opened,
 * so the feed list can highlight the matching row.
 */
export function buildMarkerLayer(incidents, { onMarkerClick, shareUrlFor } = {}) {
  const cluster = L.markerClusterGroup({
    maxClusterRadius: 46,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    iconCreateFunction(clusterObj) {
      const count = clusterObj.getChildCount();
      const size = count < 5 ? 34 : count < 15 ? 40 : 46;
      return L.divIcon({
        html: `<div class="cluster-badge" style="width:${size}px;height:${size}px;">${count}</div>`,
        className: 'cluster-badge-wrap',
        iconSize: [size, size],
      });
    },
  });

  const markersById = new Map();

  incidents.forEach((incident) => {
    const marker = L.marker([incident.latitude, incident.longitude], {
      icon: buildDivIcon(incident),
      alt: incident.title,
      keyboard: true,
    });

    const shareUrl = shareUrlFor ? shareUrlFor(incident) : undefined;
    marker.bindPopup(renderIncidentCard(incident, { shareUrl }), {
      maxWidth: 320,
      className: 'incident-popup',
    });

    marker.on('click', () => onMarkerClick?.(incident));

    markersById.set(incident.id, marker);
    cluster.addLayer(marker);
  });

  return { cluster, markersById };
}
