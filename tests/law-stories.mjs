// The scenes of a legal life: each one comes when its moment really happens (in school, a case or the career), once,
// and every choice in it changes something real. Run with: node tests/law-stories.mjs
import { store, rng, ls, lp, lc, k, check, finish, turn, lawyer, graduate, edu } from './helpers/lawSetup.mjs';
import LAW from '../js/data/events/stories/law.js';
import { EVENT_BY_ID } from '../js/data/events/index.js';

rng.seed(20261129);
const queued = () => store.state.pendingEvents.map((e) => e.id);
const beats = () => { lp.storyBeats(); return queued(); };

check(LAW.length >= 29 && LAW.every((e) => EVENT_BY_ID[e.id] && e.choices.length >= 2 && e.queuedOnly), `${LAW.length} legal scenes, each with real choices, only when queued`);

// School: the first exam, a professor, graduation, a clinic client.
{
  graduate(); ls.sitEntrance();
  let ok = false; for (let i = 0; i < 8 && !ok; i++) ok = edu.applyTo('law').accepted;
  edu.enroll('law', null, 'self');
  store.state.pendingEvents = [];
  check(beats().includes('law_first_exam'), 'the first exam comes in the first term');
  store.state.pendingEvents = [];
  check(!beats().includes('law_first_exam'), 'and only once');
  const t = ls.lawOf().school.terms.at(-1);
  lp.lawChoice('firstExam:allnight');
  check(!!ls.lawOf().acts[`study:${t.n}`], 'studying all night counts as preparation for the grade');
  ls.doSchoolAct('office_hours');
  const prof = store.state.npcs[ls.lawOf().people.lawProfessor];
  prof.meters.relationship = 70;
  store.state.pendingEvents = [];
  check(beats().includes('law_professor'), 'a professor who thinks well of you notices your work');
  lp.lawChoice('professor:yes');
  check((ls.lawOf().honors ?? []).some((h) => /Research assistant/.test(h)), 'and the research assistant job is on the record');
}

// Cases: each scene from its own situation, once per case, and each choice changes the case.
{
  lawyer('lawyer');
  const L = ls.lawOf();
  const hale = lc.createCase('burglary_hale', { role: 'defense', track: 'lawyer' });
  lc.review(hale);
  store.state.pendingEvents = [];
  let q = beats();
  check(q.includes('law_client_accused') && q.includes('law_identification'), `a criminal defense: the client accused, and a questionable identification (${q})`);
  const before = hale.evidence.find((e) => e.id === 'ident').reliability;
  lp.lawChoice('ident:expert');
  check(hale.evidence.find((e) => e.id === 'ident').reliability < before, 'an expert on eyewitness memory weakens the identification');
  store.state.pendingEvents = [];
  check(!beats().includes('law_identification'), 'and the scene does not come back for that case');
  const fam = lc.createCase('custody', { track: 'lawyer' });
  fam.stageIdx = fam.stages.findIndex((s) => s.s === 'negotiation');
  store.state.pendingEvents = [];
  q = beats();
  check(q.includes('law_parenting') && q.includes('law_settlement_conf'), `a custody case: the parenting agreement and a settlement conference (${q})`);
  const b0 = fam.bonus ?? 0;
  lp.lawChoice('parenting:child');
  check((fam.bonus ?? 0) > b0, 'a plan built around the child\'s week strengthens the case');
  const imm = lc.createCase('family_petition', { track: 'lawyer' });
  imm.stageIdx = imm.stages.findIndex((s) => s.s === 'review');
  store.state.pendingEvents = [];
  check(beats().includes('law_rfe'), 'an immigration petition: a request for evidence');
  lp.lawChoice('rfe:full');
  check(imm.evidence.find((e) => e.id === 'gap').reliability < 50, 'a full answer closes the gap in the evidence');
  const dl = lc.createCase('dismissal', { track: 'lawyer' });
  store.state.pendingEvents = [];
  check(beats().includes('law_deadline'), 'a filing deadline coming with nothing written');
  lp.lawChoice('deadline:weekend');
  check(dl.filings.some((f) => f.main && !f.routine), 'working the weekend files it properly, by hand');
}

