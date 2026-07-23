// Çalışmanın TAM içeriğini, hocanın Template şablonuna (8 bölüm) uygun, "çalışma"
// terminolojisiyle, marka ifadeleri olmadan, profesyonel akademik tasarımla .docx üretir.
// İçerik kaynağı thesis.html'dir (kısaltma YOK). Bloklar puppeteer ile çıkarılır, SVG
// figürler PNG'ye rasterize edilir, bölümler 8'li şablona yeniden eşlenir, tüm bölüm
// çapraz referansları deterministik haritayla yeniden numaralandırılır.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import sharp from "sharp";
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell,
  WidthType, BorderStyle, ImageRun, Header, Footer, PageNumber,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "thesis.html");
const outPath = path.join(__dirname, "Tor_FSM_Calisma.docx");

const puppeteer = (await import(path.resolve(__dirname, "../node_modules/puppeteer-core/lib/cjs/puppeteer/puppeteer-core.js"))).default;

const ACCENT = "14304E";   // koyu lacivert
const ACCENT2 = "3B6BA5";  // ikincil mavi
const GRAY = "555555";
const HEADFONT = "Arial";
const BODYFONT = "Times New Roman";
const SHORT_TITLE = "Tor FSM ile Geçersiz Durum Geçişi Tespiti";

// ---- Eski (tez) → Yeni (çalışma) bölüm numarası haritası ----
const REFMAP = {
  "1": "1", "1.1": "1.1", "1.2": "1.2", "1.3": "1.3", "1.4": "1.4",
  "2": "2", "2.1": "2.1", "2.2": "2.2", "2.3": "2.3", "2.4": "2.4", "2.5": "2.5", "2.6": "2.6", "2.7": "2.7", "2.8": "2.8",
  "3": "3", "3.1": "3.1", "3.2": "3.2", "3.3": "3.3", "3.4": "3.4",
  "4.1": "4.1", "4.12": "4.2", "4.14": "4.3", "4.11.2": "4.4", "4.15": "4.5",
  "4.2": "5.1", "4.3": "5.2", "4.5": "5.3", "4.6": "5.4", "4.7": "5.5", "4.8": "5.6", "4.9": "5.7", "4.10": "5.8",
  "4.11.1": "5.9", "4.11.3": "5.10", "4.13": "5.11", "4.16": "5.12", "4.17": "5.13", "4.17d": "5.13d",
  "4.11": "5.10",
  "4.4": "6.1",
  "5": "5.14",
  "6.1": "6.2",
  "6.2": "7", "6.2.1": "7.1", "6.2.2": "7.2",
  "6.3": "8", "6.3.1": "8.1", "6.3.2": "8.2", "6.3.3": "8.3", "6.3.4": "8.4",
  "6": "8",
};

