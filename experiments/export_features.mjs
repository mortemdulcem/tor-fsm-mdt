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

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { parseTorHostLog } from "./shadow_harness.mjs";

const SEEDS = (process.env.SEEDS || "42 137 2718").trim().split(/\s+/);
const ATTACKS = ["create_flood", "circuit_hijack", "premature_data"];
const RUNS = "experiments/runs";

// Coklu-istemci destegi: tek bir kosuda torclient, torclient2, ... host'lari
// olabilir (full_pipeline.sh CLIENTS>1). HER istemcinin logunu ayri okuruz ve
// gid'i host adiyla onekleriz (torclient2:5) -> istemciler-arasi gid cakismasi
// olmaz. Tek-istemci kosularda yalniz "torclient" bulunur (geriye uyumlu).
const hostsDir = (sub, seed) => `${RUNS}/${sub}/seed${seed}/hosts`;
const clientLogs = (sub, seed) => {
  const dir = hostsDir(sub, seed);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((h) => /^torclient\d*$/.test(h))
    .sort()
    .map((h) => ({ host: h, file: `${dir}/${h}/tor.1000.stdout` }))
    .filter((x) => existsSync(x.file));
};

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

function add(scenario, attack, seed, sub) {
  const clients = clientLogs(sub, seed);
  if (clients.length === 0) {
    console.log(`  atla (log yok): ${hostsDir(sub, seed)}/torclient*/tor.1000.stdout`);
    return;
  }
  let n = 0;
  for (const { host, file } of clients) {
    const raw = parseTorHostLog(readFileSync(file, "utf8"), host);
    if (!shapeLogged) {
      const ctor = raw && raw.constructor ? raw.constructor.name : typeof raw;
      console.log(`  [parse sekli] ${ctor}; ust anahtarlar:`,
        raw && typeof raw === "object" && !Array.isArray(raw) ? Object.keys(raw).slice(0, 10) : "(dizi/diger)");
      shapeLogged = true;
    }
    // raw = { gid: <olay dizisi> }; gid'i KORU + host onekle (cakisma onleme).
    const entries =
      raw instanceof Map
        ? Array.from(raw.entries())
        : Array.isArray(raw)
          ? raw.map((c, i) => [String(i), c])
          : Object.entries(raw);
    for (const [gid, circ] of entries) {
      const events = toCircuitList(circ); // devre de dizi/nesne olabilir
      dataset.push({ scenario, attack, seed: Number(seed), gid: `${host}:${gid}`, events });
      n++;
    }
  }
  const hosts = clients.map((c) => c.host).join(",");
  console.log(`  ${scenario}/${attack} seed=${seed}: ${n} devre (${clients.length} istemci: ${hosts})`);
}

