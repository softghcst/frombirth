// Baseball as it is counted and lived (data/sports.js BASEBALL): a season's line (batting average, home runs, runs
// batted in, stolen bases; wins, saves, earned run average, strikeouts), scaled from the games played in the game to
// the length of the real season; a pitcher's role (starter, reliever, closer) and the rare player who does both; career
// totals and their milestones; no-hitters and cycles; the All-Star Game and the Home Run Derby; the postseason by its
// own names and its Most Valuable Player; innings limits for young arms and rehab assignments; winter ball; the World
// Baseball Classic; summer leagues and a draft adviser; English and homesickness for players signed abroad; and, five
// years after the last game, the Hall of Fame.
//
//   e.bb = { role, twoWay, lines: [{ year, level, team, top, G, AB, H, HR, RBI, SB, AVG | GS, W, L, SV, IP, K, ER, ERA, capped }],
//            career: { G, AB, H, HR, RBI, SB, GP, W, L, SV, IP, K, ER }, reached: { H: 1000, ... }, feats: [{ year, what }],
//            allStar: [year], derby: [{ year, won }], honors: [{ year, what }], rehab: [{ year }], winter: 'always'|null,
//            winters: [{ year, league, pay }], classic: [{ year, result }], summer: [{ year, delta }], wood, adviser,
//            hall: { first, votes: [{ year, pct }], elected, dropped } }
import { log, milestone } from '../state.js';
import { clamp } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { BASEBALL as B } from '../data/sports.js';
import { gain } from './fame.js';
import { gradeOf } from './recruiting.js';
import * as sp from './sports.js';
import { internals as life, settle } from './sportsLife.js';

const { seeded, overall } = sp.internals;
const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const k = (e, key) => (e.skills[key] ?? 0) / 100;
const round1 = (n) => Math.round(n * 10) / 10;
export const isBaseball = (e) => e?.id === 'baseball';
/** The baseball record, made when first needed. */
export function record(e) {
  return (e.bb ??= { role: null, twoWay: false, lines: [], career: {}, reached: {}, feats: [], allStar: [], derby: [], honors: [], rehab: [], winter: null, winters: [], classic: [], summer: [], wood: 0, adviser: false, hall: null });
}
export const hitScore = (e) => Math.round((k(e, 'contact') + k(e, 'power') + k(e, 'discipline')) / 3 * 100);
export const armScore = (e) => Math.round((k(e, 'control') + k(e, 'stuff') + k(e, 'stamina')) / 3 * 100);

/** The level a team plays at, as baseball names it: MLB, NPB, KBO, a minor league, college, school. */
export function levelOf(org) {
  if (!org) return 'other';
  if (org.minorLevel) return org.minorLevel;
  if (org.level === 'pro') return org.tier > 1 ? 'other' : B.top[org.countryId] ?? 'other';
  return org.level === 'college' ? 'college' : org.level === 'school' ? 'school' : 'other';
}
export const isTop = (level) => ['MLB', 'NPB', 'KBO'].includes(level);
const gamesAt = (level) => B.games[level] ?? B.games.other;

// ---------- Roles ----------

/** A pitcher's job: starters need the stamina; the best arm in the bullpen closes. */
export function roleFor(e, level) {
  if (e.position !== 'pitcher') return null;
  if (k(e, 'stamina') >= 0.5) return 'starter';
  return k(e, 'stuff') >= 0.72 && (isTop(level) || /A$|ball|League|team/.test(level)) ? 'closer' : 'reliever';
}

// ---------- The season's line ----------

/** What the skills alone would give: hits and home runs a game, earned runs and strikeouts per nine innings. */
const expect = (e) => ({ avg: 0.19 + k(e, 'contact') * 0.13, hr: 0.04 + k(e, 'power') ** 2 * 0.26, era: Math.max(1.6, 5.6 - k(e, 'stuff') * 2 - k(e, 'control') * 1.4), k9: (0.6 + k(e, 'stuff')) * 7.4 });
/** A season is longer than the games played here: the line leans on the skills, and moves with how those games went. */
const lean = (expected, got, should) => expected * clamp(1 + 0.35 * ((should > 0 ? got / should : 1) - 1), 0.75, 1.3);

