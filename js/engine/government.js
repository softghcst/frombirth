// Governing: the cabinet, bills on their way through the legislature, the
// yearly budget, and what lands on a leader's desk. The political world it
// acts on is in engine/polity.js; the counting of votes is in engine/legislature.js.
//
// On the political world of a country:
//   w.cabinet    { departmentId: figureId }   who runs each department (see DEPARTMENTS)
//   w.debt       what past deficits have piled up
//   w.bill       the player's bill in progress: { lever, dir, stage: 'amend' | 'floor', ask, deals, cost }
//   w.shortlists { departmentId: { year, ids } }   who the player may appoint this year
// A minister is a politician like any other (a figure), with one more trait: t.skill.
import * as law from './rules.js';
import { post } from './economy.js';
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { store, player } from '../state.js';
import { LEVERS, DEPARTMENTS, POLITICAL_SCANDALS } from '../data/parties.js';
import { MONARCHIES } from '../data/royalty.js';
import { tally, overrides, lean } from './legislature.js';
import * as world from './polity.js';
import { report } from './news.js';
import { forCabinet, nepotism } from './kin.js';
import * as dyn from './dynasty.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', more = {}) => ({ ok, text, tone, ...more });
const noise = (n) => (rng.next() * 2 - 1) * n;
const yearNow = () => store.state.year;
const dept = (id) => DEPARTMENTS.find((d) => d.id === id);
const deptOf = (lever) => DEPARTMENTS.find((d) => d.lever === lever);
const cap = (s) => s[0].toUpperCase() + s.slice(1);
/** "raised income tax" → "raise income tax": a law as something still to be done. */
export const toDo = (text) => text.replace(/^(raised|cut|put|capped|lifted)/, (v) => ({ raised: 'raise', cut: 'cut', put: 'put', capped: 'cap', lifted: 'lift' })[v]);

/** How good a politician is at running a department. Older saves have none; it is settled the first time it matters. */
export function skillOf(f) {
  if (f.t.skill == null) f.t.skill = Math.round(clamp(rng.around(55, 30)));
  return f.t.skill;
}
const minister = (w, id) => { const f = w.figures[w.cabinet?.[id]]; return f && f.died == null && !f.retired ? f : null; };
const playerHeads = (w) => { const p = player(); return p.politics?.officeId === 'head' && p.countryId === w.countryId; };

/** In a few words, what is known about a politician as a minister. */
export function sketch(f) {
  const s = skillOf(f);
  return [s >= 72 ? 'very able' : s >= 55 ? 'capable' : s >= 40 ? 'adequate' : 'out of their depth',
    f.t.integrity >= 68 ? 'clean hands' : f.t.integrity <= 40 ? 'cuts corners' : null, f.t.ambition >= 72 ? 'wants your job' : null].filter(Boolean).join(', ');
}

// ---------- The cabinet of a government the player does not lead ----------

function fill(w, id, partyId) {
  let f = Object.values(w.figures).find((x) => x.died == null && !x.retired && !x.isPlayer && !x.sacked && x.partyId === partyId && ['former minister', 'backbench'].includes(x.post));
  if (!f) f = world.newFigure(w, partyId, rng.int(36, 60));
  f.post = 'minister';
  w.cabinet[id] = f.id;
  world.note(f, `Appointed ${dept(id).title}.`);
  return f;
}

/** A new government names its ministers. Coalition partners each get a department. */
export function formCabinet(w) {
  for (const id of Object.values(w.cabinet ?? {})) { const f = w.figures[id]; if (f?.post === 'minister') f.post = 'former minister'; }
  w.cabinet = {};
  DEPARTMENTS.forEach((d, i) => fill(w, d.id, w.govt.partners[DEPARTMENTS.length - 1 - i] ?? w.govt.lead));
}

// ---------- Votes ----------

/** A vote of the legislature on one step of one policy. Where nobody is elected, there is nobody to vote. */
export function floorVote(w, lever, dir, o = {}) {
  const m = minister(w, deptOf(lever)?.id);
  return tally(w.parties, w.seats, { wants: { [LEVERS[lever].follows]: dir } },
    { lead: w.govt.lead, partners: w.govt.partners, noise, skill: m ? (skillOf(m) - 50) / 400 : -0.04, ...o });
}
/** The tally as the screens show it: one row for each party. */
const rows = (w, t) => w.parties.filter((p) => t.byParty[p.id]).map((p) => ({ name: p.name, colour: p.colour, ...t.byParty[p.id] }));

// ---------- The yearly round ----------

