# AFLNet state-aware fuzzing of Tor circuit establishment (phases separated)

Setup: a TOR protocol module added to AFLNet (extract_requests_tor / extract_response_codes_tor;
framing = 2-byte big-endian length prefix per message) plus a plain-TCP phase-routing server
(tor_phase_server.c) that feeds each message to the real Tor parser for its phase and replies a
1-byte phase code, so AFLNet's -E state model separates the three phases.
  phase 0 -> OR-link handshake (netinfo_cell_parse)
  phase 1 -> circuit creation  (create_cell_parse / created_cell_parse)
  phase 2 -> circuit extension (extend_cell_parse / extended_cell_parse)

Command:
  afl-fuzz -d -i in_seq -o out_seq -N tcp://127.0.0.1/9700 -P TOR -E -R -m none -t 1000+ \
           -- ./tor_phase_server 9700
Server built with afl-gcc against libtor (Tor 0.4.6.10); AFLNet 2.56b.

## Result (single config, ~300 s)
- executions            : 5,606  (9.42 exec/s; network mode)
- paths discovered       : 137 total (134 new), 23 favored, max depth 3
- stability              : 99.09%
- unique crashes         : 0
- unique hangs           : 0
- global bitmap coverage : 0.50%

## Inferred protocol state machine (out_seq/ipsm.dot)
States 0 -> 1 -> 2 -> 3 with a 3 -> 3 self-loop. The three phases are DISTINCT states:
  0 = initial, 1 = after OR-link handshake, 2 = after circuit creation, 3 = after extension.
Discovered state sequences: 0-1, 0-1-2, 0-1-2-3, 0-1-2-3-3 (progressively deeper phase coverage).

## Interpretation
AFLNet's stateful model separates the OR-link handshake, circuit-creation, and extension phases
exactly as distinct protocol states, and drives phase-ordered message sequences into the real Tor
parsers. No memory-safety fault was found. This exercises byte-level robustness and reachable phase
orderings; it is complementary to the FSM method, which checks which transition is legal in which
state, not parser byte-robustness.
