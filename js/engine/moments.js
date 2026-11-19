// Living moments: the occasions a year holds, lived a year at a time.
//
// Pathways has no calendar and this adds none. "This year" is simply the year
// between one Age Up and the next. The player chooses what to mark, and it is
// resolved at once: what it costs, who came, who grew closer, what was worth
// remembering. Age Up then finishes the year (traditions nobody organized, the
// invitations nobody answered, a summary), and deals out the next one.
//
//   state.moments    = { year, done: { key: true }, social, bonds: { npcId: gained }, invites: [...], log: [...] }   this year only
//   state.traditions = [Tradition]   the family's, kept for good and passed to whoever carries the family on
//   player.momentsYears = [{ year, age, lines }]   what each year held, for the life story
//
// Nothing here is a second clock: it reads the year and ages that the rest of
// the game keeps. Availability by era and place is the `since` and `countries`
// of each occasion (data/occasions.js), so a later historical-eras system has
// one place to narrow it.
import { store, player, country, livingNpcs, npcsByRole, log, milestone } from '../state.js';
import { clamp, localCost, fmtMoney } from '../util.js';
import { rng } from '../rng.js';
import { remember } from './conditions.js';
import { apart } from './eventEngine.js';
import { roleLabel } from './relationships.js';
import { book } from './ledger.js';
import { OCCASIONS, STYLES, HOLIDAYS, INVITES, MILESTONE_BIRTHDAYS, NAMED_ANNIVERSARIES, SOCIAL_PER_YEAR, BOND_CAP, INVITE_WAYS, TRADITION_LAPSE } from '../data/occasions.js';
import { techAvailable } from './digital/tech.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const YOU = 'you';
const ordinal = (n) => `${n}${[, 'st', 'nd', 'rd'][(n % 100 >> 3 ^ 1) && n % 10] || 'th'}`;
const names = (list) => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`);
const npc = (id) => store.state.npcs[id] ?? null;
const inLife = (n) => !!n && n.alive && player().npcIds.includes(n.id);

const FAMILY = ['parent', 'sibling', 'grandparent', 'child', 'spouse', 'partner', 'relative', 'inlaw', 'niece', 'grandchild', 'greatgrandchild'];
const FRIENDS = ['friend', 'classmate', 'coworker', 'colleague', 'partner'];
/** People close enough that their round birthday is the player's to mark. */
const CLOSE = ['spouse', 'partner', 'child', 'parent', 'sibling', 'grandparent'];

// ---------- This year's record ----------

/** The record for the year being lived. A record left from an earlier year is set aside, never reused. */
export function yearState(state = store.state) {
  if (!state.moments || state.moments.year !== state.year) state.moments = { year: state.year, done: {}, social: 0, bonds: {}, invites: [], log: [] };
  return state.moments;
}
export const traditions = (state = store.state) => (state.traditions ??= []);
export const isDone = (key) => !!yearState().done[key];

/** Whether an occasion exists at this time, in this place, at this age. */
export function available(o, age = player().age) {
  const p = player();
  if (o.since && store.state.year < o.since) return false;
  if (o.countries && !o.countries.split(' ').includes(p.countryId)) return false;
  if (o.minAge != null && age < o.minAge) return false;
  if (o.maxAge != null && age > o.maxAge) return false;
  return true;
}

// ---------- Who can come ----------

export function guestPool(kind) {
  const roles = kind === 'family' ? FAMILY : kind === 'friends' ? FRIENDS : kind === 'date' ? ['partner', 'spouse', 'friend', 'classmate'] : [...new Set([...FAMILY, ...FRIENDS])];
  return livingNpcs().filter((n) => n.role !== 'pet' && roles.includes(n.role) && !n.flags.abroad && !n.flags.inside);
}

/** Someone grows closer: by the amount given, but never by more than the yearly cap from occasions. */
function closer(n, amount) {
  const s = yearState();
  const room = Math.max(0, BOND_CAP - (s.bonds[n.id] ?? 0));
  const gain = Math.min(room, Math.max(0, Math.round(amount)));
  if (gain) { n.meters.relationship = clamp(n.meters.relationship + gain); s.bonds[n.id] = (s.bonds[n.id] ?? 0) + gain; }
  n.lastInteractionAge = player().age;
  return gain;
}

// ---------- What this year holds ----------

/**
 * Everything the player could mark this year, grouped for the This Year screen.
 * Each item: { key, occasion, group, label, sub, forId?, holiday?, traditionId?, done, ok, reason }
 */
export function thisYear() {
  const p = player();
  const s = yearState();
  const items = [];
  // An occasion the family keeps as a tradition is listed once, as the tradition, so it cannot be held twice.
  const add = (x) => { if (!x.traditionId && (x.holiday || ['family_reunion', 'visit_grandparents'].includes(x.occasion)) && matchingTradition(x)) return; items.push({ done: !!s.done[x.key], ok: true, reason: '', ...x }); };
  if (!p.alive) return items;
  if (p.legal?.incarceration) return [{ key: 'none', group: 'none', label: 'Not from a cell', sub: 'Occasions will wait until you are out.', done: false, ok: false, reason: 'You are in prison.' }];

  // Birthdays: the player's own, and round numbers for the people closest to them.
  if (available(OCCASIONS.birthday)) add({ key: 'birthday:you', occasion: 'birthday', group: 'birthdays', label: `Your ${ordinal(p.age)} birthday`, sub: MILESTONE_BIRTHDAYS.includes(p.age) ? 'A big one.' : 'Another year.' });
  for (const n of livingNpcs().filter((x) => CLOSE.includes(x.role) && MILESTONE_BIRTHDAYS.includes(x.age) && !x.flags.abroad)) {
    if (!available(OCCASIONS.their_birthday)) break;
    add({ key: `birthday:${n.id}`, occasion: 'their_birthday', group: 'birthdays', forId: n.id, label: `${n.firstName}'s ${ordinal(n.age)} birthday`, sub: `Your ${roleWord(n)}.` });
  }
  // School: dances, prom (where there is one), and a party in the year you finish.
  const atSchool = p.education.enrolled && ['high', 'middle', 'secondary'].includes(p.education.stage);
  for (const id of ['prom', 'formal', 'leavers_ball']) {
    const o = OCCASIONS[id];
    if (available(o) && atSchool && p.age >= 16) add({ key: id, occasion: id, group: 'school', label: o.name, sub: o.blurb });
  }
  if (available(OCCASIONS.school_dance) && atSchool) add({ key: 'school_dance', occasion: 'school_dance', group: 'school', label: OCCASIONS.school_dance.name, sub: OCCASIONS.school_dance.blurb });
  const graduated = (p.education.degrees ?? []).find((d) => d.age === p.age);
  if (graduated && available(OCCASIONS.graduation_party)) add({ key: 'graduation', occasion: 'graduation_party', group: 'school', label: 'A party for your graduation', sub: 'You finished. That is worth a party.' });
  // Family occasions.
  const spouse = npcsByRole('spouse')[0];
  if (spouse && spouse.marriedAtAge != null && p.age - spouse.marriedAtAge >= 1) {
    const yrs = p.age - spouse.marriedAtAge;
    add({ key: `anniversary:${spouse.id}`, occasion: 'anniversary', group: 'family', forId: spouse.id, label: `Your ${ordinal(yrs)} wedding anniversary`, sub: NAMED_ANNIVERSARIES[yrs] ? `The ${NAMED_ANNIVERSARIES[yrs]} anniversary.` : `With ${spouse.firstName}.` });
  }
  if (available(OCCASIONS.visit_grandparents) && npcsByRole('grandparent').some((g) => !g.flags.abroad)) add({ key: 'visit_grandparents', occasion: 'visit_grandparents', group: 'family', label: OCCASIONS.visit_grandparents.name, sub: OCCASIONS.visit_grandparents.blurb });
  if (available(OCCASIONS.family_reunion) && guestPool('family').length >= 4) add({ key: 'family_reunion', occasion: 'family_reunion', group: 'family', label: OCCASIONS.family_reunion.name, sub: OCCASIONS.family_reunion.blurb });
  // Holidays kept where the player lives.
  for (const h of holidaysHere()) add({ key: `holiday:${h.id}`, occasion: 'holiday', holiday: h.id, group: 'holidays', label: `Celebrate ${h.name}`, sub: h.blurb });
  // The family's traditions.
  for (const t of traditions().filter((x) => x.status === 'active')) {
    const skipped = (t.skipped ?? []).includes(store.state.year);
    add({ key: `tradition:${t.id}`, group: 'traditions', traditionId: t.id, occasion: t.occasion, holiday: t.holiday, label: t.name,
      sub: skipped ? 'Skipped this year.' : t.hostId === YOU ? `You host it. Kept ${t.count} ${t.count === 1 ? 'time' : 'times'} since ${t.founded}.` : `${npc(t.hostId)?.firstName ?? 'Someone'} hosts it. Kept ${t.count} ${t.count === 1 ? 'time' : 'times'} since ${t.founded}.`,
      done: !!s.done[`tradition:${t.id}`] || skipped });
  }
  // Invitations, and evenings with friends.
  for (const inv of s.invites) {
    const from = npc(inv.fromId);
    if (!from) continue;
    add({ key: `invite:${inv.id}`, group: 'invitations', inviteId: inv.id, forId: inv.fromId, label: `${from.firstName}'s ${inv.name}`, sub: `${(INVITE_WAYS.find((w) => w.id === inv.how) ?? INVITE_WAYS[2]).text} from your ${roleWord(from)}.`, done: inv.answer != null });
  }
  for (const id of ['sleepover', 'game_night', 'dinner_party']) {
    const o = OCCASIONS[id];
    if (!available(o)) continue;
    const full = s.social >= SOCIAL_PER_YEAR;
    add({ key: `social:${id}`, occasion: id, group: 'social', label: o.name, sub: o.blurb, ok: !full && guestPool('friends').length > 0,
      reason: full ? 'You have had a full enough year of evenings.' : 'You need a friend to invite.' });
  }
  return items;
}
const roleWord = (n) => roleLabel(n).toLowerCase();
export const holidaysHere = () => HOLIDAYS.filter((h) => available(h));

