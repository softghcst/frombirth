// Stories of a life across borders. Each arc begins only from something that
// is really so in the save: a career employers abroad want, a husband or wife
// living in another country, aging parents in the country left behind, a
// child settled abroad when retirement comes. The scene names real people and
// places; each choice goes back to the engines that do the work (relocation,
// travel, immigration), so a "yes" is an application or a plan, never an
// approval, a citizenship or a person the save does not have.
//
//   p.flags.arcs   { [arc]: { year, dest?, npc? } }   when each arc last began, and about what
//
// Scenes are in data/events/abroadArcs.js; they are sent from here (queuedOnly).
import { rng } from '../rng.js';
import { clamp, theCountry } from '../util.js';
import { store, player, country, livingNpcs, log } from '../state.js';
import { COUNTRIES, COUNTRY_LIST } from '../data/countries.js';
import { WANTED } from '../data/immigration.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { routes, spouseAnswer } from './immigration.js';
import { rightToLive, held, issuer } from './citizenship.js';
import { applyToMove, activeCase } from './relocation.js';
import { startPlan, updatePlan } from './travel.js';
import { capitalCity, climate } from './geo.js';
import { recordEvent, archiveIdOf } from './chronicle.js';
import { remember } from './conditions.js';
import { today, addDays, entryRule, readiness, validPassport, applyPassport, ensureOwnPassport } from './documents.js';
import { modesFor, recordQuickTrip } from './travel.js';
import { distanceKm } from './geo.js';
import { hasEvent, charge } from './chronicle.js';
import { languagesOf } from './languages.js';
import { SKILL_BY_ID } from '../data/skills.js';
import { openBusinesses, managerOf } from './business.js';
import { openBranchAbroad } from './businessAbroad.js';
import { stamp as stampVisit } from './emigration.js';
import { localMoney, fmtMoney } from '../util.js';

const nameOf = (id) => theCountry(COUNTRIES[id]?.name ?? id);
/** Yearly chance an arc begins once its conditions hold. Gameplay pacing. */
export const ARC_ODDS = { offer: 0.07, distance: 0.35, homeward: 0.08, retire: 0.1, firstTrip: 0.25, exchange: 0.3, cultures: 0.2, venture: 0.12 };
/** Years before the same arc can begin again. */
const AGAIN = { offer: 6, distance: 2, homeward: 5, retire: 6, firstTrip: 99, exchange: 99, cultures: 8, venture: 8 };

const arcs = (p) => (p.flags.arcs ??= {});
const ready = (p, id) => { const a = arcs(p)[id]; return !a || store.state.year - a.year >= AGAIN[id]; };
const busy = (p) => !!(p.legal.incarceration || p.legal.pending || p.travel?.whereabouts);
const openCase = (p) => (p.applications ?? []).some((a) => a.kind === 'relocation' && ['submitted', 'review_requested', 'approved'].includes(a.status) && !a.used);
const partnerOf = () => livingNpcs().find((n) => n.role === 'spouse' || (n.role === 'partner' && n.flags.livesTogether));
const qualified = (p) => p.education.degrees.some((d) => ['university', 'apprenticeship', 'cosmetology', 'medical', 'law', 'graduate', 'nursing', 'teaching', 'doctorate'].includes(d.type));

// ---------- When each arc can begin ----------

/** A job offer abroad: someone settled in a career employers elsewhere look for, with no move already under way. */
function offerFor(p) {
  if (p.age < 24 || p.age > 58 || !p.career.careerId || p.career.retired || !qualified(p) || openCase(p)) return null;
  const job = CAREER_BY_ID[p.career.careerId];
  if (job?.type !== 'fulltime' || (p.career.yearsInField ?? 0) < 3) return null;
  const here = COUNTRIES[p.countryId];
  // Where pay is better, a work visa is a real route, and they are not already entitled to live.
  const options = COUNTRY_LIST.filter((c) => c.id !== p.countryId && !rightToLive(c.id, p) && (c.living?.wageK ?? 1) >= (here.living?.wageK ?? 1) * 0.95 && !c.living?.crisis
    && routes(c.id, p).find((r) => r.id === 'work')?.eligible);
  if (!options.length) return null;
  const wanted = WANTED.includes(p.career.careerId);
  // Offers come mostly from where pay is clearly better: the better-paid half of what is open.
  const best = options.sort((a, b) => (b.living?.wageK ?? 1) - (a.living?.wageK ?? 1)).slice(0, Math.max(3, Math.ceil(options.length / 2)));
  const dest = rng.pick(best);
  return { dest: dest.id, city: rng.pick(dest.cities), wanted };
}

