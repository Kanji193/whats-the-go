import { CATEGORIES, CATEGORY_META } from '../data/schema.js';

const ALL_CATEGORIES = Object.values(CATEGORIES);

/**
 * Small, dependency-free filter state holder.
 * activeCategories: Set of category keys currently shown (empty set = "All").
 * radiusKm: null means "no distance filter" (user location unknown or unset).
 */
export function createFilterState() {
  return {
    activeCategories: new Set(), // empty = show all
    radiusKm: null,
    searchText: '',
  };
}

export function toggleCategory(state, category) {
  if (state.activeCategories.has(category)) {
    state.activeCategories.delete(category);
  } else {
    state.activeCategories.add(category);
  }
  return state;
}

export function matchesFilters(incident, state, userLocation, distanceKmFn) {
  if (state.activeCategories.size > 0 && !state.activeCategories.has(incident.category)) {
    return false;
  }

  if (state.searchText) {
    const haystack = `${incident.title} ${incident.location_name} ${incident.description}`.toLowerCase();
    if (!haystack.includes(state.searchText.toLowerCase())) return false;
  }

  if (state.radiusKm != null && userLocation) {
    const d = distanceKmFn(userLocation.lat, userLocation.lng, incident.latitude, incident.longitude);
    if (d > state.radiusKm) return false;
  }

  return true;
}

/** Renders the category filter chips into `container`, wiring click handlers. */
export function renderFilterChips(container, state, onChange) {
  container.innerHTML = '';

  const allChip = document.createElement('button');
  allChip.className = 'chip';
  allChip.type = 'button';
  allChip.textContent = 'All';
  allChip.setAttribute('aria-pressed', String(state.activeCategories.size === 0));
  allChip.addEventListener('click', () => {
    state.activeCategories.clear();
    onChange();
  });
  container.appendChild(allChip);

  ALL_CATEGORIES.forEach((category) => {
    const meta = CATEGORY_META[category];
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.type = 'button';
    chip.setAttribute('aria-pressed', String(state.activeCategories.has(category)));
    chip.innerHTML = `<span class="chip__dot" style="background:${meta.color}"></span>${meta.label}`;
    chip.addEventListener('click', () => {
      toggleCategory(state, category);
      onChange();
    });
    container.appendChild(chip);
  });
}
