#!/usr/bin/env bash
# PREMATURE_DATA real-attack v3 — circuit-building hook (yeni tasarim).
#
# v1/v2 (stream-attach aninda BUILDING devre arama) yapisal olarak basarisizdi:
# probe kanitladi ki stream baglanirken hic BUILDING devre yok. v3 farkli yerde
# calisir: devre KURULURKEN, ilk hop ACIK + devre BUILDING iken, Tor'un kendi
# relay_send_command_from_edge() fonksiyonuyla ilk hop'a GERCEK erken DATA
# hucresi gonderir. Bu gercek premature penceresidir (circuit_send_next_onion_skin
# "Case two": ilk hop open, daha fazla hop var, devre BUILDING).
#
# Repo kokunden VM'de calistir:  bash experiments/premature_v3.sh
# Idempotent: her edit guarded, tekrar calistirilabilir.
#
TORSRC="${TORSRC:-$HOME/tor-0.4.6.10}"
CFT="${CFT:-/tmp/cf_test}"
HARNESS="experiments/shadow_harness.mjs"
CB="$TORSRC/src/core/or/circuitbuild.c"

set -u
say(){ printf '\n=== %s ===\n' "$1"; }

# ---------------------------------------------------------------------------
say "1) Tor patch: circuitbuild.c circuit_send_next_onion_skin hook"
if [ ! -f "$CB" ]; then echo "HATA: $CB yok"; exit 1; fi
if grep -q "TOR_FSM_PREMATURE_SEND" "$CB"; then
  echo "zaten uygulanmis (atlandi)"
else
  # "Case two" (ilk hop acik, devre BUILDING, daha fazla hop var) tam oncesine ekle.
  # env acikken: ilk hop'a (circ->cpath) gercek RELAY_COMMAND_DATA hucresi yolla,
  # gid=global_identifier ile logla (harness devreleri bu id ile anahtarliyor).
  perl -0pi -e 's{(  if \(hop\) \{\n    /\* Case two: we.re on a hop after the first\. \*/\n)}{  if (hop \&\& getenv("TOR_FSM_ATTACK_PREMATURE_DATA")) {\n    (void) relay_send_command_from_edge(0, TO_CIRCUIT(circ), RELAY_COMMAND_DATA,\n                                       "premature", 9, circ->cpath);\n    log_info(LD_CIRC, "TOR_FSM_PREMATURE_SEND gid=%u cstate=%d",\n             (unsigned)circ->global_identifier, (int)circ->base_.state);\n  }\n$1}' "$CB"
  if grep -q "TOR_FSM_PREMATURE_SEND" "$CB"; then echo "hook eklendi OK"; else echo "HATA: anchor eslesmedi (kaynak farkli olabilir)"; exit 1; fi
fi
grep -n "TOR_FSM_PREMATURE_SEND" "$CB"

# ---------------------------------------------------------------------------
say "2) Tor build"
( cd "$TORSRC" && make -j"$(nproc)" src/app/tor 2>&1 | tail -8 )
if [ ! -x "$TORSRC/src/app/tor" ]; then echo "HATA: tor binary yok (derleme basarisiz)"; exit 1; fi

# ---------------------------------------------------------------------------
say "3) Parser: shadow_harness.mjs (guarded edit)"
if [ ! -f "$HARNESS" ]; then echo "HATA: $HARNESS yok (repo kokunden calistir)"; exit 1; fi
# 3a: fonksiyonlari export et (detektor import edebilsin)
grep -q "export function parseTorHostLog" "$HARNESS" || perl -pi -e 's/^function parseTorHostLog\(/export function parseTorHostLog(/' "$HARNESS"
grep -q "export function runFsmOnAllCircuits" "$HARNESS" || perl -pi -e 's/^function runFsmOnAllCircuits\(/export function runFsmOnAllCircuits(/' "$HARNESS"
# 3b: TOR_FSM_PREMATURE_SEND gid=N -> circuits[gid]'e injected SEND_RELAY_DATA.
#     gid = global_identifier = harness'in devre anahtari. Durum BUILDING harness
#     tarafindan Tor'un circuit_finish_handshake loglarindan bagimsiz turetilir.
grep -q "TOR_FSM_PREMATURE_SEND" "$HARNESS" || perl -0pi -e 's{(    const circNew = line.match\(/origin_circuit_new)}{    const psend = line.match(/TOR_FSM_PREMATURE_SEND gid=(\\d+)/);\n    if (psend) {\n      const gid = psend[1];\n      if (circuits[gid]) {\n        circuits[gid].push({ event: "SEND_RELAY_DATA", timestamp: ts, host: hostName, injected: true, attackType: "PREMATURE_DATA" });\n      }\n      continue;\n    }\n\n$1}' "$HARNESS"
echo "parser kontrol:"; grep -n "export function parseTorHostLog\|export function runFsmOnAllCircuits\|TOR_FSM_PREMATURE_SEND" "$HARNESS"

