/**
 * Generates every Android raster asset from the same procedural icon used for
 * the web build: launcher icons, adaptive-icon foregrounds, the splash screen,
 * and the monochrome notification icon.
 *
 *   node tools/make-android-assets.mjs
 *
 * Re-run after changing tools/make-icons.mjs. No native image tooling needed.
 */

import { deflateSync, inflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { drawIcon } from './make-icons.mjs';

const RES = 'android/app/src/main/res';

/* ---------- minimal PNG writer (shared shape with make-icons) ---------- */

function crc32(buf) {
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
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
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- launcher icons ---------- */

const LAUNCHER = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
// Adaptive-icon foregrounds are 108dp with the outer 18dp reserved for masking.
const FOREGROUND = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

for (const [density, size] of Object.entries(LAUNCHER)) {
  const dir = `${RES}/mipmap-${density}`;
  mkdirSync(dir, { recursive: true });
  const png = drawIcon(size);
  writeFileSync(`${dir}/ic_launcher.png`, png);
  writeFileSync(`${dir}/ic_launcher_round.png`, png);
  writeFileSync(`${dir}/ic_launcher_foreground.png`, drawIcon(FOREGROUND[density], { maskable: true }));
  console.log(`launcher ${density} (${size}px)`);
}

/* ---------- splash ---------- */

/** Flat brand background with the icon centred, for every orientation bucket. */
function splash(width, height) {
  const buf = Buffer.alloc(width * height * 4);
  const bg = [13, 11, 22];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // A soft vertical lift keeps the splash from looking like a crash screen.
      const t = y / height;
      buf[i] = Math.round(bg[0] + t * 18);
      buf[i + 1] = Math.round(bg[1] + t * 14);
      buf[i + 2] = Math.round(bg[2] + t * 34);
      buf[i + 3] = 255;
    }
  }

  const iconSize = Math.round(Math.min(width, height) * 0.30);
  const icon = decodeIconPixels(iconSize);
  const ox = Math.round((width - iconSize) / 2);
  const oy = Math.round((height - iconSize) / 2);

  for (let y = 0; y < iconSize; y++) {
    for (let x = 0; x < iconSize; x++) {
      const s = (y * iconSize + x) * 4;
      const alpha = icon[s + 3] / 255;
      if (alpha === 0) continue;
      const d = ((oy + y) * width + ox + x) * 4;
      for (let c = 0; c < 3; c++) {
        buf[d + c] = Math.round(buf[d + c] * (1 - alpha) + icon[s + c] * alpha);
      }
    }
  }

  return encodePng(width, height, buf);
}

/**
 * drawIcon returns an encoded PNG, but compositing needs raw pixels, so the
 * icon is re-rendered here through the same maths with a transparent outside.
 */
function decodeIconPixels(size) {
  // Re-encode then strip: cheaper in code than duplicating the renderer, and
  // the sizes involved are small.
  const png = drawIcon(size);
  return rawFromPng(png, size);
}

function rawFromPng(png, size) {
  // Walk chunks to find IDAT, inflate, and undo the per-row filter bytes.
  let offset = 8;
  const idats = [];
  while (offset < png.length) {
    const len = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') idats.push(png.subarray(offset + 8, offset + 8 + len));
    offset += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idats));
  const stride = size * 4;
  const out = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw.copy(out, y * stride, y * (stride + 1) + 1, (y + 1) * (stride + 1));
  }
  return out;
}

const SPLASH_SIZES = {
  mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280],
  xxhdpi: [960, 1600], xxxhdpi: [1280, 1920],
};

writeFileSync(`${RES}/drawable/splash.png`, splash(480, 800));
for (const [density, [w, h]] of Object.entries(SPLASH_SIZES)) {
  mkdirSync(`${RES}/drawable-port-${density}`, { recursive: true });
  mkdirSync(`${RES}/drawable-land-${density}`, { recursive: true });
  writeFileSync(`${RES}/drawable-port-${density}/splash.png`, splash(w, h));
  writeFileSync(`${RES}/drawable-land-${density}/splash.png`, splash(h, w));
  console.log(`splash ${density}`);
}

/* ---------- notification icon ---------- */

/**
 * Android tints the status-bar icon itself, so it must be a white silhouette
 * on transparency. A crescent moon reads at 24dp where a book does not.
 */
function moonSilhouette(size) {
  const buf = Buffer.alloc(size * size * 4);
  const SS = 3;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;
          const inFull = Math.hypot(u - 0.5, v - 0.5) < 0.40;
          const inBite = Math.hypot(u - 0.70, v - 0.36) < 0.36;
          if (inFull && !inBite) hits++;
        }
      }
      const i = (y * size + x) * 4;
      buf[i] = 255;
      buf[i + 1] = 255;
      buf[i + 2] = 255;
      buf[i + 3] = Math.round((hits / (SS * SS)) * 255);
    }
  }

  return encodePng(size, size, buf);
}

const NOTIF = { mdpi: 24, hdpi: 36, xhdpi: 48, xxhdpi: 72, xxxhdpi: 96 };
for (const [density, size] of Object.entries(NOTIF)) {
  const dir = `${RES}/drawable-${density}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/ic_stat_moon.png`, moonSilhouette(size));
  console.log(`notification icon ${density} (${size}px)`);
}

console.log('\nAndroid assets regenerated.');
