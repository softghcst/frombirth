// Musical theater BFAs and the way into them (engine/university.js, engine/admissions.js, data/universities.js):
// the programs exist and are the costliest and hardest places in the game; a place is won in an audition room, often on a
// second or third try, and what the player does in between (coaching) changes the odds; choosing a subject shows the
// top places for it, ranked and marked reach / match / safety; and places can be compared side by side.
// Run with: node tests/bfa-universities.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { chanceWords } = await import('../js/util.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const uni = await import('../js/engine/university.js');
const adm = await import('../js/engine/admissions.js');
const { UNIVERSITY_KINDS, UNIVERSITY_KIND_BY_ID, BFA_PLANS, AUDITION_COACHING, MAX_APPLICATIONS, MAX_APPLICATIONS_AUDITION } = await import('../js/data/universities.js');
const { MAJOR_BY_ID } = await import('../js/data/majors.js');
const { COUNTRIES } = await import('../js/data/countries.js');
const { ROOTS } = await import('../js/data/economy.js');
ROOTS.familyLeaves = 0; // these lives stay where they began

const seed = Number(process.env.SEED ?? 11);
rng.seed(seed);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => ok.push(problems.length ? `(after failures) ${msg}` : msg);
const S = () => store.state;
const P = () => store.state.player;
const K = UNIVERSITY_KIND_BY_ID;
const BFA = MAJOR_BY_ID.musical_theater_bfa;
const BFA_KINDS = ['mt_elite', 'mt_conservatory', 'university_bfa'];

// ---------- 1. The programs: dearest and hardest ----------
{
  const ordinary = UNIVERSITY_KINDS.filter((k) => !BFA_KINDS.includes(k.id) && k.id !== 'conservatoire' && !k.open);
  check(Math.min(...BFA_KINDS.map((k) => K[k].tuitionMult)) > Math.max(...ordinary.map((k) => k.tuitionMult)), 'every musical theater BFA costs more than any ordinary kind of university');
  check(K.mt_elite.tuitionMult > K.mt_conservatory.tuitionMult && K.mt_conservatory.tuitionMult > K.university_bfa.tuitionMult, 'and the top tier costs most');
  const rate = (k) => adm.acceptanceRate(K[k], BFA);
  check(rate('mt_elite') < 0.06 && rate('mt_elite') < rate('mt_conservatory') && rate('mt_conservatory') < 0.12 && rate('mt_conservatory') < rate('university_bfa'), `acceptance: elite ${(rate('mt_elite') * 100).toFixed(1)}%, conservatory ${(rate('mt_conservatory') * 100).toFixed(1)}%, university program ${(rate('university_bfa') * 100).toFixed(1)}% (single digits at the top)`);
  check(rate('mt_elite') < adm.acceptanceRate(K.ancient, MAJOR_BY_ID.history), 'harder to get into than the oldest, most selective university for an ordinary degree');
  check(BFA_KINDS.every((k) => K[k].arts && K[k].strong.includes('musical_theater_bfa')), 'each is an arts place that teaches the BFA');
  check(K.mt_elite.only && K.mt_conservatory.only && !K.university_bfa.only, 'two are conservatories that teach little else; one is a university with a program inside it');
  for (const id of ['us', 'gb', 'ca', 'au']) check((BFA_PLANS[id] ?? []).length >= 3 || id === 'au', `${id} has several BFA programs`);
  check(BFA_PLANS.us.length >= 10, 'the United States has ten or more');
}
section('three kinds of BFA program: costlier than any ordinary degree, acceptance in single digits at the top');