/** Yearly, from the political world's own tick. `tell` adds a line to the year's news. */
export function tickCabinet(w, tell, playerLeads) {
  w.cabinet ??= {};
  // Deficits pile up; surpluses pay them down.
  const before = w.debt ?? 0;
  // A small deficit is carried by a growing economy; beyond that it is borrowed.
  w.debt = Math.round(clamp(before + (w.budget < 0 ? Math.max(0, -w.budget - 1) : -w.budget - 0.5), 0, 40) * 10) / 10;
  if (w.debt >= 12) {
    w.approval = clamp(w.approval - 2);
    if (before < 12) tell('The national debt has become a worry. Lenders want more interest, and say so in public.', 'bad', 3);
  }
  if (w.kind === 'none' && !Object.keys(w.cabinet).length) for (const d of DEPARTMENTS) fill(w, d.id, null);
  for (const d of DEPARTMENTS) {
    const f = w.figures[w.cabinet[d.id]];
    if (w.cabinet[d.id] && (!f || f.died != null || f.retired)) {
      delete w.cabinet[d.id];
      if (playerLeads && f) tell(`Your ${d.title}, ${f.name}, has ${f.died != null ? 'died' : 'retired'}. The post is empty.`, 'neutral', 3);
    }
    if (!playerLeads && !w.cabinet[d.id] && (w.govt.lead || w.kind === 'none')) fill(w, d.id, w.govt.lead);
  }
  if (!playerLeads) {
    const d = rng.pick(DEPARTMENTS);
    const f = minister(w, d.id);
    if (f && rng.chance(clamp(0.03 + (55 - f.t.integrity) / 700, 0.005, 0.12))) {
      const what = rng.pick(POLITICAL_SCANDALS);
      world.note(f, `Scandal: ${f.name} ${what}, and left the government.`);
      f.post = 'former minister'; f.sacked = true;
      w.approval = clamp(w.approval - 3);
      const next = fill(w, d.id, f.partyId ?? w.govt.lead);
      tell(`${d.title} ${f.name} ${what}, and has gone. ${next.name} takes over.`, 'neutral', 1);
    }
    return;
  }
  playerYear(w, tell);
}

/** The year of a government the player leads: how the ministers did, who is in trouble, what the other side tried. */
function playerYear(w, tell) {
  const p = player();
  const k = p.politics;
  let sum = 0;
  const empty = [];
  for (const d of DEPARTMENTS) {
    const f = minister(w, d.id);
    sum += f ? (skillOf(f) - 50) / 40 : -1.5;
    if (!f) empty.push(d.title);
  }
  k.approval = Math.round(clamp(k.approval + sum / 2));
  w.approval = clamp(w.approval + sum / 2);
  if (empty.length) tell(`${empty.length === 1 ? `The post of ${empty[0]} is` : `${empty.length} posts in your cabinet are`} empty, and the work is not being done.`, 'bad', 3);

  const pend = store.state.pendingEvents;
  for (const d of DEPARTMENTS) {
    const f = minister(w, d.id);
    if (!f) continue;
    if (f.t.ambition >= 75 && k.approval < 35 && rng.chance(0.25)) {
      delete w.cabinet[d.id]; f.post = 'former minister'; f.sacked = true;
      world.note(f, `Resigned as ${d.title}, saying the government had lost its way.`);
      k.approval = Math.round(clamp(k.approval - 4));
      tell(`${f.name} has resigned as your ${d.title}, with a letter clearly written for the newspapers.`, 'bad', 4);
      break;
    }
    if (rng.chance(clamp(0.04 + (50 - f.t.integrity) / 500, 0.01, 0.16))) {
      const what = rng.pick(POLITICAL_SCANDALS);
      report(w, 'minister', { post: `${d.title} ${f.name}`, what });
      pend.push({ id: 'pol_minister_scandal', cast: { dept: d.id, words: { minister: f.name, post: d.title, what } } });
      break;
    }
  }

  // Where there is a crown that reigns but does not rule, its first minister is received by it.
  const house = store.state.dynasties?.[w.countryId];
  const crown = house?.type ?? MONARCHIES[w.countryId]?.type;
  if (crown && MONARCHIES[w.countryId] && !['executive', 'absolute'].includes(crown) && !p.royal?.reigning) {
    const d = dyn.house(w.countryId);
    if (d.status !== 'abolished') {
      if ((w.palace ?? 0) <= -20) { k.approval = Math.round(clamp(k.approval - 2)); tell('The palace lets it be known, through friends, that it has no confidence in your discretion.', 'bad', 2); w.palace += 5; }
      else if (rng.chance(0.2)) pend.push({ id: 'pm_audience', cast: { words: { monarch: dyn.nameOf(d, dyn.monarchOf(d)) } } });
    }
  }

  // A leader without a majority does not control what the legislature passes.
  if (w.kind === 'party' || w.kind === 'none' || k.ruler) return;
  const mine = world.membership(w.countryId);
  const own = mine ? (w.seats[mine.id] ?? 0) + (w.govt.lead === mine.id ? w.govt.partners.reduce((s, id) => s + (w.seats[id] ?? 0), 0) : 0) : 0;
  if (own > w.seatCount / 2 || !rng.chance(0.35)) return;
  const others = w.parties.filter((x) => x.id !== mine?.id && !(w.govt.lead === mine?.id && w.govt.partners.includes(x.id))).sort((a, b) => (w.seats[b.id] ?? 0) - (w.seats[a.id] ?? 0));
  const opp = others[0];
  if (!opp) return;
  const wanted = Object.entries(LEVERS).map(([id, L]) => ({ id, dir: Math.sign(Math.round(opp.positions[L.follows]) - w.policies[id]) }))
    .filter((x) => x.dir && Math.abs(w.policies[x.id] + x.dir) <= 2 && w.budget - LEVERS[x.id].cost * x.dir > -4);
  if (!wanted.length) return;
  const b = rng.pick(wanted);
  const t = tally(w.parties, w.seats, { wants: { [LEVERS[b.id].follows]: b.dir } }, { lead: opp.id, partners: [], noise });
  if (!t.passes) return;
  const text = LEVERS[b.id][b.dir > 0 ? 'up' : 'down'];
  if (w.kind === 'presidential') {
    pend.push({ id: 'pol_bill_on_desk', cast: { lever: b.id, dir: b.dir, by: opp.id, words: { party: world.the(opp), bill: toDo(text), votes: `${t.for} votes to ${t.against}` } } });
  } else {
    const law = world.enact(w, b.id, b.dir, `${world.the(opp)} and its allies`);
    if (law) { law.vote = [t.for, t.against]; law.over = true; k.approval = Math.round(clamp(k.approval - 2)); tell(`Over your government's head, ${world.the(opp)} and its allies have ${text}, by ${t.for} votes to ${t.against}.`, 'bad', 4); }
  }
}

