import { CATEGORY_META, SEVERITY_META, CONFIDENCE_LEVELS } from '../data/schema.js';
import { formatRelativeTime, formatAbsoluteTime } from './distance.js';
import { getDisplaySummary } from '../tone/summary-modes.js';

const CONFIDENCE_LABEL = {
  [CONFIDENCE_LEVELS.OFFICIAL]: 'Official source',
  [CONFIDENCE_LEVELS.LIKELY]: 'Likely, not yet officially confirmed',
  [CONFIDENCE_LEVELS.UNVERIFIED]: 'Unverified report',
};

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

/**
 * Renders the full incident card as an HTML string.
 * `shareUrl` is optional — when provided, a "View full incident page" link
 * is included (used in map popups; the standalone page omits it).
 */
export function renderIncidentCard(incident, { shareUrl } = {}) {
  const cat = CATEGORY_META[incident.category];
  const sev = SEVERITY_META[incident.severity];
  const description = getDisplaySummary(incident);

  return `
    <article class="incident-card">
      <div class="incident-card__header">
        <span class="sev-pill" style="color:${sev.color}; background:${sev.bg};">${esc(sev.label)}</span>
        <span class="incident-card__category" style="color:${cat.color};">${esc(cat.label)}</span>
      </div>
      <h3 class="incident-card__title">${esc(incident.title)}</h3>
      <p class="incident-card__loc">📍 ${esc(incident.location_name)}</p>
      <p class="incident-card__desc">${esc(description)}</p>
      <div class="incident-card__meta">
        <span>Reported ${esc(formatRelativeTime(incident.started_at))} · ${esc(formatAbsoluteTime(incident.started_at))}</span>
        <span>Updated ${esc(formatRelativeTime(incident.updated_at))}</span>
        <span>${esc(CONFIDENCE_LABEL[incident.confidence] ?? '')}</span>
      </div>
      <div class="incident-card__source">
        Source: ${esc(incident.source_name)}
        ${incident.source_url ? ` — <a href="${esc(incident.source_url)}" target="_blank" rel="noopener">original source</a>` : ''}
      </div>
      ${shareUrl ? `<a class="incident-card__link" href="${esc(shareUrl)}">View full incident page</a>` : ''}
      ${incident.is_demo_data ? '<div class="demo-badge" style="margin-top:10px;">Demo data — not a real incident</div>' : ''}
    </article>
  `;
}