// ---------- 2. In a country's catalog; only they teach the BFA ----------
store.state = createLife({ countryId: 'us', gender: 'female' });
for (const [countryId, plan] of Object.entries(BFA_PLANS)) {
  if (!COUNTRIES[countryId]) continue;
  const cat = uni.catalog(countryId);
  const have = cat.filter((u) => BFA_KINDS.includes(u.kindId));
  check(have.length === plan.length, `${countryId}: ${plan.length} BFA programs are in its catalog (${have.length})`);
  check(new Set(cat.map((u) => u.name)).size === cat.length, `${countryId}: every institution has its own name`);
  const bfaTeachers = cat.filter((u) => uni.teaches(u, 'musical_theater_bfa'));
  check(bfaTeachers.length >= have.length && bfaTeachers.every((u) => u.strong.includes('musical_theater_bfa')), `${countryId}: only places known for it teach the BFA`);
}
{
  const cat = uni.catalog('us');
  const research = cat.find((u) => u.kindId === 'research');
  check(!uni.teaches(research, 'musical_theater_bfa') && uni.teaches(research, 'musical_theater') && uni.teaches(research, 'history'), 'an ordinary university does not teach the BFA, though it teaches the BA and everything else');
  const again = uni.catalog('us');
  check(again.length === cat.length && again.every((u, i) => u.id === cat[i].id && u.name === cat[i].name), 'the catalog is kept, not remade each time');
  // A country from before the programs existed finds them the next time it looks.
  const old = Object.values(S().universities).filter((u) => u.countryId === 'us' && BFA_KINDS.includes(u.kind));
  for (const u of old) delete S().universities[u.id];
  check(uni.catalog('us').filter((u) => BFA_KINDS.includes(u.kindId)).length === BFA_PLANS.us.length, 'a life begun before them gets them, and nothing else changes');
  // Their standing varies from place to place, without touching the seeded dice.
  const reps = new Set(uni.catalog('us').filter((u) => u.kindId === 'mt_elite').map((u) => u.rep));
  check(reps.size >= 2, 'no two elite programs are exactly alike in standing');
  const before = rng.state();
  Object.keys(S().universities).filter((id) => id.includes('_bfa')).forEach((id) => delete S().universities[id]);
  uni.catalog('us');
  check(JSON.stringify(rng.state()) === JSON.stringify(before), 'adding them uses no random numbers');
}
section('programs are in every country\'s catalog, kept, named apart, taught only where the BFA is a program');

// ---------- 3. Cost, including where the state pays for university ----------
{
  const us = uni.catalog('us');
  const elite = us.find((u) => u.kindId === 'mt_elite');
  const research = us.find((u) => u.kindId === 'research');
  const regional = us.find((u) => u.kindId === 'regional');
  const e = uni.costs(elite.id).tuition; const r = uni.costs(research.id).tuition; const g = uni.costs(regional.id).tuition;
  check(e > 2.4 * r && e > 3.5 * g, `an elite program's tuition (${e}) is far above a major public university's (${r}) and a regional one's (${g})`);
  // A country where university is free: the conservatory still charges.
  const free = Object.values(COUNTRIES).find((c) => c.freeUniversity);
  if (free) {
    store.state = createLife({ countryId: free.id, gender: 'female' });
    const cat = uni.catalog(free.id);
    const pub = cat.find((u) => u.kindId === 'research' || u.kindId === 'regional');
    const mt = cat.find((u) => BFA_KINDS.includes(u.kindId) || u.kindId === 'conservatoire');
    check(uni.costs(pub.id).tuition === 0 && uni.costs(mt.id).tuition > 0, `in ${free.name}, where the state pays, a private conservatory still charges (${uni.costs(mt.id).tuition})`);
  }
}
section('tuition far above ordinary places, and charged even where university is free');

// ---------- 4. An applicant ----------
/** A seventeen-year-old at high school with these three talents and marks, begun once and copied for every trial. */
function young(talent, gpa = 3.5) {
  for (;;) {
    store.state = createLife({ countryId: 'us', gender: 'female' });
    if (store.state.player.royal) continue;
    const p = P();
    for (let i = 0; i < 17 && p.alive; i++) { p.stats.health = 95; p.legal.pending = null; p.legal.incarceration = null; advanceYear(); store.state.pendingEvents = []; }
    // (a life that ended, or moved away, before seventeen is begun again: these checks are about the ones who reach it)
    if (p.alive && p.countryId === 'us' && p.age === 17 && p.education.enrolled && p.education.stage === 'high') break;
  }
  const p = P();
  Object.assign(p.talents, { singing: talent, dance: talent, acting: talent });
  p.education.gpa = gpa; p.finance.cash = 900000; p.legal.incarceration = null; p.legal.pending = null;
  for (const n of Object.values(S().npcs)) if (n.alive) n.flags.wouldRecommend = true; // glowing teachers: this is about the room, not the references
  return structuredClone(store.state);
}
/** The year after: out of school, school mark on record, the planning round open again. */
function nextYear() {
  const p = P();
  p.age += 1; p.birthYear -= 1;
  const e = p.education;
  e.enrolled = false; e.stage = 'none';
  e.degrees = [{ type: 'high', gpa: e.gpa, courses: { advanced: [] }, year: S().year, name: 'High school diploma' }];
  S().year += 1;
}
const names = (rows) => rows.map((r) => r.name);

