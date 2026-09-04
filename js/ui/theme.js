/**
 * Light/dark theme toggle.
 * ---------------------------------------------------------------
 * The actual theme is applied by a tiny inline script in <head> (see
 * index.html / incident.html) that runs before first paint, so there's
 * no flash of the wrong theme. This module just handles the toggle
 * button's behaviour after the page has loaded: read the current
 * theme off <html data-theme="...">, flip it, persist the choice, and
 * update the button.
 */

const STORAGE_KEY = 'wtg-theme';

export function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (e) {
    // Private browsing / storage disabled — theme just won't persist.
  }
}

function updateButton(buttonEl) {
  const theme = getTheme();
  buttonEl.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  buttonEl.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  buttonEl.setAttribute('aria-label', buttonEl.title);
}

/**
 * Wires up a theme-toggle button. `onChange(theme)` fires after the
 * theme flips, so callers (e.g. the map) can re-theme anything that
 * CSS variables alone can't reach, like Leaflet's tile layer.
 */
export function initThemeToggle(buttonEl, onChange) {
  if (!buttonEl) return;
  updateButton(buttonEl);
  buttonEl.addEventListener('click', () => {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
    updateButton(buttonEl);
    onChange?.(next);
  });
}
