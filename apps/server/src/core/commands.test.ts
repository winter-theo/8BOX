import { baseContent, CONFIG, loadContent, PROTOCOL_VERSION } from '@8box/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  type CommandCall,
  type CommandDef,
  CommandRegistry,
  completeName,
  executeCommand,
  parseClock,
  parseCommand,
} from './commands';
import { connectFakeClient, createTestContext, settle } from './testing';

const content = loadContent(baseContent);

function command(def: Partial<CommandDef> & Pick<CommandDef, 'id' | 'forms'>): CommandDef {
  return { names: [def.id], permission: 'player', run: () => {}, ...def };
}

function registry(): CommandRegistry {
  const commands = new CommandRegistry();
  commands.add(command({ id: 'help', names: ['aide', 'help'], forms: [[]] }));
  commands.add(
    command({
      id: 'tp',
      permission: 'admin',
      forms: [
        [
          { kind: 'int', min: 0 },
          { kind: 'int', min: 0 },
          { kind: 'int', optional: true },
        ],
        [{ kind: 'player' }],
      ],
    }),
  );
  commands.add(
    command({
      id: 'give',
      permission: 'admin',
      forms: [[{ kind: 'player' }, { kind: 'item' }, { kind: 'int', min: 1, optional: true }]],
    }),
  );
  commands.add(command({ id: 'spawnmob', permission: 'admin', forms: [[{ kind: 'creature' }]] }));
  commands.add(command({ id: 'time', permission: 'admin', forms: [[{ kind: 'clock' }]] }));
  commands.add(
    command({
      id: 'kick',
      permission: 'admin',
      forms: [[{ kind: 'player' }, { kind: 'text', optional: true }]],
    }),
  );
  return commands;
}

const parse = (line: string, role: 'player' | 'admin' = 'admin') =>
  parseCommand(line, role, registry(), content, CONFIG);

describe('command parsing', () => {
  it('finds a command by any of its names, whatever their case', () => {
    expect(parse('/aide')).toMatchObject({ ok: true, def: { id: 'help' }, values: [] });
    expect(parse('/HELP')).toMatchObject({ ok: true, def: { id: 'help' } });
    expect(parse('/dance')).toEqual({ ok: false, notice: { notice: 'unknownCommand' } });
    expect(parse('/')).toEqual({ ok: false, notice: { notice: 'unknownCommand' } });
  });

  it('reads the first form the words fit', () => {
    expect(parse('/tp 10 20')).toMatchObject({ ok: true, form: 0, values: [10, 20, undefined] });
    expect(parse('/tp 10 20 0')).toMatchObject({ ok: true, form: 0, values: [10, 20, 0] });
    expect(parse('/tp Ana')).toMatchObject({ ok: true, form: 1, values: ['Ana'] });
  });

  it('tells how to use a command when no form fits', () => {
    const usage = { ok: false, notice: { notice: 'usage', command: 'tp' } };
    expect(parse('/tp')).toEqual(usage);
    expect(parse('/tp 10')).toMatchObject({ ok: true, form: 1, values: ['10'] }); // A name.
    expect(parse('/tp 10 -3')).toEqual(usage); // Below the minimum.
    expect(parse('/tp 10 20 0 4')).toEqual(usage); // Too many words.
    expect(parse('/tp 1.5 2')).toEqual(usage);
    expect(parse('/give Ana base:oak_log 0')).toEqual({
      ok: false,
      notice: { notice: 'usage', command: 'give' },
    });
  });

  it('keeps the rest of the line as a text', () => {
    expect(parse('/kick Ana')).toMatchObject({ ok: true, values: ['Ana', undefined] });
    expect(parse('/kick Ana trop de spam ici')).toMatchObject({
      ok: true,
      values: ['Ana', 'trop de spam ici'],
    });
  });

  it('reads item and creature ids, with or without the base prefix', () => {
    expect(parse('/give Ana base:oak_log 10')).toMatchObject({
      ok: true,
      values: ['Ana', 'base:oak_log', 10],
    });
    expect(parse('/give Ana OAK_LOG')).toMatchObject({
      ok: true,
      values: ['Ana', 'base:oak_log', undefined],
    });
    expect(parse('/give Ana diamond 3')).toEqual({
      ok: false,
      notice: { notice: 'unknownItem', values: { arg: 'diamond' } },
    });
    expect(parse('/spawnmob slime')).toMatchObject({ ok: true, values: ['base:slime'] });
    expect(parse('/spawnmob dragon')).toEqual({
      ok: false,
      notice: { notice: 'unknownCreature', values: { arg: 'dragon' } },
    });
  });

  it('reads times of day', () => {
    expect(parseClock('22:00', CONFIG)).toBe(22 * 60);
    expect(parseClock('6:05', CONFIG)).toBe(6 * 60 + 5);
    expect(parseClock('7h', CONFIG)).toBe(7 * 60);
    expect(parseClock('7h30', CONFIG)).toBe(7 * 60 + 30);
    expect(parseClock('jour', CONFIG)).toBe(CONFIG.admin.timeDayHour * 60);
    expect(parseClock('Night', CONFIG)).toBe(CONFIG.admin.timeNightHour * 60);
    for (const word of ['24:00', '12:60', '12', 'midi', '1:2']) {
      expect(parseClock(word, CONFIG)).toBeUndefined();
    }
    expect(parse('/time 25:00')).toEqual({
      ok: false,
      notice: { notice: 'usage', command: 'time' },
    });
  });
});

