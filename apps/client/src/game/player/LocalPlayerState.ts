import type { Facing, MovementWorld, Skin } from '@8box/shared';
import { Prediction } from './Prediction';
import { type Point, SmoothMotion } from './SmoothMotion';

/** What Phaser draws for the player of this client. */
export interface LocalView {
  /** Only valid for this connection. */
  entity: number;
  /** Feet position, in tiles. */
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
  skin: Skin;
}

/**
 * The player of this client: predicted at once from its inputs, reconciled with each snapshot, and
 * drawn smoothly between the prediction steps.
 */
export class LocalPlayerState {
  private readonly prediction: Prediction;
  private readonly motion: SmoothMotion;
  private moving = false;
  /** As the server last told it. */
  skin: Skin;

  constructor(
    readonly entity: number,
    start: Point,
    /** The tiles the client knows (unloaded chunks are solid). */
    private readonly world: MovementWorld,
    /** Duration of one input, in ms (one server tick). */
    stepMs: number,
    skin: Skin,
  ) {
    this.skin = skin;
    this.prediction = new Prediction({ x: start.x, y: start.y, facing: 'down' }, stepMs / 1000);
    this.motion = new SmoothMotion(start, stepMs);
  }

  /** An input was just sent: it moves the player now. */
  input(seq: number, dir: number, now: number): void {
    const before = this.prediction.state;
    const after = this.prediction.apply({ seq, dir }, this.world);
    this.moving = after.x !== before.x || after.y !== before.y;
    this.motion.step(after, now);
  }

  /** A snapshot: the server state after input `ackSeq`. */
  snapshot(ackSeq: number, server: { x: number; y: number; facing: Facing }, now: number): void {
    this.motion.correct(this.prediction.reconcile(ackSeq, server, this.world), now);
  }

  view(now: number): LocalView {
    const { x, y } = this.motion.position(now);
    const { entity, moving, skin } = this;
    return { entity, x, y, facing: this.prediction.state.facing, moving, skin };
  }
}
