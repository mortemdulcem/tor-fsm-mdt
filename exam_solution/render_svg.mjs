// Hand-crafted SVG renderer for UML class & sequence diagrams.
// Style: textbook / academic monochrome — white boxes, thin black borders,
// subtle gray header band, serif/sans typography. No flashy colors.

const PALETTE = {
  border:     "#1a1a1a",
  borderSoft: "#3b3b3b",
  headerFill: "#ececec",
  headerStrong: "#dcdcdc",   // for service / mediator hint
  textPrimary:"#0c0c0c",
  textMuted:  "#3a3a3a",
  textLabel:  "#1c1c1c",
  background: "#ffffff",
  paper:      "#fbfaf6",     // very subtle off-white "paper" tone
  rule:       "#1a1a1a",
  noteBg:     "#fdf6dc",     // post-it / hand-written note tint
};

const FONT       = "'EB Garamond','Georgia','Cambria',serif";
const SANS_FONT  = "'Inter','Helvetica Neue','Segoe UI',Arial,sans-serif";
const MONO_FONT  = "'JetBrains Mono','SFMono-Regular','Consolas',Menlo,monospace";

const HEADER_PADDING = 10;
const ROW_HEIGHT     = 22;
const SECTION_PAD    = 10;
const HEADER_HEIGHT  = 56;

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function classBoxHeight(c) {
  const attrsH = c.attributes.length > 0
    ? SECTION_PAD * 2 + c.attributes.length * ROW_HEIGHT
    : SECTION_PAD;
  const methodsH = c.methods.length > 0
    ? SECTION_PAD * 2 + c.methods.length * ROW_HEIGHT
    : SECTION_PAD;
  return HEADER_HEIGHT + attrsH + methodsH;
}

function defaultStereotype(kind) {
  switch (kind) {
    case "interface":  return "<<interface>>";
    case "abstract":   return "<<abstract>>";
    case "enum":       return "<<enumeration>>";
    case "value":      return "<<value object>>";
    case "service":    return "<<service>>";
    case "mediator":   return "<<mediator>>";
    case "entity":     return "<<entity>>";
    default:           return null;
  }
}

function renderClass(c) {
  const h = classBoxHeight(c);
  const stereotype = c.stereotype || defaultStereotype(c.kind);
  const italicName = c.kind === "abstract" || c.kind === "interface";
  const headerFill = (c.kind === "service" || c.kind === "mediator") ? PALETTE.headerStrong : PALETTE.headerFill;

  const attrsTopY = c.y + HEADER_HEIGHT;
  const attrsHeight = c.attributes.length > 0
    ? SECTION_PAD * 2 + c.attributes.length * ROW_HEIGHT
    : SECTION_PAD;
  const methodsTopY = attrsTopY + attrsHeight;

  const parts = [];
  parts.push(`<g class="cls-${escapeXml(c.id)}">`);

  parts.push(`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${h}"
        fill="${PALETTE.background}" stroke="${PALETTE.border}" stroke-width="1.1"/>`);

  parts.push(`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${HEADER_HEIGHT}"
        fill="${headerFill}" stroke="none"/>`);

  parts.push(`<line x1="${c.x}" y1="${c.y + HEADER_HEIGHT}" x2="${c.x + c.w}" y2="${c.y + HEADER_HEIGHT}"
        stroke="${PALETTE.border}" stroke-width="1.1"/>`);

  if (stereotype) {
    parts.push(`<text x="${c.x + c.w / 2}" y="${c.y + 21}" text-anchor="middle"
      font-family="${FONT}" font-style="italic" font-size="12.5" fill="${PALETTE.textMuted}">
      ${escapeXml(stereotype)}
    </text>`);
  }

  parts.push(`<text x="${c.x + c.w / 2}" y="${c.y + 44}" text-anchor="middle"
    font-family="${FONT}" font-weight="700" font-size="16"
    ${italicName ? 'font-style="italic"' : ""}
    fill="${PALETTE.textPrimary}">
    ${escapeXml(c.name)}
  </text>`);

  // Attributes section
  for (let i = 0; i < c.attributes.length; i++) {
    const text = c.attributes[i];
    const lineY = attrsTopY + SECTION_PAD + ROW_HEIGHT * i + 16;
    const italic = /^<<.+>>/.test(text) ? 'font-style="italic"' : "";
    parts.push(`<text x="${c.x + 12}" y="${lineY}" font-family="${MONO_FONT}" font-size="12.5" ${italic} fill="${PALETTE.textPrimary}">${escapeXml(text)}</text>`);
  }

  // Section divider
  parts.push(`<line x1="${c.x}" y1="${methodsTopY}" x2="${c.x + c.w}" y2="${methodsTopY}"
    stroke="${PALETTE.border}" stroke-width="0.8"/>`);

  for (let i = 0; i < c.methods.length; i++) {
    const text = c.methods[i];
    const lineY = methodsTopY + SECTION_PAD + ROW_HEIGHT * i + 16;
    const italic = /\{abstract\}/.test(text) ? 'font-style="italic"' : "";
    parts.push(`<text x="${c.x + 12}" y="${lineY}" font-family="${MONO_FONT}" font-size="12" ${italic} fill="${PALETTE.textPrimary}">${escapeXml(text)}</text>`);
  }

  parts.push(`</g>`);
  return parts.join("\n");
}

