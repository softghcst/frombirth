// Plans that carry on by themselves from year to year: set once, changed when
// the player wants, and lived through at Age Up. They spare the player
// repeating the same choice every year (practicing the piano, posting online,
// putting money aside, looking after a pet) without making anything free:
// each still uses that year's own allowance, costs what it costs, and grows
// with the same rules as doing it by hand.
//
//   hobby       a main passion and a second interest, practiced from the year's
//               practice sessions (engine/skills.js)
//   savings     a standing deposit into one of the player's bank accounts (engine/banking.js)
//
// Celebrations, invitations and family traditions are Living Moments
// (engine/moments.js, People > My Moments). Everything here runs once per
// year: a marker records the year it last ran.
import { store, player, country } from '../state.js';
import { fmtMoney } from '../util.js';
import { SKILL_BY_ID } from '../data/skills.js';
import { practice, sessionsLeft, levelOf, canPractise } from './skills.js';
import { accountById, deposit } from './banking.js';
import { traditions as familyTraditions } from './moments.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });

export function plansOf(p = player()) {
  p.plans ??= { hobby: null, savings: null, lastYear: null };
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

// ---------- Hobby focus ----------

export function setHobby(main, second = null, p = player()) {
  const pl = plansOf(p);
  if (!main) { pl.hobby = null; return result(true, 'No hobby plan. You can still practice whenever you like.', 'neutral'); }
  const ok = (id) => SKILL_BY_ID[id] && p.age >= SKILL_BY_ID[id].minAge;
  if (!ok(main) || (second && (!ok(second) || second === main))) return result(false, 'That is not something you can take up yet.', 'neutral');
  pl.hobby = { main, second, since: store.state.year };
  return result(true, `${SKILL_BY_ID[main].name} is your main passion${second ? `, with ${SKILL_BY_ID[second].name.toLowerCase()} on the side` : ''}. You will practice through the year.`, 'good');
}

// ---------- Savings ----------

/**
 * A standing deposit: each year, this much goes from the player's pocket into
 * one of their bank accounts (and so toward any goal that account is saving
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
      for (let i = 0; i < times && sessionsLeft() > 0; i++) quietly(() => practice(id));
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

  return lines;
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
  for (const t of familyTraditions().filter((x) => x.status === 'active' || !x.status)) out.push(['Tradition', t.name]);
  return out;
}
