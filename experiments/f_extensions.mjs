// F-grubu: Bölüm 6.2-ii sınırlılığına yönelik dürüst genişletme.
//   (a) N=100 yeniden koşu (paired seed) — orijinal N=30'un 3.3× büyütülmesi
//   (b) BCa bootstrap %95 GA (5000 resample) — paired difference üzerinde
//   (c) Post-hoc Cohen's d ve a-priori required-N (β=0.80, α=0.05, two-sided)
// Bağımlılık yok; saf Node. Kod: experiments/f_extensions.mjs

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runB1, runB2, runB3, EVENT_BUDGET } from "./baselines.mjs";
import { mean, sd, studentTCDF } from "./stats.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const N = 100;
const SEED_BASE = 1000;
const BOOTSTRAP_R = 5000;
const ALPHA = 0.05;
const BETA = 0.20;          // power = 0.80

const algos = { B1_Random: runB1, B2_GreedySC: runB2, B3_MDT: runB3 };
const METRICS = ["stateCoverage", "transitionCoverage", "itdr", "eventsConsumed"];

// --- 1) N=100 paired runs ---
const results = {};
for (const [name, fn] of Object.entries(algos)) {
  results[name] = [];
  for (let i = 0; i < N; i++) results[name].push(fn(SEED_BASE + i));
}

const summarize = (arr, key) => {
  const xs = arr.map((r) => r[key]);
  return { mean: mean(xs), sd: sd(xs), n: xs.length };
};

const desc = {};
for (const name of Object.keys(results))
  desc[name] = Object.fromEntries(METRICS.map((m) => [m, summarize(results[name], m)]));

// --- 2) Inverse-normal helper for power analysis (Beasley–Springer–Moro) ---
function invNormCDF(p) {
  if (p <= 0 || p >= 1) throw new Error("p out of range");
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
             1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
             6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
             -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
             3.754408661907416];
  const plow = 0.02425, phigh = 1 - plow;
  if (p < plow) { const q = Math.sqrt(-2*Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  if (p <= phigh) { const q = p-0.5, r = q*q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1); }
  const q = Math.sqrt(-2*Math.log(1-p));
  return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
          ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
}

// Approximate required-N for a PAIRED design (single sample of differences),
// two-sided, normal/z approximation with effect size dz (= mean_diff / sd_diff).
//   N ≈ ((z_{1-α/2} + z_{1-β}) / dz)^2     [paired]
// Reported as an approximate sample-size estimate from the observed pilot
// effect size, not a strict a-priori calculation.
function requiredNPaired(dz) {
  if (!isFinite(dz) || dz === 0) return Infinity;
  const z1 = invNormCDF(1 - ALPHA / 2);
  const z2 = invNormCDF(1 - BETA);
  return Math.ceil(Math.pow((z1 + z2) / Math.abs(dz), 2));
}

