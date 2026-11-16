// Political families: a spouse or grown child who goes into politics, and a
// family name that helps or haunts whoever carries it next.
//
// On a relative (an NPC):
//   npc.flags.pol = { figureId, partyId, office: null | 'council' | 'mayor' | 'seat', since, nextRace, lost, backed }
//     figureId   their entry among the country's politicians (engine/polity.js), which carries their career
//     nextRace   the year of their next election
//     backed     the player has put their name behind them
// On the player:
//   p.flags.familyName = { name, title, best, approval, disgraced }   what the last generation left behind
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, livingNpcs, log } from '../state.js';
import { SYSTEMS } from '../data/politics.js';
import * as world from './polity.js';
import { offices, takeOffice, officeTitle } from './politics.js';
import { addSecret } from './scandal.js';
import { post } from './news.js';

const RUNGS = ['council', 'mayor', 'seat'];
const TIER = { council: 1, mayor: 2, seat: 3 };
const democracy = (cid) => ['presidential', 'parliamentary'].includes(SYSTEMS[cid]?.kind);
const word = (npc) => (npc.role === 'spouse' ? (npc.gender === 'male' ? 'husband' : npc.gender === 'female' ? 'wife' : 'spouse') : npc.gender === 'male' ? 'son' : npc.gender === 'female' ? 'daughter' : 'child');
const their = (npc) => (npc.gender === 'male' ? 'his' : npc.gender === 'female' ? 'her' : 'their');
const full = (npc) => `${npc.firstName} ${npc.lastName}`;
const shiftRel = (npc, n) => { if (npc.meters) npc.meters.relationship = Math.round(clamp(npc.meters.relationship + n)); };
const shiftApproval = (n) => { const k = player().politics; if (k) k.approval = Math.round(clamp(k.approval + n)); };

/** Relatives who are in politics, with their figure. */
export function inPolitics() {
  const w = world.polity(player().countryId);
  return livingNpcs().filter((n) => n.flags?.pol && !n.flags.pol.left).map((npc) => ({ npc, figure: w.figures[npc.flags.pol.figureId] ?? null, party: world.party(w, npc.flags.pol.partyId),
    title: npc.flags.pol.post === 'head' ? world.headTitle(player().countryId) : npc.flags.pol.post === 'leader' ? 'Party leader' : npc.flags.pol.office ? officeTitle(npc.flags.pol.office, country()) : 'Party activist', word: word(npc) }));
}

/** What the family name is worth to a candidate, as points of standing. Good names help; a disgraced one costs. */
export function nameWorth(p = player()) {
  const f = p.flags.familyName;
  let n = 0;
  if (f) n += f.disgraced ? -6 : 2 + f.best * 1.2 + clamp((f.approval - 50) / 10, -3, 3);
  else if (p.flags.politicalFamily) n += 5;
  // Relatives in office today: a name people already know.
  n += Math.min(4, inPolitics().filter((k) => k.npc.flags.pol.office && k.party?.id === world.membership(p.countryId)?.id).length * 2);
  return n;
}
/** The family name in words, for the Politics card. */
export function nameLine(p = player()) {
  const f = p.flags.familyName;
  if (!f) return '';
  return f.disgraced ? `${f.name} left office in disgrace as ${f.title}. People have not forgotten.` : `${f.name} was ${f.title}. The name still opens doors.`;
}

/** Called when a new generation takes over: what the one before leaves to the name. */
export function leaveName(op, heir) {
  const best = Math.max(0, ...(op.flags.offices ?? []).map((o) => o.tier), op.politics?.tier ?? 0);
  const old = op.flags.familyName;
  if (best >= 2) {
    const top = [...(op.flags.offices ?? [])].sort((a, b) => b.tier - a.tier)[0];
    heir.flags.familyName = { name: `${op.firstName} ${op.lastName}`, title: op.politics?.tier === best ? op.politics.title : top?.title ?? 'an office-holder', best,
      approval: op.politics?.approval ?? op.flags.lastApproval ?? 50, disgraced: !!(op.flags.removedFromOffice || op.flags.disgraced) };
  } else if (old) heir.flags.familyName = { ...old, best: Math.max(1, old.best - 1) }; // a name fades a little with each generation that does not use it
}

/**
 * An heir who was already in politics carries on where they were: same
 * party, same office, same entry among the country's politicians.
 * @param {object} h  the heir as they were (an NPC)
 */
