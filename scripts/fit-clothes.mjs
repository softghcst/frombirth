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
// Writes assets/avatars/clothes_fit/<outfit>__<head>.svg, and js/avatar/fittedClothes.js listing them.
// Needs Playwright's Chromium (to measure the necks from the head drawings).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const at = (...p) => path.join(ROOT, ...p);
const { PART_BY_ID, AVATAR_TEMPLATE: T } = await import(at('js', 'avatarManifest.js'));
const drawnFor = JSON.parse(readFileSync(at('assets', 'clothes_drawn_for.json'), 'utf8'));

// The heads that wear everyday clothes (babies and toddlers have their own).
const heads = Object.values(PART_BY_ID).filter((p) => p.fit && p.file.startsWith('heads/') && !/baby|toddler/.test(p.file))
  .map((p) => ({ id: p.id, name: path.basename(p.file, '.svg'), fit: p.fit }));

/** Each head's neck, measured from its drawing: the narrowest the outline gets below the chin, and where it widens into the shoulders. */
async function measure() {
  const require = createRequire(import.meta.url);
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<body></body>');
  const out = {};
  for (const h of heads) {
    const svg = readFileSync(at('assets', 'heads', `${h.name}.svg`), 'utf8');
    out[h.name] = await page.evaluate(async ({ svg, from }) => {
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
      return { L: neck.L, R: neck.R, base };
    }, { svg, from: Math.round(h.fit.chin) - 10 });
  }
  await browser.close();
  return out;
}

/** A head's neck in the outfit's own frame (the template's), where the outfit's top sits at T.clothesTop. */
function inTemplate(h, n) {
  const body = Math.max(0.8, Math.min(1.06, h.fit.shoulderW / T.shoulderW));
  return { half: (n.R - n.L) / 2 / body, base: T.clothesTop + (n.base - (h.fit.chin + 8)) / body };
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

/** How close two necks must be (as a ratio of widths) for an outfit to need no copy of its own. */
const SAME = 0.03;
const necks = await measure();
mkdirSync(at('assets', 'avatars', 'clothes_fit'), { recursive: true });
const fitted = {};
for (const [outfit, refName] of Object.entries(drawnFor)) {
  const ref = heads.find((h) => h.name === refName);
  if (!ref || !PART_BY_ID[outfit]) { console.warn(`skipped ${outfit}: unknown outfit or head ${refName}`); continue; }
  const src = readFileSync(at('assets', PART_BY_ID[outfit].file), 'utf8');
  const r = inTemplate(ref, necks[refName]);
  fitted[outfit] = [];
  // Copies made before are cleared first: a head whose neck now matches needs none.
  for (const f of readdirSync(at('assets', 'avatars', 'clothes_fit'))) if (f.startsWith(`${outfit}__`)) unlinkSync(at('assets', 'avatars', 'clothes_fit', f));
  for (const h of heads) {
    if (h.name === refName) continue;
    const t = inTemplate(h, necks[h.name]);
    const k = t.half / r.half;
    // A neck within SAME of the one the outfit was drawn on (the adult heads share one neck) wears the outfit's own file.
    if (Math.abs(k - 1) < SAME) { console.log(`${outfit} on ${h.name}: same neck, no copy needed`); continue; }
    writeFileSync(at('assets', 'avatars', 'clothes_fit', `${outfit}__${h.name}.svg`), warpSvg(src, warper(k, r)).replace('<svg ', `<svg data-neck-fit="${h.name}" `));
    fitted[outfit].push(h.name);
    console.log(`${outfit} on ${h.name}: neckline x${k.toFixed(2)}`);
  }
}
writeFileSync(at('js', 'avatar', 'fittedClothes.js'), `// Written by scripts/fit-clothes.mjs (\`npm run fit-clothes\`): do not edit by hand.
// Outfits with a copy fitted to each head's neck, in assets/avatars/clothes_fit/<outfit>__<head>.svg. On the head an
// outfit was drawn for (assets/clothes_drawn_for.json), and on any head not listed, the outfit's own file is used.
export const FITTED_CLOTHES = ${JSON.stringify(Object.fromEntries(Object.entries(fitted).filter(([, v]) => v.length)))};
`);
