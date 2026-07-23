#!/usr/bin/env bash
# full_pipeline.sh
# Runs Tor FSM-MDT attack experiments using Chutney multi-node network.
# Usage:
#   TOR_FSM_ATTACK_REPLAY=1 CLIENTS=1 SEEDS="42 137 2718" bash experiments/full_pipeline.sh
#
# Requires a running Chutney network (chutney start + wait_for_bootstrap done).
# CHUTNEY_NET_DIR: path to the active chutney nodes directory.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNS_DIR="$SCRIPT_DIR/runs"
TOR_BINARY="${TOR_BINARY:-/workspace/tor-0.4.6.10/src/app/tor}"
SEEDS="${SEEDS:-42 137 2718}"
CLIENTS="${CLIENTS:-1}"
RESULTS_FILE="$RUNS_DIR/results.jsonl"
CHUTNEY_NET_DIR="${CHUTNEY_NET_DIR:-/workspace/chutney-net/nodes.1784743228}"
CLIENT_TORRC="${CLIENT_TORRC:-$CHUTNEY_NET_DIR/005c/torrc}"
RUN_DURATION="${RUN_DURATION:-20}"

mkdir -p "$RUNS_DIR"
> "$RESULTS_FILE"

# Determine attack mode from environment
ATTACK_MODE="benign"
if [ -n "${TOR_FSM_ATTACK_REPLAY:-}" ]; then
  ATTACK_MODE="attack"
fi

echo "[pipeline] TOR binary      : $TOR_BINARY"
echo "[pipeline] Attack mode     : $ATTACK_MODE"
echo "[pipeline] Seeds           : $SEEDS"
echo "[pipeline] Chutney net dir : $CHUTNEY_NET_DIR"
echo "[pipeline] Run duration    : ${RUN_DURATION}s"

# ── Helper: count signal in a log file ───────────────────────────────────────
count_signal() {
  local logfile="$1"
  local pattern="$2"
  grep -cE "$pattern" "$logfile" 2>/dev/null; true
}

# ── Run one seed ─────────────────────────────────────────────────────────────
run_seed() {
  local seed="$1"
  local mode="$2"
  local run_dir="$RUNS_DIR/seed_${seed}_${mode}"
  mkdir -p "$run_dir"

  local relay_log="$run_dir/relay_001a.log"

  # Client log is written by torrc to the chutney info.log
  local client_logfile="$CHUTNEY_NET_DIR/005c/info.log"
  local client_baseline
  client_baseline=$(wc -l < "$client_logfile" 2>/dev/null || echo 0)

  # Record relay log baseline (before this run)
  local relay_logfile="$CHUTNEY_NET_DIR/001a/info.log"
  local relay_baseline
  relay_baseline=$(wc -l < "$relay_logfile" 2>/dev/null || echo 0)

  echo "[pipeline] Running seed=$seed mode=$mode (relay baseline=$relay_baseline, client baseline=$client_baseline) ..."

  # Start client in attack or benign mode
  if [ "$mode" = "attack" ]; then
    TOR_FSM_ATTACK_REPLAY=1 "$TOR_BINARY" \
      -f "$CLIENT_TORRC" --quiet >/dev/null 2>&1 &
  else
    env -u TOR_FSM_ATTACK_REPLAY "$TOR_BINARY" \
      -f "$CLIENT_TORRC" --quiet >/dev/null 2>&1 &
  fi
  local client_pid=$!

  # Wait for run duration
  sleep "$RUN_DURATION"

  # Kill client
  kill "$client_pid" 2>/dev/null || true
  sleep 1

  # Extract client log delta (new lines since baseline)
  local client_log="$run_dir/client.log"
  tail -n +$((client_baseline + 1)) "$client_logfile" > "$client_log" 2>/dev/null || true

  # Extract relay log delta (new lines since baseline)
  tail -n +$((relay_baseline + 1)) "$relay_logfile" > "$relay_log" 2>/dev/null || true

  # Count signals
  local replay_count
  replay_count=$(count_signal "$client_log" "\[FSM-REPLAY\]")
  local replay_organic_count
  replay_organic_count=$(count_signal "$relay_log" "n_chan already set\. Bug/attack\. Closing\.")
  local ghost_count
  ghost_count=$(count_signal "$relay_log" "unknown circuit [0-9]+ on connection from .+\. Dropping\.")
  local create_count
  create_count=$(count_signal "$client_log" "\[FSM-CREATE\]")
  local premature_count
  premature_count=$(count_signal "$client_log" "\[FSM-PREMATURE\]")
  local sendme_count
  sendme_count=$(count_signal "$client_log" "\[FSM-SENDME\]")

  # Write JSONL record
  local client_log_path="$run_dir/client.log"
  printf '{"seed":%s,"mode":"%s","signals":{"REPLAY":%s,"REPLAY_ORGANIC":%s,"GHOST":%s,"CREATE_FLOOD":%s,"PREMATURE":%s,"SENDME_FLOOD":%s},"logs":{"client":"%s","relay":"%s"}}\n' \
    "$seed" "$mode" \
    "$replay_count" "$replay_organic_count" "$ghost_count" \
    "$create_count" "$premature_count" "$sendme_count" \
    "$client_log_path" "$relay_log" \
    >> "$RESULTS_FILE"

  echo "[pipeline]   seed=$seed mode=$mode REPLAY=$replay_count REPLAY_ORGANIC=$replay_organic_count GHOST=$ghost_count"
}

# ── Main loop ─────────────────────────────────────────────────────────────────
for seed in $SEEDS; do
  run_seed "$seed" "$ATTACK_MODE"
done

# Also run benign for comparison if in attack mode
if [ "$ATTACK_MODE" = "attack" ]; then
  echo "[pipeline] Running benign baseline for comparison..."
  for seed in $SEEDS; do
    run_seed "$seed" "benign"
  done
fi

echo "[pipeline] Done. Results: $RESULTS_FILE"
cat "$RESULTS_FILE"
