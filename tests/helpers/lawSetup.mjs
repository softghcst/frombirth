// Shared setup for the legal career checks: a fresh life, a graduate, a licensed lawyer.
const mem = new Map();
globalThis.localStorage ??= { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };

export const { store } = await import('../../js/state.js');
export const { rng } = await import('../../js/rng.js');
export const { createLife } = await import('../../js/engine/characterGen.js');
export const { advanceTurn, setStep } = await import('../../js/engine/turns.js');
export const edu = await import('../../js/engine/education.js');
export const ls = await import('../../js/engine/lawSchool.js');
export const lp = await import('../../js/engine/lawPractice.js');
export const lc = await import('../../js/engine/lawCases.js');
export const k = await import('../../js/engine/cases.js');
export const career = await import('../../js/engine/career.js');
export const { CAREER_BY_ID } = await import('../../js/data/careers.js');
export const { saveGame, loadGame } = await import('../../js/save.js');

export const problems = [];
export const check = (c, m) => { if (!c) { problems.push(m); console.log(` ✗ ${m}`); } else console.log(` ✓ ${m}`); };
export const finish = (done) => { if (problems.length) { console.log(`PROBLEMS:\n - ${problems.join('\n - ')}`); process.exit(1); } console.log(done); };

/** One turn, with the year's scenes cleared so nothing waits on a choice. */
export const turn = () => { store.state.pendingEvents = []; advanceTurn(); };
/** A graduate of a first degree, ready for law school, in a country (the US unless said). */
export function graduate(o = {}) {
  let s; do { s = createLife({ countryId: o.countryId ?? 'us', city: o.city }); } while (s.player.royal);
  store.state = s;
  const p = s.player;
  p.age = o.age ?? 22; p.birthYear = s.year - p.age; p.stats.intellect = o.intellect ?? 78; p.finance.cash = o.cash ?? 400000;
  p.education.stage = 'none'; p.education.enrolled = false;
  p.education.degrees.push({ type: 'high', gpa: 3.6, age: 18 }, { type: 'university', majorId: 'political_science', gpa: o.gpa ?? 3.7, age: 22 });
  if (o.step) s.settings = { ...(s.settings ?? {}), step: o.step };
  return p;
}
/** A licensed lawyer, admitted through the real bar route but without playing the years of school. */
export function lawyer(careerId = 'lawyer', o = {}) {
  const p = graduate(o);
  p.age = 27; p.birthYear = store.state.year - 27;
  p.education.degrees.push({ type: 'law', majorId: 'political_science', gpa: 3.4, age: 25 });
  const L = ls.lawOf(p);
  L.bar.admitted = { year: store.state.year, m: ls.nowM(), where: 'United States', body: 'admission to the state bar' };
  (p.flags.licenses ??= []).push('law');
  career.hire(CAREER_BY_ID[careerId], o.level ?? 0, 60, 'test');
  return p;
}
/** Plays a case: interview, review, research (right), the strongest filing, then the day in court with sound choices. */
export function playCase(c, o = {}) {
  if (c.clientId) lc.interview(c);
  lc.review(c);
  const rq = lc.researchQuestion(c);
  if (rq) lc.research(c, rq.right);
  if (lc.filingOptions(c)) lc.file(c, 'strong');
  for (let i = 0; i < 40 && !c.awaiting && !c.done; i++) turn();
  if (c.done) return c.outcome;
  const day = lc.courtroom(c);
  const ans = Object.fromEntries(day.phases.map((ph) => [ph.id, ph.valid ?? ph.good ?? ph.options[0].v]));
  lc.argue(c, o.answers ?? ans);
  return c.outcome;
}
