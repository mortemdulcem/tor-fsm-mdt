import type { Express } from "express";
import type { Server } from "http";
import path from "path";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

// --- Tor FSM Simulator ---
const TorState = {
  IDLE: 'IDLE',
  CONNECTING: 'CONNECTING',
  TLS_HANDSHAKE: 'TLS_HANDSHAKE',
  CREATE_SENT: 'CREATE_SENT',
  CIRCUIT_BUILDING: 'CIRCUIT_BUILDING',
  CIRCUIT_READY: 'CIRCUIT_READY',
  TRANSMITTING: 'TRANSMITTING',
  CLOSING: 'CLOSING',
  CLOSED: 'CLOSED',
  ERROR: 'ERROR'
};

const TorEvent = {
  CONNECT: 'CONNECT',
  TLS_OK: 'TLS_OK',
  TLS_FAIL: 'TLS_FAIL',
  SEND_CREATE: 'SEND_CREATE',
  RECV_CREATED: 'RECV_CREATED',
  SEND_EXTEND: 'SEND_EXTEND',
  RECV_EXTENDED: 'RECV_EXTENDED',
  SEND_RELAY_DATA: 'SEND_RELAY_DATA',
  RECV_RELAY_DATA: 'RECV_RELAY_DATA',
  SEND_DESTROY: 'SEND_DESTROY',
  RECV_DESTROY: 'RECV_DESTROY',
  CIRCUIT_CLOSED: 'CIRCUIT_CLOSED',
  TIMEOUT: 'TIMEOUT'
};

const VALID_TRANSITIONS: Record<string, string> = {
  [`${TorState.IDLE}_${TorEvent.CONNECT}`]: TorState.CONNECTING,
  [`${TorState.CONNECTING}_${TorEvent.TLS_OK}`]: TorState.TLS_HANDSHAKE,
  [`${TorState.CONNECTING}_${TorEvent.TLS_FAIL}`]: TorState.ERROR,
  [`${TorState.CONNECTING}_${TorEvent.TIMEOUT}`]: TorState.ERROR,
  [`${TorState.TLS_HANDSHAKE}_${TorEvent.SEND_CREATE}`]: TorState.CREATE_SENT,
  [`${TorState.CREATE_SENT}_${TorEvent.RECV_CREATED}`]: TorState.CIRCUIT_BUILDING,
  [`${TorState.CREATE_SENT}_${TorEvent.TIMEOUT}`]: TorState.ERROR,
  [`${TorState.CIRCUIT_BUILDING}_${TorEvent.RECV_EXTENDED}`]: TorState.CIRCUIT_READY,
  [`${TorState.CIRCUIT_BUILDING}_${TorEvent.SEND_EXTEND}`]: TorState.CIRCUIT_BUILDING,
  [`${TorState.CIRCUIT_READY}_${TorEvent.SEND_RELAY_DATA}`]: TorState.TRANSMITTING,
  [`${TorState.CIRCUIT_READY}_${TorEvent.RECV_RELAY_DATA}`]: TorState.TRANSMITTING,
  [`${TorState.TRANSMITTING}_${TorEvent.SEND_RELAY_DATA}`]: TorState.TRANSMITTING,
  [`${TorState.TRANSMITTING}_${TorEvent.RECV_RELAY_DATA}`]: TorState.TRANSMITTING,
  [`${TorState.TRANSMITTING}_${TorEvent.SEND_DESTROY}`]: TorState.CLOSING,
  [`${TorState.TRANSMITTING}_${TorEvent.RECV_DESTROY}`]: TorState.CLOSING,
  [`${TorState.CLOSING}_${TorEvent.CIRCUIT_CLOSED}`]: TorState.CLOSED,
  [`${TorState.ERROR}_${TorEvent.CIRCUIT_CLOSED}`]: TorState.CLOSED,
};

