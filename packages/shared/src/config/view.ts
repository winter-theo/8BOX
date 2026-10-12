export const VIEW = {
  /** Smallest camera zoom: screen pixels per world pixel (zoom is always a whole number). */
  minZoom: 1,
  /** Largest camera zoom. */
  maxZoom: 8,
  /** Most tiles shown across the longer side of the game view: the zoom never goes below that. */
  maxVisibleTiles: 150,
  /** Tiles shown across the width of the game view at the starting zoom (about; zoom is whole). */
  defaultVisibleTiles: 40,
  /** Change of the distance between two fingers that zooms one step (1.25 = 25 % wider or narrower). */
  pinchStepRatio: 1.25,
  /** Largest game view accepted from a client, in CSS pixels per side. */
  maxViewportPx: 8192,
  /** Shortest time between two updates of the UI store by the game, in ms (React never runs at 60 FPS). */
  uiSyncIntervalMs: 100,
} as const;
