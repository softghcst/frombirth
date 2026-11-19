// Foreign affairs: how a country stands with a handful of others, the
// agreements between them, and the crises that come up. It runs for every
// government; a head of government who is the player makes the choices.
//
// On the political world of a country:
//   w.abroad    { countryId: { rel, leader } }   rel: -100 (hostile) … 100 (the closest of friends)
//   w.treaties  [{ with, kind: 'trade' | 'defense', year }]
//     trade     money for the treasury while it lasts
//     defense   an ally at your back when another country threatens
// Leaders abroad are names only: their own politics are not played out unless the player goes to live there.
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney, theCountry } from '../util.js';
import { store, player } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { SYSTEMS, DISPUTES, GOODWILL } from '../data/politics.js';
import { MONARCHIES } from '../data/royalty.js';
import * as world from './polity.js';
import { skillOf } from './government.js';
import { post } from './news.js';
import { envoyEdge } from './languages.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const yearNow = () => store.state.year;
const ACTS_PER_YEAR = 2;
const name = (cid) => theCountry(COUNTRIES[cid].name);
const titleOf = (cid) => SYSTEMS[cid]?.head ?? (MONARCHIES[cid] ? 'ruler' : 'leader');
const newLeader = (cid) => { const c = COUNTRIES[cid]; return `${rng.pick(rng.chance(0.65) ? c.names.male : c.names.female)} ${rng.pick(c.names.last)}`; };
const round = (n) => Math.round(n * 10) / 10;

/** The countries this one deals with most: two great powers and four others, settled once. */
export function partners(w) {
  if (!w.abroad) {
    const ids = Object.keys(COUNTRIES).filter((id) => id !== w.countryId);
    const picked = ['us', 'cn'].filter((id) => id !== w.countryId);
    while (picked.length < 6) { const id = rng.pick(ids); if (!picked.includes(id)) picked.push(id); }
    w.abroad = Object.fromEntries(picked.map((id) => [id, { rel: Math.round(clamp(rng.around(20, 45), -70, 85)), leader: newLeader(id) }]));
    w.treaties = [];
    for (const id of picked) if (w.abroad[id].rel >= 40 && rng.chance(0.6)) w.treaties.push({ with: id, kind: 'trade', year: yearNow() - rng.int(2, 30) });
  }
  return w.abroad;
}
export const treaty = (w, cid, kind) => (w.treaties ?? []).find((t) => t.with === cid && t.kind === kind) ?? null;
const allies = (w) => (w.treaties ?? []).filter((t) => t.kind === 'defense').length;
export const mood = (rel) => (rel >= 60 ? 'Close friends' : rel >= 25 ? 'Friendly' : rel >= -10 ? 'Correct' : rel >= -45 ? 'Strained' : 'Hostile');
const shift = (w, cid, n) => { const a = partners(w)[cid]; if (a) a.rel = Math.round(clamp(a.rel + n, -100, 100)); };

function sign(w, cid, kind) {
  // Trade is worth money to the treasury, but only so much: the third agreement adds less than the first.
  const worth = kind === 'trade' && w.treaties.filter((t) => t.kind === 'trade').length < 3 ? 0.5 : 0;
  w.treaties.push({ with: cid, kind, year: yearNow(), worth });
  w.budget = round(w.budget + worth);
}
function tear(w, t) {
  w.treaties = w.treaties.filter((x) => x !== t);
  w.budget = round(w.budget - (t.worth ?? 0));
}

/** The view for the screens: every partner, how things stand, and what binds the two countries. */
export function view(countryId = player().countryId) {
  const w = world.polity(countryId);
  const a = partners(w);
  return Object.entries(a).map(([id, x]) => ({ id, name: COUNTRIES[id].name, flag: COUNTRIES[id].flag, rel: x.rel, mood: mood(x.rel), leader: x.leader, title: titleOf(id),
    treaties: w.treaties.filter((t) => t.with === id).map((t) => (t.kind === 'trade' ? 'trade agreement' : 'defense pact')) })).sort((p, q) => q.rel - p.rel);
}

