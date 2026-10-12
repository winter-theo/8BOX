import { directionOf, VIEW } from '@8box/shared';

/** Angle covered by each of the 8 directions, in radians. */
const SECTOR = Math.PI / 4;

/**
 * Movement direction (`DIRECTIONS` index) of a joystick pushed by (dx, dy) from its center (y grows
 * downwards, like the screen): 0 inside the dead zone, otherwise the nearest of the 8 directions.
 */
export function joystickDirection(
  dx: number,
  dy: number,
  radius: number,
  deadZone: number = VIEW.joystickDeadZone,
): number {
  if (Math.hypot(dx, dy) < radius * deadZone) {
    return 0;
  }
  const sector = Math.round(Math.atan2(dy, dx) / SECTOR);
  return directionOf(Math.round(Math.cos(sector * SECTOR)), Math.round(Math.sin(sector * SECTOR)));
}

/** Where to draw the knob: the push, kept within the joystick radius. */
export function knobOffset(dx: number, dy: number, radius: number): { x: number; y: number } {
  const length = Math.hypot(dx, dy);
  if (length <= radius) {
    return { x: dx, y: dy };
  }
  return { x: (dx / length) * radius, y: (dy / length) * radius };
}
