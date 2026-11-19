// Women's and men's divisions, and sports agents shopped for like every other agent.
// Run with: node tests/sports-divisions.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => { disk.set(k, String(v)); }, removeItem: (k) => { disk.delete(k); } };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { sportOf } = await import('../js/data/sports.js');
const sp = await import('../js/engine/sports.js');
const life = await import('../js/engine/sportsLife.js');
const agents = await import('../js/engine/agents.js');
const { COUNTRIES: COUNTRIES_ } = await import('../js/data/countries.js');

rng.seed(20261119);
const problems = []; const ok = [];
const check = (c, m) => { if (!c) problems.push(m); };
const caseOf = (name, fn) => { const n = problems.length; try { fn(); } catch (err) { problems.push(`${name}: threw ${err.stack.split('\n').slice(0, 3).join(' | ')}`); } ok.push(problems.length === n ? name : `(failed) ${name}`); };
const S = () => store.state; const P = () => store.state.player;
function year(pref = {}) { advanceYear(); S().pendingEvents = []; for (const d of life.openDecisions()) if (pref[d.kind] !== 'skip') life.answer(d.id, pref[d.kind] && d.options.some((o) => o.id === pref[d.kind]) ? pref[d.kind] : d.options.at(-1).id); }
function grownTo(age, gender, countryId = 'uk', city = 'London', setup = () => {}) {
  for (;;) {
    store.state = createLife({ countryId, city, gender });
    if (P().royal) continue;
    // createLife can make a transgender character, whose gender is worked out in childhood: these lives are cisgender.
    P().gender = gender; P().flags.bornAs = gender;
    setup(P());
    for (let i = 0; i < age && P().alive; i++) year({ integrity: 'refuse' });
    if (P().alive && P().age === age && !P().legal?.incarceration) return P();
  }
}
const able = (p) => { p.talents.sports = 92; p.stats.health = Math.max(p.stats.health, 85); p.hidden.discipline = 80; };
const maxOut = (e, v) => { for (const k of Object.keys(e.skills)) { e.ceiling[k] = Math.max(e.ceiling[k], v + 5); e.skills[k] = v; } };

