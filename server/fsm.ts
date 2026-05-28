// Tor FSM specification — single source of truth.
// δ : Q × Σ → Q  where only listed (state, event) pairs are valid.

export const STATES = [
  "IDLE",
  "CONNECTING",
  "TLS_HANDSHAKE",
  "CREATE_SENT",
  "CIRCUIT_BUILDING",
  "CIRCUIT_READY",
  "TRANSMITTING",
  "CLOSING",
  "CLOSED",
  "ERROR",
] as const;

export const EVENTS = [
  "CONNECT",
  "TLS_OK",
  "TLS_FAIL",
  "SEND_CREATE",
  "RECV_CREATED",
  "SEND_EXTEND",
  "RECV_EXTENDED",
  "SEND_RELAY_DATA",
  "RECV_RELAY_DATA",
  "SEND_DESTROY",
  "RECV_DESTROY",
  "CIRCUIT_CLOSED",
  "TIMEOUT",
] as const;

export type State = (typeof STATES)[number];
export type Event = (typeof EVENTS)[number];

export const k = (s: State, e: Event) => `${s}|${e}`;

// 2-hop spec-conforming valid transitions (25 entries) -- original model.
export const VALID_2HOP: Record<string, State> = {
  [k("IDLE", "CONNECT")]: "CONNECTING",

  [k("CONNECTING", "TLS_OK")]: "TLS_HANDSHAKE",
  [k("CONNECTING", "TLS_FAIL")]: "ERROR",
  [k("CONNECTING", "TIMEOUT")]: "ERROR",

  [k("TLS_HANDSHAKE", "SEND_CREATE")]: "CREATE_SENT",
  [k("TLS_HANDSHAKE", "TLS_FAIL")]: "ERROR",
  [k("TLS_HANDSHAKE", "TIMEOUT")]: "ERROR",

  [k("CREATE_SENT", "RECV_CREATED")]: "CIRCUIT_BUILDING",
  [k("CREATE_SENT", "TIMEOUT")]: "ERROR",

  [k("CIRCUIT_BUILDING", "SEND_EXTEND")]: "CIRCUIT_BUILDING",
  [k("CIRCUIT_BUILDING", "RECV_EXTENDED")]: "CIRCUIT_READY",
  [k("CIRCUIT_BUILDING", "TIMEOUT")]: "ERROR",

  [k("CIRCUIT_READY", "SEND_RELAY_DATA")]: "TRANSMITTING",
  [k("CIRCUIT_READY", "RECV_RELAY_DATA")]: "TRANSMITTING",
  [k("CIRCUIT_READY", "SEND_DESTROY")]: "CLOSING",
  [k("CIRCUIT_READY", "RECV_DESTROY")]: "CLOSING",
  [k("CIRCUIT_READY", "TIMEOUT")]: "ERROR",

  [k("TRANSMITTING", "SEND_RELAY_DATA")]: "TRANSMITTING",
  [k("TRANSMITTING", "RECV_RELAY_DATA")]: "TRANSMITTING",
  [k("TRANSMITTING", "SEND_DESTROY")]: "CLOSING",
  [k("TRANSMITTING", "RECV_DESTROY")]: "CLOSING",
  [k("TRANSMITTING", "TIMEOUT")]: "ERROR",

  [k("CLOSING", "CIRCUIT_CLOSED")]: "CLOSED",
  [k("CLOSING", "TIMEOUT")]: "CLOSED",

  [k("ERROR", "CIRCUIT_CLOSED")]: "CLOSED",
};

// 3-hop spec-conforming valid transitions (27 entries).
// Extends the 2-hop model by allowing SEND_EXTEND/RECV_EXTENDED from
// CIRCUIT_READY, modeling Tor's default 3-hop circuit construction.
// This removes the structural false positive where the 3rd hop's
// SEND_EXTEND from CIRCUIT_READY was misclassified as CIRCUIT_HIJACK.
export const VALID_3HOP: Record<string, State> = {
  ...VALID_2HOP,
  [k("CIRCUIT_READY", "SEND_EXTEND")]: "CIRCUIT_BUILDING",
  [k("CIRCUIT_READY", "RECV_EXTENDED")]: "CIRCUIT_READY",
};

