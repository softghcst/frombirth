// The drafts of the leagues that have one (baseball, American football, basketball and hockey in the United States and
// Canada; data/sports.js DRAFTS), run by each league's own rules: who is eligible and when, declaring early (and
// testing the waters), the combine, an order from the standings with a lottery for the worst teams, rounds, what a
// pick is paid, signing or going (back) to college, and undrafted free agents. Then the minor leagues: a drafted
// baseball player climbs from rookie ball to Triple-A before the majors; hockey has the AHL, basketball the G League,
// football the practice squad.
//
//   e.draft = { history: [{ year, pick, round, teamId, club, signed?, declined? }], declared: year|null, rights: { orgId, until }|null }
//   e.minor = { clubId, level: index in DRAFTS[sport].minors, orgId } while the player is in the minors
//   state.sports.drafts['sport/div/year'] = { sport, year, rounds, size, order: [teamId], lottery: [{ teamId, from, to }],
//     player: { pick, round, teamId } | { undrafted: true } }
//   Everyone else in a draft class is drawn when shown (classPick): a name, a school and a position, from the draft's
//   own luck, so a class costs nothing to keep.
import { log, milestone } from '../state.js';
import { clamp } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { sportOf, DRAFTS, WOMEN_DRAFTS, COUNTRY_DRAFTS, draftCountry } from '../data/sports.js';
import { registerEmployer, employer } from './employers.js';
import { gradeOf, programs } from './recruiting.js';
import { eligibility } from './college.js';
import * as sp from './sports.js';
import { internals as life, settle } from './sportsLife.js';

// Looked up when used, not when this module loads: engine/sports.js may still be loading (an import cycle).
const seeded = (...a) => sp.internals.seeded(...a);
const overall = (...a) => sp.internals.overall(...a);
const findOrg = (...a) => sp.internals.findOrg(...a);
const teamFor = (...a) => sp.internals.teamFor(...a);
const leagueFor = (...a) => sp.internals.leagueFor(...a);
const joinOrg = (...a) => sp.internals.joinOrg(...a);
const rosterNames = (...a) => sp.internals.rosterNames(...a);
const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

/** The draft this player would go into in this sport, if there is one where they live. */
export function draftOf(state, sportId) {
  const p = state.player;
  const sport = sportOf(sportId);
  if (sp.proPath(sport, p.countryId) !== 'draft') return null;
  const women = sp.divOf(p) === 'women';
  const own = COUNTRY_DRAFTS[p.countryId];
  const rules = own ? (women ? null : own[sportId]) : women ? WOMEN_DRAFTS[sportId] : DRAFTS[sportId];
  if (!rules || state.year < sp.proFromFor(sport, p)) return null;
  return { ...rules, sportId, div: women ? 'women' : 'men' };
}

/** The year the player finished high school, if they did. */
function hsYear(state) {
  const p = state.player;
  const d = (p.education.degrees ?? []).find((x) => x.type === 'high');
  if (d) return state.year - (p.age - d.age);
  // No diploma on the record: left high school when college began, or at 18.
  const e = Object.values(state.sports?.athletes?.[p.id]?.sports ?? {}).find((x) => x.college);
  if (e) return e.college.start;
  return p.age > 18 ? state.year - (p.age - 18) : null;
}

/**
 * Whether the player may be drafted this year, by the league's rule, and whether they must declare to be.
 * @returns {{ok:boolean, why:string, declare:boolean}}
 */
