# Shadow+Tor Empirical Validation Runs

## Environment

| Component | Version |
|-----------|---------|
| Shadow | 3.3.0 |
| Tor | 0.4.6.10 |
| tgen | built from source (main branch, 2026-05) |
| OS | Ubuntu 22.04 (x86_64) |
| Node.js | 22.12.0 |

## Network Topology

- 1 directory authority (`4uthority`)
- 6 relays: `relay1`-`relay5` (guard/middle/exit), `exit1` (exit-only)
- 2 clients (1 direct client, 1 tor client)
- 1 file server (`fileserver`) for tgen traffic

All nodes share a single-node GML graph with 50 ms latency, 1 Gbit bandwidth.

## Seeds

Three seeds were used for each scenario to provide variance estimates:

- `42`
- `137`
- `2718`

## Scenarios

### benign
Baseline traffic only. Clients generate tgen HTTP streams through Tor circuits.
No attack injection. Used to measure false-positive rate (FPR) of the FSM monitor.

### replay_attack
Same baseline traffic + harness-level injection: for each circuit, two
`RECV_CREATED` events are replayed after the legitimate handshake completes.
This simulates a replay of captured CREATE cells.

### circuit_bypass
Same baseline traffic + harness-level injection: for each circuit, two events
(`SEND_RELAY_DATA` + `SEND_CREATE`) are injected at the `CONNECTING` state,
before TLS handshake. This simulates skipping the TLS handshake entirely.

## Directory Structure

```
shadow_runs/
  benign/
    run_seed42/
      shadow.yaml          # Shadow configuration used
      shadow.log           # Shadow simulator output
      shadow.data/         # Per-host stdout/stderr logs (Tor info-level)
      events.jsonl         # Extracted per-circuit FSM events
      results.json         # Per-run FSM monitor results
      conf/                # Tor and tgen config files
    run_seed137/
    run_seed2718/
  replay_attack/
    run_seed42/
    ...
  circuit_bypass/
    run_seed42/
    ...
```

## Reproduction Commands

### Prerequisites

```bash
# Install Shadow v3.3.0
git clone https://github.com/shadow/shadow.git
cd shadow
git checkout v3.3.0
./setup build --clean --test
./setup install
export PATH="$HOME/.local/bin:$PATH"

# Install Tor
sudo apt-get install -y tor

# Install tgen
git clone https://github.com/shadow/tgen.git
cd tgen
mkdir build && cd build
cmake .. -DCMAKE_INSTALL_PREFIX=$HOME/.local
make -j$(nproc) && make install
```

### Running the Harness

```bash
cd /path/to/tor-fsm-mdt

# Run all 9 simulations (3 scenarios x 3 seeds)
node experiments/shadow_harness.mjs

# Or run a specific scenario (edit SCENARIOS/SEEDS arrays in harness)
```

The harness:
1. Generates Shadow YAML configs for each scenario/seed combination
2. Runs `shadow` with the generated config
3. Parses Tor info-level logs from `shadow.data/` to extract per-circuit FSM events
4. Runs the FSM monitor on each circuit's event sequence
5. Computes precision, recall, F1, and FPR metrics
6. Writes results to `experiments/shadow_results.json`

### Event Extraction

The harness extracts FSM events from Tor's info-level log output by matching
known function calls to spec-level events:

| Tor Log Pattern | FSM Event |
|-----------------|-----------|
| `connection_or_finished_connecting()` | `CONNECT` |
| `or_state_changed: ...OPEN` | `TLS_OK` |
| `circuit_send_first_onion_skin()` | `SEND_CREATE` |
| `circuit_finish_handshake()` (hop 1) | `RECV_CREATED` |
| `circuit_finish_handshake()` (hop 2+) | `SEND_EXTEND` + `RECV_EXTENDED` |
| `circuit_mark_for_close_()` | `SEND_DESTROY` |
| `circuit_free_()` | `CIRCUIT_CLOSED` |

## Results Summary

| Scenario | Precision | Recall | F1 | FPR |
|----------|-----------|--------|----|-----|
| benign | N/A | N/A | N/A | 0.0000 |
| replay_attack | 0.369 +/- 0.004 | 1.000 +/- 0.000 | 0.539 +/- 0.004 | 0.251 +/- 0.007 |
| circuit_bypass | 0.466 +/- 0.007 | 1.000 +/- 0.000 | 0.636 +/- 0.007 | 0.251 +/- 0.007 |

## Known Limitations

1. **Small network**: 1 DA + 6 relays vs real Tor's ~7,000 relays.
2. **Harness-level injection**: Attacks are injected at the event-trace level,
   not by modifying the Tor binary. This tests the FSM monitor's detection logic
   but not the full attack vector.
3. **2-hop vs 3-hop FSM mismatch**: The FSM spec models 2-hop circuits
   (CREATE + EXTEND), but Tor builds 3-hop circuits (guard/middle/exit).
   The 3rd hop's SEND_EXTEND triggers a CIRCUIT_HIJACK violation, causing
   a 25.1% structural false-positive rate in benign traffic.
4. **Simulated time**: 30 minutes simulated time per run. Real Tor circuits
   have longer lifetimes and more diverse traffic patterns.
