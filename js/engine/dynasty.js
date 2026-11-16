// The royal house of a country: everyone in it, back about 150 years, who
// reigned when, and what has happened. One per monarchy, kept in the save as
// state.dynasties[countryId], and carried on when the story passes to an heir.
//
// A person in the house:
//   { id, name, gender, born, died, parents: [id…], spouseId, blood, adopted,
//     out, outYear, look, npcId, isPlayer, t: { ambition, loyalty, charisma, scandal },
//     story: [{ year, text }], note }
//   blood     descends from the house; people who married in are not
//   out       'renounced' | 'removed' | 'left': no place in the line (engine/succession.js)
//   look      an appearance (js/avatar), inherited from parents like anyone's
//   npcId     set when this is also someone in the player's life (state.npcs);
//             those people live through the ordinary NPC systems, and are
//             copied into the house each year. Everyone else lives here.
// The house:
//   { countryId, name, law, monarchId, people, reigns: [{ id, from, to }],
//     history: [{ year, text, ids }], standing, seq }
//   standing  how the public sees the house as a whole, 0–100
import { rng } from '../rng.js';
import { clamp, theCountry } from '../util.js';
import { store, player, country, log } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { MONARCHIES, REIGN_NOTES, SCANDALS } from '../data/royalty.js';
import { inheritAppearance, randomAppearance, ensureStyled, cloneAppearance } from '../avatar/inherit.js';
import { skinDepth, normalize, part } from '../avatar/catalog.js';
import { makeNpc } from './npcFactory.js';
import { lineOfSuccession, childrenOf, bloodParent, barred, relationTo, audit } from './succession.js';

const yearNow = () => store.state.year;
const ageOf = (p, year = yearNow()) => (p.died ?? year) - p.born;
const living = (d) => Object.values(d.people).filter((p) => p.died == null);
const titleRow = (cid, rank) => MONARCHIES[cid].ranks.find((r) => r[0] === rank);
const word = (cid, rank, gender) => { const r = titleRow(cid, rank); return r ? (gender === 'female' ? r[2] : r[1]) : ''; };
const trait = () => Math.round(clamp(rng.around(50, 30)));

// ---------- Building a house ----------

// The line of succession is worked out once and kept until something changes. Every change to a house
// goes through newPerson(), record() or accede(), which throw the kept line away.
const LINES = new WeakMap();
const touch = (d) => LINES.delete(d);

function newPerson(d, o) {
  touch(d);
  d.seq += 1;
  const p = { id: `h${d.seq}`, name: o.name, gender: o.gender, born: o.born, died: o.died ?? null, parents: o.parents ?? [],
    spouseId: null, blood: !!o.blood, look: o.look, story: [],
    t: { ambition: trait(), loyalty: trait(), charisma: trait(), scandal: trait() } };
  if (o.adopted) p.adopted = true;
  d.people[p.id] = p;
  return p;
}

/** A first name nobody living in the house has. */
function freeName(d, c, gender, avoid = []) {
  const taken = new Set([...living(d).map((p) => p.name), ...avoid]);
  const own = MONARCHIES[d.countryId].names;
  // People who marry in come from the whole country; those born to the house are named in its tradition.
  const pool = (own && !d.naming ? own : c.names)[gender === 'male' ? 'male' : 'female'];
  const free = pool.filter((n) => !taken.has(n));
  return rng.pick(free.length ? free : pool);
}

const lookOf = (a, b, gender) => ensureStyled(inheritAppearance(a.look, b?.look), gender);
const strangerLook = (near, gender) => ensureStyled(randomAppearance(Math.round(clamp(skinDepth(near) + rng.int(-1, 1), 1, 10)), gender), gender);

function wed(d, a, b, year, quiet) {
  a.spouseId = b.id; b.spouseId = a.id;
  if (!quiet) record(d, year, `${nameOf(d, a)} married ${b.name}.`, [a.id, b.id]);
}

/** Someone from outside the house, to marry into it. */
function outsider(d, c, partner, year) {
  const gender = partner.gender === 'male' ? 'female' : 'male';
  d.naming = 'outsider';
  const name = freeName(d, c, gender);
  delete d.naming;
  return newPerson(d, { name, gender, born: partner.born + rng.int(-4, 5), look: strangerLook(partner.look, gender) });
}

/** A child of a couple, with a face from both. */
function bear(d, c, mother, father, year, extra = {}) {
  const gender = extra.gender ?? rng.pick(['male', 'female']);
  return newPerson(d, { name: extra.name ?? freeName(d, c, gender), gender, born: year, parents: [mother.id, father.id].filter(Boolean),
    blood: mother.blood || father?.blood, look: extra.look ?? lookOf(mother, father, gender), ...extra });
}

