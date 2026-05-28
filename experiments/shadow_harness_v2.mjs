// Shadow + Tor empirical validation harness (v2).
// Runs real Shadow simulations with expanded topology (3 DA, 30 relays, 8 clients)
// and analyzes results under both 2-hop and 3-hop FSMs.
//
// NO fabricated data. Every number comes from actual Shadow log parsing.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import {
  STATES,
  EVENTS,
  VALID_2HOP,
  VALID_3HOP,
  k,
  classifyInvalid,
} from "../server/fsm.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHADOW_BIN = process.env.HOME + "/.local/bin/shadow";
const RESULTS_DIR = path.resolve(__dirname, "shadow_runs_v2");

// ---------------------------------------------------------------------------
// Tor log parser (same as v1 harness)
// ---------------------------------------------------------------------------

function parseTorHostLog(logContent, hostName) {
  const lines = logContent.split("\n");
  let lastCircuitId = null;
  const circuits = {};
  let orconnEstablished = false;
  let orconnPending = false;
  const circuitHopCount = {};
  let buildingCircuitId = null;

  for (const line of lines) {
    const tsMatch = line.match(/^(\w+ \d+ [\d:.]+)/);
    const ts = tsMatch ? tsMatch[1] : null;
    if (!ts) continue;

    const circNew = line.match(/origin_circuit_new\(\): Circuit (\d+)/);
    if (circNew) {
      const cid = circNew[1];
      lastCircuitId = cid;
      if (!circuits[cid]) circuits[cid] = [];
      circuits[cid].push({ event: "CONNECT", timestamp: ts, host: hostName });
      if (orconnEstablished) {
        circuits[cid].push({ event: "TLS_OK", timestamp: ts, host: hostName });
      } else {
        orconnPending = true;
      }
      continue;
    }

    const orconn = line.match(/ORCONN BEST_ANY state (?:-?\d+)->(\d+)/);
    if (orconn) {
      const newState = parseInt(orconn[1]);
      if (newState >= 7 && !orconnEstablished) {
        orconnEstablished = true;
        orconnPending = false;
        if (lastCircuitId && circuits[lastCircuitId]) {
          circuits[lastCircuitId].push({
            event: "TLS_OK",
            timestamp: ts,
            host: hostName,
          });
        }
      }
      continue;
    }

    if (/connection_or_connect_failed_tls/i.test(line)) {
      if (lastCircuitId && circuits[lastCircuitId]) {
        circuits[lastCircuitId].push({
          event: "TLS_FAIL",
          timestamp: ts,
          host: hostName,
        });
      }
      orconnPending = false;
      continue;
    }

    if (/circuit_send_first_onion_skin\(\).*sending CREATE/i.test(line)) {
      buildingCircuitId = lastCircuitId;
      if (lastCircuitId && circuits[lastCircuitId]) {
        circuits[lastCircuitId].push({
          event: "SEND_CREATE",
          timestamp: ts,
          host: hostName,
        });
      }
      continue;
    }

    if (/circuit_finish_handshake\(\)/.test(line)) {
      const cid = buildingCircuitId || lastCircuitId;
      if (cid && circuits[cid]) {
        const hop = (circuitHopCount[cid] || 0) + 1;
        circuitHopCount[cid] = hop;
        if (hop === 1) {
          circuits[cid].push({
            event: "RECV_CREATED",
            timestamp: ts,
            host: hostName,
          });
        } else {
          circuits[cid].push({
            event: "SEND_EXTEND",
            timestamp: ts,
            host: hostName,
          });
          circuits[cid].push({
            event: "RECV_EXTENDED",
            timestamp: ts,
            host: hostName,
          });
        }
      }
      continue;
    }

    if (/circuit_build_no_more_hops\(\).*circuit built/i.test(line)) {
      continue;
    }

    if (/connection_ap_handshake_send_begin\(\)/.test(line)) {
      if (lastCircuitId && circuits[lastCircuitId]) {
        circuits[lastCircuitId].push({
          event: "SEND_RELAY_DATA",
          timestamp: ts,
          host: hostName,
        });
      }
      continue;
    }

    if (/circuit_mark_for_close/i.test(line)) {
      const closeMatch = line.match(/\(id:\s*(\d+)\)/);
      const cid = closeMatch ? closeMatch[1] : lastCircuitId;
      if (cid && circuits[cid]) {
        circuits[cid].push({
          event: "SEND_DESTROY",
          timestamp: ts,
          host: hostName,
        });
      }
      continue;
    }

    if (/circuit_free_\(\)/i.test(line)) {
      const freeMatch = line.match(/\(id:\s*(\d+)\)/);
      const cid = freeMatch ? freeMatch[1] : lastCircuitId;
      if (cid && circuits[cid]) {
        circuits[cid].push({
          event: "CIRCUIT_CLOSED",
          timestamp: ts,
          host: hostName,
        });
      }
      continue;
    }

    if (/circuit_expire_building/i.test(line)) {
      if (lastCircuitId && circuits[lastCircuitId]) {
        circuits[lastCircuitId].push({
          event: "TIMEOUT",
          timestamp: ts,
          host: hostName,
        });
      }
      continue;
    }
  }

  return circuits;
}

