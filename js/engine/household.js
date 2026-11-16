// The royal household: where the family lives, and who works for the player.
//
// Residences, kept on the house: d.residences = [{ id, name, kind, owner, value, upkeep, open, sold }]
//   owner 'state'    belongs to the country. The monarch lives in it and can never sell it.
//                    It is lost if the monarchy is abolished.
//   owner 'private'  belongs to the head of the house personally. It costs
//                    money to keep, can be opened to visitors, restored or sold,
//                    and stays with the family whatever happens to the throne.
//   value and upkeep are in base units; the head of the house pays the upkeep.
// Staff are people in the player's life (state.npcs, role 'staff'), so they
// have faces, can be talked to under People, and remember things. What they
// do for the player depends on how good they are (a meter) and how loyal
// (their relationship with the player):
//   secretary  intellect  steadies risky acts of state and risky duties
//   press      charm      takes the heat out of newspaper stories
//   steward    intellect  cuts what the estates cost and raises what they earn
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, log, milestone } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { makeNpc } from './npcFactory.js';
import * as dyn from './dynasty.js';
import * as fame from './reputation.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const house = () => dyn.house(player().royal?.countryId ?? player().flags.formerRoyal?.countryId ?? country().id);
const cOf = (d) => COUNTRIES[d.countryId];

// ---------- Residences ----------

/** The house's residences, invented the first time anyone asks. */
export function residences(d = house()) {
  if (!d) return [];
  if (!d.residences) {
    const c = cOf(d);
    const cities = [...c.cities];
    const take = () => cities.splice(rng.int(0, cities.length - 1), 1)[0] ?? c.cities[0];
    const surname = d.name.replace(/^.* House of /, '');
    const mk = (name, kind, owner, value, upkeep) => ({ id: `res${d.residences.length + 1}`, name, kind, owner, value, upkeep, open: false });
    d.residences = [];
    d.residences.push(mk(`${take()} Palace`, 'palace', 'state', 0, 0));
    d.residences.push(mk(`The Summer Palace at ${take()}`, 'palace', 'state', 0, 0));
    // What the family owns itself varies a great deal from house to house.
    const wealth = rng.weighted(['land-rich', 'comfortable', 'threadbare'], (k) => ({ 'land-rich': 3, comfortable: 5, threadbare: 2 })[k]);
    d.fortune = wealth;
    d.residences.push(mk(`${surname} Castle`, 'castle', 'private', wealth === 'threadbare' ? 4000000 : 14000000, wealth === 'threadbare' ? 260000 : 420000));
    if (wealth !== 'threadbare') d.residences.push(mk(`${take()} Lodge`, 'estate', 'private', 5000000, 150000));
    if (wealth === 'land-rich') d.residences.push(mk(`The ${surname} Estate`, 'estate', 'private', 22000000, 380000));
  }
  return d.residences.filter((r) => !r.sold);
}

/** Whether the player is the one who decides about the family's own property. */
export const isHead = (d = house()) => !!(d && dyn.monarchOf(d)?.isPlayer);
const steward = () => staffIn('steward');

/** What one residence costs or earns the head of the house in a year, in local money. */
export function yearly(r, d = house()) {
  if (r.owner === 'state') return 0;
  const c = cOf(d);
  const skill = steward()?.meters.intellect ?? 0;
  const upkeep = localMoney(r.upkeep, c) * (1 - skill / 280);
  const visitors = r.open ? localMoney(r.value * 0.022, c) * (1 + skill / 200) : 0;
  return Math.round(visitors - upkeep);
}

export function residenceRows(d = house()) {
  const c = cOf(d);
  const fallen = d.status === 'abolished';
  return residences(d).filter((r) => !(fallen && r.owner === 'state')).map((r) => ({ id: r.id, name: r.name, kind: r.kind, state: r.owner === 'state', open: r.open,
    value: localMoney(r.value, c), yearly: yearly(r, d),
    note: r.owner === 'state' ? 'Belongs to the country. Yours to live in, never to sell.' : `Belongs to the family.${r.open ? ' Open to visitors.' : ''}` }));
}

/** What the head of the house may do with a residence. */
export function residenceActions(id, d = house()) {
  const r = residences(d).find((x) => x.id === id);
  if (!r || r.owner === 'state' || !isHead(d)) return [];
  const c = cOf(d);
  return [
    r.open ? { id: 'close', label: 'Close it to visitors', sub: 'Privacy, and the upkeep in full.' }
      : { id: 'open', label: 'Open it to visitors', sub: 'Coach parties in the long gallery. It pays, and the country likes it.' },
    { id: 'restore', label: 'Restore it', sub: `${fmtMoney(localMoney(r.value * 0.06, c), c)}. It is worth more afterwards, and costs a little less to keep.` },
    { id: 'sell', label: 'Sell it', sub: `About ${fmtMoney(localMoney(r.value, c), c)}. The family will not forgive it quickly.` },
  ];
}

