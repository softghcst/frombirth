// A legal career: juniors and supervisors, skills and reputation, a record counted from real cases, promotions that
// need more than years, partnership, a practice of one's own, the prosecutor's and defender's offices, District
// Attorney, Attorney General, the bench, and what a family keeps of it. Run with: node tests/law-career.mjs
import { store, rng, ls, lp, lc, k, career, CAREER_BY_ID, check, finish, turn, lawyer, playCase } from './helpers/lawSetup.mjs';
import { TRACKS } from '../js/data/law.js';

rng.seed(20261127);
const L = () => ls.lawOf();
const p = () => store.state.player;
/** Closes a case of the player's for the record, as the job it was done in: for building a history quickly. */
const done = (n, track, favorable = 1) => { for (let i = 0; i < n; i++) { const c = lc.createCase('contract_dispute', { track }); lc.close(c, { kind: 'judgment', text: 'Judgment.', favorable, trial: true }); } };

// 1. A junior is given cases at their level; harder ones as second chair, under a supervisor who stays.
{
  lawyer('lawyer');
  check(lp.leadCap() === 2, 'a new associate leads cases up to "Developing"');
  lp.chooseSpecialty('criminal_defense');
  let seen = [];
  for (let w = 0; w < 10; w++) { seen.push(...lp.offers()); L().offers = []; turn(); }
  check(seen.length && seen.every((o) => o.level <= 3) && seen.filter((o) => o.level > 2).every((o) => o.second), `offers fit the level: harder ones as second chair (${seen.map((o) => o.level).join(',')})`);
  const o = seen.find((x) => x.second) ?? null;
  check(!!o, 'some offers are above the junior\'s level, as second chair');
  if (o) {
    L().offers = [o];
    const r = lp.accept(o.id);
    const c = lc.caseById(r.caseId);
    check(c.supervisorId && store.state.npcs[c.supervisorId] && lp.supervisor().id === c.supervisorId, 'second chair: a supervising partner leads, the same person each time');
  }
  // 2–3. Experience and skills grow with real work.
  const before = L().skills.courtroom;
  const c2 = lc.createCase('theft', { role: 'defense' });
  playCase(c2);
  check(L().skills.courtroom > before && (p().career.experience.lawyer ?? 0) >= 1, `skills and years of experience grow with the work (${before.toFixed(1)} → ${L().skills.courtroom.toFixed(1)})`);
}

// 4–5. Reputation follows conduct; the record is counted from real cases, wins, losses and everything in between.
{
  lawyer('lawyer');
  const integ = L().rep.integrity;
  const c = lc.createCase('divorce'); c.ethics = { id: 'privileged', m: ls.nowM() };
  lc.resolveEthics(c, 'proper');
  check(L().rep.integrity > integ, 'integrity rises with conduct, not wins');
  done(3, 'lawyer', 1); done(2, 'lawyer', -1);
  const s = lp.stats();
  const real = L().history.filter((h) => !h.clinic && !h.referred);
  check(s.completed === real.length && s.trialsWon === 3 && s.trialsLost === 2 && s.trialsWon + s.trialsLost === s.trials, `statistics reconcile with the case records (${JSON.stringify(s)})`);
  const settled = lc.createCase('injury');
  lc.close(settled, { kind: 'settlement', text: 'Settled.', favorable: 0.5, amount: 1000 });
  check(lp.stats().settlements === 1 && lp.stats().trials === 5, 'a settlement is its own outcome, neither a trial win nor a loss');
}

// 6–7. Promotions are not guaranteed: years and reviews are not enough without the cases behind them.
{
  // Five strong years (a life that ends in a layoff, the career engine's own risk, is lived again).
  for (let tries = 0; tries < 4; tries++) {
    lawyer('lawyer');
    for (let y = 0; y < 5 && p().career.careerId === 'lawyer'; y++) { p().career.performance = 95; store.state.pendingEvents = []; turn(); L().offers = []; }
    if (p().career.careerId === 'lawyer') break;
  }
  const next = career.nextStep();
  check(p().career.level === 0 && next.missing.some((x) => /completed cases/.test(x)), `five strong years with no cases of one's own: no promotion (${next.missing.join('; ')})`);
  const ops = lp.opportunities();
  check(ops.find((x) => x.id === 'judge')?.why && ops.find((x) => x.id === 'ag')?.why, 'the bench and Attorney General are out of reach for a junior');
}

