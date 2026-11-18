// A college athlete's years (United States and Canada): the class they are in, the eligibility clock (four seasons
// to play in five years: a redshirt year, practicing but not playing, does not use one), the grades that keep them
// eligible, the transfer portal, and name-image-likeness money. The draft reads the record kept here (engine/draft.js).
//
//   e.college = { orgId, division, start, played: [year], redshirt: year|null, out: { year: why }, transfers: [{ year, from, to }],
//                 nil: [{ year, amount }] }
import { log, milestone } from '../state.js';
import { sportOf, DIVISIONS } from '../data/sports.js';
import { catalog } from './university.js';
import { divisionOf } from './recruiting.js';
import * as sp from './sports.js';
import { internals as life, settle } from './sportsLife.js';

const { seeded, overall } = sp.internals;
const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
export const SEASONS = 4;
export const CLOCK = 5;
/** The year in which name-image-likeness money became allowed for college athletes (July 2021). */
export const NIL_FROM = 2021;
/** The year from which Division I programs may pay their athletes directly (2025). */
export const SHARE_FROM = 2025;

/** The college record for the sport the player plays at college, made the first time they play there. */
export function collegeOf(e) { return e?.college ?? null; }
/** Freshman, sophomore, junior, senior, graduate; "redshirt" when they sat a year out. */
export function classOf(state, e) {
  const c = e.college;
  if (!c) return null;
  const year = state.year - c.start - (c.redshirt != null && c.redshirt < state.year ? 1 : 0);
  const name = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'][clampIndex(year)];
  return `${c.redshirt != null && c.redshirt <= state.year ? 'Redshirt ' : ''}${name.toLowerCase()}`.replace(/^./, (x) => x.toUpperCase());
}
const clampIndex = (n) => Math.max(0, Math.min(4, n));
/** Seasons still to play, and years still on the clock. */
export const eligibility = (state, e) => {
  const c = e.college;
  if (!c) return { seasons: SEASONS, years: CLOCK };
  return { seasons: Math.max(0, SEASONS - c.played.length), years: Math.max(0, CLOCK - (state.year - c.start)) };
};

/**
 * Before the season: whether the player may play it. A redshirt freshman sits out; a player whose grades fell below the
 * line, or whose eligibility has run out, does not play. @returns {?string} why they sit out, or null to play
 */
export function beforeSeason(state, a, e) {
  const p = state.player;
  const org = sp.orgOf(e.orgId, state);
  if (!org || org.kind !== 'college') return null;
  const c = (e.college ??= { orgId: org.id, division: org.division ?? 'D1', start: state.year, played: [], redshirt: null, out: {}, transfers: [], nil: [] });
  c.orgId = org.id; c.division = org.division ?? c.division;
  if (c.out[state.year]) return c.out[state.year];
  const el = eligibility(state, e);
  let why = null;
  if (!el.seasons || !el.years) why = 'eligibility';
  else if (c.redshirt === state.year) why = 'redshirt';
  // Grades: last year's (a term's marks decide the next season), under 2.0.
  else if (state.year > c.start && (c.lastGpa ?? p.education.gpa ?? 0) < 2.0 && c.division !== 'JUCO') why = 'grades';
  if (why) {
    c.out[state.year] = why;
    log({ eligibility: `Your college eligibility is used up: four seasons, or five years. ${org.name} goes on without you.`,
      redshirt: `A redshirt year at ${org.name}: every practice, no games, and the season not counted against your four.`,
      grades: `Academically ineligible: a college GPA under 2.0 keeps you out of ${org.name}'s games this season.` }[why], 'system', why === 'redshirt' ? 'neutral' : 'bad');
    if (why === 'eligibility') { e.level = 'club'; sp.internals.leaveOrg(e, state, 'eligibility used up'); }
  }
  return why;
}

/**
 * After the season: a season used if they played; name-image-likeness money; the portal for a player who wants more.
 * @param {object} sum  the season summary (engine/sportsLife.js yearIn)
 */
