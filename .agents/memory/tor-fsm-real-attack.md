---
name: Tor FSM real-attack (CREATE_FLOOD) approach
description: How a real (non-synthetic) attack is produced for the Tor FSM thesis, and the harness log-format dependency it relies on.
---

# Real attack for the Tor FSM thesis

The thesis (Bölüm 4.16 / S6) reports benign FPR from REAL Shadow logs but attacks were
SYNTHETIC injection. To make an attack real, a patched Tor binary must emit a genuine
protocol violation that the harness's log parser already detects.

## Harness log → event mapping (the key dependency)
The Shadow harness (`experiments/shadow_harness.mjs`, lives on the user's VM + GitHub
`mortemdulcem/tor-fsm-mdt`, NOT in the Replit workspace) parses Tor log lines of the form
`function_name(): message` with the regex `circuit_send_first_onion_skin\(\).*sending CREATE`
(case-insensitive). Critical mappings:
- `circuit_send_first_onion_skin(): ...sending CREATE...` → **SEND_CREATE**
- `connection_ap_handshake_send_begin()` → **SEND_RELAY_DATA**
- `circuit_build_no_more_hops(): circuit built` → circuit built
- `circuit_finish_handshake()` → RECV_CREATED / (synthesized SEND_EXTEND + RECV_EXTENDED)

**CRITICAL (cost real debugging time): real Shadow runs log at INFO, not debug.** At INFO the
ONLY matching line is `circuit_send_first_onion_skin(): First hop: finished sending CREATE cell
to '...'` (emitted ONCE per circuit at the end of the function). The debug line `First skin;
sending create cell.` never appears. So a CREATE_FLOOD patch that only adds a second *debug*
line (or a second cell without a second matching INFO line) is INVISIBLE to the harness.

**Why this matters:** a real attack must emit a SECOND copy of that INFO line. CREATE_FLOOD =
the matching SEND_CREATE INFO line appearing twice for one circuit. The two log_info calls run
in the same function call → both carry the SAME simulated timestamp, so success looks like
identical-timestamp PAIRS in the client log.

## CREATE_FLOOD patch (verified compiles on VM Tor 0.4.6.10)
In `src/core/or/circuitbuild.c`, function `circuit_send_first_onion_skin`, after the first
`circuit_deliver_create_cell(...)` succeeds, deliver a SECOND duplicate CREATE cell gated by
`getenv("TOR_FSM_ATTACK_CREATE_FLOOD")`. This is a REAL duplicate cell on the wire, not a
fabricated log line (replit.md forbids plausible/fake methodology).
- `getenv` compiles clean: `circuitbuild.c` includes `or.h` → `lib/malloc/malloc.h` → `<stdlib.h>`, so no implicit-declaration under `-Werror`.
- Env-gating keeps ONE binary usable for both benign and attacker nodes (set env per-host in shadow.yaml).
- Patch saved at workspace `create_flood.patch` (apply with `patch -p1` inside tor-0.4.6.10).

## Build facts (VM = Ubuntu 22.04 / tez@tor-fsm-ubuntu)
- Vanilla AND patched Tor 0.4.6.10 compile cleanly with system libevent/openssl/zlib.
- Shadow at `~/.local/bin/shadow`; system tor `/usr/sbin/tor` v0.4.6.10 (apt, GCC 11.2 — NOT patchable).
- Source tarball: `https://dist.torproject.org/tor-0.4.6.10.tar.gz` (curl, wget exists on VM).

## Replit env limit
Shadow CANNOT run in the Replit sandbox (needs syscall interception / kernel caps) — this is
exactly why the thesis VM (Bölüm 4.15) exists. Patch + compile-verify can be done in Replit;
the Shadow RUN must happen on the VM.

## Remaining steps (multi-session)
1. DONE — torclient in `/tmp/cf_test/shadow.yaml` points at `~/tor-0.4.6.10/src/app/tor`
   with environment `TOR_FSM_ATTACK_CREATE_FLOOD:"1"`.
2. DONE & VERIFIED — patched run shows SEND_CREATE INFO line TWICE per circuit:
   harness regex match count 9 (benign) → 18 (attack), as identical-timestamp pairs.
   Log: `/tmp/cf_test/shadow.data/hosts/torclient/tor.1000.stdout`.