export function eligible(state, e, D = draftOf(state, e.id)) {
  const p = state.player;
  if (!D) return { ok: false, why: 'There is no draft here.', declare: false };
  if (e.contractId || e.level === 'pro') return { ok: false, why: 'You are a professional already.', declare: false };
  // Once a professional, always a free agent after: nobody is drafted twice into the league they have played in.
  if (e.proYear) return { ok: false, why: 'You have played professionally: clubs sign you as a free agent.', declare: false };
  if (e.draft?.rights && state.year <= e.draft.rights.until) return { ok: false, why: `${e.draft.rights.club} hold your rights.`, declare: false };
  if (p.age > 27) return { ok: false, why: 'Too old for the draft: clubs sign older players as free agents.', declare: false };
  const g = gradeOf(p);
  const hs = hsYear(state);
  // Football, basketball and hockey seasons run through the winter: the draft after this season is next year's (the
  // spring after a fall season). Baseball is played in the spring and drafts in July, the same year.
  const ahead = ['baseball', 'npb', 'kbo'].includes(D.rule) ? 0 : 1;
  const age = p.age + ahead;
  const since = hs == null ? (g === 12 ? ahead : -1) : state.year + ahead - hs;
  const c = e.college;
  const atCollege = c && sp.orgOf(e.orgId, state)?.kind === 'college';
  const left = atCollege ? eligibility(state, e) : null;
  const underclass = !!(atCollege && left && left.seasons > 0 && left.years > 1);
  const no = (why) => ({ ok: false, why, declare: false });
  switch (D.rule) {
    case 'baseball':
      // Drafted out of high school, did not sign, and went to a four-year college: not again until after junior year, or 21.
      if (!atCollege && g !== 12 && e.draft.history.some((x) => x.pick && !x.signed) && e.recruit?.signed && !e.recruit.signed.startsWith('juco:') && p.age < 21) return no('Going to college: eligible again after your junior year.');
      // High school graduates (seniors this spring) who have not gone to a four-year college; four-year college players
      // after their junior year or at 21; junior college players in any year.
      if (g === 12 || (hs != null && !atCollege)) return { ok: true, why: '', declare: false };
      if (atCollege && c.division === 'JUCO') return { ok: true, why: '', declare: false };
      if (atCollege) return state.year - c.start >= 2 || p.age >= 21 ? { ok: true, why: '', declare: false } : no('Four-year college players are eligible after their junior year, or at 21.');
      return no('Eligible once out of high school.');
    case 'football':
      // Three years out of high school; an underclassman must declare, and gives up college football.
      if (since < 3) return no('Eligible three years after high school.');
      return { ok: true, why: '', declare: underclass };
    case 'basketball':
      // Nineteen in the draft year and a year out of high school; early entrants declare and may withdraw.
      if (age < 19 || since < 1) return no('Eligible at 19, a year out of high school.');
      return { ok: true, why: '', declare: underclass };
    case 'hockey':
      // Eighteen by the draft; first eligible at 18, last at 20. Drafted players often stay in college.
      if (age < 18) return no('Eligible at 18.');
      if (age > 20) return no('Past draft age: a free agent now.');
      return { ok: true, why: '', declare: false };
    case 'npb': {
      // High school and university players file a declaration first; company-team players wait three years after high
      // school, two after university.
      const ed = p.education;
      if (g === 12) return { ok: true, why: '', declare: true };
      if (ed.enrolled && ed.stage === 'university') return (ed.yearInStage ?? 0) >= 3 ? { ok: true, why: '', declare: true } : no('University players are eligible in their fourth year.');
      const uni = [...(ed.degrees ?? [])].reverse().find((x) => x.type === 'university');
      if (uni) return p.age - uni.age >= 2 ? { ok: true, why: '', declare: false } : no('University graduates on company teams are eligible two years on.');
      if (hs == null) return no('Eligible in the last year of high school.');
      return since >= 3 ? { ok: true, why: '', declare: false } : no('High school graduates on company teams are eligible three years on.');
    }
    case 'kbo': {
      // High school seniors and university seniors; anyone else out of school.
      const ed = p.education;
      if (g === 12) return { ok: true, why: '', declare: false };
      if (ed.enrolled && ed.stage === 'university') return (ed.yearInStage ?? 0) >= 3 ? { ok: true, why: '', declare: false } : no('University players are eligible as seniors.');
      return hs != null ? { ok: true, why: '', declare: false } : no('Eligible in the last year of high school.');
    }
    case 'women':
      if (age < 22 && underclass) return no('Eligible at 22, or when college is done.');
      return { ok: true, why: '', declare: atCollege && underclass };
    default: return no('There is no draft here.');
  }
}

/** How the scouts grade the player for the draft: skill, the years still to grow, the season, the level played. */
export function draftGrade(state, e) {
  const p = state.player;
  const o = overall(e, p);
  const youth = Math.max(0, 22 - p.age) * 1.6;
  const form = ((e.lastRating ?? 50) - 50) / 8;
  const level = { D1: 2, IVY: -1, D2: -2, NAIA: -3, JUCO: -1, D3: -5 }[e.college?.division] ?? (e.level === 'academy' || e.level === 'elite' ? 1 : 0);
  const r = seeded(`draftGrade/${p.id}/${e.id}/${state.year}`);
  // Baseball: what a summer with wooden bats showed the scouts (engine/baseball.js).
  return Math.round(o + youth + form + level + (e.draft?.combine?.[state.year] ?? 0) + (e.bb?.wood ?? 0) + r.normal(0, 2));
}
/** Where a grade goes in a draft: the first pick at the top, a thousand down for an ordinary prospect. */
export const projectedPick = (grade) => Math.max(1, Math.round(10 ** ((95 - grade) / 14)));
export const roundOf = (pick, size) => Math.ceil(pick / size);

