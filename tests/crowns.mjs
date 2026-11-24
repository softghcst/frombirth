// Royals wear crowns: every member of a royal family at every age, a coronet for the peerage once grown, none in prison.
// Run with: node tests/crowns.mjs
import { dressFor } from '../js/CharacterAvatar.js';
import { resolveLook } from '../js/avatar/catalog.js';

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
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log('Every royal wears a crown, from birth.');
