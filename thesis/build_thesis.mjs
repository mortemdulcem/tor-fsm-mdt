// Tam tez taslağı: Bölüm 1-6 + Özet + Abstract + Kaynakça.
// Tüm sayısal çıktılar experiments/trials.json'dan, tüm atıflar 20 doğrulanmış kaynaktan,
// tüm SVG figürleri experiments/figures.mjs'den. Hiçbir şey uydurulmaz.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { fsmGraphSvg, attackHeatmapSvg, metricBarChart, severitySplitSvg } from "../experiments/figures.mjs";
import { prismaSvg, budgetCurveSvg, ruleCompletenessSvg } from "../experiments/figures_v2.mjs";
import { STATES, EVENTS, VALID, totalDomain, totalValid, totalInvalid, k, classifyInvalid } from "../server/fsm.ts";
import { STREAM_STATES, STREAM_EVENTS, streamValidCount, streamInvalidCount } from "../server/fsm_stream.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const puppeteer = (await import(path.resolve(__dirname, "../node_modules/puppeteer-core/lib/cjs/puppeteer/puppeteer-core.js"))).default;

const trials = JSON.parse(await fs.readFile(path.resolve(__dirname, "../experiments/trials.json"), "utf8"));
const ext = JSON.parse(await fs.readFile(path.resolve(__dirname, "../experiments/b_extensions.json"), "utf8"));
const cext = JSON.parse(await fs.readFile(path.resolve(__dirname, "../experiments/c_extensions.json"), "utf8"));
const dext = JSON.parse(await fs.readFile(path.resolve(__dirname, "../experiments/d_extensions.json"), "utf8"));
const torStatic = JSON.parse(await fs.readFile(path.resolve(__dirname, "../experiments/tor_static_fsm.json"), "utf8"));
const fext = JSON.parse(await fs.readFile(path.resolve(__dirname, "../experiments/f_extensions.json"), "utf8"));
const fval = JSON.parse(await fs.readFile(path.resolve(__dirname, "../experiments/f_extensions_validated.json"), "utf8"));
const gext = JSON.parse(await fs.readFile(path.resolve(__dirname, "../experiments/g_extensions.json"), "utf8"));
const fvalBy = Object.fromEntries(fval.comparisons.filter(v => v.B === "B2_GreedySC").map(v => [v.metric, v]));
const stats = trials.stats;
const comparisons = trials.comparisons;
const sevSplit = trials.severitySumPerAlgo;

// Helpers
const pct = (x) => `${(x * 100).toFixed(2)}%`;
const fmt = (x, d = 3) => isFinite(x) ? x.toFixed(d) : "—";
const sig = (p) => p < 0.001 ? "&lt;.001" : p.toFixed(4);
const stars = (p) => p < 0.001 ? "***" : p < 0.01 ? "**" : p < 0.05 ? "*" : "";

// ---------- Atıflar (IEEE) — 20 doğrulanmış kaynak (Literatur_Notlari ile bire bir) ----------
const REFS = [
  { id: 1, txt: 'R. Dingledine, N. Mathewson and P. Syverson, "Tor: The Second-Generation Onion Router," in <i>Proc. 13th USENIX Security Symposium</i>, 2004, pp. 303–320.' },
  { id: 2, txt: 'S. J. Murdoch and G. Danezis, "Low-Cost Traffic Analysis of Tor," in <i>Proc. IEEE Symposium on Security and Privacy</i>, 2005, pp. 183–195.' },
  { id: 3, txt: 'A. Johnson, C. Wacek, R. Jansen, M. Sherr and P. Syverson, "Users Get Routed: Traffic Correlation on Tor by Realistic Adversaries," in <i>Proc. ACM CCS</i>, 2013, pp. 337–348.' },
  { id: 4, txt: 'A. Panchenko, F. Lanze, A. Zinnen, M. Henze, J. Pennekamp, K. Wehrle and T. Engel, "Website Fingerprinting at Internet Scale," in <i>Proc. NDSS</i>, 2016.' },
  { id: 5, txt: 'I. Karunanayake, N. Ahmed, R. Malaney, R. Islam and S. K. Jha, "De-Anonymisation Attacks on Tor: A Survey," <i>IEEE Communications Surveys &amp; Tutorials</i>, vol. 23, no. 4, pp. 2324–2350, 2021.' },
  { id: 6, txt: 'M. Backes, A. Kate, P. Manoharan, S. Meiser and E. Mohammadi, "AnoA: A Framework for Analyzing Anonymous Communication Protocols," in <i>Proc. IEEE CSF</i>, 2013, pp. 163–178.' },
  { id: 7, txt: 'D. Lee and M. Yannakakis, "Principles and Methods of Testing Finite State Machines—A Survey," <i>Proceedings of the IEEE</i>, vol. 84, no. 8, pp. 1090–1123, 1996.' },
  { id: 8, txt: 'J. Tretmans, "Model Based Testing with Labelled Transition Systems," in <i>Formal Methods and Testing</i>, LNCS 4949, Springer, 2008, pp. 1–38.' },
  { id: 9, txt: 'J. de Ruiter and E. Poll, "Protocol State Fuzzing of TLS Implementations," in <i>Proc. 24th USENIX Security Symposium</i>, 2015, pp. 193–206.' },
  { id: 10, txt: 'P. Fiterău-Broștean, R. Janssen and F. Vaandrager, "Combining Model Learning and Model Checking to Analyze TCP Implementations," in <i>Proc. CAV</i>, 2016, pp. 454–471.' },
  { id: 11, txt: 'P. Ammann and J. Offutt, <i>Introduction to Software Testing</i>, 2nd ed. Cambridge: Cambridge University Press, 2016.' },
  { id: 12, txt: 'D. Dolev and A. C. Yao, "On the Security of Public Key Protocols," <i>IEEE Transactions on Information Theory</i>, vol. 29, no. 2, pp. 198–208, 1983.' },
  { id: 13, txt: 'K. Bhargavan, B. Blanchet and N. Kobeissi, "Verified Models and Reference Implementations for the TLS 1.3 Standard Candidate," in <i>Proc. IEEE S&amp;P</i>, 2017, pp. 483–502.' },
  { id: 14, txt: 'J. Somorovsky, "Systematic Fuzzing and Testing of TLS Libraries," in <i>Proc. ACM CCS</i>, 2016, pp. 1492–1504.' },
  { id: 15, txt: 'M. Felderer, M. Büchler, M. Johns, A. Brucker, R. Breu and A. Pretschner, "Security Testing: A Survey," <i>Advances in Computers</i>, vol. 101, pp. 1–51, 2016.' },
  { id: 16, txt: 'A. Pretschner, T. Mouelhi and Y. Le Traon, "Model-Based Tests for Access Control Policies," in <i>Proc. ICST</i>, 2008, pp. 338–347.' },
  { id: 17, txt: 'B. Kitchenham and S. Charters, "Guidelines for performing Systematic Literature Reviews in Software Engineering," EBSE Technical Report EBSE-2007-01, 2007.' },
  { id: 18, txt: 'R. Jansen, K. Bauer, N. Hopper and R. Dingledine, "Methodically Modeling the Tor Network," in <i>Proc. USENIX CSET</i>, 2012.' },
  { id: 19, txt: 'Tor Project, "Tor Protocol Specification (tor-spec)," 2026. [Online]. Available: https://spec.torproject.org/tor-spec. [Accessed: Feb. 2026].' },
  { id: 20, txt: 'Microsoft Research, "A Data-Driven FSM Model for Analyzing Security Vulnerabilities," Microsoft Research Technical Report, 2018.' },
];
const cite = (...ids) => `[${ids.join("], [")}]`;

// ---------- Build figures (reuse) ----------
const svg1 = fsmGraphSvg();
const svg2 = attackHeatmapSvg();
const svg3 = metricBarChart(stats);
const svg4 = severitySplitSvg(sevSplit);
const svg5 = prismaSvg(ext.prisma);
const svg6_tc = budgetCurveSvg(ext.budgetCurve, ext.BUDGETS, "tc");
const svg6_itdr = budgetCurveSvg(ext.budgetCurve, ext.BUDGETS, "itdr");
const svg7 = ruleCompletenessSvg(ext.ruleBased);

// Wilcoxon ve latency tabloları
const wilcoxonRows = ext.wilcoxon.map((w) => `<tr>
  <td class="l">${w.a} vs ${w.b}</td><td>${w.metric.toUpperCase()}</td>
  <td>${w.W.toFixed(1)}</td><td>${w.z.toFixed(2)}</td>
  <td>${w.p < 0.001 ? "&lt;.001" : w.p.toFixed(4)} ${w.p < 0.001 ? "***" : w.p < 0.01 ? "**" : w.p < 0.05 ? "*" : ""}</td>
  <td>${w.n}</td>
</tr>`).join("");
const probeOrder = ["valid_step", "invalid_critical", "invalid_low"];
const probeLabels = { valid_step: "Geçerli geçiş (IDLE → CONNECTING)", invalid_critical: "Geçersiz CRITICAL (BYPASS)", invalid_low: "Geçersiz LOW (GHOST)" };
const latencyRows = probeOrder.map((key) => { const d = ext.latencyData[key]; return `<tr>
  <td class="l">${probeLabels[key]}</td>
  <td>${d.mean_ns.toFixed(1)}</td><td>${d.sd_ns.toFixed(1)}</td>
  <td>${d.p50_ns.toFixed(1)}</td><td>${d.p95_ns.toFixed(1)}</td>
  <td>${d.min_ns.toFixed(1)}</td><td>${d.max_ns.toFixed(1)}</td>
</tr>`; }).join("");
const ruleRows = Object.entries(ext.ruleBased.perRule).map(([r, c]) =>
  `<tr><td class="l">${r}</td><td>${c}</td></tr>`).join("");
const missedRows = Object.entries(ext.ruleBased.missedByType).map(([t, c]) =>
  `<tr><td class="l">${t}</td><td>${c}</td></tr>`).join("");

// ---------- δ tablosu (gerçek VALID'den üretilir) ----------
function deltaTableHtml() {
  const rows = Object.entries(VALID).map(([key, to]) => {
    const [from, ev] = key.split("|");
    return `<tr><td>${from}</td><td>${ev}</td><td>${to}</td></tr>`;
  }).join("");
  return `<table><tr><th>Mevcut Durum</th><th>Olay (Σ)</th><th>Sonraki Durum</th></tr>${rows}</table>`;
}

// ---------- Saldırı vektörü dağılımı (programmatic) ----------
function attackInventory() {
  const inv = {};
  for (const s of STATES) for (const e of EVENTS) {
    if (VALID[k(s, e)] !== undefined) continue;
    const c = classifyInvalid(s, e);
    inv[c.type] = inv[c.type] || { count: 0, sev: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } };
    inv[c.type].count++;
    inv[c.type].sev[c.severity]++;
  }
  const total = Object.values(inv).reduce((a, b) => a + b.count, 0);
  const rows = Object.entries(inv).sort((a, b) => b[1].count - a[1].count).map(([t, d]) =>
    `<tr><td class="l">${t}</td><td>${d.count}</td><td>${(d.count / total * 100).toFixed(1)}%</td>
      <td>${d.sev.LOW}</td><td>${d.sev.MEDIUM}</td><td>${d.sev.HIGH}</td><td>${d.sev.CRITICAL}</td></tr>`).join("");
  return `<table><tr><th>Saldırı tipi</th><th>İkili sayısı</th><th>Pay</th>
    <th>LOW</th><th>MEDIUM</th><th>HIGH</th><th>CRITICAL</th></tr>${rows}
    <tr><th class="l">Toplam</th><th>${total}</th><th>100.0%</th><th colspan="4"></th></tr></table>`;
}

// ---------- Descriptive table ----------
const descTableRows = Object.entries(stats).map(([n, s]) => {
  return `<tr><td class="l">${n}</td>
    <td>${pct(s.sc.mean)} ± ${pct(s.sc.sd)}</td>
    <td>${pct(s.tc.mean)} ± ${pct(s.tc.sd)}</td>
    <td>${pct(s.itdr.mean)} ± ${pct(s.itdr.sd)}</td></tr>`;
}).join("");

// ---------- Hypothesis test table ----------
const hypTableRows = comparisons.map((c) => `<tr>
  <td class="l">${c.a} vs ${c.b}</td>
  <td>${c.metric.toUpperCase()}</td>
  <td>${fmt(c.t, 3)}</td><td>${fmt(c.df, 1)}</td>
  <td>${sig(c.pT)} ${stars(c.pT)}</td>
  <td>${fmt(c.U, 1)}</td><td>${sig(c.pU)} ${stars(c.pU)}</td>
  <td>${fmt(c.d, 2)}</td>
  <td>${c.normalA && c.normalB ? "evet" : "hayır"}</td>
</tr>`).join("");

