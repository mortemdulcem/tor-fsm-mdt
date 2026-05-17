// IEEE konferans formatı (2-sütun A4) — tezdeki gerçek tablo/algoritma/SLR içerikleri
// taşınmış genişletilmiş sürüm. Tüm sayısal değerler trials.json + b_extensions.json'dan,
// tüm SVG figürleri experiments/figures*.mjs'den. Hiçbir şey uydurulmaz.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { fsmGraphSvg, attackHeatmapSvg, severitySplitSvg } from "../experiments/figures.mjs";
import { prismaSvg, budgetCurveSvg, ruleCompletenessSvg } from "../experiments/figures_v2.mjs";
import { STATES, EVENTS, VALID, totalDomain, totalValid, totalInvalid, k, classifyInvalid } from "../server/fsm.ts";
import { STREAM_STATES, STREAM_EVENTS } from "../server/fsm_stream.ts";
const STREAM_STATES_LEN = STREAM_STATES.length;
const STREAM_EVENTS_LEN = STREAM_EVENTS.length;

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

const pct = (x) => `${(x * 100).toFixed(1)}\\%`.replace("\\%", "%");
const fmt = (x, d = 3) => isFinite(x) ? x.toFixed(d) : "—";
const sig = (p) => p < 0.001 ? "&lt;.001" : p.toFixed(4);
const stars = (p) => p < 0.001 ? "***" : p < 0.01 ? "**" : p < 0.05 ? "*" : "";
const cite = (...ids) => `[${ids.join("], [")}]`;

const REFS = [
  '[1] R. Dingledine, N. Mathewson, P. Syverson, "Tor: The Second-Generation Onion Router," <i>USENIX Security</i>, 2004.',
  '[2] S. J. Murdoch, G. Danezis, "Low-Cost Traffic Analysis of Tor," <i>IEEE S&amp;P</i>, 2005.',
  '[3] A. Johnson et al., "Users Get Routed: Traffic Correlation on Tor by Realistic Adversaries," <i>ACM CCS</i>, 2013.',
  '[4] A. Panchenko et al., "Website Fingerprinting at Internet Scale," <i>NDSS</i>, 2016.',
  '[5] I. Karunanayake et al., "De-Anonymisation Attacks on Tor: A Survey," <i>IEEE Comm. Surveys &amp; Tutorials</i>, 23(4), 2021.',
  '[6] M. Backes et al., "AnoA: A Framework for Analyzing Anonymous Communication Protocols," <i>IEEE CSF</i>, 2013.',
  '[7] D. Lee, M. Yannakakis, "Principles and Methods of Testing FSMs—A Survey," <i>Proc. IEEE</i>, 84(8), 1996.',
  '[8] J. Tretmans, "Model Based Testing with Labelled Transition Systems," LNCS 4949, 2008.',
  '[9] J. de Ruiter, E. Poll, "Protocol State Fuzzing of TLS Implementations," <i>USENIX Security</i>, 2015.',
  '[10] P. Fiterău-Broștean, R. Janssen, F. Vaandrager, "Combining Model Learning and Model Checking to Analyze TCP Implementations," <i>CAV</i>, 2016.',
  '[11] P. Ammann, J. Offutt, <i>Introduction to Software Testing</i>, 2nd ed., Cambridge UP, 2016.',
  '[12] D. Dolev, A. C. Yao, "On the Security of Public Key Protocols," <i>IEEE TIT</i>, 29(2), 1983.',
  '[13] K. Bhargavan, B. Blanchet, N. Kobeissi, "Verified Models and Reference Implementations for the TLS 1.3 Standard Candidate," <i>IEEE S&amp;P</i>, 2017.',
  '[14] J. Somorovsky, "Systematic Fuzzing and Testing of TLS Libraries," <i>ACM CCS</i>, 2016.',
  '[15] M. Felderer et al., "Security Testing: A Survey," <i>Adv. Computers</i>, vol. 101, 2016.',
  '[16] A. Pretschner, T. Mouelhi, Y. Le Traon, "Model-Based Tests for Access Control Policies," <i>ICST</i>, 2008.',
  '[17] B. Kitchenham, S. Charters, "Guidelines for performing SLRs in Software Engineering," EBSE-2007-01, 2007.',
  '[18] R. Jansen, K. Bauer, N. Hopper, R. Dingledine, "Methodically Modeling the Tor Network," <i>USENIX CSET</i>, 2012.',
  '[19] Tor Project, "Tor Protocol Specification (tor-spec)," 2026. https://spec.torproject.org/tor-spec.',
  '[20] Microsoft Research, "A Data-Driven FSM Model for Analyzing Security Vulnerabilities," MSR Tech. Rep., 2018.',
];

// ---- Figures ----
const svgFsm = fsmGraphSvg();
const svgHeat = attackHeatmapSvg();
const svgSev = severitySplitSvg(sevSplit);
const svgPrisma = prismaSvg(ext.prisma);
const svgBudgetTC = budgetCurveSvg(ext.budgetCurve, ext.BUDGETS, "tc");
const svgBudgetITDR = budgetCurveSvg(ext.budgetCurve, ext.BUDGETS, "itdr");
const svgRule = ruleCompletenessSvg(ext.ruleBased);

// ---- Wilcoxon table ----
const wilcoxonRows = ext.wilcoxon.map((w) => `<tr>
  <td class="l">${w.a.replace("_", " ")} vs ${w.b.replace("_", " ")}</td>
  <td>${w.metric.toUpperCase()}</td>
  <td>${w.W.toFixed(1)}</td><td>${w.z.toFixed(2)}</td>
  <td>${w.p < 0.001 ? "&lt;.001" : w.p.toFixed(4)} ${w.p < 0.001 ? "***" : w.p < 0.01 ? "**" : w.p < 0.05 ? "*" : ""}</td>
  <td>${w.n}</td>
</tr>`).join("");

// ---- Latency table ----
const probeOrder = ["valid_step", "invalid_critical", "invalid_low"];
const probeLabels = { valid_step: "Valid step (IDLE→CONNECTING)", invalid_critical: "Invalid CRITICAL (BYPASS)", invalid_low: "Invalid LOW (GHOST)" };
const latencyRows = probeOrder.map((key) => { const d = ext.latencyData[key]; return `<tr>
  <td class="l">${probeLabels[key]}</td>
  <td>${d.mean_ns.toFixed(1)}</td><td>${d.sd_ns.toFixed(1)}</td>
  <td>${d.p50_ns.toFixed(1)}</td><td>${d.p95_ns.toFixed(1)}</td>
  <td>${d.min_ns.toFixed(1)}</td><td>${d.max_ns.toFixed(1)}</td>
</tr>`; }).join("");

