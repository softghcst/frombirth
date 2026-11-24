// Baseball's contracts, as the big leagues run them (data/sports.js BASEBALL): free agency with several clubs bidding
// (long deals, opt-outs, no-trade clauses, the qualifying offer), early extensions for young stars, the 40-man roster
// and the three seasons in which a player may be optioned to the minors (after that: designated for assignment,
// waivers, an outright assignment or free agency), the Rule 5 draft of unprotected minor leaguers, and the second
// chances of a released player: independent ball, Japan, Korea.
//
//   contract: optOut (year), noTrade, extended, qo (accepted the qualifying offer), minorDeal
//   e.bb: fortyMan, options: [year], ladder, rule5: { year, fromId, from } | null, exposed: [year], dfa: [{ year, how }]
import { log, milestone } from '../state.js';
import { clamp } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { BASEBALL as B, DRAFTS, draftCountry, sportOf } from '../data/sports.js';
import { clubOf, toMinors } from './draft.js';
import { record, isBaseball, levelOf } from './baseball.js';
import * as sp from './sports.js';
import { internals as life } from './sportsLife.js';

// Looked up when used, not when this module loads: engine/sports.js may still be loading (an import cycle).
const seeded = (...a) => sp.internals.seeded(...a);
const overall = (...a) => sp.internals.overall(...a);
const findOrg = (...a) => sp.internals.findOrg(...a);
const teamFor = (...a) => sp.internals.teamFor(...a);
const leagueFor = (...a) => sp.internals.leagueFor(...a);
const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const usd = (state, v) => life.money(state, v);

/** A club of a country's top league, drawn by `r`. */
export function clubIn(state, country, r) {
  const sport = sportOf('baseball');
  const org = findOrg(state, sport, 'pro', { key: `pro/baseball/${country}/0`, countryId: country, city: COUNTRIES[country].cities[0], tier: 1, strength: 4, div: 'men' });
  const lg = leagueFor(state, org, teamFor(state, org));
  return clubOf(state, r.pick(lg.teamIds));
}
/** The country whose league a free agent is a free agent in: where he last played, or where he would be drafted. */
const marketCountry = (state, e, last) => last?.countryId ?? draftCountry(sportOf(e.id), state.player.countryId) ?? 'us';
const contractOf = (state, e) => (e.contractId ? sp.ensure(state).contracts[e.contractId] : null);
const ladderOf = (e) => e.minor?.ladder ?? record(e).ladder ?? DRAFTS.baseball.minors;

/** The contract goes to another club as it stands (a waiver claim, a Rule 5 pick, a return). */
function reassign(state, e, k, to, why) {
  const p = state.player;
  const pay = p.career.salary;
  life.endContract(state, k, why);
  const res = life.signPro(state, { sportId: e.id, orgId: to.id, orgName: to.name, salary: k.salary, years: Math.max(1, k.to - state.year), level: k.level, how: 'trade' }, { transfer: true, trade: true });
  if (res.ok === false) return null;
  e.minor = null;
  p.career.salary = Math.max(p.career.salary, pay);
  return contractOf(state, e);
}

// ---------- Free agency ----------

