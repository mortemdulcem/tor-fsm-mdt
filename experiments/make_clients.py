#!/usr/bin/env python3
"""Coklu-istemci senaryo uretici (bagimsizlik yok: saf metin, PyYAML gerekmez).

Amac: deterministik Shadow verisinin ornek-cesitliligi dusuk. Yeni *seed* eklemek
cogunlukla birebir kopya vektor uretir (LOSO dup ~%83-97). Gercek cesitlilik icin
FARKLI SENARYO gerekir; en temiz kaldirac COKLU ISTEMCI'dir: her ek torclient
host'u Shadow'da ayri bir RNG akisi alir (general.seed + host adi) -> farkli yol
secimi / zamanlama -> gercekten farkli devreler (sentetik DEGIL; gercek Shadow
kosusu uretir).

Bu script bir Shadow `shadow_*.yaml` dosyasini YERINDE duzenler: tek `torclient`
host blogunu N tane (torclient, torclient2, ..., torclientN) olacak sekilde
COGALTIR. Yalniz host basligi ve `--Address/--Nickname` degerleri degisir;
tgen graphml yolu (tgen.torclient.graphml.xml) ve tor binary/environment AYNEN
korunur (boylece attack env-gate perl'i tum istemcilere ayni sekilde uygulanir).

Kullanim:  python3 experiments/make_clients.py <shadow.yaml> <N>
Idempotent: dosyada zaten torclient2 varsa hicbir sey yapmaz (cikis 0).
Girdi tek-istemci taban yaml olmalidir (full_pipeline her kosuda taze kopya verir).
"""
import re
import sys


def main() -> int:
    if len(sys.argv) != 3:
        print("kullanim: make_clients.py <shadow.yaml> <N>", file=sys.stderr)
        return 2
    path, n = sys.argv[1], int(sys.argv[2])
    if n < 1:
        print("HATA: N >= 1 olmali", file=sys.stderr)
        return 2

    lines = open(path, encoding="utf-8").read().split("\n")

    # Zaten cogaltilmis mi?
    if any(re.match(r"^( *)torclient\d+:\s*$", l) for l in lines):
        print(f"  make_clients: torclient2 mevcut -> degisiklik yok ({path})")
        return 0
    if n == 1:
        return 0  # tek istemci: dokunma

    # torclient host blogunu bul (baslik + ayni girintiden derin satirlar).
    hdr_re = re.compile(r"^( *)torclient:\s*$")
    start = end = base_indent = None
    for i, l in enumerate(lines):
        m = hdr_re.match(l)
        if m:
            start = i
            base_indent = len(m.group(1))
            break
    if start is None:
        print(f"HATA: 'torclient:' host basligi bulunamadi: {path}", file=sys.stderr)
        return 1

    # Blok sonu: girintisi base_indent veya daha az olan ilk DOLU satir (sonraki
    # kardes/ust anahtar) ya da EOF.
    end = len(lines)
    for j in range(start + 1, len(lines)):
        s = lines[j]
        if s.strip() == "":
            continue
        indent = len(s) - len(s.lstrip(" "))
        if indent <= base_indent:
            end = j
            break
    block = lines[start:end]

    def clone(block_lines, k):
        out = []
        for l in block_lines:
            if hdr_re.match(l):
                l = re.sub(r"torclient:", f"torclient{k}:", l)
            # --Address/--Nickname degerlerini degistir (tgen yolunu DEGIL).
            l = l.replace(
                "--Address torclient --Nickname torclient",
                f"--Address torclient{k} --Nickname torclient{k}",
            )
            out.append(l)
        return out

    clones = []
    for k in range(2, n + 1):
        clones.extend(clone(block, k))

    new_lines = lines[:end] + clones + lines[end:]
    open(path, "w", encoding="utf-8").write("\n".join(new_lines))
    print(f"  make_clients: {path} -> {n} istemci (torclient..torclient{n})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
