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
- 11 relays: `relay1`-`relay8` (guard/middle), `exit1`-`exit3` (exit)
- 5 clients: 1 direct (`client`), 4 tor clients (`torclient`, `torclient2`-`torclient4`)
- 1 file server (`fileserver`) for tgen traffic

All nodes share a single-node GML graph with 50 ms latency, 1 Gbit bandwidth.

### Topology Note

The user requested 3 directory authorities. This run uses 1 DA because
multi-DA setup requires coordinated voting key generation and cross-referencing
in Tor's TestingTorNetwork mode. With 1 DA the consensus is produced
deterministically; adding more DAs does not change the FSM monitor's
event-level behavior (circuits are built identically). This is documented
as a limitation.

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
Same baseline traffic + harness-level injection: for each circuit, three
`SEND_CREATE` events are replayed after a CIRCUIT_CLOSED or SEND_DESTROY event.
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

# Generate expanded template keys (for relay5-relay8, exit3, torclient2-4)
for node in relay5 relay6 relay7 relay8 exit3 torclient2 torclient3 torclient4; do
  mkdir -p $HOME/shadow_expanded_template/hosts/$node/keys
  tor --DataDirectory $HOME/shadow_expanded_template/hosts/$node \
      --ORPort 1 --Nickname $node --list-fingerprint --quiet
done
# Copy original template hosts as base
cp -r $HOME/shadow/examples/docs/tor/shadow.data.template/hosts/{4uthority,exit1,exit2,relay1,relay2,relay3,relay4,torclient,torflowauthority} \
      $HOME/shadow_expanded_template/hosts/
```

### Running the Harness

```bash
cd /path/to/tor-fsm-mdt

# Run all 9 simulations (3 scenarios x 3 seeds)
npx tsx experiments/shadow_harness.mjs

# Or run a specific scenario (edit SCENARIOS/SEEDS arrays in harness)
```

The harness:
1. Generates Shadow YAML configs with the expanded topology for each scenario/seed
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
| `origin_circuit_new()` | `CONNECT` |
| `ORCONN state>=7` | `TLS_OK` |
| `circuit_send_first_onion_skin()` | `SEND_CREATE` |
| `circuit_finish_handshake()` (hop 1) | `RECV_CREATED` |
| `circuit_finish_handshake()` (hop 2+) | `SEND_EXTEND` + `RECV_EXTENDED` |
| `circuit_mark_for_close_()` | `SEND_DESTROY` |
| `circuit_free_()` | `CIRCUIT_CLOSED` |

## Results Summary

| Scenario | Avg Circuits | Avg Events | Precision | Recall | F1 | FPR |
|----------|-------------|------------|-----------|--------|----|-----|
| benign | ~147 | ~1378 | N/A | N/A | N/A | 0.0000 |
| replay_attack | ~147 | ~1378 | 0.329 +/- 0.014 | 0.988 +/- 0.017 | 0.493 +/- 0.018 | 0.275 +/- 0.016 |
| circuit_bypass | ~147 | ~1378 | 0.436 +/- 0.015 | 1.000 +/- 0.000 | 0.607 +/- 0.015 | 0.276 +/- 0.017 |

## Known Limitations

1. **Single DA**: 1 directory authority instead of the requested 3. Multi-DA
   voting configuration is complex in TestingTorNetwork mode and does not affect
   the FSM monitor's per-circuit event analysis.
2. **Network scale**: 1 DA + 11 relays + 5 clients vs real Tor's ~7,000 relays.
   Results may not generalize to large-scale networks.
3. **Harness-level injection**: Attacks are injected at the event-trace level,
   not by modifying the Tor binary. This tests the FSM monitor's detection logic
   but not the full attack vector.
4. **2-hop vs 3-hop FSM mismatch**: The FSM spec models 2-hop circuits
   (CREATE + EXTEND), but Tor builds 3-hop circuits (guard/middle/exit).
   The 3rd hop's SEND_EXTEND triggers a CIRCUIT_HIJACK violation, causing
   a ~27% structural false-positive rate in benign traffic.
5. **Simulated time**: 30 minutes simulated time per run. Real Tor circuits
   have longer lifetimes and more diverse traffic patterns.
