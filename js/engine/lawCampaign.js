// A campaign for an elected legal office: District Attorney, state Attorney General, or a judgeship in a state that
// elects its judges. Declaring, three stretches on the trail with a debate in the middle, then the count.
//
//   L.campaign = { id, title, level, judicial, round (1-3, then 4 = the count), used: [actId], fund, appeal, polls: [{ you, rival }],
//                  debated, endorsed: [id], flags: { solicited, promised, announced, falsehood }, donors: [{ id, amount }],
//                  rival, rivalEdge, bias, startM }
//   L.campaigns = [{ year, title, won, share, rival, broke: [ruleName] }]   (every campaign run)
//   L.donors    = [{ id, amount, year }]   (who paid for a judge's campaign, for stepping aside later: Caperton)
//
// The count uses lawPractice.legalElection, which uses the politics engine's arithmetic. Campaign rules for judicial
// candidates are the real ones in force that year (engine/realLaw.js campaignRules). A candidate is never stopped from
// breaking them: the rule is shown, and breaking it has consequences after the vote, as it would.
import { rng } from '../rng.js';
import { clamp, localCost, fmtMoney } from '../util.js';
import { store, player, country, log } from '../state.js';
import { lawOf, nowM, canon, keepPerson, gain } from './lawSchool.js';
import { opportunities, legalElection, standing, seek } from './lawPractice.js';
import { discipline } from './lawCases.js';
import { campaignRules } from './realLaw.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
export const ROUNDS = 3;
export const ACTS_PER_ROUND = 2;
/** What each race needs: its reach, what a good campaign costs, and how hard the other side is. */
const RACES = {
  // The other candidate is a serious one: a lawyer with a record and backers of their own.
  da: { level: 'local', filing: 3000, budget: 150000, rival: [12, 24] },
  ag: { level: 'state', filing: 20000, budget: 2500000, rival: [15, 27] },
  judge_election: { level: 'local', filing: 2500, budget: 90000, rival: [10, 21] },
};

export const campaignOf = (p = player()) => lawOf(p).campaign ?? null;
const money = (n) => localCost(n, country());

/** Starts a campaign for an opportunity that is chosen by the voters. Pays the filing fee. */
export function declare(id, p = player()) {
  const L = lawOf(p);
  if (L.campaign) return result(false, 'You are already running.', 'neutral');
  const o = opportunities(p).find((x) => x.id === id);
  if (!o?.campaign) return result(false, 'That office is not chosen by the voters here.', 'neutral');
  if (o.why) return result(false, o.why, 'neutral');
  const race = RACES[id];
  const fee = money(race.filing);
  if (p.finance.cash < fee) return result(false, `The filing fee is ${fmtMoney(fee, country())}.`, 'neutral');
  p.finance.cash -= fee;
  (L.tried ??= {})[id] = nowM();
  const judicial = id === 'judge_election';
  const title = id === 'da' ? o.name.replace(/^Seek the office of /, '') : id === 'ag' ? 'Attorney General' : 'Judge';
  const rivalNpc = Object.values(store.state.npcs).find((n) => n.alive && n.flags.rivalOf === p.id && n.flags.justice);
  const rival = !judicial && rivalNpc ? `${rivalNpc.firstName} ${rivalNpc.lastName}` : null;
  L.campaign = { id, title, level: race.level, judicial, round: 1, used: [], fund: 0, appeal: 0, polls: [], debated: false, endorsed: [],
    flags: {}, donors: [], rivalMoves: [], rivalEndorsed: [], rival, rivalEdge: rng.int(...race.rival), bias: rng.int(-3, 3), startM: nowM() };
  log(`You filed to run for ${title}.`, 'system', 'neutral');
  return result(true, `You are a candidate for ${title}. Three stretches of campaigning, a debate, then the voters decide.${judicial ? ' Judicial candidates campaign under rules of their own: they are shown with each choice.' : ''}`, 'good');
}

/** The rules a judicial candidate runs under now, with the names of the laws. Null for other races. */
export function rulesNow(p = player()) {
  const c = campaignOf(p);
  return c?.judicial ? campaignRules(p.countryId) : null;
}
/** The rule itself (a code or rule of conduct) rather than the court case that upheld it, where both are listed. */
const lawName = (rules, key) => { const all = rules?.laws.filter((l) => l[key] === false) ?? []; return (all.find((l) => !/ v\. /.test(l.name)) ?? all[0])?.name ?? null; };

