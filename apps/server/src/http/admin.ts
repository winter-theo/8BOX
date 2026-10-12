import {
  ADMIN_ACTIONS,
  type AdminAuditResponse,
  type AdminError,
  type AdminMe,
  type AdminPlayersResponse,
  banBodySchema,
} from '@8box/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Accounts } from '../accounts/Accounts';
import type { Account } from '../accounts/account';
import type { Admin, AdminResult } from '../admin/Admin';

export interface AdminRoutesOptions {
  admin: Admin;
  accounts: Pick<Accounts, 'findByToken' | 'findByName'>;
  /** Also accept `Authorization: Dev <name>` (DEV_AUTH; never in production). */
  devAuth: boolean;
  /** Browser origins allowed to call the API (the game client). */
  allowedOrigins: readonly string[];
}

const actionParamsSchema = z.strictObject({
  id: z.coerce.number().int().positive(),
  action: z.enum(ADMIN_ACTIONS),
});

/** HTTP status of each refusal. */
const ERROR_STATUS: Record<AdminError, number> = {
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  invalidBody: 400,
  self: 409,
  targetIsAdmin: 409,
  wrongStatus: 409,
  notOnline: 409,
};

function refuse(reply: FastifyReply, error: AdminError) {
  return reply.code(ERROR_STATUS[error]).send({ error });
}

type AdminHandler = (admin: Account, request: FastifyRequest, reply: FastifyReply) => unknown;

/**
 * The admin API (`/admin/*`): `Authorization: Bearer <Clerk session token>` of an approved admin.
 * 401 without a valid token, 403 for any other player.
 */
export async function adminRoutes(app: FastifyInstance, options: AdminRoutesOptions) {
  const { admin, accounts, devAuth, allowedOrigins } = options;

  // The client page is served from another origin (in dev at least): CORS for the allowed ones.
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin !== undefined && allowedOrigins.includes(origin)) {
      reply.header('access-control-allow-origin', origin);
      reply.header('vary', 'Origin');
    }
  });
  app.options('/admin/*', async (_request, reply) =>
    reply
      .code(204)
      .header('access-control-allow-methods', 'GET, POST')
      .header('access-control-allow-headers', 'authorization, content-type')
      .header('access-control-max-age', '600')
      .send(),
  );

  async function authenticate(request: FastifyRequest): Promise<Account | undefined> {
    const [scheme, credential] = (request.headers.authorization ?? '').split(' ', 2);
    if (!credential) {
      return undefined;
    }
    if (scheme === 'Bearer') {
      return accounts.findByToken(credential);
    }
    return scheme === 'Dev' && devAuth ? accounts.findByName(credential) : undefined;
  }

  /** Runs the handler for approved admins only. */
  const guarded =
    (handler: AdminHandler) => async (request: FastifyRequest, reply: FastifyReply) => {
      const account = await authenticate(request);
      if (!account) {
        return refuse(reply, 'unauthorized');
      }
      if (account.role !== 'admin' || account.status !== 'approved') {
        return refuse(reply, 'forbidden');
      }
      return handler(account, request, reply);
    };

  app.get(
    '/admin/me',
    guarded(async (): Promise<AdminMe> => ({ pendingCount: await admin.pendingCount() })),
  );

  app.get(
    '/admin/players',
    guarded(async (): Promise<AdminPlayersResponse> => ({ players: await admin.players() })),
  );

  app.get(
    '/admin/audit',
    guarded(async (): Promise<AdminAuditResponse> => ({ entries: await admin.audit() })),
  );

  app.post(
    '/admin/players/:id/:action',
    guarded(async (account, request, reply) => {
      const params = actionParamsSchema.safeParse(request.params);
      if (!params.success) {
        return refuse(reply, 'notFound');
      }
      const { id, action } = params.data;
      let result: AdminResult;
      if (action === 'ban') {
        const body = banBodySchema.safeParse(request.body);
        if (!body.success) {
          return refuse(reply, 'invalidBody');
        }
        result = await admin.ban(account, id, body.data.reason);
      } else {
        result = await admin[action](account, id);
      }
      return result.ok ? { ok: true } : refuse(reply, result.error);
    }),
  );
}