/** Gives an adult of the house a marriage and children as their age allows, and the same for those children. */
function grow(d, c, person, year, depth = 0) {
  const age = year - person.born;
  if (age < 23 || person.spouseId || !rng.chance(depth ? 0.7 : 0.9)) return;
  const spouse = outsider(d, c, person, year);
  const married = person.born + rng.int(23, 31);
  wed(d, person, spouse, Math.min(married, year), true);
  record(d, Math.min(married, year), `${person.name} married ${spouse.name}.`, [person.id, spouse.id]);
  const [mother, father] = person.gender === 'female' ? [person, spouse] : [spouse, person];
  const want = rng.weighted([0, 1, 2, 3, 4], (n) => [8, 22, 38, 24, 8][n]);
  let at = Math.min(married, year) + rng.int(1, 3);
  for (let i = 0; i < want && at <= year && at - mother.born <= 42; i++) {
    const kid = bear(d, c, mother, father, at);
    record(d, at, `${kid.name} was born to ${person.name} and ${spouse.name}.`, [kid.id, person.id]);
    if (depth < 2) grow(d, c, kid, year, depth + 1);
    at += rng.int(1, 4);
  }
}

/**
 * Founds the house and brings it up to the present. With a `seat`, the house
 * is built around the player's own parents and siblings (who stay the NPCs
 * they are); without one, around a reigning monarch nobody in the game knows.
 * @param {object} c  country
 * @param {number} year
 * @param {{surname:string, blood:object, other:?object, kids:object[], place:'crown'|'heir'|'cadet', elder?:object}} [seat]
 */
export function buildHouse(c, year, seat) {
  const m = MONARCHIES[c.id];
  const maleLine = m.law.order === 'maleOnly';
  const d = { countryId: c.id, name: `${m.house.replace(/ House$/, '')} House of ${seat?.surname ?? rng.pick(m.names?.house ?? c.names.last)}`, law: { ...m.law }, monarchId: null,
    people: {}, reigns: [], history: [], standing: 55, seq: 0 };
  // Where several houses share a country, this one rules one state of it.
  if (m.elective) d.realm = rng.pick(m.elective.realms);

  // The main line, as birth years: from the person the present hangs on, back to the founder.
  const anchorBorn = seat ? year - seat.blood.age : year - rng.int(46, 76);
  const monarchAbove = seat && seat.place !== 'crown'; // the player's grandparent reigns
  const years = [anchorBorn];
  while (year - years[0] < 175 || years.length < 6) years.unshift(years[0] - (years.length === 1 && monarchAbove ? rng.int(24, 30) : rng.int(24, 33)));

  let prev = null;
  let prevDeath = null;
  const reformAt = m.reformed ? Math.max(1, years.length - rng.int(3, 4)) : -1;
  for (let i = 0; i < years.length; i++) {
    const last = i === years.length - 1;
    const reigningNow = last ? !monarchAbove : monarchAbove && i === years.length - 2;
    const gender = last && seat ? seat.blood.gender : maleLine ? 'male' : rng.pick(['male', 'female']);
    const spouseBefore = prev ? d.people[prev.spouseId] : null;
    const [mo, fa] = prev ? (prev.gender === 'female' ? [prev, spouseBefore] : [spouseBefore, prev]) : [null, null];
    const who = newPerson(d, { name: last && seat ? seat.blood.firstName : freeName(d, c, gender), gender, born: years[i], blood: true,
      parents: prev ? [mo.id, fa.id] : [], look: prev ? lookOf(mo, fa, gender) : ensureStyled(randomAppearance(seat ? skinDepth(seat.blood.appearance) : undefined, gender), gender) });
    if (prev) record(d, years[i], `${who.name} was born, heir to the house.`, [who.id]);
    // Brothers and sisters, all younger: remembered, but their lines are not followed in the early years.
    if (prev) {
      for (let k = rng.int(last ? 1 : 0, 2), at = years[i] + rng.int(2, 4); k > 0 && at - mo.born <= 42; k--, at += rng.int(2, 4)) {
        const sib = bear(d, c, mo, fa, at);
        const recent = i >= years.length - 2;
        if (recent) grow(d, c, sib, year);
        else sib.died = Math.min(year - 1, sib.born + rng.int(40, 88));
      }
    }
    // Marriage: the player's parents marry each other; everyone else marries someone from outside.
    const spouse = last && seat ? (seat.other ? newPerson(d, { name: seat.other.firstName, gender: seat.other.gender, born: year - seat.other.age, look: seat.other.appearance }) : null)
      : outsider(d, c, who, year);
    if (spouse) wed(d, who, spouse, Math.min(year, who.born + rng.int(22, 29)));
    // Life and reign.
    const mustBeDead = !last && !reigningNow;
    if (mustBeDead) {
      who.died = clamp(who.born + rng.int(56, 89), (prevDeath ?? who.born + 30) + 2, year - 1);
      if (i + 1 < years.length) who.died = Math.max(who.died, years[i + 1] + 1); // lived to see the next heir born
      who.died = Math.min(who.died, year - 1);
      if (spouse) spouse.died = Math.min(year - 1, Math.max(spouse.born + 40, who.died + rng.int(-12, 14)));
    }
    const from = prev ? prevDeath : who.born + rng.int(19, 34);
    if (mustBeDead || reigningNow) {
      d.reigns.push({ id: who.id, from, to: mustBeDead ? who.died : null });
      record(d, from, prev ? `${nameAt(d, who, 'monarch')} came to the throne on the death of ${nameAt(d, prev, 'monarch')}.`
        : `${nameAt(d, who, 'monarch')} took the throne, and the ${d.name.replace(/^(Royal|Imperial|Ruling) /, '')} began.`, [who.id]);
      if (mustBeDead) {
        const note = rng.pick(REIGN_NOTES.filter((n) => !Object.values(d.people).some((x) => x.note === n.text)));
        who.note = note.text;
        who.mark = note.standing;
        d.standing = clamp(d.standing + note.standing);
        who.story.push({ year: from + Math.round((who.died - from) / 2), text: `${who.name} ${note.text}.` });
        if (i === reformAt) {
          who.reformer = true;
          const y = Math.min(who.died - 1, from + rng.int(3, 15));
          record(d, y, `${nameAt(d, who, 'monarch')} had the law changed so that daughters inherit the throne equally with sons.`, [who.id]);
        }
        record(d, who.died, `${nameAt(d, who, 'monarch')} died after reigning for ${who.died - from} ${who.died - from === 1 ? 'year' : 'years'}.`, [who.id]);
      }
      if (reigningNow) d.monarchId = who.id;
    }
    if (mustBeDead) prevDeath = who.died;
    prev = who;
  }

  const anchor = prev;
  if (seat) {
    // The player's brothers and sisters, eldest first. The player is added by seatPlayer().
    const other = d.people[anchor.spouseId];
    for (const npc of [...seat.kids].sort((a, b) => b.age - a.age)) {
      const sib = newPerson(d, { name: npc.firstName, gender: npc.gender, born: year - npc.age, blood: true, parents: [anchor.id, other?.id].filter(Boolean), look: npc.appearance });
      link(sib, npc);
    }
    link(anchor, seat.blood);
    if (other && seat.other) link(other, seat.other);
    // A younger child of the monarch has an elder brother or sister, with a family, ahead of them.
    if (seat.place === 'cadet') {
      const gp = bloodParent(d.people, anchor);
      const gps = d.people[gp.spouseId];
      const [mo, fa] = gp.gender === 'female' ? [gp, gps] : [gps, gp];
      const gender = maleLine ? 'male' : rng.pick(['male', 'female']);
      const elder = bear(d, c, mo, fa, anchor.born - rng.int(2, 5), { gender });
      grow(d, c, elder, year);
    }
  } else {
    // The reigning monarch's own children and grandchildren.
    const spouse = d.people[anchor.spouseId];
    const [mo, fa] = anchor.gender === 'female' ? [anchor, spouse] : [spouse, anchor];
    const n = rng.weighted([1, 2, 3, 4], (k) => [14, 38, 34, 14][k - 1]);
    for (let i = 0, at = anchor.born + rng.int(24, 29); i < n && at <= year && at - mo.born <= 42; i++, at += rng.int(2, 4)) {
      const kid = bear(d, c, mo, fa, at);
      record(d, at, `${kid.name} was born to ${nameAt(d, anchor, 'royal')}.`, [kid.id, anchor.id]);
      grow(d, c, kid, year);
    }
  }
  // Under a law that passes the throne through men, make sure the line is not empty on day one.
  if (!lineOfSuccession(d.people, d.monarchId, d.law).length) {
    const monarch = d.people[d.monarchId];
    const spouse = d.people[monarch.spouseId];
    if (spouse && year - monarch.born >= 24) {
      const [mo, fa] = monarch.gender === 'female' ? [monarch, spouse] : [spouse, monarch];
      const kid = bear(d, c, mo, fa, clamp(monarch.born + rng.int(25, 34), monarch.born + 20, year - (seat && seat.place === 'crown' ? seat.kids.length + 1 : 0)), { gender: maleLine ? 'male' : undefined });
      if (!seat || seat.place !== 'crown') grow(d, c, kid, year);
    }
  }
  d.history.sort((a, b) => a.year - b.year);
  return d;
}

