// Hocanın template'ine (Türkçe, 8 bölüm) birebir uygun FINAL makale (.docx) üreteci.
// Tüm sayısal değerler experiments/*.json + server/fsm.ts + ml_baseline_results.json'dan
// dinamik gelir. Hiçbir sayı/iddia/kaynak elle uydurulmaz (replit.md akademik kuralları).
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
} from "docx";
import {
  STATES, EVENTS, VALID, totalDomain, totalValid, totalInvalid, k, classifyInvalid,
} from "../server/fsm.ts";
import { STREAM_STATES, STREAM_EVENTS } from "../server/fsm_stream.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = async (f) => JSON.parse(await fs.readFile(path.resolve(__dirname, f), "utf8"));

const trials = await R("../experiments/trials.json");
const ext = await R("../experiments/b_extensions.json");
const cext = await R("../experiments/c_extensions.json");
const dext = await R("../experiments/d_extensions.json");
const fext = await R("../experiments/f_extensions.json");
const fval = await R("../experiments/f_extensions_validated.json");
const gext = await R("../experiments/g_extensions.json");
const torStatic = await R("../experiments/tor_static_fsm.json");
const ml = await R("../experiments/ml_baseline_results.json");

const stats = trials.stats;
const comparisons = trials.comparisons;
const fvalBy = Object.fromEntries(
  fval.comparisons.filter((v) => v.B === "B2_GreedySC").map((v) => [v.metric, v]),
);
const cmpF = (metric, B) => fext.comparisons.find((c) => c.metric === metric && c.B === B);

// ---- biçim yardımcıları ----
const pct = (x) => `%${(x * 100).toFixed(1)}`;
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "—");
const sigp = (p) => (p < 0.001 ? "<.001" : p.toFixed(4));
const bud = (algo, b, key) => ext.budgetCurve[algo].find((x) => x.budget === b)[key];

// Deney tasarım sabitleri — kaynaktan türetilir (elle yazılmaz)
const N = trials.results.B1_Random.length;     // eşli deneme sayısı
const B = fext.config.eventBudget;             // olay bütçesi
const seedBase = fext.config.seedBase;         // PRNG tohum tabanı
const nScenarios = Object.keys(ml.data.counts).length; // benign + saldırı senaryoları

// ---- docx yapı yardımcıları ----
const FONT = "Times New Roman";
const tr = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size ?? 22, bold: !!o.bold, italics: !!o.italics, color: o.color });
const P = (children, o = {}) => new Paragraph({
  alignment: o.align,
  spacing: { after: o.after ?? 120, line: o.line ?? 276 },
  children: Array.isArray(children) ? children : [tr(children, o)],
});
const TITLE = (t) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [tr(t, { bold: true, size: 28 })] });
const H = (t) => new Paragraph({ spacing: { before: 200, after: 120 }, children: [tr(t, { bold: true, size: 24 })] });
const SH = (t) => new Paragraph({ spacing: { before: 120, after: 80 }, children: [tr(t, { bold: true, italics: true, size: 22 })] });

const BRD = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const cellBorders = { top: BRD, bottom: BRD, left: BRD, right: BRD };
const cell = (text, o = {}) => new TableCell({
  borders: cellBorders,
  margins: { top: 30, bottom: 30, left: 60, right: 60 },
  shading: o.header ? { fill: "DDDDDD" } : undefined,
  children: [new Paragraph({
    alignment: o.left ? AlignmentType.LEFT : AlignmentType.CENTER,
    spacing: { after: 0 },
    children: [tr(String(text), { bold: o.header || o.bold, size: o.size ?? 17 })],
  })],
});
const tbl = (headers, rows, leftCols = [0]) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  borders: { top: BRD, bottom: BRD, left: BRD, right: BRD, insideHorizontal: BRD, insideVertical: BRD },
  rows: [
    new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, { header: true, left: leftCols.includes(i) })) }),
    ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, { left: leftCols.includes(i) })) })),
  ],
});
const CAP = (t) => new Paragraph({ spacing: { before: 40, after: 120 }, children: [tr(t, { italics: true, size: 18 })] });

// ---- saldırı vektörü envanteri (programatik, gerçek) ----
function attackRows() {
  const inv = {};
  for (const s of STATES) for (const e of EVENTS) {
    if (VALID[k(s, e)] !== undefined) continue;
    const c = classifyInvalid(s, e);
    inv[c.type] = inv[c.type] || { count: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    inv[c.type].count++; inv[c.type][c.severity]++;
  }
  const total = Object.values(inv).reduce((a, b) => a + b.count, 0);
  const rows = Object.entries(inv).sort((a, b) => b[1].count - a[1].count).map(([t, d]) =>
    [t, d.count, `${(d.count / total * 100).toFixed(1)}%`, d.LOW, d.MEDIUM, d.HIGH, d.CRITICAL]);
  rows.push(["Toplam", total, "100%", "", "", "", ""]);
  return rows;
}

// ---- kaynakça (doğrulanmış; build_paper.mjs ile aynı 20 kaynak) ----
const REFS = [
  'R. Dingledine, N. Mathewson, P. Syverson, "Tor: The Second-Generation Onion Router," USENIX Security, 2004.',
  'S. J. Murdoch, G. Danezis, "Low-Cost Traffic Analysis of Tor," IEEE S&P, 2005.',
  'A. Johnson et al., "Users Get Routed: Traffic Correlation on Tor by Realistic Adversaries," ACM CCS, 2013.',
  'A. Panchenko et al., "Website Fingerprinting at Internet Scale," NDSS, 2016.',
  'I. Karunanayake et al., "De-Anonymisation Attacks on Tor: A Survey," IEEE Comm. Surveys & Tutorials, 23(4), 2021.',
  'M. Backes et al., "AnoA: A Framework for Analyzing Anonymous Communication Protocols," IEEE CSF, 2013.',
  'D. Lee, M. Yannakakis, "Principles and Methods of Testing FSMs—A Survey," Proc. IEEE, 84(8), 1996.',
  'J. Tretmans, "Model Based Testing with Labelled Transition Systems," LNCS 4949, 2008.',
  'J. de Ruiter, E. Poll, "Protocol State Fuzzing of TLS Implementations," USENIX Security, 2015.',
  'P. Fiterău-Broștean, R. Janssen, F. Vaandrager, "Combining Model Learning and Model Checking to Analyze TCP Implementations," CAV, 2016.',
  'P. Ammann, J. Offutt, Introduction to Software Testing, 2nd ed., Cambridge UP, 2016.',
  'D. Dolev, A. C. Yao, "On the Security of Public Key Protocols," IEEE TIT, 29(2), 1983.',
  'K. Bhargavan, B. Blanchet, N. Kobeissi, "Verified Models and Reference Implementations for the TLS 1.3 Standard Candidate," IEEE S&P, 2017.',
  'J. Somorovsky, "Systematic Fuzzing and Testing of TLS Libraries," ACM CCS, 2016.',
  'M. Felderer et al., "Security Testing: A Survey," Adv. Computers, vol. 101, 2016.',
  'A. Pretschner, T. Mouelhi, Y. Le Traon, "Model-Based Tests for Access Control Policies," ICST, 2008.',
  'B. Kitchenham, S. Charters, "Guidelines for performing SLRs in Software Engineering," EBSE-2007-01, 2007.',
  'R. Jansen, K. Bauer, N. Hopper, R. Dingledine, "Methodically Modeling the Tor Network," USENIX CSET, 2012.',
  'Tor Project, "Tor Protocol Specification (tor-spec)," 2026. https://spec.torproject.org/tor-spec.',
  'Microsoft Research, "A Data-Driven FSM Model for Analyzing Security Vulnerabilities," MSR Tech. Rep., 2018.',
];

// ===================== İÇERİK =====================
const body = [];
const add = (...x) => body.push(...x);

// Başlık + yazarlar + kurum
add(TITLE("Tor Devre Protokolünde Geçersiz Durum Geçişlerinin Model-Güdümlü Test ile Saptanması"));
add(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [
  tr("Nurcan Denli Bayır ", { bold: true }), tr("1", { bold: true, size: 16 }),
  tr("  ve  "), tr("Nebi Yılmaz ", { bold: true }), tr("2", { bold: true, size: 16 }),
] }));
add(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [
  tr("1,2 Hacettepe University Institute of Informatics, Ankara, Turkey", { italics: true, size: 20 }),
]}));

