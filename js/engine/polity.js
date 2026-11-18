// The political world of a country: its parties, its politicians, its
// legislature, who governs, what they have changed, and every election. It
// runs whether or not the player takes any part. One per country the player
// has lived in, kept in the save as state.polities[countryId].
//
//   { countryId, kind, parties: [party], figures: { id: figure }, seatCount, seats: { partyId: n },
//     govt: { lead, partners, headId, since, kind }, calendar: { general, term, local },
//     policies: { lever: level }, budget, laws: [{ year, text, lever, by }],
//     elections: [record], approval, seq }
// A party:   { id, kind, name, colour, positions, says, leaderId, deputyId, founded, record }
//   record   how voters judge its time in office lately, about -15..15
// A figure:  a politician, who persists: { id, name, gender, born, died, partyId, look,
//              t: { ambition, integrity, charisma }, post, history: [{ year, text }] }
// The arithmetic is in engine/elections.js; what policies do to daily life is in engine/policy.js.
import { rule, may } from './rules.js';
import { held, issuer } from './citizenship.js';
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { store } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { SYSTEMS } from '../data/politics.js';
import { MONARCHIES } from '../data/royalty.js';
import { PARTY_KINDS, RULING_PARTY, VOTERS, DISTRICT_SEATS, ONE_ROUND, TERMS, LEVERS, POLITICAL_SCANDALS, ISSUES } from '../data/parties.js';
import { randomAppearance, ensureStyled } from '../avatar/inherit.js';
import { vote, proportional, districts, firstRound, formGovernment } from './elections.js';
import { formCabinet, tickCabinet, floorVote, toDo } from './government.js';
import { post as postNews } from './news.js';
import { tickDiplomacy } from './diplomacy.js';
import { asSchoolmate } from './edlegacy.js';

const yearNow = () => store.state.year;
const noise = (n) => (rng.next() * 2 - 1) * n;
const trait = () => Math.round(clamp(rng.around(55, 30)));
const kindOf = (countryId) => SYSTEMS[countryId]?.kind ?? 'none';

// ---------- People ----------

export function newFigure(w, partyId, age) {
  const c = COUNTRIES[w.countryId];
  const gender = rng.chance(0.62) ? 'male' : 'female';
  w.seq += 1;
  const f = { id: `f${w.seq}`, name: `${rng.pick(c.names[gender])} ${rng.pick(c.names.last)}`, gender, born: yearNow() - (age ?? rng.int(36, 62)), died: null,
    partyId, look: ensureStyled(randomAppearance(undefined, gender), gender), t: { ambition: trait(), integrity: trait(), charisma: trait(), skill: trait() }, post: null, history: [] };
  w.figures[f.id] = f;
  return f;
}
const say = (f, text) => f?.history.push({ year: yearNow(), text });
/** Writes a line into a politician's career. */
export const note = say;
export const ageOf = (f) => (f.died ?? yearNow()) - f.born;
export const party = (w, id) => w.parties.find((p) => p.id === id) ?? null;
export const figure = (w, id) => w.figures[id] ?? null;
const head = (w) => w.figures[w.govt.headId] ?? null;
/** "the National Union", "the Greens": a party's name as it reads in a sentence. */
export const the = (p) => (/^The /.test(p.name) ? `the ${p.name.slice(4)}` : /(Party|Union|Alliance|League|Front|Movement|Centre|Center|Democrats)$/.test(p.name) ? `the ${p.name}` : p.name);

/** Whether the count here leans towards those already in power. */
export const rigged = (countryId) => !!SYSTEMS[countryId]?.rigged;
/** What the head of government is called here. */
export const headTitle = (countryId) => SYSTEMS[countryId]?.head ?? (MONARCHIES[countryId] ? 'Chief Minister' : 'Head of Government');

// ---------- Building a country's politics ----------

/** The political world of a country, made the first time it is needed. */
export function polity(countryId = store.state.player.countryId) {
  const st = store.state;
  st.polities ??= {};
  if (!st.polities[countryId]) st.polities[countryId] = build(countryId);
  const w = st.polities[countryId];
  // Saves from before there were cabinets or a policing budget.
  if (w.policies.police == null) w.policies.police = 0;
  w.cabinet ??= {};
  return w;
}

