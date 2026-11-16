// University admissions and aid, checked on hand-built applicants.
// Run with: node tests/admissions.mjs
import { assess, meets, aid, outlook } from '../js/engine/admissions.js';
import { UNIVERSITY_KINDS, UNIVERSITY_KIND_BY_ID } from '../js/data/universities.js';

let failed = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { failed += 1; console.log(`FAIL ${name}\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`); } else console.log(`ok   ${name}`);
};
const yes = (name, cond) => eq(name, !!cond, true);
function seeded(seed) { let s = seed; const next = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; return (n) => (next() * 2 - 1) * n; }

const K = UNIVERSITY_KIND_BY_ID;
const history = { minGpa: 2.8, difficulty: 0.3 };
const acting = { minGpa: 2.0, audition: true };
const plain = { mark: 3.0, predicted: false, advanced: 0, recs: 0, activities: 40, statement: 0, audition: null, athlete: false, need: 0, firstInFamily: false, legacy: false, transfer: false };

yes('a regional university will consider a record others would not', assess({ ...plain, mark: 2.3 }, K.regional, history).outcome === 'accepted' && assess({ ...plain, mark: 2.3 }, K.research, history).outcome === 'rejected');
eq('an open university takes everyone', [assess({ ...plain, mark: 0.5 }, K.open, history).outcome, assess({ ...plain, mark: 4 }, K.open, history).outcome], ['accepted', 'accepted']);
eq('marks below the least a course will consider are turned away everywhere else', assess({ ...plain, mark: 2.2 }, K.research, history).outcome, 'rejected');
yes('better marks never hurt', [2.6, 3.0, 3.4, 3.8].every((m, i, all) => i === 0 || assess({ ...plain, mark: m }, K.research, history).score >= assess({ ...plain, mark: all[i - 1] }, K.research, history).score));
eq('the same record meets different answers at different places', ['regional', 'research', 'ancient'].map((k) => assess({ ...plain, mark: 3.3 }, K[k], history).outcome), ['accepted', 'accepted', 'rejected']);
yes('a strong candidate has a real chance at the hardest place, and no guarantee', (() => { const n = seeded(7); let ok = 0; for (let i = 0; i < 200; i++) if (assess({ ...plain, mark: 3.5, advanced: 1, recs: 1, activities: 60 }, K.ancient, history, n(0.15)).outcome === 'accepted') ok++; return ok > 60 && ok < 195; })());
yes('advanced courses, recommendations and a life outside lessons each help', ['advanced', 'recs'].every((k) => assess({ ...plain, [k]: 2 }, K.research, history).score > assess(plain, K.research, history).score) && assess({ ...plain, activities: 90 }, K.research, history).score > assess(plain, K.research, history).score);
yes('a statement can help or hurt a little, and no more', Math.abs(assess({ ...plain, statement: 2 }, K.research, history).score - assess({ ...plain, statement: -1 }, K.research, history).score) < 0.25);
yes('some places weigh what an applicant had to work with', assess({ ...plain, need: 2 }, K.ancient, history).score > assess(plain, K.ancient, history).score && assess({ ...plain, need: 2 }, K.technical, history).score === assess(plain, K.technical, history).score);
yes('a family name helps a little where that counts, and cannot carry a weak record', assess({ ...plain, mark: 3.7, legacy: true }, K.ancient, history).score > assess({ ...plain, mark: 3.7 }, K.ancient, history).score && assess({ ...plain, mark: 3.0, legacy: true }, K.ancient, history).outcome === 'rejected');
yes('a coach can ask for an athlete only where there are teams', assess({ ...plain, athlete: true }, K.research, history).score > assess(plain, K.research, history).score && assess({ ...plain, athlete: true }, K.college, history).score === assess(plain, K.college, history).score);
eq('still at school: an offer depends on the final marks', [assess({ ...plain, mark: 3.5, predicted: true }, K.research, history).outcome, typeof assess({ ...plain, mark: 3.5, predicted: true }, K.research, history).condition], ['conditional', 'number']);
eq('conditions are met, missed, or just waved through', [meets(3.0, 3.2), meets(3.0, 2.7), meets(3.0, 2.9, 0.1), meets(3.0, 2.9, -0.1)], [true, false, true, false]);
yes('a performance course is won in the room, not on paper', assess({ ...plain, mark: 2.4, audition: 95 }, K.conservatoire, acting).outcome === 'accepted' && assess({ ...plain, mark: 3.9, audition: 40 }, K.conservatoire, acting).outcome === 'rejected');
yes('every decision comes with reasons', UNIVERSITY_KINDS.every((k) => assess(plain, k, history).reasons.length > 0));
eq('a near miss with a strong record is asked to try again', assess({ ...plain, mark: 3.42 }, K.ancient, history, 0.28).outcome, 'deferred');

// Help with the cost.
{
  const top = aid({ ...plain, need: 0 }, K.regional, history, 0.9);
  eq('an outstanding applicant with no need gets a scholarship for merit, kept while marks hold', [top.parts.map((x) => x.kind), top.fraction, top.keep], [['merit'], 1, 2.5]);
  const poor = aid({ ...plain, need: 2 }, K.ancient, history, 0.2);
  eq('help for need does not depend on marks, and is not taken away for a bad year', [poor.parts.map((x) => x.kind), poor.fraction, poor.keep], [['need'], 1, 0]);
  eq('a comfortable family and an ordinary record get nothing', aid(plain, K.research, history, 0.2).fraction, 0);
  yes('awards for ability do not stack: the largest is given, with help for need on top', aid({ ...plain, athlete: true, need: 1 }, K.research, history, 0.9).parts.length === 2);
  let bad = 0;
  const n = seeded(11);
  for (let i = 0; i < 400; i++) {
    const a = { ...plain, mark: 2 + Math.abs(n(2)), athlete: n(1) > 0, need: Math.floor(Math.abs(n(2.99))), audition: 50 + n(45) };
    for (const k of UNIVERSITY_KINDS) { const r = aid(a, k, n(1) > 0 ? history : acting, n(1.2)); if (!(r.fraction >= 0 && r.fraction <= 1)) bad += 1; }
  }
  eq('aid is never less than nothing or more than the whole of tuition', bad, 0);
}
eq('the outlook is told in words', [outlook({ ...plain, mark: 3.9, advanced: 2 }, K.regional, history), outlook({ ...plain, mark: 3.0 }, K.ancient, history), outlook(plain, K.open, history)], ['Likely', 'A long shot', 'Open to all']);
yes('general ability is not something an admissions office sees', !('intellect' in plain) && assess({ ...plain, intellect: 100 }, K.ancient, history).score === assess(plain, K.ancient, history).score);

console.log(failed ? `${failed} failed.` : 'Admissions and aid hold.');
process.exit(failed ? 1 : 0);
