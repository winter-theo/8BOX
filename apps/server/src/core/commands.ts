import type { ChatNoticeMessage, Content, GameConfig, PlayerRole } from '@8box/shared';
import type { Account } from '../accounts/account';
import type { Session } from '../net/session';
import type { EntityId } from './entities';
import type { ServerContext } from './module';

/** Who may use a command: every player, or the admins only. */
export type CommandPermission = PlayerRole;

/** What an argument of a command accepts. */
export type ArgKind =
  /** A whole number, within bounds. */
  | { kind: 'int'; min?: number; max?: number }
  /** A player in the game: a name, or the start of one when only one player matches. */
  | { kind: 'player' }
  /** Any player, in the game or not: the exact name (whatever its case). */
  | { kind: 'account' }
  /** A time of day: `hh:mm` (or `22h`, `22h30`), `jour`/`day` or `nuit`/`night`. */
  | { kind: 'clock' }
  /** An item id: `base:oak_log`, or `oak_log` for the base game. */
  | { kind: 'item' }
  /** A creature id, like an item id. */
  | { kind: 'creature' }
  /** The rest of the line (the last argument). */
  | { kind: 'text' };

/** One argument of a command; `optional` ones come last. */
export type ArgSpec = ArgKind & { optional?: true };

/** What the chat tells the player who typed a command. */
export type CommandNotice = Omit<ChatNoticeMessage, 't'>;

/** One command typed by a player in the game. */
export interface CommandCall {
  session: Session;
  account: Account;
  /** Name and entity of the player who typed it. */
  name: string;
  entity: EntityId;
  /** Index of the form (`CommandDef.forms`) the arguments fit. */
  form: number;
  args: CommandArgs;
  /** The line as typed (cleaned), for the audit log. */
  line: string;
  reply(notice: CommandNotice): void;
}

export interface CommandDef {
  /** Names its help in the client (`ui.chat.commands.<id>`), and `/aide` lists it by this id. */
  id: string;
  /** What players type after "/", in French and in English, in lower case. */
  names: readonly string[];
  permission: CommandPermission;
  /** Argument lists accepted, tried in order: the first one that fits is used. */
  forms: readonly (readonly ArgSpec[])[];
  /** Writes its own audit entry (the sanctions, through the Admin): the line is not recorded. */
  auditsItself?: true;
  run(call: CommandCall): void;
}

/**
 * The chat commands: every module registers its own. A player only finds the commands their role
 * allows: an admin command is unknown to the other players.
 */
export class CommandRegistry {
  private readonly defs: CommandDef[] = [];
  private readonly byName = new Map<string, CommandDef>();

  add(def: CommandDef): void {
    if (this.defs.some((other) => other.id === def.id)) {
      throw new Error(`Duplicate command "${def.id}"`);
    }
    for (const name of def.names) {
      if (this.byName.has(name)) {
        throw new Error(`Command name "/${name}" is already taken`);
      }
      this.byName.set(name, def);
    }
    this.defs.push(def);
  }

  /** The command typed as `name`, if the role may use it. */
  find(name: string, role: PlayerRole): CommandDef | undefined {
    const def = this.byName.get(name.toLowerCase());
    return def && allows(role, def.permission) ? def : undefined;
  }

  /** Commands a role may use, in registration order. */
  available(role: PlayerRole): CommandDef[] {
    return this.defs.filter((def) => allows(role, def.permission));
  }
}

function allows(role: PlayerRole, permission: CommandPermission): boolean {
  return permission === 'player' || role === 'admin';
}

/** A value read from an argument: a number (`int`, `clock` in minutes of the day) or a word. */
type RawValue = number | string | undefined;

/** The arguments of a command, read with the type their form gives them. */
export class CommandArgs {
  constructor(
    private readonly values: readonly RawValue[],
    private readonly sessions: readonly (Session | undefined)[] = [],
  ) {}

  int(index: number): number {
    return required(this.optionalInt(index), index);
  }

  optionalInt(index: number): number | undefined {
    const value = this.values[index];
    return typeof value === 'number' ? value : undefined;
  }

