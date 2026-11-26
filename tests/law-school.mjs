// Law school and admission to practice: the entrance exam, terms and grades, clinics and internships, graduation,
// the bar (failed, retaken, passed), character and fitness, and older saves.
// Run with: node tests/law-school.mjs
import { store, rng, edu, ls, lp, lc, career, CAREER_BY_ID, check, finish, turn, graduate } from './helpers/lawSetup.mjs';

rng.seed(20261125);

// 1–3. Who may apply: a first degree, and in the US an LSAT score.
{
  const p = graduate();
  const opt = () => edu.programOptions().find((x) => x.id === 'law');
  check(/LSAT/.test(opt().reason), `the US asks for the LSAT before a law school application (${opt().reason})`);
  const before = edu.admissionChance('law');
  ls.prepEntrance(); const r = ls.sitEntrance();
  check(r.ok && r.score >= 120 && r.score <= 180 && !opt().reason, `the LSAT is scored 120 to 180, and opens the application (${r.score})`);
  check(!ls.sitEntrance().ok, 'the next sitting is months away');
  check(edu.admissionChance('law') !== before, 'the score counts in admission');
  p.education.degrees = p.education.degrees.filter((d) => d.type !== 'university');
  check(/university degree/i.test(opt().reason), 'no first degree, no law school');
  const de = graduate({ countryId: 'de' });
  check(!ls.entrance(de) && !/LSAT/.test(edu.programOptions().find((x) => x.id === 'law').reason), 'Germany has no LSAT: other countries are not given American rules');
  check(ls.profileFor('de').depth === 'documented' && ls.profileFor('mx').depth === 'simplified' && ls.profileFor('us').depth === 'full', 'the US is played in depth; other countries are documented outlines or labeled simplified');
}

// 4–7. Terms move with the months; courses, an exam, a clinic, an internship; graduation only at the end.
{
  const p = graduate({ step: 3 });
  ls.sitEntrance();
  let ok = false;
  for (let i = 0; i < 8 && !ok; i++) { ok = edu.applyTo('law').accepted; if (!ok) { turn(); turn(); turn(); turn(); } }
  check(ok, 'a strong applicant gets into law school');
  edu.enroll('law', null, 'self');
  const S = ls.school();
  check(S && S.terms.length === 1 && S.terms[0].courses.includes('contracts'), 'the first term is the first-year core: contracts, torts, civil procedure, research and writing');
  const ex = ls.termExam();
  check(ex.questions.length === 2 && ex.questions.every((q) => q.options.length === 4 && typeof q.why === 'string'), 'an exam is short hypotheticals, one best answer each, with a reason');
  check(ls.answerExam(ex.questions.map((q) => q.right)).ok && !ls.termExam(), 'answered once');
  check(!lp.clinicCase().ok, 'no clinic in the first year');
  turn();
  check(S.terms.length === 1 && S.terms[0].gpa == null, 'three-month turns: half a term in, nothing is graded yet');
  turn();
  check(S.terms.length === 2 && S.terms[0].gpa != null, `after six months the first term is graded and the second opens (${S.terms[0].gpa})`);
  check(S.terms[1].courses.includes('crimlaw') && S.terms[1].courses.includes('conlaw'), 'the second term finishes the core');
  check(ls.chooseElective('family_law').ok && ls.chooseElective('immigration_law').ok && !ls.chooseElective('evidence').ok, 'two electives a term');
  turn(); turn();
  check(S.terms.length === 3 && S.terms[2].courses.includes('family_law') && S.terms[2].courses.includes('immigration_law'), 'chosen electives are taken in the second year');
  const cl = lp.clinicCase();
  const cc = lc.caseById(cl.caseId);
  check(cl.ok && cc.clinic && cc.supervisorId && store.state.npcs[cc.supervisorId] && cc.fee.model === 'salary', 'a second-year clinic case: real client, a supervisor, and no fee');
  check(!!lp.mayPractice(), 'a student may not practice on their own');
  const moot = ls.mootCourt();
  check(!!moot && ls.finishMoot({ research: moot.problem.right, brief: 'strong', bench: 'strong' }).text.length > 0 && !ls.mootCourt(), 'moot court: research, a brief, a judge\'s question; once a year');
  let got = null;
  for (const id of ['judicial', 'defender', 'prosecutor', 'legal_aid', 'agency', 'firm']) { const r = ls.applyInternship(id); if (r.ok) { got = id; break; } if (ls.internshipOptions().every((x) => x.locked)) break; }
  const intern = ls.lawOf().internships.at(-1);
  check(intern && (!intern.got || store.state.npcs[intern.supervisorId]), `an internship application has an answer${got ? `, and a supervisor who stays (${got})` : ''}`);
  const deg = () => p.education.degrees.some((d) => d.type === 'law');
  for (let i = 0; i < 4; i++) turn();
  check(!deg() && p.education.enrolled, 'no degree after two years');
  let n = 0;
  for (; n < 12 && !deg(); n++) turn();
  check(n === 4, `the degree comes as the sixth term ends, three years in (${8 + n} turns of three months)`);
  check(deg() && ls.lawOf().school.done && ls.lawGpa() != null, `graduation after three years, with a law school GPA (${ls.lawGpa()})`);
  check(p.education.degrees.find((d) => d.type === 'law').gpa === ls.lawGpa(), 'the degree carries the transcript\'s GPA');
  check(!ls.admitted() && !!lp.mayPractice(), 'a law degree is not a license');
  check(career.unmet(CAREER_BY_ID.lawyer).some((x) => /bar|exam|license|pass/i.test(x)), `hiring checks the license (${career.unmet(CAREER_BY_ID.lawyer).join('; ')})`);
}

