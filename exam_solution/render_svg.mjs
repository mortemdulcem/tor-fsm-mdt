// Hand-crafted SVG renderer for UML class diagrams.
// Renders class boxes (entity, abstract, interface, enum, value, service, mediator)
// and relationships (inheritance, realization, aggregation, composition, association, dependency)

const COLORS = {
  entity:   { stroke: "#1f3b66", fill: "#e8f0fb", header: "#1f3b66", headerText: "#ffffff" },
  concrete: { stroke: "#1f3b66", fill: "#ffffff", header: "#2c5282", headerText: "#ffffff" },
  abstract: { stroke: "#553c9a", fill: "#f3edff", header: "#553c9a", headerText: "#ffffff" },
  interface:{ stroke: "#9c6914", fill: "#fff8e7", header: "#9c6914", headerText: "#ffffff" },
  enum:     { stroke: "#1c6749", fill: "#e9f6ee", header: "#1c6749", headerText: "#ffffff" },
  value:    { stroke: "#5a4632", fill: "#f7f0e6", header: "#5a4632", headerText: "#ffffff" },
  service:  { stroke: "#7b1d3a", fill: "#fbeaf0", header: "#7b1d3a", headerText: "#ffffff" },
  mediator: { stroke: "#7b1d3a", fill: "#fbeaf0", header: "#7b1d3a", headerText: "#ffffff" },
};

const FONT       = "'Inter','Helvetica Neue','Segoe UI',Arial,sans-serif";
const MONO_FONT  = "'JetBrains Mono','SFMono-Regular','Consolas',Menlo,monospace";