// 8. Partnership is a vote, not a step on a ladder.
{
  lawyer('lawyer', { level: 1 });
  p().career.yearsInRole = 5;
  done(TRACKS.lawyer.minDone[2], 'lawyer', 1);
  check(career.nextStep().missing.some((x) => /vote of the partners/.test(x)), 'the career engine cannot make a partner: the partners must vote');
  let tries = 0; let made = false;
  for (; tries < 8 && !made; tries++) {
    const r = lp.seek('partnership');
    made = r.ok;
    if (!made) { L().tried.partnership -= 24; }
  }
  check(made && p().career.level === 2 && /partner/i.test(p().career.title), `voted in after ${tries} vote(s): ${p().career.title}`);
  check(L().selected.partnership, 'the vote is on record');
}

// 9. A practice of one's own is a business (engine/business.js), and its fees go to the firm's books.
{
  const { start } = await import('../js/engine/business.js');
  lawyer('lawyer');
  p().career.experience.lawyer = 6;
  career.quitCareer();
  const r = start('law_firm', 'Hale & Partners');
  check(r.ok && lp.trackOf() === 'own' && lp.ownFirm().name === 'Hale & Partners', `opening a firm is opening a business (${r.text.slice(0, 60)})`);
  const offers = lp.offers();
  const a = lp.accept(offers[0].id);
  const c = lc.caseById(a.caseId);
  const cap0 = lc.capacity();
  lp.ownFirm().others += 2;
  check(lc.capacity() === cap0 + 6, 'staff at your own firm let you carry more cases');
  const cash = lp.ownFirm().cash;
  playCase(c);
  turn();
  check(c.fee.model !== 'salary' && c.fee.paid && lp.ownFirm().cash !== cash, `the fee goes into the firm, once (${c.fee.amount})`);
  // Associates and partners.
  lp.ownFirm().cash = 5e6;
  const cap1 = lc.capacity();
  check(lp.hireAssociate().ok && lp.hireAssociate().ok && lp.firmView().associates.length === 2, 'the firm hires associates');
  check(lc.capacity() === cap1 + 4, 'and they carry part of the work');
  const first = lp.firmView().associates[0];
  check(!lp.makePartner(first.id).ok, 'nobody is made partner in their first year');
  const cash2 = lp.ownFirm().cash;
  store.state.settings = { ...(store.state.settings ?? {}), step: 12 };
  for (let y = 0; y < 5; y++) turn();
  for (const x of ls.lawOf().associates) x.since = Math.min(x.since, store.state.year - 5); // five years in, whatever the dates
  check(lp.ownFirm().cash !== cash2, 'their fees and salaries go through the firm\'s books');
  const r2 = lp.makePartner(first.id);
  check(r2.ok && lp.firmView().associates.find((x) => x.id === first.id).partner, `after five years, a partner (${r2.text})`);
  // Pass someone over long enough and they may leave.
  ls.lawOf().associates.forEach((x) => { if (!x.partner) x.since -= 10; });
  let left = false;
  for (let y = 0; y < 12 && !left; y++) { turn(); left = lp.firmView().associates.length < 2; }
  check(left, 'an associate passed over for years leaves to open a practice of their own');
}

