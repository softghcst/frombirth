// Contraception and family planning: the methods a person uses, how they get them, what they cost, how they fare on
// them, and how much they lower the chance of a pregnancy. It is part of the health record (p.health.contraception)
// and uses the Health Engine's clinics, clinicians, appointments, insurance claims and charges. It never starts a
// pregnancy itself: the game's pregnancy resolvers (engine/children.js surpriseChance for a couple living together,
// engine/bonds.js for a night together) stay authoritative and ask this file only for a relative risk.
//
// TIME. Contraception runs on the World Clock (state.year, state.month), counted as an absolute month
// (year × 12 + month). Supplies, refills, renewals, device expiry and side effects are processed month by month, in
// order, whenever months have been lived: on a 3- or 6-month turn (engine/turns.js) and at the turn of the year
// (engine/yearProcessor.js). Nothing here draws on the game's dice (rng.js); per-person outcomes come from seeded()
// (engine/health/util.js). So four 3-month turns, two 6-month turns and one 12-month turn process the same months the
// same way, and a year's pregnancy risk is computed once, from what was in place in each month.
//
// RISK. A method's published first-year failure rate (data/health/contraception.js) becomes a relative risk against
// using nothing (85% a year). The resolver's own yearly chance P0 (its exposure model) is combined month by month:
// P = 1 − Π(1 − P0·rr_m)^(1/12), which is exactly P0·rr for a whole year on one method, and never a full year's failure
// rate applied per Age Up. Two methods together are not simply multiplied (failures are not independent: the same
// days that a pill is missed are often the days a condom is skipped); see combine().
//
//   p.health.contraception = {
//     v, legacyDefault,               legacyDefault: a life from before this record, assumed to use some birth control
//     methods: [MethodRecord],        every method ever used, never deleted; at most one non-barrier method is active
//     scheduled: [{ id, kind, methodId, abs, facilityId, providerId }],  procedures booked for a later month
//     consents: { [methodId]: { abs, providerId } },   informed consent for permanent methods (only the patient's own)
//     consults: [...], reviews: [...], exposures: [...], planning, planningHistory, facts, postpartum, partnerTalks,
//     payments: { [ref]: amount }, processed, lastYear, scenes, baseline, lifeStage, notes }
//   MethodRecord = { id, methodId, formulation, status, startAbs, protectFrom, endAbs, protectUntil, expiresAbs,
//     deviceId, providerId, facilityId, countryId, rx, nextDueAbs, effects, reported, events, reason, replacedBy, ... }
import { store, player, country, log } from '../../state.js';
import { clamp, localCost, fmtMoney } from '../../util.js';
import { METHODS, METHOD_BY_ID, UNSPECIFIED, EMERGENCY, EC_BY_ID, SIDE_EFFECTS, PROVIDER_SCOPE, TRAINED_SHARE, COUNTRY_RULES,
  NO_METHOD_ANNUAL, LIFE_STAGE, SOURCES } from '../../data/health/contraception.js';
import { PROFESSIONS } from '../../data/health/providers.js';
import { healthOf, hasCondition } from './record.js';
import { charge, priceOf, seeded, hashOf } from './util.js';
import { canPayCare } from './visits.js';
import { facilitiesHere, clinicianAt, clinicianName, book as bookAppt, attendNow, facility } from './care.js';
import { policyNow } from './insurance.js';
import { HEALTH_PATHS } from './story.js';
import { storyBeat } from '../storyDirector.js';
import { med, qualified } from '../medicine/core.js';
import { conceive } from '../children.js';

export { METHODS, METHOD_BY_ID, EMERGENCY, SOURCES };
const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
const npcOf = (id) => store.state.npcs[id];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** How much two methods' failures go together (0 independent, 1 the same failure): game approximation, see combine(). */
export const DEPENDENCE = 0.3;
export const PLANNING = {
  not: 'Not planning a pregnancy', considering: 'Considering a pregnancy', soon: 'Planning a pregnancy soon', open: 'Open to a pregnancy', unsure: 'Unsure',
};

// ---------- Time ----------

/** The current absolute month on the World Clock. */
export const absNow = (state = store.state) => state.year * 12 + (state.month ?? 0);
/** "March 2031" for an absolute month (months run from the player's birthday, like the turns). */
export function dateOf(abs, p = player()) {
  const off = p?.birthday?.m ?? 0;
  const y = Math.floor(abs / 12); const m = abs - y * 12;
  return `${MONTH_NAMES[(off + m) % 12]} ${y + Math.floor((off + m) / 12)}`;
}
const monthsBetween = (a, b) => b - a;

// ---------- The record ----------

/** The contraception record, made on first use. A life from before it is migrated without inventing any history. */
export function cx(p = player()) {
  registerPaths();
  const h = healthOf(p);
  if (!h.contraception) {
    h.contraception = { v: 1, legacyDefault: p.flags?.birthControl !== false, methods: [], scheduled: [], consents: {}, consults: [], reviews: [], exposures: [],
      planning: null, planningHistory: [], facts: {}, postpartum: null, partnerTalks: [], payments: {}, processed: absNow() - 1, lastYear: null, scenes: {}, notes: [], seq: 0 };
  }
  const c = h.contraception;
  c.scheduled ??= []; c.consents ??= {}; c.consults ??= []; c.reviews ??= []; c.exposures ??= []; c.payments ??= {}; c.scenes ??= {}; c.notes ??= []; c.facts ??= {};
  c.partnerTalks ??= []; c.planningHistory ??= []; c.seq ??= 0;
  if (c.processed == null) c.processed = absNow() - 1;
  return c;
}
const nextId = (c, kind) => `${kind}_${(++c.seq).toString(36)}`;
const note = (rec, text, kind = 'note') => { rec.events.push({ abs: absNow(), kind, text }); if (rec.events.length > 60) rec.events.splice(0, rec.events.length - 60); };

/** Whether this body can become pregnant, and whether it can cause a pregnancy (the methods each can use). */
export const canBePregnant = (p = player()) => (p.flags?.bornAs ?? p.gender) === 'female' && !p.flags?.identity?.bottom;
export const canCausePregnancy = (p = player()) => (p.flags?.bornAs ?? p.gender) === 'male' && !p.flags?.identity?.bottom;
const bodyFits = (m, p) => (m.body === 'uterus' ? canBePregnant(p) : m.body === 'penis' ? canCausePregnancy(p) : canBePregnant(p) || canCausePregnancy(p));

export const def = (rec) => (rec?.methodId === 'unspecified' ? UNSPECIFIED : METHOD_BY_ID[rec?.methodId]);
/** Records in force now (or at month `abs`): started, not ended. Includes a device past its duration (still in place). */
export function activeAt(abs, p = player()) {
  return cx(p).methods.filter((r) => r.startAbs <= abs && (r.endAbs == null || abs < r.endAbs) && !['canceled'].includes(r.status));
}
export const active = (p = player()) => cx(p).methods.filter((r) => r.endAbs == null && r.status !== 'canceled');
export const primaryNow = (p = player()) => active(p).find((r) => !def(r)?.barrier);
export const barriersNow = (p = player()) => active(p).filter((r) => def(r)?.barrier);

// ---------- Where and when a method exists ----------

const rulesFor = (countryId) => ({ ...COUNTRY_RULES.default, ...(COUNTRY_RULES[countryId] ?? {}) });
/** The first year a method (or emergency option) is available in a country: its own year, or a documented override. */
export function firstYear(id, countryId = player().countryId) {
  const m = METHOD_BY_ID[id] ?? EC_BY_ID[id];
  if (!m) return 9999;
  const r = rulesFor(countryId).from?.[id];
  if (m.onlyIn && !m.onlyIn.includes(countryId)) return 9999;
  if (m.notIn?.includes(countryId)) return 9999;
  return Math.max(m.from, r ?? m.from);
}
export const availableIn = (id, countryId = player().countryId, year = store.state.year) => year >= firstYear(id, countryId);

/** A device's approved duration in this year and country (data-driven; versions change with approvals). */
export function durationYears(m, countryId = player().countryId, year = store.state.year) {
  const list = (m.durations ?? []).filter((d) => d.from <= year && (!d.countries || d.countries.includes(countryId)));
  return list.length ? list[list.length - 1].years : null;
}

/** How a method is obtained here and now: 'otc' | 'pharmacy' | 'clinic' | 'procedure'. */
export function accessRoute(id, countryId = player().countryId, year = store.state.year) {
  const m = METHOD_BY_ID[id];
  const r = rulesFor(countryId);
  if (r.pills?.[id]?.otcFrom && year >= r.pills[id].otcFrom) return 'otc';
  return m.access;
}

// ---------- The person: baseline cycle, adherence, life stage ----------

/** A person's own cycle, before any method (approximate model: the game has no day-by-day menstrual cycle). */
export function baseline(p = player()) {
  const c = cx(p);
  if (!c.baseline) {
    const r = seeded('cycle', p.id);
    c.baseline = { regular: r.chance(0.8), flow: r.pick(['light', 'moderate', 'moderate', 'moderate', 'heavy']), cramps: r.pick(['none', 'mild', 'mild', 'moderate', 'strong']) };
  }
  return c.baseline;
}
/** How consistently this person keeps up a routine method: 1 is typical; lower is closer to perfect use. Decided once. */
export function adherence(p = player()) {
  const c = cx(p);
  if (c.adherence == null) c.adherence = Math.round(clamp(1 + seeded('adherence', p.id).normal() * 0.35, 0.2, 2) * 100) / 100;
  return c.adherence;
}
/** The age menopause comes for this person (median about 51; varies widely). Decided once. */
export function menopauseAge(p = player()) {
  const c = cx(p);
  if (c.menopauseAge == null) c.menopauseAge = Math.round(clamp(LIFE_STAGE.menopauseMedian + seeded('menopause', p.id).normal() * LIFE_STAGE.spread, 40, 58));
  return c.menopauseAge;
}
/** 'none' (no menstrual cycle in this body), 'young', 'reproductive', 'perimenopause', 'postmenopause'. */
export function lifeStage(p = player()) {
  if (!canBePregnant(p)) return 'none';
  if (p.age < 11) return 'young';
  const meno = menopauseAge(p);
  if (p.age > meno) return 'postmenopause';
  if (p.age >= meno - LIFE_STAGE.perimenopauseYears) return 'perimenopause';
  return 'reproductive';
}

// ---------- Effectiveness ----------

