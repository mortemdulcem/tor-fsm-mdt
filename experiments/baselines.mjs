// Three test-generation algorithms operating on the Tor FSM.
// All execute in-memory (no DB), return per-trial metrics. Fully deterministic given a seed.

import { STATES, EVENTS, VALID, validKeys, totalValid, totalInvalid, k } from "../server/fsm.ts";

// Mulberry32 — small fast deterministic PRNG so trials are reproducible.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BUDGET = 500; // event budget per trial — same for all algorithms (fairness)

function emptyMetrics() {
  return {
    visited: new Set(["IDLE"]),
    coveredValid: new Set(),
    detectedInvalid: new Set(),
    events: 0,
  };
}

function finalize(m, durationMs) {
  return {
    stateCoverage: m.visited.size / STATES.length,
    transitionCoverage: m.coveredValid.size / totalValid,
    itdr: m.detectedInvalid.size / totalInvalid,
    visitedStates: m.visited.size,
    coveredValidPairs: m.coveredValid.size,
    detectedInvalidPairs: m.detectedInvalid.size,
    eventsConsumed: m.events,
    durationMs,
  };
}

function step(state, event, m) {
  const key = k(state, event);
  const next = VALID[key];
  m.events++;
  if (next !== undefined) {
    m.coveredValid.add(key);
    m.visited.add(next);
    return next;
  } else {
    m.detectedInvalid.add(key);
    return state;
  }
}

// ---------------- B1: Pure Random ----------------
// Picks a uniformly random event each step. Resets to IDLE if it reaches a terminal CLOSED state.
export function runB1(seed) {
  const rand = mulberry32(seed);
  const t0 = Date.now();
  const m = emptyMetrics();
  let s = "IDLE";
  while (m.events < BUDGET) {
    const e = EVENTS[Math.floor(rand() * EVENTS.length)];
    s = step(s, e, m);
    if (s === "CLOSED") s = "IDLE";
  }
  return finalize(m, Date.now() - t0);
}

// ---------------- B2: Greedy State Coverage ----------------
// At each step prefers events that lead to a not-yet-visited state.
// Falls back to a random valid event, then a random invalid event.
export function runB2(seed) {
  const rand = mulberry32(seed);
  const t0 = Date.now();
  const m = emptyMetrics();
  let s = "IDLE";
  while (m.events < BUDGET) {
    const validHere = EVENTS.filter((e) => VALID[k(s, e)] !== undefined);
    const unvisitedValid = validHere.filter((e) => !m.visited.has(VALID[k(s, e)]));
    const invalidHere = EVENTS.filter((e) => VALID[k(s, e)] === undefined);

    let e;
    if (unvisitedValid.length > 0) {
      e = unvisitedValid[Math.floor(rand() * unvisitedValid.length)];
    } else if (validHere.length > 0 && rand() > 0.3) {
      e = validHere[Math.floor(rand() * validHere.length)];
    } else if (invalidHere.length > 0) {
      e = invalidHere[Math.floor(rand() * invalidHere.length)];
    } else {
      e = EVENTS[Math.floor(rand() * EVENTS.length)];
    }
    s = step(s, e, m);
    if (s === "CLOSED") s = "IDLE";
  }
  return finalize(m, Date.now() - t0);
}

// ---------------- B3: Model-Driven Testing (BFS-planned) ----------------
// Same algorithm as the production /api/fsm/mdt endpoint.
// Order of pair selection randomized by seed to make trials non-degenerate.
function findPathTo(target) {
  if (target === "IDLE") return [];
  const queue = [{ state: "IDLE", path: [] }];
  const seen = new Set(["IDLE"]);
  while (queue.length) {
    const { state, path } = queue.shift();
    for (const e of EVENTS) {
      const next = VALID[k(state, e)];
      if (!next || seen.has(next)) continue;
      const np = [...path, e];
      if (next === target) return np;
      seen.add(next);
      queue.push({ state: next, path: np });
    }
  }
  return null;
}
function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function runB3(seed) {
  const rand = mulberry32(seed);
  const t0 = Date.now();
  const m = emptyMetrics();

  const exec = (events) => {
    let s = "IDLE";
    for (const e of events) {
      if (m.events >= BUDGET) return;
      s = step(s, e, m);
    }
  };

  // Positive phase
  for (const vk of shuffle(validKeys, rand)) {
    if (m.events >= BUDGET) break;
    if (m.coveredValid.has(vk)) continue;
    const [src, evt] = vk.split("|");
    const path = findPathTo(src);
    if (path === null) continue;
    exec([...path, evt]);
  }
  // Negative phase
  const invalidPairs = [];
  for (const s of STATES) for (const e of EVENTS) {
    if (VALID[k(s, e)] === undefined) invalidPairs.push([s, e]);
  }
  for (const [src, evt] of shuffle(invalidPairs, rand)) {
    if (m.events >= BUDGET) break;
    if (m.detectedInvalid.has(k(src, evt))) continue;
    const path = findPathTo(src);
    if (path === null && src !== "IDLE") continue;
    exec([...(path ?? []), evt]);
  }
  return finalize(m, Date.now() - t0);
}

export const ALGORITHMS = {
  B1_Random: runB1,
  B2_GreedySC: runB2,
  B3_MDT: runB3,
};

export const N_TRIALS = 30;
export const EVENT_BUDGET = BUDGET;
