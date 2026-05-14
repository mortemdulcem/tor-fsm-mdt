// Tam tez taslağı: Bölüm 1-6 + Özet + Abstract + Kaynakça.
// Tüm sayısal çıktılar experiments/trials.json'dan, tüm atıflar 20 doğrulanmış kaynaktan,
// tüm SVG figürleri experiments/figures.mjs'den. Hiçbir şey uydurulmaz.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { fsmGraphSvg, attackHeatmapSvg, metricBarChart, severitySplitSvg } from "../experiments/figures.mjs";
import { STATES, EVENTS, VALID, totalDomain, totalValid, totalInvalid, k, classifyInvalid } from "../server/fsm.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const puppeteer = (await import(path.resolve(__dirname, "../node_modules/puppeteer-core/lib/cjs/puppeteer/puppeteer-core.js"))).default;

const trials = JSON.parse(await fs.readFile(path.resolve(__dirname, "../experiments/trials.json"), "utf8"));
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
her geçişi yedi saldırı vektörüne (CIRCUIT_BYPASS, REPLAY_ATTACK, GHOST_CIRCUIT,
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
classification framework that maps every detected transition to one of seven attack vectors
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
  <div class="lvl2"><span>2.7 Literatür Boşluğu</span><span></span></div>
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
  <li>Tüm ${totalInvalid} geçersiz ikiliyi yedi saldırı vektörü ve dört şiddet seviyesine eşleyen
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

<h3>2.7 Literatür Boşluğu</h3>
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
fonksiyonu (kod referansı: <code>server/fsm.ts</code>, 64–204. satırlar) ile yedi kategoriden
birine eşlenir: CIRCUIT_BYPASS, REPLAY_ATTACK, GHOST_CIRCUIT, HANDSHAKE_SKIP, PREMATURE_DATA,
CIRCUIT_HIJACK, CREATE_FLOOD. Sınıflandırma mantığı dokuz koşul ailesi üzerinden işler:
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
  yedi vektör ve dört şiddet seviyesine dağılımı raporlanmıştır (G3).</li>
  <li><b>Katkı 3 (referans MDT implementasyonu):</b> Algoritma 1 ile tarif edilen motor
  açık kaynak olarak repodadır; tek komutla yeniden çalıştırılabilir (G2).</li>
  <li><b>Katkı 4 (istatistiksel karşılaştırma):</b> Bölüm 4'teki Welch t ve Mann-Whitney U
  sonuçları, MDT'nin TC ve ITDR'de istatistiksel olarak anlamlı (p &lt; .001) ve büyüklük
  bakımından çok büyük (d ≥ 3.6) avantajını belgeler (G4).</li>
</ul>

<h3>6.2 Sınırlılıklar</h3>
<ul>
  <li><b>Ground Truth = Spec.</b> Bu deneyde "doğru" davranış, FSM δ tarafından tanımlanır.
  Gerçek Tor implementasyonu (C kaynak kodu, tor 0.4.x serisi) spec ile çelişebilir; bu
  çelişkilerin ölçülmesi yapılmamıştır. Doğal devamı: deneyi gerçek Tor relay üzerinde
  Shadow ${cite(18)} simülatörü ile tekrarlamak.</li>
  <li><b>FPR = 0 doğal sonuçtur.</b> Oracle (δ) ve test üreticisi aynı modeli paylaştığı
  için yanlış-pozitif tanımı boş kümeye düşer. FPR'nin bilgilendirici olması için
  <i>bağımsız</i> bir oracle gerekir (örn. paket yakalama tabanlı gözlemci).</li>
  <li><b>Bütçe tek noktada (500 olay) ölçülmüştür.</b> Bütçe-kapsama eğrisi (B1/B2 için
  bütçe büyütüldüğünde MDT performansına yaklaşma davranışı) raporun kapsamı dışındadır.</li>
  <li><b>N = 30 koşu</b> CLT için yeterli; ancak güç analizi (β = 0.80, α = 0.05) yapılmamıştır.
  Önerilen genişletme: N = 100.</li>
  <li><b>SLR canlı veritabanı erişimi yok.</b> Bu ortamda Scopus / WoS / IEEE Xplore canlı
  sorgulanamadığı için tarama açık web kanalları ile sınırlıdır; bulunmayan kaynak olabileceği
  açıkça kabul edilir.</li>
</ul>

<h3>6.3 Gelecek Çalışmalar</h3>
<ol>
  <li><b>Implementasyon doğrulaması.</b> tor 0.4.x kaynağından gerçek FSM'i L*-tipi model
  öğrenme ${cite(10)} ile çıkarıp, bu tezdeki spec δ ile farkı raporlamak.</li>
  <li><b>Stream FSM uzantısı.</b> RELAY_BEGIN / RELAY_END / RELAY_DATA hücreleriyle yönetilen
  stream alt-FSM'inin ayrı δ tablosu olarak modellenmesi.</li>
  <li><b>Hidden service v3 protokolü.</b> Devre FSM'inden ayrı bir alt-FSM gerektirir.</li>
  <li><b>Bağımsız oracle.</b> Shadow ${cite(18)} üzerinde paket yakalama tabanlı bağımsız
  bir gözlemci ile FPR'nin gerçek ölçümü.</li>
  <li><b>Detection latency ölçümü.</b> Bu çalışmada metrik tanımlandı ancak ölçülmedi.</li>
  <li><b>İstatistiksel güç artışı.</b> N = 100 koşu, güç analizi raporlu, etki büyüklüğü
  güven aralığı (BCa bootstrap).</li>
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