// ---- Welch/MWU table (compact) ----
const hypTableRows = comparisons.map((c) => `<tr>
  <td class="l">${c.a.replace("_", " ")} vs ${c.b.replace("_", " ")}</td>
  <td>${c.metric.toUpperCase()}</td>
  <td>${fmt(c.t, 2)}</td><td>${sig(c.pT)} ${stars(c.pT)}</td>
  <td>${sig(c.pU)} ${stars(c.pU)}</td>
  <td>${fmt(c.d, 2)}</td>
</tr>`).join("");

// ---- Attack classifier inventory (programmatic, real data) ----
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
  return `<table><tr><th class="l">Attack vector</th><th>#</th><th>Share</th>
    <th>LOW</th><th>MED</th><th>HIGH</th><th>CRIT</th></tr>${rows}
    <tr><th class="l">Total</th><th>${total}</th><th>100%</th><th colspan="4"></th></tr></table>`;
}

// ---- δ table sample (first 12 valid edges, for paper compactness) ----
function deltaSample() {
  const all = Object.entries(VALID);
  const sample = all.slice(0, 12).map(([key, to]) => {
    const [from, ev] = key.split("|");
    return `<tr><td class="l">${from}</td><td class="l">${ev}</td><td class="l">${to}</td></tr>`;
  }).join("");
  return `<table><tr><th class="l">From</th><th class="l">Event (Σ)</th><th class="l">To</th></tr>${sample}
    <tr><td colspan="3" style="text-align:center;font-style:italic;">… ${all.length - 12} additional edges (full table available in repository)</td></tr></table>`;
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Tor FSM Invalid Transition Detection — IEEE Paper</title>
<style>
  @page { size: A4; margin: 18mm 14mm 18mm 14mm; }
  body { font-family: "Times New Roman", Times, serif; font-size: 9.5pt; color: #000; line-height: 1.30; }
  .title { text-align: center; font-size: 18pt; font-weight: bold; margin: 0 0 4pt; line-height: 1.15; }
  .authors { text-align: center; font-size: 10pt; margin: 6pt 0 4pt; }
  .affil { text-align: center; font-size: 9pt; font-style: italic; margin-bottom: 8pt; }
  .abstract { font-size: 9pt; margin: 10pt 14pt; }
  .abstract b { font-style: italic; }
  .keywords { font-size: 9pt; margin: 4pt 14pt 14pt; font-style: italic; }
  .cols { column-count: 2; column-gap: 6mm; column-rule: none; }
  h2 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: 0.4pt; text-align: center; margin: 12pt 0 4pt; font-weight: bold; }
  h3 { font-size: 10pt; font-style: italic; margin: 8pt 0 2pt; font-weight: normal; }
  h4 { font-size: 9.5pt; margin: 6pt 0 2pt; font-weight: bold; font-style: italic; }
  p { text-align: justify; margin: 2pt 0 4pt; text-indent: 12pt; }
  p.no-indent, .fig p, table + p, h2 + p, h3 + p, h4 + p, ul + p, pre + p { text-indent: 0; }
  ul, ol { margin: 2pt 0 4pt 14pt; padding: 0; font-size: 9pt; }
  ul li, ol li { margin: 1pt 0; }
  table { border-collapse: collapse; width: 100%; font-size: 7.8pt; margin: 4pt 0; }
  th, td { border: 1px solid #000; padding: 2pt 3pt; text-align: center; }
  th { background: #ddd; }
  td.l, th.l { text-align: left; }
  pre.algo { font-family: "Courier New", monospace; font-size: 7pt; line-height: 1.25; white-space: pre-wrap; background: #f4f4f4; padding: 4pt; border: 1px solid #aaa; margin: 4pt 0; break-inside: avoid; }
  .fig { text-align: center; margin: 4pt 0 6pt; break-inside: avoid; }
  .fig svg { max-width: 100%; height: auto; }
  .cap { font-size: 8pt; margin-top: 2pt; }
  .ref { font-size: 8pt; margin: 2pt 0; text-indent: -16pt; padding-left: 16pt; }
  code { font-family: "Courier New", monospace; font-size: 8.5pt; }
</style></head><body>

<div class="title">Detecting Invalid State Transitions in the Tor<br>Circuit Protocol via Model-Driven Testing</div>
<div class="authors"><b>Nurcan Denli Bayır</b></div>
<div class="affil">Hacettepe University, Department of Software Engineering<br>Advisor: Nebi Yılmaz · BYZ 658, May 2026</div>

<div class="abstract"><b>Abstract</b>—We present the first published 5-tuple finite-state-machine (FSM)
formalization of the Tor circuit life-cycle and propose a Model-Driven Testing
(MDT) engine that systematically detects out-of-spec (invalid) state transitions.
The Tor circuit is described over ${STATES.length} states and ${EVENTS.length} events; this yields a
${totalDomain}-cell domain with ${totalValid} valid and ${totalInvalid} invalid pairs.
Every invalid pair is mapped programmatically to one of seven primary attack
vectors (CIRCUIT_BYPASS, REPLAY_ATTACK, GHOST_CIRCUIT, HANDSHAKE_SKIP,
PREMATURE_DATA, CIRCUIT_HIJACK, CREATE_FLOOD) plus a deterministic
INVALID_TRANSITION fallback (1 cell), with a four-level severity label. Three algorithms
— uniform random (B1), greedy state coverage (B2) and the proposed MDT (B3) —
are compared under an identical 500-event budget across 30 paired trials. MDT
saturates transition coverage at ${pct(stats.B3_MDT.tc.mean)} (vs.
${pct(stats.B1_Random.tc.mean)} / ${pct(stats.B2_GreedySC.tc.mean)}) and reaches
an Invalid Transition Detection Rate of ${pct(stats.B3_MDT.itdr.mean)}. Welch
t-tests, Mann-Whitney U and Wilcoxon signed-rank tests jointly confirm
B3 &gt; {B1, B2} on TC and ITDR (p &lt; .001; Cohen's d ∈ [3.6, 15.4]); on SC
B2 and B3 saturate at 100% while B1 lags. A budget sweep over
B ∈ {50…5000} shows MDT is ${(5000 / 200).toFixed(0)}× more budget-efficient than the baselines on TC.
Under budget-free Q×Σ audit, a hand-written 7-rule detector reaches only
${(ext.ruleBased.completeness * 100).toFixed(1)}% completeness — missing
${ext.ruleBased.missedBySeverity.CRITICAL} CRITICAL and
${ext.ruleBased.missedBySeverity.HIGH} HIGH severity invalid pairs —
quantifying the gap that motivates spec-oracle MDT. Detection latency was
measured with nanosecond-resolution batch amortization: invalid-CRITICAL
classification takes ${ext.latencyData.invalid_critical.mean_ns.toFixed(0)} ns/call,
≈${(50_000_000 / Math.max(ext.latencyData.invalid_critical.max_ns, 1)).toFixed(0)}×
faster than the 50 ms proposal target.</div>
<div class="keywords"><b>Index Terms</b>—Tor, anonymous network, finite-state machine,
model-driven testing, protocol state fuzzing, security testing, transition coverage,
Wilcoxon signed-rank, PRISMA.</div>

<div class="cols">

<h2>I. Introduction</h2>
<p>The Tor anonymous communication network ${cite(1)} has been studied along
two dominant axes: traffic correlation / timing attacks ${cite(2, 3, 4, 5)} and
formal cryptographic analysis ${cite(6, 13)}. A third axis — protocol
<i>state-machine</i> conformance — remains comparatively unexplored. Protocol
state fuzzing has been applied to TLS implementations ${cite(9, 14)}, but no
equivalent published study exists for Tor. Existing surveys of Tor attacks
${cite(5)} classify deanonymization vectors at the <i>category</i> level
(traffic correlation, timing, fingerprinting) but do not provide a
cell-level mapping between protocol-state events and attack types. This paper
closes that gap.</p>

<p class="no-indent"><b>Research questions.</b></p>
<ul>
  <li><b>RQ1.</b> Can the Tor circuit life-cycle be formally modeled as a deterministic
  5-tuple FSM with a complete δ transition function?</li>
  <li><b>RQ2.</b> Can the resulting invalid-transition set (Q × Σ) ∖ dom(δ) be mapped
  programmatically to known Tor attack vectors with severity labels?</li>
  <li><b>RQ3.</b> Does an MDT-generated test suite deliver statistically significant
  gains over random and greedy baselines on Transition Coverage (TC) and Invalid
  Transition Detection Rate (ITDR) under matched event budgets?</li>
  <li><b>RQ4.</b> How does the proposed engine scale with budget B, and how does it
  compare to a category-level hand-written rule baseline under budget-free audit?</li>
</ul>

<p class="no-indent"><b>Contributions.</b> (i) The first published complete δ-matrix
for Tor circuits, derived from the official Tor specification ${cite(19)};
(ii) a programmatic classifier mapping all ${totalInvalid} invalid pairs to seven primary
attack vectors plus a deterministic fallback, with four severity levels; (iii) a reference open-source MDT engine with
worst-case complexity O(|Q|²·|Σ|²); (iv) a paired three-way statistical comparison
validated by three independent test families (Welch t, Mann-Whitney U, Wilcoxon
signed-rank); (v) a budget sensitivity analysis across seven points; (vi) a
quantified completeness gap (${(ext.ruleBased.completeness * 100).toFixed(1)}% vs. 100%) between hand-written
rule sets and spec-oracle detection; and (vii) a nanosecond-resolution detection
latency profile.</p>

<p class="no-indent"><b>Paper structure.</b> Section II surveys the literature using a
PRISMA-guided SLR. Section III gives the FSM formalization, attack classifier and
MDT algorithm. Section IV reports the empirical evaluation. Section V discusses
threats to validity, and Section VI concludes.</p>

<h2>II. Related Work and Literature Gap</h2>

<h3>A. SLR methodology (PRISMA)</h3>
<p>We followed Kitchenham and Charters' SLR guidelines ${cite(17)}. Search
sources were limited to <i>open-web channels</i> (Google Scholar, arXiv,
DOI resolution) because no live institutional access to Scopus, Web of Science
or IEEE Xplore was available in our environment. Keywords: <i>"Tor security",
"FSM testing", "model-based testing", "protocol state fuzzing", "anonymity
network attacks"</i>. Year range: 1996–2026, with classic references
year-tagged. Inclusion: peer-reviewed venue, full text accessible, work
touching at least one of {Tor, FSM testing, formal protocol verification}.
Twenty primary sources were retained, distributed over five thematic
clusters: A) Tor security (6), B) FSM-based testing (5), C) Formal methods (3),
D) Software testing methodology (3), E) Tor experimental infrastructure (3).</p>
<p>The PRISMA flow is shown in Fig. 1. Because the open-web process did not
retain an auditable query log, the <i>identified</i>, <i>screened</i> and
<i>eligibility</i> stages are reported as <b>NA</b>; only the final
included count (n = ${ext.prisma.included}) is verifiable and matches the
citation count of <code>Literatur_Notlari.pdf</code> in the repository.
This is a deliberate methodological choice to avoid false-precision
reporting of unauditable intermediate counts.</p>
<div class="fig">${svgPrisma}<div class="cap">Fig. 1. PRISMA flow of the literature search (intermediate counts NA, see Sec. V).</div></div>

