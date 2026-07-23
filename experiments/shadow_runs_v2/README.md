# Shadow+Tor Empirical Validation Runs — v2 (REPLAY_ORGANIC)

This directory contains the second-generation Shadow+Tor validation run that adds a
**non-circular, organic REPLAY signal**. The results were produced on an isolated
Shadow/Tor VM (no live Tor network was contacted).

## Files

| File | Description |
|------|-------------|
| `full_pipeline_v2.sh` | Orchestration script for the v2 Shadow+Tor pipeline. |
| `shadow_harness_v2.mjs` | Harness that runs each scenario/seed and collects detections. |
| `relay.c.patched` | Patched Tor relay source used as the organic REPLAY signal source. |
| `results_v2.jsonl` | Per-run detection records (6 records). |
| `metrics_v2.json` | Aggregated per-scenario metrics (attack vs. benign, 3 seeds each). |

## Environment

Same isolated setup as `../shadow_runs/README.md` (Shadow 3.3.0, Tor 0.4.6.10,
Ubuntu 22.04). Seeds: 42, 137, 2718.

## Results summary

| Scenario | Attack counts (seeds 42/137/2718) | Mean | Benign | Verdict |
|----------|-----------------------------------|------|--------|---------|
| REPLAY | 21 / 21 / 23 | 21.67 | 0 | DETECTED |
| REPLAY_ORGANIC | 19 / 19 / 19 | 19.00 | 0 | DETECTED |
| CREATE_FLOOD | 0 / 0 / 0 | 0 | 0 | NOT_DETECTED |
| PREMATURE | 0 / 0 / 0 | 0 | 0 | NOT_DETECTED |
| SENDME_FLOOD | 0 / 0 / 0 | 0 | 0 | NOT_DETECTED |
| GHOST | 0 / 0 / 0 | 0 | 0 | NOT_DETECTED |

The key result is `REPLAY_ORGANIC`: the replay is detected without any injected
tag, using an organic (non-circular) signal, with zero benign false positives
across all three seeds.
