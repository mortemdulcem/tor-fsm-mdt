// Coklu-seed non-circular tespit metrikleri toplayicisi.
//
// Girdi: experiments/runs/results.jsonl (full_pipeline.sh uretir). Her satir bir
// Shadow kosusu: {attack, seed, scenario:"attack"|"benign", circuits, flagged,
// native, [prem_injected, prem_noise], types}.
//
// Cikti: her gercek saldiri icin
//   - CREATE_FLOOD / CIRCUIT_HIJACK: per-seed confusion matrix (TP/FP/TN/FN) ve
//     precision/recall/F1/FPR; seedler arasi ortalama ± SD ± %95 t-GA (kucuk n).
//   - PREMATURE_DATA: non-circular native sinyal (relay zero-stream-id) attack vs
//     benign; dedektor begin-noise FPR (durust yanlis-pozitif orani); marker-tabanli
//     recall AYRICA ve "yari-dongusel" uyarisiyla.
//
// Metodoloji (durust): ornek birimi = istemci devresi. Etiket = senaryo (attack=+,
// benign=-). Tahmin = FSM dedektorunun o tipi isaretlemesi. Uc saldiri da dedektoru
// saldirinin urettigi olaya gore tetikledigi icin recall yapisal olarak yuksek
// beklenir; bilimsel olarak ayirt edici nicelik benign uzerindeki YANLIS-POZITIF
// oranidir (ozellikle PREMATURE begin-noise). PREMATURE icin istemci-tarafi TP
// marker'a dayanir (dongusel) -> non-circular kanit relay'in native logudur.
//
// Kullanim:  node experiments/metrics.mjs [results.jsonl]
//            node experiments/metrics.mjs --selftest

import { readFileSync } from "node:fs";

// --- istatistik yardimcilari -------------------------------------------------
const T95 = { 1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447,
  7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179 };
const tcrit = (n) => (n - 1 <= 0 ? NaN : (T95[n - 1] ?? 1.96));
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};
const ci95 = (a) => {
  const n = a.length;
  if (n < 2) return [NaN, NaN];
  const h = (tcrit(n) * sd(a)) / Math.sqrt(n);
  return [mean(a) - h, mean(a) + h];
};
const div = (a, b) => (b === 0 ? 0 : a / b);
const fmt = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "n/a");

function aggLine(label, arr) {
  if (!arr.length) return `    ${label}: (veri yok)`;
  const m = mean(arr), s = sd(arr), [lo, hi] = ci95(arr);
  const ci = arr.length >= 2
    ? `, %95 GA [${fmt(lo)}, ${fmt(hi)}]`
    : ` (tek seed, GA yok)`;
  return `    ${label}: ort=${fmt(m)} ± ${fmt(s)} (n=${arr.length})${ci}`;
}

// --- gruplama ----------------------------------------------------------------
function group(lines) {
  const byAttack = {};
  for (const r of lines) {
    (byAttack[r.attack] ??= {});
    (byAttack[r.attack][r.seed] ??= {});
    byAttack[r.attack][r.seed][r.scenario] = r;
  }
  return byAttack;
}

// Per-circuit isaret sayisi: benzersiz devre (varsa) yoksa ihlal sayisi; her
// halde [0, circuits] araligina KISILIR (bir devre tipte en fazla 1 kez sayilir).
const flagOf = (r) => {
  const f = r.flaggedCircuits != null ? r.flaggedCircuits : r.flagged;
  return Math.min(Math.max(0, f), r.circuits);
};

// --- CREATE_FLOOD / CIRCUIT_HIJACK: standart confusion matrix -----------------
function confusionStd(bySeed) {
  const out = { precision: [], recall: [], f1: [], fpr: [],
    tp: [], fp: [], fn: [], tn: [], nativeAtk: [], nativeBen: [] };
  for (const seed of Object.keys(bySeed)) {
    const a = bySeed[seed].attack, b = bySeed[seed].benign;
    if (!a || !b) continue;
    const fa = flagOf(a), fb = flagOf(b);
    const TP = fa, FN = Math.max(0, a.circuits - fa);
    const FP = fb, TN = Math.max(0, b.circuits - fb);
    const prec = div(TP, TP + FP), rec = div(TP, TP + FN), fpr = div(FP, FP + TN);
    const f1 = div(2 * prec * rec, prec + rec);
    out.tp.push(TP); out.fn.push(FN); out.fp.push(FP); out.tn.push(TN);
    out.precision.push(prec); out.recall.push(rec); out.f1.push(f1); out.fpr.push(fpr);
    out.nativeAtk.push(a.native); out.nativeBen.push(b.native);
  }
  return out;
}

// --- PREMATURE_DATA: non-circular native + begin-noise FPR --------------------
function prematureStats(bySeed) {
  const out = { nativeAtk: [], nativeBen: [], fprNoise: [], markerRecall: [],
    injected: [], noiseBen: [] };
  for (const seed of Object.keys(bySeed)) {
    const a = bySeed[seed].attack, b = bySeed[seed].benign;
    if (!a || !b) continue;
    out.nativeAtk.push(a.native);
    out.nativeBen.push(b.native);
    out.injected.push(a.prem_injected ?? 0);
    out.noiseBen.push(b.prem_noise ?? 0);
    out.fprNoise.push(div(b.prem_noise ?? 0, b.circuits));
    // marker recall = FSM'in yakaladigi enjekte / saldirinin GERCEKTEN gonderdigi
    // marker (TOR_FSM_PREMATURE_SEND grep). markers yoksa native'e duser (uyari).
    out.markerRecall.push(div(a.prem_injected ?? 0, (a.markers || a.native) || 0));
  }
  return out;
}