/** What the player decided in a scene sent from here. @returns {string} what happened */
export function decide(what, cast = {}) {
  const p = player();
  const w = world.polity(p.countryId);
  const k = p.politics;
  if (what === 'refuseAssent') return refuseAssent();
  if (!k) return '';
  const shift = (n) => { k.approval = Math.round(clamp(k.approval + n)); };
  if (what === 'refuseAssent') return refuseAssent();
  if (what === 'standBy' || what === 'sack') {
    const d = dept(cast.dept);
    const f = d ? minister(w, d.id) : null;
    if (!f) return '';
    if (what === 'standBy' && rng.chance(0.3 + f.t.charisma / 300)) { shift(-2); f.metPlayer = true; world.note(f, `Survived a scandal as ${d.title}.`); return `It blows over. ${f.name} keeps the job, and owes you one.`; }
    delete w.cabinet[d.id]; f.post = 'former minister'; f.sacked = true; f.metPlayer = true;
    if (what === 'sack') { shift(-1); world.note(f, `Dismissed as ${d.title} over a scandal.`); return `${f.name} is gone by lunchtime. The post of ${d.title} is empty until you fill it.`; }
    shift(-8); world.note(f, `Resigned as ${d.title} after weeks of headlines.`);
    return `It does not blow over. After three weeks of headlines ${f.name} resigns anyway, and you look as though you were the last to know. The post of ${d.title} is empty.`;
  }
  if (what === 'audienceAsk' || what === 'audienceLeak' || what === 'audienceFormal') {
    const d = dyn.house(w.countryId);
    const mon = dyn.nameOf(d, dyn.monarchOf(d));
    if (what === 'audienceFormal') return 'Twenty minutes on the weather, the harvest and the state of the roads. You bow and leave.';
    if (what === 'audienceAsk') {
      w.palace = clamp((w.palace ?? 0) + 6, -50, 50);
      // Someone who has seen a dozen governments come and go sometimes sees what a new one cannot.
      if (rng.chance(0.6)) { shift(2); return `You tell ${mon} what is really keeping you awake. The questions that come back are better than any your advisers asked, and you change your plans.`; }
      return `You tell ${mon} what is really keeping you awake. The advice is kindly meant, and forty years out of date.`;
    }
    w.palace = clamp((w.palace ?? 0) - 25, -50, 50);
    d.standing = Math.round(clamp(d.standing - 3));
    shift(4);
    return `By Sunday every newspaper knows what ${mon} thinks of your opponents. It helps you, this week. Nobody at the palace will ever speak freely in front of you again.`;
  }
  if (what === 'sign' || what === 'veto') {
    const L = LEVERS[cast.lever];
    const opp = world.party(w, cast.by);
    if (!L || !opp) return '';
    const mine = world.membership(w.countryId);
    const myLean = mine ? lean(mine, { wants: { [L.follows]: cast.dir } }) : 0;
    if (what === 'veto') {
      const t = tally(w.parties, w.seats, { wants: { [L.follows]: cast.dir } }, { lead: opp.id, partners: [], noise, whip: 0.05 });
      if (!overrides(t)) { shift(myLean <= 0 ? 2 : -2); return `You veto it. An attempt to override you gets ${t.for} of ${t.total} votes, short of the two thirds it needs, and the bill is dead.`; }
      const law = world.enact(w, cast.lever, cast.dir, `${world.the(opp)}`);
      if (law) { law.vote = [t.for, t.against]; law.over = true; }
      shift(-4);
      return `You veto it, and the legislature overrides you, ${t.for} votes to ${t.against}. It is law without your signature.`;
    }
    const law = world.enact(w, cast.lever, cast.dir, `${world.the(opp)}`);
    shift(myLean < 0 ? -3 : 1);
    return law ? `You sign it. ${L.feel(w.policies[cast.lever])}${myLean < 0 && mine ? ` ${cap(world.the(mine))} is not pleased with you.` : ''}` : 'You sign it.';
  }
  return '';
}

// ---------- The player's cabinet ----------

export function cabinetView(countryId = player().countryId) {
  const w = world.polity(countryId);
  w.cabinet ??= {};
  return DEPARTMENTS.map((d) => { const f = minister(w, d.id); return { ...d, minister: f, party: f ? world.party(w, f.partyId) : null, sketch: f ? sketch(f) : '' }; });
}

