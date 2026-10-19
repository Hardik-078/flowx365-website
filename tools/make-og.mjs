// Builds public/og.png as outlined SVG paths (no system font needed),
// using the site's own Archivo variable font at display settings.
import * as fontkit from 'fontkit';
import { readFileSync, writeFileSync } from 'node:fs';
import wawoff2 from 'wawoff2';

const SRC = new URL('../node_modules/@fontsource-variable/archivo/files/archivo-latin-standard-normal.woff2', import.meta.url);
// fontkit only instances variable fonts reliably from plain TrueType.
const ttf = Buffer.from(await wawoff2.decompress(readFileSync(SRC)));
const base = fontkit.create(ttf);
const display = base.getVariation({ wght: 800, wdth: 125 });
const text = base.getVariation({ wght: 500, wdth: 100 });
const bold = base.getVariation({ wght: 800, wdth: 115 });

function textPath(font, str, x, baseline, size, tracking = 0) {
  const run = font.layout(str);
  const s = size / font.unitsPerEm;
  let pen = x;
  let d = '';
  run.glyphs.forEach((g, i) => {
    const pos = run.positions[i];
    d += g.path.scale(s, -s).translate(pen + pos.xOffset * s, baseline - pos.yOffset * s).toSVG();
    pen += pos.xAdvance * s + tracking * size;
  });
  return { d, width: pen - x };
}

const W = 1200;
const H = 630;
const size = 168;
const l1 = textPath(display, 'WRITE IT', 64, 200, size, -0.035);
const l2 = textPath(display, 'ONCE.', 64, 200 + size * 0.86, size, -0.035);
const head = l1.d + l2.d;

const brand = textPath(bold, 'FlowX365', 64, 520, 40, -0.02);
const tag = textPath(text, 'Every document made from the one before it.  Web & Android.', 64, 562, 24);

// Perforated sheet edge peeking along the bottom.
let holes = '';
for (let x = 7; x < W; x += 14) holes += `<circle cx="${x}" cy="618" r="3.4" fill="#0f1520"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#0f1520"/>
  <path d="${head}" fill="#f7f8fa"/>
  <rect x="64" y="472" width="56" height="4" fill="#f5820a"/>
  <path d="${brand.d}" fill="#f7f8fa"/>
  <path d="${tag.d}" fill="#b9c0d0"/>
  <rect x="0" y="600" width="${W}" height="30" fill="#f4e07e"/>
  <rect x="0" y="609" width="${W}" height="21" fill="#f4c7d2"/>
  <rect x="0" y="618" width="${W}" height="12" fill="#f7f8fa"/>
  ${holes}
</svg>`;

writeFileSync(new URL('./og.svg', import.meta.url), svg);
console.log('wrote tools/og.svg; rasterize with: npm run og');
console.log('widths', Math.round(l1.width), Math.round(l2.width));
