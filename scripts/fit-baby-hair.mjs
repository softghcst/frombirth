// Snaps each baby and kid hairstyle onto its head. Run after adding one: `npm run fit-baby-hair`.
//
// Baby hair is drawn on the baby template (assets/clothes_templates/baby_head_template.png), and kid hair (7 to 13) on the
// kid template (kid_hair_template.png), and placed as drawn, but a
// drawing can come out a little narrower or wider than the skull, so the head's outline shows beside the hair, or the
// hair floats off it. This measures, row by row from the crown down to the ears, where the outside of the head and of
// the hair are (and, either side of the middle, where the top of each begins), and finds the width and height (about the
// middle of the head at ear level, where the hair ends) that bring the hair's outside edge onto the head's outline, MARGIN outside it, so the hair covers the outline
// and sits on the skull. Writes js/avatar/babyHairFit.js and js/avatar/kidHairFit.js, which js/CharacterAvatar.js applies.
// Needs Playwright.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

/** Each kind of drawn child's hair: the head it is drawn on, and the file and name it is written to. */
const KINDS = [
  { prefix: 'hair_baby_', file: 'heads/toddler.svg', head: 'head_00_toddler', out: 'babyHairFit.js', name: 'BABY_HAIR_FIT', who: 'baby', slack: 0, min: 0.9 },
  // A kid's hair has volume: it may stand up to SLACK past the outline at the sides before that counts against it, and it
  // is drawn on the kid head itself, so it is only ever made larger (to close a gap), never smaller (min 1).
  { prefix: 'hair_kid_', file: 'heads/kid.svg', head: 'head_00_kid', out: 'kidHairFit.js', name: 'KID_HAIR_FIT', who: 'kid', slack: 14, min: 1 },
];
const MARGIN = 2.5; // how far outside the head's outline the hair's edge sits (512 units): covers the outline's ink

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  const path = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!path.startsWith(root)) { res.writeHead(403); return res.end(); }
  try { const body = await readFile(path); res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:${server.address().port}/index.html`);
for (const kind of KINDS) {
const result = await page.evaluate(async ({ HEAD, HEAD_ID, PREFIX, MARGIN, SLACK, MIN }) => {
  const { PART_BY_ID } = await import('/js/avatarManifest.js');
  const K = 4; const W = 512;
  const spans = async (text) => {
    const svg = text.replace(/<svg\b[^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W * K}" height="${W * K}">`);
    const img = new Image(); img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); await img.decode();
    const c = document.createElement('canvas'); c.width = W * K; c.height = W * K;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data;
    const rows = [];
    for (let y = 0; y < W * K; y++) {
      let l = -1; let r = -1;
      for (let x = 0; x < W * K; x++) if (d[(y * W * K + x) * 4 + 3] > 128) { if (l < 0) l = x; r = x; }
      rows.push(l < 0 ? null : [l / K, (r + 1) / K]);
    }
    return rows;
  };
  const headFile = await (await fetch('/assets/' + HEAD)).text();
  const head = await spans(headFile);
  const fit = PART_BY_ID[HEAD_ID].fit;
  const headTop = head.findIndex(Boolean) / K;
  const cx = fit.cx;
  const out = { _head: { top: headTop, earTop: fit.earTop, cx } };
  for (const id of Object.keys(PART_BY_ID).filter((x) => x.startsWith(PREFIX))) {
    const hair = await spans(await (await fetch('/assets/' + PART_BY_ID[id].file)).text());
    // The rows to match: from a little below the crown (above it, a curl or a puff may stand up) to where the hair ends.
    const hairBottom = (hair.length - 1 - [...hair].reverse().findIndex(Boolean)) / K;
    const lo = headTop + 18; const hi = Math.min(fit.earTop, hairBottom - 6);
    const rowsAt = (rows, y) => rows[Math.round(y * K)];
    // Column tops: where the outside of the head and of the hair begin, across the crown, so the hair's top edge covers
    // the crown as its sides cover the temples.
    const top = (rows, x) => { for (let i = 0; i < rows.length; i++) { const r = rows[i]; if (r && r[0] <= x && r[1] >= x) return i / K; } return null; };
    const COLS = Array.from({ length: 23 }, (_, i) => cx - 110 + i * 10);
    const headTops = COLS.map((x) => top(head, x));
    // Hair short of the outline (scalp or outline showing, d > 0) counts far more than hair a little past it: a style with
    // a jagged edge is fitted so the dips between its tufts still cover the head, not so its edge is right on average.
    const gap = (d) => (d > 0 ? 12 * d * d : Math.max(0, -d - SLACK) ** 2);
    // Scaled by sx across and sy down about (cx, ay), where the hair ends at the ears.
    const ay = hi;
    const err = (sx, sy) => {
      let e = 0; let n = 0;
      for (let y = lo; y <= hi; y += 1) {
        const hr = rowsAt(head, y); if (!hr) continue;
        const r = rowsAt(hair, ay + (y - ay) / sy); if (!r) { e += 400; n++; continue; }
        const L = cx + (r[0] - cx) * sx; const R = cx + (r[1] - cx) * sx;
        const dl = (hr[0] - MARGIN) - L; const dr = R - (hr[1] + MARGIN);
        e += gap(-dl) + gap(-dr); n += 2;
      }
      COLS.forEach((x, i) => {
        const t = top(hair, cx + (x - cx) / sx); const h = headTops[i];
        if (t == null || h == null) return;
        const d = (ay + (t - ay) * sy) - (h - MARGIN);
        // Along the top only a gap counts: a curl or a puff standing up off the crown is meant to.
        e += d > 0 ? gap(d) : Math.min(d * d, 4); n += 1;
      });
      return { e: e / Math.max(1, n) };
    };
    let best = { sx: 1, sy: 1, ...err(1, 1) };
    for (let sx = MIN; sx <= 1.15001; sx += 0.005) for (let sy = MIN; sy <= 1.15001; sy += 0.005) {
      const r = err(sx, sy);
      if (r.e < best.e) best = { sx: Math.round(sx * 1000) / 1000, sy: Math.round(sy * 1000) / 1000, ...r };
    }
    out[id] = { sx: best.sx, sy: best.sy, ay: Math.round(ay * 10) / 10, cx, before: Math.round(Math.sqrt(err(1, 1).e) * 10) / 10, after: Math.round(Math.sqrt(best.e) * 10) / 10 };
  }
  return out;
}, { HEAD: kind.file, HEAD_ID: kind.head, PREFIX: kind.prefix, MARGIN, SLACK: kind.slack, MIN: kind.min });

delete result._head;
for (const [id, r] of Object.entries(result)) console.log(`${id.padEnd(36)} ${r.sx}x wide, ${r.sy}x tall (edge off the outline by ${r.before} -> ${r.after})`);
const fit = Object.fromEntries(Object.entries(result).filter(([, r]) => r.sx !== 1 || r.sy !== 1).map(([id, r]) => [id, { sx: r.sx, sy: r.sy, cx: r.cx, ay: r.ay }]));
await writeFile(join(root, 'js/avatar', kind.out), ['// Generated by scripts/fit-baby-hair.mjs (`npm run fit-baby-hair`). Do not edit by hand.',
  `// Per ${kind.who} hairstyle: scaled sx across and sy down about (cx, ay), the middle of the head where the hair ends, so its`,
  `// outside edge lies just outside the ${kind.who} head's outline. Applied by js/CharacterAvatar.js.`,
  `export const ${kind.name} = ${JSON.stringify(fit)};`, ''].join('\n'));
console.log(`Wrote js/avatar/${kind.out}`);
}
await browser.close();
server.close();
