// Living in a neighborhood: what the player can do there, and what comes of it (engine/neighborhood.js keeps the
// places and people). Meeting neighbors, getting to know them, helping, disagreeing, community events, hosting,
// local places and work, roommates, and going back to places the family once lived.
//
// What a neighbor is to the player is the ordinary relationship (engine/relationships.js): an introduction makes an
// acquaintance (role 'neighbor'); time together can make a friend, and never by itself. Living next door changes how
// easily people meet, not what they think of each other. Luck here is keyed to the turn and the person, so trying the
// same thing twice in a turn does not reroll it, and none of it touches the game's dice.
import { store, log } from '../state.js';
import { clamp, cap, localCost, fmtMoney } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { VENUES, HOSTED, COMMUNITY_EVENTS, INTERESTS, PROFILES } from '../data/neighborhoods.js';
import { PART_TIME_BY_ID } from '../data/partTimeJobs.js';
import * as N from './neighborhood.js';
import { archiveIdOf, recordEvent, charge } from './chronicle.js';
import { remember } from './conditions.js';
import { techAvailable } from './digital/tech.js';
import { jobOptions, canWorkPartTime } from './partTime.js';
import { checkChance } from './eventEngine.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const S = () => store.state;
const P = () => store.state.player;
const turnKey = (state = S()) => `${state.year}:${state.month ?? 0}`;
const INTEREST_NAME = Object.fromEntries(INTERESTS.map(([k, n]) => [k, n]));

/** What the player has done this turn; reset each turn. */
function acts(state = S()) {
  const H = N.hoods(state);
  if (H.acts.at !== turnKey(state)) H.acts = { at: turnKey(state), done: {} };
  return H.acts.done;
}
const used = (key, state = S()) => !!acts(state)[key];
const use = (key, state = S()) => { acts(state)[key] = true; };
const roll = (state, key) => N.luck(state, `act/${archiveIdOf(state.player)}/${turnKey(state)}/${key}`);

/** How people find each other: in person, by letter, by telephone, by message, as the year allows. */
export function keepInTouchWay(state = S()) {
  const y = state.year; const c = state.player.countryId;
  if (techAvailable('instant', y, c) || techAvailable('mobile', y, c)) return { verb: 'message', noun: 'a message' };
  if (techAvailable('landline', y, c)) return { verb: 'ring', noun: 'a telephone call' };
  return { verb: 'write to', noun: 'a letter' };
}

// ---------- Standing in the neighborhood ----------

const repOf = (state, hoodId) => (N.hoods(state).rep[hoodId] ??= { help: 0, inv: 0, host: 0, trouble: 0 });
/** What the people who know the player there have seen them do. Only what really happened, and only to those who saw it. */
export function standing(state = S(), hoodId = N.currentHome(state)?.h) {
  if (!hoodId) return null;
  const r = repOf(state, hoodId);
  const known = N.knownIn(state, hoodId).length;
  const residents = N.residentsOf(state, hoodId).length;
  return {
    known, residents, ...r,
    familiarity: known === 0 ? 'Nobody knows you yet' : known <= 2 ? 'A few people know you' : known <= 6 ? 'Known on your street' : 'Known all over the neighborhood',
    reliability: r.help >= 4 ? 'Known as someone who helps' : r.help >= 1 ? 'Has helped out' : 'Not yet tested',
    involvement: r.inv + r.host >= 6 ? 'At the heart of things' : r.inv + r.host >= 2 ? 'Turns up and joins in' : 'Keeps to themselves',
    trouble: r.trouble >= 3 ? 'Some neighbors find you difficult' : r.trouble >= 1 ? 'One or two disagreements' : 'No trouble with anyone',
  };
}

// ---------- People ----------

/** A neighbor becomes a friend only through time spent: closeness, and more than one occasion. */
export function maybeFriends(state, n) {
  if (!n?.alive || n.role !== 'neighbor') return false;
  if (n.meters.relationship < 62 || (n.flags.hoodTimes ?? 0) < 3) return false;
  n.role = 'friend';
  n.flags.metAs = 'neighbor';
  delete n.flags.title;
  const p = state.player;
  if (p.age < 18 && n.age < 18) n.flags.childhoodFriend = { year: state.year, hood: N.hoods(state).res[n.id] ? N.hoods(state).hhs[N.hoods(state).res[n.id].hh]?.h ?? null : null };
  log(`You and ${n.firstName} are friends now: not just neighbors.`, 'system', 'good');
  if (store.state === state) recordEvent({ key: `hood:friend:${archiveIdOf(p)}:${n.id}`, type: 'friendship', title: `Became friends with ${n.firstName} ${n.lastName}`, text: 'A neighbor first.', people: [n.id], significance: 1, privacy: 'family' });
  const home = N.currentHome(state);
  if (home) N.note(state, { t: N.nowT(state), h: home.h, k: 'friends', text: `${p.firstName} and ${n.firstName} ${n.lastName} became friends.`, who: n.id });
  return true;
}
const closer = (state, n, d) => { n.meters.relationship = clamp(n.meters.relationship + d); n.lastInteractionAge = state.player.age; n.flags.hoodTimes = (n.flags.hoodTimes ?? 0) + 1; return maybeFriends(state, n); };

/** Interests the player shares with someone: from the player's passions and talents, and the resident's own. */
function shared(state, r) {
  const p = state.player;
  const mine = new Set();
  if ((p.talents?.music ?? 0) >= 55) mine.add('music');
  if ((p.talents?.sports ?? 0) >= 55 || p.sport) mine.add('sport');
  if ((p.stats?.intellect ?? 0) >= 65) { mine.add('books'); mine.add('chess'); }
  if (p.npcIds.some((id) => state.npcs[id]?.role === 'pet') || p.animals) mine.add('animals');
  for (const k of Object.keys(p.passions ?? {})) mine.add(k);
  return (r.in ?? []).filter((k) => mine.has(k));
}