// Prosecution: a case that no longer holds.
{
  lawyer('prosecutor');
  const c = lc.createCase('burglary', { role: 'prosecution', track: 'prosecutor' });
  for (const e of c.evidence) if (e.favors === 'other') e.status = 'excluded';
  store.state.pendingEvents = [];
  check(beats().includes('law_must_dismiss'), 'when the evidence falls apart, the prosecutor must decide');
  lp.lawChoice('mustDismiss:dismiss');
  check(c.done && c.outcome.kind === 'dismissed', 'dropping the charges closes the case as dismissed');
}

// The senior career: an offer from government, and the Attorney General opportunity.
{
  lawyer('prosecutor', { level: 2 });
  const p = store.state.player;
  p.age = 50; p.career.experience = { prosecutor: 16 }; ls.lawOf().rep.integrity = 70;
  let seen = new Set();
  for (let i = 0; i < 30; i++) { store.state.pendingEvents = []; lp.storyBeats(); for (const id of queued()) seen.add(id); ls.lawOf().seen = {}; }
  check(seen.has('law_gov_offer') && seen.has('law_ag'), `an experienced prosecutor is offered government work and the chance to run for Attorney General (${[...seen].join(', ')})`);
  lp.lawChoice('govOffer:accept');
  check(p.career.careerId === 'attorney_general' && p.career.level === 0, 'accepting makes them a Deputy Attorney General, not Attorney General');
}

// Long stories: a rival from an earlier trial, and a classmate who became a judge.
{
  lawyer('lawyer');
  const me = store.state.player;
  const first = lc.createCase('contract_dispute', { track: 'lawyer' });
  const rivalId = first.otherCounselId;
  lc.close(first, { kind: 'judgment', text: 'Judgment.', favorable: 1, trial: true });
  check(store.state.npcs[rivalId].flags.rivalOf === me.id, 'the lawyer on the other side of a trial becomes a rival');
  let again = null;
  for (let i = 0; i < 40 && !again; i++) { const c = lc.createCase('injury', { track: 'lawyer' }); if (c.otherCounselId === rivalId) again = c; }
  check(!!again, 'and turns up against you again, as the same person');
  store.state.pendingEvents = [];
  lp.storyBeats();
  check(queued().includes('law_old_rival'), 'a scene: an old rival across the aisle');
  lp.lawChoice('rival:respect');
  const L = ls.lawOf();
  const { makeNpc } = await import('../js/engine/npcFactory.js');
  const friend = makeNpc({ role: 'friend', countryId: me.countryId, age: 40, relationship: 70 });
  store.state.npcs[friend.id] = friend; me.npcIds.push(friend.id);
  (L.people ??= {}).studyMate = friend.id;
  L.bar.admitted.m = ls.nowM() - 120;
  for (let i = 0; i < 80 && !friend.flags.becameJudge; i++) lp.storyBeats();
  check(friend.flags.becameJudge && k.bench(me.countryId).judges.includes(friend.id), `a law school classmate is appointed a judge, years later (${friend.firstName} ${friend.lastName})`);
  let before = null;
  for (let i = 0; i < 60 && !before; i++) { const c = lc.createCase('boundary', { track: 'lawyer' }); if (c.judgeId === friend.id) before = c; }
  check(!!before, 'and presides over one of your cases');
  store.state.pendingEvents = [];
  lp.storyBeats();
  check(queued().includes('law_old_classmate'), 'a scene: an old classmate on the bench');
  lp.lawChoice('classmate:recuse');
  check(before.judgeId !== friend.id, 'asking for another judge moves the case to someone else');
}

// Every choice of every scene does something, with nothing thrown.
{
  lawyer('lawyer');
  let quiet = 0;
  for (const ev of LAW) for (const ch of ev.choices) {
    const v = ch.outcomes[0].effects[0].value;
    try { lp.lawChoice(v); } catch (e) { check(false, `${v} threw: ${e.message}`); }
    void quiet;
  }
  check(true, 'every choice can be made without error, even when its case is not there');
}

finish('The scenes of a legal life hold.');