// ---------- 5. Shortlist: filtered by the subject, ranked, a few at a time ----------
{
  const base = young(70, 3.2);
  store.state = structuredClone(base);
  uni.plan();
  const before = uni.shortlist({ all: true });
  check(before.major === null && before.total >= 8, 'with no subject chosen it is the places by standing');
  check(uni.setMajor('musical_theater_bfa').ok, 'a subject can be chosen');
  const top = uni.shortlist();
  const all = uni.shortlist({ all: true });
  check(top.shown === 8 && top.total === all.total && all.total >= 11 && all.shown === all.total, `by default the top 8 of ${all.total} are shown; "show more" shows them all`);
  check(all.rows.every((r) => r.taught && uni.teaches(uni.uniOf(r.id), 'musical_theater_bfa')), 'only places that teach the subject are listed: no ordinary universities among them');
  check(all.rows.every((r, i) => r.rank === i + 1) && all.rows.every((r, i) => i === 0 || r.score <= all.rows[i - 1].score), 'ranked best first');
  check(top.rows.slice(0, 3).every((r) => r.label.startsWith('Elite')) && all.rows.at(-1).label !== 'Elite musical theater conservatory', 'the elite programs lead, and the university programs trail them');
  check(all.rows.every((r) => ['Reach', 'Match', 'Safety'].includes(r.fit)), 'each is marked reach, match or safety for this player');
  // History is a different list: different places, no BFAs.
  uni.setMajor('history');
  const hist = uni.shortlist({ all: true });
  check(hist.total > all.total - 1 && !hist.rows.some((r) => r.label.startsWith('Elite')) && names(hist.rows).join() !== names(all.rows).join(), 'the list for another subject is another list: no BFA conservatories in it');
  check(hist.rows[0].rep >= hist.rows.at(-1).rep, 'ranked by standing for it too');
  // The same applicant is a reach at the top and a match or safety lower down.
  store.state = structuredClone(young(94, 3.6));
  uni.plan(); uni.setMajor('musical_theater_bfa');
  const fits = uni.shortlist({ all: true }).rows.map((r) => r.fit);
  check(fits[0] === 'Reach' && fits.some((f) => f !== 'Reach'), `a very strong performer is still a reach at the very top, and not everywhere (${fits.join(',')})`);
  store.state = structuredClone(young(70, 3.2));
  uni.plan(); uni.setMajor('musical_theater_bfa');
  check(uni.shortlist({ all: true }).rows.filter((r) => r.fit === 'Reach').length > fits.filter((f) => f === 'Reach').length, 'a weaker performer has more reaches than a strong one');
  check(uni.maxApplications('musical_theater_bfa') === MAX_APPLICATIONS_AUDITION && uni.maxApplications('history') === MAX_APPLICATIONS && MAX_APPLICATIONS_AUDITION > MAX_APPLICATIONS, 'audition courses allow more applications: nobody counts on one room');
}
section('the list is the top places for the chosen subject, ranked, short, with reach / match / safety');

// ---------- 6. Compare ----------
{
  store.state = structuredClone(young(88, 3.4));
  uni.plan(); uni.setMajor('musical_theater_bfa');
  const all = uni.shortlist({ all: true }).rows;
  const elite = all.find((r) => r.label.startsWith('Elite')); const mid = all.find((r) => r.label.startsWith('Musical theater BFA')); const unip = all.find((r) => r.label.startsWith('University'));
  const rows = uni.compare([elite.id, mid.id, unip.id]);
  const by = (label) => rows.find((r) => r.label === label);
  check(rows.every((r) => r.values.length === 3 && r.values.every((v) => typeof v.text === 'string' && v.text.length)), 'every line has a value for every place, in words');
  const tuition = by('Tuition a year');
  check(tuition && tuition.values[0].text !== tuition.values[2].text && tuition.values[2].best && !tuition.values[0].best, 'tuition is shown for each, and the cheaper one is marked');
  const rate = rows.find((r) => /Places offered/.test(r.label));
  check(rate && rate.values[0].best === false && rate.values[2].best === true && /%/.test(rate.values[0].text), 'places offered: shown as a percentage, with the easier place marked');
  const chances = by('Your chances');
  check(chances && /^(Reach|Match|Safety): (very likely|likely|a fair chance|a long shot|unlikely|very unlikely)$/.test(chances.values[0].text) && chances.values.every((v) => !/\d+%/.test(v.text) && !/^\w+: very likely$/.test(v.text)), `your chances are given for you, in words and never certain: "${chances?.values[0].text}"`);
  const LADDER = ['very unlikely', 'unlikely', 'a long shot', 'a fair chance', 'likely', 'very likely'];
  const rankOf = (t) => LADDER.indexOf(t.split(': ')[1]);
  check(rankOf(chances.values[2].text) >= rankOf(chances.values[1].text) && rankOf(chances.values[1].text) >= rankOf(chances.values[0].text), 'and fall as the places get harder');
  check(rows.some((r) => r.label === 'Where') && rows.some((r) => r.label === 'Length of the course') && rows.some((r) => r.label === 'Help with the cost') && rows.some((r) => r.label === 'How it is decided'), 'where, length, help and how it is decided are there');
  check(/audition/i.test(by('How it is decided').values[0].text), 'it says an audition decides it');
  const sameTwo = uni.compare([mid.id, all.filter((r) => r.label.startsWith('Musical theater BFA'))[1].id]);
  check(sameTwo.find((r) => r.label === 'Tuition a year').values.every((v) => !v.best), 'where two places are the same on a line, neither is marked better');
  check(by('Times you have applied') === undefined, 'nothing about earlier attempts until there are some');
  check(uni.compare(all.slice(0, 6).map((r) => r.id))[0].values.length === 4, 'at most four at once');
  // Compared against what the engine says elsewhere.
  check(by('Tuition a year').values[0].text.replace(/\D/g, '') === String(elite.tuition), 'tuition agrees with the list');
  const direct = adm.chanceOf(uni.profile('musical_theater_bfa', uni.uniOf(elite.id)), uni.uniOf(elite.id), BFA);
  check(chances.values[0].text.endsWith(`: ${chanceWords(Math.min(0.89, direct))}`), 'and the words match the chance the rules give (never certain)');
}
section('comparison: one line per attribute, a value per place in words, better one marked, chances for this player');