function anchor(box, side, offset = 0.5) {
  const h = classBoxHeight(box);
  switch (side) {
    case "top":    return { x: box.x + box.w * offset, y: box.y };
    case "bottom": return { x: box.x + box.w * offset, y: box.y + h };
    case "left":   return { x: box.x,                  y: box.y + h * offset };
    case "right":  return { x: box.x + box.w,          y: box.y + h * offset };
  }
}

function sideNormal(side) {
  switch (side) {
    case "top":    return { x: 0, y: -1 };
    case "bottom": return { x: 0, y:  1 };
    case "left":   return { x: -1, y: 0 };
    case "right":  return { x: 1,  y: 0 };
  }
}

function buildPath(rel, fromBox, toBox) {
  const fromOff = rel.fromOffset ?? 0.5;
  const toOff   = rel.toOffset ?? 0.5;
  const A = anchor(fromBox, rel.fromSide, fromOff);
  const B = anchor(toBox, rel.toSide, toOff);

  if (rel.routing === "selfLoop") {
    const out1 = sideNormal(rel.fromSide);
    const out2 = sideNormal(rel.toSide);
    const off = 36;
    const p1 = { x: A.x + out1.x * off, y: A.y + out1.y * off };
    const p2 = { x: B.x + out2.x * off, y: B.y + out2.y * off };
    const cornerX = (rel.fromSide === "top" || rel.fromSide === "bottom") ? p2.x : p1.x;
    const cornerY = (rel.fromSide === "left" || rel.fromSide === "right") ? p2.y : p1.y;
    return {
      d: `M ${A.x} ${A.y} L ${p1.x} ${p1.y} L ${cornerX} ${cornerY} L ${p2.x} ${p2.y} L ${B.x} ${B.y}`,
      end: B, start: A,
      endDir: { x: -out2.x, y: -out2.y },
      startDir: { x: -out1.x, y: -out1.y },
      midpoint: { x: cornerX, y: cornerY - 8 },
    };
  }

  if (rel.routing === "orthogonal") {
    const n1 = sideNormal(rel.fromSide);
    const n2 = sideNormal(rel.toSide);
    const stub = 28;
    const p1 = { x: A.x + n1.x * stub, y: A.y + n1.y * stub };
    const p2 = { x: B.x + n2.x * stub, y: B.y + n2.y * stub };
    let cornerX, cornerY;
    if (Math.abs(n1.y) > 0) {
      cornerX = p2.x;
      cornerY = p1.y;
    } else {
      cornerX = p1.x;
      cornerY = p2.y;
    }
    return {
      d: `M ${A.x} ${A.y} L ${p1.x} ${p1.y} L ${cornerX} ${cornerY} L ${p2.x} ${p2.y} L ${B.x} ${B.y}`,
      end: B, start: A,
      endDir: { x: -n2.x, y: -n2.y },
      startDir: { x: -n1.x, y: -n1.y },
      midpoint: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
    };
  }

  const n1 = sideNormal(rel.fromSide);
  const n2 = sideNormal(rel.toSide);
  return {
    d: `M ${A.x} ${A.y} L ${B.x} ${B.y}`,
    end: B, start: A,
    endDir: { x: -n2.x, y: -n2.y },
    startDir: { x: -n1.x, y: -n1.y },
    midpoint: { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 },
  };
}

