// Screens for politics: the card on the Work tab, choosing an office to run
// for, and governing. The campaign itself is in ui/campaign.js. Rules: engine/politics.js.
import { player, country } from '../state.js';
import { esc, fmtMoney, theCountry } from '../util.js';
import * as pol from '../engine/politics.js';
import { meterHtml } from './meter.js';
import { messageModal, pickModal, confirmModal } from './modals.js';
import * as world from '../engine/polity.js';
import { openPolity } from './polity.js';
import { openCabinet, lawFlow, budgetFlow, governButtons, foreignFlow, regionalLawFlow } from './government.js';
import * as lead from '../engine/leadership.js';
import * as kin from '../engine/kin.js';
import * as cause from '../engine/activism.js';
import * as local from '../engine/local.js';
import * as camp from '../engine/campaign.js';
import { runCampaign, raceRows } from './campaign.js';

const KIND = {
  presidential: 'The president is elected directly by the voters.',
  parliamentary: 'Voters elect a parliament, and its leader governs.',
  party: 'One party governs. Its committees decide who rises, not the voters.',
};

/** The card on the Work tab. */
export function politicsCard() {
  const p = player();
  const c = country();
  const s = pol.system(c);
  const k = pol.inOffice();
  if (p.age < 14 && !k) return '';
  const o = world.overview(c.id);
  const mine = world.membership(c.id);
  const worldRows = `<div class="kv"><span>${esc(o.headTitle)}</span><span>${esc(o.head?.name ?? '')}${o.headParty ? `, ${esc(o.headParty.name)}` : ''}</span></div>
    ${o.nextElection ? `<div class="kv"><span>Next general election</span><span>${o.nextElection}</span></div>` : ''}
    ${o.kind !== 'none' ? `<div class="kv"><span>Your party</span><span>${mine ? `${esc(mine.name)}${lead.leads(c.id) ? ' (you lead it)' : ''}` : 'None'}</span></div>` : ''}`;
  // Leading a party: only where the head of government is the leader of a party.
  const leading = lead.leads(c.id);
  const leadBtn = s.kind !== 'parliamentary' || !mine ? ''
    : leading ? `${!camp.race() && world.inSeason('head', c.id) ? '<button class="btn primary" data-pol="general">Lead your party into the election</button>' : ''}<button class="btn" data-pol="unlead">Step down as party leader</button>`
      : `<button class="btn" data-pol="lead" ${lead.barrier() ? 'disabled' : ''}>Challenge for the party leadership${lead.barrier() ? `<small>${esc(lead.barrier())}</small>` : ''}</button>`;
  const worldBtn = '<button class="btn" data-pol="world">The political world</button>';
  // The family, and causes outside party politics.
  const family = kin.inPolitics();
  const my = cause.mine();
  const extras = `${kin.nameLine(p) ? `<div class="section-label">The family name</div><p class="muted">${esc(kin.nameLine(p))}</p>` : ''}
    ${family.length ? `<div class="section-label">Family in politics</div>${family.map((k) => `<div class="kv"><span>${esc(k.npc.firstName)}, your ${k.word}</span><span>${esc(k.title)}${k.party ? ` · ${esc(k.party.name)}` : ''}</span></div>`).join('')}` : ''}
    ${my ? `<div class="section-label">Your cause</div><div class="kv"><span>${esc(my.name)}</span><span>${esc(cause.rank())}</span></div>${meterHtml('How loud it is', cause.strength(), true)}` : ''}`;
  const causeBtn = `<button class="btn" data-pol="cause">${my ? `Work for your cause <small>${cause.actsLeft()} left this year</small>` : 'Join a cause'}</button>`;
  if (s.kind === 'none') {
    return `<div class="card"><h3>Politics</h3><p class="muted">There are no elections in ${esc(theCountry(c.name))}. Power here is inherited.</p>${worldRows}${extras}<div class="btn-stack" style="margin-top:10px">${causeBtn}${worldBtn}</div></div>`;
  }
  const past = (p.flags.offices ?? []).map((o) => `<div class="kv"><span>${esc(o.title)}</span><span>Age ${o.from}–${o.to}</span></div>`).join('');
  const exp = p.counters.polExp ?? 0;
  if (k) {
    return `<div class="card"><h3>In office</h3>
      <div class="kv"><span>Office</span><span><strong>${esc(pol.officeLine(p))}</strong></span></div>
      <div class="kv"><span>Salary</span><span>${fmtMoney(k.salary, c)} a year</span></div>
      <div class="kv"><span>${k.ruler ? 'Next election' : 'Term'}</span><span>${k.ruler ? 'There will not be one' : `${k.termLeft} ${k.termLeft === 1 ? 'year' : 'years'} left · term ${k.terms}`}</span></div>
      <div style="margin-top:10px">${meterHtml('Approval', k.approval, true)}</div>
      
      <div class="btn-stack" style="margin-top:10px">
        <button class="btn" data-pol="govern">Govern <small>${pol.actionsLeft()} left this year</small></button>
        ${k.officeId === 'head' ? governButtons() : ''}
        ${k.officeId === 'region' && !local.regionalLawBlock() ? `<button class="btn" data-pol="regionalLaw">Change the law of ${esc(local.myRegion().name)} <small>${k.regionalLawAge === p.age ? 'done this year' : 'one law a year'}</small></button>` : ''}
        ${local.runsPlace() ? `<button class="btn" data-pol="localBudget">${k.officeId === 'region' ? 'The region\'s budget' : 'The city\'s budget'} <small>${local.budgetView().presented ? 'presented for this year' : 'not yet presented'}</small></button>` : ''}
        ${leadBtn}
        ${worldBtn}
        ${camp.race() ? '<button class="btn primary" data-pol="run">Carry on your campaign</button>' : k.tier < 5 && !k.ruler ? '<button class="btn" data-pol="run">Run for higher office</button>' : ''}
        <button class="btn danger" data-pol="resign">${k.ruler ? 'Give up power' : 'Resign'}</button>
      </div>${raceRows()}${extras}${k.tier < 3 ? `<div class="btn-stack" style="margin-top:10px">${causeBtn}</div>` : ''}${past ? `<div class="section-label">Offices held before</div>${past}` : ''}</div>`;
  }
  return `<div class="card"><h3>Politics</h3>
    <p class="muted" style="margin-bottom:8px">${esc(KIND[s.kind])}${s.rigged ? ' The count is not always honest.' : ''}</p>
    <div class="kv"><span>Experience</span><span>${exp ? `${exp} ${exp >= 20 ? '(a great deal)' : exp >= 8 ? '(some)' : '(a little)'}` : 'None yet'}</span></div>
    ${past}
    ${worldRows}
    ${raceRows()}
    ${extras}
    <div class="btn-stack" style="margin-top:10px">${camp.race() ? '<button class="btn primary" data-pol="run">Carry on your campaign</button>' : p.age >= 18 ? '<button class="btn" data-pol="run">Run for office</button>' : ''}${leadBtn}${causeBtn}${worldBtn}</div></div>`;
}

