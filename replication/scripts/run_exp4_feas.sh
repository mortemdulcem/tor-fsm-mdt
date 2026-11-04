set +e
cd $HOME
echo "== toolchain =="
echo "gcc: $(gcc -dumpversion)  clang: $(command -v clang||echo MISSING)  llvm: $(llvm-config --version 2>/dev/null)"
echo "== clone AFLNet =="
if [ ! -d aflnet ]; then
  git clone --depth 1 https://github.com/aflnet/aflnet.git >/tmp/clone.log 2>&1 || { echo CLONE_FAILED; tail -15 /tmp/clone.log; exit 2; }
fi
cd aflnet
echo "head: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "== build AFLNet core =="
make clean all >/tmp/afl_build.log 2>&1; echo "make rc=$?"
tail -12 /tmp/afl_build.log
echo "== built binaries =="
ls -la afl-fuzz afl-gcc afl-clang 2>/dev/null || echo "(some missing)"
echo "== llvm_mode (afl-clang-fast) =="
if [ -d llvm_mode ]; then ( cd llvm_mode && make >/tmp/llvm_build.log 2>&1; echo "llvm_mode rc=$?"; tail -8 /tmp/llvm_build.log ); else echo "no llvm_mode dir"; fi
echo "== afl-gcc instrumented compile smoke test =="
printf 'int main(void){return 0;}\n' > /tmp/t.c
if ./afl-gcc /tmp/t.c -o /tmp/t.afl 2>/tmp/aflgcc.log; then echo "afl-gcc OK"; /tmp/t.afl; echo "ran exit=$?"; else echo "afl-gcc FAILED"; tail -10 /tmp/aflgcc.log; fi
echo "== NOTE: Tor instrumentation NOT attempted here (would need a separate afl-instrumented Tor build; the working patched build is left untouched). =="
exit 0
