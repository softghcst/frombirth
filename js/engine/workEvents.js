// What the choices in working-life scenes (data/events/career.js) do to the
// working state itself: hours, pay, bosses, employers, businesses, and a
// relationship with someone from work. Each returns a sentence to add to the
// outcome, or ''. Also queues the scenes that come from the state of things
// rather than from chance (a relationship at work being noticed; a child
// asking about the player's job).
import { childMoneyChoice } from './childEarnings.js';
import { rng } from '../rng.js';
import { coupleChoice } from './couple.js';
import { clamp, fmtMoney } from '../util.js';
import { store, player, country, npcsByRole, livingNpcs } from '../state.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { CULTURES } from '../data/employers.js';
import { employer, chronicle } from './employers.js';
import { career as careerState, workLaw } from './worklife.js';
import { fire } from './career.js';
import { openBusinesses } from './business.js';
import { remember } from './conditions.js';
import { storyBeat } from './storyDirector.js';

/** The business a scene is about: the player's largest. */
const mainBusiness = () => [...openBusinesses()].sort((a, b) => (b.last?.revenue ?? 0) - (a.last?.revenue ?? 0))[0];

/** Someone the player is with who works at the same employer. */
export function partnerAtWork() {
  const c = careerState();
  if (!c.employerId) return null;
  return livingNpcs().find((n) => ['partner', 'spouse'].includes(n.role) && n.life?.job?.employerId === c.employerId) ?? null;
}

/**
 * Applies a choice. value is a short key, sometimes with arguments after colons.
 * @returns {string} a sentence for the outcome, or ''
 */
export function workChoice(value, cast = {}) {
  const p = player();
  const c = careerState();
  const cty = country();
  const [key, a, b] = String(value).split(':');
  const npc = (k) => store.state.npcs[cast[k]];
  switch (key) {
    case 'childMoney': return childMoneyChoice(a);
    case 'bonus': {
      if (!c.careerId) return '';
      const amount = Math.round(c.salary * Number(a ?? 0.06));
      p.finance.cash += amount;
      p.finance.lifetimeEarned += amount;
      return `The bonus is ${fmtMoney(amount, cty)}.`;
    }
    case 'partTime': {
      // Fewer hours, agreed: the pay follows the hours.
      const car = CAREER_BY_ID[c.careerId];
      if (!car) return '';
      const before = c.hours;
      c.hours = Math.max(16, Math.round(c.hours * 0.6));
      c.extra = 0;
      if (car.payModel !== 'hourly') c.salary = Math.round(c.salary * c.hours / before);
      return `You now work ${c.hours} hours a week${car.payModel !== 'hourly' ? `, on ${fmtMoney(c.salary, cty)} a year` : ''}.`;
    }
    case 'overtime': c.extra = clamp(c.extra + Number(a ?? 5), -10, 15); c.stress = clamp(c.stress + 5); return '';
    case 'stress': c.stress = clamp(c.stress + Number(a ?? 0)); return '';
    case 'satisfaction': c.satisfaction = clamp(c.satisfaction + Number(a ?? 0)); return '';
    case 'newBoss': {
      // The old boss moves on (and stays someone the player knows); the scene's newcomer takes over.
      const old = npcsByRole('tag:boss')[0];
      const e = employer(c.employerId);
      const next = npc('newcomer');
      if (!next || !e) return '';
      if (old && old.id !== next.id) { old.flags.tag = null; old.role = old.meters.relationship >= 60 ? 'friend' : 'colleague'; old.flags.title = old.flags.mentor ? 'Mentor' : 'Former boss'; if (old.life?.job) old.life.job.employerId = null; }
      next.role = 'boss';
      next.flags.tag = 'boss';
      next.flags.title = 'Boss';
      next.flags.workedWith = e.name;
      const car = CAREER_BY_ID[c.careerId];
      if (next.life) next.life.job = { careerId: car.id, level: Math.min(car.levels.length - 1, c.level + 1), title: car.levels[Math.min(car.levels.length - 1, c.level + 1)].title, salary: Math.round(c.salary * 1.4), years: 0, employerId: e.id };
      next.occupation = car.levels[Math.min(car.levels.length - 1, c.level + 1)].title.toLowerCase();
      if (!e.staff.includes(next.id)) e.staff.push(next.id);
      chronicle(e, `${next.firstName} ${next.lastName} took over the team.`);
      return '';
    }
    case 'acquired': {
      // The employer is bought: a new culture, and a new name over the door if the buyer wants one.
      const e = employer(c.employerId);
      if (!e) return '';
      const was = e.name;
      e.culture = rng.pick(Object.keys(CULTURES).filter((k) => k !== e.culture));
      e.health = clamp(e.health + 15);
      if (e.size === 'small') e.size = 'medium';
      chronicle(e, `${was} was bought by a larger company.`);
      return `Under its new owners the place is ${CULTURES[e.culture].label.toLowerCase()}: ${CULTURES[e.culture].blurb.toLowerCase()}`;
    }
    case 'voluntary': {
      // Voluntary redundancy: a bigger check than a layoff brings, and the same door.
      if (!c.careerId) return '';
      const amount = Math.round(c.salary * (0.4 + Math.min(0.6, c.yearsInRole * 0.05)));
      p.finance.cash += amount;
      p.finance.lifetimeEarned += amount;
      const rate = workLaw().unemployment;
      const benefit = rate > 0 ? { amount: Math.round(c.salary * rate), yearsLeft: 1 } : null;
      fire('laid off');
      c.benefit = benefit;
      return `The check is ${fmtMoney(amount, cty)}, on top of the usual severance.`;
    }
    case 'biz': {
      const biz = mainBusiness();
      if (!biz) return '';
      if (a === 'rep') biz.reputation = clamp(biz.reputation + Number(b));
      if (a === 'quality') biz.quality = clamp(biz.quality + Number(b));
      if (a === 'cash') biz.cash += Math.round((biz.last?.revenue ?? 50000 * cty.currency.scale) * Number(b));
      if (a === 'staff') for (const s of biz.staff) { const n = store.state.npcs[s.id]; if (n) n.meters.relationship = clamp(n.meters.relationship + Number(b)); }
      return '';
    }
    case 'romance': {
      // A relationship with someone from work.
      const n = npc('mate') ?? npc('love');
      if (!n) return '';
      if (a === 'start') {
        n.flags.wasRole = n.role;
        n.role = 'partner';
        n.flags.since = p.age;
        n.flags.metAtWork = true;
        delete n.flags.report;
        remember(n, 'metAtWork', 'You met at work, and it became more than work.');
        p.flags.workRomance = { id: n.id, declared: false };
      }
      if (a === 'declare') { p.flags.workRomance = { id: n.id, declared: true }; c.stress = clamp(c.stress - 4); }
      if (a === 'move') {
        // One of them moves to another team or another employer, so neither answers to the other.
        p.flags.workRomance = { id: n.id, declared: true };
        if (n.life?.job) { n.life.job.employerId = null; n.life.job.years = 0; }
        n.flags.movedForUs = true;
      }
      if (a === 'end') { n.role = 'ex'; delete p.flags.workRomance; }
      return '';
    }
    case 'couple': return coupleChoice(a, cast);
    case 'inspire': {
      // A child takes an interest in the player's work, or is told to find their own way.
      const kid = npc('kid');
      if (!kid) return '';
      const fam = CAREER_BY_ID[c.careerId]?.family ?? mainBusiness()?.typeId ?? null;
      if (a === 'yes' && fam) { kid.flags.inspiredBy = CAREER_BY_ID[c.careerId]?.family ?? null; kid.flags.inspiredTrack = c.careerId ?? CAREER_BY_ID[c.lastField]?.id ?? null; }
      if (a === 'own') kid.flags.ownPath = true;
      return '';
    }
    default: return '';
  }
}

