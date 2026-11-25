// A legal career: the practice on top of the career engine (engine/career.js), which still owns hiring, salary,
// reviews and promotions. This adds what a lawyer's working life is made of: a specialty, cases offered or assigned
// in a way that fits the job (a firm takes clients, a prosecutor and a public defender are assigned cases), conflict
// checks, a workload that can be too much, supervision for juniors, promotions that need more than years (a
// partnership vote, being chosen as District Attorney), a practice of one's own (a law firm in the business engine),
// and the paths to the bench and to Attorney General, which are elections and appointments, never rewards for wins.
//
// Opportunities come by the half-year on the World Clock, so a player taking three-month turns sees no more of them
// than one taking a year at a time.
import { rng } from '../rng.js';
import { clamp, localCost, fmtMoney } from '../util.js';
import { store, player, country, log } from '../state.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { TRACKS, SPECIALTIES, SPECIALTY_BY_ID, CASE_TEMPLATES, COMPLEXITY, LEGAL_SKILLS, REPUTATION, skillsFor } from '../data/law.js';
import { lawOf, nowM, profileFor, canon, admitted, progressSchool, progressBar, keepPerson, gain, school, prepareBar } from './lawSchool.js';
import * as k from './cases.js';
import * as cases from './lawCases.js';
import { currentCareer, hire, promote, adjustPerformance, addPromotionGate } from './career.js';
import { businesses } from './business.js';
import { convictionsOf } from './records.js';
import { finishLawSchool } from './education.js';
import { employer as employerOf } from './employers.js';
import { duel } from './elections.js';
import * as world from './polity.js';
import { VOTERS } from '../data/parties.js';
import * as realLawMod from './realLaw.js';
import { discipline } from './lawCases.js';

/**
 * An election for a legal office, counted with the politics engine's own arithmetic (engine/elections.js) against a
 * real politician of the world (engine/polity.js), and kept with the player's other races (p.flags.races).
 * The campaign itself (engine/lawCampaign.js) comes in as `boost`; a race nobody campaigned for is the count alone.
 */
export function legalElection(p, title, level, s, boost = 0, officeId = null, rivalName = null) {
  const w = world.polity(p.countryId);
  const mine = world.membership(p.countryId);
  const fig = w.kind === 'party' || w.kind === 'none' ? null : world.opponentFor(level === 'local' ? 'mayor' : 'region', p.countryId);
  const theirs = fig ? world.party(w, fig.partyId) : null;
  const legalRival = Object.values(store.state.npcs).find((n) => n.alive && n.flags.rivalOf === p.id && n.flags.justice?.kind === 'prosecutor');
  const NEUTRAL = { tax: 0, services: 0, housing: 0, order: 1, green: 0, open: 0 };
  // The year's mood and the campaign itself swing a race either way, as much as anything on paper.
  const swing = (rng.next() * 2 - 1) * 9;
  const me = { id: 'me', positions: mine?.positions ?? NEUTRAL, appeal: s * 40 + (p.stats.charm - 50) / 5 + (p.hidden.fame ?? 0) / 10 + boost + swing };
  const them = { id: 'rival', positions: theirs?.positions ?? NEUTRAL, appeal: fig ? ((fig.t?.charisma ?? 55) - 55) / 8 : 0 };
  const res = duel(me, them, VOTERS, (n) => (rng.next() * 2 - 1) * n, level === 'local' ? 400000 : 3000000);
  const share = res.shares.me;
  const rival = rivalName ?? (level === 'local' && legalRival ? `${legalRival.firstName} ${legalRival.lastName}` : fig?.name ?? 'your opponent');
  const rec = { year: store.state.year, countryId: p.countryId, officeId: officeId ?? (level === 'local' ? 'district_attorney' : 'attorney_general'), title, rival, rivalParty: theirs?.name ?? null, rivalColor: theirs?.color ?? '#777',
    party: mine?.name ?? null, color: mine?.color ?? '#444', share, won: share > 50, votes: { ...res.votes }, total: res.total, turnout: res.turnout, legal: true };
  const races = (p.flags.races ??= []);
  races.push(rec);
  if (races.length > 15) races.shift();
  p.counters.polExp = (p.counters.polExp ?? 0) + 1;
  return rec;
}
import { events, visible, archiveIdOf, archived } from './chronicle.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
export const WINDOW = 6;
const LEGAL = new Set(['lawyer', 'prosecutor', 'defender', 'gov_counsel', 'judiciary', 'attorney_general', 'us_attorney', 'solicitor_general']);

// ---------- Where the player stands ----------

/** An open law practice of the player's own (the business engine's law firm), or null. */
export const ownFirm = (p = player()) => businesses(p).find((b) => b.typeId === 'law_firm' && b.status === 'open') ?? null;
/**
 * The kind of legal work the player does now: a firm ('lawyer'), the prosecutor's office, the public defender's office,
 * a government legal office, the bench, the Attorney General's office, a practice of their own ('own'), or null.
 */
export function trackOf(p = player()) {
  const id = p.career?.careerId;
  if (LEGAL.has(id)) return id;
  if (ownFirm(p)) return 'own';
  return null;
}
/** Years of legal work, from the career engine's record of experience. */
export function legalYears(p = player()) {
  const ex = p.career?.experience ?? {};
  return [...LEGAL].reduce((s, id) => s + (ex[id] ?? 0), 0);
}
/** Licensed, not suspended or disbarred, and able to take a client's case. */
export const inTraining = (p = player()) => !!p.law?.bar?.training && !p.law.bar.training.done && !p.law.bar.admitted;
export function mayPractice(p = player()) {
  const L = lawOf(p);
  if (inTraining(p) && LEGAL.has(p.career?.careerId)) return ''; // a trainee works, always under supervision
  if (!admitted(p)) return 'You are not admitted to practice. A law degree alone does not allow it.';
  if (L.bar.disbarred) return 'You were disbarred.';
  if ((L.suspendedUntil ?? 0) > nowM()) return 'You are suspended from practice.';
  if (trackOf(p) === 'judiciary') return 'A judge does not represent clients.';
  return '';
}
/** The specialties open on the current track. Only playable ones can be chosen as the main practice. */
export function specialtyOptions(p = player()) {
  const t = trackOf(p);
  return SPECIALTIES.map((s) => ({ ...s, open: !!t && s.tracks.includes(t === 'own' ? 'own' : t), current: lawOf(p).specialty === s.id }));
}
export function chooseSpecialty(id, p = player()) {
  const s = specialtyOptions(p).find((x) => x.id === id);
  if (!s) return result(false, 'There is no such practice area.', 'neutral');
  if (!s.open) return result(false, 'That is not practiced where you work.', 'neutral');
  if (!s.playable) return result(false, `${s.name} is not yet playable in Pathways.`, 'neutral');
  const L = lawOf(p);
  if (L.specialty === id) return result(false, 'That is already your practice.', 'neutral');
  const had = L.specialty;
  L.specialty = id;
  L.specialtySince = nowM();
  if (had) { L.rep.recognition = clamp(L.rep.recognition - 3); return result(true, `You moved your practice to ${s.name.toLowerCase()}. Some of your name does not carry over.`, 'neutral'); }
  return result(true, `Your practice: ${s.name}.`, 'good');
}
const defaultSpecialty = (t) => ({ prosecutor: 'prosecution', defender: 'public_defense', gov_counsel: 'government' }[t] ?? 'civil_litigation');
/**
 * Keeps the practice area in step with the job: a defense lawyer who joins the prosecutor's office practices
 * prosecution there. Offices whose work no specialty lists (the bench, the Attorney General) keep what they had.
 */
export function fitSpecialty(p = player()) {
  const t = trackOf(p);
  const L = lawOf(p);
  if (!t || !SPECIALTIES.some((s) => s.tracks.includes(t))) return L.specialty ?? null;
  if (!L.specialty || !SPECIALTY_BY_ID[L.specialty]?.tracks.includes(t)) L.specialty = defaultSpecialty(t);
  return L.specialty;
}

/** The hardest case the player leads on their own: by job and level, or for a practice of their own, by its standing. */
export function leadCap(p = player()) {
  const t = trackOf(p);
  if (t === 'own') { const b = ownFirm(p); return clamp(Math.floor(2 + legalYears(p) / 5 + (b?.reputation ?? 30) / 50), 2, 5); }
  return TRACKS[t]?.cases[p.career.level] ?? 1;
}

// ---------- Cases offered and assigned ----------

/** What a case would pay a private practice, before it is taken. */
const feeFor = (level) => localCost([0, 1500, 4000, 9000, 22000, 60000][level], country());
const pickTemplate = (specialtyId, maxLevel) => {
  const s = SPECIALTY_BY_ID[specialtyId];
  const pool = (s?.cases ?? []).filter((id) => CASE_TEMPLATES[id] && CASE_TEMPLATES[id].level <= maxLevel);
  return pool.length ? rng.pick(pool) : null;
};

/**
 * The half-year's opportunities. A firm or a practice of one's own is offered clients; a prosecutor, a public defender
 * and government counsel are assigned cases by their office, opened straight onto their desk.
 */