/** The things a candidate can do in this stretch, each with what it will cost and any rule it would break. */
export function actions(p = player()) {
  const c = campaignOf(p);
  if (!c || c.round > ROUNDS) return [];
  const rules = c.judicial ? campaignRules(p.countryId) : null;
  const left = ACTS_PER_ROUND - c.used.filter((u) => u.startsWith(`${c.round}:`)).length;
  const done = (id) => c.used.some((u) => u.endsWith(`:${id}`));
  const adCost = money(RACES[c.id].budget * 0.15);
  const breaks = (key) => (rules && !rules[key] ? `Not allowed: ${lawName(rules, key)}` : '');
  const list = [
    { id: 'committee', name: 'Raise money through a campaign committee', sub: 'The committee asks; you keep your distance from who gives.' },
    { id: 'ask', name: 'Call donors and ask for money yourself', sub: breaks('solicit') || 'It raises more than a committee does.', rule: breaks('solicit') },
    { id: 'big_donor', name: 'Take a large donation from a firm with cases in the courts', sub: c.judicial ? 'Allowed, but a judge may later have to step aside from that firm\'s cases.' : 'Allowed. Voters may wonder what it bought.' },
    { id: 'town_hall', name: 'Hold town halls across the district', sub: 'Meet voters in person: slower, and it lasts.' },
    { id: 'endorse_bar', name: c.judicial ? 'Seek the bar association\'s rating' : 'Seek the endorsement of lawyers\' groups', sub: 'Judged on your record and your name for integrity.', once: true },
    { id: 'endorse_paper', name: 'Meet the newspaper\'s editorial board', sub: 'They will ask hard questions.', once: true },
    ...(!c.judicial ? [
      { id: 'endorse_police', name: 'Seek the police union\'s endorsement', sub: 'Popular with voters who want order. Reform groups notice.', once: true },
      { id: 'endorse_reform', name: 'Seek the endorsement of reform groups', sub: 'Popular with voters who want change. The police union notices.', once: true },
    ] : []),
    { id: 'ad_record', name: 'Run ads about your record', sub: `About ${fmtMoney(adCost, country())} from the campaign fund.`, cost: adCost },
    ...(c.judicial ? [
      { id: 'ad_views', name: 'Run ads with your views on disputed issues', sub: breaks('announce') || `Allowed since Republican Party of Minnesota v. White (2002). About ${fmtMoney(adCost, country())}.`, cost: adCost, rule: breaks('announce') },
      { id: 'ad_promise', name: 'Promise how you will rule on cases like these', sub: breaks('promises') || `About ${fmtMoney(adCost, country())}.`, cost: adCost, rule: breaks('promises') },
    ] : [
      { id: 'ad_promise', name: 'Promise to be tough on crime', sub: `A promise voters remember. About ${fmtMoney(adCost, country())}.`, cost: adCost },
    ]),
    ...(c.attacked && !c.responded ? [{ id: 'respond', name: 'Answer your opponent\'s attack', sub: 'Set the record straight, calmly, with the facts.' }] : []),
    { id: 'attack_fair', name: 'Question your opponent\'s record, with the facts', sub: 'Fair, and it can still sting.' },
    { id: 'attack_false', name: 'Say things about your opponent that are not true', sub: breaks('falsehood') || 'Untrue, and the press may check.', rule: breaks('falsehood') || 'Untrue' },
  ];
  return list.map((a) => ({ ...a, why: left <= 0 ? 'You have done what you can this stretch.' : a.once && done(a.id) ? 'Done.' : a.cost && c.fund < a.cost ? 'Not enough in the campaign fund.' : '' }));
}