/** Who could be given a department this year. The list is settled once a year, so it cannot be re-rolled. */
export function shortlist(deptId) {
  const w = world.polity(player().countryId);
  w.shortlists ??= {};
  const had = w.shortlists[deptId];
  if (!had || had.year !== yearNow()) {
    for (const id of had?.ids ?? []) { const f = w.figures[id]; if (f && f.post === 'backbench' && !f.metPlayer) delete w.figures[id]; }
    const mine = world.membership(w.countryId);
    const partners = mine && w.govt.lead === mine.id ? w.govt.partners : [];
    const from = [mine?.id ?? null, mine?.id ?? null, mine?.id ?? null, ...partners];
    w.shortlists[deptId] = { year: yearNow(), ids: from.map((pid) => { const f = world.newFigure(w, pid, rng.int(34, 62)); f.post = 'backbench'; skillOf(f); return f.id; }) };
  }
  const list = w.shortlists[deptId].ids.map((id) => w.figures[id]).filter((f) => f && f.post === 'backbench' && f.died == null)
    .map((f) => ({ figure: f, party: world.party(w, f.partyId), sketch: sketch(f) }));
  // A relative in the legislature can always be found a ministry. Whether they should be is another matter.
  for (const k of forCabinet()) if (k.figure.post !== 'minister') list.push({ figure: k.figure, party: k.party, sketch: sketch(k.figure), kin: k.word });
  return list;
}

export function appoint(deptId, figureId) {
  const w = world.polity(player().countryId);
  const d = dept(deptId);
  const f = w.figures[figureId];
  if (!playerHeads(w) || !d || !f || f.died != null) return result(false, 'That appointment is not yours to make.', 'neutral');
  if (minister(w, deptId)) dismiss(deptId);
  w.cabinet[deptId] = f.id;
  if (f.kin) nepotism(f);
  f.post = 'minister'; f.metPlayer = true;
  world.note(f, `Appointed ${d.title} by ${player().firstName} ${player().lastName}.`);
  return result(true, f.kin ? `${f.name} is your ${d.title}. The family is delighted. The newspapers have noticed the surname.` : `${f.name} is your ${d.title}.`, 'neutral');
}

export function dismiss(deptId) {
  const w = world.polity(player().countryId);
  const d = dept(deptId);
  const f = d ? minister(w, deptId) : null;
  if (!playerHeads(w) || !f) return result(false, 'There is nobody to dismiss.', 'neutral');
  delete w.cabinet[deptId];
  f.post = 'former minister'; f.sacked = true; f.metPlayer = true;
  world.note(f, `Dismissed as ${d.title}.`);
  return result(true, `${f.name} has been dismissed as ${d.title}, and will not forget it.`, 'neutral');
}

// ---------- A bill, from the player's desk to the statute book ----------

const BILLS_PER_YEAR = 2;
function billCount() {
  const k = player().politics;
  if (k.bills?.age !== player().age) k.bills = { age: player().age, n: 0 };
  return k.bills;
}
export const billsLeft = () => (player().politics ? BILLS_PER_YEAR - billCount().n : 0);
export const bill = () => world.polity(player().countryId).bill ?? null;

/** What could be brought in now. */
export function billOptions() {
  const w = world.polity(player().countryId);
  const options = [];
  for (const [id, L] of Object.entries(LEVERS)) {
    for (const dir of [1, -1]) {
      if (Math.abs(w.policies[id] + dir) > 2) continue;
      options.push({ lever: id, dir, name: cap(toDo(L[dir > 0 ? 'up' : 'down'])), sub: `${L.cost * dir > 0 ? 'Costs the treasury.' : 'Brings money in.'} ${L.feel(w.policies[id] + dir) }`, minister: minister(w, deptOf(id)?.id) });
    }
  }
  return options;
}

/** The outside party whose votes would matter most: an unhappy partner first, otherwise the largest party outside the government. */
function asker(w, b, mine) {
  const wants = { wants: { [LEVERS[b.lever].follows]: b.dir } };
  const partners = mine && w.govt.lead === mine.id ? w.govt.partners.map((id) => world.party(w, id)).filter(Boolean) : [];
  const sore = partners.find((x) => lean(x, wants) < 0.5);
  if (sore) return sore;
  return w.parties.filter((x) => x.id !== mine?.id && !partners.includes(x)).sort((a, c) => (w.seats[c.id] ?? 0) - (w.seats[a.id] ?? 0))[0] ?? null;
}

