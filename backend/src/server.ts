import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { AppError } from './lib/errors.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registerConsentRoute } from './routes/consent.js';
import { registerFetchRoute } from './routes/fetch.js';
import { registerDeriveRoute } from './routes/derive.js';
import { registerIssueRoute } from './routes/issue.js';
import { registerPresentRoute } from './routes/present.js';
import { registerChallengeRoute } from './routes/challenge.js';
import { registerAdmitRoute } from './routes/admit.js';
import { registerRevokeRoute } from './routes/revoke.js';
import { registerScanRoutes } from './routes/scan.js';

// Per hackathon-runbook.md: "Add handlers that log uncaught exceptions, unhandled
// rejections, startup errors, and exit codes on the very first run. You will
// otherwise spend an hour proving something died before you learn why." — added here
// before anything else runs.
process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('[uncaughtException]', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('[unhandledRejection]', reason);
  process.exit(1);
});

const app = Fastify({
  logger: {
    transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
  },
});

await app.register(cors, { origin: true });

app.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }));

/**
 * Rider + verifier client, served as one static file.
 *
 * Deliberately NOT a Next.js app and deliberately not behind @fastify/static: a single
 * hand-written HTML file has no build step, no install step, and no dev server that can
 * die separately from this one. Per the runbook's "cut the expensive edges" — a second
 * toolchain is exactly where hackathon hours disappear for the least visible gain, and
 * a second process is a second thing that can silently not be listening.
 *
 * Path is resolved from this module's own location rather than process.cwd(), because
 * the runbook is right that relative paths resolved against the working directory break
 * the moment someone starts the server from the repo root instead of backend/.
 */
const clientPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'index.html');

app.get('/', async (_req, reply) => {
  if (!fs.existsSync(clientPath)) {
    reply.code(404).send({ error: 'CLIENT_NOT_FOUND', message: `No client at ${clientPath}.` });
    return;
  }
  reply.type('text/html; charset=utf-8').send(fs.readFileSync(clientPath, 'utf-8'));
});

// Vendored browser libs (jsQR for camera decoding, qrcode for rendering) and the
// shared Aadhaar QR decoder. Served from disk, no CDN: venue wifi is not a dependency.
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const STATIC_OK = /^[a-zA-Z0-9._-]+\.(js|png|txt)$/;
app.get('/vendor/:file', async (req, reply) => {
  const { file } = req.params as { file: string };
  const p = path.join(publicDir, 'vendor', file);
  if (!STATIC_OK.test(file) || !fs.existsSync(p)) { reply.code(404).send({ error: 'NOT_FOUND' }); return; }
  reply.type(file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/plain').send(fs.readFileSync(p));
});
app.get('/aadhaar-qr.js', async (_req, reply) => {
  reply.type('application/javascript').send(fs.readFileSync(path.join(publicDir, 'aadhaar-qr.cjs') /* .cjs: package is type=module, browser doesn't care */));
});

registerConsentRoute(app);
registerFetchRoute(app);
registerDeriveRoute(app);
registerIssueRoute(app);
registerChallengeRoute(app);
registerPresentRoute(app);
registerAdmitRoute(app);
registerRevokeRoute(app);
registerScanRoutes(app);

/**
 * Global error handler — per runbook: "a request handler that throws without writing
 * a response" leaves the connection open and the client spinning forever, and every
 * distinct fault then looks identical from the outside. This backstops every route:
 * even a bug in a handler still produces a response.
 */
app.setErrorHandler((err, req, reply) => {
  if (err instanceof AppError) {
    reply.code(err.statusCode).send({ error: err.code, message: err.message });
    return;
  }
  if (err instanceof z.ZodError) {
    reply.code(400).send({ error: 'VALIDATION_ERROR', message: err.message, issues: err.issues });
    return;
  }
  req.log.error(err);
  reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Unexpected server error.' });
});

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  // Per runbook: "confirm something is listening on the port" — this line is the
  // confirmation. If you don't see it, the server did not start; don't debug routes.
  app.log.info(`GigVault backend listening on http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