/** The league the draft is for: the country's top professional league in the sport, with all its clubs. */
function topLeague(state, sport) {
  const via = draftCountry(sport, state.player.countryId);
  // Drafted into another country's league (Puerto Rico's baseball players, into the big leagues).
  const org = via && via !== state.player.countryId
    ? findOrg(state, sport, 'pro', { key: `pro/${sport.id}/${via}/0`, countryId: via, city: COUNTRIES[via].cities[0], tier: 1, strength: 4, div: 'men' })
    : life.proClub(state, sport, 0, 1);
  return leagueFor(state, org, teamFor(state, org));
}

/** A club in the draft league, for a free agent. */
export function leagueClub(state, sport, r) {
  const lg = topLeague(state, sport);
  return lg?.teamIds.length ? clubOf(state, r.pick(lg.teamIds)) : null;
}

/** The order: the worst record first, a lottery among the worst for the first picks, and the champion last. */
function order(state, lg, D, key) {
  const S = sp.ensure(state);
  const last = Object.values(S.seasons).filter((s) => s.leagueId === lg.id).sort((a, b) => b.year - a.year)[0];
  const r = seeded(`order/${key}`);
  let base = last ? sp.standings(last).map((x) => x.teamId).reverse() : r.shuffle([...lg.teamIds]);
  if (last?.champion) base = [...base.filter((t) => t !== last.champion), last.champion];
  const lottery = [];
  if (D.lottery) {
    // The worse the record, the better the odds; the rest keep their places behind the winners.
    const pool = base.slice(0, D.lottery.teams);
    const won = [];
    for (let i = 0; i < D.lottery.picks && pool.length; i++) {
      const w = pool.map((t) => D.lottery.teams - base.indexOf(t));
      let roll = r.next() * w.reduce((x, y) => x + y, 0);
      let j = 0;
      while (j < pool.length - 1 && (roll -= w[j]) >= 0) j++;
      won.push(pool[j]); pool.splice(j, 1);
    }
    for (const [i, t] of won.entries()) lottery.push({ teamId: t, from: base.indexOf(t) + 1, to: i + 1 });
    base = [...won, ...base.filter((t) => !won.includes(t))];
  }
  return { order: base, lottery };
}

/** A professional club in the draft league: an employer too, so a contract with it is a job. */
export function clubOf(state, teamId) {
  const t = sp.teamOf(teamId, state);
  const org = sp.orgOf(t?.orgId, state);
  if (org && (!org.employerId || !employer(org.employerId))) {
    const e = registerEmployer({ name: org.name, family: 'sport', tracks: ['athlete', 'coaching'], countryId: org.countryId, city: org.city });
    e.owned = false; e.sportClub = org.id; e.size = 'large';
    org.employerId = e.id;
  }
  return org;
}

/** Someone else in a draft class, drawn when needed: the same every time it is shown. */
export function classPick(state, d, n) {
  const sport = sportOf(d.sport);
  const r = seeded(`class/${d.sport}/${d.div}/${d.year}/${n}`);
  const via = draftCountry(sport, state.player.countryId) ?? state.player.countryId;
  const [name] = rosterNames(r, via, 1, d.div === 'women' ? 'female' : 'male');
  const progs = programs(state, sport);
  const school = r.chance(d.sport === 'baseball' ? 0.35 : d.sport === 'ice_hockey' ? 0.5 : 0.05) ? `${r.pick(COUNTRIES[via].cities)} ${d.sport === 'ice_hockey' ? 'Juniors' : 'High School'}` : (progs.length ? r.pick(progs).name : '');
  return { name, school, pos: r.pick(sport.positions ?? [[null, '']])[1] };
}

/** What a pick is paid: a slot bonus in baseball, a rookie scale in football and basketball, an entry-level deal in hockey. */
function dealFor(state, D, pick, size) {
  const m = (v) => life.money(state, Math.round(v));
  // Japan: a signing bonus of up to ¥100 million and a first salary of up to ¥16 million; Korea: up to ₩500 million.
  if (D.deal === 'npb') return { bonus: m(30000 + 670000 * Math.exp(-(pick - 1) / 14)), salary: m(pick <= size ? 110000 : 55000), years: D.years };
  if (D.deal === 'kbo') return { bonus: m(20000 + 350000 * Math.exp(-(pick - 1) / 10)), salary: m(23000), years: D.years };
  if (D.deal === 'bonus') return { bonus: m(125000 + 10400000 * Math.exp(-(pick - 1) / 30)), salary: m(32000), years: D.years };
  if (D.deal === 'entry') return { bonus: m(pick <= size ? 92000 : 30000), salary: m(950000), years: D.years };
  if (D.sportId === 'basketball') {
    if (D.div === 'women') return { bonus: 0, salary: m(pick <= 4 ? 78000 : 67000), years: D.years };
    return pick <= size ? { bonus: 0, salary: m(2600000 + 10500000 * Math.exp(-(pick - 1) / 9)), years: D.years } : { bonus: 0, salary: m(580000), years: 2, twoWay: true };
  }
  return { bonus: m(pick <= size * 2 ? 1000000 * Math.exp(-(pick - 1) / 25) * 8 : 60000), salary: m(900000 + 9500000 * Math.exp(-(pick - 1) / 18)), years: D.years };
}

