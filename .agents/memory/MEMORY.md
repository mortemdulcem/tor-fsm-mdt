# Memory index

- [Tor FSM real-attacks](tor-fsm-real-attack.md) — 3 verified real env-gated attacks (CREATE_FLOOD, CIRCUIT_HIJACK, PREMATURE_DATA via build-path hook); harness keys circuits by gid; Shadow runs only on VM; Devin branch is fabricated.
- [Tor FSM multi-seed honesty](tor-fsm-real-attack.md) — injected-tag only on premature; begin-noise inflates benign CIRCUIT_HIJACK(~12)+PREMATURE; metrics three-mode; hijack non-discriminative at FSM level (native only).
- [Tor FSM ML baseline](tor-fsm-real-attack.md) — deterministic data: LOSO leaks (83-97% dup), use CV-free unique-vector overlap as real evidence; confirms create_flood≈hijack, premature≈benign; no shared FSM/ML confusion matrix.
- [Tor FSM multi-client native confusion](tor-fsm-real-attack.md) — CLIENTS>1 Shadow data does NOT exist (4-client VM run crashed extra clients; Replit can't run Shadow); 4.16 numbers stay single-client. Premature relay-native is run-level (n=seed), event-level is per-client (n=seed×client).
