/**
 * Content entries of one kind, looked up by id. Entries are sorted by id; the position of an entry
 * is its runtime index, stable for a given content set. Runtime indexes are an execution detail:
 * never persist them nor send them as a durable reference — use the id.
 */
export class Registry<T extends { id: string }> {
  /** All entries, sorted by id (index = runtime index). */
  readonly all: readonly T[];
  private readonly indexes: ReadonlyMap<string, number>;

  constructor(
    /** Kind of entries, used in error messages ("item", "tile"…). */
    readonly kind: string,
    entries: readonly T[],
  ) {
    this.all = [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    this.indexes = new Map(this.all.map((entry, index) => [entry.id, index]));
  }

  get size(): number {
    return this.all.length;
  }

  has(id: string): boolean {
    return this.indexes.has(id);
  }

  get(id: string): T | undefined {
    const index = this.indexes.get(id);
    return index === undefined ? undefined : this.all[index];
  }

  /** Like `get`, but throws when the id is unknown. */
  require(id: string): T {
    const entry = this.get(id);
    if (!entry) {
      throw new Error(`Unknown ${this.kind} "${id}"`);
    }
    return entry;
  }

  indexOf(id: string): number | undefined {
    return this.indexes.get(id);
  }

  byIndex(index: number): T | undefined {
    return this.all[index];
  }
}