export function refreshOpportunities(p = player()) {
  const L = lawOf(p);
  const now = Math.floor(nowM() / WINDOW);
  if (L.window === now) return;
  // Every half-year a turn passed through brings its own opportunities, so a year lived in one turn brings as many
  // as a year in four. Offers stay open for a year: two windows.
  const from = L.window == null ? now : Math.max(L.window + 1, now - 1);
  L.offers = (L.offers ?? []).filter((o) => o.window == null || o.window >= now - 1);
  for (let w = from; w <= now; w++) openWindow(p, w);
  L.window = now;
}
function openWindow(p, w) {
  const L = lawOf(p);
  const t = trackOf(p);
  if (!t || mayPractice(p) || t === 'attorney_general') return;
  fitSpecialty(p);
  const cap = leadCap(p);
  if (['prosecutor', 'defender', 'gov_counsel'].includes(t)) {
    // Assigned by the office: a public defender's caseload is heavy; nobody chooses their clients.
    // The office assigns a set share every half-year, whatever is on the desk: that is what a heavy caseload is.
    // A ceiling keeps it from growing without end; too much work shows in deadlines, health and reliability.
    const n = t === 'defender' ? 3 : t === 'prosecutor' ? 2 : 1;
    for (let i = 0; i < n && cases.workload(p).open < 14; i++) {
      const second = rng.chance(0.25) && cap < 5;
      const tid = pickTemplate(L.specialty, second ? cap + 1 : cap);
      if (!tid) break;
      openCase(p, tid, { role: t === 'prosecutor' ? 'prosecution' : CASE_TEMPLATES[tid].kind === 'criminal' ? 'defense' : undefined, assigned: true, second: CASE_TEMPLATES[tid].level > cap });
    }
    return;
  }
  const n = Math.max(1, t === 'own' ? 2 + (ownFirm(p)?.reputation >= 60 ? 1 : 0) + (FEE_STRATEGIES[L.fees ?? 'standard']?.offers ?? 0) + (L.adBoost === w ? 1 : 0) : 2);
  const taken = new Set((L.offers ?? []).map((o) => o.templateId));
  for (let i = 0; i < n; i++) {
    const second = inTraining(p) || (t === 'lawyer' && rng.chance(0.3) && cap < 5);
    let tid = pickTemplate(L.specialty, second ? cap + 1 : cap);
    for (let k = 0; k < 4 && taken.has(tid); k++) tid = pickTemplate(L.specialty, second ? cap + 1 : cap); // different cases, not the same one twice
    if (!tid || taken.has(tid)) continue;
    taken.add(tid);
    const T = CASE_TEMPLATES[tid];
    L.offers.push({ id: `of${w}_${i}`, window: w, templateId: tid, level: T.level, second: inTraining(p) || T.level > cap, fee: feeFor(T.level), kind: T.kind, specialty: L.specialty,
      summary: T.summary.replace(/\{\w+\}/g, (m) => ({ '{client}': 'the client', '{other}': 'their spouse', '{child}': 'the child', '{otherOrg}': 'a company', '{clientOrg}': 'the client company' }[m] ?? 'some')).replace(/(^|[.!?]\s+)([a-z])/g, (x, a, b) => a + b.toUpperCase()) });
  }
  // A former client may come back with something new: the same person, their history with the player intact.
  const former = Object.values(store.state.npcs).filter((n) => n.alive && n.flags.formerClientOf === p.id && n.meters.relationship >= 55);
  if (former.length && rng.chance(0.35)) {
    const back = rng.pick(former);
    const tid = pickTemplate(L.specialty, cap) ?? 'contract_dispute';
    L.offers.push({ id: `of${w}_back`, window: w, second: inTraining(p), templateId: tid, level: CASE_TEMPLATES[tid].level, fee: feeFor(CASE_TEMPLATES[tid].level), kind: CASE_TEMPLATES[tid].kind, clientId: back.id, returning: true,
      summary: `${back.firstName} ${back.lastName}, whose case you handled in ${store.state.npcs[back.id].flags.lastCaseYear ?? 'the past'}, is back with a new matter.` });
  }
  // A prominent client, only for an experienced lawyer whose name is known in the right field. Not a reward for wins.
  if (L.rep.recognition >= 40 && cap >= 4 && legalYears(p) >= 10 && rng.chance(0.25)) {
    const tid = pickTemplate(L.specialty, 5);
    if (tid && CASE_TEMPLATES[tid].level >= 3) {
      const who = rng.pick(['a professional athlete', 'a television actor', 'a large company', 'a city council', 'a well-known chef']);
      L.offers.push({ id: `of${w}_major`, window: w, templateId: tid, level: Math.max(4, CASE_TEMPLATES[tid].level), fee: feeFor(5), kind: CASE_TEMPLATES[tid].kind, prominent: who,
        summary: `${who.charAt(0).toUpperCase()}${who.slice(1)} wants you, and only you. ${CASE_TEMPLATES[tid].summary.replace(/\{\w+\}/g, 'the client')}` });
    }
  }
}
/** Offers waiting for an answer this half-year. */
export function offers(p = player()) { refreshOpportunities(p); return lawOf(p).offers ?? []; }

/** Opens a case on the player's desk, with a supervisor when it is above their level. */
function openCase(p, templateId, o = {}) {
  const L = lawOf(p);
  const t = trackOf(p);
  if (inTraining(p)) o = { ...o, second: true }; // a trainee is always second chair
  const sup = o.second ? supervisor(p) : null;
  // A child welfare case: government counsel acts for the agency; a private lawyer may be the child's attorney, a guardian ad litem, or a parent's attorney.
  if (templateId === 'dependency' && !o.role) o = { ...o, role: t === 'gov_counsel' ? 'childProtection' : rng.pick(['childAttorney', 'gal', 'parentAttorney']) };
  const c = cases.createCase(templateId, { role: o.role, assigned: o.assigned, specialty: L.specialty, supervisorId: sup?.id ?? null, fee: o.fee, clientId: o.clientId, track: t });
  c.second = !!o.second;
  if (o.prominent) { c.prominent = o.prominent; c.level = Math.max(c.level, o.level ?? c.level); }
  if (!L.firstClient && !c.clinic) { L.firstClient = c.id; queue('law_first_client', { client: c.vars.client }); }
  return c;
}
/** The senior lawyer a junior works under. One per employer, and they stay. */
export function supervisor(p = player()) {
  const t = trackOf(p);
  const title = { lawyer: 'Supervising partner', prosecutor: 'Lead prosecutor', defender: 'Chief defender', gov_counsel: 'Supervising attorney', own: 'Of counsel' }[t] ?? 'Senior attorney';
  return keepPerson(p, `supervisor_${p.career?.employerId ?? t}`, 'mentor', title, rng.int(42, 64));
}

/** Who a case would pit the player against: former clients on the other side, or family. */
function conflictIn(o, p) {
  if (!o.clientId) return '';
  const n = store.state.npcs[o.clientId];
  if (n && p.npcIds.includes(n.id) && ['spouse', 'parent', 'child', 'sibling'].includes(n.role)) return 'You cannot act for your own family in a matter like this.';
  return '';
}
/** Accepts an offered case: licensed, no conflict, room on the desk. */
export function accept(offerId, p = player()) {
  const why = mayPractice(p);
  if (why) return result(false, why, 'neutral');
  const L = lawOf(p);
  const o = (L.offers ?? []).find((x) => x.id === offerId);
  if (!o) return result(false, 'That offer has gone.', 'neutral');
  const conflict = conflictIn(o, p);
  if (conflict) return result(false, `Conflict of interest: ${conflict}`, 'neutral');
  const load = cases.workload(p);
  if (load.points + o.level > load.capacity * 1.6) return result(false, 'You have no room on your desk for it. Finish or refer a case first.', 'neutral');
  L.offers = L.offers.filter((x) => x !== o);
  const c = openCase(p, o.templateId, { fee: SPECIALTY_BY_ID[o.specialty]?.fees?.[0], clientId: o.clientId, second: o.second, prominent: o.prominent, level: o.level });
  if (o.prominent) canon(`law:prominent:${c.id}`, 'A prominent client', `Took on ${o.prominent} as a client.`, { privacy: 'public', sig: 2, milestone: false });
  return result(true, `You took the case: ${c.title}.${c.supervisorId ? ` ${store.state.npcs[c.supervisorId].firstName} ${store.state.npcs[c.supervisorId].lastName} leads; you are second chair.` : ''}`, 'good', { caseId: c.id });
}
export function decline(offerId, refer = false, p = player()) {
  const L = lawOf(p);
  const o = (L.offers ?? []).find((x) => x.id === offerId);
  if (!o) return result(false, 'That offer has gone.', 'neutral');
  L.offers = L.offers.filter((x) => x !== o);
  if (refer) { L.rep.clients = clamp(L.rep.clients + 0.5); return result(true, 'You referred the client to a colleague who handles this well.', 'neutral'); }
  return result(true, 'You declined.', 'neutral');
}
/** Hands a case on: to cut a workload, or because it should not stay. No fee, no outcome of the player's. */
export function referOut(caseId, p = player()) {
  const c = cases.caseById(caseId);
  if (!c || c.done || c.lawyerId !== p.id) return result(false, 'Not your open case.', 'neutral');
  c.done = true; c.awaiting = null;
  c.outcome = { kind: 'referred', text: 'Handed to a colleague.', favorable: 0, m: nowM(), year: store.state.year };
  c.history.push({ m: nowM(), year: store.state.year, text: 'Referred to a colleague.' });
  lawOf(p).history.push({ caseId: c.id, title: c.title, kind: c.kind, role: c.role, outcome: 'referred', favorable: 0, trial: false, level: c.level, year: store.state.year, track: c.track, referred: true });
  return result(true, 'You handed the case to a colleague.', 'neutral');
}

// ---------- Law student clinic ----------

/** A supervised clinic case for a law student in their second year or later. The student is not a lawyer, and says so. */
export function clinicCase(p = player()) {
  if (p.education.enrolled && p.education.stage === 'law') school(p);
  const S = lawOf(p).school;
  if (!S || S.done || !(p.education.enrolled && p.education.stage === 'law')) return result(false, 'Clinics are for law students.', 'neutral');
  const y = Math.floor((nowM() - S.start) / 12);
  if (y < 1) return result(false, 'Clinics start in the second year.', 'neutral');
  const L = lawOf(p);
  if (L.acts[`clinic:${y}`]) return result(false, 'You have a clinic case this year.', 'neutral');
  L.acts[`clinic:${y}`] = nowM();
  const sup = keepPerson(p, 'clinicDirector', 'mentor', 'Clinic director', rng.int(40, 64));
  const c = cases.createCase(rng.pick(['will', 'family_petition']), { role: 'clinic', clinic: true, supervisorId: sup.id });
  gain(p, { counseling: 1 });
  canon(`law:clinic:${p.id}:${y}`, 'A legal clinic case', `Helped a client under the supervision of ${sup.firstName} ${sup.lastName}.`, { milestone: false, sig: 1 });
  return result(true, `The clinic assigns you ${c.vars.client}'s case. ${sup.firstName} ${sup.lastName} will check every step: you are a student, not yet a lawyer.`, 'good', { caseId: c.id });
}

// ---------- The record ----------

/** Statistics, counted from the cases actually closed: nothing made up. */
export function stats(p = player()) {
  const H = lawOf(p).history.filter((h) => !h.clinic && !h.referred);
  const n = (f) => H.filter(f).length;
  return { completed: n((h) => h.kind !== 'appeal'), trials: n((h) => h.trial), trialsWon: n((h) => h.trial && h.favorable > 0), trialsLost: n((h) => h.trial && h.favorable <= 0),
    settlements: n((h) => h.outcome === 'settlement'), pleas: n((h) => h.outcome === 'plea'), dismissals: n((h) => h.outcome === 'dismissed'),
    appeals: n((h) => h.kind === 'appeal'), approvals: n((h) => h.outcome === 'approved'), deals: n((h) => ['closed', 'closed_risk'].includes(h.outcome)),
    legacyUnknown: !!lawOf(p).legacy };
}
const completedIn = (p, track) => lawOf(p).history.filter((h) => !h.clinic && !h.referred && h.kind !== 'appeal' && (!track || h.track === track)).length;

