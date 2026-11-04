set +e
AFLNET=$HOME/aflnet; export AFL_PATH=$AFLNET AFL_QUIET=1 CC=$AFLNET/afl-gcc
WD=$PWD
cd $HOME/tor-aflsrc
echo "== reconfigure with --enable-fuzzing =="
make distclean >/dev/null 2>&1
./configure --enable-fuzzing --disable-asciidoc --disable-manpage --disable-html-manual --disable-unittests >/tmp/cfg_fuzz.log 2>&1
echo "configure rc=$?"; tail -5 /tmp/cfg_fuzz.log
echo "== fuzz target names =="; grep -oE 'src/test/fuzz/fuzz[-_][a-z_]+' Makefile 2>/dev/null | sort -u | head
echo "== build fuzz-socks + fuzz-http =="
AFL_HARDEN=1 make -j4 src/test/fuzz/fuzz-socks src/test/fuzz/fuzz-http >/tmp/mk_fuzz.log 2>&1
echo "make rc=$?"; tail -10 /tmp/mk_fuzz.log
ls -la src/test/fuzz/fuzz-socks src/test/fuzz/fuzz-http 2>/dev/null
for T in fuzz-socks fuzz-http; do echo "$T afl symbols: $(nm src/test/fuzz/$T 2>/dev/null | grep -c __afl)"; done
export AFL_SKIP_CPUFREQ=1 AFL_I_DONT_CARE_ABOUT_MISSING_CRASHES=1 AFL_NO_AFFINITY=1
run_one(){
  T=$1; SEED=$2; BUD=$3
  [ -x "src/test/fuzz/$T" ] || { echo "$T NOT_BUILT"; return; }
  mkdir -p $WD/in_$T; printf "$SEED" > $WD/in_$T/s1; rm -rf $WD/out_$T
  echo "== afl-fuzz $T (${BUD}s) =="
  timeout $BUD $AFLNET/afl-fuzz -i $WD/in_$T -o $WD/out_$T -m none -t 1000 -- src/test/fuzz/$T @@ >/tmp/afl_$T.log 2>&1
  echo "$T afl exit=$?"
  grep -E 'command_line|start_time|last_update' $WD/out_$T/fuzzer_stats 2>/dev/null >/dev/null
  grep -E 'execs_done|paths_total|bitmap_cvg|execs_per_sec|unique_crashes|unique_hangs|stability' $WD/out_$T/fuzzer_stats 2>/dev/null || { echo "no fuzzer_stats; log tail:"; tail -15 /tmp/afl_$T.log; }
}
run_one fuzz-socks '\x05\x01\x00' 180
run_one fuzz-http 'GET / HTTP/1.0\r\n\r\n' 180
tar czf $WD/afl_out.tgz -C $WD out_fuzz-socks out_fuzz-http 2>/dev/null
exit 0
