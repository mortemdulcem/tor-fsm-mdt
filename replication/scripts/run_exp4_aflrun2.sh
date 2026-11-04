set +e
AFLNET=$HOME/aflnet; export AFL_PATH=$AFLNET AFL_QUIET=1 CC=$AFLNET/afl-gcc
WD=$PWD
cd $HOME/tor-aflsrc
echo "== build all fuzzers via 'make fuzzers' =="
AFL_HARDEN=1 make -j4 fuzzers >/tmp/mkf.log 2>&1
echo "make fuzzers rc=$?"; tail -8 /tmp/mkf.log
echo "== built fuzz binaries =="
ls -1 src/test/fuzz/fuzz-* 2>/dev/null | grep -v '\.' | while read f; do echo "$(basename $f): afl=$(nm $f 2>/dev/null | grep -c __afl) main=$(nm $f 2>/dev/null | grep -cw main)"; done
export AFL_SKIP_CPUFREQ=1 AFL_I_DONT_CARE_ABOUT_MISSING_CRASHES=1 AFL_NO_AFFINITY=1
run_one(){
  T=$1; SEED=$2; BUD=$3
  [ -x "src/test/fuzz/$T" ] || { echo "$T NOT_BUILT"; return; }
  mkdir -p $WD/in_$T; printf "$SEED" > $WD/in_$T/s1; rm -rf $WD/out_$T
  echo "== afl-fuzz $T (${BUD}s) =="
  timeout $BUD $AFLNET/afl-fuzz -i $WD/in_$T -o $WD/out_$T -m none -t 1000 -- src/test/fuzz/$T @@ >/tmp/afl_$T.log 2>&1
  echo "$T afl exit=$?"
  grep -E 'execs_done|paths_total|bitmap_cvg|execs_per_sec|unique_crashes|unique_hangs|stability' $WD/out_$T/fuzzer_stats 2>/dev/null || { echo "no stats; log tail:"; tail -18 /tmp/afl_$T.log; }
}
run_one fuzz-socks '\x05\x01\x00' 180
run_one fuzz-http 'GET / HTTP/1.0\r\n\r\n' 120
tar czf $WD/afl_out.tgz -C $WD out_fuzz-socks out_fuzz-http 2>/dev/null
exit 0
