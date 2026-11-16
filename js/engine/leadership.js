// Leading a party. In a parliamentary country the head of government is not
// elected to the job: they lead the party that can command the legislature.
// So the road to the top runs through the party: win a seat, win the
// leadership from whoever holds it, and then win a general election.
//
//   p.flags.party.leader    true while the player leads their party
//   p.flags.party.triedAt   the year of their last challenge
//   p.politics.viaParty     the top office is held as party leader: general elections decide it
import { rng } from '../rng.js';
import { clamp, theCountry } from '../util.js';
import { store, player, country, log, milestone } from '../state.js';
import * as world from './polity.js';
import { system, offices, takeOffice, leave } from './politics.js';
import { report } from './news.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', more = {}) => ({ ok, text, tone, ...more });
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/** The party the player leads here, or null. */
export function leads(countryId = player().countryId) {
  const p = player();
  const pa = world.membership(countryId);
  if (!pa || !p.flags.party?.leader) return null;
  const f = world.playerFigure(countryId, false);
  return f && pa.leaderId === f.id ? pa : null;
}

/** Why the player cannot challenge for the leadership now, or ''. `open`: the leadership has just changed hands, and the usual wait does not apply. */
export function barrier(open = false) {
  const p = player();
  const c = country();
  const year = store.state.year;
  const pa = world.membership(c.id);
  if (system(c).kind !== 'parliamentary') return 'Parties here choose a candidate for each election, not a leader to follow.';
  if (!pa) return 'You belong to no party.';
  if (leads(c.id)) return 'You lead the party.';
  if (p.legal.incarceration) return 'Not from a cell.';
  if (p.politics?.officeId !== 'seat') return `Only a sitting ${system(c).seat} can lead the party. Win a seat first.`;
  if (year - (p.flags.party.since ?? year) < 3) return 'You have not been in the party long enough for anyone to follow you.';
  if (!open && p.flags.party.triedAt != null && year - p.flags.party.triedAt < 3) return 'You tried too recently. The party needs time to forget.';
  return '';
}

/** How strong the sitting leader is: charm, and whether they are winning. */
function leaderStrength(w, pa, f) {
  const inGovt = pa.id === w.govt.lead;
  const last = w.elections[w.elections.length - 1]?.shares[pa.id] ?? 25;
  const before = w.elections[w.elections.length - 2]?.shares[pa.id] ?? last;
  return 15 + ((f?.t.charisma ?? 50) - 50) / 4 + (inGovt ? 8 + (w.approval - 50) / 3 : 0) + clamp((last - before) / 2, -8, 8);
}

/** Who would be challenged, and how it looks. */
export function contestInfo() {
  const c = country();
  const w = world.polity(c.id);
  const pa = world.membership(c.id);
  if (!pa) return null;
  const f = w.figures[pa.leaderId];
  const s = leaderStrength(w, pa, f);
  return { party: pa, leader: f, electors: Math.max(15, w.seats[pa.id] ?? 0), inGovt: pa.id === w.govt.lead,
    mood: s >= 24 ? 'The leader is riding high. This would be a long shot.' : s >= 15 ? 'The leader is secure, but not loved.' : 'The leader is weak, and everyone knows it.' };
}

export const APPROACHES = [
  { id: 'colleagues', name: 'Win over your colleagues, one by one', sub: 'Lunches, promises, and a good memory for names. Charm counts.' },
  { id: 'vision', name: 'Make the speech of your life', sub: 'Tell them where the party should go. A sharp mind counts.' },
  { id: 'knives', name: 'Brief against the leader', sub: 'Works best on a leader who is already wounded. If it fails, you are finished for years.' },
];

