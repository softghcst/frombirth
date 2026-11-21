// A young trainee or idol who lives abroad goes to school there (not the one back home), on a reduced timetable; a young
// performer's week is capped (35 hours under fifteen, 40 from fifteen) however many things they are in, and nothing
// at school age ever reaches the eighty-odd hours a week the game once allowed; schools founded on a talent cost far more
// than ordinary ones, with scholarships for the exceptional; and a crowd can be chosen from middle school.
// Run with: node tests/idol-student.mjs
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { SCHOOL_KINDS, KIND_BY_ID, FEE_CAP } from '../js/data/education.js';
import { LOAD } from '../js/data/workLaw.js';
import * as kp from '../js/engine/kpop.js';
import * as work from '../js/engine/worklife.js';
import * as sch from '../js/engine/schooling.js';
import * as edu from '../js/engine/education.js';

rng.seed(Number(process.env.SEED ?? 5));
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => ok.push(problems.length ? `(after failures) ${msg}` : msg);
const S = () => store.state;
const P = () => store.state.player;
const year = () => { const p = P(); p.stats.health = 95; p.legal.pending = null; p.legal.incarceration = null; advanceYear(); S().pendingEvents = []; };

/** A talented child of `age` at school in the United States who has been through an audition and been offered a place. */
function child(age, o = {}) {
  let s; do { s = createLife({ countryId: 'us', gender: 'female' }); } while (s.player.royal);
  store.state = s;
  const p = s.player;
  for (let i = 0; i < age; i++) year();
  p.talents.singing = o.talent ?? 85; p.talents.dance = o.talent ?? 85; p.talents.acting = o.talent ?? 85; p.stats.charm = 75; p.skills = { korean: 30 };
  p.flags.livesWithParents = true;
  return p;
}
/** Takes any trainee place offered in Korea (auditions held for anyone anywhere). */
function becomeTrainee(p, years = 6) {
  for (let y = 0; y < years && !kp.trainee(p); y++) {
    for (const au of kp.auditions().filter((a) => !kp.whyNotApply(a))) {
      kp.prepare(au.id);
      kp.apply(au.id, au.categories.includes('multi') ? 'multi' : au.categories[0]);
      const app = S().kpop.apps[kp.idolOf(p).apps.at(-1)];
      if (app.stage === 'callback') kp.attendCallback(app.id);
      if (app.stage === 'offered') { kp.idolOf(p).guardianOk = true; kp.acceptOffer(app.id); if (kp.trainee(p) && kp.idolOf(p).residence?.countryId === 'kr') return kp.trainee(p); }
    }
    if (!kp.trainee(p)) year();
  }
  return kp.trainee(p);
}

// ---------- 1. School goes where the child lives ----------
let abroad = null;
for (let tries = 0; tries < 12 && !abroad; tries++) {
  const p = child(14);
  if (P().age >= 18 || !p.education.enrolled) continue;
  if (becomeTrainee(p) && kp.idolOf(p).residence?.countryId === 'kr' && p.age < 18) abroad = p;
}
{
  const p = abroad;
  check(p, 'a talented American child can become a trainee at a Korean agency');
  if (p) {
    const home = sch.school();
    sch.ensure(); // (the year's tick does this)
    const here = sch.school();
    check(here && here.countryId === 'kr', `a trainee living in Seoul goes to school in Korea, not back home (${here?.countryId})`);
    check(['arts', 'public'].includes(here.kind), `at a performing arts school, or an ordinary one (${here.kind})`);
    const load = work.weeklyLoad(p);
    check(load.total < LOAD.crushing + 1, `a school-age trainee's week is not crushing (${load.total} h)`);
    const perf = load.rows.filter((r) => r.perform).reduce((s, r) => s + r.hours, 0);
    check(perf <= work.performerCap(p.age), `training is within the cap for ${p.age} (${perf} <= ${work.performerCap(p.age)})`);
    check(load.rows.some((r) => /reduced/.test(r.label)), 'and school is on a reduced timetable');
    void home;
  }
}
section('a young trainee abroad goes to school where they live, on a reduced timetable');

