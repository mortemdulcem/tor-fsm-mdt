// Hand-rolled SVG generators. No D3. All inputs are real arrays.

import { STATES, EVENTS, VALID, k } from "../server/fsm.ts";
import { classifyInvalid } from "../server/fsm.ts";

const W = 720;

// Figure 1: FSM directed graph. Circular layout for 10 states, 25 edges from VALID.
export function fsmGraphSvg() {
  const cx = 360, cy = 300, R = 220;
  const n = STATES.length;
  const pos = {};
  STATES.forEach((s, i) => {
    const ang = (i / n) * 2 * Math.PI - Math.PI / 2;
    pos[s] = { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) };
  });

  const edges = [];
  for (const key of Object.keys(VALID)) {
    const [from, ev] = key.split("|");
    const to = VALID[key];
    edges.push({ from, to, ev });
  }

  // Group edges by (from,to) to avoid label overlap on parallel edges
  const grouped = new Map();
  for (const e of edges) {
    const id = `${e.from}>>${e.to}`;
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(e.ev);
  }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 620" font-family="Helvetica,Arial,sans-serif" font-size="9">`;
  svg += `<defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#345"/>
    </marker>
    <marker id="arrSelf" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#a55"/>
    </marker>
  </defs>`;
  // edges
  for (const [id, evs] of grouped) {
    const [from, to] = id.split(">>");
    const a = pos[from], b = pos[to];
    if (from === to) {
      // self-loop
      svg += `<path d="M ${a.x + 24} ${a.y - 8} c 30 -30, 60 -30, 30 0" stroke="#a55" fill="none" marker-end="url(#arrSelf)"/>`;
      svg += `<text x="${a.x + 38}" y="${a.y - 26}" fill="#a55">${evs.join(",")}</text>`;
    } else {
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy);
      const ux = dx / len, uy = dy / len;
      // node radius offset = 22
      const x1 = a.x + ux * 22, y1 = a.y + uy * 22;
      const x2 = b.x - ux * 22, y2 = b.y - uy * 22;
      // slight perpendicular curve for legibility
      const mx = (x1 + x2) / 2 - uy * 16, my = (y1 + y2) / 2 + ux * 16;
      svg += `<path d="M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}" stroke="#456" fill="none" stroke-width="1" marker-end="url(#arr)"/>`;
      svg += `<text x="${mx}" y="${my}" fill="#234" text-anchor="middle">${evs.join(",")}</text>`;
    }
  }
  // nodes
  for (const s of STATES) {
    const p = pos[s];
    const fill = s === "IDLE" ? "#cfe9d6" : (s === "CLOSED" || s === "ERROR") ? "#f1d4d4" : "#dde7f4";
    svg += `<circle cx="${p.x}" cy="${p.y}" r="22" fill="${fill}" stroke="#234" stroke-width="1"/>`;
    svg += `<text x="${p.x}" y="${p.y + 3}" text-anchor="middle" font-size="8" font-weight="bold">${s}</text>`;
  }
  svg += `<text x="${cx}" y="20" text-anchor="middle" font-size="13" font-weight="bold">Şekil 1: Tor FSM δ-grafiği (25 geçerli geçiş, 10 durum)</text>`;
  svg += `</svg>`;
  return svg;
}

