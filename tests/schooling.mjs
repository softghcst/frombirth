// Marks, and the shape of school in each country, checked on hand-built cases.
// Run with: node tests/schooling.mjs
import { yearMark, carry, nextInterest, reason, showMark, stageFor } from '../js/engine/grades.js';
import { schoolModel, subjectsAt, SCHOOL_KINDS, SUBJECTS, LEAVING_AGE } from '../js/data/education.js';
import { COUNTRIES } from '../js/data/countries.js';

let failed = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { failed += 1; console.log(`FAIL ${name}\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`); } else console.log(`ok   ${name}`);
};
const yes = (name, cond) => eq(name, !!cond, true);

const base = { ability: 50, effort: 50, discipline: 50, interest: 50 };
eq('an average child doing average work gets a middling mark', yearMark(base), 2);
{
  const brightAndIdle = yearMark({ ability: 90, effort: 15, discipline: 30, interest: 35 });
  const ordinaryAndDiligent = yearMark({ ability: 50, effort: 90, discipline: 75, interest: 60 });
  yes('ability is not marks: a bright child who does nothing is beaten by an ordinary one who works', ordinaryAndDiligent > brightAndIdle);
  yes('but ability counts: with the same work, the abler child does better', yearMark({ ...base, ability: 80 }) > yearMark(base));
}
yes('work counts for about as much as ability', Math.abs((yearMark({ ...base, effort: 80 }) - yearMark(base)) - (yearMark({ ...base, ability: 80 }) - yearMark(base))) < 0.06);
yes('interest lifts a mark', yearMark({ ...base, interest: 90 }) > yearMark(base));
yes('skipping school costs marks', yearMark({ ...base, absences: 3 }) < yearMark(base) - 0.3);
yes('good teaching, extra attention and a tutor each help', yearMark({ ...base, teaching: 0.2 }) > yearMark(base) && yearMark({ ...base, focus: 1 }) > yearMark(base) && yearMark({ ...base, support: 0.5 }) > yearMark(base));
{
  let bad = 0;
  for (let a = 0; a <= 100; a += 10) for (let e = 0; e <= 100; e += 10) for (const abs of [0, 6]) for (const t of [-0.3, 0.6]) {
    const g = yearMark({ ability: a, effort: e, discipline: e, interest: a, absences: abs, teaching: t, focus: 1, support: 0.5, luck: 0.25 });
    if (!(g >= 0 && g <= 4)) bad += 1;
  }
  eq('marks never leave the range 0 to 4, whatever is thrown at them', bad, 0);
}
eq('a first year stands as it is; later years move the running mark part of the way', [carry(null, 3), carry(2, 4)], [3, 2.9]);
yes('one year\'s work cannot take a mark from the bottom to the top', carry(1, 4) < 3);
yes('doing well feeds interest and doing badly starves it', nextInterest(50, 3.6) > 50 && nextInterest(50, 1) < 50);
yes('an inspiring teacher or a club can turn a subject round', nextInterest(30, 2, { teacher: 7, club: true }) > 35);
yes('interest stays within 0 to 100', nextInterest(99, 4, { teacher: 7, club: true, focus: 1 }) <= 100 && nextInterest(1, 0, { teacher: -3 }) >= 0);
eq('reasons are told plainly', [reason({ ability: 85, effort: 20, interest: 50 }, 1.5), reason({ ability: 45, effort: 85, interest: 50 }, 3.4), reason({ ...base, absences: 4 }, 1)],
  ['you could do it, and did not do the work', 'you worked steadily all year, and it showed', 'you missed too many lessons']);

// Marks as each country writes them.
eq('the same mark, written six ways', ['gpa', 'letters', 'twenty', 'german', 'ten', 'percent'].map((g) => showMark(3.4, g)), ['3.40', 'A', '17/20', '1.8', '8.5/10', '90%']);
eq('the bottom of each scale', ['letters', 'twenty', 'german', 'ten', 'percent'].map((g) => showMark(0, g)), ['U', '0/20', '6.0', '0.0/10', '30%']);
yes('where 1 is the best mark, better work gets a lower number', Number(showMark(3.8, 'german')) < Number(showMark(2, 'german')));

// The shape of school, country by country.
{
  const uk = schoolModel('uk').stages;
  eq('school starts at the age the country sets', [stageFor(4, uk), stageFor(5, uk).name, stageFor(6, schoolModel('fr').stages).name, stageFor(5, schoolModel('fr').stages)], [null, 'Primary school', 'École primaire', null]);
  eq('stages change at the country\'s own ages', [stageFor(15, uk).name, stageFor(16, uk).name, stageFor(15, schoolModel('us').stages).name, stageFor(15, schoolModel('de').stages).name], ['Secondary school', 'Sixth form', 'High school', 'Gymnasium']);
  eq('school is over at the leaving age', stageFor(LEAVING_AGE, uk, LEAVING_AGE), null);
  let bad = [];
  for (const id of Object.keys(COUNTRIES)) {
    const m = schoolModel(id);
    const ok = m.stages.length === 3 && m.stages[0].start < m.stages[1].start && m.stages[1].start < m.stages[2].start && m.stages[2].start < LEAVING_AGE && m.stages.map((s) => s.id).join() === 'elementary,middle,high' && m.leaving && showMark(2, m.grading) !== '';
    if (!ok) bad.push(id);
  }
  eq(`all ${Object.keys(COUNTRIES).length} countries have a complete school system`, bad, []);
  yes('not every country uses the American words', new Set(Object.keys(COUNTRIES).map((id) => schoolModel(id).stages[2].name)).size >= 6 && new Set(Object.keys(COUNTRIES).map((id) => schoolModel(id).grading)).size >= 5);
}
eq('young children take fewer subjects, and the timetable grows', [subjectsAt('elementary').length, subjectsAt('middle').length, subjectsAt('high').length], [6, 10, 12]);
yes('every subject draws on abilities whose weights add up to 1', SUBJECTS.every((s) => Math.abs(Object.values(s.apt).reduce((a, b) => a + b, 0) - 1) < 1e-9));
yes('there is always a free school anyone can attend', SCHOOL_KINDS.some((k) => k.id === 'public' && !k.fee && !k.needs));

console.log(failed ? `${failed} failed.` : 'Marks and school systems hold.');
process.exit(failed ? 1 : 0);