/** A hitter's line over G games, from what they did in the games played (or from their skills alone). */
function batting(r, e, G, sample) {
  const X = expect(e);
  const AB = Math.round(G * 3.8);
  const avg = sample?.n ? lean(X.avg, sample.hits / sample.n, 4 * (0.15 + k(e, 'contact') * 0.2)) : X.avg * r.normal(1, 0.05);
  const hr = sample?.n ? lean(X.hr, sample.homeRuns / sample.n, 0.12 + k(e, 'power') * 0.2) : X.hr * r.normal(1, 0.12);
  const H = Math.min(AB, Math.round(AB * avg));
  const HR = Math.min(H, Math.max(0, Math.round(G * hr)));
  const RBI = Math.round((HR * 1.55 + (H - HR) * 0.3) * r.normal(1, 0.08));
  const SB = Math.max(0, Math.round(r.normal(G * k(e, 'baserunning') ** 2 * 0.3, 3)));
  return { G, AB, H, HR, RBI, SB, AVG: AB ? Math.round(H / AB * 1000) / 1000 : 0 };
}
/** A pitcher's line: starts every fifth day, or most nights out of the bullpen. */
function pitching(r, e, G, role, winRate, sample, o = {}) {
  const X = expect(e);
  const era = sample?.innings ? lean(X.era, sample.earned * 9 / sample.innings, Math.max(0.8, 5.2 - k(e, 'stuff') * 2.4 - k(e, 'control') * 1.4)) : X.era * r.normal(1, 0.1);
  const k9 = sample?.innings ? lean(X.k9, sample.strikeouts / sample.innings, 0.6 + k(e, 'stuff')) : X.k9 * r.normal(1, 0.06);
  let GP, GS = 0, IP, W, L, SV = 0;
  if (role === 'starter') {
    GS = GP = Math.round(G / (o.twoWay ? 6.5 : 5));
    const per = clamp(4.2 + k(e, 'stamina') * 3, 4.5, 6.8);
    IP = GS * per;
    // Young arms are protected: an innings limit, and the season ends early.
    if (o.cap && IP > o.cap) { IP = o.cap; GS = GP = Math.max(1, Math.round(IP / per)); }
    const good = clamp((4.6 - era) / 3, -0.3, 0.45);
    W = Math.round(GS * clamp(winRate * 0.72 + good * 0.35, 0.1, 0.8));
    L = Math.round(GS * clamp((1 - winRate) * 0.6 - good * 0.25, 0.08, 0.7));
  } else {
    GP = Math.round(G * (role === 'closer' ? 0.38 : 0.42));
    IP = GP * (role === 'closer' ? 1 : 1.1);
    W = Math.round(GP * 0.07); L = Math.round(GP * 0.06);
    SV = role === 'closer' ? Math.round(G * winRate * 0.42 * clamp(0.75 + (overall(e, o.player) - 70) / 100, 0.65, 0.95)) : Math.round(r.next() * 4);
  }
  IP = round1(IP);
  const ER = Math.round(era * IP / 9);
  return { GP, GS, W, L, SV, IP, K: Math.round(k9 * IP / 9), ER, ERA: IP ? Math.round(ER * 9 / IP * 100) / 100 : 0 };
}

/**
 * The season's line for one team the player played for (engine/sportsLife.js yearIn, after each baseball season).
 * @param {object[]} mine  the fixtures the player played in
 */
