import { incidentRepository } from './data/incident-repository.js';
import { renderIncidentCard } from './ui/incident-card.js';

const contentEl = document.getElementById('content');

async function main() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    contentEl.innerHTML = '<div class="not-found"><p>No incident specified.</p></div>';
    return;
  }

  const incident = await incidentRepository.getById(id);

  if (!incident) {
    contentEl.innerHTML = `<div class="not-found"><p>We couldn't find that incident. It may have been resolved and removed from the feed.</p></div>`;
    return;
  }

  document.title = `${incident.title} — What's The Go?`;

  const shareUrl = window.location.href;
  contentEl.innerHTML = renderIncidentCard(incident, {}) + `
    <div id="mini-map"></div>
    <div class="share-row">
      <button type="button" id="copyLinkBtn">Copy link</button>
      <a href="index.html?incident=${encodeURIComponent(incident.id)}" style="text-decoration:none;">
        <button type="button">Open on full map</button>
      </a>
    </div>
  `;

  document.getElementById('copyLinkBtn').addEventListener('click', async (e) => {
    await navigator.clipboard.writeText(shareUrl);
    e.target.textContent = 'Link copied';
    setTimeout(() => { e.target.textContent = 'Copy link'; }, 1800);
  });

  const map = L.map('mini-map', {
    center: [incident.latitude, incident.longitude],
    zoom: 14,
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    attributionControl: false,
  });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  L.circleMarker([incident.latitude, incident.longitude], {
    radius: 8,
    color: '#fff',
    weight: 2,
    fillColor: '#B0223B',
    fillOpacity: 1,
  }).addTo(map);
}

main();