/** What the player may do with someone who lives near them, by how well they know them, their ages and the year. */
export function neighborActions(state, resId) {
  const H = N.hoods(state);
  const r = H.res[resId];
  const p = state.player;
  if (!r || r.dead || !p.alive || p.legal?.incarceration) return [];
  const n = state.npcs[resId];
  const met = !!n && p.npcIds.includes(resId) && n.alive;
  const age = N.ageOf(r, state);
  const out = [];
  const done = (k) => used(`${k}:${resId}`, state);
  const here = N.currentHome(state);
  const sameHood = here && H.homes[H.hhs[r.hh]?.home]?.h === here.h;
  if (!met) {
    if (!sameHood) return [];
    if (p.age >= 5 && (age >= 5 || p.age >= 14)) out.push({ id: 'introduce', label: p.age < 13 && age < 16 ? 'Say hi and ask their name' : 'Introduce yourself', done: done('introduce') });
    if (p.age >= 3) out.push({ id: 'wave', label: 'Wave hello', done: done('wave') });
    return out;
  }
  out.push({ id: 'hello', label: 'Say hello', done: done('hello') });
  if (p.age >= 13 && age >= 13) out.push({ id: 'visit', label: sameHood ? 'Drop by for a while' : 'Go and visit', done: done('visit') });
  if (p.age >= 18 && age >= 16 && sameHood) out.push({ id: 'coffee', label: state.year >= 1700 ? 'Invite them over for coffee' : 'Invite them over', done: done('coffee') });
  if (p.age >= 4 && p.age <= 13 && age >= 3 && age <= 15) out.push({ id: 'play', label: 'Play together', done: done('play') });
  if (p.age >= 6 && p.age <= 14 && age >= 6 && age <= 15 && r.school && sameHood && state.year >= 1870) out.push({ id: 'school', label: 'Walk to school together', done: done('school') });
  if (p.age >= 12 && age >= 25 && sameHood) out.push({ id: 'help', label: 'Offer to help with something', done: done('help') });
  const pet = H.hhs[r.hh]?.pet;
  if (pet && p.age >= 10 && sameHood && age >= 16) out.push({ id: 'pet', label: `Offer to walk or feed ${pet.n}`, done: done('pet') });
  if (!sameHood && (r.gone || H.homes[H.hhs[r.hh]?.home]?.h !== here?.h)) out.push({ id: 'touch', label: `${cap(keepInTouchWay(state).verb)} them`, done: done('touch') });
  return out;
}

/** Does one of those things. */
export function neighborAct(resId, action, state = S()) {
  const H = N.hoods(state);
  const r = H.res[resId];
  const p = state.player;
  const options = neighborActions(state, resId);
  const opt = options.find((o) => o.id === action);
  if (!r || !opt) return result(false, 'That is not something you can do now.', 'neutral');
  if (opt.done) return result(false, 'You have already done that this time.', 'neutral');
  use(`${action}:${resId}`, state);
  const rr = roll(state, `${action}/${resId}`);
  const n = state.npcs[resId];
  const name = r.f;
  const out = (text, tone = 'good') => { log(text, 'system', tone); return result(true, text, tone); };
  switch (action) {
    case 'introduce': {
      const style = r.so;
      const interests = shared(state, r);
      const base = style === 'outgoing' ? 38 : style === 'reserved' ? 26 : style === 'busy' ? 28 : 34;
      const met = N.befriend(state, resId, base + rr.int(0, 8) + (interests.length ? 6 : 0));
      if (!met) return result(false, 'There is nobody at home.', 'neutral');
      met.flags.hoodTimes = 1;
      const fam = Object.keys(r.fam ?? {}).find((x) => x !== archiveIdOf(p));
      const known = fam ? N.personOf(state, `@${fam}`) : null;
      const ancestor = fam ? state.archive?.people?.[fam] : null;
      if (ancestor) remember(met, 'knewFamily', `Knew ${ancestor.firstName} ${ancestor.lastName}, years ago.`);
      const text = ancestor ? `You introduced yourself to ${name} ${r.l}. "${ancestor.firstName}'s family? I knew ${ancestor.firstName}." They are glad to meet you.`
        : interests.length ? `You introduced yourself to ${name} ${r.l}, and found you are both into ${INTEREST_NAME[interests[0]]}. You talked for an hour.`
          : style === 'outgoing' ? `You introduced yourself to ${name} ${r.l}, who talked happily on the doorstep and said to come by any time.`
            : style === 'busy' ? `You introduced yourself to ${name} ${r.l}, who was friendly but in a hurry.`
              : style === 'reserved' ? `You introduced yourself to ${name} ${r.l}. A polite hello, and not much more: some people take time.`
                : `You introduced yourself to ${name} ${r.l}, who asked about your family and told you about theirs.`;
      void known;
      return out(text, style === 'reserved' ? 'neutral' : 'good');
    }
    case 'wave': { r.seen = (r.seen ?? 0) + 1; return out(`You waved to ${r.seen >= 2 ? name : `someone from the ${H.hhs[r.hh]?.n ?? ''} household`}. They waved back.`, 'neutral'); }
    case 'hello': { closer(state, n, rr.int(1, 2)); return out(`You stopped to chat with ${name} for a few minutes.`, 'neutral'); }
    case 'visit': { const f = closer(state, n, rr.int(3, 6)); return out(`You spent an afternoon at ${name}'s.${f ? '' : ''}`); }
    case 'coffee': {
      const yes = rr.chance(clamp(0.45 + (n.meters.relationship - 40) / 80 + (r.so === 'outgoing' ? 0.15 : r.so === 'busy' ? -0.15 : 0), 0.15, 0.95));
      if (!yes) return out(`You invited ${name} over. They could not make it this time, and said so kindly.`, 'neutral');
      closer(state, n, rr.int(4, 8));
      return out(`${name} came over for coffee and stayed for two.`);
    }
    case 'play': { closer(state, n, rr.int(3, 7)); return out(p.age <= 6 ? `You and ${name} played together, with a grown-up keeping an eye on you.` : `You and ${name} played until it got dark and someone called you both in.`); }
    case 'school': { closer(state, n, rr.int(2, 4)); return out(`You walked to school with ${name}, the long way round.`); }
    case 'help': {
      closer(state, n, rr.int(4, 7));
      repOf(state, N.hoods(state).hhs[r.hh]?.h ?? N.currentHome(state).h).help += 1;
      (r.owes ??= {})[archiveIdOf(p)] = N.nowT(state);
      return out(`You helped ${name} with ${rr.pick(['the shopping', 'a leaking gutter', 'a pile of boxes', 'their garden', 'a broken fence', 'a form they could not make sense of'])}. They were grateful.`);
    }
    case 'pet': {
      const pet = H.hhs[r.hh].pet;
      closer(state, n, rr.int(2, 5));
      return out(`${name} said yes, and you took ${pet.n} out. ${pet.s === 'dog' ? 'A very good walk.' : pet.s === 'cat' ? `${pet.n} allowed it.` : `${pet.n} approved.`}`);
    }
    case 'touch': { const w = keepInTouchWay(state); closer(state, n, rr.int(2, 5)); return out(`You sent ${name} ${w.noun}. ${w.noun === 'a letter' ? 'The reply came weeks later, four pages long.' : 'It was good to hear from each other.'}`); }
    default: return result(false, 'Nothing happens.', 'neutral');
  }
}

