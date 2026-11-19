// College recruiting, as it happens in the United States and Canada: a high school athlete is rated by the recruiting
// services, goes to camps and showcases to be seen, hears from coaches, gets offers from Division I to junior college,
// takes official visits, gives a verbal commitment (which either side can break), and signs in senior year if the
// grades are there. Then college (engine/sportsLife.js collegeTeam), and the draft (engine/draft.js).
//
//   e.recruit = { stars, rank, exposure, interest: [programId], offers: [Offer], visits: [programId], commit: programId|null,
//                 signed: programId|null, history: [{ year, text }] }
//   Offer = { id: programId, name, division, fraction, year, pulled? }
//   programs: the country's universities with a sports program (their division kept in state.sports.divisions) and
//   junior colleges ('juco:<city>'), community colleges in the player's own region.
import { log, milestone } from '../state.js';
import { clamp } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { sportOf, DIVISIONS, HEADCOUNT, STARS } from '../data/sports.js';
import { catalog } from './university.js';
import * as sp from './sports.js';
import { internals as life } from './sportsLife.js';

const { seeded, overall } = sp.internals;
const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

/** The high school grade the player is in (9 to 12), or null when not at high school. */
export const gradeOf = (p) => (p.education?.enrolled && p.education.stage === 'high' ? clamp(p.age - 5, 9, 12) : null);
export const GRADE_NAMES = { 9: 'freshman', 10: 'sophomore', 11: 'junior', 12: 'senior' };
/** Where college recruiting happens at all: the countries whose universities run teams for this sport. */
export const recruitsHere = (sport, countryId) => sp.hasCollegeSport(sport, countryId);

/** A university's division, decided once from what kind of university it is. */
export function divisionOf(state, u) {
  const S = sp.ensure(state);
  S.divisions ??= {};
  if (u.id.startsWith('juco:')) return 'JUCO';
  if (!(u.id in S.divisions)) {
    const r = seeded(`division/${u.id}`);
    S.divisions[u.id] = { ancient: 'IVY', research: 'D1', regional: r.chance(0.6) ? 'D1' : 'D2', college: r.chance(0.55) ? 'D3' : 'NAIA', technical: 'D3' }[u.kindId ?? u.kind] ?? null;
  }
  return S.divisions[u.id];
}
/** Every program that could recruit the player: universities with a team, and the junior colleges near home. */
export function programs(state, sport) {
  const p = state.player;
  const unis = catalog(p.countryId).filter((u) => divisionOf(state, u)).map((u) => ({ id: u.id, name: u.name, division: divisionOf(state, u), power: u.kindId === 'research' || u.kind === 'research' }));
  const cities = (COUNTRIES[p.countryId].cities ?? [p.city]).slice(0, 3);
  const juco = cities.map((c) => ({ id: `juco:${c}`, name: `${c} Community College`, division: 'JUCO', power: false }));
  return [...unis, ...juco].map((x) => ({ ...x, sport: sport.id }));
}

/** How the recruiting services see the player: a grade out of 100, stars, and a rank in their class. */
export function prospect(state, e) {
  const p = state.player;
  const o = overall(e, p);
  const youth = Math.max(0, 17 - p.age) * 2.5; // the younger, the more there is still to come
  const form = ((e.lastRating ?? 50) - 50) / 10;
  const seen = Math.min(4, (e.recruit?.exposure ?? 0) / 10); // a player nobody has watched is rated on less
  const grade = Math.round(clamp(o + youth + form + seen, 0, 100));
  const stars = STARS.find(([min]) => grade >= min)?.[1] ?? 0;
  const r = seeded(`rank/${p.id}/${e.id}/${state.year}`);
  const rank = Math.max(1, Math.round(10 ** ((92 - grade) / 13) * r.normal(1, 0.12)));
  return { grade, stars, rank };
}

/** What a program would give: nothing at Division III or the Ivies, a whole scholarship or a share of one elsewhere. */
function aidFor(division, sport, stars) {
  const d = DIVISIONS[division];
  if (d.aid === 'none') return 0;
  if (d.aid === 'full' && HEADCOUNT.includes(sport.id)) return 1;
  const share = { 5: 0.9, 4: 0.65, 3: 0.45, 2: 0.3 }[stars] ?? 0.25;
  return Math.round((d.aid === 'partial' ? share * 0.7 : share) * 20) / 20;
}
/** The stars a program looks for: power programs the best, junior colleges and Division III almost anyone who can play. */
const need = (pr) => (pr.division === 'D1' ? (pr.power ? 4 : 3) : pr.division === 'IVY' ? 3 : pr.division === 'D2' ? 2 : 2);

