/**
 * detect_json.mjs
 * Reads results.jsonl produced by full_pipeline.sh and computes
 * per-attack detection metrics (attack count vs benign count).
 *
 * Output: JSON with per-signal statistics.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_FILE = path.join(__dirname, "runs", "results.jsonl");

/**
 * Load all JSONL records from results file.
 */
function loadResults(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Results file not found: ${filePath}`);
    process.exit(1);
  }
  return fs.readFileSync(filePath, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

/**
 * Separate records into attack and benign groups per signal.
 * Each record has: { seed, mode: "attack"|"benign", signals: { REPLAY: N, ... } }
 */
function computeStats(records) {
  const signals = [
    "CREATE_FLOOD",
    "PREMATURE",
    "SENDME_FLOOD",
    "REPLAY",
    "GHOST",
  ];

  const stats = {};

  for (const sig of signals) {
    const attackCounts = records
      .filter((r) => r.mode === "attack")
      .map((r) => r.signals?.[sig] ?? 0);
    const benignCounts = records
      .filter((r) => r.mode === "benign")
      .map((r) => r.signals?.[sig] ?? 0);

    const attackTotal = attackCounts.reduce((a, b) => a + b, 0);
    const benignTotal = benignCounts.reduce((a, b) => a + b, 0);
    const attackMean = attackCounts.length
      ? attackTotal / attackCounts.length
      : 0;
    const benignMean = benignCounts.length
      ? benignTotal / benignCounts.length
      : 0;

    // Detection: attack mean > benign mean (with at least 1 attack hit)
    const detected = attackTotal > 0 && attackMean > benignMean;

    stats[sig] = {
      attack_seeds: attackCounts.length,
      benign_seeds: benignCounts.length,
      attack_total: attackTotal,
      benign_total: benignTotal,
      attack_mean: +attackMean.toFixed(2),
      benign_mean: +benignMean.toFixed(2),
      ratio: benignMean > 0 ? +(attackMean / benignMean).toFixed(2) : null,
      detected,
    };
  }

  return stats;
}

// ── Main ─────────────────────────────────────────────────────────────────────
const records = loadResults(RESULTS_FILE);
const stats = computeStats(records);

console.log(JSON.stringify({ results_file: RESULTS_FILE, stats }, null, 2));
