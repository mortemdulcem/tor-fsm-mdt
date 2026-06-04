#!/usr/bin/env python3
"""
ML baseline — Tor FSM invalid-transition tespiti icin non-circular karsilastirma.

Amac: FSM kural-tabanli dedektorune karsi, SADECE ham davranis ozniteliklerini
(olay-tipi sayilari + olay sayisi) kullanan jenerik ML temel cizgisi. Oznitelikler
FSM ihlal etiketi ICERMEZ -> non-circular.

Veri: experiments/ml_features.csv (109 devre, 3 seed, 4 senaryo).
Etiket (zayif): run senaryosu. SINIRLILIK: saldiri kosusunda her devre fiilen
saldirili olmayabilir (ozellikle premature) -> etiket gurultusu; metrikler bu yuzden
muhafazakar (FN'i sisirir). Asagida acikca raporlanir.

Dogrulama: Leave-One-Seed-Out (LOSO) CV. Benign devreler seed'ler arasi neredeyse
ayni (deterministik Shadow) -> rastgele split kopya sizintisi yaratir. LOSO bunu
TAM ONLEMEZ: seed'ler deterministik oldugundan test vektorlerinin buyuk kismi
train'de birebir bulunur (asagidaki fold-ici kopya orani). Bu nedenle CV metrikleri
DAGITIM-ICI/IYIMSERDIR; asil guvenilir kanit CV'den bagimsiz yapisal ayrilabilirliktir.
"""
import json
import os
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import precision_recall_fscore_support, confusion_matrix
from sklearn.model_selection import GroupKFold

CSV = "experiments/ml_features.csv"
JSON_OUT = "experiments/ml_baseline_results.json"
df = pd.read_csv(CSV)

# Tez (build_thesis.mjs) bu dosyadan okur; tum sayilar buradan uretilir, elle girilmez.
results = {
    "data": {},
    "structural": {"unique_per_class": {}, "overlap": {}, "loso_dup": {},
                   "dedup": {}},
    "supervised": {"per_attack_recall": {}},
    "unsupervised": {"per_attack_recall": {}},
    "multiclass": {},
    "leakfree": {
        "supervised": {"per_attack_recall": {}},
        "unsupervised": {"per_attack_recall": {}},
        "multiclass": {},
    },
}

EVENT_COLS = ["CIRCUIT_CLOSED","CONNECT","RECV_CREATED","RECV_EXTENDED",
              "SEND_CREATE","SEND_DESTROY","SEND_EXTEND","SEND_RELAY_DATA","TLS_OK"]
FEATS = ["n_events"] + EVENT_COLS  # dur_ms haric (Shadow zamanlama gurultusu)

seeds = sorted(df["seed"].unique())
attacks = ["create_flood","circuit_hijack","premature_data"]

print("="*72)
print("VERI OZETI")
print("="*72)
print(f"toplam devre: {len(df)} | seed: {seeds} | oznitelik: {FEATS}")
print(df.groupby(["scenario","attack"]).size().to_string())

results["data"] = {
    "n_circuits": int(len(df)),
    "n_seeds": int(len(seeds)),
    "seeds": [int(s) for s in seeds],
    "features": FEATS,
    "n_features": int(len(FEATS)),
    "counts": {
        "benign": int((df["scenario"]=="benign").sum()),
        "create_flood": int((df["attack"]=="create_flood").sum()),
        "circuit_hijack": int((df["attack"]=="circuit_hijack").sum()),
        "premature_data": int((df["attack"]=="premature_data").sum()),
    },
}

# benign devreler seed'ler arasi ne kadar ayni? (kopya sizinti kontrolu)
ben = df[df.scenario=="benign"]
uniq_ben = ben[FEATS].drop_duplicates().shape[0]
print(f"\nbenign devre: {len(ben)} satir, {uniq_ben} essiz oznitelik vektoru "
      f"-> {len(ben)-uniq_ben} kopya (seed'ler arasi tekrar; deterministik Shadow)")

y_bin = (df["scenario"]=="attack").astype(int).values
X = df[FEATS].values

