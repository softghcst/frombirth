// Checks the avatar system. Run with: node tests/avatar.mjs
//  - every part has a unique id and draws without errors
//  - ids already shipped are still present (so existing saves keep loading)
//  - children are built only from what their parents were born with
//  - old saves, missing data and unknown ids all load to a stable face
import { CATALOG, INHERITED_KEYS, STYLE_KEYS, normalize, part } from '../js/avatar/catalog.js';
import { avatarSvg } from '../js/avatar/render.js';
import { randomAppearance, inheritAppearance, ensureStyled, cloneAppearance } from '../js/avatar/inherit.js';
import { rng } from '../js/rng.js';

rng.seed(20240611);
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };

// Ids that have shipped. Add new ids to the catalogue freely; never remove one from this list.
const SHIPPED = {
  face: ['oval', 'round', 'square', 'heart', 'long', 'diamond'],
  skin: ['porcelain', 'ivory', 'rose_beige', 'sand', 'golden', 'olive', 'tan', 'bronze', 'chestnut', 'umber', 'espresso', 'ebony'],
  eyeShape: ['almond', 'round', 'hooded', 'upturned', 'downturned', 'monolid'],
  eyeColor: ['dark_brown', 'brown', 'hazel', 'amber', 'green', 'blue', 'gray'],
  brows: ['straight', 'straight_bold', 'soft_arch', 'soft_arch_bold', 'sharp_arch', 'sharp_arch_bold', 'rounded'],
  nose: ['button', 'narrow', 'wide', 'aquiline', 'rounded', 'upturned'],
  lips: ['thin', 'full', 'cupid', 'lower_full', 'wide', 'heart'],
  hairColor: ['black', 'dark_brown', 'brown', 'light_brown', 'auburn', 'ginger', 'dark_blonde', 'blonde'],
  hairTexture: ['straight', 'wavy', 'curly', 'coily'],
  marks: ['freckles', 'beauty_mark', 'dimples'],
  hair: ['bald', 'buzz', 'short_crop', 'side_part', 'pixie', 'waves', 'curls_tight', 'coils', 'braids', 'locs', 'bob', 'long_straight',
    'long_wavy', 'long_curly', 'ponytail', 'bun', 'puffs'],
  hairDye: ['black', 'dark_brown', 'brown', 'light_brown', 'auburn', 'ginger', 'dark_blonde', 'blonde', 'platinum', 'silver', 'pink', 'red',
    'purple', 'blue', 'teal', 'green'],
  glasses: ['round', 'square', 'cat_eye', 'aviator'],
  facialHair: ['stubble', 'moustache', 'goatee', 'beard', 'full_beard'],
  makeup: ['soft', 'defined', 'bold'],
  lipColor: ['rose', 'red', 'berry', 'coral', 'nude', 'black'],
};

// 1. The catalogue
let parts = 0;
for (const [key, list] of Object.entries(CATALOG)) {
  const ids = list.map((x) => x.id);
  parts += ids.length;
  check(new Set(ids).size === ids.length, `${key}: duplicate id`);
  check(list.every((x) => x.id && x.name), `${key}: a part is missing its id or name`);
  for (const id of SHIPPED[key] ?? []) check(ids.includes(id), `${key}: shipped id "${id}" has been removed; saves that use it would change`);
  check(SHIPPED[key], `${key}: add its ids to SHIPPED in tests/avatar.mjs`);
}

// 2. Every part draws, at every age
const base = normalize(null, 'base');
const bad = (svg) => /NaN|undefined|null\b/.test(svg) || !svg.startsWith('<svg') || !svg.endsWith('</svg>');
for (const [key, list] of Object.entries(CATALOG)) {
  for (const x of list) {
    const a = cloneAppearance(base);
    if (key === 'marks') a.inherited.marks = [x.id];
    else if (STYLE_KEYS.includes(key)) a.style[key] = x.id; else a.inherited[key] = x.id;
    for (const age of [0, 4, 10, 16, 30, 70, 90]) check(!bad(avatarSvg({ appearance: a, age, seed: 's', mood: 20 + age })), `${key}/${x.id} draws badly at age ${age}`);
  }
}
check(!bad(avatarSvg({ age: 30, seed: 'nobody' })), 'a character with no appearance draws badly');
check(!bad(avatarSvg({ age: 30, seed: 'jail', jailed: true })), 'the prison portrait draws badly');

