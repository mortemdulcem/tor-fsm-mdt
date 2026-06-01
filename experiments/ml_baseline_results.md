# ML Temel Çizgisi (Baseline) — Non-circular Karşılaştırma

Bu belge, FSM kural-tabanlı dedektörüne karşı **bağımsız bir makine öğrenmesi temel
çizgisi** sunar. Tüm sayılar `experiments/ml_baseline.py`'nin `experiments/ml_features.csv`
üzerinde gerçek koşumundan gelir; elle düzenlenmemiştir. Yeniden üretmek için:
`python3 experiments/ml_baseline.py`.

## Önemli metodolojik uyarı (başta okunmalı)
Veri **deterministik** Shadow koşumlarından gelir: 109 devre var ama sınıf başına yalnızca
**8–11 eşsiz öznitelik vektörü** mevcut (gerisi seed'ler arası birebir kopya). Bu nedenle:
- **Seed-bazlı LOSO çapraz-doğrulama sızıntıyı ÖNLEMEZ.** Foldlarda test vektörlerinin
  **%83–97'si** train kümesinde birebir bulunur (seed42: 34/36=%94.4, seed137: 36/37=%97.3,
  seed2718: 30/36=%83.3). Dolayısıyla aşağıdaki **CV metrikleri iyimserdir** ve
  *dağıtım-içi (in-distribution) ayrılabilirlik* olarak okunmalıdır; out-of-distribution
  **genelleme** kanıtı DEĞİLDİR.
- Bu yüzden ana kanıt olarak **CV'den bağımsız "yapısal ayrılabilirlik"** (Bölüm 0) öne
  çıkarılır: sınıfların eşsiz öznitelik vektörlerinin örtüşmesi, hangi CV kullanılırsa
  kullanılsın değişmeyen bir gerçektir.

## Yöntem
- **Öznitelikler (non-circular):** devre başına ham olay-tipi sayıları
  (CONNECT, TLS_OK, SEND_CREATE, RECV_CREATED, SEND_EXTEND, RECV_EXTENDED,
  SEND_RELAY_DATA, SEND_DESTROY, CIRCUIT_CLOSED) + toplam olay sayısı (`n_events`).
  **FSM ihlal etiketi öznitelik olarak KULLANILMAZ** → model dedektörün çıktısına değil
  yalnızca gözlemlenen davranışa bakar (döngüsel değil). `dur_ms` dışlandı (Shadow zamanlama
  gürültüsü; saldırı semantiği taşımıyor).
- **Etiket (zayıf):** run senaryosu (benign / saldırı tipi). **Sınırlılık:** bir saldırı
  koşusunda her devre fiilen saldırılı olmayabilir (özellikle premature'da gid 1/2/9 benign
  görünür) → etiket gürültüsü. Etkisi **tek yönlü değildir**: denetimli modelde FN'i şişirip
  recall'ı düşürür (muhafazakâr); anomali tabanlı modelde benign-görünümlü saldırı devresi
  "saldırı" sayıldığından recall'ı şişirebilir. İki yönü de aşağıda belirtilir.