export function seasonLine(state, a, e, season, team, mine, sum) {
  if (!isBaseball(e)) return null;
  const p = state.player;
  const R = record(e);
  const org = sp.orgOf(team.orgId, state);
  const level = levelOf(org);
  const reg = season.fixtures.filter((f) => f.home === team.id || f.away === team.id);
  const played = mine.filter((f) => !f.playoff);
  if (!played.length || !reg.length) return null;
  const r = seeded(`line/${p.id}/${season.id}`);
  // A reliever is in the bullpen every night, whatever the lineup card says: only an injury shortens his season.
  const bullpen = e.position === 'pitcher' && roleFor(e, level) !== 'starter';
  const hurt = a.injuries.some((x) => x.sportId === e.id && x.status === 'out');
  const share = bullpen ? (hurt ? Math.max(0.3, played.length / reg.length) : 1) : played.length / reg.length;
  const G = Math.max(1, Math.round(gamesAt(level) * share));
  const won = played.filter((f) => (f.home === team.id ? f.score[0] > f.score[1] : f.score[1] > f.score[0])).length;
  const winRate = won / played.length;
  const pitcher = e.position === 'pitcher';
  const pro = org.level === 'pro';
  if (pitcher) {
    const role = roleFor(e, level);
    if (pro && R.role && role !== R.role) log(role === 'starter' ? 'You are in the starting rotation now.' : role === 'closer' ? 'You are the closer now: the ninth inning is yours.' : 'You were moved to the bullpen.', 'system', 'neutral');
    R.role = role;
  }
  const sumOf = (key) => played.reduce((s, f) => s + (f.me[key] ?? 0), 0);
  const line = { year: state.year, level, team: team.name, top: isTop(level), seasonId: season.id };
  const lastIP = [...R.lines].reverse().find((x) => x.IP && x.year < state.year)?.IP ?? 0;
  const cap = pro && pitcher && R.role === 'starter' && p.age <= 23 ? Math.max(110, lastIP + 30) : null;
  if (pitcher) {
    Object.assign(line, pitching(r, e, G, R.role, winRate, { innings: sumOf('innings'), earned: sumOf('earned'), strikeouts: sumOf('strikeouts') }, { cap, player: p, twoWay: R.twoWay }));
    if (cap && line.IP >= cap) { line.capped = true; sp.say(state, `${org.name} shut you down in September at ${line.IP} innings: a young arm is not to be worn out.`, 'neutral', { screen: 'sport', id: e.id }); }
    if (R.twoWay) Object.assign(line, batting(r, e, Math.round(G * 0.8), null));
  } else {
    Object.assign(line, batting(r, e, G, { n: played.length, hits: sumOf('hits'), homeRuns: sumOf('homeRuns'), rbi: sumOf('rbi') }));
    if (R.twoWay) Object.assign(line, pitching(r, e, G, 'starter', winRate, null, { cap, player: p, twoWay: true }));
  }
  R.lines.push(line);
  feats(state, e, R, line, r, org);
  if (line.top) {
    totals(state, e, R, line);
    midsummer(state, e, R, line, r, org);
  }
  october(state, e, R, season, team, mine, level, sum);
  return line;
}

/** What a line says, in a sentence. */
export function lineText(x) {
  const bat = x.AB ? `${x.AVG.toFixed(3).replace(/^0/, '')}, ${x.HR} home ${x.HR === 1 ? 'run' : 'runs'}, ${x.RBI} RBI${x.SB >= 10 ? `, ${x.SB} stolen bases` : ''}` : '';
  const arm = x.IP ? `${x.W}–${x.L}${x.SV >= 5 ? `, ${x.SV} saves` : ''}, ${x.ERA.toFixed(2)} ERA, ${x.K} strikeouts in ${x.IP} innings` : '';
  return [arm, bat].filter(Boolean).join(' · ');
}

/** Career totals in the big leagues, and the round numbers baseball remembers. */
function totals(state, e, R, line) {
  const C = R.career;
  const add = { G: line.G ?? 0, AB: line.AB ?? 0, H: line.H ?? 0, HR: line.HR ?? 0, RBI: line.RBI ?? 0, SB: line.SB ?? 0, GP: line.GP ?? 0, W: line.W ?? 0, L: line.L ?? 0, SV: line.SV ?? 0, IP: line.IP ?? 0, K: line.K ?? 0, ER: line.ER ?? 0 };
  for (const [key, v] of Object.entries(add)) C[key] = round1((C[key] ?? 0) + v);
  C.seasons = (C.seasons ?? 0) + 1;
  for (const [key, marks] of Object.entries(B.milestones)) {
    const mark = [...marks].reverse().find((m) => (C[key] ?? 0) >= m);
    if (mark && (R.reached[key] ?? 0) < mark) {
      R.reached[key] = mark;
      const text = `${mark.toLocaleString('en-US')} ${B.names[key]} in the big leagues.`;
      milestone(text, 'career');
      sp.moment(state, { type: 'milestone', sportId: e.id, text, sig: mark >= marks.at(-2) ? 3 : 2 });
      sp.say(state, `Career ${B.names[key].replace(/s$/, '')} number ${mark.toLocaleString('en-US')}.`, 'good', { screen: 'sport', id: e.id });
    }
  }
}