// ---------------------------------------------------------------------------
// FSM runner parameterized by valid transition table
// ---------------------------------------------------------------------------

function runFsmOnCircuit(events, validTable) {
  let state = "IDLE";
  const transitions = [];
  const violations = [];
  let validCount = 0;
  let invalidCount = 0;

  for (const ev of events) {
    const key = k(state, ev.event);
    const nextState = validTable[key];

    if (nextState !== undefined) {
      transitions.push({
        from: state,
        event: ev.event,
        to: nextState,
        isValid: true,
        timestamp: ev.timestamp,
      });
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
      transitions.push({
        from: state,
        event: ev.event,
        to: state,
        isValid: false,
        classification,
        timestamp: ev.timestamp,
      });
      invalidCount++;
    }

    if (state === "CLOSED" || state === "ERROR") {
      state = "IDLE";
    }
  }

  return {
    transitions,
    violations,
    validCount,
    invalidCount,
    finalState: state,
  };
}

function runFsmOnAllCircuits(circuitMap, validTable) {
  let totalValid = 0;
  let totalInvalid = 0;
  const allViolations = [];
  const perCircuit = {};

  for (const [cid, events] of Object.entries(circuitMap)) {
    const result = runFsmOnCircuit(events, validTable);
    totalValid += result.validCount;
    totalInvalid += result.invalidCount;
    allViolations.push(...result.violations);
    perCircuit[cid] = {
      eventCount: events.length,
      validCount: result.validCount,
      invalidCount: result.invalidCount,
      finalState: result.finalState,
    };
  }

  return {
    violations: allViolations,
    validCount: totalValid,
    invalidCount: totalInvalid,
    circuitCount: Object.keys(circuitMap).length,
    perCircuit,
  };
}

// ---------------------------------------------------------------------------
// Attack injection
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

