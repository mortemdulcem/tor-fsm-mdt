// B-grubu eklemeleri:
//   (5) PRISMA için sayılar — açık-web SLR sürecinin iz kayıtları (gerçek)
//   (6) Wilcoxon signed-rank — eşleştirilmiş seed tasarımına uygun
//   (7) Detection latency — process.hrtime.bigint() + batch amortizasyon ile ölçüm
//   (8) Rule-based detector (7 imza kuralı) — completeness karşılaştırması
//  (11) Bütçe-kapsama eğrisi — 7 bütçe noktası × 3 algoritma × 30 koşu

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hrtime } from "node:process";
import { STATES, EVENTS, VALID, totalInvalid, k, classifyInvalid } from "../server/fsm.ts";
import { mulberry32 } from "./baselines.mjs";
import { mean, sd, normalCDF } from "./stats.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const trials = JSON.parse(await fs.readFile(path.resolve(__dirname, "trials.json"), "utf8"));

// ============================================================
// (8) Rule-based detector — 7 elle yazılmış imza kuralı
// ============================================================
// Her kural tek satırlık bir koşul; 7 saldırı vektörünü hedef alır.
// Bu, MDT'nin "Invalid = (Q×Σ) ∖ dom(δ)" matematiksel tanımının vereceği
// %100 completeness ile karşılaştırılmak üzere kasıtlı olarak basit tutulmuştur.
const RULES = [
  { name: "R1_BYPASS",  cond: (s, e) => (e === "SEND_RELAY_DATA" || e === "RECV_RELAY_DATA") && (s === "IDLE" || s === "CONNECTING") },
  { name: "R2_REPLAY",  cond: (s, e) => e === "SEND_RELAY_DATA" && s === "CLOSED" },
  { name: "R3_GHOST",   cond: (s, e) => e === "RECV_CREATED" && s === "IDLE" },
  { name: "R4_HSKIP",   cond: (s, e) => e === "SEND_CREATE" && (s === "IDLE" || s === "CONNECTING") },
  { name: "R5_PDATA",   cond: (s, e) => (e === "SEND_RELAY_DATA" || e === "RECV_RELAY_DATA") && (s === "CREATE_SENT" || s === "CIRCUIT_BUILDING") },
  { name: "R6_HIJACK",  cond: (s, e) => (e === "SEND_CREATE" || e === "RECV_CREATED" || e === "SEND_EXTEND" || e === "RECV_EXTENDED") && (s === "CIRCUIT_READY" || s === "TRANSMITTING") },
  { name: "R7_CFLOOD",  cond: (s, e) => (e === "SEND_CREATE" || e === "RECV_CREATED") && s === "CREATE_SENT" },
];

function ruleBasedAudit() {
  const allInvalid = [];
  for (const s of STATES) for (const e of EVENTS) {
    if (VALID[k(s, e)] === undefined) allInvalid.push({ s, e, sev: classifyInvalid(s, e).severity, type: classifyInvalid(s, e).type });
  }
  let detected = 0;
  const perRule = Object.fromEntries(RULES.map((r) => [r.name, 0]));
  const missedByType = {};
  const missedBySeverity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const p of allInvalid) {
    let hit = false;
    for (const r of RULES) {
      if (r.cond(p.s, p.e)) { perRule[r.name]++; hit = true; }
    }
    if (hit) detected++;
    else { missedByType[p.type] = (missedByType[p.type] || 0) + 1; missedBySeverity[p.sev]++; }
  }
  return {
    totalInvalid: allInvalid.length,
    detectedByRules: detected,
    completeness: detected / allInvalid.length,
    missed: allInvalid.length - detected,
    perRule, missedByType, missedBySeverity,
  };
}

const ruleBased = ruleBasedAudit();

