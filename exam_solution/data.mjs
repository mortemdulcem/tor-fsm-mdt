// Class definitions and relationships for both exam questions.
// Each class is positioned manually for a clean, well-spaced layout.

// ---------------------------------------------------------------------------
// SORU 1 — Akilli Ev Cozumu
// Patterns: State (CalismaModu), Mediator (AkilliEvIzlemeMotoru), Observer (Sensor -> Motor -> Bildirim)
// Canvas: 1900 x 1500
// ---------------------------------------------------------------------------

export const soru1 = {
  width: 1900,
  height: 1700,
  title: "Soru 1 — Akıllı Ev Yönetim Sistemi",
  subtitle: "State + Mediator + Observer Örüntüleri",
  classes: [
    // ---- Kullanici katmani (ust) ----
    {
      id: "Kullanici",
      kind: "entity",
      name: "Kullanici",
      x: 60, y: 120, w: 240,
      attributes: [
        "- id : int",
        "- adSoyad : String",
        "- eposta : String",
      ],
      methods: [
        "+ uygulamalari() : List",
      ],
    },
    {
      id: "KullaniciBildirimAlici",
      kind: "interface",
      name: "KullaniciBildirimAlici",
      x: 420, y: 120, w: 340,
      attributes: [],
      methods: [
        "+ bildirimGoster(olay : SensorOlayi) : void",
        "+ durumYansit(ozet : DurumOzeti) : void",
      ],
    },
    {
      id: "MobilUygulama",
      kind: "concrete",
      name: "MobilUygulama",
      x: 800, y: 120, w: 240,
      attributes: ["- cihazId : String"],
      methods: [
        "+ bildirimGoster(olay) : void",
        "+ durumYansit(ozet) : void",
      ],
    },
    {
      id: "WebUygulamasi",
      kind: "concrete",
      name: "WebUygulamasi",
      x: 1100, y: 120, w: 240,
      attributes: ["- oturumKimligi : String"],
      methods: [
        "+ bildirimGoster(olay) : void",
        "+ durumYansit(ozet) : void",
      ],
    },
    {
      id: "DurumOzeti",
      kind: "value",
      name: "DurumOzeti",
      x: 1400, y: 120, w: 240,
      attributes: [
        "- sistemDurumlari : Map",
        "- sensorOkumalari : Map",
        "- aktifMod : ModTipi",
      ],
      methods: [],
    },

    // ---- Mediator (orta) ----
    {
      id: "AkilliEvIzlemeMotoru",
      kind: "mediator",
      name: "AkilliEvIzlemeMotoru",
      x: 580, y: 430, w: 540,
      stereotype: "<<mediator>> <<observer>>",
      attributes: [
        "- sistemler : List<EvSistemi>",
        "- sensorler : List<Sensor>",
        "- bildirimAlicilari : List<KullaniciBildirimAlici>",
        "- aktifModTipi : ModTipi",
      ],
      methods: [
        "+ sistemKaydet(s : EvSistemi) : void",
        "+ sensorKaydet(s : Sensor) : void",
        "+ bildirimAliciEkle(b : KullaniciBildirimAlici) : void",
        "+ tumModlariAyarla(tip : ModTipi) : void",
        "+ komutGonder(sistemId : int, komut : String) : void",
        "+ bildirimAl(olay : SensorOlayi) : void",
        "+ durumOzetiYayinla() : void",
      ],
    },

    // ---- Observer altyapisi (sol orta) ----
    {
      id: "SensorGozlemcisi",
      kind: "interface",
      name: "SensorGozlemcisi",
      x: 60, y: 430, w: 320,
      attributes: [],
      methods: [
        "+ bildirimAl(olay : SensorOlayi) : void",
      ],
    },
    {
      id: "SensorOlayi",
      kind: "value",
      name: "SensorOlayi",
      x: 60, y: 660, w: 320,
      attributes: [
        "- tip : SensorTipi",
        "- sensorId : int",
        "- veri : String",
        "- zaman : LocalDateTime",
      ],
      methods: [],
    },
    {
      id: "SensorTipi",
      kind: "enum",
      name: "SensorTipi",
      x: 60, y: 920, w: 200,
      attributes: ["KAPI", "HAREKET"],
      methods: [],
    },

    // ---- Sensorler (sol alt) ----
    {
      id: "Sensor",
      kind: "abstract",
      name: "Sensor",
      x: 290, y: 920, w: 320,
      attributes: [
        "# id : int",
        "# etkin : boolean",
        "# gozlemciler : List<SensorGozlemcisi>",
      ],
      methods: [
        "+ attach(o : SensorGozlemcisi) : void",
        "+ detach(o : SensorGozlemcisi) : void",
        "# bildir(olay : SensorOlayi) : void",
        "+ olcumGonder() : void  {abstract}",
      ],
    },
    {
      id: "KapiSensoru",
      kind: "concrete",
      name: "KapiSensoru",
      x: 60, y: 1240, w: 260,
      attributes: ["- acikMi : boolean"],
      methods: ["+ olcumGonder() : void"],
    },
    {
      id: "HareketSensoru",
      kind: "concrete",
      name: "HareketSensoru",
      x: 350, y: 1240, w: 260,
      attributes: ["- hareketAlgilandi : boolean"],
      methods: ["+ olcumGonder() : void"],
    },

    // ---- Sistemler (orta alt) ----
    {
      id: "EvSistemi",
      kind: "abstract",
      name: "EvSistemi",
      x: 660, y: 920, w: 360,
      attributes: [
        "# id : int",
        "# aktifMod : CalismaModu",
      ],
      methods: [
        "+ modAyarla(mod : CalismaModu) : void",
        "+ aktifModu() : CalismaModu",
        "+ durumGetir() : String",
        "+ komutCalistir(komut) : void  {abstract}",
      ],
    },
    {
      id: "AydinlatmaSistemi",
      kind: "concrete",
      name: "AydinlatmaSistemi",
      x: 660, y: 1240, w: 320,
      attributes: [
        "- ortamIsikSeviyesi : int",
        "- aydinlatmaKapasitesi : int",
      ],
      methods: [
        "+ asgariAydinlatmaUygula() : void",
        "+ maksimumAydinlatmaUygula() : void",
        "+ komutCalistir(komut) : void",
      ],
    },
    {
      id: "IsitmaSistemi",
      kind: "concrete",
      name: "IsitmaSistemi",
      x: 1020, y: 1240, w: 320,
      attributes: [
        "- hedefSicaklik : int",
        "- panelSicakligi : int",
      ],
      methods: [
        "+ sicaklikAyarla(derece : int) : void",
        "+ komutCalistir(komut) : void",
      ],
    },

    // ---- State pattern (sag) ----
    {
      id: "CalismaModu",
      kind: "interface",
      name: "CalismaModu",
      x: 1380, y: 920, w: 300,
      attributes: [],
      methods: [
        "+ uygula(sistem : EvSistemi) : void",
        "+ tipi() : ModTipi",
      ],
    },
    {
      id: "GuvenliMod",
      kind: "concrete",
      name: "GuvenliMod",
      x: 1380, y: 1170, w: 220,
      attributes: [],
      methods: [
        "+ uygula(sistem) : void",
        "+ tipi() : ModTipi",
      ],
    },
    {
      id: "TasarrufluMod",
      kind: "concrete",
      name: "TasarrufluMod",
      x: 1640, y: 1170, w: 220,
      attributes: [],
      methods: [
        "+ uygula(sistem) : void",
        "+ tipi() : ModTipi",
      ],
    },
    {
      id: "ModTipi",
      kind: "enum",
      name: "ModTipi",
      x: 1380, y: 1380, w: 220,
      attributes: ["GUVENLI", "TASARRUFLU"],
      methods: [],
    },
  ],
  relationships: [
    // Kullanici, soyutlamaya (interface) bağımlı: bildirim alıcısı arayüzünü kullanır
    { from: "Kullanici", fromSide: "right", to: "KullaniciBildirimAlici", toSide: "left", type: "association", mFrom: "1", mTo: "1..*", label: "kullanir" },
    // Realizasyonlar (interface implementations)
    { from: "MobilUygulama", fromSide: "bottom", fromOffset: 0.3, to: "KullaniciBildirimAlici", toSide: "bottom", toOffset: 0.7, type: "realization", routing: "orthogonal" },
    { from: "WebUygulamasi", fromSide: "bottom", fromOffset: 0.3, to: "KullaniciBildirimAlici", toSide: "bottom", toOffset: 0.9, type: "realization", routing: "orthogonal" },
    // Mediator → user notification
    { from: "AkilliEvIzlemeMotoru", fromSide: "top", fromOffset: 0.6, to: "KullaniciBildirimAlici", toSide: "bottom", toOffset: 0.5, type: "aggregation", mFrom: "1", mTo: "0..*", label: "bildirimAlicilari", routing: "orthogonal" },
    // Mediator publishes DurumOzeti
    { from: "AkilliEvIzlemeMotoru", fromSide: "top", fromOffset: 0.9, to: "DurumOzeti", toSide: "bottom", toOffset: 0.5, type: "dependency", label: "<<creates>>", routing: "orthogonal" },
    // Observer realization
    { from: "AkilliEvIzlemeMotoru", fromSide: "left", fromOffset: 0.5, to: "SensorGozlemcisi", toSide: "right", toOffset: 0.5, type: "realization" },
    // Sensor uses observer
    { from: "Sensor", fromSide: "top", fromOffset: 0.2, to: "SensorGozlemcisi", toSide: "bottom", toOffset: 0.5, type: "aggregation", mFrom: "1", mTo: "0..*", label: "gozlemciler", routing: "orthogonal" },
    // Not: Sensor.bildir(SensorOlayi) ve SensorOlayi.tip:SensorTipi
    // bağlantıları sınıf nitelik/imzaları üzerinden zaten görünür;
    // diyagramda ek ok çakışmasını önlemek için ayrıca çizilmemiştir.
    // Mediator owns Sensor (composition)
    { from: "AkilliEvIzlemeMotoru", fromSide: "bottom", fromOffset: 0.15, to: "Sensor", toSide: "top", toOffset: 0.6, type: "composition", mFrom: "1", mTo: "1..*", label: "sensorler", routing: "orthogonal" },
    // Mediator owns EvSistemi (composition)
    { from: "AkilliEvIzlemeMotoru", fromSide: "bottom", fromOffset: 0.6, to: "EvSistemi", toSide: "top", toOffset: 0.4, type: "composition", mFrom: "1", mTo: "1..*", label: "sistemler", routing: "orthogonal" },
    // Sensor inheritance
    { from: "KapiSensoru", fromSide: "top", to: "Sensor", toSide: "bottom", toOffset: 0.3, type: "inheritance", routing: "orthogonal" },
    { from: "HareketSensoru", fromSide: "top", to: "Sensor", toSide: "bottom", toOffset: 0.7, type: "inheritance", routing: "orthogonal" },
    // EvSistemi inheritance
    { from: "AydinlatmaSistemi", fromSide: "top", to: "EvSistemi", toSide: "bottom", toOffset: 0.3, type: "inheritance", routing: "orthogonal" },
    { from: "IsitmaSistemi", fromSide: "top", to: "EvSistemi", toSide: "bottom", toOffset: 0.7, type: "inheritance", routing: "orthogonal" },
    // EvSistemi → CalismaModu (State pattern)
    { from: "EvSistemi", fromSide: "right", fromOffset: 0.3, to: "CalismaModu", toSide: "left", toOffset: 0.5, type: "aggregation", mFrom: "1", mTo: "1", label: "aktifMod" },
    // CalismaModu realizations
    { from: "GuvenliMod", fromSide: "top", to: "CalismaModu", toSide: "bottom", toOffset: 0.3, type: "realization", routing: "orthogonal" },
    { from: "TasarrufluMod", fromSide: "top", to: "CalismaModu", toSide: "bottom", toOffset: 0.7, type: "realization", routing: "orthogonal" },
    // CalismaModu uses ModTipi
    { from: "GuvenliMod", fromSide: "bottom", fromOffset: 0.5, to: "ModTipi", toSide: "top", toOffset: 0.3, type: "dependency", routing: "orthogonal" },
    { from: "TasarrufluMod", fromSide: "bottom", fromOffset: 0.5, to: "ModTipi", toSide: "top", toOffset: 0.7, type: "dependency", routing: "orthogonal" },
  ],
  notes: [
    {
      // Mediator + Observer
      text: "Mediator + Observer:\nMotor merkezi yönlendiricidir; sensörler\nve sistemler birbirini doğrudan tanımaz.\nTüm olay akışı motor üzerinden geçer.",
      x: 1140, y: 430, w: 380,
      attachTo: "AkilliEvIzlemeMotoru",
      attachSide: "right",
    },
    {
      // State pattern note
      text: "State örüntüsü:\nEvSistemi yalnızca CalismaModu sözleşmesini\ntanır; davranış mod nesnesinde tutulur,\nfarklı modlar koşulsuz değiştirilebilir.",
      x: 1620, y: 770, w: 320,
      attachTo: "CalismaModu",
      attachSide: "top",
    },
    {
      // Open-Closed pattern note for KullaniciBildirimAlici
      text: "Açık/Kapalı İlkesi:\nYeni bildirim kanalı eklemek için\nKullaniciBildirimAlici'yi gerçekleştiren\nyeni bir sınıf yazmak yeterlidir.",
      x: 420, y: 0, w: 340,
      attachTo: "KullaniciBildirimAlici",
      attachSide: "top",
    },
  ],
};

