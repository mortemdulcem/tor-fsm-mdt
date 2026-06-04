// Coklu-seed gercek-saldiri metrikleri toplayicisi (UC-MODLU, durust).
//
// Girdi: experiments/runs/results.jsonl (full_pipeline.sh / recompute.sh uretir).
// Her satir bir Shadow kosusu:
//   {attack, seed, scenario:"attack"|"benign", circuits, flagged, injected, noise,
//    native, markers, types, [prem_injected, prem_noise]}
//
// Saldiri basina FARKLI rapor — cunku ground-truth her saldirida ayni degil:
//
//   create_flood  : FSM tipi CREATE_FLOOD yalnizca saldirida olusur (benign=0).
//                   Tip-temiz confusion matrix (TP/FP/TN/FN, precision/recall/F1/FPR).
//
//   premature_data: ihlal nesnesinde injected=true (TOR_FSM_PREMATURE_SEND marker'i
//                   parser tarafindan etiketlenir) -> EVENT-LEVEL confusion:
//                     TP = injected (gercek premature, tespit edildi)
//                     FP = attack.noise (begin-noise PREMATURE yanlis-pozitifi)
//                     FN = markers - injected (gonderilen ama FSM-etiketlenmeyen)
//                   Ayrica benign begin-noise FPR ve non-circular native (12 vs 0).
//
//   circuit_hijack: injected=0 (parser bu hook'u etiketlemiyor) VE benign'de sabit
//                   ~12 CIRCUIT_HIJACK taban-gurultusu (begin-noise normal 3-hop
//                   devrelerdeki EXTEND/CREATE'i aktif devreye yanlis-atfeder).
//                   -> FSM-siniflandirma SEVIYESINDE AYIRT EDICI DEGIL. Sahte temiz
//                   matris URETILMEZ; sayilar + delta + non-circular native (organik
//                   CREATE) raporlanir; ayrilabilirlik native uzerinden gosterilir.
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
// native nullable olabilir (premature: relay-side kosum-seviyesi -> yalniz birinci
// istemci satirinda gercek deger, digerlerinde null). null'lari atla ki kosum-basina
// tek deger sayilsin (tekrar etmesin, GA suni daralmasin).
const pushNat = (arr, v) => { if (v != null) arr.push(v); };

function aggLine(label, arr) {
  if (!arr.length) return `    ${label}: (veri yok)`;
  const m = mean(arr), s = sd(arr), [lo, hi] = ci95(arr);
  const ci = arr.length >= 2
    ? `, %95 GA [${fmt(lo)}, ${fmt(hi)}]`
    : ` (tek seed, GA yok)`;
  return `    ${label}: ort=${fmt(m)} ± ${fmt(s)} (n=${arr.length})${ci}`;
}

// non-circular native ayrilabilirlik: attack min ile benign max ortusur mu?
function sepLine(atk, ben) {
  if (!atk.length || !ben.length) return "    ayrilabilirlik: (veri yok)";
  const mnA = Math.min(...atk), mxB = Math.max(...ben);
  return `    ayrilabilirlik: attack min=${mnA} vs benign max=${mxB} -> ` +
    (mnA > mxB ? "ORTUSME YOK (esikle ayrilabilir)" : "ORTUSME VAR (ayrilamaz)");
}

// --- gruplama ----------------------------------------------------------------
// Coklu-istemci (CLIENTS>1): her istemci AYRI bir ornek boyutudur. Eskiden
// byAttack[attack][seed][scenario] tek satira yaziliyordu -> ek istemci satirlari
// birbirinin uzerine yazardi. Simdi istemci de anahtar:
//   byAttack[attack][seed][client][scenario]
// Boylece N istemci = N kat ornek; uzerine-yazma yok. Eski satirlarda client alani
// yoksa "torclient" varsayilir -> tek-istemci sonuclari birebir korunur.
function group(lines) {
  const byAttack = {};
  for (const r of lines) {
    const client = r.client || "torclient";
    (byAttack[r.attack] ??= {});
    (byAttack[r.attack][r.seed] ??= {});
    (byAttack[r.attack][r.seed][client] ??= {});
    byAttack[r.attack][r.seed][client][r.scenario] = r;
  }
  return byAttack;
}