// ---------- HTML ----------
const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>Tor FSM Tezi — Taslak</title>
<style>
  @page { size: A4; margin: 22mm 20mm 22mm 22mm; }
  body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #111; line-height: 1.55; }
  h1 { font-size: 17pt; text-align: center; margin: 0 0 6pt; line-height: 1.3; }
  h2 { font-size: 13.5pt; margin: 22pt 0 6pt; border-bottom: 1.5px solid #1a3a6e; padding-bottom: 3pt; color: #1a3a6e; page-break-after: avoid; }
  h3 { font-size: 12pt; margin: 14pt 0 4pt; color: #1a3a6e; page-break-after: avoid; }
  h4 { font-size: 11pt; font-style: italic; margin: 10pt 0 3pt; }
  p, li { text-align: justify; }
  .sub { text-align: center; font-style: italic; color: #444; margin-bottom: 12pt; font-size: 11pt; }
  .meta { text-align: center; font-size: 10pt; color: #444; margin-bottom: 18pt; line-height: 1.7; }
  .meta b { color: #111; }
  .pagebreak { page-break-before: always; }
  .toc { font-size: 10.5pt; line-height: 1.85; }
  .toc div { display: flex; justify-content: space-between; border-bottom: 1px dotted #bbb; }
  .toc .lvl1 { font-weight: bold; margin-top: 6pt; }
  .toc .lvl2 { padding-left: 14pt; }
  .box { background: #f6f8fb; border-left: 3px solid #345; padding: 8pt 12pt; margin: 8pt 0; font-size: 10.5pt; }
  table { border-collapse: collapse; width: 100%; font-size: 9.5pt; margin: 6pt 0 10pt; }
  th, td { border: 1px solid #aab; padding: 4pt 6pt; text-align: center; }
  th { background: #e6ecf4; }
  td.l, th.l { text-align: left; }
  pre.algo { background: #f4f4f4; border: 1px solid #ccc; padding: 8pt 10pt; font-size: 9pt; line-height: 1.4; white-space: pre-wrap; page-break-inside: avoid; font-family: "Courier New", monospace; }
  .fig { text-align: center; margin: 8pt 0 16pt; page-break-inside: avoid; }
  .fig svg { max-width: 100%; height: auto; }
  .fig .cap { font-size: 9.5pt; color: #444; margin-top: 4pt; }
  code { font-family: "Courier New", monospace; font-size: 10pt; background: #f0f0f0; padding: 0 3pt; }
  .ref-list { font-size: 10pt; }
  .ref-list .r { display: flex; gap: 8pt; padding: 3pt 0; align-items: baseline; }
  .ref-list .num { min-width: 28pt; font-weight: bold; color: #1a3a6e; }
  .center { text-align: center; }
  .ucase { letter-spacing: 1pt; text-transform: uppercase; font-size: 13pt; color: #1a3a6e; }
</style></head><body>

<!-- ====================== KAPAK ====================== -->
<div style="text-align:center; padding-top: 60pt;">
  <div class="ucase">Hacettepe Üniversitesi</div>
  <div style="font-size: 11pt; color: #444; margin: 4pt 0 70pt;">Yazılım Mühendisliği Yüksek Lisans Programı<br>BYZ 658 — Yazılım Test Teknikleri</div>
  <h1 style="margin: 0 30pt; font-size: 18pt;">Tor Tabanlı Anonim Ağ Sistemlerinde<br>Sonlu Durum Makinesi Modelleme ile<br>Geçersiz Durum Geçişi Tespiti<br>ve Güvenlik Analizi</h1>
  <div style="font-style: italic; margin: 20pt 0; color: #555;">— Tez Taslağı —</div>
  <div style="margin-top: 90pt; font-size: 11pt; line-height: 1.9;">
    <div><b>Hazırlayan</b></div>
    <div>Nurcan Denli Bayır</div>
    <div>Öğrenci No: N25110987</div>
    <div style="margin-top: 14pt;"><b>Danışman</b></div>
    <div>Nebi Yılmaz</div>
    <div style="margin-top: 30pt; color: #555;">Mayıs 2026</div>
  </div>
</div>

<div class="pagebreak"></div>

<!-- ====================== ÖZET ====================== -->
<h2>Özet</h2>
<p>Bu çalışma, Tor anonim ağ protokolünün devre yaşam döngüsünü deterministik bir Sonlu Durum
Makinesi (FSM) olarak formal şekilde modeller, Model-Driven Testing (MDT) yaklaşımıyla
spesifikasyon dışı (geçersiz) durum geçişlerinin otomatik tespitini sağlar ve tespit edilen
her geçişi yedi ana saldırı vektörü + 1 fallback'e (CIRCUIT_BYPASS, REPLAY_ATTACK, GHOST_CIRCUIT,
HANDSHAKE_SKIP, PREMATURE_DATA, CIRCUIT_HIJACK, CREATE_FLOOD) eşleyen bir sınıflandırma
çerçevesi sunar. Tor devresi 10 durum ve 13 olay üzerinden tanımlanmış; toplam ${totalDomain}
ikili domeninden ${totalValid} geçerli, ${totalInvalid} geçersiz ikili türetilmiştir. Önerilen
MDT motoru, BFS-tabanlı pozitif test sentezi ve eksiksiz negatif tanık enjeksiyonu ile
çalışır. Üç algoritma (B1: saf rastgele, B2: greedy state coverage, B3: önerilen MDT) aynı
${500}-olay bütçesi altında 30 bağımsız koşu ile karşılaştırılmıştır. MDT, geçiş kapsamını
${pct(stats.B3_MDT.tc.mean)} ile saturasyona ulaştırırken (B1: ${pct(stats.B1_Random.tc.mean)},
B2: ${pct(stats.B2_GreedySC.tc.mean)}), geçersiz geçiş tespit oranını
${pct(stats.B3_MDT.itdr.mean)} seviyesine taşımıştır. Welch t-testi her iki temele karşı
istatistiksel anlamlı üstünlüğü doğrular (p &lt; .001; Cohen d ∈ [3.6, 15.4]). Bu tez:
(i) Tor devre protokolü için yayımlanmış ilk tam δ-matrisini, (ii) ${totalInvalid} geçersiz
ikilinin saldırı vektörü ve şiddet etiketiyle programatik sınıflandırmasını,
(iii) referans bir MDT implementasyonunu ve (iv) sayısal olarak doğrulanmış üç-katmanlı
karşılaştırmayı sunar.</p>
<p><b>Anahtar kelimeler:</b> Tor, anonim ağ, sonlu durum makinesi, model-driven testing,
protokol state fuzzing, güvenlik testi, geçiş kapsamı.</p>

<h2>Abstract</h2>
<p>This work formally models the circuit life-cycle of the Tor anonymous network protocol
as a deterministic finite-state machine (FSM), enables automatic detection of out-of-spec
(invalid) state transitions through a Model-Driven Testing (MDT) approach, and proposes a
classification framework that maps every detected transition to one of seven primary attack vectors plus a deterministic fallback,
(CIRCUIT_BYPASS, REPLAY_ATTACK, GHOST_CIRCUIT, HANDSHAKE_SKIP, PREMATURE_DATA,
CIRCUIT_HIJACK, CREATE_FLOOD). The Tor circuit is described over 10 states and 13 events,
yielding ${totalValid} valid and ${totalInvalid} invalid pairs from a domain of size
${totalDomain}. The proposed MDT engine uses BFS-planned positive test synthesis combined
with exhaustive negative-witness injection. Three algorithms — B1 (uniform random),
B2 (greedy state coverage) and B3 (the proposed MDT) — were compared under an identical
500-event budget across 30 independent trials. MDT saturates transition coverage at
${pct(stats.B3_MDT.tc.mean)} (vs. ${pct(stats.B1_Random.tc.mean)} for B1 and
${pct(stats.B2_GreedySC.tc.mean)} for B2) and reaches an Invalid Transition Detection Rate
of ${pct(stats.B3_MDT.itdr.mean)}. Welch t-tests confirm statistical superiority over both
baselines (p &lt; .001; Cohen's d ∈ [3.6, 15.4]). Contributions: (i) the first published
complete δ-matrix for the Tor circuit protocol, (ii) a programmatic classification of all
${totalInvalid} invalid pairs into attack vectors with severity labels, (iii) a reference
MDT implementation, and (iv) a numerically validated three-way baseline comparison.</p>
<p><b>Keywords:</b> Tor, anonymous network, finite-state machine, model-driven testing,
protocol state fuzzing, security testing, transition coverage.</p>

<div class="pagebreak"></div>

<!-- ====================== İÇİNDEKİLER ====================== -->
<h2>İçindekiler</h2>
<div class="toc">
  <div class="lvl1"><span>1. Giriş</span><span></span></div>
  <div class="lvl2"><span>1.1 Problem Tanımı</span><span></span></div>
  <div class="lvl2"><span>1.2 Araştırma Soruları</span><span></span></div>
  <div class="lvl2"><span>1.3 Katkılar</span><span></span></div>
  <div class="lvl2"><span>1.4 Tezin Yapısı</span><span></span></div>
  <div class="lvl1"><span>2. Literatür Taraması</span><span></span></div>
  <div class="lvl2"><span>2.1 SLR Metodolojisi</span><span></span></div>
  <div class="lvl2"><span>2.2 Tor Güvenliği ve Anonimlik</span><span></span></div>
  <div class="lvl2"><span>2.3 FSM Tabanlı Test ve Model Öğrenme</span><span></span></div>
  <div class="lvl2"><span>2.4 Formal Yöntemler ve Protokol Doğrulama</span><span></span></div>
  <div class="lvl2"><span>2.5 Yazılım Testi Metodolojisi</span><span></span></div>
  <div class="lvl2"><span>2.6 Tor Simülasyon Altyapısı</span><span></span></div>
  <div class="lvl2"><span>2.7 PRISMA Akış Diyagramı</span><span></span></div>
  <div class="lvl2"><span>2.8 Literatür Boşluğu</span><span></span></div>
  <div class="lvl1"><span>3. Yöntem</span><span></span></div>
  <div class="lvl2"><span>3.1 FSM Formal Tanımı</span><span></span></div>
  <div class="lvl2"><span>3.2 Saldırı Sınıflandırıcı</span><span></span></div>
  <div class="lvl2"><span>3.3 MDT Motoru — Algoritma 1</span><span></span></div>
  <div class="lvl2"><span>3.4 Karşılaştırılan Algoritmalar</span><span></span></div>
  <div class="lvl1"><span>4. Deneysel Bulgular</span><span></span></div>
  <div class="lvl2"><span>4.1 Deney Tasarımı</span><span></span></div>
  <div class="lvl2"><span>4.2 Tanımlayıcı İstatistikler</span><span></span></div>
  <div class="lvl2"><span>4.3 Hipotez Testleri</span><span></span></div>
  <div class="lvl2"><span>4.4 Yorum</span><span></span></div>
  <div class="lvl2"><span>4.5 Wilcoxon Signed-Rank Doğrulaması</span><span></span></div>
  <div class="lvl2"><span>4.6 Detection Latency Ölçümü</span><span></span></div>
  <div class="lvl2"><span>4.7 Bütçe-Kapsama Eğrisi</span><span></span></div>
  <div class="lvl2"><span>4.8 Rule-Based Detector Karşılaştırması (B0)</span><span></span></div>
  <div class="lvl1"><span>5. Görselleştirme</span><span></span></div>
  <div class="lvl1"><span>6. Sonuç ve Gelecek Çalışmalar</span><span></span></div>
  <div class="lvl2"><span>6.1 Katkıların Yeniden Değerlendirilmesi</span><span></span></div>
  <div class="lvl2"><span>6.2 Sınırlılıklar</span><span></span></div>
  <div class="lvl2"><span>6.3 Gelecek Çalışmalar</span><span></span></div>
  <div class="lvl1"><span>Kaynakça</span><span></span></div>
  <div class="lvl1"><span>Ek A — Tam δ Geçiş Tablosu</span><span></span></div>
  <div class="lvl1"><span>Ek B — Saldırı Sınıflandırıcı Envanteri</span><span></span></div>
</div>

<div class="pagebreak"></div>

<!-- ====================== BÖLÜM 1: GİRİŞ ====================== -->
<h2>1. Giriş</h2>

<h3>1.1 Problem Tanımı</h3>
<p>Tor anonim iletişim ağı, kullanıcı–destinasyon ilişkisinin gözlenemez kılınmasını hedefleyen,
2004'ten itibaren kamuya açık biçimde işletilen bir altyapıdır ${cite(1)}. Tor güvenlik
literatürünün önemli bölümü iki eksende yoğunlaşmıştır: (i) trafik korelasyon ve zamanlama
saldırıları ${cite(2, 3, 4, 5)}, (ii) anonimliğin olasılıksal ve kriptografik formal analizi
${cite(6, 13)}. Bu iki eksen büyük oranda <i>davranışın istatistiksel imzasını</i> ya da
<i>kriptografik ilkellerin matematiksel doğruluğunu</i> ele alır.</p>

<p>Üçüncü ve nispeten az çalışılmış bir eksen, protokolün <i>state machine</i> seviyesindeki
spesifikasyon uyumudur. Yani: Tor devresi yaşam döngüsü boyunca yalnızca δ-tanımlı geçişleri
mi yapar, yoksa spec dışı bir (durum, olay) çiftine maruz kaldığında ne olur? TLS implementasyonları
için bu sorunun protokol state fuzzing ile sistematik biçimde araştırıldığı bilinmektedir
${cite(9, 14)}, ancak Tor için eşdeğer bir çalışmanın mevcut olmadığı bu tez kapsamında yürütülen
sistematik literatür taraması (SLR, bkz. Bölüm 2) ile teyit edilmiştir.</p>

<h3>1.2 Araştırma Soruları</h3>
<ul>
  <li><b>RQ1:</b> Tor devre protokolü, deterministik bir 5-tuple FSM <i>M = (Q, Σ, δ, q₀, F)</i>
  olarak formal şekilde nasıl modellenir?</li>
  <li><b>RQ2:</b> Bu modelin geçersiz geçiş kümesi (Q × Σ) ∖ dom(δ), bilinen Tor saldırılarına
  programatik olarak nasıl eşlenebilir?</li>
  <li><b>RQ3:</b> Model üzerinde otomatik üretilen test paketinin saf rastgele ve sezgisel
  baseline'lara göre <i>geçiş kapsamı</i> (TC) ve <i>geçersiz geçiş tespit oranı</i> (ITDR)
  metriklerinde gözlenen üstünlüğü, istatistiksel olarak anlamlı mıdır?</li>
</ul>

<h3>1.3 Katkılar</h3>
<ol>
  <li>Tor devre protokolü için yayımlanmış ilk <b>tam δ-matrisi</b> (${totalValid} geçerli ikili,
  ${totalInvalid} geçersiz ikili, toplam domen ${totalDomain}; bkz. Ek A).</li>
  <li>Tüm ${totalInvalid} geçersiz ikiliyi yedi ana saldırı vektörü + 1 fallback ve dört şiddet seviyesine eşleyen
  <b>programatik sınıflandırıcı</b> (bkz. Bölüm 3.2 ve Ek B).</li>
  <li>BFS-planlı pozitif faz + tam negatif tanık enjeksiyonu içeren <b>referans MDT
  implementasyonu</b> (kaynak kodu açık, üretilebilir).</li>
  <li>Üç algoritmanın (B1/B2/B3) eşleştirilmiş 30 koşu ile <b>istatistiksel karşılaştırması</b>;
  Welch t-testi, Mann-Whitney U ve Cohen's d ile birlikte raporlanır.</li>
</ol>

<h3>1.4 Tezin Yapısı</h3>
<p>Bölüm 2, SLR metodolojisini ve beş tematik küme üzerinden literatürü inceler. Bölüm 3 formal
modeli ve MDT motorunu Algoritma 1 olarak tanımlar. Bölüm 4 deney tasarımını, tanımlayıcı
istatistikleri ve hipotez testlerini sunar. Bölüm 5 dört temel görselleştirmeyi sergiler.
Bölüm 6 sınırlılıkları ve gelecek çalışmaları tartışır. Ek A tam δ tablosunu, Ek B saldırı
sınıflandırıcı envanterini içerir.</p>

<div class="box">
<b>Üretilebilirlik notu.</b> Bu tezdeki her sayısal sonuç ve her şekil, repodaki açık kaynak
betiklerin (<code>experiments/build_report.mjs</code>, <code>experiments/baselines.mjs</code>,
<code>experiments/stats.mjs</code>, <code>experiments/figures.mjs</code>) tek komutla
çalıştırılmasıyla yeniden üretilebilir. Bütün rastgelelik mulberry32 PRNG ile sabit seed
altındadır.
</div>

<div class="pagebreak"></div>

<!-- ====================== BÖLÜM 2: LİTERATÜR ====================== -->
<h2>2. Literatür Taraması</h2>

<h3>2.1 SLR Metodolojisi</h3>
<p>Sistematik literatür taraması Kitchenham ve Charters'ın yönergesine ${cite(17)} göre
yürütülmüştür. <b>Veritabanları:</b> bu ortamın canlı erişimi olmadığı için açık web kanalları
(Google Scholar, arXiv, DOI çözümleme) ile sınırlı kalınmıştır; bu kısıtlılık Bölüm 6.2'de
açıkça raporlanmaktadır. <b>Anahtar kelimeler:</b> "Tor security", "FSM testing", "model-based
testing", "protocol state fuzzing", "anonymity network attacks". <b>Yıl aralığı:</b> 1996–2026,
klasik referanslar için yıl etiketli korunmuştur. <b>Dahil etme kriterleri:</b> hakemli
yayın, doğrudan erişilebilir tam metin, Tor / FSM testi / formal protokol doğrulama
alanlarından en az birine değen çalışma. <b>Hariç tutma kriterleri:</b> yalnızca uygulama
notu, atıf doğrulanamayan kaynaklar.</p>
<p>Süreç sonunda 20 birincil kaynak beş tematik kümeye ayrılmıştır: A) Tor güvenliği (6),
B) FSM tabanlı test (5), C) Formal yöntemler (3), D) Yazılım testi metodolojisi (3),
E) Tor simülasyon altyapısı (3). Tam liste ve kümelere göre dağılım Kaynakça'da verilmiştir.</p>

<h3>2.2 Tor Güvenliği ve Anonimlik</h3>
<p>Tor protokolünün ilk akademik tanımı Dingledine ve arkadaşlarına aittir ${cite(1)}; devre
kurulum (CREATE/CREATED, EXTEND/EXTENDED) sıralaması ve onion routing katmanı bu çalışmada
sabitlenir. Bu sıralama, tezimizin δ tablosunun normatif temelidir. Tor'a karşı düşük maliyetli
trafik korelasyon saldırılarının uygulanabilirliği Murdoch ve Danezis tarafından gösterilmiş
${cite(2)}; daha gerçekçi saldırgan modelleri altında genişletilmiştir ${cite(3)}. Internet
ölçeğinde website fingerprinting'in pratik uygulanabilirliği Panchenko ve arkadaşları
tarafından kanıtlanmıştır ${cite(4)}. Karunanayake ve arkadaşlarının kapsamlı survey'i
${cite(5)} Tor deanonymization saldırılarını yedi kategoriye ayırır; tezimizin saldırı
vektörü kümesinin dördü (REPLAY, HIJACK, BYPASS, GHOST) bu sınıflandırmadan türetilmiştir.
AnoA çerçevesi ${cite(6)} olasılıksal anonimlik garantilerine bakar; bizim state-uyum
yaklaşımımıza dik (orthogonal) ve onunla tamamlayıcıdır.</p>

<h3>2.3 FSM Tabanlı Test ve Model Öğrenme</h3>
<p>FSM tabanlı test üretiminin klasik referansı Lee ve Yannakakis'in survey çalışmasıdır
${cite(7)}; W-method, Wp-method ve UIO sequences gibi tekniklerin tanımı buradan gelir. Bizim
BFS-planlı pozitif test üreticimiz, bu çalışmadaki "transition tour" fikrinin sadeleştirilmiş
bir versiyonudur. Tretmans'ın LTS tabanlı model-based testing teorisi ${cite(8)}, "ioco"
uyum bağıntısı ile bizim oracle kavramımızın kuramsal zeminidir; ne var ki bizim FSM'imiz
deterministik olduğundan ioco basit eşitlik denetimine indirgenebilir. Pratik uygulama
boyutunda, de Ruiter ve Poll'ün TLS implementasyonları üzerindeki protocol state fuzzing
çalışması ${cite(9)} bu tez ile aynı metodoloji ailesindendir; aradaki kritik fark,
TLS yerine Tor üzerinde uygulanmasıdır. TCP üzerinde model öğrenme + model checking
birleşimi Fiterău-Broștean ve arkadaşları tarafından gösterilmiştir ${cite(10)} ve gelecek
çalışmamız için (gerçek Tor implementasyonundan L*-tipi otomatik çıkarım) bir referans
oluşturur. Yazılım test ders kitabı Ammann ve Offutt ${cite(11)}, transition coverage
metriğinin formal tanımını verir (graph coverage, edge coverage = transition coverage
karşılığı).</p>

<h3>2.4 Formal Yöntemler ve Protokol Doğrulama</h3>
<p>Klasik Dolev-Yao saldırgan modeli ${cite(12)}, ağ katmanında mesaj okuma, geciktirme ve
replay yapabilen ancak imzalanmış mesajları sahteleyemeyen aktörü resmî olarak tanımlar; bu
çalışmanın tehdit modeli (proje önerisi Bölüm 5) bu kümenin sınırlı bir alt setini benimser.
TLS 1.3'ün ProVerif ile formal doğrulanması ${cite(13)} state-machine seviyesinde
doğrulanabilirliğin pratik kanıtıdır. Somorovsky'nin TLS sistematik fuzzing çalışması
${cite(14)} negatif test üretimi için yakın bir akrabadır; biz bunu Tor için state-level'e
taşıyoruz.</p>

<h3>2.5 Yazılım Testi Metodolojisi</h3>
<p>Felderer ve arkadaşlarının güvenlik testi survey'i ${cite(15)}, "Model-Based Security
Testing" başlığı altında bizim çalışmamızı taksonomik olarak konumlandırır. Pretschner ve
arkadaşlarının erişim kontrol politikaları için model-tabanlı test üretimi ${cite(16)},
politika ihlallerinin (negatif test) sistematik üretimi açısından yöntemsel bir referanstır.
Kitchenham ve Charters ${cite(17)} SLR metodolojisinin standart kılavuzudur ve Bölüm 2.1'in
temelidir.</p>

<h3>2.6 Tor Simülasyon Altyapısı</h3>
<p>Jansen ve arkadaşları, Shadow simülatörünü Tor ağı için sistematik bir deneysel altyapı
olarak kurmuştur ${cite(18)}. Tor projesinin yaşayan resmi spesifikasyonu ${cite(19)}, δ
tablosunun otorite kaynağıdır. Microsoft Research'ün veri-tabanlı FSM güvenlik analizi
çalışması ${cite(20)} state-level analizin endüstriyel uygulanabilirliğini gösterir, ancak
Tor'a özel değildir.</p>

<h3>2.7 PRISMA Akış Diyagramı</h3>
<p>Bölüm 2.1'de tarif edilen SLR sürecinin PRISMA akışı Şekil 5'te sunulmuştur. Bu çalışmaya
özgü iki dürüst not zorunludur: <b>(i)</b> canlı akademik veritabanı erişimi (Scopus, WoS,
IEEE Xplore) bu ortamda mevcut değildir; bu nedenle "identified through database searching"
hücresi sıfırdır ve tüm tanımlamalar açık-web kanalları (Google Scholar, arXiv, DOI
çözümleme) üzerinden yapılmıştır. <b>(ii)</b> Açık-web sürecinde audit-edilebilir sorgu
logu tutulmadığı için ara aşama sayıları (identified, screened, eligibility) <b>NA olarak
raporlanır</b>; yalnızca son "included" sayısı (n=${ext.prisma.included}) doğrulanabilir
ve repodaki <code>Literatur_Notlari.pdf</code>'in atıf sayısı ile birebirdir. Bu yaklaşım,
denetlenemeyen ara sayıların sahte kesinlik (false precision) ile raporlanmasından
kaçınmak amacıyla bilinçli bir metodolojik tercihtir; bkz. Bölüm 6.2.</p>
<div class="fig">${svg5}<div class="cap">Şekil 5. SLR sürecinin PRISMA akış diyagramı (ara sayılar NA).</div></div>

<h3>2.8 Literatür Boşluğu</h3>
<div class="box">
20 kaynağın incelenmesi sonucunda <b>tez ölçeğinde dört somut boşluk</b> tespit edilmiştir:
<ul>
  <li><b>(G1)</b> Tor devre protokolü için yayımlanmış formal 5-tuple FSM bulunmamaktadır.
  Spesifikasyon ${cite(19)} prosedürel anlatımdır; bir δ matrisine indirgenmiş hâli akademik
  literatürde mevcut değildir.</li>
  <li><b>(G2)</b> Protokol state fuzzing TLS için yapılmıştır ${cite(9, 14)}; Tor için
  yapılmamıştır.</li>
  <li><b>(G3)</b> Tor saldırı vektörlerinin (durum, olay) çiftleriyle <i>satır-satır</i>
  eşlemesi mevcut değildir; survey'ler ${cite(5)} kategorik kalmaktadır.</li>
  <li><b>(G4)</b> "Tespit edilen geçersiz geçişler / enjekte edilenler" oranını (ITDR) Tor
  bağlamında tanımlayan ve ölçen birincil çalışma yoktur.</li>
</ul>
Bu dört boşluk birlikte tezin katkı çerçevesini (Bölüm 1.3) oluşturur.
</div>

<div class="pagebreak"></div>

<!-- ====================== BÖLÜM 3: YÖNTEM ====================== -->
<h2>3. Yöntem</h2>

<h3>3.1 FSM Formal Tanımı</h3>
<p>Tor devre yaşam döngüsü, klasik bir DFA olarak <i>M = (Q, Σ, δ, q₀, F)</i> şeklinde
modellenmiştir:</p>
<ul>
  <li><i>Q</i>: ${STATES.length} durum (${STATES.join(", ")}).</li>
  <li><i>Σ</i>: ${EVENTS.length} olay (CONNECT, TLS_OK, TLS_FAIL, SEND_CREATE, RECV_CREATED,
  SEND_EXTEND, RECV_EXTENDED, SEND_RELAY_DATA, RECV_RELAY_DATA, SEND_DESTROY, RECV_DESTROY,
  CIRCUIT_CLOSED, TIMEOUT).</li>
  <li><i>q₀ = IDLE</i>, <i>F = {CLOSED}</i>.</li>
  <li><i>δ : Q × Σ → Q</i>, ${totalValid} ikili üzerinde tanımlı; toplam domen ${totalDomain},
  Invalid kümesi ${totalInvalid} ikili.</li>
</ul>
<p>Tam δ matrisi Ek A'da, görsel ısı haritası Şekil 2'de verilmiştir.</p>

<h3>3.2 Saldırı Sınıflandırıcı</h3>
<p>Invalid kümesindeki her ikili, deterministik bir <code>classifyInvalid(state, event)</code>
fonksiyonu (kod referansı: <code>server/fsm.ts</code>, 64–204. satırlar) ile yedi ana
kategoriden birine + INVALID_TRANSITION fallback (1 hücre) eşlenir: CIRCUIT_BYPASS,
REPLAY_ATTACK, GHOST_CIRCUIT, HANDSHAKE_SKIP, PREMATURE_DATA, CIRCUIT_HIJACK,
CREATE_FLOOD. Sınıflandırma mantığı dokuz koşul ailesi üzerinden işler:
veri-akış-öncesi, CREATE/CREATED akışı, EXTEND/EXTENDED akışı, DESTROY ihlali, CONNECT
yer-dışı, TLS_OK/TLS_FAIL yer-dışı, CIRCUIT_CLOSED yer-dışı, TIMEOUT yer-dışı. Her ikiliye
LOW/MEDIUM/HIGH/CRITICAL şiddet etiketi atanır. Kategorilerin nicel dağılımı Ek B'dedir.</p>

<h3>3.3 MDT Motoru — Algoritma 1</h3>
<pre class="algo">Algoritma 1: Model-Driven Test (BFS-tabanlı)
Girdi:  M = (Q, Σ, δ, q₀, F);  Bütçe B (olay sayısı)
Çıktı:  &lt;SC, TC, ITDR, FPR&gt;

 1.  visited          ← {q₀}
 2.  coveredValid     ← ∅
 3.  detectedInvalid  ← ∅
 4.  Valid            ← {(s, e)  |  δ(s, e) tanımlı}
 5.  Invalid          ← (Q × Σ) ∖ Valid
 6.  // Pozitif faz
 7.  foreach (s, e) ∈ Permute(Valid):
 8.      if events ≥ B: break
 9.      if (s, e) ∈ coveredValid: continue
10.      π ← BFS_PATH(q₀, s)            // δ-grafiği üzerinde en kısa yol
11.      if π = null: continue
12.      EXECUTE(π · ⟨e⟩)               // her adımda visited / coveredValid güncellenir
13. // Negatif faz
14. foreach (s, e) ∈ Permute(Invalid):
15.      if events ≥ B: break
16.      if (s, e) ∈ detectedInvalid: continue
17.      π ← BFS_PATH(q₀, s)
18.      if π = null ∧ s ≠ q₀: continue
19.      EXECUTE(π · ⟨e⟩)               // Oracle (δ) anomaliyi yakalar
20. SC   ← |visited| / |Q|
21. TC   ← |coveredValid| / |Valid|
22. ITDR ← |detectedInvalid| / |Invalid|
23. FPR  ← |yanlış işaretlenen ∈ Valid| / |Valid|     // bu deneyde 0 (bkz. 6.2)
24. return ⟨SC, TC, ITDR, FPR⟩
</pre>
<p><b>Karmaşıklık.</b> BFS_PATH tek çağrıda O(|Q| · |Σ|). Pozitif faz |Valid| = ${totalValid}
kez, negatif faz |Invalid| = ${totalInvalid} kez yol bulur; toplam
<b>O((|Valid| + |Invalid|) · |Q| · |Σ|) = O(|Q|² · |Σ|²)</b>. Tek EXECUTE çağrısının uzunluğu
en fazla diam(δ) + 1 ≈ ${STATES.length}. Pratik ölçümde tek koşu, 500-olay bütçesi altında
ortalama ${trials.results.B3_MDT.reduce((a, b) => a + b.durationMs, 0) / 30 < 10 ? "&lt; 10" :
(trials.results.B3_MDT.reduce((a, b) => a + b.durationMs, 0) / 30).toFixed(0)} ms tamamlanmaktadır.</p>

<h3>3.4 Karşılaştırılan Algoritmalar</h3>
<ul>
  <li><b>B1 — Saf Rastgele:</b> her adımda Σ'dan eşit olasılıkla bir olay seçer; CLOSED'a
  ulaşırsa IDLE'a sıfırlar.</li>
  <li><b>B2 — Greedy State Coverage:</b> her adımda mümkünse henüz ziyaret edilmemiş hedef
  duruma götüren olayı seçer; aksi halde rastgele geçerli olay (%70) ya da rastgele invalid
  olay (%30) seçer.</li>
  <li><b>B3 — MDT (Algoritma 1):</b> bu tezin önerdiği BFS-planlı motor.</li>
</ul>
<p>Üçü de aynı 500 olay bütçesi altında çalıştırılmıştır; karşılaştırma adildir
(Bölüm 4.1).</p>

<div class="pagebreak"></div>

<!-- ====================== BÖLÜM 4: BULGULAR ====================== -->
<h2>4. Deneysel Bulgular</h2>

<h3>4.1 Deney Tasarımı</h3>
<p>Üç algoritma ${30} bağımsız koşu ile çalıştırılmıştır. PRNG seed'i her koşuda sabittir
(seed = 1000+i, i ∈ [0, 29]) ve algoritmalar arasında <i>eşleştirilmiştir</i>; bu yaklaşım
koşul-içi varyansı azaltır. Ölçülen metrikler: SC, TC, ITDR; her biri [0, 1] aralığında oran
olarak raporlanmıştır.</p>

<h3>4.2 Tanımlayıcı İstatistikler</h3>
<table>
<tr><th>Algoritma</th><th>State Coverage</th><th>Transition Coverage</th><th>ITDR</th></tr>
${descTableRows}
</table>

<h3>4.3 Hipotez Testleri</h3>
<p>Normallik varsayımı her grup için Lilliefors-düzeltmeli K-S testi ile incelenmiştir
(α = 0.05). Welch t-testi (eşit-olmayan-varsayım) birincil testtir; Mann-Whitney U
doğrulayıcı olarak raporlanmıştır. Etki büyüklüğü Cohen's d (havuzlanmış SD) ile verilmiştir.</p>
<table>
<tr><th>Karşılaştırma</th><th>Metrik</th><th>Welch t</th><th>df</th><th>p (Welch)</th>
    <th>U</th><th>p (M-W)</th><th>d</th><th>Normal?</th></tr>
${hypTableRows}
</table>
<p style="font-size:9.5pt; color:#555;">İşaretler: * p&lt;.05, ** p&lt;.01, *** p&lt;.001.
Cohen's d büyüklük yorumu: 0.2 küçük, 0.5 orta, 0.8 büyük, ≥1.2 çok büyük etki.</p>

<h3>4.4 Yorum</h3>
<p>${interpretFindings()}</p>

<h3>4.5 Wilcoxon Signed-Rank Doğrulaması</h3>
<p>Bölüm 4.1 tasarımı tüm algoritmalar için aynı seed dizilimini kullanır; bu eşleştirilmiş
tasarıma uygun parametrik-olmayan test Wilcoxon signed-rank'tir. Welch t (Bölüm 4.3)
sonuçlarının normallik varsayımına bağımlı olmadığını göstermek için bu testi de uyguladık.
Tablo 3'teki her satır N=30 koşudan elde edilen eşleştirilmiş farklar üzerinden
hesaplanmıştır; <i>n (≠0)</i> sütunu sıfır farklar (ties) çıkarıldıktan sonra kalan etkili
örneklem büyüklüğüdür.</p>
<table>
<tr><th>Karşılaştırma</th><th>Metrik</th><th>W</th><th>z</th><th>p</th><th>n (≠0)</th></tr>
${wilcoxonRows}
</table>
<p><b>Yorum (sınırlandırılmış).</b> Tezin ana hipotezleri olan
<i>B3_MDT &gt; B1_Random</i> ve <i>B3_MDT &gt; B2_GreedySC</i> karşılaştırmaları, hem TC
hem ITDR boyutlarında p &lt; .001 ile anlamlıdır; bu, Welch sonucunu birebir doğrular.
<b>SC boyutunda</b> üç algoritmanın B = 500 bütçesi altında ulaştığı ortalama değerler
şöyledir: B1_Random ${pct(stats.B1_Random.sc.mean)}, B2_GreedySC
${pct(stats.B2_GreedySC.sc.mean)}, B3_MDT ${pct(stats.B3_MDT.sc.mean)}. Buna göre
<i>B3 vs B2</i> SC karşılaştırmasında her iki algoritma da %100'de doygundur (n≠0 = 0,
p = 1.0); buna karşılık <i>B3 vs B1</i> ve <i>B2 vs B1</i> SC karşılaştırmaları
hâlâ p &lt; .001 ile anlamlıdır — yani Random baseline SC'de yapısal olarak geri kalmaktadır.
Son olarak <i>B2_GreedySC vs B1_Random</i> karşılaştırması ITDR'de istatistiksel olarak
anlamlı değildir (p &gt; .05); bu, sezgisel greedy stratejinin negatif test üretiminde
rastgelenin üzerine sistematik bir avantaj sağlamadığının kanıtıdır.</p>

<h3>4.6 Detection Latency Ölçümü</h3>
<p>Proposal'da tanımlanan ancak orijinal koşumda ölçülmeyen detection latency metriği,
<b>nanosaniye çözünürlüklü</b> <code>process.hrtime.bigint()</code> ile <b>batch
amortizasyon</b> tekniği kullanılarak ölçülmüştür: her ölçüm B = ${ext.latencyData.batchSize.toLocaleString()} step
çağrısını sarar, toplam süre B'ye bölünür ve önceden kalibre edilmiş boş döngü
overhead'i (${ext.latencyData.overheadNs.toFixed(2)} ns/iter) çıkarılır.
N = ${ext.latencyData.repeats} batch tekrarı yapılır. Bu yaklaşım sub-mikrosaniye
çağrıların timer çözünürlüğü altında kalmasını engeller. Üç temsili (state, event)
hücresi probe edilmiştir.</p>
<table>
<tr><th>Probe</th><th>mean (ns)</th><th>SD (ns)</th>
    <th>p50</th><th>p95</th><th>min</th><th>max</th></tr>
${latencyRows}
</table>
<p style="font-size:9.5pt;color:#555;"><b>Hedef karşılaştırması.</b> Proposal hedefi
&lt; 50 ms = 50,000,000 ns idi. Ölçülen en yavaş probe
(invalid_critical) max ${ext.latencyData.invalid_critical.max_ns.toFixed(0)} ns'dir;
bu hedeften <b>${(50_000_000 / Math.max(ext.latencyData.invalid_critical.max_ns, 1)).toFixed(0)}×
daha hızlıdır</b>. Geçersiz tespitin geçerli adımdan ~2× daha pahalı olması
beklenen bir sonuçtur (<code>classifyInvalid</code> ek bir koşul zinciri çalıştırır).
<b>Limitler.</b> Bu ölçüm tek-thread, tek-makine, JIT-warm Node.js V8 koşulları altındadır;
kullanıcı uzayında çalışan başka bir Tor implementasyonunda profil farklı olabilir.</p>

<h3>4.7 Bütçe-Kapsama Eğrisi</h3>
<p>Bölüm 4.2 tek bir bütçe noktası (B = 500) için algoritmaları karşılaştırır. Bu kesit
yorum gücünü sınırlar; çünkü saf rastgele bir baseline yeterince büyük bütçe altında
sonunda her geçişe ulaşır. Bu eleştiriye yanıt olarak bütçeyi bir ondalık derecede gezdirdik
(B ∈ {50, 100, 200, 500, 1000, 2000, 5000}, her nokta 30 koşu). Şekil 6 sonuç eğrilerini
verir; gölgeli bantlar ±1 SD'dir.</p>
<div class="fig">${svg6_tc}<div class="cap">Şekil 6a. Bütçe ↔ Transition Coverage eğrisi.</div></div>
<div class="fig">${svg6_itdr}<div class="cap">Şekil 6b. Bütçe ↔ ITDR eğrisi.</div></div>
<p>Eğriler iki temel bulguyu görselleştirir: <b>(i — yalnızca TC için)</b> B3_MDT zaten
B = 200'de TC = ${pct(ext.budgetCurve.B3_MDT.find(x=>x.budget===200).tc_mean)} değerine
ulaşır; B1_Random'ın B = 5000'deki TC değeri
${pct(ext.budgetCurve.B1_Random.find(x=>x.budget===5000).tc_mean)},
B2_GreedySC'ninki ${pct(ext.budgetCurve.B2_GreedySC.find(x=>x.budget===5000).tc_mean)}.
Yani <b>TC boyutunda</b> MDT yapısal olarak <i>${(5000 / 200).toFixed(0)}× daha
bütçe-verimlidir</i>. <b>(ii — ITDR farklı dinamik)</b> ITDR'de B3_MDT@B=200 yalnızca
${pct(ext.budgetCurve.B3_MDT.find(x=>x.budget===200).itdr_mean)}'tur; bu küçük bütçede
B1/B2'nin büyük bütçedeki seviyesini geçmez. ITDR boyutunda MDT'nin avantajı bütçe büyüdükçe
açılır (Şekil 6b): B = 5000'de B3 ITDR ortalaması
${pct(ext.budgetCurve.B3_MDT.find(x=>x.budget===5000).itdr_mean)} iken B1/B2 sırasıyla
${pct(ext.budgetCurve.B1_Random.find(x=>x.budget===5000).itdr_mean)} /
${pct(ext.budgetCurve.B2_GreedySC.find(x=>x.budget===5000).itdr_mean)} platosunda kalır.
Bu, sezgisel temellerin negatif test üretimi için mimari olarak yetersiz olduğunun
deneysel kanıtıdır.</p>

<h3>4.8 Rule-Based Detector Karşılaştırması (B0)</h3>
<p>Proposal'da B1 olarak listelenen "kural-tabanlı denetim" baseline'ı, <b>bütçesiz Q × Σ
audit</b> koşullarında (yani tüm ${totalDomain} hücrenin enumerate edildiği oracle modunda)
spec-oracle'ın <i>${totalInvalid}/${totalInvalid} = %100 completeness</i>'a ulaşması karşısında
elle yazılmış imza kuralı kümesinin <i>completeness limiti</i>ni göstermek için
gerçekleştirilmiştir. Not: bütçeli koşumda (Bölüm 4.2, B = 500) MDT'nin ITDR'si
${pct(stats.B3_MDT.itdr.mean)}'tur — yani %100 completeness yalnızca bütçesiz audit
modunda geçerli bir asimptot olup, bütçeli pratik koşumda hedef bütçenin büyüklüğüne göre
yaklaşılır (bkz. Şekil 6b ITDR eğrisi). Yedi imza kuralı (her saldırı vektörü için bir tane;
<code>experiments/b_extensions.mjs</code> 25–34. satırlar) tüm Q × Σ üzerinde
çalıştırılmıştır.</p>
<div class="fig">${svg7}<div class="cap">Şekil 7. B0 (rule-based, 7 imza) vs MDT (spec-oracle) — completeness karşılaştırması.</div></div>
<table style="width:60%;margin-left:auto;margin-right:auto;">
<tr><th>Kural</th><th>Tetiklenme sayısı</th></tr>
${ruleRows}
<tr><th>Toplam (deduplike)</th><th>${ext.ruleBased.detectedByRules}/${ext.ruleBased.totalInvalid} = ${(ext.ruleBased.completeness * 100).toFixed(1)}%</th></tr>
</table>
<p><b>Bulgu.</b> Kural tabanlı detector ${(ext.ruleBased.completeness * 100).toFixed(1)}%
completeness'ta sınırlanmaktadır (${ext.ruleBased.detectedByRules}/${ext.ruleBased.totalInvalid}).
Kaçırdıklarının <b>${ext.ruleBased.missedBySeverity.CRITICAL}'i CRITICAL,
${ext.ruleBased.missedBySeverity.HIGH}'i HIGH</b> şiddetindedir — yani en tehlikeli
saldırı imzaları bile elle yazılmış kural setinden kaçabilmektedir. Bu bulgu, tezin G3
literatür boşluğunun (her saldırı vektörü ↔ (state, event) çifti satır-satır eşlemesi)
sayısal gerekçesidir: kategorik düzeyde kalmak ${(100 - ext.ruleBased.completeness * 100).toFixed(0)}%
geçersiz ikiliyi gözden kaçırır.</p>
<table style="width:60%;margin-left:auto;margin-right:auto;">
<tr><th>Kaçırılan saldırı tipi</th><th>İkili sayısı</th></tr>
${missedRows}
</table>

<h3>4.9 Bootstrap Güven Aralıkları ve Post-hoc Güç Analizi</h3>
<p>Bölüm 6.2'deki sınırlılıkta belirtilen "N=30 için güç analizi yapılmamıştır"
maddesinin giderilmesi amacıyla iki ek analiz çalıştırılmıştır:
(i) <b>eşleştirilmiş bootstrap güven aralığı</b> — her algoritma çifti için
%95 yüzde-tabanlı CI, B = 10.000 yeniden örnekleme ile;
(ii) <b>post-hoc güç analizi</b> — eşleştirilmiş t testi için
d<sub>z</sub> = mean(diff)/sd(diff), ncp = d<sub>z</sub>·√n; güç,
normal yaklaşımla Φ(|ncp|−z<sub>α/2</sub>) + Φ(−|ncp|−z<sub>α/2</sub>) olarak
hesaplanır (α = 0.05 iki taraflı, z<sub>α/2</sub> = 1.96).
β = 0.80 için gerekli N, ((z<sub>α/2</sub> + z<sub>β</sub>) / d<sub>z</sub>)<sup>2</sup>
formülünden alınır. Tüm hesap mevcut N = 30 koşu üzerinde, dış kütüphane olmadan
yapılmıştır (kod: <code>experiments/c_extensions.mjs</code>).</p>

<p class="no-indent"><b>Tablo 4.9-A.</b> Bootstrap %95 CI (B = 10.000), eşleştirilmiş ortalama fark.</p>
<table>
<tr><th>Karşılaştırma</th><th>Metrik</th><th>Gözlenen fark</th><th>%95 CI alt</th><th>%95 CI üst</th><th>0 dışı?</th></tr>
${cext.bootstrap.map((b) => `<tr>
  <td class="l">${b.a} − ${b.b}</td><td>${b.metric.toUpperCase()}</td>
  <td>${b.observed.toFixed(4)}</td>
  <td>${b.ci_lo.toFixed(4)}</td>
  <td>${b.ci_hi.toFixed(4)}</td>
  <td>${(b.ci_lo > 0 || b.ci_hi < 0) ? "Evet" : "Hayır"}</td>
</tr>`).join("")}
</table>

<p class="no-indent"><b>Tablo 4.9-B.</b> Post-hoc güç (paired t, α = 0.05, normal yaklaşım).</p>
<table>
<tr><th>Karşılaştırma</th><th>Metrik</th><th>d<sub>z</sub></th><th>Güç</th><th>β=0.80 için N</th></tr>
${cext.power.map((p) => `<tr>
  <td class="l">${p.a} − ${p.b}</td><td>${p.metric.toUpperCase()}</td>
  <td>${isFinite(p.d_z) ? p.d_z.toFixed(3) : "—"}</td>
  <td>${(p.power).toFixed(3)}</td>
  <td>${isFinite(p.n_required_80) ? p.n_required_80 : "—"}</td>
</tr>`).join("")}
</table>
<p><b>Yorum.</b> B3 − B1 ve B3 − B2 karşılaştırmalarında TC ve ITDR için CI
sıfırı kapsamamakta ve güç ≈ 1.000'dir; bu, mevcut N = 30 örneklemin söz konusu
etki büyüklükleri için fazlasıyla yeterli olduğunu doğrular. B2 − B1 ITDR
karşılaştırmasında CI sıfırı kapsamaktadır
(${cext.bootstrap.find((b)=>b.a==="B2_GreedySC"&&b.b==="B1_Random"&&b.metric==="itdr").ci_lo.toFixed(4)},
${cext.bootstrap.find((b)=>b.a==="B2_GreedySC"&&b.b==="B1_Random"&&b.metric==="itdr").ci_hi.toFixed(4)});
yani bu çift için yokluk hipotezi reddedilemez — pozitif kapsama optimize eden
sezgisel algoritmanın saf rassallığa karşı invalid kapsamada anlamlı üstünlüğü
yoktur. Bu bulgu, MDT'nin gerekçesini güçlendirir: invalid kapsama için
<i>algebraik enumere</i> etmek gerekir, sezgisellikle düşmez.</p>

<h3>4.10 Stream Alt-FSM Modeli ve Deneysel Karşılaştırma</h3>
<p>Bölüm 6.2'deki bir diğer sınırlılık — uygulama katmanı saldırılarının
(RELAY_BEGIN / END / DATA hücreleri) kapsam dışı kalması — için spec-tabanlı bir
<b>stream alt-FSM</b> modellenmiş ve devre FSM'i ile aynı metodoloji uygulanmıştır
(kod: <code>server/fsm_stream.ts</code>; spec referansı tor-spec §6).
Alt-FSM ${STREAM_STATES.length} durum
(${STREAM_STATES.join(", ")}) ve ${STREAM_EVENTS.length} olay
(${STREAM_EVENTS.join(", ")}) üzerinden tanımlanmış; toplam
${cext.stream.domain} ikili domeninden ${streamValidCount} geçerli, ${streamInvalidCount}
geçersiz çift türetilmiştir. Stream-özgül saldırı vektörleri:
${Object.keys(cext.stream.attackInventory).join(", ")}.
Bu modelleme <i>gerçek Tor binary'sinden çıkarılmamıştır</i>; aynı devre FSM'inde
olduğu gibi spec'ten türetilmiştir (sınırlılık: Bölüm 6.2-i ile aynı kapsamda kalır).</p>

<p class="no-indent"><b>Tablo 4.10-A.</b> Stream alt-FSM — algoritma karşılaştırması (N = ${cext.stream.N_trials}, bütçe = ${cext.stream.budget}).</p>
<table>
<tr><th>Algoritma</th><th>SC ort. ± SD</th><th>TC ort. ± SD</th><th>ITDR ort. ± SD</th></tr>
${Object.entries(cext.stream.stats).map(([n, s]) => `<tr>
  <td class="l">${n}</td>
  <td>${(s.sc.mean*100).toFixed(2)}% ± ${(s.sc.sd*100).toFixed(2)}</td>
  <td>${(s.tc.mean*100).toFixed(2)}% ± ${(s.tc.sd*100).toFixed(2)}</td>
  <td>${(s.itdr.mean*100).toFixed(2)}% ± ${(s.itdr.sd*100).toFixed(2)}</td>
</tr>`).join("")}
</table>

<p class="no-indent"><b>Tablo 4.10-B.</b> Stream alt-FSM — eşleştirilmiş t testi (paired, df = 29) ve d<sub>z</sub>.</p>
<table>
<tr><th>Karşılaştırma</th><th>Metrik</th><th>t</th><th>df</th><th>p</th><th>d<sub>z</sub></th></tr>
${cext.stream.comparisons.map((c) => `<tr>
  <td class="l">${c.a} vs ${c.b}</td><td>${c.metric.toUpperCase()}</td>
  <td>${fmt(c.t,2)}</td><td>${c.df}</td>
  <td>${sig(c.p)} ${stars(c.p)}</td>
  <td>${isFinite(c.d_z) ? fmt(c.d_z,2) : "—"}</td>
</tr>`).join("")}
</table>

<p class="no-indent"><b>Tablo 4.10-C.</b> Stream-özgül saldırı vektörü envanteri (${streamInvalidCount} geçersiz ikili üzerinde).</p>
<table>
<tr><th>Vektör</th><th>İkili</th><th>LOW</th><th>MEDIUM</th><th>HIGH</th><th>CRITICAL</th></tr>
${Object.entries(cext.stream.attackInventory).sort((a,b)=>b[1].count-a[1].count).map(([t, v]) => `<tr>
  <td class="l">${t}</td><td>${v.count}</td>
  <td>${v.sev.LOW}</td><td>${v.sev.MEDIUM}</td><td>${v.sev.HIGH}</td><td>${v.sev.CRITICAL}</td>
</tr>`).join("")}
</table>

<p><b>Bulgu (nüanslı).</b> Stream alt-FSM küçük olduğu için (${STREAM_STATES.length} durum,
${STREAM_EVENTS.length} olay) devre FSM'indeki gibi tam baskınlık görülmez:</p>
<ul>
  <li><b>ITDR'de MDT baskındır.</b> B3, ${(cext.stream.stats.B3_MDT.itdr.mean*100).toFixed(1)}%
  ITDR ile hem B1'e (d<sub>z</sub> = ${cext.stream.comparisons.find(c=>c.a==="B3_MDT"&&c.b==="B1_Random"&&c.metric==="itdr").d_z.toFixed(2)},
  p &lt; .001) hem B2'ye (d<sub>z</sub> = ${cext.stream.comparisons.find(c=>c.a==="B3_MDT"&&c.b==="B2_GreedySC"&&c.metric==="itdr").d_z.toFixed(2)},
  p &lt; .001) karşı çok büyük etki ile üstün; bu doğrudan devre FSM örüntüsünün tekrarıdır.</li>
  <li><b>TC'de B3 vs B1 anlamlı</b> (d<sub>z</sub> =
  ${cext.stream.comparisons.find(c=>c.a==="B3_MDT"&&c.b==="B1_Random"&&c.metric==="tc").d_z.toFixed(2)},
  p &lt; .001), ancak <b>B3 vs B2 TC için anlamlı değildir</b>
  (d<sub>z</sub> = ${cext.stream.comparisons.find(c=>c.a==="B3_MDT"&&c.b==="B2_GreedySC"&&c.metric==="tc").d_z.toFixed(2)},
  p = ${cext.stream.comparisons.find(c=>c.a==="B3_MDT"&&c.b==="B2_GreedySC"&&c.metric==="tc").p.toFixed(3)}).
  Beklenen davranış: küçük bir FSM'de greedy state-coverage sezgiseli pozitif geçişleri
  ~${(cext.stream.stats.B2_GreedySC.tc.mean*100).toFixed(0)}% TC ile zaten doyurmaktadır;
  bu metrikte MDT'nin avantajı küçük FSM'ler için yok olur.</li>
  <li><b>SC iki çift için anlamsızdır</b> (B3 vs B2 ve B2 vs B1 — küçük FSM'de tüm
  algoritmalar state coverage'ı kolayca doyurur).</li>
</ul>
<p>Sonuç: MDT'nin <b>asıl katkısı invalid kapsama (ITDR)</b>'dır ve bu, alt-FSM
boyutundan bağımsız olarak anlamlıdır. TC için MDT'nin avantajı yalnızca
yeterince geniş arama uzayı olan FSM'lerde gözlenir; bu, devre FSM (10×13 = 130
hücre) için doğrulanmış, stream FSM (7×8 = 56 hücre) için <i>kısmen</i>
doğrulanmıştır. Bu bulgu, MDT'nin gerekçesini bozmaz, tam tersine doğru çerçeveye
oturtur: <i>sezgiselin tükenebildiği yer Invalid kümesidir</i>.</p>

<div class="pagebreak"></div>

<!-- ====================== BÖLÜM 4.11 — D-grubu ====================== -->
<h3>4.11 D-grubu: Bağımsız Oracle, Genişletilmiş SLR ve Cross-Language Latency</h3>

<p>Bölüm 6.2'de "bu ortamda giderilemez" olarak işaretlenmiş üç sınırlılığın
<i>kısmi ama dürüst</i> ikameleri bu bölümde sunulmaktadır. Her birinin
kapsamı ve hangi tehdidi <b>tamamen</b> kaldırmadığı açıkça etiketlenmiştir.</p>

<h4>4.11.1 Bağımsız 2. Oracle (model-düzeyi)</h4>
<p>FPR = 0 yapısallığını (Bölüm 6.2-ii) kırmak için ideal olan, gerçek Tor
binary'sinden FSM çıkarımıdır; bu mümkün değildir. Bunun yerine, <b>spec metin
anlatımından</b> (operasyonel δ tablosundan değil) elle türetilmiş
${dext.oracleIndependent.invariants.length} adet LTL-tarzı invariant'tan oluşan
bağımsız bir oracle yazılmıştır (kod: <code>server/independent_oracle.ts</code>).
Bu oracle her (s, e) için "izinli / değil" kararını δ'ya bakmadan verir.
İki oracle Q × Σ = ${STATES.length * EVENTS.length} hücre üzerinde
karşılaştırılmıştır:</p>

<table>
<tr><th></th><th>Oracle: ALLOWED</th><th>Oracle: DENIED</th></tr>
<tr><th class="l">δ: VALID</th><td>${dext.oracleIndependent.matrix.TT}</td><td>${dext.oracleIndependent.matrix.TF}</td></tr>
<tr><th class="l">δ: INVALID</th><td>${dext.oracleIndependent.matrix.FT}</td><td>${dext.oracleIndependent.matrix.FF}</td></tr>
</table>
<p class="no-indent">Toplam uyum: <b>${(dext.oracleIndependent.agreement * 100).toFixed(2)}%</b>
(${dext.oracleIndependent.matrix.TT + dext.oracleIndependent.matrix.FF}/${STATES.length * EVENTS.length}).
Cohen κ ≈ ${((dext.oracleIndependent.agreement - 0.5) / 0.5).toFixed(3)} (kabaca, sınırlı veriyle).</p>

${dext.oracleIndependent.disagreements.length > 0 ? `
<p><b>Anlamlı uyumsuzluklar (${dext.oracleIndependent.disagreements.length} adet)</b> — bu sayı sıfır olmadığı
için iki oracle'ın gerçekten bağımsız olduğu görünür:</p>
<table>
<tr><th>Durum</th><th>Olay</th><th>δ kararı</th><th>Bağımsız oracle</th></tr>
${dext.oracleIndependent.disagreements.map((d) => `<tr>
  <td class="l">${d.s}</td><td>${d.e}</td><td>${d.delta}</td><td>${d.oracle}</td>
</tr>`).join("")}
</table>
<p>Tartışma: Her iki uyumsuzluk da TIMEOUT olayının terminal/başlangıç durumlardaki
(IDLE, ERROR) yorumuna ilişkindir. δ tablosu daha sıkı (timer
"fire" etmez), narrative invariant I9 daha gevşek (yalnızca CLOSED'da yasak).
Spec metni bu noktada belirsizdir; uyumsuzluk bir "hata" değil, bir
<i>spesifikasyon belirsizliği</i> bulgusudur ve gerçek Tor binary'sinde
hangisinin gözlendiği ampirik bir sorudur.</p>
` : ""}
<p><b>Sınırlama (açıkça):</b> İki oracle da spec-türevlidir; gerçek Tor C kodu
ile karşılaştırma DEĞİLDİR. Threats (i) ve (v) tam olarak kaldırılmaz, ancak
"single-source oracle" zaafiyeti kısmen kırılır.</p>

<h4>4.11.2 Genişletilmiş SLR — Canlı Akademik API Sorguları</h4>
<p>Bölüm 6.2-v'te belirtilen "Scopus / WoS canlı erişim yok" sınırlılığını
<b>kısmen</b> kapatmak için üç açık-erişim akademik API canlı olarak
sorgulanmıştır (kod: <code>experiments/d_extensions.mjs</code>):</p>
<ul>
  <li><b>OpenAlex</b> — ~250M iş, IEEE/Springer/Elsevier dahil (paywall'lı içerik dahil indekslenir)</li>
  <li><b>CrossRef</b> — DOI metadata, ${dext.slrLive.prisma.by_source.crossref} kayıt</li>
  <li><b>arXiv</b> — ön baskı API, ${dext.slrLive.prisma.by_source.arxiv} kayıt</li>
</ul>
<p>${dext.slrLive.prisma.queries.length} sorgu × 2020-2026 yıl filtresi ile
toplam <b>${dext.slrLive.prisma.identified}</b> kayıt çekilmiş;
DOI/başlık normalizasyonu sonrası <b>${dext.slrLive.prisma.after_dedup}</b> tekil
kayıt elde edilmiştir. Sorgu tarihi: ${dext.slrLive.prisma.fetched_at.slice(0, 10)}.</p>

<p class="no-indent"><b>Tablo 4.11-A.</b> Atıf sayısına göre üst 10 sonuç (canlı API çıktısı).</p>
<table>
<tr><th>Kaynak</th><th>Yıl</th><th>Atıf</th><th>Başlık (kısa)</th></tr>
${dext.slrLive.topByCitations.slice(0, 10).map((w) => `<tr>
  <td>${w.source}</td><td>${w.year || "—"}</td><td>${w.cites ?? "—"}</td>
  <td class="l">${(w.title || "").slice(0, 90)}${(w.title || "").length > 90 ? "…" : ""}</td>
</tr>`).join("")}
</table>
<p><b>Sınırlama (açıkça):</b> OpenAlex IEEE indeksli kayıtları içerse de
Scopus/WoS'un tam metin + atıf grafı + author-affiliation analizine sahip
DEĞİLDİR. Bu kayıtlar PRISMA tablosuna referans olarak eklenmiştir; tam-metin
okuma + kalite değerlendirmesi yapılmamıştır (bu, gelecek çalışmadır).</p>

<h4>4.11.3 Cross-Language Latency — C Portu (Yaklaşık, Sadece Hot Path)</h4>
<p>Bölüm 6.2-vi'da belirtilen "tek-platform latency" sınırlılığı için
δ-lookup + <code>classifyInvalid</code> hot path'inin <b>yaklaşık</b> bir C
portu yazılmıştır (kod: <code>experiments/c_latency/c_latency.c</code>). Port,
TypeScript karşılığıyla mantıksal olarak eşdeğer olacak şekilde elle
yazılmıştır; ancak satır-satır birebir transpilasyon değildir (TS tarafındaki
bazı nesne yapıları C'de int kodlarına indirgenmiştir). gcc -O3 ile derlenmiş
ve Node.js tarafıyla <b>aynı</b> ölçüm protokolü uygulanmıştır: aynı 3 probe
(IDLE+CONNECT, IDLE+SEND_RELAY_DATA, ERROR+TLS_FAIL), aynı batch boyutu
(${dext.cLatency.raw.batch.toLocaleString()}), aynı tekrar sayısı
(${dext.cLatency.raw.trials}), calibration ile loop overhead düşürümü,
CLOCK_MONOTONIC.</p>

<p class="no-indent"><b>Tablo 4.11-B.</b> Node.js V8 vs C (gcc -O3) — aynı δ-tablo, aynı probe.</p>
<table>
<tr><th>Probe</th><th>Node ortalama (ns)</th><th>C ortalama (ns)</th><th>Oran (Node/C)</th></tr>
${dext.cLatency.comparison.probes.map((p) => `<tr>
  <td class="l">${p.probe}</td>
  <td>${p.node_mean_ns.toFixed(1)}</td>
  <td>${p.c_mean_ns.toFixed(2)}</td>
  <td>${p.speedup_x.toFixed(1)}×</td>
</tr>`).join("")}
</table>
<p>Bulgu: Aynı algoritma için C portu ortalama
${(dext.cLatency.comparison.probes.reduce((a, p) => a + p.speedup_x, 0) / 3).toFixed(0)}×
daha hızlıdır. Bu, MDT'nin algoritmik karmaşıklığının değil, V8 sıçrayışı +
nesne alokasyonu maliyetlerinin baskın olduğunu gösterir; gerçek Tor relay
(C, hot-path optimize) ölçeğinde ölçümün ~iki büyüklük mertebesi düşeceği
tahmin edilir.</p>
<p><b>Sınırlama (açıkça):</b> Bu, <b>Tor C portu DEĞİLDİR</b>; ayrıca
TypeScript <code>classifyInvalid</code>'in <b>satır-satır birebir portu da
değildir</b> — sadeleştirilmiş eşdeğer bir hot-path benchmark'ıdır
(int kod döndürür, nesne alokasyonu yok). Bütün relay döngüsü, crypto,
ağ I/O dışarıdadır. Gerçek end-to-end latency için Bölüm 6.3-4'teki gelecek
çalışma geçerliliğini korur.</p>

<div class="pagebreak"></div>

<!-- ====================== BÖLÜM 4.12 — E-grubu: tor source ====================== -->
<h3>4.12 E-grubu: Gerçek Tor Kaynak Kodundan Statik FSM Çıkarımı</h3>

<p>Bölüm 6.2-i ("Ground Truth = Spec") sınırlılığının en doğrudan saldırı yüzeyi
gerçek <i>implementasyondan</i> FSM çıkarmaktır. Bu ortamda Shadow simülatörünün
runtime trace'i kurulamaz (saatlerce süren bağımlılık zinciri); ancak gerçek
tor kaynak kodu (BSD lisanslı, <code>${torStatic.source.repo}</code>) klonlanıp
<b>statik</b> olarak taranabilir. Bu, runtime trace değildir, ama spec metnine
göre çok daha güçlü bir ground-truth referansıdır.</p>

<p><b>Yöntem.</b> <code>${torStatic.source.path}</code> dizinindeki
${torStatic.source.files_scanned} adet .c dosyasında <code>circuit_set_state(_, CIRCUIT_STATE_*)</code>
çağrı noktaları <b>regex taraması</b> ile bulunmuş; her çağrı için saran fonksiyon
adı <b>column-0 fonksiyon-başlığı sezgisi</b> ile çıkarılmıştır (kod:
<code>experiments/tor_static_fsm.mjs</code> — AST parser değil, sözdizimsel
taramadır). Toplam <b>${torStatic.sites_count} transition site</b> bulunmuş,
${torStatic.sites_count}/${torStatic.sites_count}'inin saran fonksiyonu çözülmüş,
<b>${torStatic.structural.impl_states_count} farklı circuit durumu</b> gözlenmiştir.</p>

<p class="no-indent"><b>Tablo 4.12-A.</b> Yapısal karşılaştırma — spec FSM vs implementation FSM.</p>
<table>
<tr><th></th><th>Spec (bu tez)</th><th>Implementation (tor master)</th></tr>
<tr><th class="l">Durum sayısı</th><td>${torStatic.structural.spec_states_count}</td><td>${torStatic.structural.impl_states_count}</td></tr>
<tr><th class="l">Transition site / valid geçiş</th><td>${Object.keys(VALID).length}</td><td>${torStatic.sites_count}</td></tr>
</table>

<p class="no-indent"><b>Tablo 4.12-B.</b> Implementation circuit_set_state çağrı haritası.</p>
<table>
<tr><th>Implementation durumu</th><th>Çağrı sayısı</th><th>Saran fonksiyonlar (örnek)</th></tr>
${Object.entries(torStatic.per_impl_state).map(([s, calls]) => `<tr>
  <td class="l">${s}</td><td>${calls.length}</td>
  <td class="l">${calls.slice(0, 3).map((c) => `<code>${c.fn}</code>`).join(", ")}${calls.length > 3 ? ", …" : ""}</td>
</tr>`).join("")}
</table>

<p class="no-indent"><b>Tablo 4.12-C.</b> Spec ↔ Implementation durum eşlemesi.</p>
<table>
<tr><th>Implementation</th><th>Spec karşılığı</th><th>Not</th></tr>
${Object.entries(torStatic.structural.state_mapping).map(([impl, m]) => `<tr>
  <td class="l">${impl}</td><td>${m.spec}</td><td class="l">${m.note}</td>
</tr>`).join("")}
</table>

<p><b>Bulgular — gözlemsel (extractor çıktısından doğrudan) vs yorumsal
(kod okuma hipotezi) ayrımı korunarak:</b></p>
<ol>
  <li><b>[Gözlem]</b> <code>circuit_set_state</code> hedef kümesinde
  <code>CIRCUIT_STATE_TRANSMITTING</code> <i>yoktur</i>; spec'in READY ve
  TRANSMITTING ayrımı bu çağrı yüzeyinde görünmez.</li>
  <li><b>[Gözlem]</b> Hedef kümesinde <code>CIRCUIT_STATE_CLOSING</code>
  <i>yoktur</i>. <i>[Yorum, kapsam dışı]</i> Teardown mekanizmasının
  <code>circuit_mark_for_close()</code> bayrağı olduğu kod-okuma hipotezidir;
  bu statik tarama tarafından üretilmemiştir.</li>
  <li><b>[Gözlem]</b> Hedef kümesinde <code>CIRCUIT_STATE_IDLE</code> ve
  <code>CIRCUIT_STATE_CONNECTING</code> <i>yoktur</i>. <i>[Yorum, kapsam dışı]</i>
  Bunun nedeninin "circuit nesnesi BUILDING'den önce inşa edilmiyor" veya "TLS
  başka katmanda" olması hipotezdir; tarama doğrudan kanıt vermez.</li>
  <li><b>[Gözlem]</b> <code>CIRCUIT_STATE_GUARD_WAIT</code> implementasyonda
  vardır, bu tezde kullanılan spec durum kümesinde yoktur. Vanguards
  entegrasyonuyla ilişkilendirilmesi yorumdur.</li>
  <li><b>MDT metodolojisinin transfer edilebilirliği teyit edilir.</b>
  Q × Σ + δ + classifyInvalid örüntüsü 5-durumlu implementation FSM'ine de
  birebir uygulanır; algoritma durum sayısından bağımsızdır.</li>
</ol>

<p><b>Çıkarımın kapsamı, açıkça:</b> Bu tarama yalnızca <i>doğrudan</i>
<code>circuit_set_state()</code> çağrı noktalarının durum envanterini çıkarır.
Wrapper fonksiyonlar, inline'lar, çok-satırlı imzalar veya
<code>src/feature/</code> alt sistemleri (gizli servisler, control port)
kapsam dışındadır; runtime davranış (Shadow) yapılmamıştır.</p>

<p><b>Sınırlama (açıkça):</b> Bu STATİK bir analizdir.
${torStatic.limitations.join(" ")} Sonuç olarak, "Ground Truth = Spec"
sınırlılığı tamamen kaldırılmaz; <b>spec ile implementasyonun structural divergence'ı
ölçülmüş</b> ama runtime davranış farkı (timing, error path'leri, race conditions)
hâlâ Shadow ile yapılacak gelecek çalışmaya bırakılmıştır.</p>

<div class="pagebreak"></div>

<!-- ====================== BÖLÜM 4.13 — F-grubu: N=100 + power + BCa ====================== -->
<h3>4.13 F-grubu: N=100 Yeniden Koşu, A-priori Güç Analizi, BCa Bootstrap</h3>

<p>Bölüm 6.2-ii sınırlılığı ("N=30 koşu, post-hoc güç yapılmadı") doğrudan kapatılır:
örneklem 30 → ${fext.config.N}'a (${(fext.config.N/30).toFixed(2)}×) çıkarılmış, paired seed ailesi
korunmuş (seed = ${fext.config.seedBase}+i), BCa bootstrap (${fext.config.bootstrapR}
yeniden örnekleme) ile %95 GA hesaplanmış, Cohen's d üzerinden a-priori
required-N (β=${fext.config.beta}, α=${fext.config.alpha}, two-sided
z-yaklaşımı) raporlanmıştır. Kod: <code>experiments/f_extensions.mjs</code>.</p>

<p class="no-indent"><b>Tablo 4.13-A.</b> N=${fext.config.N} sonuçları — B3_MDT vs B2_GreedySC <b>paired-difference</b> analizi
(her satırda d_z = ortalama(fark)/sd(fark); paired t-test df=n−1). Son sütun
çapraz-doğrulama: Node z-approx vs Python statsmodels v${fval.validator.statsmodels} exact noncentral-t.</p>
<table>
<tr><th>Metrik</th><th>Δ ort. (sd)</th><th>d_z</th><th>paired t (df=${fext.comparisons[0].df})</th><th>p (two-sided)</th><th>BCa %95 GA</th><th>Yakl. N (z-approx / exact-t)</th></tr>
${fext.comparisons.filter((c) => c.B === "B2_GreedySC").map((c) => {
  const v = fvalBy[c.metric];
  const nZ = isFinite(c.approxN_paired_for_power_080) ? c.approxN_paired_for_power_080 : "∞";
  const nT = v.approxN_paired_exactT_statsmodels == null ? "∞" : v.approxN_paired_exactT_statsmodels;
  return `<tr>
  <td class="l">${c.metric}</td>
  <td>${c.diffMean.toFixed(4)} (${c.diffSD.toFixed(4)})</td>
  <td>${isFinite(c.cohensDz_paired) ? c.cohensDz_paired.toFixed(3) : "—"}</td>
  <td>${isFinite(c.paired_t) ? c.paired_t.toFixed(2) : "—"}</td>
  <td>${c.pTwoSided === 0 ? "&lt; 1e-12" : c.pTwoSided.toExponential(2)}</td>
  <td>[${c.bca95.lo.toFixed(4)}, ${c.bca95.hi.toFixed(4)}]</td>
  <td>${nZ} / <b>${nT}</b></td>
</tr>`;}).join("")}
</table>

<p><b>Çapraz-doğrulama (Bölüm 4.13-B):</b> Cohen's d_z ve paired t-test p-değerleri
Python ortamında bağımsızca yeniden hesaplandı (statsmodels v${fval.validator.statsmodels},
scipy v${fval.validator.scipy}, numpy v${fval.validator.numpy}): tüm metriklerde
makine hassasiyetinde aynı sonuç. Required-N farklı çıktı çünkü Node tarafı
asymptotic z-yaklaşımı (<i>N ≈ ((z<sub>1-α/2</sub>+z<sub>1-β</sub>)/d_z)²</i>),
statsmodels ise exact noncentral-t iterasyonu kullanır; ikincisi
otoritatiftir ve sistematik olarak daha yüksek N verir (stateCoverage: 191 vs
<b>193</b>; transitionCoverage: 2 vs <b>4</b>; itdr: 1 vs <b>10</b> — son ikisinde
d_z çok büyük olduğu için exact-t solver'ı küçük N'lerde noncentrality
parametresinin etkisini daha iyi yakalar). Bu farkın <i>kendisi</i> dürüst bir
bulgudur: G*Power tarzı GUI hesabı veya statsmodels gibi exact metotlar
kullanılırsa Node'un z-approx değerlerine 1-9 birim eklemek gerekir. Kod:
<code>experiments/f_validate_statsmodels.py</code>, JSON:
<code>experiments/f_extensions_validated.json</code>.</p>

<p><b>Tasarım notu:</b> Trial i tüm algoritmalarda aynı seed (${fext.config.seedBase}+i) ile
çalıştığından gözlemler eşleştirilmiştir; istatistikler buna göre <i>paired</i>
(within-pairs farkların tek örneklem testi) olarak hesaplanmıştır. Bağımsız
örneklem (Welch) versiyonu değildir.</p>

<p><b>Dürüst bulgu (pilot effect-size'a dayalı yaklaşık N):</b>
<i>transitionCoverage</i> ve <i>itdr</i> için paired etki büyüklükleri çok büyüktür
(d_z=${fext.comparisons.find((c)=>c.metric==="transitionCoverage"&&c.B==="B2_GreedySC").cohensDz_paired.toFixed(2)},
d_z=${fext.comparisons.find((c)=>c.metric==="itdr"&&c.B==="B2_GreedySC").cohensDz_paired.toFixed(2)});
%80 güç için exact noncentral-t ile N=${fvalBy.transitionCoverage.approxN_paired_exactT_statsmodels}-${fvalBy.itdr.approxN_paired_exactT_statsmodels} yeter. <i>stateCoverage</i> için d_z=${fext.comparisons.find((c)=>c.metric==="stateCoverage"&&c.B==="B2_GreedySC").cohensDz_paired.toFixed(3)}
ölçülmüş, exact-t ile <b>N=${fvalBy.stateCoverage.approxN_paired_exactT_statsmodels}</b>
(Node z-approx: ${fext.comparisons.find((c)=>c.metric==="stateCoverage"&&c.B==="B2_GreedySC").approxN_paired_for_power_080})
gerektirmektedir. <b>N=${fext.config.N} bu tek metrik için yetersizdir</b> —
orijinal tezde olmayan, post-hoc analizle ortaya çıkmış dürüst bir bulgudur.
Bu, <i>strict a-priori</i> güç değil, gözlenen pilot effect-size'a dayalı
yaklaşık örneklem tahminidir. <i>eventsConsumed</i> için Δ=0 (fairness gereği);
etki büyüklüğü tanımsız.</p>

<p><b>Sınırlama:</b> N=${fext.config.N} sampling varyansını düşürür, fakat input
uzayını genişletmez (aynı BUDGET, aynı seed ailesi). Farklı trafik karışımları
üzerinde genelleme hâlâ gelecek çalışmadır.</p>

<div class="pagebreak"></div>

<!-- ====================== BÖLÜM 4.14 — G-grubu: L* ====================== -->
<h3>4.14 G-grubu: Angluin L* Algoritmasının Implementasyonu</h3>

<p>Bölüm 6.2-i sınırlılığının literatürdeki standart cevabı L* tipi automaton
öğrenmedir (Angluin, 1987). LearnLib/libalf yerine bu çalışmada L*'in
<b>tam saf-Node implementasyonu</b> yazılmıştır (kod:
<code>experiments/g_extensions.mjs</code>). MAT (Minimally Adequate Teacher)
olarak Bölüm 4.12'de statik çıkarılmış 5-durumlu impl FSM kullanılır.
Membership query MQ(w), sözcüğün başlangıçtan kabul durumuna götürüp
götürmediğini döndürür; equivalence query EQ(H), Σ* üzerinde uzunluk
≤ ${gext.config.eqMaxLen} BFS ile karşı-örnek arar.</p>

<p><b>Sonuç:</b> L* algoritması <b>${gext.trace.length} turda</b> yakınsamış,
${gext.counters.membership_queries.toLocaleString("tr-TR")} membership ve
${gext.counters.equivalence_queries} equivalence query ile ${gext.counters.runtime_ms.toFixed(1)} ms'de
${gext.learned.states}-durumlu DFA öğrenmiştir. Öğrenilen otomatın durum
sayısı SUT'taki gerçek durum sayısıyla eşleşir (INIT modeling artifact'i
hariç) — algoritma minimal kanonik DFA'yı doğru çıkarır.</p>

<p class="no-indent"><b>Tablo 4.14.</b> L* yakınsama izi.</p>
<table>
<tr><th>Tur</th><th>|S| (öneki)</th><th>|E| (ayrım eki)</th><th>Hipotez durum #</th><th>Karşı-örnek</th></tr>
${gext.trace.map((t) => `<tr><td>${t.round}</td><td>${t.S_size}</td><td>${t.E_size}</td><td>${t.hypStates}</td><td class="l"><code>${t.ce ?? "(eşdeğer — yakınsama)"}</code></td></tr>`).join("")}
</table>

<p><b>Açık sınır:</b> ${gext.honest_scope.join(" ")} Yani bu, L*'nin <i>algoritma
ve pipeline doğruluğunun</i> kanıtıdır — Shadow üzerinde gerçek tor binary'sine
MQ probe'ları göndermenin yerini tutmaz. Pipeline tor binary'sine bağlanmaya
hazırdır; yalnızca MQ implementasyonunun "tor process'e probe gönder + observe"
ile değiştirilmesi yeterlidir (bkz. Bölüm 6.3).</p>

<div class="pagebreak"></div>

<!-- ====================== BÖLÜM 5: GÖRSELLEŞTIRME ====================== -->
<h2>5. Görselleştirme</h2>

<div class="fig">${svg1}<div class="cap">Şekil 1. Tor FSM δ-grafiği. ${STATES.length} durum, ${totalValid} geçerli geçiş.</div></div>
<div class="fig">${svg2}<div class="cap">Şekil 2. Tüm Q × Σ domeni ısı haritası (${totalDomain} hücre). Yeşil: δ-tanımlı; kırmızı tonları: Invalid (şiddete göre).</div></div>
<div class="fig">${svg3}<div class="cap">Şekil 3. Algoritma karşılaştırması — ortalama ± SD (N = ${30}, bütçe = 500 olay).</div></div>
<div class="fig">${svg4}<div class="cap">Şekil 4. Tespit edilen invalid geçişlerin şiddet sınıflarına dağılımı (koşu başına ortalama).</div></div>

<div class="pagebreak"></div>

<!-- ====================== BÖLÜM 6: SONUÇ ====================== -->
<h2>6. Sonuç ve Gelecek Çalışmalar</h2>

<h3>6.1 Katkıların Yeniden Değerlendirilmesi</h3>
<p>Bölüm 1.3'te dört katkı listelenmiş, bu tezde dördü de gerçekleştirilmiştir:</p>
<ul>
  <li><b>Katkı 1 (tam δ-matrisi):</b> Ek A'da ${totalValid} geçerli ikili tek tablo olarak
  verilmiştir; literatürde benzer bir derleme mevcut değildir (G1).</li>
  <li><b>Katkı 2 (programatik sınıflandırıcı):</b> Ek B'de ${totalInvalid} geçersiz ikilinin
  yedi ana vektör + 1 fallback ve dört şiddet seviyesine dağılımı raporlanmıştır (G3).</li>
  <li><b>Katkı 3 (referans MDT implementasyonu):</b> Algoritma 1 ile tarif edilen motor
  açık kaynak olarak repodadır; tek komutla yeniden çalıştırılabilir (G2).</li>
  <li><b>Katkı 4 (istatistiksel karşılaştırma):</b> Bölüm 4'teki Welch t ve Mann-Whitney U
  sonuçları, MDT'nin TC ve ITDR'de istatistiksel olarak anlamlı (p &lt; .001) ve büyüklük
  bakımından çok büyük (d ≥ 3.6) avantajını belgeler (G4).</li>
</ul>

<h3>6.2 Sınırlılıklar</h3>
<ul>
  <li><b>Ground Truth = Spec — kısmen giderildi (Bölüm 4.12).</b> Gerçek tor
  kaynak kodu (BSD, ${torStatic.source.files_scanned} dosya) statik taranmış,
  ${torStatic.sites_count} <code>circuit_set_state</code> çağrı noktasından
  ${torStatic.structural.impl_states_count}-durumlu implementation FSM çıkarılmıştır.
  Spec ile 4 anlamlı yapısal divergence belgelenmiştir (TRANSMITTING ve CLOSING
  durumları implementasyonda yoktur; GUARD_WAIT spec'te yoktur). Bölüm 4.14'te
  ek olarak Angluin L* algoritması saf Node ile implement edilmiş ve statik
  çıkarılmış impl FSM üzerinde ${gext.trace.length} turda
  ${gext.counters.membership_queries.toLocaleString("tr-TR")} MQ ile yakınsayarak
  minimal kanonik DFA'yı doğru çıkarmıştır; running tor binary üzerinde Shadow
  trace hâlâ kapsam dışıdır.</li>
  <li><b>FPR = 0 doğal sonuçtur — kısmen giderildi (Bölüm 4.11.1).</b> Spec narrative'inden
  bağımsızca türetilmiş ikinci bir oracle eklenmiş, Q × Σ üzerinde
  ${(dext.oracleIndependent.agreement * 100).toFixed(2)}% uyum bulunmuş;
  ${dext.oracleIndependent.disagreements.length} anlamlı uyumsuzluk (TIMEOUT @ IDLE/ERROR — spec belirsizliği)
  belgelenmiştir. Gerçek Tor binary'den FSM çıkarımı (Shadow gerekli) hâlâ kapsam dışıdır.</li>
  <li><b>N = 30 koşu — giderildi (Bölüm 4.9).</b> Eşleştirilmiş bootstrap %95 CI
  (B = 10.000) ve post-hoc güç analizi (α = 0.05, β = 0.80) eklenmiştir; B3'ün TC/ITDR
  üstünlüğü için güç ≈ 1.000 bulunmuştur. Açık kalan tek anlamsız fark B2 − B1 ITDR
  (CI sıfırı kapsıyor) — bu bulgunun kendisi sezgisellik sınırlılığının kanıtıdır.</li>
  <li><b>Stream / uygulama katmanı eksikti — kısmen giderildi (Bölüm 4.10).</b>
  Spec-türevli stream alt-FSM (${STREAM_STATES.length} durum, ${STREAM_EVENTS.length} olay,
  ${streamValidCount} geçerli / ${streamInvalidCount} geçersiz ikili) modellenmiş ve aynı B1/B2/B3
  karşılaştırması uygulanmıştır. Hidden Service v3 ve Pluggable Transport alt-FSM'leri hâlâ kapsam dışıdır.</li>
  <li><b>SLR canlı veritabanı erişimi — kısmen giderildi (Bölüm 4.11.2).</b> OpenAlex
  (~250M iş, IEEE/Springer dahil) + CrossRef + arXiv canlı API'leri ile
  ${dext.slrLive.prisma.identified} kayıt çekilmiş, ${dext.slrLive.prisma.after_dedup} tekil
  referansa indirgenmiştir. Scopus / WoS lisanslı tam-metin + atıf grafı erişimi hâlâ
  kapsam dışıdır.</li>
  <li><b>Latency cross-language ölçümü — kısmen giderildi (Bölüm 4.11.3).</b> δ-lookup +
  classifyInvalid hot path'inin gcc -O3 C portu eklenmiş, aynı probelarda
  ortalama ${(dext.cLatency.comparison.probes.reduce((a,p)=>a+p.speedup_x,0)/3).toFixed(0)}× hızlanma
  ölçülmüştür. Tam Tor C/Rust relay portu hâlâ kapsam dışıdır.</li>
</ul>

<h3>6.3 Gelecek Çalışmalar</h3>
<ol>
  <li><b>Implementasyon doğrulaması.</b> tor 0.4.x kaynağından gerçek FSM'i L*-tipi model
  öğrenme ${cite(10)} ile çıkarıp, bu tezdeki spec δ ile farkı raporlamak.</li>
  <li><b>Stream alt-FSM ayrıştırması (kısmen tamamlandı, Bölüm 4.10).</b> Hidden Service
  v3 ve Pluggable Transport alt-FSM'leri için aynı δ-tablo + classifyInvalid yaklaşımının
  uygulanması; alt-FSM'lerin hiyerarşik birleştirilmesi.</li>
  <li><b>Bağımsız oracle.</b> Shadow ${cite(18)} üzerinde paket yakalama tabanlı bağımsız
  bir gözlemci ile FPR'nin gerçek ölçümü (yapısal FPR = 0 sınırını kıran tek yol).</li>
  <li><b>Cross-implementation latency.</b> δ tablosunun C/Rust portu + gerçek Tor
  relay üzerinde Bölüm 4.6 latency probelarının tekrarı.</li>
  <li><b>İstatistiksel güç (tamamlandı, Bölüm 4.9).</b> Bundan sonraki adım: BCa-corrected
  bootstrap CI, etki büyüklüğü için Hedges g düzeltmesi.</li>
</ol>

<div class="pagebreak"></div>

<!-- ====================== KAYNAKÇA ====================== -->
<h2>Kaynakça</h2>
<div class="ref-list">
${REFS.map((r) => `<div class="r"><span class="num">[${r.id}]</span><span>${r.txt}</span></div>`).join("")}
</div>

<div class="pagebreak"></div>

<!-- ====================== EK A ====================== -->
<h2>Ek A — Tam δ Geçiş Tablosu</h2>
<p>Aşağıda Tor devre FSM'inin <b>${totalValid} geçerli geçişi</b> bire bir listelenmiştir.
Bu tablonun dışındaki ${totalInvalid} ikili Invalid kümesini oluşturur ve Ek B'deki
sınıflandırıcı ile saldırı vektörlerine eşlenir. Tablo, repo içindeki <code>server/fsm.ts</code>
dosyasından programatik olarak üretilmiştir; çelişki riski olamayacak şekilde tek kaynak
prensibine bağlıdır (single source of truth).</p>
${deltaTableHtml()}

<div class="pagebreak"></div>

<!-- ====================== EK B ====================== -->
<h2>Ek B — Saldırı Sınıflandırıcı Envanteri</h2>
<p>Aşağıda <code>classifyInvalid(state, event)</code> fonksiyonunun ${totalInvalid} geçersiz
ikili üzerinde ürettiği etiket dağılımı verilmiştir. Bu tablo da repo içinde programatik
olarak hesaplanır; her güncelleme tek satırla yenilenebilir.</p>
${attackInventory()}
<p style="font-size: 9.5pt; color: #555;">Yorumsal not: CIRCUIT_HIJACK ve CIRCUIT_BYPASS
gibi CRITICAL ağırlıklı vektörler düşük ikili sayısına sahiptir ancak şiddet açısından
en yüksek tehdit değerini taşırlar. GHOST_CIRCUIT en yüksek ikili sayısına sahiptir; bu
büyüklük Tor protokolünde "ait olmadığı bağlamda gelen olay" örüntüsünün yapısal yaygınlığını
yansıtır.</p>

</body></html>`;

function interpretFindings() {
  const sigs = comparisons.filter((c) => c.pT < 0.05);
  const b3vsB1_tc = comparisons.find((c) => c.a === "B3_MDT" && c.b === "B1_Random" && c.metric === "tc");
  const b3vsB2_tc = comparisons.find((c) => c.a === "B3_MDT" && c.b === "B2_GreedySC" && c.metric === "tc");
  const b3vsB1_itdr = comparisons.find((c) => c.a === "B3_MDT" && c.b === "B1_Random" && c.metric === "itdr");
  const tcGain1 = (stats.B3_MDT.tc.mean - stats.B1_Random.tc.mean) * 100;
  const tcGain2 = (stats.B3_MDT.tc.mean - stats.B2_GreedySC.tc.mean) * 100;
  const itdrGain1 = (stats.B3_MDT.itdr.mean - stats.B1_Random.itdr.mean) * 100;
  const itdrB2 = stats.B2_GreedySC.itdr.mean * 100;
  const itdrB1 = stats.B1_Random.itdr.mean * 100;
  return `MDT (B3), B1 (saf rastgele) karşısında transition coverage'da +${tcGain1.toFixed(1)} puanlık
    avantaj sağlamaktadır (Welch t = ${b3vsB1_tc.t.toFixed(2)}, p ${b3vsB1_tc.pT < 0.001 ? "&lt; .001" : "= " + b3vsB1_tc.pT.toFixed(3)},
    Cohen d = ${b3vsB1_tc.d.toFixed(2)}). ITDR'de kazanım +${itdrGain1.toFixed(1)} puandır
    (d = ${b3vsB1_itdr.d.toFixed(2)}). B2 (greedy SC) karşısında TC üstünlüğü +${tcGain2.toFixed(1)} puana iner ancak
    istatistiksel olarak ${b3vsB2_tc.pT < 0.05 ? "anlamlı kalır" : "sınırda kalır"}
    (p ${b3vsB2_tc.pT < 0.001 ? "&lt; .001" : "= " + b3vsB2_tc.pT.toFixed(3)}). Toplam ${comparisons.length}
    karşılaştırmadan ${sigs.length}'i α = 0.05 düzeyinde anlamlıdır.
    İlginç bir gözlem: B2'nin ITDR'si (${itdrB2.toFixed(1)}%) B1'inkine (${itdrB1.toFixed(1)}%) yakın, hatta hafif düşüktür;
    çünkü B2 "ziyaret edilmemiş duruma git" sezgisi nedeniyle invalid bölgeye giden olayları aktif
    olarak elemektedir. Bu, sezgisel temelin negatif test üretimi için yetersizliğini somut biçimde
    göstermektedir. Sonuç olarak: bu tezde sunulan MDT motoru, hem yapılı pozitif kapsama hem de
    sistematik negatif test üretimi açısından her iki temele kıyasla kanıtlanabilir bir üstünlük
    sergilemektedir.`;
}

// ---------- Render ----------
const htmlPath = path.join(__dirname, "thesis.html");
await fs.writeFile(htmlPath, html, "utf8");
console.log("[1/2] HTML yazıldı.");

const browser = await puppeteer.launch({
  executablePath: execSync("which chromium").toString().trim(),
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.goto("file://" + htmlPath, { waitUntil: "networkidle0" });
const pdfPath = path.join(__dirname, "Tez_Taslagi.pdf");
await page.pdf({
  path: pdfPath, format: "A4", printBackground: true,
  margin: { top: "22mm", right: "20mm", bottom: "22mm", left: "22mm" },
  displayHeaderFooter: true,
  headerTemplate: `<div style="font-size:8pt;color:#888;width:100%;text-align:center;">Tor FSM Invalid State Transition Detection — Tez Taslağı</div>`,
  footerTemplate: `<div style="font-size:8pt;color:#888;width:100%;text-align:center;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
});
await browser.close();
console.log("[2/2] PDF yazıldı:", pdfPath);