// ---------- Promotions and selection ----------

const GATE_TEXT = { elevation: 'appointment to the higher court', us_attorney: 'nomination by the President and confirmation by the Senate', solicitor_general: 'nomination by the President and confirmation by the Senate', partnership: 'a vote of the partners', managing: 'election by the partners as managing partner', da: 'selection as District Attorney (an election or appointment)',
  chief_defender: 'appointment as head of the office', general_counsel: 'appointment as general counsel', ag: 'election or appointment as Attorney General' };
/** What the career engine also needs before a legal promotion: real experience in cases, standing, and for some posts a selection. */
function gate(careerId, at) {
  const t = TRACKS[careerId];
  const p = player();
  if (!t) return [];
  const L = lawOf(p);
  const out = [];
  if (!admitted(p) && careerId !== 'judiciary') out.push('admission to the bar');
  const need = t.minDone[at] ?? 0;
  const done = completedIn(p, careerId);
  if (!L.legacy && done < need) out.push(`${need} completed cases (you have ${done})`);
  if (L.rep.integrity < 40) out.push('a better name for integrity');
  const g = t.gates[at];
  if (g && L.selected?.[g] !== p.career.employerId + ':' + at) out.push(GATE_TEXT[g]);
  return out;
}
addPromotionGate(gate);
const select = (p, g) => { (lawOf(p).selected ??= {})[g] = `${p.career.employerId}:${p.career.level + 1}`; };

/** The selections the player could seek now, with why not where they cannot. */
export function opportunities(p = player()) {
  const t = trackOf(p);
  const L = lawOf(p);
  const c = p.career;
  const yrs = legalYears(p);
  const prof = profileFor(p.countryId);
  const out = [];
  const cool = (id, months) => (L.tried?.[id] != null && nowM() - L.tried[id] < months ? `You tried recently. Again in ${months - (nowM() - L.tried[id])} months.` : '');
  const career = currentCareer();
  if (t === 'lawyer') {
    const nextAt = c.level + 1;
    const g = TRACKS.lawyer.gates[nextAt];
    if (g) {
      const served = c.yearsInRole >= (career.levels[c.level]?.years ?? 99);
      const done = completedIn(p, 'lawyer');
      const why = !served ? `After ${career.levels[c.level].years} years as ${c.title.toLowerCase()}` : !L.legacy && done < TRACKS.lawyer.minDone[nextAt] ? `${TRACKS.lawyer.minDone[nextAt]} completed cases first (${done})` : cool(g, 24);
      out.push({ id: g, name: g === 'partnership' ? 'Seek partnership' : 'Stand for managing partner', why });
    }
  }
  if (t === 'judiciary' && career.levels[c.level + 1]) {
    const served = c.yearsInRole >= (career.levels[c.level]?.years ?? 99);
    out.push({ id: 'elevation', name: `Seek appointment as ${career.levels[c.level + 1].title.toLowerCase()}`, why: !served ? `After ${career.levels[c.level].years} years as ${c.title.toLowerCase()}` : L.rep.integrity < 60 ? 'A better name for integrity first' : (L.misconduct ?? 0) > 0 ? 'Not with misconduct on your record' : cool('elevation', 36), how: prof.judges });
  }
  if (t === 'prosecutor' && c.level >= 2) out.push({ id: 'da', name: `Seek the office of ${prof.titles.prosecutorChief}`, why: yrs < 8 ? 'After eight years of legal work' : cool('da', 48), how: prof.da, campaign: prof.da === 'elected' });
  if (t === 'defender' && c.level >= 1) out.push({ id: 'chief_defender', name: `Seek appointment as ${prof.titles.defenderChief}`, why: yrs < 8 ? 'After eight years of legal work' : cool('chief_defender', 24) });
  if (t === 'gov_counsel' && c.level >= 2) out.push({ id: 'general_counsel', name: 'Seek appointment as agency general counsel', why: yrs < 8 ? 'After eight years of legal work' : cool('general_counsel', 24) });
  if (admitted(p) && t && t !== 'judiciary') {
    const clean = !convictionsOf(p).length;
    out.push({ id: 'judge', name: 'Apply for a judicial vacancy', why: p.age < 35 ? 'From age 35' : yrs < 8 ? 'After eight years of legal work' : !clean ? 'A judge needs a clean record' : L.rep.integrity < 55 ? 'A better name for integrity first' : cool('judge', 24), how: prof.judges });
    // Many American states elect their trial judges: a campaign, with rules of its own (engine/lawCampaign.js).
    if (prof.depth === 'full') out.push({ id: 'judge_election', name: 'Run for an elected judgeship', why: p.age < 35 ? 'From age 35' : yrs < 8 ? 'After eight years of legal work' : !clean ? 'A judge needs a clean record' : cool('judge_election', 24), how: 'the voters, in a state that elects its judges', campaign: true });
  }
  if (admitted(p) && t && t !== 'attorney_general') {
    const senior = (t === 'lawyer' && c.level >= 2) || (['prosecutor', 'gov_counsel'].includes(t) && c.level >= 2) || (t === 'defender' && c.level >= 2) || t === 'judiciary' || !!p.politics;
    out.push({ id: 'ag', name: prof.depth === 'full' ? 'Run for state Attorney General' : 'Seek appointment as Attorney General', why: yrs < 10 ? 'After ten years of legal work' : !senior ? 'A senior legal or public role first' : L.rep.integrity < 55 ? 'A better name for integrity first' : cool('ag', 48), how: prof.depth === 'full' ? prof.ag.state : prof.ag.federal, campaign: prof.depth === 'full' });
    // The federal offices exist only in the United States, and each is a nomination and then a Senate vote.
    if (prof.depth === 'full') {
      const fed = ['prosecutor', 'gov_counsel', 'attorney_general', 'us_attorney'].includes(t) && c.level >= (t === 'prosecutor' || t === 'gov_counsel' ? 2 : 0);
      const blocked = L.rep.integrity < 60 ? 'A better name for integrity first' : '';
      if (t !== 'us_attorney') out.push({ id: 'us_attorney', name: 'Seek nomination as United States Attorney', why: yrs < 10 ? 'After ten years of legal work' : !fed ? 'Senior prosecution or government legal work first' : blocked || cool('us_attorney', 48), how: 'nominated by the President, confirmed by the Senate' });
      if (t !== 'solicitor_general') out.push({ id: 'solicitor_general', name: 'Seek nomination as Solicitor General', why: yrs < 15 ? 'After fifteen years of legal work' : (L.skills.research ?? 0) < 45 ? 'A name as an appellate advocate first' : blocked || cool('solicitor_general', 48), how: 'nominated by the President, confirmed by the Senate' });
      if (!(t === 'attorney_general' && L.agKind === 'federal')) out.push({ id: 'ag_federal', name: 'Seek nomination as United States Attorney General', why: yrs < 15 ? 'After fifteen years of legal work' : !(senior || t === 'us_attorney' || t === 'solicitor_general' || t === 'attorney_general') ? 'A senior legal or public role first' : L.rep.recognition < 45 ? 'A national name first' : blocked || cool('ag_federal', 48), how: prof.ag.federal });
    }
  }
  return out;
}

/** The chance a selection goes the player's way: their standing, never their win count alone, and luck. */
export function standing(p) {
  const L = lawOf(p);
  const s = stats(p);
  return (L.rep.integrity - 50) / 200 + (L.rep.recognition - 20) / 160 + (L.rep.clients - 50) / 300 + (L.rep.advocacy - 40) / 300 + Math.min(0.08, s.completed / 400) + ((p.career?.performance ?? 50) - 60) / 300;
}
/**
 * Seeks a post by its own process: a partnership vote, an election or an appointment. It may fail; trying again waits.
 * Elections here are simplified (a campaign and a result), not the full politics simulation.
 */
