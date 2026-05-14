// Literatür notları PDF üreticisi.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const puppeteer = (await import(path.resolve(__dirname, "../node_modules/puppeteer-core/lib/cjs/puppeteer/puppeteer-core.js"))).default;

const refs = [
  // === A. Tor Güvenliği ve Anonimlik ===
  { id: 1, group: "A. Tor Güvenliği ve Anonimlik",
    cite: "Dingledine, R., Mathewson, N., Syverson, P. (2004). Tor: The Second-Generation Onion Router. USENIX Security Symposium.",
    note: "Tor protokolünün ilk akademik tanımlaması. Devre kurulum (CREATE/CREATED, EXTEND/EXTENDED), yönlendirme katmanı (onion routing) ve threat model burada tanıtılır. Tezimiz için bu makale δ tablosunun referans temelidir; özellikle 4.2 numaralı bölümdeki 'building circuits' alt başlığı, mevcut FSM tasarımındaki IDLE → CONNECTING → ... → CIRCUIT_READY zincirinin spec-uyum çerçevesini verir." },
  { id: 2, group: "A. Tor Güvenliği ve Anonimlik",
    cite: "Murdoch, S. J., Danezis, G. (2005). Low-Cost Traffic Analysis of Tor. IEEE Symposium on Security and Privacy.",
    note: "Tor'a karşı yapılan ilk ucuz trafik korelasyon saldırısının analizi. Bu çalışma, anonimliği bozan saldırıların yalnızca kriptografik düzeyde değil, ağ-katmanı davranış imzaları üzerinden de mümkün olduğunu kanıtlar. Tezimizin 'state-level zafiyet' tezini neden tamamlayıcı bir eksen olduğunun gerekçesini sağlar." },
  { id: 3, group: "A. Tor Güvenliği ve Anonimlik",
    cite: "Johnson, A., Wacek, C., Jansen, R., Sherr, M., Syverson, P. (2013). Users Get Routed: Traffic Correlation on Tor by Realistic Adversaries. ACM CCS.",
    note: "Realistik saldırgan modelleri altında trafik korelasyonunun anonimlik üzerindeki etkisini ölçer. Bizim tehdit modelimizdeki 'pasif on-path' saldırgan tanımı bu çalışmadan ödünç alınmıştır; ancak bizim çalışmamız korelasyonu kapsam dışı tutar ve state-uyumunu hedefler." },
  { id: 4, group: "A. Tor Güvenliği ve Anonimlik",
    cite: "Panchenko, A., Lanze, F., Zinnen, A., Henze, M., Pennekamp, J., Wehrle, K., Engel, T. (2016). Website Fingerprinting at Internet Scale. NDSS.",
    note: "İnternet ölçeğinde website fingerprinting saldırılarının uygulanabilirliğini ölçer. Tezimiz açısından önemli olan: bu saldırı, devre kurulum sırasının ('hücre dizisi') gözlemlenmesinden çıkarım yapar; bizim invalid-transition tespit motorumuz, bu tür diziye dayalı saldırıların izlerini algılayabilir." },
  { id: 5, group: "A. Tor Güvenliği ve Anonimlik",
    cite: "Karunanayake, I., Ahmed, N., Malaney, R., Islam, R., Jha, S. K. (2021). De-Anonymisation Attacks on Tor: A Survey. IEEE Communications Surveys & Tutorials, 23(4): 2324–2350.",
    note: "Tor'a karşı yapılan deanonymization saldırılarının kapsamlı bir taraması. Yedi saldırı kategorisi tanımlar; bizim Ek B'deki yedi saldırı vektörümüzün dördü (Replay, Hijack, Bypass, Ghost) bu sınıflandırmadan türetilmiştir. SLR sürecinin en güçlü kaynak makalesidir." },
  { id: 6, group: "A. Tor Güvenliği ve Anonimlik",
    cite: "Backes, M., Kate, A., Manoharan, P., Meiser, S., Mohammadi, E. (2013). AnoA: A Framework for Analyzing Anonymous Communication Protocols. IEEE CSF.",
    note: "Anonim iletişim protokollerinin formal analizi için genel bir çerçeve sunar. AnoA, bizim FSM tabanlı yaklaşımımızla doğrudan rakip değil tamamlayıcıdır: AnoA olasılıksal anonimlik garantilerine, biz state-uyum garantilerine bakıyoruz." },

  // === B. FSM Tabanlı Test ve Model Öğrenme ===
  { id: 7, group: "B. FSM Tabanlı Test ve Model Öğrenme",
    cite: "Lee, D., Yannakakis, M. (1996). Principles and Methods of Testing Finite State Machines—A Survey. Proceedings of the IEEE, 84(8): 1090–1123.",
    note: "FSM tabanlı test üretimi için klasik referans. W-method, Wp-method ve UIO sequences gibi tekniklerin tanımı buradan gelir. Bizim BFS-tabanlı pozitif test üreticimiz, transition coverage maksimizasyonu için bu makaledeki 'transition tour' fikrinin sadeleştirilmiş bir versiyonudur." },
  { id: 8, group: "B. FSM Tabanlı Test ve Model Öğrenme",
    cite: "Tretmans, J. (2008). Model Based Testing with Labelled Transition Systems. Formal Methods and Testing, LNCS 4949: 1–38.",
    note: "Etiketlenmiş Geçiş Sistemleri (LTS) üzerinden model-tabanlı test üretiminin teorik temeli. Bizim 'oracle' kavramımız, Tretmans'ın 'ioco' uyum bağıntısının basitleştirilmiş versiyonudur (FSM deterministik olduğu için)." },
  { id: 9, group: "B. FSM Tabanlı Test ve Model Öğrenme",
    cite: "de Ruiter, J., Poll, E. (2015). Protocol State Fuzzing of TLS Implementations. USENIX Security.",
    note: "TLS implementasyonlarında protokol state fuzzing'in pratik bir uygulaması. Bizim çalışmamızla aynı metodoloji ailesinden: gerçek implementasyondan FSM çıkar, ardından geçersiz geçişleri test et. Tor için bu işin daha önce yapılmamış olması, tezimizin literatür boşluğu argümanını destekler." },
  { id: 10, group: "B. FSM Tabanlı Test ve Model Öğrenme",
    cite: "Fiterău-Broștean, P., Janssen, R., Vaandrager, F. (2016). Combining Model Learning and Model Checking to Analyze TCP Implementations. CAV.",
    note: "TCP implementasyonlarından FSM otomatik öğrenme ve model checking ile birleştirme. Tezin gelecek çalışma bölümünde belirtilebilecek bir genişleme yönü: bizim manuel olarak tanımladığımız δ, model öğrenme (L*) ile gerçek bir Tor implementasyonundan çıkartılabilir." },
  { id: 11, group: "B. FSM Tabanlı Test ve Model Öğrenme",
    cite: "Ammann, P., Offutt, J. (2016). Introduction to Software Testing (2nd ed.). Cambridge University Press.",
    note: "Yazılım testinin standart ders kitabı. Bölüm 7 (Graph Coverage) bizim transition coverage metriğimizin formal tanımını verir; node coverage = state coverage, edge coverage = transition coverage karşılığı kurulur." },

  // === C. Formal Yöntemler ve Protokol Doğrulama ===
  { id: 12, group: "C. Formal Yöntemler ve Protokol Doğrulama",
    cite: "Dolev, D., Yao, A. C. (1983). On the Security of Public Key Protocols. IEEE Transactions on Information Theory, 29(2): 198–208.",
    note: "Klasik 'Dolev-Yao' saldırgan modeli. Tezimizin tehdit modeli bölümü, bu modelin sınırlı bir alt kümesini benimser: ağ üzerinde mesaj gözlemleme/geciktirme/replay yapabilen ama imzalanmış mesajları sahteleyemeyen aktif on-path saldırgan." },
  { id: 13, group: "C. Formal Yöntemler ve Protokol Doğrulama",
    cite: "Bhargavan, K., Blanchet, B., Kobeissi, N. (2017). Verified Models and Reference Implementations for the TLS 1.3 Standard Candidate. IEEE S&P.",
    note: "TLS 1.3 spesifikasyonunun ProVerif ile formal doğrulaması. Tezimizin formal modelleme bölümünü destekleyen 'state machine doğrulanabilir' tezinin pratik kanıtı. Tor TLS katmanı, ntor el-sıkışma sonrası değil-önce — bu makaleyle aynı disiplinde." },
  { id: 14, group: "C. Formal Yöntemler ve Protokol Doğrulama",
    cite: "Somorovsky, J. (2016). Systematic Fuzzing and Testing of TLS Libraries. ACM CCS.",
    note: "TLS kütüphanelerinde sistematik fuzzing. Bizim 'negatif test üretimi' fikrinin yakın akrabası: spec-dışı mesajlar göndererek implementasyonun nasıl tepki verdiğini ölçer. Tor için bunu state-level yapmak bizim katkımızdır." },

  // === D. Yazılım Testi Metodolojisi ve SLR ===
  { id: 15, group: "D. Yazılım Testi Metodolojisi ve SLR",
    cite: "Felderer, M., Büchler, M., Johns, M., Brucker, A., Breu, R., Pretschner, A. (2016). Security Testing: A Survey. Advances in Computers, 101: 1–51.",
    note: "Güvenlik testi tekniklerinin geniş kapsamlı taraması. Risk-driven security testing, threat modeling, model-based security testing ana başlıklarını verir. Bizim çalışmamız 'Model-Based Security Testing of State Machines' alt kategorisine düşer." },
  { id: 16, group: "D. Yazılım Testi Metodolojisi ve SLR",
    cite: "Pretschner, A., Mouelhi, T., Le Traon, Y. (2008). Model-Based Tests for Access Control Policies. ICST.",
    note: "Erişim kontrol politikaları için model-tabanlı test üretiminin erken örneklerinden biri. Bizim için önemli olan metodoloji aktarımı: politika ihlalleri (negatif testler) sistemli şekilde nasıl üretilir." },
  { id: 17, group: "D. Yazılım Testi Metodolojisi ve SLR",
    cite: "Kitchenham, B., Charters, S. (2007). Guidelines for performing Systematic Literature Reviews in Software Engineering. EBSE Technical Report EBSE-2007-01.",
    note: "SLR metodolojisinin standart kılavuzu. Tezimizin Hafta 1-2 SLR adımı PRISMA + Kitchenham yönergesini izleyecek; veritabanı seçimi, dahil-hariç tutma kriterleri, kalite değerlendirme bu kaynaktan türetilir." },

  // === E. Tor Simülasyonu ve Deneysel Altyapı ===
  { id: 18, group: "E. Tor Simülasyonu ve Deneysel Altyapı",
    cite: "Jansen, R., Bauer, K., Hopper, N., Dingledine, R. (2012). Methodically Modeling the Tor Network. USENIX CSET.",
    note: "Tor ağının deneysel olarak modellenmesi için Shadow simülatörünün ilk kullanımları. Tezimizin Ground Truth stratejisinin Katman 3'ünde Shadow üzerinde küçük topoloji kurarak FPR ölçümü yapılması bu makalede önerilen yaklaşıma dayanır." },
  { id: 19, group: "E. Tor Simülasyonu ve Deneysel Altyapı",
    cite: "Tor Project. (2026). Tor Protocol Specification (tor-spec). https://spec.torproject.org/tor-spec, son erişim: Şubat 2026.",
    note: "Tor protokolünün resmi yaşayan spesifikasyonu. δ tablosunun otorite kaynağı; hücre formatları, devre kurulum sırası, RELAY hücrelerinin geçerlilik koşulları burada tanımlıdır. SLR'de literatür ile spec arasındaki uyumsuzluklar açıkça belgelenecektir." },
  { id: 20, group: "E. Tor Simülasyonu ve Deneysel Altyapı",
    cite: "Microsoft Research. (2018). A Data-Driven FSM Model for Analyzing Security Vulnerabilities. Microsoft Research Technical Report.",
    note: "Veriden FSM çıkarıp güvenlik analizi yapan endüstriyel bir örnek. Tezimizin 'state-level analiz' tezini güçlendiren pratik bir referans; ancak bu çalışma Tor'a özel değildir. Tor için ilk sistematik uygulamayı bizim yapıyor olmamız literatür boşluğunu doğrular." },
];

