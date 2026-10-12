export const VIEW = {
  /** Smallest camera zoom: screen pixels per world pixel (zoom is always a whole number). */
  minZoom: 1,
  /** Largest camera zoom. */
  maxZoom: 8,
  /** Most tiles shown across the longer side of the game view: the zoom never goes below that. */
  maxVisibleTiles: 150,
  /** Tiles shown across the width of the game view at the starting zoom (about; zoom is whole). */
  defaultVisibleTiles: 40,
  /** Time each of the two walking frames of a character is shown, in ms. */
  walkFrameMs: 150,
  /** Change of the distance between two fingers that zooms one step (1.25 = 25 % wider or narrower). */
  pinchStepRatio: 1.25,
  /** Share of the joystick radius where the thumb moves nothing (no unit). */
  joystickDeadZone: 0.25,
  /** Radius of the virtual joystick: how far the knob goes from the center, in CSS pixels. */
  joystickRadiusPx: 56,
  /** Touch held this long on the world opens the action menu, in ms. */
  longPressMs: 500,
  /** A touch that moves farther than this is not a long press, in CSS pixels. */
  longPressMoveTolerancePx: 12,
  /** Largest game view accepted from a client, in CSS pixels per side. */
  maxViewportPx: 8192,
  /** Shortest time between two updates of the UI store by the game, in ms (React never runs at 60 FPS). */
  uiSyncIntervalMs: 100,
} as const;