/**
 * The player's draft year, after their season (engine/sportsLife.js yearIn): into this year's draft if they are
 * eligible without declaring; a decision to declare if they must; nothing if they are not eligible.
 */
export function draftYear(state, a, e) {
  const D = draftOf(state, e.id);
  if (!D || e.contractId) return;
  e.draft ??= { history: [], declared: null, rights: null, combine: {} };
  if (e.draft.history.some((x) => x.year === state.year)) return;
  // Hockey: a drafted player in college stays there while the club holds their rights, then signs or becomes free.
  if (e.draft.rights) {
    if (state.year > e.draft.rights.until) { log(`${e.draft.rights.club} let your rights lapse. You are free to sign with anyone.`, 'system', 'neutral'); e.draft.rights = null; }
    else if (!e.college || !sp.orgOf(e.orgId, state) || sp.orgOf(e.orgId, state).kind !== 'college' || eligibility(state, e).seasons === 0) offerEntry(state, e, D);
    return;
  }
  const el = eligible(state, e, D);
  const p = state.player;
  if (!el.ok) return;
  const grade = draftGrade(state, e);
  const projected = projectedPick(grade);
  const size = topLeague(state, sportOf(e.id), D.div).teamIds.length;
  const total = D.rounds * size;
  // Nobody with no chance of being picked is asked to declare, or put through a draft.
  if (projected > total * 1.6 && !(gradeOf(p) === 12 && D.rule === 'baseball' && projected <= total * 2)) return;
  if (el.declare && D.rule === 'npb') {
    life.decide(state, { kind: 'declare', sportId: e.id, key: `declare/${e.id}/${state.year}`, text: `The draft is in October. No club may name a ${gradeOf(p) === 12 ? 'high school' : 'university'} player who has not filed a declaration that he wants to turn professional. ${projected <= total ? `Scouts expect you to go in the ${ordinal(roundOf(projected, size))} round.` : 'Scouts are not sure anyone will pick you.'}`,
      options: [{ id: 'yes', label: 'File the declaration' }, { id: 'no', label: gradeOf(p) === 12 ? 'Not yet: university or a company team first' : 'Not this year' }] });
    return;
  }
  if (el.declare) {
    const where = projected <= total ? `Mock drafts have you in the ${ordinal(roundOf(projected, size))} round, around pick ${projected}.` : 'Mock drafts do not have you being picked.';
    life.decide(state, { kind: 'declare', sportId: e.id, key: `declare/${e.id}/${state.year}`, text: `The ${sportOf(e.id).name.toLowerCase()} draft is coming. You can declare and leave college early, or go back for another season. ${where}${D.test ? ' You can also test the waters: go to the combine, hear what teams think, and withdraw in time to go back.' : ' Declaring ends your college career.'}`,
      options: [{ id: 'yes', label: 'Declare for the draft' }, ...(D.test ? [{ id: 'test', label: 'Test the waters' }] : []), { id: 'no', label: 'Go back to college' }] });
    return;
  }
  hold(state, e, D);
}

/** The combine: measured, timed and interviewed. Stock moves with it. */
function combine(state, e, D) {
  if (!D.combine) return 0;
  const p = state.player;
  const r = seeded(`combine/${p.id}/${e.id}/${state.year}`);
  const fit = (p.stats.health - 70) / 10 + ((e.skills.speed ?? e.skills.running ?? e.skills.skating ?? e.skills.athleticism ?? overall(e, p)) - 65) / 12;
  const delta = Math.round(clamp(r.normal(fit, 2.2), -5, 5));
  (e.draft.combine ??= {})[state.year] = delta;
  log(`At the ${D.sportId === 'baseball' ? 'draft combine' : 'combine'}: ${delta >= 2 ? 'you tested among the best there, and teams noticed' : delta <= -2 ? 'the numbers were not kind, and some teams cooled' : 'nothing that changed many minds'}.`, 'system', delta >= 2 ? 'good' : delta <= -2 ? 'bad' : 'neutral');
  return delta;
}

