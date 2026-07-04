import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const repoRoot = process.cwd();
const brandDir = join(repoRoot, 'assets', 'brand');
const buildDir = join(repoRoot, 'build');
const pngSizes = [16, 32, 48, 64, 128, 256, 512];
const icoSizes = [16, 32, 48, 64, 128, 256];

await mkdir(brandDir, { recursive: true });
await mkdir(buildDir, { recursive: true });

await writeFile(join(brandDir, 'icon.svg'), createSvg(), 'utf8');

const pngBySize = new Map();
for (const size of pngSizes) {
  const png = createPng(size);
  pngBySize.set(size, png);
  await writeFile(join(brandDir, `icon-${size}.png`), png);
  if (size === 512) {
    await writeFile(join(buildDir, 'icon.png'), png);
  }
}

await writeFile(join(buildDir, 'icon.ico'), createIco(icoSizes.map((size) => pngBySize.get(size))));
console.log(`Generated ${pngSizes.length} PNG icons, SVG source, and build/icon.ico.`);

function createSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Suwol 2D Animator icon">
  <rect width="512" height="512" rx="96" fill="#111820"/>
  <circle cx="256" cy="256" r="168" fill="#1fb8a6"/>
  <circle cx="312" cy="204" r="132" fill="#111820"/>
  <path d="M142 330c68 72 179 78 254 14" fill="none" stroke="#f2b84b" stroke-width="42" stroke-linecap="round"/>
  <circle cx="190" cy="214" r="30" fill="#f2b84b"/>
  <circle cx="338" cy="314" r="24" fill="#8fd8cf"/>
</svg>
`;
}

function createPng(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const scale = size / 512;
  fillRect(rgba, size, 0, 0, size, size, [17, 24, 32, 255]);
  drawCircle(rgba, size, 256 * scale, 256 * scale, 168 * scale, [31, 184, 166, 255]);
  drawCircle(rgba, size, 312 * scale, 204 * scale, 132 * scale, [17, 24, 32, 255]);
  drawStroke(rgba, size, [
    [142 * scale, 330 * scale],
    [210 * scale, 382 * scale],
    [300 * scale, 390 * scale],
    [396 * scale, 344 * scale]
  ], Math.max(2, 42 * scale), [242, 184, 75, 255]);
  drawCircle(rgba, size, 190 * scale, 214 * scale, 30 * scale, [242, 184, 75, 255]);
  drawCircle(rgba, size, 338 * scale, 314 * scale, 24 * scale, [143, 216, 207, 255]);
  return encodePng(size, size, rgba);
}

function fillRect(rgba, size, x, y, width, height, color) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      setPixel(rgba, size, px, py, color);
    }
  }
}

function drawCircle(rgba, size, cx, cy, radius, color) {
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(size - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(size - 1, Math.ceil(cy + radius));
  const radiusSq = radius * radius;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if ((dx * dx) + (dy * dy) <= radiusSq) {
        setPixel(rgba, size, x, y, color);
      }
    }
  }
}

function drawStroke(rgba, size, points, width, color) {
  for (let index = 0; index < points.length - 1; index += 1) {
    drawLine(rgba, size, points[index], points[index + 1], width, color);
  }
}

function drawLine(rgba, size, start, end, width, color) {
  const [x0, y0] = start;
  const [x1, y1] = end;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 1.5));
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    drawCircle(rgba, size, x0 + dx * t, y0 + dy * t, width / 2, color);
  }
}

function setPixel(rgba, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) {
    return;
  }

  const offset = ((Math.trunc(y) * size) + Math.trunc(x)) * 4;
  rgba[offset] = color[0];
  rgba[offset + 1] = color[1];
  rgba[offset + 2] = color[2];
  rgba[offset + 3] = color[3];
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, (y * (stride + 1)) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', Buffer.concat([
      uint32(width),
      uint32(height),
      Buffer.from([8, 6, 0, 0, 0])
    ])),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  return Buffer.concat([
    uint32(data.length),
    typeBuffer,
    data,
    uint32(crc32(Buffer.concat([typeBuffer, data])))
  ]);
}

function createIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  const directory = Buffer.alloc(16 * pngs.length);
  let offset = header.length + directory.length;
  for (let index = 0; index < pngs.length; index += 1) {
    const png = pngs[index];
    const size = icoSizes[index];
    const base = index * 16;
    directory[base] = size >= 256 ? 0 : size;
    directory[base + 1] = size >= 256 ? 0 : size;
    directory[base + 2] = 0;
    directory[base + 3] = 0;
    directory.writeUInt16LE(1, base + 4);
    directory.writeUInt16LE(32, base + 6);
    directory.writeUInt32LE(png.length, base + 8);
    directory.writeUInt32LE(offset, base + 12);
    offset += png.length;
  }

  return Buffer.concat([header, directory, ...pngs]);
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0, 0);
  return buffer;
}

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
