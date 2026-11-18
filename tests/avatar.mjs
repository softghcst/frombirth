// Checks the avatar system. Run with: node tests/avatar.mjs
//  - every part in the manifest is on disk, normalised, and has the ids the renderer uses
//  - every hand-curated id names a real part
//  - colour ids that have shipped are still present (so existing saves keep their colours)
//  - saves from both earlier avatar systems, missing data and unknown ids all load to a complete, stable face
//  - children are built only from what their parents were born with
//  - portraits render at every age and in every situation, using only files that exist
//  - hair fits every head it can be worn on; faces are framed alike; features read on every skin tone
//  - the eye shapes on offer, and who is given which, are exactly as they were
import { readFileSync, existsSync } from 'node:fs';
import { AVATAR_MANIFEST, PART_BY_ID, AVATAR_TEMPLATE } from '../js/avatarManifest.js';
import { CATALOG, INHERITED_KEYS, STYLE_KEYS, normalize, part, resolveLook } from '../js/avatar/catalog.js';
import { avatarSvg } from '../js/avatar/render.js';
import { dressFor, filesFor, ageStage, fitTransforms, deepness, characterAvatarSvg } from '../js/CharacterAvatar.js';
import { hairFit, fitGaps, crownBare, plainFit, frameFor, FRAME, LIMITS } from '../js/avatar/hairFit.js';
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
    check(svg.includes('viewBox="0 0 512 512"') && svg.includes('data-pathways="1"') && svg.includes('<g id="art">'), `${p.file} is not normalized`);
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
const eyesWithWhites = AVATAR_MANIFEST.eyes.filter((e) => /fill:(var\(--eye-white,)?#ffffff/.test(readFileSync(new URL(`assets/avatars/${e.file}`, root), 'utf8'))).length;
check(eyesWithWhites >= AVATAR_MANIFEST.eyes.length - 2, `only ${eyesWithWhites} eye styles have whites`);

check(!CATALOG.eyes.some((e) => e.id === CUR.EXPRESSION.crying), 'crying eyes can be chosen as a resting face');
check(!AVATAR_MANIFEST.heads.some((h) => /^face_0/.test(h.id)) && normalize({ v: 3, inherited: { head: 'face_02_round' } }, 'z').inherited.head === 'head_15_cherubic', 'withdrawn face shapes are not replaced');

check(AVATAR_MANIFEST.hats.length === 0 && AVATAR_MANIFEST.crowns.length === 8, 'hats should be gone and crowns kept');
for (let i = 0; i < 300; i++) check(!CUR.HAIR_COVERS_FACE.includes(randomAppearance(i % 12, i % 2 ? 'female' : 'male').style.hair), 'a face-covering hairstyle was handed out at random');

// 2. Curated ids.
const curated = [...Object.keys(CUR.HAIR_TYPE), ...Object.values(CUR.RESTING).flat(), ...Object.values(CUR.EXPRESSION), CUR.ELDER_BROWS, CUR.BABY_BROWS, ...Object.values(CUR.OUTFITS).flat(),
  ...CUR.ROYAL.outfits.female, ...CUR.ROYAL.outfits.male, CUR.ROYAL.outfits.baby, ...Object.values(CUR.ROYAL.outfits.monarch),
  ...Object.values(CUR.ROYAL.crowns).flatMap((x) => (typeof x === 'string' ? [x] : Object.values(x))).filter(Boolean),
  ...Object.values(CUR.CAREER_DRESS).flatMap((d) => [d.outfit, d.hat, d.senior?.outfit, d.senior?.hat]).filter(Boolean), CUR.PRISON, CUR.GRADUATION.outfit, ...CUR.HAIR_COVERS_FACE];
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
  && fromV2.style.glasses && fromV2.style.facialHair && fromV2.inherited.marks.join() === 'freckles', 'v2 save lost colors, dye, face shape or accessories');
// Two relatives who shared an old nose still share one.
check(normalize({ ...v2 }, 'a').inherited.nose === normalize({ ...v2 }, 'b').inherited.nose, 'old shared nose no longer shared');
// Women's eyes (lashed, and two more) are given only to women and girls, at random or by inheritance; saved faces are never changed.
{
  const lashed = (x) => x.inherited.eyes in CUR.WOMEN_EYES;
  for (const gender of ['male', 'nonbinary', undefined]) {
    check(!Array.from({ length: 1500 }, () => randomAppearance(undefined, gender)).some(lashed), `random ${gender} characters get lashed eyes`);
  }
  check(Array.from({ length: 600 }, () => randomAppearance(undefined, 'female')).filter(lashed).length > 300, 'women no longer get their eyes at random');
  check(Object.values(CUR.WOMEN_EYES).every((e) => CUR.RESTING.eyes.includes(e) && !(e in CUR.WOMEN_EYES)), 'a son is given eyes that are not one of the men\'s');
  const mum = randomAppearance(3, 'female'); mum.inherited.eyes = 'eyes_16';
  const son = ensureStyled(inheritAppearance(mum, cloneAppearance(mum)), 'male');
  const daughter = ensureStyled(inheritAppearance(mum, cloneAppearance(mum)), 'female');
  check(son.inherited.eyes === 'eyes_9' && daughter.inherited.eyes === 'eyes_16', `a son should take the nearest of the men's eyes to his mother's: son ${son.inherited.eyes}, daughter ${daughter.inherited.eyes}`);
  const saved = cloneAppearance(mum);
  check(ensureStyled(saved, 'male').inherited.eyes === 'eyes_16', 'a saved face had its eyes changed');
}
// Old saves keep the faces they always had (taken from the code before shapes were withdrawn, then moved off withdrawn ones).
const PINNED = { 1: ['eyes_9', 'nose_16', 'lips_9'], 7: ['eyes_16', 'nose_7', 'lips_11'], 42: ['eyes_10', 'nose_12', 'lips_9'], 99: ['eyes_10', 'nose_10', 'lips_9'],
  314: ['eyes_16', 'nose_23', 'lips_9'], 2718: ['eyes_16', 'nose_17', 'lips_4'] };
for (const [i, want] of Object.entries(PINNED)) {
  const got = normalize({ v: 2, inherited: { face: 'oval', eyeShape: 'e' + i, nose: 'n' + i, lips: 'l' + i, brows: 'b' + i, skin: 0 } }, 's' + i).inherited;
  check(['eyes', 'nose', 'lips'].map((k) => got[k]).join() === want.join(), `old save ${i} now has a different face: ${['eyes', 'nose', 'lips'].map((k) => got[k])}`);
}

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
  // Surgery becomes the face: it shows, and children can take after it.
  mum.inherited.tweaks = { eyeGap: 2, eyeSize: 2, eyeY: 2, noseSize: -2, lipSize: 2 };
  check(inheritAppearance(mum, mum).inherited.tweaks.eyeGap === 2 && resolveLook(mum, 'm').tweaks.eyeGap === 2, 'reshaped features are not passed on');
  check(normalize({ v: 3, inherited: {}, style: { tweaks: { eyeGap: 1 } } }, 'q').inherited.tweaks.eyeGap === 1, 'surgery from an earlier save was lost');
}

