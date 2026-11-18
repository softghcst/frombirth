// Trades, in the leagues with a draft (the United States and Canada, Japan, Korea): players there do not move for
// transfer fees; a club trades a player's contract to another club, for players in return, and the player goes where
// he is sent on the same pay for the same years. A minor leaguer is traded as a prospect, to the same level of the new
// club's system. In the big leagues of baseball a player with ten years as a professional, the last five with his
// club, may refuse a trade (the "ten and five" rule).
//
//   contract.history gets { year, text }; e.trades = [{ year, from, to, for, vetoed? }]
import { milestone } from '../state.js';
import { clubOf, toMinors } from './draft.js';
import * as sp from './sports.js';
import { internals as life } from './sportsLife.js';

const { seeded, overall, rosterNames } = sp.internals;
const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

/** Whether the player may refuse a trade: baseball's ten-and-five rule, in the big leagues. */
export const canVeto = (state, e, k) => e.id === 'baseball' && ['us', 'ca'].includes(sp.orgOf(k.orgId, state)?.countryId) && !e.minor
  && state.year - (e.proYear ?? state.year) >= 10 && state.year - k.from >= 5;

/**
 * The year's trade market, for a player under contract in a draft league (engine/sportsLife.js contractYear), before
 * any offer to renew: a player traded in the last year of his contract joins the new club for a year.
 * @returns {boolean} whether a trade happened, or is waiting on the player
 */
export function tradeYear(state, a, e, k) {
  const p = state.player;
  if (k.status !== 'active' || k.from === state.year || e.asia?.service) return false;
  // Nobody trades for a player who cannot play: banned, stopped, or locked up.
  if (e.status !== 'active' || e.banUntil > state.year || p.legal?.incarceration || !p.alive) return false;
  const club = sp.orgOf(k.orgId, state);
  const lg = Object.values(sp.ensure(state).orgs).find((x) => x.kind === 'league' && x.teamIds.includes(club?.teamIds[0]));
  if (!lg || lg.teamIds.length < 2) return false;
  const o = overall(e, p);
  const r = seeded(`trade/${p.id}/${k.id}/${state.year}`);
  // Prospects and useful players move most; clubs keep their stars.
  if (!r.chance(e.minor ? 0.1 : o >= 86 ? 0.03 : 0.07)) return false;
  const to = clubOf(state, r.pick(lg.teamIds.filter((t) => t !== club.teamIds[0])));
  const [name] = rosterNames(r, club.countryId, 1, 'male');
  const forWhom = e.minor ? `${name}, a veteran they need now` : r.chance(0.5) ? `${name} and a prospect` : name;
  const d = { sportId: e.id, contractId: k.id, orgId: to.id, orgName: to.name, from: club.name, forWhom };
  if (canVeto(state, e, k)) {
    if (state.year >= k.to) return false; // the contract is up: he chooses his next club himself
    life.decide(state, { kind: 'trade', ...d, key: `trade/${k.id}/${state.year}`,
      text: `${club.name} have agreed to trade you to ${to.name} for ${forWhom}. With ten years in the game and five with the club, you can refuse.`,
      options: [{ id: 'yes', label: 'Accept the trade' }, { id: 'no', label: 'Refuse it' }] });
    return true;
  }
  return move(state, e, d).ok !== false;
}

/** The trade itself: the contract goes to the new club as it stands. */
function move(state, e, d) {
  const p = state.player;
  const S = sp.ensure(state);
  const old = S.contracts[d.contractId];
  if (!old || old.status !== 'active' || e.status !== 'active' || e.banUntil > state.year || p.legal?.incarceration) return { ...result(false, 'That trade is off.', 'neutral'), close: true };
  const minor = e.minor ? { level: e.minor.level, ladder: e.minor.ladder } : null;
  const pay = p.career.salary;
  life.endContract(state, old, `traded to ${d.orgName}`);
  const res = life.signPro(state, { sportId: e.id, orgId: d.orgId, orgName: d.orgName, salary: old.salary, years: Math.max(1, old.to - state.year), level: old.level, how: 'trade' }, { transfer: true, trade: true });
  if (res.ok === false) return res;
  const to = sp.orgOf(d.orgId, state);
  if (minor) toMinors(state, e, to, minor.level, minor.ladder);
  else { e.minor = null; p.career.salary = Math.max(p.career.salary, pay); }
  (e.trades ??= []).push({ year: state.year, from: d.from, to: d.orgName, for: d.forWhom });
  const text = `${d.from} traded you to ${d.orgName} for ${d.forWhom}. Your contract goes with you.`;
  sp.say(state, text, 'neutral', { screen: 'hub', id: 'career' });
  return result(true, text, 'neutral');
}

export const TRADE_ANSWERS = {
  trade(state, d, choice) {
    const e = sp.entryOf(d.sportId, state.player.id, state);
    if (!e) return { ...result(false, 'That has passed.', 'neutral'), close: true };
    if (choice === 'no') {
      (e.trades ??= []).push({ year: state.year, from: d.from, to: d.orgName, for: d.forWhom, vetoed: true });
      return result(true, `You refused the trade, and stay with ${d.from}.`, 'neutral');
    }
    return move(state, e, d);
  },
};
void milestone;