/** The first-year failure percentage this person can expect on a method (typical use shaped by their own routine). */
export function annualFailure(rec, p = player()) {
  const m = def(rec);
  if (!m) return NO_METHOD_ANNUAL * 100;
  if (m.legacy) return m.typical;
  let typical = m.typical;
  if (m.parousTypical && (p.flags?.births ?? 0) > 0) typical = m.parousTypical;
  // Methods that do not depend on day-to-day use (devices, procedures) are the same for everyone.
  if (!m.adherence) return typical;
  let a = adherence(p);
  if (m.family === 'pop') a *= m.missWindowHours <= 3 ? 1.3 : m.missWindowHours <= 12 ? 1 : 0.9; // game approximation
  if (m.id === 'fam' && (!baseline(p).regular || lifeStage(p) === 'perimenopause' || recentBirth(p))) a *= 1.6;
  return clamp(m.perfect + (typical - m.perfect) * a, m.perfect, Math.max(typical * 2, typical));
}
/** Relative yearly risk against no method (1 = no protection). */
export const relRisk = (rec, p = player()) => clamp(annualFailure(rec, p) / (NO_METHOD_ANNUAL * 100), 0, 1);

/**
 * Two methods together: the lower risk, scaled by the other's partly. Fully independent failures would give r1·r2;
 * fully shared failures would give min(r1, r2). The game takes DEPENDENCE of the way between, so pill and condom
 * together are better than either, and not as good as naive multiplication claims.
 */
export function combine(r1, r2) {
  const lo = Math.min(r1, r2); const hi = Math.max(r1, r2);
  return lo * (DEPENDENCE + (1 - DEPENDENCE) * hi);
}

/** Whether a record protects in a month, and how much (1 = not at all). */
function recordRiskAt(rec, abs, p) {
  const m = def(rec);
  if (!m) return 1;
  if (abs < rec.startAbs || (rec.endAbs != null && abs >= rec.endAbs && !(rec.protectUntil != null && abs < rec.protectUntil))) return 1;
  if (rec.protectUntil != null && abs >= rec.protectUntil) return 1;
  if (rec.expiresAbs != null && abs >= rec.expiresAbs) return 1; // past its approved duration: the game no longer counts on it
  if ((rec.gaps ?? []).some((g) => g.from <= abs && (g.to == null || abs < g.to))) return 1; // supply ran out, a dose was missed
  if (rec.status === 'awaiting_confirmation' || (rec.protectFrom != null && abs < rec.protectFrom)) return 1;
  // The published first-year rates already include the first days of use (a week of backup for some methods), so the
  // first month is not penalized again; onsetWeeks only sets how long an old method keeps protecting at a switch.
  return relRisk(rec, p);
}

/** Fertility in a month: 0 after menopause; lower while it returns after some methods (the injection). */
function fertilityAt(abs, p) {
  if (canBePregnant(p) && lifeStage(p) === 'postmenopause') return 0;
  let f = 1;
  for (const rec of cx(p).methods) {
    const m = def(rec);
    if (!m?.returnMonths) continue;
    const ended = rec.protectUntil ?? (rec.gaps?.length ? rec.gaps.at(-1).from : null);
    if (ended == null || abs < ended) continue;
    const k = abs - ended;
    if (k < m.returnMonths) f = Math.min(f, 0.25 + 0.75 * (k / m.returnMonths));
  }
  return f;
}

/** The relative risk in one month, from everything in place then: the main method and any barrier. */
export function riskAt(abs, p = player()) {
  const c = cx(p);
  const fert = fertilityAt(abs, p);
  if (c.legacyDefault && !c.methods.length) return relRisk({ methodId: 'unspecified' }, p) * fert;
  let primary = 1; let barrier = 1;
  for (const rec of c.methods) {
    const r = recordRiskAt(rec, abs, p);
    if (def(rec)?.barrier) barrier = Math.min(barrier, r); else primary = Math.min(primary, r);
  }
  return (primary < 1 && barrier < 1 ? combine(primary, barrier) : Math.min(primary, barrier)) * fert;
}
/** The parts of riskAt, for the per-night model: the main method and the barrier apart. */
function partsAt(abs, p) {
  const c = cx(p);
  if (c.legacyDefault && !c.methods.length) return { primary: relRisk({ methodId: 'unspecified' }, p), barrier: 1, fert: fertilityAt(abs, p), explicit: false };
  let primary = 1; let barrier = 1;
  for (const rec of c.methods) {
    const r = recordRiskAt(rec, abs, p);
    if (def(rec)?.barrier) barrier = Math.min(barrier, r); else primary = Math.min(primary, r);
  }
  return { primary, barrier, fert: fertilityAt(abs, p), explicit: true };
}

/**
 * The yearly chance of a pregnancy given the resolver's own yearly chance without any method (P0), from the months
 * of the year in place. Used by engine/children.js. During the yearly steps it uses the year just lived (closeYear);
 * otherwise the months of the current year as they stand now.
 */
export function yearChance(P0, p = player()) {
  const c = cx(p);
  const ly = c.lastYear;
  const months = ly && ly.forYear === store.state.year ? ly.risks : Array.from({ length: 12 }, (_, i) => riskAt(store.state.year * 12 + i, p));
  let keep = 1;
  for (const rr of months) keep *= (1 - clamp(P0 * rr, 0, 1)) ** (1 / 12);
  return 1 - keep;
}

/** The yearly pregnancy roll of engine/children.js, keyed to the life and the year: the same for every turn length. */
export const yearRoll = (p, year) => seeded('surprise-year', p.id, year).next();

/** Short label for what the risk model is using now, for messages. */
export function protectionWords(p = player()) {
  const c = cx(p);
  const a = active(p);
  if (c.legacyDefault && !c.methods.length) return 'birth control';
  if (!a.length) return null;
  return a.map((r) => def(r).name.toLowerCase()).join(' and ');
}

// ---------- Eligibility ----------

/**
 * Medical eligibility for this person now, in the shape of the US MEC (category 1 to 4) plus the game's practical
 * checks (body, age, era, country). Only conditions the game models, and facts learned at a consultation.
 * Returns { ok, cat, reasons: [text], blocked: text|null, needsReview }.
 */
export function eligibility(id, p = player()) {
  const m = METHOD_BY_ID[id];
  const out = { ok: true, cat: 1, reasons: [], blocked: null, needsReview: false };
  const worse = (cat, why) => { out.cat = Math.max(out.cat, cat); out.reasons.push(why); };
  if (!m) return { ...out, ok: false, blocked: 'Unknown method.' };
  if (!availableIn(id, p.countryId)) return { ...out, ok: false, blocked: store.state.year < m.from ? 'Not developed yet.' : 'Not available in this country in this year (simplified country profile).' };
  if (!bodyFits(m, p)) return { ...out, ok: false, blocked: m.body === 'penis' ? 'Used by a partner who could cause a pregnancy.' : 'Used by someone who could become pregnant.' };
  if (p.age < (m.minAge ?? 12)) return { ...out, ok: false, blocked: m.permanent ? `Permanent contraception is not offered under ${m.minAge} in this simplified profile.` : 'Not at this age.' };
  const est = m.hormone === 'estrogen+progestin';
  const prog = m.hormone === 'progestin';
  const h = healthOf(p);
  const pp = monthsSinceBirth(p);
  const bf = cx(p).postpartum?.breastfeeding;
  const lamotrigine = h.trials?.some((t) => t.medicationId === 'lamotrigine' && ['active', 'adjusted', 'under_review', 'tapering'].includes(t.status));
  const aura = cx(p).facts.migraineAura;
  if (est) {
    if (hasCondition('heart_disease', h)) worse(4, 'Coronary heart disease: estrogen-containing methods carry an unacceptable risk.');
    if (hasCondition('migraine', h) && aura === true) worse(4, 'Migraine with aura: estrogen raises the risk of stroke.');
    else if (hasCondition('migraine', h) && aura == null) { worse(3, 'Migraine: whether there is aura needs to be asked about first.'); out.needsReview = true; }
    else if (hasCondition('migraine', h) && p.age >= 35) worse(3, 'Migraine at 35 or older: usually another method is preferred.');
    else if (hasCondition('migraine', h)) worse(2, 'Migraine without aura.');
    if (hasCondition('hypertension', h)) worse(3, 'High blood pressure: usually another method is preferred.');
    if (hasCondition('cancer', h)) { worse(3, 'Cancer: depends on the kind; a specialist should be involved.'); out.needsReview = true; }
    if (hasCondition('type2_diabetes', h)) worse(2, 'Diabetes without complications.');
    if (lamotrigine) worse(3, 'Lamotrigine: estrogen lowers its level, which may need adjusting.');
    if (pp != null && pp < 1) worse(4, 'Less than three weeks after giving birth: a higher risk of blood clots.');
    else if (pp != null && pp < 2 && bf) worse(3, 'Breastfeeding in the first six weeks after birth.');
  }
  if (prog) {
    if (hasCondition('heart_disease', h)) worse(m.id === 'injection' ? 3 : 2, 'Coronary heart disease.');
    if (hasCondition('cancer', h)) { worse(3, 'Cancer: depends on the kind; a specialist should be involved.'); out.needsReview = true; }
    if (m.id === 'injection' && hasCondition('hypertension', h)) worse(2, 'High blood pressure.');
  }
  if (m.procedure === 'iud') {
    if (pp != null && pp < 1) worse(3, 'Between two days and four weeks after birth: placement usually waits until four weeks.');
    if (hasCondition('cancer', h) && !prog) worse(2, 'Cancer: depends on the kind.');
  }
  if (['diaphragm', 'cervical_cap'].includes(m.id) && pp != null && pp < 2) worse(3, 'Within six weeks of giving birth: fitting waits until afterwards.');
  if (m.id === 'fam') {
    if (pp != null && pp < 6) worse(3, 'After a birth, signs of fertility are hard to read for months: caution, or a delay.');
    if (!baseline(p).regular) worse(3, 'Irregular cycles make the fertile days harder to tell.');
    if (lifeStage(p) === 'perimenopause') worse(3, 'Cycles become less regular approaching menopause.');
  }
  if (m.permanent && p.age < 30) out.reasons.push('Under 30: regret is more common, and is part of the counseling.');
  out.ok = out.cat < 4;
  if (out.cat === 4) out.blocked = 'A clinician would not provide this for you now (an unacceptable health risk for you at present).';
  if (out.cat === 3) out.needsReview = true;
  return out;
}
export const CATEGORY_WORDS = { 1: 'No restriction', 2: 'Generally suitable', 3: 'Needs a careful discussion with a clinician', 4: 'Not suitable for you now' };