// ---------- 7. The room: odds change with how well prepared, and with having been before ----------
{
  const inst = (k) => ({ ...K[k], id: k });
  const a = (audition, extra = {}) => ({ mark: 3.4, predicted: false, advanced: 0, recs: 1, activities: 50, statement: 0, audition, athlete: false, need: 0, firstInFamily: false, legacy: false, transfer: false, attempts: 0, priorBest: null, ...extra });
  for (const k of BFA_KINDS) {
    const c = [78, 84, 90, 96].map((x) => adm.chanceOf(a(x), inst(k), BFA));
    check(c.every((x, i) => i === 0 || x >= c[i - 1]) && c[3] > c[0], `${k}: a better audition always helps (${c.map((x) => Math.round(x * 100)).join('%, ')}%)`);
  }
  const first = adm.chanceOf(a(90), inst('mt_elite'), BFA);
  const coached = adm.chanceOf(a(90 + AUDITION_COACHING.points), inst('mt_elite'), BFA);
  const back = adm.chanceOf(a(90 + AUDITION_COACHING.points, { attempts: 1, priorBest: 90 }), inst('mt_elite'), BFA);
  const backSame = adm.chanceOf(a(90, { attempts: 1, priorBest: 90 }), inst('mt_elite'), BFA);
  check(coached > first, `coaching raises the odds (${Math.round(first * 100)}% to ${Math.round(coached * 100)}%)`);
  check(back > coached && back > first, `a panel that remembers someone who has grown helps again (${Math.round(back * 100)}%)`);
  check(backSame >= first && backSame - first < 0.12, 'coming back unchanged is not held against them, and does not help much');
  check(first < 0.2 && back > first * 1.6, `at the top, a first try is a long shot (${Math.round(first * 100)}%) and a better-prepared second is much likelier (${Math.round(back * 100)}%)`);
  // A weak audition is no chance at the top, however lucky, and an excellent one is no certainty.
  const weakBest = Math.max(...Array.from({ length: 41 }, (_, i) => adm.assess(a(60), inst('mt_elite'), BFA, ((i / 40) * 2 - 1) * adm.luckRange(inst('mt_elite'), BFA)).score));
  check(weakBest < 0.12, 'a weak audition cannot get into an elite program on any day');
  check(adm.chanceOf(a(100, { recs: 2 }), inst('mt_elite'), BFA) < 0.97, 'and nobody is certain, however good');
  check(adm.luckRange(inst('mt_elite'), BFA) > adm.luckRange(K.research, MAJOR_BY_ID.history), 'a few places won in a room swing more on the day than a pile of grades');
  // The reasons given say so.
  const re = adm.assess(a(95, { attempts: 1, priorBest: 85 }), inst('mt_conservatory'), BFA, 0).reasons.join(' ');
  check(/remembered you/.test(re) && /grown/.test(re), 'the panel says it remembered them, and that they had grown');
}
section('odds rise with a better audition, with coaching, and with having been before and grown; nothing is certain');

