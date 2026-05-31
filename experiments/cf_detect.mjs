// CREATE_FLOOD real-attack detector — standalone re-parser.
//
// Purpose: feed an EXISTING Shadow run's Tor client log (produced by the
// patched Tor binary with TOR_FSM_ATTACK_CREATE_FLOOD=1) through the SAME FSM
// detector used by experiments/shadow_harness.mjs, WITHOUT rebuilding Shadow.
//
// The FSM detector (VALID / k / classifyInvalid) is imported from the single
// source of truth server/fsm.ts. The log->event parser and the per-circuit FSM
// runner below are copied VERBATIM from experiments/shadow_harness.mjs so the
// event reconstruction is byte-identical to the main harness (no divergence).
//
// NO fabricated data. Every event comes from the real Tor log.
//
// Usage:  tsx experiments/cf_detect.mjs [path-to-tor.NNNN.stdout]

import { readFileSync, writeFileSync } from "node:fs";
import { VALID, k, classifyInvalid } from "../server/fsm.ts";

// --- parser (verbatim from shadow_harness.mjs) -----------------------------
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
          circuits[lastCircuitId].push({ event: "TLS_OK", timestamp: ts, host: hostName });
        }
      }
      continue;
    }

    if (/connection_or_connect_failed_tls/i.test(line)) {
      if (lastCircuitId && circuits[lastCircuitId]) {
        circuits[lastCircuitId].push({ event: "TLS_FAIL", timestamp: ts, host: hostName });
      }
      orconnPending = false;
      continue;
    }

    if (/circuit_send_first_onion_skin\(\).*sending CREATE/i.test(line)) {
      buildingCircuitId = lastCircuitId;
      if (lastCircuitId && circuits[lastCircuitId]) {
        circuits[lastCircuitId].push({ event: "SEND_CREATE", timestamp: ts, host: hostName });
      }
      continue;
    }

    if (/circuit_finish_handshake\(\)/.test(line)) {
      const cid = buildingCircuitId || lastCircuitId;
      if (cid && circuits[cid]) {
        const hop = (circuitHopCount[cid] || 0) + 1;
        circuitHopCount[cid] = hop;
        if (hop === 1) {
          circuits[cid].push({ event: "RECV_CREATED", timestamp: ts, host: hostName });
        } else {
          circuits[cid].push({ event: "SEND_EXTEND", timestamp: ts, host: hostName });
          circuits[cid].push({ event: "RECV_EXTENDED", timestamp: ts, host: hostName });
        }
      }
      continue;
    }

    if (/circuit_build_no_more_hops\(\).*circuit built/i.test(line)) {
      continue;
    }

    if (/connection_ap_handshake_send_begin\(\)/.test(line)) {
      if (lastCircuitId && circuits[lastCircuitId]) {
        circuits[lastCircuitId].push({ event: "SEND_RELAY_DATA", timestamp: ts, host: hostName });
      }
      continue;
    }

    if (/circuit_mark_for_close/i.test(line)) {
      const closeMatch = line.match(/\(id:\s*(\d+)\)/);
      const cid = closeMatch ? closeMatch[1] : lastCircuitId;
      if (cid && circuits[cid]) {
        circuits[cid].push({ event: "SEND_DESTROY", timestamp: ts, host: hostName });
      }
      continue;
    }

    if (/circuit_free_\(\)/i.test(line)) {
      const freeMatch = line.match(/\(id:\s*(\d+)\)/);
      const cid = freeMatch ? freeMatch[1] : lastCircuitId;
      if (cid && circuits[cid]) {
        circuits[cid].push({ event: "CIRCUIT_CLOSED", timestamp: ts, host: hostName });
      }
      continue;
    }

    if (/circuit_expire_building/i.test(line)) {
      if (lastCircuitId && circuits[lastCircuitId]) {
        circuits[lastCircuitId].push({ event: "TIMEOUT", timestamp: ts, host: hostName });
      }
      continue;
    }
  }

  return circuits;
}

// --- per-circuit FSM runner (verbatim from shadow_harness.mjs) --------------
function runFsmOnCircuit(events) {
  let state = "IDLE";
  const transitions = [];
  const violations = [];
  let validCount = 0;
  let invalidCount = 0;

  for (const ev of events) {
    const key = k(state, ev.event);
    const nextState = VALID[key];

    if (nextState !== undefined) {
      transitions.push({ from: state, event: ev.event, to: nextState, isValid: true, timestamp: ev.timestamp });
      state = nextState;
      validCount++;
    } else {
      const classification = classifyInvalid(state, ev.event);
      violations.push({ from: state, event: ev.event, classification, timestamp: ev.timestamp, injected: ev.injected || false, attackType: ev.attackType || null });
      transitions.push({ from: state, event: ev.event, to: state, isValid: false, classification, timestamp: ev.timestamp });
      invalidCount++;
    }

    if (state === "CLOSED" || state === "ERROR") {
      state = "IDLE";
    }
  }

  return { transitions, violations, validCount, invalidCount, finalState: state };
}

function runFsmOnAllCircuits(circuitMap) {
  let totalValid = 0;
  let totalInvalid = 0;
  const allViolations = [];
  const perCircuit = {};

  for (const [cid, events] of Object.entries(circuitMap)) {
    const result = runFsmOnCircuit(events);
    totalValid += result.validCount;
    totalInvalid += result.invalidCount;
    allViolations.push(...result.violations.map((v) => ({ circuitId: cid, ...v })));
    perCircuit[cid] = { eventCount: events.length, validCount: result.validCount, invalidCount: result.invalidCount, finalState: result.finalState };
  }

  return { violations: allViolations, validCount: totalValid, invalidCount: totalInvalid, circuitCount: Object.keys(circuitMap).length, perCircuit };
}

// --- main ------------------------------------------------------------------
const logPath = process.argv[2] || "/tmp/cf_test/shadow.data/hosts/torclient/tor.1000.stdout";
const logContent = readFileSync(logPath, "utf8");
const circuits = parseTorHostLog(logContent, "torclient");
const fsm = runFsmOnAllCircuits(circuits);

const byType = {};
for (const v of fsm.violations) {
  byType[v.classification.type] = (byType[v.classification.type] || 0) + 1;
}

const createFlood = fsm.violations.filter((v) => v.classification.type === "CREATE_FLOOD");

console.log("=== CREATE_FLOOD real-attack detection (no synthetic injection) ===");
console.log("log:", logPath);
console.log("circuits:", fsm.circuitCount, "| valid:", fsm.validCount, "| invalid:", fsm.invalidCount);
console.log("violation types:", JSON.stringify(byType));
console.log("CREATE_FLOOD count:", createFlood.length);
console.log("CREATE_FLOOD samples:");
for (const v of createFlood.slice(0, 5)) {
  console.log(`  circuit ${v.circuitId}: ${v.from} x ${v.event} -> ${v.classification.type} (${v.classification.severity}) @ ${v.timestamp}`);
}

const out = {
  logPath,
  circuitCount: fsm.circuitCount,
  validCount: fsm.validCount,
  invalidCount: fsm.invalidCount,
  violationTypes: byType,
  createFloodCount: createFlood.length,
  createFloodSamples: createFlood.slice(0, 10),
};
const outPath = "/tmp/cf_test/cf_detect_result.json";
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log("written:", outPath);
