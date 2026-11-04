set +e
AFLNET=$HOME/aflnet
TOR=$HOME/tor-aflsrc/src/app/tor
WD=$PWD
pkill -f 'src/app/tor' 2>/dev/null; sleep 2
[ -x "$TOR" ] || { echo "NO_INSTRUMENTED_TOR"; exit 2; }
echo "afl symbols in tor: $(nm $TOR 2>/dev/null | grep -c __afl)"
mkdir -p /tmp/torfuzz_data; chmod 700 /tmp/torfuzz_data
cat > $WD/torrc_fuzz <<EOF
ORPort 127.0.0.1:9999
SocksPort 0
ControlPort 0
DataDirectory /tmp/torfuzz_data
Nickname fuzztor
AssumeReachable 1
PublishServerDescriptor 0
ExitRelay 0
Log notice file /tmp/torfuzz.log
EOF
echo "== sanity: does instrumented tor open the OR listener? =="
rm -f /tmp/torfuzz.log
timeout 12 $TOR -f $WD/torrc_fuzz >/tmp/torstart.log 2>&1 &
sleep 9
( ss -ltn 2>/dev/null | grep -q ':9999' ) && echo "OR_PORT_OPEN" || echo "OR_PORT_NOT_OPEN"
grep -iE 'opening or listener|opened.*listener|\[err\]|error' /tmp/torstart.log | head -5
pkill -f 'src/app/tor' 2>/dev/null; sleep 2
mkdir -p $WD/in; printf '\x00\x00\x07\x00\x00\x00\x00' > $WD/in/seed1
rm -rf $WD/out
export AFL_SKIP_CPUFREQ=1 AFL_I_DONT_CARE_ABOUT_MISSING_CRASHES=1 AFL_NO_AFFINITY=1 AFL_PATH=$AFLNET
echo "== afl-fuzz (AFLNet network mode), ~180s budget =="
timeout 200 $AFLNET/afl-fuzz -d -i $WD/in -o $WD/out -N tcp://127.0.0.1/9999 -t 4000+ -m none -- $TOR -f $WD/torrc_fuzz >/tmp/fuzz.log 2>&1
echo "afl-fuzz wrapper exit=$?"
echo "== fuzz.log tail =="; tail -28 /tmp/fuzz.log
echo "== fuzzer_stats =="; grep -E 'execs_done|paths_total|bitmap_cvg|unique_crashes|stability|execs_per_sec' $WD/out/fuzzer_stats 2>/dev/null
echo "== did Tor reach cell/circuit code? (torfuzz.log counts) =="
echo "create/extend/circuit/cell/n_chan hits: $(grep -icE 'create|extend|circuit|cell|n_chan|Bug/attack' /tmp/torfuzz.log 2>/dev/null)"
echo "== Tor log sample (what the fuzzed bytes hit) =="; grep -iE 'TLS|handshake|link|protocol|dropp|reject|closing|DoS' /tmp/torfuzz.log 2>/dev/null | sort | uniq -c | sort -rn | head -10
pkill -f 'src/app/tor' 2>/dev/null
exit 0