# Essiz oznitelik vektoru -> grup kimligi (sizintisiz GroupKFold icin).
# Ayni vektor (seed kopyalari dahil) AYNI gruba duser -> hicbir test vektoru
# train'de birebir bulunamaz.
vec_tuples = list(map(tuple, X.astype(float)))
uniq_vecs = sorted(set(vec_tuples))
vec2id = {v: i for i, v in enumerate(uniq_vecs)}
groups = np.array([vec2id[v] for v in vec_tuples])
n_groups = len(uniq_vecs)

# ---------------------------------------------------------------------------
# 0) YAPISAL AYRILABILIRLIK (CV'siz) — sizinti tartismasindan bagimsiz gercek
#    Deterministik veri -> az sayida essiz vektor. Sinif-arasi ortusme dogrudan
#    olculur; bu, herhangi bir CV/sizintidan ETKILENMEYEN yapisal bir olcudur.
# ---------------------------------------------------------------------------
print("\n" + "="*72)
print("0) YAPISAL AYRILABILIRLIK (CV yok; deterministik veri gercegi)")
print("="*72)
def vset(mask):
    return set(map(tuple, X[mask.values].astype(float)))
sets = {}
for (sc_, at_), g in df.groupby(["scenario","attack"]):
    m = (df["scenario"]==sc_) & (df["attack"]==at_)
    sets[at_] = vset(m)
    print(f"  {at_:16s}: {m.sum():2d} devre -> {len(sets[at_]):2d} essiz vektor")
    results["structural"]["unique_per_class"][at_] = int(len(sets[at_]))
def overlap(a, b):
    A, B = sets[a], sets[b]
    inter = A & B
    return len(inter), len(A), len(B)
for a, b in [("create_flood","circuit_hijack"), ("premature_data","benign"),
             ("create_flood","benign"), ("circuit_hijack","benign")]:
    i, na, nb = overlap(a, b)
    print(f"  ortusme {a} ∩ {b}: {i} essiz vektor ortak "
          f"(|{a}|={na}, |{b}|={nb})")
    results["structural"]["overlap"][f"{a}__{b}"] = {
        "inter": int(i), "na": int(na), "nb": int(nb)}
print("  -> create_flood ve circuit_hijack essiz vektorleri buyuk olcude AYNI kumede;")
print("     bu, hangi CV kullanilirsa kullanilsin degismeyen yapisal bir gercektir.")

# fold-ici kopya ortusme orani (LOSO'nun sizintiyi NE KADAR onleyemedigi)
print("\n  LOSO fold-ici kopya ortusme (test vektorunun train'de birebir bulunma orani):")
for test_seed in seeds:
    tr = (df["seed"]!=test_seed).values
    te = (df["seed"]==test_seed).values
    trset = set(map(tuple, X[tr].astype(float)))
    terows = list(map(tuple, X[te].astype(float)))
    dup = sum(1 for r in terows if r in trset)
    print(f"    test seed={test_seed}: {dup}/{len(terows)} "
          f"({dup/len(terows):.1%}) test vektoru train'de mevcut")
    results["structural"]["loso_dup"][str(int(test_seed))] = {
        "dup": int(dup), "total": int(len(terows)),
        "ratio": float(dup/len(terows))}
print("  -> LOSO sizintiyi ONLEMEZ; asagidaki CV metrikleri IYIMSERDIR "
      "(dagitim-ici/in-distribution), genelleme olarak okunmamalidir.")

# essiz-vektor (dedup) duzeyinde grup saflastirma: kac essiz vektor tek-sinif,
# kac tanesi siniflar-arasi paylasimli? (GroupKFold'un dayandigi yapisal gercek)
vec_labels = {}
for vid, at_ in zip(groups, df["attack"].values):
    vec_labels.setdefault(int(vid), set()).add(at_)
pure = sum(1 for s in vec_labels.values() if len(s) == 1)
shared = sum(1 for s in vec_labels.values() if len(s) > 1)
print(f"\n  dedup: {n_groups} essiz vektor -> {pure} tek-sinif, {shared} paylasimli")
results["structural"]["dedup"] = {
    "n_unique_vectors": int(n_groups),
    "pure": int(pure),
    "shared": int(shared),
}

