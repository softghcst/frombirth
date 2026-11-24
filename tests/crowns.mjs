// Royals wear crowns: every member of a royal family at every age, a coronet for the peerage once grown, none in prison.
// Run with: node tests/crowns.mjs
import { dressFor } from '../js/CharacterAvatar.js';
import { resolveLook } from '../js/avatar/catalog.js';
import { royalDress } from '../js/avatar/render.js';
import { AVATAR_MANIFEST as MANIFEST } from '../js/avatarManifest.js';
import { existsSync } from 'node:fs';

const problems = [];
const check = (ok, what) => { if (!ok) problems.push(what); };
for (const gender of ['male', 'female']) {
  const look = resolveLook({}, `crown-${gender}`, gender);
  for (const rank of ['monarch', 'heir', 'royal']) {
    for (const age of [0, 1, 3, 8, 15, 30, 70]) {
      const d = dressFor(look, { age, gender, royal: { rank } });
      check(/^crown_/.test(d.crown ?? ''), `a ${age}-year-old ${gender} ${rank} wears a crown (${d.crown})`);
    }
  }
  check(dressFor(look, { age: 30, gender, royal: { rank: 'monarch' } }).crown !== dressFor(look, { age: 30, gender, royal: { rank: 'royal' } }).crown,
    `a ${gender} monarch's crown is not the same as a prince or princess's`);
  check(/coronet/.test(dressFor(look, { age: 40, gender, royal: { rank: 'noble' } }).crown ?? ''), `a grown ${gender} noble wears a coronet`);
  check(!dressFor(look, { age: 30, gender, royal: { rank: 'monarch' }, jailed: true }).crown, `no crown in prison (${gender})`);
  check(!dressFor(look, { age: 30, gender }).crown, `no crown for a commoner (${gender})`);
}
// The sovereign's crown is worn by the one who reigns, king or queen, and by no one else.
for (const gender of ['male', 'female']) {
  const look = resolveLook({}, `sov-${gender}`, gender);
  check(dressFor(look, { age: 40, gender, royal: royalDress('monarch') }).crown === (gender === 'male' ? 'crown_09_sovereign' : 'crown_15_queen'), `a reigning ${gender} monarch wears the ${gender === 'male' ? "sovereign's" : "queen's"} crown`);
  check(dressFor(look, { age: 40, gender, royal: royalDress('monarch', true) }).crown !== 'crown_09_sovereign', `a ${gender} consort does not`);
  check(dressFor(look, { age: 40, gender, royal: royalDress('consort') }).crown !== 'crown_09_sovereign', `a ${gender} consort (by dynasty rank) does not`);
  for (const rank of ['heir', 'royal', 'noble', 'knight']) check(dressFor(look, { age: 40, gender, royal: royalDress(rank) }).crown !== 'crown_09_sovereign', `a ${gender} ${rank} does not`);
}
// Princesses wear the tiara at every age; princes and kings never do.
{
  const her = resolveLook({}, 'tiara-f', 'female'); const him = resolveLook({}, 'tiara-m', 'male');
  for (const rank of ['heir', 'royal']) for (const age of [0, 3, 8, 25, 70]) {
    const want = rank === 'heir' ? 'crown_16_crown_princess' : 'crown_10_princess_tiara';
    check(dressFor(her, { age, gender: 'female', royal: royalDress(rank) }).crown === want, `a ${age}-year-old princess (${rank}) wears ${want}`);
    const his = rank === 'heir' ? 'crown_17_crown_prince' : 'crown_11_prince_band';
    check(dressFor(him, { age, gender: 'male', royal: royalDress(rank) }).crown === his, `a ${age}-year-old prince (${rank}) wears ${his}`);
    check(dressFor(her, { age, gender: 'female', royal: royalDress(rank) }).crown !== 'crown_11_prince_band', `a ${age}-year-old princess (${rank}) does not`);
  }
  check(!['crown_10_princess_tiara', 'crown_11_prince_band'].includes(dressFor(him, { age: 40, gender: 'male', royal: royalDress('monarch') }).crown), 'a king wears neither');
}
// An empress (Japan) wears the empress's crown, reigning or by marriage; the emperor wears the sovereign's.
{
  const her = resolveLook({}, 'emp-f', 'female'); const him = resolveLook({}, 'emp-m', 'male');
  check(dressFor(her, { age: 50, gender: 'female', royal: royalDress('monarch', true, 'jp') }).crown === 'crown_12_empress', 'the Empress consort of Japan wears the empress crown');
  check(dressFor(her, { age: 50, gender: 'female', royal: royalDress('consort', false, 'jp') }).crown === 'crown_12_empress', 'and so in the dynasty view');
  check(dressFor(her, { age: 50, gender: 'female', royal: royalDress('monarch', false, 'jp') }).crown === 'crown_12_empress', 'a reigning empress wears it too');
  check(dressFor(him, { age: 50, gender: 'male', royal: royalDress('monarch', false, 'jp') }).crown === 'crown_14_imperial_laurel', 'the Emperor wears the imperial laurel');
  check(dressFor(him, { age: 50, gender: 'male', royal: royalDress('monarch', false, 'uk') }).crown !== 'crown_14_imperial_laurel', 'a king does not');
  check(dressFor(her, { age: 50, gender: 'female', royal: royalDress('monarch', true, 'gb') }).crown !== 'crown_12_empress', 'a queen consort elsewhere does not');
  check(dressFor(her, { age: 25, gender: 'female', royal: royalDress('royal', false, 'jp') }).crown === 'crown_10_princess_tiara', 'a princess of Japan keeps her tiara');
}
// The obsidian sovereign crown: a reigning monarch who holds real power (an absolute or executive monarchy).
{
  const him = resolveLook({}, 'obs-m', 'male'); const her = resolveLook({}, 'obs-f', 'female');
  for (const c of ['sa', 'ae', 'qa', 'ma', 'jo', 'kw', 'mc']) check(dressFor(him, { age: 55, gender: 'male', royal: royalDress('monarch', false, c) }).crown === 'crown_13_obsidian_sovereign', `the reigning monarch of ${c} wears the obsidian crown`);
  for (const c of ['uk', 'se', 'nl', 'th', null]) check(dressFor(him, { age: 55, gender: 'male', royal: royalDress('monarch', false, c) }).crown === 'crown_09_sovereign', `the reigning monarch of ${c} wears the gold sovereign crown`);
  check(dressFor(her, { age: 55, gender: 'female', royal: royalDress('monarch', true, 'sa') }).crown !== 'crown_13_obsidian_sovereign', 'a consort there does not');
  check(dressFor(him, { age: 30, gender: 'male', royal: royalDress('heir', false, 'sa') }).crown === 'crown_17_crown_prince', 'nor does the crown prince');
}
// Queens, reigning or by marriage, wear the queen's crown; in a realm where the monarch rules, a reigning queen wears obsidian.
{
  const her = resolveLook({}, 'q-f', 'female');
  check(dressFor(her, { age: 50, gender: 'female', royal: royalDress('monarch', true, 'uk') }).crown === 'crown_15_queen', 'a queen consort wears the queen crown');
  check(dressFor(her, { age: 50, gender: 'female', royal: royalDress('monarch', false, 'uk') }).crown === 'crown_15_queen', 'a reigning queen wears it too');
  check(dressFor(her, { age: 50, gender: 'female', royal: royalDress('consort', false, 'se') }).crown === 'crown_15_queen', 'and so in the dynasty view');
  check(dressFor(her, { age: 50, gender: 'female', royal: royalDress('monarch', false, 'mc') }).crown === 'crown_13_obsidian_sovereign', 'a woman who rules Monaco wears obsidian');
  check(dressFor(her, { age: 25, gender: 'female', royal: royalDress('heir', false, 'uk') }).crown === 'crown_16_crown_princess', 'a crown princess wears the crown princess tiara');
}
const sov = MANIFEST.crowns.find((c) => c.id === 'crown_09_sovereign');
check(sov && existsSync(new URL(`../assets/${sov.file}`, import.meta.url)), 'the sovereign crown is in the manifest and on disk');
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log('Every royal wears a crown, from birth.');