# ---------------------------------------------------------------------------
say "4) Shadow yaml hazirligi"
if [ ! -d "$CFT" ] || [ ! -f "$CFT/shadow_benign.yaml" ]; then
  echo "cf_test/shadow_benign.yaml yok -> Shadow tor orneginden kuruluyor"
  EX="$(dirname "$(find "$HOME" -type f -path '*examples/docs/tor/shadow.yaml' -not -path '*/build/*' 2>/dev/null | head -1)")"
  if [ -z "$EX" ] || [ ! -f "$EX/shadow.yaml" ]; then echo "HATA: Shadow tor ornegi bulunamadi"; exit 1; fi
  PB="$TORSRC/src/app/tor"
  if [ ! -x "$PB" ]; then echo "HATA: patch'li tor binary yok: $PB"; exit 1; fi
  mkdir -p "$CFT"
  cp -r "$EX/conf" "$CFT/"
  cp -r "$EX/shadow.data.template" "$CFT/"
  cp "$EX/shadow.yaml" "$CFT/shadow_benign.yaml"
  PB="$PB" perl -0777 -pi -e 's/(\n  torclient:\n.*?\n    - path: )tor\n/$1$ENV{PB}\n      environment: {}\n/s' "$CFT/shadow_benign.yaml"
  if grep -q "environment: {}" "$CFT/shadow_benign.yaml"; then
    echo "shadow_benign.yaml kuruldu (kaynak: $EX, torclient -> $PB)"
  else
    echo "HATA: torclient tor sureci duzenlenemedi (yaml yapisi degismis olabilir)"; exit 1
  fi
fi
cd "$CFT"
rm -f shadow_premature.yaml
cp shadow_benign.yaml shadow_premature.yaml
perl -pi -e 's/environment: \{\}/environment: { TOR_FSM_ATTACK_PREMATURE_DATA: "1" }/' shadow_premature.yaml
echo "premature yaml env satiri:"; grep -n "TOR_FSM_ATTACK_PREMATURE_DATA" shadow_premature.yaml || echo "(env satiri yok - yaml elle kontrol et)"
TPL=""; [ -d shadow.data.template ] && TPL="--template-directory shadow.data.template"

# ---------------------------------------------------------------------------
say "5) Shadow calistir (attack + benign)"
rm -rf shadow.data.premature shadow.data.benign2
~/.local/bin/shadow -d shadow.data.premature $TPL shadow_premature.yaml > sp.log 2>&1; echo "ATTACK EXIT=$?"; tail -2 sp.log
~/.local/bin/shadow -d shadow.data.benign2 $TPL shadow_benign.yaml > sb.log 2>&1; echo "BENIGN EXIT=$?"; tail -2 sb.log

# ---------------------------------------------------------------------------
say "6) Detection (attack vs benign)"
ATK="$CFT/shadow.data.premature/hosts/torclient/tor.1000.stdout"
BEN="$CFT/shadow.data.benign2/hosts/torclient/tor.1000.stdout"
cd - >/dev/null
echo "MARKER (attack icindeki gercek erken-DATA gonderim sayisi):"; grep -c "TOR_FSM_PREMATURE_SEND" "$ATK" 2>/dev/null || echo 0
echo "MARKER ornek (ilk 3, cstate=4 => CIRCUIT_STATE_BUILDING):"; grep "TOR_FSM_PREMATURE_SEND" "$ATK" 2>/dev/null | head -3
echo "MARKER (benign'de olmamali):"; grep -c "TOR_FSM_PREMATURE_SEND" "$BEN" 2>/dev/null || echo 0
echo "--- ATTACK detect ---"; npx tsx experiments/premature_detect.mjs "$ATK"
echo "--- BENIGN detect ---"; npx tsx experiments/premature_detect.mjs "$BEN"
say "BITTI — gercek sinyal: ATTACK'ta INJECTED PREMATURE_DATA > 0, BENIGN'de = 0 olmali"