// 3. Inheritance
let fromParents = 0; let total = 0; const combos = new Set(); let dyeLeaks = 0; let twins = 0;
for (let f = 0; f < 300; f++) {
  const mum = randomAppearance(rng.int(0, 11), 'female');
  const dad = randomAppearance(rng.int(0, 11), 'male');
  mum.style.hairDye = 'pink'; mum.style.hair = 'bob'; dad.style.hairDye = 'blue'; dad.style.glasses = 'round'; dad.style.facialHair = 'beard';
  const kids = [];
  for (let k = 0; k < 4; k++) {
    const child = ensureStyled(inheritAppearance(mum, dad), k % 2 ? 'male' : 'female');
    kids.push(JSON.stringify(child.inherited));
    for (const key of INHERITED_KEYS) {
      check(part(key, child.inherited[key]), `child has unknown ${key} "${child.inherited[key]}"`);
      total++;
      if (key === 'skin') {
        const [a, b, c] = [mum, dad, child].map((x) => part('skin', x.inherited.skin).depth);
        check(c >= Math.min(a, b) - 1 && c <= Math.max(a, b) + 1, `child's skin depth ${c} is outside the parents' ${a} and ${b}`);
        fromParents++;
      } else if (child.inherited[key] === mum.inherited[key] || child.inherited[key] === dad.inherited[key]) fromParents++;
    }
    if (child.style.hairDye || child.style.glasses || child.style.facialHair || child.style.makeup) dyeLeaks++;
    if (!part('hairColor', child.inherited.hairColor)) dyeLeaks++; // a dye colour must never become a natural colour
    check(child.style.hair && part('hair', child.style.hair), 'child has no haircut');
    combos.add(kids[k]);
  }
  if (new Set(kids).size < 4) twins++;
}
check(dyeLeaks === 0, `${dyeLeaks} children picked up a parent's styling`);
check(fromParents / total > 0.9, `only ${(fromParents / total * 100).toFixed(0)}% of features came from a parent`);
check(combos.size > 900, `siblings are not varied enough (${combos.size} distinct faces in 1,200 children)`);

// A parent restyled after the birth leaves the child as they were.
{ const mum = randomAppearance(2, 'female'); const dad = randomAppearance(9, 'male');
  const child = ensureStyled(inheritAppearance(mum, dad), 'female');
  const saved = JSON.stringify(child);
  mum.style.hairDye = 'green'; mum.style.hair = 'bald'; dad.style.glasses = 'aviator';
  check(JSON.stringify(child) === saved, 'restyling a parent changed their child');
  check(JSON.stringify(JSON.parse(saved)) === saved && JSON.stringify(normalize(JSON.parse(saved), 'x')) === JSON.stringify(normalize(child, 'x')), 'a child does not survive a save and reload unchanged'); }

// One parent, or none
{ const mum = randomAppearance(10, 'female');
  let near = 0; for (let i = 0; i < 200; i++) { const c = inheritAppearance(mum, null); if (Math.abs(part('skin', c.inherited.skin).depth - 10) <= 2) near++; }
  check(near > 170, `with one known parent, only ${near}/200 children resembled them in skin tone`);
  const orphan = ensureStyled(inheritAppearance(null, null), 'male');
  check(INHERITED_KEYS.every((k) => part(k, orphan.inherited[k])) && orphan.style.hair, 'a child with no known parents is incomplete'); }

// 4. Loading saves
{ const old = { skin: 4, hair: 1, hairStyle: 2, eyes: 1, weight: 50 };
  const a = normalize(old, 'npc_1'); const b = normalize(old, 'npc_1');
  check(JSON.stringify(a) === JSON.stringify(b), 'an old save does not load to the same face twice');
  check(a.inherited.skin === 'chestnut' && a.inherited.hairColor === 'brown' && a.inherited.eyeColor === 'blue' && a.style.hair === 'long_straight', 'an old save lost its colours or cut');
  check(JSON.stringify(normalize(a, 'someone-else')) === JSON.stringify(a), 'loading a current appearance changed it');
  const gap = normalize({ inherited: { face: 'no_such_face', skin: 'tan' }, style: { hair: 'removed_cut', hairDye: 'pink' } }, 'npc_2');
  check(part('face', gap.inherited.face) && part('hair', gap.style.hair) && gap.inherited.skin === 'tan' && gap.style.hairDye === 'pink', 'unknown ids were not replaced cleanly');
  check(JSON.stringify(normalize(undefined, 'npc_3')) === JSON.stringify(normalize(undefined, 'npc_3')), 'a missing appearance is not stable');
  check(JSON.stringify(normalize(undefined, 'npc_3')) !== JSON.stringify(normalize(undefined, 'npc_4')), 'every missing appearance gets the same face'); }

console.log(`${parts} avatar parts in ${Object.keys(CATALOG).length} groups; 1,200 children generated (${(fromParents / total * 100).toFixed(0)}% of features from a parent, ${combos.size} distinct faces, ${twins} families with look-alike siblings).`);
if (problems.length) { console.log([...new Set(problems)].slice(0, 30).join('\n')); process.exit(1); }
console.log('The avatar system is sound.');
