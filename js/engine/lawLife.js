// A legal life around the cases: pro bono work for people who cannot pay, what the work does to a family, and the end
// of a career (a judge's mandatory retirement age where the law sets one, or a lawyer's own choice), looked back on.
//
//   L.proBono = { done: n, window }     L.retired = { year, how, summary }
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { store, player, log } from '../state.js';
import { CASE_TEMPLATES } from '../data/law.js';
import { lawOf, nowM, canon, admitted } from './lawSchool.js';
import * as cases from './lawCases.js';
import { governing } from './realLaw.js';
import { quitCareer } from './career.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
const npc = (id) => store.state.npcs[id];
const FAMILY = ['spouse', 'partner', 'child', 'parent', 'sibling'];

// ---------- Pro bono ----------

const PRO_BONO = ['eviction', 'wage_claim', 'protective_order', 'family_petition', 'asylum', 'will', 'support_change'];
/** Why pro bono work is not open now, or ''. Once a half-year, for any admitted lawyer who practices. */
export function proBonoWhy(p = player()) {
  const L = lawOf(p);
  if (!admitted(p)) return 'After admission to the bar';
  if (p.career?.careerId === 'judiciary') return 'A judge does not take clients';
  if (L.retired) return 'You have retired from practice';
  if ((L.proBono?.window ?? -1) === Math.floor(nowM() / 6)) return 'One pro bono case each half-year';
  return '';
}
/** Three people who cannot pay, each with the kind of case legal aid sees. */
export function proBonoOptions(p = player()) {
  if (proBonoWhy(p)) return [];
  const w = Math.floor(nowM() / 6);
  const pool = PRO_BONO.filter((id) => CASE_TEMPLATES[id]);
  const picks = [];
  for (let i = 0; picks.length < 3 && i < 20; i++) { const id = pool[(w * 7 + i * 3) % pool.length]; if (!picks.includes(id)) picks.push(id); }
  return picks.map((id) => ({ id, summary: CASE_TEMPLATES[id].summary.replace(/\{client\}/g, 'Someone who cannot afford a lawyer').replace(/\{\w+\}/g, (m) => ({ '{other}': 'the other side', '{otherOrg}': 'a company', '{child}': 'a child' }[m] ?? 'some')) }));
}
/** Takes a pro bono case: no fee; it counts for the lawyer's name and for the people it helps. */
export function takeProBono(id, p = player()) {
  const why = proBonoWhy(p);
  if (why) return result(false, why, 'neutral');
  if (!proBonoOptions(p).some((o) => o.id === id)) return result(false, 'That case is not on the list.', 'neutral');
  const L = lawOf(p);
  const c = cases.createCase(id, { track: p.career?.careerId ?? 'own', specialty: L.specialty });
  if (!c) return result(false, 'That case could not be opened.', 'neutral');
  c.fee.model = 'pro_bono'; c.proBono = true;
  cases.note(c, 'Taken pro bono: no fee.');
  L.proBono = { done: (L.proBono?.done ?? 0), window: Math.floor(nowM() / 6) };
  return result(true, `You took ${c.title} pro bono.`, 'good', { caseId: c.id });
}
/** When a pro bono case closes: integrity, standing, and a milestone after ten. Called from tickLawLife. */
function settleProBono(p) {
  const L = lawOf(p);
  for (const c of L.caseIds.map(cases.caseById).filter((x) => x?.proBono && x.done && !x.proBonoCounted)) {
    c.proBonoCounted = true;
    L.proBono = { ...(L.proBono ?? {}), done: (L.proBono?.done ?? 0) + 1 };
    L.rep.integrity = clamp(L.rep.integrity + 2);
    L.rep.recognition = clamp(L.rep.recognition + 1);
    if (L.proBono.done === 10) canon(`law:probono10:${p.id}`, 'Ten pro bono cases', 'Represented ten people who could not afford a lawyer, without a fee.', { privacy: 'public', sig: 2 });
  }
}

// ---------- The work and the family ----------

/**
 * A heavy stretch at work (a full desk, or trials waiting) can strain a marriage or a partnership: a scene, now and
 * then, asks what gives. A big public win makes the family proud; a public disgrace costs them something too.
 */
