// Choosing where to work: the hospitals, clinics and health services a qualified physician can
// join, in their city or anywhere in the country; what each is like; applying, an interview, an
// offer with its terms, negotiating, and accepting or declining. Nothing is guaranteed, and a post
// in another city means moving.
//
//   m.offers = [{ hospitalId, city, rank, salary, relocation, year, negotiated }]   offers stand until the year ends
import { clamp, fmtMoney } from '../../util.js';
import { player, country } from '../../state.js';
import { RANKS, DEPARTMENTS, SPECIALTY_BY_ID, eraCare } from '../../data/medicine.js';
import { employer, reputation as employerReputation, payAt } from '../employers.js';
import { staffOf } from '../workplace.js';
import { cityOf, citiesOf, relocate, moveCost } from '../cities.js';
import { residency } from '../citizenship.js';
import { M, med, year, result, roll, once, reputationOf, currentSpecialty, qualified, seeded } from './core.js';
import { hospital, kindName, workplacesFor, careerFor, levelFor } from './hospitals.js';
import { startPost } from './training.js';

const OWNERSHIP = { government: 'Public (government)', public_health: 'Public (health service)', rural: 'Public (rural health service)', academic: 'Nonprofit (university)', childrens: 'Nonprofit', heart: 'Private', bone: 'Private', clinic: 'Physician-owned group' };

/** What a hospital is like, for someone deciding whether to work there. Read from what the world holds. */
export function hospitalProfile(id) {
  const e = employer(id);
  const h = hospital(e);
  if (!e || !h) return null;
  const r = seeded(`own/${id}`);
  const staff = staffOf(e);
  const doctors = staff.filter((n) => ['doctor', 'surgery', 'psychiatry', 'podiatrist'].includes(n.life?.job?.careerId)).length;
  const scale = { small: 1, medium: 3, large: 7, major: 14 }[e.size] ?? 3;
  const city = cityOf(e.countryId, e.city);
  return {
    id, name: e.name, city: e.city, kind: kindName(h), ownership: OWNERSHIP[h.kind] ?? (r.next() < 0.6 ? 'Nonprofit' : 'Private'),
    resources: Math.round(h.resources * eraCare(year())), reputation: Math.round(clamp(employerReputation(e) * 0.5 + h.resources * 0.5)), teaching: h.teaching,
    departments: h.depts.map((d) => DEPARTMENTS[d] ?? d),
    physicians: Math.max(doctors, scale * 12), nurses: scale * 40, administrators: scale * 6,
    patients: city?.kind === 'capital' || city?.kind === 'largest' ? 'a large city and the region around it' : 'the town and the country around it',
    history: (e.history ?? []).slice(-5),
  };
}

/** Open posts in a specialty: a few each year, more at bigger places; the same every time they are looked at this year. */
function seats(e, spec) {
  const r = seeded(`seats/${e.id}/${spec}/${year()}`);
  const base = { small: 0.3, medium: 0.6, large: 1, major: 1.4 }[e.size] ?? 0.6;
  return Math.floor(r.next() * 2.2 * base + 0.3);
}

/** Posts a qualified physician could apply for: here, or across the country. */
export function postings(scope = 'city', p = player(), m = med()) {
  const spec = currentSpecialty(m);
  if (!m || !spec || m.training || !qualified(m).length) return [];
  const cities = scope === 'country' ? citiesOf(p.countryId).map((c) => c.name) : [p.city];
  const rank = m.job && ['senior', 'director', 'chief', 'chair', 'cmo'].includes(m.job.rank) ? 'senior' : 'attending';
  const out = [];
  for (const city of cities) {
    for (const { e, h } of workplacesFor(spec, p.countryId, city)) {
      const open = seats(e, spec);
      const here = p.career.employerId === e.id;
      let block = '';
      if (!residency(p).workAuthorized) block = 'Your visa does not allow you to work here.';
      else if (here) block = 'You work here.';
      else if (!open) block = 'No opening this year.';
      else if (m.license.status !== 'full') block = 'Needs a full license to practice.';
      else if ((m.offers ?? []).some((o) => o.hospitalId === e.id)) block = 'Their offer is waiting for your answer.';
      out.push({ id: e.id, name: e.name, city, kind: kindName(h), rank, open, here, block, away: city !== p.city });
      // Rural and government services also take temporary (locum) physicians for a year at a time.
      if (['rural', 'government', 'public_health'].includes(h.kind) && !here && residency(p).workAuthorized && m.license.status === 'full')
        out.push({ id: e.id, name: e.name, city, kind: `${kindName(h)} (temporary post, one year)`, rank: 'attending', open: 1, here, block: '', away: city !== p.city, locum: true });
    }
  }
  return out.sort((a, b) => Number(a.away) - Number(b.away) || b.open - a.open);
}

// ---------- Applying: an interview, then an offer with terms ----------