function link(person, npc) {
  person.npcId = npc.id;
  npc.flags.houseId = person.id;
}

// ---------- Looking things up ----------

/** The royal house of the country the player lives in, founded on first use. Null where there is no crown. */
export function house(countryId = country().id) {
  const m = MONARCHIES[countryId];
  if (!m) return null;
  const st = store.state;
  st.dynasties ??= {};
  if (!st.dynasties[countryId]) {
    st.dynasties[countryId] = buildHouse(COUNTRIES[countryId], st.year);
    adoptOldSave(st.dynasties[countryId]);
  }
  return st.dynasties[countryId];
}

/** A life saved before houses existed: give a royal player a place in the new one. */
function adoptOldSave(d) {
  const p = store.state.player;
  if (!p.royal || p.royal.countryId !== d.countryId || !['monarch', 'heir', 'royal'].includes(p.royal.rank) || p.royal.by !== 'birth') return;
  const born = store.state.year - p.age;
  if (p.royal.reigning) {
    // They are on the throne already: the generated monarch becomes their late parent.
    const old = d.people[d.monarchId];
    old.died = store.state.year - 1;
    const r = d.reigns.find((x) => x.id === old.id); if (r) r.to = old.died;
    for (const kid of childrenOf(d.people, old.id)) { delete d.people[kid.id]; }
    const me = newPerson(d, { name: p.firstName, gender: p.gender, born, blood: true, parents: [old.id, old.spouseId].filter(Boolean), look: p.appearance });
    me.isPlayer = true;
    d.monarchId = me.id; d.reigns.push({ id: me.id, from: old.died, to: null });
    return;
  }
  const fits = [d.people[d.monarchId], ...lineOfSuccession(d.people, d.monarchId, d.law).map((id) => d.people[id])]
    .find((x) => born - x.born >= 20 && born - x.born <= 45);
  const parent = fits ?? d.people[d.monarchId];
  const me = newPerson(d, { name: p.firstName, gender: p.gender, born, blood: true, parents: [parent.id, parent.spouseId].filter(Boolean), look: p.appearance });
  me.isPlayer = true;
}

