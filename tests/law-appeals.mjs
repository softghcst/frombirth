// Appellate practice: four kinds of appeal, each argued on the record with its own question from the bench; a
// petition to the highest court is usually refused; real laws by year; the court's name in its era.
// Run with: node tests/law-appeals.mjs
import { store, rng, ls, lp, lc, check, finish, lawyer, playCase } from './helpers/lawSetup.mjs';
const { caseLaws } = await import('../js/engine/realLaw.js');
const { SPECIALTY_BY_ID } = await import('../js/data/law.js');
rng.seed(63);

check(new Set(SPECIALTY_BY_ID.appellate.cases).size === 4, `appellate practice takes four kinds of appeal (${[...new Set(SPECIALTY_BY_ID.appellate.cases)].join(', ')})`);
for (const id of ['criminal_appeal', 'verdict_appeal', 'supreme_court']) {
  lawyer('lawyer'); store.state.year = 2020; ls.lawOf().skills.research = 70;
  const c = lc.createCase(id);
  c.awaiting = { what: 'hearing', since: ls.nowM(), turn: ls.nowM() };
  const day = lc.courtroom(c);
  check(day.phases.map((x) => x.id).join() === 'opening,bench,closing', `${id}: argued on the record: argument, the bench, rebuttal`);
  check(!/email/.test(day.phases.find((x) => x.id === 'bench').text), `${id}: the bench asks about this case, not another (${day.phases.find((x) => x.id === 'bench').text})`);
}
// Played to the end.
const outs = {};
for (const id of ['criminal_appeal', 'verdict_appeal']) {
  lawyer('lawyer'); store.state.year = 2020;
  const c = lc.createCase(id);
  const o = playCase(c);
  outs[id] = c;
  check(['reversed', 'affirmed', 'settlement'].includes(o?.kind) && !/\{\w+\}/.test(o.text), `${id}: decided (${o?.kind}: ${o?.text})`);
}
check(lc.contingencyRule('criminal_appeal', 'us').allowed === false, 'no contingency fee for a criminal appeal');
check(caseLaws(outs.criminal_appeal, 2020).some((x) => /Sullivan v. Louisiana/.test(x.law.name)) && caseLaws(outs.criminal_appeal, 1990).every((x) => !/Sullivan/.test(x.law.name)), 'a reasonable doubt instruction cites Sullivan v. Louisiana, from 1993');
check(caseLaws(outs.verdict_appeal, 2020).some((x) => /Gore/.test(x.law.name)) && caseLaws(outs.verdict_appeal, 2020).some((x) => /Campbell/.test(x.law.name)), 'a punitive award cites BMW v. Gore and State Farm v. Campbell');
// The highest court: most petitions are refused.
let denied = 0; let heard = 0;
for (let i = 0; i < 60; i++) {
  lawyer('lawyer'); store.state.year = 2020; ls.lawOf().skills.research = 60;
  const c = lc.createCase('supreme_court');
  lc.research(c, lc.researchQuestion(c).right);
  lc.file(c, 'strong');
  if (c.done && c.outcome.kind === 'cert_denied') denied++; else heard++;
}
check(denied > heard * 2 && heard > 0, `the highest court refuses most petitions, but not all (${denied} refused, ${heard} heard)`);
lawyer('lawyer'); store.state.year = 2020;
check(lc.forumName(lc.createCase('supreme_court')) === 'Supreme Court of the United States', 'in the US: the Supreme Court');
lawyer('lawyer', { countryId: 'uk' });
store.state.year = 2000;
check(lc.forumName(lc.createCase('supreme_court')) === 'Appellate Committee of the House of Lords', 'in England before 2009: the House of Lords');
store.state.year = 2015;
check(lc.forumName(lc.createCase('supreme_court')) === 'Supreme Court of the United Kingdom', 'from 2009: the UK Supreme Court');
// A prosecutor is never handed a convicted person's appeal.
lawyer('prosecutor', { level: 2 });
lp.chooseSpecialty('appellate');
const seen = new Set();
for (let i = 0; i < 10; i++) { ls.lawOf().window = -1; lp.refreshOpportunities(); for (const c of ls.lawOf().caseIds.map(lc.caseById)) if (c) seen.add(c.templateId); store.state.year += 1; }
check(!seen.has('criminal_appeal'), `a prosecutor argues for the State, not against it (${[...seen].join(', ')})`);
finish('Appeals are argued on the record, case by case.');
