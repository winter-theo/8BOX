import type {
  AdminAction,
  AdminAuditResponse,
  AdminError,
  AdminMe,
  AdminPlayersResponse,
  BanBody,
} from '@8box/shared';

/** Gives the `Authorization` header of the admin API; null when nobody is signed in. */
export type AuthHeader = () => Promise<string | null>;

/** Why an admin request failed: the server's refusal, or no answer at all. */
export type AdminFailure = AdminError | 'network';

export class AdminApiError extends Error {
  constructor(readonly failure: AdminFailure) {
    super(`Admin request failed: ${failure}`);
  }
}

/** The admin HTTP API of the game server (`/admin/*`). */
export class AdminApi {
  constructor(
    private readonly serverUrl: string,
    private readonly authHeader: AuthHeader,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  me(): Promise<AdminMe> {
    return this.request('GET', '/admin/me');
  }

  players(): Promise<AdminPlayersResponse> {
    return this.request('GET', '/admin/players');
  }

  audit(): Promise<AdminAuditResponse> {
    return this.request('GET', '/admin/audit');
  }

  act(playerId: number, action: Exclude<AdminAction, 'ban'>): Promise<unknown> {
    return this.request('POST', `/admin/players/${playerId}/${action}`);
  }

  ban(playerId: number, body: BanBody): Promise<unknown> {
    return this.request('POST', `/admin/players/${playerId}/ban`, body);
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: object): Promise<T> {
    const authorization = await this.authHeader();
    if (authorization === null) {
      throw new AdminApiError('unauthorized');
    }
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.serverUrl}${path}`, {
        method,
        headers: {
          authorization,
          ...(body && { 'content-type': 'application/json' }),
        },
        ...(body && { body: JSON.stringify(body) }),
      });
    } catch {
      throw new AdminApiError('network');
    }
    if (!response.ok) {
      const answer = (await response.json().catch(() => ({}))) as { error?: AdminError };
      throw new AdminApiError(answer.error ?? 'network');
    }
    return (await response.json()) as T;
  }
}

/** The failure of an admin request (anything else counts as a network failure). */
export function failureOf(error: unknown): AdminFailure {
  return error instanceof AdminApiError ? error.failure : 'network';
}