export function manageResidence(id, action) {
  const p = player();
  const d = house();
  const c = cOf(d);
  const r = residences(d).find((x) => x.id === id);
  if (!r) return result(false, 'There is no such place.', 'neutral');
  if (r.owner === 'state') return result(false, `${r.name} belongs to the country. It is not yours to change or to sell.`, 'neutral');
  if (!isHead(d)) return result(false, 'That is for the head of the family to decide.', 'neutral');
  if (action === 'open' || action === 'close') {
    r.open = action === 'open';
    if (r.open) { d.standing = clamp(d.standing + 2); fame.shift('family', -3, `opening ${r.name} to visitors`); }
    const text = r.open ? `${r.name} opens on Sundays and all summer. There is a tea room in the stables.` : `${r.name} is closed to the public again.`;
    log(text);
    return result(true, text, 'neutral');
  }
  if (action === 'restore') {
    const cost = localMoney(r.value * 0.06, c);
    if (p.finance.cash < cost) return result(false, `It would cost ${fmtMoney(cost, c)}. You do not have it.`, 'neutral');
    if (r.restoredYear === store.state.year) return result(false, 'The builders are still there.', 'neutral');
    p.finance.cash -= cost;
    r.restoredYear = store.state.year;
    r.value = Math.round(r.value * 1.09);
    r.upkeep = Math.round(r.upkeep * 0.96);
    const text = `A new roof, the damp seen to, four hundred windows repainted. ${r.name} will stand another century.`;
    log(text, 'system', 'good');
    return result(true, text);
  }
  if (action === 'sell') {
    const price = localMoney(r.value, c);
    r.sold = store.state.year;
    p.finance.cash += price;
    fame.shift('family', -18, `selling ${r.name}`);
    fame.shift('image', -3, `selling ${r.name}`);
    dyn.chronicle(d, `${p.firstName} sold ${r.name}, which had been the family's for generations.`, [dyn.playerPerson(d).id]);
    const text = `${r.name} is sold, for ${fmtMoney(price, c)}. The portraits go into store. The family takes it hard.`;
    log(text, 'system', 'neutral');
    milestone(`Sold ${r.name}.`, 'money');
    return result(true, text, 'neutral');
  }
  return result(false, 'That cannot be done.', 'neutral');
}

// ---------- Staff ----------

export const POSTS = [
  { id: 'secretary', title: 'Private secretary', skill: 'intellect', pay: 90000, does: 'Runs your office, reads everything first, and tells you when you are about to make a mistake.' },
  { id: 'press', title: 'Press secretary', skill: 'charm', pay: 75000, does: 'Deals with the newspapers. A good one takes the heat out of a story before it catches.' },
  { id: 'steward', title: 'Estate steward', skill: 'intellect', pay: 60000, does: 'Manages the family\'s own property. Only the head of the family has need of one.', headOnly: true },
];
const post = (id) => POSTS.find((x) => x.id === id);
const mine = () => player().npcIds.map((id) => store.state.npcs[id]).filter((n) => n && n.alive && n.role === 'staff');
/** The person holding a post in the player's household, or null. */
export const staffIn = (id) => mine().find((n) => n.flags.staff === id) ?? null;
export const canKeepStaff = () => { const r = player().royal; return !!r && ['monarch', 'heir', 'royal'].includes(r.rank) && player().age >= 18 && !player().legal.incarceration; };
const skillWord = (v) => (v >= 80 ? 'the best in the business' : v >= 62 ? 'very capable' : v >= 45 ? 'competent' : 'out of their depth');
const salary = (id) => localMoney(post(id).pay, country());

/** The household as the screens show it. */
export function staffRows() {
  const d = house();
  return POSTS.filter((x) => !x.headOnly || isHead(d)).map((x) => {
    const n = staffIn(x.id);
    return { id: x.id, title: x.title, does: x.does, pay: salary(x.id), npcId: n?.id ?? null,
      name: n ? `${n.firstName} ${n.lastName}` : null, skill: n ? skillWord(n.meters[x.skill]) : null, years: n ? player().age - n.flags.since : 0 };
  });
}

/** Three people who have applied for a post. How good they are shows at interview; how loyal does not. */
export function candidates(id) {
  const x = post(id);
  const c = country();
  const list = [];
  for (let i = 0; i < 3; i++) {
    const npc = makeNpc({ role: 'staff', countryId: c.id, age: rng.int(28, 58), relationship: Math.round(clamp(rng.around(58, 34), 8, 96)) });
    npc.meters[x.skill] = Math.round(clamp(rng.around(60, 32), 22, 97));
    npc.flags.staff = id;
    npc.flags.tag = id;
    npc.flags.title = x.title;
    npc.occupation = 'royal household';
    list.push(npc);
  }
  store.staffShortlist = list;
  return list.map((n, i) => ({ index: i, name: `${n.firstName} ${n.lastName}`, age: n.age, skill: skillWord(n.meters[x.skill]),
    manner: n.meters.relationship >= 70 ? 'Warm, and plainly wants the post.' : n.meters.relationship >= 45 ? 'Correct, and hard to read.' : 'Very smooth.' }));
}

