import {
  type ActionDef,
  type ActionReason,
  ActionRegistry,
  type ActionSubject,
} from '@8box/shared';
import type { Session } from '../net/session';
import type { EntityId } from './entities';

/** An action the server checked (reach, `canPerform`, delays) and now performs. */
export interface ActionRequest {
  session: Session;
  /** The player entity who acts. */
  entity: EntityId;
  /** What it is aimed at, as checked. */
  subject: ActionSubject;
}

/**
 * Server side of a shared action. Returns nothing when done, or why it could not be done after all
 * (the client is told it was refused).
 */
export type PerformAction = (request: ActionRequest) => ActionReason | undefined;

/**
 * The actions of the game: their shared definitions (`canPerform`, priority, duration), and the
 * `perform` that the module owning each one registers. The `interaction` module receives the requests
 * and checks them before calling `perform`.
 */
export class ServerActions {
  readonly registry: ActionRegistry;
  private readonly performers = new Map<string, PerformAction>();

  constructor(defs: readonly ActionDef[]) {
    this.registry = new ActionRegistry(defs);
  }

  /** Registers how the server does a shared action; called once, by the module that owns it. */
  register(id: string, perform: PerformAction): void {
    if (!this.registry.get(id)) {
      throw new Error(`Unknown action "${id}"`);
    }
    if (this.performers.has(id)) {
      throw new Error(`Action "${id}" is already performed by a module`);
    }
    this.performers.set(id, perform);
  }

  /** How the server does this action; undefined when no module performs it. */
  performer(id: string): PerformAction | undefined {
    return this.performers.get(id);
  }
}
