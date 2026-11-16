// Noble titles as things in their own right: "Duke of Ghent" is a record that
// is created, held, inherited, revoked, and can die out, whoever happens to
// hold it. Kept in the save as state.titles[countryId] = [title, …].
//
// A title:
//   { id, countryId, rank, place, plain, holder, hereditary, heirIsPlayer, grantedBy,
//     created, status: 'active' | 'extinct' | 'revoked', history: [{ year, text }] }
//   place    what it is a title of: a city ("Duke of Ghent") or, with `plain`, a family name ("Baron Evans")
//   rank     one of the country's noble ranks (data/royalty.js): 'duke', 'earl', 'baron', …
//   holder   who has it now:
//              { type: 'player' }                    the player
//              { type: 'house', id }                 a member of the royal house (engine/dynasty.js)
//              { type: 'npc', id }                   someone in the player's life
//              { type: 'name', name, gender, born }  a noble family the game does not follow closely
//   hereditary  passes to the eldest child on death; otherwise it is for life
// Royal rank (prince, king) is not a title of this kind: it comes from the
// family tree. A prince can also be given a dukedom, and keeps both.
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { store, player, country, log, milestone } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { MONARCHIES, ROYAL_RANKS } from '../data/royalty.js';
import * as dyn from './dynasty.js';
import * as fame from './reputation.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const yearNow = () => store.state.year;

/** The noble ranks a country has, highest first: [[id, male, female], …]. Empty where there is no nobility. */
export const nobleRanks = (countryId) => (MONARCHIES[countryId]?.ranks ?? []).filter((r) => !ROYAL_RANKS.includes(r[0]) && r[0] !== 'knight');
const word = (countryId, rank, gender) => { const r = MONARCHIES[countryId].ranks.find((x) => x[0] === rank); return r ? (gender === 'female' ? r[2] : r[1]) : ''; };

/** Every title of a country, with a few old families invented the first time anyone looks. */
export function titles(countryId = country().id) {
  const st = store.state;
  st.titles ??= {};
  if (!st.titles[countryId]) {
    st.titles[countryId] = [];
    const ranks = nobleRanks(countryId);
    const c = COUNTRIES[countryId];
    // The old nobility: families that have held their titles for generations.
    for (let i = 0; i < Math.min(5, ranks.length * 2); i++) {
      const rank = ranks[Math.min(ranks.length - 1, Math.floor(i / 2))][0];
      const gender = rng.chance(0.75) ? 'male' : 'female';
      const t = make(countryId, rank, { type: 'name', name: `${rng.pick(c.names[gender])} ${rng.pick(c.names.last)}`, gender, born: yearNow() - rng.int(30, 78) }, true, null);
      t.created = yearNow() - rng.int(90, 420);
      t.history = [{ year: t.created, text: `The title was created.` }];
    }
  }
  return st.titles[countryId];
}

/** A place for a new title: a city while there are any left, and after that a family name ("Baron Evans"). */
function freePlace(countryId) {
  const used = new Set((store.state.titles?.[countryId] ?? []).map((t) => t.place));
  const c = COUNTRIES[countryId];
  const cities = c.cities.filter((x) => !used.has(x));
  if (cities.length) return { place: rng.pick(cities), plain: false };
  const names = c.names.last.filter((x) => !used.has(x));
  return { place: rng.pick(names.length ? names : c.names.last), plain: true };
}

function make(countryId, rank, holder, hereditary, grantedBy) {
  const list = store.state.titles[countryId];
  const t = { id: `t${countryId}${list.length + 1}`, countryId, rank, ...freePlace(countryId), holder, hereditary, grantedBy, created: yearNow(), status: 'active', history: [] };
  list.push(t);
  return t;
}

/** Who a holder is, in the terms the screens need. Null if they cannot be found. */
export function who(t) {
  const h = t.holder;
  const st = store.state;
  if (!h) return null;
  if (h.type === 'player') { const p = st.player; return { name: `${p.firstName} ${p.lastName}`, gender: p.gender, alive: p.alive, isPlayer: true }; }
  if (h.type === 'house') {
    const d = st.dynasties?.[t.countryId]; const x = d?.people[h.id];
    return x ? { name: dyn.nameOf(d, x), gender: x.gender, alive: x.died == null, person: x, house: d } : null;
  }
  if (h.type === 'npc') { const n = st.npcs[h.id]; return n ? { name: `${n.firstName} ${n.lastName}`, gender: n.gender, alive: n.alive, npc: n } : null; }
  return { name: h.name, gender: h.gender, alive: true, age: yearNow() - h.born };
}

