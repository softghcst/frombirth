// People speak their own country's language from birth: a Puerto Rican is not learning Spanish. Run with:
// node tests/native-language.mjs
const mem = new Map();
globalThis.localStorage ??= { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { nativeLanguages, speaks, hiringEdge } = await import('../js/engine/languages.js');
const { skillOptions, usesOf, practice } = await import('../js/engine/skills.js');
const { languageNote, workLanguageNote } = await import('../js/engine/languages.js');
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

// More languages: an Italian speaks Italian, a Thai Thai, a Kazakh Kazakh and Russian; each skill says what it is for.
p = life('it'); check(p.skills.italian === 100, 'an Italian speaks Italian');
p = life('th'); check(p.skills.thai === 100, 'a Thai speaks Thai');
p = life('kz'); check(p.skills.kazakh === 100 && p.skills.russian === 100, 'a Kazakh speaks Kazakh and Russian');
p = life('ch'); check(p.skills.german === 100 && p.skills.french === 100 && p.skills.italian === 100, 'a Swiss speaks German, French and Italian');
check(/Italy/.test(usesOf('italian')) && /Switzerland/.test(usesOf('italian')), `what Italian is for (${usesOf('italian')})`);
check(/computer science/.test(usesOf('coding')), 'what coding is for');
check(skillOptions().flatMap((g) => g.skills).every((s) => s.uses), 'every skill says what it is for');
// Notes on the screens.
p = life('us');
check(languageNote('us') === '', 'nothing to say where no language is needed');
check(languageNote('it').startsWith('✗'), 'an American who does not speak Italian is told it is harder');
p.skills.italian = 75;
check(languageNote('it').startsWith('✓'), 'and one who does is told it helps');
check(/Italian/.test(workLanguageNote()), 'employers counting Italian shows on the job screen');
// Practice says what a level opens.
p.age = 20; p.skills.japanese = 58; p.flags.practice = undefined;
const r = practice('japanese');
if (r.ok && p.skills.japanese >= 60) check(/employers/.test(r.text) && /Japanese/.test(r.text), `reaching Good says what it opens (${r.text})`);

if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log('Everyone speaks the language of the country they were born in.');
