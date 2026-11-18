// Plans that carry on by themselves from year to year: set once, changed when
// the player wants, and lived through at Age Up. They spare the player
// repeating the same choice every year (practising the piano, posting online,
// putting money aside, looking after a pet) without making anything free:
// each still uses that year's own allowance, costs what it costs, and grows
// with the same rules as doing it by hand.
//
//   hobby       a main passion and a second interest, practised from the year's
//               practice sessions (engine/skills.js)
//   savings     a standing deposit into one of the player's bank accounts (engine/banking.js)
//   traditions  family traditions that come round every year, and outlive the player
//
// One-off celebrations (a birthday party, a reunion) are immediate actions,
// once per occasion per year. Everything here runs once per year: a marker
// records the year it last ran.
import { store, player, country, log, milestone, npcsByRole, livingNpcs } from '../state.js';
import { clamp, localCost, fmtMoney } from '../util.js';
import { remember } from './conditions.js';
import { SKILL_BY_ID } from '../data/skills.js';
import { practise, sessionsLeft, levelOf, canPractise } from './skills.js';
import { accountById, deposit } from './banking.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });

export function plansOf(p = player()) {
  p.plans ??= { hobby: null, savings: null, traditions: [], done: {}, lastYear: null };
  p.plans.traditions ??= [];
  p.plans.done ??= {};
  return p.plans;
}

/**
 * Runs an action without its journal lines (they are summed up in one line
 * instead). Returns what the action returned.
 */
function quietly(fn) {
  const j = store.state.journal;
  const n = j.length;
  const out = fn();
  j.splice(n);
  return out;
}

/** Things done once per year: one birthday party, one anniversary. */
function onceThisYear(key) {
  const pl = plansOf();
  const y = store.state.year;
  if (pl.done.year !== y) pl.done = { year: y };
  if (pl.done[key]) return false;
  pl.done[key] = true;
  return true;
}
export const doneThisYear = (key) => plansOf().done?.year === store.state.year && !!plansOf().done[key];

// ---------- Hobby focus ----------

export function setHobby(main, second = null, p = player()) {
  const pl = plansOf(p);
  if (!main) { pl.hobby = null; return result(true, 'No hobby plan. You can still practise whenever you like.', 'neutral'); }
  const ok = (id) => SKILL_BY_ID[id] && p.age >= SKILL_BY_ID[id].minAge;
  if (!ok(main) || (second && (!ok(second) || second === main))) return result(false, 'That is not something you can take up yet.', 'neutral');
  pl.hobby = { main, second, since: store.state.year };
  return result(true, `${SKILL_BY_ID[main].name} is your main passion${second ? `, with ${SKILL_BY_ID[second].name.toLowerCase()} on the side` : ''}. You will practise through the year.`, 'good');
}

// ---------- Savings ----------

/**
 * A standing deposit: each year, this much goes from the player's pocket into
 * one of their bank accounts (and so towards any goal that account is saving
 * for). The money moves through the bank and the ledger like any deposit.
 */
export function setSavings(accountId, yearly, p = player()) {
  const pl = plansOf(p);
  if (!accountId || !(yearly > 0)) { pl.savings = null; return result(true, 'No standing deposit. Your accounts stay as they are.', 'neutral'); }
  const a = accountById(accountId);
  if (!a || a.closed != null) return result(false, 'Choose an account to save into. You can open one in My Money.', 'neutral');
  pl.savings = { accountId, yearly: Math.round(yearly), since: store.state.year };
  return result(true, `Each year ${fmtMoney(pl.savings.yearly, country())} goes into your ${a.name.toLowerCase()}.`, 'good');
}

// ---------- Celebrations and traditions ----------

export const STYLES = {
  simple: { name: 'Simple', cost: 60, warmth: 3 },
  generous: { name: 'Generous', cost: 350, warmth: 5 },
  lavish: { name: 'Lavish', cost: 1800, warmth: 7 },
};
const CLOSE = ['parent', 'sibling', 'grandparent', 'spouse', 'partner', 'child', 'grandchild', 'greatgrandchild', 'friend', 'relative', 'niece', 'inlaw'];