/** "Duke of Ghent" or "Duchess of Ghent", for whoever holds it. */
export function titleName(t, gender = who(t)?.gender ?? 'male') {
  return `${word(t.countryId, t.rank, gender)}${t.plain ? ' ' : ' of '}${t.place}`;
}
const note = (t, text) => t.history.push({ year: yearNow(), text });

/** The title the player holds themselves, if any (the highest, where there are several). */
export function playerTitle(countryId = player().royal?.countryId ?? country().id) {
  const order = nobleRanks(countryId).map((r) => r[0]);
  return (store.state.titles?.[countryId] ?? []).filter((t) => t.status === 'active' && t.holder?.type === 'player')
    .sort((a, b) => order.indexOf(a.rank) - order.indexOf(b.rank))[0] ?? null;
}

/**
 * A player born into the nobility: their family's title becomes a record,
 * held by a parent until it comes down to them. Safe to call often.
 */
export function ensureBirthTitle() {
  const p = player();
  const r = p.royal;
  if (!r || r.by === 'marriage' || ROYAL_RANKS.includes(r.rank) || r.rank === 'knight' || r.titleId) return;
  if (!nobleRanks(r.countryId).some((x) => x[0] === r.rank)) return;
  titles(r.countryId);
  const parent = p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.role === 'parent' && n.alive).sort((a, b) => (a.gender === 'male' ? -1 : 1) - (b.gender === 'male' ? -1 : 1))[0];
  const holder = r.waiting && parent ? { type: 'npc', id: parent.id } : { type: 'player' };
  const t = make(r.countryId, r.rank, holder, r.by === 'birth', null);
  t.heirIsPlayer = holder.type === 'npc';
  t.created = r.by === 'birth' ? yearNow() - p.age - rng.int(60, 380) : yearNow();
  t.history = [{ year: t.created, text: r.by === 'birth' ? 'The title was created, and has come down in the family since.' : `The title was created for ${p.firstName} ${p.lastName}, for services to the country.` }];
  r.titleId = t.id;
}

// ---------- Granting and revoking ----------

/** Whether the player may create and revoke titles: a reigning monarch of a country that has a nobility. */
export const mayGrant = () => !!player().royal?.reigning && nobleRanks(player().royal.countryId).length > 0;

/** The people a reigning player could raise to the nobility: relatives in the house, and people in their life. */
export function candidates() {
  const p = player();
  if (!mayGrant()) return [];
  const cid = p.royal.countryId;
  const d = dyn.house(cid);
  const list = titles(cid);
  const holds = (ref) => list.some((t) => t.status === 'active' && t.holder?.type === ref.type && t.holder.id === ref.id);
  const me = dyn.playerPerson(d);
  const kin = Object.values(d.people).filter((x) => x.died == null && x.blood && !x.out && !x.isPlayer && dyn.ageOf(x) >= 18 && dyn.closeness(d, me.id, x.id) <= 3)
    .map((x) => ({ ref: { type: 'house', id: x.id }, name: dyn.nameOf(d, x), kind: 'family', sub: dyn.standingOf(d, x) }));
  const friends = p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n && n.alive && n.age >= 21 && !n.flags.royal && !n.flags.houseId && ['friend', 'staff', 'mentor', 'coworker', 'inlaw'].includes(n.role))
    .map((n) => ({ ref: { type: 'npc', id: n.id }, name: `${n.firstName} ${n.lastName}`, kind: 'commoner', sub: `${n.flags.title ?? n.role}; ${n.meters.generosity >= 65 || n.meters.intellect >= 78 ? 'well thought of' : 'not widely known'}` }));
  return [...kin, ...friends].filter((x) => !holds(x.ref));
}

