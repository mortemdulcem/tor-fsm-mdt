# Saldırı Tiplerinin Gerçeklik Durumu (FSM-MDT)

Bu tablo, FSM dedektörünün ürettiği 7 saldırı sınıfının her birinin tez kapsamında
**gerçek** (modifiye Tor'da gerçek protokol ihlali, Shadow *veya* Chutney multi-node
ağında koşulmuş, non-circular sinyalle doğrulanmış), **sentetik** (yalnızca model/harness
içi üretilmiş) ya da **yapısal olarak gerçekleştirilemez** olduğunu açıkça etiketler.

**Ortam ayrımı (dürüstlük):** Dört saldırı (CREATE_FLOOD, CIRCUIT_HIJACK, PREMATURE_DATA,
GHOST_CIRCUIT) **Shadow** ağ simülatöründe doğrulandı. Beşinci saldırı (REPLAY_ATTACK)
**Chutney multi-node** ağında (gerçek Tor süreçleri, gerçek TLS/localhost) doğrulandı. Her
ikisi de modifiye Tor 0.4.6.10 ikilisini gerçek çalıştırır; fark koşum ortamıdır ve
tabloda/metinde açıkça korunur (tek bir "hepsi Shadow" iddiası yapılmaz).

## Çerçeve (tezde aynen kullanılmalı)
Gerçek saldırılar, **modifiye edilmiş Tor 0.4.6.10 ikilisinde, ortam değişkeniyle
(env-gated) tetiklenen, varsayılan olarak iyi-huylu** hata enjeksiyonlarıdır
(fault injection). Bunlar "vahşi/uzaktan sömürülebilirlik" iddiası DEĞİLDİR; aynı
ikili env değişkeni kapalıyken normal Tor gibi çalışır. Doğrulama Shadow ağ
simülatöründe (tez Bölüm 4.15 VM) yapılır; Replit ortamı Shadow çalıştıramaz.

"Non-circular sinyal" = saldırının tespiti, saldırının kendisinin yazdığı bir
işaretleyiciye (marker) değil, **Tor'un kendi organik log satırına** dayanır.
Bunun iki gücü vardır: (a) **bağımsız bileşen oracle'ı** — sinyali, parser'ın
girdisinden farklı bir bileşen üretir (PREMATURE_DATA: ilk hop **relay**'inin kendi
protokol-ihlali logu; en güçlü kanıt). (b) **marker'sız istemci organik logu** —
sinyal istemcinin kendi normal logudur, enjekte marker değildir, ancak parser'ın
girdisiyle aynı bileşendedir (CREATE_FLOOD, CIRCUIT_HIJACK). Her ikisi de marker
döngüselliğinden arınmıştır; yine de (a), (b)'den daha bağımsızdır ve tezde bu fark
korunmalıdır — üç saldırı "eşit derecede non-circular" diye sunulmamalıdır.

## Özet tablo