3. DONE & VERIFIED — fed the REAL patched-binary log through the harness's own parser+detector
   via `experiments/cf_detect.mjs`: 9 circuits → 9 CREATE_FLOOD (`CREATE_SENT x SEND_CREATE ->
   CREATE_FLOOD MEDIUM`), one per duplicated first-hop circuit. shadow_harness.mjs was made
   importable (main() guarded behind a direct-run check + `export { parseTorHostLog,
   runFsmOnAllCircuits }`; `.bak` saved) so cf_detect reuses the EXACT detector, no duplication.
4. BASELINE CONTROL (do for rigor) — same patched binary, env var OFF (benign), parse the same
   way: CREATE_FLOOD must be 0. The attack's only delta is CREATE_FLOOD 0->9; the other
   violation types (PREMATURE_DATA ~15, REPLAY_ATTACK 2, GHOST_CIRCUIT 2) are PARSER BASELINE
   artifacts present in benign too (real Tor log -> simplified FSM mapping), NOT the attack.
5. Update thesis: only CREATE_FLOOD becomes real; replay/bypass/premature stay synthetic.
   S6 honestly: "CREATE_FLOOD gerçek, diğerleri sentetik".

## Funcname-keyed parser ⇒ honesty constraint on WHICH attacks can be real
The harness recognizes each FSM event by the Tor-logged **function name** (`funcname():`)
plus content (e.g. SEND_CREATE only from `circuit_send_first_onion_skin()`; SEND_RELAY_DATA
only from `connection_ap_handshake_send_begin()`). So a REAL attack must route the genuine
cell **through that exact function** so the log carries the right funcname — you CANNOT emit
the recognized line from another function (that would be a fabricated log = forbidden). This
is why only some attack classes are realizable; the FSM *state* at detection is driven by log
LINE ORDER, not wall-clock.

## Architect verdict (both real attacks): PASS, scope caveat
- Frame in thesis as "fault-injected real protocol violations in MODIFIED Tor, env-gated, benign-by-default";
  do NOT claim wild/remote exploitability. Two validated REAL attacks (CREATE_FLOOD, CIRCUIT_HIJACK) +
  remaining classes explicitly labeled synthetic/spec-derived = most defensible thesis strategy.
- PREMATURE_DATA benign 21 vs attack 11 = collateral distribution shift from altered timing, NOT an
  improvement; report normalized (per-circuit / per-active-second) with CIs across repeated runs.
- Minor hardening (defensive only; run already exits 0 since circuit is OPEN→n_chan non-null):
  add `circ->base_.n_chan` to the gate condition; append_cell_to_circuit_queue return is ignored.

## NOT genuinely realizable: HANDSHAKE_SKIP & PREMATURE_DATA (structural blockers)
- **HANDSHAKE_SKIP** needs SEND_CREATE in IDLE/CONNECTING or SEND_EXTEND in CREATE_SENT. Tor sends the
  first CREATE only AFTER the channel/TLS is OPEN (circuit_send_first_onion_skin is gated on channel
  ready); parser emits SEND_EXTEND only on the 2nd+ circuit_finish_handshake (after hop1 RECV_CREATED).
  So the recognized log can't appear before its prerequisite without FABRICATING the log line (forbidden).
- **PREMATURE_DATA** needs SEND_RELAY_DATA in CREATE_SENT/CIRCUIT_BUILDING. But Tor sends RELAY_BEGIN
  only after circuit OPEN: `connection_ap_handshake_attach_chosen_circuit` has
  `tor_assert(circ->base_.state == CIRCUIT_STATE_OPEN)` and `connection_ap_supports_optimistic_data`
  returns 0 unless `on_circuit->state == CIRCUIT_STATE_OPEN`. (Tor "optimistic data" = don't wait for
  exit CONNECTED; it is NOT begin-before-circuit-open.) So a genuine client never emits premature data.
- **Benign PREMATURE_DATA:21 is a PARSER ARTIFACT**, not real premature data: begin for an already-OPEN
  circuit gets attributed to a more-recently-created circuit via `lastCircuitId` (its FSM still early).
  Report this as a detector limitation / FPR source, NOT as detected premature data.