/** Creates a title for someone. A monarch may make one new peer a year. */
export function grant(ref, rank, hereditary = true) {
  const p = player();
  if (!mayGrant()) return result(false, 'Only a reigning monarch can create a title.', 'neutral');
  const cid = p.royal.countryId;
  if (p.flags.grantYear === yearNow()) return result(false, 'You have created a title this year already. Too many, and they are worth nothing.', 'neutral');
  if (!nobleRanks(cid).some((r) => r[0] === rank)) return result(false, 'There is no such rank here.', 'neutral');
  const cand = candidates().find((x) => x.ref.type === ref.type && x.ref.id === ref.id);
  if (!cand) return result(false, 'They cannot be given a title.', 'neutral');
  titles(cid);
  const d = dyn.house(cid);
  const t = make(cid, rank, ref, hereditary, dyn.nameOf(d, dyn.playerPerson(d)));
  p.flags.grantYear = yearNow();
  const name = titleName(t);
  note(t, `Created by ${t.grantedBy} for ${cand.name}${hereditary ? '' : ', for life'}.`);
  let text = `${cand.name} kneels, and rises as ${name}.`;
  if (ref.type === 'house') {
    fame.shift('family', 6, `making ${cand.name} ${name}`);
    const x = d.people[ref.id];
    x.t.loyalty = clamp(x.t.loyalty + 15);
    dyn.chronicle(d, `${cand.name} was created ${name}.`, [x.id]);
    text += ' The family is pleased, and one relative in particular.';
  } else {
    const n = store.state.npcs[ref.id];
    n.meters.relationship = clamp(n.meters.relationship + 20);
    (n.memories ??= []).push({ key: `peer${t.id}`, text: `You made them ${name}.`, age: p.age });
    n.flags.peer = name;
    const deserved = n.meters.generosity >= 65 || n.meters.intellect >= 78;
    if (deserved) { fame.shift('image', 2, `a title for ${cand.name}`); text += ' Nobody can say it was not earned.'; }
    else {
      d.standing = clamp(d.standing - 3);
      fame.shift('press', -4, `a title for your friend ${cand.name}`);
      fame.addStory(`a title for your friend ${n.firstName}`, true, 28);
      text += ' The newspapers ask what, exactly, they did to deserve it.';
    }
  }
  log(text, 'system', 'good');
  return result(true, text);
}

/** Takes a title away. It is within a monarch's power, and it is never forgotten. */
export function revoke(titleId) {
  const p = player();
  if (!mayGrant()) return result(false, 'Only a reigning monarch can revoke a title.', 'neutral');
  const cid = p.royal.countryId;
  const t = titles(cid).find((x) => x.id === titleId && x.status === 'active');
  if (!t || t.holder.type === 'player') return result(false, 'That title cannot be revoked.', 'neutral');
  const w = who(t);
  const name = titleName(t);
  const d = dyn.house(cid);
  const disgraced = (w?.person && (w.person.out === 'removed')) || (w?.npc && w.npc.meters.relationship < 15);
  t.status = 'revoked';
  note(t, `Revoked by ${dyn.nameOf(d, dyn.playerPerson(d))}. ${w?.name ?? 'The holder'} was the last to hold it.`);
  t.holder = null;
  if (w?.person) { fame.shift('family', disgraced ? -2 : -10, `stripping ${w.name} of a title`); w.person.t.loyalty = clamp(w.person.t.loyalty - 30); dyn.chronicle(d, `${w.name} was stripped of the title ${name}.`, [w.person.id]); }
  if (w?.npc) { w.npc.meters.relationship = clamp(w.npc.meters.relationship - 45); delete w.npc.flags.peer; }
  d.standing = clamp(d.standing + (disgraced ? 2 : -2));
  const text = `${w?.name ?? 'The holder'} is ${name} no longer.${disgraced ? ' Few are sorry.' : ' It is your right, and it is thought harsh.'}`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}

// ---------- Inheritance ----------

/** Who a hereditary title passes to when its holder dies, as a new holder, or null if the line has ended. */
function heirOf(t) {
  const st = store.state;
  const h = t.holder;
  const sonsFirst = MONARCHIES[t.countryId].law.order !== 'absolute';
  const order = (kids) => (sonsFirst ? [...kids.filter((k) => k.gender === 'male'), ...kids.filter((k) => k.gender !== 'male')] : kids);
  if (h.type === 'house') {
    const d = st.dynasties?.[t.countryId];
    const kids = order(dyn.childrenOf(d.people, h.id).filter((k) => k.died == null && !k.adopted));
    if (!kids.length) return null;
    return kids[0].isPlayer ? { type: 'player' } : { type: 'house', id: kids[0].id };
  }
  if (h.type === 'npc') {
    if (t.heirIsPlayer && st.player.alive) return { type: 'player' };
    const kids = order(Object.values(st.npcs).filter((n) => n.alive && n.parentIds?.includes(h.id) && !n.adopted).sort((a, b) => b.age - a.age));
    return kids.length ? { type: 'npc', id: kids[0].id } : null;
  }
  if (h.type === 'name') {
    // An old family, followed loosely: usually there is an heir; now and then there is not.
    if (rng.chance(0.12)) return null;
    const c = COUNTRIES[t.countryId];
    const gender = sonsFirst ? (rng.chance(0.85) ? 'male' : 'female') : rng.pick(['male', 'female']);
    return { type: 'name', name: `${rng.pick(c.names[gender])} ${h.name.split(' ').slice(1).join(' ')}`, gender, born: yearNow() - rng.int(18, 55) };
  }
  return null;
}

