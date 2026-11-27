// The shareable obituary card: what goes on it, the words that go with it, and the portrait made drawable.
// The drawing itself needs a browser (see the Playwright check); this covers everything that does not.
// Run: node tests/sharecard.mjs
import { cardFacts, shareText, selfContained } from '../js/ui/shareCard.js';
import { avatarSvg } from '../js/avatar/render.js';
import { readFile } from 'node:fs/promises';

let failed = 0;
const check = (ok, msg) => { if (!ok) { failed++; console.log('FAIL', msg); } };
const grave = (o = {}) => ({ fullName: 'Ada Moreno', birthYear: 1990, deathYear: 2071, ageAtDeath: 81, causeOfDeath: 'heart failure', countryId: 'mx', city: 'Oaxaca',
  lastOccupation: 'Architect', netWorth: 1234567, epitaphIds: [], childrenCount: 2, grandchildrenCount: 1, spouseName: 'Luis', counters: { countriesLived: 1 },
  milestones: [{ age: 18, text: 'Moved out.' }, { age: 23, text: 'Graduated from university.' }, { age: 30, text: 'Married Luis.' }, { age: 55, text: 'Elected governor of Oaxaca.' }, { age: 60, text: 'Bought a boat.' }], ...o });

const f = cardFacts(grave());
check(f.name === 'Ada Moreno' && f.years === '1990 – 2071' && f.cause === 'Died of heart failure, aged 81.', 'name, years and cause');
check(f.highlights.length === 2 && f.highlights[0] === 'Age 23 · Graduated from university.' && f.highlights[1] === 'Age 55 · Elected governor of Oaxaca.', `the two most telling milestones, in order of age (${f.highlights})`);
check(f.facts[0][1] === 'Oaxaca, Mexico' && /1,234,567/.test(f.facts[2][1]) && f.facts[3][1] === 'married, 2 children, 1 grandchild', `facts: ${JSON.stringify(f.facts)}`);
check(cardFacts(grave({ counters: { countriesLived: 4 } })).facts[3].join(' ') === 'Lived in 4 countries', 'a life in several countries says so');
check(cardFacts(grave({ milestones: [{ age: 5, text: 'Lost a tooth.' }] })).highlights.length === 0, 'nothing ordinary is held up as a highlight');
check(cardFacts(grave({ countryId: 'zz' })).facts[0][1] === 'Oaxaca', 'an unknown country does not break it');
const t = shareText(grave(), 'https://example.org/frombirth/');
check(t.startsWith('Ada Moreno (1990 – 2071).') && t.includes('in Oaxaca, Mexico') && t.includes('At 23: Graduated') && t.endsWith('https://example.org/frombirth/'), `the words: ${t}`);
check(!/undefined|NaN/.test(t + JSON.stringify(f)), 'no gaps in the words');

// The portrait: every part a canvas could not load is put inside the SVG itself.
const svg = avatarSvg({ age: 70, gender: 'female', seed: 'test-seed' });
const files = new Set([...svg.matchAll(/href="([^"#]+)#/g)].map((m) => m[1]));
const out = await selfContained(svg, (u) => readFile(new URL(`../${u.replace(/^\.\//, '')}`, import.meta.url), 'utf8'));
check(files.size > 3, `the portrait uses several art files (${files.size})`);
check(!/href="\.?\/?assets\//.test(out) && !/href="[^"#]/.test(out), 'no reference to an outside file is left');
const ids = new Set([...out.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const refs = [...out.matchAll(/href="#([^"]+)"|url\(#([^)]+)\)/g)].map((m) => m[1] ?? m[2]);
const missing = refs.filter((r) => !ids.has(r));
check(missing.length === 0, `every reference points at something inside (${missing.slice(0, 5)})`);
check(ids.size === [...out.matchAll(/\bid="/g)].length, 'no two parts share an id');

console.log(failed ? `\n${failed} check(s) failed` : 'ok   card facts, words and a self-contained portrait\nThe shareable card holds.');
process.exit(failed ? 1 : 0);