// ---------- Marking an occasion ----------

/** What an occasion would cost, in local money, with these guests and in this style. */
export function costOf(item, guests = 0, styleId = null) {
  const c = country();
  const o = item.holiday ? HOLIDAYS.find((h) => h.id === item.holiday) : OCCASIONS[item.occasion];
  const st = styleId ? STYLES[styleId] : null;
  const base = (st?.cost ?? o?.cost ?? 0) + guests * (st?.perGuest ?? o?.perGuest ?? 0);
  return localCost(base, c);
}
/** Under 18, living at home, the family pays for the child's own occasions. */
const familyPays = () => { const p = player(); return p.age < 18 && p.flags.livesWithParents && npcsByRole('parent').length > 0; };

/** Who the occasion naturally includes, before the player changes anything. */
export function suggestedGuests(item) {
  const o = OCCASIONS[item.occasion] ?? {};
  if (item.forId && item.occasion === 'anniversary') return [item.forId];
  if (item.traditionId) { const t = traditions().find((x) => x.id === item.traditionId); return (t?.participants ?? []).filter((id) => id !== YOU && inLife(npc(id))); }
  if (item.occasion === 'visit_grandparents') return npcsByRole('grandparent').filter((g) => !g.flags.abroad).map((g) => g.id);
  const pool = guestPool(item.holiday ? 'family' : o.guests === 'friends' ? 'friends' : o.guests === 'family' ? 'family' : o.guests === 'date' ? 'date' : 'all');
  const near = pool.sort((a, b) => b.meters.relationship - a.meters.relationship);
  if (o.guests === 'date') return near.filter((n) => ['partner', 'spouse'].includes(n.role)).slice(0, 1).map((n) => n.id);
  return near.slice(0, item.holiday ? 8 : 5).map((n) => n.id);
}

