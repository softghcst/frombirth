// International amateur signings: how a boy from the Dominican Republic, Venezuela or anywhere outside the draft
// countries becomes a professional baseball player (data/sports.js INTL_SIGNING). At 12 to 14 a trainer may take him
// into his program (full time, which in practice means leaving school, or around school); clubs' scouts watch the
// program's showcases and agree handshake deals years ahead, which bind no one and sometimes fall through; on January 15
// after he turns 16 he may sign, for a bonus out of the club's pool, of which the trainer takes his share. Then the
// club's academy in the Dominican Republic and the Dominican Summer League, and the minors in the United States
// (engine/draft.js toMinors and minorsYear). A Cuban player must first leave Cuba.
//
//   e.intl = { trainer: { npcId, name, cut, fullTime, since } | null, declined: n, deal: { teamId, club, amount, year, expected } | null,
//              fellThrough: [{ year, club, why }], signed: { year, orgId, club, bonus, toTrainer } | null, left: year | null }
import { log, milestone } from '../state.js';
import { clamp } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { sportOf, INTL_SIGNING as I } from '../data/sports.js';
import { makeNpc } from './npcFactory.js';
import { canDropOut, dropOut } from './education.js';
import { clubOf, toMinors } from './draft.js';
import * as sp from './sports.js';
import { internals as life, settle } from './sportsLife.js';

// Looked up when used, not when this module loads: engine/sports.js may still be loading (an import cycle).
const seeded = (...a) => sp.internals.seeded(...a);
const overall = (...a) => sp.internals.overall(...a);
const findOrg = (...a) => sp.internals.findOrg(...a);
const teamFor = (...a) => sp.internals.teamFor(...a);
const leagueFor = (...a) => sp.internals.leagueFor(...a);
const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const cubaRule = (p) => p.countryId === 'cu';

/** Whether the player's way into professional baseball is an international signing. */
export function intlPath(state, sportId) {
  const p = state.player;
  return I.sports.includes(sportId) && I.countries.includes(p.countryId) && sp.divOf(p) !== 'women' && state.year >= I.from;
}

/** The big league, all its clubs (in the United States); a club in it by number. */
function bigLeague(state) {
  const sport = sportOf('baseball');
  const cities = COUNTRIES.us.cities;
  const org = findOrg(state, sport, 'pro', { key: 'pro/baseball/us/0', countryId: 'us', city: cities[0], tier: 1, strength: 4, div: 'men' });
  return leagueFor(state, org, teamFor(state, org));
}
export function clubAt(state, n) {
  const lg = bigLeague(state);
  return clubOf(state, lg.teamIds[n % lg.teamIds.length]);
}

/** Where a player of this skill would sign at 16, and for how much; older players are signed for far less. */
export function bonusFor(state, o, age) {
  if (o < 50) return 0;
  const usd = clamp(10000 * Math.exp((o - 50) * 0.38), 10000, I.pool[1]) * (age <= 16 ? 1 : age <= 18 ? 0.35 : 0.15);
  return life.money(state, Math.round(usd / 1000) * 1000);
}
/** The club's bonus pool this year: no one signs for more than the whole of it. */
const poolOf = (state, teamId) => life.money(state, seeded(`pool/${teamId}/${state.year}`).int(I.pool[0] / 1000, I.pool[1] / 1000) * 1000);
/** How good the player looks like being at 16, from where they are now. */
const projected = (o, age) => Math.round(o + Math.max(0, 16 - age) * 3.2);

