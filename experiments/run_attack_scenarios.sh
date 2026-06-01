#!/bin/bash
# Run attack scenario experiments with Shadow + Tor
# Executes 4 attacks × 3 seeds = 12 Shadow simulations
# Each simulation: 30 minutes simulated time, ~9 seconds real time
# Usage: npx tsx experiments/run_attack_scenarios.mjs

set -e

SHADOW_BIN="${HOME}/.local/bin/shadow"
ATTACKS=("handshake-skip" "replay" "premature-data" "circuit-bypass")
SEEDS=(12345 23456 34567)
HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${HARNESS_DIR}/shadow_runs"

echo "=== Running Attack Scenario Experiments ==="
echo "Total runs: ${#ATTACKS[@]} × ${#SEEDS[@]} = $((${#ATTACKS[@]} * ${#SEEDS[@]}))"
echo "Estimated time: ~$((${#ATTACKS[@]} * ${#SEEDS[@]} * 10)) seconds"
echo ""

if [ ! -x "$SHADOW_BIN" ]; then
  echo "ERROR: Shadow binary not found at: $SHADOW_BIN"
  echo "Install with: apt-get install shadow-simulator"
  exit 1
fi

for attack in "${ATTACKS[@]}"; do
  echo ""
  echo "======== Attack: $attack ========"
  
  for seed in "${SEEDS[@]}"; do
    run_dir="${RESULTS_DIR}/attack-${attack}/seed-${seed}"
    echo ""
    echo "  [$attack:$seed] Running simulation..."
    
    # Run shadow_harness.mjs with attack parameter
    # (Modify shadow_harness.mjs to accept attack parameter)
    npx tsx experiments/shadow_harness.mjs --attack "$attack" --seed "$seed"
  done
done

echo ""
echo "=== Comparing with Oracle ==="
npx tsx experiments/attack_harness.mjs

echo ""
echo "Done! Results in: $RESULTS_DIR/attack_scenarios_results.json"