function renderDecorator(point, dir, type, role) {
  const len = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / len;
  const uy = dir.y / len;
  const px = -uy;
  const py =  ux;
  const tipX = point.x;
  const tipY = point.y;

  if (role === "end" && (type === "inheritance" || type === "realization")) {
    const baseLen = 18;
    const baseHalf = 10;
    const baseX = tipX - ux * baseLen;
    const baseY = tipY - uy * baseLen;
    const p1x = baseX + px * baseHalf;
    const p1y = baseY + py * baseHalf;
    const p2x = baseX - px * baseHalf;
    const p2y = baseY - py * baseHalf;
    return `<polygon points="${tipX},${tipY} ${p1x},${p1y} ${p2x},${p2y}" fill="#ffffff" stroke="${PALETTE.border}" stroke-width="1.5" stroke-linejoin="miter"/>`;
  }

  if (role === "end" && (type === "association" || type === "dependency")) {
    const baseLen = 18;
    const baseHalf = 9;
    const baseX = tipX - ux * baseLen;
    const baseY = tipY - uy * baseLen;
    const p1x = baseX + px * baseHalf;
    const p1y = baseY + py * baseHalf;
    const p2x = baseX - px * baseHalf;
    const p2y = baseY - py * baseHalf;
    return `<polyline points="${p1x},${p1y} ${tipX},${tipY} ${p2x},${p2y}" fill="none" stroke="${PALETTE.border}" stroke-width="1.8" stroke-linejoin="miter" stroke-linecap="round"/>`;
  }

  if (role === "start" && (type === "aggregation" || type === "composition")) {
    const baseLen = 20;
    const baseHalf = 9;
    const fill = type === "composition" ? PALETTE.border : "#ffffff";
    const baseX = tipX - ux * baseLen;
    const baseY = tipY - uy * baseLen;
    const midX = tipX - ux * (baseLen / 2);
    const midY = tipY - uy * (baseLen / 2);
    const p1x = midX + px * baseHalf;
    const p1y = midY + py * baseHalf;
    const p2x = midX - px * baseHalf;
    const p2y = midY - py * baseHalf;
    return `<polygon points="${tipX},${tipY} ${p1x},${p1y} ${baseX},${baseY} ${p2x},${p2y}" fill="${fill}" stroke="${PALETTE.border}" stroke-width="1.5" stroke-linejoin="miter"/>`;
  }

  return "";
}

