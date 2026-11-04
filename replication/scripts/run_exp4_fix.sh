set +e
cd $HOME
# --- restore the working patched legacy tree (name + reapply source patches) ---
if [ ! -d tor-0.4.6.10 ] && [ -d tor-afl ]; then mv tor-afl tor-0.4.6.10; echo "restored tor-0.4.6.10 from tor-afl"; fi
cp relay.c.patched tor-0.4.6.10/src/core/or/relay.c
F=tor-0.4.6.10/src/feature/relay/circuitbuild_relay.c
if ! grep -q TOR_FSM_FAULT_MISSING $F; then
  grep -q '#include <stdlib.h>' $F || sed -i '0,/^#include/s//#include <stdlib.h>\n#include/' $F
  sed -i 's/^  if (circ->n_chan) {/  if (!getenv("TOR_FSM_FAULT_MISSING") \&\& circ->n_chan) {/' $F
fi
echo "restored source tokens: replay=$(grep -c TOR_FSM_ATTACK_REPLAY tor-0.4.6.10/src/core/or/relay.c) fault=$(grep -c TOR_FSM_FAULT_MISSING $F)"
echo "restored binary: $(strings tor-0.4.6.10/src/app/tor 2>/dev/null | grep -c FSM-REPLAY) FSM-REPLAY tokens"
# --- afl-instrumented build in a clean, freshly-configured separate tree ---
AFLNET=$HOME/aflnet; export AFL_PATH=$AFLNET AFL_QUIET=1 CC=$AFLNET/afl-gcc
rm -rf /tmp/aflx ~/tor-aflsrc; mkdir -p /tmp/aflx
tar xf tor-0.4.6.10.tar.gz -C /tmp/aflx && mv /tmp/aflx/tor-0.4.6.10 ~/tor-aflsrc
cd ~/tor-aflsrc
./configure --disable-asciidoc --disable-manpage --disable-html-manual --disable-unittests >/tmp/cfg.log 2>&1; echo "configure rc=$?"; tail -6 /tmp/cfg.log
AFL_HARDEN=1 make -j4 src/app/tor >/tmp/make.log 2>&1; echo "make rc=$?"; tail -15 /tmp/make.log
if [ -x src/app/tor ]; then
  echo "TOR_AFL_BUILT size=$(stat -c%s src/app/tor)"
  $AFLNET/afl-showmap -m none -o /tmp/cov -- src/app/tor --version >/tmp/sm.log 2>&1; echo "showmap rc=$?"
  grep -iaE 'tuples|captured|instrumentation|PROGRAM ABORT|No instrumentation' /tmp/sm.log | head
  echo "cov edges: $(wc -l < /tmp/cov 2>/dev/null)"
else echo "TOR_AFL_BUILD_FAILED"; fi
exit 0
