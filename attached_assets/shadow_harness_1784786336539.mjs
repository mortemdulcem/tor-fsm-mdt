/**
 * shadow_harness.mjs
 * Tor FSM-MDT Shadow simulation harness.
 * Parses Tor host logs and extracts FSM attack signals.
 *
 * Supported attack signals:
 *   CREATE_FLOOD  : [FSM-CREATE] log line
 *   PREMATURE     : [FSM-PREMATURE] log line
 *   SENDME_FLOOD  : [FSM-SENDME] log line
 *   REPLAY        : [FSM-REPLAY] log line
 *   GHOST         : "unknown circuit ... Dropping" log line
 */

import fs from "fs";
import path from "path";
import readline from "readline";

// ── Signal regex definitions ─────────────────────────────────────────────────
const SIGNAL_PATTERNS = {
  CREATE_FLOOD: /\[FSM-CREATE\]/i,
  PREMATURE:    /\[FSM-PREMATURE\]/i,
  SENDME_FLOOD: /\[FSM-SENDME\]/i,
  REPLAY:       /\[FSM-REPLAY\]\s+duplicate relay cell injected/i,
  GHOST:        /unknown circuit \d+ on connection from .+\. Dropping\./i,
};

/**
 * Parse a single Tor host log file and count signal occurrences.
 * @param {string} logPath - Absolute path to the log file
 * @returns {Promise<Object>} - { signalName: count, ... }
 */
export async function parseTorHostLog(logPath) {
  const counts = Object.fromEntries(
    Object.keys(SIGNAL_PATTERNS).map((k) => [k, 0])
  );

  if (!fs.existsSync(logPath)) {
    return counts;
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(logPath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    for (const [name, re] of Object.entries(SIGNAL_PATTERNS)) {
      if (re.test(line)) {
        counts[name]++;
      }
    }
  }

  return counts;
}

/**
 * Aggregate counts from all host log files in a Shadow run directory.
 * @param {string} runDir - Path to a single Shadow run output directory
 * @returns {Promise<Object>} - aggregated signal counts
 */
export async function aggregateRunCounts(runDir) {
  const totals = Object.fromEntries(
    Object.keys(SIGNAL_PATTERNS).map((k) => [k, 0])
  );

  if (!fs.existsSync(runDir)) {
    return totals;
  }

  // Shadow writes per-host logs under runDir/hosts/<hostname>/tor.*.log
  const hostsDir = path.join(runDir, "hosts");
  if (!fs.existsSync(hostsDir)) {
    return totals;
  }

  const hostDirs = fs.readdirSync(hostsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(hostsDir, d.name));

  for (const hd of hostDirs) {
    const logFiles = fs.readdirSync(hd)
      .filter((f) => f.endsWith(".log") || f.endsWith(".stdout"))
      .map((f) => path.join(hd, f));

    for (const lf of logFiles) {
      const counts = await parseTorHostLog(lf);
      for (const k of Object.keys(totals)) {
        totals[k] += counts[k];
      }
    }
  }

  return totals;
}

// ── CLI entry point ───────────────────────────────────────────────────────────
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [, , runDir] = process.argv;
  if (!runDir) {
    console.error("Usage: node shadow_harness.mjs <run_dir>");
    process.exit(1);
  }
  const counts = await aggregateRunCounts(runDir);
  console.log(JSON.stringify(counts, null, 2));
}