/** The single games people remember: a no-hitter, a perfect game, hitting for the cycle. */
function feats(state, e, R, line, r, org) {
  if (org.level !== 'pro' && org.level !== 'college') return;
  const tell = (what, sig) => {
    R.feats.push({ year: state.year, what, level: line.level });
    const text = `${what[0].toUpperCase()}${what.slice(1)} for ${org.name}.`;
    sp.say(state, text, 'good', { screen: 'sport', id: e.id });
    sp.moment(state, { type: 'feat', sportId: e.id, text, sig });
    if (line.top) milestone(text, 'career');
  };
  if (line.GS >= 10 && r.chance(clamp((k(e, 'stuff') * 100 - 60) / 900, 0, 0.06))) tell(r.chance(0.08) ? 'a perfect game: twenty-seven up, twenty-seven down' : 'a no-hitter', 3);
  if (line.AB >= 200 && r.chance(clamp(0.012 * k(e, 'contact') / 0.7 * (0.5 + k(e, 'baserunning')), 0, 0.03))) tell('hit for the cycle: a single, a double, a triple and a home run in one game', 2);
}

/** July: the All-Star Game, and for the sluggers the Home Run Derby. */
function midsummer(state, e, R, line, r, org) {
  const p = state.player;
  const o = overall(e, p);
  const star = o >= 84 || (line.AB ? (line.AVG >= 0.3 && line.HR >= 15) || line.HR >= 32 : (line.IP >= 100 && line.ERA <= 3.2) || line.SV >= 28);
  if (!star || o < 74) return;
  R.allStar.push(state.year);
  const mvp = r.chance(0.04);
  if (mvp) R.honors.push({ year: state.year, what: 'All-Star Game MVP' });
  sp.say(state, `You were named to the All-Star Game${R.allStar.length > 1 ? `, for the ${ordinal(R.allStar.length)} time` : ''}${mvp ? ', and were its Most Valuable Player' : ''}.`, 'good', { screen: 'sport', id: e.id });
  sp.moment(state, { type: 'allstar', sportId: e.id, text: `All-Star, ${state.year}.`, sig: 2, orgId: org.id });
  if (R.allStar.length === 1) milestone('Named to the All-Star Game.', 'career');
  gain({ audience: 'sports', amount: 3, reach: 0.4, lasting: 0.3, why: 'the All-Star Game' }, p);
  if (line.level === 'MLB' && (line.HR ?? 0) >= 28) {
    const won = r.chance(clamp(0.125 * k(e, 'power') / 0.7, 0.05, 0.3));
    R.derby.push({ year: state.year, won });
    if (won) {
      settle(state, `derby/${e.id}/${state.year}`, life.money(state, B.derbyPrize), 'prizeMoney', 'Home Run Derby: winner');
      milestone('Won the Home Run Derby.', 'career');
    }
    sp.say(state, won ? 'You won the Home Run Derby, the night before the All-Star Game.' : 'You swung in the Home Run Derby, and went out before the final.', won ? 'good' : 'neutral', { screen: 'sport', id: e.id });
  }
}
const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

/** October: the rounds by their own names, and the series' Most Valuable Player. */
function october(state, e, R, season, team, mine, level, sum) {
  const names = B.rounds[level];
  if (!names) return;
  for (const f of season.playoffs) f.label = names[f.round] ?? f.round;
  season.finalName = names.Final;
  const fin = season.playoffs.find((f) => f.round === 'Final');
  const inFinal = fin && (fin.home === team.id || fin.away === team.id);
  if (!inFinal) return;
  const champ = season.champion === team.id;
  const games = mine.filter((f) => f.playoff && f.me?.played);
  const avg = games.length ? games.reduce((s, f) => s + f.me.rating, 0) / games.length : 0;
  if (champ) {
    milestone(`Won the ${names.Final} with ${team.name}.`, 'career');
    sp.moment(state, { type: 'title', sportId: e.id, text: `${names.Final} champions, ${state.year}.`, sig: 3, seasonId: season.id });
    if (avg >= 7.4 && seeded(`mvp/${season.id}`).chance(clamp((avg - 7) / 2, 0.1, 0.7))) {
      R.honors.push({ year: state.year, what: `${names.Final} MVP` });
      milestone(`${names.Final} Most Valuable Player.`, 'career');
      sp.say(state, `You were the Most Valuable Player of the ${names.Final}.`, 'good', { screen: 'sport', id: e.id });
    }
  } else sp.say(state, `${team.name} lost the ${names.Final}.`, 'neutral', { screen: 'season', id: season.id });
  void sum;
}
/** The name of a playoff round, as its league calls it. */
export const roundName = (f) => f.label ?? f.round;