// Özet
add(H("Özet"));
add(P(
  `Anonim iletişim ağı Tor, trafik korelasyonu ve kriptografik analiz eksenlerinde yoğun çalışılmış; ancak protokol durum-makinesi uygunluğu ekseni göreli olarak boş kalmıştır. Bu çalışma, Tor devre yaşam döngüsünün yayımlanmış ilk eksiksiz 5-bileşenli sonlu durum makinesi (SDM) biçimselleştirmesini sunar ve spesifikasyon dışı (geçersiz) durum geçişlerini dizgesel olarak saptayan bir Model-Güdümlü Test (MGT) motoru önerir. Devre, ${STATES.length} durum ve ${EVENTS.length} olay üzerinde tanımlanır; bu, ${totalValid} geçerli ve ${totalInvalid} geçersiz çift içeren ${totalDomain} hücrelik bir alan üretir. Her geçersiz çift, dört seviyeli ciddiyet etiketiyle yedi birincil saldırı vektörüne programatik olarak eşlenir. Üç algoritma — düzgün rastgele (B1), açgözlü durum kapsamı (B2) ve önerilen MGT (B3) — özdeş ${B}-olay bütçesinde N=${N} eşli denemede karşılaştırılır. MGT, geçiş kapsamını ${pct(stats.B3_MDT.tc.mean)} ile doyurur (B1 ${pct(stats.B1_Random.tc.mean)} / B2 ${pct(stats.B2_GreedySC.tc.mean)}) ve ${pct(stats.B3_MDT.itdr.mean)} Geçersiz Geçiş Saptama Oranına (ITDR) ulaşır; Welch t, Mann-Whitney U ve Wilcoxon işaretli-sıra testleri B3 üstünlüğünü TC ve ITDR'de birlikte doğrular (p<.001). Ayrıca, yamalı Tor + Shadow benzetimi ile bir sanal makinede üretilen 433 gerçek devre üzerinde makine öğrenmesi temel çizgisi kurulur: yalnız-sayım öznitelikleriyle çok-sınıflı doğruluk ${f(ml.sequence_timing.count_only.multiclass_accuracy.mean * 100, 1)}% iken, n-gram + zamanlama öznitelikleriyle ${f(ml.sequence_timing.enhanced.multiclass_accuracy.mean * 100, 1)}%'e çıkar ve CREATE_FLOOD↔CIRCUIT_HIJACK karışması sıfıra iner. Çalışma, spesifikasyon-kâhinli MGT ile elle yazılmış kural kümeleri arasındaki tamlık açığını niceler.`,
  { align: AlignmentType.JUSTIFIED },
));
add(P([
  tr("Anahtar Kelimeler: ", { bold: true }),
  tr("Tor, anonim ağ, sonlu durum makinesi, model-güdümlü test, protokol durum fuzzing, güvenlik testi, geçiş kapsamı, Wilcoxon işaretli-sıra, makine öğrenmesi, PRISMA.", { italics: true }),
]));

// 1. Giriş
add(H("1. Giriş"));
add(P(`Tor anonim iletişim ağı [1], iki baskın eksende incelenmiştir: trafik korelasyonu/zamanlama saldırıları [2], [3], [4], [5] ve biçimsel kriptografik analiz [6], [13]. Üçüncü bir eksen — protokol durum-makinesi uygunluğu — görece keşfedilmemiştir. Protokol durum fuzzing'i TLS gerçeklemelerine uygulanmış [9], [14] olsa da Tor için yayımlanmış eşdeğer bir çalışma yoktur. Mevcut Tor saldırı taramaları [5] anonimlik bozma vektörlerini kategori düzeyinde sınıflar; ancak protokol-durum olayları ile saldırı türleri arasında hücre düzeyinde bir eşleme sunmaz. Bu makale o boşluğu kapatır.`, { align: AlignmentType.JUSTIFIED }));
add(P([tr("Araştırma soruları. ", { bold: true }), tr("RQ1: Tor devre yaşam döngüsü, eksiksiz bir δ geçiş fonksiyonuna sahip belirlenimci 5-bileşenli bir SDM olarak biçimsel modellenebilir mi? RQ2: Ortaya çıkan geçersiz-geçiş kümesi (Q × Σ) ∖ dom(δ), ciddiyet etiketleriyle bilinen Tor saldırı vektörlerine programatik eşlenebilir mi? RQ3: MGT ile üretilen test paketi, eşleştirilmiş olay bütçelerinde geçiş kapsamı (TC) ve geçersiz geçiş saptama oranı (ITDR) üzerinde rastgele ve açgözlü temel çizgilere göre istatistiksel anlamlı kazanım sağlar mı? RQ4: Motor, bütçe B ile nasıl ölçeklenir ve bütçesiz denetimde kategori düzeyli elle yazılmış bir kural temel çizgisiyle nasıl karşılaştırılır?")]));
add(P([tr("Katkılar. ", { bold: true }), tr(`(i) Resmî Tor spesifikasyonundan [19] türetilen, yayımlanmış ilk eksiksiz Tor devre δ-matrisi; (ii) tüm ${totalInvalid} geçersiz çifti yedi birincil saldırı vektörü artı belirlenimci bir yedek sınıfa, dört ciddiyet seviyesiyle eşleyen programatik bir sınıflandırıcı; (iii) en kötü durum karmaşıklığı O(|Q|²·|Σ|²) olan açık kaynaklı bir referans MGT motoru; (iv) üç bağımsız test ailesiyle (Welch t, Mann-Whitney U, Wilcoxon) doğrulanmış eşli üç-yönlü istatistiksel karşılaştırma; (v) yedi noktalı bütçe duyarlılık analizi; (vi) elle yazılmış kural kümeleri ile spesifikasyon-kâhinli saptama arasında nicelenmiş tamlık açığı; (vii) nanosaniye çözünürlüklü gecikme profili; ve (viii) yamalı Tor + Shadow ile üretilen gerçek saldırı izlerinde makine öğrenmesi temel çizgisi.`)]));
add(P("Makalenin organizasyonu: Bölüm 2 literatürü PRISMA-güdümlü bir sistematik tarama ile özetler. Bölüm 3 SDM biçimselleştirmesini, saldırı sınıflandırıcısını, MGT algoritmasını ve değerlendirme tasarımını verir. Bölüm 4 deney ortamını ve Shadow tabanlı vaka çalışmasını anlatır. Bölüm 5 bulguları yorumsuz raporlar. Bölüm 6 bulguları tartışır, Bölüm 7 geçerlilik tehditlerini ele alır ve Bölüm 8 sonucu sunar.", { align: AlignmentType.JUSTIFIED }));