// Figure 2: State × Event matrix coloured by validity / attack severity.
export function attackHeatmapSvg() {
  const cellW = 46, cellH = 28;
  const offX = 130, offY = 60;
  const totalW = offX + EVENTS.length * cellW + 20;
  const totalH = offY + STATES.length * cellH + 60;

  const sevColor = { LOW: "#fde68a", MEDIUM: "#fcb464", HIGH: "#f37b6b", CRITICAL: "#c43d3d" };
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" font-family="Helvetica,Arial,sans-serif" font-size="8">`;
  svg += `<text x="${totalW / 2}" y="20" text-anchor="middle" font-size="13" font-weight="bold">Şekil 2: δ-domeni matrisi (yeşil=geçerli, kırmızı tonları=invalid)</text>`;
  svg += `<text x="${totalW / 2}" y="38" text-anchor="middle" font-size="9" fill="#555">Hücre etiketi: invalid'lerde saldırı sınıfı kısaltması; geçerli hücrede hedef durum</text>`;

  // event headers (rotated)
  EVENTS.forEach((e, i) => {
    const x = offX + i * cellW + cellW / 2, y = offY - 6;
    svg += `<text x="${x}" y="${y}" text-anchor="end" transform="rotate(-50 ${x} ${y})" font-size="8">${e}</text>`;
  });
  // state row labels
  STATES.forEach((s, j) => {
    svg += `<text x="${offX - 6}" y="${offY + j * cellH + cellH / 2 + 3}" text-anchor="end" font-size="9" font-weight="bold">${s}</text>`;
  });
  // cells
  STATES.forEach((s, j) => {
    EVENTS.forEach((e, i) => {
      const x = offX + i * cellW, y = offY + j * cellH;
      const valid = VALID[k(s, e)];
      const fill = valid ? "#bce5c8" : sevColor[classifyInvalid(s, e).severity];
      svg += `<rect x="${x}" y="${y}" width="${cellW - 1}" height="${cellH - 1}" fill="${fill}" stroke="#fff"/>`;
      const label = valid ? valid.slice(0, 6) : abbrevAttack(classifyInvalid(s, e).type);
      svg += `<text x="${x + cellW / 2}" y="${y + cellH / 2 + 3}" text-anchor="middle" font-size="7">${label}</text>`;
    });
  });

  // legend
  const legendY = offY + STATES.length * cellH + 18;
  let lx = offX;
  const legend = [
    ["Valid", "#bce5c8"], ["LOW", sevColor.LOW], ["MEDIUM", sevColor.MEDIUM],
    ["HIGH", sevColor.HIGH], ["CRITICAL", sevColor.CRITICAL],
  ];
  legend.forEach(([lbl, c]) => {
    svg += `<rect x="${lx}" y="${legendY}" width="16" height="10" fill="${c}" stroke="#888"/>`;
    svg += `<text x="${lx + 20}" y="${legendY + 9}" font-size="9">${lbl}</text>`;
    lx += 70;
  });
  svg += `</svg>`;
  return svg;
}
function abbrevAttack(t) {
  return ({ CIRCUIT_BYPASS: "BYPS", REPLAY_ATTACK: "REPL", GHOST_CIRCUIT: "GHST",
    HANDSHAKE_SKIP: "HSKP", PREMATURE_DATA: "PDAT", CIRCUIT_HIJACK: "HIJK",
    CREATE_FLOOD: "CFLD", INVALID_TRANSITION: "INV" })[t] || t.slice(0, 4);
}