/** Married across a border: a husband or wife (or partner who lives with you) living in another country. */
function distanceFor(p) {
  const n = livingNpcs().find((x) => (x.role === 'spouse' || x.role === 'partner') && typeof x.flags.abroad === 'string' && COUNTRIES[x.flags.abroad] && x.flags.abroad !== p.countryId);
  return n ? { npc: n.id, dest: n.flags.abroad } : null;
}

/** Going home: years abroad, still a citizen of where they were born, and a parent there growing old. */
function homewardFor(p) {
  if (p.age < 35 || p.countryId === p.birthCountryId || !rightToLive(p.birthCountryId, p) || openCase(p)) return null;
  const since = p.flags.arrivedYear ?? (p.locations ?? []).at(-1)?.from;
  if (since == null || store.state.year - since < 10) return null;
  const parent = livingNpcs().find((n) => n.role === 'parent' && n.age >= 68 && (n.flags.abroad === p.birthCountryId || (!n.flags.abroad && p.countryId === p.birthCountryId)));
  return parent ? { npc: parent.id, dest: p.birthCountryId } : null;
}

/** Retiring abroad: near a child who lives in another country, or somewhere warmer and cheaper. */
function retireFor(p) {
  if (!p.career.retired || p.age < 60 || p.age > 82 || openCase(p)) return null;
  const kid = livingNpcs().find((n) => n.role === 'child' && n.age >= 25 && typeof n.flags.abroad === 'string' && COUNTRIES[n.flags.abroad] && n.flags.abroad !== p.countryId);
  const canGo = (id) => routes(id, p).some((r) => ['right', 'free', 'family', 'retire'].includes(r.id) && r.eligible);
  if (kid && canGo(kid.flags.abroad)) return { npc: kid.id, dest: kid.flags.abroad, why: 'kid' };
  const here = COUNTRIES[p.countryId];
  const sunny = COUNTRY_LIST.filter((c) => c.id !== p.countryId && ['warm', 'tropical'].includes(climate(c.id)) && !['warm', 'tropical'].includes(climate(p.countryId))
    && (c.living?.cost ?? 1) < (here.living?.cost ?? 1) && (c.living?.safety ?? 50) >= 55 && (c.living?.health ?? 50) >= 55 && !c.living?.crisis && canGo(c.id));
  if (!sunny.length) return null;
  return { dest: rng.pick(sunny).id, why: 'sun' };
}

/** A first trip abroad: a teenager at home who has never crossed a border, in a family that can afford it. */
function firstTripFor(p) {
  if (p.age < 12 || p.age > 17 || !p.flags.livesWithParents || hasEvent(`first-abroad:${archiveIdOf(p)}`) || (p.flags.visited ?? []).length) return null;
  const parents = livingNpcs().filter((n) => n.role === 'parent' && !n.flags.abroad);
  if (!parents.length || parents.reduce((s, n) => s + (n.savings ?? n.life?.savings ?? 0), 0) < localMoney(3000, country())) return null;
  // Somewhere the border lets them in without a visa, reachable in the year: family abroad first.
  const easy = (id) => id !== p.countryId && ['visa_free', 'free_movement', 'none'].includes(entryRule(p, id, 'visit').kind)
    && modesFor({ countryId: p.countryId, city: p.city }, { countryId: id, city: capitalCity(id) }, store.state.year).length;
  const kin = livingNpcs().find((n) => typeof n.flags.abroad === 'string' && easy(n.flags.abroad) && ['grandparent', 'sibling', 'relative', 'parent'].includes(n.role));
  const options = COUNTRY_LIST.filter((c) => easy(c.id)).sort((a, b) => (distanceKm({ countryId: p.countryId, city: p.city }, { countryId: a.id, city: capitalCity(a.id) }) ?? 1e9) - (distanceKm({ countryId: p.countryId, city: p.city }, { countryId: b.id, city: capitalCity(b.id) }) ?? 1e9)).slice(0, 6);
  if (!kin && !options.length) return null;
  return { dest: kin?.flags.abroad ?? rng.pick(options).id, npc: kin?.id ?? null, why: kin ? 'kin' : 'sun' };
}

