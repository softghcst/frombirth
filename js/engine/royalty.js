// Royalty and nobility: being born into a title, meeting and marrying a
// royal, public duties, the public's opinion, succession, and honours.
//
// On the player:  p.royal = { countryId, rank, by: 'birth'|'marriage'|'honour',
//                             line, image, reigning, spouseId? }
//   line   place in the succession (1 is next), or null if not in it
//   image  the public's opinion, 0–100. Duties raise it; scandal sinks it.
// On a royal NPC: npc.flags.royal = { rank, line, title }
// The royal house itself (everyone in it, the line of succession, its history)
// lives in engine/dynasty.js. This file is the player's side of it.
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney, theCountry } from '../util.js';
import { store, player, country, livingNpcs, log, milestone } from '../state.js';
import { makeNpc } from './npcFactory.js';
import { ensureLife } from './npcLives.js';
import { COUNTRIES } from '../data/countries.js';
import * as dyn from './dynasty.js';
import { tickCourt } from './court.js';
import * as fame from './reputation.js';
import { tickReign, shiftSupport } from './reign.js';
import { counsel, tickHousehold } from './household.js';
import { MONARCHIES, ROYAL_RANKS, ALLOWANCE, BORN_ROYAL, BORN_NOBLE, DUTIES, DUTIES_PER_YEAR, DISGRACE } from '../data/royalty.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

/** The crown of a country, or null where there is none (or where it has been abolished). */
export const monarchy = (c = country()) => (MONARCHIES[c.id] && store.state?.dynasties?.[c.id]?.status !== 'abolished' ? MONARCHIES[c.id] : null);
export const royal = () => player().royal ?? null;
export const isRoyalFamily = () => !!royal() && ROYAL_RANKS.includes(royal().rank);
const rankRow = (countryId, rank) => MONARCHIES[countryId]?.ranks.find((r) => r[0] === rank);

/** "Princess", "Duke", "Sir": the word for a rank, in a country, for a gender. */
export function titleOf(countryId, rank, gender) {
  const row = rankRow(countryId, rank);
  return row ? (gender === 'female' ? row[2] : row[1]) : '';
}

/** The player's name as the world says it: "Queen Robin", "Sir Robin Hale", or plain "Robin Hale". */
export function styledName(p = player()) {
  const r = p.royal;
  if (!r) return `${p.firstName} ${p.lastName}`;
  const t = titleOf(r.countryId, r.rank, p.gender);
  if (ROYAL_RANKS.includes(r.rank)) return `${t} ${p.firstName}`;
  if (r.waiting) return `${p.firstName} ${p.lastName}`;
  return r.rank === 'knight' ? `${t} ${p.firstName} ${p.lastName}` : `${p.firstName} ${p.lastName}, ${t}`;
}