/** Brings in a bill. It goes to committee at once; what comes out may have a price attached. */
export function introduce(lever, dir) {
  const p = player();
  const w = world.polity(p.countryId);
  const L = LEVERS[lever];
  if (!playerHeads(w) || !L) return result(false, 'That is not in your power.', 'neutral');
  if (w.bill) return result(false, 'You already have a bill before the legislature.', 'neutral');
  if (billsLeft() <= 0) return result(false, 'The legislature has no more time for your bills this year.', 'neutral');
  if (Math.abs(w.policies[lever] + dir) > 2) return result(false, 'It cannot be taken any further.', 'neutral');
  if (w.budget - L.cost * dir < -4) return result(false, 'The treasury says there is no money for it. Raise tax or cut something else first.', 'neutral');
  billCount().n += 1;
  const mine = world.membership(w.countryId);
  const b = { lever, dir, stage: 'floor', deals: {}, cost: 0 };
  w.bill = b;
  const m = minister(w, deptOf(lever)?.id);
  const who = m ? `${m.name}, your ${deptOf(lever).title},` : 'With no minister to carry it, a junior official';
  const ask = asker(w, b, mine);
  if (w.kind === 'party' || w.kind === 'none' || p.politics.ruler || !ask || rng.chance(clamp(0.45 + (m ? (skillOf(m) - 50) / 100 : -0.15), 0.1, 0.85))) {
    return result(true, `Your bill: to ${toDo(L[dir > 0 ? 'up' : 'down'])}. ${who} takes it through committee, and it comes out as it went in.`, 'neutral');
  }
  b.stage = 'amend';
  b.ask = ask.id;
  return result(true, `Your bill: to ${toDo(L[dir > 0 ? 'up' : 'down'])}. ${who} takes it into committee, and it comes out with a price on it: ${world.the(ask)} wants money for its own districts written in.`, 'neutral');
}

/** Accepts or refuses the amendment asked for in committee. */
export function concede(yes) {
  const w = world.polity(player().countryId);
  const b = w.bill;
  if (!b || b.stage !== 'amend') return result(false, '', 'neutral');
  const ask = world.party(w, b.ask);
  b.stage = 'floor';
  if (yes) { b.deals[b.ask] = 0.3; b.cost += 0.5; return result(true, `You accept the amendment. ${cap(world.the(ask))} will remember it when the vote comes, and the treasury will remember it longer.`, 'neutral'); }
  b.deals[b.ask] = -0.08;
  return result(true, `You refuse. ${cap(world.the(ask))} leaves the committee room in a temper.`, 'neutral');
}

/** What the player can do before the vote. */
export function voteOptions() {
  const p = player();
  const w = world.polity(p.countryId);
  const mine = world.membership(w.countryId);
  return [
    { id: 'none', name: 'Let it go to the vote', sub: 'Trust the arithmetic.' },
    mine ? { id: 'whip', name: 'Whip your own side hard', sub: 'Fewer rebels. They resent it, and it shows in your standing.' } : null,
    { id: 'deal', name: 'Buy the votes of another party', sub: 'A road here, a hospital wing there. The treasury pays.' },
    { id: 'public', name: 'Appeal to the country over their heads', sub: p.politics.approval >= 50 ? 'You are popular enough for it to count.' : 'You are not popular. It may count against you.' },
    mine && w.kind === 'parliamentary' ? { id: 'confidence', name: 'Make it a matter of confidence', sub: 'Your side falls into line. If you lose all the same, the government falls.' } : null,
  ].filter(Boolean);
}

/** Whether a monarch who governs gives their assent. Only where the crown still holds real power. */
function crownRefuses(w) {
  const d = store.state.dynasties?.[w.countryId];
  const type = d?.type ?? MONARCHIES[w.countryId]?.type;
  if (!type || d?.status === 'abolished' || player().royal?.reigning) return false;
  return ['executive', 'absolute'].includes(type) && rng.chance(w.approval < 40 ? 0.22 : 0.1);
}

/** After a law the player's side did not like: ministers of principle go, and partners may walk. */
function aftermath(w, wants, mine, notes) {
  const k = player().politics;
  for (const d of DEPARTMENTS) {
    const f = minister(w, d.id);
    const pa = f ? world.party(w, f.partyId) : null;
    if (f && pa && lean(pa, wants) <= -1 && f.t.integrity >= 65 && rng.chance(0.35)) {
      delete w.cabinet[d.id]; f.post = 'former minister'; f.sacked = true; f.metPlayer = true;
      world.note(f, `Resigned as ${d.title} on a point of principle.`);
      notes.push(`${f.name} resigns as ${d.title} rather than defend it.`);
      k.approval = Math.round(clamp(k.approval - 2));
      break;
    }
  }
  if (mine && w.govt.lead === mine.id) {
    const out = w.govt.partners.map((id) => world.party(w, id)).find((x) => x && lean(x, wants) <= -1.5);
    const inCabinet = out && DEPARTMENTS.some((d) => minister(w, d.id)?.partyId === out.id);
    if (out && rng.chance(inCabinet ? 0.15 : 0.3)) {
      w.govt.partners = w.govt.partners.filter((id) => id !== out.id);
      w.govt.kind = (w.seats[mine.id] ?? 0) + w.govt.partners.reduce((s, id) => s + (w.seats[id] ?? 0), 0) > w.seatCount / 2 ? (w.govt.partners.length ? 'coalition' : 'majority') : 'minority';
      for (const d of DEPARTMENTS) { const f = minister(w, d.id); if (f?.partyId === out.id) { delete w.cabinet[d.id]; f.post = 'former minister'; } }
      notes.push(`${cap(world.the(out))} has walked out of your coalition over it.`);
    }
  }
}

