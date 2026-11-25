// Choosing where to work: the hospitals, clinics and health services a qualified physician can
// join, in their city or anywhere in the country; what each is like; applying, an interview, an
// offer with its terms, negotiating, and accepting or declining. Nothing is guaranteed, and a post
// in another city means moving.
//
//   m.offers = [{ hospitalId, city, rank, salary, relocation, year, negotiated }]   offers stand until the year ends
import { clamp, fmtMoney } from '../../util.js';
import { player, country } from '../../state.js';
import { RANKS, DEPARTMENTS, eraCare } from '../../data/medicine.js';
import { employer, reputation as employerReputation, payAt } from '../employers.js';
import { staffOf } from '../workplace.js';
import { cityOf, citiesOf, relocate, moveCost } from '../cities.js';
import { M, med, year, result, roll, once, reputationOf, currentSpecialty, qualified, seeded } from './core.js';
import { hospital, kindName, workplacesFor, careerFor, levelFor } from './hospitals.js';
import { startPost } from './training.js';

const OWNERSHIP = { government: 'Public (government)', public_health: 'Public (health service)', academic: 'Nonprofit (university)', childrens: 'Nonprofit', heart: 'Private', bone: 'Private', clinic: 'Physician-owned group' };

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
      if (here) block = 'You work here.';
      else if (!open) block = 'No opening this year.';
      else if (m.license.status !== 'full') block = 'Needs a full license to practice.';
      else if ((m.offers ?? []).some((o) => o.hospitalId === e.id)) block = 'Their offer is waiting for your answer.';
      out.push({ id: e.id, name: e.name, city, kind: kindName(h), rank, open, here, block, away: city !== p.city });
    }
  }
  return out.sort((a, b) => Number(a.away) - Number(b.away) || b.open - a.open);
}

/** Applies, and interviews: an offer, or a polite no. Once a year at each place. */
export function applyFor(hospitalId, scope = 'country') {
  const p = player();
  const m = M();
  const o = postings(scope, p, m).find((x) => x.id === hospitalId) ?? postings('country', p, m).find((x) => x.id === hospitalId);
  if (!o) return result(false, 'That hospital has no post in your specialty.', 'neutral');
  if (o.block) return result(false, o.block, 'neutral');
  if (!once(`post:${hospitalId}`, m)) return result(false, 'You have already applied there this year.', 'neutral');
  const h = hospital(hospitalId);
  const chance = clamp(0.35 + (reputationOf(m) - 50) / 70 + (m.boards.some((b) => b.passed) ? 0.1 : -0.05) - (h.kind === 'academic' ? 0.1 : 0) + (m.research?.papers?.length ?? 0) * (h.teaching ? 0.03 : 0), 0.08, 0.9);
  if (!roll(chance)) return result(false, `You interviewed at ${o.name}. They chose another candidate this year.`);
  const e = employer(hospitalId);
  const career = careerFor(currentSpecialty(m));
  const [lo, hi] = payAt(e, career, levelFor(o.rank, career));
  const salary = Math.round(lo + (hi - lo) * clamp(0.35 + (reputationOf(m) - 50) / 120, 0.1, 0.9));
  const offer = { hospitalId, city: o.city, rank: o.rank, salary, relocation: o.away && roll(0.7), year: year(), negotiated: false };
  (m.offers ??= []).push(offer);
  return result(true, `${o.name} offers you a post as ${RANKS[o.rank].title.toLowerCase()}, at ${fmtMoney(salary, country())} a year${o.away ? `, in ${o.city}${offer.relocation ? ', with the move paid' : ''}` : ''}. Answer from My Medical Career.`);
}

/** Offers still standing this year. */
export function offers(m = med()) {
  if (!m?.offers) return [];
  m.offers = m.offers.filter((o) => o.year === year() && employer(o.hospitalId));
  return m.offers;
}

/** Asks for better terms, once per offer. Usually some movement; occasionally the offer goes elsewhere. */
export function negotiate(hospitalId) {
  const m = M();
  const o = offers(m).find((x) => x.hospitalId === hospitalId);
  if (!o) return result(false, 'There is no such offer.', 'neutral');
  if (o.negotiated) return result(false, 'You have already negotiated this one.', 'neutral');
  o.negotiated = true;
  const r = roll(clamp(0.5 + (reputationOf(m) - 50) / 100, 0.2, 0.8));
  if (r) { o.salary = Math.round(o.salary * 1.07); if (o.city !== player().city) o.relocation = true; return result(true, `They improve the offer: ${fmtMoney(o.salary, country())} a year${o.city !== player().city ? ', and the move paid' : ''}.`); }
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
  m.offers = [];
  startPost(currentSpecialty(m), hospitalId, o.rank);
  p.career.salary = o.salary;
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