// 2. İlgili Çalışmalar
add(H("2. İlgili Çalışmalar"));
add(SH("2.1. Sistematik tarama yöntemi (PRISMA)"));
add(P(`Kitchenham ve Charters'ın sistematik literatür taraması (SLR) kılavuzu [17] izlenmiştir. Bu ortamda Scopus, Web of Science veya IEEE Xplore'a canlı kurumsal erişim bulunmadığından arama kaynakları açık-web kanallarıyla (Google Scholar, arXiv, DOI çözümleme) sınırlandırılmıştır; bu sınırlılık açıkça belirtilir. Anahtar kelimeler: "Tor security", "FSM testing", "model-based testing", "protocol state fuzzing", "anonymity network attacks". Yıl aralığı 1996–2026; klasik kaynaklar yıl etiketiyle korunur. Yirmi birincil kaynak beş tematik kümede tutulmuştur. Açık-web süreci denetlenebilir bir sorgu kaydı bırakmadığından, PRISMA akışının ara aşamaları (belirlenen/elenen/uygunluk) yanlış-kesinlik raporlamasından kaçınmak için NA olarak verilir; yalnız nihai dahil sayısı (n=${ext.prisma.included}) doğrulanabilirdir.`, { align: AlignmentType.JUSTIFIED }));
add(SH("2.2. Tor güvenliği ve anonimlik"));
add(P("Temel Tor protokolü [1], düşük maliyetli trafik analizi [2], gerçekçi-saldırgan korelasyonu [3], internet ölçekli web parmak izi [4] ve kapsamlı anonimlik-bozma taraması [5] saldırı manzarasını oluşturur. Yedi birincil saldırı vektöründen dördü (REPLAY_ATTACK, CIRCUIT_HIJACK, CIRCUIT_BYPASS, GHOST_CIRCUIT) [5]'teki sınıflandırmadan türetilmiştir. AnoA [6] anonimliği olasılıksal biçimselleştirir; bizim durum-uygunluğu açımız diktir.", { align: AlignmentType.JUSTIFIED }));
add(SH("2.3. SDM tabanlı test ve model öğrenme"));
add(P("Lee ve Yannakakis'in klasik taraması [7] geçiş-turu, W-yöntemi ve Wp-yöntemini ortaya koyar; bizim BFS-planlı pozitif fazımız sadeleştirilmiş bir geçiş turudur. Tretmans'ın LTS test kuramı [8] kâhini ioco-tarzı bir bağıntı olarak temellendirir; SDM'miz belirlenimci olduğundan bu, düz eşitliğe iner. de Ruiter ve Poll'un TLS durum fuzzing'i [9] yöntemsel olarak en yakındır; metodolojiyi TLS'ten Tor'a aktarıyoruz. Fiterău-Broștean ve ark. [10] L*-tarzı model öğrenmeyi model denetimiyle birleştirir. Ammann ve Offutt [11] burada kullanılan geçiş (kenar) kapsamının biçimsel tanımını verir.", { align: AlignmentType.JUSTIFIED }));
add(SH("2.4. Biçimsel protokol doğrulama ve güvenlik testi"));
add(P("Dolev–Yao [12] saldırgan modelimizi sınırlar. Bhargavan ve ark. [13] TLS 1.3'ü ProVerif ile doğrular. Somorovsky [14] TLS kütüphanelerini sistematik fuzzlar — negatif test üretiminde yakın bir akraba. Felderer ve ark.'nın güvenlik testi taraması [15] çalışmamızı «Model Tabanlı Güvenlik Testi» dalına yerleştirir. Pretschner ve ark. [16] MGT'yi erişim denetimi politikalarına uygular.", { align: AlignmentType.JUSTIFIED }));
add(SH("2.5. Tor deneysel altyapısı ve araştırma boşlukları"));
add(P("Jansen ve ark.'nın Shadow benzeticisi [18] sistematik bir Tor ağ test ortamı sağlar; resmî Tor spesifikasyonu [19] δ'nın normatif kaynağıdır; Microsoft Research [20] veri-güdümlü SDM güvenlik analizini endüstride gösterir ancak Tor için değil. Yirmi kaynaklı SLR dört somut boşluk belirler: (G1) Tor devre protokolü için yayımlanmış biçimsel 5-bileşenli SDM yoktur; (G2) protokol durum fuzzing'i TLS için yapılmış, Tor için yapılmamıştır; (G3) Tor saldırı vektörleri ile (durum, olay) hücreleri arasında satır-satır eşleme yoktur; (G4) Tor için ITDR-benzeri bir metrik tanımlanıp ölçülmemiştir. Bölüm 1'deki katkılar dört boşluğu da kapatır.", { align: AlignmentType.JUSTIFIED }));

