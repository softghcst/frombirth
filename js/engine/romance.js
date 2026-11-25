// Romance: meeting people, dating, engagement, weddings (with or without a
// prenup), break-ups and divorce.
import { platformOpen } from './digital/tech.js';
import { fromAbroad, rollsRoots } from './economy.js';
import { may } from './rules.js';
import { rng } from '../rng.js';
import * as crown from './royalty.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, npcsByRole, log, milestone } from '../state.js';
import { makeNpc } from './npcFactory.js';
import { COUNTRIES } from '../data/countries.js';
import { remember } from './conditions.js';
import { spendAction, countAction, roleLabel } from './relationships.js';
import { conceive, canConceive } from './children.js';
import { supervisionBetween } from './investigations/core.js';
import { ensureLife } from './npcLives.js';
import { netWorth } from './finance.js';
import { splitJoint, familyLawOf, payDivorce, setSupport } from './family.js';
import { stakesWorth } from './business.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const bump = (npc, d) => { npc.meters.relationship = clamp(npc.meters.relationship + d); };
const npcOf = (id) => store.state.npcs[id];

export const DATING_AGE = 14;
export const ADULT = 18;
const MAX_SEARCHES = 3;

/** Costs in base units. */
export const DATE_COST = 120;
export const RINGS = [
  { id: 'plain', name: 'A plain band', cost: 400, bonus: 0 },
  { id: 'fine', name: 'A fine ring', cost: 4000, bonus: 0.1 },
  { id: 'dazzling', name: 'A dazzling ring', cost: 25000, bonus: 0.2 },
];
export const WEDDINGS = [
  { id: 'registry', name: 'Registry office and a pub lunch', cost: 600, joy: 3 },
  { id: 'classic', name: 'A proper wedding', cost: 14000, joy: 9 },
  { id: 'lavish', name: 'The wedding of the year', cost: 70000, joy: 15 },
];
export const DIVORCE_FEE = 4000;

/**
 * A wedding planned piece by piece (js/ui/weddingPlanner.js). Costs in base units; `joy` is how much the day means
 * to the two of you. Guests are paid for per head, for the food chosen (`perGuest`).
 */