export function seek(id, p = player(), o2 = {}) {
  const o = opportunities(p).find((x) => x.id === id);
  if (!o) return result(false, 'That is not open to you.', 'neutral');
  if (o.why && !o2.vote) return result(false, o.why, 'neutral'); // a campaign checked it when it was declared
  const L = lawOf(p);
  (L.tried ??= {})[id] = nowM();
  const prof = profileFor(p.countryId);
  const s = standing(p);
  const luck = rng.next();
  if (id === 'partnership' || id === 'managing') {
    const billed = Math.min(0.1, (L.billed ?? 0) / localCost(400000, country()));
    const yes = luck < clamp((id === 'partnership' ? 0.3 : 0.18) + s + billed, 0.05, 0.85);
    if (!yes) { log(`The partners voted. Not this time: they want to see another year or two.`, 'system', 'bad'); return result(false, 'The partners voted no, this time.', 'bad'); }
    select(p, id); promote();
    canon(`law:${id}:${p.id}`, id === 'partnership' ? 'Made partner' : 'Elected managing partner', `Elected by the partners of the firm.`, { privacy: 'public', sig: 3 });
    return result(true, id === 'partnership' ? 'The partners voted you in. You are a partner.' : 'The partners chose you to lead the firm.', 'good');
  }
  if (id === 'da' || id === 'chief_defender' || id === 'general_counsel') {
    const elected = id === 'da' && prof.da === 'elected';
    const cost = elected && !o2.vote ? localCost(30000, country()) : 0;
    if (cost && p.finance.cash < cost) return result(false, `A campaign costs about ${fmtMoney(cost, country())}.`, 'neutral');
    p.finance.cash -= cost;
    const chance = clamp(0.25 + s + 0.05, 0.05, 0.8);
    const name = id === 'da' ? prof.titles.prosecutorChief : id === 'chief_defender' ? prof.titles.defenderChief : 'General Counsel';
    const vote = elected ? o2.vote ?? legalElection(p, name, 'local', s) : null;
    const against = vote ? ` against ${vote.rival}, with ${vote.share}% of the vote` : '';
    if (elected ? !vote.won : luck >= chance) {
      log(elected ? `You ran for ${name}${against} and lost.` : `The post of ${name} went to another candidate.`, 'system', 'bad');
      return result(false, elected ? `You ran for ${name}. The voters chose your opponent.` : `Another candidate was appointed ${name}.`, 'bad');
    }
    select(p, id);
    while (p.career.level < currentCareer().levels.length - 1) { if (!promote()) break; select(p, id); }
    canon(`law:${id}:${p.id}`, `${elected ? 'Elected' : 'Appointed'} ${name}`, `${elected ? 'Won the election' : 'Was appointed'} as ${name}.`, { privacy: 'public', sig: 3 });
    return result(true, elected ? `You won the election${against}. You are the ${name}.` : `You were appointed ${name}.`, 'good');
  }
  if (id === 'elevation') {
    const chance = clamp(0.2 + s + ((p.career?.performance ?? 50) - 60) / 200, 0.05, 0.7);
    if (luck >= chance) return result(false, 'The seat on the higher court went to another judge.', 'bad');
    select(p, 'elevation'); promote();
    canon(`law:elevation:${p.id}:${p.career.level}`, `Appointed ${p.career.title.toLowerCase()}`, `Elevated to ${p.career.title.toLowerCase()}.`, { privacy: 'public', sig: 3 });
    return result(true, `You were appointed ${p.career.title.toLowerCase()}.`, 'good');
  }
  if (id === 'judge_election') {
    const vote = o2.vote ?? legalElection(p, 'Judge', 'local', s + (lawOf(p).rep.integrity - 55) / 150, 0, 'judge');
    if (!vote.won) return result(false, `You ran for the bench against ${vote.rival} and lost, ${vote.share}% to ${Math.round((100 - vote.share) * 10) / 10}%.`, 'bad');
    becomeJudge(p, true);
    return result(true, `You won the election, ${vote.share}% to ${Math.round((100 - vote.share) * 10) / 10}%. From now on you rule on cases; you do not argue them.`, 'good');
  }
  if (id === 'judge') {
    const chance = clamp(0.2 + s + (lawOf(p).rep.integrity - 55) / 150, 0.05, 0.7);
    if (luck >= chance) return result(false, `The vacancy went to another candidate. Judgeships are ${o.how}, and there are few of them.`, 'bad');
    becomeJudge(p);
    return result(true, 'You were selected for the bench. From now on you rule on cases; you do not argue them.', 'good');
  }
  if (['us_attorney', 'solicitor_general', 'ag_federal'].includes(id)) {
    // Two steps, each of which can fail: the President's nomination, then the Senate's vote.
    const top = id === 'ag_federal';
    const nominated = luck < clamp((top ? 0.1 : 0.2) + s + (p.politics ? 0.1 : 0) + (L.rep.recognition - 45) / 200, 0.03, 0.6);
    const name = { us_attorney: 'United States Attorney', solicitor_general: 'Solicitor General', ag_federal: 'United States Attorney General' }[id];
    if (!nominated) return result(false, `The President nominated someone else for ${name}.`, 'bad');
    const yes = Math.round(clamp(50 + s * 60 + (L.rep.integrity - 60) / 2 + (rng.next() - 0.5) * 30, 20, 85));
    if (yes < 51) {
      canon(`law:${id}:fail:${nowM()}`, `Not confirmed as ${name}`, `Nominated, and rejected by the Senate, ${yes} to ${100 - yes}.`, { privacy: 'public', sig: 2, milestone: false });
      return result(false, `The President nominated you, but the Senate voted you down, ${yes} to ${100 - yes}.`, 'bad');
    }
    withdrawAll(p, 'You left your post for federal office.');
    if (top) { hire(CAREER_BY_ID.attorney_general, 1, 70, 'appointed'); L.agKind = 'federal'; select(p, 'ag'); }
    else { hire(CAREER_BY_ID[id], 1, 70, 'appointed'); select(p, id); }
    canon(`law:${id}:${p.id}`, `Confirmed as ${name}`, `Nominated by the President and confirmed by the Senate, ${yes} to ${100 - yes}.`, { privacy: 'public', sig: 3 });
    return result(true, `The Senate confirmed you, ${yes} to ${100 - yes}. You are ${name}.`, 'good');
  }
  if (id === 'ag') {
    const elected = prof.depth === 'full';
    const cost = elected && !o2.vote ? localCost(250000, country()) : 0;
    if (cost && p.finance.cash < cost) return result(false, `A statewide campaign costs about ${fmtMoney(cost, country())}.`, 'neutral');
    p.finance.cash -= cost;
    const chance = clamp(0.12 + s + 0.03, 0.03, 0.6);
    const vote = elected ? o2.vote ?? legalElection(p, 'Attorney General', 'state', s - 0.1) : null;
    if (elected ? !vote.won : luck >= chance) return result(false, elected ? `You ran for Attorney General against ${vote.rival} and lost the statewide vote, ${vote.share}% to ${Math.round((100 - vote.share) * 10) / 10}%.` : 'The government appointed someone else.', 'bad');
    withdrawAll(p, 'You left private practice for public office.');
    hire(CAREER_BY_ID.attorney_general, 1, 65, elected ? 'elected' : 'appointed');
    L.agKind = elected ? 'state' : 'national';
    select(p, 'ag');
    canon(`law:ag:${p.id}`, `${elected ? 'Elected' : 'Appointed'} Attorney General`, `${elected ? 'Won a statewide election' : 'Was appointed'} as Attorney General.`, { privacy: 'public', sig: 3 });
    return result(true, elected ? 'You won the statewide vote. You are Attorney General.' : 'You were appointed Attorney General.', 'good');
  }
  return result(false, 'Nothing happened.', 'neutral');
}
/** Becomes a judge: the old cases go to colleagues, because a judge cannot be counsel in any of them. */
function becomeJudge(p, elected = false) {
  withdrawAll(p, 'You left practice for the bench.');
  hire(CAREER_BY_ID.judiciary, 0, 65, elected ? 'elected' : 'appointed');
  canon(`law:judge:${p.id}`, elected ? 'Elected a judge' : 'Appointed a judge', `${elected ? 'Won an election for' : 'Selected for'} the ${profileFor(p.countryId).name === 'United States' ? 'trial court' : 'bench'}.`, { privacy: 'public', sig: 3 });
}
function withdrawAll(p, why) {
  for (const c of lawOf(p).caseIds.map(cases.caseById).filter((x) => x && !x.done)) referOut(c.id, p);
  log(why);
}

/** A professional rival from the other side of a case may sit as a judge one day; then the player must disclose it. */
export function mustRecuse(judgeId, p = player()) {
  const n = store.state.npcs[judgeId];
  return !!n && (n.flags.formerClientOf === p.id || p.npcIds.includes(n.id) && ['spouse', 'parent', 'child', 'sibling', 'partner'].includes(n.role));
}

// ---------- Your own practice ----------

/** The business engine's law firm, if any, with what it can carry. Opening one is done there (engine/business.js). */
export function firmView(p = player()) {
  const b = ownFirm(p);
  if (!b) return null;
  return { id: b.id, name: b.name, founded: b.founded, reputation: b.reputation, staff: b.staff?.length ?? 0, cash: b.cash };
}

// ---------- Time ----------

/** Called on every turn and at the turn of the year: school, cases, opportunities, and the toll of the work. */
export function tickLaw(o = {}) {
  const p = player();
  if (!p?.alive) return;
  migrate(p);
  if (!p.law && !(p.education.stage === 'law' && p.education.enrolled)) return;
  const L = lawOf(p);
  if (p.education.stage === 'law' && p.education.enrolled) { progressSchool(p); finishLawSchool(); }
  const admittedNow = progressBar(p); // practical training ends, and admission follows (engine/lawSchool.js)
  if (admittedNow) log(admittedNow.text, 'system', 'good');
  cases.progressCases(p);
  if (trackOf(p)) refreshOpportunities(p);
  storyBeats(p);
  firmYear(p);
  // Closed cases count toward the review once, and the firm's fees go to the firm.
  for (const h of L.history.filter((x) => !x.counted)) {
    h.counted = true;
    if (h.clinic || h.referred) continue;
    if (p.career?.careerId && LEGAL.has(p.career.careerId)) adjustPerformance(h.favorable > 0 ? 3 : h.favorable < -0.4 ? -1 : 1);
    const c = cases.caseById(h.caseId);
    const firm = ownFirm(p);
    if (c && firm && h.track === 'own' && c.fee.amount && !c.fee.toFirm) { c.fee.toFirm = true; firm.cash += c.fee.amount; firm.reputation = clamp((firm.reputation ?? 30) + (h.favorable > 0 ? 2 : 0)); }
  }
  // The toll of too much work, counted once per half-year whatever the turn length.
  const half = Math.floor(nowM() / WINDOW);
  const halves = L.tollHalf == null ? 1 : Math.min(2, half - L.tollHalf); // each half-year passed through, once
  if (halves > 0) {
    L.tollHalf = half;
    const w = cases.workload(p);
    for (let h = 1; h < halves; h++) if (w.points > w.capacity) { p.stats.health = clamp(p.stats.health - 2); p.stats.mood = clamp(p.stats.mood - 3); L.rep.reliability = clamp(L.rep.reliability - 1); }
    if (w.points > w.capacity) {
      p.stats.health = clamp(p.stats.health - 2);
      p.stats.mood = clamp(p.stats.mood - 3);
      L.rep.reliability = clamp(L.rep.reliability - 1);
      if (!L.seen.burnout || nowM() - L.seen.burnout >= 24) { L.seen.burnout = nowM(); queue('law_burnout', {}); }
    }
    // A judicial vacancy, or an offer from government, now and then for someone who could take it.
    const ops = opportunities(p);
    if (ops.some((x) => x.id === 'judge' && !x.why) && (!L.seen.vacancy || nowM() - L.seen.vacancy >= 36) && rng.chance(0.3)) { L.seen.vacancy = nowM(); queue('law_vacancy', { place: p.city }); }
    if (ops.some((x) => x.id === 'partnership' && !x.why) && (!L.seen.partnership || nowM() - L.seen.partnership >= 24)) { L.seen.partnership = nowM(); queue('law_partnership', {}); }
  }
  void o;
}
/** Older saves: a lawyer already working keeps their job and is treated as admitted; past cases are unknown, not invented. */
export function migrate(p = player()) {
  if (p.law || !p.career?.careerId || !LEGAL.has(p.career.careerId)) return;
  const L = lawOf(p);
  L.bar.admitted = { year: null, m: null, where: null, legacy: true };
  L.legacy = { since: store.state.year, note: 'Cases before this save was updated are not on record.' };
  L.specialty = defaultSpecialty(p.career.careerId);
  if (!(p.flags.licenses ?? []).includes('law') && p.career.careerId !== 'judiciary') (p.flags.licenses ??= []).push('law');
  // Experience shows in the skills, without inventing a single case.
  const yrs = legalYears(p);
  for (const s of LEGAL_SKILLS) L.skills[s.id] = clamp(L.skills[s.id] + yrs * 2.5);
  L.rep.recognition = clamp(L.rep.recognition + yrs);
}

// ---------- Story scenes ----------

