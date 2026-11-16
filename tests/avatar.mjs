// Checks the avatar system. Run with: node tests/avatar.mjs
//  - every part in the manifest is on disk, normalised, and has the ids the renderer uses
//  - every hand-curated id names a real part
//  - colour ids that have shipped are still present (so existing saves keep their colours)
//  - saves from both earlier avatar systems, missing data and unknown ids all load to a complete, stable face
//  - children are built only from what their parents were born with
//  - portraits render at every age and in every situation, using only files that exist
import { readFileSync, existsSync } from 'node:fs';
import { AVATAR_MANIFEST, PART_BY_ID, AVATAR_TEMPLATE } from '../js/avatarManifest.js';
import { CATALOG, INHERITED_KEYS, STYLE_KEYS, normalize, part, resolveLook } from '../js/avatar/catalog.js';
import { avatarSvg } from '../js/avatar/render.js';
import { dressFor, filesFor, ageStage, fitTransforms } from '../js/CharacterAvatar.js';
import { randomAppearance, inheritAppearance, ensureStyled, cloneAppearance } from '../js/avatar/inherit.js';
import * as CUR from '../js/avatar/curation.js';
import { rng } from '../js/rng.js';

rng.seed(20240611);
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
const root = new URL('../', import.meta.url);

// 1. The artwork.
for (const [folder, list] of Object.entries(AVATAR_MANIFEST)) {
  for (const p of list) {
    const file = new URL(`assets/avatars/${p.file}`, root);
    if (!existsSync(file)) { check(false, `missing file ${p.file}`); continue; }
    const svg = readFileSync(file, 'utf8');
    check(svg.includes('viewBox="0 0 512 512"') && svg.includes('data-pathways="1"') && svg.includes('<g id="art">'), `${p.file} is not normalised`);
    if (folder === 'heads') check(svg.includes('id="skin"'), `${p.file} has no skin path for the make-up clip`);
    check(!/<rect[^>]*fill="#fff/i.test(svg), `${p.file} still has a white background`);
  }
}
const ids = Object.values(AVATAR_MANIFEST).flat().map((p) => p.id);
check(new Set(ids).size === ids.length, 'duplicate part ids in the manifest');

// 1b. Every head is measured, and every part lands inside it.
const T = AVATAR_TEMPLATE;
check(T.anchor.lips - T.anchor.nose >= 50, 'the template leaves too little room between nose and mouth');
for (const h of AVATAR_MANIFEST.heads) {
  const f = h.fit;
  if (!f) { check(false, `${h.id} has not been measured`); continue; }
  check(f.top < f.earTop && f.earTop < f.lobe && f.lobe < f.chin + 10 && f.chin < f.neck + 1, `${h.id}: measurements out of order ${JSON.stringify(f)}`);
  check(f.w > 150 && f.w < 340 && f.earL < f.cx - f.w / 2 + 12 && f.earR > f.cx + f.w / 2 - 12 && Math.abs(f.cx - 256) < 8, `${h.id}: implausible width or ears`);
  for (const stage of ['baby', 'toddler', 'kid', 'adult']) {
    const t = fitTransforms(h.id, stage);
    const y = (k) => Number(t[k].match(/translate\(\S+ (\S+)\)/)[1]);
    const sc = Number(t.nose.match(/scale\((\S+)\)/)[1]);
    check(y('eyebrows') < y('eyes') && y('eyes') < y('nose') && y('nose') < y('lips'), `${h.id}/${stage}: features out of order`);
    check(y('eyebrows') > f.top + 40 && y('lips') + 20 * sc < f.chin - 4, `${h.id}/${stage}: features fall outside the face`);
    check(y('lips') - y('nose') - 42 * sc >= 8, `${h.id}/${stage}: nose and mouth touch`); // half the nose box plus half the mouth box
    // With every personal adjustment at its extreme, the face still holds together.
    for (const v of [-2, 2]) {
      const x = fitTransforms(h.id, stage, { eyeGap: v, eyeSize: v, eyeY: v, noseSize: v, lipSize: v });
      const num = (k, re) => Number(x[k].match(re)[1]);
      const big = num('nose', /scale\((\S+)\)/);
      check(num('lips', /translate\(\S+ (\S+)\)/) - num('nose', /translate\(\S+ (\S+)\)/) - 42 * big >= 2, `${h.id}/${stage}: nose and mouth touch at size ${v}`);
      check(num('eyesL', /translate\((-?[\d.]+) 0\)"$/) < 0 === true || v < 0, `${h.id}/${stage}: eyes do not move apart`);
      check(num('eyesL', /translate\(\S+ (\S+)\)/) > f.top + 60, `${h.id}/${stage}: eyes leave the face at ${v}`);
    }
  }
}
const eyesWithWhites = AVATAR_MANIFEST.eyes.filter((e) => /fill:#ffffff/.test(readFileSync(new URL(`assets/avatars/${e.file}`, root), 'utf8'))).length;
check(eyesWithWhites >= AVATAR_MANIFEST.eyes.length - 2, `only ${eyesWithWhites} eye styles have whites`);

check(!CATALOG.eyes.some((e) => e.id === CUR.EXPRESSION.crying), 'crying eyes can be chosen as a resting face');
check(!AVATAR_MANIFEST.heads.some((h) => /^face_0/.test(h.id)) && normalize({ v: 3, inherited: { head: 'face_02_round' } }, 'z').inherited.head === 'head_15_cherubic', 'withdrawn face shapes are not replaced');

// 2. Curated ids.
const curated = [...Object.keys(CUR.HAIR_TYPE), ...Object.values(CUR.RESTING).flat(), ...Object.values(CUR.EXPRESSION), CUR.ELDER_BROWS, CUR.BABY_BROWS, ...Object.values(CUR.OUTFITS).flat(),
  ...CUR.ROYAL.outfits.female, ...CUR.ROYAL.outfits.male, CUR.ROYAL.outfits.baby, ...Object.values(CUR.ROYAL.outfits.monarch),
  ...Object.values(CUR.ROYAL.crowns).flatMap((x) => (typeof x === 'string' ? [x] : Object.values(x))).filter(Boolean),
  ...Object.values(CUR.CAREER_DRESS).flatMap((d) => [d.outfit, d.hat, d.senior?.outfit, d.senior?.hat]).filter(Boolean), CUR.PRISON, CUR.GRADUATION.outfit, CUR.GRADUATION.hat];
for (const id of curated) check(!!PART_BY_ID[id], `curation names a part that does not exist: ${id}`);
for (const h of AVATAR_MANIFEST.hair) if (!/baby/.test(h.id)) check(!!CUR.HAIR_TYPE[h.id], `hairstyle without a texture: ${h.id}`);

// 3. Colours that saves store by id.
const SHIPPED = {
  skin: ['porcelain', 'ivory', 'rose_beige', 'sand', 'golden', 'olive', 'tan', 'bronze', 'chestnut', 'umber', 'espresso', 'ebony'],
  eyeColor: ['dark_brown', 'brown', 'hazel', 'amber', 'green', 'blue', 'gray'],
  hairColor: ['black', 'dark_brown', 'brown', 'light_brown', 'auburn', 'ginger', 'dark_blonde', 'blonde'],
  hairDye: ['black', 'dark_brown', 'brown', 'light_brown', 'auburn', 'ginger', 'dark_blonde', 'blonde', 'platinum', 'silver', 'pink', 'red', 'purple', 'blue', 'teal', 'green'],
  lipColor: ['rose', 'red', 'berry', 'coral', 'nude', 'black'],
  hairTexture: ['straight', 'wavy', 'curly', 'coily'],
};
for (const [key, list] of Object.entries(SHIPPED)) for (const id of list) check(!!part(key, id), `shipped ${key} id removed: ${id}`);

// 4. Loading anything.
const valid = (a, label) => {
  check(a.v === 3, `${label}: not version 3`);
  for (const key of INHERITED_KEYS) check(!!part(key, a.inherited[key]), `${label}: inherited ${key} invalid (${a.inherited[key]})`);
  check(a.style.hair === 'bald' || !!part('hair', a.style.hair), `${label}: hair invalid`);
  for (const key of STYLE_KEYS) if (!['hair', 'jewelry'].includes(key) && a.style[key] != null) check(!!part(key, a.style[key]), `${label}: style ${key} invalid`);
  check(Array.isArray(a.style.jewelry) && Array.isArray(a.inherited.marks), `${label}: lists missing`);
};
const v2 = { v: 2, inherited: { face: 'long', skin: 'umber', eyeShape: 'hooded', eyeColor: 'green', brows: 'sharp_arch', nose: 'aquiline', lips: 'cupid', hairColor: 'auburn',
  hairTexture: 'coily', marks: ['freckles', 'dimples'] }, style: { hair: 'locs', hairDye: 'teal', glasses: 'aviator', facialHair: 'goatee', makeup: 'bold', lipColor: 'berry' } };
const cases = { nothing: undefined, empty: {}, fourNumbers: { skin: 3, hair: 4, eyes: 2, hairStyle: 1 }, v2, unknown: { v: 3, inherited: { head: 'gone', skin: 'nope' }, style: { hair: 'gone', jewelry: ['gone'] } } };
for (const [label, saved] of Object.entries(cases)) {
  const a = normalize(saved, `seed-${label}`);
  valid(a, label);
  check(JSON.stringify(a) === JSON.stringify(normalize(saved, `seed-${label}`)), `${label}: not stable between loads`);
}
const fromV2 = normalize(v2, 'x');
check(fromV2.inherited.skin === 'umber' && fromV2.inherited.eyeColor === 'green' && fromV2.style.hairDye === 'teal' && fromV2.inherited.head === 'head_18_long_rect'
  && fromV2.style.glasses && fromV2.style.facialHair && fromV2.inherited.marks.join() === 'freckles', 'v2 save lost colours, dye, face shape or accessories');
// Two relatives who shared an old nose still share one.
check(normalize({ ...v2 }, 'a').inherited.nose === normalize({ ...v2 }, 'b').inherited.nose, 'old shared nose no longer shared');

// 5. Random faces and families.
let coily = 0, deep = 0;
for (let i = 0; i < 400; i++) {
  const g = i % 2 ? 'female' : 'male';
  const a = randomAppearance(i % 12, g);
  valid(normalize(a, `r${i}`), `random ${i}`);
  check(CUR.RESTING.eyes.includes(a.inherited.eyes) && CUR.RESTING.lips.includes(a.inherited.lips), `random ${i} was given an expression for a resting face`);
  if (i % 12 >= 8) { deep++; if (['coily', 'curly'].includes(a.inherited.hairTexture)) coily++; }
}
check(coily / deep > 0.7, `deep skin tones should mostly have curly or coily hair (${coily}/${deep})`);
for (let i = 0; i < 200; i++) {
  const mum = randomAppearance(rng.int(0, 11), 'female');
  const dad = randomAppearance(rng.int(0, 11), 'male');
  mum.style.hairDye = 'pink'; dad.style.outfit = 'outfit_03_suit';
  const kid = ensureStyled(inheritAppearance(mum, dad), i % 2 ? 'female' : 'male');
  valid(normalize(kid, `k${i}`), `child ${i}`);
  check(kid.style.hairDye == null, 'a parent\'s dye reached a child');
  const before = JSON.stringify(kid);
  mum.style.hair = 'bald'; dad.inherited.skin = 'porcelain';
  check(before === JSON.stringify(kid), 'a child changed when a parent did');
  check(JSON.stringify(cloneAppearance(kid)) === before, 'clone is not a copy');
  // Surgery changes what a parent shows, not what a child inherits.
  mum.style.tweaks = { eyeGap: 2, eyeSize: 2, eyeY: 2, noseSize: -2, lipSize: 2 };
  const born = normalize(mum, 'm').inherited.tweaks;
  const later = inheritAppearance(mum, mum).inherited.tweaks;
  check(Object.keys(born).every((k) => later[k] === born[k]), 'a parent\'s surgery reached a child');
  check(resolveLook(mum, 'm').tweaks.eyeGap === 2, 'surgery does not show on the parent');
  check(Object.entries(kid.inherited.tweaks).every(([k, v]) => v === mum.inherited.tweaks[k] || v === dad.inherited.tweaks[k]), 'a child\'s proportions came from neither parent');
}

// 6. Portraits.
const SITUATIONS = [{}, { jailed: true }, { royal: { rank: 'monarch' } }, { royal: { rank: 'heir' } }, { royal: { rank: 'royal' } }, { royal: { rank: 'noble' } },
  { career: { id: 'police' } }, { career: { id: 'police', level: 5 } }, { career: { id: 'firefighter' } }, { career: { id: 'doctor' } }, { career: { id: 'kitchen' } },
  { mood: 3 }, { emotion: 'emotion_04_love_hearts' }];
for (const age of [0, 1, 3, 7, 12, 15, 30, 49, 55, 66, 80, 101]) {
  for (const [i, s] of SITUATIONS.entries()) {
    const a = randomAppearance(rng.int(0, 11), i % 2 ? 'female' : 'male');
    a.style.hat = i === 0 ? 'hat_01_beanie' : null;
    let svg = '';
    try { svg = avatarSvg({ appearance: a, age, gender: i % 2 ? 'female' : 'male', seed: `p${age}-${i}`, mood: 60, ...s }); } catch (e) { check(false, `portrait threw at ${age} (${JSON.stringify(s)}): ${e.message}`); continue; }
    for (const m of svg.matchAll(/href="\.\/assets\/avatars\/([^"#]+)#(art|skin)"/g)) check(existsSync(new URL(`assets/avatars/${m[1]}`, root)), `portrait uses a missing file ${m[1]}`);
    check(!/undefined|NaN|null/.test(svg), `portrait at ${age} (${JSON.stringify(s)}) has a hole: ${svg.match(/.{40}(undefined|NaN|null).{20}/)?.[0]}`);
    const d = dressFor(resolveLook(a, 'x', 'female'), { age, ...s });
    if (s.jailed) check(d.clothes === CUR.PRISON, 'prisoners are not in prison clothes');
    if (s.royal?.rank === 'monarch' && age >= 13) check(/crown_0[13]/.test(d.crown ?? ''), 'a monarch has no crown');
    if (ageStage(age) === 'baby') check(d.head === 'head_00_baby' && !d.glasses && !d.jewelry.length, 'a baby is wearing grown-up things');
    if (age >= 66) check(d.aging.length >= 2, 'no lines with age');
    if (s.career?.id === 'police' && age >= 18) check(/police|swat/.test(d.clothes) && /police|swat/.test(d.hat ?? ''), 'police are not in uniform');
    check(filesFor(resolveLook(a, 'x'), { age, ...s }).every((f) => existsSync(new URL(f.replace('./', ''), root))), 'filesFor lists a missing file');
  }
}

if (problems.length) {
  console.log([...new Set(problems)].slice(0, 30).join('\n'));
  console.log(`${problems.length} problem(s).`);
  process.exit(1);
}
console.log(`The avatar system is sound: ${ids.length} parts, every save format loads, families hold together.`);
