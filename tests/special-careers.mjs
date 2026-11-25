// Special careers: one at a time. Acting, music, dance, modeling, writing, sports, K-pop and politics are careers;
// taking one up (a band, an audition, a contract, a run for office) claims it, and the others wait until it is left.
//   node tests/special-careers.mjs
import { store } from '../js/state.js';
import { createLife } from '../js/engine/characterGen.js';
import * as music from '../js/engine/music.js';
import * as sc from '../js/engine/specialCareer.js';

const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const life = (age = 22) => {
  let s; do { s = createLife({ countryId: 'us' }); } while (s.player.royal);
  store.state = s;
  const p = s.player;
  p.age = age; p.education.enrolled = false; p.education.stage = 'none'; p.flags.livesWithParents = false;
  p.talents.music = 80; p.talents.singing = 80; p.finance.cash = 100000;
  return p;
};

{
  const p = life();
  check(sc.current() === null, 'a new life has no special career');
  check(music.formAct('solo').ok && sc.current() === 'music', `forming an act makes music the career (${sc.current()})`);
  check(/One special career at a time/.test(sc.whyNot('acting')) && sc.whyNot('music') === '', 'acting waits while music is the career');
  check(sc.claim('sports') !== '', 'and so does sport');
  check(sc.SPECIAL_CAREERS.length === 8, 'eight special careers');
  const r = sc.leave();
  check(r.ok && sc.current() === null && p.flags.specialPast?.[0]?.id === 'music', 'leaving it is recorded');
  check(sc.claim('acting') === '' && sc.current() === 'acting', 'then another can be taken up');
  check(/leave acting first/.test(sc.whyNot('music')), 'and music waits in turn');
  section('one special career at a time: claimed by taking it up, kept until it is left');
}

{
  // An older save, already in a band, is given that career.
  const p = life();
  music.formAct('solo');
  delete p.flags.special;
  check(sc.current() === 'music', `an older save's band is its career (${sc.current()})`);
  section('older saves: what they were already doing');
}

for (const m of ok) console.log(`ok   ${m}`);
if (problems.length) { console.log(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('One career at a time.');