export const WEDDING_PLAN = {
  venue: [
    { id: 'courthouse', name: 'City hall', icon: '🏛️', cost: 300, joy: 1, sub: 'Quick, sweet and official' },
    { id: 'backyard', name: 'A backyard party', icon: '🏡', cost: 2500, joy: 4, sub: 'String lights and lawn chairs' },
    { id: 'chapel', name: 'A little chapel', icon: '⛪', cost: 6000, joy: 6, sub: 'Stained glass and a bell' },
    { id: 'beach', name: 'On the beach', icon: '🏖️', cost: 9000, joy: 7, sub: 'Barefoot at sunset' },
    { id: 'garden', name: 'A garden', icon: '🌷', cost: 8000, joy: 7, sub: 'Under a flowering arch' },
    { id: 'vineyard', name: 'A vineyard', icon: '🍇', cost: 15000, joy: 8, sub: 'Golden hour among the vines' },
    { id: 'ballroom', name: 'A grand ballroom', icon: '✨', cost: 22000, joy: 8, sub: 'Chandeliers and a dance floor' },
    { id: 'castle', name: 'A castle', icon: '🏰', cost: 60000, joy: 10, sub: 'A fairytale, turrets and all' },
  ],
  // How many come. Each guest is invited, seated and sent home with a favor (GUEST_COST), and fed (food's perGuest).
  guests: [
    { id: 'elope', name: 'Elope, just the two of us', icon: '💞', count: 2, joy: 1, sub: 'No guests, no fuss, two witnesses' },
    { id: 'intimate', name: 'An intimate gathering', icon: '🕯️', count: 12, joy: 3, sub: 'About 12: the ones who matter most' },
    { id: 'small', name: 'Close family and friends', icon: '👨‍👩‍👧', count: 40, joy: 4, sub: 'About 40 guests' },
    { id: 'medium', name: 'Family and friends', icon: '🎉', count: 100, joy: 5, sub: 'About 100 guests' },
    { id: 'big', name: 'A big celebration', icon: '🥳', count: 200, joy: 6, sub: 'About 200 guests' },
    { id: 'huge', name: 'Everyone we have ever met', icon: '🏟️', count: 350, joy: 6, sub: 'About 350: cousins of cousins' },
  ],
  theme: [
    { id: 'blush', name: 'Blush', hex: '#F6B8C8', cost: 0, joy: 0 },
    { id: 'ivory', name: 'Ivory and gold', hex: '#F3E3B5', cost: 0, joy: 0 },
    { id: 'lavender', name: 'Lavender', hex: '#C9B4EA', cost: 0, joy: 0 },
    { id: 'sage', name: 'Sage', hex: '#B5CDA8', cost: 0, joy: 0 },
    { id: 'sky', name: 'Something blue', hex: '#A9CDEB', cost: 0, joy: 0 },
    { id: 'red', name: 'Deep red', hex: '#C9485B', cost: 0, joy: 0 },
  ],
  flowers: [
    { id: 'wild', name: 'Wildflowers', icon: '🌼', cost: 200, joy: 1, sub: 'Picked that morning' },
    { id: 'roses', name: 'Roses', icon: '🌹', cost: 1500, joy: 2, sub: 'Classic, by the armful' },
    { id: 'peonies', name: 'Peonies and orchids', icon: '💐', cost: 5000, joy: 3, sub: 'Lush, everywhere you look' },
  ],
  attire: [
    { id: 'borrowed', name: 'Something borrowed', icon: '🧵', cost: 150, joy: 1, sub: 'A family heirloom, altered' },
    { id: 'rack', name: 'Off the rack', icon: '🛍️', cost: 1200, joy: 2, sub: 'Found it, loved it' },
    { id: 'designer', name: 'Designer, made to fit', icon: '👑', cost: 9000, joy: 4, sub: 'Three fittings and a gasp' },
  ],
  cake: [
    { id: 'cupcakes', name: 'A tower of cupcakes', icon: '🧁', cost: 300, joy: 1, sub: 'Everyone gets their own' },
    { id: 'tiered', name: 'A three-tier cake', icon: '🎂', cost: 1200, joy: 2, sub: 'Buttercream and berries' },
    { id: 'showstopper', name: 'A five-tier showstopper', icon: '🍰', cost: 5000, joy: 3, sub: 'Sugar flowers cascading down' },
  ],
  music: [
    { id: 'playlist', name: 'Our playlist', icon: '🎧', cost: 0, joy: 1, sub: 'Every song means something' },
    { id: 'dj', name: 'A DJ', icon: '💿', cost: 1500, joy: 2, sub: 'Nobody leaves the dance floor' },
    { id: 'band', name: 'A live band', icon: '🎷', cost: 3500, joy: 3, sub: 'Brass, and a singer who can really sing' },
    { id: 'quartet', name: 'A string quartet', icon: '🎻', cost: 4000, joy: 3, sub: 'For the vows; a playlist for after' },
  ],
  food: [
    { id: 'potluck', name: 'Potluck and pizza', icon: '🍕', perGuest: 8, joy: 1, sub: 'Everyone brings a dish' },
    { id: 'buffet', name: 'A buffet', icon: '🍲', perGuest: 35, joy: 2, sub: 'Seconds encouraged' },
    { id: 'plated', name: 'A plated dinner', icon: '🍽️', perGuest: 85, joy: 3, sub: 'Three courses, cloth napkins' },
  ],
  honeymoon: [
    { id: 'home', name: 'Home, together', icon: '🛋️', cost: 0, joy: 1, sub: 'A week off and breakfast in bed' },
    { id: 'roadtrip', name: 'A road trip', icon: '🚗', cost: 1200, joy: 2, sub: 'Windows down, no plans' },
    { id: 'resort', name: 'A beach resort', icon: '🏝️', cost: 6000, joy: 4, sub: 'Overwater, all inclusive' },
    { id: 'world', name: 'Around the world', icon: '✈️', cost: 25000, joy: 6, sub: 'A month, six countries' },
  ],
};
/** Invitations, a seat and a favor, for each guest (base units). Two people eloping invite no one. */
export const GUEST_COST = 20;
/** What a guest list costs, before food (local money). */
export const guestCost = (count, c = country()) => (count > 2 ? localMoney(GUEST_COST, c) * count : 0);
/** The steps of the plan, in the order they are planned. */
export const PLAN_STEPS = ['venue', 'guests', 'theme', 'flowers', 'attire', 'cake', 'music', 'food', 'honeymoon'];
const planPick = (key, id) => WEDDING_PLAN[key].find((o) => o.id === id) ?? WEDDING_PLAN[key][0];