/** Interview questions: each answer says something about the candidate; the panel listens for judgment and honesty. */
const QUESTIONS = [
  { q: 'Tell us about a patient whose care did not go as planned.', a: [['What happened, what I learned, and what I changed afterward', 3], ['A case where someone else made the mistake', -2], ['I cannot think of one', -1]] },
  { q: 'Why this hospital?', a: [['Its patients and its teaching, specifically, with examples', 2], ['It was the best offer I could find', 0], ['The salary', -1]] },
  { q: 'A colleague disagrees with your plan in front of the team. What do you do?', a: [['Listen, look at the evidence together, and decide what is best for the patient', 3], ['Explain why I am right', 0], ['Take it up with the chief later', -1]] },
  { q: 'How do you look after yourself in a demanding job?', a: [['Honestly: what helps, and when I ask for support', 2], ['I do not need to', -1], ['I work through it', 0]] },
  { q: 'What would you want to have built here in five years?', a: [['Something concrete for patients or trainees, and how I would start', 2], ['A leadership post', 0], ['I have not thought about it', -1]] },
];

/** Applies to a posting: the hospital invites the candidate to interview (it may decline even that). Once a year at each place. */
export function applyFor(hospitalId, scope = 'country') {
  const p = player();
  const m = M();
  const o = postings(scope, p, m).find((x) => x.id === hospitalId) ?? postings('country', p, m).find((x) => x.id === hospitalId);
  if (!o) return result(false, 'That hospital has no post in your specialty.', 'neutral');
  if (o.block) return result(false, o.block, 'neutral');
  if (!once(`post:${hospitalId}`, m)) return result(false, 'You have already applied there this year.', 'neutral');
  if (!roll(clamp(0.55 + (reputationOf(m) - 50) / 80, 0.15, 0.95))) return result(false, `${o.name} read your application and chose not to interview you this year.`);
  const r = seeded(`int/${hospitalId}/${year()}`);
  const qs = [...QUESTIONS].sort(() => r.next() - 0.5).slice(0, 3).map((x) => QUESTIONS.indexOf(x));
  m.interview = { hospitalId, city: o.city, rank: o.rank, locum: !!o.locum, away: o.away, questions: qs, answers: [], year: year() };
  return result(true, `${o.name} invites you to interview. Answer from the Work tab.`, 'good');
}

/** The interview waiting, with its next question. */
export function interview(m = med()) {
  const v = m?.interview;
  if (!v || v.year !== year()) return null;
  const n = v.answers.length;
  if (n >= v.questions.length) return null;
  const q = QUESTIONS[v.questions[n]];
  return { hospital: employer(v.hospitalId)?.name, number: n + 1, of: v.questions.length, question: q.q, options: q.a.map(([label], i) => ({ id: i, label })) };
}

/** Answers the interview's next question; after the last, the panel decides. */
export function answer(i) {
  const m = M();
  const v = m.interview;
  const q = v && QUESTIONS[v.questions[v.answers.length]];
  if (!q || !q.a[i]) return result(false, 'There is no question waiting.', 'neutral');
  v.answers.push(Number(i));
  if (v.answers.length < v.questions.length) return result(true, 'They nod, and write something down.', 'neutral');
  const score = v.answers.reduce((t, a, k) => t + QUESTIONS[v.questions[k]].a[a][1], 0);
  m.interview = null;
  const h = hospital(v.hospitalId);
  const chance = clamp(0.3 + (reputationOf(m) - 50) / 70 + score * 0.06 + (m.boards.some((b) => b.passed) ? 0.1 : -0.05) - (h.kind === 'academic' ? 0.1 : 0) + (m.research?.papers?.length ?? 0) * (h.teaching ? 0.03 : 0), 0.05, 0.92);
  if (!roll(chance)) return result(false, `${employer(v.hospitalId).name} thanks you for your time. They have offered the post to another candidate.`);
  return result(true, makeOffer(m, v));
}

/** The offer's terms: salary, hours, on-call, a signing bonus, the move, and (at a private employer) a non-compete. */
function makeOffer(m, v) {
  const e = employer(v.hospitalId);
  const h = hospital(e);
  const career = careerFor(currentSpecialty(m));
  const [lo, hi] = payAt(e, career, levelFor(v.rank, career));
  const r = seeded(`offer/${e.id}/${year()}`);
  let salary = Math.round(lo + (hi - lo) * clamp(0.35 + (reputationOf(m) - 50) / 120, 0.1, 0.9));
  if (v.locum) salary = Math.round(salary * 1.25);
  const surgical = SPECIALTY_BY_ID[currentSpecialty(m)]?.surgical;
  const offer = { hospitalId: e.id, city: v.city, rank: v.rank, salary, year: year(), negotiated: false, locum: v.locum,
    hours: v.locum ? 45 : surgical ? 56 : [40, 45, 50][r.int(0, 2)], call: h.kind === 'rural' || surgical ? 'heavy' : ['light', 'regular'][r.int(0, 1)],
    bonus: v.locum ? 0 : Math.round(salary * [0, 0.05, 0.1][r.int(0, 2)]), relocation: v.away && r.next() < 0.7,
    nonCompete: !v.locum && /Private|Physician-owned/.test(hospitalProfile(e.id).ownership) ? 2 : 0 };
  (m.offers ??= []).push(offer);
  return `${e.name} offers you ${v.locum ? 'a one-year temporary post' : `a post as ${RANKS[v.rank].title.toLowerCase()}`}: ${fmtMoney(salary, country())} a year, ${offer.hours} hours a week, ${offer.call} on-call${offer.bonus ? `, a signing bonus of ${fmtMoney(offer.bonus, country())}` : ''}${offer.relocation ? ', the move paid' : ''}${offer.nonCompete ? `, and a ${offer.nonCompete}-year non-compete in ${v.city}` : ''}. Answer from the Work tab.`;
}