// ---------- Things to do ----------

/** The neighborhood activities open to the player now, with why any is closed. */
export function activities(state = S()) {
  const p = state.player;
  const home = N.currentHome(state);
  if (!home || !p.alive || p.legal?.incarceration) return [];
  const H = N.hoods(state);
  const hood = H.list[home.h];
  const open = (k) => hood.venues.some((v) => v.k === k && v.to == null);
  const known = N.knownIn(state, hood.id);
  const list = [
    { id: 'walk', label: 'Take a walk', sub: 'See who is about.', ok: p.age >= 6, why: 'With a grown-up, when you are older.' },
    { id: 'park', label: open('playground') && p.age <= 11 ? 'Go to the playground' : 'Visit the park', sub: p.age <= 5 ? 'With a grown-up.' : 'Fresh air, and other people.', ok: p.age >= 2 && (open('park') || open('playground') || hood.p === 'rural' || PROFILES[hood.p].gauge.parks >= 50), why: 'There is no park within reach.' },
    { id: 'knock', label: 'Knock on a neighbor\'s door', sub: 'Meet someone you have not met.', ok: p.age >= 13, why: 'You are a little young to go knocking on your own.' },
    { id: 'volunteer', label: 'Volunteer locally', sub: 'The cleanup crew, the food bank, the reading club.', ok: p.age >= 12, why: 'From 12.' },
    { id: 'club', label: 'Go to a local club', sub: 'Something people round here do together.', ok: p.age >= 6 && (open('community') || open('church') || open('library') || open('school')), why: 'There is nowhere nearby that runs one.' },
    { id: 'helpout', label: 'Help a neighbor out', sub: 'Someone you know could use a hand.', ok: p.age >= 10 && known.some((n) => n.age >= 18), why: 'You do not know anyone well enough to offer yet.' },
    { id: 'explore', label: 'Explore the neighborhood', sub: 'The back streets, the history, what is new.', ok: p.age >= 8, why: 'From 8, or with a grown-up.' },
  ];
  return list.map((a) => ({ ...a, done: used(`act:${a.id}`, state) }));
}

/** Unmet residents near the player, nearest first: who a walk or a knock might find. */
function unmetNear(state, filter = () => true) {
  const home = N.currentHome(state);
  if (!home) return [];
  const H = N.hoods(state);
  return N.around(state, home.id).filter((x) => x.hh && !x.hh.me && !x.hh.fam).flatMap((x) => x.hh.m.map((id) => ({ r: H.res[id], near: x.prox.near }))).filter((x) => x.r && N.aliveRes(x.r) && !(state.npcs[x.r.id] && state.player.npcIds.includes(x.r.id)) && filter(x.r));
}

