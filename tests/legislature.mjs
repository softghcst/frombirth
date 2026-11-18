// Votes in the legislature, checked on small hand-built chambers.
// Run with: node tests/legislature.mjs
import { lean, tally, overrides } from '../js/engine/legislature.js';

let failed = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { failed += 1; console.log(`FAIL ${name}\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`); } else console.log(`ok   ${name}`);
};
const yes = (name, cond) => eq(name, !!cond, true);
function seeded(seed) { let s = seed; const next = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; return (n) => (next() * 2 - 1) * n; }

const left = { id: 'left', positions: { tax: 2, services: 2, order: -1 } };
const right = { id: 'right', positions: { tax: -2, services: -1, order: 2 } };
const center = { id: 'center', positions: { tax: 0, services: 1, order: 0 } };
const all = [left, right, center];
const spend = { wants: { services: 1 } };
const cutTax = { wants: { tax: -1 } };

eq('a bill goes a party\'s way by as much as the party wants it', [lean(left, spend), lean(right, spend), lean(left, cutTax)], [2, -1, -2]);
eq('a bill touching two issues is judged on both', lean(left, { wants: { tax: 1, order: 1 } }), 0.5);

{
  const t = tally(all, { left: 55, right: 30, center: 15 }, spend, { lead: 'left' });
  yes('a majority government passes what its own side wants', t.passes && t.for >= 55);
  eq('every seat votes one way or the other', t.for + t.against, 100);
  eq('the tally by party adds up to the whole', Object.values(t.byParty).reduce((s, v) => s + v.for, 0), t.for);
}
{
  const seats = { left: 40, right: 45, center: 15 };
  const t = tally(all, seats, spend, { lead: 'left' });
  yes('a minority government needs votes it does not own', t.need === 51 && t.for < 51 + 15 && !tally(all, seats, { wants: { tax: 1 } }, { lead: 'left' }).passes);
  yes('a deal with another party can make the difference', tally(all, seats, { wants: { tax: 1 } }, { lead: 'left', deals: { center: 0.9 } }).passes);
}
{
  const seats = { left: 52, right: 48 };
  const against = tally([left, right], seats, cutTax, { lead: 'left' });
  yes('a government that goes against its own side has rebels', against.rebels > 0 && against.rebels === against.byParty.left.against);
  yes('a hard whip brings some of them back', tally([left, right], seats, cutTax, { lead: 'left', whip: 0.1 }).rebels < against.rebels);
  yes('the other side votes for a bill that goes its way', against.byParty.right.for > against.byParty.right.against / 2);
}
{
  const seats = { left: 30, right: 40, center: 30 };
  const alone = tally(all, seats, spend, { lead: 'center' });
  const together = tally(all, seats, spend, { lead: 'center', partners: ['left'] });
  yes('a coalition partner votes with the government more than an outsider does', together.byParty.left.for >= alone.byParty.left.for && together.passes);
  const hated = tally(all, seats, { wants: { tax: -1, services: -1 } }, { lead: 'center', partners: ['left'] });
  yes('but not for something it cannot stomach', hated.byParty.left.for < together.byParty.left.for);
}
eq('two thirds overrides a veto; less does not', [overrides({ for: 67, total: 100 }), overrides({ for: 66, total: 100 }), overrides({ for: 0, total: 0 })], [true, false, false]);
eq('an empty chamber passes nothing', tally(all, {}, spend, { lead: 'left' }).passes, false);
{
  let bad = 0;
  for (let s = 1; s <= 300; s++) {
    const n = seeded(s);
    const a = 20 + Math.round(Math.abs(n(40)));
    const b = 20 + Math.round(Math.abs(n(40)));
    const seats = { left: a, right: b, center: 120 - a - b > 0 ? 120 - a - b : 1 };
    const t = tally(all, seats, s % 2 ? spend : cutTax, { lead: ['left', 'right', 'center'][s % 3], partners: s % 4 ? [] : ['center'], whip: Math.abs(n(0.1)), sway: n(0.1), noise: n });
    const total = seats.left + seats.right + seats.center;
    if (t.for + t.against !== total || t.for < 0 || t.against < 0 || t.passes !== (t.for >= Math.floor(total / 2) + 1) || Object.values(t.byParty).some((v) => v.for < 0 || v.against < 0)) bad += 1;
  }
  eq('300 random votes: every one adds up', bad, 0);
}

console.log(failed ? `${failed} failed.` : 'The votes of the legislature add up.');
process.exit(failed ? 1 : 0);
