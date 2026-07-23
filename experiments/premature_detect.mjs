// PREMATURE_DATA real-attack detector.
//
// Reuses the harness's real parser + FSM runner (parseTorHostLog +
// runFsmOnAllCircuits from shadow_harness.mjs, which imports the spec FSM from
// server/fsm.ts) on an EXISTING Shadow run's Tor client log produced by the
// patched Tor binary with TOR_FSM_ATTACK_PREMATURE_DATA=1.
//
// The genuine attack signal is INJECTED PREMATURE_DATA: violations whose
// SEND_RELAY_DATA event came from the in-Tor marker (TOR_FSM_PREMATURE_SEND
// gid=N), attributed to the correct circuit by global_identifier, while that
// circuit's FSM state is independently reconstructed as CIRCUIT_BUILDING from
// Tor's own circuit_finish_handshake logs. This is distinct from the
// begin-attribution PREMATURE_DATA noise that the harness produces on
// lastCircuitId in BOTH attack and benign runs.
//
// Usage:  tsx experiments/premature_detect.mjs <path-to-tor.NNNN.stdout>

import { readFileSync } from "node:fs";
import { parseTorHostLog, runFsmOnAllCircuits } from "./shadow_harness.mjs";

const p = process.argv[2];
if (!p) {
  console.error("kullanim: tsx experiments/premature_detect.mjs <tor.NNNN.stdout>");
  process.exit(2);
}

const circuits = parseTorHostLog(readFileSync(p, "utf8"), "torclient");
const fsm = runFsmOnAllCircuits(circuits);

const byType = {};
for (const v of fsm.violations) {
  byType[v.classification.type] = (byType[v.classification.type] || 0) + 1;
}

const allPrem = fsm.violations.filter((v) => v.classification.type === "PREMATURE_DATA");
const injPrem = allPrem.filter((v) => v.injected === true);
const noisePrem = allPrem.filter((v) => v.injected !== true);

console.log("circuits:", fsm.circuitCount, "valid:", fsm.validCount, "invalid:", fsm.invalidCount);
console.log("types:", JSON.stringify(byType));
console.log("PREMATURE_DATA toplam:", allPrem.length,
            "| INJECTED (gercek, gid-atifli):", injPrem.length,
            "| begin-noise (lastCircuitId):", noisePrem.length);
for (const v of injPrem.slice(0, 5)) {
  console.log("  injected:", v.from, "x", v.event, "->", v.classification.type,
              "(" + v.classification.severity + ")");
}