export function carryCareer(h) {
  const p = player();
  const k = h.flags?.pol;
  if (!k || k.left || p.countryId !== (k.countryId ?? p.countryId)) return '';
  const w = world.polity(p.countryId);
  const f = w.figures[k.figureId];
  const pa = world.party(w, k.partyId);
  if (pa) p.flags.party = { countryId: p.countryId, partyId: pa.id, since: k.since };
  if (f) { for (const x of Object.values(w.figures)) if (x.isPlayer) x.isPlayer = false; f.isPlayer = true; delete f.kin; }
  p.counters.polExp = Math.max(p.counters.polExp ?? 0, 4 + (store.state.year - k.since));
  const o = k.office ? offices(country()).find((x) => x.id === k.office) : null;
  if (!o) return pa ? `You are already a member of ${world.the(pa)}.` : '';
  takeOffice(o, 55, true);
  return `You are already ${o.title}${pa ? `, for ${world.the(pa)}` : ''}, and carry on.`;
}

function enter(npc, backed, rebel = false) {
  const p = player();
  const w = world.polity(p.countryId);
  const mine = world.membership(p.countryId);
  const others = w.parties.filter((x) => x.id !== mine?.id);
  const pa = !rebel && mine ? mine : rng.pick(others.length ? others : w.parties);
  const f = world.newFigure(w, pa.id, npc.age);
  f.name = full(npc); f.gender = npc.gender; f.born = store.state.year - npc.age; f.kin = npc.id; f.metPlayer = true; f.post = 'local';
  if (npc.appearance) f.look = npc.appearance;
  world.note(f, `Joined ${world.the(pa)}.`);
  npc.flags.pol = { figureId: f.id, partyId: pa.id, countryId: p.countryId, office: null, since: store.state.year, nextRace: store.state.year + rng.int(1, 3), lost: 0, backed: !!backed };
  return pa;
}

/** A relative fights an election for the next rung. @returns {boolean} whether they won */
function race(npc, help = 0) {
  const p = player();
  const k = npc.flags.pol;
  const w = world.polity(p.countryId);
  const f = w.figures[k.figureId];
  const next = RUNGS[k.office ? Math.min(RUNGS.length - 1, RUNGS.indexOf(k.office) + 1) : 0];
  const defending = next === k.office;
  const best = Math.max(0, ...(p.flags.offices ?? []).map((o) => o.tier), p.politics?.tier ?? 0);
  const standing = p.politics ? (p.politics.approval - 50) / 200 : ((p.flags.lastApproval ?? 50) - 50) / 300;
  const chance = clamp((defending ? 0.58 : 0.36 - TIER[next] * 0.06) + best * 0.03 + standing + (k.backed ? 0.06 : 0) + help + ((f?.t.charisma ?? 50) - 50) / 250 - (p.flags.disgraced || p.flags.removedFromOffice ? 0.15 : 0), 0.08, 0.9);
  const title = officeTitle(next, country());
  k.nextRace = store.state.year + 4;
  if (rng.chance(chance)) {
    k.office = next; k.lost = 0;
    npc.occupation = title;
    if (f) world.note(f, defending ? `Re-elected ${title}.` : `Elected ${title}.`);
    if (!defending) { post(w, `${full(npc)}, ${word(npc)} of ${p.firstName} ${p.lastName}, has been elected ${title}.`); log(`Your ${word(npc)} ${npc.firstName} has been elected ${title}.`, 'system', 'good'); p.stats.mood = clamp(p.stats.mood + 5); }
    return true;
  }
  k.lost += 1;
  if (f) world.note(f, `Lost an election for ${title}.`);
  if (defending) { k.office = RUNGS[RUNGS.indexOf(k.office) - 1] ?? null; npc.occupation = k.office ? officeTitle(k.office, country()) : npc.occupation; }
  log(`Your ${word(npc)} ${npc.firstName} stood for ${title} and lost.`, 'system', 'bad');
  if (k.lost >= 2 && rng.chance(0.6)) { k.left = true; if (f) { world.note(f, 'Left politics.'); f.retired = true; } log(`${npc.firstName} has had enough of politics, and says so.`, 'system', 'neutral'); }
  return false;
}

