// Checks the avatar system. Run with: node tests/avatar.mjs
//  - every part in the manifest is on disk, normalized, and has the ids the renderer uses
//  - every hand-curated id names a real part
//  - color ids that have shipped are still present (so existing saves keep their colors)
//  - saves from both earlier avatar systems, missing data and unknown ids all load to a complete, stable face
//  - children are built only from what their parents were born with
//  - portraits render at every age and in every situation, using only files that exist
//  - hair fits every head it can be worn on; faces are framed alike; features read on every skin tone
//  - the eye shapes on offer, and who is given which, are exactly as they were
//  - every nose is clear of every pair of eyes on every face shape
//  - the lid creases of eyes are soft shades of the skin, clear of the eye and of the brows above
//  - every mouth sits well under every nose (as fitted to every pair of eyes) on every face shape
import { readFileSync, existsSync } from 'node:fs';
import { AVATAR_MANIFEST, PART_BY_ID, AVATAR_TEMPLATE } from '../js/avatarManifest.js';
import { CATALOG, INHERITED_KEYS, STYLE_KEYS, normalize, part, resolveLook, SKIN_TONES as TONES, DEPTH as SKIN_DEPTH } from '../js/avatar/catalog.js';
import { avatarSvg } from '../js/avatar/render.js';
import { dressFor, filesFor, ageStage, fitTransforms, deepness, characterAvatarSvg } from '../js/CharacterAvatar.js';
import { hairFit, fitGaps, crownBare, plainFit, frameFor, FRAME, LIMITS } from '../js/avatar/hairFit.js';
import { randomAppearance, inheritAppearance, ensureStyled, cloneAppearance } from '../js/avatar/inherit.js';
import { noseFit, noseGap, NOSE_FIT, mouthFit, LIP_FIT } from '../js/avatar/featureFit.js';
import * as CUR from '../js/avatar/curation.js';
import { rng } from '../js/rng.js';

rng.seed(20240611);
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
const root = new URL('../', import.meta.url);

