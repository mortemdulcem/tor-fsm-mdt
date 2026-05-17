// G-grubu: Angluin L* algoritmasının saf Node implementasyonu.
//
// Amaç ve sınır: L* literatürde "running tor binary'yi black-box olarak
// öğrenmek" için kullanılır (Shadow + libalf). Bu ortamda running tor
// kurulamaz; bu yüzden L*'yi STATİK ÇIKARILMIŞ impl FSM (Bölüm 4.12) üzerinde
// teacher olarak çalıştırıyoruz. Bu, algoritmanın doğru implement edildiğinin
// kanıtıdır ve aynı pipeline'ın tor binary'sine bağlanabilirliğini gösterir;
// AMA gerçek runtime öğrenme yapılmamıştır.
//
// Referans: Angluin (1987) "Learning Regular Sets from Queries and
// Counterexamples", Information and Computation 75(2): 87-106.
//
// Teacher (MAT — Minimally Adequate Teacher):
//   • Membership query MQ(w):  true if event sequence w is accepted (i.e.,
//     leads from initial state to an "open" / final state) in the SUT.
//   • Equivalence query EQ(H): returns null if H ≡ SUT, else a counterexample.
//
// SUT: 5-state implementation FSM extracted from tor source (4.12).
//   States: BUILDING, ONIONSKIN_PENDING, CHAN_WAIT, GUARD_WAIT, OPEN
//   Initial: BUILDING; Accepting: {OPEN, GUARD_WAIT}
//   Transitions: derived from the 9 circuit_set_state() call sites'
//   function names, mapped to a small alphabet of events.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- SUT definition ---
// Alphabet of events (derived from impl call-site function names):
//   c = circuit_set_state to ONIONSKIN_PENDING (server-side create received)
//   k = circuit_set_state to CHAN_WAIT (origin init, waiting for channel)
//   o = channel done → OPEN (n_chan_done; also build_no_more_hops → OPEN; relay msg → OPEN)
//   g = build_no_more_hops alt path → GUARD_WAIT
//   b = send_first_onion_skin / extend_to_new_exit → BUILDING
//   u = upgrade_circuits_from_guard_wait → OPEN
const SIGMA = ["c", "k", "b", "o", "g", "u"];

// Deterministic SUT transition function (designed conservatively to reflect
// only structural facts observed in 4.12; semantically a minimal model).
// Transitions absent below are implicit self-loops in the SUT (i.e., the
// event is observed but does not change the FSM state in our model).
const INIT = "INIT";  // pre-circuit (no impl state; modeling artifact for L*)
const SUT_DELTA = {
  [INIT]:               { c: "ONIONSKIN_PENDING", k: "CHAN_WAIT" },
  CHAN_WAIT:            { o: "OPEN" },
  ONIONSKIN_PENDING:    { b: "BUILDING" },
  BUILDING:             { o: "OPEN", g: "GUARD_WAIT" },
  GUARD_WAIT:           { u: "OPEN" },
  OPEN:                 {},
};
const ACCEPTING = new Set(["OPEN", "GUARD_WAIT"]);

let mqCount = 0, eqCount = 0;

function runSUT(word) {
  let s = INIT;
  for (const a of word) {
    s = (SUT_DELTA[s] && SUT_DELTA[s][a]) || s; // implicit self-loop
  }
  return s;
}

function MQ(word) {
  mqCount++;
  return ACCEPTING.has(runSUT(word));
}

// --- Observation table ---
function buildTable() {
  return { S: [""], E: [""], T: new Map(), rows: () => null };
}
const concat = (a, b) => a + b;
function rowKey(s, table) { return table.E.map((e) => MQ(concat(s, e)) ? "1" : "0").join(""); }
function fillTable(table) {
  const all = new Set([...table.S, ...table.S.flatMap((s) => SIGMA.map((a) => s + a))]);
  for (const s of all) table.T.set(s, rowKey(s, table));
}
function isClosed(table) {
  for (const s of table.S) {
    for (const a of SIGMA) {
      const sa = s + a;
      const r = table.T.get(sa);
      if (!table.S.some((s2) => table.T.get(s2) === r)) return sa;
    }
  }
  return null;
}
function isConsistent(table) {
  const sList = table.S;
  for (let i = 0; i < sList.length; i++) for (let j = i+1; j < sList.length; j++) {
    if (table.T.get(sList[i]) !== table.T.get(sList[j])) continue;
    for (const a of SIGMA) {
      const ri = table.T.get(sList[i] + a), rj = table.T.get(sList[j] + a);
      if (ri !== rj) {
        for (let p = 0; p < ri.length; p++) if (ri[p] !== rj[p]) return a + table.E[p];
      }
    }
  }
  return null;
}