export function doActivity(id, state = S()) {
  const a = activities(state).find((x) => x.id === id);
  if (!a) return result(false, 'That is not something you can do here.', 'neutral');
  if (!a.ok) return result(false, a.why, 'neutral');
  if (a.done) return result(false, 'You have already done that this time.', 'neutral');
  use(`act:${id}`, state);
  const p = state.player;
  const H = N.hoods(state);
  const home = N.currentHome(state);
  const hood = H.list[home.h];
  const rr = roll(state, id);
  const out = (text, tone = 'good') => { log(text, 'system', tone); return result(true, text, tone); };
  p.stats.mood = clamp(p.stats.mood + 1);
  switch (id) {
    case 'walk': {
      const seen = unmetNear(state, (r) => N.ageOf(r, state) >= 5);
      const dogs = N.around(state, home.id).filter((x) => x.hh?.pet?.s === 'dog' && x.prox.near >= 2);
      if (dogs.length && rr.chance(0.35)) { const d = rr.pick(dogs); const owner = H.res[d.hh.m.find((m) => H.res[m] && N.ageOf(H.res[m], state) >= 16)] ; if (owner) { owner.seen = (owner.seen ?? 0) + 1; return out(`On your walk you met ${d.hh.pet.n}, the ${d.hh.n} household's dog, and ${owner.seen >= 2 ? owner.f : 'whoever was on the other end of the lead'}.`, 'neutral'); } }
      if (seen.length && rr.chance(0.6)) { const x = rr.pick(seen.slice(0, 6)).r; x.seen = (x.seen ?? 0) + 1; return out(`A walk round ${hood.name}. You passed ${x.seen >= 2 ? `${x.f} from the ${x.l} household again; you know each other by sight now` : `someone from the ${x.l} household`}.`, 'neutral'); }
      return out(`A walk round ${hood.name}. ${rr.pick(['Quiet streets and somebody\'s radio.', 'The light was lovely.', 'You noticed a house you had never looked at properly.', 'It was good to be out.'])}`, 'neutral');
    }
    case 'park': {
      const kids = unmetNear(state, (r) => Math.abs(N.ageOf(r, state) - p.age) <= 2 && N.ageOf(r, state) <= 15);
      if (p.age <= 13 && kids.length && rr.chance(0.6)) {
        const k = rr.pick(kids).r;
        const n = N.befriend(state, k.id, 38 + rr.int(0, 10));
        n.flags.hoodTimes = 1;
        return out(`At the ${p.age <= 11 ? 'playground' : 'park'} you met ${k.f}, who lives ${N.proximity(state, home.id, H.hhs[k.hh].home).word}. ${p.age <= 5 ? 'The grown-ups talked while you two played.' : 'You played until it was time to go.'}`);
      }
      return out(rr.pick(['An hour in the park. You came back in a better mood.', 'You sat in the sun and watched the world go by.', 'Somebody\'s kite got stuck in a tree, and half the park helped.']), 'neutral');
    }
    case 'knock': {
      const people = unmetNear(state, (r) => N.ageOf(r, state) >= 16);
      if (!people.length) return out('You know everyone near you already.', 'neutral');
      const x = people[0].r;
      return neighborAct(x.id, 'introduce', state);
    }
    case 'volunteer': {
      repOf(state, hood.id).inv += 1;
      const n = N.knownIn(state, hood.id).find((m) => m.age >= 12);
      if (n && rr.chance(0.5)) closer(state, n, 3);
      p.hidden.karma = clamp((p.hidden.karma ?? 50) + 1);
      return out(`You volunteered ${rr.pick(['at the food bank', 'with the community cleanup', 'at the reading club for younger children', 'at the community center'])}.${n ? ` ${n.firstName} was there too.` : ''}`);
    }
    case 'club': {
      const mine = shared(state, { in: INTERESTS.map(([k]) => k) });
      const topic = mine[0] ?? rr.pick(INTERESTS.filter(([, , from]) => !from || state.year >= from))[0];
      const fellow = N.residentsOf(state, hood.id).filter((r) => (r.in ?? []).includes(topic) && !(state.npcs[r.id] && p.npcIds.includes(r.id)) && Math.abs(N.ageOf(r, state) - p.age) <= (p.age < 18 ? 3 : 40));
      repOf(state, hood.id).inv += 1;
      if (fellow.length) { const r = rr.pick(fellow); const n = N.befriend(state, r.id, 40 + rr.int(0, 8)); n.flags.hoodTimes = 1; return out(`You went to the ${INTEREST_NAME[topic]} club at the local hall, and got talking to ${r.f} ${r.l}, who lives nearby.`); }
      return out(`You went to the ${INTEREST_NAME[topic]} club at the local hall. Friendly people.`, 'neutral');
    }
    case 'helpout': {
      const n = rr.pick(N.knownIn(state, hood.id).filter((m) => m.age >= 18));
      return neighborAct(n.id, 'help', state).ok ? result(true, `You helped ${n.firstName} out.`) : result(false, 'Nobody needed a hand today.', 'neutral');
    }
    case 'explore': {
      const old = H.blocks[home.b].est;
      const longest = N.residentsOf(state, hood.id).map((r) => ({ r, since: H.hhs[r.hh]?.from })).filter((x) => x.since != null).sort((a, b) => a.since - b.since)[0];
      const open = hood.venues.filter((v) => v.to == null);
      const closed = hood.venues.filter((v) => v.to != null);
      const facts = [`${hood.name} goes back to about ${hood.est}; your ${H.blocks[home.b].kind === 'building' ? 'building' : 'street'} to about ${old}.`];
      if (longest) facts.push(`The ${longest.r.l} household has been here longest, since ${N.yearOf(longest.since)}.`);
      if (closed.length) facts.push(`Where ${closed[closed.length - 1].name} used to be, the sign is still faintly there.`);
      else if (open.length) facts.push(`${rr.pick(open).name} is busier than you thought.`);
      return out(`You explored ${hood.name}. ${facts.join(' ')}`, 'neutral');
    }
    default: return result(false, 'Nothing happens.', 'neutral');
  }
}

// ---------- Local places ----------

/** The places in the player's neighborhood that are open now. */
export function places(state = S()) {
  const home = N.currentHome(state);
  if (!home) return [];
  const H = N.hoods(state);
  const hood = H.list[home.h];
  const p = state.player;
  return hood.venues.filter((v) => v.to == null && N.venueAvailable(v.k, state.year)).map((v) => {
    const o = H.res[v.owner];
    const regular = (v.reg?.[archiveIdOf(p)] ?? 0);
    return { ...v, kind: VENUES[v.k].name, owner: o ? { id: o.id, name: o.f && state.npcs[o.id] && p.npcIds.includes(o.id) ? `${o.f} ${o.l}` : null } : null, regular,
      canVisit: (!VENUES[v.k].adult || p.age >= 18) && (p.age >= 8 || VENUES[v.k].kid), visited: used(`venue:${v.id}`, state),
      canWork: !!VENUES[v.k].work && !!o && !p.career?.partTime && canWorkPartTime() };
  });
}

export function visitPlace(venueId, state = S()) {
  const v = places(state).find((x) => x.id === venueId);
  if (!v || !v.canVisit) return result(false, 'You cannot go there.', 'neutral');
  if (v.visited) return result(false, 'You have been already this time.', 'neutral');
  use(`venue:${v.id}`, state);
  const H = N.hoods(state);
  const venue = N.hoodOf(N.currentHome(state).h, state).venues.find((x) => x.id === venueId);
  const me = archiveIdOf(state.player);
  venue.reg ??= {};
  venue.reg[me] = (venue.reg[me] ?? 0) + 1;
  const o = H.res[venue.owner];
  let text = `You went to ${venue.name}.`;
  if (o && venue.reg[me] >= 2 && !o.dead) {
    const known = state.npcs[o.id] && state.player.npcIds.includes(o.id);
    const n = known ? state.npcs[o.id] : N.befriend(state, o.id, 34);
    if (!known) { n.flags.title = `Runs ${venue.name}`; text += ` ${o.f} ${o.l}, who runs it, knows your face now and introduced themselves.`; } else closer(state, n, 1);
  }
  if (venue.reg[me] === 4) text += ' You are a regular.';
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}