// 8–11. The bar: needs the degree; can be failed and retaken; then character and fitness, and admission.
{
  const p = graduate();
  check(ls.barStatus().stage === 'none' && !ls.barExam(), 'no bar exam without a law degree');
  p.education.degrees.push({ type: 'law', majorId: 'political_science', gpa: 3.1, age: 25 });
  p.stats.intellect = 50;
  const L = ls.lawOf();
  // Walk in unprepared and answer badly: a fail.
  const ex = ls.barExam();
  const wrong = ex.questions.map((q) => (q.right + 1) % q.options.length);
  const r1 = ls.takeBar(wrong);
  check(!r1.ok && L.bar.attempts.length === 1 && !ls.admitted(), 'the bar can be failed');
  // With year-long turns the year's second sitting is open in the same turn; after it, the next is months away.
  const second = ls.barExam();
  check(!!second, 'the year\'s second sitting is open, even within one long turn');
  ls.takeBar(second.questions.map((q) => (q.right + 1) % q.options.length));
  check(!ls.barExam() && ls.barStatus().stage === 'waiting', 'after two sittings in twelve months, the next is months away');
  turn();
  check(ls.prepareBar('course').ok, 'a bar course is paid for');
  let passed = false;
  for (let i = 0; i < 6 && !passed; i++) { const e = ls.barExam(); if (e) passed = ls.takeBar(e.questions.map((q) => q.right)).ok; if (!passed) { turn(); ls.prepareBar('self'); } }
  check(passed && ls.admitted() && p.flags.licenses.includes('law'), `retaken and passed: admitted (${L.bar.attempts.length} attempts)`);
  check(L.bar.fitness === 'cleared', 'after the character and fitness review');
  check(!lp.mayPractice() || lp.mayPractice() === '', 'admitted lawyers may practice');
  const block = career.unmet(CAREER_BY_ID.lawyer);
  check(!block.some((x) => /bar|exam|license|pass/i.test(x)), `and be hired as one (${block.join('; ')})`);
}
// Character and fitness: a serious recent conviction defers admission, with a way back.
{
  const p = graduate();
  p.education.degrees.push({ type: 'law', majorId: 'political_science', gpa: 3.6, age: 25 });
  p.legal.record.push({ caseId: 'x', crimeId: 'robbery', offense: 'Robbery', year: store.state.year - 2, convicted: true, outcome: 'convicted' });
  ls.prepareBar('course');
  let r = null;
  for (let i = 0; i < 6; i++) { const e = ls.barExam(); if (e) { r = ls.takeBar(e.questions.map((q) => q.right)); if (/character|review|record/.test(r.text)) break; } turn(); }
  check(r && !r.ok && /record/.test(r.text) && !ls.admitted() && ls.barStatus().stage === 'fitness', 'a serious recent conviction puts admission off');
}
// Other countries: the documented route, with its own exam, entrance test, length and practical training.
{
  check(ls.profileFor('ca').entrance.name === 'LSAT' && ls.profileFor('kr').entrance.name === 'LEET' && ls.profileFor('uk').entrance.id === 'none', 'Canada asks for the LSAT and Korea for the LEET; England does not');
  check(ls.profileFor('uk').depth === 'documented' && ls.profileFor('de').depth === 'documented' && ls.profileFor('mx').depth === 'simplified', 'documented countries are marked as such; others are simplified');
  check(/Solicitors Qualifying Examination/.test(ls.profileFor('uk').exam) && /State Examination/.test(ls.profileFor('de').exam), 'each country\'s own exam by name');
  const ph = graduate({ countryId: 'ph' });
  check(ls.termsFor(ph) === 8, 'a Philippine law degree takes four years');
  const uk = graduate({ countryId: 'uk' });
  uk.education.degrees.push({ type: 'law', majorId: 'history', gpa: 3.6, age: 25 });
  ls.prepareBar('course');
  let r = null;
  for (let i = 0; i < 6; i++) { const e = ls.barExam(); if (e) { r = ls.takeBar(e.questions.map((q) => q.right)); if (r.ok) break; } turn(); }
  check(r?.ok && !ls.admitted() && ls.barStatus().stage === 'training' && /qualifying work experience/.test(r.text), `England: passing the SQE leads to two years of qualifying work, not straight to admission (${r?.text})`);
  check(!!lp.mayPractice(), 'a trainee may not practice on their own yet');
  turn();
  check(!ls.admitted(), 'a year in, still training');
  turn(); turn();
  check(ls.admitted() && /solicitor/.test(ls.lawOf().bar.admitted.body), `after the training, admission as a solicitor (${ls.lawOf().bar.admitted?.body})`);
}