// Build hypothesis DFA from closed+consistent table.
function buildHypothesis(table) {
  const stateMap = new Map(); // rowKey -> repState (string)
  for (const s of table.S) if (!stateMap.has(table.T.get(s))) stateMap.set(table.T.get(s), s);
  const states = Array.from(stateMap.values());
  const delta = {};
  const accept = new Set();
  for (const s of states) {
    delta[s] = {};
    if (MQ(s)) accept.add(s);
    for (const a of SIGMA) {
      const sa = s + a;
      const rep = stateMap.get(table.T.get(sa)) ?? stateMap.get(rowKey(sa, table));
      delta[s][a] = rep;
    }
  }
  return { states, init: "", accept, delta };
}

function runHyp(H, word) {
  let s = H.init;
  for (const a of word) s = H.delta[s][a];
  return s;
}

// Equivalence query: exhaustive enumeration up to length L. If H matches SUT
// on every word of length ≤ L, declare equivalent (for this bounded scope).
function EQ(H, maxLen = 6) {
  eqCount++;
  // BFS over Σ* up to maxLen
  const queue = [""];
  while (queue.length) {
    const w = queue.shift();
    if (MQ(w) !== H.accept.has(runHyp(H, w))) return w;
    if (w.length < maxLen) for (const a of SIGMA) queue.push(w + a);
  }
  return null;
}

// --- L* main loop ---
function lStar() {
  const table = buildTable();
  const trace = [];
  let H = null;
  for (let round = 0; round < 30; round++) {
    fillTable(table);
    let cs;
    while ((cs = isClosed(table)) || (cs = isConsistent(table))) {
      if (isClosed(table)) {
        // close: add cs to S
        if (!table.S.includes(cs)) table.S.push(cs);
      } else {
        // consistency violation: add column
        if (!table.E.includes(cs)) table.E.push(cs);
      }
      fillTable(table);
    }
    H = buildHypothesis(table);
    const ce = EQ(H, 6);
    trace.push({ round, S_size: table.S.length, E_size: table.E.length, hypStates: H.states.length, ce });
    if (!ce) break;
    // add all prefixes of ce to S
    for (let i = 1; i <= ce.length; i++) {
      const p = ce.slice(0, i);
      if (!table.S.includes(p)) table.S.push(p);
    }
  }
  return { H, trace };
}

const t0 = process.hrtime.bigint();
const { H, trace } = lStar();
const dtMs = Number(process.hrtime.bigint() - t0) / 1e6;

const out = {
  config: { alphabet: SIGMA, eqMaxLen: 6, sutStates: Object.keys(SUT_DELTA).length, sutAccepting: [...ACCEPTING] },
  sut: { delta: SUT_DELTA, accepting: [...ACCEPTING], init: INIT },
  learned: {
    states: H.states.length,
    accepting: [...H.accept],
    delta: H.delta,
  },
  trace,
  counters: { membership_queries: mqCount, equivalence_queries: eqCount, runtime_ms: dtMs },
  conclusion: [
    `L* converged in ${trace.length} round(s) using ${mqCount} membership + ${eqCount} equivalence queries.`,
    `Learned DFA has ${H.states.length} states; SUT has ${Object.keys(SUT_DELTA).length} distinct states.`,
    `EQ is bounded (words up to length 6, |Σ|=${SIGMA.length}); full equivalence beyond this bound is not proved by this experiment.`,
  ],
  honest_scope: [
    "Teacher SUT = static-extracted impl FSM from Sec. 4.12, not a running tor binary.",
    "Membership oracle = direct call to SUT.delta; in a real deployment this would be replaced by sending a probe sequence to a Shadow-hosted tor instance and observing its state.",
    "Equivalence oracle = bounded exhaustive enumeration. Real-world replacement: Wp-method or random sampling against the SUT.",
    "Result therefore demonstrates the algorithm and pipeline correctness; it is NOT a learning experiment on the real tor binary.",
  ],
  generatedAt: new Date().toISOString(),
};

await fs.writeFile(path.join(__dirname, "g_extensions.json"), JSON.stringify(out, null, 2));
console.log(`L* converged: ${trace.length} round(s), MQ=${mqCount}, EQ=${eqCount}, ${dtMs.toFixed(1)}ms`);
console.log(`Learned DFA states: ${H.states.length} (SUT: ${Object.keys(SUT_DELTA).length})`);
console.log(`Wrote: experiments/g_extensions.json`);
