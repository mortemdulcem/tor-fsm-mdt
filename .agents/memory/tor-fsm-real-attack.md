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

## PREMATURE_DATA — NOW REALIZED via v3 build-path hook (supersedes the v2 "not realizable" verdict below)
The v2 STREAM-ATTACH approach (hook in circuituse.c when an app stream attaches) is genuinely
unreachable — see the v2 section lower in this file; keep that as the negative result for THAT path.
v3 succeeds via a DIFFERENT, genuine path: inject the early cell from WITHIN circuit construction.
- **Hook:** `circuitbuild.c` `circuit_send_next_onion_skin()`, right after the asserts at the top
  (line ~935 `tor_assert(circ->base_.state == CIRCUIT_STATE_BUILDING)` GUARANTEES BUILDING here),
  BEFORE the `if (hop)` "Case two" block. Gated by `getenv("TOR_FSM_ATTACK_PREMATURE_DATA")` AND
  `hop` (a non-first hop exists). Sends a REAL early DATA cell with Tor's own function:
  `relay_send_command_from_edge(0, TO_CIRCUIT(circ), RELAY_COMMAND_DATA, "premature", 9, circ->cpath)`
  then `log_info(LD_CIRC, "TOR_FSM_PREMATURE_SEND gid=%u cstate=%d", circ->global_identifier, circ->base_.state)`.
  `relay.h` already included (circuitbuild.c line ~52); compiles clean on VM Tor 0.4.6.10.
- **cstate=0 == CIRCUIT_STATE_BUILDING** (printed value; the line-935 assert proves BUILDING). The
  marker's `gid` = `global_identifier` = the harness's circuit key, so the event attributes to the
  right circuit.
- **Harness wiring:** `TOR_FSM_PREMATURE_SEND gid=N` → push `{event:"SEND_RELAY_DATA", injected:true,
  attackType:"PREMATURE_DATA"}` onto circuits[N]. FSM: BUILDING × SEND_RELAY_DATA → PREMATURE_DATA (HIGH).
- **Marker run (Shadow, env-gated, same binary):** marker fired 12× (gids 3,4,...); FSM detector
  INJECTED PREMATURE_DATA = 5/5/7 across seeds, 0 in benign. **VERIFIED on saved logs (2026-06-01):
  ALL 12 markers/seed are cstate=0 (BUILDING)** — so every marker is a real premature send and the
  recall denominator (=markers) is sound. The 12→5/5/7 gap is GENUINE FSM/parser coverage loss, NOT
  non-violation READY-state calls (earlier hypothesis was WRONG; do not refine denominator). begin-noise
  (lastCircuitId mis-attribution) is ~6 attack / ~9 benign in BOTH runs — report SEPARATELY.
- **CIRCULARITY CAVEAT (important, user-flagged):** the marker-based FSM detection above is SEMI-CIRCULAR
  — the same patch that sends the cell ALSO emits the `TOR_FSM_PREMATURE_SEND` marker the detector keys
  on. This is exactly the flaw we rejected in the Devin branch. The cell is REAL, but the detection
  signal is self-emitted, so it is weaker than CREATE_FLOOD/CIRCUIT_HIJACK (those key on Tor's OWN native
  log). Do NOT present the marker/FSM number as the clean headline result.
- **NON-CIRCULAR signal (the honest proof):** the premature cell is sent with `stream_id=0`
  (`relay_send_command_from_edge(0, ...)`). The first-hop relay processes it and Tor's OWN code at
  `src/core/or/relay.c:1677` logs `"Relay data cell with zero stream_id. Dropping."` via
  `log_fn(LOG_PROTOCOL_WARN, LD_PROTOCOL, ...)`. This is Tor's native protocol-violation log, a real
  consequence of the real cell — NOT a marker. Detection = grep ALL host logs (relays) for that line:
  attack>0, benign=0. Same non-circular logic as CREATE_FLOOD keying on the native duplicate SEND_CREATE.
  premature_v3.sh step 6 now reports this as the PRIMARY signal; marker+FSM are cross-check/illustrative.