/** What clubs offer a free agent: the better and younger, the longer; stars get opt-outs and no-trade clauses. */
export function bids(state, e, country, o = {}) {
  const p = state.player;
  const skill = overall(e, p);
  const r = seeded(`market/${p.id}/${e.id}/${state.year}`);
  const many = clamp(Math.floor((skill - 60) / 6) + 1, 1, 4);
  const list = [];
  const major = country === 'us' || country === 'ca' ? skill >= 70 : true;
  for (let i = 0; i < many * 3 && list.length < many; i++) {
    if (!major && p.age >= 34) break; // nobody gives a minor league contract to a 34-year-old who is not good enough
    const club = clubIn(state, country, r);
    if (club.id === o.notId || list.some((x) => x.orgId === club.id)) continue;
    const off = life.offerFor(state, e, club);
    const years = !major ? 1 : skill >= 82 && p.age <= 31 ? r.int(5, Math.max(5, 12 - Math.max(0, p.age - 27))) : skill >= 74 && p.age <= 33 ? r.int(2, 5) : r.int(1, 2);
    const salary = major ? Math.round(off.salary * r.normal(1, 0.1)) : usd(state, 36000);
    const optOut = major && years >= 5 && skill >= 82 ? state.year + r.int(2, 3) : null;
    list.push({ orgId: club.id, orgName: club.name, salary, years, level: off.level, optOut, noTrade: major && skill >= 84, minorDeal: !major });
  }
  return list;
}
/** Opens the market for a player whose contract has ended (or who has none). @returns {boolean} whether anyone bid */
export function market(state, e, last = null, o = {}) {
  const p = state.player;
  if (!isBaseball(e) || e.contractId || p.age > 40) return false;
  const country = marketCountry(state, e, last);
  const list = bids(state, e, country, { notId: o.qo ? last?.id : null });
  if (!list.length) return false;
  const best = list.reduce((m, x) => (x.salary * x.years > m.salary * m.years ? x : m), list[0]);
  const terms = (x) => (x.minorDeal ? 'a minor league contract, with an invitation to spring training' : `${x.years} ${x.years === 1 ? 'year' : 'years'} at ${life.fmt(state, x.salary)}${x.optOut ? `, opt-out after ${x.optOut}` : ''}${x.noTrade ? ', no-trade clause' : ''}`);
  // A second market in one year (an opt-out or a release after signing) is its own decision; one still open is enough.
  const had = sp.ensure(state).decisions.filter((d) => d.kind === 'freeAgency' && d.sportId === e.id && d.year === state.year);
  if (had.some((d) => d.status === 'open')) return true;
  life.decide(state, { kind: 'freeAgency', sportId: e.id, key: `freeAgency/${e.id}/${state.year}${had.length ? `/${had.length + 1}` : ''}`, offers: list, qo: !!o.qo, from: last?.name ?? null,
    text: `You are a free agent. ${list.length === 1 ? `${best.orgName} offer ${terms(best)}.` : `${list.length} clubs have made offers; the biggest is from ${best.orgName}: ${terms(best)}.`}${o.qo ? ` You turned down the qualifying offer, so ${last.name} get a draft pick if you sign elsewhere.` : ''}`,
    options: [...list.map((x) => ({ id: x.orgId, label: `Sign with ${x.orgName}`, sub: terms(x) })), { id: 'wait', label: 'Wait' }] });
  return true;
}

/** What the old club adds when a contract is up (engine/sportsLife.js contractYear): the qualifying offer, for the best. */
export function qualifying(state, e, k, org) {
  if (!isBaseball(e) || levelOf(org) !== 'MLB' || e.minor || overall(e, state.player) < 78 || k.qo) return null;
  const amount = usd(state, B.qualifyingOffer);
  return { amount, text: ` They have also made the qualifying offer: one year at ${life.fmt(state, amount)}. Turn it down and sign elsewhere, and they are given a draft pick.`,
    option: { id: 'qo', label: 'Accept the qualifying offer', sub: `1 year at ${life.fmt(state, amount)}` } };
}

// ---------- The year under contract ----------

/**
 * Before the year's trades and renewals (engine/sportsLife.js contractYear): the 40-man roster and Rule 5, an opt-out,
 * an extension, options and waivers, and a way back from independent ball.
 * @returns {boolean} whether the contract has changed hands or ended, so the rest of the contract year is skipped
 */