// ---------- The year around the season ----------

/** Whether the Classic is played this year. */
export const classicYear = (year) => B.classic.includes(year) || (year > 2026 && (year - 2026) % 4 === 0);

/**
 * The player's baseball year, after the season (engine/sportsLife.js yearIn): two-way play, a rehab assignment, winter
 * ball, the Classic, a summer league, a draft adviser, and life abroad for a player signed from another country.
 */
export function baseballYear(state, a, e, sum) {
  if (!isBaseball(e)) return;
  const p = state.player;
  const R = record(e);
  const o = overall(e, p);
  const S = sp.ensure(state);
  const kx = e.contractId ? S.contracts[e.contractId] : null;
  const club = kx ? sp.orgOf(kx.orgId, state) : null;
  const org = sp.orgOf(e.orgId, state);
  const level = levelOf(org);
  // Two ways: a pitcher who can hit, or a hitter who can pitch, is asked once whether to do both.
  if (!R.twoWay && !R.askedTwoWay && ['pro', 'college'].includes(e.level) && hitScore(e) >= 72 && armScore(e) >= 72) {
    R.askedTwoWay = true;
    life.decide(state, { kind: 'twoWay', sportId: e.id, key: `twoWay/${e.id}`,
      text: `You can hit and you can pitch, and ${org?.name ?? 'the club'} will let you do both: a start on the mound ${e.position === 'pitcher' ? 'every sixth day, and the designated hitter between them' : 'every sixth day, on top of your place in the lineup'}. Almost nobody manages it.`,
      options: [{ id: 'yes', label: 'Do both' }, { id: 'no', label: e.position === 'pitcher' ? 'Just pitch' : 'Just hit' }] });
  }
  // Back from a long injury: a few games in the minors first.
  const back = a.injuries.find((x) => x.sportId === e.id && x.status === 'healed' && x.healed === state.year && x.severity >= 35);
  if (back && club && !e.minor && isTop(level) && !R.rehab.some((x) => x.year === state.year)) {
    R.rehab.push({ year: state.year, injury: back.name });
    sp.say(state, `Before rejoining ${club.name} you went on a rehab assignment: a week of games with their minor league team, on a pitch count, to see that ${back.type === 'ucl' ? 'the elbow' : 'it'} holds.`, 'neutral', { screen: 'hub', id: 'health' });
  }
  winterBall(state, e, R, o, club);
  classic(state, e, R, o);
  amateur(state, e, R, o, org);
  abroad(state, a, e, o, org, kx);
  void sum;
}

/** Winter ball: the leagues at home, for money and at-bats, and a way back for a player without a club. */
function winterBall(state, e, R, o, club) {
  const p = state.player;
  const league = B.winter[p.countryId];
  if (!league || !e.proYear || p.age > 37 || o < 52) return;
  if (R.winter === 'always') return playWinter(state, e, R);
  if (R.winter === 'never' || R.winters.length) return;
  life.decide(state, { kind: 'winterBall', sportId: e.id, key: `winterBall/${e.id}/${state.year}`,
    text: `The ${league} wants you this winter: two months of games at home, in front of your own people, and a second salary.${club ? '' : ' Scouts from the big league clubs watch it, too.'} It also means no rest.`,
    options: [{ id: 'yes', label: 'Play this winter' }, { id: 'always', label: 'Play every winter' }, { id: 'never', label: 'Rest in the winter' }] });
}
function playWinter(state, e, R) {
  const p = state.player;
  if (R.winters.some((x) => x.year === state.year)) return null;
  const o = overall(e, p);
  const r = seeded(`winter/${p.id}/${state.year}`);
  const pay = life.money(state, Math.round(clamp(4000 + (o - 55) * 900, 4000, 40000) / 500) * 500);
  const team = `${r.pick(COUNTRIES[p.countryId].cities)} ${r.pick(['Leones', 'Tigres', 'Águilas', 'Estrellas', 'Gigantes', 'Toros', 'Cardenales', 'Navegantes'])}`;
  settle(state, `winter/${e.id}/${state.year}`, pay, 'salary', `${B.winter[p.countryId]}: ${team}`);
  for (const key of Object.keys(e.skills)) e.skills[key] = Math.round(Math.min(e.ceiling[key], e.skills[key] + 0.5) * 10) / 10;
  e.fatigue = clamp((e.fatigue ?? 0) + 10);
  const champion = r.chance(0.14);
  R.winters.push({ year: state.year, league: B.winter[p.countryId], team, pay, champion });
  sp.say(state, `Winter ball with ${team}: ${life.fmt(state, pay)}${champion ? ', and the league title' : ''}.`, 'good', { screen: 'sport', id: e.id });
  return { team, pay, r, o };
}