export const person = (d, id) => d?.people[id] ?? null;
export const playerPerson = (d = house(player().royal?.countryId ?? country().id)) => (d ? Object.values(d.people).find((p) => p.isPlayer) ?? null : null);
export const monarchOf = (d = house()) => (d ? d.people[d.monarchId] : null);
export function lineOf(d = house()) {
  if (!d) return [];
  let line = LINES.get(d);
  if (!line) { line = lineOfSuccession(d.people, d.monarchId, d.law); LINES.set(d, line); }
  return line;
}
/** Place in the line, 1 for the heir, or 0 when not in it. */
export const placeOf = (d, id) => lineOf(d).indexOf(id) + 1;
export const whyNot = (d, p) => (p.died != null ? 'no longer living' : p.id === d.monarchId ? 'on the throne' : barred(d.people, p, d.law));
export const relationToMonarch = (d, id) => relationTo(d.people, d.monarchId, id);
export { ageOf, childrenOf, bloodParent };

const reigned = (d, id) => d.reigns.some((r) => r.id === id);

/**
 * The rank someone holds (or held at death): 'monarch' | 'consort' | 'heir' | 'royal' | null.
 * Once a monarchy is abolished the living hold no rank; the dead keep what they were.
 */
export function rankOf(d, p) {
  return d.status === 'abolished' && p.died == null ? null : memberRank(d, p);
}
/** The same, ignoring abolition: someone's place in the family, throne or no throne. */
function memberRank(d, p) {
  if (p.id === d.monarchId || (p.died != null && reigned(d, p.id))) return 'monarch';
  if (p.abdicated) return 'royal';
  if (p.out || p.divorced) return null;
  const spouse = d.people[p.spouseId];
  if (!p.blood) return spouse ? (spouse.id === d.monarchId || reigned(d, spouse.id) ? 'consort' : spouse.out ? null : 'royal') : p.widowOf ? (reigned(d, p.widowOf) ? 'consort' : 'royal') : null;
  if (p.adopted && !d.law.adoption) return 'royal';
  return p.died == null && lineOf(d)[0] === p.id ? 'heir' : 'royal';
}

/** The title in front of a name: "Queen", "Crown Prince", "Infanta", or '' for someone with none. */
export function titleOf(d, p, rank = rankOf(d, p)) {
  if (!rank) return '';
  if (rank === 'consort') return p.gender === 'female' ? word(d.countryId, 'monarch', 'female') : word(d.countryId, 'royal', 'male');
  return word(d.countryId, rank, p.gender);
}
function nameAt(d, p, rank) { return `${titleOf(d, p, rank)} ${p.name}`.trim(); }
/** "Queen Astrid", or plain "Astrid" for someone without a title. */
export const nameOf = (d, p) => nameAt(d, p, rankOf(d, p));

/** What the house reigns over: the country, or one state of it. */
export const realmOf = (d) => d.realm ?? theCountry(COUNTRIES[d.countryId].name);
/** The title of the national throne where it is held in turn ("King"), for the person holding it. */
export const nationalTitle = (d, p) => { const e = MONARCHIES[d.countryId].elective; return e ? e.title[p.gender === 'female' ? 1 : 0] : ''; };

/** In a few words, what someone is to the house. */
export function standingOf(d, p) {
  const rank = rankOf(d, p);
  const where = realmOf(d);
  const reign = d.reigns.find((r) => r.id === p.id);
  if (d.status === 'abolished' && p.died == null) {
    if (p.id === d.monarchId) return reign ? `Last to reign (${reign.from}–${reign.to}); head of the former royal house` : 'Head of the former royal house';
    return memberRank(d, p) ? 'Of the former royal family' : 'A private citizen';
  }
  if (rank === 'monarch') return reign?.to != null ? `Reigned ${reign.from}–${reign.to}` : `${titleOf(d, p)} of ${where} since ${reign?.from ?? '?'}${d.kingUntil ? `; ${nationalTitle(d, p)} of ${COUNTRIES[d.countryId].name} until ${d.kingUntil}` : ''}`;
  if (p.abdicated) return `Gave up the throne in ${p.abdicated}`;
  if (rank === 'consort') return `Consort of ${nameOf(d, d.people[p.spouseId ?? p.widowOf])}`;
  if (p.out === 'renounced') return `Gave up their place in ${p.outYear}`;
  if (p.out === 'removed') return `Removed from royal life in ${p.outYear}`;
  if (p.out === 'left') return 'Left the royal family on marrying';
  if (p.divorced) return `Married into the family; divorced in ${p.divorced}`;
  if (!p.blood) return 'Married into the family';
  if (p.died != null) return `${titleOf(d, p)} of ${where}`;
  const place = placeOf(d, p.id);
  return place === 1 ? 'Heir to the throne' : place ? `${place}${['th', 'st', 'nd', 'rd'][place % 100 > 10 && place % 100 < 14 ? 0 : Math.min(place % 10, 4) % 4]} in line to the throne` : `${titleOf(d, p)} of ${where}`;
}