function build(countryId) {
  const kind = kindOf(countryId);
  const year = yearNow();
  const w = { countryId, kind, parties: [], figures: {}, seq: 0, seatCount: 100, seats: {}, govt: { lead: null, partners: [], headId: null, since: year, kind: 'none' },
    calendar: { term: TERMS[countryId] ?? 4, general: null, local: rng.int(0, 3) }, policies: { tax: 0, tuition: 0, health: 0, rent: 0, police: 0 }, budget: 0, debt: 0, cabinet: {}, laws: [], elections: [], approval: 50 };
  if (kind === 'none') {
    // No parties and no elections: ministers serve at the ruler's pleasure.
    const f = newFigure(w, null); f.post = 'head'; w.govt = { lead: null, partners: [], headId: f.id, since: year - rng.int(1, 9), kind: 'appointed' };
    say(f, `Appointed ${headTitle(countryId)} by the crown.`);
    formCabinet(w);
    return w;
  }
  const kinds = kind === 'party' ? [RULING_PARTY] : [PARTY_KINDS[0], PARTY_KINDS[1], ...[...PARTY_KINDS.slice(2)].sort(() => rng.next() - 0.5).slice(0, rng.int(1, 3))];
  const taken = new Set();
  for (const k of kinds) {
    const name = rng.pick(k.names.filter((n) => !taken.has(n)).length ? k.names.filter((n) => !taken.has(n)) : k.names);
    taken.add(name);
    const p = { id: `p${w.parties.length + 1}`, kind: k.kind, name, colour: k.colour, says: k.says, founded: year - rng.int(12, 140), record: 0,
      // No two parties of a kind are quite alike.
      positions: Object.fromEntries(Object.entries(k.positions).map(([i, v]) => [i, clamp(Math.round((v + noise(0.5)) * 2) / 2, -2, 2)])) };
    w.parties.push(p);
    const leader = newFigure(w, p.id); leader.post = 'leader'; p.leaderId = leader.id; say(leader, `Became leader of ${the(p)}.`);
    const deputy = newFigure(w, p.id, rng.int(32, 50)); deputy.post = 'deputy'; p.deputyId = deputy.id;
  }
  // The election that produced the government in office today, some years back.
  const since = year - rng.int(0, w.calendar.term - 1);
  w.calendar.general = since + w.calendar.term;
  runGeneral(w, since, true);
  formCabinet(w);
  return w;
}

/** The voters of a country: the same groups everywhere, bent by what life is like there. */
export function voters(countryId) {
  const L = COUNTRIES[countryId].living ?? {};
  return VOTERS.map((g) => {
    const cares = { ...g.cares };
    if ((L.safety ?? 70) < 55) cares.order = (cares.order ?? 0) + 1.5; // where it is not safe, safety decides votes
    if ((L.costK ?? 1) > 1.05) cares.housing = (cares.housing ?? 0) + 1;
    if (L.crisis) cares.services = (cares.services ?? 0) + 1;
    return { ...g, cares };
  });
}

// ---------- Elections ----------

/**
 * The parties as an election sees them: positions, and what each brings
 * besides. `mood`: how much the moment (a gaffe, a scare) can move each one.
 * `boosts`: campaigns under way, by party, for a poll taken before the vote.
 */
export function partyField(w, year = yearNow(), mood = 0, boosts = {}) {
  const sys = SYSTEMS[w.countryId] ?? {};
  const inPower = new Set([w.govt.lead, ...(w.govt.partners ?? [])]);
  return w.parties.map((p) => {
    const leader = w.figures[p.leaderId];
    let appeal = ((leader?.t.charisma ?? 50) - 50) / 6 + (p.record ?? 0);
    // Governments are judged on how things are going, and wear out their welcome the longer they stay.
    if (inPower.has(p.id)) appeal += (w.approval - 50) / 3 - Math.min(14, (year - (w.govt.leadSince ?? year)) * 0.9);
    if (mood) appeal += noise(mood);
    if (sys.rigged && p.id === w.govt.lead) appeal += 14; // the count leans towards those already in power
    appeal += boosts[p.id] ?? p.boost ?? 0; // a player's campaign for this party
    return { id: p.id, positions: p.positions, appeal };
  });
}
/** Where the parties stand today, with no luck in it: what a perfect poll would find. */
export const pollGeneral = (w, boosts = {}) => vote(partyField(w, yearNow(), 0, boosts), voters(w.countryId), () => 0, 100000).shares;

/**
 * Holds a general election. For a parliament it decides the seats and then
 * the government; for a presidency it also elects the president. `quiet`
 * is used for the election in the past that produced today's government.
 * @returns {object} the record of it, as stored in w.elections
 */
