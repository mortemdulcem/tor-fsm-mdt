import type { Express } from "express";
import type { Server } from "http";
import path from "path";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import {
  STATES,
  EVENTS,
  VALID,
  validKeys,
  totalDomain,
  totalValid,
  totalInvalid,
  classifyInvalid,
  type State,
  type Event,
  k,
} from "./fsm";

// --- Legacy random simulator (preserved for "Initialize Sandbox Run" button) ---
async function runRandomSimulation(testRunId: number, count: number) {
  let currentState: State = "IDLE";
  const circuitId = `circ_${Math.floor(Math.random() * 10000)}`;

  for (let i = 0; i < count; i++) {
    let nextEvent: Event = EVENTS[Math.floor(Math.random() * EVENTS.length)];

    // 70% bias toward a valid next event from current state
    if (Math.random() > 0.3) {
      const candidates = EVENTS.filter(
        (e) => VALID[k(currentState, e)] !== undefined,
      );
      if (candidates.length > 0) {
        nextEvent = candidates[Math.floor(Math.random() * candidates.length)];
      }
    }

    const next: State | undefined = VALID[k(currentState, nextEvent)];
    const isValid = !!next;

    await storage.createTransition({
      testRunId,
      fromState: currentState,
      event: nextEvent,
      toState: isValid ? next : currentState,
      isValid,
    });

    if (!isValid) {
      const attack = classifyInvalid(currentState, nextEvent);
      await storage.createViolation({
        testRunId,
        circuitId,
        fromState: currentState,
        event: nextEvent,
        attemptedState: null,
        severity: attack.severity,
        attackType: attack.type,
        description: attack.description,
      });
    } else {
      currentState = next;
    }
  }
}

// --- Model-Driven Testing engine ---
// BFS in the δ-graph to find the shortest event sequence from IDLE to a target state.
function findPathTo(target: State): Event[] | null {
  if (target === "IDLE") return [];
  const queue: Array<{ state: State; path: Event[] }> = [
    { state: "IDLE", path: [] },
  ];
  const seen = new Set<State>(["IDLE"]);
  while (queue.length) {
    const { state, path } = queue.shift()!;
    for (const e of EVENTS) {
      const next = VALID[k(state, e)];
      if (!next || seen.has(next)) continue;
      const newPath = [...path, e];
      if (next === target) return newPath;
      seen.add(next);
      queue.push({ state: next, path: newPath });
    }
  }
  return null;
}

type MdtMetrics = {
  stateCoverage: number;
  transitionCoverage: number;
  itdr: number;
  fpr: number;
  visitedStates: number;
  totalStates: number;
  coveredValidPairs: number;
  totalValidPairs: number;
  detectedInvalidPairs: number;
  totalInvalidPairs: number;
  durationMs: number;
};

async function runMDT(testRunId: number): Promise<MdtMetrics> {
  const start = Date.now();
  const circuitId = `mdt_${start}`;

  const visitedStates = new Set<State>();
  const coveredValid = new Set<string>();
  const detectedInvalid = new Set<string>();
  let falsePositives = 0;

  async function execute(events: Event[]) {
    let s: State = "IDLE";
    visitedStates.add(s);
    for (const e of events) {
      const key = k(s, e);
      const next = VALID[key];
      const isValid = !!next;

      await storage.createTransition({
        testRunId,
        fromState: s,
        event: e,
        toState: isValid ? next : s,
        isValid,
      });

      if (isValid) {
        coveredValid.add(key);
        s = next;
        visitedStates.add(s);
      } else {
        detectedInvalid.add(key);
        const attack = classifyInvalid(s, e);
        await storage.createViolation({
          testRunId,
          circuitId,
          fromState: s,
          event: e,
          attemptedState: null,
          severity: attack.severity,
          attackType: attack.type,
          description: attack.description,
        });
      }
    }
  }

  // PHASE 1 — POSITIVE: cover every valid (state, event) pair.
  // For each valid pair, find a path to its source state, then trigger the event.
  for (const vk of validKeys) {
    if (coveredValid.has(vk)) continue;
    const [src, evt] = vk.split("|") as [State, Event];
    const path = findPathTo(src);
    if (path === null) continue;
    await execute([...path, evt]);
  }

  // PHASE 2 — NEGATIVE: inject every invalid (state, event) pair as a witness.
  for (const s of STATES) {
    for (const e of EVENTS) {
      const key = k(s, e);
      if (VALID[key] !== undefined) continue; // skip valid
      if (detectedInvalid.has(key)) continue; // already triggered
      const path = findPathTo(s);
      if (path === null && s !== "IDLE") continue; // unreachable target
      await execute([...(path ?? []), e]);
    }
  }

  const durationMs = Date.now() - start;
  return {
    stateCoverage: visitedStates.size / STATES.length,
    transitionCoverage: coveredValid.size / totalValid,
    itdr: detectedInvalid.size / totalInvalid,
    fpr: coveredValid.size === 0 ? 0 : falsePositives / coveredValid.size,
    visitedStates: visitedStates.size,
    totalStates: STATES.length,
    coveredValidPairs: coveredValid.size,
    totalValidPairs: totalValid,
    detectedInvalidPairs: detectedInvalid.size,
    totalInvalidPairs: totalInvalid,
    durationMs,
  };
}