/** The player's year, after their season (engine/sportsLife.js yearIn). */
export function intlYear(state, a, e) {
  const p = state.player;
  if (!intlPath(state, e.id)) return;
  const X = (e.intl ??= { trainer: null, declined: 0, deal: null, fellThrough: [], signed: null, left: null });
  // Signed already; or under contract, except a Cuban player at home, whose club there does not stop him leaving.
  if (X.signed || (e.contractId && !(cubaRule(p) && !X.left))) return;
  const o = overall(e, p);
  const r = seeded(`intl/${p.id}/${e.id}/${state.year}`);
  // The trainer's program: years of baseball all day, and the school work that goes with it, or does not.
  if (X.trainer && p.age <= 17) {
    for (const k of Object.keys(e.skills)) e.skills[k] = Math.round(Math.min(e.ceiling[k], e.skills[k] + (X.trainer.fullTime ? 1.6 : 0.8)) * 10) / 10;
    const ed = p.education;
    if (X.trainer.fullTime && ed.enrolled && !['university', 'community'].includes(ed.stage)) {
      if (canDropOut()) { dropOut(); log(`Training full time with ${X.trainer.name} left no room for school.`, 'system', 'neutral'); }
      else ed.gpa = Math.max(0, Math.round(((ed.gpa ?? 2.5) - 0.3) * 100) / 100);
    }
  }
  // A trainer comes calling, at 12 to 14, for a boy who looks like he will be worth signing.
  if (!X.trainer && p.age >= 12 && p.age <= 14 && I.trainers.includes(p.countryId) && !cubaRule(p) && X.declined < 2 && projected(o, p.age) >= 56) {
    const cut = Math.round((I.cut[0] + r.next() * (I.cut[1] - I.cut[0])) * 100) / 100;
    const word = p.countryId === 'do' ? 'a buscón, one of the trainers' : 'a trainer, one of those';
    life.decide(state, { kind: 'buscon', sportId: e.id, key: `buscon/${e.id}/${state.year}`, cut,
      text: `${word} who find boys and get them ready for the clubs' scouts, wants you in his program: coaching every day, food, a bed at the program if you want it, and showcases in front of the scouts. When you sign at 16 he takes ${Math.round(cut * 100)}% of your bonus.`,
      options: [{ id: 'full', label: 'Train full time', sub: 'Baseball all day: school will suffer, or stop' }, { id: 'part', label: 'Train around school' }, { id: 'no', label: 'Not now' }] });
  }
  // A deal agreed early can fall through: the boy has not grown as hoped, or the club's plans changed.
  if (X.deal && p.age < 16) {
    const why = projected(o, p.age) < X.deal.expected - 4 ? `${X.deal.club} backed out: they had expected more by now.`
      : r.chance(0.07) ? r.pick([`${X.deal.club} have a new international director, and he has his own boys.`, `${X.deal.club} spent their pool on another player.`]) : null;
    if (why) {
      X.fellThrough.push({ year: state.year, club: X.deal.club, why });
      X.deal = null;
      sp.say(state, `The handshake deal is off. ${why}`, 'bad', { screen: 'hub', id: 'career' });
    }
  }
  // Showcases: a club agrees a handshake deal years early.
  if (!X.deal && p.age >= 13 && p.age <= 15 && !cubaRule(p)) {
    const bonus = bonusFor(state, projected(o, p.age), 16);
    if (bonus >= life.money(state, 50000) && r.chance(X.trainer ? 0.75 : 0.3)) {
      const n = r.int(0, 29);
      const club = clubAt(state, n);
      const amount = Math.min(bonus, poolOf(state, club.teamIds[0]));
      life.decide(state, { kind: 'handshake', sportId: e.id, key: `handshake/${e.id}/${state.year}`, n, teamId: club.teamIds[0], club: club.name, amount, expected: projected(o, p.age),
        text: `${club.name}'s scouts have seen you at ${X.trainer ? `${X.trainer.name}'s showcases` : 'a showcase'}. They will agree now to sign you when you turn 16, for ${life.fmt(state, amount)}. It is a handshake: the rules forbid it, and nothing holds either side to it.`,
        options: [{ id: 'yes', label: 'Shake on it' }, { id: 'no', label: 'Wait for more clubs' }] });
    }
  }
  // Cuba: no one signs a player who is still there.
  if (cubaRule(p) && !X.left) {
    if (p.age >= 17 && o >= 60) {
      const veteran = p.age >= 23 && proSeasons(state, e) >= 5;
      life.decide(state, { kind: 'leaveCuba', sportId: e.id, key: `leaveCuba/${e.id}/${state.year}`,
        text: `Scouts from the big league clubs are interested, but no club can sign you in Cuba. You would have to leave, settle in a third country and be cleared before signing${veteran ? ': at your age, with five seasons in Cuba\'s top league, as a professional, outside the bonus pools' : ', for a bonus out of a club\'s pool'}. You might not be able to come back for years.`,
        options: [{ id: 'yes', label: 'Leave Cuba to sign' }, { id: 'no', label: 'Stay' }] });
    }
    return;
  }
  // Signing: from January 15 after the sixteenth birthday; at 17 to 22 for less, as an older signing.
  if (p.age >= 16 && p.age <= 22) offers(state, e, o, r);
}

