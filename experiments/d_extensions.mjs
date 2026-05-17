// D-grubu eklemeleri (dürüst kısmi ikameler):
//   (15) Bağımsız 2. oracle — spec metin invariant'larından türetilmiş, δ ile karşılaştırma
//   (16) SLR genişletme — OpenAlex + CrossRef + arXiv canlı sorgu
//   (17) C portu latency — gcc -O3 + Node karşılaştırma oranı
//
// Yapılmayanlar (açıkça): real Tor binary FSM çıkarımı, Scopus/WoS lisanslı erişim,
// gerçek Tor relay C/Rust port. Bu modüller "kısmi ikame"dir, tam çözüm değildir.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { STATES, EVENTS, VALID, k, classifyInvalid } from "../server/fsm.ts";
import { oracleAllows, ORACLE_INVARIANTS } from "../server/independent_oracle.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================
// (15) Bağımsız oracle karşılaştırması
// ============================================================
const oracleMatrix = { TT: 0, TF: 0, FT: 0, FF: 0, disagreements: [] };
for (const s of STATES) for (const e of EVENTS) {
  const deltaValid = VALID[k(s, e)] !== undefined;
  const oracleAllow = oracleAllows(s, e);
  if (deltaValid && oracleAllow) oracleMatrix.TT++;
  else if (!deltaValid && !oracleAllow) oracleMatrix.FF++;
  else if (deltaValid && !oracleAllow) {
    oracleMatrix.TF++;
    oracleMatrix.disagreements.push({ s, e, delta: "VALID", oracle: "DENIED" });
  } else {
    oracleMatrix.FT++;
    oracleMatrix.disagreements.push({ s, e, delta: "INVALID", oracle: "ALLOWED" });
  }
}
const agreement = (oracleMatrix.TT + oracleMatrix.FF) / (STATES.length * EVENTS.length);

// ============================================================
// (16) SLR genişletme — OpenAlex + CrossRef + arXiv canlı sorgular
// ============================================================
async function fetchJson(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Hacettepe-BYZ658-SLR/1.0 (academic)" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(id); }
}

const QUERIES = [
  "tor anonymity network protocol attack",
  "model-based testing finite state machine protocol",
  "protocol state fuzzing TLS",
  "tor deanonymization circuit",
  "finite state machine security vulnerability detection",
];

const slr = { openalex: [], crossref: [], arxiv: [], merged: [] };

// OpenAlex (free, no key, indexes IEEE/Springer/Elsevier including paywalled)
for (const q of QUERIES) {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(q)}&filter=publication_year:2020-2026&per-page=15`;
  try {
    const j = await fetchJson(url);
    for (const w of (j.results || [])) {
      slr.openalex.push({
        q, doi: w.doi || null, title: w.title, year: w.publication_year,
        cites: w.cited_by_count,
        venue: w.primary_location?.source?.display_name || w.host_venue?.display_name || null,
      });
    }
  } catch (err) { console.warn(`OpenAlex query failed for "${q}":`, err.message); }
}

// CrossRef (free, no key)
for (const q of QUERIES.slice(0, 3)) {
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=10&filter=from-pub-date:2020,until-pub-date:2026&select=DOI,title,issued,is-referenced-by-count,container-title`;
  try {
    const j = await fetchJson(url);
    for (const w of (j.message?.items || [])) {
      slr.crossref.push({
        q, doi: w.DOI || null, title: (w.title || [])[0] || null,
        year: w.issued?.["date-parts"]?.[0]?.[0] || null,
        cites: w["is-referenced-by-count"] || 0,
        venue: (w["container-title"] || [])[0] || null,
      });
    }
  } catch (err) { console.warn(`CrossRef query failed for "${q}":`, err.message); }
}

