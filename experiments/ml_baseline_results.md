# ML Temel Çizgisi (Baseline) — Non-circular Karşılaştırma

Bu belge, FSM kural-tabanlı dedektörüne karşı **bağımsız bir makine öğrenmesi temel
çizgisi** sunar. Tüm sayılar `experiments/ml_baseline.py`'nin `experiments/ml_features.csv`
üzerinde gerçek koşumundan gelir; elle düzenlenmemiştir. Koşum yeniden üretilebilir:
`python3 experiments/ml_baseline.py`.

## Yöntem
- **Öznitelikler (non-circular):** devre başına ham olay-tipi sayıları
  (CONNECT, TLS_OK, SEND_CREATE, RECV_CREATED, SEND_EXTEND, RECV_EXTENDED,
  SEND_RELAY_DATA, SEND_DESTROY, CIRCUIT_CLOSED) + toplam olay sayısı (`n_events`).
  **FSM ihlal etiketi öznitelik olarak KULLANILMAZ** → model, dedektörün çıktısına
  değil yalnızca gözlemlenen davranışa bakar (döngüsel değil). `dur_ms` dışlandı
  (Shadow zamanlama gürültüsü; 600–593000 ms arası, saldırı semantiği taşımıyor).
- **Etiket (zayıf):** run senaryosu (benign / saldırı tipi). **Sınırlılık:** bir saldırı
  koşusunda her devre fiilen saldırılı olmayabilir (özellikle premature'da gid 1/2/9
  benign görünür) → etiket gürültüsü. Bu, metrikleri **muhafazakâr** yapar (FN'i şişirir),
  uydurma yönünde değil.
- **Doğrulama:** Leave-One-Seed-Out (LOSO) CV. Benign 27 devrenin yalnızca **8'i** eşsiz
  öznitelik vektörü (19 kopya, seed'ler arası tekrar — deterministik Shadow). Rastgele
  split bu kopyaları train/test'e böler → sızıntı. LOSO (train 2 seed, test 1 seed)
  bunu önler. n=3 seed → ort ± SD verilir, GA geniştir.
- **Modeller:** denetimli LogisticRegression (class_weight=balanced) ve denetimsiz
  IsolationForest (yalnız benign'e fit → anomali = saldırı).
- **Veri:** 109 devre — benign 27, create_flood 27, circuit_hijack 28, premature_data 27.

## Sonuç 1 — Denetimli (LogReg), ikili benign-vs-attack, LOSO
| Ölçüt | Değer |
|---|---|
| Precision | 1.000 ± 0.000 |
| Recall | 0.695 ± 0.020 |
| F1 | 0.820 ± 0.014 |

Saldırı tipi bazında recall (devrenin "saldırı" olarak işaretlenme oranı):
| Saldırı | Recall |
|---|---|
| create_flood | 1.000 ± 0.000 |
| circuit_hijack | 1.000 ± 0.000 |
| premature_data | **0.074 ± 0.052** |

**Yorum:** Denetimli model create_flood ve circuit_hijack'i kusursuz yakalar
(her ikisinin de `SEND_CREATE=2` imzası benign'den ayrılır). premature'ı neredeyse
hiç yakalamaz (0.074) — çünkü premature devrelerinin çoğu sayım-seviyesinde benign'e
benzer ve zayıf etiketle eğitilen model bunları benign tarafına atar. Bu, FSM tarafındaki
**premature recall≈0.47 tespit-kapsamı kaybıyla aynı yönde** bir bulgudur.

## Sonuç 2 — Denetimsiz (IsolationForest, yalnız benign'e fit), LOSO
| Ölçüt | Değer |
|---|---|
| Precision | 0.750 ± 0.018 |
| Recall | 0.842 ± 0.043 |
| F1 | 0.793 ± 0.028 |

Saldırı tipi bazında recall (anomali olarak işaretlenme oranı):
| Saldırı | Recall |
|---|---|
| create_flood | 0.778 ± 0.091 |
| circuit_hijack | 0.752 ± 0.037 |
| premature_data | 1.000 ± 0.000 |

**Yorum:** Denetimsiz anomali tespiti tersine bir davranış gösterir: premature'ı tam
yakalar (1.000) çünkü premature devreleri benign'e göre anomaliktir (BUILDING sırasında
fazladan SEND_RELAY_DATA), ama create_flood/hijack'in bir kısmını kaçırır. premature
recall=1.000 **zayıf-etiket uyarısıyla** okunmalı: benign görünen premature devreleri de
"saldırı" etiketli olduğundan, anomali eşiği geniş işaretlediğinde recall şişer; bunun
bedeli precision=0.750'tir (FP maliyeti). İki paradigma bir ödünleşim sergiler; tek bir
model her saldırıyı birden iyi ayırmaz.

## Sonuç 3 — Çok-sınıflı (LogReg), LOSO
- Ortalama accuracy = **0.542 ± 0.020**.
- Toplam karışıklık matrisi (satır=gerçek, sütun=tahmin):

|  | benign | create_flood | circuit_hijack | premature |
|---|---|---|---|---|
| **benign** | 22 | 0 | 0 | 5 |
| **create_flood** | 0 | 19 | 8 | 0 |
| **circuit_hijack** | 0 | 18 | 10 | 0 |
| **premature_data** | 19 | 0 | 0 | 8 |

**Yorum (iki bağımsız doğrulama):**
1. **create_flood ↔ circuit_hijack büyük ölçüde karışır** (create_flood 19/27 doğru,
   8→hijack; circuit_hijack yalnız 10/28 doğru, 18→create_flood). İkisi de `SEND_CREATE=2`
   imzası taşır; sayım-seviyesinde ayırt edilemezler. Bu, FSM bulgusu **"CIRCUIT_HIJACK
   FSM-tip seviyesinde ayırt edici değil"** ile birebir tutarlıdır — bağımsız bir yöntemle
   aynı sonuca varılması bu kısıtı güçlendirir.
2. **premature ↔ benign büyük ölçüde karışır** (premature 19/27 benign'e atandı, yalnız
   8 doğru; benign 22/27 doğru, 5→premature). Bu da FSM'nin premature kapsam kaybı
   (recall≈0.47) ve begin-noise FPR≈0.48 bulgularıyla aynı yöndedir.

## FSM ile ilişki (adil çerçeve)
FSM dedektörü ile ML baseline **aynı birimlerde değildir** (FSM üç-modlu: tip-temiz
confusion / event-purity / native ayrım; ML burada devre-seviyesi sınıflandırma).
Bu yüzden tek bir ortak tablo **uydurulmaz**. Niteliksel olarak iki yöntem aynı üç
sonuca yakınsar:
- create_flood: en kolay ayrılan (FSM P=R=F1=1.0; ML denetimli recall=1.0).
- circuit_hijack: davranış-imzası create_flood'la örtüşür → her iki yöntemde de
  sınıf-seviyesinde ayırt edici değil (yalnız non-circular native ile ayrılır).
- premature: benign'e en yakın, en zor → her iki yöntemde de düşük kapsam.

## Sınırlılıklar (tezde açıkça belirtilmeli)
1. **Küçük n (109 devre, 3 seed).** GA geniş; sonuçlar yön gösterir, kesin nokta-tahmin
   olarak sunulmamalı.
2. **Deterministik benign** → LOSO ile sızıntı önlendi, ama çeşitlilik düşük.
3. **Zayıf devre-seviyesi etiket** (özellikle premature) → metrikler muhafazakâr;
   gerçek per-devre ground-truth için saldırının enjekte edildiği gid'ler gerekir ki
   bu dedektörün kendisine dayanır (döngüsel) — bu yüzden bilinçli olarak kullanılmadı.
4. **Yalnız sayım-seviyesi öznitelik** — sıra/zamanlama (n-gram, inter-event delta)
   modellenmedi; daha zengin öznitelikler premature ayrımını iyileştirebilir (gelecek iş).
5. ML baseline, FSM'nin **yerine** değil, bağımsız bir **karşılaştırma/teyit** olarak
   sunulur.