// ---------------------------------------------------------------------------
// SORU 2 — SimpleCar E-Satis
// Patterns: Strategy (OdemeYontemi), CoR (SiparisKontrolu), Command + Macro (SiparisIsleyici)
// ---------------------------------------------------------------------------

export const soru2 = {
  width: 1900,
  height: 1620,
  title: "Soru 2 — SimpleCar E-Satış Sistemi",
  subtitle: "Strategy + Chain of Responsibility + Command + Memento Örüntüleri",
  classes: [
    // ---- Domain (ust orta) ----
    {
      id: "Musteri",
      kind: "entity",
      name: "Musteri",
      x: 60, y: 60, w: 280,
      attributes: [
        "- id : int",
        "- ad : String",
        "- eposta : String",
        "- hesapBakiyesi : double",
      ],
      methods: [
        "+ bakiyeyiGetir() : double",
      ],
    },
    {
      id: "Siparis",
      kind: "entity",
      name: "Siparis",
      x: 400, y: 60, w: 360,
      attributes: [
        "- id : int",
        "- musteri : Musteri",
        "- miktar : int",
        "- tutar : double",
        "- odemeYontemi : OdemeYontemi",
        "- durum : SiparisDurumu",
        "/ toplamTutar : double",
      ],
      methods: [
        "+ iptalEt() : void",
        "+ tamamlandiOlarakIsaretle() : void",
        "+ odemeAl() : boolean",
        "+ durumKaydiOlustur() : SiparisDurumKaydi",
        "+ kayittanGeriYukle(k : SiparisDurumKaydi) : void",
      ],
    },
    {
      id: "SiparisDurumKaydi",
      kind: "value",
      name: "SiparisDurumKaydi",
      x: 820, y: 60, w: 320,
      stereotype: "<<memento>>",
      attributes: [
        "- durum : SiparisDurumu",
        "- tutarKopya : double",
        "- yanEtkiIzleri : List<String>",
        "- zaman : LocalDateTime",
      ],
      methods: [],
    },
    {
      id: "SiparisDurumu",
      kind: "enum",
      name: "SiparisDurumu",
      x: 820, y: 340, w: 260,
      attributes: [
        "ALINDI",
        "KONTROL_EDILIYOR",
        "ONAYLANDI",
        "IPTAL_EDILDI",
        "ISLENDI",
      ],
      methods: [],
    },

    // ---- Strategy: OdemeYontemi (sag ust) ----
    {
      id: "OdemeYontemi",
      kind: "interface",
      name: "OdemeYontemi",
      x: 1140, y: 60, w: 320,
      attributes: [],
      methods: [
        "+ odemeYap(tutar : double) : boolean",
        "+ adi() : String",
      ],
    },
    {
      id: "BankaHavalesi",
      kind: "concrete",
      name: "BankaHavalesi",
      x: 1140, y: 320, w: 240,
      attributes: ["- ibanNumarasi : String"],
      methods: ["+ odemeYap(tutar) : boolean", "+ adi() : String"],
    },
    {
      id: "Paypal",
      kind: "concrete",
      name: "Paypal",
      x: 1410, y: 320, w: 220,
      attributes: ["- hesapEpostasi : String"],
      methods: ["+ odemeYap(tutar) : boolean", "+ adi() : String"],
    },
    {
      id: "SogukCuzdan",
      kind: "concrete",
      name: "SogukCuzdan",
      x: 1660, y: 320, w: 220,
      attributes: ["- cuzdanAdresi : String"],
      methods: ["+ odemeYap(tutar) : boolean", "+ adi() : String"],
    },

    // ---- Orchestrator ----
    {
      id: "SiparisYoneticisi",
      kind: "service",
      name: "SiparisYoneticisi",
      x: 660, y: 560, w: 460,
      attributes: [
        "- kontrolZinciri : SiparisKontrolu",
        "- isleyici : SiparisIsleyici",
      ],
      methods: [
        "+ siparisAl(s : Siparis) : void",
        "- kontrolleriCalistir(s : Siparis) : boolean",
        "- siparisiIsle(s : Siparis) : void",
      ],
    },

    // ---- CoR: Kontroller (sol orta) ----
    {
      id: "SiparisKontrolu",
      kind: "abstract",
      name: "SiparisKontrolu",
      x: 60, y: 560, w: 360,
      attributes: [
        "# sonraki : SiparisKontrolu",
      ],
      methods: [
        "+ setSonraki(k : SiparisKontrolu) : void",
        "+ kontrolEt(s : Siparis) : boolean",
        "# kontroluUygula(s) : boolean {abstract}",
        "# sonrakiniCagir(s : Siparis) : boolean",
      ],
    },
    {
      id: "SahtecilikKontrolu",
      kind: "concrete",
      name: "SahtecilikKontrolu",
      x: 60, y: 820, w: 260,
      attributes: [
        "- riskEsigi : double = 0.7",
        "- karaListe : Set<String>",
      ],
      methods: [
        "# kontroluUygula(s) : boolean",
        "- riskSkoru(s) : double",
      ],
    },
    {
      id: "LimitKontrolu",
      kind: "concrete",
      name: "LimitKontrolu",
      x: 340, y: 820, w: 260,
      attributes: [
        "- gunlukLimit : double = 50000",
        "- islemLimiti : double = 10000",
      ],
      methods: [
        "# kontroluUygula(s) : boolean",
        "- gunlukToplam(m) : double",
      ],
    },
    {
      id: "BakiyeKontrolu",
      kind: "concrete",
      name: "BakiyeKontrolu",
      x: 620, y: 820, w: 260,
      attributes: [
        "- kilit : Lock",
      ],
      methods: [
        "# kontroluUygula(s) : boolean",
        "- bakiyeyiRezerveEt(s) : void",
      ],
    },

    // ---- Command: Siparis isleme (alt orta-sag) ----
    {
      id: "Komut",
      kind: "interface",
      name: "Komut",
      x: 1180, y: 800, w: 320,
      attributes: [],
      methods: [
        "+ calistir(s : Siparis) : void",
        "+ geriAl(s : Siparis, k : SiparisDurumKaydi) : void",
        "+ aciklama() : String",
      ],
    },
    {
      id: "SiparisIsleyici",
      kind: "service",
      name: "SiparisIsleyici",
      x: 1180, y: 560, w: 320,
      stereotype: "<<macro command>> <<caretaker>>",
      attributes: [
        "- komutlar : List<Komut>",
        "- kayitlar : Stack<SiparisDurumKaydi>",
      ],
      methods: [
        "+ komutEkle(k : Komut) : void",
        "+ tumKomutlariCalistir(s : Siparis) : void",
        "- hataDurumundaGeriAl(s : Siparis) : void",
      ],
    },
    {
      id: "FaturaDuzenle",
      kind: "concrete",
      name: "FaturaDuzenle",
      x: 1180, y: 1060, w: 260,
      attributes: [],
      methods: ["+ calistir(s) : void", "+ geriAl(s, k) : void", "+ aciklama() : String"],
    },
    {
      id: "FaturaGonder",
      kind: "concrete",
      name: "FaturaGonder",
      x: 1470, y: 1060, w: 260,
      attributes: [],
      methods: ["+ calistir(s) : void", "+ geriAl(s, k) : void", "+ aciklama() : String"],
    },
    {
      id: "AlacaklaraKaydet",
      kind: "concrete",
      name: "AlacaklaraKaydet",
      x: 1180, y: 1300, w: 320,
      attributes: [],
      methods: ["+ calistir(s) : void", "+ geriAl(s, k) : void", "+ aciklama() : String"],
    },
    {
      id: "Fatura",
      kind: "entity",
      name: "Fatura",
      x: 720, y: 1060, w: 260,
      attributes: [
        "- faturaNo : String",
        "- tutar : double",
        "- musteri : Musteri",
        "- siparis : Siparis",
      ],
      methods: [],
    },
  ],
  relationships: [
    // Domain
    { from: "Siparis", fromSide: "left", fromOffset: 0.35, to: "Musteri", toSide: "right", toOffset: 0.5, type: "association", mFrom: "0..*", mTo: "1", label: "alici" },
    // Strategy: Siparis -<>- OdemeYontemi, ust uzerinden dolastirilir (SiparisDurumKaydi'nin uzerinden gecmesin)
    { from: "Siparis", fromSide: "top", fromOffset: 0.92, to: "OdemeYontemi", toSide: "top", toOffset: 0.15, type: "aggregation", mFrom: "1", mTo: "1", label: "odemeYontemi", routing: "orthogonal" },
    { from: "BankaHavalesi", fromSide: "top", to: "OdemeYontemi", toSide: "bottom", toOffset: 0.2, type: "realization", routing: "orthogonal" },
    { from: "Paypal", fromSide: "top", to: "OdemeYontemi", toSide: "bottom", toOffset: 0.5, type: "realization", routing: "orthogonal" },
    { from: "SogukCuzdan", fromSide: "top", to: "OdemeYontemi", toSide: "bottom", toOffset: 0.8, type: "realization", routing: "orthogonal" },
    // Orchestrator
    { from: "SiparisYoneticisi", fromSide: "left", fromOffset: 0.45, to: "SiparisKontrolu", toSide: "right", toOffset: 0.5, type: "association", mFrom: "1", mTo: "0..1", label: "kontrolZinciri" },
    { from: "SiparisYoneticisi", fromSide: "right", fromOffset: 0.5, to: "SiparisIsleyici", toSide: "left", toOffset: 0.5, type: "composition", mFrom: "1", mTo: "1", label: "isleyici" },
    { from: "SiparisYoneticisi", fromSide: "top", fromOffset: 0.15, to: "Siparis", toSide: "bottom", toOffset: 0.5, type: "dependency", label: "isler", routing: "orthogonal" },
    // CoR self link
    { from: "SiparisKontrolu", fromSide: "top", fromOffset: 0.85, to: "SiparisKontrolu", toSide: "right", toOffset: 0.15, type: "association", mFrom: "0..1", mTo: "0..1", label: "sonraki", routing: "selfLoop" },
    // CoR inheritance
    { from: "SahtecilikKontrolu", fromSide: "top", to: "SiparisKontrolu", toSide: "bottom", toOffset: 0.2, type: "inheritance", routing: "orthogonal" },
    { from: "LimitKontrolu", fromSide: "top", to: "SiparisKontrolu", toSide: "bottom", toOffset: 0.5, type: "inheritance", routing: "orthogonal" },
    { from: "BakiyeKontrolu", fromSide: "top", to: "SiparisKontrolu", toSide: "bottom", toOffset: 0.8, type: "inheritance", routing: "orthogonal" },
    // Command aggregation
    { from: "SiparisIsleyici", fromSide: "bottom", fromOffset: 0.5, to: "Komut", toSide: "top", toOffset: 0.5, type: "aggregation", mFrom: "1", mTo: "1..*", label: "komutlar {ordered}", routing: "orthogonal" },
    // Command realizations
    { from: "FaturaDuzenle", fromSide: "top", to: "Komut", toSide: "bottom", toOffset: 0.2, type: "realization", routing: "orthogonal" },
    { from: "FaturaGonder", fromSide: "top", to: "Komut", toSide: "bottom", toOffset: 0.7, type: "realization", routing: "orthogonal" },
    { from: "AlacaklaraKaydet", fromSide: "top", fromOffset: 0.78, to: "Komut", toSide: "bottom", toOffset: 0.89, type: "realization", routing: "orthogonal" },
    // Fatura usage
    { from: "FaturaDuzenle", fromSide: "left", fromOffset: 0.5, to: "Fatura", toSide: "right", toOffset: 0.5, type: "dependency", label: "<<creates>>" },
    // Memento: Siparis creates SiparisDurumKaydi (caretaker SiparisIsleyici tutar)
    { from: "Siparis", fromSide: "right", fromOffset: 0.5, to: "SiparisDurumKaydi", toSide: "left", toOffset: 0.5, type: "dependency", label: "<<creates>>" },
    // Enum kullanim: durum tipi olarak SiparisDurumu'na bagimlilik
    { from: "Siparis", fromSide: "right", fromOffset: 0.95, to: "SiparisDurumu", toSide: "left", toOffset: 0.5, type: "dependency", label: "<<uses>>", routing: "orthogonal" },
    { from: "SiparisDurumKaydi", fromSide: "bottom", fromOffset: 0.4, to: "SiparisDurumu", toSide: "top", toOffset: 0.5, type: "dependency", label: "<<uses>>" },
  ],
  notes: [
    {
      // CoR / Template Method aciklamasi
      text: "Şablon Yöntem:\nkontrolEt(s) sabit kalır;\nalt sınıf sadece\nkontroluUygula(s) yazar.\nHalka düşerse zincir kırılır.",
      x: 60, y: 400, w: 360,
      attachTo: "SiparisKontrolu",
      attachSide: "top",
    },
    {
      // Macro Command + Memento (Saga benzeri telafi)
      text: "Macro Command + Memento:\nSiparisIsleyici (caretaker) her komut\nöncesi durumKaydiOlustur() çağırır,\nkaydı yığına atar. n. komut hata verirse\nn-1..1 sırasıyla geriAl(s, k) çalışır:\nbu, Saga benzeri yerel telafi sağlar\n(GoF Command, s.237 — Memento iliştirme).",
      x: 1530, y: 530, w: 380,
      attachTo: "SiparisIsleyici",
      attachSide: "right",
    },
    {
      // Strategy aciklamasi
      text: "Strategy: Sipariş kendi ödeme yöntemini taşır.\nYönetici hangi sınıf olduğunu bilmez;\nyalnızca odemeYap(tutar) sözleşmesini çağırır.",
      x: 1500, y: 60, w: 380,
      attachTo: "OdemeYontemi",
      attachSide: "right",
    },
  ],
};

