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
ayni (deterministik Shadow) -> rastgele split kopya sizintisi yaratir; LOSO bunu onler.
"""
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import precision_recall_fscore_support, confusion_matrix

CSV = "experiments/ml_features.csv"
df = pd.read_csv(CSV)

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

# benign devreler seed'ler arasi ne kadar ayni? (kopya sizinti kontrolu)
ben = df[df.scenario=="benign"]
uniq_ben = ben[FEATS].drop_duplicates().shape[0]
print(f"\nbenign devre: {len(ben)} satir, {uniq_ben} essiz oznitelik vektoru "
      f"-> {len(ben)-uniq_ben} kopya (seed'ler arasi tekrar) = LOSO gerekcesi")

y_bin = (df["scenario"]=="attack").astype(int).values
X = df[FEATS].values

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
print("  saldiri tipi bazinda recall (attack olarak isaretlenen oran):")
for a in attacks:
    v=np.array(per_attack_recall[a])
    print(f"    {a:16s}: {v.mean():.3f}±{v.std():.3f}")

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
print("  saldiri tipi bazinda recall (anomali olarak isaretlenen oran):")
for a in attacks:
    v=np.array(per_attack_recall[a])
    print(f"    {a:16s}: {v.mean():.3f}±{v.std():.3f}")

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
