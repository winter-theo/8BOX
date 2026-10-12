import {
  type MovementConfig,
  type MovementInput,
  type MovementWorld,
  type MoverState,
  PLAYER,
  stepMovement,
} from '@8box/shared';

/** An input sent to the server and not acknowledged yet. */
export interface PendingInput extends MovementInput {
  seq: number;
}

/**
 * Prediction of the local player: each input is applied at once with the shared movement (the same
 * code as the server), and kept until a snapshot acknowledges it. On each snapshot, the prediction
 * starts again from the server state and replays the inputs still pending (reconciliation).
 */
export class Prediction {
  private pending: PendingInput[] = [];
  private current: MoverState;

  constructor(
    start: MoverState,
    /** Duration of one input, in seconds (one server tick). */
    private readonly dt: number,
    private readonly config: MovementConfig = PLAYER,
  ) {
    this.current = { ...start };
  }

  get state(): MoverState {
    return this.current;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  /** Applies a new input now (it was just sent). */
  apply(input: PendingInput, world: MovementWorld): MoverState {
    this.pending.push(input);
    this.current = stepMovement(this.current, input, this.dt, world, this.config);
    return this.current;
  }

  /** The server state after input `ackSeq`: forgets the acknowledged inputs and replays the others. */
  reconcile(ackSeq: number, server: MoverState, world: MovementWorld): MoverState {
    this.pending = this.pending.filter((input) => input.seq > ackSeq);
    let state: MoverState = { ...server };
    for (const input of this.pending) {
      state = stepMovement(state, input, this.dt, world, this.config);
    }
    this.current = state;
    return state;
  }
}