/** What the player is, in a few words: "Queen of Sweden", "Princess by marriage", "Baron". */
export function standing(p = player()) {
  const r = p.royal;
  if (!r) return '';
  const c = COUNTRIES[r.countryId];
  const t = titleOf(r.countryId, r.rank, p.gender);
  if (r.rank === 'monarch') return `${t}${r.reigning ? '' : ' consort'} of ${theCountry(c.name)}${r.dowager ? ', widowed' : ''}`;
  if (r.rank === 'heir') return `${t} of ${theCountry(c.name)}${r.line === 1 ? ', heir to the throne' : ''}`;
  if (r.waiting) return `Heir to the title of ${t.toLowerCase()}`;
  if (r.rank === 'royal') return `${t} of ${theCountry(c.name)}${r.by === 'marriage' ? ', by marriage' : r.line ? `, ${ordinal(r.line)} in line` : ''}`;
  return `${r.rank === 'knight' && t === 'Sir' ? 'Knight' : t}${r.by === 'honour' ? ', for services to the country' : ''}`;
}
const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4]}`;

// ---------- The throne ----------

/** Who is on the throne of the player's country, in brief. Null where there is no crown. */
export function court() {
  const d = dyn.house();
  if (!d) return null;
  const mo = dyn.monarchOf(d);
  return { countryId: d.countryId, monarch: { name: mo.name, gender: mo.gender, age: dyn.ageOf(mo), isPlayer: !!mo.isPlayer, npcId: mo.npcId ?? null } };
}
const monarchTitle = () => dyn.nameOf(dyn.house(), dyn.monarchOf());

/** "Princess Astrid" for a royal, plain "Astrid" for anyone else. */
export const npcName = (npc) => (npc?.flags?.royal?.title ? `${npc.flags.royal.title} ${npc.firstName}` : npc?.firstName ?? '');

/**
 * Copies the house's view of things onto the game's: titles onto the people
 * the player knows, and the player's own rank and place in line onto p.royal.
 * `st` is the game state (given explicitly while a life is being created).
 */
export function dress(d = dyn.house(), st = store.state) {
  if (!d) return;
  const line = dyn.lineOf(d);
  for (const x of Object.values(d.people)) {
    const npc = x.npcId ? st.npcs[x.npcId] : null;
    if (!npc) continue;
    const rank = dyn.rankOf(d, x);
    if (!rank) { delete npc.flags.royal; continue; }
    npc.flags.royal = { rank: rank === 'consort' ? 'monarch' : rank, line: line.indexOf(x.id) + 1 || null, title: dyn.titleOf(d, x, rank), consort: rank === 'consort' };
    if (npc.alive && (npc.age >= 18 || rank === 'monarch')) {
      npc.occupation = rank === 'monarch' ? 'reigning monarch' : rank === 'consort' ? 'consort to the monarch' : rank === 'heir' ? 'heir to the throne' : 'working royal';
      npc.meters.money = Math.max(npc.meters.money, 95);
      if (npc.life) npc.life.job = null;
    }
  }
  const r = st.player.royal;
  const me = dyn.playerPerson(d);
  if (!me || !r || r.countryId !== d.countryId || !ROYAL_RANKS.includes(r.rank)) return;
  if (r.by === 'birth') {
    if (me.id === d.monarchId) { r.rank = 'monarch'; r.reigning = true; r.line = null; return; }
    const place = line.indexOf(me.id) + 1;
    r.line = place || null; r.rank = place === 1 ? 'heir' : 'royal'; r.reigning = false;
  } else if (r.by === 'marriage') {
    const sp = d.people[me.spouseId ?? me.widowOf];
    const rank = dyn.rankOf(d, me);
    r.rank = rank === 'consort' ? 'monarch' : sp && sp.died == null && dyn.rankOf(d, sp) === 'heir' ? 'heir' : 'royal';
    r.reigning = false; r.line = null; r.dowager = rank === 'consort' && !!me.widowOf;
  }
}

// ---------- Birth ----------

/** Whether a newborn is to be 'royal', 'noble' or neither. `wish` is the creator's choice, if any. */
export function birthKind(countryId, wish) {
  const m = MONARCHIES[countryId];
  if (!m || wish === 'commoner') return null;
  const nobles = m.ranks.some((r) => !ROYAL_RANKS.includes(r[0]) && r[0] !== 'knight');
  if (wish) return wish === 'noble' && !nobles ? null : wish;
  const roll = rng.next();
  return roll < BORN_ROYAL ? 'royal' : roll < BORN_ROYAL + BORN_NOBLE && nobles ? 'noble' : null;
}

/**
 * Sets a newborn up with the title they are born to. For a royal child,
 * `seat` is their place in the house (dynasty.seatFamily), built around
 * their own parents before they were born.
 */
export function bornInto(p, kind, seat) {
  const m = MONARCHIES[p.countryId];
  if (!m || !kind) return;
  if (kind === 'royal' && seat) {
    const d = seat.dynasty;
    const me = dyn.seatPlayer(d, seat, p);
    const place = dyn.placeOf(d, me.id);
    p.royal = { countryId: p.countryId, rank: place === 1 ? 'heir' : 'royal', by: 'birth', line: place || null, image: Math.round(clamp(d.standing + 4, 35, 80)), reigning: false };
  } else if (kind === 'noble') {
    const nobles = m.ranks.filter((r) => !ROYAL_RANKS.includes(r[0]) && r[0] !== 'knight');
    const rank = rng.weighted(nobles, (_, i) => i + 1)[0];
    // The title itself comes with the death of the parent who holds it; until then the child is the heir to it.
    p.royal = { countryId: p.countryId, rank, by: 'birth', line: null, image: 55, reigning: false, waiting: true };
  }
}

// ---------- Meeting and marrying royalty ----------

/** Whether the palace would think of inviting this person: the famous, the rich and the titled. */
export function invitable() {
  const p = player();
  if (!monarchy() || p.age < 18 || p.legal.incarceration) return false;
  const worth = p.finance.cash / (country().currency.scale * (country().living?.costK ?? 1));
  if (isRoyalFamily()) return false; // they are the ones sending the invitations
  return p.hidden.fame >= 35 || worth >= 400000 || !!p.royal || !!(p.career.level >= 3 && p.career.careerId);
}

/** How the palace sees someone who wants to marry in, 0–100. */
export function suitability() {
  const p = player();
  let s = 30 + p.hidden.karma / 4 + p.hidden.fame / 5 + p.stats.charm / 5;
  s -= p.legal.record.filter((r) => r.convicted && !r.juvenile).length * 30;
  s -= Math.max(0, p.counters.spouses) * 10;
  if (p.royal) s += 15;
  if (p.flags.identity?.outOrientation && country().living?.laws.lgbt === 'hostile') s -= 20;
  return Math.round(clamp(s));
}

/**
 * An unmarried member of the royal house, near the player's age and drawn to
 * people like the player, brought into the game as someone they can know.
 * It is a real person from the house's family tree: usually a prince or
 * princess some way down the line, now and then the heir or a widowed monarch.
 */
export function eligibleRoyal() {
  const p = player();
  const c = country();
  const d = dyn.house();
  const want = p.flags.interestedIn;
  const gender = want === 'men' ? 'male' : want === 'women' ? 'female' : rng.pick(['male', 'female']);
  const x = dyn.eligibleMember(d, gender, p.age);
  const rank = dyn.rankOf(d, x) ?? 'royal';
  const npc = makeNpc({ role: 'partner', countryId: c.id, gender: x.gender, firstName: x.name, age: dyn.ageOf(x), relationship: rng.int(42, 58),
    orientation: gender === p.gender ? 'bisexual' : 'straight', appearance: x.look });
  x.npcId = npc.id;
  npc.flags.houseId = x.id;
  npc.flags.royal = { rank, line: dyn.placeOf(d, x.id) || null, title: dyn.titleOf(d, x, rank) };
  npc.lastName = `of ${theCountry(c.name)}`;
  npc.meters.money = 98;
  ensureLife(npc);
  npc.occupation = rank === 'monarch' ? 'reigning monarch' : rank === 'heir' ? 'heir to the throne' : 'working royal';
  if (npc.life) { npc.life.job = null; npc.life.lastJob = null; npc.life.history = []; npc.life.savings = localMoney(rank === 'royal' ? 2000000 : 20000000, c); }
  return npc;
}

/** Adds a royal met at the palace to the player's life as someone they are seeing. */
export function startSeeing(npc) {
  const p = player();
  store.state.npcs[npc.id] = npc;
  p.npcIds.push(npc.id);
  npc.lastInteractionAge = p.age;
  npc.flags.since = p.age;
  p.flags.courtedByPress = true;
  log(`You are seeing ${npcName(npc)} of ${theCountry(country().name)}. The newspapers already know.`, 'system', 'good');
}

/**
 * The palace's answer when the player and a royal want to marry. Called by
 * the wedding itself. @returns {{ok:boolean, text:string, leaves?:boolean}}
 */
export function consent(npc) {
  const p = player();
  const m = monarchy();
  if (!m || !npc.flags.royal) return { ok: true, text: '' };
  // In some houses a princess who marries a commoner simply leaves the family: no consent needed, and no title gained.
  if (m.leavesOnMarriage && npc.gender === 'female' && !p.royal) return { ok: true, leaves: true, text: `${npc.firstName} gives up her title to marry you, as the law of her house requires.` };
  if (p.flags.consentAge === p.age) return { ok: false, text: 'The palace has given its answer for this year.' };
  p.flags.consentAge = p.age;
  const s = suitability();
  const who = npc.flags.royal.rank === 'monarch' && !npc.flags.royal.consort ? 'The government' : monarchTitle();
  if (rng.chance(clamp((s - 25) / 55, 0.03, 0.95))) return { ok: true, text: `${who} gives consent to the marriage.` };
  // Refused. Now and then love wins anyway, at the cost of the title.
  if (npc.meters.relationship >= 88 && rng.chance(0.3)) return { ok: true, leaves: true, text: `${who} refuses consent. ${npc.firstName} chooses you over the crown, and gives up ${npc.flags.royal.rank === 'monarch' ? 'the throne' : 'the title'}.` };
  npc.meters.relationship = clamp(npc.meters.relationship - 8);
  return { ok: false, text: `${who} refuses consent to the marriage. The palace does not think you suitable${s < 40 ? ', and the newspapers agree' : ''}. You can ask again next year.` };
}

/** Called once the wedding has happened: the player takes their place in the family, or the royal leaves it. */
export function afterWedding(npc, leaves) {
  const p = player();
  const c = country();
  if (!npc.flags.royal) return '';
  const d = dyn.house();
  const x = d.people[npc.flags.houseId];
  if (leaves) {
    if (x) {
      if (x.id === d.monarchId) dyn.accede(d, 'abdication');
      x.out = monarchy(c).leavesOnMarriage ? 'left' : 'renounced';
      x.outYear = store.state.year;
      dyn.marryIn(d, x);
      dyn.playerPerson(d).divorced = undefined;
    }
    delete npc.flags.royal;
    npc.lastName = p.lastName;
    npc.occupation = 'former royal';
    dress(d);
    return ` ${npc.firstName} is a private citizen now, and so are you.`;
  }
  if (p.royal && ROYAL_RANKS.includes(p.royal.rank)) return ''; // already royal in their own right
  if (x) dyn.marryIn(d, x);
  p.royal = { countryId: c.id, rank: 'royal', by: 'marriage', line: null, image: Math.round(clamp(d.standing + 2, 40, 70)), reigning: false, spouseId: npc.id };
  dress(d);
  p.hidden.fame = clamp(p.hidden.fame + 30);
  p.flags.livesWithParents = false;
  p.flags.marriedRoyal = true;
  milestone(`Married into the royal family of ${theCountry(c.name)}.`, 'family');
  return ` The wedding is watched by half the world, and paid for by the crown. You are ${titleOf(c.id, p.royal.rank, p.gender)} ${p.firstName} now${p.royal.rank === 'monarch' ? ', consort to the monarch' : ''}. Marriage gives you a title, and no place in the line of succession.`;
}

/** Called when a marriage to a royal ends: a title held by marriage goes with it. */
export function afterDivorce(npc) {
  const p = player();
  const d = dyn.house(p.royal?.countryId ?? country().id);
  const x = d?.people[npc.flags.houseId];
  const me = d ? dyn.playerPerson(d) : null;
  if (x && me && !me.blood && (x.spouseId === me.id || me.spouseId === x.id)) {
    x.spouseId = null; me.spouseId = null; me.divorced = store.state.year;
    dyn.chronicle(d, `${dyn.nameOf(d, x)} and ${p.firstName} divorced.`, [x.id, me.id]);
  }
  if (p.royal?.by !== 'marriage' || p.royal.spouseId !== npc.id) return '';
  const was = titleOf(p.royal.countryId, p.royal.rank, p.gender);
  delete p.royal;
  p.flags.lostTitle = true;
  return ` You are no longer ${was}. The palace asks for the keys back.`;
}

// ---------- Life as a royal ----------

function acts() {
  const p = player();
  if (p.flags.royalActs?.age !== p.age) p.flags.royalActs = { age: p.age, done: 0 };
  return p.flags.royalActs;
}
export const dutiesLeft = () => DUTIES_PER_YEAR - acts().done;
export const canDoDuties = () => !!royal() && !royal().waiting && royal().rank !== 'knight' && player().age >= 16 && !player().legal.incarceration;
export const dutyOptions = () => DUTIES.map((d) => ({ id: d.id, name: d.name, kind: d.kind, risky: !!d.risky, cost: d.cost ? localMoney(d.cost, country()) : 0 }));
export const allowance = () => (royal() && !royal().waiting ? Math.round(localMoney(ALLOWANCE[royal().rank] ?? 0, country()) * (player().flags.familyFrost ? 0.5 : 1)) : 0);

/** Moves the public's opinion, and notes why (engine/reputation.js keeps the record). */
export function shiftImage(delta, why) {
  if (fame.rep()) fame.shift('image', delta, why);
}

/** A relative gives up their title and their place in the line, of their own will. */
export function kinRenounces(npc) {
  const d = dyn.house(player().royal?.countryId);
  const x = d?.people[npc?.flags?.houseId];
  if (!x || x.out) return;
  const before = dyn.nameOf(d, x);
  x.out = 'renounced'; x.outYear = store.state.year;
  dyn.chronicle(d, `${before} gave up a title and a place in the line of succession to live privately.`, [x.id]);
  dress(d);
}

/**
 * Someone born royal marries a person from outside the house. The spouse
 * joins the family tree; in a house whose law says so, the royal leaves it.
 * @returns {string} what to add to the wedding's account
 */
export function afterMarryingOut(npc) {
  const p = player();
  const r = royal();
  if (!r || r.by !== 'birth' || !ROYAL_RANKS.includes(r.rank) || npc.flags.royal) return '';
  const d = dyn.house(r.countryId);
  const me = dyn.playerPerson(d);
  if (!me) return '';
  dyn.marryOutsider(d, me, npc);
  const m = MONARCHIES[r.countryId];
  if (m.leavesOnMarriage && p.gender === 'female' && !r.reigning) {
    me.out = 'left'; me.outYear = store.state.year;
    dyn.chronicle(d, `${p.firstName} left the royal family on her marriage, as the law of the house requires.`, [me.id]);
    delete p.royal;
    p.flags.lostTitle = true;
    dress(d);
    return ' By the law of your house, a princess who marries outside it leaves the family. You are a private citizen now, with a single payment from the state to start you off.';
  }
  const blessed = (r.family ?? 60) >= 40;
  fame.shift('family', blessed ? 4 : -10, blessed ? 'a marriage the family blessed' : 'marrying without the family\'s blessing');
  dress(d);
  return blessed ? ` ${npc.firstName} joins the family, with a title and no place in the line.` : ` The family did not come. ${npc.firstName} has a title all the same, and no place in the line.`;
}

export function doDuty(id) {
  const p = player();
  const c = country();
  const d = DUTIES.find((x) => x.id === id);
  if (!canDoDuties() || !d) return result(false, 'That is not open to you.', 'neutral');
  if (dutiesLeft() <= 0) return result(false, 'Your diary is full for the year.', 'neutral');
  const cost = d.cost ? localMoney(d.cost, c) : 0;
  if (p.finance.cash < cost) return result(false, `It takes ${fmtMoney(cost, c)} of your own money. You do not have it.`, 'neutral');
  acts().done += 1;
  p.finance.cash -= cost;
  let change = rng.int(d.image[0], d.image[1]);
  // A good private secretary has you well briefed for the risky ones.
  if (d.risky) change = Math.round(change + (p.stats.charm - 50) / 6 + (p.stats.intellect - 50) / 10 + counsel() * 30);
  const before = royal().image;
  shiftImage(change, d.name.toLowerCase().replace(/^(open|become|go on|visit|give|meet)/, (w) => ({ open: 'opening', become: 'becoming', 'go on': 'going on', visit: 'visiting', give: 'giving', meet: 'meeting' })[w]));
  change = royal().image - before;
  if (d.mood) p.stats.mood = clamp(p.stats.mood + d.mood);
  if (d.karma) p.hidden.karma = clamp(p.hidden.karma + d.karma);
  if (d.family) fame.shift('family', d.family, `${d.name[0].toLowerCase()}${d.name.slice(1)}`);
  if (d.support) shiftSupport(d.support, dyn.house(royal().countryId));
  const how = change >= 6 ? 'The country loved it.' : change >= 1 ? 'It went well.' : change >= -3 ? 'It did you no good.' : 'It was a disaster, replayed for a week.';
  const text = `${rng.pick([].concat(d.text))} ${how}`;
  log(text, 'system', change >= 0 ? 'good' : 'bad');
  return result(change >= 0, text);
}

/** Walking away: a royal gives up their place, a noble their title. It cannot be undone. */
export function renounce() {
  const p = player();
  const r = royal();
  if (!r) return result(false, 'You have no title to give up.', 'neutral');
  const was = standing();
  const wasMonarch = r.rank === 'monarch' && r.reigning;
  let next = null;
  if (ROYAL_RANKS.includes(r.rank)) {
    const d = dyn.house(r.countryId);
    const me = dyn.playerPerson(d);
    if (wasMonarch) next = dyn.accede(d, 'abdication');
    else if (me?.blood) { me.out = 'renounced'; me.outYear = store.state.year; dyn.chronicle(d, `${dyn.nameOf(d, { ...me, out: null })} gave up a place in the royal family to live privately.`, [me.id]); }
    delete p.royal;
    dress(d);
  }
  delete p.royal;
  if (wasMonarch) p.flags.abdicated = true;
  p.stats.mood = clamp(p.stats.mood + 4);
  const text = wasMonarch ? `You have abdicated. ${next ? `${dyn.nameOf(dyn.house(r.countryId), next)} reigns in your place, and` : 'The crown passes on, and'} for the first time in your life nobody is watching you eat breakfast.`
    : `You have given up your place as ${was}. You are a private citizen, with a private citizen's income.`;
  log(text, 'system', 'neutral');
  milestone(wasMonarch ? 'Abdicated the throne.' : 'Renounced a title.', 'life');
  return result(true, text, 'neutral');
}

