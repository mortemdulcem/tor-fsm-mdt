// Hand-rolled statistical primitives. No external libs. All formulas standard.

export const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
export const variance = (xs) => {
  const m = mean(xs);
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1); // unbiased, n-1
};
export const sd = (xs) => Math.sqrt(variance(xs));

// Welch's t-test (does not assume equal variances). Returns {t, df, p_two_tailed}.
export function welchT(xs, ys) {
  const m1 = mean(xs), m2 = mean(ys);
  const v1 = variance(xs), v2 = variance(ys);
  const n1 = xs.length, n2 = ys.length;
  const seSq = v1 / n1 + v2 / n2;
  if (seSq === 0) return { t: 0, df: n1 + n2 - 2, p: 1 };
  const t = (m1 - m2) / Math.sqrt(seSq);
  // Welch–Satterthwaite df
  const df = (seSq ** 2) / ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1));
  const p = 2 * (1 - studentTCDF(Math.abs(t), df));
  return { t, df, p };
}

// Cohen's d (pooled SD, classical formulation).
export function cohensD(xs, ys) {
  const v1 = variance(xs), v2 = variance(ys);
  const n1 = xs.length, n2 = ys.length;
  const sp = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2));
  if (sp === 0) return mean(xs) === mean(ys) ? 0 : Infinity;
  return (mean(xs) - mean(ys)) / sp;
}

// Mann-Whitney U test, normal approximation with tie correction.
// Returns {U, z, p_two_tailed}.
export function mannWhitneyU(xs, ys) {
  const n1 = xs.length, n2 = ys.length;
  const all = xs.map((v) => ({ v, g: 1 })).concat(ys.map((v) => ({ v, g: 2 })));
  all.sort((a, b) => a.v - b.v);
  // assign ranks (average for ties)
  let i = 0;
  while (i < all.length) {
    let j = i;
    while (j + 1 < all.length && all[j + 1].v === all[i].v) j++;
    const avg = (i + j) / 2 + 1; // ranks are 1-based
    for (let kk = i; kk <= j; kk++) all[kk].rank = avg;
    i = j + 1;
  }
  const R1 = all.filter((x) => x.g === 1).reduce((a, b) => a + b.rank, 0);
  const U1 = R1 - (n1 * (n1 + 1)) / 2;
  const U2 = n1 * n2 - U1;
  const U = Math.min(U1, U2);
  const meanU = (n1 * n2) / 2;
  // tie-corrected SD
  const N = n1 + n2;
  const tieGroups = new Map();
  for (const x of all) tieGroups.set(x.v, (tieGroups.get(x.v) || 0) + 1);
  let tieSum = 0;
  for (const t of tieGroups.values()) if (t > 1) tieSum += t ** 3 - t;
  const sigU = Math.sqrt(((n1 * n2) / 12) * (N + 1 - tieSum / (N * (N - 1))));
  if (sigU === 0) return { U, z: 0, p: 1 };
  const z = (U - meanU) / sigU;
  const p = 2 * (1 - normalCDF(Math.abs(z)));
  return { U, z, p };
}

// --- Distribution helpers ---

// Standard normal CDF via Abramowitz & Stegun 7.1.26 (max abs error 7.5e-8).
export function normalCDF(x) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}

// Student t CDF via regularized incomplete beta function.
export function studentTCDF(t, df) {
  if (!isFinite(t)) return t > 0 ? 1 : 0;
  const x = df / (df + t * t);
  const ib = regIncompleteBeta(df / 2, 0.5, x);
  const p = 1 - 0.5 * ib;
  return t >= 0 ? p : 1 - p;
}

// Regularized incomplete beta I_x(a,b) via continued fraction (Numerical Recipes).
export function regIncompleteBeta(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;
  // Lentz's algorithm
  const fpmin = 1e-30;
  let c = 1, d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < fpmin) d = fpmin;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c; if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c; if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 3e-7) break;
  }
  return front * h;
}

// log-Gamma via Lanczos approximation (g=7, 9 coefficients).
export function lnGamma(z) {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

// Shapiro-Wilk style: Lilliefors-corrected K-S vs normal as a lightweight normality probe.
// Returns {D, criticalAt05, normal}. K-S statistic against fitted normal.
export function ksNormality(xs) {
  const n = xs.length;
  const m = mean(xs), s = sd(xs);
  if (s === 0) return { D: 0, criticalAt05: 0, normal: true };
  const sorted = [...xs].sort((a, b) => a - b);
  let D = 0;
  for (let i = 0; i < n; i++) {
    const F = normalCDF((sorted[i] - m) / s);
    const eUp = (i + 1) / n;
    const eLo = i / n;
    D = Math.max(D, Math.abs(F - eUp), Math.abs(F - eLo));
  }
  // Lilliefors approximate critical value at α=0.05 (Dallal & Wilkinson 1986).
  const crit = 0.886 / Math.sqrt(n); // n>=5
  return { D, criticalAt05: crit, normal: D < crit };
}