/** Occasions open to the player this year. */
export function occasions(p = player()) {
  const out = [{ id: 'birthday', name: 'Your birthday', minAge: 3 }, { id: 'holiday', name: 'A holiday celebration', minAge: 16 }, { id: 'reunion', name: 'A family reunion', minAge: 18 }];
  if (npcsByRole('spouse').length) out.push({ id: 'anniversary', name: 'Your wedding anniversary', minAge: 18 });
  for (const k of npcsByRole('child').filter((n) => n.age < 18)) out.push({ id: `kid:${k.id}`, name: `${k.firstName}'s birthday`, minAge: 16 });
  return out.filter((o) => p.age >= o.minAge && !p.legal.incarceration).map((o) => ({ ...o, done: doneThisYear(o.id) }));
}
export const guestsFor = () => livingNpcs().filter((n) => CLOSE.includes(n.role) && !n.flags.abroad);

/**
 * A celebration: once per occasion per year, with guests and a style.
 * Everyone who comes feels a little closer; nobody's closeness can be farmed.
 */
export function celebrate(occasionId, guestIds, style = 'simple', p = player()) {
  const occ = occasions(p).find((o) => o.id === occasionId);
  const st = STYLES[style];
  if (!occ || !st) return result(false, 'That is not something to celebrate right now.', 'neutral');
  if (occ.done) return result(false, `You have already celebrated ${occ.name.toLowerCase()} this year.`, 'neutral');
  const cost = Math.round(localCost(st.cost, country()));
  if (p.age >= 18 && p.finance.cash < cost) return result(false, `That would cost ${fmtMoney(cost, country())}.`, 'neutral');
  const guests = guestIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && CLOSE.includes(n.role));
  if (occasionId.startsWith('kid:')) { const kid = store.state.npcs[occasionId.slice(4)]; if (kid && !guests.includes(kid)) guests.push(kid); }
  onceThisYear(occasionId);
  if (p.age >= 18) p.finance.cash -= cost;
  for (const n of guests) n.meters.relationship = clamp(n.meters.relationship + st.warmth);
  p.stats.mood = clamp(p.stats.mood + Math.round(st.warmth * 1.2));
  const who = guests.length ? guests.length <= 3 ? guests.map((n) => n.firstName).join(', ').replace(/, ([^,]*)$/, ' and $1') : `${guests.length} people` : 'just you';
  const text = `${occ.name} with ${who}: ${style === 'lavish' ? 'a night people will talk about' : style === 'generous' ? 'food, music and a good evening' : 'cake, and the people who matter'}.`;
  log(text, 'system', 'good');
  return result(true, text, 'good');
}

export const TRADITION_IDEAS = [
  ['sunday', 'Sunday dinners together'], ['summer', 'A summer trip together'], ['newyear', 'New Year at home'],
  ['birthdays', 'Birthday breakfasts for everyone'], ['reunion', 'A reunion every year'], ['walk', 'A walk on the first day of spring'],
];

/** Starts a family tradition. It comes round by itself every year, and passes on to the next generation. */
export function startTradition(ideaId, style = 'simple', p = player()) {
  const pl = plansOf(p);
  const idea = TRADITION_IDEAS.find(([id]) => id === ideaId);
  if (!idea || !STYLES[style]) return result(false, 'Unknown tradition.', 'neutral');
  if (pl.traditions.some((t) => t.idea === ideaId && t.active)) return result(false, 'Your family already has that tradition.', 'neutral');
  if (p.age < 18) return result(false, 'Traditions are started by the grown-ups. You can suggest one.', 'neutral');
  pl.traditions.push({ id: `trad_${ideaId}_${store.state.year}`, idea: ideaId, name: idea[1], style, since: store.state.year, years: 0, active: true, startedBy: `${p.firstName} ${p.lastName}` });
  return result(true, `A new family tradition: ${idea[1].toLowerCase()}.`, 'good');
}
export function stopTradition(id, p = player()) {
  const t = plansOf(p).traditions.find((x) => x.id === id && x.active);
  if (!t) return result(false, 'Not found.', 'neutral');
  t.active = false; t.until = store.state.year;
  return result(true, `${t.name} stops, for now. It stays in the family's history.`, 'neutral');
}

// ---------- The year ----------

/**
 * Lives the plans through the year that is ending. Runs once per year (a
 * marker records the year), before the year turns, so each plan uses that
 * year's own allowances.
 * @returns {string[]} one line per plan, for the yearly summary
 */
