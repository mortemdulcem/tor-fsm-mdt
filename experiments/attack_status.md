# Saldırı Tiplerinin Gerçeklik Durumu (FSM-MDT)

Bu tablo, FSM dedektörünün ürettiği 7 saldırı sınıfının her birinin tez kapsamında
**gerçek** (modifiye Tor'da gerçek protokol ihlali, Shadow'da koşulmuş, non-circular
sinyalle doğrulanmış), **sentetik** (yalnızca model/harness içi üretilmiş) ya da
**yapısal olarak gerçekleştirilemez** olduğunu açıkça etiketler.

## Çerçeve (tezde aynen kullanılmalı)
Gerçek saldırılar, **modifiye edilmiş Tor 0.4.6.10 ikilisinde, ortam değişkeniyle
(env-gated) tetiklenen, varsayılan olarak iyi-huylu** hata enjeksiyonlarıdır
(fault injection). Bunlar "vahşi/uzaktan sömürülebilirlik" iddiası DEĞİLDİR; aynı
ikili env değişkeni kapalıyken normal Tor gibi çalışır. Doğrulama Shadow ağ
simülatöründe (tez Bölüm 4.15 VM) yapılır; Replit ortamı Shadow çalıştıramaz.

"Non-circular sinyal" = saldırının tespiti, saldırının kendisinin yazdığı bir
işaretleyiciye (marker) değil, **Tor'un kendi organik log satırına** dayanır.

## Özet tablo

| Tip | Durum | Tetikleyici (env) | Non-circular sinyal | Doğrulama (tek koşu) |
|---|---|---|---|---|
| CREATE_FLOOD | **Gerçek** | `TOR_FSM_ATTACK_CREATE_FLOOD` | Tor'un kendi `circuit_send_first_onion_skin(): First hop: finished sending CREATE cell` satırı bir devre için **iki kez** çıkar (iki gerçek CREATE hücresi) | attack=9 devre→9, benign=0 |
| CIRCUIT_HIJACK | **Gerçek** | `TOR_FSM_ATTACK_CIRCUIT_HIJACK` | İlk hop OPEN + devre BUILDING iken **fazladan** organik CREATE log satırı (`circuit_finish_handshake(): Finished building...` sonrası SEND_CREATE) | attack=9 devre→9, benign=0 |
| PREMATURE_DATA | **Gerçek** | `TOR_FSM_ATTACK_PREMATURE_DATA` | İlk hop relay'inin **kendi** protokol-ihlali logu: `handle_relay_cell_command(): Relay data cell with zero stream_id. Dropping.` (relay.c) | attack=12 satır/relay1, benign=0 |
| REPLAY_ATTACK | Sentetik | — | — | Yalnızca harness/model içi enjeksiyon |
| GHOST_CIRCUIT | Sentetik | — | — | Yalnızca harness/model içi enjeksiyon |
| CIRCUIT_BYPASS | Sentetik | — | — | Yalnızca harness/model içi enjeksiyon |
| HANDSHAKE_SKIP | **Gerçekleştirilemez** | — | — | Yapısal engel (aşağıda) |

> Yukarıdaki doğrulama sayıları **tek koşudur** (varsayılan seed). Çoklu-seed
> (42/137/2718) tekrar + ortalama±SD + güven aralığı için
> `experiments/full_pipeline.sh` (VM) çalıştırılıp `experiments/metrics.mjs` ile
> toplanır. Bu tablo, çoklu-seed sonuçları geldiğinde güncellenmelidir.

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

### REPLAY_ATTACK / GHOST_CIRCUIT / CIRCUIT_BYPASS — Sentetik
Bunlar yalnızca model/harness içi enjeksiyonla üretilir; gerçek Tor davranışıyla
non-circular bir sinyale bağlanmamıştır. Tezde **sentetik / spec-türevli** olarak
etiketlenmelidir. (Devin AI `feature/attack-scenarios` dalı bunları "gerçek" diye
sunar; o dal uydurmadır — var olmayan Tor sembolleri, döngüsel marker-oracle — teze
ALINMAZ.)

### HANDSHAKE_SKIP — Yapısal olarak gerçekleştirilemez
HANDSHAKE_SKIP, IDLE/CONNECTING'de SEND_CREATE ya da CREATE_SENT'te SEND_EXTEND
gerektirir. Tor ilk CREATE'i ancak kanal/TLS OPEN olduktan sonra gönderir
(`circuit_send_first_onion_skin` kanal hazır olmadan çağrılmaz); parser SEND_EXTEND'i
yalnızca 2.+ `circuit_finish_handshake`'te üretir. Dolayısıyla tanınan log, ön-koşulu
oluşmadan log SATIRINI UYDURMADAN üretilemez (uydurma yasak). Bu, FSM'nin modellediği
savunmanın ta kendisidir ve **negatif sonuç** olarak raporlanır.

## Dürüst kapsam
Bu çalışma S6'nın tamamını gerçek yapmaz: yalnızca üç tip (CREATE_FLOOD,
CIRCUIT_HIJACK, PREMATURE_DATA) gerçek+doğrulanmıştır; üçü sentetik, biri
gerçekleştirilemezdir. Tezde bu ayrım her tablo/şekilde korunmalıdır.