function renderRelationship(rel, classMap) {
  const fromBox = classMap.get(rel.from);
  const toBox = classMap.get(rel.to);
  if (!fromBox || !toBox) return "";
  const p = buildPath(rel, fromBox, toBox);

  const isDashed = rel.type === "realization" || rel.type === "dependency";

  const parts = [];
  parts.push(`<g class="rel-${rel.type}">`);
  parts.push(`<path d="${p.d}" fill="none" stroke="${PALETTE.border}" stroke-width="1.2"
    ${isDashed ? 'stroke-dasharray="8,5"' : ""} stroke-linejoin="round" stroke-linecap="round"/>`);

  if (rel.type === "aggregation" || rel.type === "composition") {
    parts.push(renderDecorator(p.start, p.startDir, rel.type, "start"));
  }
  if (["inheritance","realization","association","dependency"].includes(rel.type)) {
    parts.push(renderDecorator(p.end, p.endDir, rel.type, "end"));
  }

  if (rel.mFrom) {
    const off = labelOffset(p.start, rel.fromSide);
    parts.push(`<text x="${off.x}" y="${off.y}" text-anchor="${off.anchor}" font-family="${SANS_FONT}" font-size="11.5" fill="${PALETTE.textPrimary}">${escapeXml(rel.mFrom)}</text>`);
  }
  if (rel.mTo) {
    const off = labelOffset(p.end, rel.toSide);
    parts.push(`<text x="${off.x}" y="${off.y}" text-anchor="${off.anchor}" font-family="${SANS_FONT}" font-size="11.5" fill="${PALETTE.textPrimary}">${escapeXml(rel.mTo)}</text>`);
  }

  if (rel.label) {
    const m = p.midpoint;
    parts.push(`<g>
      <text x="${m.x}" y="${m.y - 8}" text-anchor="middle"
        font-family="${FONT}" font-size="13" font-style="italic" fill="${PALETTE.textPrimary}"
        paint-order="stroke" stroke="#ffffff" stroke-width="3.5" stroke-linejoin="round">
        ${escapeXml(rel.label)}
      </text>
    </g>`);
  }

  parts.push(`</g>`);
  return parts.join("\n");
}

function labelOffset(pt, side) {
  switch (side) {
    case "left":   return { x: pt.x - 10, y: pt.y + 16, anchor: "end" };
    case "right":  return { x: pt.x + 10, y: pt.y + 16, anchor: "start" };
    case "top":    return { x: pt.x + 10, y: pt.y - 10,  anchor: "start" };
    case "bottom": return { x: pt.x + 10, y: pt.y + 18, anchor: "start" };
    default:       return { x: pt.x,      y: pt.y,      anchor: "middle" };
  }
}