// ---------- 8. A first try, a second try, over many lives ----------
{
  // Five kinds of performer, from good to excellent, each begun once and copied for every trial.
  const TALENTS = [68, 72, 76, 80, 84];
  const bases = TALENTS.map((t) => young(t, 3.4));
  const trial = (i) => {
    rng.seed(seed * 1000 + i);
    store.state = structuredClone(bases[i % TALENTS.length]);
    uni.plan(); uni.setMajor('musical_theater_bfa');
    const rows = uni.shortlist({ all: true }).rows;
    const mid = rows.filter((r) => r.label.startsWith('Musical theater BFA'));
    const picks = [rows.find((r) => r.label.startsWith('Elite')), mid[0], mid[1]].map((r) => r.id);
    picks.forEach((id) => uni.toggle(id));
    uni.send();
    uni.onResults(); // results day: the waiting lists move
    if (uni.answers().some((a) => a.outcome === 'accepted')) return { won1: true, talent: TALENTS[i % TALENTS.length] };
    // Out of school for a year: coaching, then the same places again.
    nextYear();
    const coached = uni.coaching().can && uni.takeCoaching().ok;
    const set = uni.plan().majorId;
    picks.forEach((id) => uni.toggle(id));
    uni.send();
    uni.onResults();
    return { won1: false, won2: uni.answers().some((a) => a.outcome === 'accepted'), coached, set, tries: picks.map((id) => uni.triesOf('musical_theater_bfa', id).n), talent: TALENTS[i % TALENTS.length] };
  };
  const out = Array.from({ length: 100 }, (_, i) => trial(i));
  const won1 = out.filter((o) => o.won1).length;
  const retried = out.filter((o) => !o.won1);
  const won2 = retried.filter((o) => o.won2).length;
  const never = retried.length - won2;
  check(won1 > 0 && won1 < 100, `some get in first time, some do not (${won1} of 100)`);
  check(won2 > 0, `some who were turned away everywhere get in on the second try (${won2} of ${retried.length})`);
  check(never > 0, `and some are still without a place after two years (${never})`);
  check(retried.every((o) => o.set === 'musical_theater_bfa'), 'the subject carries over to the next round');
  check(retried.every((o) => o.tries.every((n) => n === 2)), 'every place applied to twice counts two attempts');
  check(retried.every((o) => o.coached), 'coaching could be had in between');
  const byTalent = (t) => { const g = out.filter((o) => o.talent === t); return g.filter((o) => o.won1).length / g.length; };
  check(byTalent(84) > byTalent(68), `the better performers do better the first time (${Math.round(byTalent(68) * 100)}% at the weakest, ${Math.round(byTalent(84) * 100)}% at the strongest)`);
  const secondRate = won2 / retried.length;
  check(secondRate > 0.25, `a second year is a real chance (${Math.round(secondRate * 100)}% of those turned away the first time)`);
}
section('over 100 lives: some win first time, some on the second try after coaching, some not yet');

// ---------- 9. Coaching ----------
{
  store.state = structuredClone(young(80, 3.4));
  uni.plan();
  check(!uni.coaching().show && !uni.takeCoaching().ok, 'no coaching until the subject is one decided by audition');
  uni.setMajor('history');
  check(!uni.coaching().show, 'not for history');
  uni.setMajor('musical_theater_bfa');
  const c = uni.coaching();
  check(c.show && c.can && c.cost > 0 && c.points === 0, 'for a performance course it is offered, at a price');
  const cash = P().finance.cash;
  const before = uni.profile('musical_theater_bfa', uni.catalog('us').find((u) => u.kindId === 'mt_elite')).audition;
  const r = uni.takeCoaching();
  const after = uni.profile('musical_theater_bfa', uni.catalog('us').find((u) => u.kindId === 'mt_elite')).audition;
  check(r.ok && P().finance.cash === cash - c.cost && after === before + AUDITION_COACHING.points, `it costs money (${c.cost}) and adds ${AUDITION_COACHING.points} points to the audition (${before} to ${after})`);
  check(!uni.takeCoaching().ok && /this year/.test(uni.coaching().why), 'once a year');
  for (let i = 0; i < 6; i++) { S().year += 1; uni.takeCoaching(); }
  check(uni.coaching().points === AUDITION_COACHING.cap && !uni.coaching().can, 'and it adds up only to a point');
  const poor = structuredClone(young(80, 3.4)); store.state = poor; uni.plan(); uni.setMajor('musical_theater_bfa'); P().finance.cash = 10;
  check(!uni.takeCoaching().ok && /afford/.test(uni.coaching().why), 'and cannot be had without the money');
}
section('coaching: a price, points on the day, once a year, up to a cap');

if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(' ✗', p);
  process.exit(1);
}
for (const m of ok) console.log(' ✓', m);
console.log('Musical theater BFAs hold together.');