// ---------- Providers ----------

/** Whether a clinician is trained for a service (decided once per clinician; never redrawn). */
function trainedFor(npc, service) {
  const c = npc.flags.clinician;
  c.repro ??= {};
  if (c.repro[service] == null) c.repro[service] = seeded('repro-training', npc.id, service).chance(TRAINED_SHARE[service] ?? 0.5);
  return c.repro[service];
}
/** What a clinician may do: 'counsel', 'prescribe', 'injection', 'iud', 'implant', 'tubal', 'vasectomy'. */
export function mayProvide(npc, service) {
  const prof = npc?.flags?.clinician?.profession;
  const s = PROVIDER_SCOPE[prof]?.[service];
  if (!s) return false;
  if (s === 'trained') return trainedFor(npc, service);
  return true;
}
/** The service a method needs from a clinician. */
export function serviceFor(id) {
  const m = METHOD_BY_ID[id];
  if (!m) return 'counsel';
  if (m.procedure) return m.procedure;
  if (m.id === 'injection') return 'injection';
  if (m.access === 'clinic' && m.id !== 'fam') return 'prescribe';
  return 'counsel';
}

/**
 * The player's own professional scope, from the medical career (engine/medicine): an OB-GYN or family physician can
 * counsel and provide contraception for patients. Never for themselves: a clinician does not place their own device.
 */
export function playerScope(p = player()) {
  const m = med(p);
  if (!m) return null;
  const q = qualified(m);
  const prof = q.includes('obgyn') ? 'obgyn' : q.includes('family') ? 'gp' : q.length ? 'doctor' : null;
  if (!prof) return null;
  const scope = PROVIDER_SCOPE[prof];
  return { profession: prof, services: Object.keys(scope).filter((k) => scope[k] === true || scope[k] === 'always' || (scope[k] === 'trained' && seeded('own-training', p.id, k).chance(0.7))) };
}

const REPRO_FACILITIES = ['sexual_health', 'womens', 'primary', 'hospital'];
/**
 * Where a service can be had nearby: each option names the clinic, the clinician (an ordinary NPC who stays), the
 * wait (none: a visit resolves at once, like every chosen visit in My Health), the price after cover, and why not.
 */
export function providersFor(service, p = player()) {
  const out = [];
  for (const f of facilitiesHere(p)) {
    if (!REPRO_FACILITIES.includes(f.defId)) continue;
    const staffDef = (({ sexual_health: ['sexual_health_nurse', 'nurse_practitioner', 'gp'], womens: ['obgyn', 'nurse_practitioner', 'midwife'], primary: ['gp', 'nurse'], hospital: ['obgyn', 'urologist'] })[f.defId]);
    for (const prof of staffDef) {
      if (!PROVIDER_SCOPE[prof]?.[service] || store.state.year < (PROFESSIONS[prof]?.from ?? 9999)) continue;
      const npc = clinicianAt(f, prof);
      if (!npc || npc.id === p.id) continue;
      const ok = mayProvide(npc, service);
      out.push({ facilityId: f.id, facility: f.name, kind: f.kind, profession: prof, professionName: PROFESSIONS[prof].name, providerId: npc.id,
        provider: clinicianName(npc), ok, why: ok ? '' : 'Not trained for this procedure', fee: f.fee ?? 1, public: f.public, cost: priceOf(visitBase(service), f.fee ?? 1) });
    }
  }
  return out;
}
const visitBase = (service) => ({ iud: 260, implant: 250, tubal: 3500, vasectomy: 900, injection: 90, prescribe: 120, counsel: 120 })[service] ?? 120;
/** The nearest clinician able to provide a service (public services first). */
export function defaultProvider(service, p = player()) {
  const list = providersFor(service, p).filter((o) => o.ok);
  return list.sort((a, b) => (b.public ? 1 : 0) - (a.public ? 1 : 0) || a.cost - b.cost)[0] ?? null;
}

// ---------- Money ----------

/** Whether cover pays in full: contraception without cost sharing (US from 2012 for most plans; free on the UK NHS from 1974). */
export function noCostSharing(p = player()) {
  const r = rulesFor(p.countryId);
  const pol = policyNow(p);
  if (r.noCostSharingFrom && store.state.year >= r.noCostSharingFrom && ['employer', 'private'].includes(pol.kind)) return true;
  if (r.freeContraceptionFrom && store.state.year >= r.freeContraceptionFrom && ['public', 'child'].includes(pol.kind)) return true;
  return false;
}
/** What something costs the patient: care goes through cover; off-the-shelf items are paid in full. */
export function priceFor(base, kind = 'care', fee = 1, p = player()) {
  if (base <= 0) return 0;
  if (kind === 'otc') return localCost(base, country());
  return noCostSharing(p) ? 0 : priceOf(base, fee);
}
export const canAfford = (amount, p = player()) => canPayCare(amount, p);
/** Pays once for one thing (ref): through the Health Engine's charge and insurance claims, or off the shelf. */
function pay(ref, base, kind, what, fee = 1, p = player()) {
  const c = cx(p);
  if (c.payments[ref] != null) return 0;
  let amount;
  if (kind === 'otc') { amount = localCost(base, country()); p.finance.cash -= amount; } else amount = charge(ref, base, { fee, what, covered: noCostSharing(p) });
  c.payments[ref] = amount;
  const keys = Object.keys(c.payments);
  if (keys.length > 800) for (const k of keys.slice(0, keys.length - 800)) delete c.payments[k];
  return amount;
}

/** A visit with a clinician, recorded as an attended appointment in the health record (and charged once). */
function visit(provider, what, base, p = player()) {
  const f = facility(provider.facilityId);
  const a = bookAppt('contraception', { facilityId: provider.facilityId, providerId: provider.providerId, wait: 0, note: what }, p);
  a.base = noCostSharing(p) ? 0 : base;
  a.what = what;
  a.fee = f?.fee ?? 1;
  attendNow(a, p);
  return a;
}

// ---------- Consultation ----------

/** A consultation: options reviewed, history discussed, nothing decided for you. */
export function consult(provider, topic = 'options', p = player()) {
  const c = cx(p);
  if (!provider) return result(false, 'There is nowhere nearby offering this yet.', 'neutral');
  const npc = npcOf(provider.providerId);
  const price = priceFor(120, 'care', provider.fee);
  if (!canAfford(price, p)) return result(false, `A consultation costs ${fmtMoney(price, country())}, more than you have. A public sexual health service may cost less.`, 'neutral');
  const a = visit(provider, 'Contraception consultation', 120, p);
  // The history is discussed: a migraine is asked about, aura or not (decided once, from the person).
  if (hasCondition('migraine', healthOf(p)) && c.facts.migraineAura == null) c.facts.migraineAura = seeded('aura', p.id).chance(0.3);
  const options = METHODS.filter((m) => bodyFits(m, p) && availableIn(m.id, p.countryId)).map((m) => ({ id: m.id, ...eligibility(m.id, p) }));
  c.consults.push({ abs: absNow(), providerId: npc.id, facilityId: provider.facilityId, topic, apptId: a.id, offered: options.filter((o) => o.ok).map((o) => o.id),
    review: options.filter((o) => o.cat >= 3).map((o) => ({ id: o.id, cat: o.cat })) });
  if (c.consults.length > 60) c.consults.shift();
  const fits = options.filter((o) => o.ok && o.cat <= 2).map((o) => METHOD_BY_ID[o.id].name.toLowerCase());
  const careful = options.filter((o) => o.cat === 3).map((o) => METHOD_BY_ID[o.id].name.toLowerCase());
  const text = `${clinicianName(npc)} goes through the options with you, asks about your health and what matters to you, and answers your questions. `
    + `${fits.length ? `Suitable for you: ${list(fits)}.` : ''}${careful.length ? ` To think through carefully together: ${list(careful)}.` : ''}`
    + ' The choice is yours.';
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral', { consultId: c.consults.length - 1 });
}
const list = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const lastConsult = (p) => cx(p).consults.at(-1);
/** Whether a recent consultation (within two years) covered this person's options. */
export const consultedRecently = (p = player()) => { const k = lastConsult(p); return !!k && absNow() - k.abs <= 24; };

// ---------- Starting, changing and stopping ----------

/** Side effects this person will have on this method: decided once per record, from the person and the method. */
function decideEffects(rec, p) {
  const m = def(rec);
  const r = seeded('effects', p.id, rec.id, m.id);
  const effects = [];
  for (const id of m.sideEffects ?? []) {
    const se = SIDE_EFFECTS[id];
    if (!se || !r.chance(se.p)) continue;
    const at = rec.startAbs + r.int(0, 3);
    effects.push({ id, label: se.label, noticeAbs: at, fadeAbs: se.fades ? at + r.int(3, 6) : null, noticed: false, reported: false });
  }
  // The bleeding pattern on this method, for this person (approximate).
  const b = m.bleeding ?? {};
  const roll = r.next();
  rec.bleeding = roll < (b.amenorrhea ?? 0) ? 'little or no bleeding' : roll < (b.amenorrhea ?? 0) + (b.irregular ?? 0) ? 'irregular bleeding or spotting'
    : b.heavier && r.chance(b.heavier) ? 'heavier, crampier periods' : b.lighter && r.chance(b.lighter) ? 'lighter, more regular bleeds' : 'much as before';
  return effects;
}

/**
 * Starts a method. `o`: { provider, formulation, acknowledge, guardian, reason, emergency }. Checks era, country,
 * body, eligibility (a category 3 needs `acknowledge`; category 4 is not provided), a qualified provider, the cost.
 * Switching from another main method is a transition with no gap: the old one protects until the new one does.
 */
