// Re-analyze existing v1 and v2 event logs under both 2-hop and 3-hop FSMs.
// Produces a 4-cell comparison table: (v1,2hop), (v1,3hop), (v2,2hop), (v2,3hop).
// NO new Shadow runs. All data from committed events.jsonl files.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  STATES,
  EVENTS,
  VALID_2HOP,
  VALID_3HOP,
  k,
  classifyInvalid,
} from "../server/fsm.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// FSM runner parameterized by valid transition table
// ---------------------------------------------------------------------------

function runFsmOnCircuit(events, validTable) {
  let state = "IDLE";
  const violations = [];
  let validCount = 0;
  let invalidCount = 0;

  for (const ev of events) {
    const key = k(state, ev.event);
    const nextState = validTable[key];

    if (nextState !== undefined) {
      state = nextState;
      validCount++;
    } else {
      const classification = classifyInvalid(state, ev.event);
      violations.push({
        from: state,
        event: ev.event,
        classification,
        timestamp: ev.timestamp,
        injected: ev.injected || false,
        attackType: ev.attackType || null,
      });
      invalidCount++;
    }

    if (state === "CLOSED" || state === "ERROR") {
      state = "IDLE";
    }
  }

  return { violations, validCount, invalidCount };
}

function runFsmOnAllCircuits(circuitMap, validTable) {
  let totalValid = 0;
  let totalInvalid = 0;
  const allViolations = [];

  for (const [cid, events] of Object.entries(circuitMap)) {
    const result = runFsmOnCircuit(events, validTable);
    totalValid += result.validCount;
    totalInvalid += result.invalidCount;
    allViolations.push(...result.violations);
  }

  return {
    violations: allViolations,
    validCount: totalValid,
    invalidCount: totalInvalid,
    circuitCount: Object.keys(circuitMap).length,
  };
}

// ---------------------------------------------------------------------------
// Attack injection (same as shadow_harness.mjs)
// ---------------------------------------------------------------------------

function injectReplayAttack(circuitMap) {
  const modified = {};
  let injectedCount = 0;

  for (const [cid, events] of Object.entries(circuitMap)) {
    const newEvents = [...events];
    for (let i = newEvents.length - 1; i >= 0; i--) {
      if (
        newEvents[i].event === "CIRCUIT_CLOSED" ||
        newEvents[i].event === "SEND_DESTROY"
      ) {
        const ts = newEvents[i].timestamp;
        for (let j = 0; j < 3; j++) {
          newEvents.splice(i + 1, 0, {
            event: "SEND_CREATE",
            timestamp: ts,
            host: newEvents[i].host,
            injected: true,
            attackType: "REPLAY_ATTACK",
          });
          injectedCount++;
        }
        break;
      }
    }
    modified[cid] = newEvents;
  }

  return { circuits: modified, injectedCount };
}

function injectCircuitBypass(circuitMap) {
  const modified = {};
  let injectedCount = 0;

  for (const [cid, events] of Object.entries(circuitMap)) {
    const newEvents = [...events];
    for (let i = 0; i < newEvents.length; i++) {
      if (newEvents[i].event === "CONNECT") {
        newEvents.splice(
          i + 1,
          0,
          {
            event: "SEND_RELAY_DATA",
            timestamp: newEvents[i].timestamp,
            host: newEvents[i].host,
            injected: true,
            attackType: "CIRCUIT_BYPASS",
          },
          {
            event: "SEND_CREATE",
            timestamp: newEvents[i].timestamp,
            host: newEvents[i].host,
            injected: true,
            attackType: "HANDSHAKE_SKIP",
          },
        );
        injectedCount += 2;
        break;
      }
    }
    modified[cid] = newEvents;
  }

  return { circuits: modified, injectedCount };
}

// ---------------------------------------------------------------------------
// Metrics computation
// ---------------------------------------------------------------------------

function computeMetrics(fsmResult, scenario, injectedCount) {
  const totalEvents = fsmResult.validCount + fsmResult.invalidCount;

  if (scenario === "benign") {
    return {
      scenario: "benign",
      totalEvents,
      circuitCount: fsmResult.circuitCount,
      validTransitions: fsmResult.validCount,
      structuralViolations: fsmResult.invalidCount,
      tp: 0,
      fp: fsmResult.invalidCount,
      fn: 0,
      tn: fsmResult.validCount,
      precision: null,
      recall: null,
      f1: null,
      fpr:
        fsmResult.validCount + fsmResult.invalidCount > 0
          ? fsmResult.invalidCount /
            (fsmResult.invalidCount + fsmResult.validCount)
          : 0,
      violationBreakdown: breakdownViolations(fsmResult.violations),
    };
  }

  const attackViolations = fsmResult.violations.filter((v) => v.injected);
  const benignViolations = fsmResult.violations.filter((v) => !v.injected);

  const tp = attackViolations.length;
  const fn = Math.max(0, injectedCount - tp);
  const fp = benignViolations.length;
  const tn = fsmResult.validCount;

  const precision = tp + fp > 0 ? tp / (tp + fp) : null;
  const recall = tp + fn > 0 ? tp / (tp + fn) : null;
  const f1 =
    precision !== null && recall !== null && precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : null;
  const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;

  return {
    scenario,
    totalEvents,
    circuitCount: fsmResult.circuitCount,
    validTransitions: fsmResult.validCount,
    totalViolations: fsmResult.invalidCount,
    injectedAttacks: injectedCount,
    detectedAttacks: tp,
    tp,
    fp,
    fn,
    tn,
    precision,
    recall,
    f1,
    fpr,
    violationBreakdown: breakdownViolations(fsmResult.violations),
    attackBreakdown: breakdownViolations(attackViolations),
  };
}