async function report(api, r) {
  api.changed();
  await messageModal({ body: r.text, tone: r.tone });
}

async function run(api) {
  if (camp.race()) return runCampaign(api);
  const c = country();
  const party = pol.system(c).kind === 'party';
  const officeId = await pickModal({
    title: party ? 'Seek a post' : 'Run for office',
    body: party ? 'The committee decides. Loyalty, patience and usefulness are what it looks for.' : 'You can fight one campaign a year. Skipping rungs is possible, and hard.',
    options: pol.ladder().map((o) => ({ value: o.id, label: o.title, disabled: !!o.blocked,
      sub: o.blocked || `${o.odds[0].toUpperCase()}${o.odds.slice(1)}${o.opponent ? ` against ${o.opponent}` : ''}. Polling in ${o.electionYear}. From ${fmtMoney(o.cost, c)}; pays ${fmtMoney(o.salary, c)} a year${o.fullTime ? '' : ', alongside your job'}.` })),
  });
  if (!officeId) return undefined;
  if (!party) {
    const d = camp.declare(officeId);
    api.changed();
    await messageModal({ body: d.text, tone: d.tone });
    return d.ok ? runCampaign(api) : undefined;
  }
  // A one-party state: no voters, no polls, no count. The committee decides.
  const budget = await pickModal({ title: 'How much will you spend on making friends?', body: 'It comes out of your own pocket.',
    options: pol.budgets(officeId).map((b) => ({ value: b.id, label: b.name, sub: `${fmtMoney(b.cost, c)}. ${b.desc}`, disabled: !b.affordable })) });
  if (!budget) return undefined;
  const chosen = [];
  for (const nth of ['first', 'second']) {
    const options = pol.moves().filter((m) => !chosen.includes(m.id));
    if (!options.length) break;
    const move = await pickModal({ title: `Your ${nth} move`, body: nth === 'first' ? 'Choose two things to pour your time into.' : 'And one more.',
      options: options.map((m) => ({ value: m.id, label: m.name, sub: m.risky ? 'It can win it for you, or lose it.' : '' })) });
    if (!move) return undefined;
    chosen.push(move);
  }
  return report(api, pol.campaign(officeId, { platform: 'jobs', budget, moves: chosen }));
}

