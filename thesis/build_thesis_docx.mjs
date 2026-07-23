// Tez_Taslagi.pdf'in kaynağı olan thesis.html'i, içerik kısaltmadan, native Word (.docx)
// belgesine dönüştürür. DOM puppeteer ile çıkarılır, SVG figürler puppeteer ile PNG'ye
// rasterize edilir, belge docx kütüphanesiyle üretilir. Tüm metin/tablo/figür korunur.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import sharp from "sharp";
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell,
  WidthType, BorderStyle, ImageRun, PageBreak,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "thesis.html");
const outPath = path.join(__dirname, "Tor_FSM_Tez.docx");

const puppeteer = (await import(path.resolve(__dirname, "../node_modules/puppeteer-core/lib/cjs/puppeteer/puppeteer-core.js"))).default;

const ACCENT = "1A3A6E";
const GRAY = "555555";

const browser = await puppeteer.launch({
  executablePath: execSync("which chromium").toString().trim(),
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

async function run() {
  const page = await browser.newPage();
  await page.setViewport({ width: 1120, height: 1500, deviceScaleFactor: 2 });
  await page.goto("file://" + htmlPath, { waitUntil: "networkidle0" });

  // Tag svgs in DOM order
  const svgCount = await page.evaluate(() => {
    const svgs = Array.from(document.querySelectorAll("svg"));
    svgs.forEach((s, i) => s.setAttribute("data-fig-idx", String(i)));
    return svgs.length;
  });

  // Screenshot each svg → png buffer (faithful fonts/appearance)
  const svgPngs = [];
  for (let i = 0; i < svgCount; i++) {
    const handle = await page.$(`svg[data-fig-idx="${i}"]`);
    const buf = await handle.screenshot({ type: "png" });
    const meta = await sharp(buf).metadata();
    svgPngs.push({ buf, w: meta.width, h: meta.height });
  }

  // Extract ordered blocks
  const blocks = await page.evaluate(() => {
    const isBlockEl = (el) => {
      const t = el.tagName.toUpperCase();
      if (t === "IMG" || el.tagName.toLowerCase() === "svg") return true;
      return /^(DIV|P|H1|H2|H3|H4|TABLE|UL|OL|PRE|FIGURE|BLOCKQUOTE)$/.test(t);
    };
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
    const blocks = [];
    const walk = (el) => {
      for (const child of Array.from(el.children)) {
        const tag = child.tagName.toUpperCase();
        const lc = child.tagName.toLowerCase();
        if (child.classList && child.classList.contains("pagebreak")) { blocks.push({ type: "pagebreak" }); continue; }
        if (/^H[1-4]$/.test(tag)) { blocks.push({ type: tag.toLowerCase(), align: alignOf(child), runs: inlineRuns(child) }); continue; }
        if (tag === "P") { blocks.push({ type: "p", align: alignOf(child), runs: inlineRuns(child) }); continue; }
        if (tag === "PRE") { blocks.push({ type: "pre", text: child.textContent }); continue; }
        if (tag === "UL" || tag === "OL") {
          const items = Array.from(child.children).filter((li) => li.tagName.toUpperCase() === "LI").map((li) => inlineRuns(li));
          blocks.push({ type: "list", ordered: tag === "OL", items });
          continue;
        }
        if (tag === "TABLE") { blocks.push(extractTable(child)); continue; }
        if (lc === "svg") { blocks.push({ type: "svg", idx: +child.getAttribute("data-fig-idx") }); continue; }
        if (tag === "IMG") { blocks.push({ type: "img", src: child.getAttribute("src") }); continue; }
        if (tag === "DIV") {
          if (child.classList.contains("toc")) {
            const entries = Array.from(child.querySelectorAll(":scope > div")).map((d) => {
              let lvl = 1;
              if (d.classList.contains("lvl2")) lvl = 2;
              if (d.classList.contains("lvl3")) lvl = 3;
              const sp = d.querySelector("span");
              return { lvl, text: (sp ? sp.textContent : d.textContent).trim() };
            });
            blocks.push({ type: "toc", entries });
            continue;
          }
          if (child.classList.contains("ref-list")) {
            const refs = Array.from(child.querySelectorAll(":scope > .r")).map((r) => {
              const numEl = r.querySelector(".num");
              const num = numEl ? numEl.textContent.trim() : "";
              const clone = r.cloneNode(true);
              const n2 = clone.querySelector(".num");
              if (n2) n2.remove();
              return { num, runs: inlineRuns(clone) };
            });
            blocks.push({ type: "reflist", refs });
            continue;
          }
          const isCap = child.classList.contains("cap");
          const isBox = child.classList.contains("box");
          const hasBlock = Array.from(child.children).some(isBlockEl);
          if (hasBlock) { walk(child); }
          else {
            const runs = inlineRuns(child);
            if (runs.length) blocks.push({ type: isCap ? "cap" : "p", align: alignOf(child), runs, box: isBox });
          }
          continue;
        }
        walk(child);
      }
    };
    walk(document.body);
    return blocks;
  });

  await page.close();

  // ---- Build docx ----
  const ALIGN = (a) => a === "center" ? AlignmentType.CENTER : a === "right" ? AlignmentType.RIGHT
    : (a === "justify" || a === "start") ? AlignmentType.JUSTIFIED : AlignmentType.LEFT;

  const toRuns = (runs, opts = {}) => {
    const out = [];
    for (const r of runs) {
      if (r.br) { out.push(new TextRun({ break: 1 })); continue; }
      out.push(new TextRun({
        text: r.text,
        bold: r.bold || opts.bold || false,
        italics: r.italic || opts.italic || false,
        font: r.mono ? "Courier New" : (opts.font || "Times New Roman"),
        size: opts.size || 22,
        color: opts.color,
      }));
    }
    if (out.length === 0) out.push(new TextRun({ text: "", size: opts.size || 22, font: "Times New Roman" }));
    return out;
  };

  const children = [];
  const pageW = 600; // px target for figures

  for (const b of blocks) {
    if (b.type === "pagebreak") {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    } else if (b.type === "h1") {
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 120 },
        children: toRuns(b.runs, { bold: true, size: 36 }) }));
    } else if (b.type === "h2") {
      children.push(new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 360, after: 100 },
        border: { bottom: { color: ACCENT, space: 2, style: BorderStyle.SINGLE, size: 12 } },
        children: toRuns(b.runs, { bold: true, size: 27, color: ACCENT }) }));
    } else if (b.type === "h3") {
      children.push(new Paragraph({ spacing: { before: 200, after: 70 },
        children: toRuns(b.runs, { bold: true, size: 24, color: ACCENT }) }));
    } else if (b.type === "h4") {
      children.push(new Paragraph({ spacing: { before: 140, after: 50 },
        children: toRuns(b.runs, { bold: true, italic: true, size: 22 }) }));
    } else if (b.type === "p") {
      children.push(new Paragraph({ alignment: ALIGN(b.align), spacing: { after: 100, line: 300 },
        shading: b.box ? { fill: "F6F8FB" } : undefined,
        children: toRuns(b.runs) }));
    } else if (b.type === "cap") {
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
        children: toRuns(b.runs, { italic: true, size: 19, color: "444444" }) }));
    } else if (b.type === "pre") {
      const lines = b.text.replace(/\n+$/,"").split("\n");
      for (const ln of lines) {
        children.push(new Paragraph({ spacing: { after: 0, line: 240 }, shading: { fill: "F4F4F4" },
          children: [new TextRun({ text: ln || " ", font: "Courier New", size: 17 })] }));
      }
      children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    } else if (b.type === "list") {
      b.items.forEach((it, i) => {
        const prefix = b.ordered ? `${i + 1}. ` : "•  ";
        children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 50, line: 290 },
          indent: { left: 480, hanging: 260 },
          children: [new TextRun({ text: prefix, font: "Times New Roman", size: 22 }), ...toRuns(it)] }));
      });
    } else if (b.type === "toc") {
      for (const e of b.entries) {
        children.push(new Paragraph({ spacing: { before: e.lvl === 1 ? 60 : 0, after: 10 },
          indent: e.lvl > 1 ? { left: (e.lvl - 1) * 360 } : undefined,
          children: [new TextRun({ text: e.text, bold: e.lvl === 1, size: 21, font: "Times New Roman" })] }));
      }
    } else if (b.type === "reflist") {
      for (const r of b.refs) {
        children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 60, line: 270 },
          indent: { left: 520, hanging: 520 },
          children: [new TextRun({ text: (r.num ? r.num + " " : ""), bold: true, color: ACCENT, size: 20, font: "Times New Roman" }), ...toRuns(r.runs, { size: 20 })] }));
      }
    } else if (b.type === "svg") {
      const png = svgPngs[b.idx];
      if (png) {
        const w = Math.min(pageW, png.w);
        const h = Math.round(w * png.h / png.w);
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 40 },
          children: [new ImageRun({ type: "png", data: png.buf, transformation: { width: w, height: h } })] }));
      }
    } else if (b.type === "img") {
      const m = /^data:image\/(png|jpeg|jpg);base64,(.*)$/s.exec(b.src || "");
      if (m) {
        const buf = Buffer.from(m[2], "base64");
        const meta = await sharp(buf).metadata();
        const w = Math.min(500, meta.width || 500);
        const h = Math.round(w * (meta.height || 300) / (meta.width || 500));
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 40 },
          children: [new ImageRun({ type: m[1] === "png" ? "png" : "jpg", data: buf, transformation: { width: w, height: h } })] }));
      }
    } else if (b.type === "table") {
      const nCols = Math.max(...b.rows.map((r) => r.reduce((a, c) => a + (c.colspan || 1), 0)));
      const rows = b.rows.map((r) => new TableRow({
        children: r.map((c) => new TableCell({
          columnSpan: c.colspan > 1 ? c.colspan : undefined,
          shading: c.header ? { fill: "E6ECF4" } : undefined,
          margins: { top: 40, bottom: 40, left: 70, right: 70 },
          children: [new Paragraph({ alignment: ALIGN(c.align), spacing: { after: 0, line: 240 },
            children: toRuns(c.runs, { size: 19, bold: c.header }) })],
        })),
      }));
      const border = { style: BorderStyle.SINGLE, size: 4, color: "AAAABB" };
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: Array(nCols).fill(Math.round(9000 / nCols)),
        borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
        rows,
      }));
      children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    }
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 22 } } } },
    sections: [{
      properties: { page: { margin: { top: 1247, bottom: 1247, left: 1247, right: 1134 } } },
      children,
    }],
  });

  const buf = await Packer.toBuffer(doc);
  await fs.writeFile(outPath, buf);
  const kb = (buf.length / 1024).toFixed(1);
  console.log(`OK: ${outPath} (${kb} KB, ${blocks.length} blok, ${svgCount} svg figür)`);
}

try {
  await run();
} finally {
  await browser.close();
}
