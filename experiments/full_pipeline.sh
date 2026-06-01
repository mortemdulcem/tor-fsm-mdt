#!/usr/bin/env bash
# Birlesik gercek-saldiri pipeline'i (VM-only) — coklu seed + kalici saklama.
#
# Uc gercek saldiri (CREATE_FLOOD, CIRCUIT_HIJACK, PREMATURE_DATA) icin, her seed'de
# bir benign + saldiri basina bir attack Shadow kosusu calistirir; her kosunun
# loglarini KALICI dizine (experiments/runs/, /tmp DEGIL) kopyalar; non-circular
# native sinyali grep ile sayar; FSM dedektorunu (detect_json.mjs) calistirir ve
# tek-satir JSON sonucu results.jsonl'a ekler. Sonunda metrics.mjs'i calistirir.
#
# ONEMLI: Bu script Tor kaynagini YENIDEN YAMALAMAZ. VM kaynaginda hook'larin zaten
# uygulanmis olmasini bekler (create_flood + circuit_hijack patch'leri ve premature
# v3 hook'u, onceki oturumlarda dogrulandi). Bir hook yoksa o saldiri ATLANIR ve
# nedeni yazilir — calisan VM kaynagini bozmamak icin guvenli tasarim.
#
# Repo kokunden VM'de:  bash experiments/full_pipeline.sh
# Seedleri degistir:    SEEDS="42 137 2718" bash experiments/full_pipeline.sh
set -u

TORSRC="${TORSRC:-$HOME/tor-0.4.6.10}"
CB="$TORSRC/src/core/or/circuitbuild.c"
CFT="${CFT:-/tmp/cf_test}"               # Shadow calisma dizini (gecici scratch)
HARNESS="experiments/shadow_harness.mjs"
RUNS="experiments/runs"                   # KALICI cikti (repo disk)
RESULTS="$RUNS/results.jsonl"
SEEDS="${SEEDS:-42 137 2718}"
ATTACKS="create_flood circuit_hijack premature_data"

say() { printf '\n=== %s ===\n' "$1"; }

# Saldiri -> (env degiskeni, kaynaktaki hook imzasi, native grep deseni)
env_of()   { case "$1" in create_flood) echo TOR_FSM_ATTACK_CREATE_FLOOD;; circuit_hijack) echo TOR_FSM_ATTACK_CIRCUIT_HIJACK;; premature_data) echo TOR_FSM_ATTACK_PREMATURE_DATA;; esac; }
hookid_of(){ case "$1" in create_flood) echo TOR_FSM_ATTACK_CREATE_FLOOD;; circuit_hijack) echo TOR_FSM_ATTACK_CIRCUIT_HIJACK;; premature_data) echo TOR_FSM_PREMATURE_SEND;; esac; }

# Bir host log agacinda saldiriya ozgu native (non-circular) sinyali say.
#   premature: relay'in kendi protokol logu (tum hostlar)
#   create_flood/circuit_hijack: istemcinin organik CREATE log satiri (torclient)
native_count() {
  local attack="$1" hostsdir="$2"
  case "$attack" in
    premature_data)
      grep -rh "Relay data cell with zero stream_id" "$hostsdir" 2>/dev/null | wc -l ;;
    create_flood|circuit_hijack)
      grep -ch "First hop: finished sending" "$hostsdir/torclient/tor.1000.stdout" 2>/dev/null || echo 0 ;;
  esac
}

# Shadow yaml'ina seed yaz (general.seed). Yapidan bagimsiz, idempotent.
set_seed() {
  python3 - "$1" "$2" <<'PY'
import sys, re
f, seed = sys.argv[1], sys.argv[2]
s = open(f).read()
if re.search(r'^general:', s, re.M):
    if re.search(r'^[ \t]+seed:', s, re.M):
        s = re.sub(r'^([ \t]+)seed:.*$', r'\g<1>seed: ' + seed, s, count=1, flags=re.M)
    else:
        s = re.sub(r'^general:[^\n]*$', lambda m: m.group(0) + '\n  seed: ' + seed, s, count=1, flags=re.M)
else:
    s = 'general:\n  seed: ' + seed + '\n' + s
open(f, 'w').write(s)
PY
}

# ---------------------------------------------------------------------------
say "0) On kosullar"
[ -f "$CB" ] || { echo "HATA: $CB yok (TORSRC dogru mu?)"; exit 1; }
[ -f "$HARNESS" ] || { echo "HATA: $HARNESS yok (repo kokunden calistir)"; exit 1; }
command -v python3 >/dev/null || { echo "HATA: python3 gerekli (seed icin)"; exit 1; }

# Hangi saldirilarin hook'u kaynakta var?
ACTIVE=""
for a in $ATTACKS; do
  if grep -q "$(hookid_of "$a")" "$CB"; then ACTIVE="$ACTIVE $a"; echo "  [var]  $a hook'u kaynakta mevcut";
  else echo "  [YOK] $a hook'u kaynakta yok -> ATLANACAK (once ilgili patch/script uygulanmali)"; fi
done
ACTIVE="$(echo "$ACTIVE" | xargs)"
[ -n "$ACTIVE" ] || { echo "HATA: hicbir saldiri hook'u bulunamadi"; exit 1; }

# ---------------------------------------------------------------------------
say "1) Tor build (tek sefer)"
( cd "$TORSRC" && make -j"$(nproc)" src/app/tor 2>&1 | tail -6 )
[ -x "$TORSRC/src/app/tor" ] || { echo "HATA: tor binary yok (derleme basarisiz)"; exit 1; }
PB="$TORSRC/src/app/tor"