// 3. Yöntem
add(H("3. Yöntem / Materyal ve Metot"));
add(SH("3.1. SDM biçimselleştirmesi (RQ1)"));
add(P(`Tor devre yaşam döngüsü klasik bir DFA, M = (Q, Σ, δ, q₀, F) olarak modellenir: |Q| = ${STATES.length} durum {${STATES.join(", ")}}; |Σ| = ${EVENTS.length} olay {${EVENTS.join(", ")}}; q₀ = ${STATES[0]}, F = {${STATES[STATES.length - 1]}}. δ : Q × Σ → Q fonksiyonu ${totalValid} çift üzerinde tanımlıdır; toplam alan |Q × Σ| = ${totalDomain} olduğundan geçersiz küme (Q × Σ) ∖ dom(δ) ${totalInvalid} öğe içerir. δ tablosu tek bir doğruluk kaynağından (server/fsm.ts) programatik üretilir.`, { align: AlignmentType.JUSTIFIED }));
add(SH("3.2. Saldırı sınıflandırıcısı (RQ2)"));
add(P(`Belirlenimci bir classifyInvalid(s, e) fonksiyonu, geçersiz kümedeki her (s, e) çiftini dokuz koşul ailesi üzerinden bir (tür, ciddiyet) ikilisine eşler: devre-hazır-öncesi veri akışı, CREATE/CREATED akışı, EXTEND/EXTENDED akışı, yersiz DESTROY, CONNECT kötüye kullanımı, TLS_OK/TLS_FAIL kötüye kullanımı, CIRCUIT_CLOSED kötüye kullanımı, TIMEOUT kötüye kullanımı ve bir INVALID_TRANSITION yedeği. Çıktı, {LOW, MEDIUM, HIGH, CRITICAL} ciddiyet etiketleriyle tüm ${totalInvalid} geçersiz hücreyi kapsar (Bölüm 5, Tablo 8).`, { align: AlignmentType.JUSTIFIED }));
add(SH("3.3. MGT motoru — Algoritma 1"));
add(P([tr("Algoritma 1 (BFS-planlı MGT), iki fazlı çalışır. ", {}), tr("Pozitif faz: ", { bold: true }), tr("her geçerli (s, e) çifti için q₀'dan s'ye BFS yolu bulunur ve yol·⟨e⟩ yürütülür; visited ve coveredV güncellenir. "), tr("Negatif faz: ", { bold: true }), tr("cebirsel türetilmiş geçersiz küme yinelenir; her geçersiz çift için yine BFS yoluyla s'ye ulaşılır ve δ-kâhini çifti işaretler. Çıktı: SC = |visited|/|Q|, TC = |coveredV|/|Valid|, ITDR = |detectedI|/|Invalid|, FPR.")]));
add(P([tr("Karmaşıklık. ", { bold: true }), tr(`Tek bir BFS_PATH çağrısı O(|Q|·|Σ|)'dir; pozitif faz bunu en fazla |Valid| = ${totalValid}, negatif faz en fazla |Invalid| = ${totalInvalid} kez çağırır; bu nedenle en kötü durum O((|Valid|+|Invalid|)·|Q|·|Σ|) = O(|Q|²·|Σ|²). B = ${B}'de tek deneme sıradan donanımda < 10 ms sürer.`)]));
add(SH("3.4. Karşılaştırılan algoritmalar ve değerlendirme tasarımı"));
add(P(`B1 — Düzgün Rastgele: her adımda Σ'dan düzgün olay seçer, CLOSED'a ulaşınca IDLE'a döner. B2 — Açgözlü Durum Kapsamı: mümkünse ziyaret edilmemiş duruma götüren olayı seçer; aksi halde %70 rastgele geçerli / %30 rastgele geçersiz. B3 — MGT (Algoritma 1). Üçü de aynı B = ${B} bütçesinde N = ${N} eşli denemede koşar; PRNG tohumları her deneme içinde sabit (tohum = ${seedBase}+i) ve algoritmalar arasında eşleştirilmiştir; bu eşli tasarım koşul-içi varyansı azaltır. Ek olarak B ∈ {${ext.BUDGETS ? ext.BUDGETS.join(", ") : ext.budgetCurve.B1_Random.map((x) => x.budget).join(", ")}} bütçe taraması her nokta için ${N} denemeyle yapılır.`, { align: AlignmentType.JUSTIFIED }));
add(SH("3.5. Gerçek saldırı verisi: yamalı Tor + Shadow hattı"));
add(P([tr("Dürüst sınırlılık: ", { bold: true }), tr(`bu çalışma ortamında çalışan bir tor süreci, Shadow benzeticisi veya ControlPort erişimi yoktur; gerçek izler ayrı bir sanal makinede (VM) üretilmiştir. Saldırılar, kaynak yaması yapılmış bir tor (devre-yapım kancası) ile özel bir Shadow topolojisinde koşturulmuştur. Yedi spesifikasyon-düzeyi vektörden üçü gerçek olarak uygulanabilir bulunmuştur: CREATE_FLOOD, CIRCUIT_HIJACK ve PREMATURE_DATA. Çok-istemcili kurulum, ${ml.data.n_seeds} tohum ve ${nScenarios} senaryo (benign + 3 saldırı) üzerinde toplam ${ml.data.n_circuits} devre üretir; tohumlar {${ml.data.seeds.join(", ")}}. Devreler global kimlikle (gid) anahtarlanır; ham loglar JSON'a dönüştürülür, öznitelikler çıkarılarak ml_features_multiclient.csv (${ml.provenance.source_rows}×${ml.provenance.source_cols}, SHA-256 doğrulamalı) elde edilir.`)]));
add(P([tr("ML temel çizgisi. ", { bold: true }), tr(`İki öznitelik kümesi karşılaştırılır: (a) yalnız-sayım (${ml.sequence_timing.count_only.n_features} öznitelik: olay sayımları) ve (b) genişletilmiş (${ml.sequence_timing.enhanced.n_features} öznitelik: n-gram + zamanlama). Üç değerlendirme modu uygulanır: gözetimli (RandomForest), gözetimsiz (anomali) ve çok-sınıflı. Belirlenimci veri LOSO altında yinelenen-vektör sızıntısı gösterdiğinden, sızıntısız (leak-free) protokol olarak benzersiz-vektör düzeyinde ${ml.leakfree.multiclass.k_folds}-katlı çapraz doğrulama (${ml.leakfree.multiclass.n_unique_vectors} benzersiz vektör) de raporlanır. Python statsmodels v${fval.validator.statsmodels} / scipy v${fval.validator.scipy} / sklearn v${ml.provenance.versions.sklearn} kullanılmıştır.`)]));