function breakdownViolations(violations) {
  const breakdown = {};
  for (const v of violations) {
    const t = v.classification.type;
    breakdown[t] = (breakdown[t] || 0) + 1;
  }
  return breakdown;
}

// ---------------------------------------------------------------------------
// Load events.jsonl into circuit map
// ---------------------------------------------------------------------------

async function loadEventsJsonl(jsonlPath) {
  const content = await fs.readFile(jsonlPath, "utf8");
  const circuits = {};
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    const ev = JSON.parse(line);
    const cid = ev.circuitId;
    if (!circuits[cid]) circuits[cid] = [];
    circuits[cid].push(ev);
  }
  return circuits;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const versions = ["v1", "v2"];
  const fsmModels = [
    { name: "2hop", table: VALID_2HOP },
    { name: "3hop", table: VALID_3HOP },
  ];
  const scenarios = ["benign", "replay_attack", "circuit_bypass"];
  const seeds = [42, 137, 2718];

  const results = {
    metadata: {
      analysis_date: new Date().toISOString(),
      description:
        "Re-analysis of v1 and v2 Shadow event logs under both 2-hop and 3-hop FSMs",
      v1_topology: { authorities: 1, relays: 6, clients: 2 },
      v2_topology: { authorities: 1, relays: 11, clients: 5 },
      fsm_2hop_transitions: Object.keys(VALID_2HOP).length,
      fsm_3hop_transitions: Object.keys(VALID_3HOP).length,
    },
    cells: {},
  };

  console.log("=== FSM Re-Analysis: 4-Cell Comparison ===\n");

  for (const version of versions) {
    for (const fsm of fsmModels) {
      const cellKey = `${version}_${fsm.name}`;
      console.log(`\n--- Cell: ${cellKey} ---`);
      const cellResults = {};

      for (const scenario of scenarios) {
        const scenarioRuns = [];

        for (const seed of seeds) {
          const dir = version === "v1" ? "shadow_runs_v1" : "shadow_runs_v2";
          const jsonlPath = path.resolve(
            __dirname,
            dir,
            scenario,
            `run_seed${seed}`,
            "events.jsonl",
          );

          let circuitMap;
          try {
            circuitMap = await loadEventsJsonl(jsonlPath);
          } catch (err) {
            console.log(`  SKIP ${scenario}/seed${seed}: ${err.message}`);
            continue;
          }

          let traceCircuits = circuitMap;
          let injectedCount = 0;

          if (scenario === "replay_attack") {
            const result = injectReplayAttack(circuitMap);
            traceCircuits = result.circuits;
            injectedCount = result.injectedCount;
          } else if (scenario === "circuit_bypass") {
            const result = injectCircuitBypass(circuitMap);
            traceCircuits = result.circuits;
            injectedCount = result.injectedCount;
          }

          const fsmResult = runFsmOnAllCircuits(traceCircuits, fsm.table);
          const metrics = computeMetrics(fsmResult, scenario, injectedCount);
          scenarioRuns.push(metrics);
        }

        if (scenarioRuns.length > 0) {
          const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
          const sd = (a) => {
            const m = avg(a);
            return Math.sqrt(
              a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length,
            );
          };
          const stat = (arr) =>
            arr.length > 0 ? { mean: avg(arr), sd: sd(arr) } : null;

          const ps = scenarioRuns
            .map((r) => r.precision)
            .filter((v) => v !== null);
          const rs = scenarioRuns
            .map((r) => r.recall)
            .filter((v) => v !== null);
          const f1s = scenarioRuns.map((r) => r.f1).filter((v) => v !== null);
          const fprs = scenarioRuns.map((r) => r.fpr);

          cellResults[scenario] = {
            runsCompleted: scenarioRuns.length,
            precision: stat(ps),
            recall: stat(rs),
            f1: stat(f1s),
            fpr: stat(fprs),
            avgCircuits: avg(scenarioRuns.map((r) => r.circuitCount)),
            avgEvents: avg(scenarioRuns.map((r) => r.totalEvents)),
            runs: scenarioRuns,
          };

          const fmt = (x) =>
            x ? `${x.mean.toFixed(4)} +/- ${x.sd.toFixed(4)}` : "N/A";
          console.log(
            `  ${scenario}: P=${fmt(cellResults[scenario].precision)} R=${fmt(cellResults[scenario].recall)} F1=${fmt(cellResults[scenario].f1)} FPR=${fmt(cellResults[scenario].fpr)}`,
          );
        }
      }

      results.cells[cellKey] = cellResults;
    }
  }

  // Print summary table
  console.log("\n\n=== 4-CELL COMPARISON TABLE ===\n");
  console.log(
    "Cell               | Scenario         | Precision       | Recall          | F1              | FPR",
  );
  console.log(
    "-------------------|------------------|-----------------|-----------------|-----------------|----------------",
  );
  for (const cell of ["v1_2hop", "v1_3hop", "v2_2hop", "v2_3hop"]) {
    for (const s of scenarios) {
      const d = results.cells[cell]?.[s];
      if (!d) {
        console.log(`${cell.padEnd(19)}| ${s.padEnd(17)}| NO DATA`);
        continue;
      }
      const fmt = (x) =>
        x ? `${x.mean.toFixed(4)} +/- ${x.sd.toFixed(4)}` : "N/A            ";
      console.log(
        `${cell.padEnd(19)}| ${s.padEnd(17)}| ${fmt(d.precision)} | ${fmt(d.recall)} | ${fmt(d.f1)} | ${fmt(d.fpr)}`,
      );
    }
  }

  const outPath = path.resolve(__dirname, "shadow_results_4cell.json");
  await fs.writeFile(outPath, JSON.stringify(results, null, 2));
  console.log(`\nResults written to: ${outPath}`);

  return results;
}

await main();
