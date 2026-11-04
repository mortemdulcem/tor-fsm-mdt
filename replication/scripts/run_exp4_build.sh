set +e
cd $HOME/aflnet || { echo NO_AFLNET; exit 2; }
echo "== deps now present? =="
dpkg -l | grep -E 'graphviz-dev|libcap-dev' | awk '{print $2,$3}'
echo "== build AFLNet core =="
make clean all >/tmp/afl_build.log 2>&1; echo "core make rc=$?"
tail -6 /tmp/afl_build.log
echo "== build llvm_mode =="
( cd llvm_mode && make >/tmp/llvm_build.log 2>&1; echo "llvm_mode rc=$?"; tail -6 /tmp/llvm_build.log )
echo "== built binaries =="
ls -la afl-fuzz afl-gcc afl-clang-fast afl-showmap 2>/dev/null
echo "== afl-gcc smoke test =="
printf 'int main(void){return 0;}\n' > /tmp/t.c
if ./afl-gcc /tmp/t.c -o /tmp/t.afl 2>/tmp/aflgcc.log; then echo "afl-gcc OK"; /tmp/t.afl; echo "ran exit=$?"; else echo "afl-gcc FAILED"; tail -8 /tmp/aflgcc.log; fi
echo "== afl-clang-fast smoke test =="
if [ -x afl-clang-fast ]; then AFL_PATH=$PWD ./afl-clang-fast /tmp/t.c -o /tmp/t.aflc 2>/tmp/aflc.log && echo "afl-clang-fast OK" || { echo "afl-clang-fast FAILED"; tail -8 /tmp/aflc.log; }; else echo "afl-clang-fast not built"; fi
exit 0
