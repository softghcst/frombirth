// Special careers: one at a time. Acting, music, dance, modeling, writing, sports, K-pop and politics are careers;
// taking one up (a band, an audition, a contract, a run for office) claims it, and the others wait until it is left.
//   node tests/special-careers.mjs
import { store } from '../js/state.js';
import { createLife } from '../js/engine/characterGen.js';
import * as music from '../js/engine/music.js';
import * as sc from '../js/engine/specialCareer.js';
import * as career from '../js/engine/career.js';
import { CAREER_BY_ID } from '../js/data/careers.js';

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
  check(sc.SPECIAL_CAREERS.length === 9, 'nine special careers');
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

{
  // A special career is the work: no other job beside it, and a job has to be left to take one up.
  const p = life();
  music.formAct('solo');
  const tried = career.startApplication('teacher');
  check(tried.kind === 'blocked' && /You are a musician/.test(tried.text), `a musician cannot apply to be a teacher (${tried.text})`);
  check(!career.finishApplication('teacher', [2, 2, 2]).ok && !p.career.careerId, 'nor be hired as one');
  music.leaveAct();
  check(sc.current() === null && !/You are a musician/.test(career.startApplication('teacher').text ?? ''), 'leaving music opens other work again');
  career.hire(CAREER_BY_ID.teacher, 0, 50, 'Hired.');
  const r = music.formAct('solo');
  check(!r.ok && /quit your job first/.test(r.text), `someone with a job has to quit it to start a music career (${r.text})`);
  career.quitCareer();
  check(music.formAct('solo').ok, 'and then can');
  const teen = life(16);
  check(sc.jobBlock('cashier', teen, undefined, { partTime: true }) === '', 'a teenager can still have a part-time job');
  section('a special career is the job: other work waits until it is left');
}

{
  // Medicine has its own doors (the match, hospital posts, fellowships): a special career closes them too.
  const p = life(27);
  music.formAct('solo');
  const tr = await import('../js/engine/medicine/training.js');
  const jobs = await import('../js/engine/medicine/jobs.js');
  const core = await import('../js/engine/medicine/core.js');
  core.M();
  const m = tr.runMatch('residency', ['internal']);
  check(!m.ok && /musician/.test(m.text) && p.career.careerId == null, `a musician is not matched to a residency (${m.text})`);
  check(!jobs.applyFor('nowhere').ok && /musician/.test(jobs.applyFor('nowhere').text), 'nor applies for a hospital post');
  check(!tr.startPost('internal', 'nowhere').ok && p.career.careerId == null, 'nor is given one');
  section('medicine waits too: no residency or hospital post beside a special career');
}

for (const m of ok) console.log(`ok   ${m}`);
if (problems.length) { console.log(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('One career at a time.');
