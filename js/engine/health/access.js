// Accessibility and support: needs, the devices a person chooses, the
// accommodations schools and employers put in place, and the accessibility of
// home. Barriers are in the surroundings; removing one changes what a person
// can take part in, never who they are, their intelligence or their condition.
//
// An accommodation request shares the need, never the diagnosis behind it.
import { rng } from '../../rng.js';
import { store, player, country, log } from '../../state.js';
import { clamp } from '../../util.js';
import { NEEDS, DEVICES, ACCOMMODATIONS, HOME_FEATURES, ACCESS_LAW, ACCESS_LAW_DEFAULT } from '../../data/health/supports.js';
import { CONDITION_BY_ID } from '../../data/health/conditions.js';
import { healthOf, presentConditions, diagnosisFor } from './record.js';
import { now, charge, priceOf, hashOf } from './util.js';
import { domainImpact } from './course.js';
import { healthMilestone } from './story.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });

/** Whether a condition is known to the person: diagnosed, or plainly part of their life (deaf, blind, a wheelchair user). */
function known(rec, p) {
  const def = CONDITION_BY_ID[rec.conditionId];
  if (diagnosisFor(rec, healthOf(p))) return true;
  if (rec.showsAge != null && p.age < rec.showsAge) return false;
  return ['sensory', 'mobility'].includes(def.group) || ['achondroplasia', 'limb_difference'].includes(def.id);
}

/** The person's support needs: from known conditions, and any they have named themselves. */
export function needs(p = player()) {
  const h = healthOf(p);
  const out = {};
  for (const rec of presentConditions(h)) {
    if (!known(rec, p)) continue;
    for (const n of CONDITION_BY_ID[rec.conditionId].supports ?? []) out[n] ??= { id: n, source: rec.conditionId };
  }
  for (const [id, x] of Object.entries(h.supports.needs)) if (x.self && !x.removed) out[id] ??= { id, source: 'self' };
  // Someone who prefers not to use a device has not got an unmet need for it.
  for (const [id, x] of Object.entries(h.supports.needs)) if (x.declined && NEEDS[id]?.optional) delete out[id];
  return Object.values(out).filter((n) => NEEDS[n.id]);
}

/** Name a need yourself, with or without a diagnosis. */
export function addNeed(id, p = player()) {
  if (!NEEDS[id]) return result(false, 'Unknown need.', 'neutral');
  healthOf(p).supports.needs[id] = { self: true, since: now(p) };
  return result(true, `Noted: ${NEEDS[id].name.toLowerCase()}. You can ask for it at school, work or home without saying why.`, 'good');
}
/** Prefer not to use something (a hearing aid, a cochlear implant, a prosthesis). A choice, respected. */
export function declineDevice(needId, p = player()) {
  const x = (healthOf(p).supports.needs[needId] ??= {});
  x.declined = true;
  return result(true, 'Noted as your preference. Nobody will push it.', 'neutral');
}

// ---------- Devices ----------

export const deviceAvailable = (id, year = store.state.year) => !!DEVICES[id] && year >= DEVICES[id].from;
export const devicesOwned = (p = player()) => healthOf(p).supports.devices.filter((d) => d.active);

export function getDevice(deviceId, p = player()) {
  const h = healthOf(p);
  const d = DEVICES[deviceId];
  if (!deviceAvailable(deviceId)) return result(false, `${d?.name ?? 'That'} is not available yet.`, 'neutral');
  if (devicesOwned(p).some((x) => x.deviceId === deviceId)) return result(false, `You already have a ${d.name.toLowerCase()}.`, 'neutral');
  const cost = priceOf(d.cost);
  if (p.finance.cash < cost) return result(false, `It would cost you ${cost}. You do not have it right now; community services may be able to help.`, 'neutral');
  const id = `dev_${hashOf(p.id, deviceId, now(p)).toString(36)}`;
  charge(`device:${id}`, d.cost, { what: d.name });
  h.supports.devices.push({ id, deviceId, since: now(p), active: true });
  const big = ['power_chair', 'wheelchair', 'hearing_aid', 'cochlear_implant', 'prosthesis', 'braille_display', 'guide_dog'].includes(deviceId);
  if (big) healthMilestone(`Got a new ${d.name.toLowerCase()}.`, { type: 'device', id }, p, { shareable: true });
  return result(true, `You have a ${d.name.toLowerCase()} now${cost ? `; your share of the cost was ${cost}` : ''}.`, 'good');
}

