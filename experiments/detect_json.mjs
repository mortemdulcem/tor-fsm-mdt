// Birlesik gercek-saldiri dedektoru — TEK satir JSON ciktisi (metrics.mjs icin).
//
// Mevcut cf_detect.mjs / premature_detect.mjs ile AYNI API'yi kullanir:
// parseTorHostLog + runFsmOnAllCircuits (shadow_harness.mjs -> server/fsm.ts).
// Tek bir Shadow kosusunun istemci logunu okur, hedef saldiri tipini sayar ve
// confusion-matrix icin gereken alanlari iceren tek bir JSON satiri basar.
// Native (non-circular) sayim grep ile pipeline tarafindan hesaplanip --native
// ile gecirilir; burada degistirilmeden ciktiya yazilir.
//
// Kullanim:
//   tsx experiments/detect_json.mjs --attack premature_data --scenario attack \
//       --seed 42 --log <tor.1000.stdout> --native 12

import { readFileSync } from "node:fs";
import { parseTorHostLog, runFsmOnAllCircuits } from "./shadow_harness.mjs";

function arg(name, def) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 ? process.argv[i + 1] : def;
}

const attack = arg("attack");
const scenario = arg("scenario");
const seed = Number(arg("seed", "0"));
const log = arg("log");
const native = Number(arg("native", "0"));
const markers = Number(arg("markers", "0"));

const TYPE = {
  create_flood: "CREATE_FLOOD",
  circuit_hijack: "CIRCUIT_HIJACK",
  premature_data: "PREMATURE_DATA",
}[attack];

if (!attack || !scenario || !log || !TYPE) {
  console.error(
    "kullanim: --attack <create_flood|circuit_hijack|premature_data> " +
      "--scenario <attack|benign> --seed N --log <path> [--native N]"
  );
  process.exit(2);
}

const circuits = parseTorHostLog(readFileSync(log, "utf8"), "torclient");
const fsm = runFsmOnAllCircuits(circuits);

const byType = {};
for (const v of fsm.violations) {
  byType[v.classification.type] = (byType[v.classification.type] || 0) + 1;
}

const target = fsm.violations.filter((v) => v.classification.type === TYPE);

// Per-circuit confusion matrix istiyoruz: ayni devredeki birden fazla ihlal
// SAYIM sismesine yol acmasin diye benzersiz devre sayisini (mumkunse) cikar.
// Harness ihlal nesnesinde devre kimligi alani adi degisebilir -> birkac olasi
// adi dene; hicbiri yoksa null birak (metrics.mjs flagged'a duser ve clamp eder).
const cidOf = (v) =>
  v.circuitId ?? v.cid ?? v.gid ?? v.circId ?? v.circ ?? v.id ?? null;
const flaggedCircuitsSet = new Set(target.map(cidOf).filter((x) => x != null));
const flaggedCircuits = flaggedCircuitsSet.size > 0 ? flaggedCircuitsSet.size : null;

const out = {
  attack,
  seed,
  scenario,
  circuits: fsm.circuitCount,
  flagged: target.length,        // ihlal olayi sayisi
  flaggedCircuits,               // benzersiz devre sayisi (yoksa null)
  native,                        // non-circular native sinyal (grep, pipeline)
  markers,                       // saldirinin kendi marker sayisi (premature icin)
  types: byType,
};

// injected ground-truth (TUM saldirilar icin): violation nesnesinde injected:true
// = saldirinin gercekten enjekte ettigi olay; injected:false = parser/begin-noise.
// Bu, event-level confusion (TP=injected, FP=noise) icin gerekli.
out.injected = target.filter((v) => v.injected === true).length;
out.noise = target.length - out.injected;
if (attack === "premature_data") {
  out.prem_injected = out.injected;
  out.prem_noise = out.noise;
}

console.log(JSON.stringify(out));