export function startMethod(id, o = {}, p = player()) {
  const c = cx(p);
  const m = METHOD_BY_ID[id];
  if (!m) return result(false, 'Unknown method.', 'neutral');
  if (p.flags.pregnancy && (p.flags.bornAs ?? p.gender) === 'female' && !m.barrier) return result(false, 'Not during a pregnancy.', 'neutral');
  return startChecked(id, m, o, p, c);
}
function startChecked(id, m, o, p, c) {
  const el = eligibility(id, p);
  if (!el.ok) return result(false, el.blocked ?? 'Not suitable for you now.', 'neutral');
  if (el.cat === 3 && !o.acknowledge) return result(false, `${m.name}: ${el.reasons.join(' ')} Your clinician would want to talk this through with you before going ahead.`, 'neutral', { needsAck: true, reasons: el.reasons });
  if (m.permanent) return result(false, 'Permanent contraception is arranged through counseling, consent and a booked procedure.', 'neutral');
  if (active(p).some((r) => r.methodId === id)) return result(false, `You already use ${m.name.toLowerCase()}.`, 'neutral');
  if (m.barrier) {
    if (id === 'condom_internal' && active(p).some((r) => r.methodId === 'condom_external')) return result(false, 'Internal and external condoms are not used together.', 'neutral');
    if (id === 'condom_external' && active(p).some((r) => r.methodId === 'condom_internal')) return result(false, 'Internal and external condoms are not used together.', 'neutral');
  } else {
    const cur = primaryNow(p);
    if (cur && METHOD_BY_ID[cur.methodId]?.permanent) return result(false, 'You already have permanent contraception.', 'neutral');
    if (cur && METHOD_BY_ID[cur.methodId]?.procedure && !o.switchingFrom) return result(false, `Your ${def(cur).name.toLowerCase()} would need to come out first, or be switched at the same visit.`, 'neutral', { switchNeeded: true });
  }
  // Minors: confidential access depends on the country (simplified profile); never assumed either way.
  if (p.age < 18 && !m.barrier) {
    const r = rulesFor(p.countryId);
    const conf = r.minors === 'confidential' && store.state.year >= (r.minorsFrom ?? 0);
    if (!conf && !o.guardian && !(r.minors === 'varies' && o.provider && facility(o.provider.facilityId)?.defId === 'sexual_health')) {
      return result(false, 'Where you live, the rules for a young person getting this vary. A sexual health service can explain them; involving a parent or guardian is another way.', 'neutral', { minor: true });
    }
  }
  const route = accessRoute(id, p.countryId);
  const service = serviceFor(id);
  let provider = o.provider ?? null;
  if (['clinic', 'procedure'].includes(route) && m.id !== 'fam') {
    provider ??= defaultProvider(service, p);
    if (!provider) return result(false, 'Nobody nearby can provide this at the moment.', 'neutral');
    const npc = npcOf(provider.providerId);
    if (!npc || npc.id === p.id || !mayProvide(npc, service)) return result(false, `${npc ? clinicianName(npc) : 'That clinician'} is not trained to provide this. Another clinician or clinic can.`, 'neutral');
  }
  // What it costs now.
  const parts = startCosts(m, route);
  const fee = provider?.fee ?? 1;
  const total = parts.reduce((s, x) => s + priceFor(x.base, x.kind, fee, p), 0);
  if (!canAfford(total, p)) return result(false, `Starting this would cost ${fmtMoney(total, country())}, which you do not have. A public sexual health service or a lower-cost method may be within reach.`, 'neutral', { cost: total });
  const abs = absNow();
  const rec = { id: nextId(c, 'cm'), methodId: id, formulation: o.formulation ?? m.formulations?.find((f) => availableIn(id) && f.from <= store.state.year)?.id ?? null,
    status: 'active', startAbs: abs, endAbs: null, protectUntil: null, protectFrom: null, expiresAbs: null, deviceId: null,
    providerId: provider?.providerId ?? null, facilityId: provider?.facilityId ?? null, countryId: p.countryId, route, gaps: [], events: [], effects: [], reported: [],
    reason: o.reason ?? null, eligibility: { cat: el.cat, reasons: el.reasons }, autoRenew: true };
  if (m.durations) {
    const yrs = durationYears(m, p.countryId);
    rec.expiresAbs = abs + Math.round(yrs * 12);
    rec.deviceId = `dev_${hashOf(p.id, rec.id).toString(36)}`;
    rec.durationYears = yrs;
  }
  if (m.supply) rec.rx = { expiresAbs: m.supply.otc ? null : abs + (m.supply.rxMonths ?? 12), suppliedThrough: abs - 1 };
  if (m.every) rec.nextDueAbs = abs + m.every.months;
  if (m.needsConfirmation) rec.status = 'awaiting_confirmation';
  // A switch: the old main method keeps protecting until the new one does (no accidental gap).
  if (o.switchingFrom) {
    const old = c.methods.find((r) => r.id === o.switchingFrom);
    if (old && old.endAbs == null) {
      const bridge = Math.ceil((m.onsetWeeks ?? 0) / 4.33);
      endRecord(old, def(old).procedure ? 'removed' : 'switched', o.reason ?? `switched to ${m.name.toLowerCase()}`, p, bridge);
      old.replacedBy = rec.id;
      rec.switchedFrom = old.id;
      rec.bridged = true;
    }
  }
  // Pay: the visit, the device or first supply, the placement.
  const paid = parts.reduce((s, x) => s + pay(`bc:${rec.id}:${x.what}`, x.base, x.kind, `${m.name}: ${x.what}`, fee, p), 0);
  if (provider) {
    const a = visit(provider, m.procedure ? `${m.name}: placement` : `${m.name}: start`, 0, p);
    rec.startApptId = a.id;
  }
  if (rec.rx) rec.rx.suppliedThrough = abs + (m.supply.months ?? 1) - 1;
  rec.effects = decideEffects(rec, p);
  rec.paidAtStart = paid;
  note(rec, startLine(m, provider, p), 'start');
  c.methods.push(rec);
  c.legacyDefault = false;
  if (m.id === 'fam') c.facts.famTaught = true;
  syncLegacyFlag(p);
  const text = `${startLine(m, provider, p)}${paid ? ` It cost ${fmtMoney(paid, country())}.` : noCostSharing(p) ? ' Your cover paid for it in full.' : ''}`;
  log(text, 'system', 'good');
  return result(true, text, 'good', { recId: rec.id });
}
function startLine(m, provider, p) {
  const who = provider ? clinicianName(npcOf(provider.providerId)) : null;
  const yrs = m.durations ? durationYears(m, p.countryId) : null;
  if (m.procedure === 'iud' || m.procedure === 'implant') return `${who} places your ${m.name.toLowerCase()} in a short visit. It is approved for ${yrs} years here; you can have it out sooner whenever you want.`;
  if (m.id === 'injection') return `${who} gives your first injection. The next is due in about three months; renewal visits are booked for you.`;
  if (m.supply?.otc) return `You start using ${m.name.toLowerCase()}s, kept stocked as part of your routine.`;
  if (m.id === 'fam') return `${who ? `${who} teaches you` : 'You learn'} fertility awareness. It takes daily tracking, and is less certain while cycles are irregular.`;
  if (m.supply) return `${who} prescribes the ${m.name.toLowerCase()}. Refills come through while the prescription lasts.`;
  return `You start using ${m.name.toLowerCase()}.`;
}
function startCosts(m, route) {
  const out = [];
  if (m.cost?.device) out.push({ what: 'device', base: m.cost.device, kind: 'care' });
  if (m.cost?.placement) out.push({ what: 'placement', base: m.cost.placement, kind: 'care' });
  if (m.cost?.visit && route !== 'otc') out.push({ what: 'visit', base: m.cost.visit, kind: 'care' });
  if (m.cost?.dose) out.push({ what: 'dose 1', base: m.cost.dose, kind: 'care' });
  if (m.cost?.course) out.push({ what: 'course', base: m.cost.course, kind: 'otc' });
  if (m.supply) out.push({ what: 'supply', base: m.supply.base, kind: m.supply.otc || route === 'otc' ? 'otc' : 'care' });
  return out;
}

/** Ends a record. `bridgeMonths`: how long it keeps protecting after it ends (for a switch). */
function endRecord(rec, status, why, p, bridgeMonths = 0) {
  const abs = absNow();
  rec.endAbs = abs;
  rec.status = status;
  rec.endReason = why ?? null;
  if (bridgeMonths > 0) rec.protectUntil = abs + bridgeMonths;
  // An injection already given protects until it would be due again.
  if (def(rec)?.id === 'injection' && rec.nextDueAbs != null) rec.protectUntil = Math.max(rec.protectUntil ?? abs, rec.nextDueAbs);
  note(rec, `${status === 'removed' ? 'Removed' : status === 'replaced' ? 'Replaced' : status === 'switched' ? 'Switched' : 'Stopped'}${why ? `: ${why}` : ''}.`, status);
  // Any procedure still booked for it is canceled.
  syncLegacyFlag(p);
}
/** Keeps the old one-switch flag in step for any code that still reads it. */
function syncLegacyFlag(p) {
  const c = cx(p);
  p.flags.birthControl = c.legacyDefault || active(p).length > 0;
}

/** Stops a method the person controls themselves. Devices need a removal; permanent methods cannot be stopped. */
export function stopMethod(recId, why = null, p = player()) {
  const rec = cx(p).methods.find((r) => r.id === recId);
  if (!rec || rec.endAbs != null) return result(false, 'That method is not in use.', 'neutral');
  const m = def(rec);
  if (m.permanent) return result(false, `${m.name} is meant to be permanent. There is no stopping it; reversal is a separate, major operation that often does not work.`, 'neutral');
  if (m.procedure) return result(false, `A ${m.name.toLowerCase()} is taken out by a trained clinician: ask for a removal.`, 'neutral', { needsRemoval: true });
  endRecord(rec, 'stopped', why, p);
  const back = m.returnMonths ? ' Fertility can take some months to return after the injection; it varies.' : m.hormonal ? ' Fertility usually returns quickly.' : '';
  const text = `You stop using ${m.name.toLowerCase()}.${m.id === 'injection' ? ' The last injection keeps working until it would have been due.' : ''}${back}`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}

/** Removal of a device by a trained clinician. Its record stays, with the date and who removed it. */
export function removeDevice(recId, o = {}, p = player()) {
  const rec = cx(p).methods.find((r) => r.id === recId);
  if (!rec || rec.endAbs != null) return result(false, 'There is no device to remove.', 'neutral');
  const m = def(rec);
  if (!m.remove) return result(false, 'That is not a device.', 'neutral');
  const provider = o.provider ?? defaultProvider(m.remove, p);
  if (!provider) return result(false, 'Nobody nearby is trained to remove it at the moment.', 'neutral');
  const npc = npcOf(provider.providerId);
  if (!mayProvide(npc, m.remove)) return result(false, `${clinicianName(npc)} is not trained for this; another clinician can.`, 'neutral');
  const price = priceFor(m.cost.removal, 'care', provider.fee, p);
  if (!canAfford(price, p)) return result(false, `Removal costs ${fmtMoney(price, country())}, more than you have right now. A public sexual health service may cost less.`, 'neutral');
  pay(`bc:${rec.id}:removal`, m.cost.removal, 'care', `${m.name}: removal`, provider.fee, p);
  visit(provider, `${m.name}: removal`, 0, p);
  const years = Math.round(((absNow() - rec.startAbs) / 12) * 10) / 10;
  const placedAt = rec.facilityId ? facility(rec.facilityId)?.name : null;
  endRecord(rec, 'removed', o.why ?? null, p);
  rec.removedBy = provider.providerId;
  const text = `${clinicianName(npc)} removes the ${m.name.toLowerCase()}${placedAt ? ` placed at ${placedAt}` : ''} ${years >= 1 ? `${years} years ago` : 'placed earlier'}. ${m.hormonal ? 'Fertility usually returns quickly.' : 'Fertility returns straight away.'}`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}

