import { incidentRepository } from './data/incident-repository.js';
import { initMap, PERTH_CENTER } from './map/map-init.js';
import { buildMarkerLayer } from './map/markers.js';
import { requestUserLocation, showUserLocationMarker } from './map/geolocation.js';
import { createFilterState, matchesFilters, renderFilterChips } from './ui/filters.js';
import { sortByRelevance, renderFeed, setActiveRow } from './ui/feed.js';
import { distanceKm, formatDistance } from './ui/distance.js';
import { diffAndRecordVisit } from './ui/last-visit.js';
import { buildSituationSummary } from './ui/summary.js';

const state = {
  allIncidents: [],
  filters: createFilterState(),
  userLocation: null,
  newIncidentIds: new Set(),
};

const els = {
  map: document.getElementById('map'),
  feedList: document.getElementById('feedList'),
  feedEmpty: document.getElementById('feedEmpty'),
  feedCount: document.getElementById('feedCount'),
  feedSort: document.getElementById('feedSort'),
  filterChips: document.getElementById('filterChips'),
  filterChipsMobile: document.getElementById('filterChipsMobile'),
  situationSummary: document.getElementById('situationSummary'),
  searchInput: document.getElementById('searchInput'),
  radiusSlider: document.getElementById('radiusSlider'),
  radiusValue: document.getElementById('radiusValue'),
  locateHint: document.getElementById('locateHint'),
  locateBtn: document.getElementById('locateBtn'),
  sidebar: document.getElementById('sidebar'),
  sheetHandle: document.getElementById('sheetHandle'),
};

function shareUrlFor(incident) {
  return `${window.location.origin}${window.location.pathname.replace(/index\.html$/, '')}incident.html?id=${encodeURIComponent(incident.id)}`;
}

async function main() {
  const map = initMap('map');

  state.allIncidents = await incidentRepository.getAll();
  state.newIncidentIds = diffAndRecordVisit(state.allIncidents);
  els.situationSummary.textContent = buildSituationSummary(state.allIncidents);

  const { cluster, markersById } = buildMarkerLayer(state.allIncidents, {
    onMarkerClick: (incident) => setActiveRow(els.feedList, incident.id),
    shareUrlFor,
  });
  map.addLayer(cluster);

  function applyFilters() {
    const visible = state.allIncidents.filter((incident) =>
      matchesFilters(incident, state.filters, state.userLocation, distanceKm)
    );
    const sorted = sortByRelevance(visible, state.userLocation);

    // FIX: the map markers used to stay untouched here — only the feed
    // list respected the filters, so e.g. clicking the "Emergency" chip
    // filtered the sidebar but every category's pins stayed on the map.
    // Rebuild the cluster layer from the filtered set on every change.
    cluster.clearLayers();
    visible.forEach((incident) => {
      const marker = markersById.get(incident.id);
      if (marker) cluster.addLayer(marker);
    });

    renderFeed(els.feedList, els.feedEmpty, sorted, state.userLocation, (incident) => {
      const marker = markersById.get(incident.id);
      if (!marker) return;
      cluster.zoomToShowLayer(marker, () => {
        marker.openPopup();
        setActiveRow(els.feedList, incident.id);
        if (window.innerWidth <= 860) collapseSheetSlightly();
      });
    }, state.newIncidentIds);

    els.feedCount.textContent = `${sorted.length} incident${sorted.length === 1 ? '' : 's'}`;
    els.feedSort.textContent = state.userLocation ? 'Sorted by distance' : 'Sorted by severity';
  }

  function onFiltersChanged() {
    renderFilterChips(els.filterChips, state.filters, onFiltersChanged);
    renderFilterChips(els.filterChipsMobile, state.filters, onFiltersChanged);
    applyFilters();
  }

  onFiltersChanged();

  // --- Search ---
  els.searchInput.addEventListener('input', (e) => {
    state.filters.searchText = e.target.value.trim();
    applyFilters();
  });

  // --- Distance radius ---
  els.radiusSlider.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    state.filters.radiusKm = state.userLocation ? val : null;
    els.radiusValue.textContent = val >= 50 ? 'any distance' : `${val} km`;
    applyFilters();
  });

  // --- Geolocation ---
  els.locateBtn.addEventListener('click', async () => {
    els.locateBtn.classList.add('is-active');
    const loc = await requestUserLocation();
    if (!loc) {
      els.locateHint.textContent = "Couldn't get your location — check your browser's location permission.";
      els.locateBtn.classList.remove('is-active');
      return;
    }
    state.userLocation = loc;
    const marker = showUserLocationMarker(map, loc);
    marker.addTo(map);
    map.setView([loc.lat, loc.lng], 13);

    els.locateHint.textContent = 'Showing distance from your current location.';
    const currentRadius = Number(els.radiusSlider.value);
    state.filters.radiusKm = currentRadius >= 50 ? null : currentRadius;
    applyFilters();
  });

  // --- Deep link: index.html?incident=ID opens that incident's popup ---
  const params = new URLSearchParams(window.location.search);
  const deepLinkId = params.get('incident');
  if (deepLinkId && markersById.has(deepLinkId)) {
    const marker = markersById.get(deepLinkId);
    map.setView(marker.getLatLng(), 14);
    cluster.zoomToShowLayer(marker, () => {
      marker.openPopup();
      setActiveRow(els.feedList, deepLinkId);
    });
  }

  setupMobileSheet();
}

/** Nudges the bottom sheet back down to peek height after selecting an incident on mobile. */
function collapseSheetSlightly() {
  els.sidebar.classList.remove('is-expanded');
}

function setupMobileSheet() {
  let startY = 0;
  let startExpanded = false;

  function onStart(clientY) {
    startY = clientY;
    startExpanded = els.sidebar.classList.contains('is-expanded');
    els.sidebar.classList.add('is-dragging');
  }
  function onMove(clientY) {
    const delta = startY - clientY;
    if (delta > 40) els.sidebar.classList.add('is-expanded');
    if (delta < -40) els.sidebar.classList.remove('is-expanded');
  }
  function onEnd() {
    els.sidebar.classList.remove('is-dragging');
  }

  els.sheetHandle.addEventListener('touchstart', (e) => onStart(e.touches[0].clientY), { passive: true });
  els.sheetHandle.addEventListener('touchmove', (e) => onMove(e.touches[0].clientY), { passive: true });
  els.sheetHandle.addEventListener('touchend', onEnd);

  els.sheetHandle.addEventListener('click', () => {
    els.sidebar.classList.toggle('is-expanded');
  });
}

main();