export function livePlans(p = player()) {
  const pl = plansOf(p);
  const y = store.state.year;
  if (pl.lastYear === y || !p.alive) return [];
  pl.lastYear = y;
  const lines = [];
  const c = country();
  const free = !p.legal.incarceration;

  // A main passion gets most of the year's practice; a second interest some of it.
  if (pl.hobby && free && canPractise()) {
    for (const [id, times] of [[pl.hobby.main, 2], [pl.hobby.second, 1]]) {
      if (!id || !SKILL_BY_ID[id] || p.age < SKILL_BY_ID[id].minAge) continue;
      const before = levelOf(id);
      for (let i = 0; i < times && sessionsLeft() > 0; i++) quietly(() => practise(id));
      const after = levelOf(id);
      if (after > before) lines.push(`${SKILL_BY_ID[id].name}: ${before}% to ${after}%.`);
    }
  }

  // The standing deposit, if the money is there: through the bank, like any deposit.
  const f = p.finance;
  if (pl.savings && free) {
    const acct = accountById(pl.savings.accountId);
    if (!acct || acct.closed != null) pl.savings = null;
    else {
      const put = Math.max(0, Math.min(pl.savings.yearly, Math.floor(f.cash)));
      if (put > 0 && quietly(() => deposit(acct.id, put)).ok) lines.push(`You put ${fmtMoney(put, c)} into your ${acct.name.toLowerCase()}.`);
    }
  }

  // Traditions come round by themselves.
  for (const t of pl.traditions.filter((x) => x.active)) {
    const family = livingNpcs().filter((n) => ['parent', 'sibling', 'spouse', 'partner', 'child', 'grandchild', 'grandparent'].includes(n.role) && !n.flags.abroad);
    if (!family.length) continue;
    const st = STYLES[t.style];
    const cost = p.age >= 18 ? Math.round(localCost(st.cost, c)) : 0;
    if (cost > f.cash) continue; // a lean year: it is skipped, not lost
    f.cash -= cost;
    for (const n of family) n.meters.relationship = clamp(n.meters.relationship + 2);
    p.stats.mood = clamp(p.stats.mood + 2);
    t.years += 1;
    if (t.years === 10 || t.years === 25 || t.years === 50) {
      milestone(`${t.name}: a family tradition for ${t.years} years.`, 'family');
      for (const n of family) remember(n, `tradition_${t.id}_${t.years}`, `${t.name}, ${t.years} years running.`);
    }
    lines.push(`${t.name}, as every year.`);
  }
  return lines;
}

/** What carries on to the next generation: the family's traditions. */
export function inheritPlans(old, heir) {
  const traditions = (old.plans?.traditions ?? []).filter((t) => t.active).map((t) => ({ ...t, inherited: true }));
  heir.plans = { hobby: null, savings: null, traditions, done: {}, lastYear: null };
}

/** Everything that is carrying on by itself, for the This Year card. */
export function ongoing(p = player()) {
  const pl = plansOf(p);
  const out = [];
  if (pl.hobby) out.push(['Hobby', `${SKILL_BY_ID[pl.hobby.main].name}${pl.hobby.second ? ` and ${SKILL_BY_ID[pl.hobby.second].name.toLowerCase()}` : ''}`]);
  if (pl.savings) out.push(['Saving', `${fmtMoney(pl.savings.yearly, country())} a year into your ${accountById(pl.savings.accountId)?.name.toLowerCase() ?? 'account'}`]);
  const h = p.health;
  if (h) {
    const therapy = h.therapies.filter((c) => c.status === 'active').length;
    const meds = h.trials.filter((t) => ['active', 'adjusted', 'under_review', 'tapering'].includes(t.status)).length;
    if (therapy || meds) out.push(['Health care', [therapy ? `${therapy} therap${therapy === 1 ? 'y' : 'ies'}` : '', meds ? `${meds} medicine${meds === 1 ? '' : 's'}` : ''].filter(Boolean).join(', ')]);
  }
  for (const t of pl.traditions.filter((x) => x.active)) out.push(['Tradition', `${t.name}${t.years ? ` (${t.years} year${t.years === 1 ? '' : 's'})` : ''}`]);
  return out;
}
