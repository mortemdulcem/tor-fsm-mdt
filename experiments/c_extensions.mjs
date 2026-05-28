// C-grubu eklemeleri (dürüstçe yapılabilen 2 madde):
//   (12) Bootstrap güven aralıkları — mevcut N=30 paired trials üzerinden, 10000 resample
//   (13) Post-hoc güç analizi (paired t) + β=0.80 için gerekli N
//   (14) Stream alt-FSM modeli (spec-derived) + B1/B2/B3 paired karşılaştırma
//
// (1) Ground truth = real Tor C binary, (3) Scopus/WoS/IEEE Xplore canlı erişim,
// (4) C/Rust port latency — bu ortamda ortam kısıtı yüzünden YAPILAMAZ; uydurmak yerine
// sınırlılık olarak raporlanır (bkz. tez 6.2 ve paper §V).

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  STREAM_STATES,
  STREAM_EVENTS,
  STREAM_VALID,
  streamValidKeys,
  streamValidCount,
  streamInvalidCount,
  sk,
  classifyInvalidStream,
} from "../server/fsm_stream.ts";
import { mulberry32 } from "./baselines.mjs";
import { mean, sd, normalCDF, studentTCDF } from "./stats.mjs";

// Paired t-test (matched pairs design).
function pairedT(xs, ys) {
  const n = xs.length;
  const diffs = xs.map((x, i) => x - ys[i]);
  const md = mean(diffs);
  const sdd = sd(diffs);
  if (sdd === 0)
    return {
      t: md === 0 ? 0 : Infinity,
      df: n - 1,
      p: md === 0 ? 1 : 0,
      d_z: md === 0 ? 0 : Infinity,
    };
  const t = md / (sdd / Math.sqrt(n));
  const df = n - 1;
  const p = 2 * (1 - studentTCDF(Math.abs(t), df));
  return { t, df, p, d_z: md / sdd };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const trials = JSON.parse(
  await fs.readFile(path.resolve(__dirname, "trials.json"), "utf8"),
);

// ============================================================
// (12) Bootstrap güven aralıkları (paired, percentile method)
// ============================================================
function bootstrapPairedCI(xs, ys, B = 10000, alpha = 0.05) {
  if (xs.length !== ys.length)
    throw new Error("paired bootstrap requires equal-length arrays");
  const n = xs.length;
  const observed = mean(xs) - mean(ys);
  const rand = mulberry32(20260514);
  const diffs = new Array(B);
  for (let b = 0; b < B; b++) {
    let sumX = 0,
      sumY = 0;
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(rand() * n);
      sumX += xs[idx];
      sumY += ys[idx];
    }
    diffs[b] = (sumX - sumY) / n;
  }
  diffs.sort((a, b) => a - b);
  const lo = diffs[Math.floor((alpha / 2) * B)];
  const hi = diffs[Math.floor((1 - alpha / 2) * B) - 1];
  return { observed, ci_lo: lo, ci_hi: hi, B, alpha };
}

// ============================================================
// (13) Post-hoc güç analizi (paired t) — normal approx of noncentral t
// Standart: d_z = mean(diff) / sd(diff);  ncp = d_z * sqrt(n)
// power ≈ Φ(ncp - z_{1-α/2}) + Φ(-ncp - z_{1-α/2})  (büyük df için)
// β=0.80 için gerekli N: ((z_{1-α/2} + z_{1-β}) / d_z)^2
// ============================================================
const Z_ALPHA_2 = 1.959963984540054; // α=0.05 iki taraflı için z-kritik
const Z_BETA_80 = 0.8416212335729143; // 1-β=0.80 için z (one-sided)

function powerPaired(xs, ys, alpha = 0.05) {
  if (xs.length !== ys.length)
    throw new Error("paired power requires equal-length arrays");
  const n = xs.length;
  const diffs = xs.map((x, i) => x - ys[i]);
  const md = mean(diffs);
  const sdd = sd(diffs);
  if (sdd === 0) {
    return {
      n,
      mean_diff: md,
      sd_diff: 0,
      d_z: md === 0 ? 0 : Infinity,
      power: md === 0 ? 0.05 : 1,
      n_required_80: md === 0 ? Infinity : 4,
    };
  }
  const dz = md / sdd;
  const ncp = dz * Math.sqrt(n);
  // power = P(|T| > z_crit | ncp) ≈ Φ(|ncp| - z_crit) + Φ(-|ncp| - z_crit)
  const power =
    normalCDF(Math.abs(ncp) - Z_ALPHA_2) +
    normalCDF(-Math.abs(ncp) - Z_ALPHA_2);
  const nReq =
    dz === 0
      ? Infinity
      : Math.ceil(((Z_ALPHA_2 + Z_BETA_80) / Math.abs(dz)) ** 2);
  return {
    n,
    mean_diff: md,
    sd_diff: sdd,
    d_z: dz,
    power,
    n_required_80: nReq,
  };
}

