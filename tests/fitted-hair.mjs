// Checks the fitted-hair pipeline's output and how the game draws it. Run with: node tests/fitted-hair.mjs
//  - every style in js/avatar/fittedHair.js has a fitted file for every head it lists, with its four layers
//  - a portrait draws hair_back behind the head and the other layers in front, from that head's own file
//  - children get the kid head's file; a head the style was not fitted to gets the base head's
//  - a fitted style can be chosen and saved, and the hairstyles given out at random are unchanged
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { FITTED_HAIR, FITTED_BASE_HEAD } from '../js/avatar/fittedHair.js';
import { CATALOG, HAIR_STYLES, FITTED_STYLES, fittedFor, normalize } from '../js/avatar/catalog.js';
import { avatarSvg } from '../js/avatar/render.js';
import { fittedHairFile, filesFor, characterAvatarSvg, dressFor } from '../js/CharacterAvatar.js';
import { AVATAR_MANIFEST } from '../js/avatarManifest.js';

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
const root = new URL('../', import.meta.url);
const LAYERS = ['hair_back', 'hair_base', 'hair_bangs', 'hair_lines'];
const styles = Object.keys(FITTED_HAIR);
const landmarks = JSON.parse(readFileSync(new URL('assets/landmarks.json', root), 'utf8'));

check(styles.length > 0, 'no fitted hairstyles: run npm run fit-hair');
check(landmarks.base_head === FITTED_BASE_HEAD, `fittedHair.js was made from base head ${FITTED_BASE_HEAD}, but landmarks.json says ${landmarks.base_head}: run npm run fit-hair`);

// 1. The files.
const raw = readdirSync(new URL('assets/hair_raw/', root)).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4).toLowerCase().replace(/[^a-z0-9]+/g, '_'));
check(raw.sort().join() === [...styles].sort().join(), `assets/hair_raw/ (${raw}) and fittedHair.js (${styles}) differ: run npm run fit-hair`);
for (const [id, s] of Object.entries(FITTED_HAIR)) {
  check(s.heads.includes(FITTED_BASE_HEAD) && s.heads.includes('kid'), `${id} is not fitted to the base head and the kid head`);
  for (const head of s.heads) {
    const file = new URL(`assets/hair_fitted/${id}_${head}.svg`, root);
    if (!existsSync(file)) { check(false, `missing assets/hair_fitted/${id}_${head}.svg`); continue; }
    const svg = readFileSync(file, 'utf8');
    check(svg.includes('viewBox="0 0 512 512"') && !/transform=/.test(svg), `${id}_${head}.svg is not in the plain 512 frame`);
    for (const layer of LAYERS) check(svg.includes(`id="${layer}"`), `${id}_${head}.svg has no ${layer} layer`);
    check(svg.includes('var(--hair-color,'), `${id}_${head}.svg cannot be dyed`);
  }
}

// 2. Drawing it.
const heads = AVATAR_MANIFEST.heads.filter((h) => h.tags?.age === 'adult');
for (const id of styles) {
  for (const h of heads) {
    const name = h.file.replace(/^.*\/|\.svg$/g, '');
    const want = `hair_fitted/${id}_${FITTED_HAIR[id].heads.includes(name) ? name : FITTED_BASE_HEAD}.svg`;
    check(fittedHairFile(id, h.id) === want, `${id} on ${h.id} uses ${fittedHairFile(id, h.id)}, not ${want}`);
    const svg = characterAvatarSvg(dressFor({ head: h.id, hair: id, eyes: 'eyes_10', eyebrows: 'brows_10', nose: 'nose_10', lips: 'lips_6', clothes: 'outfit_01_tee', makeup: [], jewelry: [], colors: { skin: '#c68642', hair: '#2b1b14' } }, { age: 30 }), { age: 30 });
    const at = (s) => svg.indexOf(s);
    check(at(`${want}#hair_back`) > 0 && at(`${want}#hair_back`) < at(`${h.file}#art`), `${id} on ${h.id}: hair_back is not drawn behind the head`);
    for (const layer of LAYERS.slice(1)) check(at(`${want}#${layer}`) > at('outfit_01_tee'), `${id} on ${h.id}: ${layer} is not drawn in front`);
    check(!svg.includes(`${id}.svg`) && !/scale\(/.test(svg.slice(at(`${want}#hair_back`) - 120, at(`${want}#hair_back`))), `${id} on ${h.id} is moved again at run time`);
  }
  // A child wears it on the kid head; under a hat it is still clipped by the brim.
  const kid = avatarSvg({ appearance: { v: 3, inherited: { head: 'head_17_dimple_oval', skin: 'tan' }, style: { hair: id } }, seed: 'kid', age: 9 });
  check(kid.includes(`hair_fitted/${id}_kid.svg#hair_back`), `a child is not drawn with ${id}_kid.svg`);
  check(filesFor({ head: 'head_11_pixie', hair: id, makeup: [], jewelry: [] }, { age: 30 }).includes(`./assets/hair_fitted/${id}_pixie.svg`), `the fitted file of ${id} is not preloaded`);
}

// 3. Choosing it.
for (const id of styles) {
  check(CATALOG.hair.some((h) => h.id === id), `${id} is not offered in the creator`);
  check(normalize({ v: 3, inherited: { head: 'head_12_sculpted' }, style: { hair: id } }, 'saved').style.hair === id, `a saved ${id} does not load`);
}
check(!HAIR_STYLES.some((h) => FITTED_HAIR[h.id]), 'fitted styles are among the styles given out at random');
check(FITTED_STYLES.every((s) => s.type !== 'any' || ['straight', 'wavy', 'curly', 'coily'].every((t) => fittedFor(t).includes(s))), 'a style for any texture is not offered to every texture');

if (problems.length) {
  console.log([...new Set(problems)].slice(0, 30).join('\n'));
  console.log(`${problems.length} problem(s).`);
  process.exit(1);
}
console.log(`Fitted hair is sound: ${styles.length} style(s), each drawn from its own file on ${heads.length} adult heads and the kid head, back layer behind the head, the rest in front.`);