/** The player becomes leader of their party; if it governs, they govern. */
function becomeLeader(w, pa, quiet = false) {
  const p = player();
  const c = country();
  const f = world.playerFigure(c.id);
  const old = w.figures[pa.leaderId];
  if (old && old.id !== f.id) { old.post = w.govt.headId === old.id ? 'former head' : 'former leader'; world.note(old, `Lost the leadership of ${world.the(pa)} to ${f.name}.`); old.metPlayer = true; }
  pa.leaderId = f.id;
  f.partyId = pa.id;
  f.post = 'leader';
  p.flags.party.leader = true;
  world.note(f, `Became leader of ${world.the(pa)}.`);
  if (!quiet) milestone(`Became leader of ${world.the(pa)}.`, 'career');
  if (w.govt.lead === pa.id && (!old || w.govt.headId === old.id || w.govt.headId === f.id) && p.politics?.officeId !== 'head') {
    w.govt.headId = f.id;
    takeOffice(offices(c).find((o) => o.id === 'head'), 52);
    return true;
  }
  return false;
}

/** Challenges the sitting leader. The party's members of the legislature vote. */
export function challenge(approach, open = false) {
  const p = player();
  const c = country();
  const why = barrier(open);
  if (why) return result(false, why, 'neutral');
  const w = world.polity(c.id);
  const pa = world.membership(c.id);
  const old = w.figures[pa.leaderId];
  const year = store.state.year;
  p.flags.party.triedAt = year;
  let mine = (p.counters.polExp ?? 0) / 4 + (p.politics.approval - 50) / 6 + Math.min(4, (year - p.flags.party.since) / 4) + (p.hidden.fame ?? 0) / 20;
  // Someone who took over this year has had no time to make the job their own.
  const theirs = leaderStrength(w, pa, old) - (open ? 9 : 0);
  if (approach === 'vision') mine += (p.stats.intellect - 50) / 4 + rng.int(-3, 5);
  else if (approach === 'knives') { mine += (19 - theirs) * 0.8 + rng.int(-4, 6); p.hidden.karma = clamp(p.hidden.karma - 6); } else mine += (p.stats.charm - 50) / 4 + rng.int(-2, 4);
  const electors = Math.max(15, w.seats[pa.id] ?? 0);
  const part = 1 / (1 + Math.exp(-(mine - theirs + rng.int(-8, 8)) / 9));
  let votes = Math.round(electors * part);
  if (votes * 2 === electors) votes += rng.chance(0.5) ? 1 : -1;
  const tally = `${votes} votes to ${electors - votes}`;
  p.counters.polExp = (p.counters.polExp ?? 0) + 1;
  if (votes * 2 > electors) {
    const governs = becomeLeader(w, pa);
    report(w, 'leader', { party: world.the(pa), votes: tally });
    const text = `${cap(world.the(pa))} has a new leader: you, by ${tally}. ${old ? `${old.name} congratulates you through gritted teeth.` : ''}${governs ? ` And since the party governs, you are ${system(c).head} of ${theCountry(c.name)}.` : ' Now there is a general election to win.'}`;
    log(text, 'system', 'good');
    return result(true, text);
  }
  report(w, 'leaderLost', { party: world.the(pa), votes: `${electors - votes} votes to ${votes}` });
  let text = `You challenge ${old?.name ?? 'the leader'} for the leadership of ${world.the(pa)}, and lose, ${tally}.`;
  if (approach === 'knives') { p.politics.approval = Math.round(clamp(p.politics.approval - 10)); p.flags.party.triedAt = year + 3; text += ' Everyone knows who was doing the briefing. It will be a long time before you are trusted again.'; }
  p.stats.mood = clamp(p.stats.mood - 8);
  log(text, 'system', 'bad');
  return result(false, text);
}

/** Gives up the leadership, and with it the top office if it was held as leader. */
export function resignLeadership(why = 'stepped down') {
  const p = player();
  const c = country();
  const pa = leads(c.id);
  if (!pa) return result(false, 'You lead no party.', 'neutral');
  const w = world.polity(c.id);
  world.release(w, why);
  delete p.flags.party.leader;
  if (p.politics?.viaParty) leave(why);
  const text = `You have stepped down as leader of ${world.the(pa)}. ${w.figures[pa.leaderId]?.name ?? 'Somebody else'} takes over.`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}