// byAttack[attack] = {seed: {client: {scenario: r}}} -> her (seed,client) cifti bir
// orneklem: {"<seed>/<client>": {attack, benign}}. Istatistik fonksiyonlari bu
// duz yapinin uzerinde calisir (eski {seed: {scenario}} ile ayni erisim sekli).
function samplesOf(bySeedClient) {
  const out = {};
  for (const seed of Object.keys(bySeedClient)) {
    for (const client of Object.keys(bySeedClient[seed])) {
      out[`${seed}/${client}`] = bySeedClient[seed][client];
    }
  }
  return out;
}

// bir attack icin benzersiz istemci adlari (basliklarda gostermek icin)
function clientsOf(bySeedClient) {
  const set = new Set();
  for (const seed of Object.keys(bySeedClient)) {
    for (const client of Object.keys(bySeedClient[seed])) set.add(client);
  }
  return [...set].sort();
}

// --- create_flood: tip-temiz confusion (benign hedef-tip = 0 beklenir) --------
function createFloodStats(bySeed) {
  const o = { tp: [], fn: [], fp: [], tn: [], precision: [], recall: [], f1: [],
    fpr: [], nativeAtk: [], nativeBen: [], benCount: [] };
  for (const s of Object.keys(bySeed)) {
    const a = bySeed[s].attack, b = bySeed[s].benign;
    if (!a || !b) continue;
    const TP = Math.min(a.flagged, a.circuits), FN = Math.max(0, a.circuits - TP);
    const FP = Math.min(b.flagged, b.circuits), TN = Math.max(0, b.circuits - FP);
    const prec = div(TP, TP + FP), rec = div(TP, TP + FN), fpr = div(FP, FP + TN);
    o.tp.push(TP); o.fn.push(FN); o.fp.push(FP); o.tn.push(TN);
    o.precision.push(prec); o.recall.push(rec); o.f1.push(div(2 * prec * rec, prec + rec));
    o.fpr.push(fpr);
    pushNat(o.nativeAtk, a.native); pushNat(o.nativeBen, b.native); o.benCount.push(b.flagged);
  }
  return o;
}

// --- premature_data: event-level (injected ground-truth) ---------------------
function prematureStats(bySeed) {
  const o = { tp: [], fn: [], precision: [], recall: [], f1: [], fprBen: [],
    injected: [], noiseAtk: [], markers: [], nativeAtk: [], nativeBen: [] };
  for (const s of Object.keys(bySeed)) {
    const a = bySeed[s].attack, b = bySeed[s].benign;
    if (!a || !b) continue;
    const inj = a.injected ?? a.prem_injected ?? 0;
    const noiseA = a.noise ?? a.prem_noise ?? 0;
    const noiseB = b.noise ?? b.prem_noise ?? 0;
    const mk = a.markers || 0;
    const TP = inj, FN = Math.max(0, mk - inj);
    const prec = div(TP, TP + noiseA);       // attack-kosusunda dogru premature orani
    const rec = div(TP, mk || (TP + FN));    // gonderilen marker'in ne kadari etiketlendi
    o.tp.push(TP); o.fn.push(FN);
    o.precision.push(prec); o.recall.push(rec); o.f1.push(div(2 * prec * rec, prec + rec));
    o.fprBen.push(div(noiseB, b.circuits));  // benign begin-noise yanlis-pozitif orani
    o.injected.push(inj); o.noiseAtk.push(noiseA); o.markers.push(mk);
    pushNat(o.nativeAtk, a.native); pushNat(o.nativeBen, b.native);
  }
  return o;
}