// ---------------------------------------------------------------------------
// SORU 2 EK — Cografi Genisleme (Multi-Region)
// Mevcut tasarima ek olarak ulkelere gore paket kuran Abstract Factory + Para
// ---------------------------------------------------------------------------

export const soru2_bolge = {
  width: 1700,
  height: 720,
  title: "Soru 2 (Ek) — Coğrafi Genişleme",
  subtitle: "Abstract Factory + Money Value Object: ülke başına farklı paket, mevcut sınıflar değişmez",
  classes: [
    {
      id: "Para",
      kind: "concrete",
      name: "Para",
      stereotype: "<<value object>>",
      x: 60, y: 60, w: 240,
      attributes: [
        "- miktar : double",
        "- birim : ParaBirimi",
      ],
      methods: [
        "+ topla(p : Para) : Para",
        "+ cevir(hedef : ParaBirimi) : Para",
      ],
    },
    {
      id: "ParaBirimi",
      kind: "enum",
      name: "ParaBirimi",
      x: 60, y: 360, w: 240,
      attributes: ["TRY", "EUR", "USD", "GBP", "..."],
      methods: [],
    },
    {
      id: "SiparisRef",
      kind: "entity",
      name: "Siparis",
      x: 360, y: 60, w: 280,
      attributes: [
        "- tutar : Para     (degisti)",
        "- ulke : Ulke      (yeni)",
        "...",
      ],
      methods: [],
    },
    {
      id: "BolgeKonfigurasyonu",
      kind: "interface",
      name: "BolgeKonfigurasyonu",
      stereotype: "<<abstract factory>>",
      x: 700, y: 60, w: 420,
      attributes: [],
      methods: [
        "+ desteklenenOdemeler() : List<OdemeYontemi>",
        "+ kontrolZinciri() : SiparisKontrolu",
        "+ islemeKomutlari() : List<Komut>",
        "+ paraBirimi() : ParaBirimi",
      ],
    },
    {
      id: "SiparisYoneticisiRef",
      kind: "service",
      name: "SiparisYoneticisi",
      x: 1180, y: 60, w: 320,
      stereotype: "<<service>>",
      attributes: ["- konf : BolgeKonfigurasyonu"],
      methods: ["+ siparisAl(s : Siparis) : void"],
    },
    {
      id: "TrKonfigurasyonu",
      kind: "concrete",
      name: "TrKonfigurasyonu",
      x: 460, y: 440, w: 320,
      attributes: [],
      methods: [
        "+ desteklenenOdemeler()  : {Havale, Paypal}",
        "+ kontrolZinciri()       : Sahtecilik->Limit->Bakiye->KvkkOnay",
        "+ islemeKomutlari()      : EFatura->Gonder->AlacakKayit",
        "+ paraBirimi()           : TRY",
      ],
    },
    {
      id: "DeKonfigurasyonu",
      kind: "concrete",
      name: "DeKonfigurasyonu",
      x: 880, y: 440, w: 360,
      attributes: [],
      methods: [
        "+ desteklenenOdemeler()  : {SEPA, Paypal, SogukCuzdan}",
        "+ kontrolZinciri()       : Sahtecilik->Limit->Bakiye->GdprOnay->Yaptirim",
        "+ islemeKomutlari()      : Fatura->Gumruk->Gonder->AlacakKayit",
        "+ paraBirimi()           : EUR",
      ],
    },
  ],
  relationships: [
    // Para-ParaBirimi
    { from: "Para", fromSide: "bottom", fromOffset: 0.5, to: "ParaBirimi", toSide: "top", toOffset: 0.5, type: "dependency", label: "<<uses>>" },
    // Siparis tutar : Para
    { from: "SiparisRef", fromSide: "left", fromOffset: 0.5, to: "Para", toSide: "right", toOffset: 0.5, type: "aggregation", mFrom: "1", mTo: "1", label: "tutar" },
    // SiparisYoneticisi -> BolgeKonfigurasyonu
    { from: "SiparisYoneticisiRef", fromSide: "left", fromOffset: 0.5, to: "BolgeKonfigurasyonu", toSide: "right", toOffset: 0.5, type: "dependency", label: "<<uses>>" },
    // Realizations
    { from: "TrKonfigurasyonu", fromSide: "top", fromOffset: 0.5, to: "BolgeKonfigurasyonu", toSide: "bottom", toOffset: 0.35, type: "realization", routing: "orthogonal" },
    { from: "DeKonfigurasyonu", fromSide: "top", fromOffset: 0.5, to: "BolgeKonfigurasyonu", toSide: "bottom", toOffset: 0.7, type: "realization", routing: "orthogonal" },
  ],
  notes: [
    {
      text: "Mevcut sinif diyagrami DEGISMEZ:\nOdemeYontemi, SiparisKontrolu, Komut\nzaten birer arayuz/soyut sinif.\nAbstract Factory yalnizca bunlardan\n'dogru takimi' kurar -> SiparisYoneticisi'ne\nverir. Mevcut Strategy/CoR/Command/Memento\nsiniflarinda tek satir bile degismez.",
      x: 1280, y: 380, w: 380,
      attachTo: "DeKonfigurasyonu",
      attachSide: "right",
    },
  ],
};