export function afterSeason(state, a, e, sum) {
  const p = state.player;
  const c = e.college;
  if (!c || sp.orgOf(e.orgId, state)?.id !== c.orgId) return;
  c.lastGpa = p.education.gpa ?? c.lastGpa;
  const played = !c.out[state.year] && (sum.games ?? 0) > 0;
  if (played && !c.played.includes(state.year)) c.played.push(state.year);
  const sport = sportOf(e.id);
  // A freshman may sit the year out and keep the season: decided before the next one (only once).
  if (c.redshirt == null && c.played.length <= 1 && state.year === c.start && sum.role !== 'starter') {
    life.decide(state, { kind: 'redshirt', sportId: e.id, key: `redshirt/${e.id}`, text: `The coaches at ${sp.orgOf(c.orgId, state)?.name} think you could use a redshirt year next season: practice with the team, grow, play no games, and keep all your seasons.`,
      options: [{ id: 'yes', label: 'Take the redshirt year' }, { id: 'no', label: 'Play next season' }] });
  }
  // Name, image and likeness: local businesses and boosters pay players people know (from 2021); from 2025, Division I
  // programs may also pay their athletes a share of what they earn.
  const known = (a.fame ?? 0) + ({ D1: 12, IVY: 2, D2: 3, NAIA: 1, JUCO: 1, D3: 0 }[c.division] ?? 0) + (e.recruit?.stars ?? 0) * 3;
  if (state.year >= NIL_FROM && played && known >= 14) {
    const r = seeded(`nil/${p.id}/${e.id}/${state.year}`);
    const amount = life.money(state, Math.round((known - 10) * 900 * r.normal(1, 0.25)));
    if (amount > 0 && settle(state, `nil/${e.id}/${state.year}`, amount, 'sponsorship', `NIL deals: ${sport.name.toLowerCase()} at ${sp.orgOf(c.orgId, state)?.name}`)) {
      c.nil.push({ year: state.year, amount });
      sp.say(state, `Name, image and likeness deals paid you ${life.fmt(state, amount)} this year.`, 'good', { screen: 'hub', id: 'money' });
    }
  }
  if (state.year >= SHARE_FROM && played && c.division === 'D1' && sum.role === 'starter') {
    const amount = life.money(state, sport.id === 'american_football' || sport.id === 'basketball' ? 60000 : 12000);
    settle(state, `share/${e.id}/${state.year}`, amount, 'salary', `${sp.orgOf(c.orgId, state)?.name}: a share of the program's revenue`);
  }
  // The transfer portal opens after the season for anyone with seasons left who is not starting, or wants a bigger stage.
  const el = eligibility(state, e);
  if (el.seasons > 0 && el.years > 1 && (sum.role !== 'starter' || (overall(e, p) >= 72 && c.division !== 'D1'))) {
    const offers = portalOffers(state, e);
    if (offers.length) life.decide(state, { kind: 'portal', sportId: e.id, key: `portal/${e.id}/${state.year}`, offers,
      text: `The transfer portal is open. ${offers.length === 1 ? 'One program wants' : `${offers.length} programs want`} you to transfer${sum.role !== 'starter' ? ' and play' : ''}. You would play right away, and keep your year of study.`,
      options: [...offers.map((o) => ({ id: o.id, label: `Transfer to ${o.name}`, sub: `${DIVISIONS[o.division].name}${o.fraction ? ` · ${Math.round(o.fraction * 100)}% of tuition` : ''}` })), { id: 'stay', label: 'Stay' }] });
  }
}

/** Programs that would take the player through the portal: a step up for the good, a place to play for the rest. */
function portalOffers(state, e) {
  const p = state.player;
  const o = overall(e, p);
  const here = e.college.division;
  const r = seeded(`portal/${p.id}/${e.id}/${state.year}`);
  const unis = catalog(p.countryId).filter((u) => u.id !== p.education.schoolId && divisionOf(state, u)).map((u) => ({ id: u.id, name: u.name, division: divisionOf(state, u), power: u.kindId === 'research' }));
  const want = unis.filter((u) => (u.division === 'D1' ? (u.power ? o >= 74 : o >= 66) : u.division === 'D2' ? o >= 58 : u.division !== 'IVY'));
  return r.shuffle(want).filter((u) => u.division !== here || o < 70).slice(0, 3).map((u) => ({ ...u, fraction: DIVISIONS[u.division].aid === 'none' ? 0 : DIVISIONS[u.division].aid === 'full' ? 1 : 0.4 }));
}

export const COLLEGE_ANSWERS = {
  redshirt(state, d, choice) {
    const e = sp.entryOf(d.sportId, state.player.id, state);
    if (choice === 'no' || !e?.college) return result(true, 'You will play next season.', 'neutral');
    e.college.redshirt = state.year + 1;
    return result(true, 'Next season is a redshirt year: you practice with the team and keep your four seasons.', 'neutral');
  },
  portal(state, d, choice) {
    if (choice === 'stay') return result(true, 'You stay where you are.', 'neutral');
    const p = state.player;
    const e = sp.entryOf(d.sportId, p.id, state);
    const o = d.offers.find((x) => x.id === choice);
    const u = catalog(p.countryId).find((x) => x.id === choice);
    if (!o || !u || !e?.college) return { ...result(false, 'That program has moved on.', 'neutral'), close: true };
    const from = sp.orgOf(e.college.orgId, state)?.name;
    // Off the old team first (that ends the old scholarship), then onto the new program's.
    sp.internals.leaveOrg(e, state, `transferred to ${u.name}`);
    // A transfer keeps the year of study and the credits; the scholarship is the new program's.
    const ed = p.education;
    ed.schoolId = u.id; ed.schoolName = u.name; ed.tuitionMult = u.tuitionMult ?? ed.tuitionMult;
    ed.aidParts = [...(ed.aidParts ?? []).filter((x) => x.kind !== 'athletic'), ...(o.fraction ? [{ kind: 'athletic', fraction: o.fraction }] : [])];
    ed.aid = Math.min(1, ed.aidParts.reduce((s, x) => s + x.fraction, 0));
    p.flags.sportOffers = (p.flags.sportOffers ?? []).filter((x) => x.sportId !== d.sportId).concat([{ instId: u.id, name: u.name, fraction: o.fraction, sportId: d.sportId, accepted: true, division: o.division }]);
    e.college.transfers.push({ year: state.year, from, to: u.name });
    const text = `You transferred from ${from} to ${u.name} (${DIVISIONS[o.division].name}).`;
    log(text, 'system', 'good');
    milestone(`Transferred to ${u.name} to play ${sportOf(d.sportId).name.toLowerCase()}.`, 'education');
    sp.moment(state, { type: 'transfer', sportId: d.sportId, text: `Transferred to ${u.name}.`, sig: 2 });
    return result(true, text);
  },
};

/** For the draft: years of college played, the division, and how far along the player is. */
export function collegeRecord(state, e) {
  const c = e?.college;
  if (!c) return null;
  return { division: c.division, seasons: c.played.length, years: state.year - c.start + 1, junior: state.year - c.start >= 2 };
}