// 1. The artwork.
for (const [folder, list] of Object.entries(AVATAR_MANIFEST)) {
  for (const p of list) {
    const file = new URL(`assets/${p.file}`, root);
    if (!existsSync(file)) { check(false, `missing file ${p.file}`); continue; }
    const svg = readFileSync(file, 'utf8');
    check(svg.includes('viewBox="0 0 512 512"') && svg.includes('data-pathways="1"') && svg.includes('<g id="art">'), `${p.file} is not normalized`);
    if (folder === 'heads') check(svg.includes('id="skin"'), `${p.file} has no skin path for the make-up clip`);
    if (folder === 'heads') {
      // No straight edge runs across a head: two pieces of a path meeting edge to edge show as a hairline across the
      // face in Safari (scripts/unify_head_necks.mjs stitches the head to the shared neck so they never do).
      for (const d of [...svg.matchAll(/ d="([^"]*)"/g)].map((m) => m[1])) {
        const pts = [...d.matchAll(/([MLQZ])([^MLQZ]*)/g)].map(([, c, a]) => [c, a.trim().split(/[ ,]+/).filter(Boolean).map(Number)]);
        let pos = null, start = null, longest = 0;
        for (const [c, a] of pts) {
          const p = c === 'Z' ? start : a.length ? a.slice(-2) : null;
          if (c === 'M') { pos = start = p; continue; }
          if (p && pos && Math.abs(p[1] - pos[1]) < 0.01 && pos[1] > 180 && pos[1] < 500) longest = Math.max(longest, Math.abs(p[0] - pos[0]));
          pos = p;
        }
        check(longest < 40, `${p.file} has a straight edge ${longest.toFixed(0)} long across the head (a seam)`); // a square jaw is flat for about 20
      }
    }
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
  // Each stage on the heads it is drawn on: a baby, toddler or child always has a young head (STAGE_HEAD), a grown-up their own.
  for (const stage of h.id.startsWith('head_00') ? ['baby', 'toddler', 'kid', 'adult'] : ['adult']) {
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
const eyesWithWhites = AVATAR_MANIFEST.eyes.filter((e) => /fill:(var\(--eye-white,)?#ffffff/.test(readFileSync(new URL(`assets/${e.file}`, root), 'utf8'))).length;
check(eyesWithWhites >= AVATAR_MANIFEST.eyes.length - 2, `only ${eyesWithWhites} eye styles have whites`);

check(!CATALOG.eyes.some((e) => e.id === CUR.EXPRESSION.crying), 'crying eyes can be chosen as a resting face');
check(!AVATAR_MANIFEST.heads.some((h) => /^face_0/.test(h.id)) && normalize({ v: 3, inherited: { head: 'face_02_round' } }, 'z').inherited.head === 'head_15_cherubic', 'withdrawn face shapes are not replaced');
check(!AVATAR_MANIFEST.heads.some((h) => h.id === 'head_18_long_rect') && normalize({ v: 3, inherited: { head: 'head_18_long_rect' } }, 'z').inherited.head === 'head_12_sculpted', 'the withdrawn Rect face is not replaced by Sculpted');

check(AVATAR_MANIFEST.hats.length === 0 && AVATAR_MANIFEST.crowns.length === 17, 'hats should be gone and crowns kept');
for (let i = 0; i < 300; i++) check(!CUR.HAIR_COVERS_FACE.includes(randomAppearance(i % 12, i % 2 ? 'female' : 'male').style.hair), 'a face-covering hairstyle was handed out at random');

// 2. Curated ids.
const curated = [...Object.keys(CUR.HAIR_TYPE), ...Object.values(CUR.RESTING).flat(), ...Object.values(CUR.EXPRESSION), CUR.ELDER_BROWS, CUR.BABY_BROWS, ...Object.values(CUR.OUTFITS).flat(),
  ...CUR.ROYAL.outfits.female, ...CUR.ROYAL.outfits.male, ...CUR.ROYAL.outfits.baby, ...Object.values(CUR.ROYAL.outfits.monarch).flat(), ...Object.values(CUR.ROYAL.outfits.noble).flat(), ...Object.values(CUR.ROYAL.outfits.nobleByTitle).flatMap((x) => Object.values(x).flat()),
  ...Object.values(CUR.ROYAL.crowns).flatMap((x) => (typeof x === 'string' ? [x] : Object.values(x))).filter(Boolean),
  ...Object.values(CUR.CAREER_DRESS).flatMap((d) => [d.outfit, d.hat, d.senior?.outfit, d.senior?.hat]).filter(Boolean), ...[CUR.PRISON, CUR.GRADUATION.outfit].filter(Boolean), ...CUR.HAIR_COVERS_FACE];
for (const id of curated) check(!!PART_BY_ID[id], `curation names a part that does not exist: ${id}`);
for (const h of AVATAR_MANIFEST.hair) if (!/baby/.test(h.id)) check(!!CUR.HAIR_TYPE[h.id], `hairstyle without a texture: ${h.id}`);

// 3. Colors that saves store by id.
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
check(fromV2.inherited.skin === 'umber' && fromV2.inherited.eyeColor === 'green' && fromV2.style.hairDye === 'teal' && fromV2.inherited.head === 'head_12_sculpted'
  && fromV2.style.glasses && fromV2.inherited.marks.join() === 'freckles', 'v2 save lost colors, dye, face shape or accessories');
// The old facial hair is gone: a beard in an old save is dropped, and no one is drawn with one. Beards come back only
// as new artwork (assets/avatars/facial_hair/), chosen at the barbershop (style.beard).
check(!('facialHair' in fromV2.style) && !('facialHair' in normalize({ v: 3, inherited: {}, style: { facialHair: 'facial_hair_04_bushy_full_beard' } }, 'y').style), 'an old save still has facial hair');
check(!CATALOG.facialHair && !STYLE_KEYS.includes('facialHair') && CATALOG.beard.length === (AVATAR_MANIFEST.facial_hair ?? []).length, 'the old facial hair can still be chosen');
for (let i = 0; i < 200; i++) { const st = randomAppearance(0.5, 'male').style; check(!('facialHair' in st) && !st.beard, 'a new man is given facial hair'); }
// Two relatives who shared an old nose still share one.
check(normalize({ ...v2 }, 'a').inherited.nose === normalize({ ...v2 }, 'b').inherited.nose, 'old shared nose no longer shared');
// Old saves keep the faces they always had (taken from the code before shapes were withdrawn, then moved off withdrawn ones).
const PINNED = { 1: ['eyes_9', 'nose_16', 'lips_9'], 7: ['eyes_22', 'nose_7', 'lips_11'], 42: ['eyes_10', 'nose_12', 'lips_9'], 99: ['eyes_10', 'nose_10', 'lips_9'],
  314: ['eyes_16', 'nose_23', 'lips_9'], 2718: ['eyes_16', 'nose_17', 'lips_4'] };
for (const [i, want] of Object.entries(PINNED)) {
  const got = normalize({ v: 2, inherited: { face: 'oval', eyeShape: 'e' + i, nose: 'n' + i, lips: 'l' + i, brows: 'b' + i, skin: 0 } }, 's' + i).inherited;
  check(['eyes', 'nose', 'lips'].map((k) => got[k]).join() === want.join(), `old save ${i} now has a different face: ${['eyes', 'nose', 'lips'].map((k) => got[k])}`);
}

// 5. Random faces and families.
let coily = 0, deep = 0;
for (let i = 0; i < 400; i++) {
  const g = i % 2 ? 'female' : 'male';
  const a = randomAppearance(i % TONES.length, g);
  valid(normalize(a, `r${i}`), `random ${i}`);
  check((CUR.RESTING.eyes.includes(a.inherited.eyes) || /^eyes_[fm]_/.test(a.inherited.eyes)) && CUR.RESTING[g === 'male' ? 'lipsMasc' : 'lips'].includes(a.inherited.lips), `random ${i} was given an expression for a resting face, or a mouth for the other gender`);
  if (i % TONES.length >= SKIN_DEPTH.chestnut) { deep++; if (['coily', 'curly'].includes(a.inherited.hairTexture)) coily++; }
}
check(coily / deep > 0.7, `deep skin tones should mostly have curly or coily hair (${coily}/${deep})`);
for (let i = 0; i < 200; i++) {
  const mom = randomAppearance(rng.int(0, 11), 'female');
  const dad = randomAppearance(rng.int(0, 11), 'male');
  mom.style.hairDye = 'pink'; dad.style.outfit = 'outfit_57_polo_shirt';
  const kid = ensureStyled(inheritAppearance(mom, dad), i % 2 ? 'female' : 'male');
  valid(normalize(kid, `k${i}`), `child ${i}`);
  check(kid.style.hairDye == null, 'a parent\'s dye reached a child');
  const before = JSON.stringify(kid);
  mom.style.hair = 'bald'; dad.inherited.skin = 'porcelain';
  check(before === JSON.stringify(kid), 'a child changed when a parent did');
  check(JSON.stringify(cloneAppearance(kid)) === before, 'clone is not a copy');
  // Surgery becomes the face: it shows, and children can take after it.
  mom.inherited.tweaks = { eyeGap: 2, eyeSize: 2, eyeY: 2, noseSize: -2, lipSize: 2 };
  check(inheritAppearance(mom, mom).inherited.tweaks.eyeGap === 2 && resolveLook(mom, 'm').tweaks.eyeGap === 2, 'reshaped features are not passed on');
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
    for (const m of svg.matchAll(/href="\.\/assets\/([^"#]+)#(art|skin)"/g)) check(existsSync(new URL(`assets/${m[1]}`, root)), `portrait uses a missing file ${m[1]}`);
    check(!/undefined|NaN|null/.test(svg), `portrait at ${age} (${JSON.stringify(s)}) has a hole: ${svg.match(/.{40}(undefined|NaN|null).{20}/)?.[0]}`);
    const d = dressFor(resolveLook(a, 'x', 'female'), { age, ...s });
    // Prison clothes and work uniforms are being redrawn: until then, a prisoner or a police officer wears their own clothes.
    if (s.jailed && CUR.PRISON) check(d.clothes === CUR.PRISON, 'prisoners are not in prison clothes');
    if (s.royal?.rank === 'monarch' && age >= 13) check(/crown_0[13]/.test(d.crown ?? ''), 'a monarch has no crown');
    if (ageStage(age) === 'baby') check(d.head === 'head_00_toddler' && d.pacifier && !d.glasses && !d.jewelry.length, 'a baby is wearing grown-up things, or has no binky');
    if (ageStage(age) !== 'baby') check(!d.pacifier, `a ${age}-year-old still has a binky`);
    if (age >= 66) check(d.aging.length >= 2, 'no lines with age');
    if (CUR.CAREER_DRESS.police && s.career?.id === 'police' && age >= 18) check(/police|swat/.test(d.clothes), 'police are not in uniform');
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
check(hairFit('hair_boy_updo_15_headband_puff', 'head_12_sculpted').squash < 1 && hairFit('hair_boy_short_07', 'head_12_sculpted').squash === 1, 'only a tall style is flattened to fit the picture');
// The two repaired files, and the stray marks, stay repaired.
for (const id of ['hair_boy_medium_11', 'hair_girl_long_11']) check(readFileSync(new URL(`assets/${PART_BY_ID[id].file}`, root), 'utf8').includes('data-refit="1"'), `${id} has lost its repair`);
check(fitGaps('hair_boy_medium_11', 'head_00_kid').top <= 2 && fitGaps('hair_boy_medium_03', 'head_00_kid').top <= 2, 'the arch styles show background over the forehead again');
// A baby's tuft is left where it was put.
for (const h of tufts) for (const head of ['head_00_toddler']) check(JSON.stringify(hairFit(h.id, head)) === JSON.stringify(plainFit(head)), `${h.id} on ${head}: a baby's hair was refitted`);
// The reference faces: hair that already sat well is left very nearly as drawn.
const REFERENCES = { asel: ['hair_updo_03', 'head_15_cherubic'], zhi: ['hair_boy_medium_09', 'head_16_angular'], mehmet: ['hair_boy_updo_03_curly_puff', 'head_16_angular'], yoselin: ['hair_girl_long_13', 'head_17_dimple_oval'] };
for (const [who, [hair, head]] of Object.entries(REFERENCES)) {
  check(!!PART_BY_ID[hair], `${who}: the reference hairstyle ${hair} is not in the game`);
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
check(adults.every((h) => Math.abs(frameFor(h.id).x + frameFor(h.id).size / 2 - h.fit.cx) < 0.1), 'an adult face is not centered');
for (const id of ['head_00_toddler', 'head_00_kid']) check(frameFor(id) === FRAME, `${id} should keep the plain picture`);
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

// 9. Features read on every skin tone. Light faces are untouched; deep ones get softer whites and firmer lines; the brows are never outlined.
const tone = (id) => part('skin', id).hex;
check(['porcelain', 'ivory', 'rose_beige', 'sand', 'golden', 'olive', 'tan'].every((id) => deepness(tone(id)) === 0), 'a light skin tone is being adjusted');
check(deepness(tone('ebony')) === 1 && deepness(tone('espresso')) > 0.9 && deepness(tone('chestnut')) > 0 && deepness(tone('chestnut')) < deepness(tone('umber')), 'deep skin tones are not adjusted in step with their depth');
{
  const face = (skin) => avatarSvg({ appearance: { v: 3, inherited: { head: 'head_17_dimple_oval', skin, eyes: 'eyes_10', eyeColor: 'brown', brows: 'brows_10', nose: 'nose_10', lips: 'lips_6', hairColor: 'black', hairTexture: 'coily', marks: [] },
    style: { hair: 'hair_boy_short_07', jewelry: [], outfit: 'outfit_57_polo_shirt' } }, seed: 'tone', age: 30 });
  const light = face('sand');
  const deep = face('ebony');
  const parts = (svg) => [...svg.matchAll(/href="([^"#]+)#art"/g)].map((m) => m[1]).join(' ');
  const places = (svg) => [...svg.matchAll(/transform="([^"]+)"/g)].map((m) => m[1]).join(' ');
  check(parts(light) === parts(deep) && places(light) === places(deep), 'the same features are not the same shapes in the same places on a deeper skin tone');
  check(!/eye-white|stroke/.test(light.replace(/--hair-stroke:[^;"]*;?/, '')), 'a light face has been given extra weight'); // --hair-stroke is the hair outline's color, on every face
  check(/--eye-white:#[0-9a-f]{6}/.test(deep) && /--line-width:/.test(deep), 'a deep face has not been made more readable');
  // The brows are drawn as they are on every tone: no light edge (it read as a white outline on deep skin).
  check(!/eyebrows\/[^"]+#art"[^>]*stroke/.test(deep), 'the brows on a deep face have an outline');
  check(deep.includes(`--skin-color:${tone('ebony')}`), 'the skin tone itself was changed');
  // The nose is the skin itself: on every tone its skin is the face's. On deeper tones only its lines are heavier.
  for (const t of part('skin', 'porcelain') ? CATALOG.skin : []) {
    const svg = face(t.id);
    const nose = svg.match(/<use href="[^"]*noses\/[^"]*"([^>]*)\/>/)?.[1] ?? '';
    check(!/--skin-color|stroke:|fill/.test(nose), `the nose looks different from the face on ${t.id} skin`);
    check(deepness(t.hex) ? /--line-width:[\d.]+/.test(nose) : !/style=/.test(nose), `${t.id}: the nose's lines are ${deepness(t.hex) ? 'not made heavier' : 'changed on a light tone'}`);
    check((svg.match(/--skin-color:/g) ?? []).length === 1, `${t.id}: something sets its own skin color`);
  }
  // Eyes and mouths: only the outline gets heavier. A stroke on the whole part would ring the whites, highlights,
  // irises and teeth, so the part itself carries no stroke, and each drawing has exactly one shade that takes it.
  for (const use of deep.matchAll(/<use href="[^"]*(?:eyes|lips)\/[^"]*"([^>]*)\/>/g)) check(!/stroke:/.test(use[1]), 'a stroke on a whole eye or mouth');
  check(/--line-width:[\d.]+/.test(deep.match(/<use href="[^"]*eyes\/[^"]*"([^>]*)\/>/)?.[1] ?? ''), 'deep eyes are not given heavier lines');
  for (const key of ['eyes', 'lips']) for (const p of CATALOG[key]) {
    const art = readFileSync(new URL(`assets/${PART_BY_ID[p.id].file}`, root), 'utf8');
    const lined = new Set([...art.matchAll(/fill:(#[0-9a-f]{6});stroke:var\(--line-ink/g)].map((m) => m[1]));
    check(lined.size === 1, `${p.id}: ${lined.size} shades take the heavier line, not just its outline`);
  }
  const white = deep.match(/--eye-white:(#[0-9a-f]{6})/)[1];
  check(parseInt(white.slice(1, 3), 16) >= 0xd0, `the white of the eye is no longer white (${white})`);
}

// Hairstyles taken out of the game: their files are gone, they are not offered or given out, and a save that used one
// gets the nearest kept style, the same every time.
for (const [gone, kept] of Object.entries(CUR.WITHDRAWN.hair)) {
  check(!PART_BY_ID[gone] && !existsSync(new URL(`assets/avatars/hair/${gone}.svg`, root)) && !CATALOG.hair.some((h) => h.id === gone) && !CUR.HAIR_TYPE[gone], `${gone} is still in the game`);
  check(!!PART_BY_ID[kept] && !CUR.WITHDRAWN.hair[kept], `${gone} is replaced by ${kept}, which is not a kept style`);
  const a = normalize({ v: 3, inherited: { head: 'head_12_sculpted' }, style: { hair: gone } }, `saved-${gone}`);
  check(a.style.hair === kept && normalize(a, 'again').style.hair === kept, `a save with ${gone} does not land on ${kept}`);
}
check(normalize({ v: 2, inherited: { face: 'oval' }, style: { hair: 'long_straight' } }, 'v2').style.hair === CUR.WITHDRAWN.hair.hair_girl_long_02, 'an older save with long straight hair does not get a kept style');

// 10. The faces on offer: the withdrawn eyes, mouths and noses are gone, saves that used them land on the nearest kept,
// and the rest are offered and drawn at random exactly as before.
const EYES = ['eyes_10', 'eyes_14', 'eyes_16', 'eyes_18', 'eyes_19', 'eyes_20', 'eyes_22', 'eyes_25', 'eyes_26', 'eyes_6', 'eyes_7', 'eyes_8', 'eyes_9'];
const drawnEyes = (list) => list.map((e) => e.id ?? e).filter((id) => !/^eyes_[fm]_/.test(id));  // traced eyes (eyes_f_*, eyes_m_*) come and go
check(drawnEyes(AVATAR_MANIFEST.eyes).join() === EYES.join(), 'the eye shapes in the manifest have changed');
check(drawnEyes(CATALOG.eyes).join() === EYES.filter((id) => id !== 'eyes_14').join(), 'the eye shapes on offer have changed');
check(CUR.RESTING.eyes.join() === 'eyes_6,eyes_8,eyes_9,eyes_10,eyes_16,eyes_18,eyes_19,eyes_22,eyes_25', 'the eyes given out at random have changed');
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
  const seen = {};
  rng.seed(7);
  for (let i = 0; i < 4000; i++) { const e = randomAppearance(i % 12, i % 2 ? 'female' : 'male').inherited.eyes; seen[e] = (seen[e] ?? 0) + 1; }
  check(drawnEyes(Object.keys(seen)).sort().join() === [...CUR.RESTING.eyes].sort().join() && CATALOG.eyes.filter((e) => /^eyes_[fm]_/.test(e.id)).every((e) => seen[e.id]), 'random faces draw on a different set of eyes');
  check(Math.max(...Object.values(seen)) / Math.min(...Object.values(seen)) < 1.5, 'some eye shapes are now given out more often than others');
}

// 11. A saved face keeps its head, hair and eyes, and is drawn with those files.
{
  const saved = JSON.parse(JSON.stringify({ v: 3, inherited: { head: 'head_16_angular', skin: 'umber', eyes: 'eyes_22', eyeColor: 'hazel', brows: 'brows_14', nose: 'nose_17', lips: 'lips_12', hairColor: 'black', hairTexture: 'coily', marks: [], tweaks: { eyeGap: 1 } },
    style: { hair: 'hair_boy_updo_15_headband_puff', jewelry: [], outfit: 'outfit_55_zip_hoodie' } }));
  const a = normalize(saved, 'npc_saved');
  check(a.inherited.head === 'head_16_angular' && a.style.hair === 'hair_boy_updo_15_headband_puff' && a.inherited.eyes === 'eyes_22' && a.inherited.tweaks.eyeGap === 1, 'a saved face lost its head, hair or eyes');
  const svg = avatarSvg({ appearance: saved, seed: 'npc_saved', age: 40 });
  for (const f of ['heads/angular.svg', 'hair/hair_boy_updo_15_headband_puff.svg', 'eyes/eyes_22.svg']) check(svg.includes(f), `a saved face is not drawn with ${f}`);
  check(JSON.stringify(saved.inherited.tweaks) === '{"eyeGap":1}', 'drawing a face changed what was saved');
  // A face made today and one loaded from a save are fitted by the same rule.
  const fresh = randomAppearance(8, 'male');
  const again = JSON.parse(JSON.stringify(fresh));
  check(avatarSvg({ appearance: fresh, seed: 'f', age: 30 }).replace(/pw-[a-z]+-\d+/g, '') === avatarSvg({ appearance: again, seed: 'f', age: 30 }).replace(/pw-[a-z]+-\d+/g, ''), 'a saved copy of a face is drawn differently');
}

// Men's eyes: no lashes or winged liner; a woman's eyes are drawn as they are.
{
  const { EYE_MATCH } = CUR;
  const eye = (eyes, gender) => avatarSvg({ appearance: { v: 3, inherited: { head: 'head_13_athletic', skin: 'tan', eyes }, style: { hair: 'bald' } }, seed: 'eyes', age: 40, gender });
  for (const [lashed, plain] of Object.entries(EYE_MATCH.male)) {
    check(eye(lashed, 'male').includes(`eyes/${plain}.svg`) && !eye(lashed, 'male').includes(`eyes/${lashed}.svg`), `a man is drawn with ${lashed}, which has lashes`);
    check(eye(lashed, 'female').includes(`eyes/${lashed}.svg`), `a woman's ${lashed} is changed`);
    check(!EYE_MATCH.male[plain], `${plain}, a man's eyes, has lashes of its own`);
  }
  // Eyes made for one gender (eyes_f_*, eyes_m_*) are never drawn on the other.
  for (const e of CATALOG.eyes.filter((x) => /^eyes_[fm]_/.test(x.id))) {
    const other = e.id.startsWith('eyes_f_') ? 'male' : 'female';
    check(!eye(e.id, other).includes(`eyes/${e.id}.svg`), `${e.id} is drawn on a ${other === 'male' ? 'man' : 'woman'}`);
    check(eye(e.id, other === 'male' ? 'female' : 'male').includes(`eyes/${e.id}.svg`), `${e.id} is not drawn on its own gender`);
    check(!/^[FM] /.test(e.name), `${e.id} is named ${e.name}`);
  }
}

// 12. Layers: lines of age kept on the face, front hair cut at the chin; an old beard is not drawn.
{
  const look = resolveLook({ v: 3, inherited: { head: 'head_13_athletic', skin: 'golden' }, style: { hair: 'hair_girl_long_04', keepHair: true, facialHair: 'facial_hair_04_bushy_full_beard' } }, 'layers', 'male');  // keepHair: his own hair at 70, not an elder style
  const svg = characterAvatarSvg(look, { age: 70, gender: 'male' });
  check(!/facial_hair/.test(svg), 'a beard from an old save is drawn');
  check(/<g clip-path="url\(#pw-face-\d+\)"><use href="[^"]*aging/.test(svg), 'lines of age are not kept to the face');
  const cut = Number(svg.match(/<clipPath id="pw-front-\d+"><rect x="-400" y="-2000" width="1312" height="(\d+)"/)[1]) - 2000;
  const f = hairFit('hair_girl_long_04', 'head_13_athletic');
  check(Math.abs(f.ty + f.sy * (cut - T.face.top) - (PART_BY_ID.head_13_athletic.fit.chin - 2)) <= 1.5, 'hair in front of the face does not end at the chin');
}

// 12. Every nose with every pair of eyes on every face shape: none touches the eyes, a pair that was
// already clear is left exactly as drawn, and no nose is changed beyond the limits.
{
  const T = AVATAR_TEMPLATE;
  let changed = 0, faces = 0;
  for (const h of AVATAR_MANIFEST.heads.filter((x) => x.tags?.age === 'adult')) {
    const hr = (h.fit.chin - h.fit.top) / (T.face.chin - T.face.top), s = Math.sqrt((h.fit.w / T.face.w) * hr);
    const at = (ay) => h.fit.top + (ay - T.face.top) * hr;
    for (const e of AVATAR_MANIFEST.eyes) for (const n of AVATAR_MANIFEST.noses) {
      const g = { s, eyeS: s, noseS: s * (CUR.PART_SCALE[n.id] ?? 1), eyeY: at(T.anchor.eyes), noseY: at(T.anchor.nose), apart: 3 };
      const f = noseFit(e.id, n.id, g), before = noseGap(e.id, n.id, g), after = noseGap(e.id, n.id, g, f);
      faces++;
      const touched = f.k !== 1 || f.drop !== 0 || f.apart !== 0;
      if (touched) changed++;
      check(after >= 1, `${n.id} touches ${e.id} on ${h.id} (${after.toFixed(1)})`);
      check(after >= before - 0.01, `${n.id} with ${e.id} on ${h.id} was made worse`);
      check(!(before >= NOSE_FIT.gap * s + 1) || !touched, `${n.id} with ${e.id} on ${h.id} was clear and has been changed`);
      check(f.k >= Math.min(...NOSE_FIT.shrink) && f.drop <= Math.max(...NOSE_FIT.drop) * s + 0.01 && f.apart <= Math.max(...NOSE_FIT.apart), `${n.id} with ${e.id} on ${h.id} is changed beyond the limits`);
    }
  }
  check(faces === 7 * AVATAR_MANIFEST.eyes.length * AVATAR_MANIFEST.noses.length && changed > 0, 'the noses were not checked against every pair of eyes on every face');
  // The renderer applies it: a broad nose under low inner corners is drawn smaller, a clear pair as before.
  const plain = fitTransforms('head_17_dimple_oval', 'adult', {});
  check(fitTransforms('head_17_dimple_oval', 'adult', {}, { eyes: 'eyes_20', nose: 'nose_20' }).nose !== plain.nose, 'a crowded nose is not adjusted in the portrait');
  check(fitTransforms('head_17_dimple_oval', 'adult', {}, { eyes: 'eyes_9', nose: 'nose_12' }).nose === plain.nose, 'a clear nose is adjusted in the portrait');
  check(/scale\(1\.0[4-9]\)/.test(fitTransforms('head_17_dimple_oval', 'adult', {}, { eyes: 'eyes_9', nose: 'nose_10' }).nose), 'the slight nose is not drawn larger');
  for (const id of ['nose_15', 'nose_24', 'eyes_24']) check(!PART_BY_ID[id], `${id} has been withdrawn and is still listed`);
}

// 13. The men's mouths: a man is drawn with the men's match of the mouth he was born with, a woman with the
// women's match, both ways round; what is saved and passed on is the mouth itself; every resting mouth has a
// match; and the creator offers each person only the mouths that can be drawn for them.
{
  const { lipsFor } = await import('../js/avatar/catalog.js');
  for (const id of CUR.RESTING.lips) {
    check(CUR.RESTING.lipsMasc.includes(lipsFor(id, 'male')) && lipsFor(id, 'female') === id, `${id} has no men's match`);
    check(lipsFor(lipsFor(id, 'male'), 'female') === id, `${id} does not come back to itself on a daughter`);
  }
  for (const id of CUR.RESTING.lipsMasc) check(CUR.RESTING.lips.includes(lipsFor(id, 'female')) && lipsFor(id, 'male') === id, `${id} has no women's match`);
  check(lipsFor('lips_20', 'male') === 'lips_20' && lipsFor('lips_4') === 'lips_4', 'an expression, or a face with no gender, was given another mouth');
  // The neutral mouths are shared: drawn as they are on men and women alike, and given to men at random; the feminine ones never are.
  for (const id of ['lips_8', 'lips_9', 'lips_10']) check(lipsFor(id, 'male') === id && lipsFor(id, 'female') === id && CUR.RESTING.lipsMasc.includes(id), `${id} is not shared by men and women`);
  for (const id of ['lips_4', 'lips_6', 'lips_7', 'lips_11', 'lips_14']) check(lipsFor(id, 'male') !== id && !CUR.RESTING.lipsMasc.includes(id), `the feminine ${id} is drawn on a man`);
  const saved = { v: 3, inherited: { head: 'head_17_dimple_oval', lips: 'lips_7' } };
  const him = avatarSvg({ appearance: saved, seed: 'm', age: 30, gender: 'male' }), her = avatarSvg({ appearance: saved, seed: 'm', age: 30, gender: 'female' });
  check(him.includes(`lips/${lipsFor('lips_7', 'male')}.svg`) && her.includes('lips/lips_7.svg'), 'a mouth is not drawn to suit the gender');
  check(saved.inherited.lips === 'lips_7', 'drawing a man changed the mouth he passes on');
  for (const id of CUR.RESTING.lipsMasc.filter((x) => x.startsWith('lips_masc_'))) check(PART_BY_ID[id] && /^Masc \d+$/.test(PART_BY_ID[id].label), `${id} is missing or unnamed`);
}

// 14. Every mouth under every nose, as that nose is fitted to every pair of eyes, on every face shape: a resting
// mouth is at least LIP_FIT.wide times as wide as the nose (unless it would have to grow too much), its upper lip is
// closer to the same length than before, it is clear of the nose and the chin, and an expression is left as drawn.
{
  const T = AVATAR_TEMPLATE, STEP = T.featureStep;
  const rows = (list, y0) => list.map((v, i) => (v == null ? null : [v, y0 + i * STEP + 0.5])).filter(Boolean);
  const resting = (id) => CUR.RESTING.lips.includes(id) || CUR.RESTING.lipsMasc.includes(id);
  let faces = 0, spreadBefore = [Infinity, -Infinity], spreadAfter = [Infinity, -Infinity];
  for (const h of AVATAR_MANIFEST.heads.filter((x) => x.tags?.age === 'adult')) {
    const hr = (h.fit.chin - h.fit.top) / (T.face.chin - T.face.top), s = Math.sqrt((h.fit.w / T.face.w) * hr);
    const at = (ay) => h.fit.top + (ay - T.face.top) * hr;
    for (const e of CATALOG.eyes) for (const n of CATALOG.nose) {
      const noseS = s * (CUR.PART_SCALE[n.id] ?? 1);
      const nf = noseFit(e.id, n.id, { s, eyeS: s, noseS, eyeY: at(T.anchor.eyes), noseY: at(T.anchor.nose), apart: 3 });
      const nr = rows(PART_BY_ID[n.id].shape.ink, PART_BY_ID[n.id].shape.y);
      const nS = noseS * nf.k, nY = at(T.anchor.nose) + nf.drop;
      const noseBottom = nY + nS * (Math.max(...nr.map((r) => r[1])) - T.anchor.nose), noseW = 2 * nS * Math.max(...nr.map((r) => r[0]));
      for (const l of AVATAR_MANIFEST.lips) {
        const g = { s, mouthS: s, noseS: nS, noseY: nY, mouthY: at(T.anchor.lips), chin: h.fit.chin };
        const f = mouthFit(l.id, n.id, g, resting(l.id));
        faces++;
        const lr = rows(l.shape.all, l.shape.y);
        const top = g.mouthY + f.dy + s * f.k * (Math.min(...lr.map((r) => r[1])) - T.anchor.lips);
        const bottom = g.mouthY + f.dy + s * f.k * (Math.max(...lr.map((r) => r[1])) - T.anchor.lips);
        const where = `${l.id} under ${n.id} (with ${e.id}) on ${h.id}`;
        check(top - noseBottom >= Math.min(LIP_FIT.gap * s, 12) - 0.05, `${where} is too close to the nose`);
        check(h.fit.chin - bottom >= LIP_FIT.chin * s - 0.05, `${where} is too close to the chin`);
        if (!resting(l.id)) { check(f.k === 1 && f.dy === 0, `the expression ${where} has been changed`); continue; }
        check(f.k <= LIP_FIT.grow && Math.abs(f.dy) <= LIP_FIT.move * s + 0.01, `${where} is changed beyond the limits`);
        check(s * f.k * l.shape.width >= Math.min(LIP_FIT.wide * noseW, LIP_FIT.grow * s * l.shape.width) - 0.05, `${where} is narrow for the nose`);
        const lip = (g.mouthY + f.dy - noseBottom) / s, lip0 = (g.mouthY - noseBottom) / s;
        spreadBefore = [Math.min(spreadBefore[0], lip0), Math.max(spreadBefore[1], lip0)]; spreadAfter = [Math.min(spreadAfter[0], lip), Math.max(spreadAfter[1], lip)];
      }
    }
  }
  check(faces === 7 * CATALOG.eyes.length * CATALOG.nose.length * AVATAR_MANIFEST.lips.length, 'the mouths were not checked under every nose and pair of eyes on every face');
  check(spreadAfter[1] - spreadAfter[0] < spreadBefore[1] - spreadBefore[0] - 3, `upper lips are not more even (${spreadBefore.map(Math.round)} to ${spreadAfter.map(Math.round)})`);
  // The renderer applies it: a small mouth under a broad nose is drawn larger; an open mouth is left as it is.
  const mouth = (lips, nose) => fitTransforms('head_17_dimple_oval', 'adult', {}, { eyes: 'eyes_9', nose, lips }).lips;
  check(mouth('lips_4', 'nose_12') !== mouth('lips_4', 'nose_19') && /scale\(1\.0\d\)/.test(mouth('lips_4', 'nose_12')), 'a small mouth under a broad nose is not drawn wider');
  check(mouth('lips_17', 'nose_12') === fitTransforms('head_17_dimple_oval', 'adult', {}, { eyes: 'eyes_9', nose: 'nose_12' }).lips, 'an expression is fitted to the nose');
}

// 15. Lip colors: a man's natural lips are the pair for his skin tone in the shared palette: one color from porcelain to
// bronze, a nude a shade deeper than the skin that does not blend into the cheeks; from chestnut down two tones, the
// lower clearly lighter than the upper. Every resting mouth draws its upper lip in
// --lip-upper; lipstick is worn as chosen; children wear none; and the mouth drawn with a heavier outline is trimmed.
{
  const { SKIN_TONES, DEPTH } = await import('../js/avatar/catalog.js');
  const PAL = await import('../js/avatarPalettes.js');
  const lch = (h) => {
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16)));
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
    const A = 500 * (x - y), B = 200 * (y - z);
    return { L: 116 * y - 16, C: Math.hypot(A, B), h: (Math.atan2(B, A) * 180 / Math.PI + 360) % 360 };
  };
  check(PAL.NATURAL_LIP_UPPER.length === SKIN_TONES.length && PAL.NATURAL_LIP_LOWER.length === SKIN_TONES.length, 'a skin tone has no natural lip pair');
  let lastHue = Infinity;
  for (const tone of SKIN_TONES) {
    const c = resolveLook({ v: 3, inherited: { skin: tone.id, lips: 'lips_9' } }, 'x', 'male').colors;
    const skin = lch(c.skin), up = lch(c.lipUpper), lo = lch(c.lip);
    check(c.lipUpper === PAL.NATURAL_LIP_UPPER[tone.depth] && c.lip === PAL.NATURAL_LIP_LOWER[tone.depth], `${tone.id}: a man's lips are not from the shared palette`);
    if (tone.depth <= DEPTH.bronze) check(c.lipUpper === c.lip && lo.L < skin.L - 3, `${tone.id}: a lighter skin's lips are not one nude shade deeper than the skin`);
    else check(up.L < lo.L && up.L < skin.L - 3, `${tone.id}: the upper lip is not the deeper tone`);
    check(lo.h >= 30 && lo.h <= 60 && up.h >= 40 && up.h <= 62, `${tone.id}: a man's lips are not a natural brown or rose-brown (${c.lipUpper} / ${c.lip})`);
    if (['golden', 'caramel', 'olive', 'tan', 'bronze'].includes(tone.id)) check(skin.h - lo.h > 10, `${tone.id}: the lips blend into the cheeks`);
    if (tone.depth >= DEPTH.chestnut) check(lo.L - up.L > 7 && lo.L > skin.L - 1, `${tone.id}: the lips are not two-toned`);
    if (tone.depth >= DEPTH.golden) { check(lo.h <= lastHue + 3, `${tone.id}: the lower lip's hue jumps from the tone before`); lastHue = lo.h; }
  }
  // Every resting mouth, thin, full or smiling, has an upper lip of its own color; a woman's natural lips and lipstick
  // set none, so both lips stay one color for them.
  for (const id of [...CUR.RESTING.lips, ...CUR.RESTING.lipsMasc]) check(readFileSync(new URL(`../assets/avatars/lips/${id}.svg`, import.meta.url), 'utf8').includes('var(--lip-upper,'), `${id} has no separate upper-lip color`);
  check(!resolveLook({ v: 3, inherited: { skin: 'ebony' } }, 'x', 'female').colors.lipUpper, 'a woman\'s natural lips are given two tones');
  check(!resolveLook({ v: 3, inherited: { skin: 'ebony' }, style: { lipColor: CATALOG.lipColor[0].id } }, 'x', 'male').colors.lipUpper, 'lipstick is given a second tone');
  const shared = avatarSvg({ appearance: { v: 3, inherited: { skin: 'espresso', lips: 'lips_10' } }, seed: 'm', age: 30, gender: 'male' });
  check(shared.includes(`--lip-upper:${PAL.NATURAL_LIP_UPPER[DEPTH.espresso]}`) && shared.includes('lips/lips_10.svg'), 'a shared mouth on a man is not drawn in two tones');
  for (const id of ['lips_17', 'lips_18', 'lips_20', 'lips_21', 'lips_5']) check(!readFileSync(new URL(`../assets/avatars/lips/${id}.svg`, import.meta.url), 'utf8').includes('--lip-upper'), `the expression ${id} has been parted`);
  const red = resolveLook({ v: 3, inherited: { skin: 'sand' }, style: { lipColor: CATALOG.lipColor[0].id } }, 'x', 'male').colors.lip;
  check(red === CATALOG.lipColor[0].hex, 'lipstick chosen by a man is not worn');
  check(resolveLook({ v: 3, inherited: { skin: 'sand' }, style: { lipColor: CATALOG.lipColor[0].id } }, 'x', 'female', { child: true }).colors.lip !== CATALOG.lipColor[0].hex, 'a child wears lipstick');
  const boy = avatarSvg({ appearance: { v: 3, inherited: { skin: 'umber', lips: 'lips_4' } }, seed: 'b', age: 8, gender: 'male' });
  check(/--lip-upper:#/.test(boy) && /lips_masc_/.test(boy), 'a boy is not drawn with a two-toned men\'s mouth');
  const l4 = readFileSync(new URL('../assets/avatars/lips/lips_4.svg', import.meta.url), 'utf8');
  check(/data-thinned="[\d.]+\/[\d.]+"/.test(l4) && l4.includes('stroke:var(--skin-color') && !l4.includes('#3b1004'), 'the heavy outline of lips_4 is back');
}

// 16. Lid creases. Eyes that draw their crease as a line floating above the eye had it read as a second eyebrow: it is
// now a path of its own, in a soft shade of the skin (not the eye's ink), lowered toward the lid; it keeps clear of the
// eye below, and is a good way from a typical brow above.
{
  const numbers = (d) => (d.match(/-?\d+\.?\d*/g) ?? []).map(Number);
  const points = (d) => { const n = numbers(d), out = []; for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i], n[i + 1]]); return out; };
  const paths = (svg) => [...svg.matchAll(/<path ([^>]*?) d="([^"]*)"/g)].map((m) => ({ attrs: m[1], pts: points(m[2]) }));
  const read = (folder, id) => readFileSync(new URL(`../assets/avatars/${folder}/${id}.svg`, import.meta.url), 'utf8');
  // Below each point of `from`, the nearest point of `to` within 3 units across: how far apart they are.
  const clearance = (from, to) => { let least = Infinity; for (const [x, y] of from) for (const [x2, y2] of to) if (Math.abs(x - x2) <= 3 && y2 > y) least = Math.min(least, y2 - y); return least; };
  const REST = CUR.RESTING.eyebrows;
  const brows = REST.map((id) => paths(read('eyebrows', id)).flatMap((p) => p.pts).filter(([x]) => x < 256));
  for (const id of ['eyes_18', 'eyes_19', 'eyes_20', 'eyes_22', 'eyes_26', 'eyes_9', 'eyes_8', 'eyes_7']) {
    const svg = read('eyes', id), all = paths(svg), creases = all.filter((p) => p.attrs.includes('data-crease'));
    check(creases.length === 2, `${id} has ${creases.length} lid creases parted, not one for each eye`);
    for (const c of creases) check(c.attrs.includes('var(--crease-color,') && !/fill:#/.test(c.attrs), `${id}: a lid crease is drawn in ink`);
    const left = creases.find((c) => c.pts.every(([x]) => x < 256));
    const body = all.filter((p) => !p.attrs.includes('data-crease') && !p.attrs.includes('var(--eye')).flatMap((p) => p.pts).filter(([x]) => x < 256);
    if (!left) { check(false, `${id}: no crease on the left`); continue; }
    check(clearance(left.pts, body) >= 3, `${id}: the lid crease runs into the eye (${clearance(left.pts, body).toFixed(1)})`);
    const gaps = brows.map((b) => { let least = Infinity; for (const [x, y] of left.pts) for (const [x2, y2] of b) if (Math.abs(x - x2) <= 3 && y > y2) least = Math.min(least, y - y2); return least; }).filter(Number.isFinite).sort((a, b) => a - b);
    check(gaps.length > 5 && gaps[gaps.length >> 1] >= 5, `${id}: the lid crease is too close to a typical brow (${gaps[gaps.length >> 1]?.toFixed?.(1)})`);
  }
  // Eyes 25 drew two folds: the floating one is gone, and the one under its lashes (cut out of its outline) is soft too.
  { const svg = read('eyes', 'eyes_25'), folds = paths(svg).filter((p) => p.attrs.includes('data-crease'));
    check(svg.includes('data-crease-removed="1"') && folds.length === 2 && folds.every((p) => p.attrs.includes('var(--crease-color,')), 'eyes_25 does not have one soft fold over each eye'); }
  // The eyes whose top line is lashes are left as they were.
  for (const id of ['eyes_10', 'eyes_16', 'eyes_6']) check(!read('eyes', id).includes('data-crease'), `${id} has had a lid crease softened that is a lash line`);
}

// 17. Brows: the withdrawn ones are gone and saves that had them get the nearest kept; the sad brows are only ever an
// expression, worn while mood is low; and the bushy brows of old age come to old men.
{
  const gone = ['brows_02', 'brows_03', 'brows_7', 'brows_13', 'brows_17_puppy', 'brows_18_unibrow', 'brows_19_glam_arch', 'brows_22_skeptical'];
  for (const id of gone) {
    check(!PART_BY_ID[id] && !CATALOG.brows.some((b) => b.id === id), `${id} is still offered`);
    const kept = normalize({ v: 3, inherited: { brows: id } }, 'b').inherited.brows;
    check(kept === CUR.WITHDRAWN.brows[id] && PART_BY_ID[kept], `a save with ${id} does not get the nearest kept brow (${kept})`);
  }
  const sad = CUR.EXPRESSION.sadBrows;
  check(PART_BY_ID[sad] && !CATALOG.brows.some((b) => b.id === sad) && !CUR.RESTING.eyebrows.includes(sad), 'the sad brows are offered as a resting face');
  check(normalize({ v: 3, inherited: { brows: sad } }, 'b').inherited.brows === CUR.WITHDRAWN.brows[sad], 'a save with the sad brows keeps them for good');
  const browsAt = (mood, age = 30, gender = 'female') => dressFor(resolveLook({ v: 3, inherited: { brows: 'brows_10' } }, 'x', gender), { age, gender, mood }).eyebrows;
  check(browsAt(CUR.LOW_MOOD.sad) === sad && browsAt(5) === sad && browsAt(CUR.LOW_MOOD.sad + 1) === 'brows_10' && browsAt(60) === 'brows_10', 'sad brows do not follow low mood');
  check(browsAt(5, 8) === sad && browsAt(5, 1) === CUR.BABY_BROWS, 'a sad child, or a baby, has the wrong brows');
  check(dressFor(resolveLook({ v: 3, inherited: { brows: 'brows_10' } }, 'x', 'female'), { age: 30, gender: 'female', mood: 5 }).eyes === CUR.EXPRESSION.crying, 'a very unhappy face does not cry');
  check(browsAt(60, 90, 'male') === CUR.ELDER_BROWS && browsAt(60, 90, 'female') === 'brows_10' && browsAt(60, 70, 'male') === 'brows_10', 'the bushy brows of old age are not an old man\'s alone');
}

// Babies (under 3) have a binky in place of a mouth: blue for a boy, pink for a girl. From 3, a mouth again.
{
  const face = (age, gender) => avatarSvg({ appearance: { v: 3, inherited: { head: 'head_17_dimple_oval', skin: 'tan' }, style: { hair: 'bald' } }, seed: 'binkie', age, gender });
  for (const [gender, hex] of [['male', CUR.PACIFIER.boy], ['female', CUR.PACIFIER.girl]]) for (const age of [0, 2]) {
    const svg = face(age, gender);
    check(svg.includes('pacifiers/pacifier_01.svg#art') && svg.includes(`--binkie-color:${hex}`) && !/lips\/lips_/.test(svg), `a ${age}-year-old ${gender === 'male' ? 'boy' : 'girl'} has no ${hex} binky in place of a mouth`);
  }
  check(!face(3, 'female').includes('pacifier') && /lips\/lips_/.test(face(3, 'female')), 'a three-year-old still has a binky, or no mouth');
  // Round, open eyes until thirteen: a heavy-lidded shape is drawn as the round one it maps to.
  const eyed = (age) => avatarSvg({ appearance: { v: 3, inherited: { head: 'head_17_dimple_oval', skin: 'tan', eyes: 'eyes_10' }, style: { hair: 'bald' } }, seed: 'eyes', age, gender: 'female' });
  check(eyed(1).includes(`eyes/${CUR.babyEyes('eyes_10', 'female')}.svg`) && CUR.BABY_EYES.includes(CUR.babyEyes('eyes_10', 'female')) && !eyed(3).includes('eyes/eyes_10.svg'), 'a baby or toddler is drawn with grown-up eyes');
  // Children (to 13) keep the toddler eyes; their own eyes come back at fourteen, with the grown-up head.
  for (const age of [5, 9, 13]) check(eyed(age).includes(`eyes/${CUR.babyEyes('eyes_10', 'female')}.svg`) && !eyed(age).includes('eyes/eyes_10.svg'), `a ${age}-year-old is drawn with grown-up eyes`);
  check(eyed(14).includes('eyes/eyes_10.svg'), 'a fourteen-year-old does not have the eyes they were born with');
  // A girl has the round eyes with lashes, a boy eyes_22, whatever eyes they were born with.
  const eyedAs = (age, gender) => avatarSvg({ appearance: { v: 3, inherited: { head: 'head_17_dimple_oval', skin: 'tan', eyes: 'eyes_10' }, style: { hair: 'bald' } }, seed: 'eyes', age, gender });
  for (const age of [1, 5, 10]) check(eyedAs(age, 'female').includes('baby_eyes_6.svg') && eyedAs(age, 'male').includes('eyes/eyes_22.svg'), `a ${age}-year-old girl has baby_eyes_6 and a boy eyes_22`);
  // One soft pair of brows: no lighter edge on any skin, no lid crease under them, and never the crying eyes at rest.
  for (const skin of ['porcelain', 'umber', 'ebony']) {
    const svg = avatarSvg({ appearance: { v: 3, inherited: { head: 'head_17_dimple_oval', skin }, style: { hair: 'bald' } }, seed: 'brows', age: 1, gender: 'male', mood: 70 });
    check(!/eyebrows\/[^"]+#art"[^>]*paint-order:stroke/.test(svg) && svg.includes('--crease-color:transparent'), `a baby on ${skin} skin has a lighter edge on the brows, or a crease`);
  }
  check(CUR.BABY_EYES.every((e) => e !== CUR.EXPRESSION.crying && PART_BY_ID[e]), 'a baby eye shape is the crying eyes, or missing');
}

// Outfits fitted to each head's neck (scripts/fit-clothes.mjs): every fitted copy exists, the portrait uses it on
// that head, and the head the outfit was drawn for wears the outfit's own file.
{
  const { FITTED_CLOTHES } = await import('../js/avatar/fittedClothes.js');
  const drawnFor = JSON.parse(readFileSync(new URL('assets/clothes_drawn_for.json', root), 'utf8'));
  const headOf = (name) => Object.values(PART_BY_ID).find((p) => p.file === `heads/${name}.svg`)?.id;
  for (const [outfit, heads] of Object.entries(FITTED_CLOTHES)) {
    check(PART_BY_ID[outfit] && drawnFor[outfit], `${outfit}: a fitted outfit that is not in the manifest or clothes_drawn_for.json`);
    for (const h of heads) {
      const file = `assets/clothes_fit/${outfit}__${h}.svg`;
      check(existsSync(new URL(file, root)), `${file} is missing: run npm run fit-clothes`);
      const look = { ...resolveLook({}, 'neck', 'male'), head: headOf(h), clothes: outfit };
      check(characterAvatarSvg(look, { age: 30, gender: 'male' }).includes(`clothes_fit/${outfit}__${h}.svg#art`), `${outfit} on ${h}: the portrait does not use the neck-fitted copy`);
      check(filesFor(look, { age: 30, gender: 'male' }).some((f) => f.endsWith(`${outfit}__${h}.svg`)), `${outfit} on ${h}: the fitted copy is not preloaded`);
    }
    // The head it was drawn on wears the outfit's own file, unless that head needed fitting too (its shoulders lifted).
    const how = drawnFor[outfit]; const ref = typeof how === 'string' ? how : how.head;
    if (!heads.includes(ref)) {
      const own = { ...resolveLook({}, 'neck', 'male'), head: headOf(ref), clothes: outfit };
      check(characterAvatarSvg(own, { age: 30, gender: 'male' }).includes(`${PART_BY_ID[outfit].file}#art`), `${outfit} on ${ref}, the head it was drawn for: not its own file`);
    }
  }
}

// The sweetheart princess dress: for royal girls and women only.
{
  const id = 'outfit_45_princess_sweetheart';
  check(PART_BY_ID[id]?.tags?.royal, 'the sweetheart princess dress is in the manifest, tagged royal');
  check(CUR.ROYAL.outfits.female.includes(id) && !CUR.ROYAL.outfits.male.includes(id), 'it is among the royal dresses for girls, and not for boys');
  check(!CATALOG.outfit?.some?.((o) => (o.id ?? o) === id), 'nobody who is not royal can choose it');
  const look = { ...resolveLook(randomAppearance(undefined, 'female'), 'sweet', 'female'), royalOutfit: id };
  for (const age of [18, 24, 70]) check(dressFor(look, { age, gender: 'female', royal: { rank: 'royal' } }).clothes === id, `a princess of ${age} wears it`);
  for (const age of [6, 12, 15, 17]) check(dressFor(look, { age, gender: 'female', royal: { rank: 'royal' } }).clothes !== id, `a princess of ${age} does not: it is a grown-up's dress`);
  check(dressFor(look, { age: 24, gender: 'female' }).clothes !== id, 'a commoner does not');
}

// The prince's uniform with epaulettes and a sash: for royal boys and men only.
{
  const id = 'outfit_46_prince_epaulettes';
  check(PART_BY_ID[id]?.tags?.royal, 'the prince\'s uniform is in the manifest, tagged royal');
  check(CUR.ROYAL.outfits.male.includes(id) && !CUR.ROYAL.outfits.female.includes(id), 'it is among the royal outfits for boys, and not for girls');
  check(!CATALOG.outfit.some((o) => o.id === id), 'nobody who is not royal can choose it');
  const look = { ...resolveLook(randomAppearance(undefined, 'male'), 'uniform', 'male'), royalOutfit: id };
  for (const age of [18, 24, 70]) check(dressFor(look, { age, gender: 'male', royal: { rank: 'royal' } }).clothes === id, `a prince of ${age} wears it`);
  for (const age of [6, 12, 15, 17]) check(dressFor(look, { age, gender: 'male', royal: { rank: 'royal' } }).clothes !== id, `a prince of ${age} does not: it is a grown-up's uniform`);
  check(dressFor(look, { age: 24, gender: 'male' }).clothes !== id, 'a commoner does not');
}

// The sovereign's ermine robe: for reigning kings and queens only.
{
  const id = 'outfit_47_sovereign_ermine';
  check(PART_BY_ID[id]?.tags?.royal, 'the sovereign\'s robe is in the manifest, tagged royal');
  check(CUR.ROYAL.outfits.monarch.male.includes(id) && CUR.ROYAL.outfits.monarch.female.includes(id), 'kings and queens may both wear it');
  check(!CUR.ROYAL.outfits.male.includes(id) && !CUR.ROYAL.outfits.female.includes(id) && !CATALOG.outfit.some((o) => o.id === id), 'nobody else can');
  for (const g of ['male', 'female']) {
    const look = { ...resolveLook(randomAppearance(undefined, g), 'sovereign', g), monarchOutfit: id };
    check(dressFor(look, { age: 50, gender: g, royal: { rank: 'monarch' } }).clothes === id, `a reigning ${g === 'male' ? 'king' : 'queen'} wears it`);
    check(dressFor(look, { age: 50, gender: g, royal: { rank: 'royal' } }).clothes !== id, `a ${g === 'male' ? 'prince' : 'princess'} does not`);
    check(dressFor(look, { age: 10, gender: g, royal: { rank: 'monarch' } }).clothes !== id, 'a child on the throne does not');
  }
  // Every monarch wears one of the monarch's outfits, chosen once for them.
  const picks = new Set(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'].map((s) => dressFor(resolveLook(randomAppearance(undefined, 'female'), s, 'female'), { age: 50, gender: 'female', royal: { rank: 'monarch' } }).clothes));
  check([...picks].every((x) => CUR.ROYAL.outfits.monarch.female.includes(x)), `a queen wears a monarch's outfit (${[...picks]})`);
}

// None of the new royal and noble clothes is for children: every royal under 18 wears something else, and something royal.
for (const g of ['male', 'female']) for (const s of ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8']) for (const age of [5, 9, 13, 17]) for (const rank of ['royal', 'heir', 'monarch']) {
  const look = resolveLook(randomAppearance(undefined, g), s, g);
  const c = dressFor(look, { age, gender: g, royal: { rank } }).clothes;
  check(!CUR.ROYAL.grownOnly.includes(c), `a ${rank} of ${age} is not in grown-up dress (${c})`);
  // A royal child (baby, toddler or kid head, under 14) is dressed as a child: the children's clothes are being redrawn,
  // so for now nothing (or the baby's royal dress, once there is one); from 14, in royal dress.
  if (['baby', 'toddler', 'kid'].includes(ageStage(age))) check(c == null || CUR.ROYAL.outfits.baby.includes(c) || [...(CUR.ROYAL.outfits.kid[g] ?? []), CUR.ROYAL.outfits.kidHeir?.[g]].includes(c) || [...CUR.KID_OUTFITS.any, ...CUR.KID_OUTFITS[g], ...CUR.OUTFITS.baby].includes(c), `a ${rank} of ${age} is dressed as a child (${c})`);
  else {
    // A royal teen wears royal dress drawn for their age; while all of it is grown-up dress, their own clothes.
    const list = rank === 'monarch' ? CUR.ROYAL.outfits.monarch[g] : CUR.ROYAL.outfits[g];
    if (list.some((x) => !CUR.ROYAL.grownOnly.includes(x))) check(list.includes(c), `a ${rank} of ${age} still wears royal dress (${c})`);
    else check(c === look.clothes, `a ${rank} of ${age}, with no royal dress for their age, wears their own clothes (${c})`);
  }
}

// The noblewoman's cameo dress: for titled women of the nobility only.
{
  const id = 'outfit_48_noble_cameo';
  check(PART_BY_ID[id]?.tags?.royal && !CATALOG.outfit.some((o) => o.id === id), 'the noblewoman\'s dress is tagged, and nobody can choose it');
  const her = resolveLook(randomAppearance(undefined, 'female'), 'cameo', 'female');
  const him = resolveLook(randomAppearance(undefined, 'male'), 'cameo', 'male');
  check(dressFor(her, { age: 40, gender: 'female', royal: { rank: 'noble' } }).clothes === id, 'a noblewoman wears it');
  check(dressFor(her, { age: 40, gender: 'female', royal: { rank: 'noble' } }).crown === CUR.ROYAL.crowns.noble, 'with her coronet');
  check(dressFor(him, { age: 40, gender: 'male', royal: { rank: 'noble' } }).clothes !== id, 'a nobleman does not');
  check(dressFor(him, { age: 40, gender: 'male', royal: { rank: 'noble' } }).clothes === 'outfit_49_noble_cravat', 'a nobleman wears the cravat coat');
  check(dressFor(him, { age: 16, gender: 'male', royal: { rank: 'noble' } }).clothes !== 'outfit_49_noble_cravat', 'a noble boy does not');
  check(dressFor(him, { age: 40, gender: 'male' }).clothes !== 'outfit_49_noble_cravat' && dressFor(him, { age: 40, gender: 'male', royal: { rank: 'royal' } }).clothes !== 'outfit_49_noble_cravat', 'nor a commoner, nor a prince');
  check(!CATALOG.outfit.some((o) => o.id === 'outfit_49_noble_cravat'), 'nobody can choose the cravat coat');
  check(dressFor(her, { age: 15, gender: 'female', royal: { rank: 'noble' } }).clothes !== id, 'a noble girl does not');
  check(dressFor(her, { age: 40, gender: 'female' }).clothes !== id && dressFor(her, { age: 40, gender: 'female', royal: { rank: 'royal' } }).clothes !== id, 'nor a commoner, nor a princess');
}

// A duke's or a duchess's coat: by title, not by being noble.
{
  const id = 'outfit_50_duke_mantle';
  const { royalDress } = await import('../js/avatar/render.js');
  check(PART_BY_ID[id]?.tags?.royal && !CATALOG.outfit.some((o) => o.id === id), 'the duke\'s coat is tagged, and nobody can choose it');
  check(JSON.stringify(royalDress('duke')) === JSON.stringify({ rank: 'noble', title: 'duke' }) && royalDress('royal').rank === 'royal', 'the portrait knows a noble\'s title');
  for (const g of ['male', 'female']) {
    const look = resolveLook(randomAppearance(undefined, g), 'duke', g);
    check(dressFor(look, { age: 45, gender: g, royal: royalDress('duke') }).clothes === id, `a ${g === 'male' ? 'duke' : 'duchess'} wears it`);
    check(dressFor(look, { age: 45, gender: g, royal: royalDress('duke') }).crown === CUR.ROYAL.crowns.noble, 'with the coronet');
    check(dressFor(look, { age: 45, gender: g, royal: royalDress('earl') }).clothes !== id, `an ${g === 'male' ? 'earl' : 'countess'} does not`);
    check(dressFor(look, { age: 16, gender: g, royal: royalDress('duke') }).clothes !== id, 'a young heir to a dukedom does not');
  }
}

// The imperial fan-collar gown: for a reigning queen or empress, grown up.
{
  const id = 'outfit_51_imperial_fan_collar';
  check(PART_BY_ID[id]?.tags?.royal && !CATALOG.outfit.some((o) => o.id === id), 'the imperial gown is tagged, and nobody can choose it');
  check(CUR.ROYAL.outfits.monarch.female.includes(id) && !CUR.ROYAL.outfits.monarch.male.includes(id), 'a queen may wear it, a king not');
  check(!CUR.ROYAL.outfits.female.includes(id) && CUR.ROYAL.grownOnly.includes(id), 'nor a princess, nor a child');
  const look = { ...resolveLook(randomAppearance(undefined, 'female'), 'imp', 'female'), monarchOutfit: id };
  check(dressFor(look, { age: 40, gender: 'female', royal: { rank: 'monarch' } }).clothes === id, 'a reigning queen wears it');
  check(dressFor(look, { age: 15, gender: 'female', royal: { rank: 'monarch' } }).clothes !== id, 'a girl on the throne does not');
  // Placed by its shoulders: the gown reaches the bottom of the portrait, and its collar rises beside the face.
  const svg = readFileSync(new URL('../assets/' + PART_BY_ID[id].file, import.meta.url), 'utf8');
  const ys = [...svg.matchAll(/[MLCQ]\s*[-\d.]+[ ,]([-\d.]+)/g)].map((m) => +m[1]);
  check(Math.max(...ys) >= 512 && Math.min(...ys) < 380, `the gown reaches the bottom and its collar rises beside the face (${Math.min(...ys)}–${Math.max(...ys)})`);
}

// The starlight princess gown: for grown princesses only.
{
  const id = 'outfit_52_princess_starlight';
  check(PART_BY_ID[id]?.tags?.royal && !CATALOG.outfit.some((o) => o.id === id), 'the starlight gown is tagged, and nobody can choose it');
  check(CUR.ROYAL.outfits.female.includes(id) && !CUR.ROYAL.outfits.male.includes(id) && CUR.ROYAL.grownOnly.includes(id), 'it is a grown princess\'s gown');
  const look = { ...resolveLook(randomAppearance(undefined, 'female'), 'star', 'female'), royalOutfit: id };
  check(dressFor(look, { age: 22, gender: 'female', royal: { rank: 'royal' } }).clothes === id, 'a princess of 22 wears it');
  check(dressFor(look, { age: 14, gender: 'female', royal: { rank: 'royal' } }).clothes !== id, 'a princess of 14 does not');
}

// The imperial ruby gown: for a reigning queen or empress, grown up.
{
  const id = 'outfit_53_imperial_ruby';
  check(PART_BY_ID[id]?.tags?.royal && !CATALOG.outfit.some((o) => o.id === id), 'the ruby gown is tagged, and nobody can choose it');
  check(CUR.ROYAL.outfits.monarch.female.includes(id) && !CUR.ROYAL.outfits.monarch.male.includes(id) && !CUR.ROYAL.outfits.female.includes(id) && CUR.ROYAL.grownOnly.includes(id), 'a grown queen\'s gown, not a king\'s or a princess\'s');
  const look = { ...resolveLook(randomAppearance(undefined, 'female'), 'ruby', 'female'), monarchOutfit: id };
  check(dressFor(look, { age: 40, gender: 'female', royal: { rank: 'monarch' } }).clothes === id, 'a reigning queen wears it');
  check(dressFor(look, { age: 15, gender: 'female', royal: { rank: 'monarch' } }).clothes !== id, 'a girl on the throne does not');
}

// Outfits fitted to the body (scripts/snap-clothes.mjs, js/avatar/clothesSnap.js): only a little smaller and lower, and
// the portrait draws them so.
const { CLOTHES_SNAP: SNAP } = await import('../js/avatar/clothesSnap.js');
{
  for (const [id, k] of Object.entries(SNAP)) {
    check(PART_BY_ID[id] && k.s >= 0.7 && k.s <= 1 && k.dy >= 0 && k.dy <= 8, `${id} is fitted sensibly (${JSON.stringify(k)})`);
    const look = { ...resolveLook(randomAppearance(undefined, 'female'), 'fit', 'female'), clothes: id };
    const svg = characterAvatarSvg(look, { age: 30, gender: 'female' });
    check(svg.includes(`scale(${k.s}) translate(-256 -${AVATAR_TEMPLATE.clothesTop})`), `${id} is drawn fitted`);
  }
  check(!SNAP.outfit_57_polo_shirt, 'an outfit drawn to the body is drawn as it was');
}

// Every royal and noble outfit reaches past the bottom of the lowest portrait (the broadest face shows down to about 524),
// so no shoulder ever shows beneath one.
{
  const { frameFor } = await import('../js/avatar/hairFit.js');
  const lowest = Math.max(...Object.values(PART_BY_ID).filter((p) => p.id.startsWith('head_')).map((p) => { const f = frameFor(p.id); return f.y + f.size; }));
  const dress = [...new Set([...CUR.ROYAL.outfits.female, ...CUR.ROYAL.outfits.male, ...Object.values(CUR.ROYAL.outfits.monarch).flat(), ...Object.values(CUR.ROYAL.outfits.noble).flat(),
    ...Object.values(CUR.ROYAL.outfits.nobleByTitle).flatMap((x) => Object.values(x).flat())])];
  for (const id of dress) {
    const svg = readFileSync(new URL('../assets/' + PART_BY_ID[id].file, import.meta.url), 'utf8');
    const drawn = Math.max(...[...svg.matchAll(/[MLCQ]\s*[-\d.]+[ ,]([-\d.]+)/g)].map((m) => +m[1]));
    // As fitted to the body (scripts/snap-clothes.mjs): shrunk about the top of the outfit, and moved down.
    const k = SNAP[id] ?? { s: 1, dy: 0 };
    const bottom = AVATAR_TEMPLATE.clothesTop + (drawn - AVATAR_TEMPLATE.clothesTop) * k.s + k.dy;
    check(bottom >= lowest + 2, `${id} reaches past the bottom of every portrait (${bottom.toFixed(0)}, needs ${Math.ceil(lowest + 2)})`);
  }
}

// Children (to 13, the kid head) wear children's clothes, never a grown-up's; from 14, their own style. The children's and
// babies' clothes are being redrawn: until they are added, a child under 13 (royal or not) is drawn with no outfit.
{
  for (const g of ['male', 'female']) for (const s of ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']) {
    const look = { ...resolveLook(randomAppearance(undefined, g), s, g), clothes: 'outfit_55_zip_hoodie' };
    for (const age of [0, 2, 3, 6, 7, 9, 13]) {
      const c = dressFor(look, { age, gender: g }).clothes;
      check(c == null || [...CUR.KID_OUTFITS.any, ...CUR.KID_OUTFITS[g], ...CUR.OUTFITS.baby].includes(c), `a child of ${age} wears no grown-up's clothes (${c})`);
      check(dressFor(look, { age, gender: g, career: { id: 'police' } }).clothes === c, 'and no uniform');
      const r = dressFor(look, { age, gender: g, royal: { rank: 'royal' } });
      check(r.clothes === c || (age < 7 && CUR.ROYAL.outfits.baby.includes(r.clothes)) || (age >= 7 && [...(CUR.ROYAL.outfits.kid[g] ?? []), CUR.ROYAL.outfits.kidHeir?.[g]].includes(r.clothes)), `a royal child of ${age} is dressed as a child (${r.clothes})`);
    }
    check(dressFor(look, { age: 14, gender: g }).clothes === 'outfit_55_zip_hoodie', 'from 14, their own style');
  }
  check(![...CUR.KID_OUTFITS.any, ...CUR.KID_OUTFITS.female, ...CUR.KID_OUTFITS.male, ...CUR.OUTFITS.baby].some((id) => !PART_BY_ID[id]), 'every children\'s outfit listed exists');
}

const { CHILD_CLOTHES_FIT: CHILD_FIT, CHILD_NECKLINE: CHILD_NECK } = await import('../js/avatar/childClothesFit.js');
// Baby clothes, drawn on the baby head's own template: worn from birth to 6, placed exactly as drawn (no refitting),
// in the colors they were drawn in.
{
  for (const id of CUR.OUTFITS.baby) {
    check(PART_BY_ID[id], `${id} exists`);
    const svg = readFileSync(new URL('../assets/' + PART_BY_ID[id].file, import.meta.url), 'utf8');
    check(!svg.includes('var(--outfit-color'), `${id} keeps the colors it was drawn in`);
    const look = { ...resolveLook(randomAppearance(undefined, 'female'), 'babyfit', 'female'), babyClothes: id };
    for (const age of [0, 2, 3, 6]) check(dressFor(look, { age, gender: 'female' }).clothes === id, `a child of ${age} wears ${id}`);
    check(dressFor(look, { age: 7, gender: 'female' }).clothes !== id, `a child of 7 does not wear ${id}`);
    const out = characterAvatarSvg(look, { age: 1, gender: 'female' });
    const use = out.match(new RegExp(`<use href="[^"]*${id}[^"]*"([^/]*)/>`));
    // Not moved under the chin like a grown-up's outfit: at most widened about its own neckline to cover the shoulders.
    const fit = CHILD_FIT[id];
    check(use && (fit ? use[1].includes(`scale(${fit.sx} ${fit.sy})`) && use[1].includes(`translate(${CHILD_NECK.baby.x} ${CHILD_NECK.baby.y})`) : !/transform/.test(use[1])),
      `${id} is drawn where it was drawn, fitted only about its neckline (${use?.[1]})`);
    if (fit) check(fit.sx >= 1 && fit.sx <= 1.6 && fit.sy >= 1 && fit.sy <= 1.2, `${id} is fitted sensibly (${JSON.stringify(fit)})`);
  }
}

const { BABY_HAIR_FIT: BABY_FIT } = await import('../js/avatar/babyHairFit.js');
// Baby hair, by texture, drawn on the baby template: worn under 3, placed as drawn, in the baby's own hair color.
{
  for (const [tex, ids] of Object.entries(CUR.BABY_HAIR_BY_TEXTURE)) for (const id of ids) {
    check(PART_BY_ID[id], `${id} exists`);
    const svg = readFileSync(new URL('../assets/' + PART_BY_ID[id].file, import.meta.url), 'utf8');
    check(svg.includes('var(--hair-color'), `${id} takes the baby's hair color`);
    const look = { ...resolveLook({ v: 3, inherited: { hairTexture: tex } }, 'bh', 'female'), babyHair: id };
    check(dressFor(look, { age: 1, gender: 'female' }).hair === id && dressFor(look, { age: 4, gender: 'female' }).hair !== id, `${id} is a baby's (${tex})`);
    const out = characterAvatarSvg(look, { age: 1, gender: 'female' });
    // Snapped onto the head (scripts/fit-baby-hair.mjs): at most a little wider or taller, about where the hair ends.
    const bf = BABY_FIT[id];
    check(bf ? out.includes(`scale(${bf.sx} ${bf.sy})`) && bf.sx >= 0.9 && bf.sx <= 1.15 && bf.sy >= 0.9 && bf.sy <= 1.15
      : new RegExp(`<g clip-path="[^"]*"><use href="[^"]*${id}`).test(out), `${id} is snapped onto the head (${JSON.stringify(bf)})`);
  }
}

// Royal children of 7 to 13 (the kid head) wear the royal kids' outfits drawn for them: princes the prince's tunic.
{
  for (const g of ['male', 'female']) for (const rank of ['royal', 'heir']) for (const age of [7, 10, 13]) {
    const c = dressFor(resolveLook(randomAppearance(undefined, g), 'rk' + age, g), { age, gender: g, royal: { rank } }).clothes;
    const list = CUR.ROYAL.outfits.kid[g] ?? [];
    const heir = rank === 'heir' && CUR.ROYAL.outfits.kidHeir?.[g];
    check(heir ? c === heir : list.length ? list.includes(c) : !CUR.ROYAL.grownOnly.includes(c), `a royal ${g === 'male' ? 'boy' : 'girl'} of ${age} (${rank}) wears ${c}`);
  }
  check(dressFor(resolveLook(randomAppearance(undefined, 'male'), 'rk', 'male'), { age: 9, gender: 'male' }).clothes !== 'outfit_kid_01_royal_tunic', 'a boy who is not royal does not wear the prince\'s tunic');
}

// Noble children of 7 to 13 wear the plainer royal kids' outfits, never one with a crown, sash or ermine.
{
  const princely = ['outfit_kid_02_royal_sailor', 'outfit_kid_04_royal_ceremonial', 'outfit_kid_05_royal_velvet_cape', 'outfit_kid_06_heir_jacket',
    'outfit_kid_07_princess_dress', 'outfit_kid_09_princess_pinafore', 'outfit_kid_10_princess_ceremonial', 'outfit_kid_11_princess_capelet', 'outfit_kid_12_heir_princess_starry'];
  for (const g of ['male', 'female']) for (const s of ['n1', 'n2', 'n3', 'n4', 'n5']) for (const age of [7, 10, 13]) {
    const c = dressFor(resolveLook(randomAppearance(undefined, g), s, g), { age, gender: g, royal: { rank: 'noble', title: 'earl' } }).clothes;
    check(CUR.ROYAL.outfits.nobleKid[g].includes(c) && !princely.includes(c), `a noble ${g === 'male' ? 'boy' : 'girl'} of ${age} wears ${c}`);
  }
}

// What someone looks like as a baby and as a child can be chosen in the editor's Baby and Child views: kept in the save,
// worn at that age, and only then.
{
  const base = randomAppearance(undefined, 'female');
  const babyHair = CATALOG.babyHair.find((h) => h.id !== resolveLook(base, 'bk', 'female').babyHair)?.id;
  const kidHair = CATALOG.kidHair.find((h) => h.id !== base.style.hair)?.id;
  const babyOutfit = CATALOG.babyOutfit.at(-1)?.id;
  const a = normalize({ ...base, style: { ...base.style, babyHair, kidHair, babyOutfit } }, 'bk');
  check(a.style.babyHair === babyHair && a.style.kidHair === kidHair && a.style.babyOutfit === babyOutfit, 'a baby\'s or child\'s chosen look is not kept in the save');
  const look = resolveLook(a, 'bk', 'female');
  if (babyHair) check(dressFor(look, { age: 1, gender: 'female' }).hair === babyHair, 'the chosen baby hair is not worn as a baby');
  if (babyOutfit) check(dressFor(look, { age: 1, gender: 'female' }).clothes === babyOutfit, 'the chosen baby outfit is not worn as a baby');
  if (kidHair) check(dressFor(look, { age: 9, gender: 'female' }).hair === kidHair && dressFor(look, { age: 30, gender: 'female' }).hair !== kidHair || base.style.hair === kidHair, 'the chosen child\'s hairstyle is not worn as a child only');
  check(normalize({ ...base, style: { ...base.style, babyHair: 'nonsense' } }, 'bk').style.babyHair === null, 'an unknown baby hairstyle is kept');
}

if (problems.length) {
  console.log([...new Set(problems)].slice(0, 30).join('\n'));
  console.log(`${problems.length} problem(s).`);
  process.exit(1);
}
console.log(`The avatar system is sound: ${ids.length} parts, every save format loads, families hold together; ${hairs.length} hairstyles fit ${grown.length} heads (widest gap ${worstGap}).`);
