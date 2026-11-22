// Run from the repository root: node scripts/balance/careers.mjs [seed] [lives] [best|typical]
// Career balance: whole working lives (18 to 66) with a simple job-seeking player, across countries and
// education levels. Reports employment, layoffs, promotions, pay against the country's average, stress,
// burnout, milestones, and how often each scene fires.
import { store } from '../../js/state.js';
import { rng } from '../../js/rng.js';
import { createLife } from '../../js/engine/characterGen.js';
import { advanceYear } from '../../js/engine/yearProcessor.js';
import { CAREER_BY_ID } from '../../js/data/careers.js';
import { COUNTRIES } from '../../js/data/countries.js';
import { localWage } from '../../js/util.js';
import * as market from '../../js/engine/employers.js';
import * as hiring from '../../js/engine/hiring.js';
import * as work from '../../js/engine/worklife.js';
import * as career from '../../js/engine/career.js';

rng.seed(Number(process.argv[2] ?? 3));
const LIVES = Number(process.argv[3] ?? 24);
const POLICY = process.argv[4] ?? 'best'; // 'best': always the best-paid job; 'typical': any job they qualify for
const EDU = ['none', 'trade', 'degree', 'degree'];
const T = { workYears: 0, employedYears: 0, layoffs: 0, fired: 0, quits: 0, promos: 0, burnouts: 0, applications: 0, offers: 0, payRatio: [], stress: [], sat: [], ach: {}, scenes: {}, peakLevel: [], jobs: [], byEdu: {} };
for (let i = 0; i < LIVES; i++) {
  const cid = ['us', 'uk', 'de', 'in', 'br', 'jp', 'ng', 'mx'][i % 8];
  do { store.state = createLife({ countryId: cid }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = 18; p.birthYear = store.state.year - 18; p.education.enrolled = false; p.education.stage = 'none'; p.flags.livesWithParents = false;
  const edu = EDU[i % 4];
  p.education.degrees.push({ type: 'high', gpa: 3, age: 18 });
  if (edu === 'trade') p.education.degrees.push({ type: 'apprenticeship', majorId: ['electrician', 'plumber', 'carpenter', 'mechanic'][i % 4], gpa: 3, age: 21 });
  if (edu === 'degree') p.education.degrees.push({ type: 'university', majorId: ['business', 'computer_science', 'nursing', 'english', 'biology'][i % 5], gpa: 3.2, age: 22 });
  const avg = localWage(45000, COUNTRIES[cid]); // a rough national average wage for the comparison
  let peak = 0; let held = 0;
  const e = (T.byEdu[edu] ??= { years: 0, employed: 0, pay: [] });
  for (let y = 0; y < 48 && p.alive; y++) {
    const c = work.career();
    // The player: looks for work when out of it, and once every few years for something better.
    if (!c.careerId || (y % 4 === 0 && c.yearsInRole >= 3)) {
      const views = market.board({ scope: 'country', partTime: false }).map((x) => hiring.postingView(x.id)).filter((v) => v?.eligible)
        .sort((a, b) => (POLICY === 'best' ? b.post.level - a.post.level || b.post.pay[1] - a.post.pay[1] : rng.next() - 0.5));
      for (const v of views.slice(0, c.careerId ? 1 : 3)) {
        if (c.careerId && v.post.pay[0] <= c.salary) continue;
        T.applications += 1;
        const a = hiring.apply(v.post.id);
        if (a.kind !== 'interview' && a.kind !== 'audition') continue;
        const answers = a.kind === 'interview' ? a.questions.map((q) => q.a[rng.int(0, Math.min(1, q.a.length - 1))]) : [0];
        const d = hiring.decide(v.post.id, answers);
        if (d.offer) { T.offers += 1; if (hiring.accept(d.offer.id).ok) { held += 1; break; } }
      }
    }
    if (c.careerId && rng.chance(0.3)) career.workHarder();
    const hist = c.history.length;
    const promos = c.promotions ?? 0;
    try { advanceYear(); } catch (err) { console.log('FAIL', cid, p.age, err.stack.split('\n').slice(0, 3).join(' | ')); break; }
    for (const ev of store.state.pendingEvents) T.scenes[ev.id] = (T.scenes[ev.id] ?? 0) + 1;
    store.state.pendingEvents = []; p.legal.pending = null; p.legal.incarceration = null; p.stats.health = Math.max(p.stats.health, 70);
    const cc = work.career();
    for (const h of cc.history.slice(hist)) { if (h.exit === 'laid off') T.layoffs += 1; if (h.exit === 'fired') T.fired += 1; if (h.exit === 'left for another job') T.quits += 1; }
    T.promos += (cc.promotions ?? 0) - promos;
    if (p.flags.burnedOut === store.state.year) T.burnouts += 1;
    if (p.age >= 25 && p.age <= 64) {
      T.workYears += 1; e.years += 1;
      if (cc.careerId) {
        T.employedYears += 1; e.employed += 1;
        T.payRatio.push(cc.salary / avg); e.pay.push(cc.salary / avg);
        T.stress.push(cc.stress); T.sat.push(cc.satisfaction);
        peak = Math.max(peak, cc.level);
      }
    }
  }
  T.peakLevel.push(peak); T.jobs.push(held);
  for (const a of work.career().achievements) T.ach[a.name] = (T.ach[a.name] ?? 0) + 1;
}
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) * q)] : NaN; };
const f1 = (x) => x.toFixed(2);
console.log(`[${POLICY}] lives ${LIVES}; ages 25–64 employed ${(100 * T.employedYears / T.workYears).toFixed(0)}% of years`);
console.log(`per life: ${f1(T.layoffs / LIVES)} layoffs, ${f1(T.fired / LIVES)} firings, ${f1(T.quits / LIVES)} moves, ${f1(T.promos / LIVES)} promotions, ${f1(T.burnouts / LIVES)} burnouts; jobs taken ${f1(T.jobs.reduce((a, b) => a + b, 0) / LIVES)}`);
console.log(`applications ${T.applications}, offers ${T.offers} (${(100 * T.offers / Math.max(1, T.applications)).toFixed(0)}%)`);
console.log(`pay ÷ national average: p10 ${f1(pct(T.payRatio, 0.1))}  median ${f1(pct(T.payRatio, 0.5))}  p90 ${f1(pct(T.payRatio, 0.9))}`);
for (const [k, v] of Object.entries(T.byEdu)) console.log(`  ${k.padEnd(6)} employed ${(100 * v.employed / v.years).toFixed(0)}%, median pay ${f1(pct(v.pay, 0.5))}×`);
console.log(`stress median ${pct(T.stress, 0.5)} (p90 ${pct(T.stress, 0.9)}); satisfaction median ${pct(T.sat, 0.5)} (p10 ${pct(T.sat, 0.1)})`);
console.log(`highest rung reached: ${JSON.stringify(T.peakLevel.reduce((m, l) => ({ ...m, [l]: (m[l] ?? 0) + 1 }), {}))}`);
console.log('milestones:', Object.entries(T.ach).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
const work_ = Object.entries(T.scenes).filter(([k]) => /^(wf_|wp_|fd_|biz_|wr_|work_|kid_asks)/.test(k));
console.log('work scenes queued:', work_.sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none');