// ---------------------------------------------------------------------------
// SEQUENCE DIAGRAMS
// ---------------------------------------------------------------------------

export const sekans_soru1_sensor = {
  width: 1900,
  height: 1100,
  title: "Sekans 1 — Hareket Sensörü Tetiklendiğinde",
  subtitle: "Observer + Mediator zinciri: Sensor -> Motor -> EvSistemi & KullaniciBildirimAlici",
  actors: [
    { id: "ks",    label: "h : HareketSensoru", kind: "object" },
    { id: "motor", label: "m : AkilliEvIzlemeMotoru", kind: "mediator" },
    { id: "isi",   label: "i : IsitmaSistemi",   kind: "object" },
    { id: "ayd",   label: "a : AydinlatmaSistemi", kind: "object" },
    { id: "mob",   label: "u : MobilUygulama",  kind: "boundary" },
  ],
  messages: [
    { from: "ks",    to: "ks",    label: "olcumGonder()", kind: "self", note: "Yerel polling/donanım olayı" },
    { from: "ks",    to: "motor", label: "bildirimAl(olay : SensorOlayi)", kind: "sync" },
    { from: "motor", to: "motor", label: "ilgiliSistemleriBul(olay)", kind: "self" },
    { from: "motor", to: "ayd",   label: "komutCalistir(\"hareketAlgilandi\")", kind: "sync" },
    { from: "ayd",   to: "motor", label: "(donus)", kind: "return" },
    { from: "motor", to: "isi",   label: "komutCalistir(\"hareketAlgilandi\")", kind: "sync" },
    { from: "isi",   to: "motor", label: "(donus)", kind: "return" },
    { from: "motor", to: "motor", label: "durumOzetiYayinla()", kind: "self" },
    { from: "motor", to: "mob",   label: "bildirimGoster(olay)", kind: "async" },
    { from: "motor", to: "mob",   label: "durumYansit(durumOzeti)", kind: "async" },
    { from: "motor", to: "ks",    label: "(akis tamam)", kind: "return" },
  ],
};