// Figure 3: Bar chart comparing mean SC / TC / ITDR across algorithms with SD whiskers.
export function metricBarChart(stats) {
  // stats = { B1_Random: {sc: {mean,sd}, tc:{...}, itdr:{...}}, B2:..., B3:... }
  const algos = Object.keys(stats);
  const metrics = ["sc", "tc", "itdr"];
  const labels = { sc: "State Coverage", tc: "Transition Coverage", itdr: "ITDR" };
  const colors = { B1_Random: "#9aa6b8", B2_GreedySC: "#3b82c4", B3_MDT: "#1d8b5d" };

  const left = 60, top = 50, plotW = 600, plotH = 280;
  const groupW = plotW / metrics.length;
  const barW = (groupW - 30) / algos.length;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 400" font-family="Helvetica,Arial,sans-serif" font-size="10">`;
  svg += `<text x="${W / 2}" y="22" text-anchor="middle" font-size="13" font-weight="bold">Şekil 3: Algoritma karşılaştırması — ortalama ± SD (N=30)</text>`;
  // y axis
  for (let i = 0; i <= 10; i++) {
    const y = top + plotH - (i / 10) * plotH;
    svg += `<line x1="${left}" y1="${y}" x2="${left + plotW}" y2="${y}" stroke="#eee"/>`;
    svg += `<text x="${left - 6}" y="${y + 3}" text-anchor="end" font-size="8">${(i * 10)}%</text>`;
  }
  // bars
  metrics.forEach((mk, mi) => {
    const gx = left + mi * groupW + 15;
    svg += `<text x="${gx + (groupW - 30) / 2}" y="${top + plotH + 16}" text-anchor="middle" font-size="10" font-weight="bold">${labels[mk]}</text>`;
    algos.forEach((a, ai) => {
      const m = stats[a][mk].mean, s = stats[a][mk].sd;
      const h = m * plotH;
      const x = gx + ai * barW;
      const y = top + plotH - h;
      svg += `<rect x="${x}" y="${y}" width="${barW - 4}" height="${h}" fill="${colors[a]}"/>`;
      // SD whisker
      const sdH = s * plotH;
      const cx = x + (barW - 4) / 2;
      svg += `<line x1="${cx}" y1="${y - sdH}" x2="${cx}" y2="${y + sdH}" stroke="#222" stroke-width="1"/>`;
      svg += `<line x1="${cx - 4}" y1="${y - sdH}" x2="${cx + 4}" y2="${y - sdH}" stroke="#222"/>`;
      svg += `<line x1="${cx - 4}" y1="${y + sdH}" x2="${cx + 4}" y2="${y + sdH}" stroke="#222"/>`;
      svg += `<text x="${cx}" y="${y - sdH - 4}" text-anchor="middle" font-size="8">${(m * 100).toFixed(1)}%</text>`;
    });
  });
  // legend
  algos.forEach((a, i) => {
    svg += `<rect x="${left + i * 140}" y="${top + plotH + 32}" width="14" height="10" fill="${colors[a]}"/>`;
    svg += `<text x="${left + i * 140 + 18}" y="${top + plotH + 41}" font-size="10">${a}</text>`;
  });
  svg += `</svg>`;
  return svg;
}

// Figure 4: Severity distribution of detected invalid transitions, per algorithm.
export function severitySplitSvg(severityCounts) {
  // severityCounts = { B1_Random: {LOW,MEDIUM,HIGH,CRITICAL}, ... } (mean per trial)
  const algos = Object.keys(severityCounts);
  const sevs = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const colors = { LOW: "#fde68a", MEDIUM: "#fcb464", HIGH: "#f37b6b", CRITICAL: "#c43d3d" };

  const left = 100, top = 50, plotW = 540, plotH = 240;
  const barH = plotH / algos.length - 16;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 360" font-family="Helvetica,Arial,sans-serif" font-size="10">`;
  svg += `<text x="${W / 2}" y="22" text-anchor="middle" font-size="13" font-weight="bold">Şekil 4: Tespit edilen invalid'lerin şiddet dağılımı (N=30 ort.)</text>`;
  algos.forEach((a, ai) => {
    const total = sevs.reduce((s, k) => s + severityCounts[a][k], 0) || 1;
    const y = top + ai * (barH + 16);
    svg += `<text x="${left - 6}" y="${y + barH / 2 + 3}" text-anchor="end" font-weight="bold">${a}</text>`;
    let x = left;
    sevs.forEach((s) => {
      const w = (severityCounts[a][s] / total) * plotW;
      svg += `<rect x="${x}" y="${y}" width="${w}" height="${barH}" fill="${colors[s]}"/>`;
      if (w > 28) svg += `<text x="${x + w / 2}" y="${y + barH / 2 + 3}" text-anchor="middle" font-size="9">${severityCounts[a][s].toFixed(1)}</text>`;
      x += w;
    });
    svg += `<text x="${left + plotW + 8}" y="${y + barH / 2 + 3}" font-size="9" fill="#555">Σ=${total.toFixed(1)}</text>`;
  });
  // legend
  let lx = left;
  sevs.forEach((s) => {
    svg += `<rect x="${lx}" y="${top + plotH + 16}" width="14" height="10" fill="${colors[s]}"/>`;
    svg += `<text x="${lx + 18}" y="${top + plotH + 25}" font-size="10">${s}</text>`;
    lx += 90;
  });
  svg += `</svg>`;
  return svg;
}
