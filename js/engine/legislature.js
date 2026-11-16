// The arithmetic of a vote in the legislature: who votes for a bill, party by
// party, and whether it passes. Pure functions with no imports, so the rules
// can be tested on their own (tests/legislature.mjs).
//
// A bill is what it would do, issue by issue: { wants: { issue: +1 | -1 } }
//   +1 moves the country towards the high end of that issue (see data/parties.js), -1 towards the low end.
// A party votes by where it sits (leading the government, a partner in it, or
// outside it) and by whether the bill goes its way.

const clamp01 = (n) => Math.min(1, Math.max(0, n));

/** How far a bill goes a party's way, from -2 (everything it opposes) to 2 (everything it wants). */
export function lean(party, bill) {
  const issues = Object.entries(bill.wants ?? {});
  if (!issues.length) return 0;
  return issues.reduce((s, [issue, dir]) => s + dir * (party.positions?.[issue] ?? 0), 0) / issues.length;
}

/**
 * Counts a vote.
 * @param {{id:string, positions:object}[]} parties
 * @param {Object<string,number>} seats
 * @param {{wants:Object<string,number>}} bill
 * @param {object} [o]
 * @param {?string} [o.lead]       the party leading the government
 * @param {string[]} [o.partners]  its coalition partners
 * @param {number} [o.whip]        pressure on the government's own members (0.1 is a hard whip)
 * @param {number} [o.sway]        what moves members outside the government: public feeling, a good minister
 * @param {number} [o.skill]       how well the bill is being steered, about -0.05..0.1
 * @param {Object<string,number>} [o.deals]  what has been promised to particular parties
 * @param {(n:number) => number} [o.noise]
 * @returns {{for:number, against:number, total:number, need:number, passes:boolean, rebels:number, byParty:Object<string,{for:number,against:number}>}}
 */
export function tally(parties, seats, bill, o = {}) {
  const noise = o.noise ?? (() => 0);
  const byParty = {};
  let yes = 0;
  let total = 0;
  let rebels = 0;
  for (const p of parties) {
    const n = seats[p.id] ?? 0;
    if (!n) continue;
    const l = lean(p, bill);
    let part;
    // A government's own side mostly follows it; partners follow if the bill is bearable; the rest vote on the merits.
    if (p.id === o.lead) part = 0.86 + l * 0.06 + (o.whip ?? 0) + (o.skill ?? 0);
    else if ((o.partners ?? []).includes(p.id)) part = 0.62 + l * 0.16 + (o.whip ?? 0) / 2 + (o.skill ?? 0);
    else part = 0.06 + l * 0.2 + (o.sway ?? 0);
    part = clamp01(part + (o.deals?.[p.id] ?? 0) + noise(0.05));
    const ayes = Math.round(n * part);
    byParty[p.id] = { for: ayes, against: n - ayes };
    yes += ayes;
    total += n;
    if (p.id === o.lead) rebels = n - ayes;
  }
  const need = Math.floor(total / 2) + 1;
  return { for: yes, against: total - yes, total, need, passes: yes >= need, rebels, byParty };
}

/** Whether a vote is big enough to override a veto (two thirds, unless told otherwise). */
export const overrides = (t, share = 2 / 3) => t.total > 0 && t.for >= Math.ceil(t.total * share);
