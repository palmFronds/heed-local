// @vitest-environment node
// tests/local-receiver.test.js — RED (Wave 0) unit suite for WEIGHT-01
// SC1 (receiver persists a valid POST) and SC4 (receiver rejects a
// malformed POST / never serves a corrupt on-disk file), per D-06's
// receiver-side validation guarantee. This file's very first line
// overrides the project-default happy-dom Vitest environment with Node's
// real environment (05-RESEARCH.md Pitfall 4) — happy-dom's fetch/sendBeacon
// perform genuine outbound network I/O, and this suite needs Node's real
// http/fs semantics to stand up an actual server on an ephemeral port.
//
// Imports { createReceiver } from ../local-receiver/server.js, which does
// not exist yet — this import is what makes the whole suite RED until
// Plan 05-0x creates local-receiver/server.js (mirrors
// tests/inference-endsession.test.js's RED-suite header convention).
//
// Every request in this file uses Node's global fetch against the
// ephemeral port the test-local server binds to (server.address().port) —
// no literal hard-coded host/port, no real production endpoint, matching
// this plan's threat-model mitigation T-05-TEST-01.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createReceiver } from '../local-receiver/server.js';

// Mirrors admin/weights.js's exact {W1,b1,W2,b2} shape (05-RESEARCH.md
// Code Examples) — a valid fixture the receiver's own isValidWeights
// (mirroring src/inference.js's validateWeightsShape) must accept.
const VALID_WEIGHTS = {
  W1: [
    [0.5, -0.3, 0.2, 0.1],
    [-0.4, 0.6, -0.1, 0.3],
    [0.2, 0.1, -0.5, 0.4],
    [-0.1, 0.2, 0.3, -0.6],
  ],
  b1: [0.1, -0.2, 0.05, 0.0],
  W2: [
    [0.3, -0.2, 0.5, 0.1],
    [-0.1, 0.4, 0.2, -0.3],
    [0.2, 0.1, -0.4, 0.5],
    [0.4, -0.3, 0.1, 0.2],
  ],
  b2: [0.0, 0.1, -0.1, 0.05],
};

let server;
let port;
let weightsPath;

beforeEach(() => {
  // Fresh temp file per test — never touches the real
  // local-receiver/weights.json — so tests never interfere with each
  // other or with a developer's real persisted weights.
  weightsPath = path.join(os.tmpdir(), `heed-weights-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  server = createReceiver({ weightsPath });
  return new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      resolve();
    });
  });
});

afterEach(() => {
  if (fs.existsSync(weightsPath)) fs.rmSync(weightsPath);
  return new Promise((resolve) => server.close(() => resolve()));
});

describe('local-receiver', () => {
  it('POST persists a valid weights body to the weights file (SC1)', async () => {
    const res = await fetch(`http://localhost:${port}/weights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_WEIGHTS),
    });
    expect(res.status).toBe(200);

    const onDisk = JSON.parse(fs.readFileSync(weightsPath, 'utf8'));
    expect(onDisk).toEqual(VALID_WEIGHTS);
  });

  it('malformed POST is rejected with 400, never crashes the server, never writes the weights file (SC4)', async () => {
    // (a) non-JSON string body
    const resNonJson = await fetch(`http://localhost:${port}/weights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json at all',
    });
    expect(resNonJson.status).toBe(400);
    expect(fs.existsSync(weightsPath)).toBe(false);

    // (b) shape-invalid JSON object (valid JSON, wrong/missing keys)
    const resBadShape = await fetch(`http://localhost:${port}/weights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notWeights: true }),
    });
    expect(resBadShape.status).toBe(400);
    expect(fs.existsSync(weightsPath)).toBe(false);

    // Server process stays up — a following valid request still succeeds.
    const resValid = await fetch(`http://localhost:${port}/weights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_WEIGHTS),
    });
    expect(resValid.status).toBe(200);
  });

  it('an oversized POST body is rejected with 413, never crashes the server, and a following valid request still succeeds (SC4, code review CR-01)', async () => {
    // MAX_BODY_BYTES is 64 * 1024 in local-receiver/server.js -- send well
    // past that so the 'data' handler's size check fires and destroys the
    // request stream (res.writeHead(413); res.end(); req.destroy()). This
    // exercises the path that used to risk a second, unguarded
    // res.writeHead() call from the req.on('error') handler firing after
    // the 413 response had already completed, which threw
    // ERR_HTTP_HEADERS_SENT and could crash the whole process.
    const oversizedBody = 'a'.repeat(128 * 1024);
    try {
      const resOversized = await fetch(`http://localhost:${port}/weights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: oversizedBody,
      });
      expect(resOversized.status).toBe(413);
    } catch (err) {
      // The server's 413 branch calls req.destroy() immediately after
      // writing the response, which can tear down the underlying socket
      // before the client finishes reading the response bytes -- an
      // ECONNRESET on the client side here is an acceptable outcome of
      // that pre-existing destroy-on-oversized-body behavior, not a
      // regression. What this test actually guards against (CR-01) is the
      // server PROCESS crashing from a double res.writeHead() -- verified
      // below by checking a follow-up request still succeeds.
      expect(err).toBeInstanceOf(Error);
    }
    expect(fs.existsSync(weightsPath)).toBe(false);

    // The server process must still be up and answering -- if the
    // req.on('error') double-response bug fired, the uncaught
    // ERR_HTTP_HEADERS_SENT exception would have crashed the process and
    // this next request would never complete.
    const resValid = await fetch(`http://localhost:${port}/weights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_WEIGHTS),
    });
    expect(resValid.status).toBe(200);
  });

  it('a corrupt on-disk weights file does not crash the receiver and is never served as-is on GET (SC4)', async () => {
    // Pre-write garbage directly to the temp weights path (simulating an
    // externally-corrupted file), bypassing the receiver's own POST path.
    fs.writeFileSync(weightsPath, '{ this is not valid json ][');

    const resCorrupt = await fetch(`http://localhost:${port}/weights`);
    // Receiver must not crash (fetch resolves at all) and must not serve
    // the garbage bytes as a 200 — either a non-200 status or a
    // last-known-good fallback, never the raw corrupt content.
    if (resCorrupt.status === 200) {
      const body = await resCorrupt.json();
      expect(body).not.toBe('{ this is not valid json ][');
    } else {
      expect(resCorrupt.status).not.toBe(200);
    }

    // A subsequent valid POST + GET round-trips correctly, proving the
    // receiver recovered and is not permanently wedged by the corruption.
    const resPost = await fetch(`http://localhost:${port}/weights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_WEIGHTS),
    });
    expect(resPost.status).toBe(200);

    const resGet = await fetch(`http://localhost:${port}/weights`);
    expect(resGet.status).toBe(200);
    const finalBody = await resGet.json();
    expect(finalBody).toEqual(VALID_WEIGHTS);
  });
});
