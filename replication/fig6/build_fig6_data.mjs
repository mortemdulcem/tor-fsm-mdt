import { ALGORITHMS, N_TRIALS, EVENT_BUDGET, mulberry32 as mb } from "./baselines.mjs";
import { STATES, EVENTS, VALID, validKeys, totalInvalid, k, classifyInvalid } from "../server/fsm.ts";

function exec(name, seed) {
  const rand = mb(seed);
  const visited = new Set(["IDLE"]);
  const coveredValid = new Set();
  const detectedInvalid = new Set();
  let s = "IDLE", events = 0;
  const stepImpl = (state, e) => {
    events++;
    const key = k(state, e);
    const next = VALID[key];
    if (next !== undefined) { coveredValid.add(key); visited.add(next); return next; }
    detectedInvalid.add(key); return state;
  };
  if (name === "B1_Random") {
    while (events < EVENT_BUDGET) { const e = EVENTS[Math.floor(rand() * EVENTS.length)]; s = stepImpl(s, e); if (s === "CLOSED") s = "IDLE"; }
  } else if (name === "B2_GreedySC") {
    while (events < EVENT_BUDGET) {
      const validHere = EVENTS.filter((e) => VALID[k(s, e)] !== undefined);
      const unvisitedValid = validHere.filter((e) => !visited.has(VALID[k(s, e)]));
      const invalidHere = EVENTS.filter((e) => VALID[k(s, e)] === undefined);
      let e;
      if (unvisitedValid.length > 0) e = unvisitedValid[Math.floor(rand() * unvisitedValid.length)];
      else if (validHere.length > 0 && rand() > 0.3) e = validHere[Math.floor(rand() * validHere.length)];
      else if (invalidHere.length > 0) e = invalidHere[Math.floor(rand() * invalidHere.length)];
      else e = EVENTS[Math.floor(rand() * EVENTS.length)];
      s = stepImpl(s, e); if (s === "CLOSED") s = "IDLE";
    }
  } else {
    const findPath = (target) => {
      if (target === "IDLE") return [];
      const q = [{ state: "IDLE", path: [] }]; const seen = new Set(["IDLE"]);
      while (q.length) { const { state, path } = q.shift();
        for (const e of EVENTS) { const nx = VALID[k(state, e)]; if (!nx || seen.has(nx)) continue;
          const np = [...path, e]; if (nx === target) return np; seen.add(nx); q.push({ state: nx, path: np }); } }
      return null; };
    const shuf = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const execSeq = (events_) => { let st = "IDLE"; for (const e of events_) { if (events >= EVENT_BUDGET) return; st = stepImpl(st, e); } };
    for (const vk of shuf(validKeys)) { if (events >= EVENT_BUDGET) break; if (coveredValid.has(vk)) continue;
      const [src, evt] = vk.split("|"); const p = findPath(src); if (p === null) continue; execSeq([...p, evt]); }
    const invalidPairs = [];
    for (const ss of STATES) for (const ee of EVENTS) if (VALID[k(ss, ee)] === undefined) invalidPairs.push([ss, ee]);
    for (const [src, evt] of shuf(invalidPairs)) { if (events >= EVENT_BUDGET) break; if (detectedInvalid.has(k(src, evt))) continue;
      const p = findPath(src); if (p === null && src !== "IDLE") continue; execSeq([...(p ?? []), evt]); }
  }
  return { detectedInvalid };
}
const SEVMAP = { LOW:"P1", MEDIUM:"P2", HIGH:"P3", CRITICAL:"P4" };
const out = {};
for (const name of Object.keys(ALGORITHMS)) {
  const sum = { P1:0, P2:0, P3:0, P4:0 }; let det = 0;
  for (let i = 0; i < N_TRIALS; i++) {
    const { detectedInvalid } = exec(name, 1000 + i); det += detectedInvalid.size;
    for (const key of detectedInvalid) { const [s, e] = key.split("|"); const { severity } = classifyInvalid(s, e); sum[SEVMAP[severity]]++; }
  }
  out[name] = { N: N_TRIALS, budget: EVENT_BUDGET,
    mean: { P1:+(sum.P1/N_TRIALS).toFixed(2), P2:+(sum.P2/N_TRIALS).toFixed(2), P3:+(sum.P3/N_TRIALS).toFixed(2), P4:+(sum.P4/N_TRIALS).toFixed(2) },
    totalFlaggedMean: +(det/N_TRIALS).toFixed(2), itdrCheck: +((det/N_TRIALS)/totalInvalid*100).toFixed(1) };
}
console.log(JSON.stringify(out, null, 2));