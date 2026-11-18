// The arithmetic of elections, checked on small hand-built cases.
// Run with: node tests/elections.mjs
import { alignment, vote, proportional, districts, firstRound, distance, formGovernment, auditResult, duel, countByArea } from '../js/engine/elections.js';

let failed = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { failed += 1; console.log(`FAIL ${name}\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`); } else console.log(`ok   ${name}`);
};
const yes = (name, cond) => eq(name, !!cond, true);

// A seeded generator, so the random cases are the same every run.
function seeded(seed) { let s = seed; const next = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; return (n) => (next() * 2 - 1) * n; }

const left = { id: 'left', positions: { tax: 2, services: 2, order: -1 }, appeal: 0 };
const right = { id: 'right', positions: { tax: -2, services: -1, order: 2 }, appeal: 0 };
const center = { id: 'center', positions: { tax: 0, services: 1, order: 0 }, appeal: 0 };
const workers = { id: 'workers', share: 0.5, turnout: 0.6, cares: { tax: 1, services: 2 }, wants: { tax: 2, services: 2 } };
const owners = { id: 'owners', share: 0.5, turnout: 0.7, cares: { tax: 2, order: 1 }, wants: { tax: -2, order: 2 } };

yes('a group is closer to the party that shares its wants', alignment(left, workers) > alignment(right, workers) && alignment(right, owners) > alignment(left, owners));
{
  const r = vote([left, right, center], [workers, owners]);
  eq('votes add up to the number cast, and shares to 100', auditResult(r), []);
  yes('each group leans to its own side', r.byGroup.workers.left > r.byGroup.workers.right && r.byGroup.owners.right > r.byGroup.owners.left);
  yes('turnout is a believable percentage', r.turnout > 50 && r.turnout < 80);
  yes('the group that turns out more counts for more', r.shares.right > r.shares.left);
}
{
  const r1 = vote([left, right], [workers, owners]);
  const r2 = vote([{ ...left, appeal: 12 }, right], [workers, owners]);
  yes('a popular leader moves votes, without deciding everything', r2.shares.left > r1.shares.left && r2.shares.left < 80);
}
{ // Same inputs and the same seed give the same result: an election is never rerolled.
  const a = vote([left, right, center], [workers, owners], seeded(7));
  const b = vote([left, right, center], [workers, owners], seeded(7));
  eq('the same seed gives the same election', a, b);
  let bad = 0;
  for (let s = 1; s <= 300; s++) { const r = vote([left, right, center], [workers, owners], seeded(s), 100000 + s * 977); if (auditResult(r).length) bad += 1; }
  eq('300 random elections: every one adds up', bad, 0);
}

eq('proportional seats follow the votes', proportional({ a: 500, b: 300, c: 200 }, 10), { a: 5, b: 3, c: 2 });
eq('every seat is filled', Object.values(proportional({ a: 417, b: 333, c: 250 }, 7)).reduce((x, y) => x + y, 0), 7);
eq('a party under the threshold gets nothing', proportional({ a: 600, b: 370, c: 30 }, 10, 5).c, 0);
{
  const s = districts({ a: 42, b: 38, c: 20 }, 200, seeded(3));
  eq('district seats: all filled', Object.values(s).reduce((x, y) => x + y, 0), 200);
  yes('district seats favor the largest and squeeze the smallest', s.a / 200 > 0.42 && s.c / 200 < 0.2 && s.c > 0);
}
eq('over half in the first round: no run-off', firstRound({ a: 54, b: 30, c: 16 }), { leader: 'a', second: 'b', runoff: false });
eq('nobody over half: a run-off between the top two', firstRound({ a: 41, b: 35, c: 24 }), { leader: 'a', second: 'b', runoff: true });

