// Campaigns for elected legal office (engine/lawCampaign.js): District Attorney, state Attorney General and elected
// judges. Declaring costs a filing fee; three stretches on the trail with a debate; polls are bars, not numbers; the
// count is the elections engine's; judicial candidates run under the real rules of their year, and breaking them is
// a complaint after the vote; a judge's big campaign donor before the court means stepping aside (Caperton, 2009).
// Run with: node tests/law-campaign.mjs
import { store, rng, ls, lp, lc, check, finish, lawyer, saveGame, loadGame } from './helpers/lawSetup.mjs';
const camp = await import('../js/engine/lawCampaign.js');
const { campaignRules } = await import('../js/engine/realLaw.js');

const p = () => store.state.player;
const L = () => ls.lawOf(p());
rng.seed(31);

/** A seasoned prosecutor (or lawyer) in a year, ready to run. */
function candidate(careerId = 'prosecutor', year = 2026, o = {}) {
  lawyer(careerId, { level: 2, ...o });
  store.state.year = year;
  p().age = 48; p().birthYear = year - 48;
  p().career.experience = { [careerId]: 16 }; p().career.yearsInRole = 9;
  L().rep.integrity = 72; L().rep.recognition = 55; L().rep.clients = 60;
  p().finance.cash = 5e6;
  return p();
}
/** Runs the whole trail with honest choices: committee money, town halls, endorsements, ads on the record. */
function cleanRun() {
  for (let r = 1; r <= camp.ROUNDS; r++) {
    const want = r === 1 ? ['committee', 'town_hall'] : r === 2 ? ['endorse_paper', 'ad_record'] : ['endorse_bar', 'town_hall'];
    for (const id of want) camp.act(id);
    if (r === 2) camp.debate('plan');
    camp.nextRound();
  }
  return camp.pollingDay();
}

// 1. The DA race is a campaign, with a filing fee, stretches, a debate and polls drawn as bars.
{
  candidate('prosecutor');
  const op = lp.opportunities().find((x) => x.id === 'da');
  check(op?.campaign && !op.why, 'in the US, District Attorney is a race to run');
  const cash = p().finance.cash;
  check(camp.declare('da').ok && camp.campaignOf()?.round === 1, 'filing to run');
  check(p().finance.cash < cash, 'the filing fee is paid');
  check(!camp.declare('da').ok, 'one race at a time');
  const acts = camp.actions().map((a) => a.id);
  check(['committee', 'town_hall', 'endorse_police', 'endorse_reform', 'ad_promise', 'attack_false'].every((x) => acts.includes(x)), `the trail offers choices (${acts.join(', ')})`);
  check(camp.act('committee').ok && camp.campaignOf().fund > 0, 'a committee raises money');
  check(camp.act('town_hall').ok, 'town halls');
  check(camp.actions().every((a) => a.why), 'two things a stretch, then the next');
  camp.nextRound();
  check(!camp.nextRound().ok, 'the debate comes before the last stretch');
  check(camp.debate('record').text.length > 0 && !camp.debate('record').ok, 'one debate');
  camp.act('endorse_police');
  const r = camp.act('endorse_reform');
  check(!camp.campaignOf().endorsed.includes('endorse_police') || !r.ok, 'the police union and the reform groups do not both back one candidate');
  const pl = camp.poll();
  check(pl && pl.you + pl.rival === 100, 'the poll is drawn as two bars');
  camp.nextRound(); camp.nextRound();
  check(!camp.campaignOf() || camp.campaignOf().round > camp.ROUNDS, 'after three stretches, election day');
  const out = camp.pollingDay();
  check(!camp.campaignOf() && out.vote && (p().flags.races ?? []).some((x) => x.legal && x.title === out.vote.title), `the count is kept with the player's races (${out.vote?.share}% against ${out.vote?.rival})`);
  check(!out.ok || (p().career.careerId === 'prosecutor' && p().career.level === 3), `won: the top of the office (${out.text})`);
  check(L().campaigns.length === 1 && L().campaigns[0].broke.length === 0, 'an honest campaign breaks no rules');
}

// 2. A good campaign wins more often than doing nothing.
{
  const runs = (good) => {
    let wins = 0;
    for (let i = 0; i < 24; i++) {
      candidate('prosecutor');
      camp.declare('da');
      if (good) { if (cleanRun().ok) wins++; }
      else { camp.nextRound(); camp.debate('attack'); camp.nextRound(); camp.nextRound(); if (camp.pollingDay().ok) wins++; }
    }
    return wins;
  };
  const a = runs(true); const b = runs(false);
  check(a > b, `campaigning wins races (${a} of 24 with a campaign, ${b} without)`);
}