/** The World Baseball Classic: the country's professionals, every few years. */
function classic(state, e, R, o) {
  const p = state.player;
  if (!classicYear(state.year) || e.level !== 'pro' || R.classic.some((x) => x.year === state.year)) return;
  const strong = B.classicStrong.includes(p.countryId);
  if (o < (strong ? 80 : 64)) return;
  const r = seeded(`classic/${p.countryId}/${state.year}`);
  const roll = r.next() * (strong ? 1 : 3.5) - (o - 80) / 200;
  const res = roll < 0.12 ? 'champions' : roll < 0.25 ? 'runners-up' : roll < 0.5 ? 'semifinalists' : roll < 1.1 ? 'out in the quarterfinals' : 'out in the pool round';
  R.classic.push({ year: state.year, result: res });
  e.caps = (e.caps ?? 0) + r.int(3, 7);
  const text = `The World Baseball Classic ${state.year}: you played for ${COUNTRIES[p.countryId].name}, ${res}.`;
  sp.say(state, text, res === 'champions' ? 'good' : 'neutral', { screen: 'sport', id: e.id });
  sp.moment(state, { type: 'national', sportId: e.id, text: `Played for ${COUNTRIES[p.countryId].name} at the World Baseball Classic${res === 'champions' ? ', and won it' : ''}.`, sig: res === 'champions' ? 3 : 2 });
  if (res === 'champions') milestone(`Won the World Baseball Classic with ${COUNTRIES[p.countryId].name}.`, 'career');
  gain({ audience: 'sports', amount: res === 'champions' ? 8 : 3, reach: 0.6, lasting: 0.4, why: 'the World Baseball Classic' }, p);
}

/** Before the draft: a summer league with wooden bats for college players, and an adviser for the draft itself. */
function amateur(state, e, R, o, org) {
  const p = state.player;
  if (e.contractId || e.proYear) return;
  const c = e.college;
  if (org?.kind === 'college' && c && state.year - c.start <= 2 && o >= 58 && !R.summer.some((x) => x.year === state.year)) {
    life.decide(state, { kind: 'summerBall', sportId: e.id, key: `summerBall/${e.id}/${state.year}`,
      text: 'A summer league on the coast has a place for you: the best college players in the country, wooden bats instead of metal ones, and a scout behind every backstop.',
      options: [{ id: 'yes', label: 'Play this summer' }, { id: 'no', label: 'Go home and rest' }] });
  }
  const g = gradeOf(p);
  const close = g === 11 || g === 12 || (org?.kind === 'college' && c && (state.year - c.start >= 1 || c.division === 'JUCO'));
  if (!R.adviser && !R.askedAdviser && close && o >= 60 && sp.proPath(sp.SPORTS.baseball, p.countryId) === 'draft' && !['jp', 'kr'].includes(p.countryId)) {
    R.askedAdviser = true;
    life.decide(state, { kind: 'adviser', sportId: e.id, key: `adviser/${e.id}`,
      text: 'An agent offers to be your adviser for the draft: to tell the clubs what it would take to sign you, and to tell you what your pick is worth. An amateur may take advice, not an agent: he is paid nothing unless you sign, then 4% of the bonus.',
      options: [{ id: 'yes', label: 'Take him on as an adviser' }, { id: 'no', label: 'Go it alone' }] });
  }
}