/** Pro seasons at home: a Cuban veteran is signed as a professional, outside the pools. */
function proSeasons(state, e) {
  const k = Object.values(sp.ensure(state).contracts).filter((x) => x.kind === 'pro' && x.personId === state.player.id && x.sportId === e.id);
  return k.reduce((s, x) => s + ((x.ended ?? state.year) - x.from), 0);
}

function offers(state, e, o, r) {
  const p = state.player;
  const X = e.intl;
  const list = [];
  if (X.deal && p.age === 16) list.push({ n: null, teamId: X.deal.teamId, club: X.deal.club, amount: X.deal.amount, deal: true });
  const veteran = cubaRule(p) && p.age >= 23;
  const want = p.age === 16 ? 50 : veteran ? 66 : 56;
  if (o >= want) {
    const many = clamp(Math.floor((o - want) / 5) + 1, 1, 3) - list.length;
    for (let i = 0; i < many; i++) {
      const n = r.int(0, 29);
      const club = clubAt(state, n);
      if (list.some((x) => x.teamId === club.teamIds[0])) continue;
      list.push({ n, teamId: club.teamIds[0], club: club.name, amount: Math.min(bonusFor(state, o, p.age), poolOf(state, club.teamIds[0])) });
    }
  }
  if (!list.length) {
    if (p.age === 16) log('The signing period opened on January 15, and no club offered. Some boys sign at 17 or 18, for less.', 'system', 'neutral');
    return;
  }
  const best = list.reduce((m, x) => (x.amount > m.amount ? x : m), list[0]);
  life.decide(state, { kind: 'intlSign', sportId: e.id, key: `intlSign/${e.id}/${state.year}`, offers: list, veteran,
    text: `${p.age === 16 ? 'January 15: the international signing period opens, and you are 16.' : 'A club wants to sign you as an international free agent.'} ${X.deal && list[0].deal ? `${X.deal.club} are keeping their word: ${life.fmt(state, X.deal.amount)}.` : `The best offer is ${life.fmt(state, best.amount)} from ${best.club}.`}${X.trainer ? ` ${X.trainer.name} takes ${Math.round(X.trainer.cut * 100)}% of the bonus.` : ''}`,
    options: [...list.map((x) => ({ id: String(x.teamId), label: `Sign with ${x.club}`, sub: `${life.fmt(state, x.amount)} bonus${x.deal ? ' · the handshake deal' : ''}` })), { id: 'no', label: 'Wait' }] });
}