export function hire(id, index) {
  const p = player();
  const npc = store.staffShortlist?.[index];
  if (!canKeepStaff() || !npc || npc.flags.staff !== id) return result(false, 'That cannot be done now.', 'neutral');
  const old = staffIn(id);
  if (old) dismiss(id, true);
  store.state.npcs[npc.id] = npc;
  p.npcIds.push(npc.id);
  npc.flags.since = p.age;
  npc.lastInteractionAge = p.age;
  store.staffShortlist = null;
  const text = `${npc.firstName} ${npc.lastName} is your ${post(id).title.toLowerCase()}, at ${fmtMoney(salary(id), country())} a year.`;
  log(text);
  return result(true, text, 'neutral');
}

export function dismiss(id, quiet = false) {
  const n = staffIn(id);
  if (!n) return result(false, 'Nobody holds that post.', 'neutral');
  n.role = 'ex';
  n.flags.title = `Former ${post(id).title.toLowerCase()}`;
  n.flags.staff = null;
  n.flags.tag = null;
  n.occupation = 'between posts';
  const bitter = n.meters.relationship < 45;
  n.meters.relationship = clamp(n.meters.relationship - 25);
  const text = `You let ${n.firstName} ${n.lastName} go.${bitter ? ' They did not take it well, and they know a great deal.' : ''}`;
  if (!quiet) log(text);
  if (bitter && rng.chance(0.4)) fame.addStory(`what your former ${post(id).title.toLowerCase()} is saying`, true, 30);
  return result(true, text, 'neutral');
}

/** How much a good private secretary improves the odds of a risky act (0 to about 0.2). */
export const counsel = () => { const n = staffIn('secretary'); return n ? Math.max(0, n.meters.intellect - 40) / 300 : 0; };
/** How much of a story's heat the press secretary takes away (a multiplier, 1 with nobody in post). */
export const spin = () => { const n = staffIn('press'); return n ? 1 - Math.max(0, n.meters.charm - 30) / 150 : 1; };

/** Yearly: wages, the cost of the estates, and what the household gets up to. */
export function tickHousehold(d) {
  const p = player();
  const c = country();
  if (!d) return;
  // The family's own property: the head of the house pays, and collects.
  if (isHead(d) && p.age >= 18) {
    const net = residences(d).reduce((s, r) => s + yearly(r, d), 0);
    if (net) {
      p.finance.cash += net;
      if (net > 0) p.finance.lifetimeEarned += net;
      log(net >= 0 ? `The family's estates brought in ${fmtMoney(net, c)} after their costs.` : `The family's estates cost you ${fmtMoney(-net, c)} to keep up.`, 'system', net >= 0 ? 'good' : 'neutral');
    }
  }
  if (!canKeepStaff()) {
    // No longer royal: the household is let go.
    for (const n of mine()) { n.role = 'ex'; n.flags.title = `Former ${post(n.flags.staff)?.title.toLowerCase() ?? 'member of your staff'}`; n.flags.staff = null; }
    return;
  }
  for (const n of mine()) {
    const x = post(n.flags.staff);
    if (!x) continue;
    const pay = salary(x.id);
    if (p.finance.cash < pay) {
      dismiss(x.id, true);
      log(`You could not pay ${n.firstName} ${n.lastName}, and they have left your service.`, 'system', 'bad');
      continue;
    }
    p.finance.cash -= pay;
    // Years of service bind people, a little.
    n.meters.relationship = clamp(n.meters.relationship + rng.int(-2, 3));
    // The disloyal talk. Someone who has been badly treated talks more.
    // Once found out, they are careful for some years.
    if (n.meters.relationship < 40 && p.age - (n.flags.leakedAge ?? -99) >= 7 && rng.chance((42 - n.meters.relationship) / 130)) {
      n.flags.leakedAge = p.age;
      store.state.pendingEvents.push({ id: 'staff_leak', cast: { aide: n.id } });
    } else if (n.age >= 67 && rng.chance(0.3)) {
      n.role = 'friend'; n.flags.title = `Retired ${x.title.toLowerCase()}`; n.flags.staff = null; n.occupation = 'retired';
      log(`${n.firstName} ${n.lastName} has retired after ${p.age - n.flags.since} years as your ${x.title.toLowerCase()}. The post is empty.`, 'system', 'neutral');
    }
  }
}
