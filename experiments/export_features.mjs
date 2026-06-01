// Gercek ML baseline icin VERI EXPORT'u — Shadow GEREKTIRMEZ (kayitli loglari okur).
//
// VM'de repo kokunden:  node experiments/export_features.mjs
// Cikti: experiments/ml_dataset.json
//
// Her kayitli istemci logunu parseTorHostLog ile cozumler ve HER DEVRE icin HAM
// parse ciktisini (transition dizisi dahil) + etiket (scenario/attack/seed) yazar.
// Ozellik cikarimi ve sklearn modeli AYRI yapilir (experiments/ml_baseline.py,
// Replit'te); boylece ozellikler non-circular kalir (FSM ihlal etiketleri
// kullanilmaz, yalnizca ham gozlemlenen transition davranisi).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseTorHostLog } from "./shadow_harness.mjs";

const SEEDS = (process.env.SEEDS || "42 137 2718").trim().split(/\s+/);
const ATTACKS = ["create_flood", "circuit_hijack", "premature_data"];
const RUNS = "experiments/runs";

const logPath = (sub, seed) =>
  `${RUNS}/${sub}/seed${seed}/hosts/torclient/tor.1000.stdout`;

const dataset = [];

function add(scenario, attack, seed, file) {
  if (!existsSync(file)) {
    console.log(`  atla (log yok): ${file}`);
    return;
  }
  const circuits = parseTorHostLog(readFileSync(file, "utf8"), "torclient");
  for (const c of circuits) {
    dataset.push({ scenario, attack, seed: Number(seed), circuit: c });
  }
  console.log(`  ${scenario}/${attack} seed=${seed}: ${circuits.length} devre`);
}

for (const seed of SEEDS) {
  add("benign", "benign", seed, logPath("_benign", seed));
  for (const a of ATTACKS) add("attack", a, seed, logPath(a, seed));
}

// --- sekil tanitimi (uydurma alan adi kullanmamak icin gercek anahtarlari bas) ---
if (dataset.length) {
  const c0 = dataset[0].circuit;
  console.log("\n--- ornek devre anahtarlari ---", Object.keys(c0));
  const tkey = ["transitions", "events", "history", "trace", "seq"].find(
    (k) => Array.isArray(c0[k])
  );
  if (tkey) {
    const t0 = c0[tkey][0];
    console.log(`--- '${tkey}' uzunlugu ---`, c0[tkey].length);
    console.log(`--- '${tkey}'[0] anahtarlari ---`, t0 ? Object.keys(t0) : "(bos)");
    console.log(`--- '${tkey}'[0] ornek ---`, JSON.stringify(t0));
  } else {
    console.log("--- transition dizisi anahtari bulunamadi; tum devre ornegi: ---");
    console.log(JSON.stringify(c0).slice(0, 600));
  }
}

writeFileSync("experiments/ml_dataset.json", JSON.stringify(dataset));
console.log(
  `\nyazildi: experiments/ml_dataset.json (${dataset.length} devre, ${SEEDS.length} seed)`
);