/** Options that shape a vote: what each move does to the count. */
function voteSetup(w, move, deals) {
  const p = player();
  const mine = world.membership(w.countryId);
  const o = { lead: mine?.id ?? null, partners: mine && w.govt.lead === mine.id ? w.govt.partners : [], deals: { ...deals }, noise };
  let cost = 0;
  if (move === 'whip') o.whip = 0.1;
  else if (move === 'confidence') o.whip = 0.2;
  else if (move === 'public') o.sway = (p.politics.approval - 50) / 150;
  else if (move === 'deal') {
    const other = w.parties.filter((x) => x.id !== o.lead && !o.partners.includes(x.id) && (w.seats[x.id] ?? 0) > 0).sort((a, b) => (w.seats[b.id] ?? 0) - (w.seats[a.id] ?? 0))
      .find((x) => (o.deals[x.id] ?? 0) <= 0) ?? null;
    if (other) { o.deals[other.id] = (o.deals[other.id] ?? 0) + 0.3; cost = 0.5; o.bought = other; }
  }
  return { o, cost, mine };
}

/** The government falls: the player must face the voters at once. */
function fall() {
  const p = player();
  const k = p.politics;
  const w = world.polity(p.countryId);
  k.fallen = true;
  report(w, 'fell', { office: k.title });
  if (k.viaParty) w.calendar.general = store.state.year + 1; // an early general election
  else k.termLeft = 0;
}

/** Puts the bill to the vote. @returns {{ok, text, tone, tally}} */
export function putToVote(move = 'none') {
  const p = player();
  const k = p.politics;
  const w = world.polity(p.countryId);
  const b = w.bill;
  if (!b || b.stage !== 'floor' || !playerHeads(w)) return result(false, 'There is no bill to vote on.', 'neutral');
  const L = LEVERS[b.lever];
  const wants = { wants: { [L.follows]: b.dir } };
  const doing = toDo(L[b.dir > 0 ? 'up' : 'down']);
  delete w.bill;
  const notes = [];
  let t = null;
  let passed = true;
  if (w.kind !== 'party' && w.kind !== 'none' && !k.ruler && w.parties.length) {
    const { o, cost, mine } = voteSetup(w, move, b.deals);
    const m = minister(w, deptOf(b.lever)?.id);
    o.skill = m ? (skillOf(m) - 50) / 400 : -0.04;
    t = tally(w.parties, w.seats, wants, o);
    passed = t.passes;
    b.cost += cost;
    if (o.bought) notes.push(`${cap(world.the(o.bought))} has been promised a good deal.`);
    if (move === 'whip' || move === 'confidence') k.approval = Math.round(clamp(k.approval - 2));
    if (move === 'public') k.approval = Math.round(clamp(k.approval + (passed ? 1 : -4)));
    if (mine && t.rebels > 0 && lean(mine, wants) < 0) notes.push(`${t.rebels} of your own side voted against you.`);
  }
  const shown = t ? { for: t.for, against: t.against, need: t.need, rows: rows(w, t) } : null;
  w.budget = Math.round((w.budget - b.cost) * 10) / 10; // what was promised is paid for either way
  if (!passed) {
    report(w, 'lawLost', { what: doing, votes: `${t.for} votes to ${t.against}` });
    k.approval = Math.round(clamp(k.approval - 3));
    let text = `Your bill to ${doing} is defeated, ${t.for} votes to ${t.against}. ${notes.join(' ')}`.trim();
    if (move === 'confidence') { fall(); text += ' You made it a matter of confidence, and lost. The government has fallen, and you must face the voters.'; }
    return result(false, text, 'bad', { tally: shown });
  }
  if (crownRefuses(w)) {
    k.approval = Math.round(clamp(k.approval - 2));
    return result(false, `Your bill to ${doing} passes${t ? `, ${t.for} votes to ${t.against}` : ''}, and then the palace declines to give its assent. Here, that is the end of it.`, 'bad', { tally: shown });
  }
  const law = world.enact(w, b.lever, b.dir, `${p.firstName} ${p.lastName}`);
  if (!law) return result(false, 'It cannot be taken any further.', 'neutral');
  if (t) law.vote = [t.for, t.against];
  report(w, 'law', { what: doing, votes: t ? `${t.for} votes to ${t.against}` : 'by decree' });
  k.approval = Math.round(clamp(k.approval + (b.lever === 'tax' ? -b.dir : b.dir) * 3));
  aftermath(w, wants, world.membership(w.countryId), notes);
  return result(true, `${t ? `By ${t.for} votes to ${t.against}, your` : 'Your'} government has ${law.text}. ${L.feel(w.policies[b.lever])} ${notes.join(' ')}`.trim(), 'good', { tally: shown, law });
}

// ---------- Social law ----------
// Marriage, the death penalty, conscription, what may be bought and at what age: the rules in engine/rules.js.
// These cost the treasury nothing, so there is no committee stage: they are won or lost on the floor.

/** The changes of law the head of government could put to the legislature now. */
export function reformOptions() {
  const w = world.polity(player().countryId);
  return law.choices(w.countryId).map((c) => {
    const mine = world.membership(w.countryId);
    const t = w.kind !== 'party' && w.kind !== 'none' && !player().politics?.ruler && w.parties.length
      ? tally(w.parties, w.seats, { wants: c.wants }, { lead: mine?.id ?? null, partners: mine && w.govt.lead === mine.id ? w.govt.partners : [], noise: () => 0 }) : null;
    return { ...c, name: cap(c.name), outlook: !t ? 'Yours to decree.' : t.for >= t.need + 8 ? 'The votes look to be there.' : t.for >= t.need - 8 ? 'It would be close.' : 'The legislature is against it.',
      public: c.liked >= 2 ? 'Popular.' : c.liked <= -3 ? 'Deeply unpopular.' : c.liked < 0 ? 'Unpopular.' : 'The public is split.' };
  });
}