# ---------------------------------------------------------------------------
# 1) DENETIMLI: LogisticRegression, LOSO CV
# ---------------------------------------------------------------------------
print("\n" + "="*72)
print("1) DENETIMLI LogisticRegression  (benign=0 / attack=1)  LOSO CV")
print("="*72)
rows = []
per_attack_recall = {a: [] for a in attacks}
for test_seed in seeds:
    tr = df["seed"]!=test_seed
    te = df["seed"]==test_seed
    sc = StandardScaler().fit(X[tr])
    clf = LogisticRegression(max_iter=2000, class_weight="balanced")
    clf.fit(sc.transform(X[tr]), y_bin[tr])
    pred = clf.predict(sc.transform(X[te]))
    p,r,f,_ = precision_recall_fscore_support(y_bin[te], pred, average="binary",
                                              zero_division=0)
    rows.append((p,r,f))
    # her saldiri tipi icin recall (o tipteki devrelerin kacini attack dedi)
    dte = df[te].reset_index(drop=True)
    for a in attacks:
        m = (dte["attack"]==a).values
        if m.sum():
            per_attack_recall[a].append(pred[m].mean())  # attack=1 orani
    print(f"  test seed={test_seed}: P={p:.3f} R={r:.3f} F1={f:.3f}")
rows=np.array(rows)
print(f"  ORT: P={rows[:,0].mean():.3f}±{rows[:,0].std():.3f}  "
      f"R={rows[:,1].mean():.3f}±{rows[:,1].std():.3f}  "
      f"F1={rows[:,2].mean():.3f}±{rows[:,2].std():.3f}")
results["supervised"].update({
    "precision": {"mean": float(rows[:,0].mean()), "sd": float(rows[:,0].std())},
    "recall": {"mean": float(rows[:,1].mean()), "sd": float(rows[:,1].std())},
    "f1": {"mean": float(rows[:,2].mean()), "sd": float(rows[:,2].std())},
})
print("  saldiri tipi bazinda recall (attack olarak isaretlenen oran):")
for a in attacks:
    v=np.array(per_attack_recall[a])
    print(f"    {a:16s}: {v.mean():.3f}±{v.std():.3f}")
    results["supervised"]["per_attack_recall"][a] = {
        "mean": float(v.mean()), "sd": float(v.std())}

# ---------------------------------------------------------------------------
# 2) DENETIMSIZ: IsolationForest, SADECE benign'e fit (train seed'ler), LOSO
# ---------------------------------------------------------------------------
print("\n" + "="*72)
print("2) DENETIMSIZ IsolationForest  (yalniz benign'e fit -> anomali=attack)  LOSO")
print("="*72)
rows=[]
per_attack_recall = {a: [] for a in attacks}
for test_seed in seeds:
    tr_ben = (df["seed"]!=test_seed) & (df["scenario"]=="benign")
    te = df["seed"]==test_seed
    sc = StandardScaler().fit(X[tr_ben.values])
    iso = IsolationForest(n_estimators=300, contamination="auto", random_state=0)
    iso.fit(sc.transform(X[tr_ben.values]))
    pred = (iso.predict(sc.transform(X[te.values]))==-1).astype(int)  # -1=anomali
    p,r,f,_ = precision_recall_fscore_support(y_bin[te.values], pred,
                                              average="binary", zero_division=0)
    rows.append((p,r,f))
    dte = df[te].reset_index(drop=True)
    for a in attacks:
        m=(dte["attack"]==a).values
        if m.sum():
            per_attack_recall[a].append(pred[m].mean())
    print(f"  test seed={test_seed}: P={p:.3f} R={r:.3f} F1={f:.3f}")
rows=np.array(rows)
print(f"  ORT: P={rows[:,0].mean():.3f}±{rows[:,0].std():.3f}  "
      f"R={rows[:,1].mean():.3f}±{rows[:,1].std():.3f}  "
      f"F1={rows[:,2].mean():.3f}±{rows[:,2].std():.3f}")
results["unsupervised"].update({
    "precision": {"mean": float(rows[:,0].mean()), "sd": float(rows[:,0].std())},
    "recall": {"mean": float(rows[:,1].mean()), "sd": float(rows[:,1].std())},
    "f1": {"mean": float(rows[:,2].mean()), "sd": float(rows[:,2].std())},
})
print("  saldiri tipi bazinda recall (anomali olarak isaretlenen oran):")
for a in attacks:
    v=np.array(per_attack_recall[a])
    print(f"    {a:16s}: {v.mean():.3f}±{v.std():.3f}")
    results["unsupervised"]["per_attack_recall"][a] = {
        "mean": float(v.mean()), "sd": float(v.std())}

