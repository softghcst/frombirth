// Japan and Korea after the draft (data/sports.js COUNTRY_DRAFTS): the club holds a player until free agency (nine
// seasons to go abroad); before that he can ask to be posted to the big leagues, which needs the club's consent (Korea:
// after seven seasons) and earns the club a fee from the signing club (20% of the first $25 million, 17.5% of the next
// $25 million, 15% after that). A player posted before 25 is signed under the international amateur rules: a minor
// league contract and a bonus out of a pool, as Shohei Ohtani was in 2017. Korean men serve in the military before 28
// (about eighteen months), the best athletes in the armed forces' own team, Sangmu, which plays in the Futures League;
// a medal at the Games exempts them.
//
//   e.asia = { posted: [{ year, consent, to? }], service: { kind: 'sangmu'|'regular', from, until } | null, served: bool, exempt: why|null }
import { log, milestone } from '../state.js';
import { clamp } from '../util.js';
import { COUNTRY_DRAFTS, DRAFTS, sportOf } from '../data/sports.js';
import { clubOf, toMinors } from './draft.js';
import { clubAt, bonusFor } from './international.js';
import * as sp from './sports.js';
import { internals as life, settle } from './sportsLife.js';

const { seeded, overall, findOrg, joinOrg } = sp.internals;
const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
export const SERVICE_BY = 28;

/** The rules of the country's league, if the player plays there under contract. */
function home(state, e) {
  const p = state.player;
  const rules = COUNTRY_DRAFTS[p.countryId]?.[e.id];
  const k = e.contractId && sp.ensure(state).contracts[e.contractId];
  const org = k && sp.orgOf(k.orgId, state);
  return rules && org && org.countryId === p.countryId && org.level === 'pro' ? { rules, k, org } : null;
}
/** Seasons played as a professional at home. */
export const proSeasons = (state, e) => state.year - (e.proYear ?? state.year);
/** What the club receives for a posted player, by the size of his contract. */
export function postingFee(total) {
  const a = Math.min(total, 25e6), b = clamp(total - 25e6, 0, 25e6), c = Math.max(0, total - 50e6);
  return Math.round(a * 0.2 + b * 0.175 + c * 0.15);
}

/** The player's year, after the season (engine/sportsLife.js yearIn). */
export function asiaYear(state, a, e) {
  const p = state.player;
  if (!COUNTRY_DRAFTS[p.countryId]?.[e.id]) return;
  const X = (e.asia ??= { posted: [], service: null, served: false, exempt: null });
  serviceYear(state, e, X);
  const h = home(state, e);
  if (!h || X.service) return;
  const o = overall(e, p);
  const n = proSeasons(state, e);
  if (n >= h.rules.freeAgency && o >= 74) {
    offerFrom(state, e, 'freeAgent');
    return;
  }
  if (n >= h.rules.posting && o >= 76 && !X.posted.some((x) => x.year === state.year)) {
    life.decide(state, { kind: 'posting', sportId: e.id, key: `posting/${e.id}/${state.year}`,
      text: `You are among the best in ${h.rules.name}, and big league scouts are at your games. You can ask ${h.org.name} to post you: if they agree, big league clubs have 45 days to sign you, and ${h.org.name} receive a fee.${p.age < 25 ? ' Under 25, you would be signed as an international amateur: a minor league contract and a capped bonus.' : ''}`,
      options: [{ id: 'yes', label: 'Ask to be posted' }, { id: 'no', label: 'Stay' }] });
  }
}

/** A big league club's offer: posted (the club is paid a fee) or as a free agent (nobody is). */
function offerFrom(state, e, how) {
  const p = state.player;
  const r = seeded(`mlb/${p.id}/${e.id}/${state.year}`);
  const club = clubAt(state, r.int(0, 29));
  const o = overall(e, p);
  const amateur = how === 'posted' && p.age < 25;
  const off = amateur ? { bonus: Math.min(bonusFor(state, Math.max(o, 70), 16), life.money(state, 3500000)), salary: life.money(state, 46000), years: 6, level: 1 }
    : { ...life.offerFor(state, e, club), bonus: 0 };
  if (!amateur) off.years = r.int(2, 6);
  const total = off.salary * off.years + off.bonus;
  life.decide(state, { kind: 'mlbOffer', sportId: e.id, key: `mlbOffer/${e.id}/${state.year}`, how, amateur, orgId: club.id, orgName: club.name, ...off,
    text: `${club.name} want you in the big leagues: ${amateur ? `a minor league contract and a ${life.fmt(state, off.bonus)} bonus, under the international amateur rules` : `${off.years} years at ${life.fmt(state, off.salary)} a year`}.${how === 'posted' ? ` Your club would receive a posting fee of ${life.fmt(state, postingFee(total))}.` : ' As a free agent, you owe no one a fee.'}`,
    options: [{ id: 'sign', label: `Sign with ${club.name}` }, { id: 'no', label: 'Stay at home' }] });
}

