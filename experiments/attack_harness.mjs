// Real attack scenario harness for Tor FSM validation
// Runs 4 attacks × 3 seeds = 12 experiments
// Compares FSM detections against oracle logs from patched Tor binaries
// Outputs: precision, recall, F1, FPR for each attack type

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { STATES, EVENTS, VALID, k, classifyInvalid } from "../server/fsm.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ATTACKS = [
  "handshake-skip",
  "replay",
  "premature-data",
  "circuit-bypass"
];
const SEEDS = [12345, 23456, 34567];
const RESULTS_DIR = path.resolve(__dirname, "shadow_runs");

// ---------------------------------------------------------------------------
// 1) Parse oracle log from patched Tor binary
// ---------------------------------------------------------------------------

function parseOracleLog(logContent) {
  const oracleEvents = {};
  const lines = logContent.split("\n");
  
  for (const line of lines) {
    // Detect ATTACK_* log lines from oracle
    const attackMatch = line.match(
      /ATTACK_(HANDSHAKE_SKIP|REPLAY_INJECTED|PREMATURE_DATA|CIRCUIT_BYPASS)\s+circ=(\d+)/
    );
    
    if (attackMatch) {
      const attackType = attackMatch[1];
      const circId = attackMatch[2];
      const timestamp = line.match(/^(\w+ \d+ [\d:.]+)/)?.[1] || null;
      
      if (!oracleEvents[circId]) {
        oracleEvents[circId] = [];
      }
      
      oracleEvents[circId].push({
        attackType,
        timestamp,
        isOracleDetected: true
      });
    }
  }
  
  return oracleEvents;
}

// ---------------------------------------------------------------------------
// 2) Compute confusion matrix: TP/FP/FN/TN
// ---------------------------------------------------------------------------

function computeConfusionMatrix(oracleEvents, fsmViolations) {
  let tp = 0;  // Oracle detected AND FSM detected
  let fn = 0;  // Oracle detected but FSM missed
  let fp = 0;  // FSM detected but oracle didn't
  
  // Circuits with oracle detections
  for (const [circId, oracleList] of Object.entries(oracleEvents)) {
    const fsmViolationCount = (fsmViolations[circId] || []).length;
    
    if (fsmViolationCount > 0) {
      tp += Math.min(oracleList.length, fsmViolationCount);
      fn += Math.max(0, oracleList.length - fsmViolationCount);
    } else {
      fn += oracleList.length;
    }
  }
  
  // Circuits where FSM detected but oracle didn't
  for (const [circId, fsmViolationList] of Object.entries(fsmViolations)) {
    if (!oracleEvents[circId]) {
      fp += fsmViolationList.length;
    }
  }
  
  return { tp, fp, fn };
}

// ---------------------------------------------------------------------------
// 3) Run single attack experiment
// ---------------------------------------------------------------------------

async function runAttackExperiment(attackType, seed) {
  const runDir = path.join(RESULTS_DIR, `attack-${attackType}`, `seed-${seed}`);
  
  console.log(`  [${attackType}:${seed}] Parsing results...`);
  
  // Parse oracle log from relay1
  let oracleLog = "";
  try {
    const logPattern = path.join(runDir, "shadow.data", "hosts", "relay1", "tor.*.stdout");
    const logFiles = execSync(`ls -1 ${logPattern} 2>/dev/null | head -1`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"]
    }).trim();
    
    if (logFiles) {
      oracleLog = await fs.readFile(logFiles, "utf8");
    }
  } catch (e) {
    // Log file not found, continue without oracle
  }
  
  const oracleEvents = parseOracleLog(oracleLog);
  const totalOracleDetections = Object.values(oracleEvents).reduce((sum, arr) => sum + arr.length, 0);
  
  // Read FSM results
  let fsmViolations = {};
  let validTransitions = 0;
  try {
    const resultsPath = path.join(runDir, "results.json");
    const resultsData = JSON.parse(await fs.readFile(resultsPath, "utf8"));
    
    // Map violations by circuit ID
    for (const v of (resultsData.sampleViolations || [])) {
      // This is simplified; in real scenario, parse full violation log
      if (!fsmViolations[v.circuitId]) {
        fsmViolations[v.circuitId] = [];
      }
      fsmViolations[v.circuitId].push(v);
    }
    
    validTransitions = resultsData.fsmResult?.validCount || 0;
  } catch (e) {
    console.warn(`    Warning: Could not read FSM results`);
    return null;
  }
  
  const { tp, fp, fn } = computeConfusionMatrix(oracleEvents, fsmViolations);
  const tn = validTransitions;
  
  // Metrics
  const precision = tp + fp > 0 ? tp / (tp + fp) : null;
  const recall = tp + fn > 0 ? tp / (tp + fn) : null;
  const f1 = precision !== null && recall !== null && (precision + recall) > 0
    ? 2 * precision * recall / (precision + recall)
    : null;
  const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;
  
  console.log(`    Oracle events: ${totalOracleDetections}, TP=${tp} FP=${fp} FN=${fn}`);
  console.log(`    P=${precision?.toFixed(4) ?? "N/A"} R=${recall?.toFixed(4) ?? "N/A"} F1=${f1?.toFixed(4) ?? "N/A"} FPR=${fpr?.toFixed(4)}`);
  
  return {
    attackType,
    seed,
    totalOracleDetections,
    tp, fp, fn, tn,
    precision,
    recall,
    f1,
    fpr
  };
}

