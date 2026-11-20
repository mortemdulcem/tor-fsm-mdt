# Replication package (reviewer additions)

Code, scripts and run evidence for the implementation-level experiments reported in the paper.

- `mutation/` — model-level mutation fault-detection experiment (`mutation_experiment.py`) and results (`mutation_results.csv`).
- `fig6/` — per-method per-priority flagged-pair regeneration (`build_fig6_data.mjs`, same 30 seeds as the paper) and output (`fig6_priority_data.csv`).
- `aflnet/` — coverage-guided fuzzing of the modeled CREATE/EXTEND cell parsers: cell-parser harness (`tor_cell_harness.c`), state-aware AFLNet Tor module + phase-routing server (`patch_aflnet.py`, `tor_phase_server.c`), results (`cellfuzz_results.md`, `aflnet_results.md`, `aflnet_ipsm.dot`).
- `patches/` — single-point, reversible Tor source deviations (`fault_missing_check.diff`, `patch_tor_0.4.9.14_replay.diff`).
- `scripts/` — build/run scripts for the AFLNet feasibility and coverage runs (`run_exp4_*.sh`).
- `evidence/` — retained run outputs for the missing-guard comparison (`net_correct/`, `net_faulty/`). Large raw Chutney/Shadow logs of earlier stages are attached to the release `replication-data-v1`.

- `evidence/run_evidence.tgz` — archived per-run outputs (replay rebuild, Chutney replay incl. managed, missing-guard net_correct/net_faulty).

- `evidence/replay_evidence_bundle.tgz`, `evidence/replay49_evidence_bundle.tgz` — paired benign/experimental runs on Tor 0.4.6.10 and 0.4.9.14 (Section 5.3, Table 8).
- `evidence/h216_evidence_bundle.tgz` — correct vs missing-guard builds of 0.4.6.10.

Note (revision 2): the AFLNet adapter (`aflnet/tor_phase_server.c`) returns the message position as response code; it keeps no Tor state. The state machine in `aflnet_ipsm.dot` therefore reflects the adapter's message counter, not Tor (see Section 5.6 of the paper).
