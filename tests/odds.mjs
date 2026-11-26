// Chances the player can read (js/engine/odds.js): a chance in plain words before a roll, and after it whether it
// was close; the roll itself unchanged, so nothing else in a life rolls differently. Run with: node tests/odds.mjs
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { oddsWords, rollRead, afterWords } from '../js/engine/odds.js';

const problems = [];
const check = (c, m) => { if (!c) problems.push(m); };

check(oddsWords(0.9) === 'very likely' && oddsWords(0.65) === 'likely' && oddsWords(0.5) === 'about even' && oddsWords(0.3) === 'unlikely' && oddsWords(0.1) === 'a long shot', 'a chance in plain words');

// The roll uses the dice exactly as rng.chance does: one draw.
rng.seed(42);
const plain = Array.from({ length: 20 }, () => rng.chance(0.5));
const after = rng.next();
rng.seed(42);
const read = Array.from({ length: 20 }, () => rollRead(rng, 0.5).ok);
check(plain.join() === read.join() && rng.next() === after, 'reading a roll takes the same dice as rolling it');

// Close misses and long shots are said; an ordinary result says nothing extra.
const fixed = (v) => ({ next: () => v });
check(rollRead(fixed(0.55), 0.5).close && afterWords(rollRead(fixed(0.55), 0.5)).includes('close'), 'a miss by a little is close');
check(!rollRead(fixed(0.9), 0.5).close && afterWords(rollRead(fixed(0.9), 0.5)) === '', 'a clear miss is just a miss');
check(rollRead(fixed(0.1), 0.2).longShot && /long shot/.test(afterWords(rollRead(fixed(0.1), 0.2))), 'a long shot that came off is said');

// Where the player applies, the chances are shown first.
rng.seed(7);
do { store.state = createLife({ countryId: 'us' }); } while (store.state.player.royal);
const p = store.state.player;
p.age = 30; p.birthYear = store.state.year - 30; p.flags.livesWithParents = false; p.education.enrolled = false;
p.education.degrees.push({ type: 'high', gpa: 3.4, age: 18 }, { type: 'university', majorId: 'biology', gpa: 3.5, age: 22 });
const edu = await import('../js/engine/education.js');
const grad = edu.programOptions().find((o) => o.id === 'graduate');
check(grad?.eligible && ['very likely', 'likely', 'about even', 'unlikely', 'a long shot'].includes(grad.odds), `graduate school shows the chances (${grad?.odds})`);
const C = await import('../js/engine/investigations/careers.js');
const o = C.policeOdds(p);
check(o.chance > 0 && o.chance <= 1 && typeof o.words === 'string', `a police application shows the chances (${o.words}, weakest: ${o.weakest})`);

if (problems.length) { console.log(`${problems.length} problem(s):\n${problems.map((x) => ` - ${x}`).join('\n')}`); process.exit(1); }
console.log('Chances can be read, and the dice are the same.');
