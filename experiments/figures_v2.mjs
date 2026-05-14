// İlave SVG figürleri: PRISMA, bütçe-kapsama eğrisi, rule-based completeness.

const W = 720;

// Şekil 5: PRISMA akış diyagramı (audit log yoksa ara aşamalar NA)
export function prismaSvg(p) {
  const fmt = (x) => (x === null || x === undefined) ? "NA (kayıt tutulmadı)" : `n = ${x}`;
  const boxes = [
    { x: 30,  y: 50,  w: 280, h: 60, label: ["IDENTIFICATION", `Açık web (Scholar/arXiv/DOI): ${fmt(p.identified_other)}`, `Veritabanı (yapılamadı): n = ${p.identified_db}`], fill: "#dde7f4" },
    { x: 30,  y: 145, w: 280, h: 50, label: ["SCREENING — Duplikatlar çıkarıldı", fmt(p.duplicates_removed)], fill: "#dde7f4" },
    { x: 30,  y: 230, w: 280, h: 60, label: ["SCREENING — Başlık/Özet incelemesi", fmt(p.screened), `Hariç: ${p.excluded_title_abstract === null ? "NA" : p.excluded_title_abstract}`], fill: "#dde7f4" },
    { x: 30,  y: 325, w: 280, h: 60, label: ["ELIGIBILITY — Tam metin değerlendirme", fmt(p.full_text_assessed), `Hariç: ${p.excluded_full_text === null ? "NA" : p.excluded_full_text}`], fill: "#dde7f4" },
    { x: 30,  y: 420, w: 280, h: 60, label: ["INCLUDED — Sentezde kullanılan", `n = ${p.included}`, "(Literatur_Notlari.pdf ile doğrulanır)"], fill: "#bce5c8" },
  ];
  // Reasons block
  const reasonsX = 360, reasonsY = 325, reasonsW = 330;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 540" font-family="Helvetica,Arial,sans-serif" font-size="10">`;
  svg += `<text x="${W / 2}" y="22" text-anchor="middle" font-size="13" font-weight="bold">Şekil 5: PRISMA akış diyagramı (Kitchenham + Charters'a uyumlu)</text>`;
  for (const b of boxes) {
    svg += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${b.fill}" stroke="#234" stroke-width="1" rx="4"/>`;
    b.label.forEach((line, i) => {
      svg += `<text x="${b.x + b.w / 2}" y="${b.y + 18 + i * 14}" text-anchor="middle" font-size="${i === 0 ? 10 : 9}" font-weight="${i === 0 ? "bold" : "normal"}">${line}</text>`;
    });
  }
  // arrows between boxes
  for (let i = 0; i < boxes.length - 1; i++) {
    const a = boxes[i], b = boxes[i + 1];
    const x = a.x + a.w / 2;
    svg += `<line x1="${x}" y1="${a.y + a.h}" x2="${x}" y2="${b.y}" stroke="#234" stroke-width="1.4" marker-end="url(#prismaArr)"/>`;
  }
  // exclusion reasons box
  svg += `<rect x="${reasonsX}" y="${reasonsY}" width="${reasonsW}" height="155" fill="#fff4e0" stroke="#a86" stroke-width="1" rx="4"/>`;
  svg += `<text x="${reasonsX + 10}" y="${reasonsY + 16}" font-size="10" font-weight="bold">Hariç tutma gerekçeleri (nitel)</text>`;
  (p.exclusion_reasons_qualitative || p.exclusion_reasons || []).forEach((r, i) => {
    svg += `<text x="${reasonsX + 10}" y="${reasonsY + 36 + i * 14}" font-size="9">• ${r}</text>`;
  });
  // arrow from "Eligibility" to reasons
  svg += `<line x1="310" y1="${reasonsY + 30}" x2="${reasonsX}" y2="${reasonsY + 30}" stroke="#a86" stroke-width="1" stroke-dasharray="3 3" marker-end="url(#prismaArr)"/>`;
  svg += `<defs><marker id="prismaArr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#234"/></marker></defs>`;
  // honest note
  svg += `<text x="${W / 2}" y="510" text-anchor="middle" font-size="9" font-style="italic" fill="#555">Not: Açık-web sürecinde audit-edilebilir log tutulmadığı için ara sayılar NA olarak raporlanır; yalnızca son n=${p.included} doğrulanabilir.</text>`;
  svg += `</svg>`;
  return svg;
}