const hashOf = (str) => { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
/** What the partner has always dreamed of: a venue, and a big party or a small one. The same every time it is asked. */
export function dreamOf(npc) {
  const h = hashOf(`dream:${npc.id}`);
  const venues = WEDDING_PLAN.venue.filter((v) => v.id !== 'courthouse');
  return { venue: venues[h % venues.length].id, big: (h >> 8) % 2 === 0 };
}

/** What a plan costs (local money) and means, with what it does for the partner's dream. */
export function planTotals(plan, npc = null, c = country()) {
  const lines = [];
  let cost = 0; let joy = 0;
  const guests = planPick('guests', plan.guests);
  for (const key of PLAN_STEPS) {
    const o = planPick(key, plan[key]);
    const each = key === 'food' ? localMoney(o.perGuest, c) * guests.count : key === 'guests' ? guestCost(guests.count, c) : localMoney(o.cost ?? 0, c);
    cost += each; joy += o.joy ?? 0;
    if (key === 'guests') { if (guests.count > 2) lines.push({ key, label: `Invitations and seating for ${guests.count}`, cost: each }); }
    else if (key !== 'theme') lines.push({ key, label: key === 'food' ? `${o.name}, for ${guests.count}` : o.name, cost: each });
  }
  const dream = npc ? dreamOf(npc) : null;
  const dreamVenue = !!dream && plan.venue === dream.venue;
  const dreamSize = !!dream && (dream.big ? guests.count >= 100 : guests.count <= 40);
  if (dreamVenue) joy += 4;
  if (dreamSize) joy += 2;
  return { cost, joy, lines, guests: guests.count, dreamVenue, dreamSize };
}

/** Why the player cannot marry this person now, or null. */
export function weddingBlock(npcId) {
  const npc = npcOf(npcId);
  if (!npc?.alive) return 'They are no longer here.';
  if (!npc.flags.engaged) return 'You are not engaged.';
  const legal = may('marry', { partner: npc });
  return legal.ok ? null : legal.why;
}

/** The vows, said at the altar: how they land. */
export const VOWS = {
  heartfelt: { label: 'Vows I wrote myself', bump: 4, line: (n) => `${n} is crying before you reach the second line. So is half the room.` },
  traditional: { label: 'The traditional vows', bump: 2, line: (n) => `"To have and to hold." ${n} says the words back to you, steady and sure.` },
  funny: { label: 'Vows that make everyone laugh', bump: 3, line: (n) => `The whole room is laughing, and ${n} is laughing hardest, and then, suddenly, not laughing at all.` },
};
/**
 * Where the honeymoon went, the same for the same couple: an island for the resort, a coast road for the road trip,
 * six countries for the trip around the world. Null for staying home.
 */
const RESORTS = ['Bora Bora', 'the Maldives', 'Bali', 'Santorini', 'Mauritius', 'the Seychelles', 'Fiji', 'Tulum'];
const ROADS = ['the Coast Road', 'the Mountains', 'the Lakes', 'the Desert Highway', 'Wine Country'];
export function honeymoonPlace(honeymoon, npc) {
  const h = hashOf(`honeymoon:${npc.id}`);
  if (honeymoon === 'resort') return RESORTS[h % RESORTS.length];
  if (honeymoon === 'roadtrip') return ROADS[h % ROADS.length];
  if (honeymoon === 'world') return 'Around the World';
  return null;
}

/**
 * A postcard home from the honeymoon: to the player's parents, if they are living, or to everyone at home. They keep
 * it (a memory, and a little warmth). Returns who it is to and what it says, or null when the couple stayed home.
 */
export function sendPostcard(npcId, honeymoon) {
  const p = player();
  const npc = npcOf(npcId);
  const place = honeymoonPlace(honeymoon, npc);
  if (!place) return null;
  const parents = npcsByRole('parent').filter((n) => n.alive);
  const mom = parents.find((n) => n.gender === 'female'); const dad = parents.find((n) => n.gender === 'male');
  const to = mom && dad ? 'Mom and Dad' : mom ? 'Mom' : dad ? 'Dad' : parents.length ? parents[0].firstName : 'everyone at home';
  const body = {
    resort: `The water here is the color of the swimming pools in magazines. ${npc.firstName} has not stopped smiling and neither have I. We are eating breakfast in the sea. Yes, in it.`,
    roadtrip: `${npc.firstName} picked the music, I picked the turns, and we got lost twice on purpose. Every town has a diner and we have tried them all.`,
    world: 'Six countries, one suitcase each (mostly). We have eaten things we cannot pronounce and watched the sun come up on three continents.',
  }[honeymoon];
  for (const n of parents) { bump(n, 2); remember(n, 'postcard', `A postcard from your honeymoon in ${place}.`); }
  log(`From ${place}, you and ${npc.firstName} sent a postcard home.`, 'system', 'good');
  return { place, to, body, from: `${p.firstName} & ${npc.firstName}` };
}

export function sayVows(npcId, kind) {
  const npc = npcOf(npcId);
  const v = VOWS[kind] ?? VOWS.traditional;
  bump(npc, v.bump);
  remember(npc, 'vows', kind === 'heartfelt' ? 'You wrote your own vows.' : kind === 'funny' ? 'Your vows made everyone laugh.' : 'You said the old vows.');
  return v.line(npc.firstName);
}

export const spouse = () => npcsByRole('spouse')[0];
export const partner = () => spouse() ?? npcsByRole('partner')[0];
export const interest = () => player().flags.interestedIn ?? null;
export const setInterest = (v) => { player().flags.interestedIn = v; };

function searches() {
  const p = player();
  if (p.flags.loveActs?.age !== p.age) p.flags.loveActs = { age: p.age, met: 0 };
  return p.flags.loveActs;
}

export const canLookForLove = () => {
  const p = player();
  return p.age >= DATING_AGE && !partner() && !p.legal.incarceration;
};

/** Teenagers date people their own age; adults date adults. */
function ageFits(npc) {
  const p = player();
  if (p.age < ADULT) return npc.age >= DATING_AGE && npc.age < ADULT && Math.abs(npc.age - p.age) <= 2;
  return npc.age >= ADULT;
}

/** Where the player can go looking, by age. */
export function meetingPlaces() {
  const adult = player().age >= ADULT;
  // Dating apps exist only once the technology does, where the player lives (the Digital World registry decides).
  const apps = platformOpen('kindling');
  return [
    { id: 'friends', name: 'Through friends', desc: 'Someone a friend thinks you would like.' },
    ...(adult ? [...(apps ? [{ id: 'app', name: 'A dating app', desc: 'A lot of profiles. Some of them accurate.' }] : [{ id: 'app', name: 'A personal ad in the paper', desc: 'Forty words about yourself, and a box number.' }]),
      { id: 'out', name: 'A night out', desc: 'Whoever catches your eye across the room.' }]
      : [{ id: 'school', name: 'Around school', desc: 'Someone from a different class.' }]),
  ];
}

/**
 * Finds someone the player might ask out. They are not part of the player's
 * life until askOutStranger succeeds.
 * @returns {{ok:false, text:string}|{ok:true, npc:object, blurb:string}}
 */
export function meetSomeone(place) {
  const p = player();
  const s = searches();
  if (s.met >= MAX_SEARCHES) return result(false, 'You have met enough new people for one year.', 'neutral');
  s.met += 1;
  const want = interest();
  const gender = want === 'men' ? 'male' : want === 'women' ? 'female' : rng.pick(['male', 'female']);
  const age = p.age < ADULT ? clamp(p.age + rng.int(-1, 1), DATING_AGE, ADULT - 1)
    : Math.max(ADULT, p.age + rng.int(-Math.min(6, p.age - ADULT), 8));
  const surnames = COUNTRIES[p.countryId].names.last.filter((n) => n !== p.lastName);
  const npc = makeNpc({ role: 'partner', countryId: p.countryId, gender, age, relationship: rng.int(48, 62),
    lastName: rng.pick(surnames) });
  // Someone who would go out with the player is, by definition, drawn to people like them.
  npc.orientation = npc.gender === p.gender ? rng.pick(['gay', 'gay', 'bisexual', 'pansexual']) : rng.pick(['straight', 'straight', 'straight', 'bisexual']);
  if (p.age >= ADULT && rollsRoots('partnerFromAbroad')) fromAbroad(npc, p.countryId);
  if (place === 'app') npc.meters.charm = clamp(npc.meters.charm - rng.int(0, 15)); // profiles flatter
  ensureLife(npc);
  const m = npc.meters;
  const job = npc.life.job ? `works as ${/^[aeiou]/i.test(npc.occupation) ? 'an' : 'a'} ${npc.occupation}` : npc.life.edu.yearsLeft > 0 ? 'is still studying' : npc.age < 18 ? 'is at school' : 'is between jobs';
  const blurb = [
    m.charm >= 70 ? 'very easy on the eye' : m.charm >= 45 ? 'pleasant-looking' : 'not much to look at, with a lovely laugh',
    m.intellect >= 70 ? 'sharp as a tack' : m.intellect >= 45 ? 'good company' : 'not a big reader',
    job,
    m.crazy >= 70 ? 'and a little intense' : 'and seems steady',
  ].join(', ');
  return { ok: true, npc, blurb };
}

/** Asks out someone from meetSomeone. On a yes they join the player's life. */
export function askOutStranger(npc) {
  const p = player();
  const chance = clamp(0.5 + (p.stats.charm - npc.meters.charm) / 140, 0.08, 0.92);
  if (!rng.chance(chance)) {
    p.stats.mood = clamp(p.stats.mood - 3);
    const text = `You asked ${npc.firstName} out. They let you down gently.`;
    log(text, 'system', 'bad');
    return result(false, text);
  }
  store.state.npcs[npc.id] = npc;
  p.npcIds.push(npc.id);
  npc.lastInteractionAge = p.age;
  npc.flags.since = p.age;
  p.stats.mood = clamp(p.stats.mood + 8);
  const text = `${npc.firstName} said yes. You are seeing each other.`;
  log(text, 'system', 'good');
  return result(true, text);
}

/**
 * Romantic things the player can do with this person right now.
 * @returns {{id:string, label:string, danger?:boolean}[]}
 */
export function romanceActions(npc) {
  const p = player();
  const adults = p.age >= ADULT && npc.age >= ADULT;
  const a = [];
  // Not someone who reports to you: a manager asking is not a free question.
  // Nor someone who supervises you, or whom you supervise, in an investigative agency (engine/investigations/core.js).
  if (['friend', 'classmate', 'coworker', 'colleague', 'ex', 'neighbor', 'roommate'].includes(npc.role) && !npc.flags.report && !supervisionBetween(npc) && !partner() && p.age >= DATING_AGE && ageFits(npc)) {
    a.push({ id: 'askOut', label: 'Ask out' });
  }
  if ((npc.role === 'partner' || npc.role === 'spouse') && !p.legal.incarceration) {
    a.push({ id: 'date', label: npc.role === 'spouse' ? 'Plan a night out together' : 'Go on a date' });
    if (adults) a.push({ id: 'hookUp', label: 'Be intimate' });
  }
  if (npc.role === 'partner') {
    if (adults && !npc.flags.engaged) a.push({ id: 'propose', label: 'Propose' });
    if (npc.flags.engaged) a.push({ id: 'wedding', label: 'Plan the wedding' });
    a.push({ id: 'breakUp', label: npc.flags.engaged ? 'Call off the engagement' : 'Break up', danger: true });
  }
  if (npc.role === 'spouse') a.push({ id: 'divorce', label: 'File for divorce', danger: true });
  return a;
}

export function askOut(npcId) {
  const p = player();
  const npc = npcOf(npcId);
  if (!spendAction(npc, 'askOut')) return result(false, `You already asked ${npc.firstName} this year.`, 'neutral');
  const chance = clamp(0.15 + (npc.meters.relationship - 40) / 90 + (p.stats.charm - 50) / 160, 0.05, 0.9);
  if (!rng.chance(chance)) {
    bump(npc, -8);
    p.stats.mood = clamp(p.stats.mood - 5);
    const text = `You asked ${npc.firstName} out. "I think of you as a friend." It is a long walk home.`;
    log(text, 'system', 'bad');
    return result(false, text);
  }
  npc.flags.wasRole = npc.role;
  npc.role = 'partner';
  ensureLife(npc);
  npc.flags.since = p.age;
  bump(npc, 10);
  p.stats.mood = clamp(p.stats.mood + 10);
  remember(npc, 'askedOut', 'You were friends first, and then you asked.');
  const text = `You asked ${npc.firstName} out, and they had been hoping you would. You are together.`;
  log(text, 'system', 'good');
  return result(true, text);
}

export function goOnDate(npcId) {
  const p = player();
  const c = country();
  const npc = npcOf(npcId);
  const cost = localMoney(DATE_COST, c);
  if (p.age >= ADULT && p.finance.cash < cost) return result(false, 'You cannot afford a night out.', 'neutral');
  if (!spendAction(npc, 'date')) return result(false, 'You have already had your big night out this year.', 'neutral');
  if (p.age >= ADULT) p.finance.cash -= cost;
  const went = rng.chance(0.8);
  bump(npc, went ? rng.int(6, 12) : -3);
  p.stats.mood = clamp(p.stats.mood + (went ? 6 : -2));
  const text = went ? `You and ${npc.firstName} had a night neither of you wanted to end.`
    : `The restaurant lost your booking and it rained. ${npc.firstName} was polite about it.`;
  log(text, 'system', went ? 'good' : 'neutral');
  return result(went, text, went ? 'good' : 'neutral');
}

export function hookUp(npcId) {
  const p = player();
  const npc = npcOf(npcId);
  if (p.age < ADULT || npc.age < ADULT) return result(false, 'Not at your age.');
  // As often as you both like. The first night of the year means the most; after that it is part of life together.
  const first = countAction(npc, 'hookUp') === 1;
  bump(npc, first ? rng.int(3, 8) : rng.int(0, 2));
  p.stats.mood = clamp(p.stats.mood + (first ? 6 : 2));
  let text = `You and ${npc.firstName} spent the night together.`;
  if (canConceive(npc) && !p.flags.pregnancy && rng.chance(0.04 * p.hidden.fertility / 70)) {
    text += ` ${conceive(npc, false)}`;
  }
  log(text, 'system', 'good');
  return result(true, text);
}

export function propose(npcId, ringId) {
  const p = player();
  const c = country();
  const npc = npcOf(npcId);
  const ring = RINGS.find((r) => r.id === ringId);
  const cost = localMoney(ring.cost, c);
  if (p.finance.cash < cost) return result(false, 'You cannot afford that ring.', 'neutral');
  if (!spendAction(npc, 'propose')) return result(false, `You already proposed to ${npc.firstName} this year.`, 'neutral');
  p.finance.cash -= cost;
  const chance = clamp((npc.meters.relationship - 45) / 45 + ring.bonus, 0.02, 0.97);
  if (!rng.chance(chance)) {
    p.finance.cash += Math.round(cost * 0.6); // the jeweler takes it back, at a loss
    bump(npc, -15);
    p.stats.mood = clamp(p.stats.mood - 12);
    const text = `You got down on one knee. ${npc.firstName} said they were not ready. The jeweler gave you some of the money back.`;
    log(text, 'system', 'bad');
    return result(false, text);
  }
  npc.flags.engaged = true;
  bump(npc, 8);
  p.stats.mood = clamp(p.stats.mood + 15);
  const text = `You got down on one knee with ${ring.name.toLowerCase()}. ${npc.firstName} said yes before you finished the sentence.`;
  log(text, 'system', 'good');
  milestone(`Got engaged to ${npc.firstName} ${npc.lastName}.`, 'family');
  return result(true, text);
}

/** How wealthy the other person is, in local money. Used for settlements. */
const theirWealth = (npc) => (npc.life ? Math.max(0, npc.life.savings) : localMoney(npc.meters.money ** 2 * 45, country()));

/** Asks for a prenup. They may refuse, and asking always costs a little. */
export function askForPrenup(npcId) {
  const p = player();
  const npc = npcOf(npcId);
  const richer = theirWealth(npc) > p.finance.cash;
  const chance = clamp(0.55 + (npc.meters.relationship - 70) / 100 + (richer ? 0.3 : -0.15) - (npc.meters.crazy - 50) / 250, 0.05, 0.95);
  bump(npc, -4);
  if (rng.chance(chance)) {
    const text = `${npc.firstName} read the prenup twice and signed it.`;
    log(text);
    return result(true, text, 'neutral');
  }
  bump(npc, -8);
  const text = `${npc.firstName} pushed the prenup back across the table. "If we are planning the divorce, why are we planning the wedding?"`;
  log(text, 'system', 'bad');
  return result(false, text);
}

export function marry(npcId, weddingId, prenup) {
  const p = player();
  const c = country();
  const npc = npcOf(npcId);
  // A wedding chosen from WEDDINGS by id, or planned piece by piece (WEDDING_PLAN).
  const planned = weddingId && typeof weddingId === 'object' ? weddingId : null;
  const w = planned ? (() => { const t = planTotals(planned, npc, c); const v = planPick('venue', planned.venue);
    return { id: 'planned', name: `a wedding at ${v.name.replace(/^A |^An /, 'a ').replace(/^On the /, 'the ').toLowerCase()}`, joy: t.joy, cost: t.cost, local: true, plan: planned }; })()
    : WEDDINGS.find((x) => x.id === weddingId);
  if (!npc.flags.engaged) return result(false, 'You are not engaged.', 'neutral');
  { const legal = may('marry', { partner: npc }); if (!legal.ok) return result(false, legal.why, 'neutral'); }
  const royalMatch = !!npc.flags.royal;
  let cost = w.local ? w.cost : localMoney(w.cost, c);
  if (!royalMatch && p.finance.cash < cost) return result(false, 'You cannot afford that wedding.', 'neutral');
  // Marrying into a royal family needs the palace's consent, and the palace can say no.
  const palace = royalMatch ? crown.consent(npc) : null;
  if (palace && !palace.ok) { log(palace.text, 'system', 'bad'); return result(false, palace.text, 'bad'); }
  if (palace && !palace.leaves) cost = 0; // a royal wedding is paid for by the crown
  if (p.finance.cash < cost) return result(false, 'You cannot afford that wedding.', 'neutral');
  p.finance.cash -= cost;
  npc.role = 'spouse';
  npc.flags.engaged = false;
  npc.marriedAtAge = p.age;
  npc.prenup = !!prenup || (!!palace && !palace.leaves); // the palace's lawyers always insist
  npc.lastInteractionAge = p.age;
  bump(npc, w.joy);
  p.stats.mood = clamp(p.stats.mood + 15);
  p.counters.spouses += 1;
  if (p.flags.livesWithParents) p.flags.livesWithParents = false;
  if (w.plan) npc.flags.wedding = { ...w.plan, year: store.state.year };
  remember(npc, 'weddingDay', w.plan ? `You married them at ${w.name.replace(/^a wedding at /, '')}.` : `You married them with ${w.name.toLowerCase()}.`);
  const wed = `${crown.npcName(npc)} ${npc.lastName}`;
  const after = palace ? crown.afterWedding(npc, palace.leaves) : crown.afterMarryingOut(npc);
  const text = palace && !palace.leaves
    ? `${palace.text} You married ${wed} in the cathedral, under a marriage contract drawn up by the palace's lawyers.${after}`
    : `${palace ? `${palace.text} ` : ''}You married ${wed}: ${w.name.toLowerCase()}${prenup ? ', with a prenup in the drawer' : ''}. It cost ${fmtMoney(cost, c)}.${after}`;
  log(text, 'system', 'good');
  milestone(`Married ${wed}.`, 'family');
  return result(true, text);
}

export function breakUp(npcId) {
  const p = player();
  const npc = npcOf(npcId);
  const wasEngaged = npc.flags.engaged;
  npc.role = 'ex';
  npc.flags.engaged = false;
  npc.meters.relationship = Math.max(5, npc.meters.relationship - 40);
  p.stats.mood = clamp(p.stats.mood - 8);
  const text = wasEngaged ? `You called off the engagement to ${npc.firstName}.` : `You broke up with ${npc.firstName}.`;
  log(text, 'system', 'bad');
  return result(true, text, 'neutral');
}

/** What a divorce would move between the two of you. Positive means you pay. */
export function settlement(npcId) {
  const npc = npcOf(npcId);
  // Where each keeps their own, nothing changes hands but what was held jointly (engine/family.js).
  if (npc.prenup || familyLawOf() === 'separate') return 0;
  // A business is counted too: it is not in net worth, but it is part of what the two of them have (engine/business.js).
  return Math.round((Math.max(0, netWorth(store.state) + stakesWorth()) - theirWealth(npc)) / 2);
}

function endMarriage(npc, yours) {
  const p = player();
  const c = country();
  const joint = splitJoint(npc.id); // what was held in both names is divided first
  const owed = settlement(npc.id);
  const fee = localMoney(DIVORCE_FEE, c);
  if (p.flags.moneyWith) p.flags.moneyWith = 'separate';
  p.finance.cash -= fee;
  // What is owed is paid from everyday money, then the pension plan, then a share of a business (engine/family.js).
  const paid = owed > 0 ? payDivorce(npc.id, owed) : null;
  if (owed < 0) { p.finance.cash -= owed; if (npc.life) npc.life.savings += owed; }
  const support = setSupport(npc.id);
  npc.role = 'ex';
  npc.flags.wasSpouse = true;
  npc.meters.relationship = Math.min(npc.meters.relationship, 15);
  p.stats.mood = clamp(p.stats.mood - 15);
  for (const kid of npcsByRole('child')) if (kid.age < 18) bump(kid, -8);
  const money = `${joint ? `Your share of the joint account came to ${fmtMoney(joint, c)}. ` : ''}${npc.prenup ? 'The prenup held: you each kept what was yours.' : familyLawOf() === 'separate' ? 'As the law here has it, you each kept what was yours.'
    : owed > 0 ? `Everything was split down the middle: you paid ${fmtMoney(owed, c)}${paid?.pension ? `, ${fmtMoney(paid.pension, c)} of it from your pension plan` : ''}${paid?.stake ? `, and ${npc.firstName} now owns ${Math.round(paid.stake.share * 100)}% of ${paid.stake.name}` : ''}.`
      : owed < 0 ? `Everything was split down the middle: you received ${fmtMoney(-owed, c)}.` : 'There was nothing to split.'}`;
  const supportLine = support.map((s) => ` You will ${s.dir === 'pay' ? 'pay' : 'receive'} ${fmtMoney(s.amount, c)} a year in ${s.kind === 'child' ? 'child' : 'spousal'} support until ${s.until}.`).join('');
  const text = `${yours ? `You divorced ${npc.firstName}` : `${npc.firstName} divorced you`}. ${money} The lawyers took ${fmtMoney(fee, c)}.${supportLine}${crown.afterDivorce(npc)}`;
  log(text, 'system', 'bad');
  milestone(`Divorced ${npc.firstName} ${npc.lastName}.`, 'family');
  return text;
}

export function divorce(npcId) {
  const p = player();
  // Where there is no divorce, only an annulment: costly, once a year, and usually refused.
  if (!may('divorce').ok) {
    const fee = localMoney(DIVORCE_FEE * 2, country());
    if (p.flags.annulAge === p.age) return result(false, 'The court has heard you this year. You can petition again next year.', 'neutral');
    if (p.finance.cash < fee) return result(false, `${may('divorce').why} The petition costs ${fmtMoney(fee, country())}, and you do not have it.`, 'neutral');
    p.flags.annulAge = p.age;
    p.finance.cash -= fee;
    if (!rng.chance(0.3)) {
      const text = `${may('divorce').why} You petitioned for one. It cost ${fmtMoney(fee, country())}, and the court refused.`;
      log(text, 'system', 'bad');
      return result(false, text);
    }
    return result(true, `The court annulled the marriage. ${endMarriage(npcOf(npcId), true)}`, 'neutral');
  }
  return result(true, endMarriage(npcOf(npcId), true), 'neutral');
}

/** Yearly: relationships that have gone cold end themselves. */
export function tickRomance() {
  const p = player();
  for (const npc of [...npcsByRole('partner'), ...npcsByRole('spouse')]) {
    bump(npc, rng.int(-3, 2));
    if (npc.meters.relationship >= 22 || !rng.chance(0.5)) continue;
    if (npc.role === 'spouse') endMarriage(npc, false);
    else {
      npc.role = 'ex';
      npc.flags.engaged = false;
      p.stats.mood = clamp(p.stats.mood - 10);
      log(`${npc.firstName} ended things with you.`, 'system', 'bad');
    }
  }
}

/** This partner leaves the player, of their own accord (engine/bonds.js: after a betrayal, or when trust does not return). */
export function leftBy(npcId) {
  const p = player();
  const npc = store.state.npcs[npcId];
  if (!npc) return;
  if (npc.role === 'spouse') { endMarriage(npc, false); return; }
  npc.role = 'ex';
  npc.flags.engaged = false;
  p.stats.mood = clamp(p.stats.mood - 10);
  log(`${npc.firstName} ended things with you.`, 'system', 'bad');
}

export { roleLabel };