/** A device replaced at one visit: the old one out, a new one in, no gap. The new device has a record of its own. */
export function replaceDevice(recId, o = {}, p = player()) {
  const rec = cx(p).methods.find((r) => r.id === recId);
  if (!rec || rec.endAbs != null || !def(rec)?.remove) return result(false, 'There is no device to replace.', 'neutral');
  const m = def(rec);
  const newId = o.methodId ?? rec.methodId;
  if (!availableIn(newId)) return result(false, 'That device is not available here now.', 'neutral');
  const provider = o.provider ?? defaultProvider(m.remove, p);
  if (!provider) return result(false, 'Nobody nearby is trained to do this.', 'neutral');
  const price = priceFor(m.cost.removal, 'care', provider.fee, p);
  if (!canAfford(price, p)) return result(false, 'You cannot cover the cost right now.', 'neutral');
  const r = startMethod(newId, { ...o, provider, switchingFrom: rec.id, reason: 'replaced when due' }, p);
  if (!r.ok) return r;
  pay(`bc:${rec.id}:removal`, m.cost.removal, 'care', `${m.name}: removal`, provider.fee, p);
  rec.status = 'replaced';
  const text = `${clinicianName(npcOf(provider.providerId))} replaces your ${m.name.toLowerCase()} at one visit: the old one out, a new one in, with no gap in protection.`;
  log(text, 'system', 'good');
  return result(true, text, 'good', { recId: r.recId });
}

/** Changes from one main method to another (removing a device at the same visit where needed). */
export function switchMethod(recId, toId, o = {}, p = player()) {
  const rec = cx(p).methods.find((r) => r.id === recId);
  if (!rec || rec.endAbs != null) return startMethod(toId, o, p);
  const from = def(rec);
  if (from.permanent) return result(false, 'Permanent contraception is not switched.', 'neutral');
  if (from.remove) {
    const provider = o.provider ?? defaultProvider(from.remove, p);
    if (!provider) return result(false, 'Nobody nearby can remove the device.', 'neutral');
    if (!canAfford(priceFor(from.cost.removal, 'care', provider.fee, p), p)) return result(false, 'You cannot cover the removal right now.', 'neutral');
    const r = startMethod(toId, { ...o, switchingFrom: rec.id }, p);
    if (!r.ok) return r;
    pay(`bc:${rec.id}:removal`, from.cost.removal, 'care', `${from.name}: removal`, provider.fee, p);
    rec.removedBy = provider.providerId;
    return r;
  }
  return startMethod(toId, { ...o, switchingFrom: rec.id }, p);
}

/** Changes the formulation within a pill category (for example to an extended regimen), at a review. */
export function changeFormulation(recId, formId, p = player()) {
  const rec = cx(p).methods.find((r) => r.id === recId);
  const m = def(rec);
  const f = m?.formulations?.find((x) => x.id === formId);
  if (!rec || rec.endAbs != null || !f || f.from > store.state.year) return result(false, 'That is not available.', 'neutral');
  rec.formulation = formId;
  note(rec, `Changed to: ${f.name}.`, 'formulation');
  return result(true, `Your prescription is changed to: ${f.name.toLowerCase()}${f.note ? ` (${f.note})` : ''}.`, 'neutral');
}

// ---------- Side effects and concerns ----------

/** What this person has noticed on a method so far (only what has come by now). */
export const noticed = (rec, abs = absNow()) => (rec.effects ?? []).filter((e) => e.noticeAbs <= abs && (e.fadeAbs == null || abs < e.fadeAbs));

/** Reporting a concern: a clinician reviews it. You may continue, change formulation, change method or stop. */
export function reportConcern(recId, p = player()) {
  const rec = cx(p).methods.find((r) => r.id === recId);
  if (!rec || rec.endAbs != null) return result(false, 'That method is not in use.', 'neutral');
  const m = def(rec);
  const provider = (rec.providerId && npcOf(rec.providerId)?.alive && !npcOf(rec.providerId).flags.clinician?.retired)
    ? { providerId: rec.providerId, facilityId: rec.facilityId, fee: facility(rec.facilityId)?.fee ?? 1 } : defaultProvider('counsel', p);
  if (!provider) return result(false, 'There is nowhere nearby to go at the moment.', 'neutral');
  const price = priceFor(120, 'care', provider.fee, p);
  if (!canAfford(price, p)) return result(false, `A review costs ${fmtMoney(price, country())}.`, 'neutral');
  visit(provider, `${m.name}: review of a concern`, 120, p);
  const now = noticed(rec);
  for (const e of now) e.reported = true;
  const effects = now.map((e) => e.label.toLowerCase());
  rec.reported.push({ abs: absNow(), effects: now.map((e) => e.id), providerId: provider.providerId });
  const fades = now.some((e) => SIDE_EFFECTS[e.id]?.fades) && absNow() - rec.startAbs < 6;
  const text = `${clinicianName(npcOf(provider.providerId))} listens and checks you over. ${effects.length ? `What you describe (${list(effects)}) is a known effect of ${m.name.toLowerCase()} for some people.` : 'Nothing worrying turns up.'}`
    + `${fades ? ' It often settles in the first months.' : ''} You can carry on, try a different ${m.formulations ? 'formulation or ' : ''}method, or stop: it is your choice.`;
  note(rec, 'Concern reviewed.', 'review');
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral', { effects: now.map((e) => e.id) });
}

// ---------- Permanent contraception ----------

/** Informed consent: the patient's own, after counseling. No one else can give it for a competent adult. */
export function giveConsent(id, o = {}, p = player()) {
  const m = METHOD_BY_ID[id];
  if (!m?.permanent) return result(false, 'Consent is recorded for permanent methods.', 'neutral');
  if (o.by && o.by !== p.id) return result(false, 'Only you can consent to a procedure on your own body. A partner cannot consent for you.', 'bad');
  const el = eligibility(id, p);
  if (!el.ok) return result(false, el.blocked, 'neutral');
  const provider = o.provider ?? defaultProvider(m.procedure, p);
  if (!provider) return result(false, 'Nobody nearby performs this procedure.', 'neutral');
  if (!o.understood) return result(false, `${m.name} is meant to be permanent. Counseling covers other long-acting options that are reversible, and the chance of regret.`, 'neutral', { needsUnderstanding: true });
  const price = priceFor(m.cost.visit, 'care', provider.fee, p);
  if (!canAfford(price, p)) return result(false, `The counseling visit costs ${fmtMoney(price, country())}.`, 'neutral');
  visit(provider, `${m.name}: counseling and consent`, m.cost.visit, p);
  cx(p).consents[id] = { abs: absNow(), providerId: provider.providerId, facilityId: provider.facilityId };
  const text = `${clinicianName(npcOf(provider.providerId))} goes through what ${m.name.toLowerCase()} involves, that it is meant to be permanent, and the alternatives. You sign the consent form yourself. You can change your mind at any time before the procedure.`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}
/** Books the procedure for a later month (after the waiting period); it happens as the months are lived. */
export function scheduleProcedure(id, p = player()) {
  const c = cx(p);
  const m = METHOD_BY_ID[id];
  const consent = c.consents[id];
  if (!m?.permanent || !consent) return result(false, 'Consent comes first, after counseling.', 'neutral');
  if (c.scheduled.some((s) => s.methodId === id)) return result(false, 'It is already booked.', 'neutral');
  const price = priceFor(m.cost.procedure, 'care', facility(consent.facilityId)?.fee ?? 1, p);
  if (!canAfford(price, p)) return result(false, `The procedure would cost ${fmtMoney(price, country())}. Public services may offer it at less cost.`, 'neutral');
  const wait = Math.max(1, Math.ceil((m.consentWaitWeeks ?? 4) / 4.33));
  const s = { id: nextId(c, 'sched'), kind: 'procedure', methodId: id, abs: Math.max(absNow() + 1, consent.abs + wait), providerId: consent.providerId, facilityId: consent.facilityId };
  c.scheduled.push(s);
  return result(true, `The ${m.name.toLowerCase()} is booked for ${dateOf(s.abs, p)}. You can cancel it at any time before then.`, 'neutral');
}
export function cancelScheduled(schedId, p = player()) {
  const c = cx(p);
  const i = c.scheduled.findIndex((s) => s.id === schedId);
  if (i < 0) return result(false, 'Nothing is booked.', 'neutral');
  c.scheduled.splice(i, 1);
  return result(true, 'Canceled. Nothing has been done, and your consent can be given again later if you want.', 'neutral');
}
function performProcedure(s, abs, p) {
  const c = cx(p);
  const m = METHOD_BY_ID[s.methodId];
  const npc = npcOf(s.providerId);
  if (!npc?.alive || !mayProvide(npc, m.procedure) || !canAfford(priceFor(m.cost.procedure, 'care', facility(s.facilityId)?.fee ?? 1, p), p)) {
    log(`Your ${m.name.toLowerCase()} could not go ahead as booked. You can arrange it again in My Health.`, 'system', 'neutral');
    return;
  }
  const rec = { id: nextId(c, 'cm'), methodId: m.id, status: m.needsConfirmation ? 'awaiting_confirmation' : 'active', startAbs: abs, endAbs: null, protectUntil: null,
    protectFrom: m.needsConfirmation ? abs + Math.ceil(m.onsetWeeks / 4.33) : null, providerId: s.providerId, facilityId: s.facilityId, countryId: p.countryId,
    gaps: [], events: [], effects: [], reported: [], permanent: true, consentAbs: c.consents[m.id]?.abs };
  pay(`bc:${rec.id}:procedure`, m.cost.procedure, 'care', `${m.name}: procedure`, facility(s.facilityId)?.fee ?? 1, p);
  visit({ providerId: s.providerId, facilityId: s.facilityId }, `${m.name}: procedure`, 0, p);
  rec.effects = decideEffects(rec, p);
  if (m.needsConfirmation) rec.confirmAbs = rec.protectFrom;
  note(rec, `${m.name} done by ${clinicianName(npc)}.`, 'procedure');
  c.methods.push(rec);
  c.legacyDefault = false;
  delete c.consents[m.id];
  log(`${clinicianName(npc)} performs your ${m.name.toLowerCase()}. ${m.needsConfirmation ? 'Until a semen test confirms it has worked, in about three months, another method is still needed.' : 'You are home the same day, sore for a few days.'}`, 'system', 'neutral');
}