# ---------------------------------------------------------------------------
# 3) COK-SINIFLI: create_flood vs circuit_hijack ayirt edilebilir mi?
#    (FSM bulgusu: hijack native-disinda ayirt edici degil -> ML'de de bekleriz)
# ---------------------------------------------------------------------------
print("\n" + "="*72)
print("3) COK-SINIFLI LogReg (benign/create_flood/circuit_hijack/premature)  LOSO")
print("="*72)
ymc = df["attack"].values  # benign satirlarda attack='benign'
labels = ["benign","create_flood","circuit_hijack","premature_data"]
cms = np.zeros((len(labels),len(labels)))
accs=[]
for test_seed in seeds:
    tr = df["seed"]!=test_seed; te = df["seed"]==test_seed
    sc=StandardScaler().fit(X[tr.values])
    clf=LogisticRegression(max_iter=3000, class_weight="balanced")
    clf.fit(sc.transform(X[tr.values]), ymc[tr.values])
    pred=clf.predict(sc.transform(X[te.values]))
    accs.append((pred==ymc[te.values]).mean())
    cms += confusion_matrix(ymc[te.values], pred, labels=labels)
print(f"  ort accuracy={np.mean(accs):.3f}±{np.std(accs):.3f}")
print("  toplam karisiklik matrisi (satir=gercek, sutun=tahmin):")
print("    " + "  ".join(f"{l[:9]:>9s}" for l in labels))
for i,l in enumerate(labels):
    print(f"  {l[:14]:14s} " + "  ".join(f"{int(cms[i,j]):9d}" for j in range(len(labels))))

# create_flood <-> circuit_hijack karismasi
ci = labels.index("create_flood"); hj = labels.index("circuit_hijack")
cf_tot=cms[ci].sum(); hj_tot=cms[hj].sum()
print(f"\n  create_flood: {int(cms[ci,ci])}/{int(cf_tot)} dogru; "
      f"{int(cms[ci,hj])} -> circuit_hijack'e karisti")
print(f"  circuit_hijack: {int(cms[hj,hj])}/{int(hj_tot)} dogru; "
      f"{int(cms[hj,ci])} -> create_flood'a karisti")
print("\n(Yorum: ikisi de SEND_CREATE=2 imzasi tasidigindan sayim-seviyesinde "
      "buyuk olcude ortusur; bu FSM bulgusuyla -hijack ayirt edici degil- tutarlidir.)")

results["multiclass"].update({
    "accuracy": {"mean": float(np.mean(accs)), "sd": float(np.std(accs))},
    "labels": labels,
    "confusion": [[int(cms[i, j]) for j in range(len(labels))]
                  for i in range(len(labels))],
})

# ---------------------------------------------------------------------------
# 4) SIZINTISIZ DEGERLENDIRME — GroupKFold (grup = essiz oznitelik vektoru)
#    Ayni vektor train ve test'e birlikte DUSEMEZ -> deterministik kopya
#    sizintisi tamamen kaldirilir. Out-of-fold (OOF) tahminler havuzlanir ve
#    metrikler tek bir sizintisiz bolme uzerinden hesaplanir. Bu, yukaridaki
#    LOSO (iyimser) sonuclariyla YAN YANA sunulur (Tablo 4.17b/d).
# ---------------------------------------------------------------------------
K = 5  # 28 essiz vektor -> 5 fold (her foldda ~5-6 grup)
print("\n" + "="*72)
print(f"4) SIZINTISIZ GroupKFold (grup=essiz vektor, K={K}); OOF havuzlanmis")
print("="*72)
gkf = GroupKFold(n_splits=K)

# sizintisizligi DOGRULA: hicbir test vektoru train'de bulunmamali
leak = 0
for tr_idx, te_idx in gkf.split(X, y_bin, groups):
    trset = set(map(tuple, X[tr_idx].astype(float)))
    leak += sum(1 for r in map(tuple, X[te_idx].astype(float)) if r in trset)
print(f"  sizinti kontrolu: {leak}/{len(df)} test vektoru train'de (0 olmali)")