/**
 * The player's recruiting year, run with their season (engine/sportsLife.js yearIn). @returns {void}
 */
export function recruitYear(state, a, e) {
  const p = state.player;
  const sport = sportOf(e.id);
  const g = gradeOf(p);
  if (g == null || !recruitsHere(sport, p.countryId) || e.contractId || e.recruit?.signed) return;
  const R = (e.recruit ??= { stars: 0, rank: null, exposure: 0, interest: [], offers: [], visits: [], commit: null, signed: null, history: [] });
  const note = (text, tone = 'neutral') => { R.history.push({ year: state.year, text }); sp.say(state, text, tone, { screen: 'hub', id: 'career' }); };
  // Seen playing: a school or club season is exposure; the level and how well they played add to it.
  R.exposure = Math.round(R.exposure * 0.8 + ({ school: 6, club: 5, academy: 9, elite: 12 }[e.level] ?? 2) + Math.max(0, (e.lastRating ?? 50) - 55) / 3);
  const was = R.stars;
  Object.assign(R, prospect(state, e));
  if (g >= 10 && R.stars && R.stars !== was) note(`The recruiting services now rate you ${R.stars}★, number ${R.rank} in your class nationally${was ? ` (${R.stars > was ? 'up' : 'down'} from ${was}★)` : ''}.`, R.stars > was ? 'good' : 'neutral');
  // Every summer: a camp or a showcase, to be seen by college coaches.
  if (g <= 11) life.decide(state, { kind: 'camp', sportId: e.id, key: `camp/${e.id}/${state.year}`, text: `Summer is camp season. College coaches run camps, and showcases bring scouts from many programs at once. ${g < 10 ? 'Coaches cannot call you yet, but they can watch.' : 'Coaches will remember who they saw.'}`,
    options: [{ id: 'elite', label: `A college's elite camp (${life.fmt(state, life.money(state, 600))})` }, { id: 'showcase', label: `A regional showcase (${life.fmt(state, life.money(state, 250))})` }, { id: 'no', label: 'Not this summer' }] });
  const progs = programs(state, sport);
  const r = seeded(`recruit/${p.id}/${e.id}/${state.year}`);
  // A program that offered to a player who has gone backward may take it back.
  for (const o of R.offers.filter((x) => !x.pulled && !x.signed)) {
    const pr = progs.find((x) => x.id === o.id);
    if (pr && R.stars < need(pr) - 1 && r.chance(0.5)) {
      o.pulled = state.year;
      note(`${o.name} have taken back their offer.`, 'bad');
      if (R.commit === o.id) R.commit = null;
    }
  }
  // Sophomore year: letters and questionnaires (coaches may not call yet); the very best get early offers anyway.
  if (g === 10) {
    const keen = r.shuffle(progs.filter((x) => R.stars >= need(x))).slice(0, Math.min(6, R.stars * 2));
    R.interest = [...new Set([...R.interest, ...keen.map((x) => x.id)])];
    if (keen.length) note(`Letters from ${keen.length} college ${keen.length === 1 ? 'program' : 'programs'}: ${keen.slice(0, 3).map((x) => x.name).join(', ')}${keen.length > 3 ? ' and more' : ''}.`);
  }
  // From junior year coaches can call and offer; in senior year, the last offers come. The more seen, the more offers.
  if (g >= (R.stars >= 5 ? 10 : 11)) {
    const room = Math.max(0, Math.round((R.stars - 1) * 1.5 + R.exposure / 12) - R.offers.filter((x) => !x.pulled).length);
    const fits = progs.filter((x) => x.division !== 'JUCO' && R.stars >= need(x) && !R.offers.some((o) => o.id === x.id) && !(x.division === 'IVY' && p.education.gpa < 3.4));
    for (const pr of r.shuffle(fits).slice(0, Math.min(room, g === 12 ? 3 : 4))) {
      const fraction = aidFor(pr.division, sport, R.stars);
      R.offers.push({ id: pr.id, name: pr.name, division: pr.division, fraction, year: state.year });
      note(`${pr.name} (${DIVISIONS[pr.division].name}) offered you ${fraction >= 1 ? 'a full scholarship' : fraction > 0 ? `a scholarship: ${Math.round(fraction * 100)}% of tuition` : 'a place on the team (no athletic scholarship at this level)'}.`, 'good');
    }
    // Junior colleges take players the four-year programs did not, or could not, take.
    if (g === 12 && !R.offers.some((o) => !o.pulled && o.division !== 'JUCO') && R.stars >= 2) {
      const pr = progs.find((x) => x.division === 'JUCO' && !R.offers.some((o) => o.id === x.id));
      if (pr) { R.offers.push({ id: pr.id, name: pr.name, division: 'JUCO', fraction: aidFor('JUCO', sport, R.stars), year: state.year }); note(`${pr.name} offered you a place and a scholarship: two years of junior college, then a four-year program or the draft.`, 'good'); }
    }
  }
  const live = R.offers.filter((x) => !x.pulled);
  // Official visits: a weekend on campus with the team, paid by the program.
  if (g >= 11 && live.length && !R.commit) {
    const unseen = live.filter((x) => !R.visits.includes(x.id));
    if (unseen.length) life.decide(state, { kind: 'visit', sportId: e.id, key: `visit/${e.id}/${state.year}`, text: 'Programs that have offered can bring you in for an official visit: a weekend on campus, paid for by them, to meet the coaches and the team.',
      options: [...unseen.slice(0, 4).map((x) => ({ id: x.id, label: `Visit ${x.name}`, sub: DIVISIONS[x.division].name })), { id: 'no', label: 'No visits this year' }] });
  }
  // A verbal commitment: public, and not binding on either side.
  if (g >= 10 && live.length && !R.commit) {
    life.decide(state, { kind: 'commit', sportId: e.id, key: `commit/${e.id}/${state.year}`, text: `You have ${live.length} ${live.length === 1 ? 'offer' : 'offers'}. A verbal commitment tells everyone where you mean to go. It is not binding: you can change your mind, and so can they, until you sign.`,
      options: [...live.map((x) => ({ id: x.id, label: `Commit to ${x.name}`, sub: `${DIVISIONS[x.division].name} · ${x.fraction >= 1 ? 'full scholarship' : x.fraction > 0 ? `${Math.round(x.fraction * 100)}% of tuition` : 'no athletic scholarship'}${R.visits.includes(x.id) ? ' · visited' : ''}` })), { id: 'wait', label: 'Keep your options open' }] });
  }
  // Senior year: signing day. Committed or not, the offers still standing can be signed; the grades decide whether
  // the player is eligible to play as a freshman.
  if (g === 12 && live.length) {
    const first = R.commit ? live.find((x) => x.id === R.commit) : null;
    life.decide(state, { kind: 'sign', sportId: e.id, key: `sign/${e.id}/${state.year}`, text: `Signing day. Signing is binding: an agreement for a scholarship and a place on the team${first ? `. You are committed to ${first.name}` : ''}.`,
      options: [...(first ? [first] : []).concat(live.filter((x) => x !== first)).map((x) => ({ id: x.id, label: `Sign with ${x.name}`, sub: `${DIVISIONS[x.division].name} · ${x.fraction >= 1 ? 'full scholarship' : x.fraction > 0 ? `${Math.round(x.fraction * 100)}% of tuition` : 'no athletic scholarship'}` })), { id: 'no', label: 'Do not sign' }] });
  }
}