// ============================================================
// (7) Detection latency — batch-amortize edilmiş hrtime.bigint() ölçümü
// ============================================================
// Sub-mikro saniye çağrılar tek-tick saatine düşmesin diye:
//   1) Her ölçüm BATCH_SIZE step çağrısını sarar; toplam süre / BATCH_SIZE → çağrı başına latency.
//   2) Boş döngü overhead'i ayrıca ölçülüp çıkartılır.
//   3) Tüm timing hrtime.bigint() (nanosaniye çözünürlük) ile yapılır.
function instrumentedExec(name, seed, budget) {
  const rand = mulberry32(seed);
  const visited = new Set(["IDLE"]);
  const coveredValid = new Set();
  const detectedInvalid = new Set();
  let s = "IDLE", events = 0;

  const stepImpl = (state, e) => {
    events++;
    const key = k(state, e);
    const next = VALID[key];
    if (next !== undefined) {
      coveredValid.add(key); visited.add(next);
      return next;
    }
    classifyInvalid(state, e);
    detectedInvalid.add(key);
    return state;
  };

  if (name === "B1_Random") {
    while (events < budget) {
      const e = EVENTS[Math.floor(rand() * EVENTS.length)];
      s = stepImpl(s, e); if (s === "CLOSED") s = "IDLE";
    }
  } else if (name === "B2_GreedySC") {
    while (events < budget) {
      const validHere = EVENTS.filter((e) => VALID[k(s, e)] !== undefined);
      const unvisitedValid = validHere.filter((e) => !visited.has(VALID[k(s, e)]));
      const invalidHere = EVENTS.filter((e) => VALID[k(s, e)] === undefined);
      let e;
      if (unvisitedValid.length > 0) e = unvisitedValid[Math.floor(rand() * unvisitedValid.length)];
      else if (validHere.length > 0 && rand() > 0.3) e = validHere[Math.floor(rand() * validHere.length)];
      else if (invalidHere.length > 0) e = invalidHere[Math.floor(rand() * invalidHere.length)];
      else e = EVENTS[Math.floor(rand() * EVENTS.length)];
      s = stepImpl(s, e); if (s === "CLOSED") s = "IDLE";
    }
  } else { // B3_MDT
    const findPath = (target) => {
      if (target === "IDLE") return [];
      const q = [{ state: "IDLE", path: [] }]; const seen = new Set(["IDLE"]);
      while (q.length) {
        const { state, path } = q.shift();
        for (const e of EVENTS) {
          const nx = VALID[k(state, e)]; if (!nx || seen.has(nx)) continue;
          const np = [...path, e]; if (nx === target) return np;
          seen.add(nx); q.push({ state: nx, path: np });
        }
      }
      return null;
    };
    const shuf = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const execSeq = (seq) => { let st = "IDLE"; for (const e of seq) { if (events >= budget) return; st = stepImpl(st, e); } };
    const validKeysList = Object.keys(VALID);
    for (const vk of shuf(validKeysList)) {
      if (events >= budget) break;
      if (coveredValid.has(vk)) continue;
      const [src, evt] = vk.split("|");
      const p = findPath(src); if (p === null) continue;
      execSeq([...p, evt]);
    }
    const invalidPairs = [];
    for (const ss of STATES) for (const ee of EVENTS) if (VALID[k(ss, ee)] === undefined) invalidPairs.push([ss, ee]);
    for (const [src, evt] of shuf(invalidPairs)) {
      if (events >= budget) break;
      if (detectedInvalid.has(k(src, evt))) continue;
      const p = findPath(src); if (p === null && src !== "IDLE") continue;
      execSeq([...(p ?? []), evt]);
    }
  }
  return {
    sc: visited.size / STATES.length,
    tc: coveredValid.size / Object.keys(VALID).length,
    itdr: detectedInvalid.size / totalInvalid,
    events,
  };
}

// --- Mikro-benchmark çekirdeği ---
// Aynı (state,event) çiftini BATCH_SIZE kez yorumlayıp toplam ns'yi BATCH_SIZE'a böler.
// Önce boş döngü overhead'i ölçülür ve çıkartılır.
const BATCH_SIZE = 100_000;
const REPEATS = 30;

function calibrateOverhead() {
  const samples = [];
  for (let r = 0; r < REPEATS; r++) {
    const t0 = hrtime.bigint();
    let acc = 0;
    for (let i = 0; i < BATCH_SIZE; i++) acc ^= i; // boş iş
    const t1 = hrtime.bigint();
    if (acc === Infinity) console.log("noop");
    samples.push(Number(t1 - t0) / BATCH_SIZE);
  }
  return mean(samples);
}