const queue = (id, words) => { if (!store.state.pendingEvents.some((e) => e.id === id)) store.state.pendingEvents.push({ id, cast: { words } }); };
/** A scene about one case, once for that case: the case it is about is remembered for the choice. */
function caseScene(id, c, words = {}) {
  if ((c.scenes ??= []).includes(id)) return;
  c.scenes.push(id);
  (lawOf().sceneCase ??= {})[id] = c.id;
  queue(id, { client: c.vars.client ?? '', title: c.title, child: c.vars.child ?? '', charge: (c.vars.charge ?? '').toLowerCase(), ...words });
}
/** A scene of a legal life, once ever, or again only after `gap` months. */
function lifeScene(id, words = {}, gap = 0) {
  const L = lawOf();
  if (L.seen[id] != null && (!gap || nowM() - L.seen[id] < gap)) return;
  L.seen[id] = nowM();
  queue(id, words);
}

/**
 * The moments of a legal life, noticed as they happen: each scene has a real prerequisite in the player's school,
 * cases or career, plays once (or once per case), and its choice changes that school year, case or career.
 */
export function storyBeats(p = player()) {
  const L = lawOf(p);
  const S = L.school;
  if (S && !S.done && S.terms.length === 1 && S.terms[0].gpa == null) lifeScene('law_first_exam', { course: 'Contracts' });
  const prof = store.state.npcs[L.people?.lawProfessor];
  if (S && !S.done && prof?.alive && prof.meters.relationship >= 62) lifeScene('law_professor', { name: prof.lastName });
  if (S?.done && S.endM != null && nowM() - S.endM <= 6) lifeScene('law_graduation');
  const open = L.caseIds.map(cases.caseById).filter((c) => c && !c.done);
  for (const c of open) {
    const st = cases.stageOf(c);
    if (c.clinic) { if (st !== 'intake') caseScene('law_clinic_hard', c); continue; }
    if (c.awaiting && L.seen.law_first_hearing == null) { L.seen.law_first_hearing = nowM(); caseScene('law_first_hearing', c); }
    const dl = c.deadlines.find((d) => d.met == null);
    if (dl && !c.filings.some((f) => f.main) && dl.due - nowM() <= 3 && dl.due >= nowM()) caseScene('law_deadline', c);
    if (c.kind === 'criminal' && c.role === 'defense') {
      if (L.seen.law_client_accused == null) { L.seen.law_client_accused = nowM(); caseScene('law_client_accused', c); }
      const id = c.evidence.find((e) => e.kind === 'witness_statement' && e.favors === 'other' && e.reviewed && e.status !== 'excluded');
      if (id) caseScene('law_identification', c);
      if (st === 'pretrial') caseScene('law_plea_offer', c);
    }
    if (c.role === 'prosecution') {
      if (cases.strength(c).share < 0.38) caseScene('law_must_dismiss', c);
      if (st === 'discovery' && rng.chance(0.3)) caseScene('law_new_witness', c);
      if (c.level >= 4 && c.awaiting) caseScene('law_high_stakes', c);
    }
    if (c.templateId === 'divorce' && L.seen.law_marriage_apart == null) { L.seen.law_marriage_apart = nowM(); caseScene('law_marriage_apart', c); }
    if (c.templateId === 'custody' && ['negotiation', 'evaluation'].includes(st)) caseScene('law_parenting', c);
    if (c.kind === 'family' && st === 'negotiation') caseScene('law_settlement_conf', c);
    if (c.templateId === 'dependency' && c.role === 'childAttorney' && c.awaiting) caseScene('law_childs_future', c);
    if (c.templateId === 'family_petition' && st === 'review') caseScene('law_rfe', c);
    if (c.templateId === 'removal' && c.awaiting) caseScene('law_hearing_approaches', c);
    if (c.clientId && c.negotiation.offers.some((o) => !o.accepted) && rng.chance(0.4)) caseScene('law_wont_listen', c);
  }
  for (const c of L.caseIds.map(cases.caseById).filter((x) => x?.done && x.kind === 'immigration' && x.outcome?.kind === 'denied' && x.appealable && !x.appeal)) caseScene('law_imm_appeal', c);
  // A law school classmate may join the bench years later: the same person, now a judge (k.bench).
  const mate = store.state.npcs[L.people?.studyMate];
  const since = L.bar.admitted?.m;
  if (mate?.alive && !mate.flags.becameJudge && since != null && nowM() - since >= 96 && rng.chance(0.12)) {
    mate.flags.becameJudge = store.state.year;
    mate.flags.justice = { kind: 'judge', since: store.state.year, caseIds: [], countryId: p.countryId, skill: rng.int(62, 85), strict: rng.int(30, 70) };
    mate.occupation = 'Judge';
    mate.flags.title = 'Judge';
    const b = k.bench(p.countryId);
    if (!b.judges.includes(mate.id)) b.judges.push(mate.id);
    log(`Your law school classmate ${mate.firstName} ${mate.lastName} has been appointed a judge.`);
  }
  for (const c of open) {
    const judge = store.state.npcs[c.judgeId];
    if (judge && (judge.id === L.people?.studyMate || (p.npcIds.includes(judge.id) && ['friend', 'partner', 'spouse', 'sibling', 'parent', 'child'].includes(judge.role)))) caseScene('law_old_classmate', c, { judge: `${judge.firstName} ${judge.lastName}` });
    const rival = store.state.npcs[c.otherCounselId];
    if (rival?.flags.rivalOf === p.id && (rival.flags.rivalCases ?? 0) >= 1) caseScene('law_old_rival', c, { rival: `${rival.firstName} ${rival.lastName}`, since: String(rival.flags.rivalSince ?? '') });
  }
  const t = trackOf(p);
  if (t === 'lawyer' && p.career.level === 0 && rng.chance(0.25)) { const sup = supervisor(p); lifeScene('law_partner_help', { name: `${sup.firstName} ${sup.lastName}` }, 24); }
  const major = (L.offers ?? []).find((o) => o.prominent);
  if (major) lifeScene('law_major_client', { who: major.prominent.charAt(0).toUpperCase() + major.prominent.slice(1) }, 24);
  if (t === 'lawyer' && p.career.level >= 3 && rng.chance(0.15)) lifeScene('law_firm_choice', {}, 36);
  if (['lawyer', 'defender', 'prosecutor', 'gov_counsel'].includes(t) && legalYears(p) >= 12 && p.career.level >= 2 && rng.chance(0.2)) lifeScene('law_gov_offer', {}, 48);
  if (opportunities(p).some((x) => x.id === 'ag' && !x.why) && rng.chance(0.25)) lifeScene('law_ag', {}, 48);
}
/** What a choice in one of the legal scenes does (data/events/stories/law.js). */
export function lawChoice(value) {
  const p = player();
  const L = lawOf(p);
  const [scene, choice] = value.split(':');
  switch (scene) {
    case 'first': {
      if (choice === 'listen') { gain(p, { counseling: 3 }); L.rep.clients = clamp(L.rep.clients + 2); return 'You let them tell it all, and take notes. They leave calmer than they came.'; }
      if (choice === 'promise') { L.rep.integrity = clamp(L.rep.integrity - 3); return 'You promise them a win. Nobody can promise that, and part of you knows it.'; }
      gain(p, { counseling: 1, ethics: 1 }); return 'You explain how the case will go, and what nobody can know yet.';
    }
    case 'partner': {
      if (choice === 'ask') { const r = seek('partnership', p); return r.text; }
      return 'You decide to give it another year.';
    }
    case 'vacancy': {
      if (choice === 'apply') { const r = seek('judge', p); return r.text; }
      return 'You let the vacancy pass. There will be others.';
    }
    case 'burnout': {
      const open = L.caseIds.map(cases.caseById).filter((c) => c && !c.done && !c.awaiting).sort((a, b) => b.level - a.level);
      if (choice === 'refer' && open[0]) { referOut(open[0].id, p); return `You hand ${open[0].title} to a colleague. The weight on your desk lifts a little.`; }
      if (choice === 'leave') { p.stats.health = clamp(p.stats.health + 4); p.stats.mood = clamp(p.stats.mood + 6); return 'You take two weeks off and do not open your email.'; }
      p.stats.health = clamp(p.stats.health - 3); return 'You push through. The work gets done. You do not sleep much.';
    }
    default: return caseChoice(scene, choice, p, L);
  }
}