export function runGeneral(w, year = yearNow(), quiet = false) {
  const cid = w.countryId;
  const groups = voters(cid);
  const sys = SYSTEMS[cid] ?? {};
  const inPower = new Set([w.govt.lead, ...(w.govt.partners ?? [])]);
  const field = partyField(w, year, 6);
  const electorate = Math.round(COUNTRIES[cid].cities.length * 1.1e6 * (0.6 + rng.next() * 0.8));
  const rec = { year, kind: w.kind, electorate };
  if (w.kind === 'party') {
    // One party, one list. The contest is inside it.
    const p = w.parties[0];
    rec.shares = { [p.id]: 100 }; rec.seats = { [p.id]: w.seatCount }; rec.turnout = Math.round(88 + rng.next() * 10); rec.total = Math.round(electorate * rec.turnout / 100); rec.votes = { [p.id]: rec.total };
    w.seats = rec.seats;
    w.govt = { lead: p.id, partners: [], headId: p.leaderId, since: w.govt.headId === p.leaderId ? w.govt.since : year, kind: 'one party', leadSince: w.govt.leadSince };
  } else {
    const r = vote(field, groups, noise, electorate);
    Object.assign(rec, { shares: r.shares, votes: r.votes, turnout: r.turnout, total: r.total, byGroup: r.byGroup });
    rec.seats = DISTRICT_SEATS.includes(cid) ? districts(r.shares, w.seatCount, noise) : proportional(r.votes, w.seatCount, 4);
    w.seats = rec.seats;
    const oldHead = w.govt.headId;
    if (w.kind === 'presidential') {
      // The president is elected separately from the legislature, and may face a hostile one.
      const first = firstRound(r.shares);
      let winner = first.leader;
      if (first.runoff && !ONE_ROUND.includes(cid)) {
        const two = vote(field.filter((p) => p.id === first.leader || p.id === first.second), groups, noise, electorate);
        winner = Object.entries(two.shares).sort((a, b) => b[1] - a[1])[0][0];
        rec.runoff = { shares: two.shares, votes: two.votes, total: two.total };
      }
      const win = party(w, winner);
      const largest = Object.entries(rec.seats).sort((a, b) => b[1] - a[1])[0][0];
      w.govt = { lead: winner, partners: [], headId: win.leaderId, since: oldHead === win.leaderId ? w.govt.since : year,
        kind: rec.seats[winner] > w.seatCount / 2 ? 'majority' : largest === winner ? 'minority' : 'divided', leadSince: w.govt.leadSince };
    } else {
      const g = formGovernment(w.parties, rec.seats);
      w.govt = { lead: g.lead, partners: g.partners, headId: party(w, g.lead).leaderId, since: oldHead === party(w, g.lead).leaderId ? w.govt.since : year, kind: g.kind, leadSince: w.govt.leadSince };
    }
  }
  if (w.govt.lead !== [...inPower][0]) w.govt.leadSince = year; else w.govt.leadSince = w.govt.leadSince ?? year;
  const h = head(w);
  rec.govt = { lead: w.govt.lead, partners: [...w.govt.partners], kind: w.govt.kind, headId: h.id, headName: h.name };
  for (const f of Object.values(w.figures)) if (f.post === 'head') f.post = party(w, f.partyId)?.leaderId === f.id ? 'leader' : null;
  h.post = 'head';
  if (!quiet) {
    say(h, w.govt.since === year ? `Became ${headTitle(cid)} after the election.` : `Won another term as ${headTitle(cid)}.`);
    // Losing leaders often go; the party's verdict on its own government is wiped clean.
    for (const p of w.parties) {
      p.boost = 0;
      const leader = w.figures[p.leaderId];
      // (A party the player leads decides its leader's fate with the player: see engine/leadership.js.)
      if (p.id !== w.govt.lead && leader && !leader.isPlayer && leader.died == null && rng.chance(0.3 + (leader.t.ambition < 45 ? 0.2 : 0))) replaceLeader(w, p, 'stood down after the election defeat');
      if (!inPower.has(p.id)) p.record = Math.round((p.record ?? 0) * 0.4);
    }
    w.approval = 55;
  }
  for (const old of w.elections) delete old.byGroup;
  w.elections.push(rec);
  if (w.elections.length > 30) w.elections.shift();
  h.wasHead = true;
  return rec;
}

function replaceLeader(w, p, why) {
  const old = w.figures[p.leaderId];
  const next = w.figures[p.deputyId]?.died == null ? w.figures[p.deputyId] : newFigure(w, p.id, rng.int(38, 55));
  if (old) { say(old, `${why[0].toUpperCase()}${why.slice(1)} as leader of ${the(p)}.`); if (old.post !== 'head') old.post = 'former leader'; }
  p.leaderId = next.id; next.post = next.post === 'head' ? 'head' : 'leader';
  p.vacancy = yearNow(); // for a year the new leader is untested, and others may fancy their chances
  say(next, `Became leader of ${the(p)}.`);
  const dep = newFigure(w, p.id, rng.int(32, 48)); dep.post = 'deputy'; p.deputyId = dep.id;
  return next;
}

// ---------- Governing ----------

/** The parties in government, and whether they can pass what they like. */
const governing = (w) => [w.govt.lead, ...w.govt.partners].map((id) => party(w, id)).filter(Boolean);

/** One step of policy, if the government wants one and can get it through. @returns {?object} the law */
function legislate(w) {
  const lead = party(w, w.govt.lead);
  if (!lead) return null;
  // A government in deficit has to raise tax or cut something before it does anything else.
  const want = [];
  const year0 = yearNow();
  for (const [id, L] of Object.entries(LEVERS)) {
    const target = Math.round(clamp(governing(w).reduce((s, p) => s + p.positions[L.follows], 0) / governing(w).length, -2, 2));
    const at = w.policies[id];
    const dir = target > at ? 1 : -1;
    // Near the limit of what it can borrow, a government does not take on new costs.
    const settled = year0 - (w.moved?.[id] ?? -99) >= 5; // a law just changed is left alone for a while
    if (at !== target && settled && w.budget - L.cost * dir > -3) want.push({ id, dir });
  }
  let pick = null;
  if (w.budget <= -3 || ((w.debt ?? 0) >= 12 && w.budget < 0)) {
    // Either way of balancing the books is unpopular; which one depends on who governs.
    pick = lead.positions.tax >= 0 && w.policies.tax < 2 ? { id: 'tax', dir: 1, forced: true }
      : ['tuition', 'health', 'rent'].filter((id) => w.policies[id] > -2).map((id) => ({ id, dir: -1, forced: true }))[0] ?? (w.policies.tax < 2 ? { id: 'tax', dir: 1, forced: true } : null);
  } else if (want.length) pick = rng.pick(want);
  if (!pick) return null;
  // Not every year brings a bill. When one comes, the legislature votes on it: a minority
  // government, or a president facing a hostile chamber, loses votes a majority would win.
  if (!rng.chance(pick.forced ? 0.8 : 0.6)) return null;
  if (w.kind === 'party' || w.kind === 'none') return enact(w, pick.id, pick.dir, head(w)?.name, pick.forced);
  const t = floorVote(w, pick.id, pick.dir, { whip: pick.forced ? 0.1 : 0 });
  if (!t.passes) return { failed: true, text: toDo(LEVERS[pick.id][pick.dir > 0 ? 'up' : 'down']), vote: [t.for, t.against] };
  const law = enact(w, pick.id, pick.dir, head(w)?.name, pick.forced);
  if (law) law.vote = [t.for, t.against];
  return law;
}

