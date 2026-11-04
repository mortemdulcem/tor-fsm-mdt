# Replication package (reviewer additions)

Code, scripts and run evidence for the implementation-level experiments reported in the paper.

- `mutation/` — model-level mutation fault-detection experiment (`mutation_experiment.py`) and results (`mutation_results.csv`).
- `fig6/` — per-method per-priority flagged-pair regeneration (`build_fig6_data.mjs`, same 30 seeds as the paper) and output (`fig6_priority_data.csv`).
- `aflnet/` — coverage-guided fuzzing of the modeled CREATE/EXTEND cell parsers: cell-parser harness (`tor_cell_harness.c`), state-aware AFLNet Tor module + phase-routing server (`patch_aflnet.py`, `tor_phase_server.c`), results (`cellfuzz_results.md`, `aflnet_results.md`, `aflnet_ipsm.dot`).
- `patches/` — single-point, reversible Tor source deviations (`fault_missing_check.diff`, `patch_tor_0.4.9.14_replay.diff`).
- `scripts/` — build/run scripts for the AFLNet feasibility and coverage runs (`run_exp4_*.sh`).
- `evidence/` — retained run outputs for the missing-guard comparison (`net_correct/`, `net_faulty/`). Large raw Chutney/Shadow logs are omitted due to size and are available on request.

- `evidence/run_evidence.tgz` — archived per-run outputs (replay rebuild, Chutney replay incl. managed, missing-guard net_correct/net_faulty).