/**
 * Marks an occasion, now. Spends what it costs (once), brings the guests
 * closer (within the yearly cap), keeps what was memorable, and marks it done
 * for this year so it cannot be repeated.
 * @param {{key:string, guests?:string[], style?:string, makeTradition?:boolean}} o
 */
export function celebrate({ key, guests = [], style = null, makeTradition = false }) {
  const p = player();
  const c = country();
  const s = yearState();
  const item = thisYear().find((x) => x.key === key);
  if (!item) return result(false, 'That is not something this year holds.', 'neutral');
  if (item.done) return result(false, 'That is done for this year.', 'neutral');
  if (!item.ok) return result(false, item.reason, 'neutral');
  const o = OCCASIONS[item.occasion] ?? {};
  const h = item.holiday ? HOLIDAYS.find((x) => x.id === item.holiday) : null;
  if (o.styles && !o.styles.includes(style)) style = o.styles[0];
  if (!o.styles) style = null;
  // Only people who are really in the player's life, and each once.
  const people = [...new Set(guests)].map(npc).filter(inLife);
  if (item.forId && !people.some((n) => n.id === item.forId) && npc(item.forId)) people.unshift(npc(item.forId));
  const cost = costOf(item, people.length, style);
  const paidBy = familyPays() && ['birthday', 'prom', 'formal', 'leavers_ball', 'school_dance', 'sleepover', 'graduation_party'].includes(item.occasion) ? 'family' : 'you';
  if (paidBy === 'you' && cost > 0 && p.finance.cash < cost) return result(false, `It would cost ${fmtMoney(cost, c)}. You have ${fmtMoney(Math.max(0, p.finance.cash), c)}.`, 'neutral');

  // Spent once, and written down as what it was.
  if (paidBy === 'you' && cost > 0) {
    p.finance.cash -= cost;
    book({ cat: item.occasion === 'their_birthday' || item.occasion === 'anniversary' ? 'giftOut' : 'leisure', src: 'moment', desc: item.label });
  }
  const st = style ? STYLES[style] : null;
  const bond = st?.bond ?? o.bond ?? h?.bond ?? 3;
  for (const n of people) closer(n, n.id === item.forId ? bond * 1.5 : bond);
  p.stats.mood = clamp(p.stats.mood + (st?.mood ?? o.mood ?? h?.mood ?? 3));
  s.done[key] = true;
  if (item.key.startsWith('social:')) s.social += 1;

  // A tradition, kept or begun.
  const t = item.traditionId ? traditions().find((x) => x.id === item.traditionId) : matchingTradition(item);
  let begun = null;
  if (t) keepTradition(t, people, YOU);
  else if (makeTradition && canFound(item)) begun = foundTradition(item, people);

  // What is worth remembering.
  const yrs = item.occasion === 'anniversary' ? p.age - npc(item.forId).marriedAtAge : 0;
  const memorable = o.memorable || (o.milestone && (item.forId ? MILESTONE_BIRTHDAYS.includes(npc(item.forId)?.age) : MILESTONE_BIRTHDAYS.includes(p.age)))
    || (o.memorableYears ?? []).includes(yrs) || !!begun;
  const who = people.map((n) => n.firstName);
  const text = describe(item, style, who, cost, paidBy, begun);
  log(text, 'system', 'good');
  s.log.push({ key, label: item.label, guests: people.map((n) => n.id), style, cost: paidBy === 'you' ? cost : 0, memorable });
  if (memorable) {
    milestone(milestoneText(item, yrs, begun), 'life');
    for (const n of people) remember(n, `moment:${key}:${store.state.year}`, `${item.label}, the year you were ${p.age}.`);
  }
  return { ...result(true, text), cost: paidBy === 'you' ? cost : 0, guests: people.map((n) => n.id) };
}

