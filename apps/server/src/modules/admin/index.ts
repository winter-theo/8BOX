import { playingSessions } from '../../core/commands';
import type { GameModule } from '../../core/module';

/**
 * Admin commands of the chat that belong to no other system: `/who`. The other admin commands live
 * in the module of what they change (`/tp` in movement, `/give` in inventory…).
 */
export const adminModule: GameModule = {
  id: 'admin',
  dependsOn: ['players'],
  init(ctx) {
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
  },
};