caseOf('a woman plays in the women\'s division: her own clubs, team, teammates and league', () => {
  grownTo(14, 'female', 'uk', 'London', able);
  check(sp.divisionOf() === 'women', 'her division follows her gender');
  sp.takeUp('soccer');
  const clubs = sp.clubsFor('soccer');
  check(clubs.length && clubs.every((c) => c.org.div === 'women'), 'the clubs she can try for are women\'s clubs');
  check(clubs.every((c) => / Women$/.test(c.org.name)), `women's clubs are named as such (${clubs.map((c) => c.org.name).join(', ')})`);
  const { teamFor, joinOrg, leagueFor } = sp.internals;
  const org = clubs[0].org;
  const t = joinOrg(org, S(), { quiet: true });
  const mates = t.roster.filter((x) => x.npcId).map((x) => S().npcs[x.npcId]);
  check(mates.length >= 1 && mates.every((n) => n.gender === 'female'), 'the teammates she meets are women');
  const lg = leagueFor(S(), org, teamFor(S(), org));
  check(/Women's/.test(lg.name) && lg.div === 'women', `the league is a women's league (${lg.name})`);
  const rivals = lg.teamIds.map((id) => S().sports.teams[id]).map((x) => S().sports.orgs[x.orgId]).filter((o) => o.id !== org.id);
  check(rivals.length >= 7 && rivals.every((o) => o.div === 'women'), 'every other team in it is a women\'s team');
  const rec = sp.internals.findOrg(S(), sportOf('soccer'), 'recreational');
  check(rec.div === 'mixed', 'recreational play is open to everyone');
});

caseOf('a man in the same city plays for different clubs, in a different league', () => {
  grownTo(14, 'female', 'uk', 'London', able);
  sp.takeUp('soccer');
  const womens = sp.clubsFor('soccer').map((c) => c.org);
  // The same world, a man's view of it: his clubs are not hers.
  P().gender = 'male';
  check(sp.divisionOf() === 'men', 'his division follows his gender');
  const mens = sp.clubsFor('soccer').map((c) => c.org);
  check(mens.every((o) => o.div === 'men'), 'men\'s clubs');
  check(mens.every((o) => !womens.some((w) => w.id === o.id)), 'no club is both');
  const { teamFor, leagueFor } = sp.internals;
  const lg = leagueFor(S(), mens[0], teamFor(S(), mens[0]));
  check(!/Women's/.test(lg.name), 'the men\'s league is not the women\'s');
});

caseOf('events: women\'s draws are women, with women\'s names on the draw', () => {
  grownTo(17, 'female', 'us', undefined, able);
  sp.takeUp('tennis');
  const e = sp.entryOf('tennis'); maxOut(e, 60);
  const ev = sp.internals.playEvent(S(), e, 'club', 0);
  check(ev.div === 'women' && /Women's/.test(ev.name), `a women's event (${ev.name})`);
});

caseOf('women\'s professional play begins in its own years, and can end', () => {
  const W = (id, y) => sp.proYears(sportOf(id), 'women', y).open;
  const M = (id, y) => sp.proYears(sportOf(id), 'men', y).open;
  check(!W('ice_hockey', 2010) && W('ice_hockey', 2020) && M('ice_hockey', 2010), 'women\'s hockey from 2015, men\'s long before');
  check(W('baseball', 1950) && !W('baseball', 1960) && M('baseball', 1960), 'the women\'s baseball league of 1943–1954, and none after');
  const woman = { gender: 'female', flags: {} };
  check(sp.proFromFor(sportOf('baseball'), woman, 1950) === 1943 && sp.proFromFor(sportOf('baseball'), woman, 1960) === Infinity, 'after the league closed, a draft or a signing sees no women\'s professional baseball');
  check(!W('american_football', 2025) && M('american_football', 2025), 'no women\'s professional American football');
  check(W('tennis', 1975) && !W('tennis', 1965), 'a women\'s tour from 1970');
  check(W('wheelchair_basketball', 1990) && sportOf('wheelchair_basketball').mixed, 'mixed sports follow their own years');
});

caseOf('a non-binary player chooses their division, between clubs', () => {
  grownTo(14, 'nonbinary', 'uk', 'London', able);
  check(sp.choosesDivision(P()), 'they choose');
  sp.takeUp('soccer');
  // A school team counts as a club: off every team first.
  for (const e of Object.values(sp.myAthlete().sports)) if (e.orgId) sp.internals.leaveOrg(e, S(), 'changing division');
  const before = sp.divisionOf();
  const other = before === 'women' ? 'men' : 'women';
  check(sp.setDivision(other).ok && sp.divisionOf() === other, 'they can choose the other');
  check(sp.clubsFor('soccer').every((c) => c.org.div === other), 'and the clubs follow');
  sp.internals.joinOrg(sp.clubsFor('soccer')[0].org, S(), { quiet: true });
  check(!sp.setDivision(before).ok, 'not while with a club');
  P().gender = 'female'; P().flags.bornAs = 'female';
  check(!sp.choosesDivision(P()), 'someone whose division follows their gender does not choose');
});

/** A professional, signed through the engine's own routes. */
function pro(gender) {
  for (;;) {
    grownTo(16, gender, 'uk', 'London', able);
    sp.takeUp('soccer'); const e = sp.entryOf('soccer'); maxOut(e, 82); sp.setPlan('soccer', 'technical', 10);
    for (let i = 0; i < 6 && !e.contractId && P().alive; i++) year({ academy: 'yes', contract: 'yes', agent: 'no', integrity: 'refuse' });
    if (e.contractId && P().alive) return e;
  }
}

caseOf('a woman turns professional with a women\'s club', () => {
  const e = pro('female');
  const org = sp.orgOf(e.orgId);
  check(org.level === 'pro' && org.div === 'women', `signed for a women's professional club (${org.name})`);
});

caseOf('sports agents: shopped one at a time, two looks a year, each with their own cut and clients', () => {
  pro('male');
  check(life.wantsSportsAgent(), 'a professional can have an agent');
  const pool = life.sportsAgents();
  check(pool.length === 6, 'a pool of agents');
  const cuts = pool.map((n) => n.flags.agent.commission);
  check(cuts.every((c) => c >= 0.03 && c <= 0.1), `cuts between 3 and 10% (${cuts.join(', ')})`);
  check(new Set(cuts).size >= 2, 'not everyone takes the same');
  check(pool.every((n) => agents.clientsOf(n).length >= 2 && agents.clientsOf(n).every((c) => c.flags.star.kind === 'athlete')), 'every agent has athletes on their books');
  const worth = life.athleteWorth();
  check(worth >= 40, `a good professional is worth something to them (${worth})`);
  const a = life.findSportsAgent();
  check(a.ok && life.sportsAgentOnOffer(), `the first look shows someone (${a.text})`);
  const first = life.sportsAgentOnOffer().id;
  const b = life.findSportsAgent();
  check(life.sportsAgentTriesLeft() === 0, 'two looks used');
  if (b.ok) check(life.sportsAgentOnOffer().id !== first, 'the second look shows someone else');
  check(!life.findSportsAgent().ok, 'a third look waits for next year');
  if (!life.sportsAgentOnOffer()) { year({ agent: 'no' }); life.findSportsAgent(); }
  const n = life.sportsAgentOnOffer();
  const r = life.signSportsAgent();
  check(r.ok, r.text);
  const mine = life.myAgent();
  check(mine && mine.npcId === n.id && mine.commission === n.flags.agent.commission, 'signed on their own terms');
  check(n.flags.agent.clients.includes('player'), 'the player is on their books');
  const k = S().sports.contracts[`agent_${n.id}`];
  check(k?.status === 'active' && k.share === mine.commission, 'the agency contract records the cut');
  const cash = P().finance.cash;
  year({ agent: 'no' });
  const fees = Object.entries(S().sports.paid).filter(([key, x]) => key.startsWith('agent/') && x.year === S().year - 1 || key.startsWith('agent/') && x.year === S().year);
  check(fees.length >= 1, 'the agent takes their share of the year');
  const ask = life.askSportsAgentCut();
  check(typeof ask.text === 'string', 'asking for a smaller cut gets an answer');
  if (life.myAgent()) check(!life.askSportsAgentCut().ok, 'once a year');
  if (life.myAgent()) { check(life.dropSportsAgent().ok && !life.myAgent(), 'parting ways'); check(S().sports.contracts[`agent_${n.id}`].status === 'ended', 'the contract ends'); }
  void cash;
});

caseOf('an older save\'s agent keeps the flat five per cent', () => {
  pro('male');
  const a = sp.myAthlete();
  a.agentId = 'old_agent'; a.agent = undefined;
  check(life.agentCut(a) === 0.05 && life.agentClout(a) === 1, 'five per cent, ordinary pull');
});

caseOf('an agent offering themselves after a signing is a real agent from the pool', () => {
  pro('female');
  const d = life.openDecisions().find((x) => x.kind === 'agent');
  if (d) {
    const r = life.answer(d.id, 'yes');
    check(r && (life.sportsAgentOnOffer() || !r.ok), 'hearing them out puts a real agent on offer');
  }
});

caseOf('a transfer abroad: a club in another country, a sponsored work visa, a new life there', () => {
  let d = null;
  for (let t = 0; t < 6 && !d; t++) {
    const e = pro('male');
    maxOut(e, 92);
    for (let i = 0; i < 10 && !d && P().alive && e.contractId; i++) {
      year({ integrity: 'refuse', renew: 'yes', transfer: 'no', abroad: 'skip' });
      d = life.openDecisions().find((x) => x.kind === 'abroad');
    }
  }
  check(!!d, 'a club abroad bids for a top professional');
  if (!d) return;
  const home = P().countryId;
  check(d.countryId !== home && COUNTRIES_[d.countryId] && sp.orgOf(d.orgId).countryId === d.countryId, `the club is in another country (${d.countryId})`);
  const r = life.answer(d.id, 'yes');
  check(r.ok, `the move goes through (${r.text})`);
  const e = sp.entryOf('soccer');
  const k = S().sports.contracts[e.contractId];
  check(P().countryId === d.countryId && k?.orgId === d.orgId && sp.orgOf(k.orgId).countryId === P().countryId, 'the player lives and plays in the new country');
  check(['worker', 'work'].some((x) => JSON.stringify(P().residency ?? {}).includes(x)) || P().citizenships?.includes?.(d.countryId), 'on a work visa there');
  check((e.abroad ?? []).some((x) => x.countryId === d.countryId), 'the move is on the athletic record');
  year({ integrity: 'refuse' });
  check(e.seasonsPlayed >= 1 && S().sports.seasons[e.seasons.at(-1)] && sp.orgOf(k.orgId).countryId === d.countryId, 'and a season is played there');
});

console.log(ok.map((x) => `${x.startsWith('(failed)') ? 'FAIL' : 'ok  '} ${x}`).join('\n'));
if (problems.length) { console.error(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('Divisions and sports agents hold.');
