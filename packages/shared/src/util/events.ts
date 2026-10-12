export type Listener<T> = (payload: T) => void;

/**
 * Synchronous, typed event emitter. `Events` maps each event name to its payload type:
 * `new TypedEmitter<{ playerJoined: { id: string } }>()`. Declare event maps with `type`, not `interface`.
 */
export class TypedEmitter<Events extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof Events, Set<Listener<never>>>();

  /** Subscribes to an event. Returns a function that unsubscribes. */
  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return () => this.off(event, listener);
  }

  /** Subscribes to the next occurrence of an event only. */
  once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    const unsubscribe = this.on(event, (payload) => {
      unsubscribe();
      listener(payload);
    });
    return unsubscribe;
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
    const set = this.listeners.get(event);
    set?.delete(listener);
    if (set?.size === 0) {
      this.listeners.delete(event);
    }
  }

  /** Calls every listener of the event, in subscription order, before returning. */
  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event) as Set<Listener<Events[K]>> | undefined;
    if (!set) {
      return;
    }
    // Copy so listeners can unsubscribe (or subscribe) while the event is dispatched.
    for (const listener of [...set]) {
      listener(payload);
    }
  }

  listenerCount(event: keyof Events): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