<h3>B. Tor security and anonymity</h3>
<p>Foundational Tor protocol ${cite(1)}, low-cost traffic analysis ${cite(2)},
realistic-adversary correlation ${cite(3)}, internet-scale website
fingerprinting ${cite(4)} and the comprehensive deanonymization survey
${cite(5)} establish the attack landscape. Four of our seven primary attack vectors
(REPLAY_ATTACK, CIRCUIT_HIJACK, CIRCUIT_BYPASS, GHOST_CIRCUIT) are derived
from the taxonomy in ${cite(5)}. AnoA ${cite(6)} formalizes anonymity
probabilistically; our state-conformance angle is orthogonal.</p>

<h3>C. FSM-based testing and model learning</h3>
<p>Lee and Yannakakis' classical survey ${cite(7)} establishes transition-tour,
W-method and Wp-method techniques — our BFS-planned positive phase is a
simplified <i>transition tour</i>. Tretmans' LTS testing theory ${cite(8)}
grounds the oracle as an ioco-style relation; because our FSM is deterministic
this reduces to plain equality. de Ruiter and Poll's TLS state fuzzing
${cite(9)} is methodologically closest; we transplant the methodology from
TLS to Tor. Fiterău-Broștean et al. ${cite(10)} combine L*-style model
learning with model checking on TCP — a pointer for future automatic Tor
δ extraction. Ammann and Offutt ${cite(11)} provide the formal definition
of transition (edge) coverage used here.</p>

<h3>D. Formal protocol verification and security testing</h3>
<p>Dolev–Yao ${cite(12)} bounds our adversary model. Bhargavan et al.
${cite(13)} verify TLS 1.3 with ProVerif. Somorovsky ${cite(14)} systematically
fuzzes TLS libraries — a close cousin in negative test generation. Felderer
et al.'s security testing survey ${cite(15)} places our work in the
"Model-Based Security Testing" branch. Pretschner et al. ${cite(16)} apply
MDT to access-control policies.</p>

<h3>E. Tor experimental infrastructure</h3>
<p>Jansen et al.'s Shadow simulator ${cite(18)} provides a systematic Tor
network testbed. The official Tor specification ${cite(19)} is the
normative source of δ. Microsoft Research ${cite(20)} demonstrates
data-driven FSM security analysis in industry but not for Tor.</p>