/** Yearly, from the political world's own tick. */
export function tickDiplomacy(w, tell, playerLeads) {
  const a = partners(w);
  const here = COUNTRIES[w.countryId].name;
  for (const [id, x] of Object.entries(a)) {
    x.rel = Math.round(x.rel + (15 - x.rel) * 0.03);
    if (rng.chance(0.09)) x.leader = newLeader(id);
    // An agreement does not outlive the goodwill it was made in.
    for (const t of w.treaties.filter((q) => q.with === id)) if (x.rel < (t.kind === 'defense' ? 0 : -25)) { tear(w, t); tell(`${name(id).replace(/^t/, 'T')} has torn up its ${t.kind === 'trade' ? 'trade agreement' : 'defense pact'} with ${theCountry(here)}.`, 'bad', 3); }
  }
  const ids = Object.keys(a);
  if (!playerLeads) {
    // Other governments have their own good and bad years abroad.
    if (rng.chance(0.2)) {
      const id = rng.pick(ids);
      const good = rng.chance(0.5 + a[id].rel / 300);
      shift(w, id, good ? rng.int(10, 20) : -rng.int(8, 18));
      tell((good ? rng.pick(GOODWILL) : rng.pick(DISPUTES)).replace('{them}', name(id)).replace('{Them}', name(id).replace(/^t/, 'T')), 'neutral', 1);
    }
    const friend = ids.find((id) => a[id].rel >= 35 && !treaty(w, id, 'trade'));
    if (friend && rng.chance(0.12)) { sign(w, friend, 'trade'); tell(`The government has signed a trade agreement with ${name(friend)}.`, 'neutral', 2); }
    return;
  }
  const pend = store.state.pendingEvents;
  const worst = ids.slice().sort((p, q) => a[p].rel - a[q].rel)[0];
  if (a[worst].rel < 25 && rng.chance(0.1 + (a[worst].rel < -20 ? 0.08 : 0))) {
    shift(w, worst, -10);
    const what = rng.pick(DISPUTES).replace('{them}', name(worst)).replace('{Them}', name(worst).replace(/^t/, 'T'));
    pend.push({ id: 'dip_crisis', cast: { country: worst, words: { country: name(worst), leader: a[worst].leader, title: titleOf(worst), what } } });
    return;
  }
  const friend = ids.find((id) => a[id].rel >= 30 && !treaty(w, id, 'trade'));
  if (friend && rng.chance(0.15)) pend.push({ id: 'dip_trade_offer', cast: { country: friend, words: { country: name(friend), leader: a[friend].leader, title: titleOf(friend) } } });
}

// ---------- The player as head of government ----------

function acts() {
  const k = player().politics;
  if (k.foreign?.age !== player().age) k.foreign = { age: player().age, done: 0 };
  return k.foreign;
}
export const actsLeft = () => (player().politics?.officeId === 'head' ? ACTS_PER_YEAR - acts().done : 0);
/** How much a good foreign minister helps, about -0.1..0.12. */
function envoy(w) {
  const f = w.figures[w.cabinet?.foreign];
  return f && f.died == null ? (skillOf(f) - 50) / 400 : -0.08;
}

export function options(cid) {
  const p = player();
  const c = COUNTRIES[p.countryId];
  const w = world.polity(p.countryId);
  const x = partners(w)[cid];
  if (!x) return [];
  const visit = localMoney(60000, c);
  return [
    { id: 'visit', name: 'Make a state visit', sub: `Flags, an anthem, and a long dinner. ${fmtMoney(visit, c)} of your own on gifts and tailoring.`, disabled: p.finance.cash < visit },
    { id: 'trade', name: treaty(w, cid, 'trade') ? 'A trade agreement is in force' : 'Propose a trade agreement', sub: 'Money for the treasury while it lasts. They must be friendly enough to talk.', disabled: !!treaty(w, cid, 'trade') || x.rel < 30 },
    { id: 'pact', name: treaty(w, cid, 'defense') ? 'A defense pact is in force' : 'Propose a defense pact', sub: 'An ally at your back in a crisis. Only close friends sign one.', disabled: !!treaty(w, cid, 'defense') || x.rel < 55 },
    { id: 'aid', name: 'Send aid', sub: 'It costs the treasury, and is remembered.' },
    { id: 'sanctions', name: 'Impose sanctions', sub: x.rel < 0 ? 'Popular at home. It costs trade, and they will not forget it.' : 'On a country you are on good terms with, this will baffle everyone.' },
  ];
}