/** The draft itself: the order, the lottery, and where the player goes (or does not). */
export function hold(state, e, D = draftOf(state, e.id)) {
  const S = sp.ensure(state);
  const p = state.player;
  const sport = sportOf(e.id);
  const key = `${e.id}/${D.div}/${state.year}`;
  S.drafts ??= {};
  if (S.drafts[key]?.player) return S.drafts[key];
  combine(state, e, D);
  const lg = topLeague(state, sport, D.div);
  const size = lg.teamIds.length;
  const total = D.rounds * size;
  const { order: ord, lottery } = order(state, lg, D, key);
  const r = seeded(`draft/${key}/${p.id}`);
  const pick = Math.max(1, Math.round(projectedPick(draftGrade(state, e)) * r.normal(1, 0.18)));
  const d = { sport: e.id, div: D.div, year: state.year, rounds: D.rounds, size, order: ord, lottery, leagueId: lg.id };
  S.drafts[key] = d;
  const name = `${state.year} ${sport.name} Draft`;
  if (pick > total) {
    d.player = { undrafted: true };
    e.draft.history.push({ year: state.year, undrafted: true });
    sp.say(state, `The ${name} came and went without your name being called.`, 'bad', { screen: 'hub', id: 'career' });
    undrafted(state, e, D);
    return d;
  }
  const round = roundOf(pick, size);
  let teamId = ord[(pick - 1) % size];
  // Japan's first round: every club names its player at once; where several name the same one, lots are drawn.
  if (D.bids && round === 1) {
    const many = pick <= 2 ? r.int(2, 5) : pick <= 5 ? r.int(1, 3) : 1;
    if (many > 1) {
      const clubs = r.shuffle([...ord]).slice(0, many);
      teamId = r.pick(clubs);
      d.bids = { teams: clubs, winner: teamId };
      sp.say(state, `${many} clubs named you with their first pick. Lots were drawn, and ${sp.teamOf(teamId, state)?.name} drew the winning one.`, 'good', { screen: 'hub', id: 'career' });
    }
  }
  const club = clubOf(state, teamId);
  d.player = { pick, round, teamId };
  e.draft.history.push({ year: state.year, pick, round, teamId, club: club.name });
  milestone(`Drafted by ${club.name}: round ${round}, pick ${pick}, ${name}.`, 'career');
  sp.moment(state, { type: 'drafted', sportId: e.id, text: `Drafted by ${club.name}, round ${round}, pick ${pick}.`, sig: 3, orgId: club.id });
  sp.say(state, `${name}, round ${round}: with the ${ordinal(pick)} pick, ${club.name} select you.${pick === 1 ? ' The first pick of the draft.' : ''}`, 'good', { screen: 'hub', id: 'career' });
  const deal = dealFor(state, { ...D, sportId: e.id }, pick, size);
  // An adviser knows what the pick is worth, and gets a tenth more out of the club (engine/baseball.js).
  if (e.bb?.adviser && deal.bonus) { deal.bonus = Math.round(deal.bonus * 1.1 / 1000) * 1000; deal.adviser = true; }
  const g = gradeOf(p);
  const atCollege = e.college && sp.orgOf(e.orgId, state)?.kind === 'college' && eligibility(state, e).seasons > 0 && !e.draft.declared;
  const committed = !!e.recruit?.signed && !e.college;
  const asia = ['npb', 'kbo'].includes(D.rule);
  const stay = asia ? (g === 12 ? 'Turn it down: university or a company team' : 'Turn it down') : D.rule === 'baseball' && (g === 12 || atCollege || committed) ? (atCollege ? 'Go back to college' : 'Go to college instead') : D.rule === 'hockey' && (atCollege || committed) ? 'Play in college; they keep your rights' : null;
  const ready = overall(e, p) >= (asia ? 66 : { baseball: 76, ice_hockey: 70, basketball: 64, american_football: 60 }[e.id] ?? 60);
  if (asia) d.name = `${D.name} draft`;
  life.decide(state, { kind: 'draftSign', sportId: e.id, key: `draftSign/${key}`, orgId: club.id, orgName: club.name, pick, round, deal, how: 'draft',
    text: `${club.name} drafted you in the ${ordinal(round)} round, ${ordinal(pick)} overall. ${deal.bonus ? `They offer a signing bonus of ${life.fmt(state, deal.bonus)}` : 'They offer'}${deal.twoWay ? ' a two-way contract: their G League team, and the big club when they call you up' : `${deal.bonus ? ' and' : ''} ${deal.years} ${deal.years === 1 ? 'year' : 'years'} at ${life.fmt(state, deal.salary)} a year`}${D.minors.length && D.deal !== 'scale' && !ready ? `, starting in the ${D.minors[0] === 'AHL' ? 'AHL' : D.minors[0] === 'Farm team' ? 'farm team' : D.minors[0] === 'Futures League' ? 'Futures League' : 'minor leagues'}` : ''}.`,
    options: [{ id: 'sign', label: 'Sign' }, ...(stay ? [{ id: 'stay', label: stay }] : [])] });
  return d;
}