// Default: 3-hop model (primary for v2 analysis).
export const VALID = VALID_3HOP;

export const validKeys = Object.keys(VALID);
export const totalDomain = STATES.length * EVENTS.length; // 130
export const totalValid = validKeys.length; // 27
export const totalInvalid = totalDomain - totalValid; // 103

export const validKeys2Hop = Object.keys(VALID_2HOP);
export const totalValid2Hop = validKeys2Hop.length; // 25
export const totalInvalid2Hop = totalDomain - totalValid2Hop; // 105

// Programmatic attack classifier covers every (state, event) NOT in VALID.
// Returns { type, severity, description }.
export function classifyInvalid(
  state: State,
  event: Event,
): {
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
} {
  const dataEvent = event === "SEND_RELAY_DATA" || event === "RECV_RELAY_DATA";
  const createEvent = event === "SEND_CREATE" || event === "RECV_CREATED";
  const extendEvent = event === "SEND_EXTEND" || event === "RECV_EXTENDED";
  const destroyEvent = event === "SEND_DESTROY" || event === "RECV_DESTROY";
  const dead = state === "CLOSED" || state === "ERROR";

  // 1) Data flow before circuit ready
  if (dataEvent) {
    if (state === "IDLE" || state === "CONNECTING") {
      return {
        type: "CIRCUIT_BYPASS",
        severity: "CRITICAL",
        description: `Data ${event === "SEND_RELAY_DATA" ? "send" : "recv"} attempted from ${state} without any circuit setup`,
      };
    }
    if (state === "TLS_HANDSHAKE") {
      return {
        type: "HANDSHAKE_SKIP",
        severity: "HIGH",
        description: "Data attempted while TLS handshake still in progress",
      };
    }
    if (state === "CREATE_SENT" || state === "CIRCUIT_BUILDING") {
      return {
        type: "PREMATURE_DATA",
        severity: "HIGH",
        description: `Data attempted before circuit reached READY (in ${state})`,
      };
    }
    if (state === "CLOSING") {
      return {
        type: "PREMATURE_DATA",
        severity: "MEDIUM",
        description: "Data attempted on a closing circuit",
      };
    }
    if (state === "CLOSED") {
      return event === "RECV_RELAY_DATA"
        ? {
            type: "GHOST_CIRCUIT",
            severity: "HIGH",
            description: "Receiving data on a closed circuit (ghost)",
          }
        : {
            type: "REPLAY_ATTACK",
            severity: "CRITICAL",
            description: "Sending data on a closed circuit (replay)",
          };
    }
    if (state === "ERROR") {
      return {
        type: "GHOST_CIRCUIT",
        severity: "HIGH",
        description: "Data activity on a circuit in ERROR state",
      };
    }
  }

  // 2) CREATE / CREATED flow
  if (createEvent) {
    if (state === "CREATE_SENT") {
      return {
        type: "CREATE_FLOOD",
        severity: "MEDIUM",
        description:
          "Repeated CREATE while previous CREATE not yet acknowledged",
      };
    }
    if (state === "IDLE" && event === "RECV_CREATED") {
      return {
        type: "GHOST_CIRCUIT",
        severity: "HIGH",
        description: "RECV_CREATED for a circuit that was never initiated",
      };
    }
    if (state === "IDLE" && event === "SEND_CREATE") {
      return {
        type: "HANDSHAKE_SKIP",
        severity: "HIGH",
        description: "SEND_CREATE before TLS established",
      };
    }
    if (state === "CONNECTING") {
      return {
        type: "HANDSHAKE_SKIP",
        severity: "HIGH",
        description: "CREATE attempted before TLS_OK",
      };
    }
    if (
      state === "CIRCUIT_BUILDING" ||
      state === "CIRCUIT_READY" ||
      state === "TRANSMITTING"
    ) {
      return {
        type: "CIRCUIT_HIJACK",
        severity: "CRITICAL",
        description: `CREATE on an active circuit (${state}) — hijack signature`,
      };
    }
    if (state === "CLOSING") {
      return {
        type: "REPLAY_ATTACK",
        severity: "HIGH",
        description: "CREATE issued on a closing circuit",
      };
    }
    if (dead) {
      return {
        type: "REPLAY_ATTACK",
        severity: "HIGH",
        description: `CREATE replayed on a ${state} circuit`,
      };
    }
  }

  // 3) EXTEND / EXTENDED flow
  if (extendEvent) {
    if (state === "CIRCUIT_READY" || state === "TRANSMITTING") {
      return {
        type: "CIRCUIT_HIJACK",
        severity: "CRITICAL",
        description: `EXTEND on an active circuit (${state}) — hop injection`,
      };
    }
    if (dead) {
      return {
        type: "REPLAY_ATTACK",
        severity: "HIGH",
        description: `EXTEND replayed on a ${state} circuit`,
      };
    }
    if (
      state === "IDLE" ||
      state === "CONNECTING" ||
      state === "TLS_HANDSHAKE" ||
      state === "CREATE_SENT"
    ) {
      return {
        type: "HANDSHAKE_SKIP",
        severity: "MEDIUM",
        description: `EXTEND before circuit fully built (in ${state})`,
      };
    }
    if (state === "CLOSING") {
      return {
        type: "REPLAY_ATTACK",
        severity: "MEDIUM",
        description: "EXTEND on a closing circuit",
      };
    }
  }

  // 4) DESTROY out of place
  if (destroyEvent) {
    if (dead || state === "CLOSING") {
      return {
        type: "GHOST_CIRCUIT",
        severity: "MEDIUM",
        description: `DESTROY on already-${state.toLowerCase()} circuit`,
      };
    }
    return {
      type: "REPLAY_ATTACK",
      severity: "MEDIUM",
      description: `DESTROY before circuit READY (in ${state})`,
    };
  }

  // 5) CONNECT in non-IDLE
  if (event === "CONNECT" && state !== "IDLE") {
    if (dead) {
      return {
        type: "REPLAY_ATTACK",
        severity: "MEDIUM",
        description: "CONNECT replayed on a terminated circuit",
      };
    }
    return {
      type: "CREATE_FLOOD",
      severity: "LOW",
      description: `Re-CONNECT in active state ${state}`,
    };
  }

  // 6) TLS_OK out of place
  if (event === "TLS_OK" && state !== "CONNECTING") {
    return {
      type: "GHOST_CIRCUIT",
      severity: "MEDIUM",
      description: `TLS_OK arrived in ${state}, no handshake in flight`,
    };
  }

  // 7) TLS_FAIL out of place
  if (event === "TLS_FAIL") {
    return {
      type: "GHOST_CIRCUIT",
      severity: "LOW",
      description: `TLS_FAIL in ${state} (no TLS session)`,
    };
  }

  // 8) CIRCUIT_CLOSED out of place
  if (event === "CIRCUIT_CLOSED") {
    return {
      type: "GHOST_CIRCUIT",
      severity: "LOW",
      description: `CIRCUIT_CLOSED in ${state} without prior CLOSING/ERROR`,
    };
  }

  // 9) TIMEOUT out of place
  if (event === "TIMEOUT") {
    return {
      type: "GHOST_CIRCUIT",
      severity: "LOW",
      description: `TIMEOUT in non-active state ${state}`,
    };
  }

  // Fallback
  return {
    type: "INVALID_TRANSITION",
    severity: "LOW",
    description: `Undefined transition (${state} × ${event})`,
  };
}
