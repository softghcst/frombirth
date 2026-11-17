// What the eras' scenes do. The scenes are in js/data/events/stories/eras.js; the
// history engine (engine/eras.js) decides when they happen.
import { rng } from '../rng.js';
import { clamp, localMoney } from '../util.js';
import { store, player, country, log, milestone } from '../state.js';
import { leaveForWork } from './education.js';
import { CAREER_BY_ID } from '../data/careers.js';

/** Resolves a choice in an era scene. Returns the note added to the outcome text. */
export function decide(value, cast) {
  const p = player();
  const [what, picked] = value.split(':');
  let choice = picked;
  if (what === 'school') {
    if (choice === 'leave') return leaveForWork().text;
    p.hidden.discipline = Math.min(100, p.hidden.discipline + 2);
    return '';
  }
  if (what === 'callup') {
    const war = cast.words?.war ?? 'the war';
    const id = cast.words?.id ?? 'war';
    p.flags.served = { ...(p.flags.served ?? {}), [id]: store.state.year };
    if (choice === 'exempt') {
      const essential = ['trade', 'professional'].includes(CAREER_BY_ID[p.career?.careerId]?.category);
      if (rng.chance(essential ? 0.6 : 0.2)) { milestone(`Exempted from service in ${war} for essential work.`, 'era'); return 'The tribunal agreed: your work at home matters more.'; }
      choice = 'serve';
      log('The tribunal turned you down.', 'system', 'bad');
    }
    if (choice === 'object') {
      p.hidden.karma = clamp(p.hidden.karma + 3);
      p.stats.mood = clamp(p.stats.mood - 4);
      milestone(`Did alternative service as a conscientious objector in ${war}.`, 'era');
      return 'You were sent to work on the land and in hospitals instead. Some people would not speak to you for years.';
    }
    p.flags.serving = war;
    p.stats.mood = clamp(p.stats.mood - 6);
    milestone(`Served in ${war}.`, 'era');
    return 'You will serve until it is over.';
  }
  if (what === 'warnews') {
    if (choice === 'write') for (const n of p.npcIds.map((x) => store.state.npcs[x]).filter((n) => n?.alive && n.meters).slice(0, 4)) n.meters.relationship = clamp(n.meters.relationship + 2);
    if (choice === 'help') { p.hidden.karma = clamp(p.hidden.karma + 2); p.stats.mood = clamp(p.stats.mood + 1); }
    if (choice === 'carry') p.stats.mood = clamp(p.stats.mood - 1);
    return '';
  }
  if (what === 'hard') {
    const c = country();
    if (choice === 'save') { p.hidden.discipline = clamp(p.hidden.discipline + 2); p.stats.mood = clamp(p.stats.mood - 2); }
    if (choice === 'share') { p.hidden.karma = clamp(p.hidden.karma + 3); p.finance.cash = Math.max(0, p.finance.cash - localMoney(200, c)); }
    if (choice === 'work') { const earned = localMoney(rng.int(300, 1200), c); p.finance.cash += earned; p.stats.health = clamp(p.stats.health - 2); }
    return '';
  }
  if (what === 'peace') {
    p.stats.mood = clamp(p.stats.mood + (choice === 'celebrate' ? 6 : 2));
    if (choice === 'remember') p.hidden.karma = clamp(p.hidden.karma + 1);
    return '';
  }
  return '';
}