// A3 attack injectors
function injectGhostCircuit(circuitMap) {
  const modified = {};
  let injectedCount = 0;

  for (const [cid, events] of Object.entries(circuitMap)) {
    const newEvents = [...events];
    for (let i = newEvents.length - 1; i >= 0; i--) {
      if (newEvents[i].event === "CIRCUIT_CLOSED") {
        newEvents.splice(
          i + 1,
          0,
          {
            event: "SEND_RELAY_DATA",
            timestamp: newEvents[i].timestamp,
            host: newEvents[i].host,
            injected: true,
            attackType: "GHOST_CIRCUIT",
          },
          {
            event: "RECV_RELAY_DATA",
            timestamp: newEvents[i].timestamp,
            host: newEvents[i].host,
            injected: true,
            attackType: "GHOST_CIRCUIT",
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

function injectHandshakeSkip(circuitMap) {
  const modified = {};
  let injectedCount = 0;

  for (const [cid, events] of Object.entries(circuitMap)) {
    const newEvents = [...events];
    for (let i = 0; i < newEvents.length; i++) {
      if (newEvents[i].event === "CONNECT") {
        newEvents.splice(i + 1, 0, {
          event: "SEND_CREATE",
          timestamp: newEvents[i].timestamp,
          host: newEvents[i].host,
          injected: true,
          attackType: "HANDSHAKE_SKIP",
        });
        injectedCount++;
        break;
      }
    }
    modified[cid] = newEvents;
  }
  return { circuits: modified, injectedCount };
}

function injectPrematureData(circuitMap) {
  const modified = {};
  let injectedCount = 0;

  for (const [cid, events] of Object.entries(circuitMap)) {
    const newEvents = [...events];
    for (let i = 0; i < newEvents.length; i++) {
      if (newEvents[i].event === "RECV_CREATED") {
        newEvents.splice(i + 1, 0, {
          event: "SEND_RELAY_DATA",
          timestamp: newEvents[i].timestamp,
          host: newEvents[i].host,
          injected: true,
          attackType: "PREMATURE_DATA",
        });
        injectedCount++;
        break;
      }
    }
    modified[cid] = newEvents;
  }
  return { circuits: modified, injectedCount };
}

function injectCreateFlood(circuitMap) {
  const modified = {};
  let injectedCount = 0;

  for (const [cid, events] of Object.entries(circuitMap)) {
    const newEvents = [...events];
    for (let i = 0; i < newEvents.length; i++) {
      if (newEvents[i].event === "SEND_CREATE") {
        for (let j = 0; j < 5; j++) {
          newEvents.splice(i + 1, 0, {
            event: "SEND_CREATE",
            timestamp: newEvents[i].timestamp,
            host: newEvents[i].host,
            injected: true,
            attackType: "CREATE_FLOOD",
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

// ---------------------------------------------------------------------------
// Metrics
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
      fpr: totalEvents > 0 ? fsmResult.invalidCount / totalEvents : 0,
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
// Shadow runner
// ---------------------------------------------------------------------------

// Template/conf directories: use env vars if set, otherwise fall back to
// the committed topology in the repo (experiments/topology/generated).
const V2_TEMPLATE_DIR =
  process.env.SHADOW_V2_TEMPLATE ||
  path.resolve(__dirname, "topology/generated");
const V2_CONF_DIR =
  process.env.SHADOW_V2_CONF ||
  path.resolve(__dirname, "topology/generated/conf");

function generateShadowYaml(seed) {
  const guardRelays = Array.from({ length: 20 }, (_, i) => `relay${i + 1}`);
  const exitRelays = Array.from({ length: 10 }, (_, i) => `exit${i + 1}`);
  const das = [
    { name: "4uthority", ip: "100.0.0.1" },
    { name: "da2", ip: "100.0.0.2" },
    { name: "da3", ip: "100.0.0.3" },
  ];
  const torClients = [
    "torclient",
    "torclient2",
    "torclient3",
    "torclient4",
    "torclient5",
    "torclient6",
    "torclient7",
    "torclient8",
  ];

  const lines = [];
  lines.push(`general:`);
  lines.push(`  seed: ${seed}`);
  lines.push(`  stop_time: 30 min`);
  lines.push(`network:`);
  lines.push(`  graph:`);
  lines.push(`    type: gml`);
  lines.push(`    inline: |`);
  lines.push(`      graph [`);
  lines.push(`        directed 0`);
  lines.push(`        node [`);
  lines.push(`          id 0`);
  lines.push(`          host_bandwidth_down "1 Gbit"`);
  lines.push(`          host_bandwidth_up "1 Gbit"`);
  lines.push(`        ]`);
  lines.push(`        edge [`);
  lines.push(`          source 0`);
  lines.push(`          target 0`);
  lines.push(`          latency "50 ms"`);
  lines.push(`          jitter "0 ms"`);
  lines.push(`          packet_loss 0.0`);
  lines.push(`        ]`);
  lines.push(`      ]`);
  lines.push(`hosts:`);
  lines.push(`  fileserver:`);
  lines.push(`    network_node_id: 0`);
  lines.push(`    processes:`);
  lines.push(`    - path: tgen`);
  lines.push(`      environment: { OPENBLAS_NUM_THREADS: "1" }`);
  lines.push(`      args: ../../../conf/tgen.server.graphml.xml`);
  lines.push(`      start_time: 1`);
  lines.push(`      expected_final_state: running`);

  for (const d of das) {
    lines.push(`  ${d.name}:`);
    lines.push(`    network_node_id: 0`);
    lines.push(`    ip_addr: ${d.ip}`);
    lines.push(`    processes:`);
    lines.push(`    - path: tor`);
    lines.push(`      args: --Address ${d.name} --Nickname ${d.name}`);
    lines.push(`            --defaults-torrc torrc-defaults -f torrc`);
    lines.push(`      start_time: 1`);
    lines.push(`      expected_final_state: running`);
  }

  for (const r of [...guardRelays, ...exitRelays]) {
    lines.push(`  ${r}:`);
    lines.push(`    network_node_id: 0`);
    lines.push(`    processes:`);
    lines.push(`    - path: tor`);
    lines.push(`      args: --Address ${r} --Nickname ${r}`);
    lines.push(`            --defaults-torrc torrc-defaults -f torrc`);
    lines.push(`      start_time: 60`);
    lines.push(`      expected_final_state: running`);
  }

  lines.push(`  torflowauthority:`);
  lines.push(`    network_node_id: 0`);
  lines.push(`    processes: []`);
  lines.push(`  client:`);
  lines.push(`    network_node_id: 0`);
  lines.push(`    processes:`);
  lines.push(`    - path: tgen`);
  lines.push(`      environment: { OPENBLAS_NUM_THREADS: "1" }`);
  lines.push(`      args: ../../../conf/tgen.client.graphml.xml`);
  lines.push(`      start_time: 600`);
  lines.push(`      expected_final_state: running`);

  for (const c of torClients) {
    lines.push(`  ${c}:`);
    lines.push(`    network_node_id: 0`);
    lines.push(`    processes:`);
    lines.push(`    - path: tor`);
    lines.push(`      args: --Address ${c} --Nickname ${c}`);
    lines.push(`            --defaults-torrc torrc-defaults -f torrc`);
    lines.push(`      start_time: 900`);
    lines.push(`      expected_final_state: running`);
    lines.push(`    - path: tgen`);
    lines.push(`      environment: { OPENBLAS_NUM_THREADS: "1" }`);
    lines.push(`      args: ../../../conf/tgen.torclient.graphml.xml`);
    lines.push(`      start_time: 1500`);
    lines.push(`      expected_final_state: running`);
  }

  return lines.join("\n");
}

async function runShadowSimulation(seed, label) {
  const runDir = path.join(RESULTS_DIR, label, `run_seed${seed}`);
  await fs.mkdir(runDir, { recursive: true });

  // Copy template and conf (clean first to avoid nested dirs on re-run)
  execSync(
    `rm -rf ${runDir}/shadow.data.template ${runDir}/conf && cp -rL ${V2_TEMPLATE_DIR} ${runDir}/shadow.data.template && cp -rL ${V2_CONF_DIR} ${runDir}/conf`,
    { stdio: "pipe" },
  );

  // Write shadow.yaml
  const yaml = generateShadowYaml(seed);
  await fs.writeFile(path.join(runDir, "shadow.yaml"), yaml);

  console.log(`  Running Shadow simulation: ${label} seed=${seed} ...`);
  const t0 = Date.now();

  try {
    execSync(
      `cd "${runDir}" && rm -rf shadow.data/ && ${SHADOW_BIN} --template-directory shadow.data.template shadow.yaml > shadow.log 2>&1`,
      { stdio: "pipe", timeout: 300000, maxBuffer: 50 * 1024 * 1024 },
    );
  } catch (err) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  FAILED after ${elapsed}s: ${err.message?.slice(0, 200)}`);
    await fs.writeFile(
      path.join(runDir, "error.txt"),
      err.message || "unknown error",
    );
    return {
      success: false,
      error: err.message?.slice(0, 500),
      runDir,
      elapsed,
    };
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  Completed in ${elapsed}s`);
  return { success: true, runDir, elapsed };
}

async function collectPerCircuitLogs(runDir) {
  const hostsDir = path.join(runDir, "shadow.data", "hosts");
  let entries;
  try {
    entries = await fs.readdir(hostsDir);
  } catch {
    return {};
  }

  const allCircuits = {};

  for (const host of entries) {
    const hostDir = path.join(hostsDir, host);
    let files;
    try {
      files = await fs.readdir(hostDir);
    } catch {
      continue;
    }

    for (const f of files) {
      if (f.startsWith("tor.") && f.endsWith(".stdout")) {
        const content = await fs.readFile(path.join(hostDir, f), "utf8");
        const hostCircuits = parseTorHostLog(content, host);
        for (const [cid, events] of Object.entries(hostCircuits)) {
          const globalCid = `${host}_circ${cid}`;
          allCircuits[globalCid] = events;
        }
      }
    }
  }

  return allCircuits;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const INJECTORS = {
  benign: null,
  replay_attack: injectReplayAttack,
  circuit_bypass: injectCircuitBypass,
  ghost_circuit: injectGhostCircuit,
  handshake_skip: injectHandshakeSkip,
  premature_data: injectPrematureData,
  create_flood: injectCreateFlood,
};

async function main() {
  console.log("=== Shadow + Tor v2 Harness (Expanded Topology) ===\n");

  const SEEDS = [42, 137, 2718];
  const SCENARIOS = Object.keys(INJECTORS);
  const FSM_MODELS = [
    { name: "2hop", table: VALID_2HOP },
    { name: "3hop", table: VALID_3HOP },
  ];

  const allResults = {
    metadata: {
      shadow_version: "3.3.0",
      tor_version: execSync("tor --version", { encoding: "utf8" })
        .trim()
        .split("\n")[0],
      run_date: new Date().toISOString(),
      seeds: SEEDS,
      scenarios: SCENARIOS,
      simulated_time: "30 min",
      repetitions: SEEDS.length,
      network_topology: {
        authorities: 3,
        relays: 30,
        exit_relays: 10,
        guard_middle_relays: 20,
        clients: 8,
      },
      fsm_models: {
        "2hop": { valid_transitions: Object.keys(VALID_2HOP).length },
        "3hop": { valid_transitions: Object.keys(VALID_3HOP).length },
      },
    },
    runs: [],
    perCell: {},
  };

  // Run benign simulations first (only need one set, reuse for all attack scenarios)
  console.log("--- Phase 1: Running benign Shadow simulations ---");
  const benignCircuitMaps = {};
  for (const seed of SEEDS) {
    const simResult = await runShadowSimulation(seed, "benign");
    if (!simResult.success) {
      console.log(`  FATAL: benign seed=${seed} failed. Aborting.`);
      continue;
    }
    const circuitMap = await collectPerCircuitLogs(simResult.runDir);
    benignCircuitMaps[seed] = circuitMap;

    // Save events.jsonl
    const jsonlPath = path.join(simResult.runDir, "events.jsonl");
    const jsonlLines = [];
    for (const [cid, events] of Object.entries(circuitMap)) {
      for (const ev of events) {
        jsonlLines.push(JSON.stringify({ circuitId: cid, ...ev }));
      }
    }
    await fs.writeFile(jsonlPath, jsonlLines.join("\n"));

    const totalEvents = Object.values(circuitMap).reduce(
      (a, e) => a + e.length,
      0,
    );
    console.log(
      `  Seed ${seed}: ${Object.keys(circuitMap).length} circuits, ${totalEvents} events`,
    );
  }

  // Phase 2: Analyze all scenarios x FSMs
  console.log("\n--- Phase 2: Analyzing all scenarios x FSM models ---");

  for (const scenario of SCENARIOS) {
    for (const fsm of FSM_MODELS) {
      const cellKey = `v2_${fsm.name}_${scenario}`;
      const scenarioRuns = [];

      for (const seed of SEEDS) {
        const baseCircuits = benignCircuitMaps[seed];
        if (!baseCircuits) continue;

        let traceCircuits = baseCircuits;
        let injectedCount = 0;

        const injector = INJECTORS[scenario];
        if (injector) {
          const result = injector(baseCircuits);
          traceCircuits = result.circuits;
          injectedCount = result.injectedCount;
        }

        const fsmResult = runFsmOnAllCircuits(traceCircuits, fsm.table);
        const metrics = computeMetrics(
          fsmResult,
          scenario === "benign" ? "benign" : scenario,
          injectedCount,
        );

        const runResult = {
          seed,
          scenario,
          fsmModel: fsm.name,
          circuitCount: fsmResult.circuitCount,
          rawEventCount: Object.values(traceCircuits).reduce(
            (a, e) => a + e.length,
            0,
          ),
          injectedCount,
          fsmResult: {
            validCount: fsmResult.validCount,
            invalidCount: fsmResult.invalidCount,
            circuitCount: fsmResult.circuitCount,
          },
          metrics,
        };

        scenarioRuns.push(runResult);
        allResults.runs.push(runResult);
      }

      if (scenarioRuns.length > 0) {
        const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
        const sd = (a) => {
          const m = avg(a);
          return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length);
        };
        const stat = (arr) =>
          arr.length > 0 ? { mean: avg(arr), sd: sd(arr) } : null;

        const ps = scenarioRuns
          .map((r) => r.metrics.precision)
          .filter((v) => v !== null);
        const rs = scenarioRuns
          .map((r) => r.metrics.recall)
          .filter((v) => v !== null);
        const f1s = scenarioRuns
          .map((r) => r.metrics.f1)
          .filter((v) => v !== null);
        const fprs = scenarioRuns.map((r) => r.metrics.fpr);

        allResults.perCell[cellKey] = {
          scenario,
          fsmModel: fsm.name,
          runsCompleted: scenarioRuns.length,
          precision: stat(ps),
          recall: stat(rs),
          f1: stat(f1s),
          fpr: stat(fprs),
          avgCircuits: avg(scenarioRuns.map((r) => r.circuitCount)),
          avgEvents: avg(scenarioRuns.map((r) => r.rawEventCount)),
        };

        const fmt = (x) =>
          x ? `${x.mean.toFixed(4)} +/- ${x.sd.toFixed(4)}` : "N/A";
        const d = allResults.perCell[cellKey];
        console.log(
          `  ${cellKey}: P=${fmt(d.precision)} R=${fmt(d.recall)} F1=${fmt(d.f1)} FPR=${fmt(d.fpr)}`,
        );
      }
    }
  }

  // Write results
  const outPath = path.resolve(__dirname, "shadow_results_v2.json");
  await fs.writeFile(outPath, JSON.stringify(allResults, null, 2));
  console.log(`\nResults written to: ${outPath}`);

  // Print summary table
  console.log("\n=== V2 RESULTS SUMMARY ===\n");
  console.log(
    "FSM    | Scenario         | Precision       | Recall          | F1              | FPR",
  );
  console.log(
    "-------|------------------|-----------------|-----------------|-----------------|----------------",
  );
  for (const fsm of ["2hop", "3hop"]) {
    for (const s of SCENARIOS) {
      const d = allResults.perCell[`v2_${fsm}_${s}`];
      if (!d) {
        console.log(`${fsm.padEnd(7)}| ${s.padEnd(17)}| NO DATA`);
        continue;
      }
      const fmt = (x) =>
        x ? `${x.mean.toFixed(4)} +/- ${x.sd.toFixed(4)}` : "N/A            ";
      console.log(
        `${fsm.padEnd(7)}| ${s.padEnd(17)}| ${fmt(d.precision)} | ${fmt(d.recall)} | ${fmt(d.f1)} | ${fmt(d.fpr)}`,
      );
    }
  }

  return allResults;
}

const results = await main();
export default results;