for (const seed of SEEDS) {
  add("benign", "benign", seed, "_benign");
  for (const a of ATTACKS) add("attack", a, seed, a);
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

// --- n-gram (bigram) alfabesi: yalnizca fiilen gozlemlenen ardisik olay cift'leri ---
// Sira bilgisi sayim-seviyesi ozniteliklerde kaybolur; bigram olay SIRASINI yakalar
// (or. "RECV_CREATED>SEND_RELAY_DATA" vs "SEND_RELAY_DATA>RECV_CREATED" ayrimi).
const bigramSet = new Set();
for (const d of dataset) {
  const seq = d.events.map(evType);
  for (let i = 0; i + 1 < seq.length; i++) bigramSet.add(seq[i] + ">" + seq[i + 1]);
}
const bigrams = [...bigramSet].sort();

// --- devre basina zamanlama / sira ozniteligi cikarimi (gercek timestamp'lerden) ---
function seqTimeFeats(events) {
  const types = events.map(evType);
  const ts = events.map((e) => tsMs(e.timestamp));
  // olaylar-arasi gecikmeler (ms): ardisik gecerli timestamp farklari (negatif at)
  const gaps = [];
  for (let i = 1; i < ts.length; i++) {
    if (ts[i] == null || ts[i - 1] == null) continue;
    const g = ts[i] - ts[i - 1];
    if (g >= 0) gaps.push(g);
  }
  const mean = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const max = gaps.length ? Math.max(...gaps) : 0;
  const sorted = [...gaps].sort((a, b) => a - b);
  const med = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : 0;
  // ilk SEND_RELAY_DATA'ya kadar gecen sure (premature imzasi: cok erken veri):
  // yoksa -1
  const t0 = ts.find((x) => x != null);
  let firstDataMs = -1;
  for (let i = 0; i < types.length; i++) {
    if (types[i] === "SEND_RELAY_DATA" && ts[i] != null && t0 != null) {
      firstDataMs = Math.max(0, ts[i] - t0);
      break;
    }
  }
  // ilk SEND_RELAY_DATA'dan ONCE gerceklesen kurulum-tamamlama olayi sayisi
  // (RECV_CREATED/RECV_EXTENDED). Premature'da veri kurulum bitmeden gelir -> dusuk.
  // Hic veri yoksa -1. Bu SIRA-duyarli bir ozniteliktir (sayimdan farkli).
  let setupBeforeData = 0, sawData = false;
  for (const t of types) {
    if (t === "SEND_RELAY_DATA") { sawData = true; break; }
    if (t === "RECV_CREATED" || t === "RECV_EXTENDED") setupBeforeData++;
  }
  if (!sawData) setupBeforeData = -1;
  return {
    t_gap_mean: Math.round(mean),
    t_gap_max: Math.round(max),
    t_gap_med: Math.round(med),
    t_first_data_ms: firstDataMs,
    seq_setup_before_data: setupBeforeData,
  };
}

// --- CSV: devre basina non-circular oznitelikler ---
// sayim (olay-tipi + uzunluk + toplam sure) + n-gram (bg_*) + zamanlama (t_*) + sira (seq_*)
const SEQ_COLS = ["seq_setup_before_data"];
const TIME_COLS = ["t_gap_mean", "t_gap_max", "t_gap_med", "t_first_data_ms"];
const cols = [
  "scenario", "attack", "seed", "gid", "n_events", "dur_ms",
  ...alphabet,
  ...bigrams.map((b) => "bg_" + b),
  ...SEQ_COLS,
  ...TIME_COLS,
];
const rows = [cols.join(",")];
for (const d of dataset) {
  const counts = Object.fromEntries(alphabet.map((a) => [a, 0]));
  const seq = d.events.map(evType);
  const bg = Object.fromEntries(bigrams.map((b) => [b, 0]));
  let tmin = Infinity, tmax = -Infinity;
  for (const e of d.events) {
    counts[evType(e)]++;
    const ms = tsMs(e.timestamp);
    if (ms != null) { if (ms < tmin) tmin = ms; if (ms > tmax) tmax = ms; }
  }
  for (let i = 0; i + 1 < seq.length; i++) bg[seq[i] + ">" + seq[i + 1]]++;
  const dur = tmax >= tmin ? tmax - tmin : 0;
  const st = seqTimeFeats(d.events);
  rows.push([
    d.scenario, d.attack, d.seed, d.gid, d.events.length, dur,
    ...alphabet.map((a) => counts[a]),
    ...bigrams.map((b) => bg[b]),
    ...SEQ_COLS.map((c) => st[c]),
    ...TIME_COLS.map((c) => st[c]),
  ].join(","));
}
writeFileSync("experiments/ml_features.csv", rows.join("\n") + "\n");

// ham veri de saklansin (yuksek-sadakat; istege bagli)
writeFileSync("experiments/ml_dataset.json", JSON.stringify(dataset));

console.log("\n--- olay-tipi alfabesi ---", alphabet.join(" "));
console.log(`--- n-gram (bigram) sayisi: ${bigrams.length} ---`);
console.log(`yazildi: experiments/ml_features.csv (${dataset.length} devre, ${cols.length} sutun)`);
console.log(`yazildi: experiments/ml_dataset.json (${dataset.length} devre, ${SEEDS.length} seed)`);
console.log("\n--- ml_features.csv (ilk 6 satir) ---");
console.log(rows.slice(0, 6).join("\n"));