/** Does one thing on the trail. */
export function act(id, p = player()) {
  const c = campaignOf(p);
  const a = actions(p).find((x) => x.id === id);
  if (!c || !a) return result(false, 'There is no campaign.', 'neutral');
  if (a.why) return result(false, a.why, 'neutral');
  const L = lawOf(p);
  const rules = c.judicial ? campaignRules(p.countryId) : null;
  const budget = money(RACES[c.id].budget);
  c.used.push(`${c.round}:${id}`);
  if (a.cost) c.fund -= a.cost;
  const raise = (share) => { const n = Math.round(budget * share); c.fund += n; return n; };
  switch (id) {
    case 'committee': {
      const n = raise(0.12 + (L.rep.recognition + L.rep.clients) / 1000 + rng.next() * 0.06);
      return result(true, `The committee raised ${fmtMoney(n, country())}.`, 'good');
    }
    case 'ask': {
      const n = raise(0.2 + (L.rep.recognition + L.rep.clients) / 800 + rng.next() * 0.08);
      if (rules && !rules.solicit) c.flags.solicited = true;
      return result(true, `You spent the week on the phone and raised ${fmtMoney(n, country())}.${rules && !rules.solicit ? ` A judicial candidate is not supposed to ask in person (${lawName(rules, 'solicit')}).` : ''}`, rules && !rules.solicit ? 'neutral' : 'good');
    }
    case 'big_donor': {
      const n = raise(0.35 + rng.next() * 0.15);
      const donor = keepPerson(p, `donor${(L.donors ?? []).length + c.donors.length}`, 'colleague', 'Campaign donor', rng.int(45, 70));
      donor.flags.donorTo = p.id;
      c.donors.push({ id: donor.id, amount: n });
      if (!c.judicial) L.rep.integrity = clamp(L.rep.integrity - 2);
      return result(true, `${donor.firstName} ${donor.lastName}'s firm gave ${fmtMoney(n, country())}.${c.judicial ? ' If the firm comes before you as a judge, you may have to step aside.' : ''}`, 'neutral');
    }
    case 'town_hall': {
      const g = 2 + (p.stats.charm - 50) / 15 + (L.skills?.courtroom ?? 40) / 40 + rng.next();
      c.appeal += g;
      gain(p, { courtroom: 1 });
      return result(true, g > 3.5 ? 'The rooms were full, and people stayed to talk.' : 'Small rooms, but the people who came will vote.', 'good');
    }
    case 'respond': {
      c.responded = true;
      const g = 2 + (L.rep.integrity - 50) / 20 + rng.next();
      c.appeal += g;
      return result(true, g > 3 ? 'Your answer was clear and calm, and it is the one people remember.' : 'You answered it. Some people heard.', 'good');
    }
    case 'endorse_bar': case 'endorse_paper': case 'endorse_police': case 'endorse_reform': {
      if ((c.rivalEndorsed ?? []).includes(id)) return result(false, `They have already endorsed ${c.rival ?? 'your opponent'}.`, 'bad');
      const s = standing(p);
      const yes = rng.next() < clamp(0.35 + s + (id === 'endorse_bar' ? (L.rep.integrity - 60) / 80 : 0), 0.08, 0.9);
      if (id === 'endorse_police' && c.endorsed.includes('endorse_reform')) return result(false, 'The police union backs the other candidate: you already have the reform groups.', 'bad');
      if (id === 'endorse_reform' && c.endorsed.includes('endorse_police')) return result(false, 'The reform groups back the other candidate: you already have the police union.', 'bad');
      if (!yes) return result(false, { endorse_bar: c.judicial ? 'The bar association rated you "qualified", not "well qualified". It will not help much.' : 'The lawyers\' groups stayed out of it.', endorse_paper: 'The editorial board endorsed your opponent.', endorse_police: 'The police union stayed neutral.', endorse_reform: 'The reform groups stayed neutral.' }[id], 'bad');
      c.endorsed.push(id);
      c.appeal += id === 'endorse_paper' ? 3 : 2.5;
      return result(true, { endorse_bar: c.judicial ? 'The bar association rated you "well qualified".' : 'The lawyers\' groups endorsed you.', endorse_paper: 'The newspaper endorsed you.', endorse_police: 'The police union endorsed you.', endorse_reform: 'Reform groups endorsed you.' }[id], 'good');
    }
    case 'ad_record': c.appeal += 2 + Math.min(3, (L.history?.length ?? 0) / 20) + rng.next(); return result(true, 'The ads ran. Your record is the strongest thing you have.', 'good');
    case 'ad_views': c.appeal += 2.5 + rng.next(); if (rules && !rules.announce) c.flags.announced = true; return result(true, `The ads ran.${rules && !rules.announce ? ` Under ${lawName(rules, 'announce')}, a judicial candidate is not supposed to announce views on disputed issues.` : ''}`, rules && !rules.announce ? 'neutral' : 'good');
    case 'ad_promise': c.appeal += 3.5 + rng.next(); if (rules && !rules.promises) c.flags.promised = true; return result(true, `The ads ran, and the promise is the line people repeat.${rules && !rules.promises ? ` A judge is meant to decide each case on its facts: ${lawName(rules, 'promises')} forbids such promises.` : ''}`, rules && !rules.promises ? 'neutral' : 'good');
    case 'attack_fair': c.appeal += 1.5 + rng.next() * 2; return result(true, 'The point landed. Your opponent spent a week answering it.', 'good');
    case 'attack_false': {
      c.flags.falsehood = true;
      L.rep.integrity = clamp(L.rep.integrity - 4);
      if (rng.chance(0.4)) { c.appeal -= 5; c.flags.caught = true; return result(false, 'The press checked, and it was not true. The story became about you.', 'bad'); }
      c.appeal += 4;
      return result(true, 'It spread. Nobody has checked it yet.', 'neutral');
    }
    default: return result(false, 'Nothing happened.', 'neutral');
  }
}