// Historical eras: no LSAT before 1948; reading the law before 1900; women barred until the law changed.
{
  const { syncWorld } = await import('../js/engine/history.js');
  const setYear = (y) => { store.state.year = y; syncWorld(y); }; // the world's laws and money follow the year, as the game does
  const p = graduate();
  setYear(1930);
  check(!ls.entrance(), 'no LSAT before 1948');
  setYear(1880); p.age = 20; p.education.degrees = [];
  check(!ls.canReadLaw() && ls.startReadingLaw().ok && !ls.hasLawDegree(), 'in 1880 a young man reads the law in a lawyer\'s office');
  for (let i = 0; i < 3; i++) turn();
  check(ls.hasLawDegree() && /oral examination/.test(ls.barExamName()), `after two years he may be examined for the bar: an ${ls.barExamName()}`);
  const w = graduate({ countryId: 'uk' });
  w.gender = 'female'; if (w.flags) delete w.flags.trueGender;
  setYear(1910);
  w.education.degrees.push({ type: 'law', majorId: 'history', gpa: 3.7, age: 25 });
  let r = null;
  for (let i = 0; i < 4; i++) { const e = ls.barExam(); if (e) { r = ls.takeBar(e.questions.map((q) => q.right)); if (r.ok || /women/.test(r.text)) break; } turn(); }
  check(r && !r.ok && /women cannot yet be admitted/.test(r.text) && ls.barStatus().stage === 'barred', 'in England before 1919 a woman who passes cannot be admitted');
  setYear(1920);
  ls.progressBar();
  check(ls.barStatus().stage === 'training' || ls.admitted(), 'once the law changes, her result stands and she goes on to admission');
  const c = (() => { lc.createCase('contract_dispute'); return lc.LC()[`lc_${(store.state.justice.lawSeq)}`]; })();
  lc.file(c, 'strong');
  check(/clerk/.test(c.filings[0].how), `in ${store.state.year} a filing is ${c.filings[0].how}`);
  setYear(2026);
}