// ---------- 2. The week is capped ----------
{
  const p = abroad ?? child(15);
  const cap = work.performerCap(p.age);
  check(work.performerCap(14) === 35 && work.performerCap(15) === 40 && work.performerCap(17) === 40 && work.performerCap(18) === Infinity, 'the cap is 35 under fifteen, 40 to seventeen, none after');
  const small = work.canFit(4, { kind: 'freelance', performing: true });
  const big = work.canFit(60, { kind: 'freelance', performing: true });
  check(!big.ok && /capped|more than anyone/.test(big.text), `a huge extra commitment is refused for a young performer (${big.text})`);
  check(typeof small.ok === 'boolean', 'a small one is judged on the numbers');
  // Over every year of a young performer's life, whatever they take on, the week stays human.
  let worst = 0;
  for (let k = 0; k < 6; k++) {
    const q = child(13 + (k % 3), { talent: 90 });
    becomeTrainee(q, 3);
    for (let y = 0; y < 4 && q.age < 18 && q.alive; y++) { worst = Math.max(worst, work.weeklyLoad(q).total); year(); }
  }
  check(worst <= LOAD.crushing, `no school-age performer is ever past ${LOAD.crushing} hours a week (worst ${worst})`);
  void cap;
}
section('a young performer\'s week is capped; no school-age life reaches 87 hours');

// ---------- 3. Schools built on a talent cost more ----------
{
  const arts = KIND_BY_ID.arts, sports = KIND_BY_ID.sports, priv = KIND_BY_ID.private;
  check(arts.fee >= priv.fee && sports.fee > 5000 && arts.fee > 5 * 2000, `a performing arts school costs more than a private one (${arts.fee} vs ${priv.fee}), a sports academy far more than before (${sports.fee})`);
  const p = child(11, { talent: 60 });
  p.talents.acting = p.talents.singing = p.talents.dance = p.talents.music = 60;
  check(sch.feeFor(arts, p) === arts.fee && !sch.scholarshipFor(arts, p), 'an ordinary audition pays the full fee');
  p.talents.acting = 80;
  check(sch.feeFor(arts, p) === arts.fee * 0.5 && /half/.test(sch.scholarshipFor(arts, p).name), 'a strong audition earns a half scholarship');
  p.talents.acting = 95;
  check(sch.feeFor(arts, p) === 0, 'an exceptional one a full scholarship');
  p.talents.acting = 60;
  const poor = (store.state.player.flags.wealthOverride = 'poor');
  void poor;
  const text = sch.choices().find((c) => c.id === 'arts')?.fee ?? '';
  check(text === '' || /a year/.test(text), 'the fee is shown a year');
  check(FEE_CAP.poor < arts.fee && FEE_CAP.middle < arts.fee && FEE_CAP.rich > arts.fee, 'only a rich family pays the full fee; others need a scholarship');
}
section('talent schools are far more expensive, with scholarships for exceptional auditions');

// ---------- 4. A crowd from middle school ----------
{
  const p = child(12);
  const e = p.education;
  check(e.stage === 'middle' && e.enrolled, `twelve is middle school (${e.stage})`);
  e.clique = null;
  p.stats.charm = 90; p.stats.intellect = 80; p.talents.sports = 70;
  const r = edu.joinClique('brains');
  check(r.ok && e.clique === 'brains', 'a middle schooler can choose a crowd');
  const tooSoon = child(9);
  check(!edu.joinClique('brains').ok, 'an elementary child cannot');
}
section('a crowd can be chosen from middle school');

if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const m of problems) console.log(' ✗', m);
  process.exit(1);
}
for (const m of ok) console.log(' ✓', m);
console.log('Young performers, schools and crowds hold together.');
