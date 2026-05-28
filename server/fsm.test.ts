import { describe, it, expect } from "vitest";
import {
  STATES, EVENTS, VALID, VALID_2HOP, VALID_3HOP,
  k, classifyInvalid, totalDomain,
  validKeys, validKeys2Hop,
  type State, type Event,
} from "./fsm.ts";

describe("FSM state/event definitions", () => {
  it("has 10 states", () => {
    expect(STATES).toHaveLength(10);
  });

  it("has 13 events", () => {
    expect(EVENTS).toHaveLength(13);
  });

  it("totalDomain = |Q| x |Sigma| = 130", () => {
    expect(totalDomain).toBe(130);
  });

  it("k() produces correct key format", () => {
    expect(k("IDLE", "CONNECT")).toBe("IDLE|CONNECT");
    expect(k("CIRCUIT_READY", "SEND_EXTEND")).toBe("CIRCUIT_READY|SEND_EXTEND");
  });
});

describe("2-hop FSM (VALID_2HOP)", () => {
  it("has exactly 25 valid transitions", () => {
    expect(Object.keys(VALID_2HOP)).toHaveLength(25);
  });

  it("IDLE + CONNECT -> CONNECTING", () => {
    expect(VALID_2HOP[k("IDLE", "CONNECT")]).toBe("CONNECTING");
  });

  it("CIRCUIT_BUILDING + RECV_EXTENDED -> CIRCUIT_READY", () => {
    expect(VALID_2HOP[k("CIRCUIT_BUILDING", "RECV_EXTENDED")]).toBe("CIRCUIT_READY");
  });

  it("does NOT allow CIRCUIT_READY + SEND_EXTEND", () => {
    expect(VALID_2HOP[k("CIRCUIT_READY", "SEND_EXTEND")]).toBeUndefined();
  });

  it("does NOT allow CIRCUIT_READY + RECV_EXTENDED", () => {
    expect(VALID_2HOP[k("CIRCUIT_READY", "RECV_EXTENDED")]).toBeUndefined();
  });

  it("complete circuit lifecycle is valid", () => {
    const sequence: [State, Event, State][] = [
      ["IDLE", "CONNECT", "CONNECTING"],
      ["CONNECTING", "TLS_OK", "TLS_HANDSHAKE"],
      ["TLS_HANDSHAKE", "SEND_CREATE", "CREATE_SENT"],
      ["CREATE_SENT", "RECV_CREATED", "CIRCUIT_BUILDING"],
      ["CIRCUIT_BUILDING", "SEND_EXTEND", "CIRCUIT_BUILDING"],
      ["CIRCUIT_BUILDING", "RECV_EXTENDED", "CIRCUIT_READY"],
      ["CIRCUIT_READY", "SEND_RELAY_DATA", "TRANSMITTING"],
      ["TRANSMITTING", "SEND_DESTROY", "CLOSING"],
      ["CLOSING", "CIRCUIT_CLOSED", "CLOSED"],
    ];
    for (const [from, event, to] of sequence) {
      expect(VALID_2HOP[k(from, event)]).toBe(to);
    }
  });
});

describe("3-hop FSM (VALID_3HOP)", () => {
  it("has exactly 27 valid transitions", () => {
    expect(Object.keys(VALID_3HOP)).toHaveLength(27);
  });

  it("is a strict superset of 2-hop", () => {
    for (const [key, value] of Object.entries(VALID_2HOP)) {
      expect(VALID_3HOP[key]).toBe(value);
    }
  });

  it("adds CIRCUIT_READY + SEND_EXTEND -> CIRCUIT_BUILDING", () => {
    expect(VALID_3HOP[k("CIRCUIT_READY", "SEND_EXTEND")]).toBe("CIRCUIT_BUILDING");
  });

  it("adds CIRCUIT_READY + RECV_EXTENDED -> CIRCUIT_READY", () => {
    expect(VALID_3HOP[k("CIRCUIT_READY", "RECV_EXTENDED")]).toBe("CIRCUIT_READY");
  });

  it("3-hop circuit lifecycle is valid", () => {
    const sequence: [State, Event, State][] = [
      ["IDLE", "CONNECT", "CONNECTING"],
      ["CONNECTING", "TLS_OK", "TLS_HANDSHAKE"],
      ["TLS_HANDSHAKE", "SEND_CREATE", "CREATE_SENT"],
      ["CREATE_SENT", "RECV_CREATED", "CIRCUIT_BUILDING"],
      ["CIRCUIT_BUILDING", "SEND_EXTEND", "CIRCUIT_BUILDING"],
      ["CIRCUIT_BUILDING", "RECV_EXTENDED", "CIRCUIT_READY"],
      ["CIRCUIT_READY", "SEND_EXTEND", "CIRCUIT_BUILDING"],
      ["CIRCUIT_BUILDING", "RECV_EXTENDED", "CIRCUIT_READY"],
      ["CIRCUIT_READY", "SEND_RELAY_DATA", "TRANSMITTING"],
      ["TRANSMITTING", "SEND_DESTROY", "CLOSING"],
      ["CLOSING", "CIRCUIT_CLOSED", "CLOSED"],
    ];
    for (const [from, event, to] of sequence) {
      expect(VALID_3HOP[k(from, event)]).toBe(to);
    }
  });

  it("still detects EXTEND from TRANSMITTING as invalid", () => {
    expect(VALID_3HOP[k("TRANSMITTING", "SEND_EXTEND")]).toBeUndefined();
  });
});