function describe(item, style, who, cost, paidBy, begun) {
  const c = country();
  const company = who.length ? ` with ${names(who)}` : '';
  const how = style ? ` ${STYLES[style].name.toLowerCase()}` : '';
  const money = cost ? (paidBy === 'you' ? ` It cost ${fmtMoney(cost, c)}.` : ' Your family paid.') : '';
  const start = begun ? ` You agreed to do it every year: ${begun.name}.` : '';
  if (item.occasion === 'visit_grandparents') return `You spent a day with your grandparents.${money}`;
  if (item.occasion === 'anniversary') return `You marked ${item.label.charAt(0).toLowerCase() + item.label.slice(1)} with ${who[0] ?? 'your spouse'}:${how || ' a quiet evening'}.${money}`;
  return `${item.label}${how ? `:${how}` : ''}${company}.${money}${start}`;
}
function milestoneText(item, yrs, begun) {
  if (begun) return `Began a family tradition: ${begun.name}.`;
  if (item.occasion === 'anniversary') return `Celebrated ${yrs} years of marriage.`;
  if (item.occasion === 'birthday') return `Celebrated turning ${player().age}.`;
  return `${item.label}.`;
}

// ---------- Invitations ----------

/** Says yes or no to an invitation, now. Yes costs a gift and brings you closer; no is noticed. */
export function answerInvite(id, yes) {
  const p = player();
  const c = country();
  const inv = yearState().invites.find((x) => x.id === id);
  if (!inv) return result(false, 'There is no such invitation.', 'neutral');
  if (inv.answer != null) return result(false, 'You have answered it already.', 'neutral');
  const from = npc(inv.fromId);
  if (!inLife(from)) { inv.answer = 'gone'; return result(false, 'It is too late for that.', 'neutral'); }
  if (!yes) {
    inv.answer = 'no';
    from.meters.relationship = clamp(from.meters.relationship - 2);
    const text = `You sent ${from.firstName} your apologies for the ${inv.name}.`;
    log(text, 'system', 'neutral');
    return result(true, text, 'neutral');
  }
  const gift = familyPays() ? 0 : localCost(inv.gift, c);
  if (gift > p.finance.cash) return result(false, `A present would cost ${fmtMoney(gift, c)}.`, 'neutral');
  return attend(inv, from, gift, false);
}
function attend(inv, from, gift, auto) {
  const p = player();
  const c = country();
  if (gift) { p.finance.cash -= gift; book({ cat: 'giftOut', src: 'moment', desc: `A present for ${from.firstName}'s ${inv.name}` }); }
  inv.answer = 'yes';
  closer(from, auto ? inv.bond / 2 : inv.bond);
  p.stats.mood = clamp(p.stats.mood + 3);
  if (inv.memorable) remember(from, `invite:${inv.id}`, `You came to their ${inv.name}.`);
  const text = `You went to ${from.firstName}'s ${inv.name}.${gift ? ` The present cost ${fmtMoney(gift, c)}.` : ''}`;
  log(text, 'system', 'good');
  yearState().log.push({ key: `invite:${inv.id}`, label: `${from.firstName}'s ${inv.name}`, guests: [from.id], cost: gift, memorable: !!inv.memorable });
  return result(true, text);
}