/** Moves a lever one step, records the law, and charges or credits the budget. */
export function enact(w, lever, dir, by, forced = false) {
  const L = LEVERS[lever];
  const at = w.policies[lever];
  if (!L || at + dir > 2 || at + dir < -2) return null;
  w.policies[lever] = at + dir;
  (w.moved ??= {})[lever] = yearNow();
  w.budget = Math.round((w.budget - L.cost * dir) * 10) / 10;
  const law = { year: yearNow(), lever, dir, by: by ?? 'the government', text: `${dir > 0 ? L.up : L.down}${forced ? ' to balance the books' : ''}` };
  w.laws.push(law);
  if (w.laws.length > 60) w.laws.shift();
  // Voters notice: spending pleases, tax and cuts do not, though not everyone agrees.
  const liked = lever === 'tax' ? -dir : dir;
  w.approval = clamp(w.approval + liked * 3);
  for (const p of governing(w)) p.record = clamp((p.record ?? 0) + liked * 1.5, -15, 15);
  return law;
}

/**
 * Yearly: the country's politics move on a year. Returns what happened as
 * lines for whoever lives there: [{ text, tone, weight }].
 */
export function tickPolity(w) {
  const year = yearNow();
  if (w.tickedYear === year) return [];
  w.tickedYear = year;
  const cid = w.countryId;
  const c = COUNTRIES[cid];
  const news = [];
  const tell = (text, tone = 'neutral', weight = 1) => { news.push({ text, tone, weight }); postNews(w, text, { tone }); };
  const playerLeads = store.state.player.politics?.officeId === 'head' && store.state.player.countryId === cid;

  // People: age, retire, die. A party is never left without a leader.
  const pl = store.state.player;
  for (const f of Object.values(w.figures)) {
    if (f.died != null) continue;
    // The player's own entry lives and dies with the player, not by the roll of these dice.
    if (f.isPlayer) { if (pl.alive && pl.countryId === cid) { f.name = `${pl.firstName} ${pl.lastName}`; f.look = pl.appearance; } continue; }
    const age = year - f.born;
    if (rng.chance(age < 60 ? 0.003 : age < 72 ? 0.012 : age < 82 ? 0.05 : 0.14)) { f.died = year; say(f, `Died, aged ${age}.`); continue; }
    if (age >= 70 && f.post && f.post !== 'head' && rng.chance(0.18)) { say(f, 'Retired from politics.'); f.retired = true; }
  }
  for (const p of w.parties) {
    const leader = w.figures[p.leaderId];
    if (!leader || leader.died != null || leader.retired) {
      const wasHead = w.govt.headId === p.leaderId;
      const next = replaceLeader(w, p, leader?.died != null ? 'died' : 'retired');
      if (wasHead && !playerLeads) { w.govt.headId = next.id; w.govt.since = year; next.post = 'head'; tell(`${leader.name} is ${leader.died != null ? 'dead' : 'gone'}, and ${next.name} is the new ${headTitle(cid)}.`, 'neutral', 3); }
    }
  }
  tickCabinet(w, tell, playerLeads);
  tickDiplomacy(w, tell, playerLeads);
  if (w.kind === 'none') {
    const h = head(w);
    if (!h || h.died != null || h.retired || rng.chance(0.07)) { const f = newFigure(w, null); f.post = 'head'; w.govt.headId = f.id; w.govt.since = year; say(f, `Appointed ${headTitle(cid)} by the crown.`); tell(`The ruler has appointed ${f.name} as ${headTitle(cid)}.`); }
    if (!playerLeads && rng.chance(0.25)) legislateByDecree(w, tell);
    return news;
  }

  if (year % 10 === 0) {
    // Remembered: the living, everyone who governed, and anyone the player crossed paths with.
    const keep = new Set([...w.parties.flatMap((p) => [p.leaderId, p.deputyId]), ...Object.values(w.cabinet ?? {}), ...Object.values(w.shortlists ?? {}).flatMap((x) => x.ids)]);
    for (const f of Object.values(w.figures)) if (f.died != null && year - f.died > 15 && !f.wasHead && !f.metPlayer && !f.isPlayer && !keep.has(f.id)) delete w.figures[f.id];
  }

  // How the government is doing: the times it governs in, and its own conduct.
  const L = c.living ?? {};
  w.approval = Math.round(w.approval + (48 - w.approval) * 0.12 + (L.crisis ? -3 : 0) + (L.inflation === 'extreme' ? -3 : L.inflation === 'high' ? -1 : 0) + noise(3));
  w.approval = clamp(w.approval);
  if (!playerLeads) {
    const h = head(w);
    // Scandal: the less scrupulous, the likelier. It may be survived.
    if (h && rng.chance(0.02 + (60 - h.t.integrity) / 900)) {
      const what = rng.pick(POLITICAL_SCANDALS);
      w.approval = clamp(w.approval - rng.int(6, 14));
      say(h, `Scandal: ${h.name} ${what}.`);
      const lead = party(w, w.govt.lead);
      lead.record = clamp((lead.record ?? 0) - 4, -15, 15);
      if (w.approval < 30 && rng.chance(0.6) && w.kind !== 'party') {
        const next = replaceLeader(w, lead, 'resigned over a scandal');
        w.govt.headId = next.id; w.govt.since = year; next.post = 'head'; h.post = 'former head';
        tell(`${headTitle(cid)} ${h.name} ${what}, and has resigned. ${next.name} takes over.`, 'neutral', 4);
      } else tell(`${headTitle(cid)} ${h.name} ${what}.`, 'neutral', 2);
    }
    const law = legislate(w);
    if (law?.failed) tell(`The government's bill to ${law.text} was defeated in the legislature, ${law.vote[0]} votes to ${law.vote[1]}.`, 'neutral', 1);
    else if (law) tell(`The government has ${law.text}.`, 'neutral', 2);
    // A coalition of parties that do not much like each other can fall apart.
    if (w.govt.kind === 'coalition' && w.calendar.general - year > 1 && rng.chance(0.06)) {
      tell('The governing coalition has collapsed. There will be an early election.', 'neutral', 3);
      w.calendar.general = year;
    }
  }

  // The election, when it is due.
  // A player who has left the top office leaves a vacancy, filled from the largest party.
  const sitting = head(w);
  if (sitting?.isPlayer && !playerLeads) {
    const biggest = [...w.parties].sort((a, b) => (w.seats[b.id] ?? 0) - (w.seats[a.id] ?? 0))[0];
    sitting.post = 'former head';
    w.govt = { ...w.govt, lead: biggest.id, partners: [], headId: biggest.leaderId, since: year, kind: (w.seats[biggest.id] ?? 0) > w.seatCount / 2 ? 'majority' : 'minority' };
    w.figures[biggest.leaderId].post = 'head';
    formCabinet(w);
    tell(`${w.figures[biggest.leaderId].name} of ${the(biggest)} is the new ${headTitle(cid)}.`, 'neutral', 3);
  }
  if (year >= w.calendar.general) {
    const before = { lead: w.govt.lead, headId: w.govt.headId };
    // A leader who holds the top office through their party keeps it only if the party keeps the government.
    const kept = playerLeads && !pl.politics.viaParty ? { ...w.govt } : null;
    const rec = runGeneral(w, year);
    if (kept) {
      // The player won their own race for the top office; this election decides the seats they will work with.
      const me = w.figures[kept.headId];
      for (const f of Object.values(w.figures)) if (f.post === 'head' && f.id !== me.id) f.post = 'leader';
      me.post = 'head';
      w.govt = { ...w.govt, headId: me.id, since: kept.since, lead: me.partyId ?? w.govt.lead, kind: me.partyId && (w.seats[me.partyId] ?? 0) > w.seatCount / 2 ? 'majority' : 'minority' };
      rec.govt = { ...rec.govt, headId: me.id, headName: me.name, lead: w.govt.lead, kind: w.govt.kind };
    }
    w.calendar.general = year + w.calendar.term;
    // A new government names new ministers; one that is returned keeps its own.
    if (!kept && before.lead !== w.govt.lead && !head(w)?.isPlayer) formCabinet(w);
    const lead = party(w, rec.govt.lead);
    const top = Object.entries(rec.shares).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, s]) => `${party(w, id).name} ${s}%`).join(', ');
    const how = w.kind === 'party' ? `${rec.govt.headName} ${before.headId === rec.govt.headId ? 'remains' : 'now stands'} at the head of ${the(lead)}.`
      : w.kind === 'presidential' ? `${rec.govt.headName} of ${the(lead)} ${before.headId === rec.govt.headId ? 'is re-elected' : 'is elected'} ${headTitle(cid)}${rec.runoff ? ' after a run-off' : ''}${rec.govt.kind === 'divided' ? ', and faces a legislature held by opponents' : ''}.`
        : rec.govt.kind === 'coalition' ? `No party won a majority. ${the(lead).replace(/^t/, 'T')} will govern in coalition with ${rec.govt.partners.map((id) => the(party(w, id))).join(' and ')}, under ${rec.govt.headName}.`
          : rec.govt.kind === 'minority' ? `No party won a majority, and none could agree a coalition. ${the(lead).replace(/^t/, 'T')} will govern alone, as a minority, under ${rec.govt.headName}.`
            : `${the(lead).replace(/^t/, 'T')} won a majority. ${rec.govt.headName} ${before.headId === rec.govt.headId ? 'stays on as' : 'is the new'} ${headTitle(cid)}.`;
    // The player's own vote: one among millions, but theirs, and on the record.
    const v = pl.flags.voteFor;
    if (pl.countryId === cid && w.kind !== 'party' && !mayVote(cid)) {
      const chosen = party(w, v?.countryId === cid ? v.partyId : membership(cid)?.id);
      if (chosen) { (pl.flags.voted ??= []).push({ year, party: chosen.name, won: chosen.id === w.govt.lead }); if (pl.flags.voted.length > 30) pl.flags.voted.shift(); tell(`You voted for ${the(chosen)}. ${chosen.id === w.govt.lead ? 'It will lead the government.' : (w.seats[chosen.id] ?? 0) ? 'It did not win.' : 'It won no seats at all.'}`, 'neutral', 4); }
    }
    tell(w.kind === 'party' ? `The party congress has met. ${how}` : kept ? `Legislative election: ${top}; turnout ${rec.turnout}%. You remain ${headTitle(cid)}${w.govt.kind === 'majority' ? ', with a majority behind you' : ', without a majority'}.` : `General election: ${top}; turnout ${rec.turnout}%. ${how}`, 'neutral', 5);
  }
  return news;
}