// ---------------------------------------------------------------------------
// Class diagram top-level
// ---------------------------------------------------------------------------
export function renderDiagram(diagram) {
  const W = diagram.width;
  const H = diagram.height;
  const classMap = new Map(diagram.classes.map(c => [c.id, c]));

  const titleBlock = `
    <text x="${W / 2}" y="42" text-anchor="middle" font-family="${FONT}" font-size="22" font-weight="700" fill="${PALETTE.textPrimary}">
      ${escapeXml(diagram.title)}
    </text>
    <text x="${W / 2}" y="64" text-anchor="middle" font-family="${FONT}" font-size="13" font-style="italic" fill="${PALETTE.textMuted}">
      ${escapeXml(diagram.subtitle)}
    </text>
    <line x1="60" y1="80" x2="${W - 60}" y2="80" stroke="${PALETTE.rule}" stroke-width="0.8"/>
  `;

  const contentOffsetY = 100;
  diagram.classes.forEach(c => { c.y += contentOffsetY; });

  const classSvg = diagram.classes.map(renderClass).join("\n");
  const relSvg = diagram.relationships.map(r => renderRelationship(r, classMap)).join("\n");

  // UML notes (folded-corner) with optional dashed attachment line to a class
  const notes = diagram.notes || [];
  notes.forEach(n => { n._yShifted = n.y + contentOffsetY; });
  const noteSvg = notes.map(n => renderClassNote(n, classMap, contentOffsetY)).join("\n");

  diagram.classes.forEach(c => { c.y -= contentOffsetY; });

  const totalHeight = H + 100 + 80;
  const legend = renderLegend(W, totalHeight - 100);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${totalHeight}" width="${W}" height="${totalHeight}">
  <rect width="${W}" height="${totalHeight}" fill="${PALETTE.paper}"/>
  ${titleBlock}
  ${relSvg}
  ${classSvg}
  ${noteSvg}
  ${legend}
</svg>`;
}

function renderClassNote(note, classMap, contentOffsetY) {
  const lines = note.text.split("\n");
  const lineH = 15;
  const padX = 10;
  const padY = 18;
  const fold = 12;
  const charW = 6.6;
  const maxLineW = Math.max(...lines.map(l => l.length * charW));
  const w = note.w || Math.max(180, maxLineW + padX * 2 + fold);
  const h = note.h || (padY * 2 + lines.length * lineH);
  const x = note.x;
  const y = note.y + contentOffsetY;

  const path = `M ${x} ${y}
                L ${x + w - fold} ${y}
                L ${x + w} ${y + fold}
                L ${x + w} ${y + h}
                L ${x} ${y + h} Z`;
  const foldPath = `M ${x + w - fold} ${y}
                    L ${x + w - fold} ${y + fold}
                    L ${x + w} ${y + fold}`;
  const parts = [];
  parts.push(`<g>`);
  // Optional attachment line to a class
  if (note.attachTo && classMap.has(note.attachTo)) {
    const c = classMap.get(note.attachTo);
    const cy = c.y;
    const side = note.attachSide || "auto";
    let cx, cy2;
    if (side === "top")    { cx = c.x + c.w / 2;       cy2 = cy; }
    else if (side === "bottom") { cx = c.x + c.w / 2;  cy2 = cy + classBoxHeight(c); }
    else if (side === "left")   { cx = c.x;            cy2 = cy + classBoxHeight(c) / 2; }
    else if (side === "right")  { cx = c.x + c.w;      cy2 = cy + classBoxHeight(c) / 2; }
    else { cx = c.x + c.w / 2; cy2 = cy + classBoxHeight(c) / 2; }
    // Anchor on note edge closest to the class
    const anchorX = (cx < x) ? x : (cx > x + w) ? x + w : x + w / 2;
    const anchorY = (cy2 < y) ? y : (cy2 > y + h) ? y + h : y + h / 2;
    parts.push(`<line x1="${anchorX}" y1="${anchorY}" x2="${cx}" y2="${cy2}"
      stroke="${PALETTE.border}" stroke-width="1" stroke-dasharray="3,3" opacity="0.7"/>`);
  }
  parts.push(`<path d="${path}" fill="${PALETTE.noteBg || "#fdf6e3"}" stroke="${PALETTE.border}" stroke-width="1"/>`);
  parts.push(`<path d="${foldPath}" fill="none" stroke="${PALETTE.border}" stroke-width="1"/>`);
  lines.forEach((line, i) => {
    parts.push(`<text x="${x + padX}" y="${y + padY + (i + 1) * lineH - 4}"
      font-family="${SANS_FONT}" font-style="italic" font-size="11.5"
      fill="${PALETTE.textPrimary}">${escapeXml(line)}</text>`);
  });
  parts.push(`</g>`);
  return parts.join("\n");
}

function renderLegend(W, y) {
  const items = [
    { label: "Kalitim (inheritance)",       sample: "inheritance" },
    { label: "Gerceklestirme (realization)", sample: "realization" },
    { label: "Birikim (aggregation)",       sample: "aggregation" },
    { label: "Olusum (composition)",        sample: "composition" },
    { label: "Iliski (association)",        sample: "association" },
    { label: "Bagimlilik (dependency)",     sample: "dependency" },
  ];
  const startX = 60;
  const itemW = (W - 120) / items.length;
  const lineY = y + 50;
  const parts = [];
  parts.push(`<g>`);
  parts.push(`<line x1="60" y1="${y}" x2="${W - 60}" y2="${y}" stroke="${PALETTE.rule}" stroke-width="0.8"/>`);
  parts.push(`<text x="60" y="${y + 22}" font-family="${FONT}" font-size="13" font-style="italic" fill="${PALETTE.textMuted}">Notasyon Açıklaması</text>`);

  items.forEach((it, i) => {
    const ix = startX + i * itemW;
    const ax = ix + 4;
    const bx = ix + 56;
    const dashed = (it.sample === "realization" || it.sample === "dependency") ? 'stroke-dasharray="6,5"' : "";
    parts.push(`<line x1="${ax}" y1="${lineY}" x2="${bx}" y2="${lineY}" stroke="${PALETTE.border}" stroke-width="1.3" ${dashed}/>`);
    const dir = { x: 1, y: 0 };
    const tipPoint = { x: bx, y: lineY };
    if (it.sample === "inheritance" || it.sample === "realization") {
      parts.push(renderDecorator(tipPoint, dir, it.sample, "end"));
    } else if (it.sample === "association" || it.sample === "dependency") {
      parts.push(renderDecorator(tipPoint, dir, it.sample, "end"));
    } else if (it.sample === "aggregation" || it.sample === "composition") {
      parts.push(renderDecorator({ x: ax, y: lineY }, { x: -1, y: 0 }, it.sample, "start"));
    }
    parts.push(`<text x="${bx + 10}" y="${lineY + 4}" font-family="${SANS_FONT}" font-size="11.5" fill="${PALETTE.textPrimary}">${escapeXml(it.label)}</text>`);
  });

  parts.push(`</g>`);
  return parts.join("\n");
}

