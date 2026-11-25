// Real laws in the game: cited by name and year, and deciding things the way they did when they were in force.
// Run with: node tests/real-law.mjs
import { store, rng, ls, lc, check, finish, lawyer } from './helpers/lawSetup.mjs';
import * as rl from '../js/engine/realLaw.js';
const { syncWorld } = await import('../js/engine/history.js');

rng.seed(20261130);
const setYear = (y) => { store.state.year = y; syncWorld(y); };

// What governs, when.
check(rl.governing('search', 'us', 1955).id === 'us_fourth' && rl.governing('search', 'us', 1970).id === 'us_mapp', 'US searches: the Fourth Amendment alone before 1961, Mapp v. Ohio after');
check(!rl.exclusion('unlawful_search', 'us', 1955).allowed && rl.exclusion('unlawful_search', 'us', 1990).allowed, 'no exclusionary rule in state courts before 1961; one after');
check(rl.exclusion('coerced', 'us', 1950).allowed && rl.governing('confession', 'us', 1975).id === 'us_miranda' && rl.governing('confession', 'us', 1990).id === 'us_edwards', 'confessions: coercion (1936), Miranda (1966), Edwards (1981)');
check(!rl.exclusion('unlawful_search', 'uk', 1980).allowed && rl.exclusion('unlawful_search', 'uk', 1990).allowed, 'England: R v Sang (1979) gave no discretion to exclude; PACE section 78 (in force 1986) does');
check(rl.divorceNeedsFault('us', 1960).fault && !rl.divorceNeedsFault('us', 1985).fault, 'US divorce: fault before no-fault (California, 1970); not after');
check(rl.divorceNeedsFault('uk', 1960).fault && !rl.divorceNeedsFault('uk', 1990).fault && rl.governing('divorce', 'uk', 2023).id === 'uk_ddsa', 'England: a matrimonial offense before 1971; five facts after; no-fault from 2022');
check(rl.courtName('uk', 'trial', 1960).startsWith('Assizes') && rl.courtName('uk', 'trial', 1980) === 'Crown Court' && /special inquiry/.test(rl.courtName('us', 'immigration', 1975)), 'court names of their time: the Assizes before the Crown Court (1972); US immigration hearings before 1983');
check(!rl.governing('search', 'mx', 2020) && !rl.governing('custody', 'mx', 2020), 'a country whose laws are not listed borrows none');

// In play: the motion to suppress in The State v. Morgan Hale, in 1955 and in 2000.
const rate = (year) => {
  let granted = 0; let text = '';
  for (let i = 0; i < 16; i++) {
    lawyer('lawyer');
    setYear(year);
    const c = lc.createCase('burglary_hale', { role: 'defense' });
    lc.research(c, lc.researchQuestion(c).right);
    const r = lc.file(c, 'strong');
    if (c.filings[0].ruling === 'granted') granted++;
    text = r.text;
  }
  return { granted, text };
};
const old = rate(1955);
const now = rate(2000);
check(old.granted === 0 && now.granted >= 6, `the same motion: granted ${old.granted} of 16 in 1955 (no exclusionary rule yet), ${now.granted} of 16 in 2000`);
check(/Mapp|Fourth Amendment/.test(old.text + now.text), `the ruling cites the law (${old.text.slice(0, 140)})`);

// The case file names its laws; research cites them.
lawyer('lawyer'); setYear(2020);
const hale = lc.createCase('burglary_hale', { role: 'defense' });
const names = rl.caseLaws(hale).map((x) => x.law.name);
check(['Mapp v. Ohio (1961)', 'In re Winship (1970)', 'Batson v. Kentucky (1986)', 'Neil v. Biggers (1972)'].every((n) => names.includes(n)), `a 2020 burglary trial lists its law (${names.join('; ')})`);
check(/Mapp v\. Ohio/.test(lc.research(hale, lc.researchQuestion(hale).right).text), 'research cites the law that decides the issue');

// A divorce in 1960 needs fault; disclosure before Brady; racial jury strikes.
setYear(1960);
const d = lc.createCase('divorce');
check(d.faultRequired && d.evidence.some((e) => e.id === 'fault') && /fault ground/.test(d.summary), 'a 1960 divorce needs proof of a fault ground');
lawyer('prosecutor'); setYear(1955);
const p55 = lc.createCase('theft', { role: 'prosecution' });
lc.fileProcedure(p55, 'disclosure', 'improper');
check(!p55.errors.some((e) => e.kind === 'disclosure') && ls.lawOf().misconduct === 1, 'withholding in 1955: no rule of law yet (Brady came in 1963), still misconduct');
setYear(2005);
const p05 = lc.createCase('theft', { role: 'prosecution' });
lc.fileProcedure(p05, 'disclosure', 'improper');
check(p05.errors.some((e) => /Brady/.test(e.text)), 'withholding in 2005 is contrary to Brady v. Maryland, and a ground of appeal');
lawyer('lawyer'); setYear(2010);
const j = lc.createCase('burglary_hale', { role: 'defense' });
j.awaiting = { what: 'trial', since: ls.nowM(), turn: ls.nowM() };
const r = lc.argue(j, { jury: 'race' });
check(/Batson/.test(r.text) && ls.lawOf().rep.integrity < 50, 'striking jurors for their race: the judge stops it, citing Batson v. Kentucky');
check(rl.eraNotes('us', 1940).some((x) => /Sweatt v\. Painter/.test(x)) && !rl.eraNotes('us', 2000).length, 'the history of who was kept out of law school is told for its time');
setYear(2026);

finish('Real laws hold, in their time.');