// --- 3) BCa bootstrap CI on paired difference (B3 - B2) ---
// Mulberry for bootstrap
function mb(seed) { let a = seed>>>0; return () => {
  a = (a + 0x6D2B79F5) >>> 0; let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function bcaCI(xs, R, seed) {
  const rng = mb(seed);
  const n = xs.length;
  const theta = mean(xs);
  // bootstrap replications
  const reps = new Float64Array(R);
  for (let r = 0; r < R; r++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += xs[(rng() * n) | 0];
    reps[r] = s / n;
  }
  reps.sort();
  // bias-correction z0
  let below = 0;
  for (let r = 0; r < R; r++) if (reps[r] < theta) below++;
  const p0 = Math.max(1/(2*R), Math.min(1 - 1/(2*R), below / R));
  const z0 = invNormCDF(p0);
  // acceleration via jackknife
  const jack = new Float64Array(n);
  let jSum = 0;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) if (j !== i) s += xs[j];
    jack[i] = s / (n - 1);
    jSum += jack[i];
  }
  const jMean = jSum / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const dj = jMean - jack[i];
    num += dj*dj*dj; den += dj*dj;
  }
  const a = num / (6 * Math.pow(den, 1.5) || 1);
  const z_a = invNormCDF(ALPHA / 2);
  const z_1a = invNormCDF(1 - ALPHA / 2);
  const adj = (z) => {
    const v = z0 + (z0 + z) / (1 - a * (z0 + z));
    return Math.max(0, Math.min(1, normalCDF(v)));
  };
  const alo = adj(z_a), ahi = adj(z_1a);
  const lo = reps[Math.max(0, Math.floor(alo * R))];
  const hi = reps[Math.min(R - 1, Math.ceil(ahi * R) - 1)];
  return { mean: theta, lo, hi, R, z0, a };
}
function normalCDF(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804 * Math.exp(-z*z/2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

// --- 4) Build PAIRED comparisons (B3 vs B2, B3 vs B1) on each metric ---
// Paired design rationale: trial i across algorithms uses the same seed
// (1000+i), so xs[i] and ys[i] are matched observations on identical input.
const compare = (A, B, key) => {
  const xs = results[A].map((r) => r[key]);
  const ys = results[B].map((r) => r[key]);
  const diffs = xs.map((x, i) => x - ys[i]);
  const n = diffs.length;
  const mDiff = mean(diffs);
  const sDiff = sd(diffs);
  // Paired Cohen's dz = mean(diff) / sd(diff)
  const dz = sDiff === 0 ? (mDiff === 0 ? 0 : Infinity) : mDiff / sDiff;
  // Paired t-test: t = mDiff / (sDiff / sqrt(n)), df = n-1
  const tStat = sDiff === 0 ? (mDiff === 0 ? 0 : Infinity) : mDiff / (sDiff / Math.sqrt(n));
  const df = n - 1;
  const pTwoSided = isFinite(tStat) ? 2 * (1 - studentTCDF(Math.abs(tStat), df)) : (mDiff === 0 ? 1 : 0);
  return {
    metric: key, A, B,
    xMean: mean(xs), yMean: mean(ys), diffMean: mDiff, diffSD: sDiff,
    cohensDz_paired: dz,
    paired_t: tStat, df, pTwoSided,
    approxN_paired_for_power_080: requiredNPaired(dz),
    bca95: bcaCI(diffs, BOOTSTRAP_R, 424242),
  };
};

const comparisons = [];
for (const key of METRICS) {
  comparisons.push(compare("B3_MDT", "B2_GreedySC", key));
  comparisons.push(compare("B3_MDT", "B1_Random", key));
}

// --- 5) Output ---
const out = {
  config: { N, seedBase: SEED_BASE, eventBudget: EVENT_BUDGET, bootstrapR: BOOTSTRAP_R, alpha: ALPHA, beta: BETA, power: 1 - BETA },
  descriptive: desc,
  comparisons,
  notes: [
    `N increased from 30 to ${N} (3.3× the original).`,
    `Paired seeds: trial i across algorithms uses seed = ${SEED_BASE}+i (same as N=30 run).`,
    `BCa bootstrap: ${BOOTSTRAP_R} resamples on paired differences. Bias-correction z0 from bootstrap distribution position relative to point estimate; acceleration a from leave-one-out jackknife on the paired-difference vector; final percentile lookup uses BCa-adjusted indices [floor(αlo·R), ceil(αhi·R)-1] without further interpolation (no tie-handling beyond array sort).`,
    `Cohen's dz_paired = mean(diff) / sd(diff); paired t = mean(diff) / (sd(diff)/sqrt(n)), df = n-1; two-sided p from Student's t CDF.`,
    `Approximate sample size for paired design at power 0.80: N ≈ ((z_{1-α/2}+z_{1-β})/dz)². This is a pilot-effect-size estimate, NOT a strict a-priori power calculation (which would require an effect size assumed BEFORE collecting data).`,
    `Limitations preserved: N=100 reduces sampling variance but does NOT broaden the input space (still BUDGET=${EVENT_BUDGET} events/trial, same seed family). Generalization across different traffic mixes still future work.`,
  ],
  generatedAt: new Date().toISOString(),
};

await fs.writeFile(path.join(__dirname, "f_extensions.json"), JSON.stringify(out, null, 2));
console.log(`F-grubu yazıldı: experiments/f_extensions.json (N=${N}, R=${BOOTSTRAP_R})`);
console.log("Özet (B3_MDT vs B2_GreedySC, PAIRED):");
for (const c of comparisons.filter((c) => c.B === "B2_GreedySC")) {
  console.log(`  ${c.metric}: Δ=${c.diffMean.toFixed(4)} (sd=${c.diffSD.toFixed(4)}), dz=${isFinite(c.cohensDz_paired)?c.cohensDz_paired.toFixed(3):"∞"}, paired_t=${isFinite(c.paired_t)?c.paired_t.toFixed(2):"∞"}, df=${c.df}, p=${c.pTwoSided.toExponential(2)}, BCa95=[${c.bca95.lo.toFixed(4)}, ${c.bca95.hi.toFixed(4)}], approxN=${c.approxN_paired_for_power_080}`);
}