// 6. Portraits.
const SITUATIONS = [{}, { jailed: true }, { royal: { rank: 'monarch' } }, { royal: { rank: 'heir' } }, { royal: { rank: 'royal' } }, { royal: { rank: 'noble' } },
  { career: { id: 'police' } }, { career: { id: 'police', level: 5 } }, { career: { id: 'firefighter' } }, { career: { id: 'doctor' } },
  { mood: 3 }, { emotion: 'emotion_04_love_hearts' }];
for (const age of [0, 1, 3, 7, 12, 15, 30, 49, 55, 66, 80, 101]) {
  for (const [i, s] of SITUATIONS.entries()) {
    const a = randomAppearance(rng.int(0, 11), i % 2 ? 'female' : 'male');
    let svg = '';
    try { svg = avatarSvg({ appearance: a, age, gender: i % 2 ? 'female' : 'male', seed: `p${age}-${i}`, mood: 60, ...s }); } catch (e) { check(false, `portrait threw at ${age} (${JSON.stringify(s)}): ${e.message}`); continue; }
    for (const m of svg.matchAll(/href="\.\/assets\/avatars\/([^"#]+)#(art|skin)"/g)) check(existsSync(new URL(`assets/avatars/${m[1]}`, root)), `portrait uses a missing file ${m[1]}`);
    check(!/undefined|NaN|null/.test(svg), `portrait at ${age} (${JSON.stringify(s)}) has a hole: ${svg.match(/.{40}(undefined|NaN|null).{20}/)?.[0]}`);
    const d = dressFor(resolveLook(a, 'x', 'female'), { age, ...s });
    if (s.jailed) check(d.clothes === CUR.PRISON, 'prisoners are not in prison clothes');
    if (s.royal?.rank === 'monarch' && age >= 13) check(/crown_0[13]/.test(d.crown ?? ''), 'a monarch has no crown');
    if (ageStage(age) === 'baby') check(d.head === 'head_00_baby' && !d.glasses && !d.jewelry.length, 'a baby is wearing grown-up things');
    if (age >= 66) check(d.aging.length >= 2, 'no lines with age');
    if (s.career?.id === 'police' && age >= 18) check(/police|swat/.test(d.clothes), 'police are not in uniform');
    check(filesFor(resolveLook(a, 'x'), { age, ...s }).every((f) => existsSync(new URL(f.replace('./', ''), root))), 'filesFor lists a missing file');
  }
}

// 7. Hair fits the head. Every hairstyle and head is measured; the fit is worked out from the two.
const hairs = AVATAR_MANIFEST.hair.filter((h) => !/baby/.test(h.id));
const tufts = AVATAR_MANIFEST.hair.filter((h) => /baby/.test(h.id));
const grown = AVATAR_MANIFEST.heads.filter((h) => !/baby|toddler/.test(h.id)); // the heads a hairstyle is worn on: adults, and the kid
const [, , ROWS] = T.profile.rows;
const [, , COLS] = T.profile.cols;
for (const h of AVATAR_MANIFEST.hair) check(h.edge && h.edge.L.length === ROWS && h.edge.R.length === ROWS && h.edge.T.length === COLS && h.edge.O.length === COLS && Number.isFinite(h.edge.top), `${h.id} is not measured`);
for (const h of AVATAR_MANIFEST.heads) check(h.edge && h.edge.L.length === ROWS && h.edge.T.length === COLS, `${h.id} is not measured`);
// Styles drawn with a lock or a sweep that hangs clear of the head on purpose: the gap beside it is the style.
const LOOSE = ['hair_boy_long_11', 'hair_girl_long_04'];
let worstGap = 0;
for (const h of hairs) {
  for (const head of grown) {
    const f = hairFit(h.id, head.id);
    const base = plainFit(head.id);
    check(f === hairFit(h.id, head.id), `${h.id} on ${head.id}: the fit is not the same twice`);
    check(f.sx / base.sx >= LIMITS.scale[0] - 0.005 && f.sx / base.sx <= LIMITS.scale[1] + 0.005 && f.sy / base.sy >= LIMITS.scale[0] - 0.005 && f.sy / base.sy <= LIMITS.scale[1] + 0.005
      && f.ty - base.ty >= -LIMITS.up - 0.5 && f.ty - base.ty <= LIMITS.down + 0.5 && Math.abs(f.tx - base.tx) <= LIMITS.across + 0.5, `${h.id} on ${head.id}: fitted beyond the limits`);
    const g = fitGaps(h.id, head.id);
    if (!LOOSE.includes(h.id)) {
      worstGap = Math.max(worstGap, g.side, g.top);
      check(g.side <= 2 && g.top <= 2, `${h.id} on ${head.id}: background shows between hair and scalp (${g.side} at the side, ${g.top} over the crown)`);
    }
    // No fit may bare a scalp the style covered as drawn.
    check(crownBare(h.id, head.id) <= Math.max(0, crownBare(h.id, head.id, base)) + 1, `${h.id} on ${head.id}: the fit bares the top of the head`);
    // A tall style stays inside the picture.
    const top = f.line - (f.line - (f.ty + f.sy * (h.edge.top - T.face.top))) * f.squash;
    check(f.squash >= 0.62 && (f.squash < 1 || top >= frameFor(head.id).y - 1), `${h.id} on ${head.id}: wrongly flattened`);
  }
}
// A short style and a tall one, on every head: placed, and placed the same way each time.
for (const id of ['hair_boy_short_07', 'hair_boy_updo_15_headband_puff', 'hair_updo_07']) {
  for (const head of grown) {
    const f = hairFit(id, head.id);
    const hairline = Math.min(...PART_BY_ID[id].edge.T.slice(13, 20).filter((v) => v != null));
    const y = f.ty + f.sy * (hairline - T.face.top);
    check(y >= head.fit.top && y <= head.fit.top + (head.fit.chin - head.fit.top) * 0.45, `${id} on ${head.id}: the hairline is off the forehead (${Math.round(y)})`);
  }
}
check(hairFit('hair_boy_updo_15_headband_puff', 'head_18_long_rect').squash < 1 && hairFit('hair_boy_short_07', 'head_18_long_rect').squash === 1, 'only a tall style is flattened to fit the picture');
// The two repaired files, and the stray marks, stay repaired.
for (const id of ['hair_boy_medium_11', 'hair_girl_long_11']) check(readFileSync(new URL(`assets/avatars/${PART_BY_ID[id].file}`, root), 'utf8').includes('data-refit="1"'), `${id} has lost its repair`);
check(fitGaps('hair_boy_medium_11', 'head_00_kid').top <= 2 && fitGaps('hair_boy_medium_03', 'head_00_kid').top <= 2, 'the arch styles show background over the forehead again');
// A baby's tuft is left where it was put.
for (const h of tufts) for (const head of ['head_00_baby', 'head_00_toddler']) check(JSON.stringify(hairFit(h.id, head)) === JSON.stringify(plainFit(head)), `${h.id} on ${head}: a baby's hair was refitted`);
// The reference faces: hair that already sat well is left very nearly as drawn.
const REFERENCES = { asel: ['hair_updo_03', 'head_15_cherubic'], zhi: ['hair_boy_medium_09', 'head_16_angular'], mehmet: ['hair_boy_updo_03_curly_puff', 'head_16_angular'], yoselin: ['hair_girl_long_02', 'head_17_dimple_oval'] };
for (const [who, [hair, head]] of Object.entries(REFERENCES)) {
  const f = hairFit(hair, head);
  const base = plainFit(head);
  check(Math.abs(f.sx / base.sx - 1) <= 0.1 && Math.abs(f.sy / base.sy - 1) <= 0.1 && Math.abs(f.ty - base.ty) <= 18, `${who}: a reference look was moved a long way (${JSON.stringify(f)})`);
  check(fitGaps(hair, head).side <= 2 && fitGaps(hair, head).top <= 2, `${who}: a reference look has a gap`);
}

// 8. Framing. Adults fill much the same share of a portrait, with eyes on the same line; children keep their own size.
const adults = AVATAR_MANIFEST.heads.filter((h) => h.tags?.age === 'adult');
const share = (h, fr) => h.fit.w * (h.fit.chin - h.fit.top) / (fr.size * fr.size);
const eyeLine = (h, fr) => (h.fit.top + (T.anchor.eyes - T.face.top) * (h.fit.chin - h.fit.top) / (T.face.chin - T.face.top) - fr.y) / fr.size;
const spread = (xs) => Math.max(...xs) / Math.min(...xs);
check(spread(adults.map((h) => share(h, frameFor(h.id)))) < spread(adults.map((h) => share(h, FRAME))) - 0.05, 'adult faces are not brought closer in size');
check(spread(adults.map((h) => share(h, frameFor(h.id)))) <= 1.08, `adult faces differ too much in size (${spread(adults.map((h) => share(h, frameFor(h.id)))).toFixed(3)})`);
check(Math.max(...adults.map((h) => eyeLine(h, frameFor(h.id)))) - Math.min(...adults.map((h) => eyeLine(h, frameFor(h.id)))) < 0.002, 'adult eyes are not on one line');
check(adults.every((h) => Math.abs(frameFor(h.id).x + frameFor(h.id).size / 2 - h.fit.cx) < 0.1), 'an adult face is not centred');
for (const id of ['head_00_baby', 'head_00_toddler', 'head_00_kid']) check(frameFor(id) === FRAME, `${id} should keep the plain picture`);
check(share(PART_BY_ID.head_00_toddler, FRAME) > share(PART_BY_ID.head_00_kid, FRAME), 'a toddler\'s head should be bigger in the picture than a child\'s');
// Hair height does not move or resize the face: the same head has the same picture whatever is on it.
const framed = (hair, age) => avatarSvg({ appearance: { v: 3, inherited: { head: 'head_17_dimple_oval', skin: 'tan' }, style: { hair } }, seed: 'frame', age }).match(/viewBox="([^"]+)"/)[1];
check(framed('hair_boy_short_07', 30) === framed('hair_updo_07', 30) && framed('bald', 30) === framed('hair_updo_07', 30), 'the picture changes with the hairstyle');
check(framed('hair_boy_short_07', 3) === `${FRAME.x} ${FRAME.y} ${FRAME.size} ${FRAME.size}` && framed('hair_boy_short_07', 9) === framed('hair_boy_short_07', 3), 'a child\'s picture is not the plain one');
// One person is drawn the same on every screen: screens differ only in the size they show it at.
{
  const who = { appearance: randomAppearance(9, 'female'), seed: 'same', age: 34, gender: 'female', mood: 60 };
  const strip = (svg) => svg.replace(/pw-[a-z]+-\d+/g, 'id').replace(/ (width|height)="\d+"/g, '');
  check(strip(avatarSvg(who)) === strip(avatarSvg({ ...who, size: 42 })) && strip(avatarSvg(who)) === strip(avatarSvg({ ...who, size: 96, label: undefined })), 'the same person is drawn differently at different sizes');
}

// 9. Features read on every skin tone. Light faces are untouched; deep ones get softer whites and firmer features.
const tone = (id) => part('skin', id).hex;
check(['porcelain', 'ivory', 'rose_beige', 'sand', 'golden', 'olive', 'tan'].every((id) => deepness(tone(id)) === 0), 'a light skin tone is being adjusted');
check(deepness(tone('ebony')) === 1 && deepness(tone('espresso')) > 0.9 && deepness(tone('chestnut')) > 0 && deepness(tone('chestnut')) < deepness(tone('umber')), 'deep skin tones are not adjusted in step with their depth');
{
  const face = (skin) => avatarSvg({ appearance: { v: 3, inherited: { head: 'head_17_dimple_oval', skin, eyes: 'eyes_10', eyeColor: 'brown', brows: 'brows_10', nose: 'nose_10', lips: 'lips_6', hairColor: 'black', hairTexture: 'coily', marks: [] },
    style: { hair: 'hair_boy_short_07', jewelry: [], outfit: 'outfit_01_tee' } }, seed: 'tone', age: 30 });
  const light = face('sand');
  const deep = face('ebony');
  const parts = (svg) => [...svg.matchAll(/href="([^"#]+)#art"/g)].map((m) => m[1]).join(' ');
  const places = (svg) => [...svg.matchAll(/transform="([^"]+)"/g)].map((m) => m[1]).join(' ');
  check(parts(light) === parts(deep) && places(light) === places(deep), 'the same features are not the same shapes in the same places on a deeper skin tone');
  check(!/eye-white|stroke/.test(light), 'a light face has been given extra weight');
  check(/--eye-white:#[0-9a-f]{6}/.test(deep) && /--line-width/.test(deep), 'a deep face has not been made more readable');
  // Brows are drawn as they are on every tone: no light edge around them.
  for (const svg of [light, deep]) check(!/<use href="[^"]*brows\/[^"]*"[^>]*style=/.test(svg) && !/paint-order/.test(svg), 'the brows have been given an edge');
  check(deep.includes(`--skin-color:${tone('ebony')}`), 'the skin tone itself was changed');
  // The nose is the skin itself: on every tone its skin is the face's. On deeper tones only its lines are heavier.
  for (const t of part('skin', 'porcelain') ? CATALOG.skin : []) {
    const svg = face(t.id);
    const nose = svg.match(/<use href="[^"]*noses\/[^"]*"([^>]*)\/>/)?.[1] ?? '';
    check(!/--skin-color|stroke:|fill/.test(nose), `the nose looks different from the face on ${t.id} skin`);
    check(deepness(t.hex) ? /--line-width:[\d.]+/.test(nose) : !/style=/.test(nose), `${t.id}: the nose's lines are ${deepness(t.hex) ? 'not made heavier' : 'changed on a light tone'}`);
    check((svg.match(/--skin-color:/g) ?? []).length === 1, `${t.id}: something sets its own skin colour`);
  }
  // Eyes and mouths: only the outline gets heavier. A stroke on the whole part would ring the whites, highlights,
  // irises and teeth, so the part itself carries no stroke, and each drawing has exactly one shade that takes it.
  for (const use of deep.matchAll(/<use href="[^"]*(?:eyes|lips)\/[^"]*"([^>]*)\/>/g)) check(!/stroke:/.test(use[1]), 'a stroke on a whole eye or mouth');
  check(/--line-width:[\d.]+/.test(deep.match(/<use href="[^"]*eyes\/[^"]*"([^>]*)\/>/)?.[1] ?? ''), 'deep eyes are not given heavier lines');
  for (const key of ['eyes', 'lips']) for (const p of CATALOG[key]) {
    const art = readFileSync(new URL(`assets/avatars/${PART_BY_ID[p.id].file}`, root), 'utf8');
    const lined = new Set([...art.matchAll(/fill:(#[0-9a-f]{6});stroke:var\(--line-ink/g)].map((m) => m[1]));
    check(lined.size === 1, `${p.id}: ${lined.size} shades take the heavier line, not just its outline`);
  }
  const white = deep.match(/--eye-white:(#[0-9a-f]{6})/)[1];
  check(parseInt(white.slice(1, 3), 16) >= 0xd0, `the white of the eye is no longer white (${white})`);
}

// 10. The faces on offer: the withdrawn eyes, mouths and noses are gone, saves that used them land on the nearest kept,
// and the rest are offered and drawn at random exactly as before.
const EYES = ['eyes_10', 'eyes_14', 'eyes_16', 'eyes_18', 'eyes_19', 'eyes_20', 'eyes_24', 'eyes_25', 'eyes_26', 'eyes_7', 'eyes_8', 'eyes_9'];
check(AVATAR_MANIFEST.eyes.map((e) => e.id).join() === EYES.join(), 'the eye shapes in the manifest have changed');
check(CATALOG.eyes.map((e) => e.id).join() === EYES.filter((id) => id !== 'eyes_14').join(), 'the eye shapes on offer have changed');
check(CUR.RESTING.eyes.join() === 'eyes_8,eyes_9,eyes_10,eyes_16,eyes_18,eyes_19,eyes_25', 'the eyes given out at random have changed');
for (const [key, folder] of [['eyes', 'eyes'], ['lips', 'lips'], ['nose', 'noses']]) {
  for (const [gone, kept] of Object.entries(CUR.WITHDRAWN[key])) {
    check(!PART_BY_ID[gone] && !existsSync(new URL(`assets/avatars/${folder}/${gone}.svg`, root)), `${gone} is still in the game`);
    check(!!PART_BY_ID[kept] && !CUR.WITHDRAWN[key][kept], `${gone} is replaced by ${kept}, which is not a kept shape`);
    const a = normalize({ v: 3, inherited: { [key]: gone } }, `saved-${gone}`);
    check(a.inherited[key] === kept && normalize(a, 'again').inherited[key] === kept, `a save with ${gone} does not land on ${kept}`);
  }
  for (const id of CUR.RESTING[{ eyes: 'eyes', lips: 'lips', nose: 'noses' }[key]]) check(!CUR.WITHDRAWN[key][id] && !!PART_BY_ID[id], `${id} is given out at random but is not a kept shape`);
}
check(!AVATAR_MANIFEST.lips.some((l) => ['lips_1', 'lips_3', 'lips_12', 'lips_13', 'lips_15', 'lips_16', 'lips_19'].includes(l.id)), 'a mouth drawn as a single line is still offered');
check(/data-teeth="1"/.test(readFileSync(new URL('assets/avatars/lips/lips_21.svg', root), 'utf8')) && /<g id="art"><path style="fill:#ffffff"/.test(readFileSync(new URL('assets/avatars/lips/lips_21.svg', root), 'utf8')), 'lips_21 has no white teeth behind its outline');
check(CATALOG.lips.some((l) => l.id === 'lips_21') && PART_BY_ID[CUR.EXPRESSION.grin] && PART_BY_ID[CUR.EXPRESSION.laughing], 'an expression names a withdrawn mouth');
// Faces converted from the earlier avatar system land where they always did, moved off anything withdrawn.
{
  const old = (shape) => normalize({ v: 2, inherited: { eyeShape: shape, nose: shape, lips: shape }, style: {} }, 'v2').inherited;
  const a = old('hooded');
  check(JSON.stringify(a) === JSON.stringify(old('hooded')) && !CUR.WITHDRAWN.eyes[a.eyes] && !CUR.WITHDRAWN.nose[a.nose] && !CUR.WITHDRAWN.lips[a.lips], 'an older save converts to a withdrawn shape, or differently each time');
}
{
  // Women draw on every resting eye shape evenly; men only on the men's eyes.
  rng.seed(7);
  for (const gender of ['female', 'male']) {
    const seen = {};
    for (let i = 0; i < 4000; i++) { const e = randomAppearance(i % 12, gender).inherited.eyes; seen[e] = (seen[e] ?? 0) + 1; }
    const want = CUR.RESTING.eyes.filter((e) => gender === 'female' || !(e in CUR.WOMEN_EYES));
    check(Object.keys(seen).sort().join() === [...want].sort().join(), `random ${gender} faces draw on a different set of eyes`);
    check(Math.max(...Object.values(seen)) / Math.min(...Object.values(seen)) < 1.5, 'some eye shapes are now given out more often than others');
  }
}

// 11. A saved face keeps its head, hair and eyes, and is drawn with those files.
{
  const saved = JSON.parse(JSON.stringify({ v: 3, inherited: { head: 'head_18_long_rect', skin: 'umber', eyes: 'eyes_25', eyeColor: 'hazel', brows: 'brows_14', nose: 'nose_17', lips: 'lips_12', hairColor: 'black', hairTexture: 'coily', marks: [], tweaks: { eyeGap: 1 } },
    style: { hair: 'hair_boy_updo_15_headband_puff', jewelry: [], outfit: 'outfit_22_denim' } }));
  const a = normalize(saved, 'npc_saved');
  check(a.inherited.head === 'head_18_long_rect' && a.style.hair === 'hair_boy_updo_15_headband_puff' && a.inherited.eyes === 'eyes_25' && a.inherited.tweaks.eyeGap === 1, 'a saved face lost its head, hair or eyes');
  const svg = avatarSvg({ appearance: saved, seed: 'npc_saved', age: 40 });
  for (const f of ['heads/head_18_long_rect.svg', 'hair/hair_boy_updo_15_headband_puff.svg', 'eyes/eyes_25.svg']) check(svg.includes(f), `a saved face is not drawn with ${f}`);
  check(JSON.stringify(saved.inherited.tweaks) === '{"eyeGap":1}', 'drawing a face changed what was saved');
  // A face made today and one loaded from a save are fitted by the same rule.
  const fresh = randomAppearance(8, 'male');
  const again = JSON.parse(JSON.stringify(fresh));
  check(avatarSvg({ appearance: fresh, seed: 'f', age: 30 }).replace(/pw-[a-z]+-\d+/g, '') === avatarSvg({ appearance: again, seed: 'f', age: 30 }).replace(/pw-[a-z]+-\d+/g, ''), 'a saved copy of a face is drawn differently');
}

// 12. Layers: the mouth over a beard, lines of age kept on the face, front hair cut at the chin.
{
  const look = resolveLook({ v: 3, inherited: { head: 'head_13_athletic', skin: 'golden' }, style: { hair: 'hair_girl_long_04', facialHair: 'facial_hair_04_bushy_full_beard' } }, 'layers', 'male');
  const svg = characterAvatarSvg(look, { age: 70, gender: 'male' });
  check(svg.indexOf(PART_BY_ID[look.lips].file) > svg.indexOf('facial_hair_04_bushy_full_beard'), 'a beard is drawn over the mouth');
  check(/<g clip-path="url\(#pw-face-\d+\)"><use href="[^"]*aging/.test(svg), 'lines of age are not kept to the face');
  const cut = Number(svg.match(/<clipPath id="pw-front-\d+"><rect x="-400" y="-2000" width="1312" height="(\d+)"/)[1]) - 2000;
  const f = hairFit('hair_girl_long_04', 'head_13_athletic');
  check(Math.abs(f.ty + f.sy * (cut - T.face.top) - (PART_BY_ID.head_13_athletic.fit.chin - 2)) <= 1.5, 'hair in front of the face does not end at the chin');
}

if (problems.length) {
  console.log([...new Set(problems)].slice(0, 30).join('\n'));
  console.log(`${problems.length} problem(s).`);
  process.exit(1);
}
console.log(`The avatar system is sound: ${ids.length} parts, every save format loads, families hold together; ${hairs.length} hairstyles fit ${grown.length} heads (widest gap ${worstGap}).`);