export const sekans_soru1_mod = {
  width: 1900,
  height: 1050,
  title: "Sekans 2 — Kullanıcı Mod Değişikliği",
  subtitle: "State + Mediator: tek bir mod değiştirimi tüm bağlı sistemleri ve istemcileri eşleştirir",
  actors: [
    { id: "k",   label: "k : Kullanici", kind: "actor" },
    { id: "mob", label: "u : MobilUygulama", kind: "boundary" },
    { id: "m",   label: "m : AkilliEvIzlemeMotoru", kind: "mediator" },
    { id: "ayd", label: "a : AydinlatmaSistemi", kind: "object" },
    { id: "isi", label: "i : IsitmaSistemi", kind: "object" },
    { id: "tm",  label: "t : TasarrufluMod", kind: "object" },
  ],
  messages: [
    { from: "k",   to: "mob", label: "modDegistir(TASARRUFLU)", kind: "sync" },
    { from: "mob", to: "m",   label: "tumModlariAyarla(TASARRUFLU)", kind: "sync" },
    { from: "m",   to: "tm",  label: "<<create>>", kind: "create", note: "Yeni TasarrufluMod nesnesi oluşturulur (State)" },
    { from: "m",   to: "ayd", label: "modAyarla(t)", kind: "sync" },
    { from: "ayd", to: "tm",  label: "uygula(this)", kind: "sync" },
    { from: "tm",  to: "ayd", label: "asgariAydinlatmaUygula()", kind: "sync" },
    { from: "ayd", to: "m",   label: "(donus)", kind: "return" },
    { from: "m",   to: "isi", label: "modAyarla(t)", kind: "sync" },
    { from: "isi", to: "tm",  label: "uygula(this)", kind: "sync" },
    { from: "tm",  to: "isi", label: "sicaklikAyarla(18)", kind: "sync" },
    { from: "isi", to: "m",   label: "(donus)", kind: "return" },
    { from: "m",   to: "m",   label: "durumOzetiYayinla()", kind: "self" },
    { from: "m",   to: "mob", label: "durumYansit(ozet)", kind: "async" },
    { from: "mob", to: "k",   label: "ekran guncelle", kind: "return" },
  ],
};