  /** A `text`, `account`, `item` or `creature` argument. */
  string(index: number): string {
    return required(this.optionalString(index), index);
  }

  optionalString(index: number): string | undefined {
    const value = this.values[index];
    return typeof value === 'string' ? value : undefined;
  }

  /** A `player` argument: the session of that player. */
  player(index: number): Session {
    return required(this.optionalPlayer(index), index);
  }

  optionalPlayer(index: number): Session | undefined {
    return this.sessions[index];
  }
}

function required<T>(value: T | undefined, index: number): T {
  if (value === undefined) {
    throw new Error(`Command argument ${index} is missing or of another type`);
  }
  return value;
}

export type ParseResult =
  | { ok: true; def: CommandDef; form: number; values: RawValue[] }
  | { ok: false; notice: CommandNotice };

const DAY_WORDS: ReadonlySet<string> = new Set(['jour', 'day']);
const NIGHT_WORDS: ReadonlySet<string> = new Set(['nuit', 'night']);
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

/** Minutes since midnight of `hh:mm`, `22h`, `22h30`, `jour` or `nuit`; undefined otherwise. */
export function parseClock(word: string, config: GameConfig): number | undefined {
  const lower = word.toLowerCase();
  if (DAY_WORDS.has(lower)) {
    return config.admin.timeDayHour * MINUTES_PER_HOUR;
  }
  if (NIGHT_WORDS.has(lower)) {
    return config.admin.timeNightHour * MINUTES_PER_HOUR;
  }
  const match = /^(\d{1,2})(?::(\d{2})|h(\d{2})?)$/.exec(lower);
  if (!match) {
    return undefined;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? match[3] ?? 0);
  return hours < HOURS_PER_DAY && minutes < MINUTES_PER_HOUR
    ? hours * MINUTES_PER_HOUR + minutes
    : undefined;
}

function parseWholeNumber(word: string, spec: { min?: number; max?: number }): number | undefined {
  if (!/^-?\d+$/.test(word)) {
    return undefined;
  }
  const value = Number(word);
  const inBounds =
    Number.isSafeInteger(value) &&
    value >= (spec.min ?? Number.MIN_SAFE_INTEGER) &&
    value <= (spec.max ?? Number.MAX_SAFE_INTEGER);
  return inBounds ? value : undefined;
}

/** The id a player typed for content of `registry`: as is, or in the base game without its prefix. */
function contentId(word: string, registry: { has(id: string): boolean }): string | undefined {
  const id = word.toLowerCase();
  if (registry.has(id)) {
    return id;
  }
  return !id.includes(':') && registry.has(`base:${id}`) ? `base:${id}` : undefined;
}

/** Reads the words of a form, or undefined when they do not fit it (count, numbers, times). */
function fitForm(
  words: readonly string[],
  form: readonly ArgSpec[],
  config: GameConfig,
): RawValue[] | undefined {
  const values: RawValue[] = [];
  let next = 0;
  for (const spec of form) {
    if (spec.kind === 'text') {
      const rest = words.slice(next).join(' ');
      if (rest === '' && !spec.optional) {
        return undefined;
      }
      values.push(rest === '' ? undefined : rest);
      next = words.length;
      continue;
    }
    const word = words[next];
    if (word === undefined) {
      if (!spec.optional) {
        return undefined;
      }
      values.push(undefined);
      continue;
    }
    let value: RawValue = word;
    if (spec.kind === 'int') {
      value = parseWholeNumber(word, spec);
    } else if (spec.kind === 'clock') {
      value = parseClock(word, config);
    }
    if (value === undefined) {
      return undefined;
    }
    values.push(value);
    next++;
  }
  return next === words.length ? values : undefined;
}

/**
 * Reads a command line (cleaned, starting with "/"): the command, if the role may use it, and the
 * values of the first form its words fit. Items and creatures become full ids; players stay names
 * (`resolvePlayers` finds them in the game).
 */