/** Offers still standing this year. */
export function offers(m = med()) {
  if (!m?.offers) return [];
  m.offers = m.offers.filter((o) => o.year === year() && employer(o.hospitalId));
  return m.offers;
}

/** The terms that can be negotiated. One ask per offer. */
export const TERMS = { salary: 'A higher salary', hours: 'Fewer hours', call: 'Lighter on-call', relocation: 'The move paid', nonCompete: 'No non-compete' };
/** Asks for better terms on one point. Usually some movement; occasionally the offer goes elsewhere. */
export function negotiate(hospitalId, term = 'salary') {
  const p = player();
  const m = M();
  const o = offers(m).find((x) => x.hospitalId === hospitalId);
  if (!o) return result(false, 'There is no such offer.', 'neutral');
  if (!TERMS[term]) return result(false, 'That is not something they will discuss.', 'neutral');
  if (o.negotiated) return result(false, 'You have already negotiated this one.', 'neutral');
  o.negotiated = true;
  if (roll(clamp(0.5 + (reputationOf(m) - 50) / 100, 0.2, 0.8))) {
    if (term === 'salary') o.salary = Math.round(o.salary * 1.07);
    if (term === 'hours') o.hours = Math.max(32, o.hours - 6);
    if (term === 'call') o.call = o.call === 'heavy' ? 'regular' : 'light';
    if (term === 'relocation') o.relocation = o.city !== p.city;
    if (term === 'nonCompete') o.nonCompete = 0;
    return result(true, `They agree: ${TERMS[term].toLowerCase()}.`);
  }
  if (roll(0.08)) { m.offers = m.offers.filter((x) => x !== o); return result(false, 'They thank you and offer the post to another candidate.'); }
  return result(false, 'They hold firm: the offer stands as it was.', 'neutral');
}

/** Takes an offer: moving if it is in another city, and starting there. */
export function acceptOffer(hospitalId) {
  const p = player();
  const m = M();
  const o = offers(m).find((x) => x.hospitalId === hospitalId);
  if (!o) return result(false, 'There is no such offer.', 'neutral');
  if (o.city !== p.city) {
    if (o.relocation) p.finance.cash += moveCost();
    const r = relocate(o.city);
    if (!r.ok) { if (o.relocation) p.finance.cash -= moveCost(); return result(false, `You cannot move to ${o.city} just now: ${r.text}`, 'neutral'); }
  }
  // A non-compete from the last post still binds in that city.
  const bound = m.nonCompete && m.nonCompete.until > year() && m.nonCompete.city === o.city && m.nonCompete.hospitalId !== hospitalId;
  if (bound) return result(false, `Your last contract's non-compete keeps you from practicing in ${o.city} until ${m.nonCompete.until}.`, 'neutral');
  if (m.job?.contract?.nonCompete) m.nonCompete = { city: employer(m.job.hospitalId)?.city, hospitalId: m.job.hospitalId, until: year() + m.job.contract.nonCompete };
  m.offers = [];
  startPost(currentSpecialty(m), hospitalId, o.rank);
  p.career.salary = o.salary;
  p.career.hours = o.hours;
  if (o.bonus) { p.finance.cash += o.bonus; p.finance.lifetimeEarned += o.bonus; }
  m.job.contract = { hours: o.hours, call: o.call, nonCompete: o.nonCompete, locum: !!o.locum, until: o.locum ? year() + 1 : null };
  if (o.locum) { p.career.title = `Locum ${SPECIALTY_BY_ID[currentSpecialty(m)]?.doctor ?? 'physician'}`; }
  return result(true, `You accept. You are now ${p.career.title.toLowerCase()} at ${employer(hospitalId).name}.`);
}

/** Says no to an offer. */
export function declineOffer(hospitalId) {
  const m = M();
  const o = offers(m).find((x) => x.hospitalId === hospitalId);
  if (!o) return result(false, 'There is no such offer.', 'neutral');
  m.offers = m.offers.filter((x) => x !== o);
  return result(true, `You thank ${employer(hospitalId).name} and decline.`, 'neutral');
}