yes('parties that agree are close; opposites are far', distance(left, center) < distance(left, right));
eq('a majority governs alone', formGovernment([left, right, center], { left: 55, right: 30, center: 15 }), { lead: 'left', partners: [], seats: 55, majority: true, kind: 'majority' });
eq('no majority: the largest takes its nearest partner', formGovernment([left, right, center], { left: 44, right: 40, center: 16 }), { lead: 'left', partners: ['center'], seats: 60, majority: true, kind: 'coalition' });
eq('partners too far apart: a minority government', formGovernment([left, right], { left: 50, right: 50 }).kind, 'minority');
eq('the larger of two governs when tied parties cannot agree', formGovernment([left, right], { left: 50, right: 50 }).partners, []);
yes('a coalition never includes more partners than it needs', formGovernment([left, right, center, { id: 'green', positions: { tax: 1, services: 2, order: -1 } }], { left: 40, right: 30, center: 15, green: 15 }).partners.length === 1);

// A race between two candidates, and the count as it comes in.
{
  const me = { id: 'me', positions: { tax: 2, services: 2 }, appeal: 50 };
  const them = { id: 'rival', positions: { tax: -2, order: 2 }, appeal: 50 };
  const r = duel(me, them, [workers, owners], undefined, 100000);
  eq('a duel: the votes add up to the number cast', r.votes.me + r.votes.rival, r.total);
  eq('a duel: every group\'s votes add up to the candidates\' totals', Object.values(r.byGroup).reduce((s, g) => s + g.me, 0), r.votes.me);
  yes('a duel: each group leans to the candidate who wants what it wants', r.byGroup.workers.me > r.byGroup.workers.rival && r.byGroup.owners.rival > r.byGroup.owners.me);
  const better = duel({ ...me, appeal: 60 }, them, [workers, owners], undefined, 100000);
  yes('a duel: a stronger campaign wins more votes, but not all of them', better.shares.me > r.shares.me && better.shares.me < 70);
  const courted = duel({ ...me, edge: { owners: 12 } }, them, [workers, owners], undefined, 100000);
  yes('a duel: courting a group moves that group and no other', courted.byGroup.owners.me > r.byGroup.owners.me && courted.byGroup.workers.me === r.byGroup.workers.me);
  eq('a duel: two identical candidates split the vote evenly', duel({ id: 'me', positions: {}, appeal: 5 }, { id: 'rival', positions: {}, appeal: 5 }, [workers, owners], undefined, 100000).shares, { me: 50, rival: 50 });

  const areas = [{ id: 'city', mix: { workers: 0.7, owners: 0.2 } }, { id: 'town', mix: { workers: 0.2, owners: 0.3 } }, { id: 'farms', mix: { workers: 0.1, owners: 0.5 } }];
  const count = countByArea(r.byGroup, areas, ['farms', 'city', 'town']);
  eq('the count: areas report in the order given', count.map((b) => b.id), ['farms', 'city', 'town']);
  eq('the count: the last running total is the result', count[2].running, r.votes);
  eq('the count: everything is counted by the end', count[2].counted, 100);
  yes('the count: the lead can change hands as areas report', count[0].running.rival > count[0].running.me && count[1].running.me > count[0].running.me);
  let bad = 0;
  for (let s = 1; s <= 300; s++) {
    const n = seeded(s);
    const d = duel({ ...me, appeal: 50 + n(15) }, { ...them, appeal: 50 + n(15) }, [workers, owners], n, 20000 + s * 311);
    const c = countByArea(d.byGroup, areas);
    const sum = c.reduce((t, b) => t + b.votes.me + b.votes.rival, 0);
    if (d.votes.me + d.votes.rival !== d.total || sum !== d.total || c[2].running.me !== d.votes.me || c.some((b) => b.votes.me < 0 || b.votes.rival < 0) || d.turnout < 0 || d.turnout > 100) bad += 1;
  }
  eq('300 random races: every count adds up to its result', bad, 0);
}

console.log(failed ? `${failed} failed.` : 'The arithmetic of elections holds.');
process.exit(failed ? 1 : 0);
