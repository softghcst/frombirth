// Snaps outfits to the body: for each outfit, the smallest size at which it still covers the body on every grown-up
// head shape, and the least it must move down to reach the bottom of every portrait. The result is written to
// js/avatar/clothesSnap.js, which js/CharacterAvatar.js applies on top of the usual placement under the chin.
//
//   node scripts/snap-clothes.mjs                 # snap the outfits listed in SNAP below
//   node scripts/snap-clothes.mjs --report-all    # also report what every other outfit would need (changes nothing for them)
//
// How it is measured. Each outfit file is drawn alone, in the 512 template frame, and each adult head is drawn bare
// (its neck and shoulders, as its file draws them). An outfit is then shrunk about the middle of its top edge (where
// it meets the neck), so its neckline stays at the chin, and moved down only as far as it must. It fits when, on every
// head: its sleeves reach past the edges of the body by MARGIN across the bottom band of the portrait, and its bottom
// edge reaches past the bottom of the portrait. Needs Playwright (preinstalled where the checks run).
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

/** The outfits to snap: the royal and noble dress drawn for the game, each sized and placed by this script. */
const SNAP = ['outfit_45_princess_sweetheart', 'outfit_46_prince_epaulettes', 'outfit_47_sovereign_ermine', 'outfit_48_noble_cameo', 'outfit_49_noble_cravat',
  'outfit_50_duke_mantle', 'outfit_51_imperial_fan_collar', 'outfit_52_princess_starlight', 'outfit_53_imperial_ruby'];