// ---------- Pregnancy planning, partners, postpartum ----------

export function setPlanning(value, p = player()) {
  if (!PLANNING[value]) return result(false, 'Unknown choice.', 'neutral');
  const c = cx(p);
  if (c.planning === value) return result(true, 'Unchanged.', 'neutral');
  c.planningHistory.push({ abs: absNow(), from: c.planning, to: value });
  c.planning = value;
  const hint = value === 'soon' && primaryNow(p) ? ' A preference changes nothing by itself: your current method is still in place until you stop it or have it removed.' : '';
  return result(true, `Noted: ${PLANNING[value].toLowerCase()}. It is a preference, and it changes nothing about your body by itself.${hint}`, 'neutral');
}

/**
 * Talking with a partner about family planning. They say what they would like; nothing is changed by it, and they
 * cannot change your contraception or your medical record. What they say depends on who they are.
 */
export function discussWithPartner(npcId, topic = 'plans', p = player()) {
  const npc = npcOf(npcId);
  if (!npc?.alive || !['spouse', 'partner'].includes(npc.role)) return result(false, 'This is a conversation for a partner.', 'neutral');
  const c = cx(p);
  const r = seeded('partner-plans', npc.id, p.id, Math.floor(absNow() / 12));
  const wants = r.pick(['wants children soon', 'would like children one day', 'is not sure about children', 'does not want children', 'is happy either way']);
  c.partnerTalks.push({ abs: absNow(), npcId, topic, said: wants });
  if (c.partnerTalks.length > 30) c.partnerTalks.shift();
  npc.meters.relationship = clamp(npc.meters.relationship + 2);
  const text = `You and ${npc.firstName} talk it through. ${npc.firstName} says they ${wants.replace(/^is /, 'are ').replace(/^wants /, 'want ').replace(/^does not /, 'do not ').replace(/^would /, 'would ')}. `
    + `You talk about money, timing and how you would share things. ${npc.firstName} can tell you what they hope; the decisions about your own body and care stay yours.`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral', { said: wants });
}

/** A partner cannot change, stop or remove the player's contraception, or read or edit their record. */
export function partnerMayChange() { return false; }

/** Months since this person gave birth (the player), or null. */
export function monthsSinceBirth(p = player()) {
  const pp = cx(p).postpartum;
  return pp ? absNow() - pp.abs : null;
}
const recentBirth = (p) => { const k = monthsSinceBirth(p); return k != null && k < 6; };

/** Called by engine/children.js when the player has given birth: a postpartum consultation is offered, not forced. */
export function afterBirth(p = player()) {
  if (!canBePregnant(p)) return;
  const c = cx(p);
  c.postpartum = { abs: absNow(), breastfeeding: null, births: (p.flags.births = (p.flags.births ?? 0) + 1) };
  // A device cannot have stayed through a pregnancy in this model's terms: any method in place had failed or stopped.
  storyBeat('repro_postpartum', {}, { source: 'health', must: true, weight: 2 });
}
export function setBreastfeeding(on, p = player()) {
  const c = cx(p);
  if (!c.postpartum) return result(false, 'Not after a recent birth.', 'neutral');
  c.postpartum.breastfeeding = !!on;
  return result(true, on ? 'Noted. Breastfeeding alone is not reliable contraception unless strict conditions are met; your clinician can explain.' : 'Noted.', 'neutral');
}
/** Postpartum options, each with its eligibility now. */
export function postpartumOptions(p = player()) {
  return METHODS.filter((m) => bodyFits(m, p) && availableIn(m.id, p.countryId) && !m.permanent).map((m) => ({ id: m.id, name: m.name, ...eligibility(m.id, p) }));
}

// ---------- Emergency contraception ----------

/**
 * A night together (engine/bonds.js) is a real exposure. Returns the chance multiplier and whether to offer emergency
 * contraception instead of settling it now. Draws no game dice: a barrier's failure is seeded by the person and the night.
 */
export function actRisk(p = player()) {
  const c = cx(p);
  const abs = absNow();
  const parts = partsAt(abs, p);
  let failed = false;
  let mult = parts.primary * parts.fert;
  if (parts.barrier < 1) {
    c.acts = (c.acts ?? 0) + 1;
    failed = seeded('barrier', p.id, c.acts).chance(parts.barrier);
    const combined = combine(parts.primary, parts.barrier);
    mult = failed ? Math.min(1, combined / parts.barrier) * parts.fert : 0;
  }
  const unprotected = parts.explicit && parts.primary >= 0.05 && (parts.barrier >= 1 || failed);
  const want = ['not', 'unsure'].includes(c.planning);
  const offerEc = unprotected && ((failed && !['soon', 'open'].includes(c.planning)) || (parts.barrier >= 1 && want));
  return { mult, failed, offerEc };
}

/** Records an exposure that may need emergency contraception, and queues the decision at once. */
export function recordExposure(o, p = player()) {
  const c = cx(p);
  const e = { id: nextId(c, 'exp'), abs: absNow(), npcId: o.npcId, bondId: o.bondId ?? null, kind: o.failed ? 'barrier_failure' : 'unprotected', would: !!o.would, status: 'open', ec: null };
  c.exposures.push(e);
  if (c.exposures.length > 40) c.exposures.shift();
  store.state.pendingEvents.push({ id: 'repro_ec', cast: { them: o.npcId, words: { exp: e.id, what: o.failed ? 'The condom broke.' : 'You did not use anything this time.' } } });
  return e;
}
/** Emergency options for an open exposure, with whether each can be had now. Never once its window has passed. */
export function ecOptions(expId, p = player()) {
  const e = cx(p).exposures.find((x) => x.id === expId);
  if (!e || e.status !== 'open' || absNow() !== e.abs) return [];
  const r = rulesFor(p.countryId);
  return EMERGENCY.filter((ec) => availableIn(ec.id, p.countryId)).map((ec) => {
    const route = ec.id === 'ec_lng' ? (store.state.year >= (r.ecLngFrom ?? 9999) ? r.ecLng : 'clinic') : ec.id === 'ec_upa' ? (store.state.year >= (r.ecUpaFrom ?? 9999) ? r.ecUpa : 'clinic') : 'procedure';
    const provider = route === 'procedure' ? defaultProvider('iud', p) : route === 'clinic' ? defaultProvider('prescribe', p) : null;
    const el = ec.methodId ? eligibility(ec.methodId, p) : { ok: true };
    const price = ec.methodId ? priceFor(METHOD_BY_ID[ec.methodId].cost.device + METHOD_BY_ID[ec.methodId].cost.placement, 'care', provider?.fee ?? 1, p)
      : priceFor(ec.base, route === 'otc' ? 'otc' : route === 'pharmacy' ? 'otc' : 'care', provider?.fee ?? 1, p);
    const ok = el.ok && (route === 'otc' || route === 'pharmacy' || !!provider) && canAfford(price, p);
    return { id: ec.id, name: ec.name, note: ec.note, route, provider, price, ok, why: !el.ok ? el.blocked : !canAfford(price, p) ? 'More than you have right now.' : (route !== 'otc' && route !== 'pharmacy' && !provider) ? 'Nobody nearby can provide it in time.' : '' };
  });
}
/** Takes (or declines) emergency contraception, then the exposure is settled through the game's own pregnancy rule. */
export function takeEc(expId, ecId, p = player()) {
  const c = cx(p);
  const e = c.exposures.find((x) => x.id === expId);
  if (!e || e.status !== 'open') return result(false, 'There is nothing to decide now.', 'neutral');
  if (absNow() !== e.abs) return settleExposure(e, null, p, 'The window for emergency contraception has passed.');
  if (!ecId) return settleExposure(e, null, p);
  const opt = ecOptions(expId, p).find((o) => o.id === ecId);
  if (!opt?.ok) return result(false, opt?.why || 'That is not available.', 'neutral');
  const ec = EC_BY_ID[ecId];
  let text;
  if (ec.methodId) {
    const r = startMethod(ec.methodId, { provider: opt.provider, reason: 'emergency contraception', emergency: true, acknowledge: true }, p);
    if (!r.ok) return r;
    text = `${clinicianName(npcOf(opt.provider.providerId))} places a copper IUD the same week. It works as emergency contraception and stays as ongoing contraception if you want it.`;
  } else {
    pay(`bc:${e.id}:${ec.id}`, ec.base, opt.route === 'clinic' ? 'care' : 'otc', ec.name, opt.provider?.fee ?? 1, p);
    if (opt.provider) visit(opt.provider, ec.name, 0, p);
    text = `${opt.route === 'clinic' ? `${clinicianName(npcOf(opt.provider.providerId))} prescribes` : 'A pharmacist provides'} the ${ec.name.toLowerCase()}, and you take it the same day.`;
  }
  e.ec = ecId;
  return settleExposure(e, ec, p, text);
}
function settleExposure(e, ec, p, lead = '') {
  const prevented = e.would && ec && seeded('ec', p.id, e.id).chance(1 - ec.residual);
  e.status = 'settled';
  e.outcome = e.would && !prevented ? 'pregnancy' : 'none';
  let text = lead;
  if (e.outcome === 'pregnancy' && !p.flags.pregnancy) {
    const npc = npcOf(e.npcId);
    if (npc?.alive) {
      const said = conceive(npc, false);
      const b = e.bondId ? store.state.bonds?.list?.[e.bondId] : null;
      if (b) b.pregnancy = { year: store.state.year, month: store.state.month ?? 0 };
      text = `${text} ${said}${ec ? ' Emergency contraception lowers the chance; it does not remove it.' : ''}`.trim();
    }
  } else if (ec) text = `${text} Your next period comes.`.trim();
  return result(true, text || 'You let it be.', 'neutral');
}
/** Any exposure still open when the months move on: its window has passed. Settled with no emergency contraception. */
function closeOpenExposures(p) {
  for (const e of cx(p).exposures) if (e.status === 'open' && e.abs < absNow()) settleExposure(e, null, p);
}

// ---------- The months ----------