/** Signed from abroad: English, the first years far from home, and money sent back to the family. */
function abroad(state, a, e, o, org, kx) {
  const p = state.player;
  const X = e.intl;
  if (!X?.signed || !kx) return;
  X.english ??= 5;
  const inStates = org && org.countryId !== p.countryId && org.countryId !== 'do';
  const was = X.english;
  X.english = clamp(X.english + (inStates ? 9 : 6) + (X.study ? 9 : 0) + Math.round(p.stats.intellect / 25));
  if (was < 60 && X.english >= 60) { log('Your English is good enough now to do without the interpreter.', 'system', 'good'); sp.moment(state, { type: 'english', sportId: e.id, text: 'Gave a first interview in English.', sig: 1 }); }
  if (X.study == null && (X.usYears ?? 0) === 0) {
    life.decide(state, { kind: 'english', sportId: e.id, key: `english/${e.id}`,
      text: 'The club runs English classes every afternoon, after practice, when everyone is tired. Coaches, teammates, the bus driver, the lady at the counter: everything in the United States will be in English.',
      options: [{ id: 'yes', label: 'Work at the classes' }, { id: 'no', label: 'Get by' }] });
  }
  if (inStates) {
    X.usYears = (X.usYears ?? 0) + 1;
    if (X.usYears <= 2 && X.english < 45) {
      a.motivation = clamp(a.motivation - 6);
      p.stats.mood = clamp(p.stats.mood - 4);
      if (X.usYears === 1) sp.say(state, `Your first season in the United States: a small town, a host family or a shared apartment, food that is not your mother's, and nobody who speaks Spanish at the bank. It is a lonely year.`, 'bad', { screen: 'sport', id: e.id });
    }
  }
  // Money home, each year, if that was the promise.
  if (X.remit === 'yearly') {
    const amount = Math.round(p.career.salary * 0.15);
    if (amount > 0 && p.finance.cash >= amount && settle(state, `remit/${e.id}/${state.year}`, -amount, 'giftOut', 'Money sent home to the family')) closer(state, 3);
  }
}
/** The family, a little closer. */
function closer(state, by) {
  const p = state.player;
  for (const id of p.npcIds) { const n = state.npcs[id]; if (n?.alive && ['parent', 'sibling'].includes(n.role)) n.meters.relationship = clamp(n.meters.relationship + by); }
}

// ---------- The Hall of Fame ----------

/** How a career looks to the voters: the counting numbers, the honors, the rings. */
export function hallScore(e) {
  const R = record(e);
  const C = R.career;
  const awards = (e.awards ?? []).length;
  return Math.round((C.H ?? 0) / 3000 * 62 + (C.HR ?? 0) / 500 * 42 + (C.W ?? 0) / 300 * 75 + (C.SV ?? 0) / 500 * 55 + (C.K ?? 0) / 3000 * 30
    + R.allStar.length * 2.5 + awards * 3 + R.honors.length * 2 + (e.titles ?? []).length * 1.5);
}
/**
 * Each year for a player whose big league days are over (engine/sportsLife.js tickSports): on the ballot five years after the last game, for
 * up to ten years; three quarters of the votes to get in, one in twenty to stay on.
 */
export function hallYear(state, e) {
  if (!isBaseball(e) || !e.bb || e.contractId || (e.status === 'active' && e.level === 'pro')) return;
  const R = record(e);
  const H = B.hall;
  if ((R.career.seasons ?? 0) < H.seasons || R.hall?.elected || R.hall?.dropped) return;
  // Five years after the last game in the big leagues (whether or not he ever said he was retiring).
  const last = Math.max(0, ...R.lines.filter((x) => x.top).map((x) => x.year));
  if (state.year - last < H.wait) return;
  const hall = (R.hall ??= { first: state.year, votes: [], elected: null, dropped: null });
  if (hall.votes.some((v) => v.year === state.year)) return;
  const n = hall.votes.length;
  const r = seeded(`hall/${state.player.id}/${state.year}`);
  const pct = round1(clamp(hallScore(e) * 0.82 + n * 2.5 + r.normal(0, 3), 0, 99.7));
  hall.votes.push({ year: state.year, pct });
  if (pct >= H.elect) {
    hall.elected = state.year;
    milestone(`Elected to the Baseball Hall of Fame${n === 0 ? ', on the first ballot' : ''}.`, 'career');
    sp.say(state, `The call came: ${pct}% of the vote. You are in the Hall of Fame${n === 0 ? ', on the first ballot' : `, on your ${ordinal(n + 1)} ballot`}.`, 'good', { screen: 'sport', id: e.id });
    sp.moment(state, { type: 'hall', sportId: e.id, text: 'Elected to the Hall of Fame.', sig: 3 });
    gain({ audience: 'sports', amount: 15, reach: 0.8, lasting: 0.9, why: 'the Hall of Fame' }, state.player);
  } else if (pct < H.stay || n + 1 >= H.ballots) {
    hall.dropped = state.year;
    log(pct < H.stay ? `Hall of Fame: ${pct}% of the vote, under the 5% it takes to stay on the ballot.` : `Hall of Fame: ${pct}% in your tenth and last year on the ballot.`, 'system', 'neutral');
  } else log(`Hall of Fame: ${pct}% of the vote${n === 0 ? ' in your first year on the ballot' : ''}. It takes 75%.`, 'system', 'neutral');
}