# ---------------------------------------------------------------------------
say "2) Harness'i import-guvenli + export'lu yap (idempotent)"
grep -q "export function parseTorHostLog" "$HARNESS" || perl -pi -e 's/^function parseTorHostLog\(/export function parseTorHostLog(/' "$HARNESS"
grep -q "export function runFsmOnAllCircuits" "$HARNESS" || perl -pi -e 's/^function runFsmOnAllCircuits\(/export function runFsmOnAllCircuits(/' "$HARNESS"
grep -q "pathToFileURL" "$HARNESS" || perl -pi -e 's/import \{ fileURLToPath \} from "node:url";/import { fileURLToPath, pathToFileURL } from "node:url";/' "$HARNESS"
grep -q "import.meta.url === pathToFileURL" "$HARNESS" || perl -pi -e 's/const results = await main\(\);/const results = (import.meta.url === pathToFileURL(process.argv[1]).href) ? await main() : null;/' "$HARNESS"

# ---------------------------------------------------------------------------
say "3) cf_test (Shadow calisma dizini) hazirligi"
if [ ! -d "$CFT" ] || [ ! -f "$CFT/shadow_benign.yaml" ]; then
  echo "cf_test yok -> Shadow tor orneginden kuruluyor"
  EX="$(dirname "$(find "$HOME" -type f -path '*examples/docs/tor/shadow.yaml' -not -path '*/build/*' 2>/dev/null | head -1)")"
  [ -n "$EX" ] && [ -f "$EX/shadow.yaml" ] || { echo "HATA: Shadow tor ornegi bulunamadi"; exit 1; }
  mkdir -p "$CFT"; cp -r "$EX/conf" "$CFT/"; cp -r "$EX/shadow.data.template" "$CFT/"
  cp "$EX/shadow.yaml" "$CFT/shadow_benign.yaml"
  PB="$PB" perl -0777 -pi -e 's/(\n  torclient:\n.*?\n    - path: )tor\n/$1$ENV{PB}\n      environment: {}\n/s' "$CFT/shadow_benign.yaml"
  grep -q "environment: {}" "$CFT/shadow_benign.yaml" || { echo "HATA: torclient tor sureci duzenlenemedi"; exit 1; }
  echo "shadow_benign.yaml kuruldu (kaynak: $EX)"
fi
TPL=""; [ -d "$CFT/shadow.data.template" ] && TPL="--template-directory shadow.data.template"

# ---------------------------------------------------------------------------
say "4) Coklu-seed kosular"
mkdir -p "$RUNS"
: > "$RESULTS"   # results.jsonl sifirla
REPO="$(pwd)"

for seed in $SEEDS; do
  echo "--- seed=$seed ---"
  ( cd "$CFT"
    # benign: tek kosu/seed (env yok)
    cp shadow_benign.yaml "shadow_seed.yaml"
  )
  set_seed "$CFT/shadow_seed.yaml" "$seed"
  ( cd "$CFT"
    rm -rf "shadow.data.benign.$seed"
    ~/.local/bin/shadow -d "shadow.data.benign.$seed" $TPL shadow_seed.yaml > "sb.$seed.log" 2>&1
    echo "  BENIGN seed=$seed EXIT=$?"
  )
  BHOSTS="$CFT/shadow.data.benign.$seed/hosts"
  mkdir -p "$RUNS/_benign/seed$seed"
  cp -r "$BHOSTS" "$RUNS/_benign/seed$seed/" 2>/dev/null || true

  for attack in $ACTIVE; do
    ev="$(env_of "$attack")"
    ( cd "$CFT"
      cp shadow_benign.yaml "shadow_$attack.yaml"
      perl -pi -e "s/environment: \\{\\}/environment: { $ev: \"1\" }/" "shadow_$attack.yaml"
    )
    set_seed "$CFT/shadow_$attack.yaml" "$seed"
    ( cd "$CFT"
      rm -rf "shadow.data.$attack.$seed"
      ~/.local/bin/shadow -d "shadow.data.$attack.$seed" $TPL "shadow_$attack.yaml" > "s_$attack.$seed.log" 2>&1
      echo "  ATTACK $attack seed=$seed EXIT=$?"
    )
    AHOSTS="$CFT/shadow.data.$attack.$seed/hosts"
    mkdir -p "$RUNS/$attack/seed$seed"
    cp -r "$AHOSTS" "$RUNS/$attack/seed$seed/" 2>/dev/null || true

    ATK="$AHOSTS/torclient/tor.1000.stdout"
    BEN="$BHOSTS/torclient/tor.1000.stdout"
    NAT_A="$(native_count "$attack" "$AHOSTS")"
    NAT_B="$(native_count "$attack" "$BHOSTS")"

    if [ -f "$ATK" ]; then
      npx tsx experiments/detect_json.mjs --attack "$attack" --scenario attack --seed "$seed" --log "$ATK" --native "$NAT_A" >> "$RESULTS"
    else echo "  UYARI: attack log yok: $ATK"; fi
    if [ -f "$BEN" ]; then
      npx tsx experiments/detect_json.mjs --attack "$attack" --scenario benign --seed "$seed" --log "$BEN" --native "$NAT_B" >> "$RESULTS"
    else echo "  UYARI: benign log yok: $BEN"; fi
    echo "    $attack seed=$seed: native attack=$NAT_A benign=$NAT_B"
  done
done

# ---------------------------------------------------------------------------
say "5) Metrikler"
echo "results.jsonl satir sayisi: $(wc -l < "$RESULTS")"
node experiments/metrics.mjs "$RESULTS"

say "BITTI"
echo "Kalici loglar: $RUNS/<attack>/seed<seed>/  ve  $RUNS/_benign/seed<seed>/"
echo "Ham sonuc:    $RESULTS"