/**
 * Scenes that arise from how things stand. Called once a year after the
 * workplace has had its year; at most one is queued.
 */
export function queueWorkScenes() {
  const p = player();
  const c = careerState();
  const state = store.state;
  const recent = (id, yrs) => state.eventHistory.some((h) => h.id === id && p.age - h.lastAge < yrs);
  const push = (id, cast) => { storyBeat(id, cast, { source: id === 'kid_asks_work' ? 'family' : 'work' }, state); return true; };
  if (p.legal.incarceration) return false;
  // Together with someone at the same employer, and nobody has been told.
  const love = partnerAtWork();
  if (love) {
    const wr = p.flags.workRomance?.id === love.id ? p.flags.workRomance : (p.flags.workRomance = { id: love.id, declared: false });
    const boss = npcsByRole('tag:boss')[0];
    const answersTo = (love.life?.job?.level ?? 0) > c.level + 1 || love.flags.report || (boss && boss.id === love.id);
    if (answersTo && !recent('work_romance_conflict', 6)) return push('work_romance_conflict', { love: love.id });
    if (!wr.declared && !recent('work_romance_noticed', 5) && rng.chance(0.5)) return push('work_romance_noticed', { love: love.id });
  } else if (p.flags.workRomance) delete p.flags.workRomance;
  // A child of the right age wonders what the player actually does all day.
  if ((c.careerId || openBusinesses().length) && !recent('kid_asks_work', 8)) {
    const kid = livingNpcs().find((n) => n.role === 'child' && n.age >= 12 && n.age <= 17 && !n.flags.inspiredBy && !n.flags.ownPath && !n.flags.abroad);
    if (kid && rng.chance(0.35)) return push('kid_asks_work', { kid: kid.id });
  }
  return false;
}