// An older save with a student already in their third year: the years done are kept, not started again.
{
  const p = graduate();
  p.education.stage = 'law'; p.education.enrolled = true; p.education.yearInStage = 2; p.education.gpa = 3.3;
  delete p.law;
  const S = ls.school();
  check(S.terms.filter((t) => t.carried).length === 4 && S.terms.length === 5 && ls.lawGpa() === 3.3, 'a third-year student from an older save keeps four terms done, at their GPA, and starts the fifth');
}

// 12. Older saves: a lawyer already working is not sent back to law school, and no cases are invented.
{
  const p = graduate();
  p.age = 45;
  p.education.degrees.push({ type: 'law', majorId: 'history', gpa: 3.3, age: 25 });
  career.hire(CAREER_BY_ID.lawyer, 2, 70, 'test');
  p.career.experience = { lawyer: 18 };
  delete p.law;
  lp.migrate(p);
  const L = p.law;
  check(L.bar.admitted?.legacy && p.career.careerId === 'lawyer' && p.career.level === 2, 'a working lawyer keeps the job and is treated as admitted');
  check(L.history.length === 0 && lp.stats().completed === 0 && lp.stats().legacyUnknown, 'no past cases are invented; earlier statistics are marked unknown');
  check(L.skills.courtroom > 40, 'their years show in their skills');
}

// Five skills to follow, not twenty; finer ones count toward their group; older saves are folded in.
{
  const { LEGAL_SKILLS } = await import('../js/data/law.js');
  const p = graduate();
  const L = ls.lawOf(p);
  check(LEGAL_SKILLS.length === 5 && Object.keys(L.skills).length === 5, `five legal skills (${LEGAL_SKILLS.map((s) => s.name).join(', ')})`);
  const before = L.skills.courtroom;
  ls.gain(p, { cross: 3, oral: 2 });
  check(L.skills.courtroom > before && !('cross' in L.skills), 'practice at cross-examination counts toward Courtroom');
  p.law.skills = { oral: 40, cross: 60, research: 30, writing: 50, ethics: 70, negotiation: 20, counseling: 44 };
  const S = ls.lawOf(p).skills;
  check(Object.keys(S).length === 5 && S.courtroom === 50 && S.research === 40 && S.clients === 44 && S.ethics === 70, `an older save's twenty skills are folded into five (${JSON.stringify(S)})`);
  // The same five, named for the line of work.
  const { skillsFor, SKILL_NAMES, SPECIALTIES } = await import('../js/data/law.js');
  const fam = skillsFor('family', 'lawyer').map((x) => x.name); const div = skillsFor('divorce', 'lawyer').map((x) => x.name);
  check(fam.includes('Custody Hearings') && div.includes('Divorce Trials') && fam.join() !== div.join(), `family law and divorce law have their own names (${fam.join(', ')} / ${div.join(', ')})`);
  check(skillsFor(null, 'judiciary').some((x) => x.name === 'Judicial Ethics') && skillsFor('prosecution', 'prosecutor')[3].name === 'Victims & Witnesses', 'a judge and a prosecutor see their own names');
  check(SPECIALTIES.every((sp) => SKILL_NAMES[sp.id]?.length === 5) && Object.values(SKILL_NAMES).every((n) => n.length === 5), 'every practice area names all five, and never more');
}

finish('Law school and the bar hold.');