/** Choices in the scenes about school, a case or the senior career. Each changes what it is about. */
function caseChoice(scene, choice, p, L) {
  const byScene = { clinicHard: 'law_clinic_hard', deadline: 'law_deadline', wontListen: 'law_wont_listen', firstHearing: 'law_first_hearing', accused: 'law_client_accused',
    ident: 'law_identification', pleaTalk: 'law_plea_offer', newWitness: 'law_new_witness', mustDismiss: 'law_must_dismiss', highStakes: 'law_high_stakes', marriage: 'law_marriage_apart',
    classmate: 'law_old_classmate', rival: 'law_old_rival', parenting: 'law_parenting', settleConf: 'law_settlement_conf', childFuture: 'law_childs_future', rfe: 'law_rfe', immHearing: 'law_hearing_approaches', immAppeal: 'law_imm_appeal' };
  const c = byScene[scene] ? cases.caseById(L.sceneCase?.[byScene[scene]]) : null;
  const client = c ? store.state.npcs[c.clientId] : null;
  const rel = (n, d) => { if (n?.meters) n.meters.relationship = clamp(n.meters.relationship + d); };
  switch (scene) {
    case 'firstExam': {
      const t = L.school?.terms.at(-1);
      if (choice === 'allnight') { if (t) L.acts[`study:${t.n}`] = nowM(); p.stats.health = clamp(p.stats.health - 2); return 'You know the cases cold, and you are very tired.'; }
      if (choice === 'group') { gain(p, { analysis: 2 }); keepPerson(p, 'studyMate', 'friend', 'Law school classmate', rng.int(22, 30)); return 'Three of you take turns at the whiteboard until it makes sense.'; }
      p.stats.mood = clamp(p.stats.mood + 3); return 'You wake up rested. It helps more than you expected.';
    }
    case 'professor': {
      const prof = store.state.npcs[L.people?.lawProfessor];
      if (choice === 'yes') { gain(p, { research: 3, writing: 3 }); rel(prof, 8); L.honors = [...(L.honors ?? []), `Research assistant, ${store.state.year}`]; return 'Footnotes, archives, and a professor who now knows your name.'; }
      return 'They understand, and say the offer stands next year.';
    }
    case 'graduation': {
      if (choice === 'prep') { const r = prepareBar('self', p); return r.ok ? 'You start that evening.' : r.text; }
      p.stats.mood = clamp(p.stats.mood + 6);
      for (const n of Object.values(store.state.npcs).filter((x) => x.alive && p.npcIds.includes(x.id) && x.role === 'parent')) rel(n, 4);
      return 'Your family takes more photos than anyone needs.';
    }
    case 'clinicHard': {
      if (!c) return '';
      if (choice === 'beyond') { L.rep.integrity = clamp(L.rep.integrity - 4); rel(store.state.npcs[c.supervisorId], -6); cases.note(c, 'Acted beyond what a student may do.'); return 'It works out, but your supervisor finds out, and is not pleased: you are a student, not yet a lawyer.'; }
      gain(p, { ethics: 2, counseling: 1 }); rel(client, 3);
      return choice === 'refer' ? 'They call the help line the same afternoon, and you keep working the case.' : 'Your supervisor makes the call with you listening. You learn how it is done.';
    }
    case 'partnerHelp': {
      const sup = supervisor(p);
      if (choice === 'stay') { L.rep.preparation = clamp(L.rep.preparation + 3); p.stats.health = clamp(p.stats.health - 2); rel(sup, 6); adjustPerformance(2); return 'The brief goes in at 8:40. They remember who stayed.'; }
      rel(sup, -3); return 'They find someone else. It is fine. Mostly.';
    }
    case 'deadline': {
      if (!c || c.done) return '';
      if (choice === 'weekend') { if (!c.filings.some((f) => f.main)) cases.file(c, 'strong'); p.stats.health = clamp(p.stats.health - 2); return 'Filed on Monday morning, and it is good work.'; }
      if (choice === 'extension') { const dl = c.deadlines.find((d) => d.met == null); if (dl) dl.due += 1; c.due += 1; return 'The court gives you a month.'; }
      return 'The template version goes in on time.';
    }
    case 'wontListen': {
      if (!c || c.done) return '';
      if (choice === 'explain') { rel(client, 3); gain(p, { counseling: 2 }); return 'This time it lands. They are not happy, but they understand.'; }
      if (choice === 'writing') { L.rep.integrity = clamp(L.rep.integrity + 2); gain(p, { ethics: 1 }); return 'Your advice is on the record. The decision is theirs.'; }
      referOut(c.id, p); return 'You withdraw, and help them find another lawyer.';
    }
    case 'firstHearing': {
      if (!c || c.done) return '';
      if (choice === 'prepare') { c.bonus = (c.bonus ?? 0) + 0.03; p.stats.health = clamp(p.stats.health - 1); return 'You know every page of the file.'; }
      if (choice === 'mentor') { c.bonus = (c.bonus ?? 0) + 0.02; rel(supervisor(p), 3); return 'Knowing they are there steadies you.'; }
      c.bonus = (c.bonus ?? 0) - 0.02; return 'You sleep well, and wish you had read the file once more.';
    }
    case 'accused': {
      if (choice === 'presume') { gain(p, { ethics: 2, counseling: 1 }); rel(client, 3); return 'You listen to their account before you form a view.'; }
      L.rep.integrity = clamp(L.rep.integrity - 2); rel(client, -5); return 'Your client can tell what you think of them.';
    }
    case 'ident': {
      if (!c || c.done) return '';
      if (choice === 'expert') {
        const cost = localCost(3000, country());
        if (p.finance.cash < cost && c.fee.model !== 'salary') return 'There is no money for an expert.';
        if (c.fee.model !== 'salary') p.finance.cash -= cost;
        const e = c.evidence.find((x) => x.kind === 'witness_statement' && x.favors === 'other');
        if (e) e.reliability = Math.round(e.reliability * 0.75);
        return 'The expert explains how memory works at night, from across a street. The identification looks weaker.';
      }
      return 'You will do it on cross.';
    }
    case 'pleaTalk': {
      if (choice === 'honest') { rel(client, 3); gain(p, { counseling: 2 }); return 'You lay out both roads. The choice is theirs.'; }
      rel(client, -4); L.rep.integrity = clamp(L.rep.integrity - 1); return 'They feel pushed, and they are right.';
    }
    case 'newWitness': {
      if (!c || c.done) return '';
      if (choice === 'interview') { if (!c.evidence.some((e) => e.id === 'newwit')) c.evidence.push({ id: 'newwit', kind: 'witness_statement', label: 'A new witness\'s statement', favors: 'other', weight: 2, reliability: 60, admissibility: 'ok', status: 'admitted', reviewed: true }); gain(p, { evidence: 2, ethics: 1 }); return 'A careful statement, disclosed to the defense the same day.'; }
      return 'You let it go.';
    }
    case 'mustDismiss': {
      if (!c || c.done) return '';
      if (choice === 'dismiss') { const jc = c.justiceCaseId ? k.J().cases[c.justiceCaseId] : null; if (jc) k.dismissFrom(jc, 'The prosecution withdrew: the evidence no longer held.'); L.rep.integrity = clamp(L.rep.integrity + 3); cases.close(c, { kind: 'dismissed', text: 'You dropped the charges: the evidence no longer held.', favorable: 0.6 }); return 'The case is withdrawn. It was the right call.'; }
      c.weakPush = true; L.rep.integrity = clamp(L.rep.integrity - 3); return 'You press on with a case you do not believe in.';
    }
    case 'highStakes': {
      if (!c || c.done) return '';
      if (choice === 'prepare') { c.bonus = (c.bonus ?? 0) + 0.03; return 'You live in the file for a week.'; }
      L.rep.recognition = clamp(L.rep.recognition + 3); L.rep.integrity = clamp(L.rep.integrity - 1); return 'You are on the evening news.';
    }
    case 'marriage': {
      if (choice === 'listen') { rel(client, 4); gain(p, { counseling: 2 }); return 'It takes an hour. Then you can start.'; }
      if (c) c.bonus = (c.bonus ?? 0) - 0.02; rel(client, 2); return 'They like hearing it. The other side hears about it too.';
    }
    case 'parenting': {
      if (!c || c.done) return '';
      if (choice === 'child') { c.bonus = (c.bonus ?? 0) + 0.04; gain(p, { family: 2 }); return 'A plan that fits the child\'s week is one a court can adopt.'; }
      c.bonus = (c.bonus ?? 0) - 0.02; return 'You count the days. The judge will count something else.';
    }
    case 'settleConf': {
      if (!c || c.done) return '';
      if (choice === 'prepare') { c.bonus = (c.bonus ?? 0) + 0.03; gain(p, { negotiation: 2 }); return 'Your figures are better than theirs. The offer moves.'; }
      return 'Nobody moves. The hearing it is.';
    }
    case 'childFuture': {
      if (!c || c.done) return '';
      if (choice === 'wishes') { gain(p, { ethics: 2, family: 1 }); c.bonus = (c.bonus ?? 0) + 0.02; rel(client, 4); return 'The court hears what the child wants, in their own words.'; }
      L.rep.integrity = clamp(L.rep.integrity - 3); rel(client, -6); return 'You argue your own view. That is a guardian\'s job, not the child\'s attorney\'s.';
    }
    case 'rfe': {
      if (!c || c.done) return '';
      const gap = c.evidence.find((e) => e.id === 'gap');
      if (choice === 'full') { if (gap) gap.reliability = Math.round(gap.reliability * 0.3); gain(p, { immigration: 2 }); return 'Everything they asked for, translated and certified, sent early.'; }
      c.bonus = (c.bonus ?? 0) - 0.04; return 'It goes in as it is.';
    }
    case 'immHearing': {
      if (!c || c.done) return '';
      if (choice === 'prepare') { c.bonus = (c.bonus ?? 0) + 0.04; gain(p, { immigration: 1, examination: 2 }); return 'They know what the judge will ask, and they answer it truthfully.'; }
      return 'The papers will have to speak.';
    }
    case 'immAppeal': {
      if (!c) return '';
      if (choice === 'appeal') { const g = cases.appealGrounds(c)[0]; return g ? cases.fileAppeal(c, g.id).text : 'There are no grounds left.'; }
      if (choice === 'refile') { const n = cases.createCase(c.templateId, { clientId: c.clientId, track: c.track, specialty: c.specialty }); return `A new application is open: ${n.title}.`; }
      return 'You tell the client there is nothing more to do now.';
    }
    case 'classmate': {
      if (!c || c.done) return '';
      if (choice === 'disclose') { L.rep.integrity = clamp(L.rep.integrity + 2); gain(p, { ethics: 2 }); return 'You tell both sides you studied together. Nobody objects, and the case goes on.'; }
      if (choice === 'recuse') { const others = k.bench(c.countryId).judges.filter((id) => id !== c.judgeId); if (others.length) c.judgeId = rng.pick(others); L.rep.integrity = clamp(L.rep.integrity + 2); return 'You ask for another judge, to be safe. Your old classmate agrees at once.'; }
      L.rep.integrity = clamp(L.rep.integrity - 5); c.errors.push({ kind: 'bias', text: 'Counsel did not disclose a friendship with the judge.' }); return 'You say nothing. If it comes out, it will look bad, whatever the result.';
    }
    case 'rival': {
      if (!c || c.done) return '';
      if (choice === 'respect') { L.rep.integrity = clamp(L.rep.integrity + 1); gain(p, { negotiation: 1 }); return 'You shake hands outside the courtroom. Rivals, not enemies.'; }
      c.bonus = (c.bonus ?? 0) - 0.02; L.rep.integrity = clamp(L.rep.integrity - 1); return 'You make it personal. They make it personal back.';
    }
    case 'major': {
      const o = (L.offers ?? []).find((x) => x.prominent);
      if (choice === 'take' && o) return accept(o.id, p).text;
      if (o) L.offers = L.offers.filter((x) => x !== o);
      return 'You recommend a colleague.';
    }
    case 'firmChoice': {
      if (choice === 'pay') { p.career.salary = Math.round(p.career.salary * 0.9); L.rep.integrity = clamp(L.rep.integrity + 2); return 'The partners take a tenth less. The staff stay.'; }
      if (choice === 'layoffs') { L.rep.clients = clamp(L.rep.clients - 2); adjustPerformance(2); return 'Six people leave on a Friday.'; }
      L.rep.recognition = clamp(L.rep.recognition + 2); return 'Talks begin with a larger firm. It will take a year.';
    }
    case 'govOffer': {
      if (choice !== 'accept') return 'You stay where you are.';
      withdrawAll(p, 'You left to join the Attorney General\'s office.');
      hire(CAREER_BY_ID.attorney_general, 0, 60, 'appointed');
      return 'You are a Deputy Attorney General.';
    }
    case 'ag': return choice === 'run' ? seek('ag', p).text : 'Not this time.';
    default: return '';
  }
}

// ---------- Managing the work ----------

