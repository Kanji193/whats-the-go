import { TONE_MODES } from '../data/schema.js';

/**
 * Tone mode plumbing for the future "Unfiltered Mode" feature.
 *
 * V1 ships with this hard-locked to STANDARD. There is no UI to change
 * it and CURRENT_TONE_MODE is not read from anywhere user-controlled.
 * When Unfiltered Mode is actually built, this is the one file that
 * changes: read a user preference here instead of the hardcoded value,
 * and everything that calls getDisplaySummary() keeps working as-is.
 */
const CURRENT_TONE_MODE = TONE_MODES.STANDARD;

/**
 * Returns the description text to display for an incident, respecting
 * tone mode — EXCEPT sensitive incidents, which always render neutrally
 * regardless of mode. Falls back to the plain `description` field when
 * an incident has no `summary` object yet (true for all V1 mock data).
 */
export function getDisplaySummary(incident) {
  if (incident.is_sensitive) {
    return incident.description;
  }

  if (!incident.summary) {
    return incident.description;
  }

  return CURRENT_TONE_MODE === TONE_MODES.UNFILTERED
    ? incident.summary.unfiltered_summary
    : incident.summary.standard_summary;
}