// 3. Judicial elections: the real rules of the year.
{
  const r1950 = campaignRules('us', 1950); const r1990 = campaignRules('us', 1990); const r2020 = campaignRules('us', 2020);
  check(r1950.solicit && !r1950.promises, '1950: the 1924 Canons forbid promises; asking for money in person is not yet listed');
  check(!r1990.solicit && !r1990.announce && !r1990.promises, '1990: the 1972 Code forbids asking in person, announcing views and promises');
  check(r2020.announce && !r2020.solicit && r2020.laws.some((l) => /Williams-Yulee/.test(l.name)) && r2020.laws.some((l) => /White/.test(l.name)), '2020: views may be announced (White, 2002); asking in person is still forbidden (Williams-Yulee, 2015)');
  check(!campaignRules('uk', 2020).laws.length, 'no listed rules outside the US: no judicial elections there');
  candidate('lawyer', 2020);
  const op = lp.opportunities().find((x) => x.id === 'judge_election');
  check(op?.campaign && !op.why, 'a senior lawyer may run for an elected judgeship');
  camp.declare('judge_election');
  const ask = camp.actions().find((a) => a.id === 'ask');
  check(ask.rule && /Rule 4.1|Williams-Yulee|Canon 7/.test(ask.sub), `the rule is shown with the choice (${ask.sub})`);
  check(/White/.test(camp.actions().find((a) => a.id === 'ad_views').sub), 'announcing views is allowed, and the case is named');
  camp.act('ask'); camp.act('ad_promise');
  camp.nextRound(); camp.debate('record'); camp.nextRound(); camp.nextRound();
  const integrity = L().rep.integrity;
  const out = camp.pollingDay();
  const last = L().campaigns.at(-1);
  check(last.broke.length === 2 && (L().discipline ?? []).length >= 1 && L().rep.integrity < integrity, `asking in person and promising rulings bring a complaint after the vote (${last.broke.join('; ')})`);
  check(/complaint/i.test(out.text), 'and the result says so');
  candidate('lawyer', 1995);
  camp.declare('judge_election');
  check(/Canon 7/.test(camp.actions().find((a) => a.id === 'ad_views').sub), 'in 1995 announcing views on disputed issues is still forbidden (the 1972 Code)');
  camp.withdraw();
  check(!camp.campaignOf(), 'a candidate can withdraw');
}

// 4. A judge elected with a big donor's money, and that donor's case.
{
  let won = false;
  for (let i = 0; i < 20 && !won; i++) {
    candidate('lawyer', 2015);
    L().rep.integrity = 85; L().rep.recognition = 75;
    camp.declare('judge_election');
    camp.act('big_donor'); camp.act('town_hall'); camp.nextRound();
    camp.act('endorse_bar'); camp.act('ad_record'); camp.debate('plan'); camp.nextRound();
    camp.act('endorse_paper'); camp.act('town_hall'); camp.nextRound();
    won = camp.pollingDay().ok;
  }
  check(won && p().career.careerId === 'judiciary', 'elected to the bench');
  check(L().donors?.length === 1, 'the donor is remembered');
  let matter = null;
  for (let i = 0; i < 30 && !matter; i++) { L().benchWindow = -1; L().bench = []; const c = lp.benchMatter(); if (c?.donorConflict) matter = c; else if (c) { c.done = true; } }
  check(matter, 'the donor\'s firm comes before the judge');
  check(lc.caseById(matter.id) && (await import('../js/engine/realLaw.js')).caseLaws(matter).some((x) => /Caperton/.test(x.law.name)), 'the case cites Caperton v. A.T. Massey Coal Co. (2009)');
  const integrity = L().rep.integrity;
  const r = lp.rule(matter.id, 'for');
  check(!r.ok && /Caperton/.test(r.text) && L().rep.integrity < integrity, `hearing it anyway costs the judge (${r.text})`);
  L().benchWindow = -1; L().bench = [];
  let m2 = null;
  for (let i = 0; i < 30 && !m2; i++) { L().benchWindow = -1; L().bench = []; const c = lp.benchMatter(); if (c?.donorConflict) m2 = c; else if (c) c.done = true; }
  check(m2 && lp.rule(m2.id, 'recuse').ok, 'stepping aside is the right call');
}

// 5. A campaign survives a save and reload.
{
  candidate('prosecutor');
  camp.declare('da'); camp.act('committee');
  saveGame(store.state);
  const back = loadGame(store.state.slotId);
  check(back.player.law.campaign?.id === 'da' && back.player.law.campaign.fund === L().campaign.fund, 'the race in progress is saved');
}

// The other candidate campaigns too.
{
  const moves = [];
  for (let i = 0; i < 12; i++) {
    candidate('prosecutor');
    L().rep.integrity = 60;
    camp.declare('da');
    camp.nextRound(); camp.debate('plan'); camp.nextRound(); camp.nextRound();
    moves.push(...(L().campaign?.rivalMoves ?? []));
    camp.withdraw();
  }
  const kinds = new Set(moves.map((m) => m.kind));
  check(moves.length === 36 && kinds.has('ads') && kinds.has('endorse') && kinds.has('attack'), `each stretch, the opponent campaigns: ads, endorsements, attacks (${[...kinds].join(', ')})`);
  // An endorsement the opponent won is not open to the player; an attack can be answered.
  let c = null;
  for (let i = 0; i < 20 && !c; i++) { candidate('prosecutor'); L().rep.integrity = 60; camp.declare('da'); camp.act('committee'); camp.act('town_hall'); camp.nextRound(); if (L().campaign.rivalEndorsed.length || L().campaign.attacked) c = L().campaign; else camp.withdraw(); }
  if (c?.rivalEndorsed.length) check(!camp.act(c.rivalEndorsed[0]).ok, 'an endorsement the opponent has is not there to win');
  if (c?.attacked) { const before = c.appeal; const r = camp.act('respond'); check(r.ok && c.appeal > before, 'an attack can be answered'); }
  check(c, 'the opponent took something from the player\'s side in the first stretch, at least once');
}

finish('Legal offices are won on the trail, under the rules of the day.');
