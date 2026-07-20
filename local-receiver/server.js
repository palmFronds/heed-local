// local-receiver/server.js -- dev/test-only tooling, run via `npm run receiver`.
// NEVER imported by src/ and NEVER bundled into dist/sdk.js -- this is not a
// production endpoint (CLAUDE.md / PROJECT.md scope: "the local receiver is
// dev/test tooling to close the loop, not a service").
//
// Plain Node `http` server (D-04, no Express/framework, zero new npm deps) --
// one GET route, one POST route -- that persists WEIGHT-01's session-end
// weight push to a local flat JSON file and serves it back on cold start.
// Mirrors admin/weights.js's exact {W1,b1,W2,b2} shape (05-RESEARCH.md Code
// Examples), which is exactly what src/inference.js's initInference already
// expects at config.inference.weights (INF-05, unchanged this phase).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_WEIGHTS_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'weights.json');
const MAX_BODY_BYTES = 64 * 1024; // generous headroom over a ~1-2KB {W1,b1,W2,b2} payload; matches sendBeacon's own 64KiB ceiling (A4)

/**
 * Boolean-returning shape validator -- mirrors src/inference.js's
 * validateWeightsShape() exactly (same 4x4-matrix / 4-element numeric-finite
 * checks) but NEVER throws (D-06). The receiver must degrade to
 * last-known-good on a bad shape, never hard-fail/crash, which is a
 * deliberately different validation posture than the SDK-side hard-fail
 * validator it mirrors.
 * @param {*} w
 * @returns {boolean}
 */
export function isValidWeights(w) {
  const isMatrix = (m) =>
    Array.isArray(m) && m.length === 4 && m.every((row) => Array.isArray(row) && row.length === 4 && row.every((x) => typeof x === 'number' && Number.isFinite(x)));
  const isVector = (v) => Array.isArray(v) && v.length === 4 && v.every((x) => typeof x === 'number' && Number.isFinite(x));
  return Boolean(w) && typeof w === 'object' && isMatrix(w.W1) && isVector(w.b1) && isMatrix(w.W2) && isVector(w.b2);
}

function setCors(res) {
  // file:// harness pages have an opaque Origin: null, so the wildcard is
  // required (a specific origin string can never match "null"). NEVER pair
  // this with Access-Control-Allow-Credentials -- incompatible with a
  // wildcard origin, and unnecessary since no cookies/credentials are ever
  // sent (CLAUDE.md No-PII; T-05-03 accepted local-dev-only risk).
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * Factory so tests can bind an ephemeral port against a temp file
 * (tests/local-receiver.test.js) instead of the real default weights path --
 * the returned server does NOT call .listen() itself.
 * @param {{weightsPath?: string}} [options]
 * @returns {import('node:http').Server}
 */
export function createReceiver({ weightsPath = DEFAULT_WEIGHTS_PATH } = {}) {
  const server = http.createServer((req, res) => {
    setCors(res);

    if (req.method === 'OPTIONS') {
      // Preflight short-circuit -- fetch()'s application/json POST triggers
      // this since application/json is not a CORS-safelisted content type.
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/weights') {
      fs.readFile(weightsPath, 'utf8', (err, raw) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'no persisted weights yet' }));
          return;
        }
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          // Corrupt on-disk file -- never crash, never serve garbage (SC4/D-06).
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'corrupt weights file' }));
          return;
        }
        if (!isValidWeights(parsed)) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid weights shape on disk' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(raw); // serve the raw bytes already validated, not a re-stringify
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/weights') {
      let size = 0;
      let destroyed = false;
      const chunks = [];
      req.on('data', (chunk) => {
        if (destroyed) return;
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          destroyed = true;
          res.writeHead(413);
          res.end();
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        if (destroyed) return;
        let body;
        try {
          // Parse the raw body REGARDLESS of Content-Type -- fetch()'s
          // application/json POST and sendBeacon()'s text/plain POST must
          // both persist (D-03/Pitfall 3). Never branch on the header.
          body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'malformed JSON' }));
          return;
        }
        if (!isValidWeights(body)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid weights shape' }));
          return;
        }
        // Atomic swap: write to a temp file then rename onto the real path,
        // so a crash/interrupt mid-write never leaves a half-written,
        // corrupt weights.json behind. Code review WR-02: the temp path is
        // computed per-request (not once per server instance) so two POSTs
        // in flight concurrently (e.g. two browser tabs finishing a session
        // near-simultaneously, or a soak-test run against a live harness
        // session) each write their own temp file instead of racing to
        // overwrite a single shared tmpPath mid-flight.
        const tmpPath = `${weightsPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
        fs.writeFile(tmpPath, JSON.stringify(body), (writeErr) => {
          if (writeErr) {
            res.writeHead(500);
            res.end();
            return;
          }
          fs.rename(tmpPath, weightsPath, (renameErr) => {
            if (renameErr) {
              res.writeHead(500);
              res.end();
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          });
        });
      });
      req.on('error', () => {
        // Aborted/malformed request stream -- never throw into the process (T-05-01).
        // Code review CR-01: a response may already have been sent on this
        // request (e.g. the 413 size-limit branch above already called
        // res.writeHead()/res.end() and req.destroy()'d the stream) before
        // this 'error' event fires -- Node's IncomingMessage can still emit
        // 'error' after .destroy(). Calling res.writeHead() a second time in
        // that case throws ERR_HTTP_HEADERS_SENT synchronously inside this
        // listener with no surrounding try/catch, which would crash the
        // process -- exactly what this comment says must never happen. Guard
        // on both destroyed and res.headersSent so this handler is a no-op
        // once a response has already gone out.
        if (destroyed || res.headersSent) return;
        destroyed = true;
        res.writeHead(400);
        res.end();
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  return server;
}

// Guard the actual .listen() behind a run-as-main check so importing this
// module in tests never binds a port.
const isMain = (() => {
  try {
    return import.meta.url === `file://${process.argv[1]}` || import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
  } catch {
    return false;
  }
})();

if (isMain) {
  const PORT = process.env.PORT || 4310;
  const server = createReceiver();
  server.listen(PORT, () => {
    console.log(`[heed-receiver] listening on http://localhost:${PORT}`);
  });
}