function familyStrain(p) {
  const L = lawOf(p);
  const w = Math.floor(nowM() / 6);
  if ((L.strainWindow ?? -99) >= w - 9) return; // rare: at most once in five years
  const load = cases.workload(p);
  const trials = L.caseIds.map(cases.caseById).filter((c) => c && !c.done && c.awaiting).length;
  const close = p.npcIds.map(npc).find((n) => n?.alive && ['spouse', 'partner'].includes(n.role));
  // Only a truly overwhelming stretch: far more on the desk than it can hold, or three trials at once.
  if (!close || (load.points <= load.capacity * 1.3 && trials < 3)) return;
  if (!rng.chance(0.25)) return;
  L.strainWindow = w;
  L.strainWith = close.id;
  store.state.pendingEvents.push({ id: 'law_family_strain', cast: { words: { name: close.firstName, trials: String(Math.max(trials, 1)) } } });
}
/** The choice in the family strain scene. */
export function strainChoice(choice, p = player()) {
  const L = lawOf(p);
  const n = npc(L.strainWith);
  if (!n) return '';
  const open = L.caseIds.map(cases.caseById).filter((c) => c && !c.done).sort((a, b) => b.level - a.level)[0];
  if (choice === 'home') { n.meters.relationship = clamp(n.meters.relationship + 6); if (open) open.bonus = (open.bonus ?? 0) - 0.02; return `You are home for dinner every night this month. ${n.firstName} notices. The case notices too, a little.`; }
  if (choice === 'ask') { n.meters.relationship = clamp(n.meters.relationship - 1); return `You explain what the next weeks will be like. ${n.firstName} says they understand, and mostly does.`; }
  n.meters.relationship = clamp(n.meters.relationship - 7);
  if (open) open.bonus = (open.bonus ?? 0) + 0.02;
  return `You sleep at the office twice. The brief is excellent. ${n.firstName} stops waiting up.`;
}
/** Pride and shame: the family hears about a big public win, or a disgrace. Called once per such event. */
export function familyHears(kind, p = player()) {
  const d = kind === 'win' ? 3 : -6;
  for (const n of p.npcIds.map(npc).filter((x) => x?.alive && FAMILY.includes(x.role))) n.meters.relationship = clamp(n.meters.relationship + d);
  log(kind === 'win' ? 'Your family saw the news about your case. Your phone fills with messages.' : 'The news reached your family. Some of them call; some do not.', 'system', kind === 'win' ? 'good' : 'bad');
}

// ---------- Retirement ----------

/** The age a judge must retire here and now, under the law in force, or null where none is listed. */
export function judicialRetirementAge(countryId = player().countryId) {
  return governing('judicial_retirement', countryId)?.age ?? null;
}
/** A look back at a legal career: years, the record, the biggest cases, the honors. */
export function careerSummary(p = player()) {
  const L = lawOf(p);
  const H = L.history.filter((h) => !h.clinic && !h.referred);
  const big = H.filter((h) => h.favorable > 0).sort((a, b) => (b.level ?? 0) - (a.level ?? 0)).slice(0, 3).map((h) => `${h.title} (${h.year})`);
  const years = Math.round(Object.entries(p.career?.experience ?? {}).reduce((s, [, y]) => s + y, 0));
  return { years, cases: H.length, won: H.filter((h) => h.favorable > 0).length, big, proBono: L.proBono?.done ?? 0, bench: (L.benchRecord ?? []).length };
}
/** Retires from law, by choice (from 55) or at a judge's mandatory age. The career is looked back on, and kept. */
export function retire(how = 'choice', p = player()) {
  const L = lawOf(p);
  if (L.retired) return result(false, 'You have retired already.', 'neutral');
  if (how === 'choice' && p.age < 55) return result(false, 'From age 55.', 'neutral');
  const s = careerSummary(p);
  const judge = p.career?.careerId === 'judiciary';
  for (const c of L.caseIds.map(cases.caseById).filter((x) => x && !x.done)) { c.done = true; c.awaiting = null; c.outcome = { kind: 'referred', text: 'Handed to a colleague on retirement.', favorable: 0, m: nowM(), year: store.state.year }; }
  L.retired = { year: store.state.year, how, summary: s };
  if (p.career?.careerId) quitCareer();
  const text = `${judge ? 'Retired from the bench' : 'Retired from the law'} after ${s.years} years: ${s.cases} cases${s.bench ? `, ${s.bench} matters heard as a judge` : ''}${s.proBono ? `, ${s.proBono} without a fee` : ''}.`;
  canon(`law:retired:${p.id}`, judge ? 'Retired from the bench' : 'Retired from the law', text, { privacy: 'public', sig: 3 });
  // A judge of long service is remembered where they sat.
  if (judge && s.bench >= 10) canon(`law:portrait:${p.id}`, 'A portrait in the courthouse', 'Their portrait was hung in the courthouse where they served.', { privacy: 'public', sig: 2 });
  store.state.pendingEvents.push({ id: 'law_retirement', cast: { words: { years: String(s.years), big: s.big.length ? s.big.join('; ') : 'cases nobody wrote about, which mattered to the people in them' } } });
  return result(true, how === 'mandatory' ? `You have reached the retirement age for judges. ${text}` : text, 'good', { summary: s });
}
/** The choice in the retirement scene. */
export function retirementChoice(choice, p = player()) {
  const L = lawOf(p);
  if (choice === 'mentor') { L.mentoring = true; return 'You agree to mentor two young lawyers. The phone keeps ringing, and you are glad of it.'; }
  if (choice === 'speech') return 'Your speech is short. The room stands anyway.';
  return 'You clear your desk on a Friday and leave by the side door. It is enough.';
}

// ---------- Time ----------

/** Each turn: pro bono cases settled, a strained stretch at home, and a judge's mandatory retirement. */
export function tickLawLife(p = player()) {
  if (!p.law) return;
  settleProBono(p);
  if (!p.law.retired && admitted(p)) familyStrain(p);
  const age = judicialRetirementAge(p.countryId);
  if (p.career?.careerId === 'judiciary' && age && p.age >= age && !p.law.retired) {
    const r = retire('mandatory', p);
    log(r.text, 'system', 'neutral');
  }
}