/** Puts a change of law to the vote. Counts as one of the year's bills. */
export function putReform(ruleId, value, move = 'none') {
  const p = player();
  const k = p.politics;
  const w = world.polity(p.countryId);
  const c = law.choices(w.countryId).find((x) => x.rule === ruleId && x.value === value);
  if (!playerHeads(w) || !c) return result(false, 'That is not in your power.', 'neutral');
  if (billsLeft() <= 0) return result(false, 'The legislature has no more time for your bills this year.', 'neutral');
  billCount().n += 1;
  const wants = { wants: c.wants };
  const notes = [];
  let t = null;
  let passed = true;
  if (w.kind !== 'party' && w.kind !== 'none' && !k.ruler && w.parties.length) {
    const { o, cost, mine } = voteSetup(w, move, {});
    t = tally(w.parties, w.seats, wants, o);
    passed = t.passes;
    w.budget = Math.round((w.budget - cost) * 10) / 10;
    if (o.bought) notes.push(`${cap(world.the(o.bought))} has been promised a good deal.`);
    if (move === 'whip' || move === 'confidence') k.approval = Math.round(clamp(k.approval - 2));
    if (move === 'public') k.approval = Math.round(clamp(k.approval + (passed ? 1 : -4)));
    if (mine && t.rebels > 0 && lean(mine, wants) < 0) notes.push(`${t.rebels} of your own side voted against you.`);
  }
  const shown = t ? { for: t.for, against: t.against, need: t.need, rows: rows(w, t) } : null;
  if (!passed) {
    report(w, 'lawLost', { what: c.name, votes: `${t.for} votes to ${t.against}` });
    k.approval = Math.round(clamp(k.approval - 3));
    let text = `Your bill to ${c.name} is defeated, ${t.for} votes to ${t.against}. ${notes.join(' ')}`.trim();
    if (move === 'confidence') { fall(); text += ' You made it a matter of confidence, and lost. The government has fallen, and you must face the voters.'; }
    return result(false, text, 'bad', { tally: shown });
  }
  if (crownRefuses(w)) {
    k.approval = Math.round(clamp(k.approval - 2));
    return result(false, `Your bill to ${c.name} passes${t ? `, ${t.for} votes to ${t.against}` : ''}, and then the palace declines to give its assent. Here, that is the end of it.`, 'bad', { tally: shown });
  }
  const e = law.enact(w.countryId, c.rule, c.value, `${p.firstName} ${p.lastName}`);
  const entry = { year: store.state.year, rule: c.rule, by: `${p.firstName} ${p.lastName}`, text: `changed the law to ${c.name}` };
  if (t) entry.vote = [t.for, t.against];
  w.laws.push(entry);
  if (w.laws.length > 60) w.laws.shift();
  post(w.countryId, 'law', e.text, 'neutral', false);
  report(w, 'law', { what: c.name, votes: t ? `${t.for} votes to ${t.against}` : 'by decree' });
  k.approval = Math.round(clamp(k.approval + c.liked));
  w.approval = clamp(w.approval + c.liked);
  aftermath(w, wants, world.membership(w.countryId), notes);
  const felt = c.liked >= 2 ? 'The country is pleased.' : c.liked <= -3 ? 'The country is angry.' : c.liked < 0 ? 'Much of the country does not like it.' : '';
  return result(true, `${t ? `By ${t.for} votes to ${t.against}, it` : 'By your decree, it'} is the law: ${e.text} ${felt} ${notes.join(' ')}`.replace(/\s+/g, ' ').trim(), 'good', { tally: shown });
}

// ---------- The budget ----------

/** The public finances department by department, for the budget screen. */
export function budgetView() {
  const p = player();
  const w = world.polity(p.countryId);
  const mine = world.membership(w.countryId);
  return { balance: w.budget, debt: w.debt ?? 0, presented: p.politics?.budgetAge === p.age,
    // A parliamentary leader without a majority of their own does not survive losing a budget.
    fragile: w.kind === 'parliamentary' && !p.politics?.ruler && (mine ? (w.seats[mine.id] ?? 0) : 0) <= w.seatCount / 2,
    rows: Object.entries(LEVERS).map(([id, L]) => { const d = deptOf(id); return { lever: id, name: cap(L.name), dept: d?.title ?? '', minister: d ? minister(w, d.id) : null, at: w.policies[id], cost: L.cost,
      canRaise: w.policies[id] < 2, canCut: w.policies[id] > -2, up: cap(toDo(L.up)), down: cap(toDo(L.down)) }; }) };
}
/** What a set of changes would do to the balance. */
export const balanceAfter = (changes) => { const w = world.polity(player().countryId); return Math.round((w.budget - Object.entries(changes).reduce((s, [id, dir]) => s + LEVERS[id].cost * dir, 0)) * 10) / 10; };

/**
 * Presents the year's budget: every change at once, in a single vote.
 * @param {Object<string,number>} changes  lever → +1 or -1
 * @param {string} [move]  as for a bill
 */