/** Korean military service: before 28, about eighteen months; Sangmu for the best athletes; a Games medal exempts. */
function serviceYear(state, e, X) {
  const p = state.player;
  if (p.countryId !== 'kr' || p.gender !== 'male') return;
  if (X.service && state.year >= X.service.until) {
    const was = X.service;
    X.service = null; X.served = true;
    log(`Your military service is over${was.kind === 'sangmu' ? ', and with it your time at Sangmu' : ''}.`, 'system', 'good');
    milestone('Completed military service.', 'career');
    const k = e.contractId && sp.ensure(state).contracts[e.contractId];
    // Back to the club (or its minor league team) that held him, on his contract's pay.
    if (k?.status === 'active') { const club = sp.orgOf(e.minor?.orgId ?? k.orgId, state); if (club) { joinOrg(club, state); p.career.salary = k.salary; } }
    return;
  }
  if (X.served || X.service) return;
  const medal = (e.medals ?? [])[0];
  if (medal && !X.exempt) { X.exempt = `a ${medal.medal} medal at the ${medal.games}`; log(`Your ${medal.medal} medal exempts you from military service.`, 'system', 'good'); return; }
  if (X.exempt) return;
  if (p.age >= SERVICE_BY) return enlist(state, e, X, overall(e, p) >= 62 && e.level === 'pro' ? 'sangmu' : 'regular');
  if (p.age >= 25) {
    life.decide(state, { kind: 'service', sportId: e.id, key: `service/${e.id}/${state.year}`,
      text: `Military service is due before you turn ${SERVICE_BY}: about eighteen months. Sangmu, the armed forces' athletic corps, takes the best players and keeps them playing, in the Futures League.`,
      options: [{ id: 'sangmu', label: 'Apply to Sangmu' }, { id: 'regular', label: 'Serve now' }, { id: 'later', label: 'Later' }] });
  }
}
function enlist(state, e, X, kind) {
  const p = state.player;
  X.service = { kind, from: state.year, until: state.year + 2 };
  p.career.salary = life.money(state, 1500);
  if (kind === 'sangmu') {
    const org = findOrg(state, sportOf(e.id), 'pro', { key: `sangmu/${e.id}`, name: 'Sangmu Phoenix', tier: 3, strength: -8 });
    org.minorLevel = 'Futures League';
    joinOrg(org, state);
  } else e.plan.hours = Math.min(e.plan.hours, 2);
  milestone(kind === 'sangmu' ? 'Began military service with Sangmu.' : 'Began military service.', 'career');
  log(kind === 'sangmu' ? 'You enlisted, and Sangmu took you: eighteen months of soldiering and baseball.' : 'You enlisted. For eighteen months, baseball waits.', 'system', 'neutral');
}
/** Whether the player is away on ordinary military service this year (no games). */
export const onService = (state, e) => e.asia?.service?.kind === 'regular' && state.year < e.asia.service.until;

export const ASIA_ANSWERS = {
  posting(state, d, choice) {
    const p = state.player;
    const e = sp.entryOf(d.sportId, p.id, state);
    const h = e && home(state, e);
    if (!h) return { ...result(false, 'That has passed.', 'neutral'), close: true };
    if (choice === 'no') return result(true, `You stay with ${h.org.name}.`, 'neutral');
    const n = proSeasons(state, e);
    const consent = seeded(`consent/${p.id}/${state.year}`).chance(n >= 7 ? 0.85 : n >= 4 ? 0.35 : 0.1);
    e.asia.posted.push({ year: state.year, consent });
    if (!consent) return { ...result(false, `${h.org.name} said no: they want you for a while yet.`, 'neutral'), close: true };
    offerFrom(state, e, 'posted');
    return result(true, `${h.org.name} agreed to post you. Big league clubs have 45 days.`);
  },
  service(state, d, choice) {
    const e = sp.entryOf(d.sportId, state.player.id, state);
    if (!e?.asia || choice === 'later') return result(true, `It can wait until you are ${SERVICE_BY}.`, 'neutral');
    const ok = choice === 'sangmu' && overall(e, state.player) >= 62 && e.level === 'pro';
    enlist(state, e, e.asia, ok ? 'sangmu' : 'regular');
    return result(true, choice === 'sangmu' && !ok ? 'Sangmu did not take you: you serve as an ordinary soldier.' : ok ? 'Sangmu took you.' : 'You enlisted.', ok || choice === 'regular' ? 'neutral' : 'bad');
  },
  mlbOffer(state, d, choice) {
    const p = state.player;
    const e = sp.entryOf(d.sportId, p.id, state);
    if (!e || choice === 'no') return result(true, 'You stay at home.', 'neutral');
    const club = clubOf(state, sp.orgOf(d.orgId, state)?.teamIds[0]);
    const k = e.contractId && sp.ensure(state).contracts[e.contractId];
    if (k) life.endContract(state, k, d.how === 'posted' ? 'posted to the big leagues' : 'left as a free agent');
    const res = life.signPro(state, { sportId: e.id, orgId: club.id, orgName: club.name, salary: d.salary, years: d.years, level: d.level, how: 'signing' });
    if (res.ok === false) return res;
    if (d.bonus) settle(state, `mlbBonus/${e.id}/${state.year}`, d.bonus, 'sponsorship', `Signing bonus: ${club.name}`, 'action');
    if (d.amateur) toMinors(state, e, club, 4, DRAFTS.baseball.minors);
    (e.asia.posted.at(-1) ?? {}).to = club.name;
    milestone(`Signed with ${club.name}, in the big leagues.`, 'career');
    sp.moment(state, { type: 'abroad', sportId: e.id, text: `Signed with ${club.name}.`, sig: 3, orgId: club.id });
    return result(true, `You signed with ${club.name}.${d.amateur ? ' You start in Triple-A.' : ''}`);
  },
};
