/**
 * Renders the app icon to PNG without any native image dependency.
 *
 * The build environment has no ImageMagick, no librsvg and no Pillow, so the
 * icon is drawn straight into an RGBA buffer and encoded with Node's built-in
 * zlib. Shapes are anti-aliased with 3x3 supersampling.
 *
 *   node tools/make-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const SS = 3; // supersampling factor

/* ---------------- PNG encoding ---------------- */

function crc32(buf) {
  let c;
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------- drawing ---------------- */

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

/** Signed-distance helper for a rounded rectangle. Positive means inside. */
function insideRoundRect(x, y, w, h, r) {
  const dx = Math.max(r - x, 0, x - (w - r));
  const dy = Math.max(r - y, 0, y - (h - r));
  if (dx === 0 || dy === 0) return x >= 0 && x <= w && y >= 0 && y <= h;
  return dx * dx + dy * dy <= r * r;
}

const STARS = [
  [0.22, 0.20, 0.013], [0.33, 0.33, 0.009], [0.17, 0.38, 0.010],
  [0.43, 0.19, 0.008], [0.12, 0.28, 0.007], [0.29, 0.12, 0.007],
];

/**
 * @param maskable when true, keeps every meaningful element inside the
 *   central 80% so Android's adaptive-icon crop cannot clip the artwork.
 */
function drawIcon(size, { maskable = false } = {}) {
  const S = size * SS;
  const out = Buffer.alloc(size * size * 4);
  const inset = maskable ? 0.12 : 0;

  // u,v are unit coordinates inside the artwork area.
  const toArt = (t) => (t - inset) / (1 - 2 * inset);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = (px * SS + sx + 0.5) / S;
          const fy = (py * SS + sy + 0.5) / S;

          // Background plate.
          let inPlate;
          if (maskable) {
            inPlate = true; // maskable icons must be full-bleed
          } else {
            inPlate = insideRoundRect(fx * size, fy * size, size, size, size * 0.22);
          }
          if (!inPlate) continue;

          const u = toArt(fx);
          const v = toArt(fy);

          // Night-sky gradient.
          let col =
            v < 0.6
              ? mix([27, 23, 64], [58, 47, 99], Math.max(0, v) / 0.6)
              : mix([58, 47, 99], [111, 92, 192], Math.min(1, (v - 0.6) / 0.4));

          // Stars.
          for (const [sxu, syu, sr] of STARS) {
            const d = Math.hypot(u - sxu, v - syu);
            if (d < sr) col = mix(col, [255, 255, 255], 1 - d / sr);
          }

          // Moon.
          const dMoon = Math.hypot(u - 0.7, v - 0.29);
          if (dMoon < 0.13) {
            col = [255, 200, 107];
            const c1 = Math.hypot(u - 0.635, v - 0.258);
            const c2 = Math.hypot(u - 0.72, v - 0.355);
            if (c1 < 0.028 || c2 < 0.018) col = [232, 178, 92];
          }

          // Open book: two pages fanning up from a lower spine.
          if (u > 0.14 && u < 0.86) {
            const d = Math.abs(u - 0.5) / 0.36;       // 0 at spine, 1 at outer edge
            const lift = 1 - d * d;                    // pages ride higher at the edges
            const vTop = 0.505 + 0.055 * lift;
            const vBottom = 0.775 + 0.050 * lift;

            if (v > vTop && v < vBottom) {
              const t = (v - vTop) / (vBottom - vTop);
              const spineGap = 0.010;
              if (u < 0.5 - spineGap) col = [242, 239, 233];
              else if (u > 0.5 + spineGap) col = [207, 199, 230];
              else col = [86, 74, 126];

              // Ruled lines suggest text without being legible at 48px.
              if (Math.abs(u - 0.5) > spineGap) {
                const line = t * 7;
                if (Math.abs(line - Math.round(line)) < 0.12 && t > 0.18 && t < 0.92) {
                  col = mix(col, [120, 110, 150], 0.4);
                }
              }
            }
          }

          r += col[0];
          g += col[1];
          b += col[2];
          a += 255;
        }
      }

      const n = SS * SS;
      const i = (py * size + px) * 4;
      const alpha = a / n;
      // Un-premultiply so edge pixels keep their colour.
      const k = alpha > 0 ? n / (a / 255) : 0;
      out[i] = Math.round((r / n) * k);
      out[i + 1] = Math.round((g / n) * k);
      out[i + 2] = Math.round((b / n) * k);
      out[i + 3] = Math.round(alpha);
    }
  }

  return encodePng(size, size, out);
}

import { fileURLToPath } from 'node:url';

const targets = [
  ['public/icon-192.png', 192, {}],
  ['public/icon-512.png', 512, {}],
  ['public/icon-maskable.png', 512, { maskable: true }],
  ['public/favicon-32.png', 32, {}],
];

// Only emit files when run directly; make-android-assets.mjs imports drawIcon.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const [path, size, opts] of targets) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, drawIcon(size, opts));
    console.log(`wrote ${path} (${size}px)`);
  }
}

export { drawIcon };
