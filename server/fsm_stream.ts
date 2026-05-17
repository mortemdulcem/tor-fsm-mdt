// Tor Stream alt-FSM — spec-derived (tor-spec.txt §6 RELAY commands).
// Aynı metodoloji: deterministik DFA, δ tek kaynak prensibine bağlı.
// Bu modül devre FSM'inden ayrı bir alt-protokoldür (stream lifecycle).

export const STREAM_STATES = [
  "STREAM_NEW", "BEGIN_SENT", "CONNECTED", "OPEN",
  "END_SENT", "CLOSED", "ERROR",
] as const;

export const STREAM_EVENTS = [
  "SEND_BEGIN", "RECV_CONNECTED", "SEND_DATA", "RECV_DATA",
  "SEND_END", "RECV_END", "RECV_REASON", "TIMEOUT",
] as const;

export type StreamState = (typeof STREAM_STATES)[number];
export type StreamEvent = (typeof STREAM_EVENTS)[number];

export const sk = (s: StreamState, e: StreamEvent) => `${s}|${e}`;

// Stream lifecycle δ (spec §6.2: RELAY_BEGIN, RELAY_CONNECTED, RELAY_DATA, RELAY_END).
export const STREAM_VALID: Record<string, StreamState> = {
  [sk("STREAM_NEW", "SEND_BEGIN")]: "BEGIN_SENT",

  [sk("BEGIN_SENT", "RECV_CONNECTED")]: "CONNECTED",
  [sk("BEGIN_SENT", "RECV_REASON")]: "ERROR",
  [sk("BEGIN_SENT", "TIMEOUT")]: "ERROR",

  [sk("CONNECTED", "SEND_DATA")]: "OPEN",
  [sk("CONNECTED", "RECV_DATA")]: "OPEN",
  [sk("CONNECTED", "SEND_END")]: "END_SENT",
  [sk("CONNECTED", "RECV_END")]: "CLOSED",
  [sk("CONNECTED", "TIMEOUT")]: "ERROR",

  [sk("OPEN", "SEND_DATA")]: "OPEN",
  [sk("OPEN", "RECV_DATA")]: "OPEN",
  [sk("OPEN", "SEND_END")]: "END_SENT",
  [sk("OPEN", "RECV_END")]: "CLOSED",
  [sk("OPEN", "TIMEOUT")]: "ERROR",

  [sk("END_SENT", "RECV_END")]: "CLOSED",
  [sk("END_SENT", "TIMEOUT")]: "CLOSED",

  [sk("ERROR", "RECV_END")]: "CLOSED",
};

export const streamValidKeys = Object.keys(STREAM_VALID);
export const streamDomain = STREAM_STATES.length * STREAM_EVENTS.length; // 7×8 = 56
export const streamValidCount = streamValidKeys.length;                  // 17
export const streamInvalidCount = streamDomain - streamValidCount;       // 39

// Stream-specific attack vector classifier. Same deterministic principle as
// circuit classifyInvalid: every (s, e) ∉ dom(δ) maps to a (type, severity).
export function classifyInvalidStream(
  s: StreamState,
  e: StreamEvent,
): { type: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" } {
  const dataEvent = e === "SEND_DATA" || e === "RECV_DATA";
  const endEvent = e === "SEND_END" || e === "RECV_END";
  const dead = s === "CLOSED" || s === "ERROR";

  // 1) Unsolicited CONNECTED — attacker fabricates an open response.
  if (e === "RECV_CONNECTED" && s !== "BEGIN_SENT") {
    return { type: "STREAM_HIJACK", severity: "CRITICAL" };
  }

  // 2) Data injected before CONNECTED (no handshake).
  if (dataEvent && (s === "STREAM_NEW" || s === "BEGIN_SENT")) {
    return { type: "DATA_INJECTION", severity: "CRITICAL" };
  }

  // 3) Duplicate / replayed BEGIN after stream already exists.
  if (e === "SEND_BEGIN" && s !== "STREAM_NEW") {
    return { type: "DOUBLE_BEGIN", severity: "HIGH" };
  }

  // 4) RECV_REASON outside BEGIN_SENT — out-of-context teardown reason.
  if (e === "RECV_REASON" && s !== "BEGIN_SENT") {
    return { type: "GHOST_STREAM", severity: "MEDIUM" };
  }

  // 5) END events on STREAM_NEW — teardown without setup (reset flood).
  if (endEvent && s === "STREAM_NEW") {
    return { type: "RESET_FLOOD", severity: "HIGH" };
  }

  // 6) SEND_END on CLOSED / ERROR — replay of teardown after stream gone.
  if (e === "SEND_END" && dead) {
    return { type: "END_REPLAY", severity: "MEDIUM" };
  }

  // 7) Data on dead stream — late data leak / use-after-close.
  if (dataEvent && dead) {
    return { type: "DATA_INJECTION", severity: "HIGH" };
  }

  // 8) Data on END_SENT — sending payload after we already said goodbye.
  if (dataEvent && s === "END_SENT") {
    return { type: "DATA_INJECTION", severity: "MEDIUM" };
  }

  // 9) TIMEOUT on a stream that is already terminal.
  if (e === "TIMEOUT" && dead) {
    return { type: "GHOST_STREAM", severity: "LOW" };
  }

  // Fallback: structurally invalid but no specific vector.
  return { type: "INVALID_STREAM_TRANSITION", severity: "LOW" };
}
