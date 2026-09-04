/**
 * What's The Go? — Incident schema
 * ---------------------------------------------------------------
 * This file defines the ONE shape every incident must have, no matter
 * where the data came from (mock file today, a real government feed
 * adapter later). Nothing outside js/data/ should ever depend on the
 * SHAPE of a raw source — everything else in the app only ever talks
 * to this schema.
 *
 * Incident (JSDoc typedef, this is plain JS — no build step needed):
 * {
 *   id: string                 // stable unique id, e.g. "demo-fire-0001"
 *   title: string               // short factual headline
 *   description: string         // 1-3 sentence factual description
 *   category: Category          // see CATEGORIES below
 *   latitude: number
 *   longitude: number
 *   location_name: string       // human-readable place, e.g. "Kwinana Fwy, Southbound near Leach Hwy"
 *   severity: Severity          // see SEVERITIES below
 *   started_at: string          // ISO 8601 timestamp
 *   updated_at: string          // ISO 8601 timestamp
 *   source_name: string         // who reported it, e.g. "DFES (demo)"
 *   source_url: string | null   // link to the original source, if any
 *   status: Status               // see STATUSES below
 *   confidence: Confidence       // see CONFIDENCE_LEVELS below
 *   is_demo_data: true            // ALWAYS true for now — see note below
 *   is_sensitive: boolean         // true = deaths/injuries/missing/violence/evacuation etc.
 *                                  // Sensitive incidents must always render in neutral,
 *                                  // respectful language, even if "unfiltered mode" ships later.
 *   summary?: {                   // OPTIONAL — architecture for future tone modes.
 *     standard_summary: string,   // plain factual Australian-English summary
 *     unfiltered_summary: string  // casual/blunt tone — NEVER used for sensitive incidents
 *   }
 * }
 *
 * IMPORTANT: every incident produced anywhere in this app during V1 must
 * carry is_demo_data: true. This is a deliberate safety rail so a demo
 * incident can never be mistaken for a real emergency. When a real data
 * adapter is added later, its normaliser sets is_demo_data: false and
 * that's the ONLY place this flag should change.
 */

export const CATEGORIES = Object.freeze({
  EMERGENCY: 'emergency',
  TRAFFIC: 'traffic',
  POWER: 'power',
  WEATHER: 'weather',
  TRANSPORT: 'transport',
  SHARK: 'shark',
  OTHER: 'other',
});

export const CATEGORY_META = Object.freeze({
  [CATEGORIES.EMERGENCY]: { label: 'Emergency', color: 'var(--cat-emergency)', icon: 'flame' },
  [CATEGORIES.TRAFFIC]: { label: 'Traffic', color: 'var(--cat-traffic)', icon: 'car' },
  [CATEGORIES.POWER]: { label: 'Power', color: 'var(--cat-power)', icon: 'bolt' },
  [CATEGORIES.WEATHER]: { label: 'Weather', color: 'var(--cat-weather)', icon: 'cloud' },
  [CATEGORIES.TRANSPORT]: { label: 'Transport', color: 'var(--cat-transport)', icon: 'train' },
  [CATEGORIES.SHARK]: { label: 'Shark', color: 'var(--cat-shark)', icon: 'fin' },
  [CATEGORIES.OTHER]: { label: 'Other', color: 'var(--cat-other)', icon: 'dot' },
});

export const SEVERITIES = Object.freeze({
  NORMAL: 'normal',
  MODERATE: 'moderate',
  SIGNIFICANT: 'significant',
  SEVERE: 'severe',
});

// Rank used for sorting "most important first"
export const SEVERITY_RANK = Object.freeze({
  [SEVERITIES.SEVERE]: 3,
  [SEVERITIES.SIGNIFICANT]: 2,
  [SEVERITIES.MODERATE]: 1,
  [SEVERITIES.NORMAL]: 0,
});

export const SEVERITY_META = Object.freeze({
  [SEVERITIES.NORMAL]: { label: 'Normal', color: 'var(--sev-normal)', bg: 'var(--sev-normal-bg)', unfiltered_label: "She's right" },
  [SEVERITIES.MODERATE]: { label: 'Moderate', color: 'var(--sev-moderate)', bg: 'var(--sev-moderate-bg)', unfiltered_label: 'Bit cooked' },
  [SEVERITIES.SIGNIFICANT]: { label: 'Significant', color: 'var(--sev-significant)', bg: 'var(--sev-significant-bg)', unfiltered_label: 'Pretty fucked' },
  [SEVERITIES.SEVERE]: { label: 'Severe', color: 'var(--sev-severe)', bg: 'var(--sev-severe-bg)', unfiltered_label: 'Absolutely fucked' },
});

export const STATUSES = Object.freeze({
  ACTIVE: 'active',
  MONITORING: 'monitoring',
  RESOLVED: 'resolved',
});

export const CONFIDENCE_LEVELS = Object.freeze({
  OFFICIAL: 'official',       // direct from an authoritative source
  LIKELY: 'likely',           // corroborated but not an official statement
  UNVERIFIED: 'unverified',   // single/community report, not yet confirmed
});

/**
 * Tone mode toggle — read by js/tone/summary-modes.js.
 * Kept OFF for all of V1. This exists purely so the plumbing (schema,
 * data layer, UI) is ready to switch on later without a rebuild.
 */
export const TONE_MODES = Object.freeze({
  STANDARD: 'standard',
  UNFILTERED: 'unfiltered',
});