/**
 * Deals out the year's invitations, from people really in the player's life. On luck of its own, keyed to the
 * life and the year (eventEngine.apart), so it never changes what the game's dice would otherwise have done.
 */
function dealInvites() { apart(`invites/${store.state.year}`, deal); }
function deal() {
  const p = player();
  const s = yearState();
  if (s.invites.length || p.legal?.incarceration || !p.alive) return;
  // The newest way the time and place have: a message where mobile phones have arrived, then a call, a card, or word of mouth.
  const how = INVITE_WAYS.find((w) => (!w.tech || techAvailable(w.tech, store.state.year, p.countryId)) && p.age >= (w.minAge ?? 0)).id;
  const n = rng.int(0, 2);
  for (let i = 0; i < n; i++) {
    const kind = rng.pick(INVITES.filter((x) => p.age >= x.minAge));
    if (!kind) break;
    const from = rng.pick(livingNpcs().filter((x) => kind.from.includes(x.role) && x.meters.relationship >= 35 && !x.flags.abroad && !s.invites.some((v) => v.fromId === x.id)));
    if (!from) continue;
    s.invites.push({ id: `${kind.id}_${store.state.year}_${i}`, kind: kind.id, name: kind.name, fromId: from.id, gift: kind.gift, bond: kind.bond, memorable: !!kind.memorable, how, answer: null });
  }
}