/** A semester abroad: a university student who has not been on one, offered a place where study is possible. */
function exchangeFor(p) {
  if (!p.education.enrolled || !['university', 'graduate'].includes(p.education.stage) || p.age > 26 || (p.education.abroad ?? []).length) return null;
  // Universities with exchange places: where the game knows a university, or where higher education is well provided for.
  const known = new Set(Object.values(store.state.universities ?? {}).map((u) => u.countryId));
  const options = COUNTRY_LIST.filter((c) => c.id !== p.countryId && !c.living?.crisis && ((known.has(c.id) && (c.living?.infra ?? 50) >= 60) || (c.living?.infra ?? 50) >= 75));
  if (!options.length) return null;
  const c = rng.pick(options);
  return { dest: c.id, city: rng.pick(c.cities) };
}

/** Two cultures in one family: a young child at home, and a parent who grew up with another language. */
function culturesFor(p) {
  const local = languagesOf(p.countryId);
  const kid = livingNpcs().find((n) => n.role === 'child' && n.age >= 3 && n.age <= 12 && !n.flags.abroad && !n.flags.homeLanguage);
  if (!kid) return null;
  const parents = [p, ...livingNpcs().filter((n) => (n.role === 'spouse' || n.role === 'partner') && !n.flags.abroad)];
  for (const par of parents) {
    const from = par === p ? p.birthCountryId : par.bornIn;
    const lang = languagesOf(from ?? '').find((l) => !local.includes(l) && SKILL_BY_ID[l]);
    if (lang) return { npc: kid.id, lang, parent: par === p ? 'you' : par.id, dest: from };
  }
  return null;
}

/** The family business goes abroad: an established business with a manager, and a reason to look at one country. */
function ventureFor(p) {
  const b = openBusinesses(p).find((x) => x.countryId === p.countryId && x.years >= 3 && x.reputation >= 60 && managerOf(x) && !openBusinesses(p).some((y) => y.parentId === x.id));
  if (!b) return null;
  const kin = livingNpcs().find((n) => ['child', 'sibling', 'grandchild'].includes(n.role) && n.age >= 22 && typeof n.flags.abroad === 'string' && COUNTRIES[n.flags.abroad]);
  const dest = kin?.flags.abroad ?? rng.pick(COUNTRY_LIST.filter((c) => c.id !== p.countryId && (c.living?.wageK ?? 1) >= 0.8 && !c.living?.crisis)).id;
  return { dest, npc: kin?.id ?? null, business: b.id, city: capitalCity(dest) };
}

// ---------- Sending the scenes ----------

const send = (id, cast) => store.state.pendingEvents.push({ id, cast });

/** Yearly: at most one arc begins, and only from what is really so. */
export function tickAbroadArcs(p = player(), force = null) {
  if (!p.alive || busy(p) || store.state.pendingEvents.some((e) => String(e.id).startsWith('abroad_'))) return null;
  const year = store.state.year;
  const tries = [
    ['distance', distanceFor], ['homeward', homewardFor], ['retire', retireFor], ['offer', offerFor],
    ['firstTrip', firstTripFor], ['exchange', exchangeFor], ['cultures', culturesFor], ['venture', ventureFor],
  ];
  for (const [id, find] of tries) {
    if (force && force !== id) continue;
    if (!ready(p, id) || (!force && !rng.chance(ARC_ODDS[id]))) continue;
    const it = find(p);
    if (!it) continue;
    arcs(p)[id] = { year, ...it };
    const n = it.npc ? store.state.npcs[it.npc] : null;
    const words = { country: nameOf(it.dest), place: it.city ? `${it.city}, ${nameOf(it.dest)}` : nameOf(it.dest), who: n?.firstName ?? '', age: String(n?.age ?? ''), home: nameOf(p.birthCountryId),
      job: p.career.title ? `${/^[aeiou]/i.test(p.career.title) ? 'an' : 'a'} ${p.career.title.toLowerCase()}` : 'someone who does what you do', years: String(year - (p.flags.arrivedYear ?? year)),
      lang: it.lang ? SKILL_BY_ID[it.lang].name : '', parent: it.parent === 'you' ? 'you' : store.state.npcs[it.parent]?.firstName ?? '',
      business: it.business ? openBusinesses(p).find((b) => b.id === it.business)?.name ?? '' : '',
      ...(id === 'venture' ? { who: n ? `${n.firstName}, who lives there, says they could help.` : 'The numbers say it could work.' } : {}),
      trip: it.why === 'kin' && n ? `to see ${n.firstName} in ${nameOf(it.dest)}` : `to ${nameOf(it.dest)}`,
      why: it.why === 'kid' ? `${n?.firstName} has made a life in ${nameOf(it.dest)}, and keeps saying there is room for you.` : `${nameOf(it.dest).replace(/^the /, 'The ')} is warmer than here, and cheaper.` };
    send(`abroad_${id}`, { ...(n ? { kin: n.id } : {}), words });
    return id;
  }
  return null;
}

