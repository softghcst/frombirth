// Private practice: a clinic a physician owns, run by the business engine (engine/business.js:
// its staff, cash, rent, expansion, partners and sale). This adds the medical side: which kind of
// practice the owner is qualified to open, a licensed physician at its head, and a reputation
// that follows how the owner practices.
//
//   business.medical = { practiceType, specialtyId, since }
//
// Who may own a practice: a physician (or podiatrist) who has finished residency in a specialty
// that practices outside a hospital, with a full license. Where the game's jurisdiction profile
// says practices are physician-owned (the US, Canada), that is the only route; the game invents no
// further rules.
import { clamp, fmtMoney, localCost } from '../../util.js';
import { store, player, country, log } from '../../state.js';
import { relocate } from '../cities.js';
import { PRACTICE_TYPES, jurisdiction } from '../../data/medicine.js';
import * as biz from '../business.js';
import { chronicle, employer } from '../employers.js';
import { M, med, year, note, result, roll, grow, reputationOf, qualified } from './core.js';

/** Practice types this physician is qualified to open. */
export function practiceOptions(m = med(), p = player()) {
  const q = new Set(qualified(m));
  return Object.entries(PRACTICE_TYPES).map(([id, t]) => {
    let block = '';
    if (!t.needs.some((s) => q.has(s))) block = `Needs completed training in ${t.needs.slice(0, 2).map((s) => s.replace('_', ' ')).join(' or ')}.`;
    else if (m.license.status !== 'full') block = 'Needs a full license to practice.';
    return { id, ...t, block, specialtyId: t.needs.find((s) => q.has(s)) ?? null };
  });
}

/** Why the medical-practice business cannot be started (engine/business.js asks), or ''. */
export function practiceBlock(p = player()) {
  const m = med(p);
  if (!m) return null; // no medical record: the business engine's own checks apply
  if (!practiceOptions(m, p).some((o) => !o.block)) return m.license.status !== 'full' ? 'A practice needs a physician with a full license.' : 'A private practice needs completed residency in a specialty that practices outside a hospital.';
  return '';
}

// ---------- Opening a practice ----------
//
// The steps of opening, as the player takes them: credentials and the ownership rules here (checked), the kind
// of practice, where (this city, or another, which means moving), the money (savings and a loan, through the
// business engine: one ledger), premises, the approvals to operate, equipment, and how it will run.
export const PREMISES = {
  small: { name: 'A small suite (two rooms)', cost: 0, quality: -4 },
  standard: { name: 'A standard clinic space', cost: 0.1, quality: 0 },
  large: { name: 'A large, purpose-built clinic', cost: 0.25, quality: 8 },
};
export const EQUIPMENT = {
  basic: { name: 'Basic equipment', k: 0.6, quality: -5 },
  standard: { name: 'Standard equipment', k: 1, quality: 0 },
  advanced: { name: 'Advanced equipment', k: 1.6, quality: 12 },
};
export const STRATEGY = {
  insurance: { name: 'Insurance-based practice', pricing: 'standard', words: 'patients pay through their insurance or the public system' },
  self_pay: { name: 'Premium self-pay practice', pricing: 'premium', words: 'fewer patients, longer visits, higher fees' },
  community: { name: 'Community practice', pricing: 'budget', words: 'low fees and a full waiting room' },
};
/** Services a practice can add over time, each with its cost (share of startup) and the demand it brings. */
export const SERVICES = {
  procedures: { name: 'In-office procedures', cost: 0.12, demand: 0.08, minYear: 1950 },
  imaging: { name: 'On-site imaging', cost: 0.3, demand: 0.1, minYear: 1960 },
  lab: { name: 'A small laboratory', cost: 0.15, demand: 0.06, minYear: 1930 },
  therapy: { name: 'Physical therapy', cost: 0.15, demand: 0.07, minYear: 1950 },
  telehealth: { name: 'Video consultations', cost: 0.05, demand: 0.06, minYear: 2012 },
};