/** Undrafted: where the sport takes them anyway. */
function undrafted(state, e, D) {
  const p = state.player;
  const o = overall(e, p);
  const r = seeded(`udfa/${p.id}/${e.id}/${state.year}`);
  if (o < 58 || D.rule === 'hockey') return;
  const lg = topLeague(state, sportOf(e.id), D.div);
  const club = clubOf(state, r.pick(lg.teamIds));
  const asia = ['npb', 'kbo'].includes(D.rule);
  const deal = asia ? { bonus: life.money(state, r.int(2, 6) * 5000), salary: life.money(state, D.rule === 'npb' ? 28000 : 22000), years: 3, development: true }
    : D.sportId === 'basketball' || e.id === 'basketball' ? { bonus: 0, salary: life.money(state, 40000), years: 1, gLeague: true }
    : e.id === 'baseball' ? { bonus: life.money(state, Math.round(r.int(1, 15) * 10000)), salary: life.money(state, 30000), years: 6 }
      : { bonus: life.money(state, r.int(1, 25) * 1000), salary: life.money(state, 900000), years: 3 };
  life.decide(state, { kind: 'draftSign', sportId: e.id, key: `udfa/${e.id}/${state.year}`, orgId: club.id, orgName: club.name, pick: null, round: null, deal, how: 'undrafted',
    text: `Undrafted, but ${club.name} want you anyway: ${deal.development ? (D.rule === 'npb' ? 'a development contract, a three-digit number on your back and the farm team, until they register you' : 'a contract as a development player, in the Futures League') : deal.gLeague ? 'a place on their G League team, a step from the big club' : `${deal.bonus ? `a ${life.fmt(state, deal.bonus)} signing bonus and ` : ''}a chance to make the team${e.id === 'baseball' ? ' in their minor leagues' : ''}`}.`,
    options: [{ id: 'sign', label: 'Sign as an undrafted free agent' }, { id: 'no', label: 'Say no' }] });
}

/** Hockey: the club that holds the player's rights offers an entry-level contract when college is over. */
function offerEntry(state, e, D) {
  const org = sp.orgOf(e.draft.rights.orgId, state);
  if (!org) return;
  const deal = dealFor(state, { ...D, sportId: e.id }, e.draft.rights.pick ?? 100, 32);
  life.decide(state, { kind: 'draftSign', sportId: e.id, key: `entry/${e.id}/${state.year}`, orgId: org.id, orgName: org.name, pick: e.draft.rights.pick, round: null, deal, how: 'rights',
    text: `${org.name}, who hold your rights, offer an entry-level contract: ${deal.years} years at ${life.fmt(state, deal.salary)}.`,
    options: [{ id: 'sign', label: 'Sign' }, { id: 'no', label: 'Wait' }] });
}

/** Signing: the bonus, the contract, and where the player starts (the minors, or the big club). */
function sign(state, d, e) {
  const p = state.player;
  const D = draftOf(state, e.id);
  const org = sp.orgOf(d.orgId, state);
  if (!org) return { ...result(false, 'That club is gone.', 'neutral'), close: true };
  clubOf(state, sp.teamOf(org.teamIds[0], state)?.id ?? null);
  if (d.deal.bonus) settle(state, `bonus/${e.id}/${state.year}/${org.id}`, d.deal.bonus, 'sponsorship', `Signing bonus: ${org.name}`, 'action');
  if (d.deal.bonus && d.deal.adviser) settle(state, `adviser/${e.id}/${state.year}`, -Math.round(d.deal.bonus * 0.04), 'fees', 'Your adviser\'s 4% of the bonus', 'action');
  e.draft.declared = null; e.draft.rights = null;
  const last = e.draft.history.find((x) => x.year === state.year && x.teamId); if (last) last.signed = true;
  const o = overall(e, p);
  const level = o >= 86 ? 3 : o >= 76 ? 2 : o >= 66 ? 1 : 0;
  const r = life.signPro(state, { sportId: e.id, orgId: org.id, orgName: org.name, salary: d.deal.salary, years: d.deal.years, level, how: d.how === 'undrafted' ? 'signing' : 'draft' });
  if (r.ok === false) return r;
  // Straight to the big club: paid at least its minimum, not a minor league wage.
  const major = D?.rule === 'npb' ? 110000 : D?.rule === 'kbo' ? 23000 : { baseball: 760000, ice_hockey: 950000, basketball: 1200000, american_football: 900000 }[e.id];
  if (major && !d.deal.twoWay && !d.deal.gLeague && !d.deal.development) p.career.salary = Math.max(p.career.salary, life.money(state, major));
  // Where they start: baseball's draftees in the minors, by age and skill; a hockey prospect in the AHL unless ready; a
  // basketball two-way or undrafted player in the G League; a football player who is not ready on the practice squad.
  const ladder = D?.minors ?? [];
  const ready = ['npb', 'kbo'].includes(D?.rule) ? 66 : { baseball: 76, ice_hockey: 70, basketball: 64, american_football: 60 }[e.id] ?? 60;
  if (ladder.length && (o < ready || d.deal.twoWay || d.deal.gLeague || d.deal.development)) {
    // Straight from high school: rookie ball, or Single-A for the best. From college: Single-A to Double-A, by how good.
    const start = e.id === 'baseball' ? (p.age < 19 ? (o >= 74 ? 1 : 0) : clamp(Math.round((o - 60) / 5), 1, 3)) : 0;
    toMinors(state, e, org, Math.min(start, ladder.length - 1));
  }
  return result(true, `You signed with ${org.name}.${e.minor ? ` You start in ${['Practice squad', 'Farm team'].includes(ladder[e.minor.level]) ? `the ${ladder[e.minor.level].toLowerCase()}` : ladder[e.minor.level]}.` : ''}`);
}