const HEADER_PADDING = 10;
const ROW_HEIGHT     = 22;
const SECTION_PAD    = 10;
const HEADER_HEIGHT  = 56; // stereotype + name + spacer

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function classBoxHeight(c) {
  const attrsH = SECTION_PAD * 2 + Math.max(1, c.attributes.length) * ROW_HEIGHT;
  const methodsH = SECTION_PAD * 2 + Math.max(1, c.methods.length) * ROW_HEIGHT;
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
  const palette = COLORS[c.kind] || COLORS.concrete;
  const h = classBoxHeight(c);
  const stereotype = c.stereotype || defaultStereotype(c.kind);
  const italicName = c.kind === "abstract" || c.kind === "interface";

  const attrsTopY = c.y + HEADER_HEIGHT;
  const attrsHeight = SECTION_PAD * 2 + Math.max(1, c.attributes.length) * ROW_HEIGHT;
  const methodsTopY = attrsTopY + attrsHeight;
  const methodsHeight = SECTION_PAD * 2 + Math.max(1, c.methods.length) * ROW_HEIGHT;

  const parts = [];

  // Drop shadow filter applied via filter ref defined in <defs>
  parts.push(`<g class="cls-${escapeXml(c.id)}" filter="url(#dropShadow)">`);

  // Outer box
  parts.push(`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${h}"
        rx="6" ry="6" fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="1.6"/>`);

  // Header band
  parts.push(`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${HEADER_HEIGHT}"
        rx="6" ry="6" fill="${palette.header}" stroke="${palette.stroke}" stroke-width="1.6"/>`);
  // Square off bottom of header
  parts.push(`<rect x="${c.x}" y="${c.y + HEADER_HEIGHT - 8}" width="${c.w}" height="8"
        fill="${palette.header}" stroke="none"/>`);
  // Bottom border of header
  parts.push(`<line x1="${c.x}" y1="${c.y + HEADER_HEIGHT}" x2="${c.x + c.w}" y2="${c.y + HEADER_HEIGHT}"
        stroke="${palette.stroke}" stroke-width="1.6"/>`);

  // Stereotype
  if (stereotype) {
    parts.push(`<text x="${c.x + c.w / 2}" y="${c.y + 20}" text-anchor="middle"
      font-family="${FONT}" font-style="italic" font-size="12" fill="${palette.headerText}">
      ${escapeXml(stereotype)}
    </text>`);
  }

  // Class name
  parts.push(`<text x="${c.x + c.w / 2}" y="${c.y + 42}" text-anchor="middle"
    font-family="${FONT}" font-weight="700" font-size="16"
    ${italicName ? 'font-style="italic"' : ""}
    fill="${palette.headerText}">
    ${escapeXml(c.name)}
  </text>`);

  // Attributes section
  for (let i = 0; i < c.attributes.length; i++) {
    const text = c.attributes[i];
    const lineY = attrsTopY + SECTION_PAD + ROW_HEIGHT * i + 16;
    parts.push(`<text x="${c.x + 12}" y="${lineY}" font-family="${MONO_FONT}" font-size="12.5" fill="#1a1a1a">${escapeXml(text)}</text>`);
  }

  // Section divider between attributes and methods
  parts.push(`<line x1="${c.x}" y1="${methodsTopY}" x2="${c.x + c.w}" y2="${methodsTopY}"
    stroke="${palette.stroke}" stroke-width="1"/>`);

  // Methods section
  for (let i = 0; i < c.methods.length; i++) {
    const text = c.methods[i];
    const lineY = methodsTopY + SECTION_PAD + ROW_HEIGHT * i + 16;
    parts.push(`<text x="${c.x + 12}" y="${lineY}" font-family="${MONO_FONT}" font-size="12.5" fill="#1a1a1a">${escapeXml(text)}</text>`);
  }

  parts.push(`</g>`);
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Anchor point on a class box for a given side and offset.
// ---------------------------------------------------------------------------
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

// Build path d-attribute for a relationship.
function buildPath(rel, fromBox, toBox) {
  const fromOff = rel.fromOffset ?? 0.5;
  const toOff   = rel.toOffset ?? 0.5;
  const A = anchor(fromBox, rel.fromSide, fromOff);
  const B = anchor(toBox, rel.toSide, toOff);

  if (rel.routing === "selfLoop") {
    // Self-loop: goes out from fromSide perpendicular, then L-shape, then back into toSide of same box.
    const out1 = sideNormal(rel.fromSide);
    const out2 = sideNormal(rel.toSide);
    const off = 32;
    const p1 = { x: A.x + out1.x * off, y: A.y + out1.y * off };
    const p2 = { x: B.x + out2.x * off, y: B.y + out2.y * off };
    // The corner sits at the perpendicular intersection of the two stubs.
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
    const stub = 26;
    const p1 = { x: A.x + n1.x * stub, y: A.y + n1.y * stub };
    const p2 = { x: B.x + n2.x * stub, y: B.y + n2.y * stub };
    let cornerX, cornerY;
    // Decide whether to move horizontally or vertically first based on side normals.
    if (Math.abs(n1.y) > 0) {
      // Vertical first
      cornerX = p2.x;
      cornerY = p1.y;
    } else {
      // Horizontal first
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

  // Direct line
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

// Render a single decorator (arrow / diamond) at the given point with given direction.
function renderDecorator(point, dir, type, role /* "start" | "end" */) {
  // dir is the unit vector pointing FROM the line INTO the box (so for "end", dir points into target box; for "start", dir points into source box).
  // Normalize
  const len = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / len;
  const uy = dir.y / len;
  // Perpendicular
  const px = -uy;
  const py =  ux;
  const tipX = point.x;
  const tipY = point.y;

  if (role === "end" && (type === "inheritance" || type === "realization")) {
    // Open triangle pointing toward the target (i.e., into target side).
    const baseLen = 14;
    const baseHalf = 9;
    const baseX = tipX - ux * baseLen;
    const baseY = tipY - uy * baseLen;
    const p1x = baseX + px * baseHalf;
    const p1y = baseY + py * baseHalf;
    const p2x = baseX - px * baseHalf;
    const p2y = baseY - py * baseHalf;
    return `<polygon points="${tipX},${tipY} ${p1x},${p1y} ${p2x},${p2y}" fill="#ffffff" stroke="#202a3a" stroke-width="1.6" stroke-linejoin="miter"/>`;
  }

  if (role === "end" && (type === "association" || type === "dependency")) {
    // Open arrowhead V
    const baseLen = 12;
    const baseHalf = 7;
    const baseX = tipX - ux * baseLen;
    const baseY = tipY - uy * baseLen;
    const p1x = baseX + px * baseHalf;
    const p1y = baseY + py * baseHalf;
    const p2x = baseX - px * baseHalf;
    const p2y = baseY - py * baseHalf;
    return `<polyline points="${p1x},${p1y} ${tipX},${tipY} ${p2x},${p2y}" fill="none" stroke="#202a3a" stroke-width="1.6" stroke-linejoin="miter" stroke-linecap="round"/>`;
  }

  if (role === "start" && (type === "aggregation" || type === "composition")) {
    // Diamond pointing into source (whole) side.
    const baseLen = 18;
    const baseHalf = 8;
    const fill = type === "composition" ? "#202a3a" : "#ffffff";
    const baseX = tipX - ux * baseLen;
    const baseY = tipY - uy * baseLen;
    const midX = tipX - ux * (baseLen / 2);
    const midY = tipY - uy * (baseLen / 2);
    const p1x = midX + px * baseHalf;
    const p1y = midY + py * baseHalf;
    const p2x = midX - px * baseHalf;
    const p2y = midY - py * baseHalf;
    return `<polygon points="${tipX},${tipY} ${p1x},${p1y} ${baseX},${baseY} ${p2x},${p2y}" fill="${fill}" stroke="#202a3a" stroke-width="1.6" stroke-linejoin="miter"/>`;
  }

  return "";
}

function renderRelationship(rel, classMap) {
  const fromBox = classMap.get(rel.from);
  const toBox = classMap.get(rel.to);
  if (!fromBox || !toBox) return "";
  const p = buildPath(rel, fromBox, toBox);

  const isDashed = rel.type === "realization" || rel.type === "dependency";
  const lineStroke = "#202a3a";

  const parts = [];
  parts.push(`<g class="rel-${rel.type}">`);
  parts.push(`<path d="${p.d}" fill="none" stroke="${lineStroke}" stroke-width="1.5"
    ${isDashed ? 'stroke-dasharray="6,5"' : ""} stroke-linejoin="round" stroke-linecap="round"/>`);

  // Decorators
  if (rel.type === "aggregation" || rel.type === "composition") {
    parts.push(renderDecorator(p.start, p.startDir, rel.type, "start"));
  }
  if (["inheritance","realization","association","dependency"].includes(rel.type)) {
    parts.push(renderDecorator(p.end, p.endDir, rel.type, "end"));
  }

  // Multiplicity labels
  if (rel.mFrom) {
    const off = labelOffset(p.start, p.startDir);
    parts.push(`<text x="${off.x}" y="${off.y}" font-family="${FONT}" font-size="11.5" fill="#202a3a">${escapeXml(rel.mFrom)}</text>`);
  }
  if (rel.mTo) {
    const off = labelOffset(p.end, p.endDir, true);
    parts.push(`<text x="${off.x}" y="${off.y}" font-family="${FONT}" font-size="11.5" fill="#202a3a">${escapeXml(rel.mTo)}</text>`);
  }

  // Role label near midpoint
  if (rel.label) {
    const m = p.midpoint;
    parts.push(`<g>
      <text x="${m.x}" y="${m.y - 4}" text-anchor="middle"
        font-family="${FONT}" font-size="12" font-style="italic" fill="#36507c"
        paint-order="stroke" stroke="#ffffff" stroke-width="3" stroke-linejoin="round">
        ${escapeXml(rel.label)}
      </text>
    </g>`);
  }

  parts.push(`</g>`);
  return parts.join("\n");
}

function labelOffset(pt, dir, end = false) {
  // Place multiplicity label slightly offset away from line into the source/target box.
  const len = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / len;
  const uy = dir.y / len;
  // Perpendicular for slight side offset
  const px = -uy;
  const py =  ux;
  const distAlong = end ? -22 : -22;
  const distSide = 8;
  return {
    x: pt.x + ux * distAlong + px * distSide,
    y: pt.y + uy * distAlong + py * distSide + 4,
  };
}

// ---------------------------------------------------------------------------
// Top-level renderer
// ---------------------------------------------------------------------------
export function renderDiagram(diagram) {
  const W = diagram.width;
  const H = diagram.height;
  const classMap = new Map(diagram.classes.map(c => [c.id, c]));

  const titleBlock = `
    <rect x="0" y="0" width="${W}" height="80" fill="#0e1c2f"/>
    <text x="32" y="40" font-family="${FONT}" font-size="22" font-weight="700" fill="#ffffff">
      ${escapeXml(diagram.title)}
    </text>
    <text x="32" y="64" font-family="${FONT}" font-size="13" font-style="italic" fill="#a8b8d0">
      ${escapeXml(diagram.subtitle)}
    </text>
    <text x="${W - 32}" y="40" text-anchor="end" font-family="${FONT}" font-size="13" fill="#a8b8d0">
      Sinif Diyagrami
    </text>
    <text x="${W - 32}" y="64" text-anchor="end" font-family="${FONT}" font-size="11" fill="#7a8aa0">
      Nesneye Yonelik Yazilim Gelistirme — 2025-2026 Bahar
    </text>
  `;

  // Translate diagram content downward to leave room for title block
  const contentOffsetY = 90;
  diagram.classes.forEach(c => { c.y += contentOffsetY; });

  const classSvg = diagram.classes.map(renderClass).join("\n");
  const relSvg = diagram.relationships.map(r => renderRelationship(r, classMap)).join("\n");

  // Reset Y in case render runs again
  diagram.classes.forEach(c => { c.y -= contentOffsetY; });

  const totalHeight = H + 90;

  // Legend
  const legend = renderLegend(W, totalHeight - 110);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${totalHeight}" width="${W}" height="${totalHeight}">
  <defs>
    <filter id="dropShadow" x="-2%" y="-2%" width="104%" height="104%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.12"/>
    </filter>
    <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e6ebf2" stroke-width="0.6"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${totalHeight}" fill="#ffffff"/>
  <rect x="0" y="80" width="${W}" height="${totalHeight - 80}" fill="url(#gridPattern)"/>
  ${titleBlock}
  ${relSvg}
  ${classSvg}
  ${legend}
</svg>`;
}

function renderLegend(W, y) {
  const items = [
    { label: "Inheritance",   sample: "inheritance" },
    { label: "Realization",   sample: "realization" },
    { label: "Aggregation",   sample: "aggregation" },
    { label: "Composition",   sample: "composition" },
    { label: "Association",   sample: "association" },
    { label: "Dependency",    sample: "dependency" },
  ];
  const startX = 32;
  const itemW = 150;
  const lineY = y + 50;
  const parts = [];
  parts.push(`<g>`);
  parts.push(`<rect x="20" y="${y}" width="${W - 40}" height="80" rx="8" ry="8" fill="#f7f9fc" stroke="#cfd6e2"/>`);
  parts.push(`<text x="32" y="${y + 22}" font-family="${FONT}" font-size="13" font-weight="700" fill="#0e1c2f">Notasyon Aciklamasi</text>`);

  items.forEach((it, i) => {
    const ix = startX + i * itemW;
    const ax = ix + 4;
    const bx = ix + 60;
    const dashed = (it.sample === "realization" || it.sample === "dependency") ? 'stroke-dasharray="6,5"' : "";
    parts.push(`<line x1="${ax}" y1="${lineY}" x2="${bx}" y2="${lineY}" stroke="#202a3a" stroke-width="1.5" ${dashed}/>`);
    // Decorator
    const dir = { x: 1, y: 0 };
    const tipPoint = { x: bx, y: lineY };
    if (it.sample === "inheritance" || it.sample === "realization") {
      parts.push(renderDecorator(tipPoint, dir, it.sample, "end"));
    } else if (it.sample === "association" || it.sample === "dependency") {
      parts.push(renderDecorator(tipPoint, dir, it.sample, "end"));
    } else if (it.sample === "aggregation" || it.sample === "composition") {
      parts.push(renderDecorator({ x: ax, y: lineY }, { x: -1, y: 0 }, it.sample, "start"));
    }
    parts.push(`<text x="${bx + 10}" y="${lineY + 4}" font-family="${FONT}" font-size="12" fill="#202a3a">${escapeXml(it.label)}</text>`);
  });

  parts.push(`</g>`);
  return parts.join("\n");
}