export function contractHook(state, a, e, k) {
  if (!isBaseball(e)) return false;
  const p = state.player;
  const R = record(e);
  const club = sp.orgOf(k.orgId, state);
  if (!club) return false;
  const o = overall(e, p);
  const r = seeded(`bbk/${p.id}/${k.id}/${state.year}`);
  const mlb = ['us', 'ca'].includes(club.countryId) && !club.minorLevel;
  if (e.minor) R.ladder = e.minor.ladder ?? DRAFTS.baseball.minors;
  // Independent ball: a big league organization may buy the contract.
  if (club.minorLevel === 'Independent League') {
    if (o >= 60 && r.chance(0.4)) minorDeal(state, e, r, 'They have been watching you in independent ball.');
    // Independent clubs sign a season at a time, for the same few thousand a month.
    if (state.year >= k.to) { if (p.age > 37) return false; k.to = state.year + 1; return true; }
    return false;
  }
  if (!mlb) return false;
  if (!e.minor) R.fortyMan = true;
  // A minor leaguer whose contract is up, or who has stopped climbing: kept another year, or released.
  if (e.minor) {
    const stalled = state.year > k.from + 1 && ((p.age >= 27 && e.minor.level < ladderOf(e).length - 2) || (p.age >= 31 && o < 68));
    if (stalled || (state.year >= k.to && (o < 58 || p.age > 29))) {
      life.endContract(state, k, 'released');
      sp.say(state, `${club.name} released you. ${p.age >= 27 ? 'They need the roster place for someone younger.' : 'They do not see you getting further.'}`, 'bad', { screen: 'hub', id: 'career' });
      sp.moment(state, { type: 'released', sportId: e.id, text: `Released by ${club.name}.`, sig: 2 });
      e.minor = null;
      freeAgentYear(state, a, e);
      return true;
    }
    if (state.year >= k.to) { k.to = state.year + 1; log(`${club.name} kept you for another year on your minor league contract.`, 'system', 'neutral'); return true; }
  }
  if (rule5(state, e, k, R, o, r, club)) return true;
  // An opt-out: the player may end the contract and go back to the market.
  if (k.optOut === state.year && o >= 80 && p.age <= 34) {
    life.decide(state, { kind: 'optOut', sportId: e.id, contractId: k.id, key: `optOut/${k.id}`,
      text: `Your contract with ${club.name} lets you opt out now: ${k.to - state.year} more ${k.to - state.year === 1 ? 'year' : 'years'} at ${life.fmt(state, k.salary)}, or the open market.`,
      options: [{ id: 'yes', label: 'Opt out, and test the market' }, { id: 'no', label: 'Stay' }] });
  }
  // An extension, early: security now, against what the market might pay later.
  const service = state.year - (e.proYear ?? state.year);
  if (!e.minor && !k.extended && p.age <= 27 && o >= 78 && service >= 2 && state.year < k.to && r.chance(0.35)) {
    const years = r.int(6, 10);
    const salary = Math.round(life.offerFor(state, e, club).salary * 0.72);
    if (salary > k.salary) life.decide(state, { kind: 'extension', sportId: e.id, contractId: k.id, years, salary, key: `extension/${k.id}`,
      text: `${club.name} want to keep you: ${years} years at ${life.fmt(state, salary)} a year, starting now. It is less than a free agent of your kind would get, and it is guaranteed whatever happens to your arm or your swing.`,
      options: [{ id: 'yes', label: 'Sign the extension' }, { id: 'no', label: 'Bet on yourself' }] });
  }
  // Sent down: three option years, then waivers.
  if (!e.minor && o < 70 && (e.lastRating ?? 50) < 40 && state.year > k.from && !R.rule5) return sentDown(state, e, k, R, r, club);
  return false;
}

/** Optioned to Triple-A while options remain; then designated for assignment. */
function sentDown(state, e, k, R, r, club) {
  const p = state.player;
  const ladder = ladderOf(e);
  const top = ladder.length - 1;
  R.options ??= [];
  if (!R.options.includes(state.year) && R.options.length < B.optionYears) {
    R.options.push(state.year);
    toMinors(state, e, club, top, ladder);
    sp.say(state, `${club.name} optioned you to ${ladder[top]}. It is your ${['first', 'second', 'third'][R.options.length - 1]} option year of three.`, 'bad', { screen: 'hub', id: 'career' });
    return false;
  }
  // Out of options: designated for assignment, and seven days on waivers.
  (R.dfa ??= []).push({ year: state.year, how: null });
  const rec = R.dfa.at(-1);
  if (r.chance(0.35)) {
    const to = clubIn(state, club.countryId, r);
    if (to.id !== club.id && reassign(state, e, k, to, `claimed on waivers by ${to.name}`)) {
      rec.how = `claimed by ${to.name}`;
      sp.say(state, `${club.name} designated you for assignment, and ${to.name} claimed you on waivers. Your contract goes with you.`, 'neutral', { screen: 'hub', id: 'career' });
      return true;
    }
  }
  rec.how = 'cleared waivers';
  life.decide(state, { kind: 'outright', sportId: e.id, contractId: k.id, key: `outright/${k.id}/${state.year}`,
    text: `You are out of options, and ${club.name} designated you for assignment. No club claimed you on waivers. You can accept an outright assignment to ${ladder[top]}, on your contract, or become a free agent.`,
    options: [{ id: 'yes', label: `Go to ${ladder[top]}` }, { id: 'no', label: 'Become a free agent' }] });
  void p;
  return false;
}