/**
 * Brings the player's office into line with the legislature. Called after
 * every general election, and yearly: a party leader governs if, and only
 * if, their party leads the government.
 */
export function afterGeneral() {
  const p = player();
  const c = country();
  const w = world.polity(c.id);
  if (w.kind !== 'parliamentary') return;
  const k = p.politics;
  // Saves from before leadership existed: a prime minister with a party is its leader.
  if (k?.officeId === 'head' && !k.ruler && !k.viaParty && world.membership(c.id) && !leads(c.id)) {
    const pa = world.membership(c.id);
    const f = world.playerFigure(c.id);
    pa.leaderId = f.id; f.partyId = pa.id; p.flags.party.leader = true; k.viaParty = true;
  }
  const pa = leads(c.id);
  if (!pa) {
    // The leadership of the player's party has just changed hands: a sitting member may put their name forward.
    const mine = world.membership(c.id);
    if (mine && mine.vacancy === store.state.year && p.flags.party.askedVacancy !== store.state.year && !barrier(true)) {
      p.flags.party.askedVacancy = store.state.year;
      store.state.pendingEvents.push({ id: 'pol_leadership_open', cast: { words: { party: world.the(mine), leader: w.figures[mine.leaderId]?.name ?? 'the deputy' } } });
    }
    return;
  }
  const f = world.playerFigure(c.id);
  f.t.charisma = Math.round(p.stats.charm);
  // A leader who has lost their place in the legislature cannot go on leading.
  if (!p.politics || p.legal.incarceration) { resignLeadership(p.legal.incarceration ? 'sent to prison' : 'lost their seat'); return; }
  const head = offices(c).find((o) => o.id === 'head');
  const seat = offices(c).find((o) => o.id === 'seat');
  if (w.govt.headId === f.id && p.politics.officeId !== 'head') {
    takeOffice(head, 55);
    report(w, 'generalWon', { party: cap(world.the(pa)), office: head.title });
    log(`${cap(world.the(pa))} will form the government, and you lead it. You are ${head.title} of ${theCountry(c.name)}.`, 'system', 'good');
  } else if (w.govt.headId !== f.id && p.politics.officeId === 'head' && p.politics.viaParty) {
    leave('lost the general election');
    takeOffice(seat, 50, true);
    report(w, 'generalLost', { party: cap(world.the(pa)), office: head.title });
    log(`${cap(world.the(pa))} has lost the election. You are no longer ${head.title}; you lead the opposition from your seat in the legislature.`, 'system', 'bad');
  } else if (p.politics.officeId === 'head') p.politics.viaParty = true;
  // A leader who has just lost a general election, in office or out of it, has the party to face.
  const year = store.state.year;
  if (w.elections[w.elections.length - 1]?.year === year && w.govt.headId !== f.id && p.flags.party.faced !== year) {
    p.flags.party.faced = year;
    store.state.pendingEvents.push({ id: 'pol_leader_defeated', cast: { words: { party: world.the(pa) } } });
  }
  if (p.politics?.viaParty) p.politics.termLeft = Math.max(1, w.calendar.general - store.state.year);
}

/** After a lost election: the party decides whether to keep its leader. @returns {string} */
export function faceTheParty() {
  const p = player();
  const c = country();
  const pa = leads(c.id);
  if (!pa) return '';
  const w = world.polity(c.id);
  const last = w.elections[w.elections.length - 1]?.shares[pa.id] ?? 25;
  const before = w.elections[w.elections.length - 2]?.shares[pa.id] ?? last;
  if (rng.chance(clamp(0.55 + (last - before) / 20 + (p.stats.charm - 50) / 200, 0.1, 0.9))) return 'You tell the party you will fight on. There is muttering, but nobody moves against you.';
  resignLeadership('removed by the party after the election defeat');
  return 'You tell the party you will fight on. The party has other ideas: within a month you have been voted out as leader.';
}

/** Stands for a leadership that has just fallen vacant. @returns {string} */
export function standForVacancy() {
  return challenge('colleagues', true).text;
}