// ---- Metin temizleme: referans remap + terminoloji + marka temizliği ----
function cleanText(s) {
  if (!s) return s;
  // (1) çıplak "Bölüm 4" özel cümleleri → placeholder (generic remap'ten korunur)
  s = s.replace(/Bölüm 4 deney tasarımını/g, "§§REFA§§ deney tasarımını");
  s = s.replace(/Bölüm 4'teki/g, "§§REFB§§");
  // (1b) bölüm referans ARALIKLARI — eski bitişik aralık yeni numaralandırmada dağıldığı
  //      için bağlama uygun temiz ifadeyle (placeholder ile generic remap'ten korunur)
  s = s.replace(/Bölüm 4\.10-4\.14 ve 6\.2\.1/g, "§§RR5§§")
       .replace(/Bölüm 4\.16[–-]4\.17/g, "§§RR2§§")
       .replace(/Bölüm 4\.1-4\.13/g, "§§RR3§§")
       .replace(/Bölüm 4\.6-4\.11/g, "§§RR4§§")
       .replace(/Bölüm 6\.3-4/g, "§§RR1§§");
  // (2) generic bölüm referansları (Bölüm/Section/§ önekli) — bilinmeyen → throw
  s = s.replace(/(Bölümler|Bölüm|Section|§)(\s?)(\d+(?:\.\d+){0,2}[a-z]?)/g, (m, kw, sp, num) => {
    const nn = REFMAP[num];
    if (nn === undefined) throw new Error("Eşlenmemiş bölüm referansı: '" + m + "' (num=" + num + ")");
    return kw + (sp || " ") + nn;
  });
  // (3) harfli deney etiketleri (X.Y-A / X.Y.Z-B) — önekleri aynı haritayla; tutarlı kalır
  s = s.replace(/\b(\d+(?:\.\d+){1,2})-([A-D])\b/g, (m, num, letter) => {
    const nn = REFMAP[num];
    return nn === undefined ? m : nn + "-" + letter;
  });
  // (4) çıplak parantezli bölüm referansları (önek yok)
  s = s.replace(/\(6\.3\.1\)/g, "(8.1)").replace(/\(6\.3\.2\)/g, "(8.2)").replace(/\(6\.3\.3\)/g, "(8.3)");
  // (5) placeholder geri yükle
  s = s.replace(/§§REFA§§/g, "Bölüm 4 ve 5").replace(/§§REFB§§/g, "Bölüm 5'teki")
       .replace(/§§RR1§§/g, "Bölüm 8").replace(/§§RR2§§/g, "Bölüm 5.12–5.13")
       .replace(/§§RR3§§/g, "Bölüm 4 ve 5").replace(/§§RR4§§/g, "Bölüm 5.4–5.10")
       .replace(/§§RR5§§/g, "Bölüm 4 ve 5 ile 7.1");
  // (6) terminoloji: tez → çalışma (uzun/ekli formlar önce; hipotez/sentez vb. korunur)
  s = s.replace(/Tezin Yapısı/g, "Çalışmanın Yapısı").replace(/Tez Taslağı/g, "Çalışma")
       .replace(/\btezimizin\b/g, "çalışmamızın").replace(/\bTezimizin\b/g, "Çalışmamızın")
       .replace(/\btezimiz\b/g, "çalışmamız").replace(/\bTezimiz\b/g, "Çalışmamız")
       .replace(/\btezdeki\b/g, "çalışmadaki").replace(/\bTezdeki\b/g, "Çalışmadaki")
       .replace(/\btezden\b/g, "çalışmadan").replace(/\bTezden\b/g, "Çalışmadan")
       .replace(/\btezde\b/g, "çalışmada").replace(/\bTezde\b/g, "Çalışmada")
       .replace(/\btezin\b/g, "çalışmanın").replace(/\bTezin\b/g, "Çalışmanın")
       .replace(/\bteze\b/g, "çalışmaya").replace(/\bTeze\b/g, "Çalışmaya")
       .replace(/\btezi\b/g, "çalışmayı").replace(/\bTezi\b/g, "Çalışmayı")
       .replace(/\btez\b/g, "çalışma").replace(/\bTez\b/g, "Çalışma");
  // (7) marka / ortam ifadeleri temizliği
  s = s.replace(/Replit NixOS sandbox/gi, "izole geliştirme ortamı")
       .replace(/Replit NixOS container'ıdır/g, "izole bir Linux container'ıdır")
       .replace(/Replit NixOS container'ı/g, "izole Linux container'ı")
       .replace(/\s*\(örn\. Claude Code, Devin\)/g, "")
       .replace(/\s*\(Claude Code, Devin\)/g, "")
       .replace(/Claude Code, Devin/g, "otonom kod ajanları")
       .replace(/Claude Code/g, "otonom kod ajanı")
       .replace(/\bDevin\b/g, "")
       .replace(/\bReplit\b/g, "izole geliştirme ortamı")
       .replace(/\bLLM\b/g, "dil modeli");
  // (8) boşluk düzeltme
  s = s.replace(/\(\s*\)/g, "").replace(/ {2,}/g, " ").replace(/ ([,.;:])/g, "$1");
  return s;
}

const browser = await puppeteer.launch({
  executablePath: execSync("which chromium").toString().trim(),
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

async function run() {
  const page = await browser.newPage();
  await page.setViewport({ width: 1120, height: 1500, deviceScaleFactor: 2 });
  await page.goto("file://" + htmlPath, { waitUntil: "networkidle0" });

  const svgCount = await page.evaluate(() => {
    const svgs = Array.from(document.querySelectorAll("svg"));
    svgs.forEach((s, i) => s.setAttribute("data-fig-idx", String(i)));
    return svgs.length;
  });
  const svgPngs = [];
  for (let i = 0; i < svgCount; i++) {
    const handle = await page.$(`svg[data-fig-idx="${i}"]`);
    const buf = await handle.screenshot({ type: "png" });
    const meta = await sharp(buf).metadata();
    svgPngs.push({ buf, w: meta.width, h: meta.height });
  }

  const blocks = await page.evaluate(() => {
    const inlineRuns = (el) => {
      const runs = [];
      const rec = (node) => {
        if (node.nodeType === 3) {
          const raw = node.textContent.replace(/\s+/g, " ");
          if (raw === "") return;
          const cs = node.parentElement ? getComputedStyle(node.parentElement) : null;
          const fw = cs ? cs.fontWeight : "400";
          runs.push({
            text: raw,
            bold: cs ? (fw === "bold" || (+fw >= 600)) : false,
            italic: cs ? cs.fontStyle === "italic" : false,
            mono: cs ? /courier|mono/i.test(cs.fontFamily) : false,
          });
          return;
        }
        if (node.nodeType !== 1) return;
        if (node.tagName === "BR") { runs.push({ br: true }); return; }
        node.childNodes.forEach(rec);
      };
      el.childNodes.forEach(rec);
      return runs;
    };
    const isBlockEl = (el) => {
      const t = el.tagName.toUpperCase();
      if (t === "IMG" || el.tagName.toLowerCase() === "svg") return true;
      return /^(DIV|P|H1|H2|H3|H4|TABLE|UL|OL|PRE|FIGURE|BLOCKQUOTE)$/.test(t);
    };
    const alignOf = (el) => getComputedStyle(el).textAlign;
    const extractTable = (table) => {
      const trs = Array.from(table.querySelectorAll("tr"));
      const rows = trs.map((tr) =>
        Array.from(tr.children).map((cell) => ({
          header: cell.tagName.toUpperCase() === "TH",
          align: getComputedStyle(cell).textAlign,
          colspan: cell.colSpan || 1,
          runs: inlineRuns(cell),
        }))
      );
      return { type: "table", rows };
    };
    const out = [];
    const walk = (el) => {
      for (const child of Array.from(el.children)) {
        const tag = child.tagName.toUpperCase();
        const lc = child.tagName.toLowerCase();
        if (child.classList && child.classList.contains("pagebreak")) { out.push({ type: "pagebreak" }); continue; }
        if (/^H[1-4]$/.test(tag)) { out.push({ type: tag.toLowerCase(), align: alignOf(child), runs: inlineRuns(child) }); continue; }
        if (tag === "P") { out.push({ type: "p", align: alignOf(child), runs: inlineRuns(child) }); continue; }
        if (tag === "PRE") { out.push({ type: "pre", text: child.textContent }); continue; }
        if (tag === "UL" || tag === "OL") {
          const items = Array.from(child.children).filter((li) => li.tagName.toUpperCase() === "LI").map((li) => inlineRuns(li));
          out.push({ type: "list", ordered: tag === "OL", items });
          continue;
        }
        if (tag === "TABLE") { out.push(extractTable(child)); continue; }
        if (lc === "svg") { out.push({ type: "svg", idx: +child.getAttribute("data-fig-idx") }); continue; }
        if (tag === "IMG") { out.push({ type: "img", src: child.getAttribute("src") }); continue; }
        if (tag === "DIV") {
          if (child.classList.contains("toc")) { continue; }
          if (child.classList.contains("ref-list")) {
            const refs = Array.from(child.querySelectorAll(":scope > .r")).map((r) => {
              const numEl = r.querySelector(".num");
              const num = numEl ? numEl.textContent.trim() : "";
              const clone = r.cloneNode(true);
              const n2 = clone.querySelector(".num");
              if (n2) n2.remove();
              return { num, runs: inlineRuns(clone) };
            });
            out.push({ type: "reflist", refs });
            continue;
          }
          const isCap = child.classList.contains("cap");
          const isBox = child.classList.contains("box");
          const hasBlock = Array.from(child.children).some(isBlockEl);
          if (hasBlock) { walk(child); }
          else {
            const runs = inlineRuns(child);
            if (runs.length) out.push({ type: isCap ? "cap" : "p", align: alignOf(child), runs, box: isBox });
          }
          continue;
        }
        walk(child);
      }
    };
    walk(document.body);
    return out;
  });

  await page.close();

  // ---------- Yardımcılar ----------
  const ALIGN = (a) => a === "center" ? AlignmentType.CENTER : a === "right" ? AlignmentType.RIGHT
    : (a === "justify" || a === "start") ? AlignmentType.JUSTIFIED : AlignmentType.LEFT;

  const runText = (b) => (b.runs || []).map((r) => r.text || "").join("");

  const toRuns = (runs, opts = {}) => {
    const out = [];
    for (const r of runs || []) {
      if (r.br) { out.push(new TextRun({ break: 1 })); continue; }
      out.push(new TextRun({
        text: cleanText(r.text),
        bold: r.bold || opts.bold || false,
        italics: r.italic || opts.italic || false,
        font: r.mono ? "Courier New" : (opts.font || BODYFONT),
        size: opts.size || 21,
        color: opts.color,
      }));
    }
    if (out.length === 0) out.push(new TextRun({ text: "", size: opts.size || 21, font: BODYFONT }));
    return out;
  };

  const children = [];
  const pageW = 600;

  const emitBlock = async (b) => {
    if (!b || b.type === "pagebreak") return;
    if (b.type === "p") {
      children.push(new Paragraph({ alignment: ALIGN(b.align) === AlignmentType.LEFT ? AlignmentType.JUSTIFIED : ALIGN(b.align),
        spacing: { after: 120, line: 312 },
        shading: b.box ? { fill: "F2F5F9" } : undefined,
        border: b.box ? { left: { color: ACCENT2, space: 6, style: BorderStyle.SINGLE, size: 18 } } : undefined,
        children: toRuns(b.runs) }));
    } else if (b.type === "cap") {
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 180 },
        children: toRuns(b.runs, { italic: true, size: 18, color: GRAY }) }));
    } else if (b.type === "pre") {
      const lines = cleanText(b.text).replace(/\n+$/, "").split("\n");
      for (const ln of lines) {
        children.push(new Paragraph({ spacing: { after: 0, line: 240 }, shading: { fill: "F4F6F8" },
          children: [new TextRun({ text: ln || " ", font: "Courier New", size: 16 })] }));
      }
      children.push(new Paragraph({ spacing: { after: 140 }, children: [] }));
    } else if (b.type === "list") {
      b.items.forEach((it, i) => {
        const prefix = b.ordered ? `${i + 1}. ` : "•  ";
        children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 60, line: 300 },
          indent: { left: 480, hanging: 260 },
          children: [new TextRun({ text: prefix, font: BODYFONT, size: 21, color: ACCENT2, bold: !b.ordered }), ...toRuns(it)] }));
      });
    } else if (b.type === "reflist") {
      for (const r of b.refs) {
        children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 70, line: 276 },
          indent: { left: 520, hanging: 520 },
          children: [new TextRun({ text: (r.num ? r.num + " " : ""), bold: true, color: ACCENT, size: 19, font: BODYFONT }), ...toRuns(r.runs, { size: 19 })] }));
      }
    } else if (b.type === "svg") {
      const png = svgPngs[b.idx];
      if (png) {
        const w = Math.min(pageW, png.w);
        const h = Math.round(w * png.h / png.w);
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 40 },
          children: [new ImageRun({ type: "png", data: png.buf, transformation: { width: w, height: h } })] }));
      }
    } else if (b.type === "img") {
      const m = /^data:image\/(png|jpeg|jpg);base64,(.*)$/s.exec(b.src || "");
      if (m) {
        const buf = Buffer.from(m[2], "base64");
        const meta = await sharp(buf).metadata();
        const w = Math.min(500, meta.width || 500);
        const h = Math.round(w * (meta.height || 300) / (meta.width || 500));
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 40 },
          children: [new ImageRun({ type: m[1] === "png" ? "png" : "jpg", data: buf, transformation: { width: w, height: h } })] }));
      }
    } else if (b.type === "table") {
      const nCols = Math.max(...b.rows.map((r) => r.reduce((a, c) => a + (c.colspan || 1), 0)));
      let bodyIdx = -1;
      const rows = b.rows.map((r) => {
        const isHeaderRow = r.some((c) => c.header);
        if (!isHeaderRow) bodyIdx++;
        const zebra = !isHeaderRow && (bodyIdx % 2 === 1);
        return new TableRow({
          tableHeader: isHeaderRow,
          children: r.map((c) => new TableCell({
            columnSpan: c.colspan > 1 ? c.colspan : undefined,
            shading: c.header ? { fill: ACCENT } : (zebra ? { fill: "F2F5F9" } : undefined),
            margins: { top: 50, bottom: 50, left: 80, right: 80 },
            children: [new Paragraph({ alignment: ALIGN(c.align), spacing: { after: 0, line: 240 },
              children: toRuns(c.runs, { size: 18, bold: c.header, color: c.header ? "FFFFFF" : undefined }) })],
          })),
        });
      });
      const bd = { style: BorderStyle.SINGLE, size: 3, color: "C7D0DC" };
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: Array(nCols).fill(Math.round(9000 / nCols)),
        borders: { top: bd, bottom: bd, left: bd, right: bd, insideHorizontal: bd, insideVertical: bd },
        rows,
      }));
      children.push(new Paragraph({ spacing: { after: 140 }, children: [] }));
    }
  };

  const emitH2 = (text, { pageBreak = false, numbered = true } = {}) => {
    children.push(new Paragraph({
      spacing: { before: pageBreak ? 0 : 360, after: 140 },
      pageBreakBefore: pageBreak,
      border: { bottom: { color: ACCENT, space: 4, style: BorderStyle.SINGLE, size: 14 } },
      children: [new TextRun({ text: cleanText(text), bold: true, size: 27, color: ACCENT, font: HEADFONT })],
    }));
  };
  const emitH3 = (text) => {
    children.push(new Paragraph({ spacing: { before: 240, after: 80 },
      children: [new TextRun({ text: cleanText(text), bold: true, size: 23, color: ACCENT2, font: HEADFONT })] }));
  };

  // ---------- Üniteleri kur ----------
  const idxGiris = blocks.findIndex((b) => b.type === "h2" && /^\s*1\.\s+Giriş/.test(runText(b)));
  const idxOzet = blocks.findIndex((b) => b.type === "h2" && /^\s*Özet\s*$/.test(runText(b)));
  const coverH1 = blocks.find((b) => b.type === "h1");
  const ozetP = blocks.slice(idxOzet + 1).find((b) => b.type === "p");
  const keywordsP = blocks.slice(idxOzet + 1).find((b) => b.type === "p" && /Anahtar kelimeler/i.test(runText(b)));

  const bodyBlocks = blocks.slice(idxGiris);
  const units = {};
  let cur = null;
  const keyOf = (b) => {
    const t = runText(b).trim();
    let m = /^(\d+(?:\.\d+){0,2})\.?\s+(.*)$/.exec(t);
    if (m) return { key: m[1], title: m[2] };
    if (/^Kaynakça/i.test(t)) return { key: "REF", title: "Kaynakça" };
    if (/^Ek A/i.test(t)) return { key: "EKA", title: t };
    if (/^Ek B/i.test(t)) return { key: "EKB", title: t };
    return { key: null, title: t };
  };
  for (const b of bodyBlocks) {
    if (b.type === "pagebreak") continue;
    if (/^h[2-4]$/.test(b.type)) {
      const { key, title } = keyOf(b);
      if (key) { cur = key; units[key] = { title, blocks: [] }; }
      continue;
    }
    if (cur) units[cur].blocks.push(b);
  }

  const need = (k) => { if (!units[k]) throw new Error("Ünite bulunamadı: " + k); return units[k]; };

  // ---------- 8 bölümlü PLAN ----------
  const SUB = (num, keys, title, opts = {}) => ({ type: "sub", num, keys: Array.isArray(keys) ? keys : [keys], title, ...opts });
  const SEC = (num, title, intro = [], opts = {}) => ({ type: "sec", num, title, intro, ...opts });
  const PLAN = [
    SEC("1", "Giriş", ["1"]),
    SUB("1.1", "1.1"), SUB("1.2", "1.2"), SUB("1.3", "1.3"), SUB("1.4", "1.4", "Çalışmanın Yapısı"),
    SEC("2", "İlgili Çalışmalar", ["2"], { pageBreak: true }),
    SUB("2.1", "2.1"), SUB("2.2", "2.2"), SUB("2.3", "2.3"), SUB("2.4", "2.4"),
    SUB("2.5", "2.5"), SUB("2.6", "2.6"), SUB("2.7", "2.7"), SUB("2.8", "2.8"),
    SEC("3", "Yöntem (Materyal ve Metot)", ["3"], { pageBreak: true }),
    SUB("3.1", "3.1"), SUB("3.2", "3.2"), SUB("3.3", "3.3"), SUB("3.4", "3.4"),
    SEC("4", "Deneyler ve Uygulama (Vaka Çalışması)", ["4"], { pageBreak: true }),
    SUB("4.1", "4.1", "Deney Tasarımı"),
    SUB("4.2", "4.12", "Gerçek Tor Kaynak Kodundan Statik FSM Çıkarımı"),
    SUB("4.3", "4.14", "Angluin L* Algoritması İmplementasyonu"),
    SUB("4.4", ["4.11", "4.11.2"], "Genişletilmiş SLR — Canlı Akademik API Sorguları"),
    SUB("4.5", "4.15", "Bağımsız VM Ortamında Tekrar Üretilebilirlik"),
    SEC("5", "Bulgular", [], { pageBreak: true, findings: true }),
    SUB("5.1", "4.2", "Tanımlayıcı İstatistikler"),
    SUB("5.2", "4.3", "Hipotez Testleri"),
    SUB("5.3", "4.5", "Wilcoxon Signed-Rank Doğrulaması"),
    SUB("5.4", "4.6", "Tespit Gecikmesi (Detection Latency) Ölçümü"),
    SUB("5.5", "4.7", "Bütçe–Kapsama Eğrisi"),
    SUB("5.6", "4.8", "Kural Tabanlı Dedektör Karşılaştırması (B0)"),
    SUB("5.7", "4.9", "Bootstrap Güven Aralıkları ve Post-hoc Güç Analizi"),
    SUB("5.8", "4.10", "Stream Alt-FSM Modeli ve Deneysel Karşılaştırma"),
    SUB("5.9", "4.11.1", "Bağımsız İkinci Oracle (Model Düzeyi)"),
    SUB("5.10", "4.11.3", "Cross-Language Latency — C Portu"),
    SUB("5.11", "4.13", "N=100 Yeniden Koşu, A-priori Güç Analizi ve BCa Bootstrap"),
    SUB("5.12", "4.16", "Ampirik Doğrulamanın Bir Model Hatasını Yakalaması"),
    SUB("5.13", "4.17", "Makine Öğrenmesi Temel Çizgisi: Bağımsız Doğrulama"),
    SUB("5.14", "5", "Görselleştirme"),
    SEC("6", "Tartışma", [], { pageBreak: true }),
    SUB("6.1", "4.4", "Sonuçların Yorumlanması", { withYorum: true }),
    SUB("6.2", "6.1", "Katkıların Yeniden Değerlendirilmesi"),
    SEC("7", "Geçerlilik Tehditleri", ["6.2"], { pageBreak: true }),
    SUB("7.1", "6.2.1", "Ortam Kısıtlılıkları"),
    SUB("7.2", "6.2.2", "Konu Bazlı Sınırlılıklar"),
    SEC("8", "Sonuç ve Gelecek Çalışmalar", ["6", "6.3"], { pageBreak: true }),
    SUB("8.1", "6.3.1"), SUB("8.2", "6.3.2"), SUB("8.3", "6.3.3"), SUB("8.4", "6.3.4"),
    { type: "tesekkur" },
    SEC("REF", "Kaynakça", ["REF"], { pageBreak: true, numbered: false }),
    SEC("EK", "Ekler", [], { pageBreak: true, numbered: false }),
    { type: "subraw", keys: ["EKA"] }, { type: "subraw", keys: ["EKB"] },
  ];

  // ---------- Front matter (Template) ----------
  const titleText = coverH1 ? cleanText(runText(coverH1)) : "Tor Anonim Ağ Protokolünde FSM Modelleme ile Geçersiz Durum Geçişi Tespiti";
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240, after: 200 },
    children: [new TextRun({ text: titleText, bold: true, size: 28, color: ACCENT, font: HEADFONT })] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
    children: [
      new TextRun({ text: "Nurcan Denli Bayır ", size: 24, font: BODYFONT }),
      new TextRun({ text: "1", superScript: true, size: 24, font: BODYFONT }),
      new TextRun({ text: " and Nebi Yılmaz ", size: 24, font: BODYFONT }),
      new TextRun({ text: "2", superScript: true, size: 24, font: BODYFONT }),
    ] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
    children: [
      new TextRun({ text: "1,2 ", superScript: true, size: 20, color: GRAY, font: BODYFONT }),
      new TextRun({ text: "Hacettepe University Institute of Informatics, Ankara, Turkey", italics: true, size: 20, color: GRAY, font: BODYFONT }),
    ] }));
  children.push(new Paragraph({ spacing: { before: 80, after: 100 },
    border: { bottom: { color: ACCENT, space: 4, style: BorderStyle.SINGLE, size: 14 } },
    children: [new TextRun({ text: "Özet", bold: true, size: 24, color: ACCENT, font: HEADFONT })] }));
  if (ozetP) children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120, line: 300 },
    children: toRuns(ozetP.runs) }));
  if (keywordsP) children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 60, line: 290 },
    children: toRuns(keywordsP.runs) }));

  // ---------- PLAN'ı işle ----------
  const yorumCollected = [];
  let findingsMode = false;
  const emitKeysCollectingYorum = async (keys) => {
    for (const k of keys) {
      for (const b of need(k).blocks) {
        if (findingsMode && b.type === "p") {
          const t = cleanText(runText(b)).trim();
          if (/^Yorum\b/.test(t)) { yorumCollected.push(b); continue; }
        }
        await emitBlock(b);
      }
    }
  };

  for (const it of PLAN) {
    if (it.type === "sec") {
      findingsMode = !!it.findings;
      const head = it.numbered === false ? it.title : `${it.num}. ${it.title}`;
      emitH2(head, { pageBreak: !!it.pageBreak, numbered: it.numbered !== false });
      if (it.intro && it.intro.length) await emitKeysCollectingYorum(it.intro);
    } else if (it.type === "sub") {
      emitH3(`${it.num} ${cleanText(it.title || need(it.keys[0]).title)}`);
      if (it.withYorum) {
        for (const k of it.keys) for (const b of need(k).blocks) await emitBlock(b);
        for (const b of yorumCollected) await emitBlock(b);
      } else {
        await emitKeysCollectingYorum(it.keys);
      }
    } else if (it.type === "subraw") {
      const u = need(it.keys[0]);
      emitH3(cleanText(u.title));
      for (const b of u.blocks) await emitBlock(b);
    } else if (it.type === "tesekkur") {
      findingsMode = false;
      emitH2("Teşekkür", { numbered: false });
      children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120, line: 300 },
        children: [new TextRun({ text: "Bu çalışma herhangi bir dış fon veya proje desteği almamıştır. Tüm deneyler ve analizler yazarlar tarafından yürütülmüştür.", size: 21, font: BODYFONT })] }));
    }
  }

  // ---------- Belge ----------
  const doc = new Document({
    styles: { default: { document: { run: { font: BODYFONT, size: 21 } } } },
    sections: [{
      properties: { page: { margin: { top: 1247, bottom: 1247, left: 1247, right: 1134 } } },
      headers: { default: new Header({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT, spacing: { after: 40 },
        border: { bottom: { color: "C7D0DC", space: 2, style: BorderStyle.SINGLE, size: 6 } },
        children: [new TextRun({ text: SHORT_TITLE, italics: true, size: 15, color: GRAY, font: HEADFONT })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GRAY, font: HEADFONT })] })] }) },
      children,
    }],
  });

  const buf = await Packer.toBuffer(doc);
  await fs.writeFile(outPath, buf);
  const kb = (buf.length / 1024).toFixed(1);
  const wordCount = children.length;
  console.log(`OK: ${outPath} (${kb} KB, ${blocks.length} kaynak blok, ${svgCount} svg figür, ${wordCount} çıktı paragrafı)`);
}

try {
  await run();
} finally {
  await browser.close();
}
