# Attack Scenario Experiments - Shadow/Tor

Infrastructure for running real attack scenario validation experiments.

## Prerequisites

- Tor 0.4.6.10 source: `bash attacks/build_attack_binaries.sh`
- Shadow 3.3.0 installed
- Node.js 18+

## Running Experiments

```bash
# Build patched Tor binaries
bash attacks/build_attack_binaries.sh

# Run all 12 experiments (4 attacks × 3 seeds)
bash experiments/run_attack_scenarios.sh
```

## Output Structure

After running experiments:

```
shadow_runs/
├── attack-handshake-skip/
│   ├── seed-12345/
│   │   ├── shadow.data/hosts/relay1/tor.*.stdout  (Oracle log)
│   │   ├── events.jsonl                           (FSM events)
│   │   └── results.json                           (Metrics)
│   ├── seed-23456/
│   └── seed-34567/
├── attack-replay/
├── attack-premature-data/
├── attack-circuit-bypass/
└── attack_scenarios_results.json (Aggregated results)
```

## Oracle vs FSM Comparison

The harness compares:
1. **Oracle logs** from patched Tor (`ATTACK_*` lines in relay1 stdout)
2. **FSM detections** from circuit violations
3. Computes: TP, FP, FN metrics
4. Outputs: Precision, Recall, F1, FPR

## See Also

- `attacks/README.md` - Attack patch descriptions
- `ATTACK_SCENARIOS.md` - Complete implementation guide