/** Where nobody is elected, policy is whatever the ruler's ministers think the ruler wants. */
function legislateByDecree(w, tell) {
  const id = rng.pick(Object.keys(LEVERS));
  const dir = w.budget <= -3 || ((w.debt ?? 0) >= 12 && w.budget < 0) ? (id === 'tax' ? 1 : -1) : rng.pick([1, 1, -1]);
  const law = enact(w, id, dir, head(w)?.name);
  if (law) tell(`By decree, the government has ${law.text}.`, 'neutral', 2);
}

// ---------- For the screens ----------

/** In words, where a party stands on an issue. */
export function stance(issue, v) {
  const words = { tax: ['much lower taxes', 'lower taxes', 'taxes as they are', 'higher taxes on the well-off', 'much higher taxes on the well-off'],
    services: ['a much smaller state', 'a leaner state', 'services as they are', 'more for schools and hospitals', 'far more for schools and hospitals'],
    housing: ['housing left to the market', 'fewer housing rules', 'housing as it is', 'more building and rent limits', 'a great deal of building and firm rent control'],
    order: ['a far lighter touch on crime', 'a lighter touch on crime', 'policing as it is', 'tougher policing', 'much tougher policing'],
    green: ['growth before the environment', 'fewer green rules', 'the environment as it is', 'stronger green rules', 'the environment before growth'],
    open: ['closed borders and tradition', 'tighter borders', 'things as they are', 'more open borders and freedoms', 'open borders and wide personal freedoms'] };
  return words[issue][clamp(Math.round(v) + 2, 0, 4)];
}