/** The answers to the recruiting decisions (merged into sportsLife's). */
export const RECRUIT_ANSWERS = {
  camp(state, d, choice) {
    if (choice === 'no') return result(true, 'No camp this summer.', 'neutral');
    const e = sp.entryOf(d.sportId, state.player.id, state);
    const cost = life.money(state, choice === 'elite' ? 600 : 250);
    const p = state.player;
    // The family pays for a child's camp, as for the rest of their sport.
    if (p.age >= 18 && p.finance.cash < cost) return result(false, `It costs ${life.fmt(state, cost)}. You do not have it.`, 'neutral');
    if (p.age >= 18) p.finance.cash -= cost;
    e.recruit ??= { stars: 0, rank: null, exposure: 0, interest: [], offers: [], visits: [], commit: null, signed: null, history: [] };
    e.recruit.exposure += choice === 'elite' ? 12 : 8;
    const text = choice === 'elite' ? 'A week at an elite camp, in front of the coaches who run it.' : 'A day at a showcase, with scouts from a dozen programs in the stands.';
    log(text, 'system', 'good');
    return result(true, text);
  },
  visit(state, d, choice) {
    if (choice === 'no') return result(true, 'No visits this year.', 'neutral');
    const e = sp.entryOf(d.sportId, state.player.id, state);
    const o = e.recruit.offers.find((x) => x.id === choice && !x.pulled);
    if (!o) return { ...result(false, 'That offer is gone.', 'neutral'), close: true };
    e.recruit.visits.push(o.id);
    const text = `An official visit to ${o.name}: the facilities, a game, dinner with the coaches, a night with the players.`;
    log(text, 'system', 'good');
    return result(true, text);
  },
  commit(state, d, choice) {
    if (choice === 'wait') return result(true, 'You keep your options open.', 'neutral');
    const e = sp.entryOf(d.sportId, state.player.id, state);
    const o = e.recruit.offers.find((x) => x.id === choice && !x.pulled);
    if (!o) return { ...result(false, 'That offer is gone.', 'neutral'), close: true };
    e.recruit.commit = o.id;
    e.recruit.history.push({ year: state.year, text: `Verbally committed to ${o.name}.` });
    const text = `You committed to ${o.name}. It is public now, but not binding until you sign.`;
    log(text, 'system', 'good');
    sp.moment(state, { type: 'commit', sportId: d.sportId, text: `Committed to ${o.name}.`, sig: 2 });
    return result(true, text);
  },
  sign(state, d, choice) {
    if (choice === 'no') return result(true, 'You did not sign.', 'neutral');
    const p = state.player;
    const e = sp.entryOf(d.sportId, p.id, state);
    const o = e.recruit.offers.find((x) => x.id === choice && !x.pulled);
    if (!o) return { ...result(false, 'That offer is gone.', 'neutral'), close: true };
    // Eligible as a freshman only with the grades: a non-qualifier goes the junior college route.
    const min = DIVISIONS[o.division].minGpa;
    if ((p.education.gpa ?? 0) < min) {
      const text = `${o.name} cannot take you: a ${DIVISIONS[o.division].name} freshman needs a ${min.toFixed(1)} GPA in core courses, and yours is ${(p.education.gpa ?? 0).toFixed(2)}. Junior college is the way in: two years there, then a four-year program.`;
      o.pulled = state.year;
      log(text, 'system', 'bad');
      return { ...result(false, text, 'bad'), close: true };
    }
    e.recruit.signed = o.id; e.recruit.commit = o.id; o.signed = state.year;
    // The scholarship goes where admissions and fees read it (engine/university.js, engine/admissions.js).
    p.flags.sportOffers = (p.flags.sportOffers ?? []).filter((x) => x.sportId !== d.sportId).concat([{ instId: o.id, name: o.name, fraction: o.fraction, sportId: d.sportId, accepted: true, division: o.division }]);
    p.flags.athlete = { ...(p.flags.athlete ?? { seasons: 0, best: 0, awards: [] }), recruited: { age: p.age, sport: sportOf(d.sportId).name.toLowerCase(), instId: o.id, division: o.division } };
    const text = `You signed with ${o.name} (${DIVISIONS[o.division].name})${o.fraction >= 1 ? ' on a full scholarship' : o.fraction > 0 ? `, ${Math.round(o.fraction * 100)}% of tuition` : ''}. ${o.division === 'JUCO' ? 'Enroll at community college to play there.' : 'Apply there: the coach backs your application.'}`;
    log(text, 'system', 'good');
    milestone(`Signed to play ${sportOf(d.sportId).name.toLowerCase()} at ${o.name}.`, 'education');
    sp.moment(state, { type: 'signed', sportId: d.sportId, text: `Signed with ${o.name}.`, sig: 3 });
    return result(true, text);
  },
};

/** Takes back a verbal commitment. Coaches move on: the offer may not be there to come back to. */
export function decommit(sportId, state) {
  const e = sp.entryOf(sportId, state.player.id, state);
  const R = e?.recruit;
  if (!R?.commit || R.signed) return result(false, R?.signed ? 'You have signed: that is binding.' : 'You are not committed anywhere.', 'neutral');
  const o = R.offers.find((x) => x.id === R.commit);
  R.commit = null;
  if (o && seeded(`decommit/${o.id}/${state.year}`).chance(0.5)) o.pulled = state.year;
  R.history.push({ year: state.year, text: `Decommitted from ${o?.name}.` });
  const text = `You decommitted from ${o?.name}.${o?.pulled ? ' They have moved on to other recruits.' : ' The offer still stands, for now.'}`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}