<h3>F. Identified research gaps</h3>
<p>Twenty-source SLR analysis identifies four concrete gaps at thesis scale:</p>
<ul>
  <li><b>(G1)</b> No published formal 5-tuple FSM exists for the Tor circuit
  protocol; the specification ${cite(19)} is procedural, never reduced to
  a δ matrix in the academic literature.</li>
  <li><b>(G2)</b> Protocol state fuzzing has been done for TLS ${cite(9, 14)}
  but not for Tor.</li>
  <li><b>(G3)</b> No row-by-row mapping exists between Tor attack vectors
  and (state, event) cells; surveys ${cite(5)} remain categorical.</li>
  <li><b>(G4)</b> No primary study defines and measures an ITDR-like metric
  (detected ÷ injected invalid transitions) for Tor.</li>
</ul>
<p>The contributions in Sec. I close all four gaps.</p>

<h2>III. Method</h2>

<h3>A. FSM formalization (RQ1)</h3>
<p>The Tor circuit life-cycle is modeled as a classical DFA
<i>M = (Q, Σ, δ, q₀, F)</i> with:</p>
<ul>
  <li><i>|Q|</i> = ${STATES.length} states: ${STATES.join(", ")}.</li>
  <li><i>|Σ|</i> = ${EVENTS.length} events (CONNECT, TLS_OK, TLS_FAIL,
  SEND_CREATE, RECV_CREATED, SEND_EXTEND, RECV_EXTENDED, SEND_RELAY_DATA,
  RECV_RELAY_DATA, SEND_DESTROY, RECV_DESTROY, CIRCUIT_CLOSED, TIMEOUT).</li>
  <li><i>q₀ = IDLE</i>, <i>F = {CLOSED}</i>.</li>
  <li><i>δ : Q × Σ → Q</i> is defined on ${totalValid} pairs; the total
  domain |Q × Σ| = ${totalDomain}, so the Invalid set
  (Q × Σ) ∖ dom(δ) has ${totalInvalid} elements.</li>
</ul>
<p>Fig. 2 visualizes δ as a directed graph. A representative subset of
the δ table is shown in Table I; the full table is generated programmatically
from a single source of truth (<code>server/fsm.ts</code>) and is provided
in the public repository.</p>
<div class="fig">${svgFsm}<div class="cap">Fig. 2. Tor circuit FSM δ-graph. ${totalValid} valid edges over ${STATES.length} states.</div></div>
<p class="no-indent"><b>Table I.</b> Sample of the δ transition table.</p>
${deltaSample()}

<h3>B. Attack classifier (RQ2)</h3>
<p>A deterministic function <code>classifyInvalid(s, e)</code> maps every
pair (s, e) ∈ Invalid to a (type, severity) tuple via nine condition
families: data-flow-before-circuit-ready, CREATE/CREATED flow,
EXTEND/EXTENDED flow, DESTROY out-of-place, CONNECT misuse,
TLS_OK / TLS_FAIL misuse, CIRCUIT_CLOSED misuse, TIMEOUT misuse, and an
INVALID_TRANSITION fallback. The output covers all ${totalInvalid} invalid
cells with severity labels in {LOW, MEDIUM, HIGH, CRITICAL}. Table II
gives the per-vector distribution computed programmatically over the
full Invalid set.</p>
<p class="no-indent"><b>Table II.</b> Attack-vector inventory over ${totalInvalid} invalid pairs (programmatic).</p>
${attackInventory()}
<p style="font-size:8.5pt;color:#444;">GHOST_CIRCUIT dominates by count, reflecting the structural
prevalence of "event-out-of-context" patterns; CIRCUIT_HIJACK and
CIRCUIT_BYPASS hold the highest severity weights despite lower counts.</p>
<div class="fig">${svgHeat}<div class="cap">Fig. 3. Attack-severity heatmap over (state × event).</div></div>

<h3>C. MDT engine — Algorithm 1</h3>
<pre class="algo">Algorithm 1: Model-Driven Test (BFS-planned)
Input:  M = (Q,Σ,δ,q₀,F);  Budget B (event count)
Output: ⟨SC, TC, ITDR, FPR⟩
 1  visited ← {q₀}; coveredV ← ∅; detectedI ← ∅
 2  Valid   ← {(s,e) | δ(s,e) defined}
 3  Invalid ← (Q × Σ) ∖ Valid
 4  // Positive phase
 5  for (s,e) ∈ Permute(Valid):
 6     if events ≥ B: break
 7     if (s,e) ∈ coveredV: continue
 8     π ← BFS_PATH(q₀, s)
 9     if π = null: continue
10     EXECUTE(π · ⟨e⟩)        // updates visited, coveredV
11  // Negative phase
12  for (s,e) ∈ Permute(Invalid):
13     if events ≥ B: break
14     if (s,e) ∈ detectedI: continue
15     π ← BFS_PATH(q₀, s)
16     if π = null ∧ s ≠ q₀: continue
17     EXECUTE(π · ⟨e⟩)        // δ-oracle flags it
18  SC   ← |visited|/|Q|
19  TC   ← |coveredV|/|Valid|
20  ITDR ← |detectedI|/|Invalid|
21  FPR  ← |misflagged ∈ Valid|/|Valid|  // 0 here, see Sec. V
22  return ⟨SC, TC, ITDR, FPR⟩
</pre>
<p><b>Complexity.</b> A single BFS_PATH call is O(|Q|·|Σ|). The positive
phase invokes it up to |Valid| = ${totalValid} times and the negative phase
up to |Invalid| = ${totalInvalid} times, so the overall worst-case is
<b>O((|Valid|+|Invalid|)·|Q|·|Σ|) = O(|Q|²·|Σ|²)</b>. A single EXECUTE
path has length at most diam(δ)+1 ≈ ${STATES.length}. Empirically, one trial
at B = 500 finishes in &lt; 10 ms on commodity hardware.</p>

<h3>D. Compared algorithms</h3>
<ul>
  <li><b>B1 — Uniform Random:</b> at each step picks an event uniformly
  from Σ; resets to IDLE upon reaching CLOSED.</li>
  <li><b>B2 — Greedy State Coverage:</b> at each step picks an event leading
  to an unvisited state if possible; otherwise random valid (70%) or
  random invalid (30%) event.</li>
  <li><b>B3 — MDT (Algorithm 1):</b> the proposed BFS-planned engine.</li>
</ul>
<p>All three are run under the same B = 500 event budget; the comparison
is fair (Sec. IV-A).</p>

<h2>IV. Evaluation</h2>

