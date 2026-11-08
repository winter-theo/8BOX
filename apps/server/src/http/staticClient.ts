import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/** The client built by `pnpm build` (`apps/client/dist`). */
export const CLIENT_DIST_DIR = fileURLToPath(new URL('../../../client/dist', import.meta.url));

/** Content types of the files Vite writes; anything else is sent as raw bytes. */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};
const BINARY_TYPE = 'application/octet-stream';
/** Text files smaller than this are sent as they are: compressing them saves nothing, in bytes. */
const GZIP_MIN_BYTES = 1024;
/** Vite names the files of `assets/` after their content: they never change. */
const ASSETS_PREFIX = '/assets/';
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
/** The page and the other files are checked again each time (they keep their name between builds). */
const REVALIDATE_CACHE = 'no-cache';

interface ClientFile {
  body: Buffer;
  /** Gzipped body, for the text files worth it. */
  gzipped: Buffer | undefined;
  type: string;
  cacheControl: string;
}

export interface StaticClientOptions {
  /** Folder of the built client. Default: `apps/client/dist`. */
  dir?: string;
}

/** Every file under `dir`, by URL path (`/assets/index-abc.js`). */
function readClientFiles(dir: string): Map<string, ClientFile> {
  const files = new Map<string, ClientFile>();
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }
    const path = join(entry.parentPath, entry.name);
    const urlPath = `/${relative(dir, path).split(sep).join('/')}`;
    const body = readFileSync(path);
    const type = CONTENT_TYPES[extname(entry.name).toLowerCase()] ?? BINARY_TYPE;
    const text = /^text\/|^application\/(json|manifest)|^image\/svg/.test(type);
    files.set(urlPath, {
      body,
      gzipped: text && body.length >= GZIP_MIN_BYTES ? gzipSync(body) : undefined,
      type,
      cacheControl: urlPath.startsWith(ASSETS_PREFIX) ? IMMUTABLE_CACHE : REVALIDATE_CACHE,
    });
  }
  return files;
}

function send(request: FastifyRequest, reply: FastifyReply, file: ClientFile): FastifyReply {
  reply
    .header('content-type', file.type)
    .header('cache-control', file.cacheControl)
    .header('x-content-type-options', 'nosniff');
  if (file.gzipped === undefined) {
    return reply.send(file.body);
  }
  reply.header('vary', 'accept-encoding');
  const acceptsGzip = /\bgzip\b/.test(String(request.headers['accept-encoding'] ?? ''));
  return acceptsGzip
    ? reply.header('content-encoding', 'gzip').send(file.gzipped)
    : reply.send(file.body);
}

/**
 * Serves the built client (`SERVE_CLIENT=1`): the game and the server share one address. The files are
 * read once, at start; only those exact paths are served. A path without an extension (`/`, `/admin`) is
 * a page of the client: it gets `index.html`. The routes of the server (`/health`, `/admin/me`…) come first.
 */
export async function staticClientRoutes(
  app: FastifyInstance,
  options: StaticClientOptions,
): Promise<void> {
  const dir = options.dir ?? CLIENT_DIST_DIR;
  let files: Map<string, ClientFile>;
  try {
    files = readClientFiles(dir);
  } catch (error) {
    throw new Error(`SERVE_CLIENT: cannot read the built client in ${dir} (pnpm build)`, {
      cause: error,
    });
  }
  const index = files.get('/index.html');
  if (index === undefined) {
    throw new Error(`SERVE_CLIENT: ${dir} has no index.html (pnpm build)`);
  }

  app.get('/*', async (request, reply) => {
    const path = request.url.split('?', 1)[0] ?? '/';
    const file = files.get(path);
    if (file !== undefined) {
      return send(request, reply, file);
    }
    if (extname(path) === '') {
      return send(request, reply, index);
    }
    return reply.code(404).send({ error: 'not found' });
  });
}
