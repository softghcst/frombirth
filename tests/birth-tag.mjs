// A baby's hospital tag: the day (during the year just lived), the time, the size (leaning toward the parents' own),
// the doctor and a hospital of the place; the star sign from the day; twins on the same day, a few minutes apart.
// Run with: node tests/birth-tag.mjs
import { store } from '../js/state.js';
import { createLife } from '../js/engine/characterGen.js';
import { tickChildren, cleanName, nameBaby, surnameChoices, NAME_LIMITS } from '../js/engine/children.js';
import { keepsake, weekdayOf, inheritSize, sizeAtBirth, makeBirthInfo, sizeWords, hospitalIn, playerBirthInfo, AT_BIRTH } from '../js/engine/birthTag.js';
import { yearSpan } from '../js/engine/birthday.js';
import { rng } from '../js/rng.js';

const problems = [];
const check = (ok, what) => { if (!ok) problems.push(what); };
const life = (o = {}) => { for (;;) { store.state = createLife({ countryId: 'us', city: 'Chicago', ...o }); if (!store.state.player.royal) return store.state.player; } };

// Size runs in families: babies of parents born big are bigger, on average, than babies of parents born small.
const big = [{ id: 'a', birthInfo: { weightOz: 150, lengthIn: 21.5 } }, { id: 'b', birthInfo: { weightOz: 146, lengthIn: 21.25 } }];
const small = [{ id: 'c', birthInfo: { weightOz: 92, lengthIn: 18.25 } }, { id: 'd', birthInfo: { weightOz: 96, lengthIn: 18.5 } }];
const avg = (parents, k, twin = false) => { let t = 0; for (let i = 0; i < 400; i++) t += inheritSize(`kid${i}`, 'female', parents, twin)[k]; return t / 400; };
check(avg(big, 'weightOz') - avg(small, 'weightOz') > 15, `big parents, bigger babies (${avg(big, 'weightOz').toFixed(1)} oz against ${avg(small, 'weightOz').toFixed(1)})`);
check(avg(big, 'lengthIn') - avg(small, 'lengthIn') > 0.8, 'and longer ones');
check(avg([], 'weightOz', true) < avg([], 'weightOz') - 12, 'twins are smaller');
check(avg([], 'weightOz', 3) < avg([], 'weightOz', true) - 12 && avg([], 'weightOz', 4) < avg([], 'weightOz', 3) - 12, 'triplets smaller still, and quadruplets smaller again');
let lo = Infinity; let hi = 0;
for (let i = 0; i < 2000; i++) { const s = inheritSize(`r${i}`, i % 2 ? 'male' : 'female'); lo = Math.min(lo, s.weightOz); hi = Math.max(hi, s.weightOz); check(s.lengthIn >= 16.5 && s.lengthIn <= 23, 'a length a baby could have'); }
check(lo >= 64 && hi <= 176 && hi - lo > 40, `weights from ${lo} to ${hi} oz`);
check(sizeAtBirth({ id: 'same' }).weightOz === sizeAtBirth({ id: 'same' }).weightOz, 'a parent with no recorded size is given the same one every time');
const boys = avg([], 'weightOz'); let b = 0; for (let i = 0; i < 400; i++) b += inheritSize(`kid${i}`, 'male').weightOz; check(b / 400 > boys, 'boys are a little heavier');

// How it is told: pounds and inches in the US, kilograms and centimeters in France.
check(sizeWords({ countryId: 'us', weightOz: 120, lengthIn: 19.5 }).weight === '7 lbs 8 oz', 'pounds and ounces in the US');
check(sizeWords({ countryId: 'fr', weightOz: 120, lengthIn: 19.5 }).weight === '3.40 kg' && sizeWords({ countryId: 'fr', weightOz: 120, lengthIn: 19.5 }).length === '50 cm', 'kilograms and centimeters in France');

