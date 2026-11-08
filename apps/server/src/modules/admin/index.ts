import type { AdminError } from '@8box/shared';
import type { Account } from '../../accounts/account';
import type { AdminResult } from '../../admin/Admin';
import {
  type CommandCall,
  type CommandDef,
  type CommandNotice,
  playingSessions,
} from '../../core/commands';
import type { GameModule, ServerContext } from '../../core/module';

/** A sanction of the chat, done by the Admin (which writes it to the audit log). */
type Sanction = (admin: Account, targetId: number, call: CommandCall) => Promise<AdminResult>;

/** What the chat says when the Admin refuses a sanction against `name`. */
function refusalNotice(command: string, name: string, error: AdminError): CommandNotice {
  switch (error) {
    case 'notFound':
    case 'notOnline':
      return { notice: 'unknownPlayer', name };
    case 'self':
      return { notice: 'self' };
    case 'targetIsAdmin':
    case 'wrongStatus':
      return { notice: 'refused', command, reason: error, name };
    default:
      return { notice: 'refused', command, reason: 'failed', name };
  }
}

/**
 * A sanction command: finds the player named (in the game for a `player` argument, or any account),
 * asks the Admin, and tells the admin how it went once it is written (outside the tick).
 */
function sanction(
  ctx: ServerContext,
  def: Pick<CommandDef, 'id' | 'names' | 'forms'>,
  apply: Sanction,
): CommandDef {
  const run = async (call: CommandCall) => {
    const online = call.args.optionalPlayer(0);
    const target = online?.account
      ? { playerId: online.account.playerId, name: online.name ?? call.args.string(0) }
      : await ctx.admin.playerNamed(call.args.string(0));
    if (!target) {
      call.reply({ notice: 'unknownPlayer', name: call.args.string(0) });
      return;
    }
    const result = await apply(call.account, target.playerId, call);
    call.reply(
      result.ok
        ? { notice: 'done', command: def.id, name: target.name, ...valuesOf(def.id, call) }
        : refusalNotice(def.id, target.name, result.error),
    );
  };
  return {
    ...def,
    permission: 'admin',
    auditsItself: true,
    run: (call) => {
      run(call).catch((error: unknown) => {
        ctx.log.error({ err: error, line: call.line }, 'sanction failed');
        call.reply({ notice: 'refused', command: def.id, reason: 'failed' });
      });
    },
  };
}

/** Values the `done` text of a sanction shows: the length of a mute. */
function valuesOf(command: string, call: CommandCall): Pick<CommandNotice, 'values'> {
  return command === 'mute' ? { values: { minutes: call.args.int(1) } } : {};
}

/**
 * Admin commands of the chat that belong to no other system: `/who`, and the sanctions (`/kick`,
 * `/ban`, `/unban`, `/mute`, `/unmute`), which go through the Admin like those of the admin tab. The
 * other admin commands live in the module of what they change (`/tp` in movement, `/give` in
 * inventory…).
 */
export const adminModule: GameModule = {
  id: 'admin',
  dependsOn: ['players'],
  init(ctx) {
    const { admin } = ctx.config;
    /** A reason typed in the chat, cut to what a ban reason may be. */
    const reasonOf = (call: CommandCall) =>
      call.args.optionalString(1)?.slice(0, admin.banReasonMaxLength) ?? null;

    ctx.commands.add({
      id: 'who',
      names: ['who'],
      permission: 'admin',
      forms: [[]],
      run: ({ reply }) => {
        const names = playingSessions(ctx).map((session) => session.name ?? '');
        reply({ notice: 'who', list: names.sort((a, b) => a.localeCompare(b)) });
      },
    });

    ctx.commands.add(
      sanction(
        ctx,
        {
          id: 'kick',
          names: ['kick'],
          forms: [[{ kind: 'player' }, { kind: 'text', optional: true }]],
        },
        (account, id, call) => ctx.admin.kick(account, id, reasonOf(call)),
      ),
    );
    ctx.commands.add(
      sanction(
        ctx,
        {
          id: 'ban',
          names: ['ban'],
          forms: [[{ kind: 'account' }, { kind: 'text', optional: true }]],
        },
        (account, id, call) => ctx.admin.ban(account, id, reasonOf(call)),
      ),
    );
    ctx.commands.add(
      sanction(
        ctx,
        { id: 'unban', names: ['unban'], forms: [[{ kind: 'account' }]] },
        (account, id) => ctx.admin.unban(account, id),
      ),
    );
    ctx.commands.add(
      sanction(
        ctx,
        {
          id: 'mute',
          names: ['mute'],
          forms: [
            [
              { kind: 'account' },
              { kind: 'int', min: admin.muteMinMinutes, max: admin.muteMaxMinutes },
            ],
          ],
        },
        (account, id, call) => ctx.admin.mute(account, id, call.args.int(1)),
      ),
    );
    ctx.commands.add(
      sanction(
        ctx,
        { id: 'unmute', names: ['unmute'], forms: [[{ kind: 'account' }]] },
        (account, id) => ctx.admin.unmute(account, id),
      ),
    );
  },
};