/** The Rule 5 draft: protected on the 40-man roster, or left where another club can take him. */
function rule5(state, e, k, R, o, r, club) {
  const p = state.player;
  // Taken last year: he had to stay in the big leagues all season. Kept, or offered back.
  if (R.rule5 && R.rule5.year === state.year - 1) {
    const from = sp.orgOf(R.rule5.fromId, state);
    const was = R.rule5;
    R.rule5 = null;
    if (o >= 66 || !from) { sp.say(state, `You lasted the whole season with ${club.name}: you are theirs now.`, 'good', { screen: 'hub', id: 'career' }); return false; }
    if (reassign(state, e, k, from, `offered back to ${from.name}`)) {
      const ladder = ladderOf(e);
      toMinors(state, e, from, clamp(Math.round((o - 52) / 4) - (ladder.length === 6 ? 0 : 1), 1, ladder.length - 1), ladder);
      R.fortyMan = false;
      sp.say(state, `${club.name} could not keep you in the big leagues all season, and had to offer you back to ${was.from}.`, 'neutral', { screen: 'hub', id: 'career' });
      return true;
    }
    return false;
  }
  if (!e.minor || R.fortyMan) return false;
  const signedAt = p.age - (state.year - (e.proYear ?? state.year));
  if (state.year - (e.proYear ?? state.year) < (signedAt <= 18 ? B.rule5.young : B.rule5.older)) return false;
  if (o >= 63) {
    R.fortyMan = true;
    sp.say(state, `${club.name} added you to their 40-man roster, to protect you from the Rule 5 draft.`, 'good', { screen: 'hub', id: 'career' });
    return false;
  }
  (R.exposed ??= []).push(state.year);
  if (o < 57 || !r.chance(0.25)) return false;
  const to = clubIn(state, club.countryId, r);
  if (to.id === club.id) return false;
  const ladder = ladderOf(e);
  if (!reassign(state, e, k, to, `taken by ${to.name} in the Rule 5 draft`)) return false;
  R.ladder = ladder;
  R.rule5 = { year: state.year, fromId: club.id, from: club.name };
  R.fortyMan = true;
  p.career.salary = Math.max(p.career.salary, usd(state, B.minimum));
  milestone(`Taken by ${to.name} in the Rule 5 draft.`, 'career');
  sp.say(state, `${club.name} left you off their 40-man roster, and ${to.name} took you in the Rule 5 draft. They must keep you in the big leagues all next season, or offer you back.`, 'good', { screen: 'hub', id: 'career' });
  sp.moment(state, { type: 'rule5', sportId: e.id, text: `Taken by ${to.name} in the Rule 5 draft.`, sig: 2, orgId: to.id });
  return true;
}

// ---------- Without a club ----------

/** A minor league contract with a big league organization. */
export function minorDeal(state, e, r, why) {
  const club = clubIn(state, 'us', r);
  life.decide(state, { kind: 'minorDeal', sportId: e.id, orgId: club.id, orgName: club.name, key: `minorDeal/${e.id}/${state.year}`,
    text: `${why} ${club.name} offer a minor league contract.`,
    options: [{ id: 'yes', label: 'Sign' }, { id: 'no', label: 'Say no' }] });
}

/**
 * A professional without a contract (engine/sportsLife.js proRoutes): the market if clubs still want him, and if not,
 * the places a released player goes. @returns {boolean} whether baseball has dealt with the year
 */