// --- rapor -------------------------------------------------------------------
function report(byAttack) {
  const lines = [];
  lines.push("=== Coklu-seed gercek-saldiri metrikleri (non-circular) ===\n");
  for (const attack of Object.keys(byAttack).sort()) {
    const bySeed = byAttack[attack];
    const seeds = Object.keys(bySeed);
    lines.push(`# ${attack}  (seed: ${seeds.join(", ")} | n=${seeds.length})`);
    if (attack === "premature_data") {
      const p = prematureStats(bySeed);
      lines.push("  [non-circular] Tor native relay logu (zero-stream-id) satir sayisi:");
      lines.push(aggLine("ATTACK", p.nativeAtk));
      lines.push(aggLine("BENIGN", p.nativeBen));
      lines.push("  [dedektor FPR] begin-noise yanlis-pozitif (benign): noise/circuits:");
      lines.push(aggLine("FPR", p.fprNoise));
      lines.push("  [yari-dongusel — uyari] marker-tabanli recall = injected/markers:");
      lines.push(aggLine("recall*", p.markerRecall));
      lines.push("    * marker saldirinin kendi yazdigi sinyaldir; bas sonuc DEGIL.");
    } else {
      const c = confusionStd(bySeed);
      lines.push("  [confusion matrix — devre bazli, seed ortalamasi]");
      lines.push(aggLine("TP", c.tp));
      lines.push(aggLine("FN", c.fn));
      lines.push(aggLine("FP", c.fp));
      lines.push(aggLine("TN", c.tn));
      lines.push(aggLine("Precision", c.precision));
      lines.push(aggLine("Recall   ", c.recall));
      lines.push(aggLine("F1       ", c.f1));
      lines.push(aggLine("FPR      ", c.fpr));
      lines.push("  [non-circular] organik CREATE log satir sayisi (attack vs benign):");
      lines.push(aggLine("ATTACK", c.nativeAtk));
      lines.push(aggLine("BENIGN", c.nativeBen));
    }
    lines.push("");
  }
  return lines.join("\n");
}

// --- selftest (formul dogrulamasi; GERCEK VERI DEGIL) ------------------------
function selftest() {
  const data = [
    { attack: "create_flood", seed: 1, scenario: "attack", circuits: 10, flagged: 10, native: 20 },
    { attack: "create_flood", seed: 1, scenario: "benign", circuits: 10, flagged: 0, native: 10 },
    { attack: "create_flood", seed: 2, scenario: "attack", circuits: 8, flagged: 8, native: 16 },
    { attack: "create_flood", seed: 2, scenario: "benign", circuits: 8, flagged: 0, native: 8 },
    { attack: "premature_data", seed: 1, scenario: "attack", circuits: 10, flagged: 11, native: 12, prem_injected: 5, prem_noise: 6 },
    { attack: "premature_data", seed: 1, scenario: "benign", circuits: 9, flagged: 9, native: 0, prem_injected: 0, prem_noise: 9 },
  ];
  const g = group(data);
  const c = confusionStd(g.create_flood);
  const p = prematureStats(g.premature_data);
  const assert = (cond, msg) => { if (!cond) { console.error("FAIL:", msg); process.exit(1); } };
  // create_flood: her seed icin TP=flagged, FN=0, FP=0, recall=1, fpr=0
  assert(JSON.stringify(c.tp) === JSON.stringify([10, 8]), "tp");
  assert(JSON.stringify(c.fn) === JSON.stringify([0, 0]), "fn");
  assert(JSON.stringify(c.fp) === JSON.stringify([0, 0]), "fp");
  assert(mean(c.recall) === 1, "recall=1");
  assert(mean(c.fpr) === 0, "fpr=0");
  assert(mean(c.precision) === 1, "precision=1");
  // premature: native attack=12 benign=0; FPR=9/9=1; markerRecall=5/12
  assert(p.nativeAtk[0] === 12 && p.nativeBen[0] === 0, "prem native");
  assert(p.fprNoise[0] === 1, "prem fpr 9/9");
  assert(Math.abs(p.markerRecall[0] - 5 / 12) < 1e-9, "prem marker recall");
  console.log("selftest PASS (formul dogrulamasi; bu sayilar gercek veri degildir)");
}

// --- main --------------------------------------------------------------------
const args = process.argv.slice(2);
if (args.includes("--selftest")) {
  selftest();
} else {
  const path = args[0] || "experiments/runs/results.jsonl";
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    console.error(`results bulunamadi: ${path}\nOnce VM'de: bash experiments/full_pipeline.sh`);
    process.exit(2);
  }
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
  if (!lines.length) { console.error("results.jsonl bos"); process.exit(2); }
  console.log(report(group(lines)));
}