// 10. Government offices assign cases; a public defender is on a salary with a heavy caseload.
{
  for (let i = 0; i < 4; i++) { lawyer('defender'); store.state.player.career.performance = 85; turn(); if (store.state.player.career.careerId === 'defender') break; }
  const mine = L().caseIds.map(lc.caseById);
  check(mine.length >= 1 && mine.every((c) => c.assigned && c.fee.model === 'salary') && !(L().offers ?? []).length, `a public defender is assigned clients by the office, on salary (${mine.length})`);
  // A year can end in a layoff (the career engine's own risk): try again with another life if so.
  for (let i = 0; i < 4; i++) { lawyer('prosecutor'); store.state.player.career.performance = 85; turn(); if (store.state.player.career.careerId === 'prosecutor') break; }
  const pros = L().caseIds.map(lc.caseById);
  check(pros.length >= 1 && pros.every((c) => c.role === 'prosecution' && !c.clientId), `a prosecutor is assigned cases for the government (${pros.map((c) => `${c.templateId}:${c.role}:${c.clientId}`).join(' ')})`);
  const gc = CAREER_BY_ID.gov_counsel.levels.map((x) => x.title);
  check(gc[0] === 'Staff attorney' && gc.at(-1) === 'Agency general counsel', `government counsel has its own ladder (${gc.join(' → ')})`);
}

// 11. District Attorney is won by election in the US, not by promotion.
{
  lawyer('prosecutor', { level: 2 });
  p().career.experience.prosecutor = 10;
  p().career.yearsInRole = 9;
  done(30, 'prosecutor', 1);
  check(career.nextStep().missing.some((x) => /District Attorney/.test(x)), 'the career engine cannot make anyone District Attorney');
  const op = lp.opportunities().find((x) => x.id === 'da');
  check(op && op.how === 'elected' && !op.why, 'in the US the office is elected');
  const cash = p().finance.cash;
  let won = false;
  for (let i = 0; i < 8 && !won; i++) { won = lp.seek('da').ok; if (!won) L().tried.da -= 48; }
  check(p().finance.cash < cash, 'a campaign costs money');
  const race = (p().flags.races ?? []).find((r) => r.legal);
  check(race && typeof race.share === 'number' && race.total > 0 && race.rival, `the race is counted like any election and kept with the player's races (${race?.share}% against ${race?.rival})`);
  check(!won || p().career.level === 3, `elected: the top of the office (${p().career.title})`);
}

// 12. Attorney General is not an ordinary promotion.
{
  lawyer('lawyer');
  career.hire(CAREER_BY_ID.attorney_general, 0, 95, 'test');
  p().career.yearsInRole = 10;
  check(career.nextStep().missing.some((x) => /Attorney General/.test(x)), 'a deputy is never promoted to Attorney General by the career engine');
  lawyer('prosecutor', { level: 2 });
  p().career.experience = { prosecutor: 14 };
  p().age = 45;
  L().rep.integrity = 70;
  const op = lp.opportunities().find((x) => x.id === 'ag');
  check(op && !op.why && /elected/.test(op.how), `a senior prosecutor may run for state Attorney General (${op?.how})`);
  p().finance.cash = 5e6;
  let got = false;
  for (let i = 0; i < 12 && !got; i++) { got = lp.seek('ag').ok; if (!got) L().tried.ag -= 48; }
  check(!got || (p().career.careerId === 'attorney_general' && p().career.level === 1), `won: Attorney General (${got ? p().career.title : 'lost every time, which can happen'})`);
}