export function parseCommand(
  line: string,
  role: PlayerRole,
  registry: CommandRegistry,
  content: Content,
  config: GameConfig,
): ParseResult {
  const [name = '', ...words] = line.slice(1).split(' ').filter(Boolean);
  const def = registry.find(name, role);
  if (!def) {
    return { ok: false, notice: { notice: 'unknownCommand' } };
  }
  for (const [form, specs] of def.forms.entries()) {
    const values = fitForm(words, specs, config);
    if (!values) {
      continue;
    }
    for (const [index, spec] of specs.entries()) {
      const value = values[index];
      if (typeof value !== 'string' || (spec.kind !== 'item' && spec.kind !== 'creature')) {
        continue;
      }
      const id = contentId(value, spec.kind === 'item' ? content.items : content.creatures);
      if (id === undefined) {
        const notice = spec.kind === 'item' ? 'unknownItem' : 'unknownCreature';
        return { ok: false, notice: { notice, values: { arg: value } } };
      }
      values[index] = id;
    }
    return { ok: true, def, form, values };
  }
  return { ok: false, notice: { notice: 'usage', command: def.id } };
}

export type NameMatch = { name: string } | { ambiguous: string[] } | undefined;

/**
 * The name a player meant among `names`: the same name whatever its case, otherwise the only name it
 * starts.
 */
export function completeName(typed: string, names: readonly string[]): NameMatch {
  const lower = typed.toLowerCase();
  const exact = names.find((name) => name.toLowerCase() === lower);
  if (exact !== undefined) {
    return { name: exact };
  }
  const matches = names.filter((name) => name.toLowerCase().startsWith(lower));
  if (matches.length === 0) {
    return undefined;
  }
  return matches.length === 1 ? { name: matches[0] as string } : { ambiguous: matches.sort() };
}

/** The sessions of the players in the game. */
export function playingSessions(ctx: ServerContext): Session[] {
  return ctx.net
    .allSessions()
    .filter((session) => session.state === 'playing' && session.name !== undefined);
}

/**
 * Finds the players a command names: a `player` argument becomes the session of the player in the game
 * it names (completed), an `account` argument the exact name of a player in the game whatever its case.
 * Gives the notice to show instead when a player is not in the game, or when several names fit.
 */
function resolvePlayers(
  ctx: ServerContext,
  specs: readonly ArgSpec[],
  values: RawValue[],
): { args: CommandArgs } | { notice: CommandNotice } {
  const playing = playingSessions(ctx);
  const names = playing.map((session) => session.name as string);
  const sessions: (Session | undefined)[] = [];
  for (const [index, spec] of specs.entries()) {
    const typed = values[index];
    if (typeof typed !== 'string') {
      continue;
    }
    if (spec.kind === 'account') {
      const exact = names.find((name) => name.toLowerCase() === typed.toLowerCase());
      values[index] = exact ?? typed;
    } else if (spec.kind === 'player') {
      const match = completeName(typed, names);
      if (match === undefined) {
        return { notice: { notice: 'unknownPlayer', name: typed } };
      }
      if ('ambiguous' in match) {
        return { notice: { notice: 'ambiguousPlayer', name: typed, list: match.ambiguous } };
      }
      values[index] = match.name;
      sessions[index] = playing.find((session) => session.name === match.name);
    }
  }
  return { args: new CommandArgs(values, sessions) };
}

/**
 * Runs a command line typed by a player in the game: unknown to them (`unknownCommand`), used the
 * wrong way (`usage`), naming something that does not exist, or run.
 */
export function executeCommand(ctx: ServerContext, session: Session, line: string): void {
  const { account, name, player } = session;
  if (!account || name === undefined || !player) {
    return;
  }
  const reply = (notice: CommandNotice) => ctx.net.send(session, { t: 'chatNotice', ...notice });
  const parsed = parseCommand(line, account.role, ctx.commands, ctx.content, ctx.config);
  if (!parsed.ok) {
    reply(parsed.notice);
    return;
  }
  const { def, form } = parsed;
  const resolved = resolvePlayers(ctx, def.forms[form] ?? [], parsed.values);
  if ('notice' in resolved) {
    reply(resolved.notice);
    return;
  }
  def.run({
    session,
    account,
    name,
    entity: player.entity,
    form,
    args: resolved.args,
    line,
    reply,
  });
}
