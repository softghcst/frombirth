// Royalty and nobility: being born into a title, meeting and marrying a
// royal, public duties, the public's opinion, succession, and honours.
//
// On the player:  p.royal = { countryId, rank, by: 'birth'|'marriage'|'honour',
//                             line, image, reigning, spouseId? }
//   line   place in the succession (1 is next), or null if not in it
//   image  the public's opinion, 0–100. Duties raise it; scandal sinks it.
// On a royal NPC: npc.flags.royal = { rank, line, title }
// The throne itself is kept simply in state.court = { monarch: { name, gender, age } }.
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney, theCountry } from '../util.js';
import { store, player, country, livingNpcs, log, milestone } from '../state.js';
import { makeNpc } from './npcFactory.js';
import { ensureLife } from './npcLives.js';
import { COUNTRIES } from '../data/countries.js';
import { MONARCHIES, ROYAL_RANKS, ALLOWANCE, BORN_ROYAL, BORN_NOBLE, DUTIES, DUTIES_PER_YEAR, DISGRACE } from '../data/royalty.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

export const monarchy = (c = country()) => MONARCHIES[c.id] ?? null;
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

/** The reigning monarch of the player's country, invented once and then aged like anyone else. */
export function court() {
  const c = country();
  if (!monarchy(c)) return null;
  const st = store.state;
  if (st.court?.countryId !== c.id) {
    const gender = monarchy(c).maleOnly ? 'male' : rng.pick(['male', 'female']);
    const born = st.player.flags.courtAtBirth;
    st.court = { countryId: c.id, monarch: born && st.player.royal?.countryId === c.id && st.player.royal.by === 'birth' && !st.court
      ? { ...born, age: born.age + st.player.age } : { name: rng.pick(c.names[gender]), gender, age: rng.int(45, 78) } };
  }
  return st.court;
}
const monarchTitle = () => `${titleOf(country().id, 'monarch', court().monarch.gender)} ${court().monarch.name}`;

/** "Princess Astrid" for a royal, plain "Astrid" for anyone else. */
export const npcName = (npc) => (npc?.flags?.royal?.title ? `${npc.flags.royal.title} ${npc.firstName}` : npc?.firstName ?? '');

/** A new monarch for the country, when the old one is gone and the player is not next. */
function crownSomeoneElse() {
  const c = country();
  const m = monarchy(c);
  if (!m || !store.state.court) return;
  const gender = m.maleOnly ? 'male' : rng.pick(['male', 'female']);
  store.state.court.monarch = { name: rng.pick(c.names[gender]), gender, age: rng.int(32, 62) };
}

// ---------- Birth ----------

/**
 * Decides whether a newborn is royal or noble, and sets it up. Called by
 * character creation. `wish` is 'royal' | 'noble' | 'commoner' | undefined (chance).
 */