export function retireDevice(id, p = player()) {
  const d = healthOf(p).supports.devices.find((x) => x.id === id && x.active);
  if (!d) return result(false, 'Nothing to put away.', 'neutral');
  d.active = false; d.until = now(p);
  return result(true, 'Put away. It stays in your record.', 'neutral');
}

// ---------- Accommodations ----------

/** Where accommodations apply right now: the school or job the player is in. */
export function placeOf(setting, p = player()) {
  if (setting === 'school') return p.education.enrolled ? `school:${p.education.schoolId ?? p.education.stage}` : null;
  if (setting === 'work') return p.career.careerId ? `work:${p.career.careerId}:${p.career.employerId ?? ''}` : null;
  return setting;
}
export const lawSince = (cid = country().id) => ACCESS_LAW[cid] ?? ACCESS_LAW_DEFAULT;
export const accommodationsNow = (p = player()) => healthOf(p).supports.accommodations.filter((a) => a.status === 'granted' && a.place === placeOf(a.setting, p));

/**
 * Asks a school or employer for an accommodation. Where disability law
 * requires reasonable adjustments, nearly all are agreed; before that, it
 * depends on goodwill. Only the need is shared, never a diagnosis.
 */
export function requestAccommodation(setting, typeId, needId, p = player()) {
  const h = healthOf(p);
  const a = ACCOMMODATIONS[typeId];
  const place = placeOf(setting, p);
  if (!a || !a.settings.includes(setting)) return result(false, 'That does not apply there.', 'neutral');
  if (!place) return result(false, setting === 'school' ? 'You are not in school or college.' : 'You are not working at the moment.', 'neutral');
  if (store.state.year < a.from) return result(false, `${a.name} is not something anyone offers yet.`, 'neutral');
  if (h.supports.accommodations.some((x) => x.typeId === typeId && x.place === place && ['granted', 'requested'].includes(x.status))) return result(false, 'You already have that.', 'neutral');
  const law = store.state.year >= lawSince();
  const remote = typeId === 'remote_work' && !p.career.careerId;
  const odds = remote ? 0 : law ? 0.92 : 0.55;
  const id = `acc_${hashOf(p.id, typeId, place, now(p)).toString(36)}`;
  const granted = rng.chance(odds);
  h.supports.accommodations.push({ id, setting, typeId, needId, place, status: granted ? 'granted' : 'declined', requestedWk: now(p), grantedAt: granted ? now(p) : null, shared: 'need only' });
  const where = setting === 'school' ? 'school' : 'your employer';
  if (granted) {
    if (h.supports.accommodations.filter((x) => x.status === 'granted').length === 1) healthMilestone(`${setting === 'school' ? 'School' : 'Work'} put support in place: ${a.name.toLowerCase()}.`, { type: 'accommodation', id }, p, { shareable: true });
    return result(true, `${where.charAt(0).toUpperCase() + where.slice(1)} agreed: ${a.name.toLowerCase()}. You explained what you need; nobody asked for a diagnosis.`, 'good');
  }
  return result(false, law ? `${where.charAt(0).toUpperCase() + where.slice(1)} said no. Where the law requires reasonable adjustments, you can ask again with support from an advocate.` : `${where.charAt(0).toUpperCase() + where.slice(1)} said no. There is no law here yet that makes them.`, 'bad');
}

/** Which accommodations or devices would meet a need in a setting. */
export function meetsFor(needId, setting) {
  const n = NEEDS[needId];
  return n.meets.filter((m) => (ACCOMMODATIONS[m]?.settings.includes(setting)) || DEVICES[m] || (setting === 'home' && HOME_FEATURES[m]));
}

// ---------- Home ----------

/** The home the player lives in, as a record that can carry adaptations. */
export function homeRecord(p = player()) {
  const own = p.assets.find((a) => a.id === p.homeId);
  if (own) return { kind: 'own', name: own.name ?? 'Your home', features: (own.access ??= []), asset: own };
  const key = p.flags.livesWithParents ? 'family' : 'rented';
  const h = healthOf(p);
  const rec = (h.supports.home[`${p.countryId}:${p.city}:${key}`] ??= { features: [] });
  return { kind: key, name: key === 'family' ? 'The family home' : 'Your rented home', features: rec.features, rec };
}

export function homeFeatureAvailable(id, year = store.state.year) { return year >= (HOME_FEATURES[id].from ?? 1900); }

/**
 * Adapts the home. An owner pays and the change is written into the home's own
 * history (and stays with the house if it is sold). A tenant asks the landlord,
 * who must agree to reasonable changes where the law requires it.
 */
