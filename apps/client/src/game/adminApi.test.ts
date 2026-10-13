import { describe, expect, it, vi } from 'vitest';
import { AdminApi, failureOf } from './adminApi';

function answer(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('AdminApi', () => {
  it('sends the credentials, and a JSON body for a ban', async () => {
    const fetchMock = vi.fn(async () => answer(200, { ok: true }));
    const api = new AdminApi('http://server.test', async () => 'Bearer abc', fetchMock);

    await api.ban(7, { reason: 'griefing' });

    expect(fetchMock).toHaveBeenCalledWith('http://server.test/admin/players/7/ban', {
      method: 'POST',
      headers: { authorization: 'Bearer abc', 'content-type': 'application/json' },
      body: '{"reason":"griefing"}',
    });
  });

  it('sends no body for the other actions', async () => {
    const fetchMock = vi.fn(async () => answer(200, { ok: true }));
    const api = new AdminApi('http://server.test', async () => 'Bearer abc', fetchMock);

    await api.act(7, 'approve');

    expect(fetchMock).toHaveBeenCalledWith('http://server.test/admin/players/7/approve', {
      method: 'POST',
      headers: { authorization: 'Bearer abc' },
    });
  });

  it("turns the server's refusal into a failure", async () => {
    const api = new AdminApi(
      'http://server.test',
      async () => 'Bearer abc',
      async () => answer(403, { error: 'forbidden' }),
    );
    const error = await api.me().catch((caught: unknown) => caught);
    expect(failureOf(error)).toBe('forbidden');
  });

  it('fails without credentials, without calling the server', async () => {
    const fetchMock = vi.fn();
    const api = new AdminApi('http://server.test', async () => null, fetchMock);
    expect(failureOf(await api.players().catch((caught: unknown) => caught))).toBe('unauthorized');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a network failure when the server does not answer', async () => {
    const api = new AdminApi(
      'http://server.test',
      async () => 'Bearer abc',
      async () => {
        throw new TypeError('Failed to fetch');
      },
    );
    expect(failureOf(await api.audit().catch((caught: unknown) => caught))).toBe('network');
  });
});