- **Why CREATE_FLOOD/CIRCUIT_HIJACK ARE realizable but these two are not:** a duplicate CREATE rides an
  already-OPEN channel (real transmittable cell, relay drops it). HANDSHAKE_SKIP/PREMATURE_DATA require
  emitting a cell BEFORE its prerequisite exists — Tor's layering forbids transmit, so only a fake log
  or parser-attribution gaming could fake them. Decision: keep both SYNTHETIC, clearly labeled.

## Extending to other attack types (same env-gate pattern, benign-by-default)
- **CIRCUIT_HIJACK (CRITICAL) — DONE & VERIFIED (non-destructive variant, run exits 0).**
  Result: attack(flag on)=9 circuits→CIRCUIT_HIJACK 9; benign(SAME binary, flag off, env var fully
  REMOVED — note getenv("")!=NULL so setting "" does NOT disable)=9 circuits→CIRCUIT_HIJACK 0. Only
  delta is CIRCUIT_HIJACK 0→9 (REPLAY/GHOST 3/3 both; PREMATURE 21 benign vs 11 attack — baseline
  artifact, not the signal). n_circ_id is on the BASE circuit: use `circ->base_.n_circ_id`
  (origin_circuit_t has no n_circ_id member). create_cell_format + append_cell_to_circuit_queue ARE
  declared in circuitbuild.c (no extra include needed). History below kept for context:
  In `circuit_finish_handshake`, after first hop OPEN (`hop == circ->cpath`, circuit BUILDING),
  gated by `TOR_FSM_ATTACK_CIRCUIT_HIJACK`, re-call `circuit_send_first_onion_skin(circ)` → emits
  a 2nd `circuit_send_first_onion_skin(): ...sending CREATE` log AFTER the `circuit_finish_handshake():
  Finished building circuit hop:` line → parser reads SEND_CREATE in BUILDING → CIRCUIT_HIJACK. The
  log IS produced (detection valid even when the run "fails").
  **Gotcha — NOT a crash:** `circuit_deliver_create_cell` (inside that function) REASSIGNS a new
  n_circ_id via get_unique_circ_id_by_chan. The relay answers the 2nd CREATE with CREATED on the
  new id; the already-built client circuit then logs `got extended when circ already built? Closing`
  and tears the circuit down. All circuits die → tgen never completes → Shadow reports the process
  "running" at sim end (exit≠0). It is the attack's real impact, not an assert/segfault.
  **Non-destructive fix (for a run that exits 0):** send the extra CREATE on the EXISTING
  `circ->n_circ_id` instead of reassigning — build the create_cell into a LOCAL throwaway
  `onion_handshake_state_t`, `create_cell_format()` it, set `cell.circ_id = circ->n_circ_id`,
  `append_cell_to_circuit_queue(TO_CIRCUIT(circ), circ->base_.n_chan, &cell, CELL_DIRECTION_OUT, 0)`,
  emit the recognized log, release the local state, return 0. Relay drops the duplicate CREATE on a
  known circ id → circuit survives → sim completes. (Needs create_cell_format/append_cell_to_circuit_queue
  declared in circuitbuild.c's includes — they are if circuit_deliver_create_cell is defined there; else
  add the header.) Patch saved at workspace `circuit_hijack.patch`.
- **HANDSHAKE_SKIP / PREMATURE_DATA — uncertain.** Need a recognized SEND_CREATE before TLS_OK
  (CONNECTING) resp. SEND_RELAY_DATA before circuit READY. These require sending the real cell
  from a context where Tor's invariants likely assert, or the recognized funcname is not on the
  path. Attempt via separate env gates; if Tor asserts / emits nothing, report HONESTLY as
  "stayed synthetic" — do not forge.

## Per-attack run pattern
One rebuild; per attack a separate Shadow run with only that env var set, parsed by cf_detect;
compare each against the env-OFF benign baseline. The attack's signal = the violation type that
is ~0 in benign and >0 under its flag (CREATE_FLOOD 0→9 verified; CIRCUIT_HIJACK benign=0).

**Scope honesty:** this does NOT make all of S6 real — only the attack types actually verified.