const pairs = [
  ["B3_MDT", "B1_Random"],
  ["B3_MDT", "B2_GreedySC"],
  ["B2_GreedySC", "B1_Random"],
];
const metrics = ["transitionCoverage", "itdr", "stateCoverage"];
const metricLabel = {
  transitionCoverage: "tc",
  itdr: "itdr",
  stateCoverage: "sc",
};

const bootstrap = [];
const power = [];
for (const [a, b] of pairs) {
  for (const m of metrics) {
    const xs = trials.results[a].map((t) => t[m]);
    const ys = trials.results[b].map((t) => t[m]);
    bootstrap.push({
      a,
      b,
      metric: metricLabel[m],
      ...bootstrapPairedCI(xs, ys),
    });
    power.push({ a, b, metric: metricLabel[m], ...powerPaired(xs, ys) });
  }
}

// ============================================================
// (14) Stream alt-FSM B1/B2/B3 paired karşılaştırma
// Aynı runner deseni circuit FSM ile; sadece state/event/δ farklı.
// ============================================================
function emptyStreamMetrics() {
  return {
    visited: new Set(["STREAM_NEW"]),
    coveredValid: new Set(),
    detectedInvalid: new Set(),
    events: 0,
  };
}
function streamStep(state, event, m) {
  const key = sk(state, event);
  const next = STREAM_VALID[key];
  m.events++;
  if (next !== undefined) {
    m.coveredValid.add(key);
    m.visited.add(next);
    return next;
  }
  m.detectedInvalid.add(key);
  return state;
}
function finalizeStream(m, t0) {
  return {
    stateCoverage: m.visited.size / STREAM_STATES.length,
    transitionCoverage: m.coveredValid.size / streamValidCount,
    itdr: m.detectedInvalid.size / streamInvalidCount,
    durationMs: Date.now() - t0,
  };
}

const BUDGET = 500;

function runStreamB1(seed) {
  const rand = mulberry32(seed);
  const t0 = Date.now();
  const m = emptyStreamMetrics();
  let s = "STREAM_NEW";
  while (m.events < BUDGET) {
    const e = STREAM_EVENTS[Math.floor(rand() * STREAM_EVENTS.length)];
    s = streamStep(s, e, m);
    if (s === "CLOSED") s = "STREAM_NEW";
  }
  return finalizeStream(m, t0);
}
function runStreamB2(seed) {
  const rand = mulberry32(seed);
  const t0 = Date.now();
  const m = emptyStreamMetrics();
  let s = "STREAM_NEW";
  while (m.events < BUDGET) {
    const validHere = STREAM_EVENTS.filter(
      (e) => STREAM_VALID[sk(s, e)] !== undefined,
    );
    const unvisited = validHere.filter(
      (e) => !m.visited.has(STREAM_VALID[sk(s, e)]),
    );
    const invalidHere = STREAM_EVENTS.filter(
      (e) => STREAM_VALID[sk(s, e)] === undefined,
    );
    let e;
    if (unvisited.length > 0)
      e = unvisited[Math.floor(rand() * unvisited.length)];
    else if (validHere.length > 0 && rand() > 0.3)
      e = validHere[Math.floor(rand() * validHere.length)];
    else if (invalidHere.length > 0)
      e = invalidHere[Math.floor(rand() * invalidHere.length)];
    else e = STREAM_EVENTS[Math.floor(rand() * STREAM_EVENTS.length)];
    s = streamStep(s, e, m);
    if (s === "CLOSED") s = "STREAM_NEW";
  }
  return finalizeStream(m, t0);
}
function streamPathTo(target) {
  if (target === "STREAM_NEW") return [];
  const queue = [{ state: "STREAM_NEW", path: [] }];
  const seen = new Set(["STREAM_NEW"]);
  while (queue.length) {
    const { state, path } = queue.shift();
    for (const e of STREAM_EVENTS) {
      const next = STREAM_VALID[sk(state, e)];
      if (!next || seen.has(next)) continue;
      const np = [...path, e];
      if (next === target) return np;
      seen.add(next);
      queue.push({ state: next, path: np });
    }
  }
  return null;
}
function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function runStreamB3(seed) {
  const rand = mulberry32(seed);
  const t0 = Date.now();
  const m = emptyStreamMetrics();
  const exec = (events) => {
    let s = "STREAM_NEW";
    for (const e of events) {
      if (m.events >= BUDGET) return;
      s = streamStep(s, e, m);
    }
  };
  for (const vk of shuffle(streamValidKeys, rand)) {
    if (m.events >= BUDGET) break;
    if (m.coveredValid.has(vk)) continue;
    const [src, evt] = vk.split("|");
    const path = streamPathTo(src);
    if (path === null) continue;
    exec([...path, evt]);
  }
  const invalidPairs = [];
  for (const s of STREAM_STATES)
    for (const e of STREAM_EVENTS) {
      if (STREAM_VALID[sk(s, e)] === undefined) invalidPairs.push([s, e]);
    }
  for (const [src, evt] of shuffle(invalidPairs, rand)) {
    if (m.events >= BUDGET) break;
    if (m.detectedInvalid.has(sk(src, evt))) continue;
    const path = streamPathTo(src);
    if (path === null && src !== "STREAM_NEW") continue;
    exec([...(path ?? []), evt]);
  }
  return finalizeStream(m, t0);
}