// ---------- What each choice does ----------

/** A draft trip there, waiting in Explore the World. Nothing is booked or paid. */
function draftTrip(type, dest, city, nights = 7) {
  const t = startPlan(type);
  updatePlan(t.id, { destination: { countryId: dest, city: city ?? capitalCity(dest) } });
  const from = addDays(today(), 40) <= `${store.state.year}-12-01` ? addDays(today(), 40) : `${store.state.year + 1}-02-01`;
  updatePlan(t.id, { depart: from, ret: addDays(from, nights) });
  return t;
}

/** What the player chose in an arc's scene. @returns {string} what happened, in a sentence or two */
export function decide(what, cast = {}) {
  const p = player();
  const [arc, choice] = String(what).split(':');
  const a = arcs(p)[arc];
  if (!a) return '';
  const n = a.npc ? store.state.npcs[a.npc] : null;
  const there = nameOf(a.dest);

  if (arc === 'offer') {
    if (choice === 'no') { recordEvent({ key: `arc:offer:${a.year}`, type: 'decision', title: `Turned down a job in ${COUNTRIES[a.dest].name}`, place: { countryId: p.countryId, city: p.city }, privacy: 'private' }); return 'You thank them, and say no. You wonder about it, now and then.'; }
    p.flags.sponsor = a.dest; // a job offer in hand: it counts in a work visa application (engine/immigration.js)
    if (choice === 'visit') { draftTrip('interview', a.dest, a.city, 4); return `They will see you in ${a.city}. A plan for the trip is waiting in Explore the World; nothing is booked yet. The offer counts if you apply.`; }
    if (choice === 'talk') {
      const s = partnerOf();
      if (!s) return 'There is nobody at home to ask but yourself.';
      const yes = s.role === 'spouse' ? spouseAnswer(s, a.dest) : rng.chance(clamp(0.35 + (s.meters.relationship - 50) / 100, 0.1, 0.9));
      remember(s, `offer_${a.year}`, `You talked about the job in ${COUNTRIES[a.dest].name}, together.`);
      return yes ? `${s.firstName} is quiet for a long time, then says: "Let's do it." Apply when you are ready (Explore the World, Immigration).` : `${s.firstName} does not want to go. ${s.life?.job ? 'Their work is here.' : 'Their life is here.'} If you go, it may be alone.`;
    }
    const r = applyToMove(a.dest, 'work', a.city);
    return r.ok ? `${r.text} Your new employer is sponsoring you.` : `You meant to, but: ${r.text}`;
  }

  if (arc === 'distance') {
    if (!n?.alive || n.flags.abroad !== a.dest) return 'Things have changed since then.';
    if (choice === 'visit') { draftTrip(n.role === 'spouse' ? 'romantic' : 'visiting', a.dest, null, 10); n.meters.relationship = clamp(n.meters.relationship + 3); return `You promise ${n.firstName} you will come. A plan is waiting in Explore the World.`; }
    if (choice === 'wait') { n.meters.relationship = clamp(n.meters.relationship - 2); return 'You leave it there for now. The calls go on.'; }
    if (choice === 'join') {
      // Moving to them: the routes are the player's own; a spouse who is a citizen there opens the family route.
      const open = routes(a.dest, p).filter((r) => r.eligible && ['right', 'free', 'family', 'settle', 'work'].includes(r.id)).sort((x, y) => ['right', 'free', 'family', 'work', 'settle'].indexOf(x.id) - ['right', 'free', 'family', 'work', 'settle'].indexOf(y.id))[0];
      if (!open) return `You would go, but no route into ${there} is open to you.`;
      if (activeCase(a.dest, p)) return 'Your application is already in.';
      const r = applyToMove(a.dest, open.id);
      return r.ok ? `You tell ${n.firstName} you are coming. ${r.text}` : r.text;
    }
    if (choice === 'ask') {
      // Their decision, and then their own permission to come: a spouse applies to join, which is not certain.
      const willing = rng.chance(clamp(0.3 + (n.meters.relationship - 50) / 80 - (n.life?.job ? 0.15 : 0), 0.05, 0.9));
      if (!willing) { n.meters.relationship = clamp(n.meters.relationship - 4); return `${n.firstName} cannot leave ${there}, not yet. ${n.life?.job ? 'Their work is there.' : 'Their life is there.'}`; }
      const entitled = rightToLive(p.countryId, n) || held(n).includes(issuer(p.countryId));
      const granted = entitled || (n.role === 'spouse' && rng.chance(0.85)) || (n.role === 'partner' && rng.chance(0.6));
      if (!granted) { remember(n, `refused_${store.state.year}`, 'You tried to come and live with them, and were refused permission.'); return `${n.firstName} applied to come and live with you, and was refused. You can try again another year.`; }
      const from = n.flags.abroad;
      n.flags.abroad = false; delete n.flags.stayedBehind;
      if (n.life?.job) n.life.job = null;
      n.meters.relationship = clamp(n.meters.relationship + 8);
      recordEvent({ key: `arc:join:${n.id}:${store.state.year}`, type: 'relocation', international: true, subject: archiveIdOf(n), people: [archiveIdOf(p)],
        title: `${n.firstName} moved to ${COUNTRIES[p.countryId].name} to be with ${p.firstName}`, from: { countryId: from }, place: { countryId: p.countryId, city: p.city }, significance: 3, privacy: 'family' });
      log(`${n.firstName} came to live with you in ${p.city}.`, 'system', 'good');
      return `${n.firstName} says yes${entitled ? '' : ', applies to join you, and is given permission'}. Within the year you are living under one roof again, in ${p.city}.`;
    }
  }

  if (arc === 'homeward') {
    if (choice === 'stay') { recordEvent({ key: `arc:stay:${a.year}`, type: 'belonging', title: `Chose to stay in ${COUNTRIES[p.countryId].name}`, place: { countryId: p.countryId, city: p.city }, privacy: 'private' }); return `You stay. ${COUNTRIES[p.countryId].name} is home now too. You call ${n?.firstName ?? 'home'} more often.`; }
    if (choice === 'visit') { draftTrip('visiting', a.dest, p.birthCity && COUNTRIES[a.dest].cities.includes(p.birthCity) ? p.birthCity : null, 14); return `A plan to go and see ${n?.firstName ?? 'them'} is waiting in Explore the World.`; }
    const r = applyToMove(a.dest, 'right', p.birthCity && COUNTRIES[a.dest].cities.includes(p.birthCity) ? p.birthCity : null);
    return r.ok ? `You decide to go home. As a citizen there is nothing to apply for: arrange the move in Explore the World, Immigration.` : r.text;
  }

  if (arc === 'firstTrip') {
    if (choice === 'stay') return 'You say you would rather stay at home this year. Your parents look at each other, and let it go.';
    // The parents take the family: the papers first, then two weeks there. Paid by them.
    const parents = livingNpcs().filter((n) => n.role === 'parent' && !n.flags.abroad);
    const sibs = livingNpcs().filter((n) => n.role === 'sibling' && n.age < 18 && !n.flags.abroad);
    for (const x of [p, ...sibs]) if (!validPassport(x)) for (const j of held(x).slice(0, 1)) { if (x === p) applyPassport(p.id, j); else ensureOwnPassport(x, today(), addDays(today(), 30)); }
    if (!readiness(p, a.dest, 'visit', today(), addDays(today(), 14)).ok) return 'In the end the papers did not come through in time, and the trip was put off.';
    const cost = localMoney(2200, country()) * (1 + parents.length + sibs.length);
    for (const par of parents) { const share = Math.round(cost / parents.length); if (par.life) par.life.savings -= share; else par.savings = (par.savings ?? 0) - share; }
    const paid = charge({ amount: cost, kind: 'travel', memo: `A family trip ${choice === 'kin' && n ? `to see ${n.firstName}` : `to ${COUNTRIES[a.dest].name}`}`, payer: 'parent' });
    const q = recordQuickTrip({ countryId: a.dest, city: null, nights: 14, people: [...parents, ...sibs], name: `A family trip to ${COUNTRIES[a.dest].name}`, txId: paid.tx.id, amount: cost, purpose: n && choice === 'kin' ? 'family' : 'holiday' });
    stampVisit(a.dest, 'visit');
    if (!(p.flags.visited ??= []).includes(a.dest)) p.flags.visited.push(a.dest);
    p.stats.mood = clamp(p.stats.mood + 8);
    if (n && choice === 'kin') { n.meters.relationship = clamp(n.meters.relationship + 10); remember(n, `firstTrip_${a.year}`, 'You came to see them, the first time you went abroad.'); }
    for (const par of parents) remember(par, `firstTrip_${a.year}`, `You took ${p.firstName} abroad for the first time.`);
    if ((p.talents?.music ?? 0) >= 50 || (p.skills?.photography ?? 0) > 0) { p.skills ??= {}; p.skills.photography = clamp((p.skills.photography ?? 0) + 4); }
    return `Two weeks in ${nameOf(a.dest)}${n && choice === 'kin' ? ` with ${n.firstName}` : ''}. Everything smelled different, and you came home with a list of places you mean to see. ${q.notes.join(' ')}`.trim();
  }

  if (arc === 'exchange') {
    if (choice === 'no') return 'You let the deadline pass. There will be other chances.';
    const t = startPlan('semester');
    const y = store.state.year + 1;
    updatePlan(t.id, { destination: { countryId: a.dest, city: a.city }, depart: `${y}-02-01`, ret: `${y}-06-15`, stay: 'student' });
    return `You put your name down for a semester in ${a.city}, ${nameOf(a.dest)}, next spring. The plan is waiting in Explore the World; a student visa may be needed, and is decided when the year turns.`;
  }

  if (arc === 'cultures') {
    const kid = n;
    if (!kid?.alive) return '';
    const lang = SKILL_BY_ID[a.lang]?.name ?? 'it';
    if (choice === 'local') { kid.flags.homeLanguage = { lang: a.lang, pace: 0, year: store.state.year }; return `The language of home becomes the language of ${nameOf(p.countryId)}. ${kid.firstName} still knows a few words of ${lang} for birthdays.`; }
    const pace = choice === 'school' ? 7 : 4;
    if (choice === 'school') { const cost = localMoney(800, country()); const paid = charge({ amount: cost, kind: 'education', memo: `Weekend ${lang} school for ${kid.firstName}` }); if (!paid.ok) return `The weekend school wants ${fmtMoney(cost, country())}, which you do not have this year.`; }
    kid.flags.homeLanguage = { lang: a.lang, pace, year: store.state.year, level: kid.flags.homeLanguage?.level ?? 5 };
    recordEvent({ key: `cultures:${kid.id}`, type: 'family', title: `${kid.firstName} grows up with ${lang} at home`, subject: archiveIdOf(kid), people: [archiveIdOf(p)], place: { countryId: p.countryId, city: p.city }, significance: 1, privacy: 'family' });
    return choice === 'school' ? `On Saturday mornings ${kid.firstName} goes to ${lang} school, complains about it, and comes home singing songs you remember.` : `${lang} at home, the local language everywhere else. ${kid.firstName} switches between them mid-sentence, and is not confused in the least.`;
  }

  if (arc === 'venture') {
    if (choice === 'no') return 'You decide the business has enough to do at home.';
    const r = openBranchAbroad(a.business, a.dest, a.city);
    if (r.ok && n) { remember(n, `venture_${a.year}`, `They helped open the family business in ${COUNTRIES[a.dest].name}.`); n.meters.relationship = clamp(n.meters.relationship + 5); }
    return r.ok && n ? `${r.text} ${n.firstName} found the premises.` : r.text;
  }

  if (arc === 'retire') {
    if (choice === 'stay') return 'You stay where your life is. The idea stays with you, a little.';
    if (choice === 'visit') { draftTrip('vacation', a.dest, null, 30); return `A month there first, to see. The plan is waiting in Explore the World.`; }
    const open = routes(a.dest, p).find((r) => r.eligible && ['right', 'free', 'family', 'retire'].includes(r.id));
    if (!open) return `No route into ${there} is open to you now.`;
    const r = applyToMove(a.dest, open.id);
    return r.text;
  }
  return '';
}

