#!/usr/bin/env node
/**
 * Puts every adult head on one shared neck and one pair of shoulders, so clothes, necklaces and long hair
 * sit the same on every face shape. Each head keeps its own skull, ears, cheeks, jaw and chin.
 *
 *     node scripts/unify_head_necks.mjs            (heads already done are skipped)
 *     node scripts/unify_head_necks.mjs --force    (redo them all)
 *
 * Then rebuild the measurements:  python3 scripts/build-avatar-manifest.py && python3 scripts/extract_landmarks.py
 * and refit the hair:             npm run fit-hair
 *
 * Needs Playwright's Chromium (the browser tests use it too).
 *
 * How it works. In every column of the face it finds the jaw outline (going down from the cheeks, the first
 * dark line) and keeps the head down to that line's bottom edge, so none of the head's own neck is left; where
 * the head's old neck lines run into the jaw, the jaw's edge is carried across from either side. Under that go
 * the shared neck (the base head's width, straight down) and the base head's shoulders. That is drawn at 8x and
 * traced back into an outline path and a skin path. Above SEAM (y 404, below everything the face is measured
 * by) the file keeps the head's original drawing exactly; the traced part is joined on under it, so the file
 * has the same form as every other head (outline path, then the skin path, id="skin") and no seams.
 *
 * Each head also keeps the chin it was measured with (data-face-chin for the manifest, data-outline-chin for the
 * hair pipeline's landmarks), so the eyes, nose and mouth stay where
 * they were; and the manifest gives the heads with the shared neck one collar for clothes and necklaces.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = new URL('../', import.meta.url);
const HEADS = ['dimple_oval', 'almond', 'cherubic', 'athletic', 'angular', 'sculpted', 'pixie', 'long_rectangle'];
const BASE = 'dimple_oval';                    // whose neck and shoulders everyone gets
const NECK = { l: 216, r: 295, line: 7 };      // the base head's neck: skin edges, outline width
const CUT = 446;                               // below this row the base head's shoulders are used as they are
const K = 8;                                   // trace at 8x
const OUTLINE = '#23140f', SKIN = '#da965e';
const MARK = 'data-shared-neck="1"';
const force = process.argv.includes('--force');

const file = (n) => new URL(`assets/heads/${n}.svg`, ROOT);
const read = (n) => { try { return readFileSync(file(n), 'utf8'); } catch { return null; } };
// Each face's own chin, as the manifest measured it before the neck was replaced. The new neck can meet a narrow chin
// a little higher than the old one did, which would move the measured chin and so the eyes, nose and mouth; the
// manifest builder uses this instead (data-face-chin). Kept from the file itself when a head is redone.
const MANIFEST = readFileSync(new URL('js/avatarManifest.js', ROOT), 'utf8');
const faceChin = (n) => {
  const kept = read(n)?.match(/data-face-chin="(\d+(?:\.\d+)?)"/);
  if (kept) return kept[1];
  const m = MANIFEST.match(new RegExp(`"file": "heads/${n}\\.svg"[^\\n]*?"chin": (\\d+(?:\\.\\d+)?)`));
  return m ? m[1] : null;
};
// The same for the hair pipeline's landmarks (scripts/extract_landmarks.py), which measure the chin their own way:
// asked of that script, on the head as it is before its neck is replaced (data-outline-chin).
const outlineChin = (n) => {
  const kept = read(n)?.match(/data-outline-chin="([-\d.]+)"/);
  if (kept) return kept[1];
  const code = 'import sys; sys.path.insert(0, sys.argv[1]); import extract_landmarks as EL; '
    + 'print(EL.landmarks(EL.scan(EL.head_polys(sys.argv[2])))[1]["chin"])';
  return execFileSync('python3', ['-c', code, fileURLToPath(new URL('scripts/', ROOT)), fileURLToPath(file(n))], { encoding: 'utf8' }).trim();
};
// Plain colours, so the art draws the same as an <img>, at the size it is traced at.
const plain = (svg) => svg.replace(/var\(--skin-color,([^)]*)\)/g, '$1').replace(/width="512" height="512"/, `width="${512 * K}" height="${512 * K}"`);

const base = read(BASE);
const todo = HEADS.filter((n) => { const s = read(n); return s && (force || !s.includes(MARK)); });
if (!todo.length) { console.log('every head already has the shared neck (use --force to redo them)'); process.exit(0); }

const chins = Object.fromEntries(todo.map((n) => [n, { face: faceChin(n), outline: outlineChin(n) }]));
const browser = await chromium.launch();
const page = await browser.newPage();
const results = await page.evaluate(async ({ heads, base, NECK, CUT, K, SKIN }) => {
  const S = 512 * K;
  const load = async (svg) => { const img = new Image(); img.src = 'data:image/svg+xml;base64,' + btoa(svg); await img.decode(); return img; };
  const canvas = (w = S) => { const c = document.createElement('canvas'); c.width = c.height = w; return c; };
  const baseImg = await load(base);
  const out = {};
  for (const [name, svg] of Object.entries(heads)) {
    const img = await load(svg);
    // 1. Measure on a K-times render. In every column of the face, going down from the cheeks, the first dark run
    //    is the jaw outline: the head is kept down to its bottom edge, so none of the head's own neck survives.
    const m = canvas().getContext('2d'); m.drawImage(img, 0, 0, S, S);
    const px = m.getImageData(0, 0, S, S).data;
    const on = (x, y) => px[(y * S + x) * 4 + 3] > 127;
    const dark = (x, y) => on(x, y) && px[(y * S + x) * 4] < 110;
    const FROM = 300 * K, EARS = 380 * K;             // the cheeks; below the ears
    const bottom = new Float32Array(S), merged = new Uint8Array(S), face = new Uint8Array(S);
    for (let x = 0; x < S; x++) {
      if (!on(x, FROM) || dark(x, FROM)) { bottom[x] = EARS; continue; }   // not inside the face here: ears and air
      face[x] = 1;
      let y = FROM; while (y < S && on(x, y) && !dark(x, y)) y++;
      const start = y; while (y < S && dark(x, y)) y++;
      bottom[x] = y;
      // a jaw line that runs straight on down past the chin is the head's own neck line joining it
      merged[x] = y - start > 16 * K && y > 432 * K ? 1 : 0;
    }
    // and the head's own neck lines, found just under the middle of the chin: thin upright dark runs
    const probe = Math.min(S - 1, Math.round(bottom[256 * K] + 2 * K));
    for (let x = 0; x < S;) {
      if (!dark(x, probe)) { x++; continue; }
      const l = x; while (x < S && dark(x, probe)) x++;
      if (x - l <= 14 * K && (x < 256 * K || l > 256 * K)) for (let k = Math.max(0, l - 2 * K); k < Math.min(S, x + 2 * K); k++) if (face[k]) merged[k] = 1;
    }
    // across those columns, carry the jaw's bottom edge over from the columns either side
    for (let x = 0; x < S; x++) {
      if (!merged[x]) continue;
      let l = x, r = x; while (l >= 0 && merged[l]) l--; while (r < S && merged[r]) r++;
      const okL = l >= 0 && face[l], okR = r < S && face[r];
      for (let k = x; k < r; k++) {
        const t = (k - l) / (r - l);
        bottom[k] = okL && okR ? bottom[l] + (bottom[r] - bottom[l]) * t : okL ? bottom[l] : okR ? bottom[r] : 432 * K;
        merged[k] = 0;
      }
    }
    for (let x = 0; x < S; x++) bottom[x] = Math.max(bottom[x], EARS);   // never cut into the ears
    let keep = 'M0 0H512';              // the top edge, then back along the bottom edge, right to left
    for (let x = S - 1; x >= 0; x--) keep += `L${(x + 1) / K} ${bottom[x] / K}L${x / K} ${bottom[x] / K}`;
    keep += 'Z';
    const J = Math.round(Math.max(...bottom.slice(NECK.l * K, NECK.r * K)) / K), jl = 0, jr = 0;

    // 2. Draw the new head at K times the size: the base head's shoulders, the shared neck, then the head.
    const c = canvas(); const g = c.getContext('2d');
    g.setTransform(K, 0, 0, K, 0, 0);
    g.save(); g.beginPath(); g.rect(0, CUT, 512, 80); g.clip(); g.drawImage(baseImg, 0, 0, 512, 512); g.restore();
    const neck = (o) => { const p = new Path2D(); p.rect(NECK.l - o, 360, NECK.r - NECK.l + 2 * o, CUT + 1 - 360); return p; };
    g.fillStyle = '#23140f'; g.fill(neck(NECK.line)); g.fillStyle = SKIN; g.fill(neck(0));
    g.save(); g.clip(new Path2D(keep)); g.drawImage(img, 0, 0, 512, 512); g.restore();

    // 3. Two fields to trace: inside the outline, and skin (0 at the outline colour, 1 at the skin colour).
    const d = g.getImageData(0, 0, S, S).data;
    const sil = new Float32Array(S * S), skin = new Float32Array(S * S);
    const dr = 0x23, sr = parseInt(SKIN.slice(1, 3), 16);
    for (let i = 0; i < S * S; i++) {
      const al = d[i * 4 + 3] / 255; sil[i] = al;
      const t = al > 0 ? Math.min(1, Math.max(0, (d[i * 4] / al - dr) / (sr - dr))) : 0;
      skin[i] = al * t;
    }
    out[name] = { J, sil: trace(sil, S), skin: trace(skin, S) };
  }
  return out;

  // Marching squares at 0.5 -> closed loops in 512 units, simplified and written as a smooth path.
  function trace(f, n) {
    const W = n + 2, v = (i, j) => (i < 1 || j < 1 || i > n || j > n ? 0 : f[(j - 1) * n + (i - 1)]);
    const P = (i, j) => [(i - 0.5) / K, (j - 0.5) / K];
    const lerp = (p, q, vp, vq) => { const t = (0.5 - vp) / (vq - vp); return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; };
    const pts = new Map(), segs = [], at = new Map();
    const point = (key, p, q, vp, vq) => { if (!pts.has(key)) pts.set(key, lerp(p, q, vp, vq)); return key; };
    const link = (k1, k2) => { const s = segs.length; segs.push([k1, k2]); for (const k of [k1, k2]) { if (!at.has(k)) at.set(k, []); at.get(k).push(s); } };
    for (let j = 0; j < W - 1; j++) for (let i = 0; i < W - 1; i++) {
      const tl = v(i, j), tr = v(i + 1, j), br = v(i + 1, j + 1), bl = v(i, j + 1);
      const c = (tl >= 0.5 ? 8 : 0) | (tr >= 0.5 ? 4 : 0) | (br >= 0.5 ? 2 : 0) | (bl >= 0.5 ? 1 : 0);
      if (c === 0 || c === 15) continue;
      const T = () => point(`h${i},${j}`, P(i, j), P(i + 1, j), tl, tr);
      const R = () => point(`v${i + 1},${j}`, P(i + 1, j), P(i + 1, j + 1), tr, br);
      const B = () => point(`h${i},${j + 1}`, P(i, j + 1), P(i + 1, j + 1), bl, br);
      const L = () => point(`v${i},${j}`, P(i, j), P(i, j + 1), tl, bl);
      const mid = (tl + tr + br + bl) / 4 >= 0.5;
      switch (c) {
        case 1: case 14: link(L(), B()); break;
        case 2: case 13: link(B(), R()); break;
        case 3: case 12: link(L(), R()); break;
        case 4: case 11: link(T(), R()); break;
        case 6: case 9: link(T(), B()); break;
        case 7: case 8: link(L(), T()); break;
        case 5: if (mid) { link(L(), T()); link(B(), R()); } else { link(L(), B()); link(T(), R()); } break;
        case 10: if (mid) { link(L(), B()); link(T(), R()); } else { link(L(), T()); link(B(), R()); } break;
      }
    }
    const used = new Uint8Array(segs.length), loops = [];
    for (let s0 = 0; s0 < segs.length; s0++) {
      if (used[s0]) continue;
      const loop = []; let s = s0, from = segs[s0][0];
      while (!used[s]) {
        used[s] = 1; const to = segs[s][0] === from ? segs[s][1] : segs[s][0];
        loop.push(pts.get(to)); from = to;
        s = at.get(to).find((x) => !used[x]) ?? s;
      }
      if (loop.length > 8) loops.push(loop);
    }
    return loops.map((l) => lines(simplify(l, 0.05))).join('');
  }
  function simplify(loop, eps) {        // Douglas-Peucker on a closed loop
    const rdp = (p) => {
      if (p.length < 3) return p;
      const [a, b] = [p[0], p[p.length - 1]]; let idx = 0, dmax = 0;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
      for (let i = 1; i < p.length - 1; i++) { const dd = Math.abs((b[0] - a[0]) * (a[1] - p[i][1]) - (a[0] - p[i][0]) * (b[1] - a[1])) / len; if (dd > dmax) { dmax = dd; idx = i; } }
      return dmax > eps ? rdp(p.slice(0, idx + 1)).slice(0, -1).concat(rdp(p.slice(idx))) : [a, b];
    };
    const h = loop.length >> 1;
    return rdp(loop.slice(0, h + 1)).slice(0, -1).concat(rdp(loop.slice(h).concat([loop[0]])).slice(0, -1));
  }
  // Straight segments, fine enough (0.05 units) that no corner shows at any size the game draws a portrait.
  // Not smoothed into curves: rounding would soften the corner where each ear meets the head, and the
  // manifest builder finds the ears by that sudden widening.
  function lines(p) {
    const f = (x) => Math.round(x * 10) / 10;
    return 'M' + p.map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + 'Z';
  }
}, { heads: Object.fromEntries(todo.map((n) => [n, plain(read(n))])), base: plain(base), NECK, CUT, K, SKIN });
await browser.close();

// ---------- Joining the original drawing to the traced neck ----------
//
// Above SEAM the head is its original drawing, exactly: every measurement taken there (the face, the ears, the
// outline the hair is fitted to) stays what it was. Below it, the traced drawing. Each path is cut along the
// line y = SEAM, curves split exactly where they cross it, and the two halves joined into one path, so nothing
// shows where they meet. SEAM is below every row the manifest profiles (PROFILE_ROWS ends at 402) and above
// every jaw.
const SEAM = 404;

/** Path data (absolute M, L, Q, Z: the heads and the trace use nothing else) -> subpaths of segments. */
function parse(d) {
  const toks = d.match(/[MLQZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi), subs = [];
  let i = 0, cmd, cur = null, pos, start;
  const num = () => Number(toks[i++]);
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) cmd = toks[i++].toUpperCase();
    if (cmd === 'M') { pos = start = [num(), num()]; cur = []; subs.push(cur); cmd = 'L'; continue; }
    if (cmd === 'Z') { if (pos[0] !== start[0] || pos[1] !== start[1]) cur.push([pos, start]); pos = start; continue; }
    if (cmd === 'L') { const p = [num(), num()]; cur.push([pos, p]); pos = p; continue; }
    if (cmd === 'Q') { const c = [num(), num()], p = [num(), num()]; cur.push([pos, c, p]); pos = p; continue; }
    throw new Error(`unsupported path command ${cmd}`);
  }
  return subs;
}

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** A segment ([p0, p1] or [p0, c, p1]) split at t. */
function split(s, t) {
  if (s.length === 2) { const m = lerp(s[0], s[1], t); return [[s[0], m], [m, s[1]]]; }
  const a = lerp(s[0], s[1], t), b = lerp(s[1], s[2], t), m = lerp(a, b, t);
  return [[s[0], a, m], [m, b, s[2]]];
}
/** Where a segment crosses y = Y, as t in (0, 1), in order. */
function crossings(s, Y) {
  const ys = s.map((p) => p[1]), ts = [];
  if (s.length === 2) { const t = (Y - ys[0]) / (ys[1] - ys[0]); if (t > 1e-9 && t < 1 - 1e-9) ts.push(t); return ts; }
  const a = ys[0] - 2 * ys[1] + ys[2], b = 2 * (ys[1] - ys[0]), c = ys[0] - Y;
  const roots = Math.abs(a) < 1e-12 ? (Math.abs(b) < 1e-12 ? [] : [-c / b])
    : (() => { const disc = b * b - 4 * a * c; if (disc < 0) return []; const r = Math.sqrt(disc); return [(-b - r) / (2 * a), (-b + r) / (2 * a)]; })();
  return roots.filter((t) => t > 1e-9 && t < 1 - 1e-9).sort((x, y) => x - y);
}
/** The part of a path on one side of y = Y (above: y < Y), each piece closed along the line. */
function clip(d, Y, above) {
  const inside = (y) => (above ? y < Y : y > Y);
  const fmt = (p) => `${Math.round(p[0] * 100) / 100} ${Math.round(p[1] * 100) / 100}`;
  let out = '';
  for (const segs of parse(d)) {
    let s = '', open = false;
    for (const seg of segs) {
      // split at each crossing, in order along the segment (t is rescaled to what is left of it)
      let rest = seg, done = 0; const pieces = [];
      for (const t of crossings(seg, Y)) { const [a, b] = split(rest, (t - done) / (1 - done)); pieces.push(a); rest = b; done = t; }
      pieces.push(rest);
      for (const p of pieces) {
        const mid = p.length === 2 ? lerp(p[0], p[1], 0.5) : lerp(lerp(p[0], p[1], 0.5), lerp(p[1], p[2], 0.5), 0.5);
        if (!inside(mid[1])) continue;
        // a straight run along the line from wherever the outline left this side
        s += open ? `L${fmt(p[0])}` : `M${fmt(p[0])}`;
        open = true;
        s += p.length === 2 ? `L${fmt(p[1])}` : `Q${fmt(p[1])} ${fmt(p[2])}`;
      }
    }
    if (open) out += s + 'Z';
  }
  return out;
}
const paths = (svg) => {
  const ds = [...svg.matchAll(/<path\b[^>]*\bd="([^"]*)"[^>]*>/g)].map((m) => ({ d: m[1], skin: /id="skin"/.test(m[0]) }));
  return { outline: ds.find((p) => !p.skin).d, skin: ds.find((p) => p.skin).d };
};

for (const [name, r] of Object.entries(results)) {
  r.chin = chins[name];
  const orig = paths(read(name));
  const join = (above, below) => clip(above, SEAM, true) + clip(below, SEAM, false);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" data-pathways="1" ${MARK}${r.chin.face ? ` data-face-chin="${r.chin.face}"` : ''} data-outline-chin="${r.chin.outline}">`
    + `<g id="art"><path style="fill:${OUTLINE}" fill-rule="evenodd" d="${join(orig.outline, r.sil)}"/>`
    + `<path id="skin" style="fill:var(--skin-color,${SKIN})" fill-rule="evenodd" d="${join(orig.skin, r.skin)}"/></g></svg>`;
  writeFileSync(file(name), svg);
  console.log(`${name}: chin ends at y=${r.J}, ${(svg.length / 1024).toFixed(1)} KB`);
}
