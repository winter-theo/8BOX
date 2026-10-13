import { type Facing, type Skin, VIEW } from '@8box/shared';

/** Frames of a character sheet, all facing right: at rest, then two walking frames. */
export type CharacterFrame = 'idle' | 'walk1' | 'walk2';

/** Side a character sprite looks to: the sheet faces right, it is flipped to face left. */
export type Side = 'left' | 'right';

/** Frame shown at `timeMs`: at rest, or the two walking frames taking turns every `VIEW.walkFrameMs`. */
export function characterFrame(moving: boolean, timeMs: number): CharacterFrame {
  if (!moving) {
    return 'idle';
  }
  return Math.floor(timeMs / VIEW.walkFrameMs) % 2 === 0 ? 'walk1' : 'walk2';
}

/** The sprite turns only when looking left or right; going up or down keeps its last side. */
export function spriteSide(facing: Facing, previous: Side): Side {
  return facing === 'left' || facing === 'right' ? facing : previous;
}

/** Sprite id of a frame of a character skin (`char.theo.idle`…). */
export function characterSprite(skin: Skin, frame: CharacterFrame): string {
  return `char.${skin}.${frame}`;
}