function record(d, year, text, ids = []) {
  touch(d);
  d.history.push({ year, text, ids });
  for (const id of ids.slice(0, 2)) d.people[id]?.story.push({ year, text });
}
/** Writes something into the house's history, dated this year. */
export const chronicle = (d, text, ids) => record(d, yearNow(), text, ids);

/** Facts and figures for the journal. */
export function stats(d) {
  const year = yearNow();
  const spans = d.reigns.map((r) => ({ id: r.id, years: (r.to ?? year) - r.from, done: r.to != null }));
  const done = spans.filter((s) => s.done && s.years > 0);
  const longest = spans.reduce((a, b) => (b.years > (a?.years ?? -1) ? b : a), null);
  const shortest = done.reduce((a, b) => (b.years < (a?.years ?? 1e9) ? b : a), null);
  const depth = (p) => { let n = 1; let at = p; while ((at = bloodParent(d.people, at))) n += 1; return n; };
  const people = Object.values(d.people);
  return { founded: d.reigns[0]?.from, years: spans.reduce((n, x) => n + x.years, 0), monarchs: d.reigns.length, longest, shortest,
    generations: Math.max(...people.filter((p) => p.blood).map(depth)), livingMembers: people.filter((p) => p.died == null && memberRank(d, p)).length,
    marriages: people.filter((p) => !p.blood).length, standing: d.standing };
}

const FEATURES = { eyeColor: 'eye colour', eyes: 'eyes', hairColor: 'hair colour', hairTexture: 'hair', nose: 'nose', lips: 'mouth', head: 'face', brows: 'brows' };
/** The features two people share, as words: ["eyes", "nose"]. */
export function shared(a, b) {
  const x = normalize(a, 'a').inherited;
  const y = normalize(b, 'b').inherited;
  return Object.keys(FEATURES).filter((k) => x[k] === y[k]).map((k) => FEATURES[k]);
}
/** How many generations lie between an ancestor and a descendant (1 for a parent), or 0 if not an ancestor. */
export function generationsUp(d, fromId, ancestorId) {
  let layer = [fromId];
  for (let n = 1; n <= 12 && layer.length; n++) {
    layer = layer.flatMap((id) => d.people[id]?.parents ?? []);
    if (layer.includes(ancestorId)) return n;
  }
  return 0;
}

// ---------- The player's place ----------

/**
 * Seats a newborn player in a house built around their own family. Called by
 * character creation, before the player's face is inherited (the parent of
 * the blood takes the face the house's history gave them).
 * @returns {{dynasty:object, parentId:string, place:string}}
 */
export function seatFamily(c, year, fam, playerGender) {
  const m = MONARCHIES[c.id];
  const maleLine = m.law.order === 'maleOnly';
  // The parent through whom the child is royal. Without a father in the picture, it is the mother (where the law allows a line through her).
  const blood = fam.father && (maleLine || rng.chance(0.5)) ? fam.father : fam.mother;
  const other = blood === fam.father ? fam.mother : fam.father;
  const place = rng.weighted(['crown', 'heir', 'cadet'], (k) => ({ crown: blood.age >= 30 ? 22 : 6, heir: 38, cadet: 40 })[k]);
  const d = buildHouse(c, year, { surname: blood.lastName, blood, other, kids: fam.siblings, place });
  const anchor = Object.values(d.people).find((p) => p.npcId === blood.id);
  // The parent of the blood wears the face their ancestors gave them; the children are redrawn from both parents.
  blood.appearance = ensureStyled(cloneAppearance(anchor.look), blood.gender);
  for (const sib of fam.siblings) {
    sib.appearance = ensureStyled(inheritAppearance(fam.mother.appearance, fam.father?.appearance), sib.gender);
    d.people[sib.flags.houseId].look = sib.appearance;
  }
  // The grandparents the child knows are the ones the house remembers.
  const side = blood === fam.father ? 'paternal' : 'maternal';
  const gp = bloodParent(d.people, anchor);
  for (const g of fam.grandparents.filter((x) => x.flags.side === side)) {
    const match = [gp, d.people[gp.spouseId]].find((x) => x && x.gender === g.gender && !x.npcId);
    if (!match) continue;
    if (match.died != null) { g.alive = false; g.age = match.died - match.born; g.flags.diedYear = match.died; } else g.age = year - match.born;
    g.firstName = match.name; g.lastName = blood.lastName; g.appearance = ensureStyled(cloneAppearance(match.look), g.gender);
    link(match, g);
  }
  // A reigning grandparent (and their consort) is someone the child can visit, not only a name.
  for (const x of [gp, d.people[gp.spouseId]]) {
    if (!x || x.died != null || x.npcId) continue;
    const g = makeNpc({ role: 'grandparent', countryId: c.id, gender: x.gender, firstName: x.name, lastName: blood.lastName, age: year - x.born,
      relationship: rng.int(45, 85), appearance: cloneAppearance(x.look) });
    g.flags.side = side;
    fam.grandparents.push(g);
    link(x, g);
  }
  return { dynasty: d, parentId: anchor.id, place, playerGender };
}

