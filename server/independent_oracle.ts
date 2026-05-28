// Bağımsız 2. oracle — tor-spec.txt metin anlatımından (state/event narratives)
// elle türetilmiş LTL-tarzı invariant'lar. δ tablosundan TÜRETİLMEZ; ayrı bir
// kaynak (spec metin paragrafları) referans alınır. Amaç: "FPR = 0 yapısaldır"
// (Threats i) sınırlılığını model-düzeyinde kısmen kırmak.
//
// Bu oracle gerçek Tor binary'sinin davranışını ÖLÇMEZ; o, Shadow + tor 0.4.x
// gerektirir (bu ortamda yok). Sadece spec'in iki ayrı formülasyonu (operasyonel
// δ vs deklaratif invariants) arasında çapraz doğrulama sağlar.

import { STATES, EVENTS, type State, type Event } from "./fsm.ts";

// Her invariant: (s, e) çiftinin "izinli" olup olmadığına karar verir.
// Spec referansı: tor-spec.txt — bölüm numaraları yorum olarak.
const INVARIANTS: {
  name: string;
  spec: string;
  allows: (s: State, e: Event) => boolean;
}[] = [
  {
    name: "I1_CONNECT_ONLY_IDLE",
    spec: "§2: A TLS connection is initiated only when the OP has no existing connection.",
    allows: (s, e) => e !== "CONNECT" || s === "IDLE",
  },
  {
    name: "I2_TLS_AFTER_CONNECT",
    spec: "§2: TLS handshake events occur only on an active in-progress connection.",
    allows: (s, e) =>
      (e !== "TLS_OK" && e !== "TLS_FAIL") ||
      s === "CONNECTING" ||
      (e === "TLS_FAIL" && s === "TLS_HANDSHAKE"),
  },
  {
    name: "I3_CREATE_AFTER_TLS",
    spec: "§5.1: CREATE cells are sent after TLS handshake completes (TLS_HANDSHAKE).",
    allows: (s, e) => e !== "SEND_CREATE" || s === "TLS_HANDSHAKE",
  },
  {
    name: "I4_CREATED_ECHOES_CREATE",
    spec: "§5.1: A CREATED cell can only follow a previously sent CREATE on the same circuit.",
    allows: (s, e) => e !== "RECV_CREATED" || s === "CREATE_SENT",
  },
  {
    name: "I5_EXTEND_DURING_BUILD",
    spec: "§5.2: EXTEND/EXTENDED only during multi-hop circuit construction (CIRCUIT_BUILDING).",
    allows: (s, e) =>
      (e !== "SEND_EXTEND" && e !== "RECV_EXTENDED") ||
      s === "CIRCUIT_BUILDING",
  },
  {
    name: "I6_DATA_AFTER_READY",
    spec: "§6.1: RELAY_DATA cells require an established circuit (CIRCUIT_READY or TRANSMITTING).",
    allows: (s, e) =>
      (e !== "SEND_RELAY_DATA" && e !== "RECV_RELAY_DATA") ||
      s === "CIRCUIT_READY" ||
      s === "TRANSMITTING",
  },
  {
    name: "I7_DESTROY_ON_LIVE_CIRC",
    spec: "§5.4: DESTROY tears down an existing circuit (CIRCUIT_READY or TRANSMITTING).",
    allows: (s, e) =>
      (e !== "SEND_DESTROY" && e !== "RECV_DESTROY") ||
      s === "CIRCUIT_READY" ||
      s === "TRANSMITTING",
  },
  {
    name: "I8_CLOSED_AFTER_TEARDOWN",
    spec: "§5.4: CIRCUIT_CLOSED notification only after CLOSING or ERROR.",
    allows: (s, e) =>
      e !== "CIRCUIT_CLOSED" || s === "CLOSING" || s === "ERROR",
  },
  {
    name: "I9_TIMEOUT_NOT_TERMINAL",
    spec: "tor implementation: timers do not fire on already-terminal circuits (CLOSED).",
    allows: (s, e) => e !== "TIMEOUT" || s !== "CLOSED",
  },
];

// Oracle kararı: tüm invariant'lar AND ile birleşir. Bir tanesi bile izin
// vermezse (s, e) "DENIED"; aksi halde "ALLOWED".
export function oracleAllows(s: State, e: Event): boolean {
  for (const inv of INVARIANTS) {
    if (!inv.allows(s, e)) return false;
  }
  return true;
}

export const ORACLE_INVARIANTS = INVARIANTS.map((i) => ({
  name: i.name,
  spec: i.spec,
}));