/**
 * Sends the player to a level of the club's minor league system (its own team, in its own league). The ladder is the
 * draft's (data/sports.js DRAFTS minors), or the one an international signing starts on (engine/international.js).
 */
export function toMinors(state, e, club, level, ladder = e.minor?.ladder ?? draftOf(state, e.id)?.minors) {
  const p = state.player;
  const name = ladder[level];
  const sport = sportOf(e.id);
  // The Dominican Summer League is played at the clubs' academies in the Dominican Republic; the rest where the club is.
  const where = name === 'Dominican Summer League' ? 'do' : club.countryId;
  const r = seeded(`affiliate/${club.id}/${name}`);
  const city = r.pick(COUNTRIES[where].cities ?? [club.city]);
  const nick = r.pick(['Bees', 'Mudcats', 'Rivercats', 'Sand Gnats', 'Firebirds', 'Hops', 'Trash Pandas', 'IronPigs', 'Storm Chasers', 'Flying Squirrels', 'Wranglers', 'Admirals']);
  const org = findOrg(state, sport, 'pro', { key: `minor/${club.id}/${name}`, countryId: where, city,
    name: name === 'Practice squad' ? `${club.name} practice squad` : name === 'Farm team' ? `${club.name} (farm)` : name === 'Futures League' ? `${club.name} Futures` : name === 'Dominican Summer League' ? `DSL ${club.name.split(' ').slice(-1)[0]}` : `${city} ${nick}`,
    tier: 2 + level, strength: -6 - (ladder.length - 1 - level) * 4 });
  org.minorLevel = name; org.parentId = club.id;
  e.minor = { clubId: club.id, level, orgId: org.id, ...(ladder !== draftOf(state, e.id)?.minors ? { ladder } : {}) };
  joinOrg(org, state);
  p.career.salary = life.money(state, { 'Farm team': 40000, 'Futures League': 22000, 'Dominican Summer League': 7000, 'Rookie ball': 26000, 'Single-A': 28000, 'High-A': 30000, 'Double-A': 35000, 'Triple-A': 46000, AHL: 90000, 'G League': 40000, 'Practice squad': 230000 }[name] ?? 30000);
  log(`${club.name} sent you to ${name === 'Practice squad' ? 'their practice squad' : name === 'Farm team' ? 'their farm team' : `${org.name} (${name})`}.`, 'system', 'neutral');
}

/**
 * The minors, after each season: up a level for a player who is better than it, called up to the big club when ready,
 * down again if they fall back. @param {object} sum the season (engine/sportsLife.js yearIn)
 */
export function minorsYear(state, a, e, sum) {
  const m = e.minor;
  if (!m || !e.contractId || e.asia?.service) return;
  const p = state.player;
  const ladder = m.ladder ?? draftOf(state, e.id)?.minors;
  if (!ladder) return;
  const club = sp.orgOf(m.clubId, state);
  const o = overall(e, p);
  const ready = ['Farm team', 'Futures League'].includes(ladder[0]) ? 66 : { baseball: 74, ice_hockey: 71, basketball: 66, american_football: 62 }[e.id] ?? 62;
  // What each level asks: the same names ask the same, whether or not the ladder starts in the Dominican Summer League.
  const climb = (lvl) => 52 + (lvl + (ladder[0] === 'Dominican Summer League' ? 0 : 1)) * 4;
  if (o >= ready && (m.level === ladder.length - 1 || o >= ready + 4) && (sum.rating ?? 6) >= 6.2) {
    e.minor = null;
    joinOrg(club, state);
    const asia = { 'Farm team': 110000, 'Futures League': 23000 }[ladder[0]];
    p.career.salary = Math.max(p.career.salary, life.money(state, asia ?? { baseball: 760000, ice_hockey: 950000, basketball: 1200000, american_football: 900000 }[e.id] ?? 800000));
    const text = `Called up: ${club.name} want you with the big club.`;
    sp.say(state, text, 'good', { screen: 'hub', id: 'career' });
    milestone(`Called up to ${club.name}.`, 'career');
    sp.moment(state, { type: 'callup', sportId: e.id, text: `Called up to ${club.name}.`, sig: 3, orgId: club.id });
    return;
  }
  // Up a level for a player who is good enough for it and playing well, or plainly too good for where he is.
  if (m.level < ladder.length - 1 && o >= climb(m.level + 1) && ((sum.rating ?? 6) >= 6.4 || o >= climb(m.level + 1) + 2)) {
    toMinors(state, e, club, m.level + 1);
    sp.moment(state, { type: 'promoted', sportId: e.id, text: `Promoted to ${ladder[e.minor.level]}.`, sig: 2 });
  } else if (m.level > 0 && o < climb(m.level) - 6 && (sum.rating ?? 6) < 5.8) {
    toMinors(state, e, club, m.level - 1);
  }
}

