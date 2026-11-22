// Run from the repository root: node scripts/balance/business.mjs [seed] [runs per kind]
// Business balance: for every kind of business, open it with a sensible crew and a full-time owner, run 15
// years (business tick only, for speed), and report survival, profit as a multiple of a local wage, and value.
import { store } from '../../js/state.js';
import { rng } from '../../js/rng.js';
import { createLife } from '../../js/engine/characterGen.js';
import { BUSINESS_TYPES } from '../../js/data/business.js';
import * as biz from '../../js/engine/business.js';
import * as work from '../../js/engine/worklife.js';

rng.seed(Number(process.argv[2] ?? 11));
const RUNS = Number(process.argv[3] ?? 12);
const YEARS = 15;
const rows = [];
for (const t of BUSINESS_TYPES) {
  let failed = 0; const profits = []; const vals = []; const take = [];
  for (let r = 0; r < RUNS; r++) {
    do { store.state = createLife({ countryId: ['us', 'uk', 'de', 'in', 'br', 'jp'][r % 6] }); } while (store.state.player.royal);
    const p = store.state.player;
    p.age = 32; p.education.enrolled = false; p.education.stage = 'none'; p.finance.cash = 1e9; p.stats.intellect = 60; p.hidden.discipline = 55;
    p.education.degrees.push({ type: 'high', gpa: 3, age: 18 }, { type: 'university', majorId: 'business', gpa: 3, age: 22 }, { type: 'apprenticeship', majorId: t.needs.trade ?? 'electrician', gpa: 3, age: 21 });
    if (t.needs.program) { p.education.degrees.push({ type: t.needs.program, gpa: 3.5, age: 26 }); (p.flags.licenses ??= []).push(t.needs.program); }
    const c = work.career();
    c.experience = Object.fromEntries([...Object.keys(t.needs.experience ?? {}), t.track].map((k) => [k, 6]));
    c.experience.office = 12;
    const res = biz.start(t.id, null, { borrow: 0 });
    if (!res.ok) { rows.push([t.id, 'BLOCKED: ' + res.text]); break; }
    const b = biz.openBusinesses()[0];
    p.finance.cash = 0;
    const f = biz.figures(t, b.countryId, b.city);
    const crew = t.solo ? 0 : 2;
    for (let i = 0; i < crew; i++) biz.hire(b, 0);
    let profitSum = 0;
    for (let y = 0; y < YEARS && b.status === 'open'; y++) {
      p.age += 1; store.state.year += 1;
      biz.tickBusinesses();
      // A sensible owner: hire when turning custom away and the account allows it.
      if (b.status === 'open' && b.last && b.last.demand > b.last.heads * 1.3 && b.cash > f.wage) biz.hire(b, biz.staffOf(b).length < 5 ? 0 : null);
      if (b.status === 'open' && b.last && b.last.heads > b.last.demand * 1.6 && b.others) biz.letGo(b);
      if (b.last) profitSum += b.last.profit;
    }
    if (b.status !== 'open') failed += 1;
    else { profits.push(profitSum / YEARS / f.wage); vals.push(biz.valuation(b) / f.wage); take.push((b.last?.drawn ?? 0) / f.wage); }
  }
  const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN);
  rows.push([t.id, `failed ${failed}/${RUNS}`, `profit/yr ${med(profits).toFixed(1)}× a wage`, `owner takes ${med(take).toFixed(1)}×`, `worth ${med(vals).toFixed(0)}×`]);
}
for (const r of rows) console.log(r.join('  '));