export function freeAgentYear(state, a, e) {
  const p = state.player;
  if (!isBaseball(e) || !e.proYear || e.contractId || p.age > 40) return false;
  const o = overall(e, p);
  const r = seeded(`fa/${p.id}/${e.id}/${state.year}`);
  if (o >= 62 && r.chance(0.5 + (o - 62) / 30) && market(state, e)) return true;
  if (o < 50 || p.age > 36) return true;
  const sport = sportOf(e.id);
  const opts = [{ id: 'indy', label: 'Independent ball', sub: `${life.fmt(state, usd(state, 15000))} for the season, and a chance to be seen` }];
  const offers = {};
  for (const [c, need, name] of [['jp', 66, 'Japan'], ['kr', 63, 'Korea']]) {
    if (o < need || p.countryId === c || !(sport.draftIn ?? []).includes(c) || !r.chance(0.6)) continue;
    const club = clubIn(state, c, r);
    const off = life.offerFor(state, e, club);
    offers[c] = { orgId: club.id, orgName: club.name, salary: off.salary, level: off.level, years: r.int(1, 2) };
    opts.push({ id: c, label: `${club.name}, in ${name}`, sub: `${offers[c].years} ${offers[c].years === 1 ? 'year' : 'years'} at ${life.fmt(state, off.salary)}` });
  }
  life.decide(state, { kind: 'secondChance', sportId: e.id, key: `secondChance/${e.id}/${state.year}`, offers,
    text: `No big league organization has called. There is independent ball: small parks, long bus rides, a few thousand a month, and scouts who sometimes come.${opts.length > 1 ? ' And there are clubs abroad, where a foreign player is paid well and expected to carry the team.' : ''}`,
    options: [...opts, { id: 'no', label: 'Wait for the phone to ring' }] });
  return true;
}