function benchOneCellNs(state, event, overheadNs) {
  // Closures ile aynı path tekrar tekrar çalışır → JIT amortize.
  const samples = [];
  for (let r = 0; r < REPEATS; r++) {
    const t0 = hrtime.bigint();
    let detected = 0, covered = 0;
    for (let i = 0; i < BATCH_SIZE; i++) {
      const key = k(state, event);
      const nx = VALID[key];
      if (nx !== undefined) { covered++; }
      else { classifyInvalid(state, event); detected++; }
    }
    const t1 = hrtime.bigint();
    if (detected + covered < 0) console.log("noop");
    const perCallNs = Number(t1 - t0) / BATCH_SIZE - overheadNs;
    samples.push(Math.max(0, perCallNs));
  }
  return samples;
}

console.log("[1/4] Latency ölçümü (overhead kalibrasyonu + Q×Σ batch benchmark)...");
const overheadNs = calibrateOverhead();
console.log(`  Boş döngü overhead'i: ${overheadNs.toFixed(2)} ns/iter`);

// Üç sınıf hücreyi ölçümle: (a) valid cell, (b) invalid CRITICAL, (c) invalid LOW.
const probes = [
  { label: "valid_step",      s: "IDLE",         e: "CONNECT" },
  { label: "invalid_critical",s: "IDLE",         e: "SEND_RELAY_DATA" }, // BYPASS CRITICAL
  { label: "invalid_low",     s: "ERROR",        e: "TLS_FAIL" },        // GHOST LOW
];

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

const latencyData = { overheadNs, batchSize: BATCH_SIZE, repeats: REPEATS };
for (const pr of probes) {
  const ns = benchOneCellNs(pr.s, pr.e, overheadNs);
  latencyData[pr.label] = {
    state: pr.s, event: pr.e,
    mean_ns: mean(ns), sd_ns: sd(ns),
    min_ns: Math.min(...ns), max_ns: Math.max(...ns),
    p50_ns: percentile(ns, 0.50), p95_ns: percentile(ns, 0.95),
  };
}

// ============================================================
// (6) Wilcoxon signed-rank — eşleştirilmiş tasarıma uygun
// ============================================================
function wilcoxonSignedRank(xs, ys) {
  if (xs.length !== ys.length) throw new Error("paired arrays must be equal length");
  const diffs = xs.map((x, i) => x - ys[i]).filter((d) => d !== 0);
  const n = diffs.length;
  if (n === 0) return { W: 0, z: 0, p: 1, n: 0 };
  const ranked = diffs.map((d) => ({ abs: Math.abs(d), sign: Math.sign(d) }));
  ranked.sort((a, b) => a.abs - b.abs);
  let i = 0;
  while (i < ranked.length) {
    let j = i;
    while (j + 1 < ranked.length && ranked[j + 1].abs === ranked[i].abs) j++;
    const avg = (i + j) / 2 + 1;
    for (let kk = i; kk <= j; kk++) ranked[kk].rank = avg;
    i = j + 1;
  }
  const Wp = ranked.filter((r) => r.sign > 0).reduce((a, b) => a + b.rank, 0);
  const Wn = ranked.filter((r) => r.sign < 0).reduce((a, b) => a + b.rank, 0);
  const W = Math.min(Wp, Wn);
  // tie-corrected SD
  const tieGroups = new Map();
  for (const r of ranked) tieGroups.set(r.abs, (tieGroups.get(r.abs) || 0) + 1);
  let tieSum = 0;
  for (const t of tieGroups.values()) if (t > 1) tieSum += t ** 3 - t;
  const meanW = (n * (n + 1)) / 4;
  const sigW = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24 - tieSum / 48);
  if (sigW === 0) return { W, z: 0, p: 1, n };
  const z = (W - meanW) / sigW;
  const p = 2 * (1 - normalCDF(Math.abs(z)));
  return { W, z, p, n, Wp, Wn };
}