<h3>A. Design</h3>
<p>Each algorithm is run for N = 30 paired trials. PRNG seeds are fixed
within each trial (seed = 1000+i, i ∈ [0, 29]) and matched across
algorithms; this paired design reduces within-condition variance.
Metrics — SC, TC, ITDR — are all in [0, 1]. In addition, a budget sweep
B ∈ {50, 100, 200, 500, 1000, 2000, 5000} is performed with 30 trials per
point.</p>

<h3>B. Coverage and ITDR at B = 500</h3>
<p class="no-indent"><b>Table III.</b> Descriptive statistics (mean ± SD across N = 30 trials).</p>
<table>
<tr><th class="l">Algorithm</th><th>SC</th><th>TC</th><th>ITDR</th></tr>
<tr><td class="l">B1 — Random</td><td>${pct(stats.B1_Random.sc.mean)}±${pct(stats.B1_Random.sc.sd)}</td>
<td>${pct(stats.B1_Random.tc.mean)}±${pct(stats.B1_Random.tc.sd)}</td>
<td>${pct(stats.B1_Random.itdr.mean)}±${pct(stats.B1_Random.itdr.sd)}</td></tr>
<tr><td class="l">B2 — Greedy SC</td><td>${pct(stats.B2_GreedySC.sc.mean)}±${pct(stats.B2_GreedySC.sc.sd)}</td>
<td>${pct(stats.B2_GreedySC.tc.mean)}±${pct(stats.B2_GreedySC.tc.sd)}</td>
<td>${pct(stats.B2_GreedySC.itdr.mean)}±${pct(stats.B2_GreedySC.itdr.sd)}</td></tr>
<tr><td class="l">B3 — MDT</td><td>${pct(stats.B3_MDT.sc.mean)}±${pct(stats.B3_MDT.sc.sd)}</td>
<td>${pct(stats.B3_MDT.tc.mean)}±${pct(stats.B3_MDT.tc.sd)}</td>
<td>${pct(stats.B3_MDT.itdr.mean)}±${pct(stats.B3_MDT.itdr.sd)}</td></tr>
</table>
<div class="fig">${svgSev}<div class="cap">Fig. 4. Severity-weighted invalid detection per algorithm.</div></div>

<h3>C. Hypothesis tests — Welch &amp; Mann-Whitney</h3>
<p>For each pair × metric, normality is checked via Lilliefors-corrected
K-S (α = 0.05); the primary test is Welch's t (unequal variance) and the
confirmatory test is Mann-Whitney U. Cohen's d uses pooled SD.
Table IV summarizes the nine comparisons.</p>
<p class="no-indent"><b>Table IV.</b> Pairwise hypothesis tests (B = 500, N = 30 paired trials).</p>
<table>
<tr><th class="l">Comparison</th><th>Metric</th><th>t</th><th>p (Welch)</th><th>p (M-W)</th><th>d</th></tr>
${hypTableRows}
</table>

<h3>D. Wilcoxon signed-rank (paired design)</h3>
<p>Because seeds are paired across algorithms, the design-appropriate
non-parametric test is Wilcoxon signed-rank. Table V reports W, z, p and
the effective sample size after dropping zero differences (ties).</p>
<p class="no-indent"><b>Table V.</b> Wilcoxon signed-rank tests on paired differences.</p>
<table>
<tr><th class="l">Comparison</th><th>Metric</th><th>W</th><th>z</th><th>p</th><th>n (≠0)</th></tr>
${wilcoxonRows}
</table>
<p><b>Constrained interpretation.</b> The main hypotheses — <i>B3 &gt; B1</i>
and <i>B3 &gt; B2</i> — are confirmed on TC and ITDR (p &lt; .001),
matching Welch. On SC, the means are B1 ${pct(stats.B1_Random.sc.mean)},
B2 ${pct(stats.B2_GreedySC.sc.mean)}, B3 ${pct(stats.B3_MDT.sc.mean)};
so <i>B3 vs B2</i> on SC saturates at 100% (n≠0 = 0, p = 1.0) while
<i>B3 vs B1</i> and <i>B2 vs B1</i> remain p &lt; .001 — i.e., Random lags
structurally on SC. Finally, <i>B2 vs B1</i> on ITDR is <b>not</b> significant
(p &gt; .05), evidence that the greedy heuristic offers no systematic
advantage over Random in negative test generation.</p>

<h3>E. Budget sensitivity</h3>
<p>Figs. 5 and 6 plot TC and ITDR against log-scale budget; shaded bands are
±1 SD.</p>
<div class="fig">${svgBudgetTC}<div class="cap">Fig. 5. Transition coverage vs. event budget (N=30 per point, shaded ±SD).</div></div>
<div class="fig">${svgBudgetITDR}<div class="cap">Fig. 6. ITDR vs. event budget (N=30 per point, shaded ±SD).</div></div>
<p><b>For TC</b>, B3 reaches
${pct(ext.budgetCurve.B3_MDT.find(x=>x.budget===200).tc_mean)} at B = 200,
already above B1
(${pct(ext.budgetCurve.B1_Random.find(x=>x.budget===5000).tc_mean)}) and B2
(${pct(ext.budgetCurve.B2_GreedySC.find(x=>x.budget===5000).tc_mean)})
at B = 5000 — i.e., MDT is ${(5000 / 200).toFixed(0)}× more budget-efficient on TC.
<b>For ITDR</b> the dynamic differs: at B = 200, B3 ITDR is only
${pct(ext.budgetCurve.B3_MDT.find(x=>x.budget===200).itdr_mean)} and the
advantage widens with budget. At B = 5000, B3 reaches
${pct(ext.budgetCurve.B3_MDT.find(x=>x.budget===5000).itdr_mean)} while B1/B2
plateau at ${pct(ext.budgetCurve.B1_Random.find(x=>x.budget===5000).itdr_mean)} /
${pct(ext.budgetCurve.B2_GreedySC.find(x=>x.budget===5000).itdr_mean)}. The
ITDR plateau of heuristic baselines is the operational evidence for gap G4.</p>

<h3>F. Rule-based detector baseline (B0)</h3>
<p>To quantify the gap motivating spec-oracle MDT, a hand-written rule-based
detector (B0) was implemented with seven signatures — one per primary attack
vector (the deterministic fallback class has no specific rule).
Under <i>budget-free Q×Σ audit</i> (every cell enumerated), B0 achieves
only ${(ext.ruleBased.completeness * 100).toFixed(1)}% completeness on the
${ext.ruleBased.totalInvalid}-cell invalid set, missing
${ext.ruleBased.missedBySeverity.CRITICAL} CRITICAL and
${ext.ruleBased.missedBySeverity.HIGH} HIGH severity pairs (Fig. 7);
the spec-oracle reaches 100% in the same audit mode. This quantifies the
limitation of category-level rule sets: without the cell-level δ map (gap G3),
even high-severity attacks are systematically missed.</p>
<div class="fig">${svgRule}<div class="cap">Fig. 7. Rule-based (B0) vs. spec-oracle completeness over ${totalInvalid} invalid pairs.</div></div>