// Federal offices (US only): a nomination, then a Senate vote; each can fail; none is a promotion.
{
  lawyer('prosecutor', { level: 2 });
  p().age = 52; p().career.experience = { prosecutor: 18 }; L().rep.integrity = 75; L().rep.recognition = 60; L().skills.research = 60;
  const ids = lp.opportunities().map((x) => x.id);
  check(['us_attorney', 'solicitor_general', 'ag_federal'].every((x) => ids.includes(x)), `a senior US prosecutor may seek the federal offices (${ids.join(', ')})`);
  check(/Senate/.test(lp.opportunities().find((x) => x.id === 'ag_federal').how), 'the US Attorney General is appointed by the President and confirmed by the Senate');
  const texts = [];
  let got = false;
  for (let i = 0; i < 20 && !got; i++) { const r = lp.seek('us_attorney'); texts.push(r.text); got = r.ok; if (!got) L().tried.us_attorney -= 48; }
  check(texts.some((t) => /nominated someone else|voted you down/.test(t)) || got, 'a nomination can go to someone else, or the Senate can say no');
  check(!got || (p().career.careerId === 'us_attorney' && p().career.level === 1 && /United States Attorney/.test(p().career.title)), `confirmed: ${got ? p().career.title : 'not this time'}`);
  check(!got || /confirmed/i.test(texts.at(-1)), 'confirmation names the Senate vote');
  career.hire(CAREER_BY_ID.us_attorney, 0, 95, 'test'); p().career.yearsInRole = 9;
  check(career.nextStep().missing.some((x) => /Senate/.test(x)), 'a First Assistant is never promoted to US Attorney by the career engine');
  lawyer('prosecutor', { level: 2, countryId: 'uk' });
  p().age = 52; p().career.experience = { prosecutor: 18 };
  check(!lp.opportunities().some((x) => ['us_attorney', 'solicitor_general', 'ag_federal'].includes(x.id)), 'outside the US there are no American federal offices');
}

// 13–14. The bench: eligibility, selection, and a judge does not represent anyone.
{
  lawyer('lawyer');
  check(lp.opportunities().find((x) => x.id === 'judge').why, 'a young lawyer cannot apply for the bench');
  p().age = 48; p().career.experience = { lawyer: 15 }; L().rep.integrity = 75;
  const open = lc.createCase('contract_dispute', { track: 'lawyer' });
  let made = false;
  for (let i = 0; i < 40 && !made; i++) { made = lp.seek('judge').ok; if (!made) L().tried.judge -= 24; } // a seat is a long shot each time
  check(made && p().career.careerId === 'judiciary', 'selected for the bench through the vacancy process');
  check(open.done && open.outcome.kind === 'referred', 'their open cases went to colleagues');
  check(/judge/i.test(lp.mayPractice()), 'a judge does not take clients');
  L().offers = [{ id: 'x', templateId: 'theft', level: 1, fee: 0, kind: 'criminal', specialty: 'criminal_defense' }];
  check(!lp.accept('x').ok, 'and cannot accept a case as counsel');
}

// Judges move up by appointment, and step aside from cases involving people they know.
{
  const jobs = await import('../js/engine/legalCareers.js');
  lawyer('judiciary');
  p().age = 55; L().rep.integrity = 80;
  p().career.yearsInRole = 10; p().career.performance = 95;
  check(career.nextStep().missing.some((x) => /higher court/.test(x)), 'a district judge is not promoted to a higher court by the career engine');
  let up = false;
  for (let i = 0; i < 12 && !up; i++) { up = lp.seek('elevation').ok; if (!up) L().tried.elevation -= 36; }
  check(up && p().career.level === 1, `appointed to the higher court by selection (${p().career.title})`);
  const friend = k.civilian(p().countryId); friend.flags.formerClientOf = p().id;
  let c = null;
  for (let i = 0; i < 60 && !jobs.recusalFor(c); i++) { p().flags.legalActs = null; c = jobs.openBench(); }
  const con = jobs.recusalFor(c);
  const known = store.state.npcs[con?.npcId];
  check(!!con && known && (known.flags.formerClientOf === p().id || p().npcIds.includes(known.id)) && con.why, `someone the judge knows turns up in a case on the list (${con?.name}, ${con?.why})`);
  const judge = c.judgeId;
  const r = jobs.recuse(c);
  check(r.ok && c.judgeId !== judge && c.judgeId !== p().id, 'the judge steps aside, and another judge takes the case');
  p().flags.legalActs = null;
  let c2 = null; for (let i = 0; i < 60 && !jobs.recusalFor(c2); i++) { p().flags.legalActs = null; c2 = jobs.openBench(); }
  const integ = L().rep.integrity;
  jobs.hearAnyway(c2);
  check(L().rep.integrity < integ && L().misconduct >= 1 && lp.opportunities().find((x) => x.id === 'elevation')?.why, 'hearing it anyway is misconduct, and blocks the next appointment');
}