| Tip | Durum | Tetikleyici (env) | Non-circular sinyal | Doğrulama (çoklu-seed, n=3: 42/137/2718) |
|---|---|---|---|---|
| CREATE_FLOOD | **Gerçek** | `TOR_FSM_ATTACK_CREATE_FLOOD` | Tor'un kendi `circuit_send_first_onion_skin(): First hop: finished sending CREATE cell` satırı bir devre için **iki kez** çıkar (iki gerçek CREATE hücresi) | tip-temiz: P=R=F1=1.0, FPR=0; native 18→9 (ortüşme yok) |
| CIRCUIT_HIJACK | **Gerçek (saldırı)**, ama FSM-tip dedektörü *ayırt edici değil* | `TOR_FSM_ATTACK_CIRCUIT_HIJACK` | İlk hop OPEN + devre BUILDING iken **fazladan** organik CREATE log satırı (`circuit_finish_handshake(): Finished building...` sonrası SEND_CREATE) | native 18/20/18→9 (ortüşme yok); **FSM-tip benign tabanı=12 → dedektör begin-noise ile confounded** |
| PREMATURE_DATA | **Gerçek** | `TOR_FSM_ATTACK_PREMATURE_DATA` | İlk hop relay'inin **kendi** protokol-ihlali logu: `handle_relay_cell_command(): Relay data cell with zero stream_id. Dropping.` (relay.c) | native 12→0 (ortüşme yok); event-level P≈0.50/R≈0.47/F1≈0.48; begin-noise FPR≈0.48 |
| REPLAY_ATTACK | **Gerçek** (non-circular, Chutney) | `TOR_FSM_ATTACK_REPLAY` | Guard relay'in **kendi** FSM kontrolü: duplicate EXTEND2 gelince `circuit_extend_state_valid_helper()` (`circuitbuild_relay.c:68`) `n_chan already set. Bug/attack. Closing.` basar — saldırganın marker'ından bağımsız | Chutney (n=3: 42/137/2718): REPLAY_ORGANIC attack=19/19/19 vs benign=0 (ortüşme yok) |
| GHOST_CIRCUIT | **Gerçek** (non-circular, Shadow) | `TOR_FSM_ATTACK_GHOST` | Alıcı relay'in **kendi** organik protokol-uyarısı: tahsis edilmemiş circ_id'li hücre gelince Tor'un `command.c` `unknown circuit %u on connection from %s. Dropping.` satırını basar — saldırganın marker'ından bağımsız | Shadow (n=3: 42/137/2718): attack her relay için >0 (aralık 11–22) vs benign=0/0/0 (ortüşme yok) |
| CIRCUIT_BYPASS | Sentetik (koşulmadı; yama güvenli-hazır) | `TOR_FSM_ATTACK_BYPASS` (aday) | Aday: istemcinin kendi `relay.c:451` `Circuits must be open before sending relay cells.` satırı (BUILDING'de relay cell paketleme guard'ı) | Henüz VM'de koşulmadı; sinyal doğrulanana kadar sentetik |
| HANDSHAKE_SKIP | **Gerçekleştirilemez** | — | — | Yapısal engel (aşağıda) |

## Çoklu-seed sonuçları (tek-istemci, CLIENTS=1; n=3, seed 42/137/2718)
Sayılar VM'de Shadow koşulduktan sonra kayıtlı loglardan `experiments/recompute.sh`
ile `experiments/runs/results.jsonl`'a yazılır ve `experiments/metrics.mjs` ile
toplanır (ort ± SD; n=3 olduğu için t-tabanlı %95 GA geniştir). Örnek birimi ve
ground-truth her saldırıda farklı olduğundan rapor **üç-modludur** — tek bir ortak
confusion matrisi uydurmak yerine her saldırı kendi geçerli ölçüsüyle raporlanır.

**Aşağıdaki tüm sayılar tek-istemci (`CLIENTS=1`) koşumundan gelir** (kanonik
9-host topoloji, tek `torclient`). Örnek boyutu = seed sayısı (n=3).

### Çok-istemci (CLIENTS>1) durumu — dürüst kapsam
Deney hattı (`full_pipeline.sh` / `recompute.sh` + `detect_json.mjs --client` +
`metrics.mjs` `byAttack[attack][seed][client][scenario]`) çok-istemci koşumunu
**destekler**: her `torclient*` host'u ayrı bir örnek satırı olur ve örnek boyutu
seed×istemci'ye çıkar. Bu yol öncelikle 4.17 ML çeşitliliği içindir; native
confusion'a (bu bölüm) istemci ayrı örnek boyutu olarak katılabilir.

**Çok-istemci koşumu yapıldı (sağlamlık kontrolü), ama çeşitlilik düşük:**
- Shadow yalnızca VM'de çalışır (Replit ortamı koşamaz; bkz. Çerçeve).
- Önceki `CLIENTS=4` denemesinde ek istemciler (`torclient2/3/4`) `EXIT=1
  "Unable to open torrc"` ile düşüyordu; kök neden: Shadow her host'un dosyalarını
  `shadow.data.template/hosts/<host>/` altından kopyalar, `make_clients.py` YAML'a
  host ekler ama template host dizinini oluşturmazdı. `full_pipeline.sh` artık
  CLIENTS>1 iken bu dizini idempotent kopyalar → düzeltildi.
