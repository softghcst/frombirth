#!/usr/bin/env node
// Fits outfits to each head's neck. Run after scripts/build-avatar-manifest.py: `npm run fit-clothes`.
//
// An outfit is drawn against one head (the template the image model was given), so its neckline matches that
// head's neck. The heads' shoulders are nearly the same, but their necks are not: on a thinner neck the neckline
// gapes, on a thicker one it bites. The portrait already scales an outfit to the shoulders (fitTransforms in
// js/CharacterAvatar.js); this makes, for every other head, a copy of the outfit whose neckline is drawn in or out
// to that head's neck, easing back to the drawing as it was by the shoulders.
//
// Which outfits, and which head each was drawn on: assets/clothes_drawn_for.json, e.g.
//   { "outfit_54_denim_jacket_tee": "athletic" }
// Writes assets/clothes_fit/<outfit>__<head>.svg, and js/avatar/fittedClothes.js listing them.
// Needs Playwright's Chromium (to measure the necks from the head drawings).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const at = (...p) => path.join(ROOT, ...p);
const { PART_BY_ID, AVATAR_TEMPLATE: T } = await import(at('js', 'avatarManifest.js'));
const { OUTFITS } = await import(at('js', 'avatar', 'curation.js'));
const drawnFor = JSON.parse(readFileSync(at('assets', 'clothes_drawn_for.json'), 'utf8'));

// The heads that wear everyday clothes (babies and toddlers have their own).
const heads = Object.values(PART_BY_ID).filter((p) => p.fit && p.file.startsWith('heads/') && !/baby|toddler/.test(p.file))
  .map((p) => ({ id: p.id, name: path.basename(p.file, '.svg'), fit: p.fit }));

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<body></body>');

/** Draws SVG text at 512 px; -> for each column, the first row at or below `from` where something is drawn (or -1). */
async function tops(svg, from, skip = null) {
  return page.evaluate(async ({ svg, from, skip }) => {
    const img = new Image();
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    await img.decode();
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, 512, 512).data;
    const on = (x, y) => d[(y * 512 + x) * 4 + 3] > 128;
    const out = [];
    for (let x = 0; x < 512; x++) {
      let t = -1;
      // A body's top: only beside the neck, where the row it starts from is clear of the head.
      if (!skip || ((x < skip[0] || x > skip[1]) && !on(x, from))) for (let y = from; y < 512; y++) if (on(x, y)) { t = y; break; }
      out.push(t);
    }
    return out;
  }, { svg, from, skip });
}

/**
 * Each head's neck, measured from its drawing: the narrowest the outline gets below the chin, and where it widens into
 * the shoulders; and the top of its shoulders, column by column, beside the neck.
 */
async function measure() {
  const out = {};
  for (const h of heads) {
    const svg = readFileSync(at('assets', 'heads', `${h.name}.svg`), 'utf8');
    const n = await page.evaluate(async ({ svg, from }) => {
      const img = new Image();
      img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
      await img.decode();
      const c = document.createElement('canvas'); c.width = c.height = 512;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, 512, 512).data;
      const row = (y) => { let L = -1, R = -1; for (let x = 0; x < 512; x++) if (d[(y * 512 + x) * 4 + 3] > 128) { if (L < 0) L = x; R = x; } return { L, R, w: R - L }; };
      let neck = null;
      for (let y = from; y < from + 45; y++) { const r = row(y); if (!neck || r.w < neck.w) neck = { ...r, y }; }
      let base = neck.y;
      for (let y = neck.y; y < 505; y++) if (row(y).w > neck.w * 1.15) { base = y; break; }
      return { L: neck.L, R: neck.R, y: neck.y, base };
    }, { svg, from: Math.round(h.fit.chin) - 10 });
    n.shoulders = await tops(svg, n.y, [n.L - 2, n.R + 2]);
    out[h.name] = n;
  }
  return out;
}

/** A head's neck in the outfit's own frame (the template's), where the outfit's top sits at T.clothesTop. */
function inTemplate(h, n) {
  const body = Math.max(0.8, Math.min(1.06, h.fit.shoulderW / T.shoulderW));
  return { half: (n.R - n.L) / 2 / body, base: T.clothesTop + (n.base - (h.fit.collar ?? h.fit.chin + 8)) / body };
}