// ---------- Traditions ----------
// { id, occasion, holiday, name, founded, founder: { id, name }, hostId, participants: [npcId | 'you'],
//   lastYear, count, skipped: [years], history: [{ year, text }], status: 'active'|'lapsed'|'ended' }

/** The Joneses, the Farkases, the Smiths. */
export const familyPlural = (name) => (/(s|x|z|ch|sh)$/i.test(name) ? `${name}es` : `${name}s`);
const traditionFor = (item) => (item.holiday ? `holiday:${item.holiday}` : item.occasion);
function matchingTradition(item) {
  const k = traditionFor(item);
  return traditions().find((t) => t.status === 'active' && (t.holiday ? `holiday:${t.holiday}` : t.occasion) === k) ?? null;
}
/** Holidays, the reunion and Sunday visits can become traditions; the player must be an adult to start one. */
export const canFound = (item) => player().age >= 18 && !matchingTradition(item) && (!!item.holiday || ['family_reunion', 'visit_grandparents'].includes(item.occasion));

function foundTradition(item, people) {
  const p = player();
  const h = item.holiday ? HOLIDAYS.find((x) => x.id === item.holiday) : null;
  const t = { id: `trad_${store.state.year}_${traditions().length + 1}`, occasion: item.occasion, holiday: item.holiday ?? null,
    name: h ? `${h.name} at the ${familyPlural(p.lastName)}'` : item.occasion === 'family_reunion' ? `The ${p.lastName} family reunion` : 'Sundays with the grandparents',
    founded: store.state.year, founder: { id: p.id, name: `${p.firstName} ${p.lastName}` }, hostId: YOU, participants: [YOU, ...people.map((n) => n.id)],
    lastYear: store.state.year, count: 1, skipped: [], history: [{ year: store.state.year, text: `First kept, hosted by ${p.firstName}.` }], status: 'active' };
  traditions().push(t);
  yearState().done[`tradition:${t.id}`] = true; // begun this year is kept this year
  return t;
}
function keepTradition(t, people, by) {
  if (t.lastYear === store.state.year) return;
  t.lastYear = store.state.year;
  t.count += 1;
  for (const n of people) if (!t.participants.includes(n.id)) t.participants.push(n.id);
  if (by === YOU && !t.participants.includes(YOU)) t.participants.push(YOU);
  if ([5, 10, 25, 50, 75, 100].includes(t.count)) {
    t.history.push({ year: store.state.year, text: `Kept for the ${ordinal(t.count)} time.` });
    if (t.participants.includes(YOU)) milestone(`${t.name}: kept for the ${ordinal(t.count)} time.`, 'family');
  }
  yearState().done[`tradition:${t.id}`] = true;
}

/** Leaves a tradition out this year. Three years in a row and it fades. */
export function skipTradition(id) {
  const t = traditions().find((x) => x.id === id && x.status === 'active');
  if (!t) return result(false, 'There is no such tradition.', 'neutral');
  if (t.lastYear === store.state.year) return result(false, 'It has already been kept this year.', 'neutral');
  t.skipped ??= [];
  if (!t.skipped.includes(store.state.year)) t.skipped.push(store.state.year);
  const text = `${t.name} will not happen this year.`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}