/** Opens a practice: the plan's choices, then the business engine opens it. */
export function openPractice(typeId, name, plan = {}) {
  const p = player();
  const m = M();
  const o = practiceOptions(m, p).find((x) => x.id === typeId);
  if (!o) return result(false, 'There is no such practice.', 'neutral');
  if (o.block) return result(false, o.block, 'neutral');
  const premises = PREMISES[plan.premises] ?? PREMISES.standard;
  const equipment = EQUIPMENT[plan.equipment] ?? EQUIPMENT.standard;
  const strategy = STRATEGY[plan.strategy] ?? STRATEGY.insurance;
  // Where: another city means moving there first.
  if (plan.city && plan.city !== p.city) {
    const r = relocate(plan.city);
    if (!r.ok) return result(false, `You cannot move to ${plan.city} just now: ${r.text}`, 'neutral');
  }
  const title = name || `${p.lastName} ${o.name}`;
  const r = biz.start('clinic', title, { borrow: plan.borrow ?? 0 });
  if (!r.ok) return r;
  const b = biz.businesses(p).at(-1);
  // Premises, approvals and equipment are paid from the practice's own account (it borrows if it must).
  const startup = biz.figures(biz.typeOf(b), b.countryId, b.city).startup;
  const extra = Math.round(startup * premises.cost) + Math.round(startup * 0.02) + Math.round(localCost(o.equipment, country()) * equipment.k);
  b.cash -= extra;
  if (b.cash < 0) { b.debt += -b.cash; b.debtYears = Math.max(b.debtYears, 5); b.cash = 0; }
  b.quality = clamp(b.quality + premises.quality + equipment.quality);
  b.pricing = strategy.pricing;
  b.medical = { practiceType: typeId, specialtyId: o.specialtyId, since: year(), premises: plan.premises ?? 'standard', equipment: plan.equipment ?? 'standard',
    strategy: plan.strategy ?? 'insurance', approved: year(), services: [], equipmentValue: Math.round(localCost(o.equipment, country()) * equipment.k), group: null };
  b.reputation = clamp(Math.round(b.reputation * 0.5 + reputationOf(m) * 0.5));
  m.clinicIds.push(b.id);
  const e = employer(b.employerId);
  if (e) { e.medKind = 'clinic'; chronicle(e, `${p.firstName} ${p.lastName} opened ${title}, ${o.name.toLowerCase()}.`); }
  note(`Opened ${title}, ${o.name.toLowerCase()}.`, 'career', { key: `clinic:${b.id}`, milestone: `Opened a private practice: ${title}.`, significance: 2, log: false });
  return result(true, `${r.text} It is ${o.name.toLowerCase()}: ${premises.name.toLowerCase()}, ${equipment.name.toLowerCase()}, approved to operate, ${strategy.words}. Premises, approvals and equipment cost ${fmtMoney(extra, country())}.`);
}

// ---------- Running a practice ----------

const own = (id) => practices().find((b) => b.id === id) ?? null;
const doneThis = (b, k) => { b.medical.acted ??= {}; if (b.medical.acted.year !== year()) b.medical.acted = { year: year() }; if (b.medical.acted[k]) return true; b.medical.acted[k] = true; return false; };

/** Hires for a named role: a physician, a nurse, or a receptionist (the business engine's applicants). */
export function hireRole(id, role) {
  const b = own(id);
  if (!b) return result(false, 'That is not your practice.', 'neutral');
  if (!CLINIC_ROLE[role]) return result(false, 'There is no such post.', 'neutral');
  if (role === 'physician' && !(b.staff.length >= 1)) return result(false, 'Hire a nurse first: a physician needs a team.', 'neutral');
  b.nextRole = CLINIC_ROLE[role];
  const r = biz.hire(b, 0);
  delete b.nextRole;
  return r;
}
const CLINIC_ROLE = { physician: { career: 'doctor', level: 1, title: 'Associate physician' }, nurse: { career: 'nurse', level: 0 }, receptionist: { career: 'office', level: 0, title: 'Receptionist' }, manager: { career: 'health_admin', level: 1 } };