/** Adds the newborn player to the house. */
export function seatPlayer(d, seat, p) {
  const anchor = d.people[seat.parentId];
  const me = newPerson(d, { name: p.firstName, gender: p.flags.bornAs ?? p.gender, born: p.birthYear, blood: true,
    parents: [anchor.id, anchor.spouseId].filter(Boolean), look: p.appearance });
  me.isPlayer = true;
  record(d, p.birthYear, `${p.firstName} was born to ${nameOf(d, anchor)}.`, [me.id, anchor.id]);
  return me;
}

/** The player marries someone of the house: they join it, without any right to the throne. */
export function marryIn(d, spouse, year = yearNow()) {
  const p = player();
  let me = playerPerson(d);
  if (!me) { me = newPerson(d, { name: p.firstName, gender: p.gender, born: p.birthYear, look: p.appearance }); me.isPlayer = true; }
  delete me.divorced;
  wed(d, spouse, me, year);
  return me;
}

/** Someone from outside marries a member of the house: they join the tree, linked to the person they are in the game. */
export function marryOutsider(d, member, npc, year = yearNow()) {
  if (member.spouseId) return d.people[member.spouseId];
  const s = npc.flags.houseId && d.people[npc.flags.houseId] ? d.people[npc.flags.houseId]
    : newPerson(d, { name: npc.firstName, gender: npc.gender, born: year - npc.age, look: npc.appearance });
  link(s, npc);
  delete s.divorced;
  wed(d, member, s, year);
  return s;
}

/** Someone unmarried in the house whom the player might meet, or null. */
export function eligibleMember(d, gender, age) {
  const fits = living(d).filter((x) => x.blood && !x.spouseId && !x.out && !x.npcId && !x.isPlayer && x.gender === gender
    && ageOf(x) >= 18 && Math.abs(ageOf(x) - age) <= 12);
  if (fits.length) return rng.pick(fits);
  // Nobody of the right age: a cousin from a junior branch comes to court.
  const c = COUNTRIES[d.countryId];
  const elders = Object.values(d.people).filter((x) => x.blood && x.spouseId && yearNow() - age - x.born >= 22 && yearNow() - age - x.born <= 40
    && (d.law.order !== 'maleOnly' || x.gender === 'male') && x.id !== d.monarchId);
  const parent = elders.length ? rng.pick(elders) : null;
  const born = yearNow() - clamp(age + rng.int(-4, 5), 18, 60);
  if (parent) {
    const sp = d.people[parent.spouseId];
    const [mo, fa] = parent.gender === 'female' ? [parent, sp] : [sp, parent];
    return bear(d, c, mo, fa, Math.max(born, parent.born + 20), { gender });
  }
  return newPerson(d, { name: freeName(d, c, gender), gender, born, blood: true, look: ensureStyled(randomAppearance(undefined, gender), gender) });
}

// ---------- The throne changing hands ----------

/**
 * Ends the reign (death, abdication or removal) and seats the next in line.
 * @returns {?object} the new monarch's record, or null if the throne could not be filled
 */
export function accede(d, why = 'death') {
  const year = yearNow();
  touch(d);
  const old = d.people[d.monarchId];
  const reign = d.reigns.find((r) => r.id === old.id && r.to == null);
  if (reign) reign.to = year;
  if (why !== 'death') old.abdicated = year;
  let nextId = lineOf(d)[0];
  if (!nextId) {
    // The line has run out: parliament sends for the nearest relative it can find.
    const c = COUNTRIES[d.countryId];
    const gender = d.law.order === 'maleOnly' ? 'male' : rng.pick(['male', 'female']);
    const cousin = newPerson(d, { name: freeName(d, c, gender), gender, born: year - rng.int(30, 55), blood: true, look: strangerLook(old.look, gender) });
    cousin.story.push({ year, text: `With no heir left, ${cousin.name}, of a distant branch of the family, was called to the throne.` });
    grow(d, c, cousin, year);
    nextId = cousin.id;
  }
  const next = d.people[nextId];
  d.monarchId = nextId;
  touch(d);
  if (d.status === 'abolished') {
    // No throne to take: the headship of the house passes, and that is all.
    record(d, year, `${next.name} became head of the former royal house.`, [next.id]);
    return next;
  }
  d.reigns.push({ id: nextId, from: year, to: null });
  const widow = d.people[old.spouseId];
  if (why === 'death' && widow) { widow.widowOf = old.id; }
  record(d, year, why === 'death' ? `${nameAt(d, next, 'monarch')} came to the throne on the death of ${nameAt(d, old, 'monarch')}.`
    : why === 'abdication' ? `${nameAt(d, old, 'monarch')} gave up the throne. ${nameAt(d, next, 'monarch')} reigns.`
      : `${nameAt(d, old, 'monarch')} was made to give up the throne. ${nameAt(d, next, 'monarch')} reigns.`, [next.id, old.id]);
  return next;
}