// ---------------------------------------------------------------------------
// 4) Main pipeline
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n=== Real Attack Scenario Validation ===");
  console.log("=== Oracle vs FSM Detection ===\n");
  console.log(`Attacks: ${ATTACKS.join(", ")}`);
  console.log(`Seeds: ${SEEDS.join(", ")}`);
  console.log(`Total experiments: ${ATTACKS.length} × ${SEEDS.length} = ${ATTACKS.length * SEEDS.length}\n`);
  
  const allResults = {
    metadata: {
      date: new Date().toISOString(),
      attacks: ATTACKS,
      seeds: SEEDS,
      totalExperiments: ATTACKS.length * SEEDS.length
    },
    experiments: [],
    perAttack: {}
  };
  
  for (const attack of ATTACKS) {
    console.log(`\nAttack: ${attack.toUpperCase()}`);
    const attackResults = [];
    
    for (const seed of SEEDS) {
      const result = await runAttackExperiment(attack, seed);
      if (result) {
        attackResults.push(result);
        allResults.experiments.push(result);
      }
    }
    
    if (attackResults.length > 0) {
      const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
      const sd = (arr) => {
        const m = avg(arr);
        return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
      };
      
      const ps = attackResults.map(r => r.precision).filter(v => v !== null);
      const rs = attackResults.map(r => r.recall).filter(v => v !== null);
      const f1s = attackResults.map(r => r.f1).filter(v => v !== null);
      const fprs = attackResults.map(r => r.fpr);
      
      allResults.perAttack[attack] = {
        runsCompleted: attackResults.length,
        precision: ps.length > 0 ? { mean: avg(ps), sd: sd(ps) } : null,
        recall: rs.length > 0 ? { mean: avg(rs), sd: sd(rs) } : null,
        f1: f1s.length > 0 ? { mean: avg(f1s), sd: sd(f1s) } : null,
        fpr: fprs.length > 0 ? { mean: avg(fprs), sd: sd(fprs) } : null
      };
    }
  }
  
  console.log("\n\n=== ATTACK SCENARIO RESULTS ===\n");
  console.log("Attack              | Precision       | Recall          | F1              | FPR");
  console.log("--------------------|-----------------|-----------------|-----------------|----------------");
  
  for (const attack of ATTACKS) {
    const data = allResults.perAttack[attack];
    if (!data) continue;
    
    const fmt = (x) => x ? `${x.mean.toFixed(4)} +/- ${x.sd.toFixed(4)}` : "N/A            ";
    const line = `${attack.padEnd(20)}| ${fmt(data.precision)} | ${fmt(data.recall)} | ${fmt(data.f1)} | ${fmt(data.fpr)}`;
    console.log(line);
  }
  
  const outPath = path.resolve(__dirname, "attack_scenarios_results.json");
  await fs.writeFile(outPath, JSON.stringify(allResults, null, 2));
  console.log(`\nResults written to: ${outPath}`);
  
  return allResults;
}

const results = await main();
export default results;