const STREAM_ALGOS = {
  B1_Random: runStreamB1,
  B2_GreedySC: runStreamB2,
  B3_MDT: runStreamB3,
};
const N_TRIALS = 30;
const streamResults = { B1_Random: [], B2_GreedySC: [], B3_MDT: [] };
for (let i = 0; i < N_TRIALS; i++) {
  const seed = 1000 + i; // aynı seed dizilimi — circuit deneyi ile paired-eşdeğer tasarım
  for (const [name, fn] of Object.entries(STREAM_ALGOS)) {
    streamResults[name].push(fn(seed));
  }
}
const streamStats = {};
for (const [n, arr] of Object.entries(streamResults)) {
  const sc = arr.map((r) => r.stateCoverage);
  const tc = arr.map((r) => r.transitionCoverage);
  const it = arr.map((r) => r.itdr);
  streamStats[n] = {
    sc: { mean: mean(sc), sd: sd(sc) },
    tc: { mean: mean(tc), sd: sd(tc) },
    itdr: { mean: mean(it), sd: sd(it) },
  };
}
const streamComparisons = [];
for (const [a, b] of pairs) {
  for (const m of metrics) {
    const xs = streamResults[a].map((r) => r[m]);
    const ys = streamResults[b].map((r) => r[m]);
    const pt = pairedT(xs, ys);
    streamComparisons.push({
      a,
      b,
      metric: metricLabel[m],
      t: pt.t,
      df: pt.df,
      p: pt.p,
      d_z: pt.d_z,
    });
  }
}

// Stream attack inventory
function streamAttackInventory() {
  const inv = {};
  for (const s of STREAM_STATES)
    for (const e of STREAM_EVENTS) {
      if (STREAM_VALID[sk(s, e)] !== undefined) continue;
      const c = classifyInvalidStream(s, e);
      inv[c.type] = inv[c.type] || {
        count: 0,
        sev: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
      };
      inv[c.type].count++;
      inv[c.type].sev[c.severity]++;
    }
  return inv;
}

// ============================================================
// Persist
// ============================================================
const out = {
  bootstrap,
  power,
  stream: {
    states: STREAM_STATES,
    events: STREAM_EVENTS,
    domain: STREAM_STATES.length * STREAM_EVENTS.length,
    valid: streamValidCount,
    invalid: streamInvalidCount,
    stats: streamStats,
    comparisons: streamComparisons,
    attackInventory: streamAttackInventory(),
    N_trials: N_TRIALS,
    budget: BUDGET,
  },
};
await fs.writeFile(
  path.resolve(__dirname, "c_extensions.json"),
  JSON.stringify(out, null, 2),
  "utf8",
);

console.log("[12] Bootstrap CI (10k resamples) →", bootstrap.length, "satır");
console.log("[13] Post-hoc power            →", power.length, "satır");
console.log("[14] Stream FSM trials         → 3 algo × 30 koşu");
console.log("Yazıldı: experiments/c_extensions.json");