/** Yearly: relatives think about politics, fight their elections, and now and then get into trouble. */
export function tickKin() {
  const p = player();
  const c = country();
  if (!democracy(c.id)) return;
  const w = world.polity(c.id);
  const year = store.state.year;
  const pend = store.state.pendingEvents;
  const best = Math.max(0, ...(p.flags.offices ?? []).map((o) => o.tier), p.politics?.tier ?? 0);
  let asked = false;
  for (const npc of livingNpcs()) {
    if (!['spouse', 'child'].includes(npc.role) || npc.flags?.royal || typeof npc.flags?.abroad === 'string') continue;
    const k = npc.flags?.pol;
    if (!k) {
      // The children of politicians grow up in it. Some want nothing to do with it; some want nothing else.
      if (asked || npc.flags.polAsked || npc.age < 25 || npc.age > 60) continue;
      if (rng.chance(0.004 + (best >= 2 ? 0.01 : 0) + (best >= 4 ? 0.01 : 0) + (world.membership(c.id) ? 0.006 : 0))) {
        npc.flags.polAsked = true; asked = true;
        pend.push({ id: 'kin_wants_politics', cast: { kin: npc.id, words: { rel: word(npc), their: their(npc), cost: fmtMoney(localMoney(10000, c), c) } } });
      }
      continue;
    }
    if (k.left) continue;
    // A link to the country's politicians can be lost when a generation changes; mend it or let it go.
    let f = w.figures[k.figureId];
    if (!f || f.died != null) { k.left = true; continue; }
    f.kin = npc.id; f.name = full(npc);
    if (k.office && rng.chance(0.02 + (55 - f.t.integrity) / 900)) {
      pend.push({ id: 'kin_scandal', cast: { kin: npc.id, words: { rel: word(npc), their: their(npc), title: officeTitle(k.office, c) } } });
      continue;
    }
    // Someone in the legislature for long enough may be chosen to lead their party, like anyone else there.
    const pa = world.party(w, k.partyId);
    if (k.office === 'seat' && pa && !k.post && !w.figures[pa.leaderId]?.isPlayer && pa.vacancy === year && rng.chance(clamp(0.06 + (f.t.charisma - 50) / 400, 0.01, 0.2))) {
      const governs = world.makeLeader(w, pa, f);
      k.post = governs ? 'head' : 'leader';
      npc.occupation = governs ? world.headTitle(c.id) : `Leader of ${world.the(pa)}`;
      const text = governs ? `Your ${word(npc)} ${npc.firstName} has been chosen to lead ${world.the(pa)}, and with it the country: ${npc.firstName} is ${world.headTitle(c.id)}.` : `Your ${word(npc)} ${npc.firstName} has been chosen to lead ${world.the(pa)}.`;
      post(w, `${full(npc)} is the new leader of ${world.the(pa)}.`); log(text, 'system', 'good'); p.stats.mood = clamp(p.stats.mood + 8);
    }
    if (k.post) {
      // The post follows the figure: lost when the party drops them, gained when the party wins.
      const leads = pa?.leaderId === f.id;
      const now = !leads ? null : w.govt.headId === f.id ? 'head' : 'leader';
      if (now !== k.post) { k.post = now; npc.occupation = now === 'head' ? world.headTitle(c.id) : now === 'leader' ? `Leader of ${world.the(pa)}` : officeTitle('seat', c); if (now === 'head') log(`Your ${word(npc)} ${npc.firstName} is ${world.headTitle(c.id)}.`, 'system', 'good'); }
      if (now) continue; // a leader's fate is decided by general elections, not a race of their own
    }
    if (year >= k.nextRace) {
      if (k.askedRace !== year && rng.chance(0.7)) { k.askedRace = year; pend.push({ id: 'kin_campaign', cast: { kin: npc.id, words: { rel: word(npc), their: their(npc), title: officeTitle(RUNGS[k.office ? Math.min(2, RUNGS.indexOf(k.office) + 1) : 0], c), cost: fmtMoney(localMoney(20000, c), c) } } }); } else race(npc);
    }
  }
  // Married to power: now and then the spouse of a national figure is asked to speak for themselves.
  const spouse = livingNpcs().find((n) => n.role === 'spouse');
  if (spouse && (p.politics?.tier ?? 0) >= 4 && !spouse.flags?.pol && rng.chance(0.12)) pend.push({ id: 'spouse_public', cast: { kin: spouse.id, words: { rel: word(spouse), their: their(spouse) } } });
}