const MARGIN = 6; // template units the sleeves reach past the body's edge
const BAND = 40; // how far up from the bottom of the portrait the sleeves are checked
const MAX_DROP = 8; // the most an outfit may move down (its neckline with it): more, and a short gown slides out of the picture
const MIN_SCALE = 0.7;

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const path = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!path.startsWith(root)) { res.writeHead(403); return res.end(); }
  try { const body = await readFile(path.endsWith('/') ? join(path, 'index.html') : path); res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;
const all = process.argv.includes('--report-all');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:${port}/index.html`);
const result = await page.evaluate(async ({ SNAP, all, MARGIN, BAND, MAX_DROP, MIN_SCALE }) => {
  const { PART_BY_ID, AVATAR_TEMPLATE: T } = await import('/js/avatarManifest.js');
  const { fitTransforms } = await import('/js/CharacterAvatar.js');
  const { frameFor } = await import('/js/avatar/hairFit.js');
  const K = 2; // pixels per template unit
  const H = 660; // template units drawn, from 0 down
  /** Draws SVG text to a canvas; -> for each row (template units, step 1/K), [left, right] of what is drawn, or null. */
  async function rows(svgText) {
    const img = new Image();
    img.src = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
    await img.decode();
    const c = document.createElement('canvas'); c.width = 512 * K; c.height = H * K;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const out = [];
    for (let y = 0; y < c.height; y++) {
      let l = -1; let r = -1;
      for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 140) { if (l < 0) l = x; r = x; }
      out.push(l < 0 ? null : [l / K, r / K]);
    }
    return out;
  }
  const frame = (text) => text.replace(/<svg\b[^>]*>/, (h) => h.replace(/viewBox="[^"]*"/, `viewBox="0 0 512 ${H}"`).replace(/width="[^"]*"/, `width="${512 * K}"`).replace(/height="[^"]*"/, `height="${H * K}"`));
  // The bodies: every adult head, bare, as a portrait draws it, in the 512 frame.
  const heads = Object.values(PART_BY_ID).filter((p) => p.id.startsWith('head_') && p.tags?.age === 'adult');
  const bodies = [];
  let measured = 0;
  for (const h of heads) {
    // A portrait draws the head file as it is (its neck and shoulders included), so the body is that file's outline.
    const r = await rows(frame(await (await fetch('/assets/' + h.file)).text()));
    const fr = frameFor(h.id);
    const tf = fitTransforms(h.id, 'adult').clothes; // translate(x y) scale(s) translate(-256 -top)
    const [, x, y, s] = tf.match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/).map(Number);
    bodies.push({ id: h.id, rows: r, bottom: fr.y + fr.size, at: { x, y, s }, chin: h.fit.chin });
    measured += r.filter(Boolean).length;
  }
  const top = T.clothesTop;
  const ids = Object.keys(PART_BY_ID).filter((id) => PART_BY_ID[id].file?.startsWith('avatars/clothes/') && !/baby|bib/.test(id) && (all || SNAP.includes(id)));
  const out = {};
  for (const id of ids) {
    const text = await (await fetch('/assets/' + PART_BY_ID[id].file)).text();
    const g = await rows(frame(text));
    const drawn = g.map((r, i) => (r ? i / K : null)).filter((v) => v != null);
    const gBottom = Math.max(...drawn);
    // Where a point of the outfit lands in a portrait of this head, with the outfit shrunk by `k` and moved down by `dy`.
    const fits = (k, dy) => bodies.every((b) => {
      const Y = (y) => b.at.y + (top + (y - top) * k + dy - top) * b.at.s;
      const X = (x) => b.at.x + (256 + (x - 256) * k - 256) * b.at.s;
      if (Y(gBottom) < b.bottom + 1) return false;
      // Across the bottom band, the outfit's edges are outside the body's by MARGIN.
      for (let Yb = b.bottom - BAND; Yb <= b.bottom; Yb += 1) {
        const body = b.rows[Math.round(Yb * K)];
        if (!body) continue;
        // The row of the outfit drawn here.
        const y = top + ((Yb - b.at.y) / b.at.s + top - dy - top) / k;
        const row = g[Math.round(y * K)];
        if (!row) return false;
        if (X(row[0]) > body[0] - MARGIN * b.at.s || X(row[1]) < body[1] + MARGIN * b.at.s) return false;
      }
      return true;
    });
    let best = null;
    for (let k = 1.0; k >= MIN_SCALE - 1e-9 && !best?.stop; k = Math.round((k - 0.01) * 100) / 100) {
      let ok = null;
      for (let dy = 0; dy <= MAX_DROP; dy++) if (fits(k, dy)) { ok = dy; break; }
      if (ok != null) best = { s: k, dy: ok }; else if (best) break; // smaller no longer fits
    }
    out[id] = best ?? { s: 1, dy: 0, none: true };
  }
  if (!measured) throw new Error('no body was measured');
  out._bodies = bodies.map((b) => ({ id: b.id, bottom: Math.round(b.bottom), widthAtBottom: (() => { const r = b.rows[Math.round(b.bottom * K)] ?? b.rows.filter(Boolean).pop(); return r ? Math.round(r[1] - r[0]) : null; })() }));
  return out;
}, { SNAP, all, MARGIN, BAND, MAX_DROP, MIN_SCALE });
await browser.close();
server.close();

console.log('bodies:', JSON.stringify(result._bodies)); delete result._bodies;
for (const [id, r] of Object.entries(result)) console.log(`${SNAP.includes(id) ? 'snap  ' : 'report'} ${id.padEnd(34)} ${r.none ? 'does not fit at any size' : `scale ${r.s.toFixed(2)}, down ${r.dy}`}`);
const snap = Object.fromEntries(SNAP.filter((id) => result[id] && !result[id].none && (result[id].s < 1 || result[id].dy > 0)).map((id) => [id, result[id]]));
const lines = ['// Generated by scripts/snap-clothes.mjs. Do not edit by hand: run the script again.',
  '// Per outfit: `s` shrinks it about the middle of its top edge (where it meets the neck); `dy` moves it down, in',
  '// template units, after shrinking. Applied by js/CharacterAvatar.js on top of the usual placement under the chin.',
  `export const CLOTHES_SNAP = ${JSON.stringify(snap, null, 2).replace(/"(\w+)":/g, '$1:').replace(/"/g, '\'')};`, ''];
await writeFile(join(root, 'js/avatar/clothesSnap.js'), lines.join('\n'));
console.log(`Wrote js/avatar/clothesSnap.js (${Object.keys(snap).length} outfits).`);