# --- (a) Denetimli LogReg, OOF ---
oof = np.full(len(df), -1, dtype=int)
for tr_idx, te_idx in gkf.split(X, y_bin, groups):
    sc = StandardScaler().fit(X[tr_idx])
    clf = LogisticRegression(max_iter=2000, class_weight="balanced")
    clf.fit(sc.transform(X[tr_idx]), y_bin[tr_idx])
    oof[te_idx] = clf.predict(sc.transform(X[te_idx]))
p,r,f,_ = precision_recall_fscore_support(y_bin, oof, average="binary",
                                          zero_division=0)
print(f"  DENETIMLI (OOF): P={p:.3f} R={r:.3f} F1={f:.3f}")
results["leakfree"]["supervised"].update({
    "precision": float(p), "recall": float(r), "f1": float(f)})
for a in attacks:
    m = (df["attack"]==a).values
    rec = float(oof[m].mean()) if m.sum() else 0.0
    print(f"    {a:16s} recall(OOF)={rec:.3f}")
    results["leakfree"]["supervised"]["per_attack_recall"][a] = rec

# --- (b) Denetimsiz IsolationForest (yalniz benign train gruplarina fit), OOF ---
oofu = np.full(len(df), -1, dtype=int)
for tr_idx, te_idx in gkf.split(X, y_bin, groups):
    tr_ben = tr_idx[(df["scenario"].values[tr_idx]=="benign")]
    sc = StandardScaler().fit(X[tr_ben])
    iso = IsolationForest(n_estimators=300, contamination="auto", random_state=0)
    iso.fit(sc.transform(X[tr_ben]))
    oofu[te_idx] = (iso.predict(sc.transform(X[te_idx]))==-1).astype(int)
p,r,f,_ = precision_recall_fscore_support(y_bin, oofu, average="binary",
                                          zero_division=0)
print(f"  DENETIMSIZ (OOF): P={p:.3f} R={r:.3f} F1={f:.3f}")
results["leakfree"]["unsupervised"].update({
    "precision": float(p), "recall": float(r), "f1": float(f)})
for a in attacks:
    m = (df["attack"]==a).values
    rec = float(oofu[m].mean()) if m.sum() else 0.0
    print(f"    {a:16s} recall(OOF)={rec:.3f}")
    results["leakfree"]["unsupervised"]["per_attack_recall"][a] = rec

# --- (c) Cok-sinifli LogReg, OOF confusion ---
oofmc = np.empty(len(df), dtype=object)
for tr_idx, te_idx in gkf.split(X, ymc, groups):
    sc = StandardScaler().fit(X[tr_idx])
    clf = LogisticRegression(max_iter=3000, class_weight="balanced")
    clf.fit(sc.transform(X[tr_idx]), ymc[tr_idx])
    oofmc[te_idx] = clf.predict(sc.transform(X[te_idx]))
acc = float((oofmc==ymc).mean())
cm_lf = confusion_matrix(ymc, oofmc, labels=labels)
print(f"  COK-SINIFLI (OOF) accuracy={acc:.3f}")
print("  karisiklik matrisi (satir=gercek, sutun=tahmin):")
print("    " + "  ".join(f"{l[:9]:>9s}" for l in labels))
for i,l in enumerate(labels):
    print(f"  {l[:14]:14s} " + "  ".join(f"{int(cm_lf[i,j]):9d}" for j in range(len(labels))))
results["leakfree"]["multiclass"].update({
    "k_folds": int(K),
    "n_unique_vectors": int(n_groups),
    "accuracy": acc,
    "labels": labels,
    "confusion": [[int(cm_lf[i,j]) for j in range(len(labels))]
                  for i in range(len(labels))],
})

print("\n(Yorum: GroupKFold ile ayni vektor train/test'e birlikte dusmez; "
      "kopya sizintisi 0'a iner. LOSO ile farki, iyimserligin ne kadarinin "
      "ezberden -ne kadarinin gercek sinyalden- geldigini gosterir.)")

# ---------------------------------------------------------------------------
# JSON cikti — tez (build_thesis.mjs) bu dosyadan okur. Tum sayilar yukaridaki
# gercek kosumdan gelir; elle girilmez.
# ---------------------------------------------------------------------------
with open(JSON_OUT, "w", encoding="utf-8") as fh:
    json.dump(results, fh, ensure_ascii=False, indent=2)
print(f"\n[OK] sonuclar JSON'a yazildi -> {JSON_OUT}")