/** What the player chose in a family scene. @returns {string} */
export function decide(what, cast = {}) {
  const p = player();
  const c = country();
  const npc = store.state.npcs[cast.kin];
  if (!npc) return '';
  const w = world.polity(c.id);
  if (what === 'back' || what === 'neutral' || what === 'discourage') {
    if (what === 'discourage' && rng.chance(0.5)) { shiftRel(npc, -4); return `${npc.firstName} listens, and thinks about it, and lets the idea go. You are never sure you were right.`; }
    const cost = localMoney(10000, c);
    if (what === 'back') { if (p.finance.cash < cost) return 'You would like to, but you do not have the money.'; p.finance.cash -= cost; shiftRel(npc, 8); }
    if (what === 'discourage') shiftRel(npc, -10);
    // Not every child follows the family line.
    const rebel = what !== 'back' && !!world.membership(c.id) && rng.chance(what === 'discourage' ? 0.4 : 0.15);
    const pa = enter(npc, what === 'back', rebel);
    const text = rebel ? `${npc.firstName} goes ahead, and joins ${world.the(pa)}: the other side. Family dinners will be livelier.` : `${npc.firstName} joins ${world.the(pa)} and starts at the bottom, delivering leaflets in the rain.`;
    log(`Your ${word(npc)} ${npc.firstName} has gone into politics, with ${world.the(pa)}.`, 'system', 'neutral');
    return what === 'discourage' ? `You say your piece. ${text}` : text;
  }
  const k = npc.flags.pol;
  if (!k) return '';
  if (what === 'campaign' || what === 'money' || what === 'stayOut') {
    let help = 0;
    let text = '';
    if (what === 'campaign') {
      // A popular name on the platform helps. An unpopular one does not.
      const pull = p.politics ? (p.politics.approval - 45) / 150 : (p.hidden.fame ?? 0) / 600;
      help = clamp(0.06 + pull, -0.1, 0.2); k.backed = true; shiftRel(npc, 6);
      text = help >= 0.06 ? 'You share a platform, and the crowd is glad to see you both.' : 'You share a platform. It is not clear, afterwards, that you helped.';
    } else if (what === 'money') {
      const cost = localMoney(20000, c);
      if (p.finance.cash < cost) text = 'You would like to, but you do not have the money.';
      else { p.finance.cash -= cost; help = 0.08; shiftRel(npc, 4); text = 'You pay for the leaflets and stay out of the photographs.'; }
    } else { shiftRel(npc, -3); text = `You tell ${npc.firstName} that this one is ${their(npc)} own to win.`; }
    const won = race(npc, help);
    return `${text} ${won ? `${npc.firstName} wins.` : `${npc.firstName} loses.`}`;
  }
  if (what === 'standBy' || what === 'distance') {
    const f = w.figures[k.figureId];
    const title = officeTitle(k.office, c);
    if (what === 'standBy') {
      shiftRel(npc, 10); shiftApproval(-5);
      if (rng.chance(0.5)) { if (f) world.note(f, 'Survived a scandal.'); return `You stand beside ${npc.firstName} in front of the cameras. It costs you something, and ${npc.firstName} keeps the job.`; }
    } else shiftRel(npc, -20);
    if (f) world.note(f, `Resigned as ${title} over a scandal.`);
    k.office = RUNGS[RUNGS.indexOf(k.office) - 1] ?? null; k.lost += 1; k.nextRace = store.state.year + 4;
    npc.occupation = k.office ? officeTitle(k.office, c) : 'Former politician';
    return what === 'standBy' ? `You stand beside ${npc.firstName} in front of the cameras. It is not enough: ${npc.firstName} resigns as ${title} within the week, and some of the mud stays on you.`
      : `You tell the press it is a matter for ${npc.firstName} alone. ${npc.firstName} resigns as ${title}, and does not ring you for a long time.`;
  }
  if (what === 'speak' || what === 'hide') {
    if (what === 'hide') { shiftRel(npc, -6); return `${npc.firstName} stays at home, and makes it clear whose idea that was.`; }
    if (rng.chance(clamp(0.35 + (npc.meters?.charm ?? 50) / 200, 0.2, 0.85))) { shiftApproval(4); shiftRel(npc, 4); return `${npc.firstName} is funny, warm and unscripted, and is on every front page the next day for the right reasons.`; }
    shiftApproval(-4);
    return `${npc.firstName} says what ${npc.firstName} really thinks about your colleagues. It is on every front page the next day.`;
  }
  return '';
}

/** Relatives who could be given a ministry: in the legislature, in the player's party. */
export function forCabinet() {
  const mine = world.membership(player().countryId);
  return inPolitics().filter((k) => k.figure && k.npc.flags.pol.office === 'seat' && k.party?.id === mine?.id);
}
/** A ministry for a relative: gratitude at home, and something for the newspapers to find. */
export function nepotism(figure) {
  const npc = store.state.npcs[figure.kin];
  if (!npc) return;
  shiftRel(npc, 15); shiftApproval(-3);
  addSecret('nepotism', rng.int(45, 70));
}
