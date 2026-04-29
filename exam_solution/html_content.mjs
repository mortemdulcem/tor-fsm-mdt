// Academic Turkish content for the OOP midterm answer document.
// Style: serif (EB Garamond), monochrome paper, textbook layout.

export function buildHtml({ diagram1Path, diagram2Path, sekans1aPath, sekans1bPath, sekans2Path }) {
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8"/>
<title>Ara Sinav Cevap Belgesi</title>
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
    <div class="cover-mark">Bilisim Enstitusu &middot; Yuksek Lisans</div>

    <h1 class="cover-title">Nesneye Yonelik<br/>Yazilim Gelistirme</h1>
    <p class="cover-subtitle">Ara Sinav &middot; Cevap Belgesi</p>

    <div class="cover-rule"></div>

    <table class="cover-meta">
      <tr><td>Donem</td><td>2025-2026 Bahar</td></tr>
      <tr><td>Teslim Tarihi</td><td>30 Nisan 2026</td></tr>
      <tr><td>Toplam Puan</td><td>100 (Soru 1: 50 + Soru 2: 50)</td></tr>
      <tr><td>Format</td><td>PDF, A4, tek dosya</td></tr>
    </table>

    <div class="cover-rule"></div>

    <p class="cover-abstract">
      <span class="dropcap">B</span>u belge, sinavda istenen iki senaryo icin nesneye yonelik tasarim cozumlerini
      sunar. Her soru icin (i) senaryo cozumlemesi, (ii) tasarim oruntusu secimleri ile <em>red edilmis
      alternatiflerin gerekceleri</em>, (iii) UML 2.x sinif diyagrami, (iv) bir veya iki sira (sequence)
      diyagrami, (v) onemli metotlarin sozde-kodlari ve (vi) tipik calisma akislari yer almaktadir.
      Diyagramlar, baglilik (coupling) ve uyum (cohesion) olcutleri ile <em>okunaklilik</em> dengesi
      gozetilerek elle dizayn edilmis; otomatik olarak yerlestirilmemistir.
    </p>

    <div class="cover-toc">
      <div class="toc-title">Icindekiler</div>
      <ol>
        <li><span>Soru 1 &middot; Akilli Ev Yonetim Sistemi</span><span class="dots"></span><span>State + Mediator + Observer</span></li>
        <li><span>Soru 2 &middot; SimpleCar E-Satis Sistemi</span><span class="dots"></span><span>Strategy + CoR + Command</span></li>
      </ol>
    </div>
  </div>
</section>

<!-- ====================== SORU 1 ====================== -->
<section class="page question-page">
  <header class="q-header">
    <span class="q-tag">Soru 1 &middot; 50 Puan</span>
    <h1>Akilli Ev Yonetim Sistemi</h1>
    <p class="q-sub">State, Mediator ve Observer Oruntulerinin Birlikte Kullanimi</p>
  </header>

  <h2>1.1 Senaryonun Cozumlenmesi</h2>
  <p>
  Senaryo, dort tip bilesen tanimlar: iki <em>aktif sistem</em> (aydinlatma, isitma), iki <em>pasif olcum
  kaynagi</em> (kapi sensoru, hareket sensoru) ve bir <em>orta kontrol noktasi</em> (akilli ev izleme motoru).
  Bilesenler arasindaki etkilesimleri dort temel olguya indirgeyebiliriz:
  </p>
  <ol class="num-list">
    <li><b>Davranissal cogulluk.</b> Aydinlatma ve isitma sistemleri, ic durumlarina &mdash; yani aktif <em>moda</em>
      &mdash; gore <em>farkli davranir</em>. Tasarruflu modda isitma 18&deg;C, aydinlatma asgari seviye hedefler;
      guvenli modda ise sirasiyla 40&deg;C panel sicakligi ve maksimum aydinlatma uygulanir. Bu davranissal
      cogullugu <code>if/switch</code> ile cozmek, her yeni mod eklendiginde mevcut sinifi degistirmeyi gerektirir.
      Polimorfizm uzerinden tasinmasi <em>acik-kapali</em> prensibinin (OCP) dogal sonucudur.</li>
    <li><b>Kosullu senkronizasyon.</b> Iki sistemin modu <em>baglantilidir</em>: bir sistemde tasarruflu mod
      secilirse digeri de zorunlu olarak gecer. Bu kural sistemler arasinda <em>dogrudan</em> uygulanirsa, her
      sistem digerini referans alir; <em>n &times; (n-1)</em> baglantisi ortaya cikar. Senaryoda iki sistem var,
      ancak ileride yeni bir sistem (orn. sulama) eklendiginde dogrudan referans yapisi kirilgan hale gelir.</li>
    <li><b>Olay yayini, alici farkindaligi olmadan.</b> Sensorler, olcumlerini iletmeli; ama <em>kime</em>
      ilettiklerini <em>bilmek zorunda olmamali</em>. Sensorun motora dogrudan referansi olmasi, sensoru izleme
      altyapisina baglar &mdash; sensoru baska bir baglamda (orn. test, ayri bir konsol) kullanmayi imkansizlastirir.</li>
    <li><b>Cogul bildirim hedefi.</b> Bir kullanicinin <em>birden fazla</em> istemcisi olabilir (mobil ve web).
      Motor, "kullaniciya bildirim gonder" eylemini somut bir istemci tipine baglarsa, yeni bir kanal
      (e-posta, SMS, sesli asistan) eklendiginde motor degisir. Burada da <em>yayinci-abone</em> ayrismasi
      kacinilmazdir.</li>
  </ol>

  <h2>1.2 Oruntu Secimleri ve Gerekceleri</h2>
  <p>Yukaridaki dort olgu, GoF kataloundaki uc <em>davranissal</em> oruntu ile noktasal olarak eslesir:</p>
  <table class="design-table">
    <thead><tr><th>Oruntu</th><th>Uygulanan Yer</th><th>Cozdugu Olgu</th></tr></thead>
    <tbody>
      <tr>
        <td><b>State</b><br/><span class="ref">GoF, s.305</span></td>
        <td><code>CalismaModu</code> arayuzu; <code>GuvenliMod</code> ve <code>TasarrufluMod</code>; <code>EvSistemi</code>
            &laquo;baglam&raquo; rolunde, <code>aktifMod</code> alanini tutar.</td>
        <td>(1) Davranissal cogulluk: <code>komutCalistir</code> cagirildiginda davranis aktif moda gore polimorfik
            secilir. Yeni bir mod eklemek <code>EvSistemi</code>'ni degistirmez.</td>
      </tr>
      <tr>
        <td><b>Mediator</b><br/><span class="ref">GoF, s.273</span></td>
        <td><code>AkilliEvIzlemeMotoru</code>; tum <code>EvSistemi</code> ve <code>Sensor</code> nesnelerini tanir,
            sistemleri birbirine baglamadan koordine eder.</td>
        <td>(2) Kosullu senkronizasyon: "tum sistemler ayni moda gecsin" gibi cok-yonlu kurallar arabulucuda
            <em>tek bir noktada</em> uygulanir; sistemler arasi referans gerekmez.</td>
      </tr>
      <tr>
        <td><b>Observer</b><br/><span class="ref">GoF, s.293</span></td>
        <td>(a) <code>Sensor</code> &#x2194; <code>SensorGozlemcisi</code> arayuzu (motor abonedir).<br/>
            (b) <code>AkilliEvIzlemeMotoru</code> &#x2194; <code>KullaniciBildirimAlici</code> arayuzu
                (mobil/web abonedir).</td>
        <td>(3) Olay yayini ve (4) cogul bildirim hedefi: hem sensor hem motor, abone tipinden bagimsiz olarak
            yayin yapar. Yeni kanal/abone eklemek mevcut yayinciyi degistirmez.</td>
      </tr>
    </tbody>
  </table>

  <h2>1.3 Reddedilen Alternatifler</h2>
  <table class="design-table">
    <thead><tr><th>Alternatif</th><th>Neden Tercih Edilmedi?</th></tr></thead>
    <tbody>
      <tr>
        <td><b>Singleton</b> &mdash; <code>AkilliEvIzlemeMotoru</code>'nu tekil yapmak.</td>
        <td>Senaryo "bir akilli ev"den bahsediyor; ancak <em>test edilebilirlik</em> ve <em>gelecek cok-evli</em>
          (apartman, site) senaryosu icin tekillik bagimliligi maliyetli. Tekillik bir <em>uretim/yaratim</em>
          karari; mevcut tasarim <em>davranissal</em> sorunlari cozer.</td>
      </tr>
      <tr>
        <td><b>Strategy</b> &mdash; modlari <code>Calisma Stratejisi</code> olarak tasimak.</td>
        <td>Strategy, davranisi <em>disaridan</em> secilen bir algoritma olarak modeller; biz icine ait <em>durumu</em>
          modelliyoruz. Ozellikle "iki sistemin modu birlikte degisir" kurali, sistemden ayri bir strateji nesnesini
          gerektirmez. State daha dogru kavramsal eslesmedir.</td>
      </tr>
      <tr>
        <td><b>Pub/Sub mesaj kuyrugu</b> &mdash; sensor olaylari icin.</td>
        <td>Senaryo bunu istemez; ek altyapi maliyeti getirir. Observer, <em>ayni surec icinde</em> ihtiyac
          duyulan ayrismayi sade bicimde saglar.</td>
      </tr>
      <tr>
        <td><b>Visitor</b> &mdash; mod degisikliginde sistemleri dolasmak icin.</td>
        <td>Visitor, <em>sabit nesne hiyerarsisi uzerinde degisken islemler</em> icin uygundur. Burada islem (mod
          degistirme) sabit, hiyerarsi (sistemler) genisleyebilir; tam ters yon. Mediator + State daha uygun.</td>
      </tr>
    </tbody>
  </table>

  <div class="callout">
    <b>Mimari kanaat.</b> &nbsp; State davranisi, Mediator koordinasyonu, Observer ise bilgi yayinini bagimsiz
    eksenler olarak ayirir. Uc oruntu birbirinin <em>kaldiraci</em>: birini cikartmak diger ikisinin yukunu
    artirir ve kodun acilan/kapanan dengesini bozar.
  </div>

  

  <h2>1.4 Sinif Diyagrami</h2>
  <figure class="diagram-figure">
    <img src="${diagram1Path}" alt="Soru 1 sinif diyagrami"/>
    <figcaption>Sekil 1.1 &middot; Akilli Ev Yonetim Sistemi &mdash; UML 2.x sinif diyagrami.
      Sol katman: kullanici ve goruntuleme; orta katman: arabulucu motor ve gozlemci arayuzleri; alt katman:
      sistem ve sensor hiyerarsileri.</figcaption>
  </figure>

  

  <h2>1.5 Sinif Aciklamalari</h2>
  <table class="class-table">
    <thead><tr><th>Sinif / Arayuz</th><th>Stereotip</th><th>Sorumluluk &amp; Roller</th></tr></thead>
    <tbody>
      <tr><td><code>Kullanici</code></td><td>&laquo;entity&raquo;</td>
          <td>Ev sahibinin kimligi; bir veya birden fazla bildirim aliciya (mobil/web) sahip olabilir.</td></tr>
      <tr><td><code>KullaniciBildirimAlici</code></td><td>&laquo;interface&raquo;</td>
          <td>Observer arayuzu (kanal-bagimsiz). <code>bildirimGoster(olay)</code> ve <code>durumYansit(ozet)</code>.</td></tr>
      <tr><td><code>MobilUygulama</code> &middot; <code>WebUygulamasi</code></td><td>&laquo;concrete&raquo;</td>
          <td>Concrete observer; kanal-ozel goruntuleme yapar. Kullanici komutlarini motora iletir.</td></tr>
      <tr><td><code>DurumOzeti</code></td><td>&laquo;value object&raquo;</td>
          <td>Anlik durum fotografi; degismez (immutable). Motor uretir, alicilar tuketir.</td></tr>
      <tr><td><code>AkilliEvIzlemeMotoru</code></td><td>&laquo;mediator&raquo; + &laquo;observer&raquo;</td>
          <td>Tum sistem ve sensorleri tanir. Sensor olaylarinda gozlemci, kullanici icin yayinci. Mod
            senkronizasyonu, komut yonlendirme ve durum yayini.</td></tr>
      <tr><td><code>EvSistemi</code></td><td>&laquo;abstract&raquo;</td>
          <td>State icin <em>baglam</em>; <code>aktifMod</code> alani uzerinden davranisini polimorfik secer.
            <code>komutCalistir</code> alt siniflara birakilir.</td></tr>
      <tr><td><code>AydinlatmaSistemi</code> &middot; <code>IsitmaSistemi</code></td><td>&laquo;concrete&raquo;</td>
          <td>Cihaz-ozel davranisi (asgari/maksimum aydinlatma; hedef sicaklik) uygular.</td></tr>
      <tr><td><code>CalismaModu</code></td><td>&laquo;interface&raquo;</td>
          <td>State arayuzu; <code>uygula(sistem)</code> ile baglami yapilandirir.</td></tr>
      <tr><td><code>GuvenliMod</code> &middot; <code>TasarrufluMod</code></td><td>&laquo;concrete&raquo;</td>
          <td>Iki politik davranis: maksimum kapasite ile asgari/hedef ayar.</td></tr>
      <tr><td><code>ModTipi</code></td><td>&laquo;enumeration&raquo;</td>
          <td>Kullanici arayuzunden gelen mod tercihi icin tip-guvenli sabitler.</td></tr>
      <tr><td><code>Sensor</code></td><td>&laquo;abstract&raquo;</td>
          <td>Subject rolu: <code>attach</code>/<code>detach</code> ve <code>bildir</code> ortak metotlari.</td></tr>
      <tr><td><code>KapiSensoru</code> &middot; <code>HareketSensoru</code></td><td>&laquo;concrete&raquo;</td>
          <td>Donanima ozgu olcum metotlari (<code>olcumGonder</code>); olay tetiklerler.</td></tr>
      <tr><td><code>SensorGozlemcisi</code></td><td>&laquo;interface&raquo;</td>
          <td>Sensor olaylarini alacak nesneler icin Observer arayuzu (motor uygular).</td></tr>
      <tr><td><code>SensorOlayi</code></td><td>&laquo;value object&raquo;</td>
          <td>Tip, kaynak sensor, veri ve zaman tasiyan degismez olay nesnesi.</td></tr>
      <tr><td><code>SensorTipi</code></td><td>&laquo;enumeration&raquo;</td>
          <td>KAPI / HAREKET; mantik kontrolu ve kayit icin.</td></tr>
    </tbody>
  </table>

  <h2>1.6 Iliski Tipleri (UML Notasyonu)</h2>
  <ul class="bullet-list">
    <li><em>Olusum (composition).</em> <code>AkilliEvIzlemeMotoru &#x25C6;&mdash; EvSistemi (1..*)</code> ve
        <code>AkilliEvIzlemeMotoru &#x25C6;&mdash; Sensor (1..*)</code>: motor olmadan sistem/sensor anlamli
        degildir &mdash; yasam dongulerini motor sahiplenir.</li>
    <li><em>Birikim (aggregation).</em> <code>AkilliEvIzlemeMotoru &#x25C7;&mdash; KullaniciBildirimAlici (0..*)</code>:
        bildirim alicilari motorun parcasi degildir, dis dunyaya aittir; motor onlari yalnizca tutar.</li>
    <li><em>Birikim (state).</em> <code>EvSistemi &#x25C7;&mdash; CalismaModu</code> (aktif mod): mod
        nesnesi sistemin yasam dongusunden bagimsiz olusturulup atanir.</li>
    <li><em>Gerceklestirme (realization).</em> <code>MobilUygulama / WebUygulamasi &mdash;..&#x25B7; KullaniciBildirimAlici</code>;
        <code>GuvenliMod / TasarrufluMod &mdash;..&#x25B7; CalismaModu</code>;
        <code>AkilliEvIzlemeMotoru &mdash;..&#x25B7; SensorGozlemcisi</code>.</li>
    <li><em>Kalitim (inheritance).</em> Sensor ve EvSistemi hiyerarsileri.</li>
    <li><em>Bagimlilik (dependency).</em> <code>AkilliEvIzlemeMotoru &mdash;..&gt; DurumOzeti</code>
        (&laquo;creates&raquo;): motor durum ozetini olusturup yayinlar; alicilar bunu yalnizca tuketir.</li>
  </ul>

  

  <h2>1.7 Sira Diyagramlari (Calisma Akislari)</h2>
  <figure class="diagram-figure">
    <img src="${sekans1aPath}" alt="Sekans 1 - sensor olayi"/>
    <figcaption>Sekil 1.2 &middot; Hareket sensoru tetiklendiginde olay akisi.
      Sensor olayi gozlemci uzerinden motora iletilir; motor ilgili sistemleri
      uyarir, sonra DurumOzeti ile tum bildirim alicilarini eslestirir.</figcaption>
  </figure>

  <figure class="diagram-figure">
    <img src="${sekans1bPath}" alt="Sekans 2 - mod degisikligi"/>
    <figcaption>Sekil 1.3 &middot; Kullanicinin tasarruflu mod talebi.
      Tek bir <code>tumModlariAyarla</code> cagrisi, mediator araciligi ile tum sistemleri ve istemcileri
      tutarli bicimde gunceller; sistemler birbirini referans almaz.</figcaption>
  </figure>

  

  <h2>1.8 Onemli Metotlarin Sozde-Kodu</h2>

  <pre class="code">// MEDIATOR — tum sistemleri tek noktadan moda gecir
class AkilliEvIzlemeMotoru implements SensorGozlemcisi {
    void tumModlariAyarla(ModTipi tip) {
        CalismaModu yeniMod = (tip == ModTipi.TASARRUFLU)
                              ? new TasarrufluMod()
                              : new GuvenliMod();
        for (EvSistemi s : sistemler) {        // baglantili sistemler
            s.modAyarla(yeniMod);              // ayni nesne paylasilir
        }
        aktifModTipi = tip;
        durumOzetiYayinla();                   // observer'lara bildir
    }

    // OBSERVER — sensorden olay
    void bildirimAl(SensorOlayi olay) {
        for (EvSistemi s : ilgiliSistemleriBul(olay))
            s.komutCalistir(olay.tip == SensorTipi.HAREKET
                            ? "hareketAlgilandi" : "kapiAcildi");
        for (KullaniciBildirimAlici a : bildirimAlicilari)
            a.bildirimGoster(olay);            // kanal-bagimsiz yayin
        durumOzetiYayinla();
    }

    private void durumOzetiYayinla() {
        DurumOzeti ozet = new DurumOzeti(/* anlik durum */);
        for (KullaniciBildirimAlici a : bildirimAlicilari)
            a.durumYansit(ozet);
    }
}</pre>

  <pre class="code">// STATE — davranisi mod uzerinden polimorfik tasi
abstract class EvSistemi {
    protected CalismaModu aktifMod;
    void modAyarla(CalismaModu m) { this.aktifMod = m; m.uygula(this); }
    abstract void komutCalistir(String komut);
}

class IsitmaSistemi extends EvSistemi {
    void sicaklikAyarla(int derece) { /* donanim cagrisi */ }
    void komutCalistir(String komut) {
        // mod kararinin tum yuku CalismaModu.uygula icinde toplanmistir;
        // burada yalnizca komutu donanima yansitiriz
    }
}

class TasarrufluMod implements CalismaModu {
    void uygula(EvSistemi s) {
        if (s instanceof IsitmaSistemi)     ((IsitmaSistemi) s).sicaklikAyarla(18);
        if (s instanceof AydinlatmaSistemi) ((AydinlatmaSistemi) s).asgariAydinlatmaUygula();
    }
    ModTipi tipi() { return ModTipi.TASARRUFLU; }
}</pre>

  <h2>1.9 Tasarimin Niteliksel Avantajlari</h2>
  <ul class="bullet-list">
    <li><b>Acik-Kapali (OCP).</b> Yeni mod (UykuModu), yeni sensor (Pencere), yeni bildirim kanali (E-posta);
        her durumda <em>yalnizca yeni bir sinif</em> eklenir, mevcut kod degismez.</li>
    <li><b>Tek Sorumluluk (SRP).</b> Mod davranisi <code>CalismaModu</code> hiyerarsisinde; senkronizasyon
        politikasi <code>AkilliEvIzlemeMotoru</code>'nda; olay tasimasi <code>Sensor</code> +
        <code>SensorGozlemcisi</code> ikilisinde tutulmustur.</li>
    <li><b>Dusuk Baglilik.</b> Sistemler birbirini, sensorler de motoru somut bir tip olarak bilmez.</li>
    <li><b>Test Edilebilirlik.</b> Stub gozlemci ve sahte modlar ile motor birim test seviyesinde dogrulanabilir.</li>
    <li><b>Liskov Uyumu.</b> Yeni mod, yeni sistem ve yeni sensor turleri ust sozlesmenin (<em>contract</em>)
        ihlali olmadan eklenir.</li>
  </ul>
</section>

<!-- ====================== SORU 2 ====================== -->
<section class="page question-page">
  <header class="q-header">
    <span class="q-tag">Soru 2 &middot; 50 Puan</span>
    <h1>SimpleCar E-Satis Sistemi</h1>
    <p class="q-sub">Strategy, Chain of Responsibility ve Command Oruntulerinin Birlikte Kullanimi</p>
  </header>

  <h2>2.1 Senaryonun Cozumlenmesi</h2>
  <p>
  SimpleCar firmasi yalnizca e-satis yapan bir araba ureticisidir. Domeni dort bilesene ayrilabilir:
  </p>
  <ol class="num-list">
    <li><b>Algoritma ailesi (odeme).</b> Odeme tek bir <em>davranistir</em>, ancak <em>banka havalesi</em>,
      <em>paypal</em>, <em>soguk cuzdan</em> gibi farkli yollarla yapilir; senaryo ayrica bu listenin <em>siklikla
      genisleyip daralacagini</em> ozellikle vurgular. Calisma zamaninda secilebilen, bagimsiz olarak
      degistirilebilen bir <em>algoritma ailesi</em> gerekir.</li>
    <li><b>Asamali ve genisleyebilir kontrol.</b> Her siparis <em>sahtecilik</em>, <em>limit</em> ve <em>bakiye</em>
      kontrollerine tabidir. Birinin olumsuzlugu siparisi iptal eder. Senaryo bu kontrollerin de zamanla
      <em>artirilabilecegini</em> belirtir. Bu, bir <em>filtre zinciri</em>: her halka kararini verir, basariliysa
      siradakine devreder; basarisizsa zinciri keser.</li>
    <li><b>Sirali isleme adimlari.</b> Tum kontroller basariliysa siparis sirasiyla <em>fatura duzenleme</em>,
      <em>fatura gonderme</em> ve <em>alacaklara kaydetme</em> adimlariyla islenir. Adimlar ileride degisebilir;
      her biri test edilebilir bagimsiz bir is birimini temsil eder.</li>
    <li><b>Yonetim ve yasam dongusu.</b> Bir orchestrator (use-case) bilesen, siparisi <em>alir</em>,
      <em>dogrular</em> ve <em>isler</em>. Domain (Siparis) ile servis sorumluluklari ayrik tutulmalidir.</li>
  </ol>

  <h2>2.2 Oruntu Secimleri ve Gerekceleri</h2>
  <table class="design-table">
    <thead><tr><th>Oruntu</th><th>Uygulanan Yer</th><th>Cozdugu Olgu</th></tr></thead>
    <tbody>
      <tr>
        <td><b>Strategy</b><br/><span class="ref">GoF, s.315</span></td>
        <td><code>OdemeYontemi</code> arayuzu; <code>BankaHavalesi</code>, <code>Paypal</code>,
            <code>SogukCuzdan</code>; siparisle <em>1-1</em> birikim.</td>
        <td>(1) Algoritma ailesi: odeme ailesi siparisten bagimsiz olarak yer degistirebilir; yeni yontem eklemek
            mevcut kodu degistirmez.</td>
      </tr>
      <tr>
        <td><b>Chain of Responsibility</b><br/><span class="ref">GoF, s.223</span></td>
        <td><code>SiparisKontrolu</code> soyut sinifi; <code>Sahtecilik</code>, <code>Limit</code>,
            <code>Bakiye</code> halkalari; <code>setSonraki</code> ile kuruluyor.</td>
        <td>(2) Asamali kontrol: halka basariliysa siradakine devreder, basarisizsa zincir kesilir;
            yeni kontrol eklemek tek satir konfigurasyondur.</td>
      </tr>
      <tr>
        <td><b>Command + Macro Command</b><br/><span class="ref">GoF, s.233</span></td>
        <td><code>Komut</code> arayuzu; <code>FaturaDuzenle</code>, <code>FaturaGonder</code>,
            <code>AlacaklaraKaydet</code>; <code>SiparisIsleyici</code> sirayla calistirir.</td>
        <td>(3) Sirali isleme adimlari: her adim kapsullenmis; sira degistirme, ek adim, geri-alma (undo) gibi
            ihtiyaclar icin esnek altyapi.</td>
      </tr>
    </tbody>
  </table>

  <h2>2.3 Reddedilen Alternatifler</h2>
  <table class="design-table">
    <thead><tr><th>Alternatif</th><th>Neden Tercih Edilmedi?</th></tr></thead>
    <tbody>
      <tr>
        <td><b>Template Method</b> &mdash; siparis isleme akisini soyut sinifta sablon olarak kurmak.</td>
        <td>Sablon, <em>sira sabit</em> ise iyidir; ancak senaryo "adim sayisi degisebilir" implikasyonunu tasir
          (yeni adimlar). Komut listesi, calisma zamaninda yeniden duzenlenebilir; sablon ise siniflarin
          yeniden yazilmasini gerektirir.</td>
      </tr>
      <tr>
        <td><b>Decorator</b> &mdash; kontrolleri sarmalayici olarak eklemek.</td>
        <td>Decorator, ana arayuze yeni davranis ekler; ancak burada kontroller <em>kararsal</em>: false donerse
          akisi durdurur. Bu, "ekleme" degil "eleme" semantigi; CoR daha dogru.</td>
      </tr>
      <tr>
        <td><b>Observer</b> &mdash; siparis durumu degistikce abonelere haber vermek.</td>
        <td>Faydali olabilirdi; ancak senaryo "bilgilendirme" istemiyor, <em>islem akisini</em> tarif ediyor.
          Cozumumuz islem-yonludur; Observer ihtiyaca gore daha sonra eklenebilir, mimariyi engellemez.</td>
      </tr>
      <tr>
        <td><b>State</b> &mdash; siparis durumu icin.</td>
        <td><code>SiparisDurumu</code> bir enum yeterli; siparisin davranisi durumla degismiyor (yalnizca
          basit gozlemlenebilir alanlar). State asiri muhendislik olur.</td>
      </tr>
    </tbody>
  </table>

  <div class="callout">
    <b>Mimari kanaat.</b> Strategy "ne ile odensin", CoR "kabul edilebilir mi", Command "kabul sonrasi ne yapilsin"
    sorularini birbirinden bagimsiz cevaplar. Senaryonun her uc <em>degisme ekseni</em> &mdash; odeme yontemleri,
    kontrol kurallari, isleme adimlari &mdash; ayri bir oruntu ile soyutlanmistir; biri buyurken digerleri sabit kalir.
  </div>

  

  <h2>2.4 Sinif Diyagrami</h2>
  <figure class="diagram-figure">
    <img src="${diagram2Path}" alt="Soru 2 sinif diyagrami"/>
    <figcaption>Sekil 2.1 &middot; SimpleCar E-Satis &mdash; UML 2.x sinif diyagrami.
      Sol kanat: CoR (kontroller); orta: orchestrator; sag ust: Strategy (odeme yontemleri);
      sag alt: Command (sirali isleme adimlari).</figcaption>
  </figure>

  

  <h2>2.5 Sinif Aciklamalari</h2>
  <table class="class-table">
    <thead><tr><th>Sinif / Arayuz</th><th>Stereotip</th><th>Sorumluluk &amp; Roller</th></tr></thead>
    <tbody>
      <tr><td><code>Musteri</code></td><td>&laquo;entity&raquo;</td>
          <td>Siparisi veren kisi; <code>hesapBakiyesi</code> bakiye kontrolunde kullanilir.</td></tr>
      <tr><td><code>Siparis</code></td><td>&laquo;entity&raquo;</td>
          <td>Aggregate root; tutar, miktar, secilen <code>OdemeYontemi</code>, durum bilgilerini tasir.</td></tr>
      <tr><td><code>SiparisDurumu</code></td><td>&laquo;enumeration&raquo;</td>
          <td>Yasam dongusu sabitleri: ALINDI / KONTROL_EDILIYOR / ONAYLANDI / IPTAL_EDILDI / ISLENDI.</td></tr>
      <tr><td><code>OdemeYontemi</code></td><td>&laquo;interface&raquo;</td>
          <td>Strategy sozlesmesi; <code>odemeYap(tutar)</code> imzasi.</td></tr>
      <tr><td><code>BankaHavalesi</code> &middot; <code>Paypal</code> &middot; <code>SogukCuzdan</code></td>
          <td>&laquo;concrete&raquo;</td>
          <td>Mevcut odeme stratejileri; her birinin kanal-ozel alanlari (IBAN, e-posta, cuzdan adresi) vardir.</td></tr>
      <tr><td><code>SiparisKontrolu</code></td><td>&laquo;abstract&raquo;</td>
          <td>CoR taban sinifi; <code>kontrolEt</code> sablon metodu zincirleme isini tasir,
            <code>kontroluUygula</code> alt siniflara birakilir.</td></tr>
      <tr><td><code>SahtecilikKontrolu</code> &middot; <code>LimitKontrolu</code> &middot; <code>BakiyeKontrolu</code></td>
          <td>&laquo;concrete&raquo;</td>
          <td>Tek bir kurali uygulayan halkalar; bagimsiz birim test yapilabilir.</td></tr>
      <tr><td><code>Komut</code></td><td>&laquo;interface&raquo;</td>
          <td>Command sozlesmesi; <code>calistir(siparis)</code>.</td></tr>
      <tr><td><code>FaturaDuzenle</code> &middot; <code>FaturaGonder</code> &middot; <code>AlacaklaraKaydet</code></td>
          <td>&laquo;concrete&raquo;</td>
          <td>Senaryoda istenen sirali uc isleme adimi; her biri kendi yan etkisinden sorumlu.</td></tr>
      <tr><td><code>SiparisIsleyici</code></td><td>&laquo;macro command&raquo;</td>
          <td>Sirali komut listesi; <code>komutEkle</code> ile genisletilebilir.</td></tr>
      <tr><td><code>SiparisYoneticisi</code></td><td>&laquo;service&raquo;</td>
          <td>Use-case orchestratoru; kontrol zincirini ve isleyiciyi koordine eder. <em>Acik:</em>
            burada Facade kalitsal bir izi vardir &mdash; cagirana tek bir <code>siparisAl(s)</code> arayuzu
            sunulur.</td></tr>
      <tr><td><code>Fatura</code></td><td>&laquo;entity&raquo;</td>
          <td>Fatura komutlari arasinda paylasilan veri; siparis ile <em>1-1</em> iliskili.</td></tr>
    </tbody>
  </table>

  <h2>2.6 Iliski Tipleri (UML Notasyonu)</h2>
  <ul class="bullet-list">
    <li><em>Birikim (aggregation).</em> <code>Siparis &#x25C7;&mdash; OdemeYontemi (1..1)</code>: odeme yontemi
        siparise atanir, fakat onun parcasi degildir.</li>
    <li><em>Birikim.</em> <code>SiparisIsleyici &#x25C7;&mdash; Komut (1..*, sirali)</code>: komut listesi
        isleyiciden bagimsiz olarak da var olabilir.</li>
    <li><em>Olusum (composition).</em> <code>SiparisYoneticisi &#x25C6;&mdash; SiparisIsleyici</code>: yonetici,
        isleyiciyi kendisi olusturur ve sahiplenir.</li>
    <li><em>Refleksif iliski.</em> <code>SiparisKontrolu &mdash; sonraki: 0..1</code>: zincirleme
        bagintisi, halkanin kendisine.</li>
    <li><em>Gerceklestirme (realization).</em> <code>BankaHavalesi/Paypal/SogukCuzdan &mdash;..&#x25B7; OdemeYontemi</code>;
        <code>FaturaDuzenle/FaturaGonder/AlacaklaraKaydet &mdash;..&#x25B7; Komut</code>.</li>
    <li><em>Kalitim.</em> Uc kontrol halkasi <code>SiparisKontrolu</code>'ndan turer.</li>
    <li><em>Bagimlilik.</em> <code>SiparisYoneticisi &mdash;..&gt; Siparis</code> (&laquo;invokes&raquo;);
        <code>FaturaDuzenle &mdash;..&gt; Fatura</code> (&laquo;creates&raquo;).</li>
  </ul>

  

  <h2>2.7 Sira Diyagrami (Siparis Yasam Dongusu)</h2>
  <figure class="diagram-figure">
    <img src="${sekans2Path}" alt="Sekans 3 - siparis yasam dongusu"/>
    <figcaption>Sekil 2.2 &middot; Bir siparisin alinmasindan ISLENDI durumuna gecisine kadar tum etkilesim akisi.
      Kontroller CoR boyunca devredilir; isleme adimlari Macro Command tarafindan sirayla calistirilir.</figcaption>
  </figure>

  

  <h2>2.8 Onemli Metotlarin Sozde-Kodu</h2>

  <pre class="code">// CHAIN OF RESPONSIBILITY — taban sinif
abstract class SiparisKontrolu {
    protected SiparisKontrolu sonraki;
    SiparisKontrolu setSonraki(SiparisKontrolu k) { this.sonraki = k; return k; }

    final boolean kontrolEt(Siparis s) {       // template method
        if (!kontroluUygula(s)) return false;  // basarisizsa zincir kesilir
        return sonraki == null ? true
                               : sonraki.kontrolEt(s);
    }
    protected abstract boolean kontroluUygula(Siparis s);
}

class BakiyeKontrolu extends SiparisKontrolu {
    protected boolean kontroluUygula(Siparis s) {
        return s.musteri.bakiyeyiGetir() >= s.tutar;
    }
}</pre>

  <pre class="code">// MACRO COMMAND — sirali komut listesi
class SiparisIsleyici {
    private final List&lt;Komut&gt; komutlar = new ArrayList&lt;&gt;();
    void komutEkle(Komut k) { komutlar.add(k); }
    void tumKomutlariCalistir(Siparis s) {
        for (Komut k : komutlar) k.calistir(s);
    }
}

// USE-CASE ORCHESTRATOR
class SiparisYoneticisi {
    private final SiparisKontrolu kontrolZinciri;
    private final SiparisIsleyici isleyici;

    void siparisAl(Siparis s) {
        s.durum = SiparisDurumu.KONTROL_EDILIYOR;
        if (!kontrolZinciri.kontrolEt(s)) {
            s.iptalEt();                      // durum = IPTAL_EDILDI
            return;
        }
        if (!s.odemeAl()) { s.iptalEt(); return; }   // strategy uzerinden
        s.durum = SiparisDurumu.ONAYLANDI;
        isleyici.tumKomutlariCalistir(s);     // fatura duzenle/gonder/alacak
        s.tamamlandiOlarakIsaretle();         // durum = ISLENDI
    }
}</pre>

  <pre class="code">// STRATEGY — siparisten secilen yontem cagirilir
class Siparis {
    private OdemeYontemi odemeYontemi;
    boolean odemeAl() { return odemeYontemi.odemeYap(this.tutar); }
}

class Paypal implements OdemeYontemi {
    private final String hesapEpostasi;
    public boolean odemeYap(double tutar) { /* ag cagrisi */ return true; }
    public String adi() { return "Paypal"; }
}</pre>

  <h2>2.9 Genisletilebilirlik Senaryolari</h2>
  <table class="design-table">
    <thead><tr><th>Yeni Gereksinim</th><th>Mevcut Tasarimda Yapilacak Tek Sey</th></tr></thead>
    <tbody>
      <tr><td>Kripto kart yontemi eklemek</td>
          <td><code>OdemeYontemi</code>'ni uygulayan yeni bir sinif yazmak. Mevcut hicbir kod degismez.</td></tr>
      <tr><td>KYC kontrolu eklemek</td>
          <td><code>SiparisKontrolu</code>'ndan turetilen yeni bir halka yazip zincire <code>setSonraki</code> ile takmak.</td></tr>
      <tr><td>Kargo etiketi olusturma adimi eklemek</td>
          <td><code>Komut</code>'u uygulayan yeni bir sinifi <code>SiparisIsleyici.komutEkle</code> ile dahil etmek.</td></tr>
      <tr><td>Bazi adimlari paralel calistirma</td>
          <td><code>SiparisIsleyici</code>'yi <code>ParalelSiparisIsleyici</code> olarak alternatiflestirmek
              (Liskov uyumlu).</td></tr>
      <tr><td>Tum kontrolleri tek seferde calistirip <em>tum</em> hatalari toplama</td>
          <td>Yeni bir <code>HepsiniDogrulayanSiparisKontrolu</code> kompozit halkasi yazmak; mevcut halkalar
              degismeden kullanilir.</td></tr>
    </tbody>
  </table>

  <h2>2.10 Sonuc</h2>
  <p>
  Onerilen tasarim; siparisin <em>alinmasi, dogrulanmasi ve islenmesi</em> ic akislarini birbirinden ayri,
  oruntu-tabanli kapsullere yerlestirir. Senaryonun en sik degisecegi belirtilen iki ekseni &mdash; <em>odeme
  yontemleri</em> ve <em>kontrol kurallari</em> &mdash; mevcut kodu degistirmeden buyur. Sirali isleme,
  gozlemlenebilir, sira/komut listesi degistirebilir ve test edilebilir bir komut akisi ile gerceklestirilir.
  Boylece, hem sinav kurallarinda istenen <em>oruntu adi acikca belirtilmis</em> ve <em>iliski tip ile
  isaretlemeleri dogru kullanilmis</em>; hem de senaryodaki nitelikler ve metotlar siniflar icinde
  konumlandirilmistir.
  </p>
</section>

</body>
</html>
`;
}

function css() {
  return `
@page { size: A4; margin: 20mm 18mm; }

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
  font-size: 9.5pt;
  letter-spacing: 0.32em;
  color: #5a5a5a;
  font-weight: 600;
  text-transform: uppercase;
  font-variant-caps: small-caps;
}
.cover-title {
  font-size: 38pt;
  font-weight: 700;
  margin-top: 8mm;
  line-height: 1.02;
  color: #0c0c0c;
  letter-spacing: -0.015em;
}
.cover-subtitle {
  font-size: 17pt;
  font-style: italic;
  font-weight: 500;
  margin: 4mm 0 0;
  color: #2b2b2b;
}
.cover-rule {
  border-top: 1px solid #1a1a1a;
  margin: 7mm 0;
}
.cover-meta {
  width: 110mm;
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
.diagram-figure figcaption {
  margin-top: 6pt;
  font-size: 9.5pt;
  color: #2b2b2b;
  font-style: italic;
  text-align: center;
}
`;
}
