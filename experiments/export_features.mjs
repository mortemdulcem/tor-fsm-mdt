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
let shapeLogged = false;

// parseTorHostLog cikti sekli kesin bilinmiyor (dizi / Map / id->devre nesnesi /
// {circuits:[...]}); uydurma yerine hepsini normalize ederek devre listesine cevir.
function toCircuitList(circuits) {
  if (circuits == null) return [];
  if (Array.isArray(circuits)) return circuits;
  if (circuits instanceof Map) return Array.from(circuits.values());
  if (Array.isArray(circuits.circuits)) return circuits.circuits;
  if (typeof circuits === "object") return Object.values(circuits);
  return [];
}

function add(scenario, attack, seed, file) {
  if (!existsSync(file)) {
    console.log(`  atla (log yok): ${file}`);
    return;
  }
  const raw = parseTorHostLog(readFileSync(file, "utf8"), "torclient");
  if (!shapeLogged) {
    const ctor = raw && raw.constructor ? raw.constructor.name : typeof raw;
    console.log(`  [parse sekli] ${ctor}; ust anahtarlar:`,
      raw && typeof raw === "object" && !Array.isArray(raw) ? Object.keys(raw).slice(0, 10) : "(dizi/diger)");
    shapeLogged = true;
  }
  // raw = { gid: <olay dizisi> }; gid'i KORU (devre kimligi).
  const entries =
    raw instanceof Map
      ? Array.from(raw.entries())
      : Array.isArray(raw)
        ? raw.map((c, i) => [String(i), c])
        : Object.entries(raw);
  let n = 0;
  for (const [gid, circ] of entries) {
    const events = toCircuitList(circ); // devre de dizi/nesne olabilir
    dataset.push({ scenario, attack, seed: Number(seed), gid, events });
    n++;
  }
  console.log(`  ${scenario}/${attack} seed=${seed}: ${n} devre`);
}

for (const seed of SEEDS) {
  add("benign", "benign", seed, logPath("_benign", seed));
  for (const a of ATTACKS) add("attack", a, seed, logPath(a, seed));
}

// --- olay-tipi alfabesi (tum devrelerin birlesimi) ---
const evType = (e) => (e && (e.event ?? e.type ?? e.name)) || "UNK";
const alphabet = [...new Set(dataset.flatMap((d) => d.events.map(evType)))].sort();

function tsMs(t) {
  // "Jan 01 00:15:01.401" -> gun ici ms (yalnizca sure farki icin)
  const m = /(\d\d):(\d\d):(\d\d)\.(\d+)/.exec(String(t || ""));
  if (!m) return null;
  return ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000 + +m[4];
}

// --- CSV: devre basina non-circular oznitelikler (olay sayilari + uzunluk + sure) ---
const cols = ["scenario", "attack", "seed", "gid", "n_events", "dur_ms", ...alphabet];
const rows = [cols.join(",")];
for (const d of dataset) {
  const counts = Object.fromEntries(alphabet.map((a) => [a, 0]));
  let tmin = Infinity, tmax = -Infinity;
  for (const e of d.events) {
    counts[evType(e)]++;
    const ms = tsMs(e.timestamp);
    if (ms != null) { if (ms < tmin) tmin = ms; if (ms > tmax) tmax = ms; }
  }
  const dur = tmax >= tmin ? tmax - tmin : 0;
  rows.push([
    d.scenario, d.attack, d.seed, d.gid, d.events.length, dur,
    ...alphabet.map((a) => counts[a]),
  ].join(","));
}
writeFileSync("experiments/ml_features.csv", rows.join("\n") + "\n");

// ham veri de saklansin (yuksek-sadakat; istege bagli)
writeFileSync("experiments/ml_dataset.json", JSON.stringify(dataset));

console.log("\n--- olay-tipi alfabesi ---", alphabet.join(" "));
console.log(`yazildi: experiments/ml_features.csv (${dataset.length} devre, ${cols.length} sutun)`);
console.log(`yazildi: experiments/ml_dataset.json (${dataset.length} devre, ${SEEDS.length} seed)`);
console.log("\n--- ml_features.csv (ilk 6 satir) ---");
console.log(rows.slice(0, 6).join("\n"));
