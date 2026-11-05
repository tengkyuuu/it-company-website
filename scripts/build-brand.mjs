/** Rebuild the MykTech() vector identity. Run: npm run build:brand.
 * Ignition: drawn keycap + MT + spark. OFL-licensed lettering is outlined. */
import opentype from 'opentype.js';
import sharp from 'sharp';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brand = path.join(root, 'public/brand'), out = path.join(brand, 'myktech');
for (const folder of ['', 'svg', 'png', 'fonts']) await mkdir(path.join(out, folder), { recursive: true });
const fontRoot = path.join(root, 'node_modules/geist/dist/fonts');
const loadFont = file => { const b = readFileSync(file); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const sans = loadFont(path.join(fontRoot, 'geist-sans/Geist-Medium.ttf'));
const mono = loadFont(path.join(fontRoot, 'geist-mono/GeistMono-Medium.ttf'));
const serif = loadFont(path.join(out, 'fonts/DMSerifDisplay-Italic.ttf'));
const num = n => +n.toFixed(3);
const encode = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const pathData = commands => commands.map(c => {
  if (c.type === 'Z') return 'Z';
  const points = [];
  if (c.type === 'C') points.push(c.x1, c.y1, c.x2, c.y2);
  if (c.type === 'Q') points.push(c.x1, c.y1);
  points.push(c.x, c.y);
  return c.type + points.map(num).join(' ');
}).join('');
// Approved Ignition direction, redrawn as native vector geometry.
// Open top-face rim, substantial lower keycap, a fine right-face separation.
const cap = 'M187 59L119 41Q101 36 88 50L30 110Q17 125 36 132L148 161Q163 165 170 150L195 94L212 136Q216 146 207 155L167 196Q159 204 146 201L15 171Q1 168 5 153L20 109Q22 101 29 94L84 45Q99 31 120 37L186 54Z';
const seam = 'M153 163L167 199L170 196L157 164Z';
const mt = 'M48 120L80 74L96 78L105 95L145 78L184 73L176 92L154 96L130 143L109 138L131 100L102 112L90 97L69 125Z';
const spark = 'M207 0C210 21 218 28 238 31C218 34 210 42 207 64C204 42 196 34 176 31C196 28 204 21 207 0Z';
const symbol = `${cap}${seam}${mt}`;
// Tiny optical mark: retain the MT gesture, omit cap and spark at 16-39px.
const micro = 'M14 142L72 54L100 61L116 91L172 58L226 49L212 83L181 88L141 173L106 165L146 96L111 119L89 91L51 152Z';
const mark = (small = false) => small
  ? `<path fill="#000" d="${micro}"/>`
  : `<path fill="#000" fill-rule="evenodd" d="${symbol}"/><path fill="#ACCENT" d="${spark}"/>`;
const paint = (body, tone = 'primary') => {
  const palettes = { primary: ['#0C0A09','#D4AF37'], reversed: ['#FAFAF9','#D4AF37'], ink: ['#0C0A09','#0C0A09'], white: ['#FAFAF9','#FAFAF9'], gold: ['#D4AF37','#D4AF37'] };
  const [base, accent] = palettes[tone];
  return body.replaceAll('#000', base).replaceAll('#ACCENT', accent);
};
function text(s, x, baseline, size, color = '#0C0A09', font = sans, tracking = 0) {
  let d = '', cursor = x;
  const scale = size / font.unitsPerEm, glyphs = font.stringToGlyphs(s);
  glyphs.forEach((g, i) => {
    d += pathData(g.getPath(cursor, baseline, size).commands);
    cursor += g.advanceWidth * scale + tracking;
    if (glyphs[i + 1]) cursor += font.getKerningValue(g, glyphs[i + 1]) * scale;
  });
  return { svg: `<path fill="${color}" d="${d}"/>`, width: cursor - x - tracking };
}
const lettering = text('MykTech()', 6, 83, 88, '#000', serif, -1.2);
// Keep the native k terminal: no added tail crossing into the following T.
const nameWidth = Math.ceil(lettering.width + 14), name = lettering.svg;
const H = 112, W = Math.ceil(148 + nameWidth + 8);
const shapes = {
  horizontal: { w: W, h: H, body: `<g transform="translate(8 3) scale(.5)">${mark()}</g><g transform="translate(148 0)">${name}</g>` },
  wordmark: { w: nameWidth + 16, h: H, body: `<g transform="translate(8 0)">${name}</g>` },
  stacked: { w: nameWidth + 48, h: 332, body: `<g transform="translate(${num((nameWidth + 48 - 216) / 2)} 16) scale(.9)">${mark()}</g><g transform="translate(24 210)">${name}</g>` },
  signature: { w: W, h: 148, body: `<g transform="translate(8 3) scale(.5)">${mark()}</g><g transform="translate(148 0)">${name}</g>${text('SOFTWARE, DESIGNED WITH INTENT.', 154, 129, 11, '#000', mono, .8).svg}` },
  symbol: { w: 252, h: 220, body: `<g transform="translate(6 6)">${mark()}</g>` },
  micro: { w: 252, h: 220, body: `<g transform="translate(6 6)">${mark(true)}</g>` },
};
const tones = ['primary', 'reversed', 'ink', 'white', 'gold'];
function svg(w, h, body, label = 'MykTech()') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${encode(label)}"><title>${encode(label)}</title>${body}</svg>`;
}
const exports = [];
for (const [kind, shape] of Object.entries(shapes)) {
  for (const tone of tones) {
    const source = svg(shape.w, shape.h, paint(shape.body,tone)), stem = `myktech-${kind}-${tone}`;
    await writeFile(path.join(out, 'svg', `${stem}.svg`), source);
    const width = ['symbol', 'micro'].includes(kind) ? 1024 : 2400;
    await sharp(Buffer.from(source)).resize({ width }).png().toFile(path.join(out, 'png', `${stem}.png`));
    exports.push({ name: stem, format: ['svg', 'png'], width: shape.w, height: shape.h, pngWidth: width });
  }
  if (kind === 'horizontal' || kind === 'wordmark') {
    const ring = paint(shape.body, 'ink').replaceAll('fill="#0C0A09"', 'fill="none" stroke="#0C0A09" stroke-width="0.9" stroke-linejoin="round"');
    await writeFile(path.join(out, 'svg', `myktech-${kind}-outline.svg`), svg(shape.w, shape.h, ring));
    exports.push({ name: `myktech-${kind}-outline`, format: ['svg'], width: shape.w, height: shape.h });
  }
}
for (const [tone, bg, palette] of [['dark', '#0C0A09', 'reversed'], ['light', '#FAFAF9', 'primary'], ['gold', '#D4AF37', 'ink']]) {
  const body = `<rect width="512" height="512" rx="112" fill="${bg}"/><g transform="translate(76 88) scale(1.5)">${paint(mark(),palette)}</g>`, source = svg(512, 512, body);
  await writeFile(path.join(out, 'svg', `myktech-avatar-${tone}.svg`), source);
  await sharp(Buffer.from(source)).resize(1024, 1024).png().toFile(path.join(out, 'png', `myktech-avatar-${tone}.png`));
  exports.push({ name: `myktech-avatar-${tone}`, format: ['svg', 'png'], width: 512, height: 512, pngWidth: 1024 });
}
// Stable masks consumed by the site, preloader, footer and social cards.
await writeFile(path.join(brand, 'wordmark.svg'), svg(W, H, shapes.horizontal.body.replaceAll('#ACCENT','#000')));
await writeFile(path.join(brand, 'wordmark-outline.svg'), svg(W, H, shapes.horizontal.body.replaceAll('#ACCENT','#000').replaceAll('fill="#000"', 'fill="none" stroke="#000" stroke-width="0.9" stroke-linejoin="round"')));
await writeFile(path.join(brand, 'monogram.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="252" height="220" viewBox="-6 -6 252 220"><path fill="#000" fill-rule="evenodd" d="${symbol}"/><path fill="#000" d="${spark}"/></svg>`);
await writeFile(path.join(brand, 'monogram-micro.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="252" height="220" viewBox="-6 -6 252 220"><path fill="#000" d="${micro}"/></svg>`);
for (const [kind, shape] of Object.entries(shapes)) {
  const sparkOnly = shape.body.replace(/<path\b[^>]*fill="#000"[^>]*\/>/g, '').replaceAll('#ACCENT','#000');
  await writeFile(path.join(out,'svg',`myktech-${kind}-accent-mask.svg`),svg(shape.w,shape.h,sparkOnly));
}
await writeFile(path.join(brand,'wordmark-accent.svg'),svg(W,H,`<path fill="#000" transform="translate(8 3) scale(.5)" d="${spark}"/>`));
await writeFile(path.join(root,'lib/brand-geometry.ts'),`// Generated by scripts/build-brand.mjs.\nexport const brandGeometry = ${JSON.stringify(Object.fromEntries(Object.entries(shapes).map(([k,s])=>[k,`${s.w} / ${s.h}`])),null,2)} as const;\n`);
const offlineFile = path.join(root, 'public/offline.html');
const offline = await readFile(offlineFile, 'utf8');
await writeFile(offlineFile, offline.replace(/<svg class="mark"[\s\S]*?<\/svg>/, `<svg class="mark" viewBox="-6 -6 252 220" aria-hidden="true" focusable="false">${paint(mark(),'reversed')}</svg>`));
await writeFile(path.join(out, 'manifest.json'), JSON.stringify({ brand: 'MykTech()', version: '2.0', direction: 'Ignition', date: '2026-11-04', ratio: W / H, horizontal: { width: W, height: H }, exports }, null, 2) + '\n');
const tokens = {
  name: 'MykTech()', version: '2.0', direction: 'Ignition',
  color: { ink: '#0C0A09', paper: '#FAFAF9', surface: '#FFFFFF', mist: '#E7E5E4', muted: '#78716C', gold: '#D4AF37', goldText: '#8C6D1F', goldPress: '#B8962E' },
  typography: { display: { family: 'Geist', weight: 500, tracking: '-0.03em' }, body: { family: 'Geist', weight: 400, lineHeight: 1.6 }, label: { family: 'Geist Mono', weight: 400, tracking: '0.12em' } },
  logo: { typeface: 'DM Serif Display Italic, outlined with adjusted spacing and native k terminal', clearSpace: 'One eighth of the complete emblem ink width, on every side', minimum: { horizontalPx: 160, wordmarkPx: 120, stackedPx: 160, signaturePx: 320, symbolPx: 40, microPx: 16 }, printMinimumMm: { horizontal: 36, wordmark: 27, stacked: 36, signature: 72, symbol: 10, micro: 5 } },
  spacing: { unitPx: 8 }, goldMaximumArea: '10%',
};
await writeFile(path.join(out, 'tokens.json'), JSON.stringify(tokens, null, 2) + '\n');
await writeFile(path.join(out, 'tokens.css'), `/* MykTech() Ignition identity v2.0 */\n:root {\n${Object.entries(tokens.color).map(([key, value]) => `  --myktech-${key.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}: ${value};`).join('\n')}\n  --myktech-font: 'Geist', sans-serif;\n  --myktech-mono: 'Geist Mono', monospace;\n  --myktech-space: 8px;\n  --myktech-logo-ratio: ${W} / ${H};\n}\n`);
for (const [group, filename] of [['geist-sans', 'Geist-Regular.woff2'], ['geist-sans', 'Geist-Medium.woff2'], ['geist-mono', 'GeistMono-Regular.woff2']]) await copyFile(path.join(fontRoot, group, filename), path.join(out, 'fonts', filename));
await copyFile(path.join(root, 'node_modules/geist/LICENSE.txt'), path.join(out, 'fonts/OFL.txt'));
// Text in the portable overview is outlined too.
const tx = (s, x, y, size, color = '#0C0A09', font = sans, tracking = 0) => text(s, x, y, size, color, font, tracking).svg;
const place = (kind, x, y, width, color = '#0C0A09') => `<g transform="translate(${x} ${y}) scale(${width / shapes[kind].w})">${paint(shapes[kind].body,color==='#FAFAF9'?'reversed':color==='#0C0A09'?'primary':'ink')}</g>`;
const line = y => `<path d="M72 ${y}H1528" stroke="#D5D2CE"/>`;
const board = `<rect width="1600" height="2000" fill="#FAFAF9"/>
${tx('MykTech()',72,77,24)}${tx('VISUAL IDENTITY / 2026',1180,75,12,'#78716C',mono,1.3)}${line(108)}
${place('horizontal',218,230,1164)}${tx('Software, designed with intent.',535,548,28,'#78716C')}
${tx('Ignition. From an idea to something real.',72,694,28)}${tx('The keycap is the craft. M/T is the studio. The spark is the moment an idea comes alive.',72,729,17,'#78716C')}${line(775)}
${tx('HORIZONTAL / PRIMARY',72,815,11,'#78716C',mono,1)}${tx('STACKED / VERTICAL',848,815,11,'#78716C',mono,1)}
${place('horizontal',96,914,620)}${place('stacked',1000,825,340)}${line(1138)}
<rect x="72" y="1182" width="704" height="340" fill="#0C0A09"/>${tx('REVERSED',100,1219,11,'#A8A29E',mono,1)}${place('horizontal',128,1305,592,'#FAFAF9')}
<rect x="800" y="1182" width="340" height="340" fill="#E7E5E4"/>${tx('THE IGNITION EMBLEM',828,1219,11,'#0C0A09',mono,.5)}${place('symbol',872,1265,196)}
<rect x="1164" y="1182" width="364" height="340" fill="#E7E5E4"/>${tx('WORDMARK / MINIMAL',1192,1219,11,'#57534E',mono,.7)}${place('wordmark',1192,1323,308)}
${tx('THE PALETTE',72,1600,11,'#78716C',mono,1)}
<rect x="72" y="1630" width="540" height="138" fill="#0C0A09"/><rect x="612" y="1630" width="504" height="138" fill="#E7E5E4"/><rect x="1116" y="1630" width="412" height="138" fill="#D4AF37"/>
${tx('Ink',96,1675,21,'#FAFAF9')}${tx('#0C0A09',96,1744,13,'#A8A29E',mono)}${tx('Paper / warm neutrals',636,1675,21)}${tx('#FAFAF9 / #E7E5E4',636,1744,13,'#57534E',mono)}${tx('Gold / used sparingly',1140,1675,21)}${tx('#D4AF37',1140,1744,13)}
${tx('Geist',72,1880,68)}${tx('Aa Bb Cc 0123456789',520,1868,30)}${tx('Geist Sans for words. Geist Mono for the details.',520,1908,17,'#78716C')}${line(1950)}
${tx('MYKTECH() / IGNITION / V2.0',72,1980,10,'#78716C',mono,1)}${tx('DIPOLOG CITY, PHILIPPINES',1264,1980,10,'#78716C',mono,.5)}`;
const boardSvg = svg(1600, 2000, board, 'MykTech() visual identity overview');
await writeFile(path.join(out, 'brand-board.svg'), boardSvg);
await sharp(Buffer.from(boardSvg)).png().toFile(path.join(out, 'brand-board.png'));
const social = `<rect width="1584" height="396" fill="#0C0A09"/>${place('horizontal',72,80,720,'#FAFAF9')}${tx('Software, designed with intent.',82,310,26,'#A8A29E')}<path d="M1430 64V332" stroke="#D4AF37" stroke-width="4"/>${tx('DIPOLOG CITY, PHILIPPINES',935,310,12,'#A8A29E',mono,1.2)}`;
await writeFile(path.join(out, 'social-cover.svg'), svg(1584, 396, social, 'MykTech() social cover'));
await sharp(Buffer.from(svg(1584, 396, social))).png().toFile(path.join(out, 'social-cover.png'));
console.log(`Brand kit: ${exports.length} assets, ${W}:${H} horizontal ratio. Native alpha PNGs; outlined lettering.\nUse ${W} / ${H} in .wm and .pl-stage; MARK_H = MARK_W * ${H} / ${W}.`);