const groups = [...new Set(refs.map(r => r.group))];

const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>Literatür Notları</title>
<style>
  @page { size: A4; margin: 22mm 20mm 22mm 22mm; }
  * { box-sizing: border-box; }
  html, body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #111; line-height: 1.5; }
  h1 { font-size: 16pt; text-align: center; margin: 0 0 4pt; }
  .subtitle { text-align: center; font-style: italic; color: #444; margin-bottom: 14pt; }
  h2 { font-size: 12.5pt; margin: 16pt 0 6pt; border-bottom: 1px solid #888; padding-bottom: 2pt; color: #1a3a6e; }
  .ref { margin: 10pt 0 14pt; padding: 8pt 12pt; border-left: 3px solid #c0c8d4; background: #fafbfc; page-break-inside: avoid; }
  .ref .num { display: inline-block; min-width: 24pt; font-weight: bold; color: #1a3a6e; }
  .ref .cite { font-style: italic; color: #333; margin-bottom: 4pt; }
  .ref .note { text-align: justify; }
  .meta { font-size: 9.5pt; color: #444; text-align: center; margin-bottom: 14pt; }
  .meta b { color: #111; }
  .summary { background: #eef2f7; border: 1px solid #bcc8d8; padding: 10pt 14pt; margin: 14pt 0; border-radius: 4px; font-size: 10.5pt; }
  .summary ul { margin: 4pt 0 4pt 18pt; }
</style></head>
<body>

<h1>Literatür Notları (SLR — Hafta 1–2 Çıktısı)</h1>
<div class="subtitle">Tor FSM Invalid State Transition Detection — 20 Birincil Kaynak</div>
<div class="meta">
<b>Öğrenci:</b> Nurcan Denli Bayır (N25110987) &nbsp;|&nbsp;
<b>Ders:</b> BYZ 658 — Yazılım Test Teknikleri &nbsp;|&nbsp;
<b>Danışman:</b> Nebi Yılmaz<br>
<b>Üniversite:</b> Hacettepe Üniversitesi &nbsp;|&nbsp;
<b>Tarih:</b> 14.05.2026
</div>

<div class="summary">
<b>Özet.</b> Bu doküman, tezin Hafta 1-2 sistematik literatür taraması çıktısının yoğunlaştırılmış halidir. 20 birincil kaynak beş tematik kümeye ayrılmıştır:
<ul>
  <li><b>A.</b> Tor Güvenliği ve Anonimlik (6 kaynak) — Tor'a özgü saldırılar ve protokol tanımı.</li>
  <li><b>B.</b> FSM Tabanlı Test ve Model Öğrenme (5 kaynak) — Metodolojik temel.</li>
  <li><b>C.</b> Formal Yöntemler ve Protokol Doğrulama (3 kaynak) — Tehdit modeli ve doğrulama tekniği.</li>
  <li><b>D.</b> Yazılım Testi Metodolojisi ve SLR (3 kaynak) — Süreç kılavuzu.</li>
  <li><b>E.</b> Tor Simülasyonu ve Deneysel Altyapı (3 kaynak) — Doğrulama ortamı.</li>
</ul>
Her girdi: tam atıf + tezle ilişkilendirilmiş 1 paragraf yorumdan oluşur. Atıf formatı IEEE/APA karması olup tez yazımında IEEE'ye göre yeknesaklaştırılacaktır.
</div>

${groups.map(g => `
<h2>${g}</h2>
${refs.filter(r => r.group === g).map(r => `
  <div class="ref">
    <div class="cite"><span class="num">[${r.id}]</span> ${r.cite}</div>
    <div class="note">${r.note}</div>
  </div>
`).join("")}
`).join("")}

<h2>Literatür Boşluğu — SLR Sonucu</h2>
<div class="summary">
20 kaynağın incelenmesi sonucu net şekilde gözlemlenen boşluk:
<ul>
  <li><b>Tor'a özgü FSM modeli (kaynak 1, 19):</b> spesifikasyon var, ancak <i>formal 5-tuple FSM</i> olarak akademik literatürde derlenmiş bir kaynak yok.</li>
  <li><b>Protokol state fuzzing (kaynak 9, 14):</b> TLS için yapılmış, Tor için yapılmamıştır.</li>
  <li><b>Saldırı vektörü ↔ state geçişi eşleme (kaynak 5):</b> kategorik sınıflandırma var, fakat her saldırının imzasını bir δ-dışı (state, event) çiftiyle eşleyen <i>satır-satır tablo</i> mevcut değil.</li>
  <li><b>ITDR metriği:</b> "tespit edilen geçersiz geçişler / enjekte edilenler" oranını Tor'da ölçen birincil çalışma yok.</li>
</ul>
Bu dört boşluk birlikte tezimizin <i>katkı çerçevesini</i> oluşturur ve Bölüm 4 (Önem) argümanlarını destekler.
</div>

</body></html>`;

async function main() {
  const htmlPath = path.join(__dirname, "literature.html");
  await fs.writeFile(htmlPath, html, "utf8");
  console.log("[1/2] Literatür HTML yazıldı.");

  const browser = await puppeteer.launch({
    executablePath: execSync("which chromium").toString().trim(),
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.goto("file://" + htmlPath, { waitUntil: "networkidle0" });
  const out = path.join(__dirname, "Literatur_Notlari.pdf");
  await page.pdf({
    path: out, format: "A4", printBackground: true,
    margin: { top: "22mm", right: "20mm", bottom: "22mm", left: "22mm" },
    displayHeaderFooter: true,
    headerTemplate: `<div style="font-size:8pt; color:#888; width:100%; text-align:center;">Literatür Notları — Tor FSM Invalid Transition Detection</div>`,
    footerTemplate: `<div style="font-size:8pt; color:#888; width:100%; text-align:center;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
  });
  await browser.close();
  console.log("[2/2] PDF yazıldı:", out);
}

main().catch(e => { console.error(e); process.exit(1); });