// ===========================================================================
// SEQUENCE DIAGRAM RENDERER
// ===========================================================================
//
// data shape:
// {
//   width, height, title, subtitle,
//   actors: [{ id, label, kind: "actor"|"object"|"boundary"|"control"|"entity" }, ...],
//   messages: [
//     { from, to, label, kind: "sync"|"async"|"return"|"create"|"self", note? },
//     { kind: "frag", type: "alt"|"loop"|"opt", label, condition }, // future
//   ]
// }

function seqArrowhead(point, dir, filled) {
  const ux = dir.x, uy = dir.y;
  const px = -uy, py = ux;
  const baseLen = 12;
  const baseHalf = 6;
  const bx = point.x - ux * baseLen;
  const by = point.y - uy * baseLen;
  const p1x = bx + px * baseHalf;
  const p1y = by + py * baseHalf;
  const p2x = bx - px * baseHalf;
  const p2y = by - py * baseHalf;
  if (filled) {
    return `<polygon points="${point.x},${point.y} ${p1x},${p1y} ${p2x},${p2y}" fill="${PALETTE.border}" stroke="${PALETTE.border}" stroke-width="1" stroke-linejoin="miter"/>`;
  }
  return `<polyline points="${p1x},${p1y} ${point.x},${point.y} ${p2x},${p2y}" fill="none" stroke="${PALETTE.border}" stroke-width="1.3" stroke-linejoin="miter" stroke-linecap="round"/>`;
}