export const sekans_soru2 = {
  width: 1900,
  height: 1300,
  title: "Sekans 3 — Sipariş Yaşam Döngüsü",
  subtitle: "CoR (kontroller) + Strategy (ödeme) + Command (sıralı işleme adımları)",
  actors: [
    { id: "musteri", label: ": Musteri", kind: "actor" },
    { id: "yon",     label: "y : SiparisYoneticisi", kind: "service" },
    { id: "k1",      label: "sk : SahtecilikKontrolu", kind: "object" },
    { id: "k2",      label: "lk : LimitKontrolu", kind: "object" },
    { id: "k3",      label: "bk : BakiyeKontrolu", kind: "object" },
    { id: "siparis", label: "s : Siparis", kind: "object" },
    { id: "odeme",   label: ": OdemeYontemi", kind: "object" },
    { id: "isleyici",label: "i : SiparisIsleyici", kind: "object" },
  ],
  messages: [
    { from: "musteri", to: "yon",   label: "siparisAl(s)", kind: "sync" },
    { from: "yon",    to: "yon",    label: "kontrolleriCalistir(s)", kind: "self" },
    { from: "yon",    to: "k1",     label: "kontrolEt(s)", kind: "sync" },
    { from: "k1",     to: "k1",     label: "kontroluUygula(s)", kind: "self", note: "Sahtecilik değerlendirmesi" },
    { from: "k1",     to: "k2",     label: "kontrolEt(s)", kind: "sync" },
    { from: "k2",     to: "k2",     label: "kontroluUygula(s)", kind: "self", note: "Tutar limit kontrolü" },
    { from: "k2",     to: "k3",     label: "kontrolEt(s)", kind: "sync" },
    { from: "k3",     to: "k3",     label: "kontroluUygula(s)", kind: "self", note: "Müşteri bakiye kontrolü" },
    { from: "k3",     to: "k2",     label: "true", kind: "return" },
    { from: "k2",     to: "k1",     label: "true", kind: "return" },
    { from: "k1",     to: "yon",    label: "true", kind: "return" },
    { from: "yon",    to: "siparis", label: "odemeAl()", kind: "sync", note: "Strategy: sipariş kendi yöntemini taşır" },
    { from: "siparis", to: "odeme", label: "odemeYap(tutar)", kind: "sync" },
    { from: "odeme",  to: "siparis", label: "true", kind: "return" },
    { from: "siparis", to: "yon",   label: "true", kind: "return" },
    { from: "yon",    to: "isleyici", label: "tumKomutlariCalistir(s)", kind: "sync" },
    { from: "isleyici", to: "isleyici", label: "FaturaDuzenle.calistir(s)", kind: "self" },
    { from: "isleyici", to: "isleyici", label: "FaturaGonder.calistir(s)", kind: "self" },
    { from: "isleyici", to: "isleyici", label: "AlacaklaraKaydet.calistir(s)", kind: "self" },
    { from: "isleyici", to: "yon",   label: "(donus)", kind: "return" },
    { from: "yon",    to: "musteri", label: "siparis onaylandi", kind: "return" },
  ],
};