// --- circuit_hijack: confounded (event-level ground-truth yok) ----------------
function hijackStats(bySeed) {
  const o = { atkCount: [], benCount: [], delta: [], injected: [],
    nativeAtk: [], nativeBen: [] };
  for (const s of Object.keys(bySeed)) {
    const a = bySeed[s].attack, b = bySeed[s].benign;
    if (!a || !b) continue;
    o.atkCount.push(a.flagged); o.benCount.push(b.flagged);
    o.delta.push(a.flagged - b.flagged); o.injected.push(a.injected ?? 0);
    pushNat(o.nativeAtk, a.native); pushNat(o.nativeBen, b.native);
  }
  return o;
}

// --- rapor -------------------------------------------------------------------
function report(byAttack) {
  const L = [];
  L.push("=== Coklu-seed gercek-saldiri metrikleri (non-circular, uc-modlu) ===\n");
  for (const attack of Object.keys(byAttack).sort()) {
    const bySeedClient = byAttack[attack];
    const seeds = Object.keys(bySeedClient);
    const clients = clientsOf(bySeedClient);
    // her (seed,client) cifti bir orneklem -> istatistikler bu duz yapi uzerinde.
    const bySeed = samplesOf(bySeedClient);
    const n = Object.keys(bySeed).length;
    const clientInfo = clients.length > 1
      ? ` | istemci: ${clients.length} (${clients.join(", ")})`
      : "";
    L.push(`# ${attack}  (seed: ${seeds.join(", ")}${clientInfo} | n=${n})`);

    if (attack === "create_flood") {
      const c = createFloodStats(bySeed);
      const benClean = c.benCount.every((x) => x === 0);
      L.push(`  [tip-temiz confusion — FSM tipi CREATE_FLOOD benign'de ${benClean ? "GORULMEZ (ayrac)" : "GORULDU (uyari!)"}]`);
      L.push(aggLine("TP", c.tp)); L.push(aggLine("FN", c.fn));
      L.push(aggLine("FP", c.fp)); L.push(aggLine("TN", c.tn));
      L.push(aggLine("Precision", c.precision));
      L.push(aggLine("Recall   ", c.recall));
      L.push(aggLine("F1       ", c.f1));
      L.push(aggLine("FPR      ", c.fpr));
      L.push("  [non-circular] organik CREATE log satiri (attack vs benign):");
      L.push(aggLine("ATTACK", c.nativeAtk)); L.push(aggLine("BENIGN", c.nativeBen));
      L.push(sepLine(c.nativeAtk, c.nativeBen));

    } else if (attack === "premature_data") {
      const p = prematureStats(bySeed);
      if (clients.length > 1) {
        L.push(`  [coklu-istemci] event-level confusion ${clients.length} istemci x ${seeds.length} seed uzerinden (n=${n} orneklem).`);
        L.push("    not: relay-side native (zero-stream-id) KOSUM-SEVIYESIDIR (tek");
        L.push("    istemciye atfedilemez) -> kosum basina bir kez sayilir (asagidaki n).");
      }
      L.push("  [event-level confusion — ground-truth: injected (TOR marker)]");
      L.push(aggLine("TP=injected", p.tp));
      L.push(aggLine("FN=markers-inj", p.fn));
      L.push(aggLine("FP=attack-noise", p.noiseAtk));
      L.push(aggLine("Precision", p.precision));
      L.push(aggLine("Recall   ", p.recall));
      L.push(aggLine("F1       ", p.f1));
      L.push("    not: recall = FSM-etiketli injected / gonderilen marker; parser");
      L.push("    kapsami sinirli oldugu icin <1 (gonderilenin hepsi etiketlenmez).");
      L.push("  [benign begin-noise FPR] noise/circuits:");
      L.push(aggLine("FPR", p.fprBen));
      L.push("  [non-circular] Tor native relay logu (zero-stream-id):");
      L.push(aggLine("ATTACK", p.nativeAtk)); L.push(aggLine("BENIGN", p.nativeBen));
      L.push(sepLine(p.nativeAtk, p.nativeBen));

    } else if (attack === "circuit_hijack") {
      const h = hijackStats(bySeed);
      const injZero = h.injected.every((x) => x === 0);
      L.push("  [UYARI] FSM-siniflandirma seviyesinde AYIRT EDICI DEGIL:");
      L.push(`    - injected ground-truth ${injZero ? "YOK (hepsi 0)" : "var"}; event-level confusion kurulamaz.`);
      L.push("    - benign'de sabit begin-noise taban-gurultusu (asagidaki BENIGN sayisi).");
      L.push("  [FSM hedef-tip ihlal sayisi] CIRCUIT_HIJACK:");
      L.push(aggLine("ATTACK", h.atkCount)); L.push(aggLine("BENIGN", h.benCount));
      L.push(aggLine("delta=atk-ben", h.delta));
      L.push("  [non-circular] organik CREATE log satiri (attack vs benign):");
      L.push(aggLine("ATTACK", h.nativeAtk)); L.push(aggLine("BENIGN", h.nativeBen));
      L.push(sepLine(h.nativeAtk, h.nativeBen));
      L.push("    sonuc: ayrim YALNIZCA non-circular native ile mumkun; FSM-tip degil.");

    } else {
      L.push("  (taninmayan saldiri — atlandi)");
    }
    L.push("");
  }
  return L.join("\n");
}

