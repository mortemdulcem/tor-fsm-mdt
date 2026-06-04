#!/usr/bin/env bash
# Kayitli loglardan results.jsonl'i YENIDEN URETIR (Shadow'u tekrar kosmadan).
#
# full_pipeline.sh saldiri/benign Shadow loglarini experiments/runs/ altina kalici
# kopyalar. Bu script o loglari okuyup detect_json.mjs'i tekrar calistirir; boylece
# detect_json/metrics degisikliklerini (or. injected/noise alanlari) PAHALI Shadow
# kosusu olmadan sonuca yansitiriz. native sayim + coklu-istemci mantigi
# full_pipeline.sh ile AYNI: her torclient* host'u ayri ornek satiri (--client).
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

# full_pipeline.sh ile AYNI native sayim. $3 = istemci host adi (cf/hijack per-client;
# premature relay-native kosum-seviyesi -> client yok sayilir).
native_count() {
  local attack="$1" hostsdir="$2" client="${3:-torclient}"
  case "$attack" in
    premature_data)
      grep -rh "Relay data cell with zero stream_id" "$hostsdir" 2>/dev/null | wc -l ;;
    create_flood|circuit_hijack)
      grep -ch "First hop: finished sending" "$hostsdir/$client/tor.1000.stdout" 2>/dev/null || echo 0 ;;
  esac
}

# Bir hosts dizinindeki istemci host adlarini sirali listele (torclient, torclient2, ...).
list_clients() {
  local d="$1"
  [ -d "$d" ] || { echo "torclient"; return 0; }
  local found
  found="$(find "$d" -maxdepth 1 -type d -name 'torclient*' -printf '%f\n' 2>/dev/null | sort -V)"
  [ -n "$found" ] && echo "$found" || echo "torclient"
}

: > "$RESULTS"
n=0
for seed in $SEEDS; do
  BHOSTS="$RUNS/_benign/seed$seed/hosts"
  for attack in $ATTACKS; do
    AHOSTS="$RUNS/$attack/seed$seed/hosts"
    if [ ! -d "$AHOSTS" ]; then echo "  atla: $attack seed=$seed (attack hosts yok: $AHOSTS)"; continue; fi

    # Coklu-istemci: her torclient* host'u AYRI bir ornek. premature relay-native
    # kosum-seviyesi -> yalniz birinci istemci satirina yazilir (digerleri null).
    CLIST="$(list_clients "$AHOSTS")"
    ci=0
    for client in $CLIST; do
      ci=$((ci + 1))
      ATK="$AHOSTS/$client/tor.1000.stdout"
      BEN="$BHOSTS/$client/tor.1000.stdout"
      if [ ! -f "$ATK" ]; then echo "  atla: $attack seed=$seed client=$client (attack log yok: $ATK)"; continue; fi

      if [ "$attack" = premature_data ]; then
        if [ "$ci" -eq 1 ]; then
          NAT_A="$(native_count "$attack" "$AHOSTS" "$client")"
          NAT_B="$(native_count "$attack" "$BHOSTS" "$client")"
        else
          NAT_A=null; NAT_B=null
        fi
      else
        NAT_A="$(native_count "$attack" "$AHOSTS" "$client")"
        NAT_B="$(native_count "$attack" "$BHOSTS" "$client")"
      fi
      MRK_A=0
      [ "$attack" = premature_data ] && MRK_A="$(grep -ch 'TOR_FSM_PREMATURE_SEND' "$ATK" 2>/dev/null || echo 0)"

      npx tsx experiments/detect_json.mjs --attack "$attack" --scenario attack --seed "$seed" --client "$client" --log "$ATK" --native "$NAT_A" --markers "$MRK_A" >> "$RESULTS" && n=$((n+1))
      if [ -f "$BEN" ]; then
        npx tsx experiments/detect_json.mjs --attack "$attack" --scenario benign --seed "$seed" --client "$client" --log "$BEN" --native "$NAT_B" --markers 0 >> "$RESULTS" && n=$((n+1))
      else echo "  uyari: benign log yok: $BEN"; fi
      echo "    $attack seed=$seed client=$client: native attack=$NAT_A benign=$NAT_B"
    done
  done
done

echo "results.jsonl satir sayisi: $n"
echo "--- injected/noise (hedef-tip) ozet ---"
node -e '
const fs=require("fs");
const L=fs.readFileSync("'"$RESULTS"'","utf8").trim().split("\n").map(JSON.parse);
for(const r of L) console.log(`${r.attack} seed=${r.seed} ${r.scenario}: flagged=${r.flagged} injected=${r.injected} noise=${r.noise} native=${r.native}`);
'