- **Modeller:** denetimli LogisticRegression (class_weight=balanced); denetimsiz
  IsolationForest (yalnız train-benign'e fit → anomali = saldırı); çok-sınıflı LogReg.
  StandardScaler her foldda yalnız train'e fit edilir (scaler sızıntısı yok); IsolationForest
  yalnız train-benign'e fit edilir. Buna rağmen kopya örtüşmesi (yukarıda) nedeniyle metrikler
  iyimserdir.
- **Veri:** 109 devre — benign 27, create_flood 27, circuit_hijack 28, premature_data 27.

## Sonuç 0 — Yapısal ayrılabilirlik (CV yok; sızıntıdan bağımsız)
Eşsiz öznitelik vektörü sayısı: circuit_hijack 11, create_flood 9, premature_data 10, benign 8.

Sınıflar-arası ortak eşsiz vektör sayısı:
| Çift | Ortak eşsiz vektör |
|---|---|
| create_flood ∩ circuit_hijack | **8** (\|cf\|=9, \|ch\|=11) |
| premature_data ∩ benign | 2 (\|pd\|=10, \|bn\|=8) |
| create_flood ∩ benign | **0** |
| circuit_hijack ∩ benign | **0** |

**Bu yapısal gerçeğin sonuçları (CV'den bağımsız):**
1. create_flood ve circuit_hijack eşsiz vektörlerinin neredeyse tamamı **ortaktır** (8/9 ve
   8/11). İkisi de `SEND_CREATE=2` imzası taşır → sayım-seviyesinde **ayırt edilemezler**.
   Bu, FSM bulgusu **"CIRCUIT_HIJACK FSM-tip seviyesinde ayırt edici değil"** ile birebir
   tutarlıdır; bağımsız bir yöntemle aynı sonuca varılması bu kısıtı güçlendirir.
2. create_flood ve circuit_hijack devreleri benign ile **hiç** ortak eşsiz vektör paylaşmaz
   (0). Yani `SEND_CREATE=2` imzalı saldırılar benign'den **kusursuz ayrılır** — bu, denetimli
   modelin bu iki tipte recall=1.0 vermesinin sızıntı-bağımsız yapısal nedenidir.
3. premature ile benign 2 eşsiz vektör paylaşır (zayıf-etiketli, benign-görünümlü premature
   devreleri) → premature benign'e **en yakın**, en zor ayrılan sınıftır.

## Sonuç 1 — Denetimli (LogReg), ikili benign-vs-attack, LOSO (iyimser)
| Ölçüt | Değer |
|---|---|
| Precision | 1.000 ± 0.000 |
| Recall | 0.695 ± 0.020 |
| F1 | 0.820 ± 0.014 |

Saldırı tipi bazında recall ("saldırı" işaretlenme oranı):
| Saldırı | Recall |
|---|---|
| create_flood | 1.000 ± 0.000 |
| circuit_hijack | 1.000 ± 0.000 |
| premature_data | **0.074 ± 0.052** |

**Yorum:** create_flood/circuit_hijack kusursuz yakalanır (Sonuç 0.2: benign ile sıfır örtüşme).
premature neredeyse hiç yakalanmaz (0.074): premature devrelerinin çoğu sayım-seviyesinde
benign'e benzer ve zayıf etiketle eğitilen model bunları benign tarafına atar (FN şişer). Bu,
FSM tarafındaki **premature recall≈0.47 kapsam kaybıyla aynı yönde**dir.

## Sonuç 2 — Denetimsiz (IsolationForest, yalnız train-benign'e fit), LOSO (iyimser)
| Ölçüt | Değer |
|---|---|
| Precision | 0.750 ± 0.018 |
| Recall | 0.842 ± 0.043 |
| F1 | 0.793 ± 0.028 |

Saldırı tipi bazında recall (anomali işaretlenme oranı):
| Saldırı | Recall |
|---|---|
| create_flood | 0.778 ± 0.091 |
| circuit_hijack | 0.752 ± 0.037 |
| premature_data | 1.000 ± 0.000 |

**Yorum:** Anomali tespiti tersine bir davranış gösterir: premature'ı yüksek yakalar çünkü
benign'e göre anomaliktir (BUILDING sırasında fazladan SEND_RELAY_DATA), ama create_flood/hijack'in
bir kısmını kaçırır. premature recall=1.000 **zayıf-etiket uyarısıyla iki yönlü** okunmalı:
benign-görünümlü premature devreleri de "saldırı" etiketli olduğundan ve anomali eşiği geniş
işaretlediğinden recall şişebilir; bedeli precision=0.750'tir (FP). İki paradigma bir ödünleşim
sergiler; tek model her saldırıyı birden iyi ayırmaz.

## Sonuç 3 — Çok-sınıflı (LogReg), LOSO (iyimser)
- Ortalama accuracy = **0.542 ± 0.020**.
- Toplam karışıklık matrisi (satır=gerçek, sütun=tahmin):

|  | benign | create_flood | circuit_hijack | premature |
|---|---|---|---|---|
| **benign** | 22 | 0 | 0 | 5 |
| **create_flood** | 0 | 19 | 8 | 0 |
| **circuit_hijack** | 0 | 18 | 10 | 0 |
| **premature_data** | 19 | 0 | 0 | 8 |

**Yorum:** Confusion matrisi Sonuç 0'daki yapısal örtüşmenin doğrudan yansımasıdır:
create_flood ↔ circuit_hijack büyük ölçüde karışır (ch yalnız 10/28 doğru, 18→cf);
premature ↔ benign karışır (premature 19/27 benign'e atanır). İkisi de FSM bulgularıyla
(hijack ayırt edici değil; premature kapsam kaybı) aynı yöndedir.

## FSM ile ilişki (adil çerçeve)
FSM dedektörü ile ML baseline **aynı birimlerde değildir** (FSM üç-modlu: tip-temiz confusion /
event-purity / native ayrım; ML burada devre-seviyesi sınıflandırma). Bu yüzden tek bir ortak
tablo **uydurulmaz**. Niteliksel olarak iki yöntem aynı üç sonuca yakınsar:
- create_flood: en kolay ayrılan (FSM P=R=F1=1.0; ML yapısal olarak benign'le sıfır örtüşme).
- circuit_hijack: davranış-imzası create_flood'la örtüşür → her iki yöntemde de sınıf-seviyesinde
  ayırt edici değil (yalnız non-circular native ile ayrılır).
- premature: benign'e en yakın, en zor → her iki yöntemde de düşük kapsam.

## Sınırlılıklar (tezde açıkça belirtilmeli)
1. **Küçük n + deterministik veri:** 109 devre, sınıf başına 8–11 eşsiz vektör, 3 seed.
   Seed-bazlı LOSO sızıntıyı önlemez (test vektörlerinin %83–97'si train'de). CV metrikleri
   **dağıtım-içi/iyimserdir**, genelleme tahmini değildir. Asıl güvenilir kanıt **Sonuç 0**
   (yapısal ayrılabilirlik).
2. **Daha dürüst genelleme için** grup-temelli/deduplikasyon sonrası değerlendirme veya çok daha
   fazla eşsiz örüntülü veri gerekir (gelecek iş). Mevcut veriyle out-of-distribution iddiası
   yapılmaz.
3. **Zayıf devre-seviyesi etiket** (özellikle premature) → etkisi iki yönlü (denetimlide FN↑,
   anomalide recall↑). Gerçek per-devre ground-truth dedektörün kendisine dayanır (döngüsel),
   bu yüzden bilinçli kullanılmadı.
4. **Yalnız sayım-seviyesi öznitelik** — sıra/zamanlama (n-gram, inter-event delta) modellenmedi;
   daha zengin öznitelikler premature ayrımını iyileştirebilir (gelecek iş).
5. ML baseline FSM'nin **yerine** değil, bağımsız bir **karşılaştırma/teyit** olarak sunulur.
