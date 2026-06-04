# Memory index

- [Tor FSM real-attacks](tor-fsm-real-attack.md) — 3 verified real env-gated attacks (CREATE_FLOOD, CIRCUIT_HIJACK, PREMATURE_DATA via build-path hook); harness keys circuits by gid; Shadow runs only on VM; Devin branch is fabricated.
- [Tor FSM multi-seed honesty](tor-fsm-real-attack.md) — injected-tag only on premature; begin-noise inflates benign CIRCUIT_HIJACK(~12)+PREMATURE; metrics three-mode; hijack non-discriminative at FSM level (native only).
- [Tor FSM ML baseline](tor-fsm-real-attack.md) — deterministic data: LOSO leaks (83-97% dup), use CV-free unique-vector overlap as real evidence; confirms create_flood≈hijack, premature≈benign; no shared FSM/ML confusion matrix.
- [Tor FSM multi-client + n-gram primary](tor-fsm-real-attack.md) — multi-client RESOLVED & real (CLIENTS=4×3seed, 433 circuits); it is the PRIMARY ML dataset (benign vectors differ per client). n-gram/timing now on VM and DO improve separation (cf↔ch→0, acc 0.600→0.908, premature recall 0.102→0.694; enhanced eval is LOSO-optimistic). 4.16 native-confusion stays single-client (attack totals ±0 across clients). Premature relay-native run-level (n=seed), event-level per-client (n=seed×client).
