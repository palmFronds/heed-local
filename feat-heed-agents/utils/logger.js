// utils/logger.js
// Handles page.on('console') interception, [heed] log parsing,
// and NDJSON serialization to output/.

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');

/**
 * Attach a [heed] console interceptor to a Playwright page.
 * Returns a mutable events array that is populated in real-time.
 *
 * @param {import('playwright').Page} page
 * @returns {{ events: Array, detach: Function }}
 */
function attachHeedLogger(page) {
  const events = [];

  const handler = (msg) => {
    const text = msg.text();
    if (!text.startsWith('[heed]')) return;

    // Strip the '[heed] ' prefix and parse the JSON payload
    const jsonStr = text.slice('[heed] '.length).trim();
    try {
      const parsed = JSON.parse(jsonStr);
      events.push({ _capturedAt: Date.now(), ...parsed });
    } catch {
      // If it doesn't parse cleanly, store raw text so we never lose data
      events.push({ _capturedAt: Date.now(), _raw: jsonStr });
    }
  };

  page.on('console', handler);

  return {
    events,
    detach: () => page.off('console', handler),
  };
}

/**
 * Write a completed session object to:
 *   output/sessions-<timestamp>.ndjson  (append, one line per session)
 *   output/summary-<timestamp>.json     (overwritten each run with aggregates)
 *
 * @param {object} session   — fully formed session object
 * @param {string} runStamp  — timestamp string shared across one run.js invocation
 * @param {object} runStats  — mutable stats object maintained by run.js
 */
function writeSession(session, runStamp, runStats) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // ── NDJSON append ──────────────────────────────────────────────
  const ndjsonPath = path.join(OUTPUT_DIR, `sessions-${runStamp}.ndjson`);
  fs.appendFileSync(ndjsonPath, JSON.stringify(session) + '\n', 'utf8');

  // ── In-memory stats update ─────────────────────────────────────
  runStats.total += 1;
  runStats.byPersona[session.persona] = (runStats.byPersona[session.persona] || 0) + 1;
  runStats.byOutcome[session.outcome] = (runStats.byOutcome[session.outcome] || 0) + 1;

  // Tally signal types
  for (const evt of session.events) {
    const sig = evt.event || evt.signal || evt.type;
    if (sig) {
      runStats.signalFrequency[sig] = (runStats.signalFrequency[sig] || 0) + 1;
    }
  }

  // ── Summary JSON overwrite ─────────────────────────────────────
  const summaryPath = path.join(OUTPUT_DIR, `summary-${runStamp}.json`);
  const summary = {
    runStamp,
    generatedAt: new Date().toISOString(),
    ...runStats,
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
}

/**
 * Create a blank stats object for a new run.
 */
function createRunStats() {
  return {
    total: 0,
    byPersona: {},
    byOutcome: {},
    signalFrequency: {},
  };
}

module.exports = { attachHeedLogger, writeSession, createRunStats };