/** Services the practice could add now. */
export function serviceOptions(id) {
  const b = own(id);
  if (!b?.medical) return [];
  const f = biz.figures(biz.typeOf(b), b.countryId, b.city);
  return Object.entries(SERVICES).map(([sid, s]) => ({ id: sid, ...s, price: Math.round(f.startup * s.cost),
    block: b.medical.services.includes(sid) ? 'Already offered.' : year() < s.minYear ? `Not available in ${year()}.` : b.cash < f.startup * s.cost ? 'The practice cannot afford it yet.' : '' }));
}
/** Adds a service. Once a year. */
export function addService(id, sid) {
  const b = own(id);
  const o = serviceOptions(id).find((x) => x.id === sid);
  if (!b || !o) return result(false, 'There is no such service.', 'neutral');
  if (o.block) return result(false, o.block, 'neutral');
  if (doneThis(b, 'service')) return result(false, 'One new service a year is plenty to set up properly.', 'neutral');
  b.cash -= o.price;
  b.medical.services.push(sid);
  b.quality = clamp(b.quality + 3);
  biz.note(b, `${b.name} began offering ${o.name.toLowerCase()}.`);
  return result(true, `${b.name} now offers ${o.name.toLowerCase()}.`);
}

/** Joins a larger medical group: it buys a share, brings patients and back-office help, and takes its cut. */
export function joinGroup(id) {
  const p = player();
  const b = own(id);
  if (!b) return result(false, 'That is not your practice.', 'neutral');
  if (b.medical.group) return result(false, `${b.name} is already part of ${b.medical.group}.`, 'neutral');
  if (b.stake < 0.7) return result(false, 'Too much of the practice already belongs to others.', 'neutral');
  if (doneThis(b, 'group')) return result(false, 'You talked to the groups this year.', 'neutral');
  const price = Math.round(biz.valuation(b) * 0.3);
  if (price <= 0) return result(false, 'No group will buy into a practice that owes more than it is worth.');
  if (!roll(clamp(0.3 + (b.reputation - 50) / 80, 0.1, 0.8))) return result(false, 'The groups you approached were not interested this year.');
  const groupName = `${b.city} Physicians Group`;
  b.stake = Math.round((b.stake - 0.3) * 100) / 100;
  b.partners.push({ id: `group:${b.id}`, stake: 0.3, group: groupName, invested: price, manages: false, role: 'medical group (minority owner)', comp: 'thirty percent of what the practice pays out', exit: 'its share bought back at valuation, with a year of notice' });
  p.finance.cash += price;
  b.medical.group = groupName;
  b.reputation = clamp(b.reputation + 4);
  return result(true, `${groupName} buys thirty percent of ${b.name} for ${fmtMoney(price, country())}. Its referrals and back office come with it.`);
}

/** Forms a medical group from several sites or practices: the owner leads it. */
export function formGroup() {
  const m = M();
  const mine = practices(m);
  const sites = mine.reduce((t, b) => t + b.sites, 0);
  if (sites < 2) return result(false, 'A medical group needs at least two sites.', 'neutral');
  if (m.groupLeader) return result(false, 'You already lead your group.', 'neutral');
  m.groupLeader = { name: `${player().lastName} Medical Group`, since: year() };
  for (const b of mine) b.medical.group = m.groupLeader.name;
  grow('management', 3, m); grow('leadership', 3, m);
  note(`Formed ${m.groupLeader.name}, and leads it.`, 'career', { key: 'medical_group', milestone: `Founded ${m.groupLeader.name}.`, significance: 2 });
  return result(true, `Your practices become ${m.groupLeader.name}, with you as its president.`);
}

/** A physician partner's terms, as the partnership records them (persistent NPC partners only). */
export function partnerRecords(id) {
  const b = own(id) ?? biz.business(id);
  if (!b) return [];
  return b.partners.map((x) => {
    const n = store.state.npcs[x.id];
    return { id: x.id, name: x.group ?? (n ? `${n.firstName} ${n.lastName}` : 'A partner'), stake: x.stake, invested: x.invested ?? null, manages: !!x.manages,
      role: x.role ?? 'physician partner', comp: x.comp ?? `${Math.round(x.stake * 100)}% of what the practice pays out`, exit: x.exit ?? 'bought out at valuation, with a year of notice' };
  });
}
/** Brings in a physician partner through the business engine, and writes down their terms. */
export function bringPartner(id, npcId) {
  const b = own(id);
  if (!b) return result(false, 'That is not your practice.', 'neutral');
  const before = biz.valuation(b);
  const r = biz.takePartner(b, npcId);
  if (r.ok) {
    const x = b.partners.find((y) => y.id === npcId);
    Object.assign(x, { invested: Math.round(before * 0.25), manages: false, role: 'physician partner: sees patients, shares the call', comp: 'a quarter of what the practice pays out', exit: 'bought out at valuation, with a year of notice' });
  }
  return r;
}
/** Gives a partner a say in running the practice, or takes it back. */
export function setPartnerManages(id, npcId, on) {
  const b = own(id);
  const x = b?.partners.find((y) => y.id === npcId);
  if (!x) return result(false, 'There is no such partner.', 'neutral');
  x.manages = !!on;
  return result(true, on ? 'They now share the management of the practice: hiring, budgets, the rota.' : 'You take the management back. They remain a partner.', 'neutral');
}