export const INTL_ANSWERS = {
  buscon(state, d, choice) {
    const p = state.player;
    const e = sp.entryOf(d.sportId, p.id, state);
    if (!e?.intl) return { ...result(false, 'That has passed.', 'neutral'), close: true };
    if (choice === 'no') { e.intl.declined += 1; return result(true, 'You stay as you are, for now.', 'neutral'); }
    const npc = makeNpc({ role: 'coach', gender: 'male', countryId: p.countryId, age: seeded(`trainer/${p.id}/${state.year}`).int(30, 60), relationship: 50 });
    npc.flags.title = p.countryId === 'do' ? 'Your trainer (buscón)' : 'Your trainer'; npc.flags.sport = e.id;
    state.npcs[npc.id] = npc; p.npcIds.push(npc.id);
    const name = `${npc.firstName} ${npc.lastName}`;
    e.intl.trainer = { npcId: npc.id, name, cut: d.cut, fullTime: choice === 'full', since: state.year };
    e.plan.hours = Math.max(e.plan.hours, choice === 'full' ? 16 : 12);
    milestone(`Joined ${name}'s baseball program.`, 'career');
    sp.moment(state, { type: 'trainer', sportId: e.id, text: `Joined ${name}'s program.`, sig: 2 });
    return result(true, `You joined ${name}'s program${choice === 'full' ? ', full time' : ', around school'}.`);
  },
  handshake(state, d, choice) {
    const e = sp.entryOf(d.sportId, state.player.id, state);
    if (!e?.intl || choice === 'no') return result(true, 'You wait to see who else is interested.', 'neutral');
    e.intl.deal = { teamId: d.teamId, club: d.club, amount: d.amount, year: state.year, expected: d.expected };
    sp.moment(state, { type: 'handshake', sportId: e.id, text: `A handshake deal with ${d.club}.`, sig: 2 });
    return result(true, `A handshake deal with ${d.club}: ${life.fmt(state, d.amount)} when you turn 16, if it holds.`);
  },
  leaveCuba(state, d, choice) {
    const p = state.player;
    const e = sp.entryOf(d.sportId, p.id, state);
    if (!e?.intl || choice === 'no') return result(true, 'You stay in Cuba.', 'neutral');
    const k = Object.values(sp.ensure(state).contracts).find((x) => x.id === e.contractId);
    if (k) life.endContract(state, k, 'left Cuba');
    e.intl.left = state.year;
    milestone('Left Cuba to play baseball.', 'career');
    sp.moment(state, { type: 'leftHome', sportId: e.id, text: 'Left Cuba to sign abroad.', sig: 3 });
    offers(state, e, overall(e, p), seeded(`intl/${p.id}/${e.id}/${state.year}/left`));
    return result(true, 'You left Cuba. Once you are settled and cleared, clubs can sign you.', 'neutral');
  },
  intlSign(state, d, choice) {
    const p = state.player;
    const e = sp.entryOf(d.sportId, p.id, state);
    if (!e?.intl) return { ...result(false, 'That has passed.', 'neutral'), close: true };
    if (choice === 'no') return result(true, 'You wait.', 'neutral');
    const x = d.offers.find((y) => String(y.teamId) === choice);
    const club = clubOf(state, x?.teamId);
    if (!club) return { ...result(false, 'That club has moved on.', 'neutral'), close: true };
    const o = overall(e, p);
    const salary = life.money(state, d.veteran ? 760000 : 7000);
    const level = o >= 86 ? 3 : o >= 76 ? 2 : o >= 66 ? 1 : 0;
    const res = life.signPro(state, { sportId: e.id, orgId: club.id, orgName: club.name, salary, years: d.veteran ? 4 : 7, level, how: 'signing' });
    if (res.ok === false) return res;
    settle(state, `intlBonus/${e.id}/${state.year}`, x.amount, 'sponsorship', `Signing bonus: ${club.name}`, 'action');
    const toTrainer = e.intl.trainer ? Math.round(x.amount * e.intl.trainer.cut) : 0;
    if (toTrainer) settle(state, `trainerCut/${e.id}/${state.year}`, -toTrainer, 'sport', `${e.intl.trainer.name}'s share of the bonus`, 'action');
    e.intl.signed = { year: state.year, orgId: club.id, club: club.name, bonus: x.amount, toTrainer };
    if (x.deal || e.intl.deal?.teamId === x.teamId) e.intl.deal = null;
    // Where they start: a 16-year-old at the academy and the Dominican Summer League; an older or better one in the United
    // States; a Cuban veteran as high as he is good.
    const start = d.veteran ? (o >= 74 ? null : clamp(Math.round((o - 56) / 4), 2, 5)) : p.age <= 17 && o < 62 ? 0 : clamp(Math.round((o - 52) / 5), 1, 3);
    if (start != null) toMinors(state, e, club, start, I.ladder);
    const where = start === 0 ? `You report to ${club.name}'s academy in the Dominican Republic: baseball, English classes, and the Dominican Summer League.` : start != null ? `You start in ${I.ladder[start]}.` : 'You go straight to the big club.';
    milestone(`Signed with ${club.name} for a ${life.fmt(state, x.amount)} bonus.`, 'career');
    // The bonus is the family's too (engine/baseball.js).
    const mine = x.amount - toTrainer;
    if (mine > 0) life.decide(state, { kind: 'remit', sportId: e.id, amount: mine, key: `remit/${e.id}`,
      text: `The bonus is more money than your family has ever seen. Many players buy their mother a house with it, and send money home every year after.`,
      options: [{ id: 'house', label: 'A house for the family', sub: `Half the bonus: ${life.fmt(state, Math.round(mine * 0.5))}, and money home each year` }, { id: 'some', label: 'Give them a share', sub: `A fifth: ${life.fmt(state, Math.round(mine * 0.2))}, and money home each year` }, { id: 'no', label: 'Keep it for now' }] });
    return result(true, `You signed with ${club.name}. The bonus is ${life.fmt(state, x.amount)}${toTrainer ? `, of which ${e.intl.trainer.name} takes ${life.fmt(state, toTrainer)}` : ''}. ${where}`);
  },
};
