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
  const before = L().skills.oral;
  const c2 = lc.createCase('theft', { role: 'defense' });
  playCase(c2);
  check(L().skills.oral > before && (p().career.experience.lawyer ?? 0) >= 1, `skills and years of experience grow with the work (${before.toFixed(1)} → ${L().skills.oral.toFixed(1)})`);
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
  lawyer('lawyer');
  p().career.performance = 95;
  for (let y = 0; y < 5; y++) { p().career.performance = 95; store.state.pendingEvents = []; turn(); L().offers = []; }
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
  const cash = lp.ownFirm().cash;
  playCase(c);
  turn();
  check(c.fee.model !== 'salary' && c.fee.paid && lp.ownFirm().cash !== cash, `the fee goes into the firm, once (${c.fee.amount})`);
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

// 13–14. The bench: eligibility, selection, and a judge does not represent anyone.
{
  lawyer('lawyer');
  check(lp.opportunities().find((x) => x.id === 'judge').why, 'a young lawyer cannot apply for the bench');
  p().age = 48; p().career.experience = { lawyer: 15 }; L().rep.integrity = 75;
  const open = lc.createCase('contract_dispute', { track: 'lawyer' });
  let made = false;
  for (let i = 0; i < 12 && !made; i++) { made = lp.seek('judge').ok; if (!made) L().tried.judge -= 24; }
  check(made && p().career.careerId === 'judiciary', 'selected for the bench through the vacancy process');
  check(open.done && open.outcome.kind === 'referred', 'their open cases went to colleagues');
  check(/judge/i.test(lp.mayPractice()), 'a judge does not take clients');
  L().offers = [{ id: 'x', templateId: 'theft', level: 1, fee: 0, kind: 'criminal', specialty: 'criminal_defense' }];
  check(!lp.accept('x').ok, 'and cannot accept a case as counsel');
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

finish('A legal career holds together.');