/** Asks about work at a local place. A word from someone who knows the player helps; it never decides. */
export function askForWork(venueId, state = S()) {
  const p = state.player;
  const v = places(state).find((x) => x.id === venueId);
  if (!v?.canWork) return result(false, 'There is no work going there for you.', 'neutral');
  if (used(`work:${venueId}`, state) || N.hoods(state).acts.workYear === state.year + ':' + venueId) return result(false, 'You already asked this year.', 'neutral');
  const H = N.hoods(state);
  H.acts.workYear = state.year + ':' + venueId;
  use(`work:${venueId}`, state);
  const jobId = VENUES[v.k].work === 'barista' ? 'barista' : VENUES[v.k].work === 'waiter' ? 'cafe' : 'cashier';
  const job = PART_TIME_BY_ID[jobId];
  const option = jobOptions().find((o) => o.id === jobId);
  if (!job || !option) return result(false, 'They are not taking anyone on.', 'neutral');
  if (!option.available) return result(false, option.reason, 'neutral');
  const owner = state.npcs[v.owner?.id ?? H.list[N.currentHome(state).h].venues.find((x) => x.id === venueId).owner];
  const word = owner && p.npcIds.includes(owner.id) ? clamp((owner.meters.relationship - 45) / 200, 0, 0.15) : 0;
  const rr = roll(state, `work/${venueId}`);
  const venue = H.list[N.currentHome(state).h].venues.find((x) => x.id === venueId);
  if (!rr.chance(clamp(checkChance(job.hire, {}) + word, 0.05, 0.95))) {
    const text = `You asked about work at ${venue.name}. Nothing for now${word ? `, though ${owner.firstName} said they would keep you in mind` : ''}.`;
    log(text, 'system', 'neutral');
    return result(false, text, 'neutral');
  }
  // The same part-time job the rest of the game knows, at this place, with its owner as manager.
  const c = COUNTRIES[p.countryId];
  const boss = owner ?? N.befriend(state, venue.owner, 45);
  for (const id of p.npcIds) { const x = state.npcs[id]; if (x?.flags.tag === 'manager') { x.flags.tag = 'formerManager'; x.flags.title = 'Former manager'; } }
  if (!p.npcIds.includes(boss.id)) N.befriend(state, boss.id, 45);
  boss.flags.tag = 'manager'; boss.flags.title = `Manager at ${venue.name}`; boss.flags.workedWith = venue.name;
  p.career.partTime = { jobId, title: job.title, place: venue.name, salary: option.pay, hours: job.hours, since: p.age, campus: false, venueId };
  p.counters.jobsHeld += 1;
  const text = `${boss.firstName} took you on at ${venue.name}, as a ${job.title.toLowerCase()}, for ${fmtMoney(option.pay, c)} a year.`;
  log(text, 'system', 'good');
  return result(true, text);
}

// ---------- Hosting ----------

/** Gatherings the player can host, and who they could invite: people they know, living nearby. */
export function hostOptions(state = S()) {
  const p = state.player;
  const home = N.currentHome(state);
  if (!home || !p.alive) return { kinds: [], guests: [] };
  const H = N.hoods(state);
  const block = H.blocks[home.b];
  const fresh = state.year - N.yearOf(H.cur.since) <= 1;
  const kinds = Object.entries(HOSTED).filter(([, x]) => p.age >= x.minAge && (!x.blocks || x.blocks.includes(block.kind)) && (!x.fresh || fresh))
    .map(([id, x]) => ({ id, name: x.name, cost: localCost(x.cost, COUNTRIES[p.countryId]), max: x.max }));
  const guests = N.knownIn(state, home.h).concat(p.npcIds.map((id) => state.npcs[id]).filter((n) => n?.alive && n.role === 'friend' && !N.knownIn(state, home.h).includes(n)))
    .filter((n) => n.age >= (p.age < 18 ? 3 : 14)).map((n) => ({ id: n.id, name: `${n.firstName} ${n.lastName}`, rel: Math.round(n.meters.relationship), near: !!H.res[n.id] }));
  return { kinds, guests, done: used('host', state) };
}

/**
 * Hosts a gathering: charged once, the guests asked one by one (each may say no), and what came of it. Most
 * gatherings are simply pleasant.
 */
export function host(kindId, guestIds, budget = 'modest', state = S()) {
  const p = state.player;
  const o = hostOptions(state);
  const kind = o.kinds.find((k) => k.id === kindId);
  if (!kind) return result(false, 'You cannot host that now.', 'neutral');
  if (o.done) return result(false, 'You have already hosted something this time.', 'neutral');
  const ids = [...new Set(guestIds)].filter((id) => o.guests.some((g) => g.id === id)).slice(0, kind.max);
  if (!ids.length) return result(false, 'Invite someone first.', 'neutral');
  const cost = Math.round(kind.cost * (budget === 'generous' ? 1.8 : 1));
  const paid = charge({ amount: cost, kind: 'gathering', memo: `${kind.name}`, key: `host:${archiveIdOf(p)}:${turnKey(state)}` }, p);
  if (!paid.ok) return result(false, paid.why === 'Not enough money.' ? `It would cost ${fmtMoney(cost, COUNTRIES[p.countryId])}. You do not have it.` : paid.why, 'neutral');
  use('host', state);
  const rr = roll(state, `host/${kindId}`);
  const H = N.hoods(state);
  const came = []; const sorry = [];
  for (const id of ids) {
    const n = state.npcs[id];
    const r = H.res[id];
    const busy = r?.so === 'busy' ? 0.15 : 0;
    if (rr.chance(clamp(0.55 + (n.meters.relationship - 40) / 100 - busy, 0.2, 0.95))) came.push(n); else sorry.push(n);
  }
  const lift = budget === 'generous' ? 2 : 0;
  let friends = 0;
  for (const n of came) if (closer(state, n, rr.int(3, 7) + lift)) friends += 1;
  // Neighbors who meet at the player's gathering may get on too: a new acquaintance among guests is just noted.
  repOf(state, N.currentHome(state).h).host += 1;
  p.stats.mood = clamp(p.stats.mood + (came.length ? 5 : -2));
  const hitch = came.length >= 3 && rr.chance(0.12) ? rr.pick([' Two of the guests disagreed loudly about parking, and made it up over dessert.', ' Someone broke a glass. Nobody minded.', ' The food ran out early, and nobody minded.']) : '';
  const text = came.length
    ? `Your ${kind.name.toLowerCase()}: ${came.map((n) => n.firstName).join(', ')} came${sorry.length ? `; ${sorry.map((n) => n.firstName).join(' and ')} sent apologies` : ''}. ${rr.pick(['A good evening.', 'People stayed late.', 'An easy, happy afternoon.'])}${hitch}${friends ? ' Some neighbors are friends now.' : ''}`
    : `Nobody could come to your ${kind.name.toLowerCase()}. You ate well, at least.`;
  log(text, 'system', came.length ? 'good' : 'neutral');
  const home = N.currentHome(state);
  if (came.length) {
    const ev = recordEvent({ key: `hood:host:${archiveIdOf(p)}:${turnKey(state)}`, type: 'gathering', title: `Hosted a ${kind.name.toLowerCase()}`, text: `With ${came.map((n) => n.firstName).join(', ')}.`, people: came.map((n) => archiveIdOf(n)), place: { countryId: p.countryId, city: p.city }, significance: 1, privacy: 'family' });
    N.note(state, { t: N.nowT(state), h: home.h, k: 'hosted', text: `${p.firstName} ${p.lastName} hosted a ${kind.name.toLowerCase()}, with ${came.map((n) => n.firstName).join(', ')}.`, who: `@${archiveIdOf(p)}`, home: home.id, ev: ev.id });
  }
  return result(true, text, came.length ? 'good' : 'neutral');
}

