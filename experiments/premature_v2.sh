#!/usr/bin/env bash
# PREMATURE_DATA real-attack v2 — one-shot apply + build + run + detect.
# Run from the repo root on the VM:  bash experiments/premature_v2.sh
# Idempotent: every edit is guarded, safe to re-run.
#
# Paths (override with env if needed):
TORSRC="${TORSRC:-$HOME/tor-0.4.6.10}"
CFT="${CFT:-/tmp/cf_test}"
HARNESS="experiments/shadow_harness.mjs"
CU="$TORSRC/src/core/or/circuituse.c"

set -u
say(){ printf '\n=== %s ===\n' "$1"; }

# ---------------------------------------------------------------------------
say "1) Tor patch: circuituse.c stream-attach hook"
if [ ! -f "$CU" ]; then echo "HATA: $CU yok"; exit 1; fi
if grep -q "TOR_FSM_ATTACK_PREMATURE_DATA" "$CU"; then
  echo "zaten uygulanmis (atlandi)"
else
  perl -0pi -e 's{(    retval = circuit_get_open_circ_or_launch\(conn,\n            connection_ap_get_nonrend_circ_purpose\(conn\),\n            &circ\);\n)}{    if (getenv("TOR_FSM_ATTACK_PREMATURE_DATA") &&\n        conn->socks_request->command == SOCKS_COMMAND_CONNECT &&\n        !ENTRY_TO_EDGE_CONN(conn)->on_circuit) {\n      SMARTLIST_FOREACH_BEGIN(circuit_get_global_list(), circuit_t *, fc) {\n        if (CIRCUIT_IS_ORIGIN(fc) && fc->state == CIRCUIT_STATE_BUILDING &&\n            fc->purpose == CIRCUIT_PURPOSE_C_GENERAL) {\n          origin_circuit_t *foc = TO_ORIGIN_CIRCUIT(fc);\n          if (foc->cpath && foc->cpath->state == CPATH_STATE_OPEN) {\n            link_apconn_to_circ(conn, foc, foc->cpath);\n            log_info(LD_CIRC, "TOR_FSM_PREMATURE_BEGIN gid=%u", (unsigned)foc->global_identifier);\n            if (connection_ap_handshake_send_begin(conn) >= 0)\n              return 1;\n          }\n        }\n      } SMARTLIST_FOREACH_END(fc);\n    }\n\n$1}' "$CU"
  if grep -q "TOR_FSM_PREMATURE_BEGIN" "$CU"; then echo "uygulandi OK"; else echo "HATA: hook eklenemedi (anchor eslesmedi)"; exit 1; fi
fi
grep -n "TOR_FSM_PREMATURE_BEGIN" "$CU"

# ---------------------------------------------------------------------------
say "2) Tor build"
( cd "$TORSRC" && make -j"$(nproc)" src/app/tor 2>&1 | tail -8 )
if [ ! -x "$TORSRC/src/app/tor" ]; then echo "HATA: tor binary yok"; exit 1; fi

# ---------------------------------------------------------------------------
say "3) Parser: shadow_harness.mjs (3 edit, guarded)"
if [ ! -f "$HARNESS" ]; then echo "HATA: $HARNESS yok (repo kokunden calistir)"; exit 1; fi
# 3a: yeni degiskenler
grep -q "lastReadyCircuitId" "$HARNESS" || perl -0pi -e 's{(  let buildingCircuitId = null;\n)}{$1  let lastReadyCircuitId = null;\n  let pendingPrematureGid = null;\n}' "$HARNESS"
# 3b: son-hop RECV_EXTENDED -> lastReadyCircuitId
grep -q "lastReadyCircuitId = cid;" "$HARNESS" || perl -0pi -e 's{(            event: "RECV_EXTENDED",\n            timestamp: ts,\n            host: hostName,\n          \}\);\n)}{$1          lastReadyCircuitId = cid;\n}' "$HARNESS"
# 3c: marker + yeni begin atifi
grep -q "TOR_FSM_PREMATURE_BEGIN" "$HARNESS" || perl -0pi -e 's{    if \(/connection_ap_handshake_send_begin.*?\n      continue;\n    \}\n}{    const pmark = line.match(/TOR_FSM_PREMATURE_BEGIN gid=(\\d+)/);\n    if (pmark) {\n      pendingPrematureGid = pmark[1];\n      if (!circuits[pendingPrematureGid]) circuits[pendingPrematureGid] = [];\n      continue;\n    }\n\n    if (/connection_ap_handshake_send_begin\\(\\): Sending relay cell/.test(line)) {\n      const bcid = pendingPrematureGid || lastReadyCircuitId || lastCircuitId;\n      pendingPrematureGid = null;\n      if (bcid && circuits[bcid]) {\n        circuits[bcid].push({\n          event: "SEND_RELAY_DATA",\n          timestamp: ts,\n          host: hostName,\n        });\n      }\n      continue;\n    }\n}s' "$HARNESS"
echo "parser kontrol:"; grep -n "lastReadyCircuitId\|pendingPrematureGid\|TOR_FSM_PREMATURE_BEGIN\|Sending relay cell" "$HARNESS"

# ---------------------------------------------------------------------------
say "4) Shadow yaml hazirligi"
if [ ! -d "$CFT" ]; then echo "HATA: $CFT yok"; exit 1; fi
cd "$CFT"
if [ ! -f shadow_benign.yaml ]; then echo "HATA: shadow_benign.yaml yok"; exit 1; fi
if [ ! -f shadow_premature.yaml ]; then
  cp shadow_benign.yaml shadow_premature.yaml
  perl -pi -e 's/environment: \{\}/environment: { TOR_FSM_ATTACK_PREMATURE_DATA: "1" }/' shadow_premature.yaml
fi
echo "premature yaml env satiri:"; grep -n "TOR_FSM_ATTACK_PREMATURE_DATA" shadow_premature.yaml || echo "(env satiri yok - yaml elle kontrol et)"
TPL=""; [ -d shadow.data.template ] && TPL="--template-directory shadow.data.template"

# ---------------------------------------------------------------------------
say "5) Shadow calistir (attack + benign)"
rm -rf shadow.data.premature shadow.data.benign2
~/.local/bin/shadow -d shadow.data.premature $TPL shadow_premature.yaml > sp.log 2>&1; echo "ATTACK EXIT=$?"; tail -2 sp.log
~/.local/bin/shadow -d shadow.data.benign2 $TPL shadow_benign.yaml > sb.log 2>&1; echo "BENIGN EXIT=$?"; tail -2 sb.log

# ---------------------------------------------------------------------------
say "6) Detection"
ATK="$CFT/shadow.data.premature/hosts/torclient/tor.1000.stdout"
BEN="$CFT/shadow.data.benign2/hosts/torclient/tor.1000.stdout"
cd - >/dev/null
echo "MARKER (attack icinde gercek erken-begin sayisi):"; grep -c "TOR_FSM_PREMATURE_BEGIN" "$ATK" 2>/dev/null || echo 0
echo "--- ATTACK detect ---"; npx tsx experiments/cf_detect.mjs "$ATK"
echo "--- BENIGN detect ---"; npx tsx experiments/cf_detect.mjs "$BEN"
say "BITTI"