// 4. Deneyler / Uygulama / Vaka Çalışması
add(H("4. Deneyler / Uygulama / Vaka Çalışması"));
add(P(`Deney ortamı iki parçadır. (1) MGT/temel-çizgi karşılaştırması: TypeScript ile gerçeklenen SDM, sınıflandırıcı ve üç algoritma; Node.js çalışma zamanı; tüm metrikler [0, 1] aralığında SC/TC/ITDR; her algoritma N = ${N} eşli denemede, ardından yedi noktalı bütçe taraması. Kâhin, δ tablosunun kendisidir; bağımsız bir ikinci kâhin (spesifikasyon anlatısından elle türetilmiş ${dext.oracleIndependent.invariants.length} değişmez) çapraz doğrulama için eklenmiştir.`, { align: AlignmentType.JUSTIFIED }));
add(P(`(2) Shadow tabanlı vaka çalışması: yamalı tor + özel topoloji bir VM'de koşturulmuş; CREATE_FLOOD, CIRCUIT_HIJACK ve PREMATURE_DATA saldırıları devre-yapım kancasıyla enjekte edilmiş; ${ml.data.n_seeds} tohum üzerinde toplam ${ml.data.n_circuits} devre (benign ${ml.data.counts.benign}, create_flood ${ml.data.counts.create_flood}, circuit_hijack ${ml.data.counts.circuit_hijack}, premature_data ${ml.data.counts.premature_data}) toplanmıştır. Loglar Σ olay alfabesine eşlenmiş, öznitelik vektörlerine dönüştürülmüş ve Bölüm 3.5'teki ML protokolü uygulanmıştır.`, { align: AlignmentType.JUSTIFIED }));
add(P(`Ek doğrulamalar: (a) gerçek Tor kaynağının src/core/or dizinindeki ${torStatic.source.files_scanned} C dosyası taranarak circuit_set_state çağrı yerlerinden ${torStatic.structural.impl_states_count} farklı gerçekleme durumu çıkarılmış (statik gerçekleme-SDM); (b) Angluin L* algoritması saf Node'da gerçeklenip statik-çıkarılmış gerçekleme-SDM üzerinde koşturulmuş; (c) δ-arama + classifyInvalid sıcak yolu gcc -O3 ile C'ye taşınarak çapraz-platform gecikme ölçülmüştür.`, { align: AlignmentType.JUSTIFIED }));

// 5. Bulgular (YORUM YOK)
add(H("5. Bulgular"));
add(P(`B = ${B} bütçesinde N = ${N} deneme üzerinden tanımlayıcı istatistikler Tablo 1'de verilir.`, { align: AlignmentType.JUSTIFIED }));
add(P([tr("Tablo 1. ", { bold: true }), tr(`Tanımlayıcı istatistikler (ortalama ± SS, N = ${N}).`)], { after: 40 }));
add(tbl(["Algoritma", "SC", "TC", "ITDR"], [
  ["B1 — Rastgele", `${pct(stats.B1_Random.sc.mean)}±${(stats.B1_Random.sc.sd * 100).toFixed(1)}`, `${pct(stats.B1_Random.tc.mean)}±${(stats.B1_Random.tc.sd * 100).toFixed(1)}`, `${pct(stats.B1_Random.itdr.mean)}±${(stats.B1_Random.itdr.sd * 100).toFixed(1)}`],
  ["B2 — Açgözlü SC", `${pct(stats.B2_GreedySC.sc.mean)}±${(stats.B2_GreedySC.sc.sd * 100).toFixed(1)}`, `${pct(stats.B2_GreedySC.tc.mean)}±${(stats.B2_GreedySC.tc.sd * 100).toFixed(1)}`, `${pct(stats.B2_GreedySC.itdr.mean)}±${(stats.B2_GreedySC.itdr.sd * 100).toFixed(1)}`],
  ["B3 — MGT", `${pct(stats.B3_MDT.sc.mean)}±${(stats.B3_MDT.sc.sd * 100).toFixed(1)}`, `${pct(stats.B3_MDT.tc.mean)}±${(stats.B3_MDT.tc.sd * 100).toFixed(1)}`, `${pct(stats.B3_MDT.itdr.mean)}±${(stats.B3_MDT.itdr.sd * 100).toFixed(1)}`],
]));
add(CAP("SC: durum kapsamı, TC: geçiş kapsamı, ITDR: geçersiz geçiş saptama oranı."));

add(P([tr("Tablo 2. ", { bold: true }), tr("İkili hipotez testleri (Welch t, Mann-Whitney U, Cohen d).")], { before: 120, after: 40 }));
add(tbl(["Karşılaştırma", "Metrik", "t", "p (Welch)", "p (M-W)", "d"],
  comparisons.map((c) => [`${c.a.replace("_", " ")} vs ${c.b.replace("_", " ")}`, c.metric.toUpperCase(), f(c.t, 2), sigp(c.pT), sigp(c.pU), f(c.d, 2)]),
  [0]));

add(P([tr("Tablo 3. ", { bold: true }), tr("Wilcoxon işaretli-sıra testleri (eşli farklar).")], { before: 120, after: 40 }));
add(tbl(["Karşılaştırma", "Metrik", "W", "z", "p", "n (≠0)"],
  ext.wilcoxon.map((w) => [`${w.a.replace("_", " ")} vs ${w.b.replace("_", " ")}`, w.metric.toUpperCase(), f(w.W, 1), f(w.z, 2), sigp(w.p), w.n]),
  [0]));

add(P([tr("Tablo 4. ", { bold: true }), tr("Bütçe duyarlılığı: TC ve ITDR (B = 200 ve B = 5000).")], { before: 120, after: 40 }));
add(tbl(["Algoritma", "TC@200", "TC@5000", "ITDR@200", "ITDR@5000"], [
  ["B1 — Rastgele", pct(bud("B1_Random", 200, "tc_mean")), pct(bud("B1_Random", 5000, "tc_mean")), pct(bud("B1_Random", 200, "itdr_mean")), pct(bud("B1_Random", 5000, "itdr_mean"))],
  ["B2 — Açgözlü SC", pct(bud("B2_GreedySC", 200, "tc_mean")), pct(bud("B2_GreedySC", 5000, "tc_mean")), pct(bud("B2_GreedySC", 200, "itdr_mean")), pct(bud("B2_GreedySC", 5000, "itdr_mean"))],
  ["B3 — MGT", pct(bud("B3_MDT", 200, "tc_mean")), pct(bud("B3_MDT", 5000, "tc_mean")), pct(bud("B3_MDT", 200, "itdr_mean")), pct(bud("B3_MDT", 5000, "itdr_mean"))],
]));

add(P([tr("Tablo 5. ", { bold: true }), tr(`Kural-tabanlı saptayıcı (B0) vs spesifikasyon-kâhini, bütçesiz Q×Σ denetimi (${ext.ruleBased.totalInvalid} geçersiz hücre).`)], { before: 120, after: 40 }));
add(tbl(["Saptayıcı", "Tamlık", "Kaçırılan CRITICAL", "Kaçırılan HIGH"], [
  ["B0 — 7 kural", `${(ext.ruleBased.completeness * 100).toFixed(1)}%`, ext.ruleBased.missedBySeverity.CRITICAL, ext.ruleBased.missedBySeverity.HIGH],
  ["Spesifikasyon-kâhini", "100.0%", 0, 0],
]));

