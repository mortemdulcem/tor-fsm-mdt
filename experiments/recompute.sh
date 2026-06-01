#!/usr/bin/env bash
# Kayitli loglardan results.jsonl'i YENIDEN URETIR (Shadow'u tekrar kosmadan).
#
# full_pipeline.sh saldiri/benign Shadow loglarini experiments/runs/ altina kalici
# kopyalar. Bu script o loglari okuyup detect_json.mjs'i tekrar calistirir; boylece
# detect_json/metrics degisikliklerini (or. injected/noise alanlari) PAHALI Shadow
# kosusu olmadan sonuca yansitiriz. native sayim mantigi full_pipeline ile AYNI.
#
# Repo kokunden VM'de:  bash experiments/recompute.sh
set -u

RUNS="experiments/runs"
RESULTS="$RUNS/results.jsonl"
HARNESS="experiments/shadow_harness.mjs"
SEEDS="${SEEDS:-42 137 2718}"
ATTACKS="create_flood circuit_hijack premature_data"

[ -f "$HARNESS" ] || { echo "HATA: $HARNESS yok (repo kokunden calistir)"; exit 1; }
[ -d "$RUNS" ] || { echo "HATA: $RUNS yok (once full_pipeline.sh kosulmali)"; exit 1; }

# full_pipeline.sh ile AYNI native sayim.
native_count() {
  local attack="$1" hostsdir="$2"
  case "$attack" in
    premature_data)
      grep -rh "Relay data cell with zero stream_id" "$hostsdir" 2>/dev/null | wc -l ;;
    create_flood|circuit_hijack)
      grep -ch "First hop: finished sending" "$hostsdir/torclient/tor.1000.stdout" 2>/dev/null || echo 0 ;;
  esac
}

: > "$RESULTS"
n=0
for seed in $SEEDS; do
  BHOSTS="$RUNS/_benign/seed$seed/hosts"
  BEN="$BHOSTS/torclient/tor.1000.stdout"
  for attack in $ATTACKS; do
    AHOSTS="$RUNS/$attack/seed$seed/hosts"
    ATK="$AHOSTS/torclient/tor.1000.stdout"
    if [ ! -f "$ATK" ]; then echo "  atla: $attack seed=$seed (attack log yok: $ATK)"; continue; fi

    NAT_A="$(native_count "$attack" "$AHOSTS")"
    NAT_B="$(native_count "$attack" "$BHOSTS")"
    MRK_A=0
    [ "$attack" = premature_data ] && MRK_A="$(grep -ch 'TOR_FSM_PREMATURE_SEND' "$ATK" 2>/dev/null || echo 0)"

    npx tsx experiments/detect_json.mjs --attack "$attack" --scenario attack --seed "$seed" --log "$ATK" --native "$NAT_A" --markers "$MRK_A" >> "$RESULTS" && n=$((n+1))
    if [ -f "$BEN" ]; then
      npx tsx experiments/detect_json.mjs --attack "$attack" --scenario benign --seed "$seed" --log "$BEN" --native "$NAT_B" --markers 0 >> "$RESULTS" && n=$((n+1))
    else echo "  uyari: benign log yok: $BEN"; fi
    echo "    $attack seed=$seed: native attack=$NAT_A benign=$NAT_B"
  done
done

echo "results.jsonl satir sayisi: $n"
echo "--- injected/noise (hedef-tip) ozet ---"
node -e '
const fs=require("fs");
const L=fs.readFileSync("'"$RESULTS"'","utf8").trim().split("\n").map(JSON.parse);
for(const r of L) console.log(`${r.attack} seed=${r.seed} ${r.scenario}: flagged=${r.flagged} injected=${r.injected} noise=${r.noise} native=${r.native}`);
'