/** Takes on the hosting of a tradition. */
export function takeOver(id) {
  const t = traditions().find((x) => x.id === id && x.status !== 'ended');
  if (!t) return result(false, 'There is no such tradition.', 'neutral');
  if (player().age < 18) return result(false, 'You are too young to host it.', 'neutral');
  if (t.hostId === YOU) return result(false, 'You host it already.', 'neutral');
  const was = npc(t.hostId)?.firstName;
  t.hostId = YOU; t.status = 'active';
  if (!t.participants.includes(YOU)) t.participants.push(YOU);
  t.history.push({ year: store.state.year, text: `${player().firstName} took over hosting${was ? ` from ${was}` : ''}.` });
  const text = `You will host ${t.name} from now on.`;
  log(text, 'system', 'good');
  return result(true, text);
}
/** Brings a faded tradition back. */
export function revive(id) {
  const t = traditions().find((x) => x.id === id && x.status === 'lapsed');
  if (!t) return result(false, 'There is nothing to bring back.', 'neutral');
  t.status = 'active'; t.hostId = YOU; t.skipped = [];
  if (!t.participants.includes(YOU)) t.participants.push(YOU);
  t.history.push({ year: store.state.year, text: `Brought back by ${player().firstName}.` });
  return result(true, `${t.name} is back.`);
}

// ---------- Age Up ----------

/**
 * The year is over: whatever the player did not organize happens or does not,
 * once. Called by Age Up before the year and ages move on.
 */
export function finishYear() {
  const state = store.state;
  const p = player();
  if (!p?.alive) return;
  const s = yearState();
  const year = state.year;
  const c = country();
  const lines = [];

  for (const t of traditions().filter((x) => x.status === 'active')) {
    // Whoever hosts it may be gone: it passes to the player, if they are part of it, or to the eldest who is.
    if (t.hostId !== YOU && !inLife(npc(t.hostId))) {
      const next = t.participants.includes(YOU) && p.age >= 18 ? YOU : t.participants.map(npc).filter(inLife).sort((a, b) => b.age - a.age)[0]?.id;
      t.history.push({ year, text: next ? `Passed to ${next === YOU ? p.firstName : npc(next).firstName} to host.` : 'Its host was gone, and nobody took it on.' });
      t.hostId = next ?? null;
    }
    const people = t.participants.filter((id) => id !== YOU).map(npc).filter(inLife);
    if (!t.hostId || people.length + (t.participants.includes(YOU) ? 1 : 0) < 2) { t.status = 'lapsed'; t.history.push({ year, text: 'Too few were left to keep it.' }); continue; }
    if (t.lastYear === year) continue; // kept by hand this year: nothing more
    if ((t.skipped ?? []).includes(year)) {
      let run = 0;
      while (t.skipped.includes(year - run)) run += 1;
      if (run >= TRADITION_LAPSE) { t.status = 'lapsed'; t.history.push({ year, text: `Skipped ${TRADITION_LAPSE} years running, and let go.` }); }
      continue;
    }
    // It happens anyway, as it always has.
    if (t.hostId === YOU) {
      const cost = localCost(t.holiday ? (HOLIDAYS.find((h) => h.id === t.holiday)?.cost ?? 100) : 150, c);
      if (p.finance.cash < cost) { t.skipped = [...(t.skipped ?? []), year]; t.history.push({ year, text: 'There was no money to host it this year.' }); continue; }
      p.finance.cash -= cost;
      book({ cat: 'leisure', src: 'moment', desc: t.name });
    }
    for (const n of people) closer(n, 2);
    keepTradition(t, people, t.participants.includes(YOU) ? YOU : null);
    lines.push(t.name);
  }

  // Invitations nobody answered: a close friend's is gone to; the rest are missed, and noticed a little.
  for (const inv of s.invites.filter((x) => x.answer == null)) {
    const from = npc(inv.fromId);
    if (!inLife(from)) { inv.answer = 'gone'; continue; }
    const gift = familyPays() ? 0 : localCost(inv.gift, c);
    if (from.meters.relationship >= 60 && p.finance.cash >= gift && !p.legal?.incarceration) { attend(inv, from, gift, true); lines.push(`${from.firstName}'s ${inv.name}`); }
    else { inv.answer = 'missed'; from.meters.relationship = clamp(from.meters.relationship - 2); }
  }

  // A round birthday or anniversary of someone close that went by without a word is felt.
  const spouse = npcsByRole('spouse')[0];
  if (spouse?.marriedAtAge != null) {
    const yrs = p.age - spouse.marriedAtAge;
    if (NAMED_ANNIVERSARIES[yrs] && [5, 10, 25, 40, 50].includes(yrs) && !s.done[`anniversary:${spouse.id}`]) {
      spouse.meters.relationship = clamp(spouse.meters.relationship - 3);
      log(`Your ${ordinal(yrs)} wedding anniversary went by without being marked. ${spouse.firstName} noticed.`, 'system', 'bad');
    }
  }

  // What the year held, for the life story.
  const held = [...s.log.map((x) => x.label), ...lines];
  if (held.length) {
    (p.momentsYears ??= []).push({ year, age: p.age, lines: [...new Set(held)].slice(0, 8) });
    if (p.momentsYears.length > 120) p.momentsYears.shift();
  }
  // A host who is growing old may want someone to take it on (engine/eventEngine.js scene).
  const tired = traditions().find((t) => t.status === 'active' && t.hostId !== YOU && npc(t.hostId)?.age >= 78 && !t.askedHandover && t.participants.includes(YOU) && p.age >= 18);
  if (tired) { tired.askedHandover = year; state.pendingEvents.push({ id: 'tradition_handover', cast: { host: tired.hostId } }); }
}