async function govern(api) {
  if (pol.actionsLeft() <= 0) return messageModal({ body: 'There are only so many hours in a year of government.' });
  const pick = await pickModal({ title: 'Govern', body: `You can do ${pol.actionsLeft()} more ${pol.actionsLeft() === 1 ? 'thing' : 'things'} this year.`,
    options: pol.actionOptions().map((a) => ({ value: a.id, label: a.name, sub: a.note })) });
  if (!pick) return undefined;
  if (pick === 'seize') {
    const sure = await confirmModal({ title: 'Seize emergency powers?', body: 'Send parliament home and rule alone. It is likeliest to work where the country is already unstable and you are popular. If it fails, you are out of office and wanted for treason.', yes: 'Seize power', danger: true });
    if (!sure) return undefined;
  }
  return report(api, pol.govern(pick));
}

/** Handles the card's buttons. */
async function challenge(api) {
  const info = lead.contestInfo();
  const pick = await pickModal({ title: `Lead ${info.party.name}?`, cancel: 'Not yet',
    body: `${info.leader?.name ?? 'The leader'} leads the party${info.inGovt ? ', and the government' : ''}. ${info.mood} The party's ${info.electors} members of the legislature will vote. Lose, and you cannot try again for years.`,
    options: lead.APPROACHES.map((a) => ({ value: a.id, label: a.name, sub: a.sub })) });
  if (!pick) return undefined;
  return report(api, lead.challenge(pick));
}

async function causes(api) {
  if (!cause.mine()) {
    const pick = await pickModal({ title: 'Join a cause', cancel: 'Not now', body: 'Change does not only come from inside politics. A cause that grows loud enough can force a government to move.',
      options: cause.causes().map((c) => ({ value: c.id, label: c.name, sub: `${c.wants}${c.strength >= 35 ? ' Already being talked about.' : ''}` })) });
    return pick ? report(api, cause.join(pick)) : undefined;
  }
  const m = cause.mine();
  const options = cause.actions().map((a) => ({ value: a.id, label: a.name, sub: a.why || a.sub, disabled: !!a.disabled || cause.actsLeft() <= 0 }));
  options.push({ value: 'leave', label: 'Leave the cause' });
  const pick = await pickModal({ title: m.name, cancel: 'Back', body: `${m.wants} You are ${cause.rank()}. You can do ${cause.actsLeft()} more ${cause.actsLeft() === 1 ? 'thing' : 'things'} for it this year.`, options });
  if (!pick) return undefined;
  return report(api, pick === 'leave' ? cause.leaveCause() : cause.act(pick));
}

export async function politicsAction(id, api) {
  if (id === 'cause') return causes(api);
  if (id === 'lead') return challenge(api);
  if (id === 'general') { const d = camp.declare('head'); api.changed(); await messageModal({ body: d.text, tone: d.tone }); return d.ok ? runCampaign(api) : undefined; }
  if (id === 'unlead') {
    const sure = await confirmModal({ title: 'Step down as leader?', body: pol.inOffice()?.viaParty ? 'You hold the top office as leader of your party. Give up one and you give up both.' : 'Somebody else will lead the party into the next election.', yes: 'Step down', danger: true });
    return sure ? report(api, lead.resignLeadership()) : undefined;
  }
  if (id === 'world') return openPolity(() => api.changed());
  if (id === 'law') return lawFlow(api);
  if (id === 'cabinet') return openCabinet(api);
  if (id === 'foreign') return foreignFlow(api);
  if (id === 'budget') return budgetFlow(api);
  if (id === 'localBudget') return budgetFlow(api, local);
  if (id === 'regionalLaw') return regionalLawFlow(api);
  if (id === 'run') return run(api);
  if (id === 'govern') return govern(api);
  if (id === 'resign') {
    const k = pol.inOffice();
    const sure = await confirmModal({ title: k.ruler ? 'Give up power?' : `Resign as ${k.title}?`, body: 'The salary stops, and somebody else takes the office.', yes: k.ruler ? 'Give it up' : 'Resign', danger: true });
    if (sure) return report(api, pol.resign());
  }
  return undefined;
}