/** A summary of a country's politics for the screens. */
export function overview(countryId = store.state.player.countryId) {
  const w = polity(countryId);
  const h = head(w);
  const year = yearNow();
  return {
    kind: w.kind, headTitle: headTitle(countryId), head: h, headParty: party(w, h?.partyId), since: w.govt.since, govtKind: w.govt.kind, approval: w.approval,
    parties: [...w.parties].sort((a, b) => (w.seats[b.id] ?? 0) - (w.seats[a.id] ?? 0)).map((p) => ({ ...p, seats: w.seats[p.id] ?? 0, share: w.elections[w.elections.length - 1]?.shares[p.id] ?? 0,
      leader: w.figures[p.leaderId], inGovt: p.id === w.govt.lead || w.govt.partners.includes(p.id), stances: Object.keys(ISSUES).map((i) => stance(i, p.positions[i])).filter((s) => !/as (they are|it is)/.test(s)) })),
    seatCount: w.seatCount, nextElection: w.kind === 'none' ? null : w.calendar.general, yearsToElection: w.kind === 'none' ? null : w.calendar.general - year,
    policies: Object.entries(w.policies).filter(([, n]) => n).map(([id, n]) => LEVERS[id].feel(n)), budget: w.budget, debt: w.debt ?? 0,
    laws: [...w.laws].reverse().slice(0, 12), elections: [...w.elections].reverse(),
  };
}

// ---------- The player's part ----------

/** The party the player belongs to in this country, or null. */
export function membership(countryId = store.state.player.countryId) {
  const m = store.state.player.flags.party;
  return m && m.countryId === countryId ? party(polity(countryId), m.partyId) : null;
}

export function joinParty(partyId) {
  const p = store.state.player;
  const w = polity(p.countryId);
  const pa = party(w, partyId);
  if (!pa || p.age < 16) return { ok: false, text: 'You cannot join that party.', tone: 'neutral' };
  if (p.royal && ['monarch', 'heir', 'royal'].includes(p.royal.rank)) return { ok: false, text: 'The royal family belongs to no party.', tone: 'neutral' };
  const was = membership(p.countryId);
  if (p.flags.party?.leader) release(w, 'left the party');
  p.flags.party = { countryId: p.countryId, partyId, since: yearNow() };
  const text = was ? `You have left ${the(was)} and joined ${the(pa)}. Your old colleagues will not forget it.` : `You have joined ${the(pa)}. There is a card, a newsletter, and a great many meetings.`;
  if (was) p.counters.polExp = Math.max(0, (p.counters.polExp ?? 0) - 3);
  return { ok: true, text, tone: 'neutral' };
}

export function leaveParty() {
  const p = store.state.player;
  const was = membership(p.countryId);
  if (!was) return { ok: false, text: 'You belong to no party.', tone: 'neutral' };
  if (p.flags.party?.leader) release(polity(p.countryId), 'left the party');
  delete p.flags.party;
  return { ok: true, text: `You have left ${the(was)}. You are an independent now.`, tone: 'neutral' };
}