export const CONTRACT_ANSWERS = {
  freeAgency(state, d, choice) {
    const p = state.player;
    const e = sp.entryOf(d.sportId, p.id, state);
    if (!e || choice === 'wait') return result(true, 'You wait for a better offer.', 'neutral');
    const x = d.offers.find((y) => y.orgId === choice);
    const club = sp.orgOf(x?.orgId, state);
    if (!club) return { ...result(false, 'That club has moved on.', 'neutral'), close: true };
    const res = life.signPro(state, { sportId: e.id, orgId: club.id, orgName: club.name, salary: x.salary, years: x.years, level: x.level, how: 'signing' });
    if (res.ok === false) return res;
    const k = contractOf(state, e);
    if (x.optOut) k.optOut = x.optOut;
    if (x.noTrade) k.noTrade = true;
    if (x.minorDeal) { k.minorDeal = true; const ladder = ladderOf(e); toMinors(state, e, club, clamp(ladder.length - 1 - Math.max(0, Math.round((68 - overall(e, p)) / 4)), 1, ladder.length - 1), ladder); }
    else { e.minor = null; record(e).fortyMan = true; }
    if (d.qo && d.from) log(`${d.from} receive a draft pick for losing you.`, 'system', 'neutral');
    if (x.years >= 5) sp.moment(state, { type: 'signing', sportId: e.id, text: `A ${x.years}-year contract with ${club.name}.`, sig: 3, orgId: club.id });
    return result(true, `You signed with ${club.name}${x.minorDeal ? ', on a minor league contract' : `: ${x.years} ${x.years === 1 ? 'year' : 'years'} at ${life.fmt(state, x.salary)}`}.`);
  },
  optOut(state, d, choice) {
    const e = sp.entryOf(d.sportId, state.player.id, state);
    const k = sp.ensure(state).contracts[d.contractId];
    if (!e || !k || k.status !== 'active') return { ...result(false, 'That has passed.', 'neutral'), close: true };
    if (choice === 'no') { k.optOut = null; return result(true, 'You stay.', 'neutral'); }
    const club = sp.orgOf(k.orgId, state);
    life.endContract(state, k, 'opted out');
    market(state, e, club);
    return result(true, 'You opted out, and are a free agent.', 'neutral');
  },
  extension(state, d, choice) {
    const p = state.player;
    const k = sp.ensure(state).contracts[d.contractId];
    if (!k || k.status !== 'active' || p.career.sportContract !== k.id) return { ...result(false, 'That offer is gone.', 'neutral'), close: true };
    if (choice === 'no') { k.extended = 'declined'; return result(true, 'You will play it out, and see what the market says.', 'neutral'); }
    k.to = state.year + d.years; k.salary = d.salary; k.extended = true;
    p.career.salary = d.salary;
    milestone(`Signed a ${d.years}-year extension with ${k.name}.`, 'career');
    return result(true, `You signed a ${d.years}-year extension with ${k.name} at ${life.fmt(state, d.salary)} a year.`);
  },
  outright(state, d, choice) {
    const p = state.player;
    const e = sp.entryOf(d.sportId, p.id, state);
    const k = sp.ensure(state).contracts[d.contractId];
    if (!e || !k || k.status !== 'active') return { ...result(false, 'That has passed.', 'neutral'), close: true };
    const club = sp.orgOf(k.orgId, state);
    if (choice === 'yes') {
      const ladder = ladderOf(e);
      toMinors(state, e, club, ladder.length - 1, ladder);
      p.career.salary = k.salary; // an outright assignment keeps the contract's pay
      record(e).fortyMan = false;
      return result(true, `You accepted the assignment to ${ladder.at(-1)}.`, 'neutral');
    }
    life.endContract(state, k, 'elected free agency');
    const any = market(state, e, club);
    return result(true, any ? 'You are a free agent.' : 'You are a free agent, and the phone is quiet.', 'neutral');
  },
  minorDeal(state, d, choice) {
    const p = state.player;
    const e = sp.entryOf(d.sportId, p.id, state);
    if (!e || choice === 'no') return result(true, 'You said no.', 'neutral');
    const club = sp.orgOf(d.orgId, state);
    const old = contractOf(state, e);
    if (old) life.endContract(state, old, `contract bought by ${club.name}`);
    const res = life.signPro(state, { sportId: e.id, orgId: club.id, orgName: club.name, salary: usd(state, 36000), years: 2, level: 0, how: 'signing' });
    if (res.ok === false) return res;
    const ladder = ladderOf(e);
    const o = overall(e, p);
    toMinors(state, e, club, clamp(ladder.length - 1 - Math.max(0, Math.round((68 - o) / 4)), 1, ladder.length - 1), ladder);
    contractOf(state, e).minorDeal = true;
    return result(true, `You signed a minor league contract with ${club.name}.`);
  },
  secondChance(state, d, choice) {
    const p = state.player;
    const e = sp.entryOf(d.sportId, p.id, state);
    if (!e || choice === 'no') return result(true, 'You wait.', 'neutral');
    if (choice === 'indy') {
      const sport = sportOf(e.id);
      const r = seeded(`indy/${p.id}/${state.year}`);
      const city = r.pick(COUNTRIES.us.cities);
      const org = findOrg(state, sport, 'pro', { key: `indy/baseball/us/${city}`, countryId: 'us', city, tier: 4, strength: -16, div: 'men',
        name: `${city} ${r.pick(['Ducks', 'Saltdogs', 'RailCats', 'Goldeyes', 'Barnstormers', 'Blue Crabs', 'Boomers', 'Lumberjacks'])}` });
      org.minorLevel = 'Independent League';
      const club = clubOf(state, teamFor(state, org).id);
      const res = life.signPro(state, { sportId: e.id, orgId: club.id, orgName: club.name, salary: usd(state, 15000), years: 1, level: 0, how: 'signing' });
      if (res.ok === false) return res;
      e.minor = null;
      return result(true, `You signed with ${club.name}, in independent ball.`, 'neutral');
    }
    const x = d.offers[choice];
    const club = sp.orgOf(x?.orgId, state);
    if (!club) return { ...result(false, 'That club has moved on.', 'neutral'), close: true };
    const res = life.signPro(state, { sportId: e.id, orgId: club.id, orgName: club.name, salary: x.salary, years: x.years, level: x.level, how: 'signing' });
    if (res.ok === false) return res;
    e.minor = null;
    milestone(`Signed with ${club.name}, in ${COUNTRIES[club.countryId].name}.`, 'career');
    sp.moment(state, { type: 'abroad', sportId: e.id, text: `Went to ${COUNTRIES[club.countryId].name} to play for ${club.name}.`, sig: 2, orgId: club.id });
    return result(true, `You signed with ${club.name}: a new country, and a new league.`);
  },
};