export function presentBudget(changes, move = 'none') {
  const p = player();
  const k = p.politics;
  const w = world.polity(p.countryId);
  if (!playerHeads(w)) return result(false, 'That is not in your power.', 'neutral');
  if (k.budgetAge === p.age) return result(false, 'This year\'s budget has already been presented.', 'neutral');
  const list = Object.entries(changes).filter(([id, dir]) => LEVERS[id] && (dir === 1 || dir === -1) && Math.abs(w.policies[id] + dir) <= 2);
  const treasurer = minister(w, 'treasury');
  const after = balanceAfter(Object.fromEntries(list));
  if (after < -5) return result(false, `${treasurer ? `${treasurer.name}, your ${dept('treasury').title},` : 'The treasury'} will not put a name to it: the deficit would be more than the country can borrow.`, 'neutral');
  k.budgetAge = p.age;
  if (!list.length) return result(true, 'A budget that changes nothing. It passes on the nod, and nobody remembers it by the weekend.', 'neutral');
  const wants = {};
  for (const [id, dir] of list) wants[LEVERS[id].follows] = (wants[LEVERS[id].follows] ?? 0) + dir;
  for (const i of Object.keys(wants)) { wants[i] = Math.sign(wants[i]); if (!wants[i]) delete wants[i]; }
  const notes = [];
  let t = null;
  let passed = true;
  if (w.kind !== 'party' && w.kind !== 'none' && !k.ruler && w.parties.length) {
    const { o, cost, mine } = voteSetup(w, move, {});
    o.skill = treasurer ? (skillOf(treasurer) - 50) / 300 : -0.06;
    t = tally(w.parties, w.seats, { wants }, o);
    passed = t.passes;
    w.budget = Math.round((w.budget - cost) * 10) / 10;
    if (o.bought) notes.push(`${cap(world.the(o.bought))} has been promised a good deal.`);
    if (move === 'whip' || move === 'confidence') k.approval = Math.round(clamp(k.approval - 2));
    if (move === 'public') k.approval = Math.round(clamp(k.approval + (passed ? 1 : -4)));
    if (!passed) {
      k.approval = Math.round(clamp(k.approval - 5));
      report(w, 'budgetLost', { votes: `${t.for} votes to ${t.against}` });
      const lost = `Your budget is defeated, ${t.for} votes to ${t.against}.`;
      const own = mine ? (w.seats[mine.id] ?? 0) : 0;
      if (w.kind === 'parliamentary' && (move === 'confidence' || own <= w.seatCount / 2)) { fall(); return result(false, `${lost} A government that cannot pass its budget cannot govern: yours has fallen, and you must face the voters.`, 'bad', { tally: { for: t.for, against: t.against, need: t.need, rows: rows(w, t) } }); }
      w.approval = clamp(w.approval - 5);
      return result(false, `${lost} Last year's figures roll over, offices close for a fortnight, and everybody blames you.`, 'bad', { tally: { for: t.for, against: t.against, need: t.need, rows: rows(w, t) } });
    }
  }
  if (t) report(w, 'budget', { votes: `${t.for} votes to ${t.against}` });
  let liked = 0;
  const done = [];
  for (const [id, dir] of list) {
    const law = world.enact(w, id, dir, `${p.firstName} ${p.lastName}`);
    if (!law) continue;
    law.budget = true;
    if (t) law.vote = [t.for, t.against];
    liked += id === 'tax' ? -dir : dir;
    done.push(law.text);
  }
  k.approval = Math.round(clamp(k.approval + liked * 2));
  aftermath(w, { wants }, world.membership(w.countryId), notes);
  return result(true, `${t ? `Your budget passes, ${t.for} votes to ${t.against}.` : 'Your budget is adopted.'} You have ${done.join('; ')}. The public finances are now ${w.budget <= -3 ? 'deep in deficit' : w.budget < 0 ? 'in deficit' : w.budget === 0 ? 'in balance' : 'in surplus'}. ${notes.join(' ')}`.trim(),
    'good', { tally: t ? { for: t.for, against: t.against, need: t.need, rows: rows(w, t) } : null });
}

/**
 * The crown refuses its assent to the latest law, and the government gives
 * way: the law is undone. Used when the player is the monarch.
 * @returns {string} what was undone, or '' if there was nothing recent to refuse
 */
export function refuseAssent() {
  const w = world.polity(player().countryId);
  const law = [...w.laws].reverse().find((l) => store.state.year - l.year <= 1 && !l.refused && LEVERS[l.lever]);
  if (!law) return '';
  w.policies[law.lever] = clamp(w.policies[law.lever] - law.dir, -2, 2);
  w.budget = Math.round((w.budget + LEVERS[law.lever].cost * law.dir) * 10) / 10;
  law.refused = true;
  w.laws.push({ year: store.state.year, lever: law.lever, dir: -law.dir, by: 'the crown', over: true, text: `refused assent, and the government withdrew its plan to ${toDo(law.text)}` });
  return `The plan to ${toDo(law.text)} is withdrawn.`;
}

/** The most recent law, as something that was done: for scenes in which a monarch is asked to sign it. */
export function latestLaw(countryId = player().countryId) {
  const w = store.state.polities?.[countryId];
  const law = w ? [...w.laws].reverse().find((l) => store.state.year - l.year <= 1 && !l.refused && LEVERS[l.lever]) : null;
  return law ? toDo(law.text) : null;
}