/** What belonging to a party (or to none) is worth in a campaign, as points of standing. */
export function partyBacking(tier, countryId = store.state.player.countryId) {
  const w = polity(countryId);
  if (w.kind === 'none') return 0;
  const pa = membership(countryId);
  if (!pa) return tier >= 3 ? -4 : 0; // an independent has no machine behind them for the bigger races
  const share = w.elections[w.elections.length - 1]?.shares[pa.id] ?? 20;
  const inGovt = pa.id === w.govt.lead || w.govt.partners.includes(pa.id);
  return Math.round(clamp((share - 22) / 3, -4, 8) + (inGovt ? (w.approval - 50) / 8 : 2));
}

/** The year the next election for an office is held. Local and regional offices have their own cycles. */
export function nextElection(officeId, countryId = store.state.player.countryId) {
  const w = polity(countryId);
  const year = yearNow();
  if (w.kind === 'none') return null;
  if (officeId === 'seat' || officeId === 'head') return Math.max(year + 1, w.calendar.general);
  const offset = officeId === 'region' ? (w.calendar.local + 2) % 4 : w.calendar.local;
  let y = year + 1;
  while (y % 4 !== offset) y += 1;
  return y;
}
/** Whether a campaign for an office can be fought now: only in the year running up to its election. */
export const inSeason = (officeId, countryId) => nextElection(officeId, countryId) === yearNow() + 1;

/** The person the player is up against for an office: a real politician, who will be remembered. */
export function opponentFor(officeId, countryId = store.state.player.countryId) {
  const w = polity(countryId);
  const mine = membership(countryId);
  if (w.kind === 'party' || w.kind === 'none') return null;
  if (officeId === 'head') {
    const sitting = head(w);
    if (sitting && !sitting.isPlayer && sitting.partyId !== mine?.id) return sitting;
    const rival = w.parties.filter((p) => p.id !== mine?.id).sort((a, b) => (w.seats[b.id] ?? 0) - (w.seats[a.id] ?? 0))[0];
    return w.figures[rival.leaderId];
  }
  // For other offices: a local politician from a rival party, the same one each time until one of you moves on.
  const key = `rival_${officeId}`;
  let f = w.figures[w[key]];
  if (!f || f.died != null || f.retired || f.partyId === mine?.id) {
    const rivals = w.parties.filter((p) => p.id !== mine?.id);
    f = newFigure(w, rng.pick(rivals).id, rng.int(30, 58));
    f.post = 'local';
    if (countryId === store.state.player.countryId) asSchoolmate(f);
    w[key] = f.id;
  }
  f.metPlayer = true;
  return f;
}

/** Whether the player may vote here: an adult citizen, where votes are counted. */
export function mayVote(countryId = store.state.player.countryId) {
  const p = store.state.player;
  const kind = kindOf(countryId);
  if (kind !== 'presidential' && kind !== 'parliamentary') return 'No votes are cast here.';
  if (p.age < rule('votingAge', countryId)) return `You are too young to vote: the voting age here is ${rule('votingAge', countryId)}.`;
  // Historical Eras: before women won the vote, they could not cast one.
  if ((p.flags?.trueGender ?? p.gender) === 'female' && !rule('womenVote', countryId)) return 'Women cannot vote here yet.';
  if (p.legal?.incarceration) return 'Prisoners cannot vote here.';
  if (!held(p).includes(issuer(countryId))) return 'You are not a citizen here, and cannot vote. You can apply for citizenship from your passport.';
  return '';
}
/** Says how the player will vote at the next general election. */
export function intend(partyId) {
  const p = store.state.player;
  const w = polity(p.countryId);
  const pa = party(w, partyId);
  const why = mayVote(p.countryId);
  if (why || !pa) return { ok: false, text: why || 'There is no such party.', tone: 'neutral' };
  p.flags.voteFor = { countryId: p.countryId, partyId };
  return { ok: true, text: `At the next general election, in ${Math.max(yearNow() + 1, w.calendar.general)}, you will vote for ${the(pa)}.`, tone: 'neutral' };
}

/** The colleague who wants the same nomination: someone in the player's own party, the same one until one of them moves on. */
export function primaryRival(officeId, countryId = store.state.player.countryId) {
  const w = polity(countryId);
  const mine = membership(countryId);
  if (!mine) return null;
  const key = `primary_${officeId}`;
  let f = w.figures[w[key]];
  if (!f || f.died != null || f.retired || f.partyId !== mine.id || f.isPlayer) {
    f = newFigure(w, mine.id, rng.int(30, 58));
    f.post = 'local';
    if (countryId === store.state.player.countryId) asSchoolmate(f);
    w[key] = f.id;
  }
  f.metPlayer = true;
  return f;
}

/** Writes a race into the record of the politician the player fought. */
export function recordRace(f, text) { if (f) { f.metPlayer = true; say(f, text); } }

/** The player's own entry among the country's politicians. */
export function playerFigure(countryId = store.state.player.countryId, create = true) {
  const p = store.state.player;
  const w = polity(countryId);
  let f = Object.values(w.figures).find((x) => x.isPlayer);
  if (!f && !create) return null;
  if (!f) { f = newFigure(w, membership(countryId)?.id ?? null, p.age); f.isPlayer = true; }
  f.name = `${p.firstName} ${p.lastName}`; f.gender = p.gender; f.look = p.appearance; f.born = yearNow() - p.age; f.partyId = membership(countryId)?.id ?? null;
  f.t.charisma = Math.round(p.stats.charm);
  return f;
}