// Hospitals sound like the place, and are the same for every child born in one city.
check(hospitalIn('us', 'Seattle') === hospitalIn('us', 'Seattle'), 'one hospital per city');
const de = new Set(Array.from({ length: 30 }, (_, i) => hospitalIn('de', `Stadt${i}`)));
check([...de].every((h) => /Klinikum|Krankenhaus|Frauenklinik|Universitätsklinikum/.test(h)), `German hospitals sound German (${[...de].slice(0, 3)})`);
const old = makeBirthInfo({ id: 'old', gender: 'female' }, { date: '1910-05-02', countryId: 'uk', city: 'Leeds' });
check(old.atHome && old.place === 'At home' && /midwife/.test(old.doctor), 'long ago, babies were born at home with a midwife');
const now = makeBirthInfo({ id: 'now', gender: 'male' }, { date: '2020-05-02', countryId: 'us', city: 'Chicago' });
check(!now.atHome && /^Dr\. /.test(now.doctor) && /^\d{1,2}:\d{2} (AM|PM)$/.test(now.time) && /^\d{3}$/.test(now.room), `a hospital birth has a doctor, a time and a room (${now.doctor}, ${now.time}, ${now.room})`);

// A child of the player: born on a day of the year just lived, tagged, and the tag shown once.
for (let k = 0; k < 40; k++) {
  const p = life();
  p.age = 30; p.birthYear = store.state.year - 30;
  const partner = Object.values(store.state.npcs).find((n) => n.role === 'parent' && n.gender !== p.gender) ?? Object.values(store.state.npcs).find((n) => n.role === 'parent');
  const span = yearSpan();
  store.state.year += 1; p.age += 1; // as at the birthday that ends the year, when births come
  p.flags.pregnancy = { otherId: partner.id, dueAge: p.age };
  const before = new Set(p.npcIds);
  rng.seed?.(k);
  tickChildren();
  const kids = p.npcIds.filter((id) => !before.has(id)).map((id) => store.state.npcs[id]);
  check(kids.length >= 1 && kids.every((c) => c.birthInfo && c.flags.birthTag === 'new'), 'a newborn has a tag waiting to be shown');
  for (const c of kids) {
    check(c.birthInfo.date >= span.start && c.birthInfo.date <= span.end, `born during the year just lived (${c.birthInfo.date}, ${span.start} to ${span.end})`);
    check(c.birthday.m === Number(c.birthInfo.date.slice(5, 7)) - 1 && c.birthday.d === Number(c.birthInfo.date.slice(8, 10)), 'their birthday is the day on the tag');
  }
  if (kids.length === 2) check(kids[0].birthInfo.date === kids[1].birthInfo.date && kids[0].birthInfo.doctor === kids[1].birthInfo.doctor && kids[0].birthInfo.time !== kids[1].birthInfo.time, 'twins: the same day and doctor, minutes apart');
}

// Naming the baby: the rules for names, the last names on offer, and the day's story told with the name given.
check(cleanName('  Mary-Kate ', 20) === 'Mary-Kate' && cleanName("O'Brien", 30) === "O'Brien" && cleanName('José Luis', 20) === 'José Luis' && cleanName('Zoë', 20) === 'Zoë', 'real names are fine');
check(cleanName('X Æ A-12', 20) === null && cleanName('', 20) === null && cleanName('a'.repeat(21), 20) === null && cleanName('Ann--Lee', 20) === null && cleanName('🙂', 20) === null, 'numbers, emoji, doubled marks and long names are not');
check(NAME_LIMITS.first === 20 && NAME_LIMITS.last === 30, 'first names up to 20, last names up to 30');
{
  const mom = life({ countryId: 'mx', city: 'Guadalajara' });
  mom.gender = 'female'; mom.lastName = 'Ruiz'; mom.age = 30; mom.birthYear = store.state.year - 30;
  const dad = Object.values(store.state.npcs).find((n) => n.role === 'parent');
  dad.gender = 'male'; dad.lastName = 'García'; dad.firstName = 'Miguel';
  store.state.year += 1; mom.age += 1;
  mom.flags.pregnancy = { otherId: dad.id, dueAge: mom.age };
  const before = new Set(mom.npcIds);
  tickChildren();
  const baby = mom.npcIds.filter((id) => !before.has(id)).map((id) => store.state.npcs[id])[0];
  const choices = surnameChoices(baby, mom).map((x) => x.value);
  check(choices[0] === 'García Ruiz', `in Mexico, the father's surname then the mother's comes first (${choices})`);
  check(choices.includes('Ruiz') && choices.includes('García') && choices.includes('Ruiz-García') && choices.includes('García-Ruiz'), 'with each one, and both joined');
  const old = baby.firstName;
  check(!nameBaby(baby.id, 'Luna 2', 'García').ok, 'a name with a number is turned down');
  const r = nameBaby(baby.id, 'Luna', 'García Ruiz');
  check(r.ok && baby.firstName === 'Luna' && baby.lastName === 'García Ruiz', 'the baby is named');
  check(old === 'Luna' || !store.state.journal.filter((e) => e.age === mom.age).some((e) => new RegExp(`\\b${old}\\b`).test(e.text)), 'the day\'s story uses the new name');
  check(store.state.journal.some((e) => e.age === mom.age && /Luna/.test(e.text)), 'and says it');
}