// ---------- Each year ----------

const mortality = (age) => (age < 50 ? 0.002 : age < 62 ? 0.006 : age < 72 ? 0.018 : age < 80 ? 0.045 : age < 88 ? 0.1 : age < 95 ? 0.2 : 0.38);

/** Copies what has happened to the people the player knows into the house: deaths, marriages, births. */
function syncKnown(d, year) {
  const st = store.state;
  const p = st.player;
  const me = playerPerson(d);
  if (me) { me.name = p.firstName; me.look = p.appearance; me.gender = me.blood ? me.gender : p.gender; }
  const byNpc = Object.fromEntries(Object.values(d.people).filter((x) => x.npcId).map((x) => [x.npcId, x]));
  for (const x of Object.values(byNpc)) {
    const npc = st.npcs[x.npcId];
    if (!npc) { delete x.npcId; continue; } // gone from the player's life; the house keeps living them itself
    x.name = npc.firstName; x.look = npc.appearance;
    if (!npc.alive && x.died == null) {
      const title = nameOf(d, x);
      x.died = npc.flags.diedYear ?? year;
      const sp = d.people[x.spouseId];
      if (sp && sp.died == null) { sp.widowOf = x.id; sp.spouseId = null; }
      record(d, x.died, `${title} died, aged ${x.died - x.born}.`, [x.id]);
    }
    // A marriage made in their own life.
    const loveId = npc.life?.married ? npc.life.partnerId : null;
    const love = loveId ? st.npcs[loveId] : null;
    if (love && x.blood && !x.spouseId && !byNpc[love.id]) {
      const s = newPerson(d, { name: love.firstName, gender: love.gender, born: year - love.age, look: love.appearance });
      link(s, love); byNpc[love.id] = s;
      wed(d, x, s, year);
    }
  }
  // Children: of the player, and of anyone linked.
  for (const npc of Object.values(st.npcs)) {
    if (npc.flags?.houseId || npc.role === 'pet') continue;
    let parents = (npc.parentIds ?? []).map((id) => byNpc[id]).filter(Boolean);
    if (npc.role === 'child' && me) parents = [me, ...parents.filter((x) => x !== me)];
    if (!parents.some((x) => x.blood)) continue;
    if (!npc.alive) continue;
    const kid = newPerson(d, { name: npc.firstName, gender: npc.gender, born: year - npc.age, blood: true, parents: parents.slice(0, 2).map((x) => x.id),
      look: npc.appearance, adopted: !!(npc.adopted || npc.flags.adopted) });
    link(kid, npc); byNpc[npc.id] = kid;
    record(d, kid.born, `${kid.name} was ${kid.adopted ? 'adopted by' : 'born to'} ${nameOf(d, parents.find((x) => x.blood))}.`, [kid.id, parents[0].id]);
  }
}

/** A year in the lives of the members of the house nobody in the game is living for them. Returns what happened, as lines. */
function liveAYear(d, year) {
  const c = COUNTRIES[d.countryId];
  const m = MONARCHIES[d.countryId];
  const crowded = living(d).length > 70;
  const thin = lineOf(d).length < 4; // a house short of heirs marries young and has large families
  const far = (x) => { const place = placeOf(d, x.id); return !place || place > 14; };
  const news = [];
  const tell = (text, ids, weight = 1) => { record(d, year, text, ids); news.push({ text, ids, weight }); };
  for (const x of living(d)) {
    const age = year - x.born;
    const own = !x.npcId && !x.isPlayer; // lived here, not in the player's game
    if (own && rng.chance(mortality(age))) {
      x.died = year;
      const sp = d.people[x.spouseId];
      if (sp) { sp.widowOf = x.id; sp.spouseId = null; x.spouseId = sp.id; }
      tell(`${nameAt(d, x, x.id === d.monarchId ? 'monarch' : rankOf(d, { ...x, died: null }))} died, aged ${age}.`, [x.id], x.id === d.monarchId ? 5 : 2);
      continue;
    }
    if (!memberRank(d, x)) continue;
    // Marriage.
    if (own && x.blood && !x.spouseId && !x.widowOf && age >= 22 && age <= 44 && rng.chance((age < 30 ? 0.11 : 0.07) * (far(x) ? (crowded ? 0.1 : 0.4) : thin ? 2 : 1))) {
      const s = outsider(d, c, x, year);
      const leaves = m.leavesOnMarriage && x.gender === 'female';
      const before = nameOf(d, x);
      wed(d, x, s, year, true);
      if (leaves) { x.out = 'left'; x.outYear = year; }
      tell(leaves ? `${before} married ${s.name}, and left the royal family as the law of the house requires.` : `${before} married ${s.name}.`, [x.id, s.id], 2);
      continue;
    }
    // Children.
    const sp = d.people[x.spouseId];
    if (own && x.blood && sp && sp.died == null && !sp.npcId && !sp.isPlayer) {
      const mother = x.gender === 'female' ? x : sp;
      const kids = childrenOf(d.people, x.id).length;
      if (year - mother.born <= 42 && kids < (thin ? 6 : 4) && rng.chance(far(x) ? (kids === 0 ? 0.3 : kids === 1 ? 0.2 : 0.07) * (crowded ? 0.15 : 0.5) : thin ? 0.3 : kids === 0 ? 0.3 : kids === 1 ? 0.2 : 0.07)) {
        const father = mother === x ? sp : x;
        const kid = bear(d, c, mother, father, year);
        tell(`${nameOf(d, x)} and ${sp.name} had a ${kid.gender === 'male' ? 'son' : 'daughter'}, ${kid.name}.`, [kid.id, x.id], 2);
      }
    }
    if (age < 18 || x.isPlayer) continue;
    // Scandal: the careless and the unlucky.
    if (d.status !== 'abolished' && rng.chance(0.004 + x.t.scandal / 9000)) {
      const what = rng.pick(SCANDALS);
      d.standing = clamp(d.standing - rng.int(2, 6));
      tell(`${nameOf(d, x)} ${what}.`, [x.id], 1);
    }
    // Walking away: the disloyal, the unambitious, and never the monarch.
    if (x.blood && !x.out && x.id !== d.monarchId && rng.chance(0.0008 + Math.max(0, 45 - x.t.loyalty) / 9000)) {
      const before = nameOf(d, x);
      const place = placeOf(d, x.id);
      x.out = 'renounced'; x.outYear = year;
      tell(`${before} gave up ${place ? 'a place in the line of succession' : 'royal life'} to live privately.`, [x.id], place && place <= 3 ? 4 : 2);
    }
    // Divorce.
    if (own && sp && sp.died == null && !sp.npcId && !sp.isPlayer && rng.chance(0.006)) {
      const outsiderOf = x.blood ? sp : x;
      const royalOf = x.blood ? x : sp;
      const before = nameOf(d, outsiderOf);
      x.spouseId = null; sp.spouseId = null;
      outsiderOf.divorced = year;
      tell(`${nameOf(d, royalOf)} and ${before} divorced.`, [royalOf.id, outsiderOf.id], 1);
    }
  }
  return news;
}

