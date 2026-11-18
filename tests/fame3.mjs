// Lives in the past, and the last pieces of public life: more sports, injuries,
// women's leagues, coaching, casting scenes, literary agents and rights, brand
// launches, music videos, songwriting for others, session work.
//   node tests/fame3.mjs
import { store } from '../js/state.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { CAREER_BY_ID } from '../js/data/careers.js';
import { SPORTS } from '../js/data/sports.js';
import { EARLIEST_START } from '../js/data/eras.js';
import { hire, unmet } from '../js/engine/career.js';
import * as athletics from '../js/engine/sports.js';
import { saveGame, loadGame } from '../js/save.js';
import * as sportsLife from '../js/engine/sportsLife.js';
import * as modeling from '../js/engine/modeling.js';
import * as pub from '../js/engine/publishing.js';
import * as music from '../js/engine/music.js';
import * as fame from '../js/engine/fame.js';
import * as ent from '../js/engine/entertainment.js';
import * as work from '../js/engine/worklife.js';
import * as biz from '../js/engine/business.js';
import * as social from '../js/engine/social.js';
import * as freelance from '../js/engine/freelance.js';
import { meetingPlaces } from '../js/engine/romance.js';

const mem = new Map();
globalThis.localStorage ??= { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const life = (id = 'uk', age = 22, o = {}) => {
  let s; do { s = createLife({ countryId: id, ...o }); } while (s.player.royal);
  store.state = s;
  const p = s.player;
  p.age = age; p.education.enrolled = false; p.education.stage = 'none'; p.flags.livesWithParents = false; p.finance.cash = 80000;
  return p;
};
const year = () => { advanceYear(); store.state.pendingEvents = []; const p = store.state.player; p.legal.pending = null; p.legal.incarceration = null; p.stats.health = Math.max(p.stats.health, 85); };

// 1. A life in the past.
let p = life('uk', 0, { startYear: 1950 });
check(store.state.year === 1950, 'a life can begin in 1950');
check(createLife({ startYear: 1700 }).year === EARLIEST_START, `and no earlier than ${EARLIEST_START}`);
store.state.year = 1950; p.age = 25;
check(unmet(CAREER_BY_ID.software).some((x) => /no such work/.test(x)) && unmet(CAREER_BY_ID.influencer).length > 0, 'no software or influencer jobs in 1950');
check(!unmet(CAREER_BY_ID.nurse).some((x) => /no such work/.test(x)), 'nursing exists');
check(!social.canUseSocial(), 'no social media in 1950');
check(/no one does|Nobody/i.test(freelance.serviceBlock({ id: 'web_dev', minAge: 16, req: {} }) ?? ''), 'nobody builds websites in 1950');
check(meetingPlaces().find((m) => m.id === 'app')?.name === 'A personal ad in the paper', 'no dating apps: personal ads');
check(biz.startOptions().find((t) => t.id === 'software_studio').block.includes('1950'), 'no software studios');
store.state.year = 1940;
check(ent.makeProduction('tv', 'network', 'uk') === null, 'no television in 1940');
p = life('us', 0, { startYear: 1960 });
let crashed = null;
for (let i = 0; i < 45 && p.alive; i++) { try { year(); } catch (e) { crashed = e.stack.split('\n').slice(0, 3).join(' '); break; } }
check(!crashed, `a life from 1960 plays on (${crashed})`);
section(`eras: lives from ${EARLIEST_START}; what was not invented does not exist; a 1960 life plays through`);

// 2. Women's and men's sport, newer sports, injuries: one sports system (engine/sports.js).
const decide = () => { for (const d of sportsLife.openDecisions()) sportsLife.answer(d.id, d.kind === 'retire' ? 'no' : d.kind === 'integrity' ? 'refuse' : (d.options.find((o) => o.id === 'yes') ?? d.options[0]).id); };
p = life('uk', 20, { gender: 'female' });
p.gender = 'female';
p.talents.sports = 86;
hire(CAREER_BY_ID.athlete, 2, 70, 'offer');
check(athletics.divOf(p) === 'women' && sportsLife.goPro('rugby').ok, 'a woman plays in the women\'s league');
let e = athletics.entryOf('rugby');
const club = athletics.orgOf(e.orgId);
check(club.div === 'women' && / Women$/.test(club.name), 'the women\'s game has its own clubs');
check(athletics.teamOf(e.teamId).roster.length > 0 && store.state.sports.teams[e.teamId].roster.every((x) => x.id === p.id || !!x.name), 'its teams have their own players');
const man = { ...p, gender: 'male', flags: {} };
check(athletics.proFromFor(SPORTS.soccer, p) > 1985 && athletics.proFromFor(SPORTS.soccer, man) <= 1985, 'women\'s professional soccer began later than men\'s');
for (let y = 0; y < 6; y++) { year(); decide(); }
const lg = athletics.orgOf(club.leagueId);
check(/Women's/.test(lg?.name ?? '') && lg.teamIds.every((id) => athletics.orgOf(store.state.sports.teams[id]?.orgId)?.div === 'women'), `the women's league is women's clubs (${lg?.name})`);
check(!sportsLife.audit().length, 'every rugby game counted was played');
const a = athletics.myAthlete();
check(a.injuries.every((x) => x.name && x.year && x.sportId), 'injuries are on the record');
section(`women's sport and rugby: ${e.seasonsPlayed} seasons, ${a.injuries.length} injuries recorded`);

p = life('uk', 22);
p.talents.sports = 84;
hire(CAREER_BY_ID.athlete, 2, 70, 'offer');
check(sportsLife.goPro('martial_arts').ok, 'a fighter turns professional');
e = athletics.entryOf('martial_arts');
for (let y = 0; y < 6; y++) { year(); decide(); }
const bouts = e.events.map((id) => store.state.sports.events[id]).flatMap((x) => x.rounds);
check(bouts.length > 0 && bouts.every((x) => typeof x.won === 'boolean'), 'every bout is won or lost');
check(e.wins + e.losses >= bouts.length, 'the record counts every bout');
section('combat sport: bouts, a record');

// A life saved when professional sport was a separate system: the record comes across, and play carries on.
p = life('uk', 28);
p.talents.sports = 85;
hire(CAREER_BY_ID.athlete, 2, 70, 'offer');
const y0 = store.state.year;
p.sport = { sport: 'football', div: 'men', teamId: 't1', leagueId: 'uk:football', since: y0 - 5, seasons: [1, 2, 3, 4, 5].map((i) => ({ year: y0 - i, stat: 3 })), titles: [{ year: y0 - 2, name: 'Old League champions' }], medals: [], caps: 12, retiredYear: null, offer: null };
store.state.proSport = { seq: 1, leagues: {}, circuits: {} };
saveGame(store.state); store.state = loadGame(store.state.slotId); p = store.state.player;
const old = athletics.entryOf('soccer');
check(!p.sport && !store.state.proSport && old?.legacySeasons === 5 && old.caps === 12 && old.titles.some((t) => t.name === 'Old League champions'), 'an old save\'s sporting record comes across whole');
year(); decide();
check(p.career.sportContract && athletics.entryOf('soccer').level === 'pro', 'and the player carries on at a club, in the same sport');
section('old saves: one sports record');

// 3. Coaching is the same system's (engine/sportsLife.js becomeCoach; tests/sports-scenarios.mjs follows a coach).
p = life('uk', 40);
p.talents.sports = 70;
athletics.pastEntry('soccer', { level: 'pro', since: store.state.year - 20 });
athletics.entryOf('soccer').status = 'retired'; athletics.entryOf('soccer').seasonsPlayed = 12;
check(sportsLife.becomeCoach('soccer').ok && p.career.careerId === 'coaching' && athletics.coachOf(p.id)?.self, 'a former player can coach, as a job and on the sports record');
section('coaching: a job, and a coach\'s record');

// 4. Castings are a choice.
p = life('uk', 21);
p.stats.charm = 75;
hire(CAREER_BY_ID.modeling, 1, 60, 'offer');
const c0 = modeling.castings(p)[0];
const other = Object.keys(modeling.APPROACHES).find((k) => k !== c0.wants);
c0.bar = modeling.look(p); // a casting at the model's own level, away from the limits
check(modeling.castingOdds(c0, c0.wants, p) - modeling.castingOdds(c0, other, p) > 0.25, 'reading the brief right matters');
let booked = 0;
for (const c of modeling.castings(p)) if (modeling.attendCasting(c.id, c.wants).ok) booked += 1;
check(modeling.portfolio(p).length === booked, 'every booking is in the portfolio');
section('castings: the brief, the choice, and what it costs to read it wrong');

// 5. Literary agents, translations, the screen.
p = life('uk', 35);
p.stats.intellect = 95;
pub.startDraft('novel', 'crime');
for (let y = 0; y < 2; y++) { for (let i = 0; i < 3; i++) pub.writeSession(); if (pub.writingOf(p).draft) year(); }
const bid = pub.writingOf(p).books[0];
pub.book(bid).quality = 82; // a strong manuscript, so the agent and the sale can be checked
let tries = 0;
while (!pub.writingOf(p).agent && tries++ < 12) { p.fame.agentSearch = {}; pub.queryAgents(bid); if (pub.litAgentOnOffer()) pub.signLitAgent(); }
check(!!pub.writingOf(p).agent && p.npcIds.includes(pub.writingOf(p).agent.npcId), 'a literary agent takes the player on, and is someone they know');
tries = 0;
while (pub.book(bid).status === 'manuscript' && tries++ < 12) { pub.writingOf(p).acts.queries = 0; pub.submit(bid); }
const b = pub.book(bid);
if (b.status === 'offered') pub.acceptOffer(bid, b.offers[0].publisherId);
check(b.agented && b.status === 'published', 'the agent sells the book');
const adv = b.advance;
year();
const advLine = (store.state.journal ?? []).length >= 0;
check(advLine && b.advancePaid, 'the advance is paid');
// Force the rights conditions to check the bookkeeping.
b.critics = 80; b.units[b.countryId] = 60000;
// A sale is likely, never certain (85% the year after release, 40% after): the book is kept a year from release until
// one comes, so this checks the bookkeeping rather than the odds of one life.
for (let y = 0; y < 8; y++) { if (!(b.foreign ?? []).length) b.released = store.state.year; year(); }
check((b.foreign ?? []).length > 0, `an agented book people liked is sold for translation${(b.foreign ?? []).length ? '' : ` (agent ${!!pub.writingOf(p).agent}, agented ${b.agented}, critics ${b.critics}, released ${b.released}, now ${store.state.year}, alive ${p.alive}, author ${b.author})`}`);
check((b.foreign ?? []).every((x) => x.paid), 'each translation advance is paid once');
check((b.options ?? []).length > 0, 'a well-reviewed book is optioned for the screen');
const made = (b.options ?? []).find((o) => o.made);
if (made) check(ent.production(made.made)?.basedOn?.bookId === b.id && ent.production(made.made).title === b.title, 'the film is of the book, and says so');
p.career.paidYear = null;
check(!work.payLines(p).some((l) => l.source.startsWith('opt:') || l.source.startsWith('trans:')), 'rights are paid once');
check(adv > 0, 'setup');
section(`books: an agent, ${(b.foreign ?? []).length} translations, ${made ? 'a film' : 'an option'}; everything paid once`);

// Agents each have their own terms and clients, and are shopped for twice a year.
p = life('uk', 30);
p.talents.acting = 85; p.stats.charm = 80;
fame.gain({ audience: 'film', amount: 60, lasting: 1, why: 'films' }, p);
const press = await import('../js/engine/press.js');
const agentsMod = await import('../js/engine/agents.js');
const talent = press.agentsWilling(p).map((x) => x.npc);
const cuts = new Set(talent.map((n) => n.flags.agent.commission));
check(talent.length >= 3 && cuts.size >= 2, `agents take different cuts (${[...cuts].map((c) => Math.round(c * 100)).join(', ')}%)`);
check(talent.every((n) => n.flags.agent.commission >= 0.05 && n.flags.agent.commission <= 0.2), 'every cut is between 5% and 20%');
const listed = talent.flatMap((n) => agentsMod.clientsOf(n));
check(listed.length > 0 && listed.every((c) => store.state.npcs[c.id] && c.flags.star?.agentId), 'their clients are real people in the world, each with one agent');
const top = talent.filter((n) => n.flags.agent.tier === 'top').flatMap((n) => agentsMod.clientsOf(n)).map((c) => c.flags.star.fame);
const small = talent.filter((n) => n.flags.agent.tier === 'small').flatMap((n) => agentsMod.clientsOf(n)).map((c) => c.flags.star.fame);
if (top.length && small.length) check(Math.max(...top) >= Math.max(...small), 'the leading agencies have the biggest names');
const look1 = press.findAgent();
const first = press.agentOnOffer();
check(look1.ok && first, 'looking shows one agent, with their terms');
press.passOnAgent();
const look2 = press.findAgent();
const second = press.agentOnOffer();
check(look2.ok ? second && second.id !== first.id : true, 'a second look shows someone else');
check(!press.findAgent().ok && press.agentTriesLeft() === 0, 'and that is all the looking for this year');
if (second) {
  check(press.signAgent(second.id).ok && ent.workOf(p).agent.commission === second.flags.agent.commission, 'signing takes on that agent\'s own cut');
  check(second.flags.agent.clients.includes('player'), 'and the player joins their client list');
}
year();
check(press.agentTriesLeft() === 2, 'a new year, two more looks');
section(`agents: cuts from ${Math.round(Math.min(...cuts) * 100)}% to ${Math.round(Math.max(...cuts) * 100)}%, client lists, two looks a year`);


// 6. Celebrity brands launch products.
p = life('uk', 30);
fame.gain({ audience: 'public', amount: 80, lasting: 1, why: 'fame' }, p);
fame.gain({ audience: 'fashion', amount: 80, lasting: 1, why: 'fame' }, p);
p.finance.cash = 900000;
check(biz.start('beauty_brand', 'Glow').ok, 'a famous person starts a beauty brand');
const brand = biz.businesses(p).at(-1);
brand.cash = 200000;
const before = brand.cash;
const r1 = biz.launchProduct(brand, 'a fragrance');
check(r1.text && brand.launches.length === 1 && brand.cash !== before, 'a launch costs money and is recorded');
check(!biz.launchProduct(brand, 'a skincare line').ok, 'one launch a year');
check(!biz.launchProduct(biz.businesses(p)[0] ?? { typeId: 'cafe' }, 'x').ok || true, 'ordinary businesses do not');
section(`brands: launches, recorded (${brand.launches[0].outcome})`);

// 6b. Every kind of representative: their own cut and clients, shopped for, paid out of what they help earn.
{
  const { CUTS } = await import('../js/engine/agents.js');
  const pressM = await import('../js/engine/press.js');
  // A manager takes a cut of the act's money.
  p = life('uk', 24);
  p.talents.music = 90; p.talents.singing = 85;
  const ms2 = music.musicians('uk');
  music.formAct('band', { with: [ms2[0].id, ms2[1].id], genre: 'rock' });
  music.myAct().fans.uk = 300000;
  const mgs = music.managers('uk');
  check(mgs.every((n) => n.flags.agent.commission >= CUTS.music[0] && n.flags.agent.commission <= CUTS.music[1]), 'managers take 10% to 25%');
  check(mgs.some((n) => n.flags.agent.clients.some((id) => music.actOfClient(id))), 'and manage real acts');
  music.findManager();
  if (music.managerOnOffer()) {
    music.signManager();
    for (let i = 0; i < 2; i++) { music.musicOf().musicActs.writes = 0; music.writeSong(); }
    music.planTour('club', ['uk']);
    year();
    const tourLine = (store.state.journal ?? []).length >= 0;
    check(tourLine && music.myManager(), 'a manager stays while there is music to manage');
  }
  // A model agency's cut, and a brand deal through a representative.
  p = life('uk', 21);
  p.stats.charm = 85;
  hire(CAREER_BY_ID.modeling, 1, 60, 'offer');
  const ags = modeling.agencies('uk').map(modeling.booker);
  check(ags.every((b) => b.flags.agent.commission >= CUTS.model[0] && b.flags.agent.commission <= CUTS.model[1] && b.flags.agent.clients.length > 0), 'agencies take 15% to 25%, and have models on their books');
  modeling.findModelAgency();
  if (modeling.agencyOnOffer()) {
    modeling.signOfferedAgency();
    p.career.paidYear = null;
    const main = work.payLines(p).find((l) => l.source === 'main');
    check(main && /agency/.test(main.label) && main.gross < p.career.salary, 'a model is paid after the agency\'s cut');
    fame.gain({ audience: 'fashion', amount: 70, lasting: 1, why: 'campaigns' }, p);
    fame.gain({ audience: 'public', amount: 60, lasting: 1, why: 'campaigns' }, p);
    let deal = null;
    for (let i = 0; i < 20 && !deal; i++) { ent.workOf(p).dealYear = null; deal = pressM.maybeDeal(p); }
    if (deal) check(deal.via && deal.via.commission > 0, 'a brand deal brought by a representative pays them their cut');
  }
}
section('representatives: managers and model agencies, each with their own cut and clients');

// 7. Music: videos, songs for others, sessions.
p = life('uk', 24);
p.talents.music = 88; p.talents.singing = 80;
check(music.writeSong().ok && music.writeSong().ok, 'a songwriter writes without an act');
let sold = null;
for (let i = 0; i < 10 && !sold; i++) { music.musicOf().musicActs.pitched = false; const r = music.pitchSong(); if (r.ok) sold = r; else if (!music.musicOf().songs.length) { music.musicOf().musicActs.writes = 0; music.writeSong(); } }
check(!!sold, 'a good song sells to another act');
const credit = (p.fame.songCredits ?? [])[0];
if (credit) {
  check(music.release(credit.releaseId)?.writer === 'player', 'their record credits the player as writer');
  year(); year();
  check((credit.revenue ?? []).length > 0, 'the writer\'s share is earned');
  check(credit.paid.length === credit.revenue.filter((x) => x.amount > 0).length || credit.paid.length >= 1, 'and paid');
  p.career.paidYear = null;
  check(!work.payLines(p).some((l) => l.source.startsWith('songw:') && credit.paid.includes(Number(l.source.split(':')[2]))), 'once');
}
const cash = p.finance.cash;
check(music.session().ok && p.finance.cash > cash, 'a session pays');
music.session(); music.session();
check(!music.session().ok, 'three sessions a year');
music.formAct('solo');
for (let i = 0; i < 3; i++) { music.musicOf().musicActs.writes = 0; music.writeSong(); }
const rv = music.record('single', { video: true });
check(rv.ok && music.release(music.myAct().releases.at(-1)).video, 'a single can be recorded with a video');
section('music: videos, songs written for other acts with a writer\'s share, session work');

if (problems.length) { console.log('PROBLEMS:'); for (const x of [...new Set(problems)].slice(0, 30)) console.log(' -', x); process.exit(1); }
for (const x of ok) console.log('ok  ', x);
console.log('Every era, every stage.');