/** An honour from the crown for a commoner who has earned one. */
export function honour(rank) {
  const p = player();
  const c = country();
  if (!monarchy(c) || (p.royal && p.royal.rank !== 'knight')) return '';
  p.royal = { countryId: c.id, rank, by: 'honour', line: null, image: 60, reigning: false };
  p.flags.honouredAs = rank;
  milestone(`Was made ${titleOf(c.id, rank, p.gender) === 'Sir' || titleOf(c.id, rank, p.gender) === 'Dame' ? `a ${p.gender === 'female' ? 'dame' : 'knight'}` : `${/^[AEIOU]/.test(titleOf(c.id, rank, p.gender)) ? 'an' : 'a'} ${titleOf(c.id, rank, p.gender).toLowerCase()}`}.`, 'fame');
  return styledName(p);
}

/** Yearly: the allowance, what the public thinks, the succession, and invitations and honours for commoners. */
export function tickRoyalty() {
  const p = player();
  const c = country();
  const m = monarchy(c);
  const r = royal();

  const old = p.flags.formerRoyal;
  if (old && old.countryId !== c.id && store.state.dynasties?.[old.countryId]) {
    const far = store.state.dynasties[old.countryId];
    dyn.tickDynasty(far); tickReign(far);
  }
  // Someone who leaves the country leaves the role (a title of honour or nobility travels with them).
  if (r && r.countryId !== c.id && ROYAL_RANKS.includes(r.rank)) {
    delete p.royal;
    log('Having left the country, you are no longer a working member of the royal family.', 'system', 'neutral');
    return;
  }
  if (!m) {
    // A house without a throne still lives, and may yet be asked back.
    const fallen = MONARCHIES[c.id] ? store.state.dynasties?.[c.id] : null;
    if (fallen) { dyn.tickDynasty(fallen); tickReign(fallen); }
    return;
  }
  // The house lives a year: births, marriages, scandals, deaths, and the throne changing hands.
  const d = dyn.house();
  const inFamily = isRoyalFamily();
  const before = inFamily && r.by === 'birth' ? r.line : null;
  const wasHeir = before === 1;
  const res = dyn.tickDynasty(d);
  const me = dyn.playerPerson(d);
  if (res.newMonarch) {
    const old = `${titleOf(c.id, 'monarch', res.oldMonarch.gender)} ${res.oldMonarch.name}`;
    const next = res.newMonarch;
    if (next.isPlayer && r) {
      dress(d);
      p.hidden.fame = 100;
      p.flags.reigned = true;
      log(`${old} has died. You are ${titleOf(c.id, 'monarch', p.gender)} ${p.firstName} of ${theCountry(c.name)}.`, 'system', 'good');
      milestone(`Crowned ${titleOf(c.id, 'monarch', p.gender)} of ${theCountry(c.name)}.`, 'fame');
      if (p.age < 18) log('You are too young to rule. A regent will govern in your name until you are eighteen.', 'system', 'neutral');
      else store.state.pendingEvents.push({ id: 'coronation_day', cast: {} });
    } else {
      if (p.age >= 8) log(`${old} has died. ${dyn.nameOf(d, next)} has come to the throne.`, 'system', inFamily ? 'bad' : 'neutral');
      if (me && !me.blood && next.id === me.spouseId) {
        log(`You are ${titleOf(c.id, 'monarch', p.gender)} consort.`, 'system', 'good');
        milestone(`Became ${titleOf(c.id, 'monarch', p.gender)} consort of ${theCountry(c.name)}.`, 'fame');
      }
    }
  }
  dress(d);
  // News of the family reaches those who are in it.
  if (me && inFamily && p.age >= 6) {
    const mine = res.news.filter((n) => !n.ids.includes(d.monarchId) || !res.newMonarch)
      .filter((n) => n.weight >= 4 || n.ids.some((id) => dyn.closeness(d, me.id, id) <= 3)).slice(0, 4);
    for (const n of mine) log(n.text, 'system', 'neutral');
  }
  if (royal()?.by === 'birth' && isRoyalFamily() && !royal().reigning && before !== royal().line && p.age >= 6) {
    const now = royal().line;
    log(now ? `You are now ${ordinal(now)} in line to the throne${before ? ` (you were ${ordinal(before)})` : ''}.` : 'You no longer have a place in the line of succession.', 'system', now && before && now < before ? 'good' : 'neutral');
    // Someone just ahead has walked away from it all.
    if (now && before && now < before && now <= 3 && p.age >= 14 && !wasHeir && res.news.some((n) => n.weight >= 4 && /gave up/.test(n.text))) {
      store.state.pendingEvents.push({ id: 'heirs_dilemma', cast: {} });
    }
  }

  // A secret does not keep for ever.
  if (p.flags.secretLove && isRoyalFamily()) {
    const love = livingNpcs().find((n) => n.role === 'partner' && n.memories?.some((x) => x.key === 'secretRoyal'));
    if (!love) p.flags.secretLove = false;
    else if (rng.chance(0.45)) store.state.pendingEvents.push({ id: 'royal_love_found_out', cast: { love: love.id } });
  }

  // The crown itself: what the country makes of it, and whether it lasts.
  tickReign(d);
  tickHousehold(d);
  if (!royal() && r) return; // the monarchy fell this year

  // Family politics: for those born into it.
  if (isRoyalFamily() && royal().by === 'birth') tickCourt(d);

  // A noble title waits for the parent who holds it.
  if (r?.waiting && !livingNpcs().some((n) => n.role === 'parent')) {
    r.waiting = false;
    log(`With your parents gone, the title is yours. You are ${styledName(p)}.`, 'system', 'neutral');
    milestone(`Inherited the title of ${titleOf(r.countryId, r.rank, p.gender).toLowerCase()}.`, 'family');
  }

  if (r && !r.waiting && r.rank !== 'knight') {
    // Money from the crown, while the public will stand for it.
    const pay = allowance();
    if (pay && p.age >= 18) {
      p.finance.cash += pay;
      p.finance.lifetimeEarned += pay;
      log(`Your allowance as ${titleOf(r.countryId, r.rank, p.gender).toLowerCase()} came to ${fmtMoney(pay, c)}.`);
    }
    // The public's opinion: neglect, scandal and time.
    if (ROYAL_RANKS.includes(r.rank) && p.age >= 18) {
      const done = p.flags.royalActs?.age === p.age - 1 ? p.flags.royalActs.done : 0;
      if (!done) { shiftImage(-6, 'no public duties all year'); log('You carried out no public duties this year, and it was noticed.', 'system', 'bad'); }
      fame.tickReputation(done);
      r.image = Math.round(r.image + (50 - r.image) * 0.12); // yesterday's cheers fade, and so do yesterday's scandals
      if (p.legal.record.some((x) => x.convicted && x.age === p.age - 1)) { shiftImage(-35, 'a criminal conviction'); fame.shift('family', -25, 'a criminal conviction'); fame.addStory('your conviction', true, 70); }
      if (p.legal.incarceration) shiftImage(-20, 'being in prison');
      p.hidden.fame = clamp(Math.max(p.hidden.fame, r.rank === 'monarch' ? 95 : 70));
      if (r.image < DISGRACE) {
        const was = standing();
        const monarchOut = r.rank === 'monarch' && r.reigning;
        if (monarchOut) dyn.accede(d, 'removed');
        else if (me?.blood) { me.out = 'removed'; me.outYear = store.state.year; dyn.chronicle(d, `${p.firstName} was removed from royal life by the palace.`, [me.id]); }
        delete p.royal;
        dress(d);
        p.flags.lostTitle = true;
        p.stats.mood = clamp(p.stats.mood - 15);
        const text = monarchOut ? 'The country has had enough. Parliament asks for your abdication, and gets it.'
          : `The palace announces that you will no longer carry out royal duties or use your title. You are no longer ${was}.`;
        log(text, 'system', 'bad');
        milestone(monarchOut ? 'Forced to abdicate.' : 'Stripped of a royal title.', 'life');
      }
    }
  }

  // For commoners: an invitation to the palace, and now and then an honour.
  if (p.age >= 18 && p.age <= 55 && !p.legal.incarceration && invitable() && !livingNpcs().some((n) => n.role === 'spouse' || n.role === 'partner')
      && p.flags.palaceAge !== p.age && rng.chance(0.3)) {
    p.flags.palaceAge = p.age;
    store.state.pendingEvents.push({ id: 'palace_invitation', cast: {} });
  }
  if (m.honours && p.age >= 30 && !p.royal && !p.flags.honoured && !p.legal.record.some((x) => x.convicted && !x.juvenile)) {
    const great = p.counters.donated >= 1000000 || p.hidden.fame >= 90;
    const good = p.counters.donated >= 100000 || p.hidden.fame >= 65 || (p.counters.livesSaved ?? 0) >= 2;
    if ((great || good) && rng.chance(0.2)) {
      p.flags.honoured = true;
      p.flags.honourRank = great ? 'baron' : 'knight';
      store.state.pendingEvents.push({ id: 'honours_letter', cast: {} });
    }
  }
}