- Düzeltme sonrası `CLIENTS=4`, seed 42/137/2718 koşusu **başarılıdır** (tüm süreçler
  `EXIT=0`; gerçek Shadow verisi). İki seviye ayrılır:
  - **Native-confusion (bu bölüm) — istemciler arası özdeş:** ek istemciler
    birincil istemciyle aynı saldırı-confusion toplamlarını üretti (native
    CREATE_FLOOD/CIRCUIT_HIJACK istemciler arası ±0,000). Yani bu metrik için `n=12`
    örneklem **bağımsız değil yüksek korelasyonludur** (4 kopya × 3 seed).
  - **ML öznitelik vektörü (4.17) — istemciler arası FARKLI:** devre-başına olay
    sayıları (benign yol/uzatma) istemciden istemciye değişir; çok-istemci sınıf
    başına daha fazla *eşsiz* vektör verir (ör. create_flood tek-istemci ~8 → çok-istemci 18).
- **Bu nedenle native-confusion birincil sayıları tek-istemci (n=3) kalır** (çok-istemci
  bu metrik için yalnızca sağlamlık teyididir; `n=12`'yi bağımsız tekrar gibi sunmak ve
  ±0,000 dar aralığı hassasiyet kanıtı saymak yanıltıcı olacağından yapılmaz).
  **ML temel çizgisi (4.17) ise çok-istemci veri setini (CLIENTS=4 × 3 seed, 433 devre)
  birincil alır**, çünkü orada çeşitlilik gerçekten artar (yukarıdaki ayrım).

**Reprodüksiyon (4.17 ML) — commit'li ve birebir yeniden üretilebilir:**
- Çok-istemci öznitelik CSV'si (`experiments/ml_features_multiclient.csv`, 433 devre ×
  38 sütun; n-gram `bg_*` + zamanlama `t_*` + `seq_setup_before_data`) artık **repoya
  commit'lidir**. Ham Shadow olay dizileri yalnızca VM'de kalır (full_pipeline.sh
  CLIENTS=4 ile üretilir), fakat bunlardan türetilen öznitelik tablosu commit'li
  olduğundan kanonik JSON sıfırdan yeniden üretilebilir.
- `python3 experiments/ml_baseline.py` → `experiments/ml_baseline_results.json`'u
  **birebir** üretir (varsayılan girdi = çok-istemci CSV). JSON içine script-türevli
  `provenance` bloğu yazılır (kaynak CSV, sha256, satır/sütun, ngram bayrağı).
- **Tekrarüretilebilirlik koruması:** tek-istemci/sayım-only CSV
  (`experiments/ml_features.csv`, 109 devre, n-gram yok) ile çalıştırıldığında script
  kanonik JSON'a yazmayı **reddeder** (sessiz veri bozulmasını önler); tek-istemci
  karşılaştırma için `ML_FEATURES_CSV`/`ML_RESULTS_JSON` ile ayrı dosyaya yazılır.

**Örnek-boyutu kuralı (çok-istemci için, koşum yapıldığında geçerli olacak):**
- `create_flood` / `circuit_hijack` native + tip-temiz confusion: **per-client**
  ölçülür (her istemcinin kendi organik CREATE logu) → örnek boyutu **n = seed×istemci**.
- `premature_data` event-level confusion (TP=injected, FP=noise, precision/recall):
  **per-client** → örnek boyutu **n = seed×istemci**.