console.log("[2/4] Wilcoxon signed-rank testleri...");
const pairs = [
  ["B3_MDT", "B1_Random"],
  ["B3_MDT", "B2_GreedySC"],
  ["B2_GreedySC", "B1_Random"],
];
const wilcoxon = [];
for (const [a, b] of pairs) {
  for (const m of ["sc", "tc", "itdr"]) {
    const xs = trials.stats[a][m].values;
    const ys = trials.stats[b][m].values;
    const w = wilcoxonSignedRank(xs, ys);
    wilcoxon.push({ a, b, metric: m, ...w });
  }
}

// ============================================================
// (11) Bütçe-kapsama eğrisi
// ============================================================
console.log("[3/4] Bütçe-kapsama eğrisi (7 bütçe × 3 algo × 30 koşu)...");
const BUDGETS = [50, 100, 200, 500, 1000, 2000, 5000];
const budgetCurve = {};
for (const name of ["B1_Random", "B2_GreedySC", "B3_MDT"]) {
  budgetCurve[name] = [];
  for (const B of BUDGETS) {
    const tcVals = [], itdrVals = [];
    for (let i = 0; i < 30; i++) {
      const r = instrumentedExec(name, 1000 + i, B);
      tcVals.push(r.tc);
      itdrVals.push(r.itdr);
    }
    budgetCurve[name].push({
      budget: B,
      tc_mean: mean(tcVals), tc_sd: sd(tcVals),
      itdr_mean: mean(itdrVals), itdr_sd: sd(itdrVals),
    });
  }
}

// ============================================================
// (5) PRISMA — yalnızca denetlenebilir sayılar
// ============================================================
// Açık-web SLR sürecinde ham sorgu logları tutulmadığı için ara aşama sayıları
// raporlanmaz (NA). Yalnızca son "included" sayısı denetlenebilir: repodaki
// Literatur_Notlari.pdf'in atıf sayısı = 20.
const prisma = {
  identified_db: 0,            // doğrulanabilir: canlı DB erişimi yok
  identified_other: null,      // NA — ham log tutulmadı
  duplicates_removed: null,    // NA
  screened: null,              // NA
  excluded_title_abstract: null, // NA
  full_text_assessed: null,    // NA
  excluded_full_text: null,    // NA
  included: 20,                // doğrulanabilir: Literatur_Notlari.pdf ile birebir
  exclusion_reasons_qualitative: [
    "Tor ile dolaylı ilgili çalışmalar",
    "Sadece kriptografik primitif analizi (FSM ile ilgisiz)",
    "Eski sürüm Tor (≤0.2.x), güncel spec ile uyumsuz",
    "Tam metne açık erişim yok",
    "Yetersiz metodolojik açıklama",
  ],
  notes: "Ara sayılar (NA) raporlanmaz çünkü açık-web sürecinde audit-edilebilir log tutulmadı. Bu durum tezin sınırlılıklar bölümünde açıkça belirtilir.",
};

// ============================================================
// Yaz
// ============================================================
const outPath = path.join(__dirname, "b_extensions.json");
await fs.writeFile(outPath, JSON.stringify({
  ruleBased, latencyData, wilcoxon, budgetCurve, prisma, BUDGETS,
}, null, 2));
console.log("[4/4] b_extensions.json yazıldı:", outPath);
console.log("\nÖZET:");
console.log(`  Rule-based completeness: ${(ruleBased.completeness * 100).toFixed(1)}% (${ruleBased.detectedByRules}/${ruleBased.totalInvalid})`);
console.log(`  Missed by severity:`, ruleBased.missedBySeverity);
for (const pr of probes) {
  const d = latencyData[pr.label];
  console.log(`  Latency [${pr.label}]: ${d.mean_ns.toFixed(1)} ns/call (SD ${d.sd_ns.toFixed(1)}, p95 ${d.p95_ns.toFixed(1)})`);
}
console.log(`  Wilcoxon B3 vs B1 [TC]: W=${wilcoxon.find(w=>w.a==='B3_MDT'&&w.b==='B1_Random'&&w.metric==='tc').W.toFixed(1)}, p=${wilcoxon.find(w=>w.a==='B3_MDT'&&w.b==='B1_Random'&&w.metric==='tc').p.toExponential(2)}`);
