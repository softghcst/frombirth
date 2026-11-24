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
  check(dressFor(look, { age: 40, gender, royal: royalDress('monarch') }).crown === 'crown_09_sovereign', `a reigning ${gender} monarch wears the sovereign's crown`);
  check(dressFor(look, { age: 40, gender, royal: royalDress('monarch', true) }).crown !== 'crown_09_sovereign', `a ${gender} consort does not`);
  check(dressFor(look, { age: 40, gender, royal: royalDress('consort') }).crown !== 'crown_09_sovereign', `a ${gender} consort (by dynasty rank) does not`);
  for (const rank of ['heir', 'royal', 'noble', 'knight']) check(dressFor(look, { age: 40, gender, royal: royalDress(rank) }).crown !== 'crown_09_sovereign', `a ${gender} ${rank} does not`);
}
// Princesses wear the tiara at every age; princes and kings never do.
{
  const her = resolveLook({}, 'tiara-f', 'female'); const him = resolveLook({}, 'tiara-m', 'male');
  for (const rank of ['heir', 'royal']) for (const age of [0, 3, 8, 25, 70]) {
    check(dressFor(her, { age, gender: 'female', royal: royalDress(rank) }).crown === 'crown_10_princess_tiara', `a ${age}-year-old princess (${rank}) wears the tiara`);
    check(dressFor(him, { age, gender: 'male', royal: royalDress(rank) }).crown === 'crown_11_prince_band', `a ${age}-year-old prince (${rank}) wears the prince's band`);
    check(dressFor(her, { age, gender: 'female', royal: royalDress(rank) }).crown !== 'crown_11_prince_band', `a ${age}-year-old princess (${rank}) does not`);
  }
  check(!['crown_10_princess_tiara', 'crown_11_prince_band'].includes(dressFor(him, { age: 40, gender: 'male', royal: royalDress('monarch') }).crown), 'a king wears neither');
}
const sov = MANIFEST.crowns.find((c) => c.id === 'crown_09_sovereign');
check(sov && existsSync(new URL(`../assets/${sov.file}`, import.meta.url)), 'the sovereign crown is in the manifest and on disk');
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log('Every royal wears a crown, from birth.');
