# Memory index

- [Tor FSM real-attacks](tor-fsm-real-attack.md) — 3 verified real env-gated attacks (CREATE_FLOOD, CIRCUIT_HIJACK, PREMATURE_DATA via build-path hook); harness keys circuits by gid; Shadow runs only on VM; Devin branch is fabricated.
- [Tor FSM multi-seed honesty](tor-fsm-real-attack.md) — injected-tag only on premature; begin-noise inflates benign CIRCUIT_HIJACK(~12)+PREMATURE; metrics three-mode; hijack non-discriminative at FSM level (native only).
- [Tor FSM ML baseline](tor-fsm-real-attack.md) — deterministic data: LOSO leaks (83-97% dup), use CV-free unique-vector overlap as real evidence; confirms create_flood≈hijack, premature≈benign; no shared FSM/ML confusion matrix.
- [Tor FSM multi-client + n-gram primary](tor-fsm-real-attack.md) — multi-client (433 circuits) is PRIMARY ML dataset; n-gram improves separation; 4.16 native-confusion stays single-client; premature sample-unit differs run vs event level.
- [Tor FSM ML reproducibility](tor-fsm-real-attack.md) — 433×38 feature CSV committed; `python3 ml_baseline.py` reproduces canonical JSON bit-for-bit; ngram+shape guards + provenance.versions; only leakfree-unsupervised f1 is sklearn-version-sensitive.
- [Tez derleme komutu](tor-fsm-real-attack.md) — thesis/build_thesis.mjs `server/fsm.ts` import eder; `node` .ts uzantısını çözemez, `npx tsx thesis/build_thesis.mjs` ile derle. thesis.html değişmezse sayılar zaten ml_baseline_results.json ile tutarlı.