- **VM-VERIFIED (non-circular):** native line appears on `relay1` (first hop), emitted by Tor's own
  `handle_relay_cell_command()` (the relay.c:1677 message; func name is the wrapper, still native).
  ATTACK = 12 lines / 1 host, BENIGN = 0. 1:1 with the 12 markers → each real premature cell really
  reached relay1 and Tor rejected it. LOG_PROTOCOL_WARN→INFO worked because the shadow tor example's
  `conf/tor.common.torrc` (`Log info stdout`) applies to relays too. PREMATURE_DATA now stands on the
  SAME non-circular footing as CREATE_FLOOD/CIRCUIT_HIJACK.
- **Framing:** fault-injected real protocol violation in MODIFIED Tor, env-gated, benign-by-default —
  NOT a claim that a stock client or remote attacker emits this.
- **Status: THREE attacks real+verified (native-log, non-circular): CREATE_FLOOD, CIRCUIT_HIJACK,
  PREMATURE_DATA.** Files on premature-transport branch: experiments/premature_v3.sh (+ premature_detect.mjs).

## Tez figürleri: kullanıcının GERÇEK VM ekran görüntülerini kullan (uydurma diyagram değil)
Kullanıcı VM kanıtını `attached_assets/`'e ekran görüntüsü olarak gönderiyor (git-tracked).
**Ders:** "görsel yok" demeden önce `ls attached_assets/` ile bak; VM/Shadow figürlerinde
SVG uydurma yerine bu gerçek ekran görüntülerini base64 ile göm (HTML+PDF kendine yeterli).
- En temiz VM ortam görseli: VirtualBox Yöneticisi "Güç Kapalı" detay görünümü (overlay yok).
- **Sürüm tuzağı (tutarlılık):** VirtualBox misafir-OS *tür etiketi* "Ubuntu 22.10 (Kinetic Kudu)"
  görünür ama fiilen kurulan ISO `ubuntu-22.04.5-desktop-amd64.iso` → sistem **Ubuntu 22.04.5 LTS**.
  Metinde 22.04(.5) yaz, etiketin yalnızca VBox ayarı olduğunu açıkla; figürle metin çelişmesin.
- VM gerçek konfig (ekrandan): 8192 MB RAM, 4 vCPU, EFI, VMSVGA 16 MB, 50 GB VDI, Intel PRO/1000 NAT.
- **Akademik temizlik:** ham 1920×1080 ekran görüntüleri masaüstü/taskbar/tarayıcı/Replit/kişisel
  öğeler içerir; teze koymadan önce ImageMagick (`magick ... -crop WxH+X+Y +repage`) ile yalnızca
  VirtualBox penceresine kırp. Kırpılmışları `thesis/assets/` altında tut, base64 göm.
- **Sihirbaz-tuzağı:** "Sanal donanımı belirle" yeni-VM sihirbazı görseli VARSAYILANLARI gösterir
  (2048 MB / 1 işlemci / 25 GB) — fiili konfigle (8192/4/50) çelişir; provisioning kanıtı diye
  KULLANMA. Kanıt için "Ayrıntılar/detay" görünümünü kullan (gerçek değerleri gösterir).