// Leading an office, and a judge's civil list; managing the workload.
{
  lawyer('prosecutor', { level: 3 });
  check(lp.leadsOffice() === 'da', 'the top of the prosecutor\'s office leads it');
  const ds = lp.leaderDuties().map((d) => d.id);
  check(['priorities', 'review', 'supervise'].every((x) => ds.includes(x)), `a District Attorney has duties of office (${ds})`);
  const integ = L().rep.integrity;
  lp.doDuty('review', 'evidence');
  check(L().rep.integrity > integ && !lp.doDuty('review', 'evidence').ok, 'reviewing a major case on the evidence counts for integrity; once a half-year');
  lp.doDuty('priorities', 'diversion');
  check(L().office.priority === 'diversion', 'the office\'s priorities are set and kept');
  lawyer('lawyer');
  career.hire(CAREER_BY_ID.attorney_general, 1, 70, 'test');
  check(lp.leaderDuties().some((d) => d.id === 'opinion'), 'an Attorney General gives legal opinions');
  const i2 = L().rep.integrity; lp.doDuty('opinion', 'politics');
  check(L().rep.integrity < i2, 'an opinion bent to politics costs integrity');
  lawyer('judiciary');
  let m = lp.benchMatter();
  for (let i = 0; i < 20 && m?.benchCriminal; i++) { L().benchWindow = -1; L().bench = []; m = lp.benchMatter(); } // a civil matter, for this check
  check(m && m.bench && m.judgeId === p().id && !L().caseIds.includes(m.id) && lp.rulingOptions(m).length >= 3, `a judge hears a civil or family matter: ${m?.title}`);
  const r = lp.rule(m.id, m.templateId === 'custody' ? 'improper' : 'for');
  check(m.done && L().benchRecord.length === 1 && (m.templateId !== 'custody' || /Wealth is not the test/.test(r.text)), 'the ruling is recorded; custody never goes to the wealthier parent as such');
  check(!lp.benchMatter(), 'one civil matter a half-year');
  lawyer('lawyer', { level: 1 });
  const cap0 = lc.workload().capacity;
  check(lp.askSupport().ok && lc.workload().capacity === cap0 + 3 && !lp.askSupport().ok, 'asking for support gives room for a while, not again at once');
  const c = lc.createCase('assault', { role: 'defense', track: 'lawyer' });
  const pts = lc.workload().points;
  check(lp.delegate(c.id).ok && lc.workload().points === pts - c.level / 2, 'a senior lawyer can delegate the routine work of a case');
  const due = c.due;
  check(lp.takeLeave().ok && c.due === due + 1 && !lp.takeLeave().ok, 'leave moves the deadlines back, once a year');
}