export function act(cid, id) {
  const p = player();
  const k = p.politics;
  const c = COUNTRIES[p.countryId];
  const w = world.polity(p.countryId);
  const x = partners(w)[cid];
  if (k?.officeId !== 'head' || !x) return result(false, 'That is not in your power.', 'neutral');
  if (actsLeft() <= 0) return result(false, 'There are only so many state banquets in a year.', 'neutral');
  const o = options(cid).find((q) => q.id === id);
  if (!o || o.disabled) return result(false, 'That cannot be done now.', 'neutral');
  acts().done += 1;
  const them = name(cid);
  const approve = (n) => { k.approval = Math.round(clamp(k.approval + n)); };
  if (id === 'visit') {
    p.finance.cash -= localMoney(60000, c);
    const tongue = envoyEdge(cid, p);
    const gain = Math.round(rng.int(5, 10) + (p.stats.charm - 50) / 8 + envoy(w) * 30 + tongue * 5);
    shift(w, cid, gain); approve(1);
    post(w, `${p.firstName} ${p.lastName} has made a state visit to ${them}.`, { you: true });
    return result(true, gain >= 8 ? `${x.leader} meets you at the foot of the aircraft steps.${tongue ? ' You make your speech in their language, and the room warms at once.' : ''} By the second evening you are on first-name terms.` : `The visit to ${them} is correct, courteous and slightly chilly. It does no harm.`, 'neutral');
  }
  if (id === 'aid') {
    w.budget = round(w.budget - 0.5); shift(w, cid, rng.int(10, 18)); p.hidden.karma = clamp(p.hidden.karma + 4); approve(-1);
    return result(true, `Trucks, doctors and money go to ${them}. Some at home ask why the money is not spent here.`, 'neutral');
  }
  if (id === 'sanctions') {
    const t = treaty(w, cid, 'trade');
    if (t) tear(w, t);
    shift(w, cid, -rng.int(20, 30)); approve(x.rel < 0 ? 3 : -4);
    post(w, `The government has imposed sanctions on ${them}.`, { you: true });
    return result(true, `Sanctions on ${them} come into force at midnight.${t ? ' The trade agreement is dead.' : ''} ${x.leader} calls it an act of hostility.`, 'neutral');
  }
  // An agreement: they have to want it too.
  const chance = clamp((id === 'pact' ? 0.25 : 0.4) + (x.rel - (id === 'pact' ? 55 : 30)) / 120 + (p.stats.intellect - 50) / 300 + envoy(w), 0.1, 0.92);
  if (!rng.chance(chance)) { shift(w, cid, -4); return result(false, `The talks with ${them} run for months and end with a communiqué that says nothing. ${x.leader} was not ready to sign.`, 'bad'); }
  sign(w, cid, id === 'pact' ? 'defense' : 'trade');
  shift(w, cid, 8); approve(id === 'pact' ? 1 : 2);
  post(w, id === 'pact' ? `${theCountry(c.name).replace(/^t/, 'T')} and ${them} have signed a defense pact.` : `A trade agreement with ${them} has been signed.`, { you: true });
  return result(true, id === 'pact' ? `You and ${x.leader} sign a defense pact under two flags. An attack on one is now the business of both.` : `You and ${x.leader} sign a trade agreement. The treasury will feel it within the year.`);
}

/** What the player chose in a scene from abroad. @returns {string} */
export function decide(what, cast = {}) {
  const p = player();
  const k = p.politics;
  const w = world.polity(p.countryId);
  const cid = cast.country;
  const x = partners(w)[cid];
  if (!k || !x) return '';
  const them = name(cid);
  const approve = (n) => { k.approval = Math.round(clamp(k.approval + n)); };
  if (what === 'negotiate') {
    if (rng.chance(clamp(0.35 + (p.stats.intellect - 50) / 200 + envoy(w) + (x.rel + 100) / 600 + envoyEdge(cid, p) * 0.08, 0.1, 0.9))) { shift(w, cid, 20); approve(6); post(w, `The dispute with ${them} has been settled by negotiation.`, { you: true, tone: 'good' }); return `Three nights of talks, and a text both sides can live with. ${x.leader} shakes your hand for the cameras.`; }
    shift(w, cid, -10); approve(-5);
    return `The talks collapse on the second day. ${x.leader} leaves by a side door, and the dispute is worse than before.`;
  }
  if (what === 'sanction') {
    const t = treaty(w, cid, 'trade');
    if (t) tear(w, t);
    shift(w, cid, -25); approve(3);
    if (rng.chance(0.3)) { w.budget = round(w.budget - 0.5); return `You impose sanctions on ${them}. They answer in kind, and prices at home begin to rise.`; }
    return `You impose sanctions on ${them}. It plays well at home, and settles nothing.`;
  }
  if (what === 'threaten') {
    if (rng.chance(clamp(0.3 + allies(w) * 0.15 + (p.hidden.willpower - 50) / 300, 0.1, 0.85))) { shift(w, cid, -15); approve(10); post(w, `${them.replace(/^t/, 'T')} has backed down after a warning from the government.`, { you: true, tone: 'good' }); return `You move ships and say very little.${allies(w) ? ' Your allies say it with you.' : ''} Within a week ${x.leader} has found a way to climb down.`; }
    shift(w, cid, -25); approve(-12); w.approval = clamp(w.approval - 6);
    post(w, `The government has backed down in its dispute with ${them}.`, { you: true, tone: 'bad' });
    return `You move ships and say very little. ${x.leader} calls your bluff, and it was a bluff. The climb-down is yours, and everybody watches it.`;
  }
  if (what === 'concede') { shift(w, cid, 15); approve(-7); return `You give ${them} most of what it wanted. The newspapers call it surrender; your diplomats call it Tuesday.`; }
  if (what === 'signTrade' || what === 'haggle') {
    if (what === 'haggle') {
      if (!rng.chance(clamp(0.45 + (p.stats.intellect - 50) / 200 + envoy(w), 0.15, 0.9))) { shift(w, cid, -10); return `You push for more. ${x.leader} withdraws the offer and says so in public.`; }
      w.budget = round(w.budget + 0.5); // better terms than were first on the table
    } else approve(-1);
    sign(w, cid, 'trade'); shift(w, cid, 8); approve(2);
    post(w, `A trade agreement with ${them} has been signed.`, { you: true });
    return what === 'haggle' ? `You push for more, and get it. The agreement with ${them} is signed on your terms.` : `You sign the agreement with ${them} as it was offered. Some of your own farmers are not pleased.`;
  }
  if (what === 'declineTrade') { shift(w, cid, -5); return `You thank ${x.leader} and decline. Perhaps another year.`; }
  return '';
}