describe("VALID defaults to 3-hop", () => {
  it("VALID === VALID_3HOP", () => {
    expect(Object.keys(VALID)).toHaveLength(Object.keys(VALID_3HOP).length);
    for (const [key, value] of Object.entries(VALID_3HOP)) {
      expect(VALID[key]).toBe(value);
    }
  });
});

describe("classifyInvalid — attack classification", () => {
  it("CIRCUIT_BYPASS: data from IDLE", () => {
    const r = classifyInvalid("IDLE", "SEND_RELAY_DATA");
    expect(r.type).toBe("CIRCUIT_BYPASS");
    expect(r.severity).toBe("CRITICAL");
  });

  it("CIRCUIT_BYPASS: data from CONNECTING", () => {
    const r = classifyInvalid("CONNECTING", "SEND_RELAY_DATA");
    expect(r.type).toBe("CIRCUIT_BYPASS");
    expect(r.severity).toBe("CRITICAL");
  });

  it("HANDSHAKE_SKIP: data during TLS_HANDSHAKE", () => {
    const r = classifyInvalid("TLS_HANDSHAKE", "SEND_RELAY_DATA");
    expect(r.type).toBe("HANDSHAKE_SKIP");
    expect(r.severity).toBe("HIGH");
  });

  it("PREMATURE_DATA: data during CIRCUIT_BUILDING", () => {
    const r = classifyInvalid("CIRCUIT_BUILDING", "SEND_RELAY_DATA");
    expect(r.type).toBe("PREMATURE_DATA");
    expect(r.severity).toBe("HIGH");
  });

  it("PREMATURE_DATA: data during CREATE_SENT", () => {
    const r = classifyInvalid("CREATE_SENT", "RECV_RELAY_DATA");
    expect(r.type).toBe("PREMATURE_DATA");
    expect(r.severity).toBe("HIGH");
  });

  it("PREMATURE_DATA: data during CLOSING", () => {
    const r = classifyInvalid("CLOSING", "SEND_RELAY_DATA");
    expect(r.type).toBe("PREMATURE_DATA");
    expect(r.severity).toBe("MEDIUM");
  });

  it("GHOST_CIRCUIT: recv data on CLOSED circuit", () => {
    const r = classifyInvalid("CLOSED", "RECV_RELAY_DATA");
    expect(r.type).toBe("GHOST_CIRCUIT");
    expect(r.severity).toBe("HIGH");
  });

  it("REPLAY_ATTACK: send data on CLOSED circuit", () => {
    const r = classifyInvalid("CLOSED", "SEND_RELAY_DATA");
    expect(r.type).toBe("REPLAY_ATTACK");
    expect(r.severity).toBe("CRITICAL");
  });

  it("GHOST_CIRCUIT: data on ERROR circuit", () => {
    const r = classifyInvalid("ERROR", "SEND_RELAY_DATA");
    expect(r.type).toBe("GHOST_CIRCUIT");
    expect(r.severity).toBe("HIGH");
  });

  it("CREATE_FLOOD: repeated CREATE in CREATE_SENT", () => {
    const r = classifyInvalid("CREATE_SENT", "SEND_CREATE");
    expect(r.type).toBe("CREATE_FLOOD");
    expect(r.severity).toBe("MEDIUM");
  });

  it("GHOST_CIRCUIT: RECV_CREATED from IDLE", () => {
    const r = classifyInvalid("IDLE", "RECV_CREATED");
    expect(r.type).toBe("GHOST_CIRCUIT");
    expect(r.severity).toBe("HIGH");
  });

  it("HANDSHAKE_SKIP: SEND_CREATE from IDLE", () => {
    const r = classifyInvalid("IDLE", "SEND_CREATE");
    expect(r.type).toBe("HANDSHAKE_SKIP");
    expect(r.severity).toBe("HIGH");
  });

  it("HANDSHAKE_SKIP: CREATE from CONNECTING", () => {
    const r = classifyInvalid("CONNECTING", "SEND_CREATE");
    expect(r.type).toBe("HANDSHAKE_SKIP");
    expect(r.severity).toBe("HIGH");
  });

  it("CIRCUIT_HIJACK: CREATE on active CIRCUIT_BUILDING", () => {
    const r = classifyInvalid("CIRCUIT_BUILDING", "SEND_CREATE");
    expect(r.type).toBe("CIRCUIT_HIJACK");
    expect(r.severity).toBe("CRITICAL");
  });

  it("CIRCUIT_HIJACK: CREATE on CIRCUIT_READY", () => {
    const r = classifyInvalid("CIRCUIT_READY", "SEND_CREATE");
    expect(r.type).toBe("CIRCUIT_HIJACK");
    expect(r.severity).toBe("CRITICAL");
  });

  it("CIRCUIT_HIJACK: CREATE on TRANSMITTING", () => {
    const r = classifyInvalid("TRANSMITTING", "SEND_CREATE");
    expect(r.type).toBe("CIRCUIT_HIJACK");
    expect(r.severity).toBe("CRITICAL");
  });

  it("CIRCUIT_HIJACK: EXTEND on TRANSMITTING", () => {
    const r = classifyInvalid("TRANSMITTING", "SEND_EXTEND");
    expect(r.type).toBe("CIRCUIT_HIJACK");
    expect(r.severity).toBe("CRITICAL");
  });

  it("REPLAY_ATTACK: CREATE on CLOSING", () => {
    const r = classifyInvalid("CLOSING", "SEND_CREATE");
    expect(r.type).toBe("REPLAY_ATTACK");
    expect(r.severity).toBe("HIGH");
  });

  it("REPLAY_ATTACK: CREATE on CLOSED", () => {
    const r = classifyInvalid("CLOSED", "SEND_CREATE");
    expect(r.type).toBe("REPLAY_ATTACK");
    expect(r.severity).toBe("HIGH");
  });

  it("REPLAY_ATTACK: EXTEND on CLOSING", () => {
    const r = classifyInvalid("CLOSING", "SEND_EXTEND");
    expect(r.type).toBe("REPLAY_ATTACK");
    expect(r.severity).toBe("MEDIUM");
  });

  it("GHOST_CIRCUIT: DESTROY on CLOSED", () => {
    const r = classifyInvalid("CLOSED", "SEND_DESTROY");
    expect(r.type).toBe("GHOST_CIRCUIT");
    expect(r.severity).toBe("MEDIUM");
  });

  it("CREATE_FLOOD: re-CONNECT in active state", () => {
    const r = classifyInvalid("TRANSMITTING", "CONNECT");
    expect(r.type).toBe("CREATE_FLOOD");
    expect(r.severity).toBe("LOW");
  });

  it("REPLAY_ATTACK: CONNECT on CLOSED", () => {
    const r = classifyInvalid("CLOSED", "CONNECT");
    expect(r.type).toBe("REPLAY_ATTACK");
    expect(r.severity).toBe("MEDIUM");
  });

  it("GHOST_CIRCUIT: TLS_OK out of CONNECTING", () => {
    const r = classifyInvalid("CIRCUIT_READY", "TLS_OK");
    expect(r.type).toBe("GHOST_CIRCUIT");
    expect(r.severity).toBe("MEDIUM");
  });

  it("GHOST_CIRCUIT: TLS_FAIL anywhere", () => {
    const r = classifyInvalid("IDLE", "TLS_FAIL");
    expect(r.type).toBe("GHOST_CIRCUIT");
    expect(r.severity).toBe("LOW");
  });

  it("GHOST_CIRCUIT: CIRCUIT_CLOSED out of place", () => {
    const r = classifyInvalid("TRANSMITTING", "CIRCUIT_CLOSED");
    expect(r.type).toBe("GHOST_CIRCUIT");
    expect(r.severity).toBe("LOW");
  });

  it("GHOST_CIRCUIT: TIMEOUT out of place", () => {
    const r = classifyInvalid("IDLE", "TIMEOUT");
    expect(r.type).toBe("GHOST_CIRCUIT");
    expect(r.severity).toBe("LOW");
  });

  it("classifies every invalid (state, event) pair", () => {
    for (const state of STATES) {
      for (const event of EVENTS) {
        if (!VALID[k(state, event)]) {
          const result = classifyInvalid(state, event);
          expect(result).toBeDefined();
          expect(result.type).toBeTruthy();
          expect(result.severity).toBeTruthy();
          expect(result.description).toBeTruthy();
        }
      }
    }
  });
});

describe("2-hop vs 3-hop structural FP resolution", () => {
  it("3rd hop SEND_EXTEND is CIRCUIT_HIJACK under 2-hop", () => {
    // Under 2-hop: CIRCUIT_READY + SEND_EXTEND is invalid
    expect(VALID_2HOP[k("CIRCUIT_READY", "SEND_EXTEND")]).toBeUndefined();
    const r = classifyInvalid("CIRCUIT_READY", "SEND_EXTEND");
    expect(r.type).toBe("CIRCUIT_HIJACK");
  });

  it("3rd hop SEND_EXTEND is valid under 3-hop", () => {
    expect(VALID_3HOP[k("CIRCUIT_READY", "SEND_EXTEND")]).toBe("CIRCUIT_BUILDING");
  });

  it("attack from TRANSMITTING is still detected under 3-hop", () => {
    expect(VALID_3HOP[k("TRANSMITTING", "SEND_EXTEND")]).toBeUndefined();
    const r = classifyInvalid("TRANSMITTING", "SEND_EXTEND");
    expect(r.type).toBe("CIRCUIT_HIJACK");
  });
});