// Your own firm: a fee strategy and malpractice cover. A trainee works, but only under supervision.
{
  const { start } = await import('../js/engine/business.js');
  lawyer('lawyer');
  p().career.experience.lawyer = 6;
  career.quitCareer();
  start('law_firm', 'Ellis Law');
  check(lp.setFeeStrategy('premium').ok && L().fees === 'premium', 'your own firm sets its fees');
  const c = lc.createCase('contract_dispute', { track: 'own', fee: 'flat' });
  lc.close(c, { kind: 'judgment', text: 'Judgment.', favorable: 1, trial: true });
  check(c.fee.amount === Math.round(lc.LC()[c.id].fee.amount) && c.fee.amount > 0, `premium fees are charged (${c.fee.amount})`);
  const firm = lp.ownFirm();
  const lost = lc.createCase('injury', { track: 'own', fee: 'hourly' });
  lost.deadlines.push({ id: 'proc:x', proc: 'x', label: 'A filing', due: 0, met: false });
  lc.close(lost, { kind: 'judgment_against', text: 'Lost.', favorable: -0.5, trial: true });
  store.state.pendingEvents = []; turn();
  check(lost.claimChecked && store.state.journal.some((e) => /sued your firm/.test(e.text)), 'a case lost through a missed deadline brings a malpractice claim, paid by an uninsured firm');
  check(lp.setMalpractice(true).ok && L().malpractice, 'and the firm can insure against it');
  // A trainee in England during qualifying work.
  const uk = lawyer('lawyer', { countryId: 'uk' });
  career.quitCareer();
  uk.flags.licenses = []; L().bar.admitted = null; L().bar.training = { from: ls.nowM(), until: ls.nowM() + 24, name: 'qualifying work experience' };
  check(!career.unmet(CAREER_BY_ID.lawyer).some((x) => /exam|pass/i.test(x)), 'a trainee in qualifying work can be hired by a firm');
  career.hire(CAREER_BY_ID.lawyer, 0, 60, 'test');
  check(!lp.mayPractice(), 'and works cases');
  L().window = null; L().offers = [];
  const offs = lp.offers();
  check(offs.length && offs.every((o) => o.second), 'but always as second chair, under a supervisor');
}

// 15. Retirement keeps the record; a descendant sees the career, not the clients' secrets.
{
  lawyer('lawyer');
  playCase(lc.createCase('divorce', { track: 'lawyer' }));
  career.quitCareer();
  const me = p().id;
  const all = lp.legalLegacy(me, me);
  const heir = lp.legalLegacy(me, 'someone_else');
  check(all.some((e) => e.privacy === 'restricted') && !heir.some((e) => e.privacy === 'restricted'), 'the lawyer sees their own case notes; a descendant does not');
  check(heir.some((e) => /Admitted|first case/i.test(e.title)) && !heir.some((e) => /Marriage of/.test(`${e.title} ${e.text}`)), 'a descendant sees the career, never a client\'s name from a private matter');
  check(L().history.length >= 1, 'the professional history stays after leaving work');
}

// The next generation: the Family Archive keeps the ancestor's legal career, never the clients' private matters.
{
  const { die } = await import('../js/engine/death.js');
  const { continueAs, heirs } = await import('../js/engine/legacy.js');
  const { makeNpc } = await import('../js/engine/npcFactory.js');
  lawyer('lawyer');
  const me = p();
  const kid = makeNpc({ role: 'child', countryId: me.countryId, age: 24, relationship: 80 });
  store.state.npcs[kid.id] = kid; me.npcIds.push(kid.id);
  const private1 = lc.createCase('divorce', { track: 'lawyer' }); playCase(private1);
  const secret = store.state.npcs[private1.clientId].lastName;
  const ancestor = { first: me.firstName, last: me.lastName };
  die('old age');
  const h = heirs().find((x) => x.id === kid.id) ?? heirs()[0];
  store.state = continueAs(h.id);
  const leg = lp.familyLegalLegacy();
  const theirs = leg.find((x) => x.name === `${ancestor.first} ${ancestor.last}`);
  check(theirs && theirs.milestones.some((m) => /First case/i.test(m.title)), `the heir finds the ancestor's legal career in the Family Archive (${theirs?.milestones.map((m) => m.title).join('; ')})`);
  check(!JSON.stringify(leg).includes(secret), 'and nothing of a client\'s private matter');
}

// The practice area follows the job; the skills take its names.
{
  lawyer('lawyer');
  lp.chooseSpecialty('divorce');
  check(lp.overview().skills.some((x) => x.name === 'Divorce Trials'), 'a divorce lawyer\'s skills have divorce names');
  const before = L().skills.courtroom;
  career.hire(CAREER_BY_ID.prosecutor, 0, 60, 'test');
  check(lp.fitSpecialty() === 'prosecution' && lp.overview().specialty.id === 'prosecution', 'joining the prosecutor\'s office makes the practice prosecution');
  check(lp.overview().skills.some((x) => x.name === 'Trial Advocacy') && L().skills.courtroom === before, 'the names change; what was learned stays');
}