## Tor günlük kaynakları + kaynakça sayı kısıtı
- **İki Tor sayfasını karıştırma:** (1) `metrics.torproject.org/web-server-logs.html` =
  Tor'un WEB sitelerinin sanitize Apache HTTP erişim logları (web trafiği) — devre/hücre/FSM
  verisi DEĞİL; FSM analizine konamaz. (2) `support.torproject.org/.../reading-tor-logs/` =
  kendi Tor istemcinin NOTICE/WARN logunu okuma rehberi (Bootstrapped %, handshake, "Failed to
  find node for hop 0... Discarding this circuit"); izin GEREKMEZ, kendi sürecinin çıktısı.
- **İzin/etik kısıtı yalnızca CANLI Tor ağında aktif saldırı/deney içindir** — log okumak için değil.
  Bu yüzden deneyler Shadow simülasyonunda; FSM Σ olayları gerçek Tor log fazlarına dayandırılır (3.1).
- **Kaynakça kısıtı:** tez metni "20 birincil kaynak" (kümeler 6+...+3=20) der ve numaralı IEEE
  kaynakça tam 20'dir. SLR-dışı teknik dokümanları (Tor doc sayfaları) numaralı kaynakçaya EKLEME —
  "20" iddiasını bozar; metin-içi çevrimiçi kaynak (URL) olarak ver, tor-spec'i mevcut [19] ile atıfla.
- **İntegrite uyarısı:** tez `experiments/shadow_harness.mjs`'e 3 yerde atıf yapar ama dosya YOK
  (gerçek dosyalar: detect_json.mjs, tor_static_fsm.mjs, full_pipeline.sh). Native/çok-istemci
  görevleri merge olunca harness adını doğrula; uydurma dosya atfı replit.md'ye aykırı.

## Multi-seed metrics pipeline (full_pipeline.sh + metrics.mjs + detect_json.mjs)
- **Patch files are NOT clean `patch -p1` diffs.** `create_flood.patch` is a near-clean unified diff,
  but `circuit_hijack.patch` and `premature_data.patch` are PROSE + partial/truncated hunks
  (premature_data.patch is the STALE v1 circuituse.c path, superseded by the v3 perl hook in
  premature_v3.sh). So do NOT auto-`patch -p1` them. `full_pipeline.sh` instead ASSUMES the VM tor
  source already has the hooks (greps circuitbuild.c for TOR_FSM_ATTACK_CREATE_FLOOD /
  _CIRCUIT_HIJACK / TOR_FSM_PREMATURE_SEND) and SKIPS any attack whose hook is absent — safe, never
  edits the working source.
- **Confusion-matrix methodology (honest):** unit = client circuit; label = scenario (attack=+,
  benign=−); prediction = FSM flags that type on the circuit. Recall is HIGH BY CONSTRUCTION (the
  detector keys on the event the attack produces), so the scientifically meaningful number is the
  benign FALSE-POSITIVE RATE, not recall. CREATE_FLOOD/CIRCUIT_HIJACK get a clean per-seed confusion
  matrix (non-circular: organic CREATE log). PREMATURE is reported SEPARATELY: native relay
  zero-stream-id count (attack vs benign) as the headline, begin-noise FPR (noise/circuits) as the
  honest detector FPR, marker recall only with a "semi-circular" caveat.
- **Seeds** set via Shadow `general.seed` (python text-edit in full_pipeline.sh, structure-agnostic).
  metrics.mjs aggregates mean±SD±95% t-CI (n=3 → wide; hardcoded t-table). `node metrics.mjs
  --selftest` validates the formulas with non-real numbers (clearly labelled).
- Files live on `premature-transport` branch: full_pipeline.sh, detect_json.mjs, metrics.mjs,
  attack_status.md (the gerçek/sentetik/gerçekleştirilemez classification table for the thesis).

## Multi-seed RESULT corrects earlier single-run claims — three-mode honest metrics
Single-run notes below saying "CIRCUIT_HIJACK benign=0" are WRONG/misleading; the 3-seed
(42/137/2718) recompute over the SAVED logs shows a different, honest picture.
- **injected-tag asymmetry (root fact):** the violation object has NO circuit id and only
  PREMATURE carries `injected:true` (the parser tags only the `TOR_FSM_PREMATURE_SEND`
  marker). create_flood and circuit_hijack runs have `injected=0` for ALL seeds — the
  parser never tags their hooks. So event-level ground-truth exists ONLY for premature.
- **begin-noise has TWO faces (same single bug):** `lastCircuitId` mis-attribution routes a
  benign event onto a newer circuit; `classifyInvalid` then files it as CIRCUIT_HIJACK
  (CREATE/EXTEND on active circuit) OR PREMATURE_DATA (DATA during build). Hence benign
  produces ~12 CIRCUIT_HIJACK AND ~5 PREMATURE per run. CREATE_FLOOD is immune (its
  signature is duplicate CREATE only in CREATE_SENT).
- **Three honest report modes (metrics.mjs branches by attack name):**
  - create_flood = tip-temiz confusion: benign CREATE_FLOOD=0 always → P=R=F1=1.0, FPR=0;
    native organic CREATE 18 vs 9.
  - premature = event-level using injected: TP=injected(5/5/7), FP=attack.noise, FN=markers−injected
    → P≈0.50, R≈0.47, F1≈0.48; benign begin-noise FPR≈0.48; native 12 vs 0 (headline).
  - circuit_hijack = NON-discriminative at FSM level: injected=0, benign baseline=12 (cannot
    build a clean confusion → DO NOT fabricate one). Attack is still REAL but provable ONLY
    via non-circular native (attack 18/20/18 vs benign 9, no overlap). Report counts+native.
- **`recompute.sh`** regenerates results.jsonl from the saved `experiments/runs/<attack>/seed<seed>/`
  + `_benign/` logs WITHOUT rerunning Shadow — use it to re-aggregate after metrics changes.
- **Resolved:** the earlier seed=2718 circuit_hijack interruption was re-run clean — all 3 seeds now
  EXIT=0, native attack=18/20/18 (mean 18.667±1.155), FSM-tip 21.333±0.577. No interrupted-run caveat.

## NOT genuinely realizable: HANDSHAKE_SKIP (structural blocker)
- **HANDSHAKE_SKIP** needs SEND_CREATE in IDLE/CONNECTING or SEND_EXTEND in CREATE_SENT. Tor sends the
  first CREATE only AFTER the channel/TLS is OPEN (circuit_send_first_onion_skin is gated on channel
  ready); parser emits SEND_EXTEND only on the 2nd+ circuit_finish_handshake (after hop1 RECV_CREATED).
  So the recognized log can't appear before its prerequisite without FABRICATING the log line (forbidden).
- **Benign PREMATURE_DATA begin-noise is a PARSER ARTIFACT**, not real premature data: begin for an
  already-OPEN circuit gets attributed to a more-recently-created circuit via `lastCircuitId` (its FSM
  still early). Report this as a detector limitation / FPR source, separate from the injected signal.

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

## /tmp/cf_test is volatile — rebuild from the Shadow tor example
The Shadow working dir `/tmp/cf_test` (shadow_benign.yaml + conf/ + shadow.data.template) is wiped on
VM reboot (tmpfs). There is NO backup elsewhere. Rebuild it from the pristine Shadow tor example at
`~/shadow/examples/docs/tor` (has shadow.yaml, conf/, shadow.data.template with a torclient host).
- The example's `conf/tor.common.torrc` ALREADY sets `Log info stdout` → torclient logs at INFO; no torrc edit needed for the harness.
- Example uses `path: tor` (PATH = stock 0.4.6.10) for all relays/authority/exits; only torclient must be repointed to the patched binary `~/tor-0.4.6.10/src/app/tor`.
- The env-gate design needs an empty `environment: {}` ONLY on torclient's tor process; the premature/attack
  variant does `s/environment: {}/environment: { TOR_FSM_ATTACK_*: "1" }/` (tgen hosts have non-empty env, so they don't match).
- Relative paths: shadow runs FROM cf_test; host runtime dir `cf_test/shadow.data.*/hosts/<h>/` resolves `../../../conf/` → `cf_test/conf/`, so conf/ MUST be copied into cf_test.
- `experiments/premature_v2.sh` step 4 now auto-builds cf_test if missing (finds the example via `find $HOME -path '*examples/docs/tor/shadow.yaml' -not -path '*/build/*'`).

## v2 STREAM-ATTACH path is NOT realizable (SUPERSEDED by v3 build-path hook above — keep as negative result for THIS path only)
NOTE: this section is the negative result for the STREAM-ATTACH approach only. PREMATURE_DATA IS
realized via the v3 build-path hook (see the v3 section earlier). Do not read this as "PREMATURE_DATA impossible".
Attempted via env-gated hook in `circuituse.c` (premature-transport branch, `experiments/premature_v2.sh`):
when a CONNECT stream attaches, scan for an origin general circuit in `CIRCUIT_STATE_BUILDING` whose
last-hop `cpath->state == CPATH_STATE_OPEN`, then `link_apconn_to_circ` + `connection_ap_handshake_send_begin`.
A `TOR_FSM_PREMATURE_PROBE` log counts candidates at each attach attempt.
**Result (Shadow, patched tor 0.4.6.10):** probe fired 15x (env + patched binary confirmed effective), but
EVERY attempt showed `building=0 building_cpath_open=0` (open=0..6). MARKER (actual early-begin) = 0.
**Why:** Tor builds circuits proactively and only attaches a stream to an ALREADY-OPEN circuit; the instant a
circuit's last hop cpath opens, the circuit transitions to OPEN — so "BUILDING with open last hop" is
essentially unreachable by design. This IS the defense the FSM models (no data before CIRCUIT_READY).
**Decision:** stop trying. PREMATURE_DATA stays a SIMULATED attack type in the thesis; report the negative
result as evidence of Tor's defense. Real+verified attacks remain only CREATE_FLOOD + CIRCUIT_HIJACK.
Separately: `cf_detect.mjs` imports `parseTorHostLog`/`runFsmOnAllCircuits` from `shadow_harness.mjs` but those
export names don't exist → wrapper is broken; the harness itself is the working detector. Irrelevant when MARKER=0.

## Devin AI `feature/attack-scenarios` branch = FABRICATED, do NOT use in thesis
A parallel branch (Devin AI) adds `attacks/*.patch` + `attack_harness.mjs` claiming 4 "real" attacks
(HANDSHAKE_SKIP, REPLAY_ATTACK, PREMATURE_DATA, CIRCUIT_BYPASS). All four patches are non-functional
pseudo-code: they reference Tor symbols that DO NOT EXIST (`conn->tls_state`, `TLS_STATE_OPEN`,
`circuit_send_create_cell`, `CONN_STATE_READY`, `relay_data_to_client`, `attacker_replay_cache`), use JS
syntax (`for (const x in ...)`) inside a C patch, and have invalid hunk context (modify the file's comment
header) so `git apply` fails. Detection is CIRCULAR: the only signal is an injected `log_notice("ATTACK_*")`
that is both the "attack" and the "ground-truth oracle". This violates replit.md (plausible methodology +
fabrication). It also claims-as-real exactly the two attacks proven NOT realizable here. Keep thesis honest:
only CREATE_FLOOD + CIRCUIT_HIJACK are real; ignore this branch (PR #3, #4 are draft + "Devin Review: failure").

## ML baseline — deterministik veride dürüst değerlendirme dersi
Shadow verisi deterministik: sınıf başına yalnız 8-11 eşsiz öznitelik vektörü, gerisi seed
kopyası. **Ders:** seed-bazlı LOSO bu veride sızıntıyı ÖNLEMEZ (test vektörünün %83-97'si
train'de birebir) → CV metrikleri dağıtım-içi/iyimser, genelleme değil. Güvenilir kanıt
CV'den bağımsız **yapısal ayrılabilirlik**: sınıfların eşsiz vektör kümeleri örtüşmesi.
- **Why:** create_flood ve circuit_hijack eşsiz vektörleri büyük ölçüde ortak (ikisi de
  SEND_CREATE=2) ve benign ile sıfır örtüşür; premature benign'e en yakın. Bu, FSM bulgularını
  (hijack ayırt edici değil; premature kapsam kaybı) bağımsız yöntemle teyit eder.
- **How to apply:** Bu repoda ML metriği raporlarken önce eşsiz-vektör örtüşmesini ver; LOSO/CV
  sayılarını "iyimser" etiketiyle sun; zayıf-etiket etkisini iki yönlü (denetimlide FN↑,
  anomalide recall↑) belirt; FSM ile ortak confusion matrisi uydurma (birimler farklı).
- **Sızıntısız değerlendirme eklendi (GroupKFold, grup=eşsiz vektör):** LOSO yan yana sunulur.
  Kritik dürüst bulgu: sızıntı kaldırılınca tablo ÇÖKMEZ — create_flood/hijack recall hâlâ 1.0
  (ayrım gerçek SEND_CREATE=2 sinyalinden, ezberden değil); precision 1.0→~0.95 DÜŞER (kaybolan
  tek şey train'deki birebir benign kopyalarının yarattığı yapay precision); premature recall
  yine ~0.04; çok-sınıflı accuracy ~0.54→~0.55 sabit. **Why:** sızıntısız GroupKFold değerlendirmesi
  sızıntı endişesini giderdi; sonuç ayrılabilirlik niteliğini değiştirmiyor, sadece iyimser precision şişmesini
  açıklıyor. Data çoğaltma Shadow gerektirir (Replit'te çalışmaz) → sentetik EKLENMEDİ, dürüstçe
  sınır yazıldı. Sayılar ml_baseline_results.json["leakfree"]'den; tez Tablo 4.17d + 6.2.2.
## ML seq/timing features — workspace lacks raw sequences (VM-only)
ml_features.csv (count-level + real dur_ms) is the ONLY per-circuit data in the Replit repo.
Raw ORDERED event sequences w/ per-event timestamps (needed for n-gram + inter-event delay)
live ONLY on the VM; export_features.mjs regenerates them (writes ml_dataset.json + CSV).
- **n-gram/timing extraction** added to export_features.mjs (bigrams bg_*, inter-event gap
  mean/med/max t_*, t_first_data_ms, seq_setup_before_data) and ml_baseline.py section 5
  (after the leak-free GroupKFold section 4) auto-detects these columns (count-only vs
  count+seq+timing LOSO compare). Absent in committed CSV → script honestly runs dur_ms-only
  and reports "ngram_available:false".
- **Why dur_ms-only is misleading:** adding a continuous/noisy timing feature (dur_ms) mechanically
  drops unique-vector OVERLAP (every circuit vector becomes near-unique) WITHOUT changing recall —
  NOT real separation. So `improved` is gated on recall/accuracy gain, and overlap-drop only counts
  when discrete n-gram/seq columns exist. Current real result: dur_ms changes nothing (AYRIM SINIRLI).
- **How to apply:** real n-gram/inter-event comparison numbers must come from a VM CSV regen; thesis
  Bölüm 4.17(d) reads ml.sequence_timing and writes the honest "pending VM" branch when ngram absent.

- **Çeşitlilik darboğazı seed DEĞİL topolojidir.** Veri deterministik olduğundan sadece `SEEDS=`
  eklemek çoğunlukla kopya vektör üretir (modest unique-vector kazancı). Gerçek örüntü çeşitliliği
  için VM'de farklı SENARYO gerek (daha çok istemci/devre, tgen akış sayısı, topoloji) — Replit'te
  yapılamaz, sentetik yasak. **Why:** ML kanıtını "daha çeşitli veri" ile güçlendirme görevi bu
  yüzden VM-bloklu; analiz tarafı (ml_baseline.py) tamamen veri-güdümlü, genişletilmiş veriyi kod
  değişikliği olmadan yutar. **How to apply:** full_pipeline.sh artık adım 6'da export_features +
  ml_baseline'ı zincirler → VM'de `SEEDS="..." bash experiments/full_pipeline.sh` tek komutta
  ml_features.csv + ml_baseline_results.json'ı yeniler; tez sayıları JSON'dan otomatik gelir.
- **Çok-istemci kaldıracı UYGULANDI (`CLIENTS=` parametresi).** Diversity için en temiz yol: her ek
  torclient host'u Shadow'da AYRI RNG akışı (general.seed + host adı) alır → farklı yol/zamanlama →
  gerçekten farklı devreler (sentetik DEĞİL). `experiments/make_clients.py` (bağımsızlıksız, saf
  metin — PyYAML VM'de de yok) tek `torclient` blok'unu N'e çoğaltır. **KRİTİK:** yalnız host
  başlığı + `--Address/--Nickname` değişir; tgen `tgen.torclient.graphml.xml` yolu ASLA
  rename edilmez (içinde "torclient" geçer ama hepsi paylaşır). Attack env perl `s/environment:
  {}/.../` zaten satır-satır çalışır → tüm istemciler env-gate alır; tgen `{ OPENBLAS... }` boş
  `{}` olmadığı için dokunulmaz. **Kapsam (önemli):** ek istemciler yalnız ML yolunu (4.17:
  export_features tüm `torclient*` loglarını okur, gid'i host'la önekler) besler; native/4.16
  detect_json+metrics birincil torclient'te kalır (metrics `byAttack[atk][seed][scenario]` üzerine
  yazıyor → istemci başına ayrı satır 4.16'yı bozardı). `CLIENTS=1` tam geriye uyumlu (varsayılan).

## 4.16 native confusion now multi-client (detect_json --client + metrics seed×client)
detect_json.mjs emits a `client` field; metrics.mjs groups `byAttack[attack][seed][client][scenario]`
and flattens each (seed,client) into one sample — N clients = N× samples for 4.16 (no overwrite).
CLIENTS=1 reproduces old numbers byte-for-byte (missing `client` defaults to "torclient").
- **Premature native is RUN-LEVEL, not per-client.** The non-circular signal (relay "Relay data cell
  with zero stream_id") is logged by relays and cannot be attributed to one torclient. So the pipeline
  passes the run-global native only on the FIRST client's row and `--native null` for the rest;
  metrics.mjs skips null natives (helper `pushNat`) so it's counted ONCE per run.
  **Why:** replicating the same native across "independent" client samples would fake-shrink the CI.
  Event-level confusion (injected/noise/markers) IS per-client, so premature native (n=seeds) and
  premature event-level (n=seeds×clients) legitimately report different n in the same block.
- create_flood/circuit_hijack native ("First hop: finished sending") IS per-client (grep that client's
  own tor.1000.stdout). full_pipeline.sh + recompute.sh share `list_clients` + `native_count <a> <dir> <client>`.
