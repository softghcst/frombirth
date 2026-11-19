// Plays many whole lives through the newer public-life features and checks that nothing breaks along the way.
// Run with: node scripts/stress/fame-lives.mjs [lives] [first-seed]
//
// Three kinds of life, in turn: an idol (auditions to debut, comebacks, fan products, variety, hiatus, renewal, and an
// heir taking the family route), a fan (albums, trades, single cards, sales), and an athlete (a division, a club, a
// professional contract, sports agents). After every year it checks invariants: no exception, money a finite number,
// fame, fandoms, card prices and collections sane, positions valid, every payroll line a finite amount. At the end
// of each life the save is written and read back. Each life is reproducible from its seed (printed on failure).
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), key: (i) => [...mem.keys()][i], get length() { return mem.size; } };

// Every life is drawn from its own seed: the clock and Math.random are replaced, so createLife is reproducible too.
let seedState = 1;
const nextRandom = () => { seedState = (seedState + 0x6D2B79F5) >>> 0; let t = seedState; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
Math.random = nextRandom;
let clock = 1_800_000_000_000;
Date.now = () => (clock += 17);

const { store } = await import('../../js/state.js');
const { rng } = await import('../../js/rng.js');
const { createLife } = await import('../../js/engine/characterGen.js');
const { advanceYear } = await import('../../js/engine/yearProcessor.js');
const { saveGame, loadGame } = await import('../../js/save.js');
const { die } = await import('../../js/engine/death.js');
const { continueAs } = await import('../../js/engine/legacy.js');
const { makeNpc } = await import('../../js/engine/npcFactory.js');
const { COUNTRIES } = await import('../../js/data/countries.js');
const { RELEASE_KINDS } = await import('../../js/data/kpop.js');
const kp = await import('../../js/engine/kpop.js');
const sp = await import('../../js/engine/sports.js');
const sportsLife = await import('../../js/engine/sportsLife.js');
const work = await import('../../js/engine/worklife.js');
const fame = await import('../../js/engine/fame.js');
const extras = await import('../../js/engine/sportsExtras.js');

const LIVES = Number(process.argv[2] ?? 60);
const FIRST = Number(process.argv[3] ?? 1);
const problems = [];
const ends = { idol: [], fan: [], athlete: [] };
const tally = { idol: 0, fan: 0, athlete: 0, debuts: 0, trainees: 0, shows: 0, products: 0, cards: 0, trades: 0, sets: 0, agents: 0, pros: 0, heirsRouted: 0, years: 0 };

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
function invariants(tag) {
  const s = store.state;
  const p = s.player;
  const bad = (m) => problems.push(`${tag} year ${s.year} (age ${p.age}): ${m}`);
  if (!finite(p.finance.cash)) bad(`cash is ${p.finance.cash}`);
  const f = p.fame;
  if (f) for (const k of ['favor', 'credibility', 'attention', 'legacy']) if (!finite(f[k]) || f[k] < 0 || f[k] > 100) bad(`fame.${k} is ${f[k]}`);
  for (const l of work.payLines(p)) if (!finite(l.gross)) bad(`payroll line ${l.source} is ${l.gross}`);
  const K = s.kpop;
  if (K) {
    for (const g of Object.values(K.groups)) {
      if (!finite(g.fandom.size) || g.fandom.size < 0 || !finite(g.fandom.core) || g.fandom.core < 0) bad(`${g.name} fandom ${g.fandom.size}/${g.fandom.core}`);
      if (!finite(g.fandom.engagement)) bad(`${g.name} engagement ${g.fandom.engagement}`);
      for (const [who, labels] of Object.entries(g.positions ?? {})) if (!kp.validLabels(labels)) bad(`${g.name}: positions ${labels.join('+')} for ${who}`);
      const ids = kp.current(g).map((m) => m.who);
      if (new Set(ids).size !== ids.length) bad(`${g.name}: a member listed twice`);
      for (const y of Object.values(g.ledger?.years ?? {})) for (const v of Object.values(y.perMember ?? {})) if (!finite(v) || v < 0) bad(`${g.name}: a member's share is ${v}`);
    }
    for (const c of Object.values(K.cards ?? {})) for (const v of Object.values(c.values ?? {})) if (!finite(v) || v <= 0) bad(`a card price is ${v}`);
  }
  if (p.fan) {
    for (const [id, n] of Object.entries(p.fan.cards)) {
      if (!Number.isInteger(n) || n <= 0) bad(`card ${id} count ${n}`);
      if (!kp.cardParts(id).release) bad(`card ${id} lost its album`);
    }
    if (!finite(kp.collectionValue())) bad('collection value');
  }
  const a = s.sports?.athletes?.[p.id];
  if (a?.agentId && !(a.agent?.commission >= 0.03 && a.agent.commission <= 0.1) && a.agent) bad(`agent cut ${a.agent.commission}`);
}
const answerSports = () => { for (const d of sportsLife.openDecisions()) { const yes = d.options.some((o) => o.id === 'yes') && d.kind !== 'retire' && d.kind !== 'integrity' && (d.kind !== 'abroad' || rng.chance(0.5)); if (d.kind === 'abroad' && yes) tally.abroad = (tally.abroad ?? 0) + 1; sportsLife.answer(d.id, yes ? 'yes' : d.options.at(-1).id); } };
function year(tag) {
  advanceYear();
  store.state.pendingEvents = [];
  answerSports();
  tally.years += 1;
  invariants(tag);
}
const money = (base) => base * COUNTRIES[store.state.player.countryId].currency.scale;

function newLife(countryId, gender, age) {
  let s; do { s = createLife({ countryId, gender }); } while (s.player.royal);
  store.state = s;
  const p = s.player;
  for (let i = 0; i < age && p.alive; i++) year('growing up');
  return p;
}

/** The idol path: what a keen player would do each year. */
function idolYear(tag) {
  const p = store.state.player;
  const i = kp.idolOf(p);
  if (!kp.trainee(p) && !kp.myGroup(p)) {
    for (const au of kp.auditions().filter((x) => !kp.whyNotApply(x, p)).slice(0, 3)) {
      kp.prepare(au.id);
      const cat = rng.pick(au.categories);
      kp.apply(au.id, cat);
      const app = store.state.kpop.apps[i.apps.at(-1)];
      if (app?.stage === 'callback') kp.attendCallback(app.id);
      if (app?.stage === 'offered') { kp.askGuardian(app.id); if (kp.acceptOffer(app.id).ok) { tally.trainees += 1; break; } }
    }
    for (const r of kp.legacyRoutes(p)) if (!kp.whyNotLegacy(r.agencyId, p)) { tally.heirsRouted += 1; const x = kp.legacyAudition(r.agencyId); const app = store.state.kpop.apps[i.apps.at(-1)]; if (x.ok && app?.stage === 'offered') { i.guardianOk = true; kp.acceptOffer(app.id); } }
  }
  if (kp.trainee(p)) { kp.setFocus(rng.pick(['vocal', 'dance', 'balanced', 'media'])); for (const k of ['vocal', 'dance', 'media']) kp.trainAction?.(k); }
  if (kp.debutOffer(p)) { if (kp.acceptDebut().ok) tally.debuts += 1; }
  const g = kp.myGroup(p);
  if (g?.status === 'preparing') kp.debut(g);
  if (g?.debut) {
    kp.comeback(rng.pick(Object.keys(RELEASE_KINDS)));
    for (const k of ['photobook', 'seasons_greetings', 'cafe', 'popup', 'characters', 'concert_film']) if (!kp.whyNotProduct(k, g) && kp.launchProduct(k, { where: rng.pick(kp.popupPlaces(g)), character: 'fox' }).ok) tally.products += 1;
    if (!g.merch?.lightstick) kp.designLightstick('star', 'coral');
    if (!g.merch?.fanclub) kp.launchFanclub();
    if (rng.chance(0.3)) kp.setCardPolicy(rng.pick(['generous', 'modest']));
    if (rng.chance(0.4)) kp.planTour(rng.pick(Object.keys(kp.TOURS)));
    if (rng.chance(0.15) && !i.hiatus) kp.startHiatus(rng.pick(['rest', 'health']));
    else if (i.hiatus && i.hiatus.kind !== 'service') kp.endHiatus();
    if (kp.openRumor(p)) kp.answerRumor(kp.openRumor(p).true ? 'confirm' : 'deny');
  }
  if (kp.varietyOpen(p)) {
    const o = kp.varietyOffers(p);
    const pick = o.find((x) => x.role !== 'guest') ?? o[0];
    if (pick && kp.takeVariety(pick.id).ok && pick.role !== 'guest') tally.shows += 1;
  }
  if (kp.renewalDue(p)) kp.decideRenewal(rng.pick(['renew', 'leave', 'keep_group']));
  year(tag);
}

/** The fan path. */
function fanYear(tag) {
  const p = store.state.player;
  if (!p.fan) { const gs = kp.fanGroups(); if (gs.length) { const g = rng.pick(gs.slice(0, 6)); const who = kp.current(g).map((m) => m.who).find((w) => w !== 'player'); if (who) kp.becomeFan(g.id, who); } }
  const f = kp.fanOf(p);
  if (f) {
    p.finance.cash = Math.max(p.finance.cash, money(400));
    if (kp.buyAlbums(rng.int(1, 12)).ok) tally.cards += 1;
    const g = kp.group(f.groupId);
    const r = g && g.status === 'active' ? kp.albumsOf(g)[0] : null;
    if (r) {
      const missing = r.performers.map((w) => `${r.id}|${w}|n`).filter((id) => !f.cards[id]);
      if (missing.length && kp.tradeFor(missing[0]).ok) tally.trades += 1;
      if (missing.length > 1 && rng.chance(0.5)) kp.buyCard(missing[1]);
    }
    const spare = kp.spares(f).at(-1);
    if (spare && rng.chance(0.4)) kp.sellCard(spare);
    tally.sets = Math.max(tally.sets, f.sets.length);
  }
  year(tag);
}

/** The athlete path. */
function athleteYear(tag, sportId) {
  const p = store.state.player;
  const e = sp.entryOf(sportId);
  if (e && !e.orgId && p.age >= 10) { const c = sp.clubsFor(sportId).find((x) => x.open); if (c) sp.tryOut(c.org.id); }
  if (sportsLife.wantsSportsAgent()) {
    if (!sportsLife.myAgent() && sportsLife.findSportsAgent().ok && sportsLife.signSportsAgent().ok) tally.agents += 1;
    else if (sportsLife.myAgent() && rng.chance(0.3)) sportsLife.askSportsAgentCut();
  }
  if (e?.contractId) tally.pros += 1;
  year(tag);
}

for (let n = 0; n < LIVES; n++) {
  const seed = FIRST + n;
  seedState = seed >>> 0; clock = 1_800_000_000_000 + seed * 7919;
  const kind = ['idol', 'fan', 'athlete'][n % 3];
  tally[kind] += 1;
  const tag = `life ${seed} (${kind})`;
  try {
    if (kind === 'idol') {
      const p = newLife(rng.pick(['kr', 'us', 'br', 'jp', 'ph', 'uk', 'th']), rng.pick(['female', 'male']), 13);
      p.talents.singing = Math.max(p.talents.singing, rng.int(55, 95)); p.talents.dance = Math.max(p.talents.dance, rng.int(55, 95)); p.stats.charm = Math.max(p.stats.charm, 60);
      for (let y = 0; y < 30 && p.alive; y++) idolYear(tag);
      // The next generation: a child takes the family route.
      if (p.alive && (p.idol?.groups ?? []).length) {
        const kid = makeNpc({ role: 'child', countryId: p.countryId, age: 15, gender: rng.pick(['female', 'male']) });
        store.state.npcs[kid.id] = kid; p.npcIds.push(kid.id);
        die('natural causes');
        const next = continueAs(kid.id);
        if (next) {
          store.state = next;
          const q = next.player;
          q.talents.singing = rng.int(50, 90); q.talents.dance = rng.int(50, 90);
          for (let y = 0; y < 6 && q.alive; y++) idolYear(`${tag} heir`);
        }
      }
    } else if (kind === 'fan') {
      const p = newLife(rng.pick(['uk', 'us', 'ph', 'br', 'kr', 'mx']), rng.pick(['female', 'male']), 9);
      for (let y = 0; y < 15 && p.alive; y++) fanYear(tag);
    } else {
      const gender = rng.pick(['female', 'male', 'nonbinary']);
      const p = newLife(rng.pick(['us', 'uk', 'ca', 'au', 'kr']), gender, 9);
      if (sp.choosesDivision(p)) sp.setDivision(rng.pick(['women', 'men']));
      p.talents.sports = Math.max(p.talents.sports, rng.int(70, 98)); p.stats.health = Math.max(p.stats.health, 80);
      const sportId = rng.pick(['soccer', 'basketball', 'tennis', 'ice_hockey', 'track', 'volleyball', 'boxing', 'rugby']);
      sp.takeUp(sportId);
      sp.setPlan(sportId, 'technical', 10);
      for (let y = 0; y < 22 && p.alive; y++) athleteYear(tag, sportId);
      // Then the dugout: a team sport's former player coaches a club for a few seasons.
      if (p.alive && ['soccer', 'basketball', 'ice_hockey', 'volleyball', 'rugby'].includes(sportId)) {
        const e = sp.entryOf(sportId);
        if (e?.status === 'active') sportsLife.retire(sportId);
        if (sportsLife.becomeCoach(sportId).ok) {
          tally.coaches = (tally.coaches ?? 0) + 1;
          for (let y = 0; y < 6 && p.alive; y++) {
            extras.setTactics(rng.pick(Object.keys(extras.TACTICS))); extras.setTraining(rng.pick(Object.keys(extras.TRAINING)));
            const sq = extras.squadOf(); if (sq && rng.chance(0.3)) extras.toggleBench(rng.pick(sq.team.roster).id);
            year(tag);
            for (const x of extras.squadOf()?.team.roster ?? []) if (!finite(x.rating) || x.rating < 0 || x.rating > 100) problems.push(`${tag}: a squad rating is ${x.rating}`);
          }
        }
      }
      const bx = sp.entryOf('boxing')?.boxing;
      if (bx) { tally.boxers = (tally.boxers ?? 0) + 1; if (bx.titles.length) tally.champions = (tally.champions ?? 0) + 1; if (bx.fights.length !== Math.min(60, bx.record.w + bx.record.l) && bx.record.w + bx.record.l <= 60) problems.push(`${tag}: boxing record ${bx.record.w}-${bx.record.l} but ${bx.fights.length} fights`); }
      const gt = Object.values(sp.myAthlete()?.sports ?? {}).flatMap((e) => e.gamesTeams ?? []).filter((t) => t.picked);
      tally.gamesTeams = (tally.gamesTeams ?? 0) + gt.length;
    }
    const s = store.state;
    // Money at the end, in base units (today's dollars), to show anything absurd.
    const q = s.player;
    ends[kind].push(Math.round(q.finance.cash / COUNTRIES[q.countryId].currency.scale));
    if (q.fan) ends.fanValue = Math.max(ends.fanValue ?? 0, Math.round(kp.collectionValue() / COUNTRIES[q.countryId].currency.scale));
    saveGame(s);
    const back = loadGame(s.slotId);
    if (!back || back.player.age !== s.player.age || JSON.stringify(back.kpop ?? null).length !== JSON.stringify(s.kpop ?? null).length) problems.push(`${tag}: the save did not come back as it was`);
  } catch (err) {
    problems.push(`${tag}: threw ${err.stack.split('\n').slice(0, 4).join(' | ')}`);
  }
  mem.clear();
}

console.log(JSON.stringify(tally));
const mid = (xs) => { const v = [...xs].sort((a, b) => a - b); return v.length ? `median ${v[Math.floor(v.length / 2)]}, range ${v[0]} to ${v.at(-1)}` : 'none'; };
for (const k of ['idol', 'fan', 'athlete']) console.log(`cash at the end, ${k} lives (today's dollars): ${mid(ends[k])}`);
console.log(`largest photocard collection (today's dollars): ${ends.fanValue ?? 0}`);
if (problems.length) {
  const uniq = [...new Set(problems)];
  console.log(`${uniq.length} problem(s):\n- ${uniq.slice(0, 40).join('\n- ')}`);
  process.exit(1);
}
console.log(`${LIVES} lives, no problems.`);
