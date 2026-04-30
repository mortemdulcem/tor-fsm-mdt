// Academic Turkish content for the OOP midterm answer document.
// Style: serif (EB Garamond), monochrome paper, textbook layout.

export function buildHtml({ diagram1Path, diagram2Path, sekans1aPath, sekans1bPath, sekans2Path }) {
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8"/>
<title>Ara Sınav Cevap Belgesi</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
${css()}
</style>
</head>
<body>

<!-- ====================== COVER ====================== -->
<section class="cover">
  <div class="cover-frame">
    <div class="cover-mark">
      <span class="cover-mark-line">Hacettepe Üniversitesi</span>
      <span class="cover-mark-line">Yazılım Mühendisliği Yüksek Lisansı</span>
    </div>

    <h1 class="cover-title">Nesneye Yönelik<br/>Yazılım Geliştirme</h1>
    <p class="cover-subtitle">Ara Sınav &middot; Cevap Belgesi</p>

    <div class="cover-rule"></div>

    <div class="cover-author">
      <p class="cover-author-name">Nurcan Denli Bayır</p>
      <p class="cover-author-line">Öğrenci No: N25110987</p>
      <p class="cover-author-line">nurcandenli25@hacettepe.edu.tr</p>
    </div>

    <div class="cover-rule"></div>

    <table class="cover-meta">
      <tr><td>Dönem</td><td>2025-2026 Bahar</td></tr>
      <tr><td>Teslim Tarihi</td><td>30 Nisan 2026</td></tr>
    </table>

    <div class="cover-rule"></div>

    <p class="cover-abstract">
      <span class="dropcap">B</span>u belge, sınavda istenen iki senaryo için nesneye yönelik tasarım çözümlerini
      sunar. Her soru için (i) senaryo çözümlemesi, (ii) tasarım örüntüsü seçimleri ile <em>reddedilmiş
      alternatiflerin gerekçeleri</em>, (iii) UML 2.x sınıf diyagramı, (iv) bir veya iki sıra (sequence)
      diyagramı ve (v) tipik çalışma akışları yer almaktadır.
      Diyagramlar, bağlılık (coupling) ve uyum (cohesion) ölçütleri ile <em>okunaklılık</em> dengesi
      gözetilerek elle dizayn edilmiş; otomatik olarak yerleştirilmemiştir.
    </p>

    <div class="cover-toc">
      <div class="toc-title">İçindekiler</div>
      <ol>
        <li><span>Soru 1 &middot; Akıllı Ev Yönetim Sistemi</span><span class="dots"></span><span>State + Mediator + Observer</span></li>
        <li><span>Soru 2 &middot; SimpleCar E-Satış Sistemi</span><span class="dots"></span><span>Strategy + CoR + Command</span></li>
      </ol>
    </div>
  </div>
</section>

<!-- ====================== SORU 1 ====================== -->
<section class="page question-page">
  <header class="q-header">
    <span class="q-tag">Soru 1 &middot; 50 Puan</span>
    <h1>Akıllı Ev Yönetim Sistemi</h1>
    <p class="q-sub">State, Mediator ve Observer Örüntülerinin Birlikte Kullanımı</p>
  </header>

  <h2>1.1 Senaryonun Çözümlenmesi</h2>
  <p>
  Senaryo, dört tip bileşen tanımlar: iki <em>aktif sistem</em> (aydınlatma, ısıtma), iki <em>pasif ölçüm
  kaynağı</em> (kapı sensörü, hareket sensörü) ve bir <em>orta kontrol noktası</em> (akıllı ev izleme motoru).
  Bileşenler arasındaki etkileşimleri dört temel olguya indirgeyebiliriz:
  </p>
  <ol class="num-list">
    <li><b>Davranışsal çoğulluk.</b> Aydınlatma ve ısıtma sistemleri, iç durumlarına &mdash; yani aktif <em>moda</em>
      &mdash; göre <em>farklı davranır</em>. Tasarruflu modda ısıtma 18&deg;C, aydınlatma asgari seviye hedefler;
      güvenli modda ise sırasıyla 40&deg;C panel sıcaklığı ve maksimum aydınlatma uygulanır. Bu davranışsal
      çoğulluğu <code>if/switch</code> ile çözmek, her yeni mod eklendiğinde mevcut sınıfı değiştirmeyi gerektirir.
      Polimorfizm üzerinden taşınması <em>açık-kapalı</em> prensibinin (OCP) doğal sonucudur.</li>
    <li><b>Koşullu senkronizasyon.</b> İki sistemin modu <em>bağlantılıdır</em>: bir sistemde tasarruflu mod
      seçilirse diğeri de zorunlu olarak geçer. Bu kural sistemler arasında <em>doğrudan</em> uygulanırsa, her
      sistem diğerini referans alır; <em>n &times; (n-1)</em> bağlantısı ortaya çıkar. Senaryoda iki sistem var,
      ancak ileride yeni bir sistem (örn. sulama) eklendiğinde doğrudan referans yapısı kırılgan hale gelir.</li>
    <li><b>Olay yayını, alıcı farkındalığı olmadan.</b> Sensörler, ölçümlerini iletmeli; ama <em>kime</em>
      ilettiklerini <em>bilmek zorunda olmamalı</em>. Sensörün motora doğrudan referansı olması, sensörü izleme
      altyapısına bağlar &mdash; sensörü başka bir bağlamda (örn. test, ayrı bir konsol) kullanmayı imkânsızlaştırır.</li>
    <li><b>Çoğul bildirim hedefi.</b> Bir kullanıcının <em>birden fazla</em> istemcisi olabilir (mobil ve web).
      Motor, "kullanıcıya bildirim gönder" eylemini somut bir istemci tipine bağlarsa, yeni bir kanal
      (e-posta, SMS, sesli asistan) eklendiğinde motor değişir. Burada da <em>yayıncı-abone</em> ayrışması
      kaçınılmazdır.</li>
  </ol>

  <h2>1.2 Örüntü Seçimleri ve Gerekçeleri</h2>
  <p>Yukarıdaki dört olgu, GoF kataloğundaki üç <em>davranışsal</em> örüntü ile noktasal olarak eşleşir:</p>
  <table class="design-table">
    <thead><tr><th>Örüntü</th><th>Uygulanan Yer</th><th>Çözdüğü Olgu</th></tr></thead>
    <tbody>
      <tr>
        <td><b>State</b><br/><span class="ref">GoF, s.305</span></td>
        <td><code>CalismaModu</code> arayüzü; <code>GuvenliMod</code> ve <code>TasarrufluMod</code>; <code>EvSistemi</code>
            &laquo;bağlam&raquo; rolünde, <code>aktifMod</code> alanını tutar.</td>
        <td>(1) Davranışsal çoğulluk: <code>komutCalistir</code> çağırıldığında davranış aktif moda göre polimorfik
            seçilir. Yeni bir mod eklemek <code>EvSistemi</code>'ni değiştirmez.</td>
      </tr>
      <tr>
        <td><b>Mediator</b><br/><span class="ref">GoF, s.273</span></td>
        <td><code>AkilliEvIzlemeMotoru</code>; tüm <code>EvSistemi</code> ve <code>Sensor</code> nesnelerini tanır,
            sistemleri birbirine bağlamadan koordine eder.</td>
        <td>(2) Koşullu senkronizasyon: "tüm sistemler aynı moda geçsin" gibi çok-yönlü kurallar arabulucuda
            <em>tek bir noktada</em> uygulanır; sistemler arası referans gerekmez.</td>
      </tr>
      <tr>
        <td><b>Observer</b><br/><span class="ref">GoF, s.293</span></td>
        <td>(a) <code>Sensor</code> &#x2194; <code>SensorGozlemcisi</code> arayüzü (motor abonedir).<br/>
            (b) <code>AkilliEvIzlemeMotoru</code> &#x2194; <code>KullaniciBildirimAlici</code> arayüzü
                (mobil/web abonedir).</td>
        <td>(3) Olay yayını ve (4) çoğul bildirim hedefi: hem sensör hem motor, abone tipinden bağımsız olarak
            yayın yapar. Yeni kanal/abone eklemek mevcut yayıncıyı değiştirmez.</td>
      </tr>
    </tbody>
  </table>

  <h2>1.3 Reddedilen Alternatifler</h2>
  <table class="design-table">
    <thead><tr><th>Alternatif</th><th>Neden Tercih Edilmedi?</th></tr></thead>
    <tbody>
      <tr>
        <td><b>Singleton</b> &mdash; <code>AkilliEvIzlemeMotoru</code>'nu tekil yapmak.</td>
        <td>Senaryo "bir akıllı ev"den bahsediyor; ancak <em>test edilebilirlik</em> ve <em>gelecek çok-evli</em>
          (apartman, site) senaryosu için tekillik bağımlılığı maliyetli. Tekillik bir <em>üretim/yaratım</em>
          kararı; mevcut tasarım <em>davranışsal</em> sorunları çözer.</td>
      </tr>
      <tr>
        <td><b>Strategy</b> &mdash; modları <code>CalismaStratejisi</code> olarak taşımak.</td>
        <td>Strategy, davranışı <em>dışarıdan</em> seçilen bir algoritma olarak modeller; biz içine ait <em>durumu</em>
          modelliyoruz. Özellikle "iki sistemin modu birlikte değişir" kuralı, sistemden ayrı bir strateji nesnesini
          gerektirmez. State daha doğru kavramsal eşleşmedir.</td>
      </tr>
      <tr>
        <td><b>Pub/Sub mesaj kuyruğu</b> &mdash; sensör olayları için.</td>
        <td>Senaryo bunu istemez; ek altyapı maliyeti getirir. Observer, <em>aynı süreç içinde</em> ihtiyaç
          duyulan ayrışmayı sade biçimde sağlar.</td>
      </tr>
      <tr>
        <td><b>Visitor</b> &mdash; mod değişikliğinde sistemleri dolaşmak için.</td>
        <td>Visitor, <em>sabit nesne hiyerarşisi üzerinde değişken işlemler</em> için uygundur. Burada işlem (mod
          değiştirme) sabit, hiyerarşi (sistemler) genişleyebilir; tam ters yön. Mediator + State daha uygun.</td>
      </tr>
    </tbody>
  </table>

  <div class="callout">
    <b>Mimari kanaat.</b> &nbsp; State davranışı, Mediator koordinasyonu, Observer ise bilgi yayınını bağımsız
    eksenler olarak ayırır. Üç örüntü birbirinin <em>kaldıracı</em>: birini çıkartmak diğer ikisinin yükünü
    artırır ve kodun açılan/kapanan dengesini bozar.
  </div>

  

</section>
<section class="diagram-page-landscape">
  <h2>1.4 Sınıf Diyagramı</h2>
  <figure class="diagram-figure">
    <img src="${diagram1Path}" alt="Soru 1 sınıf diyagramı"/>
    <figcaption>Şekil 1.1 &middot; Akıllı Ev Yönetim Sistemi &mdash; UML 2.x sınıf diyagramı.
      Sol katman: kullanıcı ve görüntüleme; orta katman: arabulucu motor ve gözlemci arayüzleri; alt katman:
      sistem ve sensör hiyerarşileri.</figcaption>
  </figure>
</section>
<section class="page question-page">

  

  <h2>1.5 Sınıf Açıklamaları</h2>
  <table class="class-table">
    <thead><tr><th>Sınıf / Arayüz</th><th>Stereotip</th><th>Sorumluluk &amp; Roller</th></tr></thead>
    <tbody>
      <tr><td><code>Kullanici</code></td><td>&laquo;entity&raquo;</td>
          <td>Ev sahibinin kimliği; bir veya birden fazla bildirim alıcıya (mobil/web) sahip olabilir.</td></tr>
      <tr><td><code>KullaniciBildirimAlici</code></td><td>&laquo;interface&raquo;</td>
          <td>Observer arayüzü (kanal-bağımsız). <code>bildirimGoster(olay)</code> ve <code>durumYansit(ozet)</code>.</td></tr>
      <tr><td><code>MobilUygulama</code> &middot; <code>WebUygulamasi</code></td><td>&laquo;concrete&raquo;</td>
          <td>Somut gözlemci; kanal-özel görüntüleme yapar. Kullanıcı komutlarını motora iletir.</td></tr>
      <tr><td><code>DurumOzeti</code></td><td>&laquo;value object&raquo;</td>
          <td>Anlık durum fotoğrafı; değişmez (immutable). Motor üretir, alıcılar tüketir.</td></tr>
      <tr><td><code>AkilliEvIzlemeMotoru</code></td><td>&laquo;mediator&raquo; + &laquo;observer&raquo;</td>
          <td>Tüm sistem ve sensörleri tanır. Sensör olaylarında gözlemci, kullanıcı için yayıncı. Mod
            senkronizasyonu, komut yönlendirme ve durum yayını.</td></tr>
      <tr><td><code>EvSistemi</code></td><td>&laquo;abstract&raquo;</td>
          <td>State için <em>bağlam</em>; <code>aktifMod</code> alanı üzerinden davranışını polimorfik seçer.
            <code>komutCalistir</code> alt sınıflara bırakılır.</td></tr>
      <tr><td><code>AydinlatmaSistemi</code> &middot; <code>IsitmaSistemi</code></td><td>&laquo;concrete&raquo;</td>
          <td>Cihaz-özel davranışı (asgari/maksimum aydınlatma; hedef sıcaklık) uygular.</td></tr>
      <tr><td><code>CalismaModu</code></td><td>&laquo;interface&raquo;</td>
          <td>State arayüzü; <code>uygula(sistem)</code> ile bağlamı yapılandırır.</td></tr>
      <tr><td><code>GuvenliMod</code> &middot; <code>TasarrufluMod</code></td><td>&laquo;concrete&raquo;</td>
          <td>İki politik davranış: maksimum kapasite ile asgari/hedef ayar.</td></tr>
      <tr><td><code>ModTipi</code></td><td>&laquo;enumeration&raquo;</td>
          <td>Kullanıcı arayüzünden gelen mod tercihi için tip-güvenli sabitler.</td></tr>
      <tr><td><code>Sensor</code></td><td>&laquo;abstract&raquo;</td>
          <td>Özne (subject) rolü: <code>attach</code>/<code>detach</code> ve <code>bildir</code> ortak metotları.</td></tr>
      <tr><td><code>KapiSensoru</code> &middot; <code>HareketSensoru</code></td><td>&laquo;concrete&raquo;</td>
          <td>Donanıma özgü ölçüm metotları (<code>olcumGonder</code>); olay tetiklerler.</td></tr>
      <tr><td><code>SensorGozlemcisi</code></td><td>&laquo;interface&raquo;</td>
          <td>Sensör olaylarını alacak nesneler için Observer arayüzü (motor uygular).</td></tr>
      <tr><td><code>SensorOlayi</code></td><td>&laquo;value object&raquo;</td>
          <td>Tip, kaynak sensör, veri ve zaman taşıyan değişmez olay nesnesi.</td></tr>
      <tr><td><code>SensorTipi</code></td><td>&laquo;enumeration&raquo;</td>
          <td>KAPI / HAREKET; mantık kontrolü ve kayıt için.</td></tr>
    </tbody>
  </table>

  <h2>1.6 İlişki Tipleri (UML Notasyonu)</h2>
  <ul class="bullet-list">
    <li><em>Composition.</em> <code>AkilliEvIzlemeMotoru &#x25C6;&mdash; EvSistemi (1..*)</code> ve
        <code>AkilliEvIzlemeMotoru &#x25C6;&mdash; Sensor (1..*)</code>: motor olmadan sistem/sensör anlamlı
        değildir &mdash; yaşam döngülerini motor sahiplenir.</li>
    <li><em>Aggregation.</em> <code>AkilliEvIzlemeMotoru &#x25C7;&mdash; KullaniciBildirimAlici (0..*)</code>:
        bildirim alıcıları motorun parçası değildir, dış dünyaya aittir; motor onları yalnızca tutar.</li>
    <li><em>Aggregation.</em> <code>EvSistemi &#x25C7;&mdash; CalismaModu</code> (aktif mod): mod
        nesnesi sistemin yaşam döngüsünden bağımsız oluşturulup atanır.</li>
    <li><em>Realization.</em> <code>MobilUygulama / WebUygulamasi &mdash;..&#x25B7; KullaniciBildirimAlici</code>;
        <code>GuvenliMod / TasarrufluMod &mdash;..&#x25B7; CalismaModu</code>;
        <code>AkilliEvIzlemeMotoru &mdash;..&#x25B7; SensorGozlemcisi</code>.</li>
    <li><em>Inheritance.</em> Sensor ve EvSistemi hiyerarşileri.</li>
    <li><em>Dependency.</em> <code>AkilliEvIzlemeMotoru &mdash;..&gt; DurumOzeti</code>
        (&laquo;creates&raquo;): motor durum özetini oluşturup yayınlar; alıcılar bunu yalnızca tüketir.</li>
  </ul>

  

  <div style="break-inside:avoid;">
  <h2>1.7 Sıra Diyagramları (Çalışma Akışları)</h2>
  <figure class="diagram-figure seq-fig">
    <img src="${sekans1aPath}" alt="Sekans 1 - sensör olayı"/>
    <figcaption>Şekil 1.2 &middot; Hareket sensörü tetiklendiğinde olay akışı.
      Sensör olayı gözlemci üzerinden motora iletilir; motor ilgili sistemleri
      uyarır, sonra DurumOzeti ile tüm bildirim alıcılarını eşleştirir.</figcaption>
  </figure>
  </div>

  <figure class="diagram-figure seq-fig">
    <img src="${sekans1bPath}" alt="Sekans 2 - mod değişikliği"/>
    <figcaption>Şekil 1.3 &middot; Kullanıcının tasarruflu mod talebi.
      Tek bir <code>tumModlariAyarla</code> çağrısı, mediator aracılığıyla tüm sistemleri ve istemcileri
      tutarlı biçimde günceller; sistemler birbirini referans almaz.</figcaption>
  </figure>

  

  <h2>1.8 Tasarımın Niteliksel Avantajları</h2>
  <ul class="bullet-list">
    <li><b>Açık-Kapalı (OCP).</b> Yeni mod (UykuModu), yeni sensör (Pencere), yeni bildirim kanalı (E-posta);
        her durumda <em>yalnızca yeni bir sınıf</em> eklenir, mevcut kod değişmez.</li>
    <li><b>Tek Sorumluluk (SRP).</b> Mod davranışı <code>CalismaModu</code> hiyerarşisinde; senkronizasyon
        politikası <code>AkilliEvIzlemeMotoru</code>'nda; olay taşıması <code>Sensor</code> +
        <code>SensorGozlemcisi</code> ikilisinde tutulmuştur.</li>
    <li><b>Düşük Bağlılık.</b> Sistemler birbirini, sensörler de motoru somut bir tip olarak bilmez.</li>
    <li><b>Test Edilebilirlik.</b> Stub gözlemci ve sahte modlar ile motor birim test seviyesinde doğrulanabilir.</li>
    <li><b>Liskov Uyumu.</b> Yeni mod, yeni sistem ve yeni sensör türleri üst sözleşmenin (<em>contract</em>)
        ihlali olmadan eklenir.</li>
  </ul>
</section>

<!-- ====================== SORU 2 ====================== -->
<section class="page question-page">
  <header class="q-header">
    <span class="q-tag">Soru 2 &middot; 50 Puan</span>
    <h1>SimpleCar E-Satış Sistemi</h1>
    <p class="q-sub">Strategy, Chain of Responsibility ve Command Örüntülerinin Birlikte Kullanımı</p>
  </header>

  <h2>2.1 Senaryonun Çözümlenmesi</h2>
  <p>
  SimpleCar firması yalnızca e-satış yapan bir araba üreticisidir. Domeni dört bileşene ayrılabilir:
  </p>
  <ol class="num-list">
    <li><b>Algoritma ailesi (ödeme).</b> Ödeme tek bir <em>davranıştır</em>, ancak <em>banka havalesi</em>,
      <em>paypal</em>, <em>soğuk cüzdan</em> gibi farklı yollarla yapılır; senaryo ayrıca bu listenin <em>sıklıkla
      genişleyip daralacağını</em> özellikle vurgular. Çalışma zamanında seçilebilen, bağımsız olarak
      değiştirilebilen bir <em>algoritma ailesi</em> gerekir.</li>
    <li><b>Aşamalı ve genişleyebilir kontrol.</b> Her sipariş <em>sahtecilik</em>, <em>limit</em> ve <em>bakiye</em>
      kontrollerine tabidir. Birinin olumsuzluğu siparişi iptal eder. Senaryo bu kontrollerin de zamanla
      <em>artırılabileceğini</em> belirtir. Bu, bir <em>filtre zinciri</em>: her halka kararını verir, başarılıysa
      sıradakine devreder; başarısızsa zinciri keser.</li>
    <li><b>Sıralı işleme adımları.</b> Tüm kontroller başarılıysa sipariş sırasıyla <em>fatura düzenleme</em>,
      <em>fatura gönderme</em> ve <em>alacaklara kaydetme</em> adımlarıyla işlenir. Adımlar ileride değişebilir;
      her biri test edilebilir bağımsız bir iş birimini temsil eder.</li>
    <li><b>Yönetim ve yaşam döngüsü.</b> Bir orchestrator (use-case) bileşen, siparişi <em>alır</em>,
      <em>doğrular</em> ve <em>işler</em>. Domain (Siparis) ile servis sorumlulukları ayrık tutulmalıdır.</li>
  </ol>

  <h2>2.2 Örüntü Seçimleri ve Gerekçeleri</h2>
  <table class="design-table">
    <thead><tr><th>Örüntü</th><th>Uygulanan Yer</th><th>Çözdüğü Olgu</th></tr></thead>
    <tbody>
      <tr>
        <td><b>Strategy</b><br/><span class="ref">GoF, s.315</span></td>
        <td><code>OdemeYontemi</code> arayüzü; <code>BankaHavalesi</code>, <code>Paypal</code>,
            <code>SogukCuzdan</code>; siparişle <em>1-1</em> birikim.</td>
        <td>(1) Algoritma ailesi: ödeme ailesi siparişten bağımsız olarak yer değiştirebilir; yeni yöntem eklemek
            mevcut kodu değiştirmez.</td>
      </tr>
      <tr>
        <td><b>Chain of Responsibility</b><br/><span class="ref">GoF, s.223</span></td>
        <td><code>SiparisKontrolu</code> soyut sınıfı; <code>Sahtecilik</code>, <code>Limit</code>,
            <code>Bakiye</code> halkaları; <code>setSonraki</code> ile kuruluyor.</td>
        <td>(2) Aşamalı kontrol: halka başarılıysa sıradakine devreder, başarısızsa zincir kesilir;
            yeni kontrol eklemek tek satır konfigürasyondur.</td>
      </tr>
      <tr>
        <td><b>Command + Macro Command</b><br/><span class="ref">GoF, s.233</span></td>
        <td><code>Komut</code> arayüzü; <code>FaturaDuzenle</code>, <code>FaturaGonder</code>,
            <code>AlacaklaraKaydet</code>; <code>SiparisIsleyici</code> sırayla çalıştırır.</td>
        <td>(3) Sıralı işleme adımları: her adım kapsüllenmiş; sıra değiştirme, ek adım, geri-alma (undo) gibi
            ihtiyaçlar için esnek altyapı.</td>
      </tr>
    </tbody>
  </table>

  <h2>2.3 Reddedilen Alternatifler</h2>
  <table class="design-table">
    <thead><tr><th>Alternatif</th><th>Neden Tercih Edilmedi?</th></tr></thead>
    <tbody>
      <tr>
        <td><b>Template Method</b> &mdash; sipariş işleme akışını soyut sınıfta şablon olarak kurmak.</td>
        <td>Şablon, <em>sıra sabit</em> ise iyidir; ancak senaryo "adım sayısı değişebilir" implikasyonunu taşır
          (yeni adımlar). Komut listesi, çalışma zamanında yeniden düzenlenebilir; şablon ise sınıfların
          yeniden yazılmasını gerektirir.</td>
      </tr>
      <tr>
        <td><b>Decorator</b> &mdash; kontrolleri sarmalayıcı olarak eklemek.</td>
        <td>Decorator, ana arayüze yeni davranış ekler; ancak burada kontroller <em>kararsal</em>: false dönerse
          akışı durdurur. Bu, "ekleme" değil "eleme" semantiği; CoR daha doğru.</td>
      </tr>
      <tr>
        <td><b>Observer</b> &mdash; sipariş durumu değiştikçe abonelere haber vermek.</td>
        <td>Faydalı olabilirdi; ancak senaryo "bilgilendirme" istemiyor, <em>işlem akışını</em> tarif ediyor.
          Çözümümüz işlem-yönlüdür; Observer ihtiyaca göre daha sonra eklenebilir, mimariyi engellemez.</td>
      </tr>
      <tr>
        <td><b>State</b> &mdash; sipariş durumu için.</td>
        <td><code>SiparisDurumu</code> bir enum yeterli; siparişin davranışı durumla değişmiyor (yalnızca
          basit gözlemlenebilir alanlar). State aşırı mühendislik olur.</td>
      </tr>
    </tbody>
  </table>

  <div class="callout">
    <b>Mimari kanaat.</b> Strategy "ne ile ödensin", CoR "kabul edilebilir mi", Command "kabul sonrası ne yapılsın"
    sorularını birbirinden bağımsız cevaplar. Senaryonun her üç <em>değişme ekseni</em> &mdash; ödeme yöntemleri,
    kontrol kuralları, işleme adımları &mdash; ayrı bir örüntü ile soyutlanmıştır; biri büyürken diğerleri sabit kalır.
  </div>

  

</section>
<section class="diagram-page-landscape">
  <h2>2.4 Sınıf Diyagramı</h2>
  <figure class="diagram-figure">
    <img src="${diagram2Path}" alt="Soru 2 sınıf diyagramı"/>
    <figcaption>Şekil 2.1 &middot; SimpleCar E-Satış &mdash; UML 2.x sınıf diyagramı.
      Sol kanat: CoR (kontroller); orta: orchestrator; sağ üst: Strategy (ödeme yöntemleri);
      sağ alt: Command (sıralı işleme adımları).</figcaption>
  </figure>
</section>
<section class="page question-page">

  

  <h2>2.5 Sınıf Açıklamaları</h2>
  <table class="class-table">
    <thead><tr><th>Sınıf / Arayüz</th><th>Stereotip</th><th>Sorumluluk &amp; Roller</th></tr></thead>
    <tbody>
      <tr><td><code>Musteri</code></td><td>&laquo;entity&raquo;</td>
          <td>Siparişi veren kişi; <code>hesapBakiyesi</code> bakiye kontrolünde kullanılır.</td></tr>
      <tr><td><code>Siparis</code></td><td>&laquo;entity&raquo;</td>
          <td>Aggregate root; tutar, miktar, seçilen <code>OdemeYontemi</code>, durum bilgilerini taşır.</td></tr>
      <tr><td><code>SiparisDurumu</code></td><td>&laquo;enumeration&raquo;</td>
          <td>Yaşam döngüsü sabitleri: ALINDI / KONTROL_EDILIYOR / ONAYLANDI / IPTAL_EDILDI / ISLENDI.</td></tr>
      <tr><td><code>OdemeYontemi</code></td><td>&laquo;interface&raquo;</td>
          <td>Strategy sözleşmesi; <code>odemeYap(tutar)</code> imzası.</td></tr>
      <tr><td><code>BankaHavalesi</code> &middot; <code>Paypal</code> &middot; <code>SogukCuzdan</code></td>
          <td>&laquo;concrete&raquo;</td>
          <td>Mevcut ödeme stratejileri; her birinin kanal-özel alanları (IBAN, e-posta, cüzdan adresi) vardır.</td></tr>
      <tr><td><code>SiparisKontrolu</code></td><td>&laquo;abstract&raquo;</td>
          <td>CoR taban sınıfı; <code>kontrolEt</code> şablon metodu zincirleme işini taşır,
            <code>kontroluUygula</code> alt sınıflara bırakılır.</td></tr>
      <tr><td><code>SahtecilikKontrolu</code> &middot; <code>LimitKontrolu</code> &middot; <code>BakiyeKontrolu</code></td>
          <td>&laquo;concrete&raquo;</td>
          <td>Tek bir kuralı uygulayan halkalar; bağımsız birim test yapılabilir.</td></tr>
      <tr><td><code>Komut</code></td><td>&laquo;interface&raquo;</td>
          <td>Command sözleşmesi; <code>calistir(siparis)</code>.</td></tr>
      <tr><td><code>FaturaDuzenle</code> &middot; <code>FaturaGonder</code> &middot; <code>AlacaklaraKaydet</code></td>
          <td>&laquo;concrete&raquo;</td>
          <td>Senaryoda istenen sıralı üç işleme adımı; her biri kendi yan etkisinden sorumlu.</td></tr>
      <tr><td><code>SiparisIsleyici</code></td><td>&laquo;macro command&raquo;</td>
          <td>Sıralı komut listesi; <code>komutEkle</code> ile genişletilebilir.</td></tr>
      <tr><td><code>SiparisYoneticisi</code></td><td>&laquo;service&raquo;</td>
          <td>Use-case orchestratoru; kontrol zincirini ve işleyiciyi koordine eder. <em>Açık:</em>
            burada Facade kalıtsal bir izi vardır &mdash; çağırana tek bir <code>siparisAl(s)</code> arayüzü
            sunulur.</td></tr>
      <tr><td><code>Fatura</code></td><td>&laquo;entity&raquo;</td>
          <td>Fatura komutları arasında paylaşılan veri; sipariş ile <em>1-1</em> ilişkili.</td></tr>
    </tbody>
  </table>

  <h2>2.6 İlişki Tipleri (UML Notasyonu)</h2>
  <ul class="bullet-list">
    <li><em>Aggregation.</em> <code>Siparis &#x25C7;&mdash; OdemeYontemi (1..1)</code>: ödeme yöntemi
        siparişe atanır, fakat onun parçası değildir.</li>
    <li><em>Aggregation.</em> <code>SiparisIsleyici &#x25C7;&mdash; Komut (1..*, {ordered})</code>: komut listesi
        işleyiciden bağımsız olarak da var olabilir; UML kısıtı <code>{ordered}</code> sıralı koleksiyonu belirtir.</li>
    <li><em>Composition.</em> <code>SiparisYoneticisi &#x25C6;&mdash; SiparisIsleyici</code>: yönetici,
        işleyiciyi kendisi oluşturur ve sahiplenir.</li>
    <li><em>Self-association.</em> <code>SiparisKontrolu &mdash; sonraki: 0..1</code>: zincirleme
        bağıntısı, halkanın kendisine.</li>
    <li><em>Realization.</em> <code>BankaHavalesi/Paypal/SogukCuzdan &mdash;..&#x25B7; OdemeYontemi</code>;
        <code>FaturaDuzenle/FaturaGonder/AlacaklaraKaydet &mdash;..&#x25B7; Komut</code>.</li>
    <li><em>Inheritance.</em> Üç kontrol halkası <code>SiparisKontrolu</code>'ndan türer.</li>
    <li><em>Dependency.</em> <code>SiparisYoneticisi &mdash;..&gt; Siparis</code> (etiket: <em>isler</em>);
        <code>FaturaDuzenle &mdash;..&gt; Fatura</code> (&laquo;creates&raquo;).</li>
  </ul>

  

  <div style="break-inside:avoid;">
  <h2>2.7 Sıra Diyagramı (Sipariş Yaşam Döngüsü)</h2>
  <figure class="diagram-figure seq-fig">
    <img src="${sekans2Path}" alt="Sekans 3 - sipariş yaşam döngüsü"/>
    <figcaption>Şekil 2.2 &middot; Bir siparişin alınmasından ISLENDI durumuna geçişine kadar tüm etkileşim akışı.
      Kontroller CoR boyunca devredilir; işleme adımları Macro Command tarafından sırayla çalıştırılır.</figcaption>
  </figure>
  </div>

  

  <h2>2.8 Genişletilebilirlik Senaryoları</h2>
  <table class="design-table">
    <thead><tr><th>Yeni Gereksinim</th><th>Mevcut Tasarımda Yapılacak Tek Şey</th></tr></thead>
    <tbody>
      <tr><td>Kripto kart yöntemi eklemek</td>
          <td><code>OdemeYontemi</code>'ni uygulayan yeni bir sınıf yazmak. Mevcut hiçbir kod değişmez.</td></tr>
      <tr><td>KYC kontrolü eklemek</td>
          <td><code>SiparisKontrolu</code>'ndan türetilen yeni bir halka yazıp zincire <code>setSonraki</code> ile takmak.</td></tr>
      <tr><td>Kargo etiketi oluşturma adımı eklemek</td>
          <td><code>Komut</code>'u uygulayan yeni bir sınıfı <code>SiparisIsleyici.komutEkle</code> ile dahil etmek.</td></tr>
      <tr><td>Bazı adımları paralel çalıştırma</td>
          <td><code>SiparisIsleyici</code>'yi <code>ParalelSiparisIsleyici</code> olarak alternatifleştirmek
              (Liskov uyumlu).</td></tr>
      <tr><td>Tüm kontrolleri tek seferde çalıştırıp <em>tüm</em> hataları toplama</td>
          <td>Yeni bir <code>HepsiniDogrulayanSiparisKontrolu</code> kompozit halkası yazmak; mevcut halkalar
              değişmeden kullanılır.</td></tr>
    </tbody>
  </table>

  <h2>2.9 Sonuç</h2>
  <p>
  Önerilen tasarım; siparişin <em>alınması, doğrulanması ve işlenmesi</em> iç akışlarını birbirinden ayrı,
  örüntü-tabanlı kapsüllere yerleştirir. Senaryonun en sık değişeceği belirtilen iki ekseni &mdash; <em>ödeme
  yöntemleri</em> ve <em>kontrol kuralları</em> &mdash; mevcut kodu değiştirmeden büyür. Sıralı işleme,
  gözlemlenebilir, sıra/komut listesi değiştirilebilir ve test edilebilir bir komut akışı ile gerçekleştirilir.
  Böylece, hem sınav kurallarında istenen <em>örüntü adı açıkça belirtilmiş</em> ve <em>ilişki tipi ile
  işaretlemeleri doğru kullanılmış</em>; hem de senaryodaki nitelikler ve metotlar sınıflar içinde
  konumlandırılmıştır.
  </p>
</section>

</body>
</html>
`;
}

function css() {
  return `
@page { size: A4 portrait; margin: 20mm 18mm; }
@page landscape-diagram { size: A4 landscape; margin: 14mm 16mm; }

.diagram-page-landscape {
  page: landscape-diagram;
  break-before: page;
  break-after: page;
  break-inside: avoid;
}
.diagram-page-landscape .diagram-figure {
  margin: 0;
  break-inside: avoid;
}
.diagram-page-landscape .diagram-figure img {
  width: 100%;
  max-height: 160mm;
  object-fit: contain;
  height: auto;
}
.diagram-page-landscape h2 {
  margin-top: 0;
  margin-bottom: 4pt;
  break-after: avoid;
}

* { box-sizing: border-box; }

body {
  font-family: 'EB Garamond', 'Cambria', 'Georgia', serif;
  color: #161616;
  font-size: 11.4pt;
  line-height: 1.55;
  margin: 0;
  background: #fbfaf6;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

code {
  font-family: 'JetBrains Mono','SFMono-Regular','Consolas',Menlo,monospace;
  font-size: 9.8pt;
  background: #efece4;
  padding: 1px 5px;
  border-radius: 2px;
  color: #1a1a1a;
}

p { margin: 0 0 10px; text-align: justify; hyphens: auto; }
em { font-style: italic; }
b, strong { font-weight: 700; }

h1, h2, h3 { color: #0c0c0c; margin: 0; font-family: 'EB Garamond', serif; }
h1 { font-size: 26pt; font-weight: 700; letter-spacing: -0.005em; }
h2 {
  font-size: 15pt; font-weight: 700; margin: 20pt 0 8pt;
  padding-bottom: 5pt;
  border-bottom: 1px solid #1a1a1a;
}
h3 { font-size: 12.5pt; font-weight: 600; margin: 10pt 0 4pt; font-style: italic; color: #2b2b2b; }

ol, ul { margin: 4px 0 12px 22px; padding: 0; }
ol li, ul li { margin-bottom: 6px; }

.ref {
  font-size: 9pt; font-style: italic; color: #5a5a5a;
}

.page-break { page-break-after: always; height: 0; }

/* ========= COVER ========= */
.cover {
  page-break-after: always;
  height: 250mm;
  padding: 0;
  position: relative;
  overflow: hidden;
}
.cover-frame {
  border: 1px solid #1a1a1a;
  margin: 0;
  padding: 18mm 18mm 14mm;
  height: 100%;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 96% 4%, rgba(0,0,0,0.04), transparent 28%),
    radial-gradient(circle at 4% 96%, rgba(0,0,0,0.04), transparent 28%);
}
.cover-mark {
  text-align: center;
  margin-top: 6mm;
}
.cover-mark-line {
  display: block;
  font-size: 9.5pt;
  letter-spacing: 0.32em;
  color: #5a5a5a;
  font-weight: 600;
  text-transform: uppercase;
  margin: 1.2mm 0;
}
.cover-title {
  text-align: center;
  font-size: 38pt;
  font-weight: 700;
  margin-top: 10mm;
  line-height: 1.02;
  color: #0c0c0c;
  letter-spacing: -0.015em;
}
.cover-subtitle {
  text-align: center !important;
  font-size: 16pt;
  font-style: italic;
  font-weight: 500;
  margin: 5mm 0 0;
  color: #2b2b2b;
  hyphens: none;
}
.cover-rule {
  border-top: 1px solid #1a1a1a;
  margin: 7mm 0;
}
.cover-author {
  text-align: center;
  margin: 4mm 0 0;
}
.cover-author p { text-align: center !important; hyphens: none; }
.cover-author-name {
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 15pt;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #1a1a1a;
  margin: 0 0 2mm;
}
.cover-author-line {
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 11pt;
  font-style: italic;
  color: #3a3a3a;
  margin: 0.6mm 0;
}
.cover-meta {
  width: 110mm;
  margin: 0 auto;
  border-collapse: collapse;
  font-size: 11pt;
}
.cover-meta td {
  padding: 4px 6px;
}
.cover-meta td:first-child {
  color: #4a4a4a;
  width: 40mm;
  font-style: italic;
  font-variant: small-caps;
  letter-spacing: 0.05em;
}
.cover-abstract {
  font-size: 10.5pt;
  color: #1a1a1a;
  margin: 5mm 0 7mm;
  text-align: justify;
  line-height: 1.5;
}
.dropcap {
  font-size: 32pt;
  font-weight: 700;
  float: left;
  line-height: 0.9;
  margin: 3px 7px 0 0;
  color: #0c0c0c;
}
.cover-toc {
  border-top: 0.5px solid #1a1a1a;
  border-bottom: 0.5px solid #1a1a1a;
  padding: 4mm 0;
}
.toc-title {
  font-size: 10pt;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: #4a4a4a;
  margin-bottom: 3mm;
  font-variant-caps: small-caps;
}
.cover-toc ol {
  list-style: none;
  margin: 0; padding: 0;
}
.cover-toc li {
  display: flex;
  align-items: baseline;
  font-size: 10.5pt;
  padding: 2mm 0;
  border-bottom: 0.3px dotted #999;
}
.cover-toc li:last-child { border-bottom: none; }
.cover-toc li > span:first-child { flex: 0 0 auto; }
.cover-toc li > .dots { flex: 1 1 auto; border-bottom: 0.5px dotted #888; margin: 0 6px; transform: translateY(-3px); }
.cover-toc li > span:last-child { flex: 0 0 auto; font-style: italic; color: #4a4a4a; }

/* ========= QUESTION HEADER ========= */
.page { page-break-before: always; }
.q-header {
  margin-bottom: 8mm;
  padding-bottom: 5mm;
  border-bottom: 2px solid #0c0c0c;
}
.q-tag {
  display: inline-block;
  font-size: 9.5pt;
  letter-spacing: 0.28em;
  font-variant-caps: small-caps;
  font-weight: 600;
  color: #5a5a5a;
  border: 1px solid #5a5a5a;
  padding: 2px 8px;
  border-radius: 2px;
}
.q-header h1 {
  margin-top: 8px;
  font-size: 28pt;
  letter-spacing: -0.01em;
}
.q-sub {
  color: #4a4a4a;
  font-style: italic;
  margin: 6px 0 0;
  font-size: 12pt;
}

/* ========= TABLES ========= */
table { border-collapse: collapse; width: 100%; margin: 8pt 0 14pt; font-size: 10.5pt; }
.design-table th, .design-table td,
.class-table th, .class-table td {
  border-top: 0.6px solid #1a1a1a;
  border-bottom: 0.6px solid #1a1a1a;
  padding: 7px 9px;
  vertical-align: top;
}
.design-table th, .class-table th {
  font-weight: 700;
  text-align: left;
  border-top: 1.4px solid #0c0c0c;
  border-bottom: 1.4px solid #0c0c0c;
  background: transparent;
  font-variant-caps: small-caps;
  letter-spacing: 0.04em;
}
.design-table td:first-child {
  width: 22%;
  font-weight: 600;
}
.class-table td:nth-child(2) { width: 22%; color: #4a4a4a; font-style: italic; font-size: 10pt; }
.class-table td:first-child { width: 26%; }

/* ========= LISTS ========= */
.num-list, .bullet-list { margin-left: 22px; }
.num-list > li, .bullet-list > li { margin-bottom: 6px; }

/* ========= CALLOUT ========= */
.callout {
  border-left: 3px solid #1a1a1a;
  padding: 10px 16px;
  font-size: 11pt;
  font-style: italic;
  margin: 10pt 0 14pt;
  background: rgba(0,0,0,0.025);
}
.callout b { font-style: normal; }

/* ========= CODE BLOCK ========= */
pre.code {
  font-family: 'JetBrains Mono','SFMono-Regular','Consolas',Menlo,monospace;
  font-size: 9.5pt;
  line-height: 1.45;
  background: #f3efe5;
  border: 0.6px solid #b9b29f;
  border-left: 3px solid #1a1a1a;
  padding: 10px 14px;
  margin: 10pt 0 14pt;
  white-space: pre-wrap;
  page-break-inside: avoid;
  color: #1a1a1a;
}

/* ========= DIAGRAM ========= */
.diagram-figure {
  margin: 8pt 0 16pt;
  text-align: center;
  page-break-inside: avoid;
}
.diagram-figure img {
  width: 100%;
  height: auto;
  border: 0.6px solid #1a1a1a;
}
.seq-fig {
  break-inside: avoid;
}
.seq-fig img {
  max-height: 78mm;
  object-fit: contain;
}
.diagram-figure figcaption {
  margin-top: 6pt;
  font-size: 9.5pt;
  color: #2b2b2b;
  font-style: italic;
  text-align: center;
}
`;
}
