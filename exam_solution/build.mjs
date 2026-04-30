// Generates SVG diagrams (class + sequence), converts to PNG, and produces final PDF answer document.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import puppeteer from "puppeteer-core";

import { soru1, soru2, sekans_soru1_sensor, sekans_soru1_mod, sekans_soru2 } from "./data.mjs";
import { renderDiagram, renderSequenceDiagram } from "./render_svg.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function findChromium() {
  const { execSync } = await import("node:child_process");
  const p = execSync("which chromium 2>/dev/null || true").toString().trim();
  if (p) return p;
  throw new Error("Chromium executable not found");
}

async function svgToPng(svg, outPath) {
  const buf = await sharp(Buffer.from(svg), { density: 144 }).png().toBuffer();
  await fs.writeFile(outPath, buf);
}

async function main() {
  console.log("[1/5] SVG diyagramlar olusturuluyor (sinif + sekans)...");
  const svgClass1 = renderDiagram(soru1);
  const svgClass2 = renderDiagram(soru2);
  const svgSeq1a = renderSequenceDiagram(sekans_soru1_sensor);
  const svgSeq1b = renderSequenceDiagram(sekans_soru1_mod);
  const svgSeq2  = renderSequenceDiagram(sekans_soru2);

  await fs.writeFile(path.join(__dirname, "diagram_soru1.svg"), svgClass1, "utf8");
  await fs.writeFile(path.join(__dirname, "diagram_soru2.svg"), svgClass2, "utf8");
  await fs.writeFile(path.join(__dirname, "sekans_soru1a.svg"), svgSeq1a, "utf8");
  await fs.writeFile(path.join(__dirname, "sekans_soru1b.svg"), svgSeq1b, "utf8");
  await fs.writeFile(path.join(__dirname, "sekans_soru2.svg"),  svgSeq2,  "utf8");

  console.log("[2/5] SVG -> PNG donusumu...");
  await svgToPng(svgClass1, path.join(__dirname, "diagram_soru1.png"));
  console.log("    -> sinif diyagrami 1");
  await svgToPng(svgClass2, path.join(__dirname, "diagram_soru2.png"));
  console.log("    -> sinif diyagrami 2");
  await svgToPng(svgSeq1a, path.join(__dirname, "sekans_soru1a.png"));
  console.log("    -> sekans 1a");
  await svgToPng(svgSeq1b, path.join(__dirname, "sekans_soru1b.png"));
  console.log("    -> sekans 1b");
  await svgToPng(svgSeq2, path.join(__dirname, "sekans_soru2.png"));
  console.log("    -> sekans 2");

  console.log("[3/5] HTML dokumani hazirlaniyor...");
  const { buildHtml } = await import("./html_content.mjs");
  const html = buildHtml({
    diagram1Path: "file://" + path.join(__dirname, "diagram_soru1.png"),
    diagram2Path: "file://" + path.join(__dirname, "diagram_soru2.png"),
    sekans1aPath: "file://" + path.join(__dirname, "sekans_soru1a.png"),
    sekans1bPath: "file://" + path.join(__dirname, "sekans_soru1b.png"),
    sekans2Path:  "file://" + path.join(__dirname, "sekans_soru2.png"),
  });
  await fs.writeFile(path.join(__dirname, "preview.html"), html, "utf8");

  console.log("[4/5] Chromium baslatiliyor...");
  const chromiumPath = await findChromium();
  console.log("    Chromium yolu: " + chromiumPath);
  const browser = await puppeteer.launch({
    executablePath: chromiumPath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
  });
  const page = await browser.newPage();
  // Navigate to preview.html via file:// so that file:// image references resolve reliably
  await page.goto("file://" + path.join(__dirname, "preview.html"), { waitUntil: "networkidle0" });
  // Make sure all <img> elements actually finished decoding
  await page.evaluate(async () => {
    const imgs = Array.from(document.images);
    await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = img.onerror = res; })));
  });
  await page.emulateMediaType("print");

  console.log("[5/5] PDF uretiliyor...");
  const pdfPath = path.join(__dirname, "Arasinav_Cevap.pdf");
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "20mm", bottom: "20mm", left: "18mm", right: "18mm" },
    displayHeaderFooter: true,
    headerTemplate: `<div style="font-family:'EB Garamond',Georgia,serif;font-size:9px;color:#7a7060;width:100%;padding:0 18mm;display:flex;justify-content:space-between;font-style:italic;">
      <span>Nesneye Yönelik Yazılım Geliştirme</span>
      <span class="title"></span>
    </div>`,
    footerTemplate: `<div style="font-family:'EB Garamond',Georgia,serif;font-size:9px;color:#7a7060;width:100%;padding:0 18mm;display:flex;justify-content:space-between;font-style:italic;">
      <span>Bilişim Enstitüsü &middot; 2025-2026 Bahar</span>
      <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>`,
  });
  await browser.close();

  console.log("Tamam! PDF: " + pdfPath);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
