// When someone close dies: a scene with who, how old, and what of, and the funeral; and quick posts, one tap each.
// Run with: node tests/loss-and-posts.mjs
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { tickRelationships } = await import('../js/engine/relationships.js');
const { resolveChoice, renderText } = await import('../js/engine/eventEngine.js');
const { EVENT_BY_ID } = await import('../js/data/events/index.js');

rng.seed(20261123);
const problems = [];
const check = (c, m) => { if (!c) problems.push(m); };

let s; do { s = createLife({ countryId: 'us' }); } while (s.player.royal);
store.state = s;
s.player.age = 30;
const mom = Object.values(s.npcs).find((n) => n.role === 'parent' && n.alive);
mom.age = 118; mom.meters.health = 0;
for (let i = 0; i < 30 && mom.alive; i++) { s.pendingEvents = []; tickRelationships(); }
check(!mom.alive, 'the parent dies');
const pe = s.pendingEvents.find((e) => e.id === 'close_death');
check(pe, 'a scene comes for the death of someone close');
if (pe) {
  const ev = EVENT_BY_ID.close_death;
  const text = renderText(ev.text, pe.cast);
  check(text.includes(mom.firstName) && text.includes(String(mom.age)) && /It was /.test(text) && !/\{|undefined/.test(text), `it names them, their age and the cause (${text})`);
  check(ev.choices.map((c) => c.label).join('|') === 'Go to the funeral|Speak at the funeral|Stay away', 'the choices: go, speak, or stay away');
  const mood = s.player.stats.mood;
  resolveChoice(ev, 2, pe.cast);
  check(s.player.stats.mood < mood, 'staying away is felt');
}
check(mom.flags.cause && s.journal.some((j) => j.text.includes(mom.flags.cause)), `the cause is in the life story too (${mom.flags.cause})`);
// An old person dies of what old people die of; the same person always the same thing.
check(/old age|pneumonia|heart|fall/.test(mom.flags.cause), 'at 118, something of old age');

if (problems.length) { console.log(`${problems.length} problem(s):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('Goodbyes are said.');
