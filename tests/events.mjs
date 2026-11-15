// Checks every scene in js/data/events: unique ids, 2–5 choices, at least one
// choice that is always available, outcomes for every result of a check, and
// only effect types the engine knows. Run with: node tests/events.mjs
import { EVENTS } from '../js/data/events/index.js';
import { ILLNESS_BY_ID } from '../js/data/illnesses.js';

const EFFECTS = new Set(['stat', 'hidden', 'talent', 'cash', 'relationship', 'flag', 'addNpc', 'removeNpc', 'condition', 'cure',
  'gpa', 'legal', 'followers', 'counter', 'milestone', 'death', 'memory', 'queue', 'partTimeScale', 'tag', 'feud', 'perf', 'pay',
  'fired', 'promoted', 'npcSet', 'moveCity', 'property', 'vehicle', 'sellInvestments', 'prison', 'giveVehicle', 'npcTransition']);
const problems = [];
const ids = new Set();
const allIds = new Set(EVENTS.map((e) => e.id));
for (const ev of EVENTS) {
  const at = (msg) => problems.push(`${ev.id}: ${msg}`);
  if (ids.has(ev.id)) at('duplicate id');
  ids.add(ev.id);
  if (!ev.text || !ev.category) at('missing text or category');
  if (!Array.isArray(ev.ageRange) || ev.ageRange[0] > ev.ageRange[1]) at('bad ageRange');
  if (!ev.choices?.length || ev.choices.length > 5) at(`${ev.choices?.length ?? 0} choices`);
  if (!ev.choices?.some((c) => !c.requires?.length)) at('no choice is always available');
  const cast = new Set(Object.keys(ev.cast ?? {}));
  for (const c of ev.choices ?? []) {
    const on = new Set(c.outcomes.map((o) => o.on));
    if (c.check && !(on.has('success') && on.has('fail')) && !on.has('always')) at(`"${c.label}" has a check without both results`);
    if (!c.check && !on.has('always')) at(`"${c.label}" has no outcome`);
    for (const o of c.outcomes) {
      const added = new Set(o.effects.filter((e) => e.type === 'addNpc').map((e) => e.target));
      for (const e of o.effects) {
        if (!EFFECTS.has(e.type)) at(`unknown effect "${e.type}"`);
        if (e.type === 'condition' && !ILLNESS_BY_ID[e.value]) at(`unknown condition "${e.value}"`);
        if (e.type === 'queue' && !allIds.has(e.value)) at(`queues unknown scene "${e.value}"`);
      }
      for (const [, key] of `${ev.text} ${c.label} ${o.text}`.matchAll(/\{([a-zA-Z]+)\}/g)) {
        if (!ev.queuedOnly && !ev.castGiven && !['name', 'city'].includes(key) && !cast.has(key) && !added.has(key)) at(`text uses {${key}} with nobody cast as it`);
      }
    }
  }
}
console.log(`${EVENTS.length} scenes checked.`);
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log('All scenes are well formed.');
