import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';

const INDEX = '<!doctype html><title>8Box</title>';
/** Big enough to be gzipped. */
const SCRIPT = `console.log(${JSON.stringify('8box '.repeat(500))});`;

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), '8box-client-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), INDEX);
  writeFileSync(join(dir, 'assets', 'index-abc123.js'), SCRIPT);
  writeFileSync(join(dir, 'favicon.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('staticClientRoutes', () => {
  it('serves the page at / and at the client routes, checked again each time', async () => {
    const app = buildApp({ serveClient: { dir } });
    for (const url of ['/', '/admin', '/admin/', '/?protocol=1']) {
      const response = await app.inject({ url });
      expect(response.statusCode, url).toBe(200);
      expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.body).toBe(INDEX);
    }
  });

  it('serves the hashed assets for good, gzipped when the browser accepts it', async () => {
    const app = buildApp({ serveClient: { dir } });
    const plain = await app.inject({ url: '/assets/index-abc123.js' });
    expect(plain.statusCode).toBe(200);
    expect(plain.headers['content-type']).toBe('text/javascript; charset=utf-8');
    expect(plain.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(plain.headers['content-encoding']).toBeUndefined();
    expect(plain.body).toBe(SCRIPT);

    const gzipped = await app.inject({
      url: '/assets/index-abc123.js',
      headers: { 'accept-encoding': 'gzip, deflate, br' },
    });
    expect(gzipped.headers['content-encoding']).toBe('gzip');
    expect(gzipped.headers.vary).toBe('accept-encoding');
    expect(gzipped.rawPayload.length).toBeLessThan(SCRIPT.length);
    expect(gunzipSync(gzipped.rawPayload).toString()).toBe(SCRIPT);
  });

  it('sends the other files as they are, with their type', async () => {
    const app = buildApp({ serveClient: { dir } });
    const response = await app.inject({
      url: '/favicon.png',
      headers: { 'accept-encoding': 'gzip' },
    });
    expect(response.headers['content-type']).toBe('image/png');
    expect(response.headers['content-encoding']).toBeUndefined();
    expect(response.rawPayload).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it('answers 404 for a missing file, and never leaves the folder', async () => {
    const app = buildApp({ serveClient: { dir } });
    for (const url of ['/assets/missing.js', '/../package.json', '/%2e%2e/package.json']) {
      expect((await app.inject({ url })).statusCode, url).toBe(404);
    }
  });

  it('leaves the routes of the server first', async () => {
    const app = buildApp({ serveClient: { dir } });
    const response = await app.inject({ url: '/health' });
    expect(response.json()).toMatchObject({ ok: true });
  });

  it('is off by default', async () => {
    const app = buildApp();
    expect((await app.inject({ url: '/' })).statusCode).toBe(404);
  });

  it('refuses to start without a built client', async () => {
    const app = buildApp({ serveClient: { dir: join(dir, 'missing') } });
    await expect(app.ready()).rejects.toThrow(/cannot read the built client/);
    const empty = mkdtempSync(join(tmpdir(), '8box-empty-'));
    try {
      await expect(buildApp({ serveClient: { dir: empty } }).ready()).rejects.toThrow(
        /no index\.html/,
      );
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
