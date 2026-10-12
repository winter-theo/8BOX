import type { Content, GameConfig } from '@8box/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { NetServer } from '../net/net';
import type { World } from '../world/World';
import type { EntityStore } from './entities';
import type { EventBus } from './events';
import type { Scheduler } from './scheduler';

export type Logger = FastifyBaseLogger;

/** Everything a module can use. Later steps add `actions`, `commands`, `writeQueue`. */
export interface ServerContext {
  readonly config: GameConfig;
  readonly content: Content;
  readonly log: Logger;
  readonly events: EventBus;
  readonly entities: EntityStore;
  readonly scheduler: Scheduler;
  readonly systems: SystemRegistry;
  /** Client sessions: send messages, handle game messages (`onMessage`). */
  readonly net: NetServer;
  /** Tiles of every layer, in memory. */
  readonly world: World;
}

export interface GameModule {
  /** Unique id, used in the `dependsOn` of other modules. */
  readonly id: string;
  /** Modules that must be initialized before this one. */
  readonly dependsOn?: readonly string[];
  /** Registers the module systems, event listeners and tasks. Called once, after its dependencies. */
  init(ctx: ServerContext): void;
}

/** Phases of a tick, in run order. */
export const SYSTEM_PHASES = ['input', 'simulate', 'post', 'net'] as const;
export type SystemPhase = (typeof SYSTEM_PHASES)[number];

/** Runs once per tick. `dt` is the duration of a tick, in seconds. */
export type System = (ctx: ServerContext, dt: number) => void;

export interface SystemDef {
  /** Shown in logs when the system fails. */
  name: string;
  phase: SystemPhase;
  /** Order inside the phase, lowest first (default 0); equal orders run by registration. */
  order?: number;
  run: System;
}

export class SystemRegistry {
  private readonly systems: Required<SystemDef>[] = [];

  add(system: SystemDef): void {
    this.systems.push({ ...system, order: system.order ?? 0 });
    // Stable sort: registration order is kept for equal phase and order.
    this.systems.sort(
      (a, b) =>
        SYSTEM_PHASES.indexOf(a.phase) - SYSTEM_PHASES.indexOf(b.phase) || a.order - b.order,
    );
  }

  names(): string[] {
    return this.systems.map((system) => system.name);
  }

  /** Runs every system in order. A system that throws is logged and the others still run. */
  run(ctx: ServerContext, dt: number): void {
    for (const system of this.systems) {
      try {
        system.run(ctx, dt);
      } catch (error) {
        ctx.log.error({ err: error, system: system.name }, 'system failed');
      }
    }
  }
}

/**
 * Orders the modules so that each one comes after its dependencies; otherwise keeps the given order.
 * Throws on a duplicate id, an unknown dependency or a dependency cycle.
 */
export function sortModules(modules: readonly GameModule[]): GameModule[] {
  const byId = new Map<string, GameModule>();
  for (const module of modules) {
    if (byId.has(module.id)) {
      throw new Error(`Duplicate module "${module.id}"`);
    }
    byId.set(module.id, module);
  }

  const sorted: GameModule[] = [];
  const done = new Set<string>();
  const path: string[] = [];

  const visit = (module: GameModule) => {
    if (done.has(module.id)) {
      return;
    }
    if (path.includes(module.id)) {
      throw new Error(`Module dependency cycle: ${[...path, module.id].join(' → ')}`);
    }
    path.push(module.id);
    for (const dependencyId of module.dependsOn ?? []) {
      const dependency = byId.get(dependencyId);
      if (!dependency) {
        throw new Error(`Module "${module.id}" depends on unknown module "${dependencyId}"`);
      }
      visit(dependency);
    }
    path.pop();
    done.add(module.id);
    sorted.push(module);
  };

  for (const module of modules) {
    visit(module);
  }
  return sorted;
}

/** Initializes the modules in dependency order. Returns their ids in that order. */
export function initModules(ctx: ServerContext, modules: readonly GameModule[]): string[] {
  const ordered = sortModules(modules);
  for (const module of ordered) {
    module.init(ctx);
    ctx.log.debug({ module: module.id }, 'module initialized');
  }
  return ordered.map((module) => module.id);
}