// arXiv (free, no key) — XML, basit parse
for (const q of QUERIES.slice(0, 3)) {
  const url = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent("all:" + q)}&start=0&max_results=10&sortBy=submittedDate&sortOrder=descending`;
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 30000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(id);
    const xml = await r.text();
    const entries = xml.split("<entry>").slice(1);
    for (const en of entries) {
      const title = (en.match(/<title>([\s\S]+?)<\/title>/)?.[1] || "").replace(/\s+/g, " ").trim();
      const id = en.match(/<id>([\s\S]+?)<\/id>/)?.[1] || null;
      const year = parseInt(en.match(/<published>(\d{4})/)?.[1] || "0", 10) || null;
      if (title) slr.arxiv.push({ q, arxivId: id, title, year, cites: null, venue: "arXiv" });
    }
  } catch (err) { console.warn(`arXiv query failed for "${q}":`, err.message); }
}

// Merge & deduplicate by DOI / normalized title
const seen = new Set();
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
for (const src of ["openalex", "crossref", "arxiv"]) {
  for (const w of slr[src]) {
    const key = w.doi ? `doi:${w.doi.toLowerCase()}` : `t:${norm(w.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slr.merged.push({ source: src, ...w });
  }
}
slr.merged.sort((a, b) => (b.cites || 0) - (a.cites || 0));

const prismaUpdated = {
  identified: slr.openalex.length + slr.crossref.length + slr.arxiv.length,
  after_dedup: slr.merged.length,
  by_source: { openalex: slr.openalex.length, crossref: slr.crossref.length, arxiv: slr.arxiv.length },
  queries: QUERIES,
  fetched_at: new Date().toISOString(),
  note: "OpenAlex + CrossRef + arXiv canlı sorgular; Scopus/WoS lisanslı erişim hâlâ yok.",
};

// ============================================================
// (17) C portu latency — derle ve çalıştır
// ============================================================
let cLatency = null;
try {
  const cdir = path.resolve(__dirname, "c_latency");
  execSync(`gcc -O3 -o ${cdir}/c_latency ${cdir}/c_latency.c`, { stdio: "pipe" });
  const out = execSync(`${cdir}/c_latency`, { encoding: "utf8" });
  cLatency = JSON.parse(out);
} catch (err) {
  console.warn("C latency build/run failed:", err.message);
}

// Node tarafı b_extensions.json'dan al
const bext = JSON.parse(await fs.readFile(path.resolve(__dirname, "b_extensions.json"), "utf8"));
const compare = cLatency ? {
  probes: ["valid_step", "invalid_critical", "invalid_low"].map((p) => ({
    probe: p,
    node_mean_ns: bext.latencyData[p].mean_ns,
    c_mean_ns: cLatency[p].mean_ns,
    speedup_x: bext.latencyData[p].mean_ns / Math.max(cLatency[p].mean_ns, 0.01),
  })),
} : null;

// ============================================================
// Persist
// ============================================================
const out = {
  oracleIndependent: {
    invariants: ORACLE_INVARIANTS,
    matrix: { TT: oracleMatrix.TT, TF: oracleMatrix.TF, FT: oracleMatrix.FT, FF: oracleMatrix.FF },
    agreement,
    disagreements: oracleMatrix.disagreements,
    note: "İki oracle da spec-türevli (biri δ tablosu, diğeri narrative invariants). Gerçek Tor binary'den çıkarma DEĞİLDİR; o Shadow gerektirir.",
  },
  slrLive: {
    prisma: prismaUpdated,
    topByCitations: slr.merged.slice(0, 25).map((w) => ({
      source: w.source, title: w.title, year: w.year, cites: w.cites, doi: w.doi, venue: w.venue,
    })),
    note: "OpenAlex IEEE/Springer/Elsevier dahil indeksli kataloglara erişir; Scopus/WoS değildir.",
  },
  cLatency: {
    raw: cLatency,
    comparison: compare,
    note: "Tor C portu DEĞİLDİR; sadece δ-lookup + classifyInvalid hot path'i için cross-language karşılaştırma.",
  },
};

await fs.writeFile(path.resolve(__dirname, "d_extensions.json"), JSON.stringify(out, null, 2), "utf8");
console.log("[15] Oracle agreement:", (agreement * 100).toFixed(2) + "%", `(${oracleMatrix.TT}+${oracleMatrix.FF}/${STATES.length * EVENTS.length})`);
console.log("[16] SLR canlı kayıtlar:", prismaUpdated.identified, "→ dedupe:", prismaUpdated.after_dedup);
console.log("[17] C latency:", cLatency ? "OK" : "FAILED");
if (compare) {
  for (const c of compare.probes) console.log(`     ${c.probe}: Node ${c.node_mean_ns.toFixed(1)}ns / C ${c.c_mean_ns.toFixed(1)}ns = ${c.speedup_x.toFixed(2)}x`);
}
console.log("Yazıldı: experiments/d_extensions.json");
