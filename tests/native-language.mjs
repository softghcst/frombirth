// People speak their own country's language from birth: a Puerto Rican is not learning Spanish. Run with:
// node tests/native-language.mjs
const mem = new Map();
globalThis.localStorage ??= { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { nativeLanguages, speaks, hiringEdge } = await import('../js/engine/languages.js');
const { skillOptions } = await import('../js/engine/skills.js');
const { saveGame, peekGame } = await import('../js/save.js');

const problems = [];
const check = (ok, what) => { if (!ok) problems.push(what); };
const life = (countryId) => { for (;;) { store.state = createLife({ countryId }); if (!store.state.player.royal) return store.state.player; } };
const lang = (id) => skillOptions().flatMap((g) => g.skills).find((s) => s.id === id);

let p = life('pr');
check(p.skills.spanish === 100, `a Puerto Rican speaks Spanish from birth (${p.skills.spanish})`);
check(lang('spanish').native && lang('spanish').mastered && lang('spanish').levelName === 'Native', 'Spanish shows as their native language, not one to practice');
check(!lang('french').native && !lang('french').mastered, 'French is still there to learn');

p = life('ma');
check(p.skills.arabic === 100 && p.skills.french === 100, 'a Moroccan speaks Arabic and French');
p = life('jp');
check(p.skills.japanese === 100 && !p.skills.spanish, 'a Japanese child speaks Japanese, not Spanish');
p = life('us');
check(nativeLanguages(p).length === 0 && !Object.keys(p.skills).some((k) => ['spanish', 'french'].includes(k)), 'an American starts with English only (the common tongue)');

// A Mexican in Spain speaks the language already.
p = life('mx');
check(speaks('es', p) === 100, 'a Mexican speaks the language of Spain');
// The native language is not counted as a second language by employers.
const before = hiringEdge(p);
p.skills.french = 70;
check(hiringEdge(p) > before, 'a second language helps with employers');

// An older save, from before native languages were kept, has its language given on loading.
p = life('co'); delete p.skills.spanish;
saveGame(store.state);
check(peekGame(store.state.slotId).player.skills.spanish === 100, 'an older Colombian life speaks Spanish once loaded');

if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log('Everyone speaks the language of the country they were born in.');