/**
 * Moves each point sideways: inside the neck's width the neckline is drawn in or out (by k); outside it, the collar,
 * lapels and buttons slide by the same amount the neck's edge moved, keeping their shape, and that slide fades out
 * towards the shoulders' outer reach. Downwards the change fades out over the 40 units below the neck. Monotonic, so
 * shapes never fold.
 */
function warper(k, ref) {
  const h = ref.half; // the neck's half-width, where the neckline meets it
  const D = h + 140; // beyond this, the shoulders and sleeves: left alone
  const y0 = ref.base + 2; const y1 = ref.base + 40;
  const side = (u) => {
    const s = Math.sign(u); const m = Math.abs(u);
    if (m <= h) return u * k;
    if (m >= D) return u;
    return u + s * h * (k - 1) * (1 - (m - h) / (D - h));
  };
  return (x, y) => {
    const w = y <= y0 ? 1 : y >= y1 ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * (y - y0)) / (y1 - y0));
    const u = x - 256;
    return [256 + u + w * (side(u) - u), y];
  };
}

/** The transform the portrait puts an outfit through on this head (fitTransforms in js/CharacterAvatar.js). */
function placement(h) {
  const body = Math.max(0.8, Math.min(1.06, h.fit.shoulderW / T.shoulderW));
  // The adult heads share one neck and shoulders: clothes sit on that body (collar, bodyX), others under the chin.
  const cx = h.fit.bodyX ?? h.fit.cx; const top = h.fit.collar ?? h.fit.chin + 8;
  return { body, cx, top, attr: `translate(${cx} ${top}) scale(${body}) translate(-256 ${-T.clothesTop})` };
}

/**
 * How far this body's shoulders rise above the outfit's top edge, column by column of the outfit's own frame (template
 * units; 0 where the outfit is above them, or not there). Skin showing there.
 */
