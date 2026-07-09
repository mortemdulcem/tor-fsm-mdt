---
name: Tor FSM v1 SCI paper (Cohen's d table)
description: Verified Cohen's d / stats values for the v1 English paper Table 7, and the v1 draft error found.
---
# v1 SCI makale — Tablo 7 istatistik doğrulaması

Baseline karşılaştırması (experiments/trials.csv, N=30 eşleştirilmiş koşu, 500-olay bütçesi):
- TC: MDT vs Random d=6.93 ; MDT vs GreedySC d=3.64
- ITDR: MDT vs Random d=6.22 ; MDT vs GreedySC d=15.40
- Tümü p<0.001 (Welch + Mann-Whitney); tümü "very large effect" (d≥1.2).
- Ortalamalar: TC Random 45.9% / GreedySC 78.3% / MDT 100%; ITDR Random 50.3% / GreedySC 47.5% / MDT 93.8%.
- Bu değerler thesis/Tor_FSM_Calisma.docx §5.2 tablosuyla birebir aynı (referans doğruluk kaynağı).

**Why:** Hocanın v1 taslağında (attached_assets/v1_*.docx) Tablo 7 hatalıydı: TC MDT-vs-Random hücresine
15.4 yazılmıştı (doğrusu 6.93; 15.40 aslında ITDR-vs-GreedySC), ITDR iki d hücresi "x" placeholder'dı
(replit.md uydurma/placeholder ihlali). Düzeltilmiş dosya: attached_assets/v1_revised.docx.

**How to apply:** v1 üzerinde tekrar çalışırken bu 4 d değerini ve p<0.001'i sabit doğru kabul et;
trials.csv'den yeniden hesaplanabilir. ITDR 93.8% (algoritmik 30-koşu baseline) ile 100% (FSM native
detector, farklı katman) KARIŞTIRILMAMALI.