// Şekil 6: Bütçe-kapsama eğrisi (TC vs bütçe, 3 algoritma)
export function budgetCurveSvg(curve, budgets, metric = "tc") {
  const left = 60, top = 60, plotW = 600, plotH = 280;
  const colors = { B1_Random: "#9aa6b8", B2_GreedySC: "#3b82c4", B3_MDT: "#1d8b5d" };
  const xMin = Math.log10(budgets[0]), xMax = Math.log10(budgets[budgets.length - 1]);
  const xScale = (b) => left + ((Math.log10(b) - xMin) / (xMax - xMin)) * plotW;
  const yScale = (v) => top + plotH - v * plotH;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 410" font-family="Helvetica,Arial,sans-serif" font-size="10">`;
  svg += `<text x="${W / 2}" y="22" text-anchor="middle" font-size="13" font-weight="bold">Şekil 6: Bütçe ↔ ${metric.toUpperCase()} kapsama eğrisi (N=30 ortalama, gölge = SD)</text>`;
  // y-grid
  for (let i = 0; i <= 10; i++) {
    const y = top + plotH - (i / 10) * plotH;
    svg += `<line x1="${left}" y1="${y}" x2="${left + plotW}" y2="${y}" stroke="#eee"/>`;
    svg += `<text x="${left - 6}" y="${y + 3}" text-anchor="end" font-size="8">${i * 10}%</text>`;
  }
  // x-axis ticks
  for (const b of budgets) {
    const x = xScale(b);
    svg += `<line x1="${x}" y1="${top + plotH}" x2="${x}" y2="${top + plotH + 4}" stroke="#234"/>`;
    svg += `<text x="${x}" y="${top + plotH + 16}" text-anchor="middle" font-size="9">${b}</text>`;
  }
  svg += `<text x="${left + plotW / 2}" y="${top + plotH + 32}" text-anchor="middle" font-size="10">Olay bütçesi (log ölçek)</text>`;
  // lines + bands
  for (const algo of Object.keys(curve)) {
    const pts = curve[algo].map((p) => ({ x: xScale(p.budget), y: yScale(p[`${metric}_mean`]), yLo: yScale(Math.max(0, p[`${metric}_mean`] - p[`${metric}_sd`])), yHi: yScale(Math.min(1, p[`${metric}_mean`] + p[`${metric}_sd`])) }));
    // band
    const bandPath = "M " + pts.map((p) => `${p.x} ${p.yHi}`).join(" L ") + " L " + pts.slice().reverse().map((p) => `${p.x} ${p.yLo}`).join(" L ") + " Z";
    svg += `<path d="${bandPath}" fill="${colors[algo]}" opacity="0.18"/>`;
    // mean line
    svg += `<polyline points="${pts.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="${colors[algo]}" stroke-width="2"/>`;
    // points
    for (const p of pts) svg += `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${colors[algo]}"/>`;
  }
  // legend
  let lx = left;
  for (const algo of Object.keys(curve)) {
    svg += `<line x1="${lx}" y1="${top + plotH + 50}" x2="${lx + 26}" y2="${top + plotH + 50}" stroke="${colors[algo]}" stroke-width="2"/>`;
    svg += `<text x="${lx + 32}" y="${top + plotH + 53}" font-size="10">${algo}</text>`;
    lx += 140;
  }
  svg += `</svg>`;
  return svg;
}

// Şekil 7: Rule-based vs spec-based completeness
export function ruleCompletenessSvg(rb) {
  const left = 60, top = 60, plotW = 600, plotH = 220;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 360" font-family="Helvetica,Arial,sans-serif" font-size="10">`;
  svg += `<text x="${W / 2}" y="22" text-anchor="middle" font-size="13" font-weight="bold">Şekil 7: Tespit completeness — kural-tabanlı (B0) vs. spec-oracle (MDT)</text>`;
  // Two bars side by side
  const m = rb.completeness;
  const bars = [
    { label: "B0 — Rule-based (7 imza)", val: m, color: "#c97a3d", text: `${rb.detectedByRules}/${rb.totalInvalid} = ${(m * 100).toFixed(1)}%` },
    { label: "MDT — Spec oracle (δ)",     val: 1.0, color: "#1d8b5d", text: `${rb.totalInvalid}/${rb.totalInvalid} = 100.0%` },
  ];
  bars.forEach((b, i) => {
    const x = left + i * 320, w = 220;
    const h = b.val * plotH, y = top + plotH - h;
    svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${b.color}"/>`;
    svg += `<text x="${x + w / 2}" y="${y - 6}" text-anchor="middle" font-size="11" font-weight="bold">${b.text}</text>`;
    svg += `<text x="${x + w / 2}" y="${top + plotH + 18}" text-anchor="middle" font-size="10">${b.label}</text>`;
  });
  // y axis
  for (let i = 0; i <= 10; i++) {
    const y = top + plotH - (i / 10) * plotH;
    svg += `<line x1="${left}" y1="${y}" x2="${left + plotW}" y2="${y}" stroke="#eee"/>`;
    svg += `<text x="${left - 6}" y="${y + 3}" text-anchor="end" font-size="8">${i * 10}%</text>`;
  }
  // missed breakdown
  let mx = left;
  svg += `<text x="${left}" y="${top + plotH + 50}" font-size="10" font-weight="bold">Kural tabanlının kaçırdığı (n=${rb.missed}) şiddet dağılımı:</text>`;
  Object.entries(rb.missedBySeverity).forEach(([sev, cnt]) => {
    svg += `<text x="${mx}" y="${top + plotH + 70}" font-size="10">${sev}: ${cnt}</text>`;
    mx += 130;
  });
  svg += `</svg>`;
  return svg;
}