/** Processes every month lived since the last time, in order, up to `target` (an absolute month). Idempotent. */
export function processThrough(target, p = player()) {
  if (!p?.alive) return;
  const c = cx(p);
  closeOpenExposures(p);
  const start = c.processed + 1;
  for (let m = start; m <= target; m++) month(m, p, c);
  if (target > c.processed) c.processed = target;
}
function month(abs, p, c) {
  // Procedures booked for this month.
  for (const s of c.scheduled.filter((x) => x.abs === abs)) { c.scheduled.splice(c.scheduled.indexOf(s), 1); performProcedure(s, abs, p); }
  for (const rec of c.methods) {
    if (rec.endAbs != null && rec.endAbs <= abs) continue;
    const m = def(rec);
    if (!m) continue;
    // Moving country: a prescription from abroad needs a local clinician (renewed at once if one is available).
    if (rec.countryId !== p.countryId) {
      rec.countryId = p.countryId;
      if (rec.rx?.expiresAbs != null) rec.rx.expiresAbs = abs;
      if (!availableIn(rec.methodId, p.countryId) && !m.durations && !m.permanent) {
        endRecord(rec, 'stopped', 'not available in the new country', p);
        log(`${m.name} is not available where you now live, so it has stopped. My Health shows what is available here.`, 'system', 'bad');
        storyBeat('repro_access_change', {}, { source: 'health', weight: 2 });
        continue;
      }
      note(rec, 'Moved country: care continues under the new country\'s rules.', 'move');
    }
    if (m.supply) supplyMonth(rec, m, abs, p, c);
    if (m.every) injectionMonth(rec, m, abs, p);
    if (rec.expiresAbs != null) {
      if (abs === rec.expiresAbs - 6) storyBeat('repro_expiring', {}, { source: 'health', weight: 2 });
      if (abs === rec.expiresAbs) { rec.status = 'expired'; note(rec, 'Reached its approved duration: replacement or removal is due.', 'expired'); log(`Your ${m.name.toLowerCase()} has reached the end of its approved duration. It can be replaced or removed in My Health.`, 'system', 'neutral'); }
    }
    if (rec.status === 'awaiting_confirmation' && rec.confirmAbs === abs) {
      pay(`bc:${rec.id}:test`, m.cost.test ?? 100, 'care', `${m.name}: confirmation test`, 1, p);
      if (seeded('confirm', p.id, rec.id).chance(0.95)) { rec.status = 'active'; note(rec, 'The confirmation test shows it has worked.', 'confirmed'); log(`The follow-up test confirms your ${m.name.toLowerCase()} has worked.`, 'system', 'good'); }
      else { rec.confirmAbs = abs + 3; rec.protectFrom = abs + 3; note(rec, 'The test is not clear yet: another in three months, with another method meanwhile.', 'retest'); }
    }
    for (const e of rec.effects ?? []) if (!e.noticed && e.noticeAbs === abs) {
      e.noticed = true;
      if (!rec.seenEffectScene) { rec.seenEffectScene = true; storyBeat('repro_side_effect', { words: { method: m.name.toLowerCase(), effect: e.label.toLowerCase() } }, { source: 'health', weight: 1 }); }
    }
  }
}
function supplyMonth(rec, m, abs, p, c) {
  if (rec.rx.suppliedThrough >= abs) return;
  // A prescription that has run out is renewed at a routine review, booked for you while you keep the method.
  if (rec.rx.expiresAbs != null && rec.rx.expiresAbs <= abs) {
    const provider = renewalProvider(rec, p);
    const price = provider ? priceFor(m.cost?.visit ?? 120, 'care', provider.fee, p) : Infinity;
    if (!provider || !rec.autoRenew || !canAfford(price, p)) return lapse(rec, m, abs, p, !provider ? 'no clinician available to renew it' : !rec.autoRenew ? 'not renewed' : 'the renewal visit could not be paid for');
    pay(`bc:${rec.id}:renew:${abs}`, m.cost?.visit ?? 120, 'care', `${m.name}: prescription review`, provider.fee, p);
    visit(provider, `${m.name}: prescription review`, 0, p);
    rec.providerId = provider.providerId; rec.facilityId = provider.facilityId;
    rec.rx.expiresAbs = abs + (m.supply.rxMonths ?? 12);
    note(rec, 'Prescription renewed at a routine review.', 'renewal');
  }
  const kind = m.supply.otc || rec.route === 'otc' ? 'otc' : 'care';
  const price = priceFor(m.supply.base, kind, 1, p);
  if (!canAfford(price, p)) return lapse(rec, m, abs, p, 'the refill could not be paid for');
  pay(`bc:${rec.id}:supply:${abs}`, m.supply.base, kind, `${m.name}: ${m.supply.months > 1 ? `${m.supply.months} months' supply` : 'a month\'s supply'}`, 1, p);
  rec.rx.suppliedThrough = abs + m.supply.months - 1;
  const open = rec.gaps.find((g) => g.to == null);
  if (open) { open.to = abs; note(rec, 'Back on it after a gap.', 'resume'); }
}
function lapse(rec, m, abs, p, why) {
  if (rec.gaps.some((g) => g.to == null)) return;
  rec.gaps.push({ from: abs, to: null, why });
  note(rec, `Ran out: ${why}.`, 'lapse');
  log(`Your ${m.name.toLowerCase()} ran out: ${why}. Until it is sorted out, it does not protect you. My Health has the options.`, 'system', 'bad');
  storyBeat('repro_refill', { words: { method: m.name.toLowerCase() } }, { source: 'health', weight: 2 });
}
function injectionMonth(rec, m, abs, p) {
  if (rec.nextDueAbs !== abs) return;
  const provider = renewalProvider(rec, p, 'injection');
  const price = provider ? priceFor((m.cost.visit ?? 90) + (m.cost.dose ?? 0), 'care', provider.fee, p) : Infinity;
  if (!provider || !rec.autoRenew || !canAfford(price, p)) {
    // Late: the last dose stops protecting once its grace has passed (within the month, in the game's terms).
    rec.gaps.push({ from: abs, to: null, why: !rec.autoRenew ? 'injection not renewed' : 'the injection visit was missed' });
    rec.protectUntil = abs;
    rec.status = 'overdue';
    note(rec, 'Next injection missed: no longer protected until a new dose.', 'late');
    log('Your contraceptive injection was due and was not given. It no longer protects you. My Health can arrange it.', 'system', 'bad');
    return;
  }
  pay(`bc:${rec.id}:dose:${abs}`, (m.cost.visit ?? 90) + (m.cost.dose ?? 0), 'care', `${m.name}: injection`, provider.fee, p);
  visit(provider, `${m.name}: injection`, 0, p);
  rec.nextDueAbs = abs + m.every.months;
  rec.doses = (rec.doses ?? 1) + 1;
  note(rec, 'Injection given on schedule.', 'dose');
}
/** The clinician who renews: the one already caring for it if still practicing, else the nearest who can. */
function renewalProvider(rec, p, service = 'prescribe') {
  const npc = npcOf(rec.providerId);
  const f = facility(rec.facilityId);
  if (npc?.alive && !npc.flags.clinician?.retired && f && f.countryId === p.countryId && f.city === p.city && mayProvide(npc, service)) return { providerId: npc.id, facilityId: f.id, fee: f.fee ?? 1 };
  const next = defaultProvider(service, p);
  if (next && rec.providerId && next.providerId !== rec.providerId) storyBeat('repro_new_provider', {}, { source: 'health', weight: 1 });
  return next;
}

/** Restarts an overdue injection or a lapsed refill. */
export function resume(recId, p = player()) {
  const rec = cx(p).methods.find((r) => r.id === recId);
  if (!rec || rec.endAbs != null) return result(false, 'That method is not in use.', 'neutral');
  const m = def(rec);
  const abs = absNow();
  if (m.every) {
    const provider = renewalProvider(rec, p, 'injection');
    const price = provider ? priceFor((m.cost.visit ?? 90) + (m.cost.dose ?? 0), 'care', provider.fee, p) : Infinity;
    if (!provider || !canAfford(price, p)) return result(false, 'It cannot be arranged right now.', 'neutral');
    pay(`bc:${rec.id}:dose:${abs}:late`, (m.cost.visit ?? 90) + (m.cost.dose ?? 0), 'care', `${m.name}: injection`, provider.fee, p);
    visit(provider, `${m.name}: injection (late)`, 0, p);
    const g = rec.gaps.find((x) => x.to == null); if (g) g.to = abs;
    rec.protectUntil = null; rec.status = 'active'; rec.nextDueAbs = abs + m.every.months; rec.protectFrom = abs + 1;
    note(rec, 'A late injection: a pregnancy test first, and protection again after a short while.', 'dose');
    return result(true, 'You have the injection. As it was late, the clinic checks you are not pregnant first, and it takes a little while to protect again.', 'neutral');
  }
  if (m.supply) {
    rec.autoRenew = true;
    if (rec.rx.expiresAbs != null && rec.rx.expiresAbs <= abs) rec.rx.expiresAbs = abs; // renewed in the month's processing
    month(abs, p, cx(p));
    return rec.gaps.some((g) => g.to == null) ? result(false, 'It still cannot be arranged.', 'neutral') : result(true, 'Sorted: your supply is back.', 'good');
  }
  return result(false, 'Nothing to resume.', 'neutral');
}

/** Between turns (engine/turns.js): the months just lived. */
export function between(state = store.state) {
  const p = state.player;
  if (!p?.alive || !p.health) return;
  processThrough(absNow(state) - 1, p);
}
/** At the turn of the year (engine/yearProcessor.js), before the year changes: the rest of the year, and its risk. */
export function closeYear(p = player()) {
  if (!p?.alive) return;
  const c = cx(p);
  const y = store.state.year;
  processThrough(y * 12 + 11, p);
  c.lastYear = { forYear: y + 1, year: y, risks: Array.from({ length: 12 }, (_, i) => riskAt(y * 12 + i, p)) };
  yearScenes(p, c);
}

// ---------- Story Director ----------

const COOLDOWN = { repro_considering: 4, repro_discuss_children: 3, repro_permanent: 6, repro_followup: 3, repro_insurance: 2 };
/** Once a year: an optional, context-true scene, at most one, never repeated within its cooldown. */
function yearScenes(p, c) {
  const y = store.state.year;
  const ok = (id) => (c.scenes[id] == null || y - c.scenes[id] >= (COOLDOWN[id] ?? 3));
  const mark = (id, cast = {}) => { if (storyBeat(id, cast, { source: 'health', weight: 1 })) c.scenes[id] = y; };
  const partner = p.npcIds.map(npcOf).find((n) => n?.alive && ['spouse', 'partner'].includes(n.role));
  const pol = policyNow(p);
  const lastKey = c.policyKey; c.policyKey = pol.key;
  if (lastKey && lastKey !== pol.key && active(p).some((r) => def(r)?.supply && !def(r).supply.otc) && ok('repro_insurance')) return mark('repro_insurance');
  if (p.age >= 18 && p.age <= 45 && (canBePregnant(p) || canCausePregnancy(p)) && partner && !c.methods.length && !c.planning && ok('repro_considering')) return mark('repro_considering');
  if (partner && p.age >= 25 && p.age <= 42 && ['unsure', null, 'considering'].includes(c.planning) && ok('repro_discuss_children')) return mark('repro_discuss_children', { love: partner.id });
  const kids = p.npcIds.map(npcOf).filter((n) => n?.role === 'child').length;
  if (p.age >= 35 && kids >= 2 && c.planning === 'not' && !c.methods.some((r) => def(r)?.permanent) && ok('repro_permanent')) return mark('repro_permanent');
  const longUse = active(p).find((r) => !def(r)?.barrier && absNow() - r.startAbs >= 24);
  if (longUse && ok('repro_followup')) return mark('repro_followup', { words: { method: def(longUse).name.toLowerCase() } });
  return undefined;
}

/** The `repro` effect of the reproductive health scenes (data/events/repro.js). */
export function sceneChoice(value, cast = {}) {
  const p = player();
  const [what, arg] = String(value).split(':');
  const words = cast.words ?? {};
  switch (what) {
    case 'consult': return consult(defaultProvider('counsel', p), arg ?? 'options', p).text;
    case 'plan': return setPlanning(arg, p).text;
    case 'ec': return takeEc(words.exp, arg === 'none' ? null : arg, p).text;
    case 'talk': return cast.love ? discussWithPartner(cast.love, 'children', p).text : '';
    case 'breastfeeding': return setBreastfeeding(arg === 'yes', p).text;
    case 'review': { const rec = primaryNow(p); return rec ? reportConcern(rec.id, p).text : ''; }
    case 'note': return '';
    default: return '';
  }
}
/** For the emergency scene: the options, in words, so the scene lists only what is really possible now. */
export const ecChoicesFor = (expId) => ecOptions(expId).filter((o) => o.ok);
const openExposure = (p) => cx(p).exposures.find((e) => e.status === 'open' && e.abs === absNow());
// Scene requirements (engine/conditions.js resolves these paths): which emergency options are really open now.
// Registered on first use, not at load: the health modules import each other.
let pathsReady = false;
function registerPaths() {
  if (pathsReady) return;
  pathsReady = true;
  HEALTH_PATHS['repro.ec'] = (p) => { const e = p.health?.contraception ? openExposure(p) : null; return e ? ecChoicesFor(e.id).map((o) => o.id) : []; };
  HEALTH_PATHS['repro.postpartum'] = (p) => (p.health?.contraception?.postpartum ? 100 : 0);
}

// ---------- Views ----------

/** Status of a record, in words, for the screens. Never shows an old stopped method as current. */
export function statusOf(rec, abs = absNow()) {
  const m = def(rec);
  if (rec.endAbs != null && abs >= rec.endAbs) {
    if (rec.protectUntil != null && abs < rec.protectUntil) return { key: 'ending', label: 'Ending (still protecting for now)' };
    return { key: rec.status, label: { removed: 'Removed', replaced: 'Replaced', switched: 'Changed to another method', stopped: 'Stopped' }[rec.status] ?? 'Ended' };
  }
  if (rec.status === 'awaiting_confirmation') return { key: 'awaiting', label: 'Awaiting the confirmation test: use another method meanwhile' };
  if (rec.expiresAbs != null && abs >= rec.expiresAbs) return { key: 'expired', label: 'Past its approved duration: replace or remove' };
  if ((rec.gaps ?? []).some((g) => g.to == null)) return { key: 'lapsed', label: rec.status === 'overdue' ? 'Injection overdue: not protecting' : 'Supply ran out: not protecting' };
  if (m?.permanent) return { key: 'active', label: 'Permanent' };
  return { key: 'active', label: 'In use' };
}

/** What to do next, for the current-method card. */
export function nextAction(rec, p = player()) {
  const m = def(rec);
  const abs = absNow();
  if (rec.status === 'awaiting_confirmation') return `Confirmation test in ${dateOf(rec.confirmAbs, p)}`;
  if (rec.expiresAbs != null) return abs >= rec.expiresAbs ? 'Replacement or removal is due' : `Replacement or removal by ${dateOf(rec.expiresAbs, p)}`;
  if (m.every) return rec.gaps.some((g) => g.to == null) ? 'Arrange a new injection' : `Next injection ${dateOf(rec.nextDueAbs, p)}`;
  if (m.supply && !m.supply.otc) return rec.gaps.some((g) => g.to == null) ? 'Sort out a refill' : `Prescription review by ${dateOf(rec.rx.expiresAbs, p)}`;
  if (m.supply) return 'Kept stocked as part of your routine';
  return 'Nothing to do';
}

/** The comparison table: meaningful characteristics, no single ranking or safety score. */
export function comparison(ids, p = player()) {
  return ids.map((id) => METHOD_BY_ID[id]).filter(Boolean).map((m) => {
    const yrs = m.durations ? durationYears(m, p.countryId) : null;
    const el = eligibility(m.id, p);
    const route = availableIn(m.id) ? accessRoute(m.id) : null;
    const startParts = startCosts(m, route ?? m.access);
    return {
      id: m.id, name: m.name, hormonal: m.hormonal ? `Hormonal (${m.hormone})` : 'Nonhormonal', acting: m.category === 'larc' ? 'Long-acting' : m.permanent ? 'Permanent' : 'Short-acting',
      typical: m.typicalRange ? `${m.typicalRange[0]}–${m.typicalRange[1]} in 100 (varies with method and use)` : `${m.typical} in 100`, perfect: `${m.perfect} in 100`,
      maintenance: m.maintenance, access: { otc: 'Off the shelf', pharmacy: 'From a pharmacist', clinic: 'From a clinician', procedure: 'A clinician\'s procedure' }[route ?? m.access],
      duration: yrs ? `Up to ${yrs} years (approved here now)` : m.every ? `About every ${m.every.months} months` : m.permanent ? 'Permanent' : m.supply ? 'While you keep using it' : 'Each time',
      sideEffects: (m.sideEffects ?? []).map((s) => SIDE_EFFECTS[s]?.label).filter(Boolean), sti: m.sti ? 'Lowers the risk of many STIs' : 'No protection against STIs',
      startCost: startParts.reduce((s, x) => s + priceFor(x.base, x.kind, 1, p), 0), available: availableIn(m.id), eligibility: el, approximate: !!m.approximate,
    };
  });
}

/** The menstrual picture now (approximate model; labeled so in the UI). */
export function bleedingNow(p = player()) {
  const st = lifeStage(p);
  if (st === 'none' || st === 'young') return null;
  if (st === 'postmenopause') return { stage: st, text: 'Periods have stopped (after menopause).' };
  if (p.flags.pregnancy) return { stage: st, text: 'No periods during pregnancy.' };
  const b = baseline(p);
  const rec = primaryNow(p);
  const onMethod = rec && !def(rec)?.permanent && rec.bleeding;
  const base = `${b.regular ? 'Regular' : 'Irregular'} cycles, ${b.flow} flow${b.cramps !== 'none' ? `, ${b.cramps} cramps` : ''}`;
  return { stage: st, text: onMethod ? `On ${def(rec).name.toLowerCase()}: ${rec.bleeding}. (Before: ${base.toLowerCase()}.)` : `${base}.${st === 'perimenopause' ? ' Cycles may become less predictable approaching menopause; contraception can still be needed.' : ''}` };
}

/** What a viewer may see of this person's contraception: the person only (and nothing in archives or for others). */
export function visibleTo(viewerId, p = player()) { return viewerId === p.id ? cx(p) : null; }

// ---------- Compatibility ----------

/** The old one-switch API (People tab, engine/bonds.js): on starts nothing new, it keeps or restores the unspecified default. */
export function legacySwitch(on, p = player()) {
  const c = cx(p);
  if (on) {
    if (!active(p).length && !c.methods.length) c.legacyDefault = true;
    p.flags.birthControl = true;
    return result(true, active(p).length || c.legacyDefault ? 'You are using birth control. Health → Reproductive health lets you choose a specific method.' : 'Choose a method in Health → Reproductive health.', 'neutral');
  }
  c.legacyDefault = false;
  for (const rec of active(p)) if (!def(rec).procedure && !def(rec).permanent) endRecord(rec, 'stopped', 'stopped using birth control', p);
  p.flags.birthControl = false;
  const left = active(p);
  return result(true, left.length ? `You stop the methods you control yourself. Your ${left.map((r) => def(r).name.toLowerCase()).join(' and ')} stays until it is removed by a clinician.` : 'You have stopped using birth control.', 'neutral');
}
/** Whether a method in place means a couple cannot simply "try for a baby" (it has to be stopped or removed first). */
export function blocksTrying(p = player(), o = {}) {
  cx(p);
  // IVF goes around the tubes (and, after a vasectomy, sperm can be retrieved): only a reversible method stands in its way.
  const rec = active(p).find((r) => !def(r)?.barrier && recordRiskAt(r, absNow(), p) < 0.5 && !(o.ivf && def(r)?.permanent));
  if (!rec) return null;
  const m = def(rec);
  return m.permanent ? `${m.name} is meant to be permanent.` : m.procedure ? `Your ${m.name.toLowerCase()} would need to be removed first (My Health → Reproductive health).`
    : `You would stop your ${m.name.toLowerCase()} first (My Health → Reproductive health).`;
}

/** Save migration: lives from before this record get it lazily (cx), from the old flag; nothing is invented. */
export function migrateContraception(state) {
  registerPaths();
  const p = state.player;
  if (!p?.health) return;
  if (p.health.contraception) {
    const c = p.health.contraception;
    // Defensive: a duplicated device record (two active records with the same device id) keeps the first.
    const seen = new Set();
    c.methods = c.methods.filter((r) => { if (!r.deviceId || r.endAbs != null) return true; if (seen.has(r.deviceId)) return false; seen.add(r.deviceId); return true; });
  }
}