export const DRAFT_ANSWERS = {
  declare(state, d, choice) {
    const e = sp.entryOf(d.sportId, state.player.id, state);
    const D = draftOf(state, d.sportId);
    if (!e || !D) return { ...result(false, 'There is no draft now.', 'neutral'), close: true };
    if (choice === 'no') return result(true, 'You go back to college for another season.', 'neutral');
    if (choice === 'test') {
      const delta = combine(state, e, D);
      const projected = projectedPick(draftGrade(state, e));
      const size = topLeague(state, sportOf(e.id), D.div).teamIds.length;
      life.decide(state, { kind: 'withdraw', sportId: e.id, key: `withdraw/${e.id}/${state.year}`, text: `Teams have had their look${delta >= 2 ? ', and liked it' : delta <= -2 ? ', and some are cooler on you' : ''}. ${projected <= D.rounds * size ? `They see you going around pick ${projected}.` : 'Most do not see you being picked.'} Stay in the draft, or withdraw before the deadline and go back to college?`,
        options: [{ id: 'stay', label: 'Stay in the draft' }, { id: 'withdraw', label: 'Withdraw and go back' }] });
      return result(true, 'You are testing the waters: the combine, and what teams think.', 'neutral');
    }
    e.draft.declared = state.year;
    leaveCollege(state, e);
    hold(state, e, D);
    return result(true, 'You declared for the draft.', 'good');
  },
  withdraw(state, d, choice) {
    const e = sp.entryOf(d.sportId, state.player.id, state);
    const D = draftOf(state, d.sportId);
    if (choice === 'withdraw') return result(true, 'You withdrew in time, and go back to college.', 'neutral');
    e.draft.declared = state.year;
    leaveCollege(state, e);
    hold(state, e, D);
    return result(true, 'You stayed in the draft.', 'good');
  },
  draftSign(state, d, choice) {
    const e = sp.entryOf(d.sportId, state.player.id, state);
    if (!e) return { ...result(false, 'That has passed.', 'neutral'), close: true };
    if (choice === 'sign') return sign(state, d, e);
    if (choice === 'stay' && d.how === 'draft' && draftOf(state, d.sportId)?.rule === 'hockey') {
      e.draft.rights = { orgId: d.orgId, club: d.orgName, until: state.year + (draftOf(state, d.sportId).rights ?? 4), pick: d.pick };
      return result(true, `${d.orgName} hold your rights while you play in college.`, 'neutral');
    }
    return result(true, d.how === 'draft' ? 'You did not sign. You can be drafted again when you are next eligible.' : 'You said no.', 'neutral');
  },
};
/** Declaring early ends a college career (the athletic scholarship with it). */
function leaveCollege(state, e) {
  const org = sp.orgOf(e.orgId, state);
  if (org?.kind === 'college') { sp.internals.leaveOrg(e, state, 'declared for the draft'); e.college.out[state.year + 1] = 'declared'; }
}

/** The pick-by-pick record of a draft, for My Athletics: every pick of the first round, and the player's own. */
export function draftBoard(state, d, rounds = 1) {
  const out = [];
  const max = Math.min(d.rounds, rounds) * d.size;
  for (let n = 1; n <= max; n++) {
    const teamId = d.order[(n - 1) % d.size];
    const mine = d.player?.pick === n;
    out.push({ pick: n, round: roundOf(n, d.size), team: sp.teamOf(teamId, state)?.name ?? '', ...(mine ? { name: 'You', mine: true } : classPick(state, d, n)) });
  }
  if (d.player?.pick > max) out.push({ pick: d.player.pick, round: d.player.round, team: sp.teamOf(d.player.teamId, state)?.name ?? '', name: 'You', mine: true });
  return out;
}