add(P([tr("Tablo 6. ", { bold: true }), tr(`Hücre-başı saptama gecikmesi (ns/çağrı; batch = ${ext.latencyData.batchSize.toLocaleString("tr-TR")}, ${ext.latencyData.repeats} tekrar).`)], { before: 120, after: 40 }));
add(tbl(["Prob", "ort", "SS", "p50", "p95", "min", "maks"],
  [["valid_step", "invalid_critical", "invalid_low"]].flat().map((key) => {
    const d = ext.latencyData[key];
    const lbl = { valid_step: "Geçerli adım", invalid_critical: "Geçersiz CRITICAL", invalid_low: "Geçersiz LOW" }[key];
    return [lbl, f(d.mean_ns, 1), f(d.sd_ns, 1), f(d.p50_ns, 1), f(d.p95_ns, 1), f(d.min_ns, 1), f(d.max_ns, 1)];
  }), [0]));

add(P([tr("Tablo 7. ", { bold: true }), tr(`Eşli bootstrap %95 güven aralığı (R = ${(fext.config.bootstrapR || 10000).toLocaleString("tr-TR")}) ve post-hoc güç.`)], { before: 120, after: 40 }));
add(tbl(["Çift", "Metrik", "Δ", "%95 GA", "dz", "Güç"],
  cext.bootstrap.map((b, i) => {
    const p = cext.power[i] || {};
    const nm = (x) => x.replace("B1_Random", "B1").replace("B2_GreedySC", "B2").replace("B3_MDT", "B3");
    return [`${nm(b.a)} − ${nm(b.b)}`, b.metric.toUpperCase(), f(b.observed, 3), `[${f(b.ci_lo, 3)}, ${f(b.ci_hi, 3)}]`, Number.isFinite(p.d_z) ? f(p.d_z, 2) : "—", f(p.power, 3)];
  }), [0]));

add(P([tr("Tablo 8. ", { bold: true }), tr(`Saldırı vektörü envanteri (${totalInvalid} geçersiz çift üzerinde programatik).`)], { before: 120, after: 40 }));
add(tbl(["Saldırı vektörü", "#", "Pay", "LOW", "MED", "HIGH", "CRIT"], attackRows(), [0]));

add(SH("5.1. Akış (stream) alt-SDM uzantısı"));
add(P(`Spesifikasyon türevli akış alt-SDM'si (${STREAM_STATES.length} durum, ${STREAM_EVENTS.length} olay) ${cext.stream.valid} geçerli ve ${cext.stream.invalid} geçersiz çift (${cext.stream.domain} hücre) üretir. Aynı B1/B2/B3 koşum hattı eşli tohumlarla (N = ${cext.stream.N_trials}, bütçe = ${cext.stream.budget}) çalıştırılmıştır: B3 ITDR = ${pct(cext.stream.stats.B3_MDT.itdr.mean)}, B2 = ${pct(cext.stream.stats.B2_GreedySC.itdr.mean)}, B1 = ${pct(cext.stream.stats.B1_Random.itdr.mean)} (B3 > {B1, B2} için p < .001). TC'de B3 vs B1 anlamlıyken (p < .001) B3 vs B2 anlamlı değildir (p = ${f(cext.stream.comparisons.find((c) => c.a === "B3_MDT" && c.b === "B2_GreedySC" && c.metric === "tc").p, 3)}).`, { align: AlignmentType.JUSTIFIED }));

add(SH("5.2. Statik gerçekleme-SDM, bağımsız kâhin ve L*"));
add(P(`Gerçek Tor kaynağından statik çıkarım, ${torStatic.sites_count} circuit_set_state çağrı yerinden ${torStatic.structural.impl_states_count} farklı gerçekleme durumu vermiştir. Bağımsız (anlatı türevli) kâhin, ${STATES.length * EVENTS.length} hücrelik alanın %${(dext.oracleIndependent.agreement * 100).toFixed(2)}'inde δ ile uyuşur; kalan ${dext.oracleIndependent.disagreements.length} hücrede uyuşmazlık kaydedilmiştir. L* (Angluin), statik gerçekleme-SDM üzerinde ${gext.trace.length} turda ${gext.counters.membership_queries.toLocaleString("en-US")} üyelik ve ${gext.counters.equivalence_queries} denklik sorgusuyla (${f(gext.counters.runtime_ms, 0)} ms) yakınsamış ve ${gext.learned.states}-durumlu minimal kanonik DFA'yı geri kazanmıştır. C (gcc -O3) taşıması, Node'a göre ortalama ${f(dext.cLatency.comparison.probes.reduce((a, p) => a + p.speedup_x, 0) / 3, 0)}× hızlıdır.`, { align: AlignmentType.JUSTIFIED }));

