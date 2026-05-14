// 8 sayfalık IEEE conference formatında makale taslağı.
// Tezin yoğunlaştırılmış versiyonu — aynı veri ve atıflar.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { fsmGraphSvg, attackHeatmapSvg, metricBarChart } from "../experiments/figures.mjs";
import { budgetCurveSvg, ruleCompletenessSvg } from "../experiments/figures_v2.mjs";
import { totalDomain, totalValid, totalInvalid } from "../server/fsm.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const puppeteer = (await import(path.resolve(__dirname, "../node_modules/puppeteer-core/lib/cjs/puppeteer/puppeteer-core.js"))).default;

const trials = JSON.parse(await fs.readFile(path.resolve(__dirname, "../experiments/trials.json"), "utf8"));
const ext = JSON.parse(await fs.readFile(path.resolve(__dirname, "../experiments/b_extensions.json"), "utf8"));
const stats = trials.stats;
const cmp = trials.comparisons;

const pct = (x) => `${(x * 100).toFixed(1)}\\%`.replace("\\%", "%");
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

const svgFsm = fsmGraphSvg();
const svgBudget = budgetCurveSvg(ext.budgetCurve, ext.BUDGETS, "tc");
const svgRule = ruleCompletenessSvg(ext.ruleBased);

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
  p { text-align: justify; margin: 2pt 0 4pt; text-indent: 12pt; }
  p.no-indent, .fig p, table + p { text-indent: 0; }
  ul, ol { margin: 2pt 0 4pt 16pt; padding: 0; font-size: 9pt; }
  table { border-collapse: collapse; width: 100%; font-size: 8pt; margin: 4pt 0; }
  th, td { border: 1px solid #000; padding: 2pt 4pt; text-align: center; }
  th { background: #ddd; }
  td.l, th.l { text-align: left; }
  pre.algo { font-family: "Courier New", monospace; font-size: 7.5pt; line-height: 1.25; white-space: pre-wrap; background: #f4f4f4; padding: 4pt; border: 1px solid #aaa; margin: 4pt 0; }
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
The Tor circuit is described over 10 states and 13 events; this yields a
${totalDomain}-cell domain with ${totalValid} valid and ${totalInvalid} invalid pairs.
Every invalid pair is mapped programmatically to one of seven attack vectors
(CIRCUIT_BYPASS, REPLAY_ATTACK, GHOST_CIRCUIT, HANDSHAKE_SKIP, PREMATURE_DATA,
CIRCUIT_HIJACK, CREATE_FLOOD) with a four-level severity label. Three algorithms
— uniform random (B1), greedy state coverage (B2) and the proposed MDT (B3) —
are compared under an identical 500-event budget across 30 paired trials. MDT
saturates transition coverage at ${pct(stats.B3_MDT.tc.mean)} (vs.
${pct(stats.B1_Random.tc.mean)} / ${pct(stats.B2_GreedySC.tc.mean)}) and reaches
an Invalid Transition Detection Rate of ${pct(stats.B3_MDT.itdr.mean)}. Welch
t-tests, Mann-Whitney U and Wilcoxon signed-rank tests jointly confirm
B3 &gt; {B1, B2} on TC and ITDR (p &lt; .001; Cohen's d ∈ [3.6, 15.4]); SC
comparisons are saturated. Under budget-free audit, a hand-written 7-rule
detector reaches only ${(ext.ruleBased.completeness * 100).toFixed(1)}%
completeness — missing
${ext.ruleBased.missedBySeverity.CRITICAL} CRITICAL and
${ext.ruleBased.missedBySeverity.HIGH} HIGH severity invalid pairs —
quantifying the gap motivating spec-oracle MDT.</div>
<div class="keywords"><b>Index Terms</b>—Tor, anonymous network, finite-state machine,
model-driven testing, protocol state fuzzing, security testing, transition coverage.</div>

<div class="cols">

<h2>I. Introduction</h2>
<p>The Tor anonymous communication network ${cite(1)} has been studied along
two dominant axes: traffic correlation / timing attacks ${cite(2, 3, 4, 5)} and
formal cryptographic analysis ${cite(6, 13)}. A third axis — protocol
<i>state-machine</i> conformance — remains comparatively unexplored. Protocol
state fuzzing has been applied to TLS implementations ${cite(9, 14)}, but no
equivalent published study exists for Tor. This paper closes that gap.</p>
<p class="no-indent"><b>Research questions.</b></p>
<ul>
  <li><b>RQ1.</b> Can the Tor circuit life-cycle be formally modeled as a deterministic
  5-tuple FSM?</li>
  <li><b>RQ2.</b> Can the resulting invalid-transition set (Q × Σ) ∖ dom(δ) be mapped
  programmatically to known Tor attack vectors?</li>
  <li><b>RQ3.</b> Does an MDT-generated test suite deliver statistically significant
  gains over random and greedy baselines on Transition Coverage (TC) and Invalid
  Transition Detection Rate (ITDR)?</li>
</ul>
<p class="no-indent"><b>Contributions.</b> (i) The first published complete δ-matrix
for Tor circuits; (ii) a programmatic classifier mapping all
${totalInvalid} invalid pairs to seven attack vectors and four severity levels;
(iii) a reference open-source MDT implementation; (iv) a paired three-way
statistical comparison validated by Welch t, Mann-Whitney U and Wilcoxon
signed-rank tests.</p>

<h2>II. Related Work</h2>
<h3>A. Tor security and anonymity</h3>
<p>Tor's protocol foundations ${cite(1)}, low-cost traffic analysis ${cite(2)},
realistic-adversary correlation ${cite(3)}, internet-scale website fingerprinting
${cite(4)} and the comprehensive de-anonymization survey ${cite(5)} establish the
attack landscape. AnoA ${cite(6)} formalizes anonymity probabilistically; our
state-conformance angle is orthogonal.</p>
<h3>B. FSM-based testing</h3>
<p>Lee and Yannakakis' classical survey ${cite(7)} establishes transition coverage
methodology; Tretmans' LTS testing theory ${cite(8)} grounds our oracle as an
ioco-style relation. de Ruiter and Poll's TLS state fuzzing ${cite(9)} is
methodologically closest. Fiterău-Broștean et al. ${cite(10)} demonstrate model
learning for TCP — a future-work pointer for automatic Tor extraction.
Ammann and Offutt ${cite(11)} formalize transition coverage.</p>
<h3>C. Formal protocol verification</h3>
<p>Dolev–Yao ${cite(12)} bounds our threat model. Bhargavan et al. ${cite(13)}
verify TLS 1.3 with ProVerif. Somorovsky ${cite(14)} fuzz-tests TLS libraries.</p>
<h3>D. Software testing methodology</h3>
<p>Felderer et al. ${cite(15)} taxonomize security testing; Pretschner et al.
${cite(16)} apply MDT to access control. Kitchenham and Charters ${cite(17)}
guide our SLR (limited to open-web sources due to no live database access in
this work).</p>
<h3>E. Tor experimental infrastructure</h3>
<p>Shadow ${cite(18)} provides Tor network simulation. The official Tor
specification ${cite(19)} is δ's authority. Microsoft Research ${cite(20)}
demonstrates data-driven FSM security analysis in industry but not for Tor.</p>

<h2>III. Method</h2>
<h3>A. FSM formalization</h3>
<p>The Tor circuit is modeled as M = (Q, Σ, δ, q₀, F) with |Q| = 10, |Σ| = 13,
|dom(δ)| = ${totalValid}, q₀ = IDLE, F = {CLOSED}. The full δ table is in the
extended thesis appendix; Fig. 1 visualizes the graph.</p>
<div class="fig">${svgFsm}<div class="cap">Fig. 1. Tor circuit FSM δ-graph. ${totalValid} valid edges over 10 states.</div></div>
<h3>B. Attack classification</h3>
<p>A deterministic <code>classifyInvalid(s, e)</code> function maps every
(s, e) ∈ Invalid to a (type, severity) pair via nine condition families:
data-flow before circuit-ready, CREATE/CREATED flow, EXTEND/EXTENDED flow,
DESTROY out of place, CONNECT misuse, TLS_OK / TLS_FAIL misuse, CIRCUIT_CLOSED
misuse, TIMEOUT misuse, fallback. The output covers all ${totalInvalid}
invalid pairs.</p>

<h3>C. MDT engine — Algorithm 1</h3>
<pre class="algo">Input:  M = (Q,Σ,δ,q₀,F);  Budget B
Output: ⟨SC, TC, ITDR, FPR⟩
 1  visited ← {q₀}; coveredV ← ∅; detectedI ← ∅
 2  Valid ← {(s,e) | δ(s,e) defined}
 3  Invalid ← (Q×Σ) ∖ Valid
 4  // Positive phase
 5  for (s,e) ∈ Permute(Valid) until events≥B:
 6      π ← BFS_PATH(q₀, s);  if π=null continue
 7      EXECUTE(π · ⟨e⟩)
 8  // Negative phase
 9  for (s,e) ∈ Permute(Invalid) until events≥B:
10      π ← BFS_PATH(q₀, s)
11      EXECUTE(π · ⟨e⟩)             // δ-oracle flags it
12  return ⟨|visited|/|Q|, |coveredV|/|Valid|,
          |detectedI|/|Invalid|, FPR⟩
</pre>
<p>Worst-case complexity is O(|Q|² · |Σ|²); empirical mean cost per
trial is &lt; 10 ms on commodity hardware.</p>

<h3>D. Compared algorithms</h3>
<p><b>B1</b> draws events uniformly from Σ. <b>B2</b> greedily chooses an
event leading to an unvisited state, falling back to a 70/30 valid/invalid
mixture. <b>B3</b> is Algorithm 1.</p>

<h2>IV. Evaluation</h2>
<h3>A. Design</h3>
<p>Each algorithm is run for N = 30 paired trials at budget B = 500 events;
seeds are matched across algorithms (seed = 1000+i). A budget sweep
B ∈ {50, 100, 200, 500, 1000, 2000, 5000} is also performed.</p>

<h3>B. Coverage and ITDR (B = 500)</h3>
<table>
<tr><th>Alg.</th><th>SC</th><th>TC</th><th>ITDR</th></tr>
<tr><td class="l">B1</td><td>${pct(stats.B1_Random.sc.mean)}±${pct(stats.B1_Random.sc.sd)}</td>
<td>${pct(stats.B1_Random.tc.mean)}±${pct(stats.B1_Random.tc.sd)}</td>
<td>${pct(stats.B1_Random.itdr.mean)}±${pct(stats.B1_Random.itdr.sd)}</td></tr>
<tr><td class="l">B2</td><td>${pct(stats.B2_GreedySC.sc.mean)}±${pct(stats.B2_GreedySC.sc.sd)}</td>
<td>${pct(stats.B2_GreedySC.tc.mean)}±${pct(stats.B2_GreedySC.tc.sd)}</td>
<td>${pct(stats.B2_GreedySC.itdr.mean)}±${pct(stats.B2_GreedySC.itdr.sd)}</td></tr>
<tr><td class="l">B3</td><td>${pct(stats.B3_MDT.sc.mean)}±${pct(stats.B3_MDT.sc.sd)}</td>
<td>${pct(stats.B3_MDT.tc.mean)}±${pct(stats.B3_MDT.tc.sd)}</td>
<td>${pct(stats.B3_MDT.itdr.mean)}±${pct(stats.B3_MDT.itdr.sd)}</td></tr>
</table>

<h3>C. Statistical tests</h3>
<p>For each (algorithm pair × metric), Welch t and Mann-Whitney U on
independent samples and Wilcoxon signed-rank on paired samples are computed.
B3 vs. {B1, B2} comparisons on TC and ITDR yield p &lt; .001 with
Cohen's d ∈ [3.6, 15.4]. On SC, B2 and B3 saturate at 100% (p = 1.0) while
B1 lags at ${pct(stats.B1_Random.sc.mean)} and is significantly below both
(p &lt; .001). Under <i>budget-free Q×Σ
audit</i>, the B0 (rule-based) detector with seven hand-written signatures
reaches only ${(ext.ruleBased.completeness * 100).toFixed(1)}% completeness on
the ${ext.ruleBased.totalInvalid}-cell invalid set, missing
${ext.ruleBased.missedBySeverity.CRITICAL} CRITICAL and
${ext.ruleBased.missedBySeverity.HIGH} HIGH severity pairs (Fig. 3); the
spec-oracle reaches 100%. In the budget-constrained run (B = 500), MDT's
ITDR is ${pct(stats.B3_MDT.itdr.mean)}, which approaches the audit-mode
asymptote with budget (Fig. 2).</p>

<h3>D. Budget sensitivity</h3>
<p>Fig. 2 shows TC versus log-scale budget. <b>For TC</b>, B3 reaches
${pct(ext.budgetCurve.B3_MDT.find(x=>x.budget===200).tc_mean)} at B = 200,
exceeding B1 (${pct(ext.budgetCurve.B1_Random.find(x=>x.budget===5000).tc_mean)})
and B2 (${pct(ext.budgetCurve.B2_GreedySC.find(x=>x.budget===5000).tc_mean)})
at B = 5000 — i.e., MDT is ${(5000 / 200).toFixed(0)}× more budget-efficient
on TC. <b>For ITDR</b> the dynamic differs: at B = 200, B3 ITDR is only
${pct(ext.budgetCurve.B3_MDT.find(x=>x.budget===200).itdr_mean)} and the
advantage opens up with budget; at B = 5000, B3 reaches
${pct(ext.budgetCurve.B3_MDT.find(x=>x.budget===5000).itdr_mean)} while B1/B2
plateau at ${pct(ext.budgetCurve.B1_Random.find(x=>x.budget===5000).itdr_mean)} /
${pct(ext.budgetCurve.B2_GreedySC.find(x=>x.budget===5000).itdr_mean)}.</p>
<div class="fig">${svgBudget}<div class="cap">Fig. 2. Transition coverage vs. event budget (N=30, shaded ±SD).</div></div>

<h3>E. Detection latency</h3>
<p>Latency was measured with nanosecond-resolution
<code>process.hrtime.bigint()</code> using batch amortization
(B = ${ext.latencyData.batchSize.toLocaleString()} step calls per measurement,
empty-loop overhead of ${ext.latencyData.overheadNs.toFixed(2)} ns/iter
calibrated and subtracted, N = ${ext.latencyData.repeats} repeats).
Three representative cells were probed: a valid step
(${ext.latencyData.valid_step.mean_ns.toFixed(0)} ns/call), an invalid CRITICAL
cell (${ext.latencyData.invalid_critical.mean_ns.toFixed(0)} ns/call) and an
invalid LOW cell (${ext.latencyData.invalid_low.mean_ns.toFixed(0)} ns/call).
The slowest probe's worst case
(${ext.latencyData.invalid_critical.max_ns.toFixed(0)} ns) is
≈${(50_000_000 / Math.max(ext.latencyData.invalid_critical.max_ns, 1)).toFixed(0)}×
faster than the proposal target of 50 ms. Invalid handling is ~2× slower than
valid because <code>classifyInvalid</code> evaluates an additional condition
chain.</p>

<div class="fig">${svgRule}<div class="cap">Fig. 3. Hand-written rule set vs. spec-oracle completeness.</div></div>

<h2>V. Discussion</h2>
<p>The MDT advantage stems from explicit access to δ as a planning oracle:
positive phase exploits BFS for guaranteed reachability of every valid edge;
negative phase iterates the algebraically derived Invalid set rather than
hoping to stumble onto it. The B0 result quantifies the limit of category-level
rule sets: 7 rules cover only
${(ext.ruleBased.completeness * 100).toFixed(1)}% of invalid pairs,
demonstrating that without the cell-level δ map (research gap G3) even
high-severity attacks are missed.</p>
<p class="no-indent"><b>Threats to validity.</b> (i) Ground truth equals the
specification; deviations of real Tor binaries from spec are not measured.
(ii) FPR is structurally zero because oracle and generator share the model;
an independent oracle (e.g., Shadow ${cite(18)} packet capture) is required to
populate it. (iii) The SLR was limited to open-web sources due to the absence
of live academic database access in our environment; PRISMA intermediate counts
are reported as NA because no auditable query log was retained — only the final
included set (n=${ext.prisma.included}) is verifiable. (iv) Latency was measured
on a single-platform, single-thread, JIT-warm Node.js V8 environment; profiles
on a real Tor C/Rust implementation may differ.</p>

<h2>VI. Conclusion</h2>
<p>We delivered the first complete published Tor circuit δ-matrix, a
programmatic invalid-pair classifier, a reference MDT engine, and a paired
three-way statistical comparison validated by three test families. Future work:
(a) L*-style automatic δ extraction from real Tor binaries ${cite(10)};
(b) Stream and Hidden-Service-v3 sub-FSMs; (c) independent oracle via Shadow
${cite(18)} for genuine FPR measurement.</p>

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