// ---------- Roommates ----------

export const roommate = (state = S()) => state.npcs[N.hoods(state).roommate] ?? null;
/** Who could move in: a friend who lives alone, or someone new from a notice. Only for a rented place the player lives in alone. */
export function roommateOptions(state = S()) {
  const p = state.player;
  const d = N.dwelling(state);
  if (!d || d.kind !== 'rent' || p.age < 18 || roommate(state)) return { ok: false, why: roommate(state) ? 'You already share.' : 'Only for a place you rent and live in.' , people: [] };
  if (p.npcIds.some((id) => ['spouse'].includes(state.npcs[id]?.role) && state.npcs[id].alive)) return { ok: false, why: 'You live with your spouse.', people: [] };
  const people = p.npcIds.map((id) => state.npcs[id]).filter((n) => n?.alive && n.role === 'friend' && n.age >= 18 && n.meters.relationship >= 50);
  return { ok: true, people };
}

/** Takes in a roommate: a friend (by id), or someone answering a notice (null). They share the rent from then on. */
export function takeRoommate(friendId = null, state = S()) {
  const o = roommateOptions(state);
  if (!o.ok) return result(false, o.why, 'neutral');
  const H = N.hoods(state);
  let n;
  if (friendId) { n = o.people.find((x) => x.id === friendId); if (!n) return result(false, 'They cannot move in.', 'neutral'); } else {
    // Someone new: a real person, made once, with a household they leave behind.
    const home = N.currentHome(state);
    const hood = H.list[home.h];
    const hh = N.makeHousehold(state, hood, { t: 'single', id: `${home.id}-notice` }, N.luck(state, `roommate/${archiveIdOf(state.player)}/${state.year}`), { shape: 'single' });
    const r = H.res[hh.m[0]];
    hh.home = null; hh.to = N.nowT(state);
    n = N.befriend(state, r.id, 40, 'roommate');
    n.role = 'roommate';
  }
  H.roommate = n.id;
  n.flags.roommateSince = state.year;
  N.syncHousehold(state);
  const text = `${n.firstName} moved in with you. You split the rent.`;
  log(text, 'system', 'good');
  N.note(state, { t: N.nowT(state), h: N.currentHome(state).h, k: 'roommate', text: `${n.firstName} ${n.lastName} moved in with ${state.player.firstName} as a roommate.`, who: n.id, home: N.currentHome(state).id });
  return result(true, text);
}

export function endRoommate(state = S()) {
  const n = roommate(state);
  if (!n) return result(false, 'You do not have a roommate.', 'neutral');
  const H = N.hoods(state);
  H.roommate = null;
  if (n.role === 'roommate') n.role = n.meters.relationship >= 55 ? 'friend' : 'neighbor', n.flags.title = 'Former roommate';
  N.syncHousehold(state);
  const text = `${n.firstName} moved out. You have the place to yourself again, and the whole rent.`;
  log(text, 'system', 'neutral');
  N.note(state, { t: N.nowT(state), h: N.currentHome(state)?.h, k: 'roommate', text: `${n.firstName} ${n.lastName} moved out.`, who: n.id });
  return result(true, text, 'neutral');
}
/** The share of rent the player pays: less with a roommate. Bills are shared less evenly than rent. */
export const rentShare = (state = S()) => (roommate(state)?.alive && N.dwelling(state)?.kind === 'rent' ? 0.6 : 1);

// ---------- Moving within a city ----------

/** Other neighborhoods of the city the player could rent in. */
export function homesToRent(state = S()) {
  const p = state.player;
  const d = N.dwelling(state);
  if (!d || d.kind !== 'rent' || p.age < 18) return [];
  const here = N.currentHome(state);
  const H = N.hoods(state);
  const known = Object.values(H.list).filter((h) => h.c === p.countryId && h.city === p.city && h.id !== here?.h);
  const out = known.map((h) => ({ hood: h.id, name: h.name, profile: PROFILES[h.p].name, known: true, cost: h.cost }));
  for (const pid of ['urban', 'apartments', 'suburban', 'smalltown', 'mixed', 'historic'].filter((x) => N.profileAvailable(x, p.countryId, state.year) && !known.some((h) => h.p === x) && x !== H.list[here?.h]?.p)) out.push({ profile: PROFILES[pid].name, profileId: pid, known: false, cost: PROFILES[pid].cost });
  return out.slice(0, 5);
}

/** Moves to a rented home in another neighborhood of the same city (or back to one the family knew). */
export function moveTo(choice, state = S()) {
  const p = state.player;
  const d = N.dwelling(state);
  if (!d || d.kind !== 'rent' || p.age < 18) return result(false, 'You can only move between rented homes in your city.', 'neutral');
  if (used('move', state)) return result(false, 'You have only just moved.', 'neutral');
  const H = N.hoods(state);
  const target = choice.hood ? H.list[choice.hood] : null;
  if (choice.hood && (!target || target.city !== p.city || target.c !== p.countryId)) return result(false, 'That is not in your city.', 'neutral');
  const cost = localCost(400, COUNTRIES[p.countryId]);
  const paid = charge({ amount: cost, kind: 'move', memo: 'Moving costs', key: `hoodmove:${archiveIdOf(p)}:${turnKey(state)}` }, p);
  if (!paid.ok) return result(false, `Moving would cost ${fmtMoney(cost, COUNTRIES[p.countryId])}.`, 'neutral');
  use('move', state);
  const home = N.findHome(state, d, choice.hood ? { hood: choice.hood } : { profile: choice.profileId });
  const back = choice.hood && H.past.some((x) => x.hood === choice.hood && x.who !== archiveIdOf(p) || (x.hood === choice.hood && x.to != null));
  N.moveInto(state, home, d, back ? 'came back' : 'moved');
  if (roommate(state)) endRoommate(state);
  const hood = H.list[home.h];
  const text = `You moved to ${home.label}${H.blocks[home.b].kind === 'building' ? ` in ${H.blocks[home.b].name}` : ` on ${H.blocks[home.b].name}`}, in ${hood.name}.${back ? ' Back where it began.' : ''}`;
  log(text, 'system', 'good');
  return result(true, text);
}

