// The arithmetic of elections: turning what groups of voters want into vote
// shares, shares into seats, and seats into a government. Pure functions with
// no imports, so the rules can be tested on their own (tests/elections.mjs).
//
// A party:        { id, positions: { issue: -2..2 }, appeal }      appeal: leader, record, campaign (about -15..15)
// A voter group:  { id, share, turnout, cares: { issue: weight }, wants: { issue: -2..2 } }
//   share    its part of the electorate (the shares add up to 1)
//   turnout  how many of them vote, 0..1

/** How well a party's positions match what a group wants, weighted by what the group cares about. Higher is closer. */
export function alignment(party, group) {
  let score = 0;
  let weight = 0;
  for (const [issue, w] of Object.entries(group.cares)) {
    score += w * (4 - Math.abs((party.positions[issue] ?? 0) - (group.wants[issue] ?? 0)));
    weight += w * 4;
  }
  return weight ? score / weight : 0.5; // 0..1
}

/**
 * Vote shares for each party, from the groups of voters.
 * @param {object[]} parties
 * @param {object[]} groups
 * @param {(n:number) => number} noise  returns a random number around 0 (about -n..n); the caller owns the randomness
 * @param {number} [electorate]  the number of people entitled to vote, for totals
 * @returns {{shares:Object<string,number>, votes:Object<string,number>, turnout:number, byGroup:Object<string,Object<string,number>>}}
 *   shares are percentages that add up to 100.
 */
export function vote(parties, groups, noise = () => 0, electorate = 1000000) {
  const raw = Object.fromEntries(parties.map((p) => [p.id, 0]));
  const byGroup = {};
  let cast = 0;
  for (const g of groups) {
    // Each group splits between the parties in proportion to how strongly it prefers them.
    const pull = parties.map((p) => Math.max(0.02, alignment(p, g) + (p.appeal ?? 0) / 100 + noise(0.04)) ** 3.2);
    const sum = pull.reduce((a, b) => a + b, 0);
    const voters = g.share * Math.min(1, Math.max(0.05, g.turnout + noise(0.03)));
    byGroup[g.id] = {};
    parties.forEach((p, i) => { raw[p.id] += voters * pull[i] / sum; byGroup[g.id][p.id] = Math.round(pull[i] / sum * 1000) / 10; });
    cast += voters;
  }
  const votes = {};
  let counted = 0;
  const total = Math.round(cast * electorate);
  const order = [...parties].sort((a, b) => raw[b.id] - raw[a.id]);
  for (const p of order) { votes[p.id] = Math.round(raw[p.id] * electorate); counted += votes[p.id]; }
  // Rounding is made up on the largest party, so the votes always add up to the number cast.
  if (order.length) votes[order[0].id] += total - counted;
  const shares = Object.fromEntries(parties.map((p) => [p.id, total ? Math.round(votes[p.id] / total * 1000) / 10 : 0]));
  return { shares, votes, turnout: Math.round(cast * 1000) / 10, total, byGroup };
}

/** Seats by the highest-averages (D'Hondt) method, with an optional threshold below which a party gets none. */
export function proportional(votes, seats, threshold = 0) {
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  const ok = Object.entries(votes).filter(([, v]) => total && v / total * 100 >= threshold);
  const won = Object.fromEntries(Object.keys(votes).map((id) => [id, 0]));
  for (let i = 0; i < seats && ok.length; i++) {
    const [id] = ok.reduce((best, cur) => (cur[1] / (won[cur[0]] + 1) > best[1] / (won[best[0]] + 1) ? cur : best));
    won[id] += 1;
  }
  return won;
}

/**
 * Seats where each district elects one member. Districts lean a little each
 * way from the national result, so the largest parties win more than their
 * share and small ones are squeezed.
 * @param {(n:number) => number} noise
 */
export function districts(shares, seats, noise = () => 0) {
  const ids = Object.keys(shares);
  const won = Object.fromEntries(ids.map((id) => [id, 0]));
  for (let d = 0; d < seats; d++) {
    let best = null;
    let top = -Infinity;
    for (const id of ids) {
      const local = shares[id] + noise(13);
      if (local > top) { top = local; best = id; }
    }
    won[best] += 1;
  }
  return won;
}

/** The two leading candidates, and whether a second round is needed (nobody over half). */
export function firstRound(shares) {
  const order = Object.entries(shares).sort((a, b) => b[1] - a[1]);
  return { leader: order[0]?.[0] ?? null, second: order[1]?.[0] ?? null, runoff: (order[0]?.[1] ?? 0) <= 50 && order.length > 1 };
}

/** How far apart two parties are on the issues (0 identical, 4 opposite on everything). */
export function distance(a, b) {
  const issues = new Set([...Object.keys(a.positions), ...Object.keys(b.positions)]);
  let d = 0;
  for (const i of issues) d += Math.abs((a.positions[i] ?? 0) - (b.positions[i] ?? 0));
  return issues.size ? d / issues.size : 0;
}

/**
 * Forms a government from the seats. The largest party leads; if it has no
 * majority it takes the nearest parties as partners until it has one. If even
 * that fails (the partners are too far apart), it governs as a minority.
 * @returns {{lead:string, partners:string[], seats:number, majority:boolean, kind:'majority'|'coalition'|'minority'}}
 */
export function formGovernment(parties, seats, tooFar = 2.2) {
  const total = Object.values(seats).reduce((a, b) => a + b, 0);
  const need = Math.floor(total / 2) + 1;
  const order = [...parties].filter((p) => seats[p.id] > 0).sort((a, b) => seats[b.id] - seats[a.id]);
  const lead = order[0];
  if (!lead) return { lead: null, partners: [], seats: 0, majority: false, kind: 'minority' };
  let have = seats[lead.id];
  const partners = [];
  const rest = order.slice(1).sort((a, b) => distance(lead, a) - distance(lead, b));
  for (const p of rest) {
    if (have >= need) break;
    if (distance(lead, p) > tooFar) continue;
    partners.push(p.id);
    have += seats[p.id];
  }
  const majority = have >= need;
  if (!majority) return { lead: lead.id, partners: [], seats: seats[lead.id], majority: false, kind: 'minority' };
  return { lead: lead.id, partners, seats: have, majority, kind: partners.length ? 'coalition' : 'majority' };
}

/** Checks a result for things that must never be true. Returns problems (empty when sound). */
export function auditResult(result, seats, seatCount) {
  const problems = [];
  const sumVotes = Object.values(result.votes).reduce((a, b) => a + b, 0);
  if (sumVotes !== result.total) problems.push(`votes add up to ${sumVotes}, not the ${result.total} cast`);
  if (Object.values(result.votes).some((v) => v < 0)) problems.push('a party has fewer than no votes');
  const sumShares = Object.values(result.shares).reduce((a, b) => a + b, 0);
  if (Math.abs(sumShares - 100) > 0.6) problems.push(`shares add up to ${sumShares}`);
  if (result.turnout < 0 || result.turnout > 100) problems.push(`turnout of ${result.turnout}%`);
  if (seats) {
    const s = Object.values(seats).reduce((a, b) => a + b, 0);
    if (s !== seatCount) problems.push(`${s} seats filled of ${seatCount}`);
  }
  return problems;
}