// --- selftest (formul dogrulamasi; GERCEK VERI DEGIL) ------------------------
function selftest() {
  const data = [
    // create_flood: benign-temiz -> precision=recall=F1=1, FPR=0
    { attack: "create_flood", seed: 1, scenario: "attack", circuits: 10, flagged: 10, injected: 0, noise: 10, native: 20 },
    { attack: "create_flood", seed: 1, scenario: "benign", circuits: 10, flagged: 0, injected: 0, noise: 0, native: 10 },
    { attack: "create_flood", seed: 2, scenario: "attack", circuits: 8, flagged: 8, injected: 0, noise: 8, native: 16 },
    { attack: "create_flood", seed: 2, scenario: "benign", circuits: 8, flagged: 0, injected: 0, noise: 0, native: 8 },
    // premature: TP=inj=5, FN=markers-inj=7, FP=noiseAtk=6, prec=5/11, rec=5/12
    { attack: "premature_data", seed: 1, scenario: "attack", circuits: 10, flagged: 11, injected: 5, noise: 6, native: 12, markers: 12 },
    { attack: "premature_data", seed: 1, scenario: "benign", circuits: 9, flagged: 9, injected: 0, noise: 9, native: 0, markers: 0 },
    // circuit_hijack: injected=0, benign baseline>0
    { attack: "circuit_hijack", seed: 1, scenario: "attack", circuits: 9, flagged: 21, injected: 0, noise: 21, native: 18 },
    { attack: "circuit_hijack", seed: 1, scenario: "benign", circuits: 9, flagged: 12, injected: 0, noise: 12, native: 9 },
  ];
  const g = group(data);
  // client alani olmayan satirlar "torclient" altinda gruplanmali (geriye uyumluluk)
  const c = createFloodStats(samplesOf(g.create_flood));
  const p = prematureStats(samplesOf(g.premature_data));
  const h = hijackStats(samplesOf(g.circuit_hijack));
  const assert = (cond, msg) => { if (!cond) { console.error("FAIL:", msg); process.exit(1); } };
  // create_flood
  assert(JSON.stringify(c.tp) === JSON.stringify([10, 8]), "cf tp");
  assert(mean(c.precision) === 1 && mean(c.recall) === 1 && mean(c.fpr) === 0, "cf clean");
  // premature
  assert(p.tp[0] === 5 && p.fn[0] === 7, "prem tp/fn");
  assert(Math.abs(p.precision[0] - 5 / 11) < 1e-9, "prem precision 5/11");
  assert(Math.abs(p.recall[0] - 5 / 12) < 1e-9, "prem recall 5/12");
  assert(Math.abs(p.fprBen[0] - 9 / 9) < 1e-9, "prem benign fpr 9/9");
  assert(p.nativeAtk[0] === 12 && p.nativeBen[0] === 0, "prem native");
  // hijack
  assert(h.atkCount[0] === 21 && h.benCount[0] === 12 && h.delta[0] === 9, "hijack counts");
  assert(h.injected.every((x) => x === 0), "hijack injected=0");

  // --- coklu-istemci boyutu (CLIENTS>1) ---
  // Ayni veriye 2. istemci ekle: client alanli satirlar uzerine-yazilmamali ve
  // her (seed,client) ayri orneklem olmali.
  const mc = [
    // create_flood seed=1: torclient (10/10) + torclient2 (6/6) -> 2 orneklem
    { attack: "create_flood", seed: 1, client: "torclient",  scenario: "attack", circuits: 10, flagged: 10, injected: 0, noise: 10, native: 20 },
    { attack: "create_flood", seed: 1, client: "torclient",  scenario: "benign", circuits: 10, flagged: 0,  injected: 0, noise: 0,  native: 10 },
    { attack: "create_flood", seed: 1, client: "torclient2", scenario: "attack", circuits: 6,  flagged: 6,  injected: 0, noise: 6,  native: 12 },
    { attack: "create_flood", seed: 1, client: "torclient2", scenario: "benign", circuits: 6,  flagged: 0,  injected: 0, noise: 0,  native: 6  },
    // premature seed=1: 2 istemci, her biri kendi event-level; native YALNIZ
    // torclient'ta (relay-side kosum-seviyesi), torclient2'de null.
    { attack: "premature_data", seed: 1, client: "torclient",  scenario: "attack", circuits: 10, flagged: 11, injected: 5, noise: 6, native: 12,   markers: 12 },
    { attack: "premature_data", seed: 1, client: "torclient",  scenario: "benign", circuits: 9,  flagged: 9,  injected: 0, noise: 9, native: 0,    markers: 0 },
    { attack: "premature_data", seed: 1, client: "torclient2", scenario: "attack", circuits: 8,  flagged: 7,  injected: 3, noise: 4, native: null, markers: 8 },
    { attack: "premature_data", seed: 1, client: "torclient2", scenario: "benign", circuits: 8,  flagged: 8,  injected: 0, noise: 8, native: null, markers: 0 },
  ];
  const gmc = group(mc);
  const cmc = createFloodStats(samplesOf(gmc.create_flood));
  const pmc = prematureStats(samplesOf(gmc.premature_data));
  // uzerine-yazma yok: iki istemci -> iki create_flood orneklem
  assert(cmc.tp.length === 2 && JSON.stringify(cmc.tp) === JSON.stringify([10, 6]), "mc cf 2 ornek");
  assert(clientsOf(gmc.create_flood).length === 2, "mc cf 2 istemci");
  // premature event-level iki istemci -> iki TP orneklemi
  assert(pmc.tp.length === 2 && JSON.stringify(pmc.tp) === JSON.stringify([5, 3]), "mc prem 2 ornek");
  // native null'lar atlandi: kosum basina tek deger (torclient: 12 / benign 0)
  assert(pmc.nativeAtk.length === 1 && pmc.nativeAtk[0] === 12, "mc prem native run-level");
  assert(pmc.nativeBen.length === 1 && pmc.nativeBen[0] === 0, "mc prem native benign");

  // --- geriye uyumluluk: client'siz veri == client="torclient" ile ayni sayilar ---
  const withClient = data.map((r) => ({ ...r, client: "torclient" }));
  const gWith = group(withClient);
  const cWith = createFloodStats(samplesOf(gWith.create_flood));
  assert(JSON.stringify(cWith.tp) === JSON.stringify(c.tp) &&
         JSON.stringify(cWith.precision) === JSON.stringify(c.precision),
         "geriye uyumluluk: client=torclient ayni sayilar");
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
    console.error(`results bulunamadi: ${path}\nOnce VM'de: bash experiments/full_pipeline.sh (veya recompute.sh)`);
    process.exit(2);
  }
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
  if (!lines.length) { console.error("results.jsonl bos"); process.exit(2); }
  console.log(report(group(lines)));
}
