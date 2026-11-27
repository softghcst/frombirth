#!/usr/bin/env node
/**
 * Gives every adult head the base head's skull and ears, so a hairstyle sits on all of them exactly as it was drawn,
 * the way the one baby head wears its hair. Each head keeps its own cheeks, jaw and chin (and the shared neck), which
 * is what tells the face shapes apart.
 *
 *     node scripts/share_adult_skull.mjs            (heads already done are skipped)
 *     node scripts/share_adult_skull.mjs --force    (redo them all, from the heads as they are)
 *
 * Then: python3 scripts/build-avatar-manifest.py, python3 scripts/extract_landmarks.py, npm run trace-hair (every
 * style drawn as a picture, named), python3 scripts/fit_hair.py and node scripts/hair_tops.mjs.
 *
 * How. Each head and the base head are drawn at 4x and turned into signed distance fields (of the whole silhouette,
 * and of the skin), which are blended row by row: the base head's above y FROM, the head's own below y TO, and
 * smoothly between (smoothstep), so the skull runs into the cheeks with no step. The blend is traced back into an
 * outline path and a skin path (marching squares on the fields), the same form as every other head.
 *
 * The hair measurements: a head marked data-shared-skull keeps its own chin for its features (data-face-chin), but its
 * landmarks for the hair are measured with the base head's chin (data-outline-chin), so every adult head has the same
 * landmarks and a hairstyle is fitted to all of them without moving.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = new URL('../', import.meta.url);
const BASE = JSON.parse(readFileSync(new URL('assets/landmarks.json', ROOT), 'utf8')).base_head; // athletic
const HEADS = ['dimple_oval', 'almond', 'cherubic', 'angular', 'sculpted', 'pixie', 'long_rectangle'];
const FROM = 290, TO = 370; // the base head's skull above FROM, the head's own face below TO
const K = 4;
const MARK = 'data-shared-skull="1"';
const force = process.argv.includes('--force');
const file = (n) => new URL(`assets/heads/${n}.svg`, ROOT);
const read = (n) => { try { return readFileSync(file(n), 'utf8'); } catch { return null; } };
const plain = (s) => s.replace(/var\(--skin-color,([^)]*)\)/g, '$1');

const base = read(BASE);
const todo = HEADS.filter((n) => n !== BASE && read(n) && (force || !read(n).includes(MARK)));
if (!todo.length) { console.log('every adult head already has the shared skull (use --force to redo them)'); process.exit(0); }
const baseChin = (base.match(/data-outline-chin="([-\d.]+)"/) || [])[1];
if (!baseChin) throw new Error(`${BASE}.svg has no data-outline-chin`);

const browser = await chromium.launch();
const page = await browser.newPage();
const traced = await page.evaluate(async ({ heads, base, FROM, TO, K }) => {
  const S = 512 * K;
  const load = async (svg) => { const im = new Image(); im.src = 'data:image/svg+xml;base64,' + btoa(svg.replace(/width="512" height="512"/, `width="${S}" height="${S}"`)); await im.decode(); return im; };
  const masks = async (svg) => {
    const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.drawImage(await load(svg), 0, 0);
    const d = g.getImageData(0, 0, S, S).data, sil = new Uint8Array(S * S), skin = new Uint8Array(S * S);
    for (let i = 0; i < S * S; i++) { sil[i] = d[i * 4 + 3] > 127 ? 1 : 0; skin[i] = sil[i] && d[i * 4] > 150 ? 1 : 0; }
    return { sil, skin };
  };
  // Squared Euclidean distance transform (Felzenszwalb and Huttenlocher), then signed distance (inside negative).
  const edt = (inside) => {
    const INF = 1e12, f = new Float64Array(S * S);
    for (let i = 0; i < S * S; i++) f[i] = inside[i] ? 0 : INF;
    const pass = (src, n) => {
      const v = new Int32Array(n), z = new Float64Array(n + 1), o = new Float64Array(n); let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
      for (let q = 1; q < n; q++) {
        let s;
        do { const r = v[k]; s = ((src[q] + q * q) - (src[r] + r * r)) / (2 * q - 2 * r); if (s <= z[k]) k--; else break; } while (k >= 0);
        k++; v[k] = q; z[k] = s; z[k + 1] = INF;
      }
      k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; o[q] = (q - v[k]) ** 2 + src[v[k]]; } return o;
    };
    const col = new Float64Array(S);
    for (let x = 0; x < S; x++) { for (let y = 0; y < S; y++) col[y] = f[y * S + x]; const r = pass(col, S); for (let y = 0; y < S; y++) f[y * S + x] = r[y]; }
    const row = new Float64Array(S);
    for (let y = 0; y < S; y++) { for (let x = 0; x < S; x++) row[x] = f[y * S + x]; const r = pass(row, S); for (let x = 0; x < S; x++) f[y * S + x] = Math.sqrt(r[x]); }
    return f;
  };
  const signed = (m) => { const out = edt(m), inv = new Uint8Array(S * S); for (let i = 0; i < S * S; i++) inv[i] = 1 - m[i]; const inn = edt(inv); const r = new Float32Array(S * S); for (let i = 0; i < S * S; i++) r[i] = (out[i] - inn[i]) / K; return r; };
  const b = await masks(base), bs = signed(b.sil), bk = signed(b.skin);
  const result = {};
  for (const [name, svg] of Object.entries(heads)) {
    const m = await masks(svg), hs = signed(m.sil), hk = signed(m.skin);
    const sil = new Float32Array(S * S), skin = new Float32Array(S * S);
    for (let y = 0; y < S; y++) {
      const u = Math.min(1, Math.max(0, (y / K - FROM) / (TO - FROM))), t = u * u * (3 - 2 * u);
      for (let x = 0; x < S; x++) { const i = y * S + x; sil[i] = bs[i] * (1 - t) + hs[i] * t; skin[i] = bk[i] * (1 - t) + hk[i] * t; }
    }
    result[name] = { sil: trace(sil), skin: trace(skin) };
  }
  return result;

  // Marching squares on a signed field (inside < 0), at 0 -> closed loops in 512 units, simplified.
  function trace(f) {
    const v = (i, j) => (i < 0 || j < 0 || i >= S || j >= S ? 1 : f[j * S + i]);
    const P = (i, j) => [(i + 0.5) / K, (j + 0.5) / K];
    const lerp = (p, q, vp, vq) => { const t = vp / (vp - vq); return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; };
    const pts = new Map(), segs = [], at = new Map();
    const point = (key, p, q, vp, vq) => { if (!pts.has(key)) pts.set(key, lerp(p, q, vp, vq)); return key; };
    const link = (k1, k2) => { const s = segs.length; segs.push([k1, k2]); for (const k of [k1, k2]) { if (!at.has(k)) at.set(k, []); at.get(k).push(s); } };
    for (let j = -1; j < S; j++) for (let i = -1; i < S; i++) {
      const tl = v(i, j), tr = v(i + 1, j), br = v(i + 1, j + 1), bl = v(i, j + 1);
      const c = (tl < 0 ? 8 : 0) | (tr < 0 ? 4 : 0) | (br < 0 ? 2 : 0) | (bl < 0 ? 1 : 0);
      if (c === 0 || c === 15) continue;
      const T = () => point(`h${i},${j}`, P(i, j), P(i + 1, j), tl, tr);
      const R = () => point(`v${i + 1},${j}`, P(i + 1, j), P(i + 1, j + 1), tr, br);
      const B = () => point(`h${i},${j + 1}`, P(i, j + 1), P(i + 1, j + 1), bl, br);
      const L = () => point(`v${i},${j}`, P(i, j), P(i, j + 1), tl, bl);
      const mid = (tl + tr + br + bl) / 4 < 0;
      switch (c) {
        case 1: case 14: link(L(), B()); break; case 2: case 13: link(B(), R()); break;
        case 3: case 12: link(L(), R()); break; case 4: case 11: link(T(), R()); break;
        case 6: case 9: link(T(), B()); break; case 7: case 8: link(L(), T()); break;
        case 5: if (mid) { link(L(), T()); link(B(), R()); } else { link(L(), B()); link(T(), R()); } break;
        case 10: if (mid) { link(L(), B()); link(T(), R()); } else { link(L(), T()); link(B(), R()); } break;
      }
    }
    const used = new Uint8Array(segs.length), loops = [];
    for (let s0 = 0; s0 < segs.length; s0++) {
      if (used[s0]) continue;
      const loop = []; let s = s0, from = segs[s0][0];
      while (!used[s]) { used[s] = 1; const to = segs[s][0] === from ? segs[s][1] : segs[s][0]; loop.push(pts.get(to)); from = to; s = at.get(to).find((x) => !used[x]) ?? s; }
      if (loop.length > 8) loops.push(loop);
    }
    return loops.map((l) => 'M' + simplify(l, 0.05).map(([x, y]) => `${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`).join('L') + 'Z').join('');
  }
  function simplify(loop, eps) {
    const rdp = (p) => {
      if (p.length < 3) return p;
      const [a, b2] = [p[0], p[p.length - 1]]; let idx = 0, dmax = 0; const len = Math.hypot(b2[0] - a[0], b2[1] - a[1]) || 1e-9;
      for (let i = 1; i < p.length - 1; i++) { const dd = Math.abs((b2[0] - a[0]) * (a[1] - p[i][1]) - (a[0] - p[i][0]) * (b2[1] - a[1])) / len; if (dd > dmax) { dmax = dd; idx = i; } }
      return dmax > eps ? rdp(p.slice(0, idx + 1)).slice(0, -1).concat(rdp(p.slice(idx))) : [a, b2];
    };
    const h = loop.length >> 1;
    return rdp(loop.slice(0, h + 1)).slice(0, -1).concat(rdp(loop.slice(h).concat([loop[0]])).slice(0, -1));
  }
}, { heads: Object.fromEntries(todo.map((n) => [n, plain(read(n))])), base: plain(base), FROM, TO, K });
await browser.close();

for (const [name, r] of Object.entries(traced)) {
  const old = read(name);
  const keep = (attr) => (old.match(new RegExp(`${attr}="[^"]*"`)) || [''])[0];
  const attrs = ['data-shared-neck', 'data-face-chin'].map(keep).filter(Boolean).join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" data-pathways="1" ${attrs} ${MARK} data-outline-chin="${baseChin}">`
    + `<g id="art"><path style="fill:#23140f" fill-rule="evenodd" d="${r.sil}"/>`
    + `<path id="skin" style="fill:var(--skin-color,#da965e)" fill-rule="evenodd" d="${r.skin}"/></g></svg>`;
  writeFileSync(file(name), svg);
  console.log(`${name}: the ${BASE} skull and ears above y ${FROM}, its own face below y ${TO}, ${(svg.length / 1024).toFixed(1)} KB`);
}