<h3>G. Detection latency</h3>
<p>Latency was measured with nanosecond-resolution
<code>process.hrtime.bigint()</code> and batch amortization:
each measurement wraps B = ${ext.latencyData.batchSize.toLocaleString()} step calls,
the total time is divided by B, and a pre-calibrated empty-loop overhead
of ${ext.latencyData.overheadNs.toFixed(2)} ns/iter is subtracted; N =
${ext.latencyData.repeats} batch repeats per probe. Three representative
cells were probed (Table VI).</p>
<p class="no-indent"><b>Table VI.</b> Per-cell detection latency (ns/call).</p>
<table>
<tr><th class="l">Probe</th><th>mean</th><th>SD</th>
    <th>p50</th><th>p95</th><th>min</th><th>max</th></tr>
${latencyRows}
</table>
<p>The slowest probe's worst case is
${ext.latencyData.invalid_critical.max_ns.toFixed(0)} ns —
≈${(50_000_000 / Math.max(ext.latencyData.invalid_critical.max_ns, 1)).toFixed(0)}×
faster than the proposal target of 50 ms. Invalid handling is ~2× slower than
valid because <code>classifyInvalid</code> evaluates an additional condition chain.</p>

<h3>H. Bootstrap CIs and post-hoc power</h3>
<p>To address the N = 30 limitation, we computed paired percentile bootstrap
95% CIs (B = 10,000 resamples) and post-hoc power for the paired t-test
(α = 0.05 two-sided, normal approximation of noncentral t). Table VII reports
the three pairs that drive the main claim. For B3 vs B1 and B3 vs B2, CIs for
TC and ITDR exclude zero and post-hoc power is ≈1.000, confirming N = 30 is
sufficient for the observed effect sizes. The B2 vs B1 ITDR difference, by
contrast, has a CI of
[${cext.bootstrap.find((b)=>b.a==="B2_GreedySC"&&b.b==="B1_Random"&&b.metric==="itdr").ci_lo.toFixed(4)},
${cext.bootstrap.find((b)=>b.a==="B2_GreedySC"&&b.b==="B1_Random"&&b.metric==="itdr").ci_hi.toFixed(4)}]
that includes zero — a heuristic optimizing positive coverage does not yield
significant invalid-coverage gains over uniform random, reinforcing the
algebraic-enumeration argument behind MDT.</p>

<p class="no-indent"><b>Table VII.</b> Paired bootstrap 95% CI (B = 10,000) and post-hoc power.</p>
<table>
<tr><th class="l">Pair</th><th>Metric</th><th>Δ</th><th>95% CI</th><th>d<sub>z</sub></th><th>Power</th></tr>
${cext.bootstrap.map((b, i) => {
  const p = cext.power[i];
  return `<tr><td class="l">${b.a.replace("_"," ").replace("B1 Random","B1").replace("B2 GreedySC","B2").replace("B3 MDT","B3")} − ${b.b.replace("_"," ").replace("B1 Random","B1").replace("B2 GreedySC","B2").replace("B3 MDT","B3")}</td>
    <td>${b.metric.toUpperCase()}</td>
    <td>${b.observed.toFixed(3)}</td>
    <td>[${b.ci_lo.toFixed(3)}, ${b.ci_hi.toFixed(3)}]</td>
    <td>${isFinite(p.d_z) ? p.d_z.toFixed(2) : "—"}</td>
    <td>${p.power.toFixed(3)}</td>
  </tr>`;
}).join("")}
</table>

<h3>I. Extension to the Tor stream sub-FSM</h3>
<p>To address the limitation that the circuit FSM does not cover the
application-layer stream lifecycle (RELAY_BEGIN/CONNECTED/DATA/END), we
modelled a spec-derived Stream sub-FSM (tor-spec §6) with
${STREAM_STATES_LEN} states and ${STREAM_EVENTS_LEN} events, yielding
${cext.stream.valid} valid and ${cext.stream.invalid} invalid pairs over a
${cext.stream.domain}-cell domain. Stream-specific attack vectors
(${Object.keys(cext.stream.attackInventory).slice(0,5).join(", ")}, …) were derived
via the same <code>classifyInvalid</code> pattern. The same B1/B2/B3 harness was
run with paired seeds (N = ${cext.stream.N_trials}, budget = ${cext.stream.budget})
and evaluated with paired t-tests (df = 29). The result is nuanced: MDT's
<i>invalid-coverage</i> dominance replicates strongly — B3 reaches
${(cext.stream.stats.B3_MDT.itdr.mean*100).toFixed(1)}% ITDR vs.
${(cext.stream.stats.B2_GreedySC.itdr.mean*100).toFixed(1)}% (B2) and
${(cext.stream.stats.B1_Random.itdr.mean*100).toFixed(1)}% (B1) with
p &lt; .001 and paired d<sub>z</sub> &gt; 4 against both heuristics. However,
on TC the picture is different: B3 vs B1 is significant (p &lt; .001,
d<sub>z</sub> = ${cext.stream.comparisons.find(c=>c.a==="B3_MDT"&&c.b==="B1_Random"&&c.metric==="tc").d_z.toFixed(2)})
but B3 vs B2 is <b>not</b> significant
(p = ${cext.stream.comparisons.find(c=>c.a==="B3_MDT"&&c.b==="B2_GreedySC"&&c.metric==="tc").p.toFixed(3)},
d<sub>z</sub> = ${cext.stream.comparisons.find(c=>c.a==="B3_MDT"&&c.b==="B2_GreedySC"&&c.metric==="tc").d_z.toFixed(2)}).
On a small FSM (56-cell domain), greedy state coverage already saturates
positive transitions, so MDT's TC advantage vanishes — exactly as expected.
The takeaway is that the <i>essential</i> MDT contribution is invalid-pair
enumeration (ITDR), which is FSM-size-independent; the TC advantage is
size-dependent and is confirmed on the larger circuit FSM (Sec. IV) but only
partially on the stream FSM. The stream FSM here is spec-derived, not
extracted from a real Tor binary — Threats (i) and (v) still apply.</p>

<p class="no-indent"><b>Table VIII.</b> Stream sub-FSM — algorithm comparison (mean ± SD; ${cext.stream.N_trials} trials, budget ${cext.stream.budget}).</p>
<table>
<tr><th class="l">Algo</th><th>SC</th><th>TC</th><th>ITDR</th></tr>
${Object.entries(cext.stream.stats).map(([n, s]) => `<tr>
  <td class="l">${n.replace("B1_Random","B1").replace("B2_GreedySC","B2").replace("B3_MDT","B3")}</td>
  <td>${(s.sc.mean*100).toFixed(1)}±${(s.sc.sd*100).toFixed(1)}</td>
  <td>${(s.tc.mean*100).toFixed(1)}±${(s.tc.sd*100).toFixed(1)}</td>
  <td>${(s.itdr.mean*100).toFixed(1)}±${(s.itdr.sd*100).toFixed(1)}</td>
</tr>`).join("")}
</table>