/** The new year: a fresh record and this year's invitations. Called by Age Up once the year has moved on. */
export function startYear() {
  yearState();
  dealInvites();
}

/** For a scene: the player takes over the tradition the cast host keeps, or lets someone else. */
export function sceneChoice(what, cast = {}) {
  const t = traditions().find((x) => x.status === 'active' && x.hostId === cast.host);
  if (!t) return null;
  if (what === 'takeover') return takeOver(t.id).text;
  if (what === 'lapse') { t.status = 'lapsed'; t.history.push({ year: store.state.year, text: 'Let go when its host could no longer manage it.' }); return null; }
  if (what === 'cousin') {
    const next = t.participants.map(npc).filter((n) => inLife(n) && n.id !== cast.host && n.age >= 25 && n.age < 70).sort((a, b) => a.age - b.age)[0];
    if (next) { t.history.push({ year: store.state.year, text: `${npc(cast.host)?.firstName ?? 'The host'} handed it to ${next.firstName}.` }); t.hostId = next.id; }
    return null;
  }
  return null;
}

// ---------- The next generation ----------

/**
 * When an heir carries the family on, its traditions come with it. Whoever
 * was the player is no longer among them; the heir is, as the player now.
 */
export function carryTraditions(old, next, heirId) {
  next.traditions = (old.traditions ?? []).map((t) => {
    const copy = JSON.parse(JSON.stringify(t));
    const was = copy.participants.includes(YOU);
    copy.participants = copy.participants.filter((id) => id !== YOU && id !== heirId && next.npcs[id]);
    if (was || t.participants.includes(heirId)) copy.participants.push(YOU);
    if (copy.hostId === YOU) {
      copy.hostId = next.player.age >= 18 ? YOU : copy.participants.find((id) => id !== YOU && next.npcs[id]?.alive && next.npcs[id].age >= 18) ?? null;
      copy.history.push({ year: next.year, text: `${old.player.firstName} died; ${copy.hostId === YOU ? `${next.player.firstName} hosts it now` : copy.hostId ? `${next.npcs[copy.hostId].firstName} hosts it now` : 'nobody hosts it for now'}.` });
    } else if (copy.hostId === heirId) copy.hostId = YOU;
    if (!copy.hostId && copy.status === 'active') copy.status = 'lapsed';
    delete copy.askedHandover;
    return copy;
  });
  next.player.momentsYears = [];
}