describe('command permissions', () => {
  it('hides the admin commands from the other players', () => {
    expect(parse('/tp 10 20', 'player')).toEqual({
      ok: false,
      notice: { notice: 'unknownCommand' },
    });
    // Even used the wrong way, an admin command stays unknown.
    expect(parse('/tp', 'player')).toEqual({ ok: false, notice: { notice: 'unknownCommand' } });
    expect(parse('/aide', 'player')).toMatchObject({ ok: true });
  });

  it('lists the commands a role may use', () => {
    const commands = registry();
    expect(commands.available('player').map(({ id }) => id)).toEqual(['help']);
    expect(commands.available('admin').map(({ id }) => id)).toEqual([
      'help',
      'tp',
      'give',
      'spawnmob',
      'time',
      'kick',
    ]);
  });

  it('refuses two commands with the same name', () => {
    const commands = registry();
    expect(() => commands.add(command({ id: 'other', names: ['aide'], forms: [[]] }))).toThrow(
      /already taken/,
    );
    expect(() => commands.add(command({ id: 'tp', names: ['teleport'], forms: [[]] }))).toThrow(
      /Duplicate/,
    );
  });
});

describe('player names', () => {
  const names = ['Ana', 'Anatole', 'Bob'];

  it('completes the start of a single name, whatever its case', () => {
    expect(completeName('bob', names)).toEqual({ name: 'Bob' });
    expect(completeName('b', names)).toEqual({ name: 'Bob' });
    expect(completeName('anat', names)).toEqual({ name: 'Anatole' });
  });

  it('prefers the exact name, and lists the names a start fits', () => {
    expect(completeName('ana', names)).toEqual({ name: 'Ana' });
    expect(completeName('an', names)).toEqual({ ambiguous: ['Ana', 'Anatole'] });
    expect(completeName('zoe', names)).toBeUndefined();
  });
});

describe('running a command', () => {
  async function setup() {
    const { ctx } = createTestContext({ devAuth: true });
    const run = vi.fn<(call: CommandCall) => void>();
    ctx.commands.add(
      command({
        id: 'poke',
        forms: [[{ kind: 'player' }, { kind: 'account', optional: true }]],
        run,
      }),
    );
    const join = async (name: string) => {
      const client = connectFakeClient(ctx);
      client.send({ t: 'hello', version: PROTOCOL_VERSION, devName: name });
      await settle();
      client.received.length = 0;
      return client;
    };
    // Without the players module, sessions get their entity by hand.
    ctx.events.on('session.authenticated', ({ session }) => {
      const entity = ctx.entities.create('player', { position: { layer: 0, x: 5, y: 5 } });
      session.player = {
        entity,
        name: session.name ?? '',
        skin: 'cat',
        position: { layer: 0, x: 5, y: 5 },
      };
    });
    return { ctx, run, join };
  }

  it('gives the sessions of the players named, completed', async () => {
    const { ctx, run, join } = await setup();
    const ana = await join('Ana');
    const bob = await join('Bobby');

    executeCommand(ctx, ana.session, '/poke bob BOBBY');

    const call = run.mock.calls[0]?.[0];
    expect(call?.args.player(0)).toBe(bob.session);
    expect(call?.args.string(1)).toBe('Bobby');
    expect(call).toMatchObject({ name: 'Ana', form: 0, line: '/poke bob BOBBY' });
  });

  it('keeps an account name as typed when nobody in the game has it', async () => {
    const { ctx, run, join } = await setup();
    const ana = await join('Ana');
    await join('Bobby');

    executeCommand(ctx, ana.session, '/poke ana bob');

    expect(run.mock.calls[0]?.[0].args.string(1)).toBe('bob');
  });

  it('tells who is not in the game, or which names fit', async () => {
    const { ctx, run, join } = await setup();
    const ana = await join('Ana');
    await join('Anatole');
    await join('Annie');

    executeCommand(ctx, ana.session, '/poke zoe');
    executeCommand(ctx, ana.session, '/poke an');

    expect(run).not.toHaveBeenCalled();
    expect(ana.received).toEqual([
      { t: 'chatNotice', notice: 'unknownPlayer', name: 'zoe' },
      { t: 'chatNotice', notice: 'ambiguousPlayer', name: 'an', list: ['Ana', 'Anatole', 'Annie'] },
    ]);
  });
});
