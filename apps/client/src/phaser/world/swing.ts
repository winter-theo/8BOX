import { type Facing, VIEW } from '@8box/shared';

/** Angle swept by a swing, centered on the facing, in radians. */
const SWING_ARC = (2 * Math.PI) / 3;

const FACING_ANGLE: Readonly<Record<Facing, number>> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
};

/**
 * Where a swing is at `progress` (0 to 1): the angle around the middle of the character (0 = right,
 * growing clockwise on screen), sweeping clockwise across its facing, in radians.
 */
export function swingAngle(facing: Facing, progress: number): number {
  const t = Math.min(1, Math.max(0, progress));
  return FACING_ANGLE[facing] - SWING_ARC / 2 + t * SWING_ARC;
}

/**
 * Whether a character hit `elapsedMs` ago is drawn now: it blinks while it cannot be hurt, hidden first
 * so that the hit shows at once.
 */
export function blinkVisible(elapsedMs: number): boolean {
  return Math.floor(elapsedMs / VIEW.hitBlinkIntervalMs) % 2 === 1;
}
