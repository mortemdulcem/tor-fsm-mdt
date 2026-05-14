# Tor FSM Invalid State Transition Detection Dashboard

## User preferences — Akademik çalışmalar için bağlayıcı kurallar
**Bu kurallar her makale, tez, rapor, öneri talebinde — tekrar söylenmeden — uygulanır.**

### Yasak (asla yapma)
1. **Plausible methodology** — "öyleymiş gibi görünen" yöntem yazma. Yöntem ya gerçekten uygulanır ya da uygulanmadığı açıkça belirtilir.
2. **Uydurma veri / placeholder / halüsinasyon** — sayı, p-değeri, R², α, atıf, yıl, sayfa numarası, yazar adı uydurmak yasak. Bilinmiyorsa "kaynak doğrulanmadı" yazılır.
3. **Inconsistency / Context Loss** — aynı dokümanda çelişen rakam/iddia bırakılmaz; önceki cevaplarla tutarlılık korunur.
4. **Confirmation Bias** — sadece tezi destekleyen kaynak seçilmez; karşıt bulgular da raporlanır.
5. **Repetition** — aynı paragrafı/cümleyi farklı yerlerde tekrar etme.
6. **Formatting Errors** — başlık seviyeleri, atıf formatı (IEEE/APA), tablo numaralandırması, kaynakça sırası tutarlı.

### Zorunlu (her zaman yap)
1. **Gerçek research gap tespiti** — hayali boşluk değil, gerçekten okunan literatürde bulunan boşluk.
2. **En güncel kaynaklar** — son 3-5 yıl tercih, klasik referanslar yıl belirtilerek korunur.
3. **İstatistiksel analiz** — p-değeri, Cronbach α, regresyon katsayıları, etki büyüklüğü gerçek veri üzerinden hesaplanır; SPSS/R/AMOS/Python (statsmodels, pingouin, semopy) çıktıları gerçek yorumlanır.
4. **ML/derin öğrenme talep edilirse** — gerçek veriyle, gerçek modelle (sklearn, PyTorch, TensorFlow); metrikler (accuracy, F1, AUC, RMSE) gerçek hesaplanır.
5. **Derin analiz** — yüzeysel özet değil, neden-sonuç + sınırlılık + alternatif yorum.

### Dürüst limitler (bu ortamda yapılamayanı önceden söyle)
- **Canlı akademik veritabanı erişimi (Scopus/WoS/IEEE Xplore) yok** — varsa entegrasyon kurulur; yoksa açık web (Google Scholar, arXiv, DOI çözümleme) ile sınırlı çalışılır ve bu açıkça belirtilir.
- **Gerçek istatistik için gerçek veri lazım** — kullanıcı CSV/Excel/SPSS dosyası yüklemediyse istatistik çıktısı üretilmez; "veri yükle" denir. Sentetik veri ancak açıkça istenirse ve "sentetik" etiketiyle üretilir.
- **SPSS/AMOS yerel olarak yok** — eşdeğeri R/Python (lavaan, semopy, statsmodels, pingouin) kullanılır; çıktı formatı SPSS/AMOS'a uygun raporlanır.
- **Bilinmeyen kaynak doğrulanır** — DOI/URL üzerinden teyit edilemiyorsa kaynakçaya konulmaz.

### İletişim tarzı
- Türkçe, kısa, nötr, abartısız.
- Emoji yok.
- Yapılan ile yapılmayan ayrımı açık.
- Sınırlılık varsa cevabın başında belirtilir.



## Overview
A fullstack web application for analyzing Tor network protocol security vulnerabilities through Finite State Machine (FSM) modeling and invalid state transition detection.

## Architecture
- **Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: wouter (frontend), Express (backend)

## Key Features
- FSM simulation of Tor circuit lifecycle (IDLE -> CONNECTING -> TLS_HANDSHAKE -> CREATE_SENT -> CIRCUIT_BUILDING -> CIRCUIT_READY -> TRANSMITTING -> CLOSING -> CLOSED)
- Automatic detection of invalid state transitions
- Security violation classification (CIRCUIT_BYPASS, REPLAY_ATTACK, GHOST_CIRCUIT, HANDSHAKE_SKIP, PREMATURE_DATA, CIRCUIT_HIJACK, CREATE_FLOOD)
- Test run management with transition history and violation logs
- Interactive dashboard with data visualization

## Database Schema
- `test_runs`: Stores simulation test runs (id, name, status, createdAt)
- `transitions`: Records each FSM state transition (fromState, event, toState, isValid)
- `violations`: Logs security violations with severity and attack type classification

## API Routes (defined in shared/routes.ts)
- `GET /api/test-runs` - List all test runs
- `POST /api/test-runs` - Create a new test run
- `GET /api/test-runs/:id` - Get specific test run
- `GET /api/test-runs/:testRunId/transitions` - Get transitions for a test run
- `GET /api/test-runs/:testRunId/violations` - Get violations for a test run
- `GET /api/violations` - Get all violations
- `POST /api/fsm/simulate` - Run FSM simulation

## Project Files
- `shared/schema.ts` - Database schema and types
- `shared/routes.ts` - API contract with Zod validation
- `server/db.ts` - Database connection
- `server/storage.ts` - Data access layer
- `server/routes.ts` - API route handlers + FSM simulator
- `client/src/pages/dashboard.tsx` - Main dashboard
- `client/src/pages/test-run-details.tsx` - Test run detail view

## Generated Documents
- `client/public/Proje_Onerisi_Plani.docx` - Academic project proposal (Turkish)