const mortality = (age) => (age < 55 ? 0.004 : age < 70 ? 0.02 : age < 80 ? 0.05 : age < 90 ? 0.12 : 0.3);

/** Yearly: titles pass on, or die out. */
export function tickPeerage() {
  const p = player();
  ensureBirthTitle();
  const all = store.state.titles ?? {};
  for (const list of Object.values(all)) {
    for (const t of list) {
      if (t.status !== 'active' || !t.holder) continue;
      const h = t.holder;
      if (h.type === 'player') continue; // the player's own death is handled when the story passes on
      const w = who(t);
      const dead = h.type === 'name' ? rng.chance(mortality(yearNow() - h.born)) : !w || !w.alive;
      if (!dead) continue;
      const old = w?.name ?? 'the last holder';
      const was = titleName(t, w?.gender);
      const next = t.hereditary ? heirOf(t) : null;
      if (!next) {
        t.status = 'extinct';
        t.holder = null;
        note(t, t.hereditary ? `${old} died without an heir, and the title died with them.` : `${old} died. The title was for life, and ended with them.`);
        continue;
      }
      t.holder = next;
      t.heirIsPlayer = false;
      const now = who(t);
      note(t, `${old} died, and the title passed to ${now.name}.`);
      if (next.type === 'player' && p.royal) {
        p.royal.waiting = false;
        p.royal.rank = t.rank;
        p.royal.titleId = t.id;
        log(`${old} has died, and the title has come to you. You are ${titleName(t)}.`, 'system', 'neutral');
        milestone(`Inherited the title ${titleName(t)}.`, 'family');
      } else if (now.npc && p.npcIds.includes(now.npc.id)) {
        now.npc.flags.peer = titleName(t);
        log(`${now.npc.firstName} is ${titleName(t)} now, since ${old} died.`, 'system', 'neutral');
      } else if (was && w?.npc && p.npcIds.includes(w.npc.id)) log(`With ${old} gone, the title of ${was} has passed to ${now.name}.`);
    }
  }
}

/**
 * When the story passes to an heir: the old player's titles go where the law
 * sends them. Called once the new state is in place. `old` is the previous
 * state, `h` the heir as they were.
 */
export function carryTitles(old, h) {
  if (!old.titles) return '';
  store.state.titles = old.titles;
  const p = player();
  let mine = '';
  for (const list of Object.values(old.titles)) {
    for (const t of list) {
      if (t.status !== 'active' || !t.holder) continue;
      if (t.holder.type === 'npc' && t.holder.id === h.id) { t.holder = { type: 'player' }; mine = mine || titleName(t); continue; }
      if (t.holder.type !== 'player') continue;
      const name = `${old.player.firstName} ${old.player.lastName}`;
      // To the eldest child, if this heir is that child; otherwise to whichever child the law prefers, or nobody.
      const direct = t.hereditary && h.role === 'child' && !h.adopted;
      if (direct) { t.holder = { type: 'player' }; note(t, `${name} died, and the title passed to ${p.firstName} ${p.lastName}.`); mine = mine || titleName(t); }
      else { t.status = 'extinct'; t.holder = null; note(t, t.hereditary ? `${name} died without a child to inherit, and the title died with them.` : `${name} died. The title was for life.`); }
    }
  }
  if (mine && !p.royal) {
    const t = playerTitle(p.countryId);
    if (t) p.royal = { countryId: t.countryId, rank: t.rank, by: 'birth', line: null, image: 55, reigning: false, titleId: t.id };
  } else if (mine && p.royal && !ROYAL_RANKS.includes(p.royal.rank)) {
    const t = playerTitle(p.royal.countryId);
    if (t) { p.royal.rank = t.rank; p.royal.titleId = t.id; p.royal.waiting = false; }
  }
  return mine;
}

/** The peerage of a country, for the screens: active titles first, the player's own at the top. */
export function roll(countryId = player().royal?.countryId ?? country().id) {
  ensureBirthTitle();
  const order = nobleRanks(countryId).map((r) => r[0]);
  const rank = (t) => (t.status === 'active' ? 0 : 100) + (t.holder?.type === 'player' ? -50 : 0) + order.indexOf(t.rank);
  return [...titles(countryId)].sort((a, b) => rank(a) - rank(b)).map((t) => {
    const w = t.holder ? who(t) : null;
    return { id: t.id, name: titleName(t, t.status === 'active' ? undefined : 'male'), status: t.status, holder: w?.name ?? null, isPlayer: !!w?.isPlayer,
      created: t.created, hereditary: t.hereditary, grantedBy: t.grantedBy, history: t.history, canRevoke: mayGrant() && t.status === 'active' && t.holder?.type !== 'player' };
  });
}