async function shoulderGap(svgText, h, neck) {
  const { body, cx, top: collar, attr } = placement(h);
  const inner = svgText.match(/<g id="art">([\s\S]*)<\/g>\s*<\/svg>/)[1];
  const top = await tops(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><g transform="${attr}">${inner}</g></svg>`, 360);
  const gap = []; const topT = [];
  for (let xt = 0; xt < 512; xt++) {
    const hx = Math.round(cx + (xt - 256) * body);
    const t = hx >= 0 && hx < 512 ? top[hx] : -1; const b = hx >= 0 && hx < 512 ? neck.shoulders[hx] : -1;
    gap.push(t >= 0 && b >= 0 ? Math.max(0, (t - b) / body) : 0);
    topT.push(t >= 0 ? T.clothesTop + (t - collar) / body : null);
  }
  return { gap, topT };
}

/**
 * Where this body's shoulders show above the outfit more than they do on the head it was drawn on (a child's sit
 * higher), the outfit's top is lifted there, by the difference and 2 more, easing back to the drawing as it was over
 * the 45 units below its top edge. Skin the drawing means to show (a tank top's shoulders) shows on every head alike.
 * -> a warp, or null if nothing needs lifting.
 */
function shoulderLift(mine, drawn) {
  const raw = mine.gap.map((g, x) => (g - drawn.gap[x] > 3 ? g - drawn.gap[x] + 2 : 0)); // a few units either way is only how the heads differ
  const lift = raw.map((_, x) => Math.max(...raw.slice(Math.max(0, x - 10), x + 11))); // a little either side, so the edge is smooth
  if (Math.max(...lift) < 0.5) return null;
  const col = (x) => Math.max(0, Math.min(511, Math.round(x)));
  return (x, y) => {
    const L = lift[col(x)]; const t = mine.topT[col(x)];
    if (!L || t == null) return [x, y];
    const w = y <= t ? 1 : y >= t + 45 ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * (y - t)) / 45);
    return [x, y - L * w];
  };
}

/** Rewrites every coordinate pair in the drawing's paths. The build leaves only absolute M, L, C, Q and Z. */
function warpSvg(svg, f) {
  return svg.replace(/ d="([^"]*)"/g, (m, d) => {
    if (/[a-y]/.test(d.replace(/e-?\d/g, ''))) throw new Error('relative path commands: run the avatar build first');
    const nums = d.match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
    let i = 0;
    const out = d.replace(/-?\d*\.?\d+(?:e-?\d+)?/g, () => {
      const j = i++;
      if (j % 2) return '';
      const [x, y] = f(Number(nums[j]), Number(nums[j + 1]));
      return `${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`;
    });
    return ` d="${out.replace(/ {2,}/g, ' ').replace(/ ([A-Za-z])/g, '$1').replace(/([A-Za-z]) /g, '$1')}"`;
  });
}

const necks = await measure();
mkdirSync(at('assets', 'clothes_fit'), { recursive: true });
const fitted = {};
let changedDrawnFor = false;
for (const [outfit, how] of Object.entries(drawnFor)) {
  // "athletic", or { head: "athletic", scale: 1.25 } for an outfit drawn on that head and then scaled up about the
  // middle of its neckline (scripts/import_outfit.py): its neckline is then wider than the neck it was drawn on, so
  // that head is fitted too.
  // { head, neckline: "open" }: a V-neck or scoop neck, cut wider than the neck. It is widened for a thicker neck
  // and never drawn in for a thinner one (an open neckline on a slim neck is how it is meant to look).
  const refName = typeof how === 'string' ? how : how.head;
  const open = typeof how === 'object' && how.neckline === 'open';
  const scale = typeof how === 'string' ? 1 : how.scale ?? 1;
  const ref = heads.find((h) => h.name === refName);
  if (!ref || !PART_BY_ID[outfit]) { console.warn(`skipped ${outfit}: unknown outfit or head ${refName}`); continue; }
  const src = readFileSync(at('assets', PART_BY_ID[outfit].file), 'utf8');
  // The neck it was drawn on, as it was then: remembered the first time it is fitted, so redrawing that head later
  // (the adult heads were given one shared neck) does not change what the outfit's neckline was cut for.
  const drawn = typeof how === 'object' && how.neck ? how.neck : inTemplate(ref, necks[refName]);
  if (!(typeof how === 'object' && how.neck)) {
    drawnFor[outfit] = { ...(typeof how === 'object' ? how : { head: refName }), neck: { half: Math.round(drawn.half * 10) / 10, base: Math.round(drawn.base * 10) / 10 } };
    changedDrawnFor = true;
  }
  const r = { half: drawn.half * scale, base: T.clothesTop + (drawn.base - T.clothesTop) * scale };
  fitted[outfit] = [];
  const drawnGap = await shoulderGap(src, ref, necks[refName]);
  // Shoulders bare on the head it was drawn on (a tank top): the drawing means them to show, on every head.
  const bare = Math.max(...drawnGap.gap) > 10;
  for (const h of heads) {
    if (h.name === 'kid' && OUTFITS.grownOnly?.includes(outfit)) continue; // grown-ups' clothes: no child wears them
    const t = inTemplate(h, necks[h.name]);
    // Every head is measured against the neck the outfit was drawn on (that head itself may have been redrawn since).
    const raw = open ? Math.max(1, t.half / r.half) : t.half / r.half;
    const k = Math.abs(raw - 1) < 0.03 ? 1 : raw;
    let svg = k === 1 ? src : warpSvg(src, warper(k, r));
    const lift = bare ? null : shoulderLift(await shoulderGap(svg, h, necks[h.name]), drawnGap);
    if (lift) svg = warpSvg(svg, lift);
    if (k === 1 && !lift) continue; // nothing to change on this head: the outfit's own file
    writeFileSync(at('assets', 'clothes_fit', `${outfit}__${h.name}.svg`), svg.replace('<svg ', `<svg data-neck-fit="${h.name}" `));
    fitted[outfit].push(h.name);
    console.log(`${outfit} on ${h.name}: neckline x${k.toFixed(2)}${lift ? ', shoulders lifted' : ''}`);
  }
}
await browser.close();
if (changedDrawnFor) writeFileSync(at('assets', 'clothes_drawn_for.json'), `${JSON.stringify(drawnFor, null, 2)}\n`);
writeFileSync(at('js', 'avatar', 'fittedClothes.js'), `// Written by scripts/fit-clothes.mjs (\`npm run fit-clothes\`): do not edit by hand.
// Outfits with a copy fitted to each head's neck, in assets/clothes_fit/<outfit>__<head>.svg. On the head an
// outfit was drawn for (assets/clothes_drawn_for.json), and on any head not listed, the outfit's own file is used.
export const FITTED_CLOTHES = ${JSON.stringify(fitted)};
`);