/** Puts a particular politician at the head of their party; if the party leads the government, at the head of that too. @returns {boolean} whether they now govern */
export function makeLeader(w, pa, f) {
  const old = w.figures[pa.leaderId];
  const wasHead = w.govt.headId === pa.leaderId;
  if (old && old.id !== f.id) { old.post = wasHead ? 'former head' : 'former leader'; say(old, `Gave way to ${f.name} as leader of ${the(pa)}.`); }
  pa.leaderId = f.id; f.post = 'leader';
  say(f, `Became leader of ${the(pa)}.`);
  if (w.govt.lead === pa.id && wasHead) { w.govt.headId = f.id; w.govt.since = yearNow(); f.post = 'head'; f.wasHead = true; say(f, `Became ${headTitle(w.countryId)}.`); return true; }
  return false;
}

/** The player gives up whatever they lead: their party gets a new leader, and the country a new head of government. */
export function release(w, why = 'stepped down') {
  const f = Object.values(w.figures).find((x) => x.isPlayer);
  if (!f) return;
  for (const pa of w.parties) if (pa.leaderId === f.id) replaceLeader(w, pa, why);
  if (w.govt.headId === f.id) {
    const lead = party(w, w.govt.lead) ?? [...w.parties].sort((a, b) => (w.seats[b.id] ?? 0) - (w.seats[a.id] ?? 0))[0];
    const next = lead ? w.figures[lead.leaderId] : null;
    f.post = 'former head';
    if (next) { w.govt.headId = next.id; w.govt.since = yearNow(); next.post = 'head'; next.wasHead = true; say(next, `Became ${headTitle(w.countryId)}.`); formCabinet(w); }
  }
  delete w.bill;
}

/** The player is gone (a new generation has taken over): their entry becomes one more name in the country's history. */
export function detach(w) {
  const f = Object.values(w.figures).find((x) => x.isPlayer);
  if (!f) return;
  release(w, 'died');
  f.isPlayer = false;
  if (f.died == null) { f.died = yearNow(); say(f, `Died, aged ${f.died - f.born}.`); }
  delete w.shortlists;
}

/** The player takes the top office: the political world has a new head of government. */
export function seatPlayer(countryId = store.state.player.countryId) {
  const w = polity(countryId);
  const f = playerFigure(countryId);
  const old = head(w);
  if (old && old.id !== f.id) { old.post = 'former head'; say(old, `Lost the office of ${headTitle(countryId)} to ${f.name}.`); }
  f.post = 'head'; f.wasHead = true;
  // A government already formed around the player (they lead the party that won) is kept as it is.
  if (w.govt.headId !== f.id) w.govt = { ...w.govt, headId: f.id, since: yearNow(), lead: f.partyId ?? w.govt.lead, partners: f.partyId ? [] : w.govt.partners, leadSince: yearNow(), kind: f.partyId && (w.seats[f.partyId] ?? 0) > w.seatCount / 2 ? 'majority' : 'minority' };
  say(f, `Became ${headTitle(countryId)}.`);
  // The last government's ministers clear their desks. The new leader chooses their own.
  for (const id of Object.values(w.cabinet ?? {})) { const m = w.figures[id]; if (m?.post === 'minister') m.post = 'former minister'; }
  w.cabinet = {};
  delete w.bill;
  w.approval = 55;
  return f;
}

/**
 * As head of government, the player brings in a law. Whether it passes
 * depends on the seats behind them. @returns {{ok:boolean, text:string, tone:string, law?:object}}
 */
export function playerLaw(lever, dir) {
  const p = store.state.player;
  const w = polity(p.countryId);
  const L = LEVERS[lever];
  if (p.politics?.officeId !== 'head' || !L) return { ok: false, text: 'That is not in your power.', tone: 'neutral' };
  if (w.policies[lever] + dir > 2 || w.policies[lever] + dir < -2) return { ok: false, text: 'It cannot be taken any further.', tone: 'neutral' };
  if (w.budget - L.cost * dir < -4) return { ok: false, text: 'The treasury says there is no money for it. Raise tax or cut something else first.', tone: 'neutral' };
  // A leader with a majority gets their way; one without has to find the votes.
  const mine = membership(p.countryId);
  const seats = mine ? (w.seats[mine.id] ?? 0) : 0;
  const chance = w.kind === 'party' || p.politics.ruler ? 0.95 : clamp(0.25 + (seats / w.seatCount) * 1.1 + (p.stats.charm - 50) / 300, 0.15, 0.95);
  if (!rng.chance(chance)) {
    const text = `Your bill to ${L[dir > 0 ? 'up' : 'down'].replace(/^(raised|cut|put|capped|lifted)/, (v) => ({ raised: 'raise', cut: 'cut', put: 'put', capped: 'cap', lifted: 'lift' })[v])} was voted down. You did not have the numbers.`;
    return { ok: false, text, tone: 'bad' };
  }
  const law = enact(w, lever, dir, `${p.firstName} ${p.lastName}`);
  return { ok: true, text: `Your government has ${law.text}. ${L.feel(w.policies[lever]) }`, tone: 'good', law };
}
