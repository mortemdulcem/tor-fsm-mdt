# Attack Scenario Patches for Tor 0.4.6.10

This directory contains four patch files for instrumenting Tor 0.4.6.10 with real attack behaviors for evaluation in Shadow simulations. Each patch modifies Tor source code to implement a specific attack, and includes oracle logging for ground truth detection.

## Overview

| Attack | Patch File | Location | Effect | Oracle Log |
|--------|-----------|----------|--------|------------|
| **HANDSHAKE_SKIP** | `attack-handshake-skip.patch` | `src/core/or/circuitbuild.c` | Send CREATE without TLS handshake | `ATTACK_HANDSHAKE_SKIP circ=%u` |
| **REPLAY_ATTACK** | `attack-replay.patch` | `src/core/or/relay.c` | Replay previously seen RELAY cells | `ATTACK_REPLAY_INJECTED circ=%u cell_type=%d` |
| **PREMATURE_DATA** | `attack-premature-data.patch` | `src/core/or/relay.c` | Send data before circuit READY | `ATTACK_PREMATURE_DATA circ=%u state=%d` |
| **CIRCUIT_BYPASS** | `attack-circuit-bypass.patch` | `src/core/or/circuituse.c` | Skip EXTEND hops, connect directly | `ATTACK_CIRCUIT_BYPASS circ=%u dest=%s` |

## Building Patched Tor Binaries

See `../build_attack_binaries.sh` for automated compilation script.

Manual process:

```bash
git clone --depth 1 --branch tor-0.4.6.10 https://gitlab.torproject.org/tpo/core/tor
cd tor

for attack in handshake-skip replay premature-data circuit-bypass; do
  git apply ../attacks/attack-${attack}.patch
  ./configure --prefix=/opt/tor-attack-${attack} \
              --enable-fragile-hardening \
              --disable-asciidoc
  make clean && make -j4 && make install
  git checkout src/  # Reset for next patch
done
```

## Attack Descriptions

### 1. HANDSHAKE_SKIP
**FSM Violation**: Sends SEND_CREATE from non-OPEN state (TLS handshake bypassed).

**Mechanism**: Removes TLS state check in `circuit_send_first_onion_skin()`, allows CREATE to be sent immediately upon connection without waiting for TLS_OK event.

**FSM Impact**:
- Normal: IDLE → CONNECT → TLS_OK → SEND_CREATE → ...
- Attack: IDLE → CONNECT → SEND_CREATE (TLS_OK missing)

**Detection**: FSM detects invalid transition from CONNECT to SEND_CREATE.

---

### 2. REPLAY_ATTACK
**FSM Violation**: Injects RELAY_DATA events after circuit should be CLOSED.

**Mechanism**: Intercepts and caches RELAY cells during normal operation, then re-injects them after circuit closure or timeout.

**FSM Impact**:
- Normal: ... → SEND_RELAY_DATA → SEND_DESTROY → CIRCUIT_CLOSED
- Attack: ... → SEND_RELAY_DATA → SEND_DESTROY → CIRCUIT_CLOSED → SEND_RELAY_DATA (injected)

**Detection**: FSM detects SEND_RELAY_DATA from ERROR/CLOSED state.

---

### 3. PREMATURE_DATA
**FSM Violation**: Sends application data (RELAY_DATA) before circuit fully extended.

**Mechanism**: Bypasses the connection state check in `connection_edge_process_inbuf()`, allows relay data to be sent even when circuit extension is incomplete.

**FSM Impact**:
- Normal: ... → SEND_CREATE → RECV_CREATED → SEND_EXTEND → RECV_EXTENDED → SEND_RELAY_DATA
- Attack: ... → SEND_CREATE → SEND_RELAY_DATA (intermediate hops missing)

**Detection**: FSM detects SEND_RELAY_DATA from non-ready states (e.g., EXTENDING).

---

### 4. CIRCUIT_BYPASS
**FSM Violation**: Skips intermediate hops in multi-hop circuit extension.

**Mechanism**: Malicious relay intercepts EXTEND cells and directly connects to destination rather than forwarding to next hop in `circuit_get_open_circ_or_launch()`.

**FSM Impact**:
- Normal 3-hop: ... → SEND_EXTEND₁ → RECV_EXTENDED₁ → SEND_EXTEND₂ → RECV_EXTENDED₂ → ...
- Attack: ... → SEND_EXTEND₁ → RECV_EXTENDED₁ → (skip hop 2) → SEND_RELAY_DATA

**Detection**: FSM detects missing SEND_EXTEND/RECV_EXTENDED transitions in multi-hop sequence.

---

## Ground Truth Oracle

Each attack logs its occurrence to Tor's info-level log using `log_notice(LD_GENERAL, ...)`:

```c
log_notice(LD_GENERAL, "ATTACK_<NAME> circ=%u ...", circ->global_identifier, ...);
```

The harness (`experiments/attack_harness.mjs`) parses these logs to extract ground truth labels, computing true positives/false positives by comparing FSM detections against oracle events.

## Integration with Shadow Harness

The harness uses these patches in an experimental matrix:
- **4 attacks** × **3 seeds** × **30-minute simulations** = 12 runs
- For each attack, relay1 is launched with the corresponding patched binary
- Other relays use stock Tor binary
- Results are compared against oracle logs to compute TP/FP/FN/TN and metrics (P/R/F1/FPR)

## Experiment Configuration

**Network Topology**:
- 1 Directory Authority
- 8 Guard/Middle relays (relay1-relay8), relay1 is attacker-controlled
- 3 Exit relays (exit1-exit3)
- 1 Direct client + 4 Tor clients

**Simulation Parameters**:
- Duration: 30 minutes simulated time
- Seeds: 12345, 23456, 34567 (deterministic given 1 DA)
- Shadow version: 3.3.0
- Tor version: 0.4.6.10

## Output Artifacts

For each attack/seed combination:
- `shadow.data/hosts/relay1/tor.*.stdout` → Oracle log with ATTACK_* lines
- `events.jsonl` → Per-circuit FSM event trace
- `results.json` → Metrics (precision, recall, F1, FPR, TP/FP/FN/TN)

See `experiments/attack_scenarios_results.json` for aggregated results across all 12 runs.

## References

- Tor Source Code: https://gitlab.torproject.org/tpo/core/tor
- Tor 0.4.6.10 Release Notes: https://blog.torproject.org/tor-0-4-6-10-released
- FSM Specification: `server/fsm.ts` (this project)
- Shadow Simulator: https://shadow.github.io/
