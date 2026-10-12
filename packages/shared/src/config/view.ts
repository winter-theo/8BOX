export const VIEW = {
  /** Smallest camera zoom: screen pixels per world pixel (zoom is always a whole number). */
  minZoom: 1,
  /** Largest camera zoom. */
  maxZoom: 8,
  /** Zoom when the game starts. */
  defaultZoom: 4,
  /** Largest game view accepted from a client, in CSS pixels per side. */
  maxViewportPx: 8192,
} as const;