/** The debate, in the second stretch: answered once. */
export const DEBATE = [
  ['Stand on your record', 'record'],
  ['Set out what you would change', 'plan'],
  ['Go after your opponent', 'attack'],
  ['Promise an outcome voters want', 'promise'],
];
export function debate(how, p = player()) {
  const c = campaignOf(p);
  if (!c || c.round !== 2 || c.debated) return result(false, 'There is no debate now.', 'neutral');
  const L = lawOf(p);
  c.debated = true;
  const rules = c.judicial ? campaignRules(p.countryId) : null;
  const skill = ((L.skills?.courtroom ?? 40) + p.stats.charm) / 2;
  const score = (skill - 50) / 8 + rng.next() * 4 - 1 + { record: 1, plan: 1.5, attack: 0.5, promise: 2 }[how];
  c.appeal += score;
  if (how === 'promise' && rules && !rules.promises) c.flags.promised = true;
  if (how === 'attack') L.rep.integrity = clamp(L.rep.integrity - 1);
  return result(score > 1.5, score > 3 ? 'You won the debate, by most accounts.' : score > 1.5 ? 'A good night: steady, clear.' : 'Your opponent had the better night.', score > 1.5 ? 'good' : 'bad');
}

/** What the polls show: two bars, no numbers. `you` and `rival` are 0-100 for drawing. */
export function poll(p = player()) {
  const c = campaignOf(p);
  if (!c) return null;
  const fundEdge = Math.min(6, c.fund / money(RACES[c.id].budget) * 6);
  const est = clamp(50 + (c.appeal + fundEdge + standing(p) * 20 - c.rivalEdge) * 0.9 + c.bias, 20, 80);
  return { you: est, rival: 100 - est };
}

/** Ends a stretch of the trail; after the third, the voters decide. */
export function nextRound(p = player()) {
  const c = campaignOf(p);
  if (!c) return result(false, 'There is no campaign.', 'neutral');
  if (c.round === 2 && !c.debated) return result(false, 'The debate comes first.', 'neutral');
  const move = rivalMove(c, p);
  c.polls.push(poll(p));
  c.round += 1;
  if (c.round > ROUNDS) return result(true, `${move} The campaign is over. Election day.`, 'neutral');
  return result(true, `${move} ${c.round === 2 ? 'On to the second stretch, and the debate.' : 'The last stretch.'}`, 'neutral');
}

/**
 * The other candidate's stretch: they campaign too. Ads and money, an endorsement the player may have wanted, or an
 * attack on the player's record, which sticks less to someone known for integrity and can be answered.
 */
function rivalMove(c, p) {
  const L = lawOf(p);
  const who = c.rival ?? 'Your opponent';
  c.rivalMoves ??= []; c.rivalEndorsed ??= [];
  const open = ['endorse_paper', ...(c.judicial ? ['endorse_bar'] : ['endorse_police', 'endorse_reform'])].filter((id) => !c.endorsed.includes(id) && !c.rivalEndorsed.includes(id)
    && !(id === 'endorse_police' && c.endorsed.includes('endorse_reform')) && !(id === 'endorse_reform' && c.endorsed.includes('endorse_police')));
  const kinds = ['ads', 'ads', 'money', ...(open.length ? ['endorse', 'endorse'] : []), ...(c.round <= 2 && !c.attacked ? ['attack'] : [])];
  const kind = rng.pick(kinds);
  let text;
  if (kind === 'ads') { c.rivalEdge += 1.5 + rng.next() * 1.5; text = `${who} ran ads all over the district.`; }
  else if (kind === 'money') { c.rivalEdge += 1; text = `${who} held a big fundraiser.`; }
  else if (kind === 'endorse') {
    const id = rng.pick(open);
    c.rivalEndorsed.push(id); c.rivalEdge += 2.5;
    text = `${who} won the endorsement of ${{ endorse_paper: 'the newspaper', endorse_bar: 'the bar association', endorse_police: 'the police union', endorse_reform: 'the reform groups' }[id]}.`;
  } else {
    c.attacked = true;
    const sticks = L.rep.integrity >= 70 ? 0.5 : 2.5;
    c.appeal -= sticks;
    text = `${who} attacked your record${sticks < 1 ? ', but it did not stick: your name for integrity is well known.' : '. You can answer it next stretch.'}`;
  }
  c.rivalMoves.push({ round: c.round, kind, text });
  return text;
}