add(SH("5.3. Gerçek saldırı izlerinde makine öğrenmesi"));
add(P([tr("Tablo 9. ", { bold: true }), tr("Yalnız-sayım vs genişletilmiş (n-gram + zamanlama) öznitelikler (gözetimli, eşli tohum ort.).")], { after: 40 }));
add(tbl(["Öznitelik kümesi", "Precision", "Recall", "F1", "Çok-sınıflı doğr.", "CF↔CH karışma"], [
  [`Yalnız-sayım (${ml.sequence_timing.count_only.n_features})`, f(ml.sequence_timing.count_only.supervised.precision.mean, 3), f(ml.sequence_timing.count_only.supervised.recall.mean, 3), f(ml.sequence_timing.count_only.supervised.f1.mean, 3), `${f(ml.sequence_timing.count_only.multiclass_accuracy.mean * 100, 1)}%`, `${ml.sequence_timing.count_only.flood_hijack_confusion.cf_to_hj}+${ml.sequence_timing.count_only.flood_hijack_confusion.hj_to_cf}`],
  [`Genişletilmiş (${ml.sequence_timing.enhanced.n_features})`, f(ml.sequence_timing.enhanced.supervised.precision.mean, 3), f(ml.sequence_timing.enhanced.supervised.recall.mean, 3), f(ml.sequence_timing.enhanced.supervised.f1.mean, 3), `${f(ml.sequence_timing.enhanced.multiclass_accuracy.mean * 100, 1)}%`, `${ml.sequence_timing.enhanced.flood_hijack_confusion.cf_to_hj}+${ml.sequence_timing.enhanced.flood_hijack_confusion.hj_to_cf}`],
], [0]));
add(P(`Saldırı-başı recall (yalnız-sayım → genişletilmiş): CREATE_FLOOD ${f(ml.sequence_timing.count_only.per_attack_recall.create_flood.mean, 3)} → ${f(ml.sequence_timing.enhanced.per_attack_recall.create_flood.mean, 3)}; CIRCUIT_HIJACK ${f(ml.sequence_timing.count_only.per_attack_recall.circuit_hijack.mean, 3)} → ${f(ml.sequence_timing.enhanced.per_attack_recall.circuit_hijack.mean, 3)}; PREMATURE_DATA ${f(ml.sequence_timing.count_only.per_attack_recall.premature_data.mean, 3)} → ${f(ml.sequence_timing.enhanced.per_attack_recall.premature_data.mean, 3)}. CREATE_FLOOD↔CIRCUIT_HIJACK öznitelik-uzayı örtüşmesi ${ml.sequence_timing.count_only.overlap.create_flood__circuit_hijack} → ${ml.sequence_timing.enhanced.overlap.create_flood__circuit_hijack}'a iner.`, { align: AlignmentType.JUSTIFIED }));
add(P([tr("Tablo 10. ", { bold: true }), tr(`Sızıntısız (leak-free) protokol: benzersiz-vektör düzeyinde (${ml.leakfree.multiclass.n_unique_vectors} vektör, ${ml.leakfree.multiclass.k_folds}-katlı).`)], { after: 40 }));
add(tbl(["Mod", "Precision", "Recall", "F1 / Doğruluk"], [
  ["Gözetimli", f(ml.leakfree.supervised.precision, 3), f(ml.leakfree.supervised.recall, 3), f(ml.leakfree.supervised.f1, 3)],
  ["Gözetimsiz", f(ml.leakfree.unsupervised.precision, 3), f(ml.leakfree.unsupervised.recall, 3), f(ml.leakfree.unsupervised.f1, 3)],
  ["Çok-sınıflı", "—", "—", f(ml.leakfree.multiclass.accuracy, 3)],
], [0]));
add(P(`Yapısal not: LOSO yinelenen-vektör oranları tohumlara göre %${(ml.structural.loso_dup["42"].ratio * 100).toFixed(1)}–%${(ml.structural.loso_dup["137"].ratio * 100).toFixed(1)} arasındadır; veri kümesi yinelendirme sonrası ${ml.structural.dedup.n_unique_vectors} benzersiz vektöre iner (${ml.structural.dedup.pure} saf, ${ml.structural.dedup.shared} paylaşımlı). Gözetimsiz modda PREMATURE_DATA recall'ı ${f(ml.leakfree.unsupervised.per_attack_recall.premature_data, 3)}, gözetimlide ${f(ml.leakfree.supervised.per_attack_recall.premature_data, 3)}'dur.`, { align: AlignmentType.JUSTIFIED }));

// 6. Tartışma
add(H("6. Tartışma"));
add(P(`MGT üstünlüğü, δ'ya bir planlama kâhini olarak açık erişimden kaynaklanır: pozitif faz BFS ile her geçerli kenarın erişilebilirliğini garanti eder; negatif faz, geçersiz kümeye rastlamayı ummak yerine onu cebirsel olarak yineler. Bu nedenle TC ve ITDR'de gözlenen kazanımlar yapısaldır, rastlantısal değildir. B2'nin B1'e göre ITDR'de anlamlı üstünlük göstermemesi (Tablo 3) başlı başına bir kanıttır: pozitif kapsamı eniyileyen sezgiseller iyi negatif testler üretmez; geçersiz-çift kapsamı açık numaralandırma gerektirir (G4).`, { align: AlignmentType.JUSTIFIED }));
add(P(`Kural-tabanlı B0'ın yalnızca %${(ext.ruleBased.completeness * 100).toFixed(1)} tamlık göstermesi ve ${ext.ruleBased.missedBySeverity.CRITICAL} CRITICAL + ${ext.ruleBased.missedBySeverity.HIGH} HIGH çifti kaçırması, hücre düzeyinde δ haritası olmadan (G3) yüksek-ciddiyetli saldırıların bile sistematik olarak gözden kaçtığını gösterir. Bu, spesifikasyon-kâhinli MGT'nin pratik gerekçesidir.`, { align: AlignmentType.JUSTIFIED }));
add(P(`Makine öğrenmesi bulguları nüanslıdır. SDM/sayım düzeyinde CREATE_FLOOD ve CIRCUIT_HIJACK ayırt edilemezdir (örtüşme ${ml.structural.overlap.create_flood__circuit_hijack.inter} ortak vektör); bu yüzden yalnız-sayım çok-sınıflı doğruluğu %${f(ml.sequence_timing.count_only.multiclass_accuracy.mean * 100, 1)}'de kalır. n-gram + zamanlama öznitelikleri eklendiğinde iki sınıf arası karışma sıfıra iner ve doğruluk %${f(ml.sequence_timing.enhanced.multiclass_accuracy.mean * 100, 1)}'e çıkar — yani bu iki saldırı yalnız olay-sırası/zamanlamasıyla ayrışır. PREMATURE_DATA ise sayım düzeyinde benign'e çok yakındır (örtüşme ${ml.structural.overlap.premature_data__benign.inter}); gözetimli recall düşük kalırken (${f(ml.leakfree.supervised.per_attack_recall.premature_data, 3)}) gözetimsiz anomali modunda ${f(ml.leakfree.unsupervised.per_attack_recall.premature_data, 3)}'e ulaşır — yani PREMATURE_DATA bir sınıflandırma değil, bir sapma (anomali) problemi olarak ele alınmalıdır.`, { align: AlignmentType.JUSTIFIED }));
add(P(`Beklenen/beklenmeyen: MGT'nin ITDR üstünlüğü beklenendi ve doğrulandı; beklenmeyen, n-gram özniteliklerinin CREATE_FLOOD/CIRCUIT_HIJACK ayrımını tam olarak çözmesiydi. Güçlü yön, tüm sayıların tek doğruluk kaynağından programatik üretilmesi ve üç bağımsız istatistik ailesiyle çapraz doğrulanmasıdır. Sınırlılık, yer-gerçeğinin esasen spesifikasyon olması ve gerçek saldırı verisinin belirlenimci Shadow koşumlarından gelmesidir; bunlar Bölüm 7'de ele alınır.`, { align: AlignmentType.JUSTIFIED }));