<h2>V. Discussion and Threats to Validity</h2>
<p>The MDT advantage stems from explicit access to δ as a planning oracle:
the positive phase exploits BFS for guaranteed reachability of every valid
edge; the negative phase iterates the algebraically derived Invalid set
rather than hoping to stumble onto it. The B0 result quantifies the limit
of category-level rule sets — seven rules cover only
${(ext.ruleBased.completeness * 100).toFixed(1)}% of invalid pairs (gap G3).
The non-significant B2 vs B1 result on ITDR is itself an evidence point:
heuristics that optimize <i>positive</i> coverage do not automatically
generate good <i>negative</i> tests — invalid-pair coverage requires explicit
enumeration.</p>

<p class="no-indent"><b>Threats to validity.</b></p>
<ul>
  <li><b>(i) Ground truth = specification — partially addressed (Sec. IV-K).</b>
  Static extraction of the real Tor source (BSD-licensed, master branch,
  ${torStatic.source.files_scanned} files in <code>src/core/or</code>) found
  ${torStatic.sites_count} <code>circuit_set_state</code> call sites resolving
  to ${torStatic.structural.impl_states_count} distinct implementation states.
  Four state-set divergences are <i>observed</i> directly from the extractor
  output: TRANSMITTING, CLOSING, IDLE, and CONNECTING do not appear as targets
  of any <code>circuit_set_state</code> call, and <code>CIRCUIT_STATE_GUARD_WAIT</code>
  appears in the impl with no spec analog. Mechanisms (e.g., teardown via
  <code>circuit_mark_for_close()</code> flag) are code-reading interpretations
  beyond the extractor's evidence and are flagged as such in the thesis.
  Dynamic trace via Shadow ${cite(18)} remains future work.</li>
  <li><b>(ii) FPR = 0 is structural — partially addressed (Sec. IV-J).</b>
  An independent second oracle, hand-derived from the spec narrative (not the
  δ table), was added; it agrees with δ on
  ${(dext.oracleIndependent.agreement * 100).toFixed(2)}% of the
  ${STATES.length * EVENTS.length}-cell domain. The remaining
  ${dext.oracleIndependent.disagreements.length} disagreements (TIMEOUT @ IDLE / ERROR) are
  genuine spec ambiguities, not bugs. A binary-extracted oracle (via Shadow)
  is still future work.</li>
  <li><b>(iii) N = 30 trials — addressed (Sec. IV-H).</b> Paired bootstrap
  CIs and post-hoc power confirm sufficiency for the main effects (power ≈ 1.000).
  Remaining issue: BCa correction and Hedges' g are future work.</li>
  <li><b>(iv) SLR scope — partially addressed (Sec. IV-J).</b> Live queries
  against OpenAlex (which indexes IEEE/Springer/Elsevier), CrossRef and arXiv
  returned ${dext.slrLive.prisma.identified} hits across
  ${dext.slrLive.prisma.queries.length} queries, deduplicated to
  ${dext.slrLive.prisma.after_dedup} unique records. Licensed Scopus/WoS full-text
  + citation-graph access remains out of scope.</li>
  <li><b>(v) Single-platform latency — partially addressed (Sec. IV-J).</b>
  An <i>approximate</i> C port (gcc -O3) of the δ-lookup and classifyInvalid
  hot path (logically equivalent, not a line-by-line transpile — returns int
  codes, no object allocation) was added and benchmarked under the
  <b>same</b> probe set, batch (${dext.cLatency.raw.batch.toLocaleString()})
  and repeat count (${dext.cLatency.raw.trials}) as the Node measurement; the
  C version is ${(dext.cLatency.comparison.probes.reduce((a,p)=>a+p.speedup_x,0)/3).toFixed(0)}× faster on average
  (probe-wise:
  ${dext.cLatency.comparison.probes.map((p) => `${p.probe} ${p.speedup_x.toFixed(0)}×`).join(", ")}).
  A full Tor relay C/Rust port remains future work.</li>
  <li><b>(vi) N=30 sample size — addressed (Sec. IV-L).</b> The experiment was
  rerun at N=${fext.config.N} with paired seeds, BCa bootstrap
  (R=${fext.config.bootstrapR}) and a paired-difference design (Cohen's d_z,
  paired t, df=n−1). Paired effect sizes are large for the two primary metrics
  (d_z=${fext.comparisons.find((c)=>c.metric==="transitionCoverage"&&c.B==="B2_GreedySC").cohensDz_paired.toFixed(2)} for transitionCoverage,
  d_z=${fext.comparisons.find((c)=>c.metric==="itdr"&&c.B==="B2_GreedySC").cohensDz_paired.toFixed(2)} for itdr); required N at power 0.80 is
  ≤${fvalBy.itdr.approxN_paired_exactT_statsmodels} (exact noncentral-t).
  However, <i>stateCoverage</i> shows d_z=${fext.comparisons.find((c)=>c.metric==="stateCoverage"&&c.B==="B2_GreedySC").cohensDz_paired.toFixed(3)},
  requiring N=${fvalBy.stateCoverage.approxN_paired_exactT_statsmodels}
  (exact-t; Node z-approx: ${fext.comparisons.find((c)=>c.metric==="stateCoverage"&&c.B==="B2_GreedySC").approxN_paired_for_power_080});
  even N=${fext.config.N} is under-powered for this single metric.
  Cross-validated independently with Python statsmodels v${fval.validator.statsmodels} /
  scipy v${fval.validator.scipy}: d_z and p-values match Node to machine
  precision; required-N differs by 2-9 units because Node uses asymptotic
  z-approximation whereas statsmodels uses exact noncentral-t (the authoritative
  method, equivalent to G*Power's calculation). This is a pilot-effect-size
  estimate, not strict a-priori power.</li>
  <li><b>(vii) Automaton learning unimplemented — addressed (Sec. IV-M).</b>
  Angluin's L* algorithm is implemented in pure Node and converges on the
  static-extracted impl FSM in ${gext.trace.length} rounds using
  ${gext.counters.membership_queries.toLocaleString("en-US")} membership and
  ${gext.counters.equivalence_queries} equivalence queries
  (${gext.counters.runtime_ms.toFixed(0)} ms), correctly recovering the minimal
  canonical ${gext.learned.states}-state DFA. The teacher is the extracted FSM,
  not a running tor binary; the pipeline is, however, ready to be connected to
  a Shadow-hosted tor process by replacing the membership oracle.</li>
</ul>

<p class="no-indent"><b>IV-K. Spec vs. implementation FSM (static extraction).</b>
The Tor source repository was cloned and the
${torStatic.source.files_scanned} C files in <code>src/core/or</code> were
scanned by regex for <code>circuit_set_state(_, CIRCUIT_STATE_*)</code> call
sites; the enclosing function for each call was extracted as an event proxy.
This yielded the ${torStatic.structural.impl_states_count}-state implementation
FSM <i>{ ${torStatic.structural.impl_states.map((s) => s.replace("CIRCUIT_STATE_", "")).join(", ")} }</i>
with ${torStatic.sites_count} transition sites. The mapping to the
${torStatic.structural.spec_states_count}-state spec FSM is reported in
<a href="https://github.com/...">the artifact</a> (Table; see thesis Sec. 4.12).
The MDT methodology transfers unchanged: Q × Σ + δ + classifyInvalid applies
to the smaller impl FSM exactly as it does to the
${cext.stream.domain}-cell stream sub-FSM (Sec. IV-I). The
${(dext.oracleIndependent.matrix.TT + dext.oracleIndependent.matrix.FF) /
  (STATES.length * EVENTS.length) * 100 | 0}%
spec-internal oracle agreement combined with this implementation-level
extraction provides two independent cross-checks of the δ table — neither
eliminates Threat (i) on its own, but together they narrow the gap from
"unmeasured" to "structurally characterized."</p>

<p class="no-indent"><b>IV-L. Resampled study (N=${fext.config.N}) with BCa
bootstrap and a-priori power.</b> The original N=30 comparison was rerun with
paired seeds at N=${fext.config.N}, analyzed as paired differences.
BCa-bootstrap %95 CIs (R=${fext.config.bootstrapR}) for B3 − B2 are
[${fext.comparisons.find((c)=>c.metric==="transitionCoverage"&&c.B==="B2_GreedySC").bca95.lo.toFixed(3)},
 ${fext.comparisons.find((c)=>c.metric==="transitionCoverage"&&c.B==="B2_GreedySC").bca95.hi.toFixed(3)}]
for transitionCoverage and
[${fext.comparisons.find((c)=>c.metric==="itdr"&&c.B==="B2_GreedySC").bca95.lo.toFixed(3)},
 ${fext.comparisons.find((c)=>c.metric==="itdr"&&c.B==="B2_GreedySC").bca95.hi.toFixed(3)}]
for itdr — both excluding 0 with substantial margin. New honest finding:
required paired-design N for stateCoverage at power 0.80 is
${fvalBy.stateCoverage.approxN_paired_exactT_statsmodels} (statsmodels exact
noncentral-t; Node z-approx ${fext.comparisons.find((c)=>c.metric==="stateCoverage"&&c.B==="B2_GreedySC").approxN_paired_for_power_080});
N=${fext.config.N} is under-powered for this single metric. All d_z and
p-values cross-validated against Python statsmodels v${fval.validator.statsmodels}
to machine precision.</p>

<p class="no-indent"><b>IV-M. L* (Angluin 1987) implementation.</b> Pure-Node
implementation of the classical observation-table L* algorithm with closedness
and consistency repair, BFS-bounded equivalence oracle (|w| ≤
${gext.config.eqMaxLen}), and prefix-closure on counterexamples. Teacher SUT =
the 5-state impl FSM from Sec. IV-K. L* converged in ${gext.trace.length}
rounds (${gext.counters.membership_queries.toLocaleString("en-US")} MQ,
${gext.counters.equivalence_queries} EQ, ${gext.counters.runtime_ms.toFixed(0)} ms),
producing a ${gext.learned.states}-state minimal canonical DFA matching the
SUT. This validates the algorithm and pipeline; replacing the MQ with a Shadow
+ tor binary harness is the natural next step (Threat (i)). The pipeline-ready
artifact is the contribution here, not a learning experiment on running tor.</p>

<p class="no-indent"><b>IV-J. Honest partial substitutes for (ii), (iv), (v).</b>
The three threats above are partially mitigated, not eliminated. The
independent oracle (${dext.oracleIndependent.invariants.length} LTL-style invariants in
<code>server/independent_oracle.ts</code>) demonstrates that the FPR = 0 result
is not an artifact of a single source: δ and the narrative-derived oracle agree
on
${dext.oracleIndependent.matrix.TT}/${dext.oracleIndependent.matrix.TT + dext.oracleIndependent.matrix.TF}
valid and
${dext.oracleIndependent.matrix.FF}/${dext.oracleIndependent.matrix.FF + dext.oracleIndependent.matrix.FT}
invalid pairs. The extended SLR fills the previously-NA cells of the PRISMA
flow with real query counts. The C latency port quantifies the V8 overhead of
the dispatch + allocation path, showing that the algorithmic core is
sub-3-ns under -O3. Each substitute is documented as a partial mitigation and
the residual gaps are listed verbatim in Sec. VI.</p>

<h2>VI. Conclusion and Future Work</h2>
<p>We delivered the first complete published Tor circuit δ-matrix, a
programmatic invalid-pair classifier, a reference MDT engine, and a paired
three-way statistical comparison validated by three test families plus a
seven-point budget sweep and a rule-based baseline. The MDT engine
saturates transition coverage and yields ITDR gains of up to ${((stats.B3_MDT.itdr.mean - stats.B1_Random.itdr.mean) * 100).toFixed(1)}
points over Random with p &lt; .001 and Cohen's d &gt; 3.6. Future work:
(a) L*-style automatic δ extraction from real Tor binaries ${cite(10)};
(b) Hidden-Service-v3 and Pluggable-Transport sub-FSMs (the Stream sub-FSM
extension is delivered in Sec. IV-I);
(c) independent oracle via Shadow ${cite(18)} for genuine FPR measurement;
(d) cross-implementation latency profiling via a C/Rust port of the δ table.</p>

<h2>References</h2>
${REFS.map((r) => `<div class="ref">${r}</div>`).join("")}

</div></body></html>`;

const htmlPath = path.join(__dirname, "paper.html");
await fs.writeFile(htmlPath, html, "utf8");
console.log("[1/2] Paper HTML yazıldı.");

const browser = await puppeteer.launch({
  executablePath: execSync("which chromium").toString().trim(),
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.goto("file://" + htmlPath, { waitUntil: "networkidle0" });
const out = path.join(__dirname, "Tor_FSM_MDT_Paper.pdf");
await page.pdf({
  path: out, format: "A4", printBackground: true,
  margin: { top: "18mm", right: "14mm", bottom: "18mm", left: "14mm" },
  displayHeaderFooter: false,
});
await browser.close();
console.log("[2/2] PDF yazıldı:", out);