export function adaptHome(featureId, p = player()) {
  const f = HOME_FEATURES[featureId];
  const home = homeRecord(p);
  if (!f || !homeFeatureAvailable(featureId)) return result(false, 'That is not available.', 'neutral');
  if (home.features.includes(featureId)) return result(false, 'Your home already has that.', 'neutral');
  if (home.kind === 'family' && p.age < 18) return result(false, 'Your parents would need to arrange that.', 'neutral');
  if (home.kind === 'rented') {
    const law = store.state.year >= lawSince();
    if (!rng.chance(law ? 0.85 : 0.4)) return result(false, 'The landlord refused.', 'bad');
  }
  const cost = priceOf(f.cost);
  if (p.finance.cash < cost) return result(false, `It would cost ${cost}. Grants for home adaptations may help.`, 'neutral');
  charge(`home:${featureId}:${home.kind}:${p.homeId ?? p.city}`, f.cost, { what: f.name });
  home.features.push(featureId);
  if (home.asset) (home.asset.history ??= []).push({ year: store.state.year, text: `Made more accessible: ${f.name.toLowerCase()}.` });
  log(`${f.name} fitted at ${home.kind === 'own' ? 'your home' : home.name.toLowerCase()}.`, 'system', 'good');
  if (home.features.length === 1) healthMilestone('Made home work better for you.', { type: 'home', id: featureId }, p, { shareable: true });
  return result(true, `${f.name} is in. ${home.kind === 'own' ? 'It is recorded in the house\'s history.' : ''}`.trim(), 'good');
}

// ---------- Barriers ----------

/** Whether a need is met in a setting, by an accommodation, a device or the home. */
export function met(needId, setting, p = player()) {
  const ways = NEEDS[needId].meets;
  if (devicesOwned(p).some((d) => ways.includes(d.deviceId))) return true;
  if (setting === 'home') return homeRecord(p).features.some((f) => HOME_FEATURES[f].meets.includes(needId));
  if (setting === 'school' || setting === 'work') {
    if (accommodationsNow(p).some((a) => a.setting === setting && ways.includes(a.typeId))) return true;
    // Buildings put up since the law came in are step-free.
    if (needId === 'step_free' && store.state.year >= lawSince() + 10) return true;
  }
  return false;
}

/** How much unmet needs get in the way in a setting (0–1). */
export function barrier(setting, p = player()) {
  const ws = needs(p).map((n) => (met(n.id, setting, p) ? 0 : NEEDS[n.id].settings[setting] ?? 0)).filter((x) => x > 0).sort((a, b) => b - a);
  return clamp((ws[0] ?? 0) + ws.slice(1).reduce((s, x) => s + x * 0.25, 0), 0, 1);
}

/**
 * Marks lost to barriers at school or university, not to ability: an unmet
 * need, or a hard stretch for concentration. Accommodations take it away.
 */
export function studyBarrier(p = player()) {
  if (!p.health) return 0;
  const d = domainImpact(p);
  const focus = (d.focus ?? 0) / 100;
  const study = (d.study ?? 0) / 100; // already lower where support is in place (supportEffect)
  return Math.round(clamp(barrier('school', p) * 0.5 + focus * 0.3 + study * 0.3, 0, 0.9) * 100) / 100;
}
/** Work performance points lost to barriers. */
export function workBarrier(p = player()) {
  if (!p.health) return 0;
  const focus = (domainImpact(p).focus ?? 0) / 100;
  return Math.round(barrier('work', p) * 10 + focus * 6);
}

/** What met needs do for the everyday impact of a condition (0–0.5). */
export function supportEffect(rec, p = player()) {
  const def = CONDITION_BY_ID[rec.conditionId];
  const list = def?.supports ?? [];
  if (!list.length || !(def.neurotype || ['sensory', 'mobility', 'genetic'].includes(def.group))) return 0;
  const settings = ['school', 'work', 'home'];
  let have = 0; let all = 0;
  for (const n of list) for (const s of settings) if (NEEDS[n]?.settings[s]) { all++; if (met(n, s, p)) have++; }
  return all ? 0.5 * have / all : 0;
}

/** For the Accessibility screen: each need, where it applies, and whether it is met. */
export function supportSummary(p = player()) {
  return needs(p).map((n) => ({ ...n, name: NEEDS[n.id].name,
    settings: Object.keys(NEEDS[n.id].settings).map((s) => ({ setting: s, met: met(n.id, s, p), weight: NEEDS[n.id].settings[s] })) }));
}
