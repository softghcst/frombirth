// Checks the fitted-hair pipeline's output and how the game draws it. Run with: node tests/fitted-hair.mjs
//  - assets/hair_manifest.json lists exactly the styles in assets/hair_raw/, with names and clipToHead set by the rules
//  - every style has a fitted file for every head it lists, with its four layers
//  - a portrait draws hair_back behind the head and the other layers in front, from that head's own file;
//    a clipToHead style (buzz cut, fade) is clipped to the head's skin
//  - children get the kid head's file; a head the style was not fitted to gets the base head's
//  - a fitted style can be chosen and saved, and the hairstyles given out at random are unchanged
//  - every hairstyle has one bold outer silhouette (hair_back, hair_base) and only soft lines inside it (hair_bangs,
//    hair_lines), raw and fitted; and the ChatGPT prompt asks for exactly that
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { FITTED_HAIR, FITTED_BASE_HEAD, FITTED_LOADED } from '../js/avatar/fittedHair.js';
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

check(FITTED_LOADED, 'assets/hair_manifest.json did not load');
check(styles.length > 0, 'no fitted hairstyles: run npm run fit-hair');
check(landmarks.base_head === FITTED_BASE_HEAD, `the hair manifest was made from base head ${FITTED_BASE_HEAD}, but landmarks.json says ${landmarks.base_head}: run npm run fit-hair`);

// 1. The files.
const raw = readdirSync(new URL('assets/hair_raw/', root)).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4).toLowerCase().replace(/[^a-z0-9]+/g, '_'));
check(raw.sort().join() === [...styles].sort().join(), `assets/hair_raw/ (${raw}) and assets/hair_manifest.json (${styles}) differ: run npm run fit-hair`);
for (const [id, s] of Object.entries(FITTED_HAIR)) {
  check(s.id === id && typeof s.name === 'string' && s.name.length > 0 && typeof s.clipToHead === 'boolean', `${id}: the manifest entry needs an id, a name and clipToHead`);
  const rawSvg = readFileSync(new URL(`assets/hair_raw/${id}.svg`, root), 'utf8');
  const flag = rawSvg.match(/<svg[^>]*\sdata-clip-to-head="(true|false)"/)?.[1];
  check(s.clipToHead === (flag ? flag === 'true' : /fade|buzz/.test(id)), `${id}: clipToHead should be ${flag ?? /fade|buzz/.test(id)}`);
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
  // A style marked clipToHead is drawn inside the head's skin, back and front; one that is not, is not clipped to it.
  const meta = FITTED_HAIR[id];
  const was = meta.clipToHead;
  for (const clip of [false, true]) {
    meta.clipToHead = clip;
    const svg = characterAvatarSvg(dressFor({ head: 'head_12_sculpted', hair: id, makeup: [], jewelry: [], colors: { skin: '#c68642', hair: '#2b1b14' } }, { age: 30 }), { age: 30 });
    const face = svg.match(/<clipPath id="(pw-face-\d+)"><use href="[^"]*heads\/sculpted\.svg#skin"\/><\/clipPath>/)?.[1];
    const wrapped = (layer) => new RegExp(`<g clip-path="url\\(#${face}\\)"><g clip-path="url\\(#pw-back-\\d+\\)"><use href="[^"]*${id}_sculpted\\.svg#${layer}"`).test(svg);
    check(!!face && wrapped('hair_back') === clip && wrapped('hair_base') === clip, `${id} with clipToHead ${clip} is ${clip ? 'not ' : ''}clipped to the head's skin`);
  }
  meta.clipToHead = was;
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


// The lines: one bold outer silhouette, soft separation inside it (scripts/soften_hair_lines.py, assets/CHATGPT_HAIR_PROMPT.md).
{
  const layers = (svg) => Object.fromEntries([...svg.matchAll(/<g id="(hair_\w+)"([\s\S]*?)<\/g>/g)].map((m) => [m[1], m[2]]));
  const widths = (body) => [...body.matchAll(/stroke-width(?:="|:)\s*([\d.]+)/g)].map((m) => Number(m[1]));
  const files = [...raw.map((id) => `assets/hair_raw/${id}.svg`), ...readdirSync(new URL('assets/hair_fitted/', root)).filter((f) => f.endsWith('.svg')).map((f) => `assets/hair_fitted/${f}`)];
  for (const f of files) {
    const g = layers(readFileSync(new URL(f, root), 'utf8'));
    for (const outer of ['hair_back', 'hair_base']) check(!g[outer] || !/<path/.test(g[outer]) || (g[outer].includes('#23140f') && widths(g[outer]).includes(6)), `${f}: ${outer} has lost its bold outline`);
    for (const inner of ['hair_bangs', 'hair_lines']) {
      check(!(g[inner] ?? '').includes('#23140f'), `${f}: ${inner} still has the bold outline inside the hair`);
      check(widths(g[inner] ?? '').every((w) => w <= 2.5), `${f}: ${inner} has a line heavier than 2.5 (${widths(g[inner])})`);
    }
  }
  const prompt = readFileSync(new URL('assets/CHATGPT_HAIR_PROMPT.md', root), 'utf8');
  check(/ONLY the outer silhouette/.test(prompt) && prompt.includes('stroke="#4a2414" stroke-width="2.5" stroke-linecap="round"') && /hair_bangs has stroke="none"/.test(prompt)
    && ['#8f4b29', '#6b3520', '#4a2414', '#b8693d'].every((c) => prompt.includes(c)), 'the ChatGPT hair prompt does not ask for one bold silhouette and soft lines inside it');
  check(prompt.includes(`Here is the base head (\`${landmarks.base_head}\`)`) && prompt.includes('| `crown_top` |'), 'the ChatGPT hair prompt has lost its reference head or landmarks');
}

if (problems.length) {
  console.log([...new Set(problems)].slice(0, 30).join('\n'));
  console.log(`${problems.length} problem(s).`);
  process.exit(1);
}
console.log(`Fitted hair is sound: ${styles.length} style(s), each drawn from its own file on ${heads.length} adult heads and the kid head, back layer behind the head, the rest in front.`);