export function renderSequenceDiagram(diagram) {
  const W = diagram.width;
  const H = diagram.height;

  const titleBlock = `
    <text x="${W / 2}" y="42" text-anchor="middle" font-family="${FONT}" font-size="22" font-weight="700" fill="${PALETTE.textPrimary}">
      ${escapeXml(diagram.title)}
    </text>
    <text x="${W / 2}" y="64" text-anchor="middle" font-family="${FONT}" font-size="13" font-style="italic" fill="${PALETTE.textMuted}">
      ${escapeXml(diagram.subtitle)}
    </text>
    <line x1="60" y1="80" x2="${W - 60}" y2="80" stroke="${PALETTE.rule}" stroke-width="0.8"/>
  `;

  const topPad = 110;
  const lifelineHeadH = 60;
  const headTop = topPad;
  const headBottom = headTop + lifelineHeadH;

  const margin = 80;
  const usableW = W - margin * 2;
  const colW = usableW / diagram.actors.length;
  const lifelineX = diagram.actors.map((_, i) => margin + colW * i + colW / 2);

  // Render headers
  const headers = diagram.actors.map((a, i) => {
    const cx = lifelineX[i];
    const headW = Math.min(220, colW - 40);
    const x = cx - headW / 2;
    const stereo = a.kind && a.kind !== "object" ? `<<${a.kind}>>` : null;
    return `
      <rect x="${x}" y="${headTop}" width="${headW}" height="${lifelineHeadH}"
            fill="${PALETTE.headerFill}" stroke="${PALETTE.border}" stroke-width="1.3"/>
      ${stereo ? `<text x="${cx}" y="${headTop + 22}" text-anchor="middle" font-family="${FONT}" font-style="italic" font-size="12.5" fill="${PALETTE.textMuted}">${escapeXml(stereo)}</text>` : ""}
      <text x="${cx}" y="${headTop + (stereo ? 44 : 36)}" text-anchor="middle"
            font-family="${FONT}" font-weight="700" font-size="14" fill="${PALETTE.textPrimary}">${escapeXml(a.label)}</text>
    `;
  }).join("\n");

  const actorIndex = new Map(diagram.actors.map((a, i) => [a.id, i]));

  // Compute message Y positions with dynamic spacing per message
  const msgStartY = headBottom + 40;
  const baseGap = 50;
  const selfExtra = 18;     // self-loops need more vertical room (loop has height 22)
  const noteExtra = 44;     // notes need extra vertical room
  const messages = diagram.messages;
  const msgY = [];
  let cursorY = msgStartY;
  for (let i = 0; i < messages.length; i++) {
    msgY.push(cursorY);
    let gap = baseGap;
    const m = messages[i];
    if (m.kind === "self" || (actorIndex.get(m.from) === actorIndex.get(m.to))) gap += selfExtra;
    if (m.note) gap += noteExtra;
    cursorY += gap;
  }

  // Lifelines (dashed vertical lines from below headers down to bottom)
  const lifelineTop = headBottom;
  const lifelineBottom = cursorY + 30;
  const lifelines = lifelineX.map((cx) =>
    `<line x1="${cx}" y1="${lifelineTop}" x2="${cx}" y2="${lifelineBottom}" stroke="${PALETTE.borderSoft}" stroke-width="1" stroke-dasharray="5,5"/>`
  ).join("\n");

  // Activation rectangles - track activations per actor with stack
  const ACT_W = 12;
  const activations = diagram.actors.map(() => []); // stacks
  const actRects = [];

  function activate(actorIdx, y) {
    activations[actorIdx].push(y);
  }
  function deactivate(actorIdx, y) {
    const start = activations[actorIdx].pop();
    if (start !== undefined) {
      const cx = lifelineX[actorIdx];
      actRects.push(`<rect x="${cx - ACT_W/2}" y="${start}" width="${ACT_W}" height="${y - start}" fill="${PALETTE.background}" stroke="${PALETTE.border}" stroke-width="1.2"/>`);
    }
  }

  // Render messages
  const msgSvg = messages.map((m, i) => {
    const y = msgY[i];
    const fromIdx = actorIndex.get(m.from);
    const toIdx = actorIndex.get(m.to);
    if (fromIdx === undefined || toIdx === undefined) return "";

    const x1 = lifelineX[fromIdx];
    const x2 = lifelineX[toIdx];

    const isReturn = m.kind === "return";
    const isAsync = m.kind === "async";
    const isCreate = m.kind === "create";
    const isSelf = fromIdx === toIdx || m.kind === "self";

    const dashAttr = (isReturn || isCreate) ? 'stroke-dasharray="6,5"' : "";
    const stroke = PALETTE.border;

    // Handle activations
    if (!isReturn) {
      if (isSelf) {
        // self-activation (push)
        activate(toIdx, y);
      } else {
        activate(toIdx, y);
      }
    } else {
      // return: pop activation on caller side (from)
      deactivate(fromIdx, y);
    }

    const parts = [];
    const useFilled = !isReturn && !isAsync && !isCreate;
    if (isSelf) {
      const cx = x1;
      const loopW = 60;
      const dx = ACT_W / 2;
      parts.push(`<path d="M ${cx + dx} ${y} L ${cx + dx + loopW} ${y} L ${cx + dx + loopW} ${y + 22} L ${cx + dx + 4} ${y + 22}"
        fill="none" stroke="${stroke}" stroke-width="1.3" ${dashAttr}/>`);
      const tipPoint = { x: cx + dx + 4, y: y + 22 };
      const dir = { x: -1, y: 0 };
      parts.push(seqArrowhead(tipPoint, dir, useFilled));
      parts.push(`<text x="${cx + dx + 8}" y="${y - 6}" font-family="${SANS_FONT}" font-size="12" fill="${PALETTE.textPrimary}">${escapeXml(m.label)}</text>`);
    } else {
      const goingRight = x2 > x1;
      const startX = goingRight ? x1 + ACT_W/2 : x1 - ACT_W/2;
      const endX = goingRight ? x2 - ACT_W/2 : x2 + ACT_W/2;
      parts.push(`<line x1="${startX}" y1="${y}" x2="${endX}" y2="${y}" stroke="${stroke}" stroke-width="1.3" ${dashAttr}/>`);
      const tipPoint = { x: endX, y: y };
      const dir = { x: goingRight ? 1 : -1, y: 0 };
      parts.push(seqArrowhead(tipPoint, dir, useFilled));
      const midX = (startX + endX) / 2;
      parts.push(`<text x="${midX}" y="${y - 8}" text-anchor="middle" font-family="${SANS_FONT}" font-size="12.5" fill="${PALETTE.textPrimary}"
        paint-order="stroke" stroke="#ffffff" stroke-width="3" stroke-linejoin="round">${i + 1}: ${escapeXml(m.label)}</text>`);
    }
    if (m.note) {
      // UML note (folded corner) placed below the message line so it does not collide with the label
      const noteText = m.note;
      const charW = 6.6;
      const noteW = Math.max(180, Math.min(540, noteText.length * charW + 28));
      const noteH = 30;
      let noteX;
      if (isSelf) {
        // place to the right of the self loop
        noteX = x1 + ACT_W / 2 + 70;
      } else {
        noteX = Math.min(x1, x2) + 20;
      }
      const noteY = y + 16;     // safely below the message line (label sits at y-8)
      const fold = 10;
      // path with folded top-right corner
      const path = `M ${noteX} ${noteY}
                    L ${noteX + noteW - fold} ${noteY}
                    L ${noteX + noteW} ${noteY + fold}
                    L ${noteX + noteW} ${noteY + noteH}
                    L ${noteX} ${noteY + noteH} Z`;
      const foldPath = `M ${noteX + noteW - fold} ${noteY}
                        L ${noteX + noteW - fold} ${noteY + fold}
                        L ${noteX + noteW} ${noteY + fold}`;
      parts.push(`<g>
        <path d="${path}" fill="#faf6e8" stroke="${PALETTE.border}" stroke-width="1"/>
        <path d="${foldPath}" fill="none" stroke="${PALETTE.border}" stroke-width="1"/>
        <text x="${noteX + 8}" y="${noteY + 20}" font-family="${FONT}" font-style="italic" font-size="11.5" fill="${PALETTE.textPrimary}">${escapeXml(noteText)}</text>
      </g>`);
    }
    return parts.join("\n");
  }).join("\n");

  // Close any remaining activations at bottom
  for (let i = 0; i < activations.length; i++) {
    while (activations[i].length > 0) {
      const start = activations[i].pop();
      const cx = lifelineX[i];
      actRects.push(`<rect x="${cx - ACT_W/2}" y="${start}" width="${ACT_W}" height="${lifelineBottom - start}" fill="${PALETTE.background}" stroke="${PALETTE.border}" stroke-width="1.2"/>`);
    }
  }

  const totalHeight = Math.max(H, lifelineBottom + 60);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${totalHeight}" width="${W}" height="${totalHeight}">
  <rect width="${W}" height="${totalHeight}" fill="${PALETTE.paper}"/>
  ${titleBlock}
  ${lifelines}
  ${actRects.join("\n")}
  ${headers}
  ${msgSvg}
</svg>`;
}
