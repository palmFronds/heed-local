#!/usr/bin/env node
// run.js — Heed Agents Volume Runner
//
// Usage:
//   node run.js                              # defaults: all personas, 100 sessions
//   node run.js --persona=confident          # only confident persona
//   node run.js --persona=hesitant --sessions=10
//   node run.js --persona=abandoning --sessions=5
//   node run.js --persona=all --sessions=100
//   node run.js --persona=confident --sessions=1 --headed  # visible browser
//
// Session ratio for --persona=all (default):
//   20% confident, 50% hesitant, 30% abandoning
//
// Output (written to ./output/):
//   sessions-<timestamp>.ndjson   one JSON object per line
//   summary-<timestamp>.json      counts and signal frequency

'use strict';

const { v4: uuidv4 } = require('uuid');
const { launchMobileBrowser } = require('./utils/browser');
const { attachHeedLogger, writeSession, createRunStats } = require('./utils/logger');
const { runConfident } = require('./personas/confident');
const { runHesitant } = require('./personas/hesitant');
const { runAbandoning } = require('./personas/abandoning');

// ── CLI argument parsing ───────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const get = (key) => {
    const match = args.find((a) => a.startsWith(`--${key}=`));
    return match ? match.split('=')[1] : null;
  };
  return {
    persona: get('persona') || 'all',
    sessions: parseInt(get('sessions') || '100', 10),
    headed: args.includes('--headed'),
  };
}

// ── Session ratio builder ──────────────────────────────────────────────────────
function buildSessionPlan(persona, totalSessions) {
  if (persona !== 'all') {
    return Array(totalSessions).fill(persona);
  }

  const confident  = Math.round(totalSessions * 0.20);
  const hesitant   = Math.round(totalSessions * 0.50);
  const abandoning = totalSessions - confident - hesitant;

  const plan = [
    ...Array(confident).fill('confident'),
    ...Array(hesitant).fill('hesitant'),
    ...Array(abandoning).fill('abandoning'),
  ];

  // Fisher-Yates shuffle to avoid running all of one type in a block
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [plan[i], plan[j]] = [plan[j], plan[i]];
  }

  return plan;
}

// ── Persona dispatcher ─────────────────────────────────────────────────────────
async function runPersona(personaName, page, logger) {
  switch (personaName) {
    case 'confident':  return runConfident(page, logger);
    case 'hesitant':   return runHesitant(page, logger);
    case 'abandoning': return runAbandoning(page, logger);
    default: throw new Error(`Unknown persona: ${personaName}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const { persona, sessions, headed } = parseArgs();
  const plan = buildSessionPlan(persona, sessions);
  const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runStats = createRunStats();

  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`  Heed Agents — Volume Runner`);
  console.log(`  Persona: ${persona} | Sessions: ${plan.length} | Headed: ${headed}`);
  console.log(`  Output stamp: ${runStamp}`);
  console.log(`╚══════════════════════════════════════════════╝\n`);

  for (let i = 0; i < plan.length; i++) {
    const personaName = plan[i];
    const sessionId = uuidv4();
    const startTs = Date.now();

    process.stdout.write(
      `  [${String(i + 1).padStart(3)}/${plan.length}] ${personaName.padEnd(12)} ${sessionId.slice(0, 8)}…`
    );

    let lastError = null;
    let sessionResult = null;
    let sessionEvents = [];

    for (let attempt = 1; attempt <= 2; attempt++) {
      let browser;
      try {
        const { browser: b, page } = await launchMobileBrowser({ headless: !headed });
        browser = b;

        const logger = attachHeedLogger(page);
        const result = await runPersona(personaName, page, logger);
        logger.detach();

        sessionResult = result;
        sessionEvents = logger.events;
        lastError = null;
        await browser.close().catch(() => {});
        break; // success
      } catch (err) {
        lastError = err;
        if (browser) await browser.close().catch(() => {});
        if (attempt < 2) {
          process.stdout.write(` ↺`);
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }

    const endTs = Date.now();
    const durationMs = endTs - startTs;

    if (lastError) {
      console.log(` ✗  ERROR: ${lastError.message}`);
      writeSession({
        sessionId, persona: personaName, outcome: 'error',
        flowComplete: false, variant: null,
        startTs, endTs, durationMs, events: [],
        error: lastError.message,
      }, runStamp, runStats);
    } else {
      const sigCount = sessionEvents.length;
      console.log(` ✓  outcome=${sessionResult.outcome}  signals=${sigCount}  ${durationMs}ms`);
      writeSession({
        sessionId, persona: personaName,
        outcome: sessionResult.outcome,
        flowComplete: sessionResult.flowComplete,
        variant: sessionResult.variant || null,
        startTs, endTs, durationMs,
        events: sessionEvents,
      }, runStamp, runStats);
    }
  }

  // ── Final summary ────────────────────────────────────────────────────────────
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`  Run complete: ${runStats.total} sessions`);
  console.log(`  By persona:  ${JSON.stringify(runStats.byPersona)}`);
  console.log(`  By outcome:  ${JSON.stringify(runStats.byOutcome)}`);
  console.log(`  Top signals: ${
    Object.entries(runStats.signalFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ') || 'none captured'
  }`);
  console.log(`  Files:  output/sessions-${runStamp}.ndjson`);
  console.log(`          output/summary-${runStamp}.json`);
  console.log(`╚══════════════════════════════════════════════╝\n`);
}

main().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