// ---------- Places the family has lived ----------

/** Earlier homes in the city the player lives in now that they could go and see: their own, or their family's. */
export function placesToRevisit(state = S()) {
  const p = state.player;
  const H = N.hoods(state);
  const me = archiveIdOf(p);
  const here = N.currentHome(state);
  const out = new Map();
  for (const x of H.past) {
    const hood = H.list[x.hood];
    if (!hood || hood.c !== p.countryId || hood.city !== p.city || x.hood === here?.h || x.to == null) continue;
    const ancestor = state.archive?.people?.[x.who];
    const mine = x.who === me;
    if (!mine && !ancestor) continue;
    const key = x.hood;
    if (!out.has(key)) out.set(key, { hood: x.hood, name: hood.name, home: x.home, mine, who: mine ? 'you' : `${ancestor.firstName} ${ancestor.lastName}`, from: N.yearOf(x.from), to: N.yearOf(x.to), childhood: mine && N.yearOf(x.from) - (p.birthYear ?? 0) < 18 });
  }
  return [...out.values()];
}

/**
 * Goes back to look at an old home: who lives there now, and anyone from those years still in the neighborhood,
 * who may be glad to see the player again. Knowledge comes from real records: an ancestor's friend recognizes the
 * family only if they really knew them.
 */
export function revisit(hoodId, state = S()) {
  const p = state.player;
  const spot = placesToRevisit(state).find((x) => x.hood === hoodId);
  if (!spot) return result(false, 'You have no reason to go there.', 'neutral');
  if (used(`revisit:${hoodId}`, state)) return result(false, 'You were there just now.', 'neutral');
  use(`revisit:${hoodId}`, state);
  const H = N.hoods(state);
  const hood = H.list[hoodId];
  N.wake(state, hood);
  const home = H.homes[spot.home];
  const now = home?.hh ? H.hhs[home.hh] : null;
  const me = archiveIdOf(p);
  const lines = [`You went back to ${hood.name}, to ${home?.label ?? 'the old place'}${spot.mine ? '' : `, where ${spot.who} lived`}.`];
  lines.push(now && !now.me && !now.fam ? `The ${now.n} household lives there now${N.yearOf(now.from) ? `, since ${N.yearOf(now.from)}` : ''}.` : home?.hh ? 'Your family still lives there.' : 'It stands empty.');
  const familiar = N.residentsOf(state, hoodId).filter((r) => (r.met?.[me] || Object.keys(r.fam ?? {}).length) && N.aliveRes(r));
  const met = [];
  for (const r of familiar.slice(0, 2)) {
    const knewMe = !!r.met?.[me];
    const knewWho = Object.keys(r.fam ?? {}).find((x) => x !== me && state.archive?.people?.[x]);
    if (!knewMe && !knewWho) continue;
    const n = N.befriend(state, r.id, null);
    if (!n) continue;
    n.meters.relationship = clamp(n.meters.relationship + 6);
    n.lastInteractionAge = p.age;
    met.push(n);
    if (knewMe) lines.push(`${r.f} ${r.l} still lives on ${H.blocks[H.homes[H.hhs[r.hh].home].b].name}, and knew you at once.`);
    else { const a = state.archive.people[knewWho]; lines.push(`${r.f} ${r.l}, who lives there still, knew ${a.firstName} ${a.lastName}: "${a.firstName} was a ${r.fam[knewWho] === 'friend' ? 'good friend' : 'good neighbor'} to us."`); remember(n, 'knewFamily', `Knew ${a.firstName} ${a.lastName}.`); }
  }
  const text = lines.join(' ');
  log(text, 'system', 'good');
  const kind = spot.mine ? (spot.childhood ? 'the street you grew up on' : 'an old home') : `${spot.who}'s home`;
  recordEvent({ key: `hood:revisit:${me}:${hoodId}:${state.year}`, type: 'revisit', title: `Went back to ${kind}`, text, people: met.map((n) => archiveIdOf(n)), place: { countryId: hood.c, city: hood.city }, significance: 1, privacy: 'family' });
  N.note(state, { t: N.nowT(state), h: hoodId, k: 'revisit', text: `${p.firstName} ${p.lastName} came back to see ${home?.label ?? 'the old place'}.`, who: `@${me}`, home: spot.home });
  return result(true, text);
}

// ---------- Scenes ----------