export function bornInto(p, wish) {
  const m = MONARCHIES[p.countryId];
  if (!m || wish === 'commoner') return;
  const nobles = m.ranks.filter((r) => !ROYAL_RANKS.includes(r[0]) && r[0] !== 'knight');
  const roll = rng.next();
  const kind = wish ?? (roll < BORN_ROYAL ? 'royal' : roll < BORN_ROYAL + BORN_NOBLE && nobles.length ? 'noble' : null);
  if (!kind) return;
  const male = (p.flags.bornAs ?? p.gender) === 'male';
  if (kind === 'royal') {
    // Either the monarch's child, or a child of the monarch's younger brother or sister.
    const direct = rng.chance(0.4);
    const line = m.maleOnly && !male ? null : direct ? rng.int(1, 3) : rng.int(4, 8);
    p.royal = { countryId: p.countryId, rank: line === 1 ? 'heir' : 'royal', by: 'birth', line, image: 60, reigning: false };
    const gender = m.maleOnly ? 'male' : rng.pick(['male', 'female']);
    p.flags.courtAtBirth = { name: rng.pick(COUNTRIES[p.countryId].names[gender]), gender, age: direct ? rng.int(30, 48) : rng.int(40, 62) };
  } else if (nobles.length) {
    const rank = (wish === 'noble' ? rng.pick(nobles) : rng.weighted(nobles, (_, i) => i + 1))[0];
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
 * Creates an unmarried royal near the player's age, drawn to people like the
 * player. Usually a prince or princess some way down the line; now and then
 * the heir, and once in a long while the monarch, widowed. Not yet part of the player's life.
 */
export function eligibleRoyal() {
  const p = player();
  const c = country();
  const m = monarchy(c);
  const k = court();
  const want = p.flags.interestedIn;
  const gender = want === 'men' ? 'male' : want === 'women' ? 'female' : rng.pick(['male', 'female']);
  const canReign = !m.maleOnly || gender === 'male';
  const roll = rng.next();
  let rank = 'royal';
  if (roll < 0.08 && canReign && p.age >= 28 && !k.monarch.isPlayer && !k.monarch.npcId) rank = 'monarch';
  else if (roll < 0.28 && canReign) rank = 'heir';
  const age = rank === 'monarch' ? clamp(p.age + rng.int(0, 12), 30, 72) : clamp(p.age + rng.int(-5, 6), 18, 60);
  const npc = makeNpc({ role: 'partner', countryId: c.id, gender, age, relationship: rng.int(42, 58),
    orientation: gender === p.gender ? 'bisexual' : 'straight' });
  const line = rank === 'monarch' ? null : rank === 'heir' ? 1 : canReign ? rng.int(2, 7) : null;
  npc.flags.royal = { rank, line, title: titleOf(c.id, rank, gender) };
  npc.lastName = `of ${theCountry(c.name)}`;
  npc.meters.money = 98;
  ensureLife(npc);
  npc.occupation = rank === 'monarch' ? 'reigning monarch' : rank === 'heir' ? 'heir to the throne' : 'working royal';
  if (npc.life) { npc.life.job = null; npc.life.lastJob = null; npc.life.history = []; npc.life.savings = localMoney(rank === 'royal' ? 2000000 : 20000000, c); }
  if (rank === 'monarch') k.monarch = { name: npc.firstName, gender, age: npc.age, npcId: npc.id };
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
  const who = npc.flags.royal.rank === 'monarch' ? 'The government' : monarchTitle();
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
  if (leaves) {
    if (store.state.court?.monarch.npcId === npc.id) crownSomeoneElse();
    delete npc.flags.royal;
    npc.lastName = p.lastName;
    npc.occupation = 'former royal';
    return ` ${npc.firstName} is a private citizen now, and so are you.`;
  }
  if (p.royal && ROYAL_RANKS.includes(p.royal.rank)) return ''; // already royal in their own right
  p.royal = { countryId: c.id, rank: npc.flags.royal.rank, by: 'marriage', line: null, image: 58, reigning: false, spouseId: npc.id };
  p.hidden.fame = clamp(p.hidden.fame + 30);
  p.flags.livesWithParents = false;
  p.flags.marriedRoyal = true;
  milestone(`Married into the royal family of ${theCountry(c.name)}.`, 'family');
  return ` The wedding is watched by half the world, and paid for by the crown. You are ${titleOf(c.id, p.royal.rank, p.gender)} ${p.firstName} now.`;
}

/** Called when a marriage to a royal ends: a title held by marriage goes with it. */
export function afterDivorce(npc) {
  const p = player();
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
export const dutyOptions = () => DUTIES.map((d) => ({ id: d.id, name: d.name, risky: !!d.risky, cost: d.cost ? localMoney(d.cost, country()) : 0 }));
export const allowance = () => (royal() && !royal().waiting ? localMoney(ALLOWANCE[royal().rank] ?? 0, country()) : 0);

/** Moves the public's opinion. The better liked a royal already is, the less each good deed adds. */
export function shiftImage(delta) {
  const r = royal();
  if (!r) return;
  const d = delta > 0 ? Math.max(1, Math.round(delta * Math.min(1, (100 - r.image) / 55))) : delta;
  r.image = Math.round(clamp(r.image + d));
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
  if (d.risky) change = Math.round(change + (p.stats.charm - 50) / 6 + (p.stats.intellect - 50) / 10);
  const before = royal().image;
  shiftImage(change);
  change = royal().image - before;
  if (d.mood) p.stats.mood = clamp(p.stats.mood + d.mood);
  if (d.karma) p.hidden.karma = clamp(p.hidden.karma + d.karma);
  const how = change >= 6 ? 'The country loved it.' : change >= 1 ? 'It went well.' : change >= -3 ? 'It did you no good.' : 'It was a disaster, replayed for a week.';
  const text = `${d.text} ${how}`;
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
  delete p.royal;
  if (wasMonarch) { crownSomeoneElse(); p.flags.abdicated = true; }
  p.stats.mood = clamp(p.stats.mood + 4);
  const text = wasMonarch ? `You have abdicated. The crown passes on, and for the first time in your life nobody is watching you eat breakfast.`
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

  // Someone who leaves the country leaves the role (a title of honour or nobility travels with them).
  if (r && r.countryId !== c.id && ROYAL_RANKS.includes(r.rank)) {
    delete p.royal;
    log('Having left the country, you are no longer a working member of the royal family.', 'system', 'neutral');
    return;
  }
  if (!m) return;
  const k = court();

  // The throne: the monarch ages, and one day dies.
  const known = k.monarch.npcId ? store.state.npcs[k.monarch.npcId] : null;
  let dies;
  if (known) { k.monarch.age = known.age; dies = !known.alive; } else {
    k.monarch.age += 1;
    dies = rng.chance(k.monarch.age < 60 ? 0.006 : k.monarch.age < 75 ? 0.03 : k.monarch.age < 88 ? 0.1 : 0.3);
  }
  const spouse = r?.spouseId ? store.state.npcs[r.spouseId] : null;
  if (dies && !(r?.rank === 'monarch' && r.reigning)) {
    const old = monarchTitle();
    if (r?.by === 'birth' && r.line === 1 && !r.waiting) {
      r.rank = 'monarch'; r.reigning = true; r.line = null;
      k.monarch = { name: p.firstName, gender: p.gender, age: p.age, isPlayer: true };
      p.hidden.fame = 100;
      p.flags.reigned = true;
      log(`${old} has died. You are ${titleOf(c.id, 'monarch', p.gender)} ${p.firstName} of ${theCountry(c.name)}.`, 'system', 'good');
      milestone(`Crowned ${titleOf(c.id, 'monarch', p.gender)} of ${theCountry(c.name)}.`, 'fame');
      if (p.age < 18) log('You are too young to rule. A regent will govern in your name until you are eighteen.', 'system', 'neutral');
      else store.state.pendingEvents.push({ id: 'coronation_day', cast: {} });
    } else if (spouse?.alive && spouse.flags.royal?.line === 1) {
      spouse.flags.royal = { rank: 'monarch', line: null, title: titleOf(c.id, 'monarch', spouse.gender) };
      spouse.occupation = 'reigning monarch';
      r.rank = 'monarch'; r.reigning = false;
      k.monarch = { name: spouse.firstName, gender: spouse.gender, age: spouse.age, npcId: spouse.id };
      log(`${old} has died. ${spouse.firstName} is ${spouse.flags.royal.title} now, and you are ${titleOf(c.id, 'monarch', p.gender)} consort.`, 'system', 'good');
      milestone(`Became ${titleOf(c.id, 'monarch', p.gender)} consort of ${theCountry(c.name)}.`, 'fame');
    } else {
      const gender = m.maleOnly ? 'male' : rng.pick(['male', 'female']);
      k.monarch = { name: rng.pick(c.names[gender]), gender, age: rng.int(35, 62) };
      if (p.age >= 8) log(`${old} has died. ${monarchTitle()} has come to the throne.`);
      if (r?.by === 'marriage' && r.rank === 'monarch') r.dowager = true;
      if (r?.by === 'birth' && r.line > 1) { r.line -= 1; if (r.line === 1) r.rank = 'heir'; }
      if (spouse?.alive && spouse.flags.royal?.line > 1) spouse.flags.royal.line -= 1;
    }
  }

  // People ahead in the line drop out now and then; new births push everyone back.
  for (const who of [r?.by === 'birth' ? r : null, spouse?.alive ? spouse.flags.royal : null]) {
    if (!who || !who.line || who.line <= 1) continue;
    if (rng.chance(0.03)) { who.line -= 1; if (who === r && r.line === 1) { r.rank = 'heir'; log('A death in the family has made you heir to the throne.', 'system', 'neutral'); } }
    else if (rng.chance(0.05)) who.line += 1;
  }

  // Children of the royal family are princes and princesses from birth.
  if (isRoyalFamily()) {
    for (const kid of livingNpcs()) {
      if (kid.role === 'child' && !kid.flags.royal && !kid.flags.adopted) kid.flags.royal = { rank: 'royal', line: null, title: titleOf(c.id, 'royal', kid.gender) };
    }
  }

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
      if (!done) { shiftImage(-6); log('You carried out no public duties this year, and it was noticed.', 'system', 'bad'); }
      r.image = Math.round(r.image + (50 - r.image) * 0.12); // yesterday's cheers fade, and so do yesterday's scandals
      if (p.legal.record.some((x) => x.convicted && x.age === p.age - 1)) shiftImage(-35);
      if (p.legal.incarceration) shiftImage(-20);
      p.hidden.fame = clamp(Math.max(p.hidden.fame, r.rank === 'monarch' ? 95 : 70));
      if (r.image < DISGRACE) {
        const was = standing();
        const monarchOut = r.rank === 'monarch' && r.reigning;
        delete p.royal;
        p.flags.lostTitle = true;
        if (monarchOut) crownSomeoneElse();
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
 * When the story carries on with a child or grandchild: what of the old
 * player's standing passes to them. Called by legacy.continueAs once the new
 * state is in place. `old` is the previous state, `h` the heir as they were.
 */
export function inheritStanding(old, h) {
  const p = player();
  const op = old.player;
  const r = op.royal;
  if (old.court) store.state.court = old.court;
  if (!r || r.countryId !== p.countryId) return '';
  const m = MONARCHIES[r.countryId];
  const mayReign = !m.maleOnly || p.gender === 'male';
  if (ROYAL_RANKS.includes(r.rank) && (r.by === 'birth' || h.flags.royal)) {
    if (r.rank === 'monarch' && r.reigning && mayReign) {
      p.royal = { countryId: r.countryId, rank: 'monarch', by: 'birth', line: null, image: 60, reigning: true };
      p.flags.reigned = true;
      p.hidden.fame = 100;
      store.state.court = { countryId: r.countryId, monarch: { name: p.firstName, gender: p.gender, age: p.age, isPlayer: true } };
      milestone(`Crowned ${titleOf(r.countryId, 'monarch', p.gender)} of ${theCountry(COUNTRIES[r.countryId].name)}.`, 'fame');
      return `The crown has passed to you. You are ${titleOf(r.countryId, 'monarch', p.gender)} ${p.firstName} of ${theCountry(COUNTRIES[r.countryId].name)}.`;
    }
    if (r.rank === 'monarch' && r.reigning) crownSomeoneElse();
    const line = !mayReign ? null : r.line ? r.line : rng.int(2, 6);
    p.royal = { countryId: r.countryId, rank: line === 1 ? 'heir' : 'royal', by: 'birth', line, image: 58, reigning: false };
    p.hidden.fame = Math.max(p.hidden.fame, 70);
    return `You are ${styledName(p)}, ${standing(p).replace(/^\S+( \S+)? of/, 'of')}.`;
  }
  if (r.by === 'birth' && !ROYAL_RANKS.includes(r.rank) && r.rank !== 'knight' && h.role === 'child') {
    p.royal = { countryId: r.countryId, rank: r.rank, by: 'birth', line: null, image: 55, reigning: false };
    return `The title has come down to you. You are ${styledName(p)}.`;
  }
  return '';
}
