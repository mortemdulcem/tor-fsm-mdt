# Model-driven conformance testing of Tor circuit establishment — replication repository

This repository contains only the material of the study
*"Model-Driven Conformance Testing of Security-Relevant Circuit-Establishment Behavior in Tor: An FSM-Based Case Study"*
(N. Denli Bayır, N. Yılmaz). Release `v2.0` corresponds to the second-round revision; the same content is deposited on Zenodo.

| Path | Content |
|---|---|
| `server/fsm.ts` | Abstract FSM (10 states, 13 events, 25 valid transitions) and the preliminary classification function |
| `experiments/baselines.mjs` | Original Random Testing, GreedySC and MDT implementations (TypeScript/JS) |
| `analysis/torfsm.py` | Mulberry32-exact Python port of the model and strategies, plus reset rules, W/Wp/UIO suites, single-fault mutants and the triage rules (`triage()`) |
| `analysis/*.py` | Scripts that regenerate every model-level number and figure of the paper (see below) |
| `analysis/out/` | Their outputs: `model_results.csv`, `budget_curves.csv`, `triage_105.csv`, `fidelity.json`, `summary.json` |
| `figures/` | Figures 1, 3, 5, 6, 7 of the revised paper |
| `replication/` | Tor patches, AFL/AFLNet harnesses, run scripts, first-round mutation script, and the retained Chutney run evidence |

## Reproducing the model-level results
Python ≥ 3.10 with `numpy` and `matplotlib`:
```
cd analysis
python3 verify.py     # reproduces Table 9 and Table C1 (checks the port against baselines.mjs)
python3 check_mut.py  # reproduces the first-round mutation scores; checks the fast kill counter
python3 run_all.py    # all strategies x budgets x reset rules, triage of the 105 undefined pairs
python3 curves.py     # budget curves (Fig. 7) and complete-suite lengths
python3 fidelity.py   # ordering properties, abstraction vs hop-explicit refinement (Table F2)
python3 figures.py    # figures/Fig3, Fig5, Fig6, Fig7
```
Seeds: 1000–1029 (main configuration, curves, mutants); 1000–1099 (Table C1).

## Implementation-level evidence
`replication/evidence/` holds the retained Chutney run directories for Tor 0.4.6.10 and 0.4.9.14
(benign/experimental, per-node `relay_counts.csv`, `metrics.csv`, `RESULTS.md`, `tor_version.txt`).
Directory names contain "replay" from an earlier wording; the check is a duplicated-EXTEND2 misbehaving-client check.
Larger raw Shadow/Chutney logs of earlier development stages are attached to the release `replication-data-v1`;
Shadow results are not used in the paper.

## Note on earlier repository content
Earlier development material (web dashboard, thesis and proposal build files, unrelated course material, pasted logs
and AI-agent working notes) has been removed from `main` to keep the repository limited to the study; it remains in
the git history (tag `pre-cleanup-2026-11-20`). No result of the paper comes from the excluded `feature/attack-scenarios` branch.

Checksums of all files: `SHA256SUMS`.