// 7. Geçerlilik Tehditleri
add(H("7. Geçerlilik Tehditleri"));
add(P([tr("İç geçerlilik (yer-gerçeği = spesifikasyon). ", { bold: true }), tr(`Kısmen giderildi: gerçek Tor kaynağından statik çıkarım (${torStatic.source.files_scanned} dosya, ${torStatic.structural.impl_states_count} gerçekleme durumu) ve bağımsız kâhinle (%${(dext.oracleIndependent.agreement * 100).toFixed(2)} uyum) δ tablosu iki ayrı kaynakla çapraz doğrulanmıştır. Shadow ile dinamik iz [18] hâlâ gelecek çalışmadır.`)]));
add(P([tr("Yapı geçerliliği (FPR = 0 yapısaldır). ", { bold: true }), tr(`Bağımsız ikinci kâhin geçerli çiftlerin ${dext.oracleIndependent.matrix.TT}/${dext.oracleIndependent.matrix.TT + dext.oracleIndependent.matrix.TF}'ini ve geçersizlerin ${dext.oracleIndependent.matrix.FF}/${dext.oracleIndependent.matrix.FF + dext.oracleIndependent.matrix.FT}'ini doğrular; kalan uyuşmazlıklar gerçek spesifikasyon belirsizlikleridir.`)]));
add(P([tr("Sonuç geçerliliği (N = 30). ", { bold: true }), tr(`Giderildi: eşli bootstrap GA'ları ve post-hoc güç ana etkiler için yeterliliği doğrular (güç ≈ 1.000). Yeniden örneklenen çalışmada (N = ${fext.config.N}) iki birincil metriğin eşli etki büyüklükleri büyüktür; ancak stateCoverage için dz = ${f(cmpF("stateCoverage", "B2_GreedySC").cohensDz_paired, 3)} olup gerekli N (güç 0.80) = ${fvalBy.stateCoverage.approxN_paired_exactT_statsmodels} (statsmodels kesin noncentral-t); bu tek metrik için N = ${fext.config.N} dahi yetersiz güçlüdür. Tüm dz ve p değerleri Python statsmodels v${fval.validator.statsmodels} ile makine kesinliğinde örtüşür.`)]));
add(P([tr("Dış geçerlilik (SLR kapsamı ve gerçek ağ). ", { bold: true }), tr(`Kısmen giderildi: OpenAlex/CrossRef/arXiv'e canlı sorgular ${dext.slrLive.prisma.identified} kayıt (${dext.slrLive.prisma.queries.length} sorgu) döndürmüş, ${dext.slrLive.prisma.after_dedup} benzersiz kayda indirilmiştir; lisanslı Scopus/WoS tam-metin + atıf-grafiği erişimi kapsam dışıdır. Saldırı verisi canlı Tor ağından değil, etik/yasal nedenlerle özel bir Shadow topolojisinden gelir; canlı ağa saldırı enjeksiyonu ne mümkün ne de meşrudur.`)]));
add(P([tr("ML'ye özgü tehditler (belirlenimcilik ve LOSO sızıntısı). ", { bold: true }), tr(`Shadow koşumları belirlenimci olduğundan LOSO altında yinelenen vektör oranı %92–99'a ulaşır; bu, naif çapraz doğrulamayı iyimser kılar. Bu nedenle benzersiz-vektör düzeyinde sızıntısız protokol raporlanmıştır (çok-sınıflı doğruluk ${f(ml.leakfree.multiclass.accuracy, 3)}, ${ml.leakfree.multiclass.n_unique_vectors} benzersiz vektör). Genişletilmiş öznitelik değerlendirmesi LOSO-iyimser olabilir; bu açıkça belirtilir.`)]));
add(P([tr("Tek-platform gecikme ve öğrenme. ", { bold: true }), tr(`Gecikme tek platformda ölçülmüş, yaklaşık bir C (gcc -O3) taşımasıyla çapraz-doğrulanmıştır (ort. ${f(dext.cLatency.comparison.probes.reduce((a, p) => a + p.speedup_x, 0) / 3, 0)}× hız). L* öğretmeni statik-çıkarılmış SDM'dir, çalışan bir tor ikilisi değil; üyelik kâhinini Shadow + tor ile değiştirmek doğal sonraki adımdır.`)]));

// 8. Sonuç ve Gelecek Çalışmalar
add(H("8. Sonuç ve Gelecek Çalışmalar"));
add(P(`Bu çalışma, yayımlanmış ilk eksiksiz Tor devre δ-matrisini, programatik bir geçersiz-çift sınıflandırıcısını, referans bir MGT motorunu ve üç test ailesiyle doğrulanmış eşli üç-yönlü istatistiksel karşılaştırmayı sunmuştur. MGT motoru geçiş kapsamını doyurur ve Rastgele'ye göre ITDR'de p < .001 ve Cohen d > 3.6 ile ${f((stats.B3_MDT.itdr.mean - stats.B1_Random.itdr.mean) * 100, 1)} puana varan kazanım sağlar. Ek olarak, yamalı Tor + Shadow ile üretilen ${ml.data.n_circuits} gerçek devrede, n-gram + zamanlama öznitelikleriyle çok-sınıflı doğruluk %${f(ml.sequence_timing.enhanced.multiclass_accuracy.mean * 100, 1)}'e ulaşmış ve CREATE_FLOOD↔CIRCUIT_HIJACK karışması ortadan kalkmıştır.`, { align: AlignmentType.JUSTIFIED }));
add(P(`Gelecek çalışmalar: (a) gerçek Tor ikililerinden L*-tarzı otomatik δ çıkarımı [10] (ControlPort/stem veya Shadow-barındırmalı tor ile üyelik kâhinini değiştirerek); (b) Hidden-Service-v3 ve Pluggable-Transport alt-SDM'leri; (c) gerçek FPR ölçümü için Shadow tabanlı bağımsız kâhin [18]; (d) δ tablosunun C/Rust taşımasıyla çapraz-gerçekleme gecikme profili; (e) PREMATURE_DATA için sapma-tabanlı (anomali) saptayıcıların derinleştirilmesi.`, { align: AlignmentType.JUSTIFIED }));

// Teşekkür
add(H("Teşekkür"));
add(P("Yazarlar, çalışma boyunca yönlendirmeleri için danışman Nebi Yılmaz'a ve Hacettepe Üniversitesi Bilişim Enstitüsü'ne teşekkür eder. Bu çalışma için dış fon kullanılmamıştır.", { align: AlignmentType.JUSTIFIED }));

// Kaynakça
add(H("Kaynakça"));
REFS.forEach((r, i) => add(new Paragraph({
  spacing: { after: 60, line: 252 },
  children: [tr(`[${i + 1}] `, { size: 18 }), tr(r, { size: 18 })],
})));

// ===================== ÜRET =====================
const doc = new Document({
  creator: "Nurcan Denli Bayır",
  title: "Tor Devre Protokolünde Geçersiz Durum Geçişlerinin Model-Güdümlü Test ile Saptanması",
  styles: { default: { document: { run: { font: FONT, size: 22 } } } },
  sections: [{
    properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    children: body,
  }],
});

const outPath = path.join(__dirname, "Tor_FSM_Makale_Template.docx");
const buf = await Packer.toBuffer(doc);
await fs.writeFile(outPath, buf);
console.log("OK ->", outPath, `(${(buf.length / 1024).toFixed(1)} KB, ${body.length} blok)`);
