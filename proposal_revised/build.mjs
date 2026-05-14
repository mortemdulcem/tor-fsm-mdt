// Revize edilmiş proje önerisi — PDF üretici.
// exam_solution/node_modules altındaki puppeteer-core kullanılır.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const puppeteer = (await import(path.resolve(__dirname, "../node_modules/puppeteer-core/lib/cjs/puppeteer/puppeteer-core.js"))).default;

function findChromium() {
  const p = execSync("which chromium 2>/dev/null || true").toString().trim();
  if (!p) throw new Error("Chromium bulunamadı");
  return p;
}

const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>Proje Önerisi (Revize)</title>
<style>
  @page { size: A4; margin: 22mm 20mm 22mm 22mm; }
  * { box-sizing: border-box; }
  html, body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #111; line-height: 1.45; }
  h1 { font-size: 16pt; text-align: center; margin: 0 0 4pt; }
  h2 { font-size: 12.5pt; margin: 14pt 0 4pt; border-bottom: 1px solid #888; padding-bottom: 2pt; }
  h3 { font-size: 11.5pt; margin: 10pt 0 3pt; color: #222; }
  h4 { font-size: 11pt; margin: 8pt 0 2pt; font-style: italic; }
  p { margin: 4pt 0; text-align: justify; }
  ul, ol { margin: 4pt 0 4pt 18pt; padding: 0; }
  li { margin: 2pt 0; text-align: justify; }
  .subtitle { text-align: center; font-style: italic; margin: 0 0 14pt; color: #333; }
  .meta { font-size: 9.5pt; color: #444; text-align: center; margin-bottom: 14pt; }
  .meta b { color: #111; }
  table { border-collapse: collapse; width: 100%; margin: 6pt 0; font-size: 9.5pt; }
  th, td { border: 1px solid #888; padding: 4pt 6pt; vertical-align: top; text-align: left; }
  th { background: #ececec; }
  .small { font-size: 9pt; color: #444; }
  code, .mono { font-family: "Courier New", monospace; font-size: 10pt; background: #f3f3f3; padding: 0 2pt; }
  .formula { font-family: "Cambria Math", "Times New Roman", serif; background: #f7f7f7; padding: 6pt 10pt; margin: 4pt 0; border-left: 3px solid #777; }
  .callout { border: 1px solid #aaa; background: #fafafa; padding: 6pt 10pt; margin: 6pt 0; border-radius: 3px; }
  .new-tag { display: inline-block; font-size: 8pt; background: #f0e2c8; color: #6a4b00; padding: 1px 5px; border-radius: 3px; margin-left: 6pt; vertical-align: middle; letter-spacing: 0.4px; }
  .ref { font-size: 9.5pt; }
  .ref li { margin: 3pt 0; }
  .signoff { margin-top: 18pt; font-size: 10pt; text-align: right; line-height: 1.5; }
  .pagebreak { page-break-before: always; }
  .toc { font-size: 10pt; }
  .toc div { display: flex; justify-content: space-between; padding: 1pt 0; }
</style></head>
<body>

<h1>Tor Tabanlı Anonim Ağ Sistemlerinde Sonlu Durum Makinesi (FSM)<br>Modelleme ile Invalid State Transition Tespiti ve Güvenlik Analizi</h1>
<div class="subtitle">Proje Önerisi — Revize Sürüm</div>
<div class="meta">
<b>Öğrenci:</b> Nurcan Denli Bayır (N25110987) &nbsp;|&nbsp;
<b>Bölüm:</b> Yazılım Mühendisliği YL, 1. Sınıf / Bahar Dönemi &nbsp;|&nbsp;
<b>Üniversite:</b> Hacettepe Üniversitesi<br>
<b>Ders:</b> BYZ 658 — Yazılım Test Teknikleri &nbsp;|&nbsp;
<b>Danışman:</b> Nebi Yılmaz &nbsp;|&nbsp;
<b>Teslim Tarihi:</b> 09.03.2026
</div>

<h2>Özet</h2>
<p>Bu çalışma, Tor anonim ağ protokolünün devre yaşam döngüsünü Sonlu Durum Makinesi (FSM) olarak <i>formal</i> şekilde modeller; Model-Driven Testing (MDT) yaklaşımı ile spesifikasyon dışı (geçersiz) durum geçişlerinin otomatik tespitini sağlar; ve tespit edilen her geçersiz geçişi bilinen bir saldırı vektörüne (Circuit Bypass, Replay Attack, Ghost Circuit, Handshake Skip, Premature Data, Circuit Hijack, Create Flood) eşleyen bir sınıflandırma çerçevesi sunar. Çıktılar: (i) Tor devresine özgü genişletilmiş bir FSM tanımı; (ii) geçerli/geçersiz geçiş ↔ saldırı vektörü eşleme tablosu; (iii) açık kaynak bir simülasyon ve tespit aracı; (iv) state-coverage, transition-coverage ve <i>Invalid Transition Detection Rate</i> (ITDR) metrikleriyle deneysel değerlendirme.</p>

<h2>İçindekiler</h2>
<div class="toc">
  <div><span>1. Problem Tanımı</span><span>2</span></div>
  <div><span>2. Konu ve Kapsam (Scope)</span><span>2</span></div>
  <div><span>3. Amaç ve Alt Hedefler</span><span>3</span></div>
  <div><span>4. Önem ve Literatür Boşluğu</span><span>3</span></div>
  <div><span>5. Tehdit Modeli</span><span>4</span></div>
  <div><span>6. Yöntem</span><span>5</span></div>
  <div><span>7. Değerlendirme Metrikleri ve Karşılaştırma Temelleri</span><span>6</span></div>
  <div><span>8. Ground Truth (Doğrulama Verisi) Stratejisi</span><span>7</span></div>
  <div><span>9. Çalışma Planı ve Risk Kayıt Defteri</span><span>7</span></div>
  <div><span>10. Beklenen Çıktılar</span><span>8</span></div>
  <div><span>Ek A. FSM δ Geçiş Tablosu</span><span>9</span></div>
  <div><span>Ek B. Geçersiz Geçiş ↔ Saldırı Vektörü Eşleme Tablosu</span><span>10</span></div>
  <div><span>Kaynakça</span><span>11</span></div>
</div>

<h2>1. Problem Tanımı</h2>
<p>Tor, kullanıcıların ağ üzerindeki anonimliğini korumak amacıyla geliştirilmiş, dünya genelinde günlük iki milyondan fazla kullanıcısı olan bir ağ altyapısıdır. Devre kurulum (<i>circuit setup</i>) ve veri iletim aşamalarındaki durum geçişleri, protokolün hem güvenliği hem de anonimliği için kritik öneme sahiptir. Ne var ki bu geçişlerin <i>formal</i> bir model üzerinden otomatik denetimi, hem Tor proje topluluğu hem de akademik literatür tarafından sınırlı şekilde ele alınmıştır.</p>

<p>Mevcut Tor güvenliği literatürü ağırlıklı olarak iki eksene yoğunlaşmıştır: <b>(a)</b> trafik korelasyonu ve zamanlama tabanlı deanonymization saldırıları [4, 7, 11], <b>(b)</b> kriptografik el-sıkışma ve anahtar değişim protokollerinin biçimsel doğrulanması [9]. Bu iki ekseni tamamlayan üçüncü bir eksen — yani protokolün <i>state machine</i> seviyesindeki spesifikasyon uyumu — büyük ölçüde ihmal edilmiştir. Oysa 2024 yılında raporlanan büyük ölçekli timing saldırıları ve cell-sequence tabanlı yeni deanonymization teknikleri [12], saldırı yüzeyinin önemli bir bölümünün protokolün <i>"olmaması gereken durum geçişlerini yine de yapabilmesi"</i> sayesinde mümkün olduğunu göstermektedir.</p>

<p>Bu çalışma şu temel araştırma sorusunu yanıtlar: <b>Tor devre protokolünün gerçekleşen durum geçişleri, formal spesifikasyonun izin verdiği geçişler kümesine ne ölçüde uymaktadır; uyumsuz (invalid) geçişler hangi bilinen saldırı vektörlerinin imzasını taşımaktadır?</b></p>

<h2>2. Konu ve Kapsam (Scope) <span class="new-tag">REVİZE</span></h2>
<p>Çalışma, Tor protokolünün <b>devre yaşam döngüsü</b> üzerine odaklanır. Aşağıda dahil edilen ve dışarıda bırakılan unsurlar açıkça tanımlanmıştır.</p>

<h4>Kapsam içinde (in-scope)</h4>
<ul>
  <li>Tor devresine ait 10 durumlu yaşam döngüsü: <code>IDLE, CONNECTING, TLS_HANDSHAKE, CREATE_SENT, CIRCUIT_BUILDING, CIRCUIT_READY, TRANSMITTING, CLOSING, CLOSED, ERROR</code>.</li>
  <li>Devre üzerindeki kontrol-düzlemi olayları: <code>connect, tls_complete, create_received, extend, extended, data_send, data_recv, destroy, timeout</code>.</li>
  <li>Yedi saldırı vektörü: Circuit Bypass, Replay Attack, Ghost Circuit, Handshake Skip, Premature Data, Circuit Hijack, Create Flood.</li>
  <li>Sentetik trafik üzerinde kontrollü simülasyon, MDT tabanlı negatif test üretimi ve değerlendirme.</li>
</ul>

<h4>Kapsam dışı (out-of-scope) <span class="new-tag">YENİ</span></h4>
<ul>
  <li><b>Stream (uygulama-katmanı) yaşam döngüsü:</b> RELAY_BEGIN/RELAY_END/RELAY_DATA hücreleri ile yönetilen stream FSM'i, bağımsız bir alt-FSM olarak gelecek çalışmaya bırakılmıştır. Bu kararın gerekçesi: stream FSM'i devre FSM'inden yapısal olarak ayrışıktır ve ayrı bir δ tablosu gerektirir; tek bir tezde her ikisinin de kapsanması derinlik kaybına yol açacaktır.</li>
  <li><b>Directory consensus protokolü:</b> Authority sunucularının imzalı consensus üretim süreci kapsam dışındadır.</li>
  <li><b>Kriptografik primitiflerin doğrulaması:</b> Curve25519, ntor el-sıkışma protokolünün <i>kriptografik</i> doğruluğu çalışmanın konusu değildir; yalnızca FSM olayı (event) düzeyinde modellenir.</li>
  <li><b>Hidden service / onion service v3 protokolü:</b> Ayrı bir devre tipi olduğundan ayrı bir FSM gerektirir; gelecek çalışma.</li>
  <li><b>Gerçek Tor ağında canlı ölçüm:</b> Etik ve operasyonel kısıtlar nedeniyle deneyler yalnızca yerel simülasyon ortamında yürütülecektir.</li>
</ul>

<h2>3. Amaç ve Alt Hedefler</h2>
<p>Bu projenin temel amacı, Tor devre protokolünün durum geçişlerini formal bir FSM modeli üzerinde tanımlayarak geçersiz geçişlerin otomatik tespitini sağlayan bir sistemin geliştirilmesidir. Alt hedefler:</p>
<ol>
  <li>Tor devre protokolünün tüm yaşam döngüsünü kapsayan kapsamlı bir FSM modelinin oluşturulması.</li>
  <li>Geçerli ve geçersiz durum geçişlerinin sistematik olarak sınıflandırılması.</li>
  <li>Model-Driven Testing yaklaşımıyla hem pozitif (state/transition coverage maksimizasyonu) hem de negatif (saldırı imzası enjeksiyonu) test senaryolarının otomatik üretilmesi.</li>
  <li>Tespit edilen geçersiz geçişlerin yedi saldırı vektörüne eşlenmesi ve şiddet (severity) sınıflandırılmasının üretilmesi.</li>
  <li>Bulguları görselleştiren etkileşimli bir analiz panelinin (dashboard) geliştirilmesi.</li>
  <li>Sistemin durum kapsama (state coverage), geçiş kapsama (transition coverage) ve <i>Invalid Transition Detection Rate</i> (ITDR) metrikleriyle deneysel değerlendirmesinin yapılması.</li>
</ol>

<h2>4. Önem ve Literatür Boşluğu</h2>
<ul>
  <li><b>Literatür Boşluğu:</b> Tor protokolünün FSM düzeyinde geçersiz geçişleri ile saldırı vektörleri arasındaki sistematik eşleme tablosunu sunan bir çalışma literatürde bulunmamaktadır. Mevcut çalışmalar trafik korelasyonu [4, 7, 11], kriptografik doğrulama [9] veya yan-kanal analizi [12] eksenlerinde yoğunlaşmıştır.</li>
  <li><b>Güncellik:</b> 2024 yılında raporlanan timing ve cell-sequence saldırıları [12], state-level zafiyetlerin pratik sömürülebilirliğini ortaya koymuştur.</li>
  <li><b>Teorik Katkı:</b> Tor'a özgü, kapsamlı bir δ geçiş matrisi ve geçersiz geçiş ↔ saldırı vektörü eşleme tablosu önerilerek protokol güvenliği alanına yeni bir sınıflandırma çerçevesi kazandırılır.</li>
  <li><b>Pratik Katkı:</b> Geliştirilen otomatik tespit aracı, güvenlik araştırmacıları ve Tor geliştiricileri tarafından protokol doğrulamasında ve yeni saldırı vektörlerinin keşfinde kullanılabilir.</li>
  <li><b>Disiplinler Arası Yaklaşım:</b> Formal yöntemler [3, 8, 14], ağ güvenliği [4, 11, 12] ve yazılım testi [3, 13, 15] alanlarını birleştirir.</li>
</ul>

<div class="pagebreak"></div>

<h2>5. Tehdit Modeli <span class="new-tag">YENİ</span></h2>
<p>Çalışmanın güvenlik analizinin formal temelini oluşturmak amacıyla aşağıda saldırgan kabiliyetleri, varsayımlar ve güven sınırları açıkça tanımlanmıştır.</p>

<h4>5.1 Varsayımlar</h4>
<ul>
  <li>Tor istemcisi ve relayları, modellenen FSM spesifikasyonuna <i>uyacak şekilde</i> tasarlanmıştır; spesifikasyon dışı her geçiş bir uyumsuzluğun (defect veya saldırı) işaretidir.</li>
  <li>Kriptografik primitifler (Curve25519, AES-128-CTR, SHA-256) ideal birer kara kutu olarak kabul edilir; analiz <i>protokol seviyesinde</i> yürütülür.</li>
  <li>Saldırgan, Dolev–Yao [10] modelinin sınırlı bir alt kümesine sahiptir: ağ üzerinde mesaj okuyabilir, geciktirebilir, tekrar oynatabilir, ancak imzalanmış mesajları sahteleyemez.</li>
</ul>

<h4>5.2 Saldırgan Modelleri</h4>
<table>
  <tr><th>Tip</th><th>Yetenekler</th><th>İlgili Saldırı Vektörleri</th></tr>
  <tr><td>Pasif on-path</td><td>Trafiği gözlemler, içeriği okuyamaz</td><td>(temel olarak korelasyon — bu çalışma kapsamı dışı)</td></tr>
  <tr><td>Aktif on-path</td><td>Mesajları geciktirir / yeniden gönderir / sıralarını bozar</td><td>Replay Attack, Premature Data</td></tr>
  <tr><td>Kompromize relay</td><td>Devrede yer alan kötü niyetli düğüm</td><td>Circuit Bypass, Circuit Hijack, Handshake Skip</td></tr>
  <tr><td>İstemci tarafı saldırgan</td><td>Spec-dışı istemci yazılımı çalıştırır</td><td>Create Flood, Ghost Circuit</td></tr>
</table>

<h4>5.3 Güven Sınırları</h4>
<ul>
  <li><b>Güvenilen:</b> Directory authority imzaları, kriptografik primitifler, FSM spesifikasyonunun kendisi.</li>
  <li><b>Güvenilmeyen:</b> Devredeki herhangi bir relayın (guard hariç) iyi niyetli davranacağı; herhangi bir aktarılan hücrenin spec-uyumlu sırada geleceği.</li>
</ul>

<h4>5.4 Güvenlik Hedefleri</h4>
<ul>
  <li><b>State integrity:</b> Bir devrenin durumu ancak δ'da tanımlı bir geçişle değişebilir.</li>
  <li><b>Liveness:</b> Devre, sonlu sayıda olay sonunda <code>CIRCUIT_READY</code> ya da <code>ERROR</code> durumuna ulaşır.</li>
  <li><b>Detection:</b> δ dışı her geçiş, sistem tarafından tespit edilir ve loglanır.</li>
</ul>

<div class="pagebreak"></div>

<h2>6. Yöntem</h2>

<h3>6.1 Sistematik Literatür Taraması (SLR)</h3>
<p>Kitchenham [5] yönergeleri izlenecektir. Veritabanları: ACM DL, IEEE Xplore, USENIX, arXiv. Anahtar kelimeler: <i>Tor security, FSM testing, model-driven testing, protocol state fuzzing, anonymity network attacks</i>. Yıl aralığı 2010–2026. Hariç tutma kriterleri belirlenmiş; PRISMA akış diyagramı sunulacaktır.</p>

<h3>6.2 Formal Modelleme</h3>
<p>Tor devre protokolü 5-tuple olarak modellenecektir:</p>
<div class="formula"><b>M = (Q, Σ, δ, q₀, F)</b></div>
<ul>
  <li><b>Q</b> = {IDLE, CONNECTING, TLS_HANDSHAKE, CREATE_SENT, CIRCUIT_BUILDING, CIRCUIT_READY, TRANSMITTING, CLOSING, CLOSED, ERROR}</li>
  <li><b>Σ</b> = {connect, tls_complete, create_received, extend, extended, data_send, data_recv, destroy, timeout}</li>
  <li><b>δ : Q × Σ → Q</b> — yalnızca <i>geçerli</i> geçişleri tanımlar; bkz. Ek A.</li>
  <li><b>q₀</b> = IDLE</li>
  <li><b>F</b> = {CLOSED, ERROR}</li>
</ul>
<p>Geçersiz geçiş kümesi şöyle tanımlanır: <span class="mono">Invalid = (Q × Σ) ∖ dom(δ)</span>. Bu küme üzerinden saldırı vektörü eşlemesi Ek B'de verilmiştir.</p>

<h3>6.3 Model-Driven Testing (MDT)</h3>
<p>Test senaryoları FSM modelinin kendisinden iki sınıfta üretilecektir:</p>
<ul>
  <li><b>Pozitif test üretimi:</b> δ üzerinde yapılan derinlik-öncelikli arama ile tüm geçerli (state, event) çiftlerini en az bir kez tetikleyen senaryolar üretilir. Hedef: <i>full transition coverage</i>.</li>
  <li><b>Negatif test üretimi:</b> Invalid kümesindeki her (state, event) çifti için, sistemin söz konusu durumda bu olayı tetiklemesini sağlayan minimum-uzunlukta bir öncül senaryo (witness) sentezlenir. Hedef: tespit mekanizmasının her geçersiz geçişe en az bir kez maruz kalması.</li>
</ul>
<p>Senaryo üretimi için referans: Lee &amp; Yannakakis [6] FSM tabanlı test üretim algoritmaları.</p>

<h3>6.4 İmplementasyon ve Simülasyon Ortamı</h3>
<p>Sistem, TypeScript tabanlı bir tam-yığın (full-stack) uygulama olarak gerçekleştirilecektir. Backend, FSM yorumlayıcı ve test çalıştırıcıyı içerir; frontend, etkileşimli analiz panelini sunar. Veriler PostgreSQL üzerinde tutulur. Simülasyon, sentetik olay üreticileri tarafından beslenir ve her test koşumu için (i) geçiş geçmişi (ii) tespit edilen ihlaller kaydedilir. Açık kaynak Tor ağ simülatörü Shadow [1] gelecek bir doğrulama adımında referans olarak kullanılabilir.</p>

<h3>6.5 Güvenlik Analizi</h3>
<p>Tespit edilen her geçersiz geçiş, Ek B'deki eşleme tablosuna göre yedi saldırı vektöründen birine atanır ve bir <i>severity</i> (LOW / MEDIUM / HIGH / CRITICAL) etiketi alır. Şiddet ataması, vektörün anonimliğe etkisi (deanonymization potansiyeli) ile devre kullanılabilirliğine etkisi (DoS potansiyeli) iki boyutlu bir matriste değerlendirilerek yapılır.</p>

<h2>7. Değerlendirme Metrikleri ve Karşılaştırma Temelleri</h2>

<h4>7.1 Birincil metrikler</h4>
<table>
  <tr><th>Metrik</th><th>Tanım</th><th>Hedef</th></tr>
  <tr><td>State Coverage (SC)</td><td>|ziyaret edilen Q| / |Q|</td><td>≥ 0.95</td></tr>
  <tr><td>Transition Coverage (TC)</td><td>|test edilen δ çiftleri| / |dom(δ)|</td><td>≥ 0.90</td></tr>
  <tr><td>Invalid Transition Detection Rate (ITDR)</td><td>|tespit edilen geçersiz| / |enjekte edilen geçersiz|</td><td>≥ 0.95</td></tr>
  <tr><td>False Positive Rate (FPR) <span class="new-tag">YENİ</span></td><td>|geçerli olup ihlal işaretlenen| / |toplam geçerli geçiş|</td><td>≤ 0.02</td></tr>
  <tr><td>Tespit Gecikmesi (Detection Latency)</td><td>İhlalin gerçekleşmesi ile loglanması arası ortalama süre</td><td>&lt; 50 ms</td></tr>
</table>

<h4>7.2 Karşılaştırma Temelleri (Baseline) <span class="new-tag">YENİ</span></h4>
<ul>
  <li><b>B1 — Kural tabanlı denetim:</b> Elle yazılmış 7 imza kuralı (her saldırı vektörü için bir kural). MDT yaklaşımının üretkenliği bu temel ile karşılaştırılır.</li>
  <li><b>B2 — Rastgele test üretimi:</b> Eşit sayıda olayın rastgele üretilmesiyle elde edilen TC ve ITDR değerleri. MDT'nin yapılı üstünlüğünü ölçer.</li>
  <li><b>B3 — Tor'un kendi unit test havuzu:</b> Tor kaynak kodunda bulunan resmi test vakaları (testing/circuit_test.c vb.) ile yapılan transition coverage karşılaştırması.</li>
</ul>

<h4>7.3 Deneysel Tasarım</h4>
<p>Her deney 30 bağımsız tekrar ile yürütülecek; metrikler ortalama ± standart sapma olarak raporlanacaktır. Anlamlılık testleri için Wilcoxon signed-rank uygulanacaktır (p &lt; 0.05).</p>

<div class="pagebreak"></div>

<h2>8. Ground Truth (Doğrulama Verisi) Stratejisi <span class="new-tag">YENİ</span></h2>
<p>Sentetik simülasyona dayanan herhangi bir tespit sisteminde "tespit edilen ihlaller gerçek bir saldırının imzası mı yoksa simülatörün ürettiği yapay bir olay mı?" sorusu kritik bir geçerlilik (validity) tehdididir. Bu çalışmada üç katmanlı bir doğrulama stratejisi izlenecektir:</p>

<ol>
  <li><b>Katman 1 — Kontrollü enjeksiyon (oracle ground truth):</b> Negatif test senaryoları, hangi (state, event, expected_attack_vector) üçlüsünün enjekte edildiğini bilen bir oracle tarafından üretildiği için tespit doğruluğu birebir hesaplanabilir. ITDR ve FPR yalnızca bu katmanda anlamlıdır.</li>
  <li><b>Katman 2 — CVE/PoC tabanlı doğrulama:</b> Geçmişte raporlanmış ve kamuya açık olan Tor zafiyetlerine ait Proof-of-Concept'ler (örn. CVE-2022-33903 ile ilgili relay-side tutarsızlıklar) sistemde yeniden çalıştırılır; sistemin söz konusu PoC'ları tespit edip etmediği denetlenir.</li>
  <li><b>Katman 3 — Shadow simülatörü ile çapraz doğrulama:</b> Açık kaynak Tor ağ simülatörü Shadow [1] üzerinde küçük ölçekli bir Tor topolojisi (örn. 10 relay, 50 istemci) kurulur ve normal trafik akışından elde edilen geçiş geçmişi, geliştirilen sistemin <i>false positive</i> oranını gerçekçi koşullarda ölçmek için kullanılır.</li>
</ol>

<p>Bu üç katman birlikte: tespit doğruluğunun (Katman 1), pratik geçerliliğin (Katman 2) ve gürültü dayanıklılığının (Katman 3) kanıtını sağlar.</p>

<h2>9. Çalışma Planı ve Risk Kayıt Defteri</h2>

<h4>9.1 12 Haftalık Plan</h4>
<table>
  <tr><th>Hafta</th><th>Görev</th><th>Çıktı</th></tr>
  <tr><td>1–2</td><td>SLR (PRISMA), Tor protokol dokümantasyonu (tor-spec.txt) analizi, saldırı vektörü taraması</td><td>Literatür taraması raporu</td></tr>
  <tr><td>3–4</td><td>FSM δ tablosunun formal tanımı, Invalid kümesinin türetilmesi, saldırı eşleme tablosunun ilk sürümü</td><td>Ek A, Ek B v0.1</td></tr>
  <tr><td>5–6</td><td>MDT motoru: pozitif + negatif test üreticileri, oracle altyapısı</td><td>Test üretici modülü (kod)</td></tr>
  <tr><td>7–8</td><td>Simülatör + dashboard implementasyonu, test koşumlarının veritabanına yazımı</td><td>Çalışan prototip</td></tr>
  <tr><td>9–10</td><td>Üç katmanlı değerlendirme (Bölüm 8), baseline karşılaştırmaları, istatistiksel testler</td><td>Sonuç tabloları</td></tr>
  <tr><td>11–12</td><td>Makale yazımı, görselleştirme, savunma sunumunun hazırlığı</td><td>Tez metni + sunum</td></tr>
</table>

<h4>9.2 Risk Kayıt Defteri <span class="new-tag">YENİ</span></h4>
<table>
  <tr><th>Risk</th><th>Olasılık</th><th>Etki</th><th>Azaltma</th></tr>
  <tr><td>Tor spesifikasyonunun belirsizliği — δ tanımının literatürle çatışması</td><td>Orta</td><td>Yüksek</td><td>Tor proje topluluğunun resmi spesifikasyon dokümanları (torspec git repo) referans alınacak; uyumsuzluklar tez metninde açıkça belgelenecek.</td></tr>
  <tr><td>Negatif test üretiminin patlaması — kombinatoryel patlama</td><td>Yüksek</td><td>Orta</td><td>Witness sentezi minimum-uzunluk öncüllüklü; öncelik sıralaması saldırı vektörü ciddiyetine göre.</td></tr>
  <tr><td>Shadow simülatörünün kurulum karmaşıklığı (Katman 3)</td><td>Orta</td><td>Düşük</td><td>Katman 3 zorunlu değil; Katman 1 ve 2 tek başına tezi savunulabilir kılar.</td></tr>
  <tr><td>Zaman aşımı (12 hafta yetersizliği)</td><td>Orta</td><td>Yüksek</td><td>Stream FSM'i ve hidden service kapsamı baştan dışarıda bırakıldı. Hafta 9 sonunda durum değerlendirmesi yapılacak.</td></tr>
</table>

<h2>10. Beklenen Çıktılar</h2>
<ul>
  <li>Tor devresine özgü, 10 durumlu kapsamlı bir FSM modeli (formal tanım + δ tablosu).</li>
  <li>Geçersiz geçiş ↔ saldırı vektörü eşleme tablosu ve şiddet sınıflandırması (Ek B).</li>
  <li>Açık kaynak (MIT lisansı) bir simülasyon, tespit ve görselleştirme aracı.</li>
  <li>Üç katmanlı değerlendirme metodolojisi ve sonuçları içeren bir tez metni.</li>
  <li>SCI/SCI-E indeksli bir konferansa veya dergiye gönderilmek üzere bir makale taslağı.</li>
</ul>

<div class="pagebreak"></div>

<h2>Ek A. FSM δ Geçiş Tablosu (Geçerli Geçişler)</h2>
<table>
  <tr><th>Mevcut Durum</th><th>Olay (event)</th><th>Sonraki Durum</th></tr>
  <tr><td>IDLE</td><td>connect</td><td>CONNECTING</td></tr>
  <tr><td>CONNECTING</td><td>tls_complete</td><td>TLS_HANDSHAKE</td></tr>
  <tr><td>CONNECTING</td><td>timeout</td><td>ERROR</td></tr>
  <tr><td>TLS_HANDSHAKE</td><td>create_received</td><td>CREATE_SENT</td></tr>
  <tr><td>TLS_HANDSHAKE</td><td>timeout</td><td>ERROR</td></tr>
  <tr><td>CREATE_SENT</td><td>extend</td><td>CIRCUIT_BUILDING</td></tr>
  <tr><td>CIRCUIT_BUILDING</td><td>extended</td><td>CIRCUIT_READY</td></tr>
  <tr><td>CIRCUIT_BUILDING</td><td>timeout</td><td>ERROR</td></tr>
  <tr><td>CIRCUIT_READY</td><td>data_send</td><td>TRANSMITTING</td></tr>
  <tr><td>CIRCUIT_READY</td><td>destroy</td><td>CLOSING</td></tr>
  <tr><td>TRANSMITTING</td><td>data_send</td><td>TRANSMITTING</td></tr>
  <tr><td>TRANSMITTING</td><td>data_recv</td><td>TRANSMITTING</td></tr>
  <tr><td>TRANSMITTING</td><td>destroy</td><td>CLOSING</td></tr>
  <tr><td>CLOSING</td><td>tls_complete</td><td>CLOSED</td></tr>
  <tr><td>CLOSING</td><td>timeout</td><td>CLOSED</td></tr>
</table>
<p class="small">Bu tabloda yer almayan tüm (Q × Σ) çiftleri <i>Invalid</i> kümesini oluşturur. Toplam |Q| × |Σ| = 10 × 9 = 90 olası çiftten yukarıdaki 15 çift geçerlidir; geri kalan 75 çift potansiyel olarak Invalid'dir. Bu 75 çift Ek B'de saldırı vektörlerine eşlenmektedir.</p>

<h2>Ek B. Geçersiz Geçiş ↔ Saldırı Vektörü Eşleme Tablosu</h2>
<table>
  <tr><th>Geçersiz Geçiş Örneği</th><th>Saldırı Vektörü</th><th>Severity</th><th>Açıklama</th></tr>
  <tr><td>IDLE — data_send → *</td><td>Premature Data</td><td>HIGH</td><td>Devre kurulmadan veri gönderme girişimi.</td></tr>
  <tr><td>CONNECTING — data_send → *</td><td>Premature Data</td><td>HIGH</td><td>TLS tamamlanmadan veri akışı.</td></tr>
  <tr><td>IDLE → TRANSMITTING (zincirsiz)</td><td>Circuit Bypass</td><td>CRITICAL</td><td>Tüm el-sıkışma adımlarının atlanması.</td></tr>
  <tr><td>CONNECTING → CIRCUIT_READY</td><td>Circuit Bypass</td><td>CRITICAL</td><td>Aradaki TLS + CREATE + EXTEND atlanmış.</td></tr>
  <tr><td>TLS_HANDSHAKE → CREATE_SENT (tls_complete olmadan)</td><td>Handshake Skip</td><td>HIGH</td><td>El-sıkışma tamamlanmadan ilerleme.</td></tr>
  <tr><td>CIRCUIT_READY → CIRCUIT_BUILDING</td><td>Replay Attack</td><td>HIGH</td><td>Önceki bir extended hücresinin tekrar oynatılması.</td></tr>
  <tr><td>TRANSMITTING → CREATE_SENT</td><td>Replay Attack</td><td>HIGH</td><td>Eski create paketinin yeniden oynatılması.</td></tr>
  <tr><td>(geçersiz circuit_id) — herhangi bir olay</td><td>Ghost Circuit</td><td>MEDIUM</td><td>Sistemde kayıtlı olmayan circuit'e ait olay.</td></tr>
  <tr><td>CLOSED → TRANSMITTING</td><td>Circuit Hijack</td><td>CRITICAL</td><td>Kapatılmış devrenin yeniden veri taşımaya zorlanması.</td></tr>
  <tr><td>CLOSED → CIRCUIT_READY</td><td>Circuit Hijack</td><td>CRITICAL</td><td>Kapatılmış devrenin yeniden ayağa kaldırılması.</td></tr>
  <tr><td>IDLE — create_received (×N)</td><td>Create Flood</td><td>MEDIUM→HIGH</td><td>Aynı kaynaktan kısa sürede çok sayıda create. N artarsa HIGH'a yükselir.</td></tr>
  <tr><td>ERROR → herhangi bir aktif durum</td><td>Circuit Hijack / Ghost</td><td>CRITICAL</td><td>Hata durumundan çıkışın yalnızca yeniden başlatma ile mümkün olması gerekir.</td></tr>
</table>
<p class="small">Tablo örnek niteliğindedir; tam liste (75 çift) tezin Ek B'sinde verilecektir.</p>

<div class="pagebreak"></div>

<h2>Kaynakça</h2>
<ol class="ref">
  <li>R. Jansen, K. Bauer, N. Hopper, R. Dingledine. "Methodically Modeling the Tor Network." <i>USENIX CSET</i>, 2012.</li>
  <li>R. Dingledine, N. Mathewson, P. Syverson. "Tor: The Second-Generation Onion Router." <i>USENIX Security Symposium</i>, 2004.</li>
  <li>M. Felderer, M. Büchler, M. Johns, A. Brucker, R. Breu, A. Pretschner. "Security Testing: A Survey." <i>Advances in Computers</i>, vol. 101, pp. 1–51, 2016.</li>
  <li>A. Johnson, C. Wacek, R. Jansen, M. Sherr, P. Syverson. "Users Get Routed: Traffic Correlation on Tor by Realistic Adversaries." <i>ACM CCS</i>, 2013.</li>
  <li>B. Kitchenham, S. Charters. "Guidelines for performing Systematic Literature Reviews in Software Engineering." <i>EBSE Technical Report EBSE-2007-01</i>, 2007.</li>
  <li>D. Lee, M. Yannakakis. "Principles and Methods of Testing Finite State Machines—A Survey." <i>Proceedings of the IEEE</i>, vol. 84, no. 8, pp. 1090–1123, 1996.</li>
  <li>A. Panchenko, F. Lanze, A. Zinnen, M. Henze, J. Pennekamp, K. Wehrle, T. Engel. "Website Fingerprinting at Internet Scale." <i>NDSS</i>, 2016.</li>
  <li>J. Somorovsky. "Systematic Fuzzing and Testing of TLS Libraries." <i>ACM CCS</i>, 2016.</li>
  <li>K. Bhargavan, B. Blanchet, N. Kobeissi. "Verified Models and Reference Implementations for the TLS 1.3 Standard Candidate." <i>IEEE S&amp;P</i>, 2017.</li>
  <li>D. Dolev, A. C. Yao. "On the Security of Public Key Protocols." <i>IEEE Transactions on Information Theory</i>, vol. 29, no. 2, pp. 198–208, 1983.</li>
  <li>S. J. Murdoch, G. Danezis. "Low-Cost Traffic Analysis of Tor." <i>IEEE S&amp;P</i>, 2005.</li>
  <li>I. Karunanayake, N. Ahmed, R. Malaney, R. Islam, S. K. Jha. "De-Anonymisation Attacks on Tor: A Survey." <i>IEEE Communications Surveys &amp; Tutorials</i>, vol. 23, no. 4, pp. 2324–2350, 2021.</li>
  <li>P. Ammann, J. Offutt. <i>Introduction to Software Testing</i>, 2nd ed. Cambridge University Press, 2016.</li>
  <li>J. Tretmans. "Model Based Testing with Labelled Transition Systems." <i>Formal Methods and Testing</i>, LNCS 4949, pp. 1–38, 2008.</li>
  <li>A. Pretschner, T. Mouelhi, Y. Le Traon. "Model-Based Tests for Access Control Policies." <i>ICST</i>, 2008.</li>
  <li>J. de Ruiter, E. Poll. "Protocol State Fuzzing of TLS Implementations." <i>USENIX Security</i>, 2015.</li>
  <li>P. Fiterău-Broștean, R. Janssen, F. Vaandrager. "Combining Model Learning and Model Checking to Analyze TCP Implementations." <i>CAV</i>, 2016.</li>
  <li>M. Backes, A. Kate, P. Manoharan, S. Meiser, E. Mohammadi. "AnoA: A Framework for Analyzing Anonymous Communication Protocols." <i>IEEE CSF</i>, 2013.</li>
  <li>"Tor Protocol Specification (tor-spec)." Tor Project. https://spec.torproject.org/tor-spec, son erişim: Şubat 2026.</li>
  <li>R. Dingledine. "Tor Bug Tracker: Circuit Lifecycle States." Tor GitLab Issue Tracker. son erişim: Şubat 2026.</li>
</ol>

<div class="signoff">
Ad Soyad: <b>Nurcan Denli Bayır</b><br>
Öğrenci No: N25110987<br>
Bölüm: Yazılım Mühendisliği YL — 1. Sınıf / Bahar Dönemi<br>
Üniversite: Hacettepe Üniversitesi<br>
Ders: BYZ 658 / Yazılım Test Teknikleri<br>
Danışman: Nebi Yılmaz<br>
Teslim Tarihi: 09.03.2026<br>
E-posta: nurcandenli25@hacettepe.edu.tr / drnurcandenlibayir@gmail.com
</div>

</body></html>`;

async function main() {
  const htmlPath = path.join(__dirname, "proposal.html");
  await fs.writeFile(htmlPath, html, "utf8");
  console.log("[1/2] HTML yazıldı.");

  const browser = await puppeteer.launch({
    executablePath: findChromium(),
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.goto("file://" + htmlPath, { waitUntil: "networkidle0" });
  const outPdf = path.join(__dirname, "Proje_Onerisi_Revize.pdf");
  await page.pdf({
    path: outPdf,
    format: "A4",
    printBackground: true,
    margin: { top: "22mm", right: "20mm", bottom: "22mm", left: "22mm" },
    displayHeaderFooter: true,
    headerTemplate: `<div style="font-size:8pt; color:#888; width:100%; text-align:center;">Tor FSM Invalid Transition Detection — Proje Önerisi (Revize) — N. Denli Bayır</div>`,
    footerTemplate: `<div style="font-size:8pt; color:#888; width:100%; text-align:center;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
  });
  await browser.close();
  console.log("[2/2] PDF yazıldı:", outPdf);
}

main().catch((e) => { console.error(e); process.exit(1); });