/**
 * When the story carries on with a child or grandchild: the house goes with
 * it, and the heir takes whatever place in it is really theirs. Called by
 * legacy.continueAs once the new state is in place. `old` is the previous
 * state, `h` the heir as they were.
 */
export function inheritStanding(old, h) {
  const p = player();
  const op = old.player;
  const r = op.royal;
  if (old.dynasties) store.state.dynasties = old.dynasties;
  const d = store.state.dynasties?.[p.countryId];
  if (d) {
    const was = dyn.playerPerson(d);
    const me = Object.values(d.people).find((x) => x.npcId === h.id);
    if (was) {
      was.isPlayer = false;
      was.wasPlayer = true;
      was.look = op.appearance;
      if (was.died == null) {
        const title = dyn.nameOf(d, was);
        was.died = old.year;
        const sp = d.people[was.spouseId];
        if (sp) { sp.widowOf = was.id; sp.spouseId = null; }
        dyn.chronicle(d, `${title} died, aged ${op.age}.`, [was.id]);
      }
    }
    if (me) {
      me.isPlayer = true;
      delete me.npcId;
      let note = '';
      if (was && d.monarchId === was.id) {
        const next = dyn.accede(d, 'death');
        if (next.id !== me.id) note = ` ${dyn.nameOf(d, next)} has come to the throne.`;
      }
      if (me.blood && dyn.rankOf(d, me)) {
        p.royal = { countryId: d.countryId, rank: 'royal', by: 'birth', line: null, image: Math.round(clamp(d.standing + 3, 35, 80)), reigning: false };
        dress(d);
        if (p.royal.reigning) {
          p.flags.reigned = true;
          p.hidden.fame = 100;
          milestone(`Crowned ${titleOf(d.countryId, 'monarch', p.gender)} of ${theCountry(COUNTRIES[d.countryId].name)}.`, 'fame');
          return `The crown has passed to you. You are ${titleOf(d.countryId, 'monarch', p.gender)} ${p.firstName} of ${theCountry(COUNTRIES[d.countryId].name)}.`;
        }
        p.hidden.fame = Math.max(p.hidden.fame, 70);
        return `You are ${styledName(p)}${p.royal.line ? `, ${ordinal(p.royal.line)} in line to the throne` : ''}.${note}`;
      }
      dress(d);
      if (note) return note.trim();
    }
  }
  if (r && r.countryId === p.countryId && r.by === 'birth' && !ROYAL_RANKS.includes(r.rank) && r.rank !== 'knight' && h.role === 'child') {
    p.royal = { countryId: r.countryId, rank: r.rank, by: 'birth', line: null, image: 55, reigning: false };
    return `The title has come down to you. You are ${styledName(p)}.`;
  }
  return '';
}