/** What a neighborhood scene's choice does (effects.js, type 'hood'). Returns a line to show, if any. */
export function hoodChoice(v, cast, state = S()) {
  const H = N.hoods(state);
  const p = state.player;
  const id = cast.person ?? cast.words?.res;
  const r = H.res[id];
  const rr = N.luck(state, `scene/${v.do}/${id ?? ''}/${N.nowT(state)}`);
  const home = N.currentHome(state);
  const w = cast.words ?? {};
  switch (v.do) {
    case 'meet': {
      if (!r) return null;
      const n = N.befriend(state, id, v.rel ?? 36 + rr.int(0, 8));
      if (n) { n.flags.hoodTimes = Math.max(1, n.flags.hoodTimes ?? 0); if (v.rel >= 45) closer(state, n, 0); }
      if (v.help && home) repOf(state, home.h).help += 1;
      if (v.kid && n) remember(n, 'firstMet', `Met ${p.age <= 6 ? 'as little children' : 'as children'}, ${w.where ?? 'nearby'}.`);
      return null;
    }
    case 'closer': { const n = state.npcs[id]; if (n?.alive) { if (!p.npcIds.includes(id)) N.befriend(state, id); closer(state, n, v.by ?? 4); } return null; }
    case 'attend': {
      const hood = home && H.list[home.h];
      if (!hood) return null;
      const kind = w.kind;
      const pool = N.residentsOf(state, hood.id).filter((x) => x.id !== id && (COMMUNITY_EVENTS[kind]?.who !== 'adult' || N.ageOf(x, state) >= 16));
      const there = rr.shuffle(pool).slice(0, 4);
      const org = id ? N.befriend(state, id, p.npcIds.includes(id) ? null : 34) : null;
      if (org) closer(state, org, v.how === 'help' ? 6 : 2);
      let met = null;
      for (const x of there) {
        const n = state.npcs[x.id];
        if (n && p.npcIds.includes(x.id)) closer(state, n, 2);
        else if (!met && Math.abs(N.ageOf(x, state) - p.age) <= (p.age < 18 ? 4 : 40)) { met = N.befriend(state, x.id, 33 + rr.int(0, 6)); if (met) met.flags.hoodTimes = 1; }
      }
      repOf(state, hood.id).inv += v.how === 'help' ? 2 : 1;
      p.stats.mood = clamp(p.stats.mood + 3);
      const people = [id, ...there.map((x) => x.id)].filter((x) => state.npcs[x] && p.npcIds.includes(x));
      recordEvent({ key: `hood:event:${w.eventId}:${archiveIdOf(p)}`, type: 'community_event', title: `${cap(w.event ?? 'A neighborhood event')} in ${hood.name}`, text: v.how === 'help' ? 'Helped organize it.' : 'Went along.',
        people: people.map((x) => archiveIdOf(state.npcs[x])), place: { countryId: hood.c, city: hood.city }, significance: 1, privacy: 'public' });
      N.note(state, { t: N.nowT(state), h: hood.id, k: 'attended', text: `${p.firstName} ${p.lastName} ${v.how === 'help' ? 'helped run' : 'went to'} the ${w.event}.`, who: `@${archiveIdOf(p)}` });
      return met ? `You got talking to ${met.firstName} ${met.lastName}, from the ${H.res[met.id]?.l ?? met.lastName} household.` : null;
    }
    case 'help': {
      const n = N.befriend(state, id, null);
      if (!n) return null;
      if (v.how === 'help') { closer(state, n, 7); (r.owes ??= {})[archiveIdOf(p)] = N.nowT(state); if (home) repOf(state, home.h).help += 1; recordEvent({ key: `hood:help:${archiveIdOf(p)}:${id}:${state.year}`, type: 'neighbor_help', title: `Helped ${n.firstName} ${n.lastName}`, text: w.need ?? '', people: [archiveIdOf(n)], significance: 1, privacy: 'family' }); }
      else if (v.how === 'suggest') closer(state, n, 1);
      return null;
    }
    case 'dispute': {
      const d = H.disputes.find((x) => x.id === w.disputeId);
      const n = N.befriend(state, id, null);
      if (!d || !n) return null;
      const settle = { calm: 0.75, compromise: 0.85, ask: 0.8, mediate: 0.8, boundary: 0.6, formal: 0.7 }[v.how] ?? 0.6;
      const ok = rr.chance(clamp(settle + (n.meters.relationship - 40) / 200));
      d.status = ok ? 'resolved' : 'open';
      d.how = v.how;
      n.meters.relationship = clamp(n.meters.relationship + ({ calm: ok ? 3 : -2, compromise: ok ? 4 : -1, ask: ok ? 5 : 0, mediate: 1, boundary: -3, formal: -6 }[v.how] ?? 0));
      if (v.how === 'formal' && home) repOf(state, home.h).trouble += 1;
      recordEvent({ key: `hood:dispute:${d.id}`, type: 'neighbor_dispute', title: `A disagreement with ${n.firstName} ${n.lastName}`, text: ok ? 'Sorted out.' : 'Not settled yet.', people: [archiveIdOf(n)], significance: 0, privacy: 'private' });
      return ok ? `It is settled${v.how === 'ask' ? `: ${n.firstName} had no idea, and is mortified.` : '.'}` : 'It is not settled, but it may yet blow over.';
    }
    case 'moving': {
      const n = state.npcs[id];
      if (!n?.alive) return null;
      if (v.how === 'party') closer(state, n, 6);
      if (v.how === 'help') { closer(state, n, 8); if (r) (r.owes ??= {})[archiveIdOf(p)] = N.nowT(state); }
      if (v.how === 'keep') { n.flags.keepInTouch = true; n.meters.relationship = clamp(n.meters.relationship + 3); }
      if (!p.npcIds.includes(id)) p.npcIds.push(id);
      return null;
    }
    case 'business': {
      const n = N.befriend(state, id, null);
      if (!n) return null;
      closer(state, n, v.how === 'support' ? 5 : 2);
      const hood = home && H.list[home.h];
      const venue = hood?.venues.find((x) => x.id === w.venueId);
      if (venue) { venue.reg ??= {}; venue.reg[archiveIdOf(p)] = (venue.reg[archiveIdOf(p)] ?? 0) + 1; }
      if (hood) repOf(state, hood.id).inv += 1;
      return null;
    }
    case 'elder': {
      const n = N.befriend(state, id, v.how === 'listen' ? 46 : 34);
      if (n && v.how === 'listen') { n.flags.hoodTimes = 2; remember(n, 'stories', `Told you about ${w.hood ?? 'the neighborhood'} as it was, ${w.years ?? 'many'} years ago.`); }
      return null;
    }
    case 'reflect': { p.stats.mood = clamp(p.stats.mood + (v.by ?? 0)); return null; }
    case 'reunion': {
      const hoodId = w.hoodId;
      const me = archiveIdOf(p);
      const old = Object.values(H.res).filter((x) => x.met?.[me] != null && !x.dead && x.id.startsWith(`npc_${hoodId}r`)).slice(0, 3);
      const met = [];
      for (const x of old) { const n = N.befriend(state, x.id, null); if (n) { n.meters.relationship = clamp(n.meters.relationship + (v.how === 'go' ? 8 : 3)); n.lastInteractionAge = p.age; met.push(n); } }
      if (v.how === 'go') recordEvent({ key: `hood:reunion:${me}:${hoodId}`, type: 'reunion', title: `A reunion in ${H.list[hoodId]?.name ?? 'the old neighborhood'}`, text: `With ${met.map((n) => n.firstName).join(', ')}.`, people: met.map((n) => archiveIdOf(n)), significance: 1, privacy: 'family' });
      return null;
    }
    default: return null;
  }
}