/** Asks a supervisor for help with the load: three more cases' worth of room for six months. Once a half-year. */
export function askSupport(p = player()) {
  const L = lawOf(p);
  if (!trackOf(p) || trackOf(p) === 'own') return result(false, trackOf(p) === 'own' ? 'Your own firm: hire staff instead.' : 'You are not practicing.', 'neutral');
  if ((L.support?.asked ?? -99) >= nowM() - 6) return result(false, 'You asked recently.', 'neutral');
  const sup = supervisor(p);
  L.support = { asked: nowM(), until: nowM() + 6 };
  sup.meters.relationship = clamp(sup.meters.relationship - 2);
  return result(true, `${sup.firstName} ${sup.lastName} takes some of your files for the next few months.`, 'good');
}
/** Two weeks away: rest, and every open case's next step moves back a month. Once a year. */
export function takeLeave(p = player()) {
  const L = lawOf(p);
  if ((L.leave ?? -99) >= nowM() - 12) return result(false, 'You took leave this year.', 'neutral');
  L.leave = nowM();
  p.stats.health = clamp(p.stats.health + 4); p.stats.mood = clamp(p.stats.mood + 8);
  for (const c of L.caseIds.map(cases.caseById).filter((x) => x && !x.done && !x.awaiting)) { c.due += 1; for (const d of c.deadlines.filter((x) => x.met == null)) d.due += 1; }
  return result(true, 'You take two weeks away. The office moves your deadlines back a month.', 'good');
}
/** A senior lawyer hands a case's routine work to a junior: half the load, the decisions still theirs. */
export function delegate(caseId, p = player()) {
  const c = cases.caseById(caseId);
  if (!c || c.done || c.lawyerId !== p.id) return result(false, 'Not your open case.', 'neutral');
  const senior = (p.career?.level ?? 0) >= 1 || (trackOf(p) === 'own' && (ownFirm(p)?.staff?.length ?? 0) + (ownFirm(p)?.others ?? 0) > 0);
  if (!senior) return result(false, 'You need a junior to delegate to.', 'neutral');
  if (c.delegated) return result(false, 'Already delegated.', 'neutral');
  c.delegated = { m: nowM() };
  c.bonus = (c.bonus ?? 0) - 0.01;
  return result(true, 'A junior colleague takes over the routine work. The decisions stay yours.', 'good');
}

// ---------- Leading an office ----------

/** Whether the player leads a legal office, and which. */
export function leadsOffice(p = player()) {
  const id = p.career?.careerId; const lv = p.career?.level ?? 0;
  if (id === 'prosecutor' && lv >= 3) return 'da';
  if (id === 'defender' && lv >= 2) return 'chief_defender';
  if (id === 'gov_counsel' && lv >= 3) return 'general_counsel';
  if (id === 'attorney_general') return 'ag';
  if (id === 'us_attorney' && lv >= 1) return 'us_attorney';
  if (id === 'solicitor_general' && lv >= 1) return 'sg';
  return null;
}
/** What leading the office asks of the player this half-year: each duty once. */
export function leaderDuties(p = player()) {
  const lead = leadsOffice(p);
  if (!lead) return [];
  const L = lawOf(p);
  const w = Math.floor(nowM() / WINDOW);
  const done = (id) => L.duties?.[`${w}:${id}`];
  const list = [
    { id: 'priorities', name: 'Set the office\'s priorities', options: [['Serious violent crime', 'violent'], ['Fraud and corruption', 'fraud'], ['Diversion for first offenders', 'diversion'], ['Clearing the backlog of old cases', 'backlog']] },
    { id: 'review', name: 'Review a major case in the office', text: 'A senior attorney brings you a case the whole office is watching. The evidence is weaker than the headlines.', options: [['Decide on the evidence: drop what does not hold', 'evidence'], ['Press on: the public expects it', 'pressure'], ['Seek a fair plea', 'plea']] },
    { id: 'supervise', name: 'Supervise your attorneys', options: [['Sit in on trials and give honest feedback', 'mentor'], ['Set targets and leave them to it', 'targets']] },
  ];
  if (lead === 'ag') list.push({ id: 'opinion', name: 'Give a legal opinion to the government', text: 'The government asks whether a new policy is lawful. It is popular, and probably not.', options: [['Advise on the law, as it stands', 'law'], ['Find a way to say yes', 'politics']] });
  if (lead === 'sg') list.push({ id: 'argue', name: 'Argue a case before the Supreme Court', text: 'The government\'s appeal is set for argument. You decide how to put it.', options: [['Concede the weak point and win on the strong one', 'strong'], ['Defend every point', 'every']] });
  if (L.controversy && !L.controversy.answered) list.push({ id: 'controversy', name: 'Answer a controversy', text: L.controversy.text, options: [['Admit the mistake and fix it', 'admit'], ['Defend the office\'s decision', 'defend'], ['Blame a junior attorney', 'blame']] });
  return list.map((d) => ({ ...d, done: !!done(d.id) }));
}
/** Carries out a duty of office. */
export function doDuty(id, choice, p = player()) {
  const d = leaderDuties(p).find((x) => x.id === id);
  if (!d) return result(false, 'That is not yours to do.', 'neutral');
  if (d.done) return result(false, 'Done for this half-year.', 'neutral');
  const L = lawOf(p);
  (L.duties ??= {})[`${Math.floor(nowM() / WINDOW)}:${id}`] = choice;
  gain(p, { leadership: 3, management: 1 });
  let text = '';
  if (id === 'priorities') { L.office = { ...(L.office ?? {}), priority: choice, since: nowM() }; L.rep.recognition = clamp(L.rep.recognition + 1); text = { violent: 'Serious violent crime comes first in your office.', fraud: 'Your office goes after fraud and corruption.', diversion: 'First offenders are offered diversion where the law allows.', backlog: 'The old cases get cleared, one by one.' }[choice]; canon(`law:priority:${p.id}:${nowM()}`, 'Set office priorities', text, { privacy: 'public', sig: 1, milestone: false }); }
  if (id === 'review') {
    if (choice === 'evidence') { L.rep.integrity = clamp(L.rep.integrity + 3); text = 'You drop the charges that do not hold. Some headlines are angry; the judges notice who is careful.'; }
    else if (choice === 'pressure') { L.rep.integrity = clamp(L.rep.integrity - 3); L.rep.recognition = clamp(L.rep.recognition + 2); if (rng.chance(0.4)) L.controversy = { text: 'A case your office pressed on despite weak evidence has collapsed at trial, and the papers want to know why.', m: nowM() }; text = 'The case goes ahead, under your name.'; }
    else { L.rep.integrity = clamp(L.rep.integrity + 1); text = 'A plea that fits what the evidence can prove.'; }
  }
  if (id === 'supervise') { if (choice === 'mentor') { gain(p, { leadership: 2 }); adjustPerformance(2); text = 'Your attorneys get better, and they know who helped.'; } else { adjustPerformance(1); text = 'The numbers improve. The trials do not.'; } }
  if (id === 'opinion') { if (choice === 'law') { L.rep.integrity = clamp(L.rep.integrity + 4); text = 'You advise that the policy is unlawful as written. The government is not pleased.'; } else { L.rep.integrity = clamp(L.rep.integrity - 6); text = 'Your opinion finds a way. The courts may not.'; if (rng.chance(0.5)) L.controversy = { text: 'A court has struck down the policy your opinion called lawful.', m: nowM() }; } }
  if (id === 'argue') {
    const won = rng.chance(clamp(0.35 + (L.skills.research ?? 20) / 150 + (choice === 'strong' ? 0.12 : 0), 0.1, 0.85));
    canon(`law:sg:${p.id}:${nowM()}`, won ? 'Won a Supreme Court argument' : 'Lost a Supreme Court argument', won ? 'The Court ruled for the government.' : 'The Court ruled against the government.', { privacy: 'public', sig: 2, milestone: false });
    L.rep.advocacy = clamp(L.rep.advocacy + (won ? 3 : 1)); text = won ? 'The Court rules for the government.' : 'The Court rules against you, five to four.';
  }
  if (id === 'controversy') {
    L.controversy.answered = choice;
    if (choice === 'admit') { L.rep.integrity = clamp(L.rep.integrity + 3); L.rep.recognition = clamp(L.rep.recognition - 2); text = 'You say what went wrong and what will change. It costs you a week of headlines, and earns you trust.'; }
    else if (choice === 'defend') text = 'You stand by the office. The story fades, slowly.';
    else { L.rep.integrity = clamp(L.rep.integrity - 8); adjustPerformance(-3); text = 'A junior attorney takes the blame. The office knows the truth.'; }
  }
  return result(true, text, 'good');
}

// ---------- The bench: civil and family matters ----------

