// Checks the fitted-hair pipeline's output and how the game draws it. Run with: node tests/fitted-hair.mjs
//  - assets/hair_manifest.json lists exactly the styles in assets/hair_raw/, with names and clipToHead set by the rules
//  - every style has a fitted file for every head it lists, with its four layers
//  - a portrait draws hair_back behind the head and the other layers in front, from that head's own file;
//    a clipToHead style (buzz cut, fade) is clipped to the head's skin
//  - children get the kid head's file; a head the style was not fitted to gets the base head's
//  - a fitted style can be chosen and saved, and the hairstyles given out at random are unchanged
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { FITTED_HAIR, FITTED_BASE_HEAD, FITTED_LOADED } from '../js/avatar/fittedHair.js';
import { CATALOG, HAIR_STYLES, FITTED_STYLES, GONE_FITTED, fittedFor, normalize } from '../js/avatar/catalog.js';
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
for (const f of readdirSync(new URL('assets/hair_raw/', root)).filter((x) => x.endsWith('.svg'))) {
  const head = readFileSync(new URL(`assets/hair_raw/${f}`, root), 'utf8').match(/<svg\b[^>]*>/)?.[0] ?? '';
  check(/viewBox="0 0 512 512"/.test(head), `assets/hair_raw/${f} is not on the 512x512 head canvas: run npm run soften-hair`);
}
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
// A withdrawn style is gone from the game, and a save that used it is given its replacement.
for (const [gone, kept] of Object.entries(GONE_FITTED)) {
  check(!FITTED_HAIR[gone] && !existsSync(new URL(`assets/hair_raw/${gone}.svg`, root)), `${gone} is withdrawn but still in the game`);
  check(!!FITTED_HAIR[kept], `${gone} is replaced by ${kept}, which is not a fitted style`);
  check(normalize({ v: 3, inherited: { head: 'head_12_sculpted' }, style: { hair: gone } }, 'saved').style.hair === kept, `a save with ${gone} is not given ${kept}`);
}
// One shade: no hair shape is a darker mix of the main color (lighter highlight shapes are allowed).
for (const id of styles) {
  const svg = readFileSync(new URL(`assets/hair_fitted/${id}_${FITTED_BASE_HEAD}.svg`, root), 'utf8');
  check(!/fill:color-mix\([^)]*#000\)/.test(svg), `${id} has hair shapes in a darker shade`);
}
check(FITTED_STYLES.every((s) => s.type !== 'any' || ['straight', 'wavy', 'curly', 'coily'].every((t) => fittedFor(t).includes(s))), 'a style for any texture is not offered to every texture');

// Grown-up styles (data-min-age on the raw SVG) carry their minimum age into the game, which does not offer them younger.
for (const [id, st] of Object.entries(FITTED_HAIR)) {
  const head = readFileSync(new URL(`assets/hair_raw/${id}.svg`, root), 'utf8').match(/<svg\b[^>]*>/)?.[0] ?? '';
  const want = Number(head.match(/data-min-age="(\d+)"/)?.[1] ?? 0);
  check((st.minAge ?? 0) === want && FITTED_STYLES.find((x) => x.id === id)?.minAge === want, `${id}: minimum age ${want} not carried into the game`);
}
check(FITTED_HAIR.storybook_waves?.minAge === 13, 'Storybook Waves is offered to children');
// Each style is fitted from the head it was drawn on (data-drawn-on; the base head if not given), so changing the
// base head keeps every style fitting.
for (const id of Object.keys(FITTED_HAIR)) {
  const on = readFileSync(new URL(`assets/hair_raw/${id}.svg`, root), 'utf8').match(/<svg\b[^>]*>/)?.[0].match(/data-drawn-on="([a-z0-9_]+)"/)?.[1] ?? landmarks.base_head;
  check(!!landmarks[on], `${id}: drawn on ${on}, which has no landmarks`);
  const fitted = readFileSync(new URL(`assets/hair_fitted/${id}_${FITTED_BASE_HEAD}.svg`, root), 'utf8');
  check(fitted.includes(`data-fitted-from="${on}"`), `${id}: not fitted from the head it was drawn on (${on})`);
}


// Older women: from ELDER_HAIR_AGE drawn with an elder style, unless they chose their hair at the salon since.
{
  const { elderHairStyles } = await import('../js/CharacterAvatar.js');
  const { ELDER_HAIR_AGE } = await import('../js/avatar/curation.js');
  const elders = elderHairStyles('female');
  check(elders.includes('elder_low_bun'), 'Elder Low Bun is not an elder style');
  check(elders.every((id) => !!FITTED_HAIR[id] || !!CATALOG.hair.find((h) => h.id === id)), 'an elder style does not exist');
  const look = (extra = {}) => ({ v: 3, inherited: { head: 'head_13_athletic', skin: 'tan' }, style: { hair: 'long_straight_center_part', ...extra } });
  const drawn = (age, gender, extra) => avatarSvg({ appearance: look(extra), seed: 'elder', age, gender });
  const elderly = (svg) => elders.some((id) => svg.includes(`hair_fitted/${id}_`));
  check(!elderly(drawn(ELDER_HAIR_AGE - 1, 'female')), 'a woman is drawn with an elder style before old age');
  check(elderly(drawn(ELDER_HAIR_AGE, 'female')) && elderly(drawn(90, 'female')), 'an older woman keeps a young style');
  check(!elderly(drawn(90, 'female', { keepHair: true })) && drawn(90, 'female', { keepHair: true }).includes('long_straight_center_part'), 'an older woman who chose her hair at the salon is not drawn with it');
  const menElders = elderHairStyles('male');
  check(menElders.includes('elder_twists') && !menElders.some((id) => elders.includes(id)), 'Elder Twists is not an elder men\'s style, or the lists overlap');
  check(!elderly(drawn(90, 'male')), 'an older man is drawn with an elder woman\'s style');
  check(menElders.some((id) => drawn(90, 'male').includes(`hair_fitted/${id}_`)), 'an older man keeps a young style');
  check(!menElders.some((id) => drawn(ELDER_HAIR_AGE - 1, 'male').includes(`hair_fitted/${id}_`)), 'a man is drawn with an elder style before old age');
  check(drawn(90, 'male', { keepHair: true }).includes('long_straight_center_part'), 'an older man who chose his hair at the salon is not drawn with it');
  check(normalize(look({ keepHair: true }), 'k').style.keepHair === true, 'a salon choice in old age is not kept in the save');
}

// Men's and women's hair: every fitted style says whose it is, and generated people only get their own gender's (or unisex).
{
  const { randomAppearance, ensureStyled } = await import('../js/avatar/inherit.js');
  const { hairSuitsGender } = await import('../js/avatar/catalog.js');
  for (const [id, st] of Object.entries(FITTED_HAIR)) check(['male', 'female', 'any'].includes(st.gender), `${id}: no gender (data-gender on its raw SVG)`);
  check(FITTED_HAIR.swept_back_waves?.gender === 'male' && FITTED_HAIR.storybook_waves?.gender === 'female', 'a men\'s or women\'s style is tagged wrong');
  const byId = Object.fromEntries(CATALOG.hair.map((h) => [h.id, h]));
  for (let i = 0; i < 400; i++) {
    const gender = i % 2 ? 'female' : 'male';
    const hair = ensureStyled(randomAppearance(undefined, gender), gender).style.hair;
    check(hairSuitsGender(byId[hair], gender), `a generated ${gender === 'male' ? 'man' : 'woman'} was given ${hair}, a ${byId[hair]?.tags?.gender} style`);
  }
}

if (problems.length) {
  console.log([...new Set(problems)].slice(0, 30).join('\n'));
  console.log(`${problems.length} problem(s).`);
  process.exit(1);
}
console.log(`Fitted hair is sound: ${styles.length} style(s), each drawn from its own file on ${heads.length} adult heads and the kid head, back layer behind the head, the rest in front.`);
