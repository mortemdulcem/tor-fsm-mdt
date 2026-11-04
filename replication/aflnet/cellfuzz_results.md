# Coverage-guided fuzzing of Tor CREATE/EXTEND cell parsers (H2-19/20)

Harness: tor_cell_harness.c — feeds input bytes to create_cell_parse, created_cell_parse,
extend_cell_parse (RELAY_COMMAND_EXTEND2), extended_cell_parse (RELAY_COMMAND_EXTENDED2).
Built with afl-gcc against libtor (Tor 0.4.6.10); fuzzed with AFL 2.57b, file-input mode.

AFLNet network mode is not applicable: its afl-fuzz requires a -P protocol parser (none exists
for Tor's OR cell protocol) and a network target reachable by plain-TCP replay, whereas the
modeled cells travel inside the TLS link connection. The harness instead drives the exact
CREATE/CREATED/EXTEND/EXTENDED parsers the FSM models, after the point where TLS/crypto is handled.

## Run (single config, ~300 s)
- executions            : 178,184  (564.8 exec/s)
- paths discovered       : 72 total (68 new), 39 favored, max depth 3
- stability              : 100.00%
- unique crashes         : 0
- unique hangs           : 0
- global bitmap coverage : 0.49%  (harness exercises only the cell-parsing slice of libtor)
- baseline edges on a valid CREATE2 seed (afl-showmap): 85

## Interpretation
Coverage-guided fuzzing stresses the byte-level robustness of the cell parsers; 178k malformed
inputs produced no memory-safety fault (0 crashes), indicating the parsers are robust on this slice.
This axis is complementary to the FSM method, which covers the protocol state-transition space
(which cell is legal in which state) rather than parser byte-robustness.