const BENCH_MATTERS = ['contract_dispute', 'injury', 'boundary', 'custody', 'divorce', 'dismissal'];
/** A civil or family matter for a judge to decide: once a half-year. Real parties; the evidence decides. */
export function benchMatter(p = player()) {
  if (trackOf(p) !== 'judiciary') return null;
  const L = lawOf(p);
  const w = Math.floor(nowM() / WINDOW);
  const open = (L.bench ?? []).map(cases.caseById).find((c) => c && !c.done);
  if (open) return open;
  if ((L.benchWindow ?? -1) === w) return null;
  L.benchWindow = w;
  const c = cases.createCase(rng.pick(BENCH_MATTERS), { track: 'judiciary' });
  L.caseIds = L.caseIds.filter((x) => x !== c.id); // a judge's matter is not a client's case
  c.lawyerId = null; c.judgeId = p.id; c.bench = true; c.role = 'judge';
  for (const e of c.evidence) e.reviewed = true;
  // A firm that paid for the judge's election campaign comes before the judge (engine/lawCampaign.js).
  const donor = (L.donors ?? []).find((d) => store.state.npcs[d.id]?.alive);
  if (donor && c.parties?.otherId && rng.chance(0.35)) { c.parties.otherId = donor.id; c.donorConflict = { id: donor.id, amount: donor.amount }; }
  (L.bench ??= []).push(c.id);
  return c;
}
/** What the evidence supports, for checking a ruling: the claimant's share of the evidence. */
const supported = (c) => { const s = cases.strength({ ...c, role: 'plaintiff' }).share; return s > 0.58 ? 'for' : s < 0.42 ? 'against' : 'part'; };
/** The rulings open to the judge, worded for the matter. */
export function rulingOptions(c) {
  if (c.templateId === 'custody') return [['Adopt the parenting plan built around the child\'s school and needs', 'for'], ['Split the time exactly in half, whatever the schedules', 'part'], ['Give custody to the parent who earns more', 'improper']];
  return [['For the claimant', 'for'], ['For the respondent', 'against'], ['For the claimant in part', 'part']];
}
/** Rules on a matter. A ruling the evidence does not support may be reversed; a judge who knows a party must step aside. */
export function rule(caseId, ruling, p = player()) {
  const c = cases.caseById(caseId);
  if (!c?.bench || c.done) return result(false, 'There is nothing to rule on.', 'neutral');
  const L = lawOf(p);
  const known = [c.clientId, c.parties.otherId].map((id) => store.state.npcs[id]).find((n) => n && (p.npcIds.includes(n.id) || n.flags.formerClientOf === p.id));
  if (ruling === 'recuse') { c.done = true; c.outcome = { kind: 'recused', text: 'The judge stepped aside.', m: nowM(), year: store.state.year }; return result(true, 'You step aside, and the matter goes to another judge.', 'good'); }
  if (known && !c.donorConflict) { L.rep.integrity = clamp(L.rep.integrity - 8); L.misconduct = (L.misconduct ?? 0) + 1; }
  // Hearing a big campaign donor's case: the loser may appeal on that alone, and since Caperton (2009) win.
  const caperton = c.donorConflict ? realLawMod.governing('recusal', p.countryId) : null;
  if (c.donorConflict) { L.rep.integrity = clamp(L.rep.integrity - 6); L.misconduct = (L.misconduct ?? 0) + 1; }
  const right = ruling === 'improper' ? false : c.templateId === 'custody' ? ruling === 'for' : ruling === supported(c);
  const reversed = (!right && rng.chance(0.5)) || (!!caperton && ruling === 'against' && rng.chance(0.6));
  c.done = true;
  c.outcome = { kind: `ruled_${ruling}`, text: `${{ for: 'For the claimant', against: 'For the respondent', part: 'In part', improper: 'Custody to the wealthier parent' }[ruling]}.${reversed ? ' Reversed on appeal.' : ''}`, m: nowM(), year: store.state.year, right, reversed };
  (L.benchRecord ??= []).push({ caseId: c.id, title: c.title, ruling, right, reversed, year: store.state.year });
  if (right) { adjustPerformance(2); L.rep.integrity = clamp(L.rep.integrity + 1); }
  if (reversed) adjustPerformance(-3);
  if (ruling === 'improper') { L.rep.integrity = clamp(L.rep.integrity - 6); return result(false, 'Wealth is not the test: the child\'s interests are. The appeal court will say so.', 'bad'); }
  if (c.donorConflict) return result(false, `${caperton ? `Under ${caperton.name}, a` : 'A'} judge whose campaign a party paid for that heavily should have stepped aside.${reversed ? ' The appeal court sent the case back to another judge.' : ' People noticed.'}`, 'bad');
  return result(right, right ? 'Your ruling follows the evidence and the law.' : reversed ? 'The appeal court reverses you: the evidence did not support the ruling.' : 'Your ruling stands, though it was a close thing.', right ? 'good' : 'neutral');
}

// ---------- Your own firm's choices ----------

export const FEE_STRATEGIES = {
  standard: { name: 'Standard fees', k: 1, offers: 0, note: 'The going rate.' },
  premium: { name: 'Premium fees', k: 1.5, offers: -1, note: 'Fewer clients, who pay more and expect more.' },
  accessible: { name: 'Accessible fees', k: 0.7, offers: 1, note: 'More clients, who pay less: many could not afford a lawyer otherwise.' },
};
/** Sets your own firm's fees. */
export function setFeeStrategy(id, p = player()) {
  if (!ownFirm(p)) return result(false, 'Only for your own practice.', 'neutral');
  if (!FEE_STRATEGIES[id]) return result(false, 'There is no such strategy.', 'neutral');
  lawOf(p).fees = id;
  return result(true, `${FEE_STRATEGIES[id].name}: ${FEE_STRATEGIES[id].note}`, 'neutral');
}
/** Malpractice cover for your own firm: a yearly premium from the firm's books, and claims paid if it comes to that. */
export function setMalpractice(on, p = player()) {
  if (!ownFirm(p)) return result(false, 'Only for your own practice.', 'neutral');
  lawOf(p).malpractice = !!on;
  return result(true, on ? 'Your firm is insured against malpractice claims.' : 'Your firm carries no malpractice cover.', 'neutral');
}
/** The year's premium, and claims from clients whose cases were lost through a missed deadline. Once a year. */
function firmYear(p) {
  const b = ownFirm(p);
  const L = lawOf(p);
  if (!b || L.firmYear === store.state.year) return;
  L.firmYear = store.state.year;
  if (L.malpractice) b.cash -= localCost(3000, country());
  for (const c of L.caseIds.map(cases.caseById).filter((x) => x?.done && x.track === 'own' && !x.claimChecked)) {
    c.claimChecked = true;
    if (!(c.outcome?.favorable < 0 && c.deadlines.some((d) => d.met === false))) continue;
    const amount = localCost(25000, country());
    if (L.malpractice) { log(`${c.vars.client} claimed against your firm over ${c.title}. Your insurer paid.`, 'system', 'neutral'); }
    else { b.cash -= amount; log(`${c.vars.client} sued your firm over a missed deadline in ${c.title}. With no malpractice cover, the firm paid ${fmtMoney(amount, country())}.`, 'system', 'bad'); }
    L.rep.clients = clamp(L.rep.clients - 3);
  }
}

// ---------- Advertising ----------

/** Whether a practice may advertise here and now, and under what law. Where it is not listed, the game says so. */
export function advertisingRule(p = player()) {
  const law = realLawMod.governing('advertising', p.countryId);
  const listed = ['us', 'uk'].includes(p.countryId);
  return { allowed: listed ? !!law : true, law, listed };
}
/** Advertises your own firm, once a half-year: honestly, or with promises no lawyer can keep. */
export function advertise(kind = 'honest', p = player()) {
  const b = ownFirm(p);
  if (!b) return result(false, 'Only for your own practice.', 'neutral');
  const r = advertisingRule(p);
  if (!r.allowed) return result(false, p.countryId === 'us' ? 'Lawyers may not advertise yet: that comes with Bates v. State Bar of Arizona (1977).' : 'Solicitors may not advertise yet: the rules change in 1984.', 'neutral');
  const L = lawOf(p);
  const w = Math.floor(nowM() / WINDOW);
  if (L.advertised === w) return result(false, 'You have advertised this half-year.', 'neutral');
  const cost = localCost(4000, country());
  if (b.cash < cost) return result(false, `An advertising run costs the firm ${fmtMoney(cost, country())}.`, 'neutral');
  b.cash -= cost;
  L.advertised = w;
  b.reputation = clamp((b.reputation ?? 30) + 3);
  L.adBoost = w + 1; // one more client in the next half-year
  if (kind === 'promises') {
    L.rep.integrity = clamp(L.rep.integrity - 6);
    const rule = realLawMod.governing('advertising', p.countryId);
    if (rng.chance(0.5)) return discipline('reprimand');
    return result(false, `The ads promise results. ${rule ? `That breaks ${rule.name}: ` : ''}no lawyer can promise an outcome.`, 'bad');
  }
  return result(true, `Your firm's ads run for six months: plain words about what you do.${r.law ? ` (${r.law.name})` : ''}`, 'good');
}

// ---------- The office and the court ----------

/** Where the player works, and the court they appear in: real people, real records. */
export function officeView(p = player()) {
  const e = employerOf(p.career?.employerId);
  const b = cases.LC();
  const judges = k.bench(p.countryId).judges.map((id) => store.state.npcs[id]).filter(Boolean).map((n) => {
    const mine = Object.values(b).filter((c) => c.judgeId === n.id && c.lawyerId === p.id);
    return { id: n.id, name: `${n.firstName} ${n.lastName}`, since: n.flags.justice?.since ?? null, cases: mine.length, decided: mine.filter((c) => c.done).length, classmate: n.id === lawOf(p).people?.studyMate };
  });
  return { employer: e ? { name: e.name, city: e.city, founded: e.founded, history: (e.history ?? []).slice(-8).reverse() } : null, judges,
    rivals: Object.values(store.state.npcs).filter((n) => n.alive && n.flags.rivalOf === p.id).map((n) => ({ id: n.id, name: `${n.firstName} ${n.lastName}`, cases: n.flags.rivalCases ?? 1 })) };
}

// ---------- Legacy ----------

/**
 * A legal career as the family archive keeps it: milestones that were public or family history, never a client's
 * confidential details (those events are restricted to the lawyer while they live: engine/chronicle.js visible).
 */
export function legalLegacy(subjectId, viewerId = archiveIdOf(player())) {
  return events((e) => e.type === 'legal_career' && e.subject === subjectId && visible(e, viewerId)).sort((a, b) => a.year - b.year);
}

/**
 * Every legal career in the family, as the Family Archive keeps it: one entry per person, with the milestones the
 * viewer may see. A client's confidential matter never appears (engine/chronicle.js visible).
 */
export function familyLegalLegacy(viewerId = archiveIdOf(player())) {
  const p = player();
  const by = new Map();
  for (const e of events((x) => x.type === 'legal_career' && visible(x, viewerId) && x.privacy !== 'restricted')) {
    if (!by.has(e.subject)) by.set(e.subject, []);
    by.get(e.subject).push(e);
  }
  return [...by.entries()].map(([id, list]) => {
    const a = archived(id);
    const me = id === archiveIdOf(p);
    return { id, name: me ? `${p.firstName} ${p.lastName}` : a ? `${a.firstName} ${a.lastName}` : 'A relative', born: me ? p.birthYear : a?.born?.year ?? null, died: me ? null : a?.died?.year ?? a?.died ?? null,
      you: me, milestones: list.sort((x, y) => x.year - y.year).map((e) => ({ year: e.year, title: e.title, text: e.text, public: e.privacy === 'public' })) };
  }).sort((x, y) => (x.born ?? 0) - (y.born ?? 0));
}

// ---------- For the hub ----------

/** Everything the Legal Career screen shows, from saved state. */
export function overview(p = player()) {
  const L = lawOf(p);
  const t = trackOf(p);
  return { track: t, trackName: t === 'own' ? 'Your own practice' : TRACKS[t]?.name ?? null, title: p.career?.careerId && LEGAL.has(p.career.careerId) ? p.career.title : t === 'own' ? 'Principal' : null,
    specialty: SPECIALTY_BY_ID[fitSpecialty(p)] ?? null, years: legalYears(p), stats: stats(p), skills: skillsFor(L.specialty, trackOf(p) ?? (p.education.enrolled && p.education.stage === 'law' ? 'student' : null)).map((s) => ({ ...s, v: Math.round(L.skills[s.id] ?? 0) })),
    rep: REPUTATION.map((r) => ({ ...r, v: Math.round(L.rep[r.id] ?? 0) })), workload: cases.workload(p), cap: leadCap(p), capName: COMPLEXITY[leadCap(p)],
    admitted: admitted(p), legacy: L.legacy ?? null, discipline: L.discipline ?? [], why: mayPractice(p) };
}