/** Retires from practice: a partner buys the owner out, or the practice is offered for sale. */
export function retireFromPractice(id) {
  const p = player();
  const b = own(id);
  if (!b) return result(false, 'That is not your practice.', 'neutral');
  const heir = b.partners.find((x) => store.state.npcs[x.id]?.alive);
  if (heir) {
    const price = Math.round(biz.valuation(b) * b.stake * 0.9);
    p.finance.cash += price;
    b.status = 'sold'; b.soldFor = price; b.soldAge = p.age;
    const n = store.state.npcs[heir.id];
    note(`Retired from ${b.name}; ${n.firstName} ${n.lastName} bought the practice.`, 'career', { key: `clinic_retire:${b.id}`, significance: 2 });
    return result(true, `You retire from ${b.name}. ${n.firstName} ${n.lastName}, your partner, buys your share for ${fmtMoney(price, country())} and carries it on.`);
  }
  const r = biz.sell(b);
  if (r.ok) note(`Retired from ${b.name}, sold to a new owner.`, 'career', { key: `clinic_retire:${b.id}`, significance: 2 });
  return r;
}

/** What a medical practice costs to run beyond the business engine's own lines: insurance, compliance, upkeep. */
export function practiceCosts(b, revenue) {
  if (!b.medical) return 0;
  const surgical = ['ortho_clinic', 'plastic_clinic', 'obgyn_clinic', 'eye_clinic', 'podiatry_clinic'].includes(b.medical.practiceType);
  const insurance = Math.round(revenue * (surgical ? 0.07 : 0.04));
  const compliance = Math.round(revenue * 0.015);
  const upkeep = Math.round((b.medical.equipmentValue ?? 0) * 0.05);
  const services = (b.medical.services ?? []).length * Math.round(revenue * 0.01);
  b.medical.costs = { insurance, compliance, upkeep, services };
  return insurance + compliance + upkeep + services;
}
/** How much custom a medical practice draws, on top of the business engine's: its kind, its services, a group. */
export function practiceDemand(b) {
  if (!b.medical) return 1;
  const t = PRACTICE_TYPES[b.medical.practiceType];
  const services = (b.medical.services ?? []).reduce((k, sid) => k + (SERVICES[sid]?.demand ?? 0), 0);
  return (t?.demand ?? 1) * (1 + services) * (b.medical.group ? 1.08 : 1);
}

/** The physician's practices still open. */
export const practices = (m = med()) => (m?.clinicIds ?? []).map((id) => biz.business(id)).filter((b) => b && b.status === 'open');

/** A practice's year, after the business engine's: the reputation follows the physician, and the license must hold. */
export function practiceYear() {
  const p = player();
  const m = med();
  if (!m) return;
  for (const b of practices(m)) {
    if (!b.medical) continue;
    const t = PRACTICE_TYPES[b.medical.practiceType];
    b.reputation = clamp(Math.round(b.reputation * 0.75 + reputationOf(m) * 0.25 * (t?.demand ?? 1)));
    if (m.license.status !== 'full' || m.license.countryId && m.license.countryId !== b.countryId) {
      b.quality = clamp(b.quality - 15);
      log(`${b.name} cannot see patients without a licensed physician. It is losing them.`, 'system', 'bad');
    }
  }
  m.clinicIds = m.clinicIds.filter((id) => biz.business(id));
}

/** Words about who may own a practice here, for the career page. */
export function ownershipNote(countryId = player().countryId) {
  const j = jurisdiction(countryId);
  return j.ownership === 'physician' ? 'Here a medical practice is owned by physicians.' : j.detail === 'simplified' ? 'Ownership rules here are simplified in the game.' : '';
}
