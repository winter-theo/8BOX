import { LAYER, type SafeZone } from '@8box/shared';
import type { ServerContext } from './module';

/** The safe zone around the spawn of the world. */
export function safeZoneOf(ctx: ServerContext): SafeZone {
  const { spawn } = ctx.world;
  return {
    layer: LAYER.surface,
    x: spawn.x,
    y: spawn.y,
    radiusTiles: ctx.config.world.safeZoneRadiusTiles,
  };
}
