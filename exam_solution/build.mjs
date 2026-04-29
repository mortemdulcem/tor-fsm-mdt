// Generates SVG diagrams, converts to PNG, and produces final PDF answer document.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import puppeteer from "puppeteer-core";

import { soru1, soru2 } from "./data.mjs";
import { renderDiagram } from "./render_svg.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function findChromium() {
  const { execSync } = await import("node:child_process");
  const p = execSync("which chromium 2>/dev/null || true").toString().trim();
  if (p) return p;
  throw new Error("Chromium executable not found");
}

async function main() {
  console.log("[1/5] SVG diyagramlar olusturuluyor...");
  const svg1 = renderDiagram(soru1);
  const svg2 = renderDiagram(soru2);
  await fs.writeFile(path.join(__dirname, "diagram_soru1.svg"), svg1, "utf8");
  await fs.writeFile(path.join(__dirname, "diagram_soru2.svg"), svg2, "utf8");

  console.log("[2/5] SVG -> PNG donusumu...");
  console.log("    -> PNG 1");
  const png1 = await sharp(Buffer.from(svg1), { density: 144 }).png().toBuffer();
  await fs.writeFile(path.join(__dirname, "diagram_soru1.png"), png1);
  console.log("    -> PNG 2");
  const png2 = await sharp(Buffer.from(svg2), { density: 144 }).png().toBuffer();
  await fs.writeFile(path.join(__dirname, "diagram_soru2.png"), png2);

  console.log("[3/5] HTML dokumani hazirlaniyor...");
  const { buildHtml } = await import("./html_content.mjs");
  const html = buildHtml({
    diagram1Path: "file://" + path.join(__dirname, "diagram_soru1.png"),
    diagram2Path: "file://" + path.join(__dirname, "diagram_soru2.png"),
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
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.emulateMediaType("print");

  console.log("[5/5] PDF uretiliyor...");
  const pdfPath = path.join(__dirname, "Arasinav_Cevap.pdf");
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
    displayHeaderFooter: true,
    headerTemplate: `<div style="font-family:'Inter',sans-serif;font-size:8px;color:#7a8aa0;width:100%;padding:0 16mm;display:flex;justify-content:space-between;">
      <span>Nesneye Yonelik Yazilim Gelistirme — Ara Sinav Cevabi</span>
      <span class="date"></span>
    </div>`,
    footerTemplate: `<div style="font-family:'Inter',sans-serif;font-size:8px;color:#7a8aa0;width:100%;padding:0 16mm;display:flex;justify-content:space-between;">
      <span>Hacettepe Universitesi — Bilisim Enstitusu</span>
      <span>Sayfa <span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>`,
  });
  await browser.close();

  console.log("Tamam! PDF: " + pdfPath);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