/** Election day: the count, the office if it is won, and what breaking the rules on the way costs. */
export function pollingDay(p = player()) {
  const c = campaignOf(p);
  if (!c || c.round <= ROUNDS) return result(false, 'The vote has not come yet.', 'neutral');
  const L = lawOf(p);
  const fundEdge = Math.min(6, c.fund / money(RACES[c.id].budget) * 6);
  const boost = c.appeal + fundEdge - c.rivalEdge;
  const s = standing(p) + (c.id === 'ag' ? -0.1 : 0);
  const vote = legalElection(p, c.title, c.level, s, boost, c.id === 'judge_election' ? 'judge' : null, c.rival);
  const r = seek(c.id, p, { vote });
  // Rules broken on the trail are complaints after it, win or lose.
  const rules = c.judicial ? campaignRules(p.countryId) : null;
  const broke = [];
  if (c.flags.solicited) broke.push(`asking for money in person (${lawName(rules, 'solicit')})`);
  if (c.flags.promised) broke.push(`promising how you would rule (${lawName(rules, 'promises')})`);
  if (c.flags.announced) broke.push(`announcing views on disputed issues (${lawName(rules, 'announce')})`);
  if (c.flags.falsehood && rules && !rules.falsehood) broke.push(`false statements about your opponent (${lawName(rules, 'falsehood')})`);
  else if (c.flags.falsehood && !c.judicial && p.countryId === 'us' && store.state.year >= 1983) broke.push('false statements about your opponent (ABA Model Rule of Professional Conduct 8.2(a))');
  let after = '';
  if (broke.length) {
    L.rep.integrity = clamp(L.rep.integrity - 4 * broke.length);
    const serious = broke.length >= 2 || c.flags.falsehood && c.flags.caught;
    discipline(serious && !vote.won ? 'suspended' : 'reprimand');
    after = ` A complaint followed: ${broke.join('; ')}. ${serious && !vote.won ? 'You were suspended.' : 'You were formally reprimanded.'}`;
  }
  if (vote.won && c.judicial && c.donors.length) (L.donors ??= []).push(...c.donors.map((d) => ({ ...d, year: store.state.year })));
  (L.campaigns ??= []).push({ year: store.state.year, title: c.title, won: vote.won, share: vote.share, rival: vote.rival, broke: broke.filter(Boolean) });
  canon(`law:campaign:${c.id}:${nowM()}`, `${vote.won ? 'Won' : 'Lost'} the race for ${c.title}`, `${vote.share}% of the vote against ${vote.rival}.`, { privacy: 'public', sig: vote.won ? 3 : 2, milestone: vote.won });
  L.campaign = null;
  return result(vote.won, `${r.text}${after}`, vote.won ? 'good' : 'bad', { vote });
}

/** Withdraws from the race. The filing fee is gone; what is in the fund goes back to donors. */
export function withdraw(p = player()) {
  const L = lawOf(p);
  if (!L.campaign) return result(false, 'You are not running.', 'neutral');
  const t = L.campaign.title;
  L.campaign = null;
  log(`You withdrew from the race for ${t}.`, 'system', 'neutral');
  return result(true, `You withdrew from the race for ${t}.`, 'neutral');
}

/** A judge's campaign donors who are a party to a matter: the judge should step aside (Caperton, 2009). */
export function donorIn(npcIds, p = player()) {
  const d = (lawOf(p).donors ?? []).find((x) => npcIds.includes(x.id));
  return d ? { ...d, npc: store.state.npcs[d.id] } : null;
}
