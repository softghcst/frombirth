// Every country has enough names that a family's children, and the people around them, are not all called the same
// thing. Run with: node tests/name-variety.mjs
import { COUNTRIES } from '../js/data/countries.js';

const problems = [];
for (const c of Object.values(COUNTRIES)) {
  for (const k of ['male', 'female']) {
    const n = new Set(c.names[k]).size;
    if (n < 45) problems.push(`${c.name}: only ${n} ${k} first names`);
  }
  if (new Set(c.names.last).size < 40) problems.push(`${c.name}: only ${new Set(c.names.last).size} surnames`);
  if (c.names.male.some((x) => /_/.test(x))) problems.push(`${c.name}: an underscore left in a name`);
}
if (!COUNTRIES.ve.names.last.includes('Subero')) problems.push('Venezuela has Subero');
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log('Every country has a wide choice of names.');