- `premature_data` relay-side **native** (zero-stream-id) sinyali **KOŞUM-SEVİYESİDİR**
  (ilk hop relay'inin logu; tek istemciye atfedilemez) → örnek boyutu **n = seed**
  (koşum başına bir kez; `metrics.mjs` ek istemci satırlarına `native=null` yazıp
  toplamada atlar, GA suni daralmaz). Bu run-level / event-level ayrımı tezde açıkça
  korunmalıdır.

### Estimand haritası (tezde tutarsızlık eleştirisini önlemek için)
Her saldırının ölçtüğü nicelik (estimand) farklıdır; aşağıdaki tablo bunu açıkça sabitler.

| Saldırı | Örnek birimi | Ground-truth | Birincil geçerli iddia |
|---|---|---|---|
| CREATE_FLOOD | istemci devresi | FSM-tip (benign-temiz) | tip-temiz confusion: P=R=F1=1.0, FPR=0 |
| PREMATURE_DATA | premature olayı (event) | `injected` (TOR marker) + relay native log | event-purity precision + marker-coverage recall; non-circular native 12 vs 0 |
| CIRCUIT_HIJACK | istemci devresi | YOK (`injected`=0) | non-circular native ayrımı (18/20/18 vs 9); FSM-tip ayırt edici DEĞİL |

**CREATE_FLOOD** (tip-temiz confusion — FSM tipi CREATE_FLOOD benign'de hiç görülmez):
- TP=9.0±0, FP=0±0, TN=9.0±0, FN=0±0 → Precision=Recall=F1=**1.000**, FPR=**0.000**
- non-circular native (organik CREATE): attack=18.0±0 vs benign=9.0±0 → ortüşme yok
- En temiz ayraç: imza yalnızca CREATE_SENT'te tekrar CREATE olduğundan begin-noise'a bağışık.

**PREMATURE_DATA** (event-level; ground-truth = `injected`, `TOR_FSM_PREMATURE_SEND` marker'ı):
- TP=injected=5.67±1.15, FN=markers−inj=6.33±1.15, FP=attack-noise=6.67±4.62
- event-purity Precision=**0.495±0.179**, marker-coverage Recall=**0.472±0.096**, F1=**0.477±0.132**
  (precision = saldırı koşusunda enjekte/(enjekte+noise); recall = enjekte/gönderilen marker)
- benign begin-noise FPR (noise/circuits) = **0.481±0.064**
- non-circular native (relay zero-stream-id): attack=12.0±0 vs benign=0 → ortüşme yok (**en güçlü kanıt**)
  - **Örnek-boyutu (önemli):** event-level confusion (TP/FP/precision/recall) per-client'tır
    (çok-istemci'de n=seed×istemci); relay-side native ise **koşum-seviyesidir** (n=seed),
    çünkü zero-stream-id logunu ilk hop relay'i yazar, tek istemciye atfedilemez. Tek-istemci
    (CLIENTS=1) bu koşumda ikisi de n=3 verir; ayrım yalnız CLIENTS>1'de görünür hale gelir.
- Recall<1 nedeni: parser, gönderilen 12 marker'ın yalnızca 5/5/7'sini injected
  PREMATURE_DATA olarak etiketler (parser kapsam sınırı). Bu ölçülen bir değerdir,
  uydurma değil; tezde "tespit kapsamı sınırı" olarak raporlanır.
- **Payda doğrulaması:** kayıtlı loglarda üç seed de 12/12 marker `cstate=0`
  (CIRCUIT_STATE_BUILDING) → markerların tamamı gerçek BUILDING-anı premature gönderim;
  payda (=marker) doğrudur, recall<1 bir payda artefaktı değil gerçek tespit-kapsamı kaybıdır.

**CIRCUIT_HIJACK** (FSM-sınıflandırma seviyesinde **AYIRT EDİCİ DEĞİL**):
- `injected` ground-truth YOK (üç seed de 0) → event-level confusion kurulamaz; sahte matris üretilmedi.
- FSM-tip CIRCUIT_HIJACK sayısı: attack=21.333±0.577 vs benign=**12.0±0** (sabit begin-noise tabanı); delta=9.333±0.577.
- non-circular native (organik CREATE): attack=18.667±1.155 (18/20/18) vs benign=9.0±0 → min(attack)=18 > max(benign)=9, ortüşme yok.
- **Sonuç:** saldırı gerçektir ve YALNIZCA native ile ayrılır; FSM'nin CIRCUIT_HIJACK
  tipi benign begin-noise ile dolduğundan sınıflandırma-seviyesi tespit ayırt edici
  değildir. Tezde bu kısıt açıkça belirtilmelidir (confirmation bias'tan kaçınma).
- Üç seed de EXIT=0 ile temiz tamamlandı (kesinti yok).

> **begin-noise tek kök neden:** harness `lastCircuitId` ile bir olayı yanlış (daha
> yeni) devreye atfedince, `classifyInvalid` bunu aktif devrede CREATE/EXTEND görürse
> **CIRCUIT_HIJACK**, build sırasında DATA görürse **PREMATURE_DATA** kovasına koyar.
> Bu yüzden premature FPR≈0.48 ile hijack benign tabanı≈12 AYNI kusurdan doğar.
> CREATE_FLOOD bağışıktır. Bu, dedektörün gerçek bir sınırlılığıdır; tezde negatif
> bulgu olarak raporlanır.

## Tip bazında ayrıntı

### CREATE_FLOOD — Gerçek
`circuitbuild.c / circuit_send_first_onion_skin`: ilk CREATE hücresi gönderildikten
sonra, env açıksa Tor'un kendi `circuit_deliver_create_cell()`'i ile **ikinci, gerçek
bir CREATE hücresi** kabloda gönderilir. Bu, tek devre için iki birinci-hop CREATE'tir
(gerçek protokol ihlali), uydurma log değil. INFO seviyesinde eşleşen tek satır
`circuit_send_first_onion_skin(): First hop: finished sending CREATE cell` olduğundan,
saldırı bu satırı **bir devre için iki kez** üretir; FSM harness aynı zaman damgalı
çiftleri SEND_CREATE tekrarı olarak görür ve CREATE_FLOOD sınıflar.

### CIRCUIT_HIJACK — Gerçek
`circuit_finish_handshake`: ilk hop anahtarları kurulup devre BUILDING'e geçtikten
sonra, env açıksa `circuit_send_first_onion_skin` yeniden çağrılır; mevcut
`n_circ_id` üzerinde **bir adet fazladan gerçek CREATE** kuyruğa eklenir
(yıkıcı-olmayan varyant: relay bilinen circ id'deki yinelenen CREATE'i düşürür, devre
ayakta kalır, simülasyon exit 0). Organik SEND_CREATE log satırı devre BUILDING iken
çıktığı için FSM bunu CIRCUIT_HIJACK sınıflar.

**Önemli kısıt (çoklu-seed):** saldırının kendisi gerçektir (native organik CREATE
attack 18/20/18 vs benign 9 — ortüşme yok), ancak FSM'nin **CIRCUIT_HIJACK tipi**
benign begin-noise ile de ~12 kez tetiklendiğinden sınıflandırma-seviyesinde ayırt
edici değildir. Yani bu saldırı için geçerli kanıt FSM-tip sayısı değil, non-circular
native'dir. Ayrıntı ve sayılar yukarıdaki "Çoklu-seed sonuçları" bölümündedir.

### PREMATURE_DATA — Gerçek (non-circular, VM-doğrulanmış)
`circuitbuild.c / circuit_send_next_onion_skin` "Case two" öncesi: devre BUILDING +
ilk hop OPEN iken, env açıksa Tor'un kendi `relay_send_command_from_edge(0, ...,
RELAY_COMMAND_DATA, ..., circ->cpath)` çağrısıyla **gerçek bir erken DATA hücresi**
(stream_id=0) ilk hop'a gönderilir.
- **Asıl kanıt (non-circular):** hücre stream_id=0 olduğundan ilk hop relay'i Tor'un
  KENDİ kodu ile `Relay data cell with zero stream_id. Dropping.` basar. VM: ATTACK=12
  satır (relay1), BENIGN=0.
- **Circularity uyarısı:** istemci tarafı FSM tespiti, saldırının kendi yazdığı
  `TOR_FSM_PREMATURE_SEND` marker'ına dayanır (yarı-döngüsel) — bu yüzden marker/FSM
  sayısı baş sonuç olarak sunulmaz; baş sonuç relay'in native logudur.
- **begin-noise (FPR kaynağı):** harness, halihazırda OPEN bir devrenin begin'ini
  `lastCircuitId` ile daha yeni bir devreye atfedince benign koşuda da PREMATURE_DATA
  üretir. Bu **gerçek erken-veri değil, dedektör yanlış-pozitifidir** ve tezde ayrı
  raporlanır (bkz. `metrics.mjs` "begin-noise FPR").

### REPLAY_ATTACK — Gerçek (non-circular, Chutney multi-node)
Modifiye Tor, env açıkken (`TOR_FSM_ATTACK_REPLAY`) bir RELAY hücresini
`circuit_package_relay_cell()` yoluyla **bir kez daha** enjekte eder (gerçek duplicate
hücre; recursive re-entry'den kaçınmak için `relay.c` içinde ayrı `replay_cell`).
- **Asıl kanıt (non-circular):** duplicate hücre bir EXTEND2 (relay_command=14) olduğunda,
  guard relay ilk EXTEND2 ile devreyi `n_chan` ile genişletmiştir; ikinci (duplicate)
  EXTEND2 gelince guard'ın **kendi** `circuit_extend_state_valid_helper()`
  (`src/feature/relay/circuitbuild_relay.c:68`) fonksiyonu
  `n_chan already set. Bug/attack. Closing.` basar. Bu satır saldırganın `relay.c`'deki
  marker'ından **bağımsızdır** (relay saldırganın logunu okumaz, kendi FSM durumunu kontrol
  eder) → `attack_status.md` çerçevesinde **(a) bağımsız-bileşen oracle** (en güçlü kanıt
  sınıfı; PREMATURE_DATA'nın relay-native zero-stream-id sinyaliyle aynı güçte).
- **Ölçüm:** Chutney multi-node ağ (000a–003a auth+relay, 004r exit, 005c client,
  guard=test001a). n=3 seed (42/137/2718): REPLAY_ORGANIC attack=19/19/19 vs benign=0/0/0
  → ortüşme yok. Benign=0'ın nedeni tautoloji değil; env kapalıyken duplicate EXTEND2 hiç
  gönderilmediği için relay bu organik satırı üretmez (PREMATURE native 12→0 ile aynı mantık).
- **Circularity uyarısı (referans kolonu):** aynı koşuda saldırının kendi yazdığı
  `[FSM-REPLAY]` client-side marker'ı da sayılır (REPLAY, attack≈21 vs benign=0) ama bu
  **döngüseldir** (saldırı kodu hem yazar hem sayar) → baş sonuç DEĞİLDİR, yalnızca referans.
  Baş sonuç guard relay'in native `n_chan already set` logudur.
- **Ortam notu:** bu tek saldırı **Chutney**'de koşuldu (diğer üçü Shadow). İkisi de gerçek
  Tor binary'sini çalıştırır; tezde ortam farkı açıkça belirtilir.
- **Framing:** modifiye Tor'da env-gated, varsayılan iyi-huylu gerçek protokol ihlali —
  stok istemcinin/uzak saldırganın bunu ürettiği iddia edilmez.

### GHOST_CIRCUIT — Gerçek (non-circular, Shadow)
Modifiye Tor, env açıkken (`TOR_FSM_ATTACK_GHOST`) `circuit_package_relay_cell()`
içinde her 10 hücrede bir, **tahsis edilmemiş bir circ_id** (`circ->n_circ_id + 0x1000`)
taşıyan bir RELAY hücresini `append_cell_to_circuit_queue(..., CELL_DIRECTION_OUT, 0)`
ile kabloya koyar (gerçek "hayalet devre" hücresi; saldırgan marker'ı YOK).
- **Asıl kanıt (non-circular):** hücre var olmayan bir devreye ait olduğundan, alıcı
  düğüm Tor'un **kendi** kodu ile (`command.c`) `unknown circuit %u on connection from
  %s. Dropping.` basar. Bu satır saldırının yazdığı bir marker değil, Tor'un organik
  protokol-uyarısıdır (parser'ın girdisinden ayrı bir bileşen üretir).
- **Ölçüm:** Shadow (n=3 seed: 42/137/2718). Attack koşumunda üç relay'in her birinde
  sayı >0 (gözlenen aralık 11–22), benign koşumda üç seed de 0/0/0 → ortüşme yok.
  Benign=0 tautoloji değil; env kapalıyken hayalet hücre gönderilmediği için relay bu
  organik satırı hiç üretmez (PREMATURE native 12→0 ile aynı mantık).
- **Kısıt (dürüstlük):** `n_circ_id + 0x1000` teorik olarak nadiren gerçek bir devreyle
  çakışabilir; çakışırsa o hücre "unknown circuit" üretmez (eksik sayım riski, uydurma
  değil). attack≫benign farkı bu riske rağmen net.
- **Framing:** modifiye Tor'da env-gated, varsayılan iyi-huylu gerçek protokol ihlali —
  stok istemcinin/uzak saldırganın bunu ürettiği iddia edilmez.

### CIRCUIT_BYPASS — Sentetik (aday yama güvenli-hazır, henüz koşulmadı)
Şu an yalnızca model/harness içi enjeksiyonla üretilir; gerçek Tor davranışıyla
non-circular bir sinyale **henüz** bağlanmamıştır → tezde **sentetik** olarak etiketlenir.
- **Aday organik sinyal:** `relay.c:451` `Circuits must be open before sending relay
  cells.`. `circuit_package_relay_cell()` başındaki `circ->state != CIRCUIT_STATE_OPEN`
  guard'ı, `CELL_DIRECTION_OUT && CIRCUIT_STATE_CHAN_WAIT` meşru istisnası hariç, bu
  satırı basıp **`return -1`** eder — crypto/`layer_hint` yoluna inmeden (sed 445–480 ile
  doğrulandı → crash riski yok).
- **Aday yama:** BUILDING (OPEN ve CHAN_WAIT değil) bir devrede
  `circuit_package_relay_cell(&cell, circ, CELL_DIRECTION_OUT, NULL, NULL)` çağrısı;
  guard log basıp döner.
- **Doğrulanmadan gerçek sayılmaz:** VM koşusu bu satırı attack>0 / benign≈0 ile ve
  PREMATURE'ın `zero stream_id` satırından **ayrı** üretmediği sürece BYPASS sentetik
  kalır (çift sayım ve crash≠tespit kuralları geçerli).

(Devin AI `feature/attack-scenarios` dalı bu iki tipi "gerçek" diye sunar; o dal
uydurmadır — var olmayan Tor sembolleri, döngüsel marker-oracle — teze ALINMAZ.)

### HANDSHAKE_SKIP — Yapısal olarak gerçekleştirilemez
HANDSHAKE_SKIP, IDLE/CONNECTING'de SEND_CREATE ya da CREATE_SENT'te SEND_EXTEND
gerektirir. Tor ilk CREATE'i ancak kanal/TLS OPEN olduktan sonra gönderir
(`circuit_send_first_onion_skin` kanal hazır olmadan çağrılmaz); parser SEND_EXTEND'i
yalnızca 2.+ `circuit_finish_handshake`'te üretir. Dolayısıyla tanınan log, ön-koşulu
oluşmadan log SATIRINI UYDURMADAN üretilemez (uydurma yasak). Bu, FSM'nin modellediği
savunmanın ta kendisidir ve **negatif sonuç** olarak raporlanır.

## Dürüst kapsam
Bu çalışma S6'nın tamamını gerçek yapmaz: **beş tip** (CREATE_FLOOD, CIRCUIT_HIJACK,
PREMATURE_DATA, GHOST_CIRCUIT — Shadow; REPLAY_ATTACK — Chutney) gerçek+doğrulanmıştır;
**bir tip** (CIRCUIT_BYPASS) sentetiktir (aday yama güvenli-hazır ama henüz koşulmadı),
**bir tip** (HANDSHAKE_SKIP) gerçekleştirilemezdir. Tezde bu ayrım — gerçek/sentetik
ayrımı VE Shadow/Chutney ortam ayrımı — her tablo/şekilde korunmalıdır.