// Four reputation bars to follow, not six.
{
  lawyer('lawyer');
  L().rep.clients = 80; L().rep.reliability = 40;
  const rep = lp.overview().rep;
  check(rep.length === 4 && rep.find((r) => r.id === 'trust').v === 60, `reputation is shown as four bars (${rep.map((r) => r.name).join(', ')})`);
}

// A judge presides over criminal trials: the rulings, the instruction on reasonable doubt, the verdict and sentence.
{
  const play = (answersFor) => {
    lawyer('judiciary');
    store.state.year = 2020;
    let c = null;
    for (let i = 0; i < 40 && !c; i++) { L().benchWindow = -1; L().bench = []; const x = lp.benchMatter(); if (x?.benchCriminal) c = x; else if (x) x.done = true; }
    const steps = lp.trialSteps(c);
    return { c, steps, r: lp.presideTrial(c.id, answersFor(steps)) };
  };
  const good = play((steps) => ({ ...Object.fromEntries(steps.map((s) => [s.id, s.right])), sentence: 'within' }));
  check(good.c && good.steps.some((s) => s.id === 'instruct'), `a criminal trial comes before the judge (${good.c?.title})`);
  check(good.c.done && good.r.ok && L().benchRecord.at(-1).criminal && L().benchRecord.at(-1).right, `rulings that follow the law are upheld (${good.r.text})`);
  const jc = k.J().cases[good.c.justiceCaseId];
  check(!jc || jc.verdict, 'the verdict is on the justice record');
  // A wrong instruction on reasonable doubt: a conviction never survives it.
  let bad = null;
  for (let i = 0; i < 12 && !bad; i++) { const x = play((steps) => ({ ...Object.fromEntries(steps.map((s) => [s.id, s.right])), instruct: 'wrong', sentence: 'within' })); if (x.r.guilty) bad = x; }
  check(bad && bad.r.reversed && /reversed/.test(bad.r.text), 'a jury told the wrong standard of proof: the conviction is reversed');
  // A search without a warrant: the ruling depends on the law of the time (Mapp v. Ohio, 1961).
  lawyer('judiciary');
  let ds = null;
  for (let i = 0; i < 80 && !ds; i++) { L().benchWindow = -1; L().bench = []; const x = lp.benchMatter(); if (x?.templateId === 'drug_supply') ds = x; else if (x) x.done = true; }
  store.state.year = 2020;
  check(ds && lp.trialSteps(ds).find((s) => s.id === 'motion').right === 'grant', 'in 2020, evidence from an unlawful search is excluded');
  store.state.year = 1955;
  check(lp.trialSteps(ds).find((s) => s.id === 'motion').right === 'deny', 'in a 1955 state court, it is not');
  store.state.year = 2026;
}

// Public lawyers work for public offices, not private firms; job posts for them are the office's.
{
  const { employer, jobs, cityEmployers } = await import('../js/engine/employers.js');
  for (const [id, re] of [['prosecutor', /District Attorney's Office$/], ['defender', /Public Defender's Office$/], ['judiciary', /Superior Court$/]]) {
    lawyer(id);
    turn();
    const e = employer(p().career.employerId);
    check(e?.public && re.test(e.name), `a ${id} works for ${e?.name}`);
  }
  lawyer('lawyer');
  check(!employer(p().career.employerId)?.public, 'a lawyer in private practice works for a firm');
  for (const c of ['Chicago', 'New York', 'Houston', 'Los Angeles']) cityEmployers('us', c);
  const posts = Object.values(jobs().postings).filter((x) => ['prosecutor', 'defender'].includes(x.careerId));
  check(posts.length > 0 && posts.every((x) => employer(x.employerId)?.public), `posts for prosecutors and public defenders are the public offices' (${posts.length})`);
}

finish('A legal career holds together.');
