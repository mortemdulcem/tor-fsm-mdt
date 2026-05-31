// CREATE_FLOOD real-attack detector — reuses the harness's real parser+detector.
//
// Imports parseTorHostLog + runFsmOnAllCircuits from experiments/shadow_harness.mjs
// (which itself imports the FSM spec from server/fsm.ts) and runs them on an
// EXISTING Shadow run's Tor client log produced by the patched Tor binary with
// TOR_FSM_ATTACK_CREATE_FLOOD=1 — no Shadow rebuild, no re-implemented logic.
//
// Requires shadow_harness.mjs to export parseTorHostLog + runFsmOnAllCircuits and
// to guard its main() behind a direct-run check (so importing it is side-effect-free).
//
// Usage:  tsx experiments/cf_detect.mjs [path-to-tor.NNNN.stdout]

import { readFileSync } from "node:fs";
import { parseTorHostLog, runFsmOnAllCircuits } from "./shadow_harness.mjs";

const p = process.argv[2] || "/tmp/cf_test/shadow.data/hosts/torclient/tor.1000.stdout";
const circuits = parseTorHostLog(readFileSync(p, "utf8"), "torclient");
const fsm = runFsmOnAllCircuits(circuits);

const byType = {};
for (const v of fsm.violations) byType[v.classification.type] = (byType[v.classification.type] || 0) + 1;
const cf = fsm.violations.filter((v) => v.classification.type === "CREATE_FLOOD");

console.log("circuits:", fsm.circuitCount, "valid:", fsm.validCount, "invalid:", fsm.invalidCount);
console.log("types:", JSON.stringify(byType));
console.log("CREATE_FLOOD count:", cf.length);
for (const v of cf.slice(0, 5)) console.log("  " + v.from + " x " + v.event + " -> " + v.classification.type + " (" + v.classification.severity + ")");