const ATTACK_PATTERNS: Record<string, { type: string, severity: string, description: string }> = {
  [`${TorState.IDLE}_${TorEvent.SEND_RELAY_DATA}`]: { type: "CIRCUIT_BYPASS", severity: "CRITICAL", description: "Bypassed circuit creation to send data" },
  [`${TorState.CLOSED}_${TorEvent.SEND_RELAY_DATA}`]: { type: "REPLAY_ATTACK", severity: "CRITICAL", description: "Sending data on a closed circuit" },
  [`${TorState.CLOSED}_${TorEvent.RECV_RELAY_DATA}`]: { type: "GHOST_CIRCUIT", severity: "HIGH", description: "Receiving data on a closed circuit" },
  [`${TorState.TLS_HANDSHAKE}_${TorEvent.SEND_RELAY_DATA}`]: { type: "HANDSHAKE_SKIP", severity: "HIGH", description: "Skipping handshake to send data" },
  [`${TorState.CIRCUIT_BUILDING}_${TorEvent.SEND_RELAY_DATA}`]: { type: "PREMATURE_DATA", severity: "HIGH", description: "Sending data before circuit is ready" },
  [`${TorState.TRANSMITTING}_${TorEvent.SEND_CREATE}`]: { type: "CIRCUIT_HIJACK", severity: "CRITICAL", description: "Attempting to recreate an active circuit" },
  [`${TorState.CREATE_SENT}_${TorEvent.SEND_CREATE}`]: { type: "CREATE_FLOOD", severity: "MEDIUM", description: "Sending multiple CREATE cells" },
};

async function runSimulation(testRunId: number, count: number) {
  let currentState = TorState.IDLE;
  let circuitId = `circ_${Math.floor(Math.random() * 10000)}`;

  const events = Object.values(TorEvent);

  for (let i = 0; i < count; i++) {
    // 80% chance of picking a valid next event if possible, 20% chance of random event (to force invalid)
    let nextEvent = events[Math.floor(Math.random() * events.length)];
    
    // Attempt to be somewhat realistic but occasionally fail
    if (Math.random() > 0.3) {
       const validKeys = Object.keys(VALID_TRANSITIONS).filter(k => k.startsWith(currentState + '_'));
       if (validKeys.length > 0) {
           const chosenKey = validKeys[Math.floor(Math.random() * validKeys.length)];
           nextEvent = chosenKey.split('_').slice(1).join('_'); // handle events with underscore
       }
    }

    const key = `${currentState}_${nextEvent}`;
    const nextState = VALID_TRANSITIONS[key];
    const isValid = !!nextState;
    
    await storage.createTransition({
      testRunId,
      fromState: currentState,
      event: nextEvent,
      toState: isValid ? nextState : currentState,
      isValid
    });

    if (!isValid) {
      const attack = ATTACK_PATTERNS[key] || { 
        type: "INVALID_TRANSITION", 
        severity: "LOW", 
        description: "An undefined transition was attempted." 
      };

      await storage.createViolation({
        testRunId,
        circuitId,
        fromState: currentState,
        event: nextEvent,
        attemptedState: null,
        severity: attack.severity,
        attackType: attack.type,
        description: attack.description
      });
    } else {
      currentState = nextState;
    }
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get(api.testRuns.list.path, async (req, res) => {
    const runs = await storage.getTestRuns();
    res.json(runs);
  });

  app.post(api.testRuns.create.path, async (req, res) => {
    try {
      const input = api.testRuns.create.input.parse(req.body);
      const run = await storage.createTestRun(input);
      res.status(201).json(run);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.testRuns.get.path, async (req, res) => {
    const run = await storage.getTestRun(Number(req.params.id));
    if (!run) {
      return res.status(404).json({ message: 'Test run not found' });
    }
    res.json(run);
  });

  app.get(api.transitions.list.path, async (req, res) => {
    const transitions = await storage.getTransitionsByTestRun(Number(req.params.testRunId));
    res.json(transitions);
  });

  app.get(api.violations.list.path, async (req, res) => {
    const violations = await storage.getViolationsByTestRun(Number(req.params.testRunId));
    res.json(violations);
  });

  app.get(api.violations.listAll.path, async (req, res) => {
    const violations = await storage.getAllViolations();
    res.json(violations);
  });

  app.post(api.fsm.simulate.path, async (req, res) => {
    try {
      const input = api.fsm.simulate.input.parse(req.body);
      
      const testRun = await storage.getTestRun(input.testRunId);
      if (!testRun) {
        return res.status(404).json({ message: "Test run not found" });
      }

      // Run simulation asynchronously
      storage.updateTestRunStatus(input.testRunId, 'running').then(() => {
        runSimulation(input.testRunId, input.count).then(() => {
          storage.updateTestRunStatus(input.testRunId, 'completed');
        }).catch((err) => {
          console.error("Simulation failed:", err);
          storage.updateTestRunStatus(input.testRunId, 'failed');
        });
      });

      res.json({ message: "Simulation started" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get('/api/download/proposal', (req, res) => {
    const filePath = path.resolve('client/public/Proje_Onerisi_Plani.docx');
    res.download(filePath, 'Proje_Onerisi_Plani.docx');
  });

  return httpServer;
}
