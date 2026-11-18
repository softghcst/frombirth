// Estate and inheritance tax: worked examples, and rules every country's entry must keep.
// Run: node tests/inheritance.mjs
import { COUNTRIES, COUNTRY_LIST } from '../js/data/countries.js';
import { INHERITANCE } from '../js/data/inheritance.js';
import { estateTax, heirTax, lawOf, inheritanceLine, inheritanceShort, topRate } from '../js/engine/inheritance.js';

let failed = 0;
const check = (ok, msg) => { if (!ok) { failed++; console.log('FAIL', msg); } };
const section = (name) => console.log('ok', name);
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
const C = (id) => COUNTRIES[id];
const one = (relation) => [{ relation, share: 1 }];

// Worked examples, by hand from data/inheritance.js.
check(estateTax(500000, C('uk'), one('child')) === 70000, 'UK: 40% of what is above GBP 325,000');
check(estateTax(500000, C('uk'), one('spouse')) === 0, 'UK: nothing when it all goes to a spouse');
check(estateTax(500000, C('uk'), [{ relation: 'spouse', share: 0.5 }, { relation: 'child', share: 0.5 }]) === 0, 'UK: half to a spouse leaves the child\'s half under the band');
check(estateTax(10e6, C('us'), one('child')) === 0 && estateTax(20e6, C('us'), one('child')) === 2e6, 'US: USD 15 million exempt, then 40%');
check(near(heirTax(500000, 'child', C('de')), 75000 * 0.07 + 25000 * 0.11), 'Germany: a child\'s EUR 400,000 allowance, then 7% and 11%');
check(near(heirTax(100000, 'other', C('de')), 80000 * 0.3), 'Germany: others have EUR 20,000 free, then 30%');
check(near(heirTax(200000, 'child', C('fr')), 8072 * 0.05 + 4037 * 0.1 + 3823 * 0.15 + 84068 * 0.2), 'France: EUR 100,000 free for a child, then the direct-line scale');
check(heirTax(1e6, 'spouse', C('fr')) === 0, 'France: a spouse pays nothing');
check(heirTax(2e6, 'child', C('it')) === 40000 && heirTax(100000, 'other', C('it')) === 8000, 'Italy: 4% above EUR 1 million for a child; 8% for others');
check(heirTax(500000, 'child', C('ie')) === 33000 && heirTax(5e6, 'spouse', C('ie')) === 0, 'Ireland: 33% above EUR 400,000; a spouse exempt');
check(heirTax(1e6, 'child', C('hu')) === 0 && near(heirTax(1e6, 'other', C('hu')), 180000), 'Hungary: close family exempt; others 18%');
check(estateTax(1e8, C('ph'), one('child')) === Math.round((1e8 - 5e6) * 0.06), 'Philippines: 6% after a PHP 5 million deduction');
// Japan: JPY 36 million free for one heir; 64 million taxable: 10% of 10m, 15% of 20m, 20% of 20m, 30% of 14m.
check(estateTax(1e8, C('jp'), one('child')) === 1e6 + 3e6 + 4e6 + 4.2e6, 'Japan: one child, the scale on what is above JPY 36 million');
const twoKids = estateTax(1e8, C('jp'), [{ relation: 'child', share: 0.5 }, { relation: 'child', share: 0.5 }]);
check(twoKids < estateTax(1e8, C('jp'), one('child')), 'Japan: two heirs pay less in all than one (a larger allowance, each part on the lower bands)');
check(estateTax(1e8, C('jp'), one('other')) > estateTax(1e8, C('jp'), one('child')), 'Japan: an heir outside the family pays more');
check(estateTax(5e6, C('se'), one('other')) === 0 && estateTax(5e6, C('ca'), one('child')) === 0, 'No tax at death in Sweden or Canada');
check(estateTax(1e6, C('uk'), []) === 0, 'Nothing to tax when nobody inherits (all to charity)');
section('worked examples');

// Every country has an entry, and every entry is well formed.
for (const c of COUNTRY_LIST) {
  const law = INHERITANCE[c.id];
  check(!!law, `${c.id}: no inheritance entry`);
  if (!law) continue;
  check(['estate', 'heir', 'none'].includes(law.kind) && ['pwc', 'wiki', 'partial', 'author'].includes(law.src ?? 'pwc'), `${c.id}: kind or source`);
  const scales = law.kind === 'estate' ? [law.bands] : law.kind === 'heir' ? ['child', 'spouse', 'other'].map((k) => (law[k] === 'child' ? law.child : law[k])).filter(Boolean).map((k) => k.bands) : [];
  for (const b of scales) {
    check(b.length && b.at(-1)[0] === Infinity && b.every(([u, r], i) => r >= 0 && r < 1 && (i === 0 || u > b[i - 1][0])), `${c.id}: a scale must rise in its limits, end at Infinity, and keep rates below 100%`);
  }
  for (const rel of ['child', 'spouse', 'other']) {
    let prev = -1;
    for (const x of [0, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10]) {
      const t = estateTax(x, c, one(rel));
      check(t >= 0 && t <= x && t >= prev, `${c.id} ${rel}: tax on ${x} is ${t}: never negative, never more than the estate, never less on more`);
      prev = t;
    }
  }
  check(estateTax(1e9, c, one('spouse')) <= estateTax(1e9, c, one('other')) + 1, `${c.id}: a spouse never pays more than a stranger`);
  check(typeof inheritanceLine(c) === 'string' && !/NaN|undefined/.test(inheritanceLine(c) + inheritanceShort(c)), `${c.id}: the description reads (${inheritanceLine(c)})`);
  check(topRate(c, 'child') <= topRate(c, 'other') + 1e-9, `${c.id}: a child's top rate is no higher than a stranger's`);
}
check(lawOf('zz').kind === 'none', 'an unknown place charges nothing');
section(`every country (${COUNTRY_LIST.length}): an entry, well-formed scales, sensible taxes and descriptions`);

console.log(failed ? `\n${failed} check(s) failed` : '\nEstate and inheritance tax hold.');
process.exit(failed ? 1 : 0);
