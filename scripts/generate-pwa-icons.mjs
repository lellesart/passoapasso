import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const outDir = path.resolve('public');
const targets = [
  ['passo-a-passo-icon-180-v20260820.png', 180],
  ['passo-a-passo-icon-192-v20260820.png', 192],
  ['passo-a-passo-icon-512-v20260820.png', 512],
];

const colors = {
  teal: [7, 95, 99, 255],
  tealSoft: [232, 241, 239, 255],
  paper: [251, 247, 239, 255],
  paperEdge: [216, 208, 194, 255],
  ink: [25, 23, 22, 255],
  muted: [143, 153, 148, 255],
  olive: [94, 111, 59, 255],
  oliveSoft: [238, 243, 219, 255],
  wine: [143, 63, 74, 255],
  wineSoft: [245, 237, 230, 255],
  shadow: [6, 47, 49, 56],
};

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodePng(width, height, rgba) {
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    rows[rowStart] = 0;
    rgba.copy(rows, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(rows, { level: 9 })),
    chunk('IEND'),
  ]);
}

function blend(buffer, width, x, y, color, coverage = 1) {
  const alpha = (color[3] / 255) * coverage;
  if (alpha <= 0) return;
  const index = (y * width + x) * 4;
  const inverse = 1 - alpha;
  buffer[index] = Math.round(color[0] * alpha + buffer[index] * inverse);
  buffer[index + 1] = Math.round(color[1] * alpha + buffer[index + 1] * inverse);
  buffer[index + 2] = Math.round(color[2] * alpha + buffer[index + 2] * inverse);
  buffer[index + 3] = 255;
}

function drawPredicate(buffer, width, height, bounds, color, predicate) {
  const samples = [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
  ];
  const [minX, minY, maxX, maxY] = bounds.map((value, index) => {
    const rounded = index < 2 ? Math.floor(value) : Math.ceil(value);
    return Math.max(0, Math.min(index % 2 === 0 ? width : height, rounded));
  });

  for (let y = minY; y < maxY; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      let hits = 0;
      for (const [sx, sy] of samples) {
        if (predicate(x + sx, y + sy)) hits += 1;
      }
      if (hits) blend(buffer, width, x, y, color, hits / samples.length);
    }
  }
}

function drawRoundRect(buffer, width, height, x, y, w, h, r, color) {
  drawPredicate(buffer, width, height, [x, y, x + w, y + h], color, (px, py) => {
    const cx = Math.max(x + r, Math.min(px, x + w - r));
    const cy = Math.max(y + r, Math.min(py, y + h - r));
    return (px - cx) ** 2 + (py - cy) ** 2 <= r ** 2;
  });
}

function drawCircle(buffer, width, height, cx, cy, r, color) {
  drawPredicate(buffer, width, height, [cx - r, cy - r, cx + r, cy + r], color, (px, py) => {
    return (px - cx) ** 2 + (py - cy) ** 2 <= r ** 2;
  });
}

function drawCircleStroke(buffer, width, height, cx, cy, r, stroke, color) {
  drawPredicate(buffer, width, height, [cx - r - stroke, cy - r - stroke, cx + r + stroke, cy + r + stroke], color, (px, py) => {
    const distance = Math.hypot(px - cx, py - cy);
    return distance >= r - stroke / 2 && distance <= r + stroke / 2;
  });
}

function drawLine(buffer, width, height, x1, y1, x2, y2, stroke, color) {
  const radius = stroke / 2;
  const minX = Math.min(x1, x2) - radius;
  const minY = Math.min(y1, y2) - radius;
  const maxX = Math.max(x1, x2) + radius;
  const maxY = Math.max(y1, y2) + radius;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;

  drawPredicate(buffer, width, height, [minX, minY, maxX, maxY], color, (px, py) => {
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
    const nx = x1 + t * dx;
    const ny = y1 + t * dy;
    return Math.hypot(px - nx, py - ny) <= radius;
  });
}

function drawIcon(size) {
  const buffer = Buffer.alloc(size * size * 4);
  const scale = size / 512;
  const s = (value) => value * scale;

  drawRoundRect(buffer, size, size, 0, 0, size, size, s(112), colors.teal);
  drawRoundRect(buffer, size, size, s(76), s(86), s(360), s(366), s(42), colors.shadow);
  drawRoundRect(buffer, size, size, s(70), s(72), s(372), s(368), s(38), colors.paper);
  drawPredicate(buffer, size, size, [s(70), s(72), s(442), s(440)], colors.paperEdge, (px, py) => {
    const x = s(70);
    const y = s(72);
    const w = s(372);
    const h = s(368);
    const r = s(38);
    const outerX = Math.max(x + r, Math.min(px, x + w - r));
    const outerY = Math.max(y + r, Math.min(py, y + h - r));
    const innerX = Math.max(x + r + s(5), Math.min(px, x + w - r - s(5)));
    const innerY = Math.max(y + r + s(5), Math.min(py, y + h - r - s(5)));
    const insideOuter = (px - outerX) ** 2 + (py - outerY) ** 2 <= r ** 2;
    const insideInner = (px - innerX) ** 2 + (py - innerY) ** 2 <= Math.max(0, r - s(5)) ** 2;
    return insideOuter && !insideInner;
  });

  drawLine(buffer, size, size, s(132), s(116), s(132), s(396), s(8), [...colors.teal.slice(0, 3), 184]);

  const rows = [
    [158, colors.teal, colors.tealSoft, 142, 182, 226, 150, 368, 226, 182, 318],
    [256, colors.olive, colors.oliveSoft, 240, 280, 226, 248, 344, 226, 280, 358],
    [354, colors.wine, colors.wineSoft, null, null, 226, 346, 380, 226, 378, 310],
  ];

  for (const [cy, accent, soft, c1y, _c2y, line1x, line1y, line1end, line2x, line2y, line2end] of rows) {
    drawCircle(buffer, size, size, s(174), s(cy), s(28), soft);
    drawCircleStroke(buffer, size, size, s(174), s(cy), s(28), s(7), accent);
    if (c1y) {
      drawLine(buffer, size, size, s(160), s(cy - 1), s(172), s(cy + 12), s(8), accent);
      drawLine(buffer, size, size, s(172), s(cy + 12), s(197), s(cy - 17), s(8), accent);
    }
    drawLine(buffer, size, size, s(line1x), s(line1y), s(line1end), s(line1y), s(18), colors.ink);
    drawLine(buffer, size, size, s(line2x), s(line2y), s(line2end), s(line2y), s(12), colors.muted);
  }

  return buffer;
}

fs.mkdirSync(outDir, { recursive: true });

for (const [fileName, size] of targets) {
  const rgba = drawIcon(size);
  fs.writeFileSync(path.join(outDir, fileName), encodePng(size, size, rgba));
  console.log(`generated ${fileName}`);
}