export const BASEBALL_ANSWERS = {
  twoWay(state, d, choice) {
    const e = sp.entryOf(d.sportId, state.player.id, state);
    if (!e) return { ...result(false, 'That has passed.', 'neutral'), close: true };
    record(e).twoWay = choice === 'yes';
    if (choice === 'yes') { milestone('Became a two-way player: pitching and hitting.', 'career'); sp.moment(state, { type: 'twoWay', sportId: e.id, text: 'A two-way player.', sig: 2 }); }
    return result(true, choice === 'yes' ? 'You will pitch and hit.' : 'One job is enough.', 'neutral');
  },
  winterBall(state, d, choice) {
    const e = sp.entryOf(d.sportId, state.player.id, state);
    if (!e) return { ...result(false, 'That has passed.', 'neutral'), close: true };
    const R = record(e);
    if (choice === 'never') { R.winter = 'never'; return result(true, 'You rest in the winter.', 'neutral'); }
    if (choice === 'always') R.winter = 'always';
    const w = playWinter(state, e, R);
    return result(true, w ? `You played the winter with ${w.team}.` : 'You have played this winter already.', 'neutral');
  },
  summerBall(state, d, choice) {
    const e = sp.entryOf(d.sportId, state.player.id, state);
    if (!e || choice === 'no') return result(true, 'You went home for the summer.', 'neutral');
    const R = record(e);
    const r = seeded(`summer/${state.player.id}/${state.year}`);
    // Wooden bats tell the scouts what metal ones hide: hitters with real contact and power gain, the rest lose.
    const delta = Math.round(clamp(r.normal(e.position === 'pitcher' ? 1 + (armScore(e) - 62) / 12 : (hitScore(e) - 62) / 8, 1.5), -3, 5));
    R.summer.push({ year: state.year, delta });
    R.wood = clamp((R.wood ?? 0) + delta, -4, 7);
    for (const key of Object.keys(e.skills)) e.skills[key] = Math.round(Math.min(e.ceiling[key], e.skills[key] + 0.6) * 10) / 10;
    return result(true, `A summer with wooden bats. ${delta >= 2 ? 'The scouts liked what they saw.' : delta <= -2 ? 'It was harder than it looks, and the scouts noticed.' : 'It did you no harm.'}`, delta >= 2 ? 'good' : 'neutral');
  },
  adviser(state, d, choice) {
    const e = sp.entryOf(d.sportId, state.player.id, state);
    if (!e || choice === 'no') return result(true, 'You will deal with the clubs yourself.', 'neutral');
    record(e).adviser = true;
    return result(true, 'You have an adviser for the draft.', 'neutral');
  },
  english(state, d, choice) {
    const e = sp.entryOf(d.sportId, state.player.id, state);
    if (!e?.intl) return { ...result(false, 'That has passed.', 'neutral'), close: true };
    e.intl.study = choice === 'yes';
    return result(true, choice === 'yes' ? 'You sit at the front of the class.' : 'You get by with the words you need.', 'neutral');
  },
  remit(state, d, choice) {
    const p = state.player;
    const e = sp.entryOf(d.sportId, p.id, state);
    if (!e?.intl) return { ...result(false, 'That has passed.', 'neutral'), close: true };
    if (choice === 'no') { e.intl.remit = 'no'; return result(true, 'You keep it, for now.', 'neutral'); }
    const share = choice === 'house' ? 0.5 : 0.2;
    const amount = Math.min(p.finance.cash, Math.round(d.amount * share));
    if (amount > 0) settle(state, `remitBonus/${e.id}`, -amount, 'giftOut', choice === 'house' ? 'A house for the family, from the signing bonus' : 'Money for the family, from the signing bonus', 'action');
    e.intl.remit = 'yearly';
    closer(state, choice === 'house' ? 18 : 10);
    if (choice === 'house') milestone('Bought the family a house with the signing bonus.', 'family');
    return result(true, choice === 'house' ? 'Half the bonus went on a house for your family, and you will send money every year.' : 'You gave the family a fifth of the bonus, and will send money every year.');
  },
};