// A baby first called José, renamed: the story says the new name (accented letters are letters).
{
  const p = life();
  p.age = 30; p.birthYear = store.state.year - 30;
  const partner = Object.values(store.state.npcs).find((n) => n.role === 'parent');
  store.state.year += 1; p.age += 1;
  p.flags.pregnancy = { otherId: partner.id, dueAge: p.age };
  const before = new Set(p.npcIds);
  tickChildren();
  const baby = p.npcIds.filter((id) => !before.has(id)).map((id) => store.state.npcs[id])[0];
  for (const e of store.state.journal.filter((x) => x.age === p.age)) e.text = e.text.split(baby.firstName).join('José');
  baby.firstName = 'José';
  nameBaby(baby.id, 'Mateo', p.lastName);
  check(!store.state.journal.some((e) => e.age === p.age && /José/.test(e.text)) && store.state.journal.some((e) => e.age === p.age && /Mateo/.test(e.text)), 'José becomes Mateo in the story');
}

// The player's own tag: made once, and the same when asked again.
const me = life();
const t1 = JSON.stringify(playerBirthInfo(me));
check(t1 === JSON.stringify(playerBirthInfo(me)) && me.birthInfo.date.endsWith(`-${String(me.birthday.m + 1).padStart(2, '0')}-${String(me.birthday.d).padStart(2, '0')}`), 'your own tag is dated on your birthday');
check(AT_BIRTH.weight === 120, 'the average baby weighs 7 lbs 8 oz');

// The back: the day of the week, the birthstone and flower of the month, a note, who the baby takes after.
check(weekdayOf('2026-11-25') === 'Wednesday' && weekdayOf('2000-01-01') === 'Saturday', 'days of the week are right');
const ks = keepsake({ id: 'kk', birthInfo: { date: '2027-02-18', doctor: 'Dr. Ramirez' }, talents: { singing: 90 } }, [], () => 'winter', true);
check(ks.day === 'Born on a snowy Thursday' && ks.stone[0] === 'Amethyst' && ks.flower[0] === 'Violet', `the day, the stone, the flower (${ks.day}, ${ks.stone[0]}, ${ks.flower[0]})`);
check(/lungs|Sang/.test(ks.note), `a singer's note (${ks.note})`);
check(ks.stamp && /Ward \d/.test(ks.signoff) && /^#\d{2}-\d{4}$/.test(ks.bracelet), 'a stamp, a sign-off and a wristband number');
const mom = { firstName: 'Ana', gender: 'female', appearance: { inherited: { nose: 'nose_3', eyes: 'eyes_1', hairColor: 'black' } } };
const dad = { firstName: 'Ben', gender: 'male', appearance: { inherited: { nose: 'nose_9', eyes: 'eyes_7', hairColor: 'brown' } } };
const kid = { id: 'kid', birthInfo: { date: '2027-06-01', doctor: 'Dr. A' }, appearance: { inherited: { nose: 'nose_3', eyes: 'eyes_7', hairColor: 'red' } } };
const looks = keepsake(kid, [mom, dad], () => 'summer').looks;
check(/Mom's nose/.test(looks) && /Dad's eyes/.test(looks), `who they take after (${looks})`);
check(keepsake({ ...kid, appearance: { inherited: { nose: 'x', eyes: 'y' } } }, [mom, dad], () => 'summer').looks.startsWith('Looks like nobody else'), 'a baby who takes after nobody');
check(keepsake({ id: 'h', birthInfo: { date: '1910-03-01', doctor: 'Mrs. Bell, midwife', atHome: true } }, [], () => 'spring').signoff === 'With love, Mrs. Bell', 'a midwife signs her own');

if (problems.length) { console.log([...new Set(problems)].join('\n')); process.exit(1); }
console.log('Every baby gets a hospital tag, sized like their family.');