/**
 * Yearly: the house lives a year. Returns what the caller needs to tell the
 * player: { news: [{text, ids, weight}], newMonarch: ?person, oldMonarch: ?person }.
 */
export function tickDynasty(d) {
  const year = yearNow();
  if (d.tickedYear === year) return { news: [] }; // never twice in a year
  d.tickedYear = year;
  touch(d);
  syncKnown(d, year);
  const news = liveAYear(d, year);
  const out = { news };
  const monarch = d.people[d.monarchId];
  if (monarch.died != null) {
    out.oldMonarch = monarch;
    out.newMonarch = accede(d, 'death');
  }
  d.standing = Math.round(d.standing + (55 - d.standing) * 0.04);
  if (year % 10 === 0) prune(d, year);
  return out;
}

/**
 * Keeps a long-lived house from filling the save. Remembered for ever: every
 * monarch and consort, every ancestor of anyone living, and anyone who died
 * in the last fifty years. Distant relatives dead longer than that are let go,
 * and so are the small entries in the history that were about them.
 */
function prune(d, year) {
  const keep = new Set();
  const reignIds = new Set(d.reigns.map((r) => r.id));
  for (const p of Object.values(d.people)) {
    if (p.died == null || year - p.died <= 50 || reignIds.has(p.id) || p.isPlayer || p.wasPlayer) keep.add(p.id);
    else if (reignIds.has(p.spouseId) || reignIds.has(p.widowOf)) keep.add(p.id);
  }
  const stack = [...keep];
  while (stack.length) {
    for (const id of d.people[stack.pop()]?.parents ?? []) if (d.people[id] && !keep.has(id)) { keep.add(id); stack.push(id); }
  }
  for (const p of Object.values(d.people)) {
    if (!keep.has(p.id)) { delete d.people[p.id]; continue; }
    if (p.spouseId && !keep.has(p.spouseId)) p.spouseId = null;
    if (p.widowOf && !keep.has(p.widowOf)) delete p.widowOf;
  }
  d.history = d.history.filter((h) => year - h.year <= 60 || h.ids.some((id) => reignIds.has(id)) || h.ids.some((id) => d.people[id]?.wasPlayer));
  if (d.history.length > 400) d.history = d.history.filter((h, i) => i >= d.history.length - 400 || h.ids.some((id) => reignIds.has(id)));
  touch(d);
}

/** For tests and long runs: everything that must never be true of a house. */
export const check = (d) => { touch(d); return audit(d.people, d.monarchId); };
/** How closely two members are related, for deciding what news reaches the player: 1 parent/child/sibling, 2 grandparent/uncle/niece, 3 cousin… */
export function closeness(d, aId, bId) {
  const up = (id) => { const dist = { [id]: 0 }; let layer = [id]; for (let n = 1; n <= 4; n++) { layer = layer.flatMap((x) => d.people[x]?.parents ?? []); for (const x of layer) dist[x] ??= n; } return dist; };
  const A = up(aId); const B = up(bId);
  let best = 99;
  for (const [id, n] of Object.entries(A)) if (B[id] != null) best = Math.min(best, n + B[id]);
  const a = d.people[aId]; const b = d.people[bId];
  if (a?.spouseId === bId || b?.spouseId === aId) best = Math.min(best, 1);
  return best;
}