// Compute metrics post-hoc from stored transitions+violations.
async function computeMetricsForRun(testRunId: number): Promise<MdtMetrics> {
  const trans = await storage.getTransitionsByTestRun(testRunId);
  const viols = await storage.getViolationsByTestRun(testRunId);

  const visitedStates = new Set<State>();
  const coveredValid = new Set<string>();
  const detectedInvalid = new Set<string>();
  let falsePositives = 0;

  for (const t of trans) {
    visitedStates.add(t.fromState as State);
    visitedStates.add(t.toState as State);
    const key = k(t.fromState as State, t.event as Event);
    const isValidInSpec = VALID[key] !== undefined;
    if (t.isValid) {
      if (isValidInSpec) coveredValid.add(key);
      else falsePositives++; // marked valid but spec says invalid
    } else {
      if (isValidInSpec)
        falsePositives++; // marked invalid but spec says valid
      else detectedInvalid.add(key);
    }
  }

  return {
    stateCoverage: visitedStates.size / STATES.length,
    transitionCoverage: coveredValid.size / totalValid,
    itdr: detectedInvalid.size / totalInvalid,
    fpr: trans.length === 0 ? 0 : falsePositives / trans.length,
    visitedStates: visitedStates.size,
    totalStates: STATES.length,
    coveredValidPairs: coveredValid.size,
    totalValidPairs: totalValid,
    detectedInvalidPairs: detectedInvalid.size,
    totalInvalidPairs: totalInvalid,
    durationMs: 0,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  app.get(api.testRuns.list.path, async (_req, res) => {
    const runs = await storage.getTestRuns();
    res.json(runs);
  });

  app.post(api.testRuns.create.path, async (req, res) => {
    try {
      const input = api.testRuns.create.input.parse(req.body);
      const run = await storage.createTestRun(input);
      res.status(201).json(run);
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.testRuns.get.path, async (req, res) => {
    const run = await storage.getTestRun(Number(req.params.id));
    if (!run) return res.status(404).json({ message: "Test run not found" });
    res.json(run);
  });

  app.get(api.transitions.list.path, async (req, res) => {
    res.json(
      await storage.getTransitionsByTestRun(Number(req.params.testRunId)),
    );
  });

  app.get(api.violations.list.path, async (req, res) => {
    res.json(
      await storage.getViolationsByTestRun(Number(req.params.testRunId)),
    );
  });

  app.get(api.violations.listAll.path, async (_req, res) => {
    res.json(await storage.getAllViolations());
  });

  app.post(api.fsm.simulate.path, async (req, res) => {
    try {
      const input = api.fsm.simulate.input.parse(req.body);
      const testRun = await storage.getTestRun(input.testRunId);
      if (!testRun)
        return res.status(404).json({ message: "Test run not found" });

      storage.updateTestRunStatus(input.testRunId, "running").then(() => {
        runRandomSimulation(input.testRunId, input.count)
          .then(() => storage.updateTestRunStatus(input.testRunId, "completed"))
          .catch((e) => {
            console.error("Random sim failed:", e);
            storage.updateTestRunStatus(input.testRunId, "failed");
          });
      });
      res.json({ message: "Simulation started" });
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // FSM specification endpoint
  app.get("/api/fsm/spec", async (_req, res) => {
    res.json({
      states: STATES,
      events: EVENTS,
      validTransitions: validKeys.map((vk) => {
        const [from, event] = vk.split("|");
        return { from, event, to: VALID[vk] };
      }),
      totalDomain,
      totalValid,
      totalInvalid,
    });
  });

  // MDT run — synchronous (returns metrics)
  app.post("/api/fsm/mdt", async (req, res) => {
    try {
      const input = z.object({ testRunId: z.number() }).parse(req.body);
      const testRun = await storage.getTestRun(input.testRunId);
      if (!testRun)
        return res.status(404).json({ message: "Test run not found" });

      await storage.updateTestRunStatus(input.testRunId, "running");
      try {
        const metrics = await runMDT(input.testRunId);
        await storage.updateTestRunStatus(input.testRunId, "completed");
        res.json({ message: "MDT completed", metrics });
      } catch (e) {
        console.error("MDT failed:", e);
        await storage.updateTestRunStatus(input.testRunId, "failed");
        res.status(500).json({ message: "MDT execution failed" });
      }
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Metrics for a given run
  app.get("/api/test-runs/:id/metrics", async (req, res) => {
    const id = Number(req.params.id);
    const run = await storage.getTestRun(id);
    if (!run) return res.status(404).json({ message: "Test run not found" });
    const metrics = await computeMetricsForRun(id);
    res.json(metrics);
  });

  app.get("/api/download/proposal", (_req, res) => {
    const filePath = path.resolve("client/public/Proje_Onerisi_Plani.docx");
    res.download(filePath, "Proje_Onerisi_Plani.docx");
  });

  return httpServer;
}
