// Screens for politics: the card on the Work tab, the campaign (platform,
// budget, two moves, the count), and governing. Rules: engine/politics.js.
import { player, country } from '../state.js';
import { esc, fmtMoney, theCountry } from '../util.js';
import * as pol from '../engine/politics.js';
import { meterHtml } from './meter.js';
import { messageModal, pickModal, confirmModal } from './modals.js';

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
  if (p.age < 16 && !k) return '';
  if (s.kind === 'none') {
    return `<div class="card"><h3>Politics</h3><p class="muted">There are no elections in ${esc(theCountry(c.name))}. Power here is inherited.</p></div>`;
  }
  const past = (p.flags.offices ?? []).map((o) => `<div class="kv"><span>${esc(o.title)}</span><span>Age ${o.from}–${o.to}</span></div>`).join('');
  const exp = p.counters.polExp ?? 0;
  if (k) {
    return `<div class="card"><h3>In office</h3>
      <div class="kv"><span>Office</span><span><strong>${esc(pol.officeLine(p))}</strong></span></div>
      <div class="kv"><span>Salary</span><span>${fmtMoney(k.salary, c)} a year</span></div>
      <div class="kv"><span>${k.ruler ? 'Next election' : 'Term'}</span><span>${k.ruler ? 'There will not be one' : `${k.termLeft} ${k.termLeft === 1 ? 'year' : 'years'} left · term ${k.terms}`}</span></div>
      <div style="margin-top:10px">${meterHtml('Approval', k.approval, true)}</div>
      <p class="muted" style="margin-top:6px">Use the office, or be blamed for doing nothing. If approval falls far enough, there will be a move to throw you out.</p>
      <div class="btn-stack" style="margin-top:10px">
        <button class="btn" data-pol="govern">Govern <small>${pol.actionsLeft()} left this year</small></button>
        ${k.tier < 5 && !k.ruler ? '<button class="btn" data-pol="run">Run for higher office</button>' : ''}
        <button class="btn danger" data-pol="resign">${k.ruler ? 'Give up power' : 'Resign'}</button>
      </div>${past ? `<div class="section-label">Offices held before</div>${past}` : ''}</div>`;
  }
  return `<div class="card"><h3>Politics</h3>
    <p class="muted" style="margin-bottom:8px">${esc(KIND[s.kind])}${s.rigged ? ' The count is not always honest.' : ''}</p>
    <div class="kv"><span>Experience that counts</span><span>${exp ? `${exp} ${exp >= 20 ? '(a great deal)' : exp >= 8 ? '(some)' : '(a little)'}` : 'None yet'}</span></div>
    ${past}
    <p class="muted" style="margin-top:8px">Student council, debating, a law or politics degree, helping on campaigns and every office you hold all make the next race easier.</p>
    ${p.age >= 18 ? '<div class="btn-stack" style="margin-top:10px"><button class="btn" data-pol="run">Run for office</button></div>' : ''}</div>`;
}

async function report(api, r) {
  api.changed();
  await messageModal({ body: r.text, tone: r.tone });
}

async function run(api) {
  const c = country();
  const party = pol.system(c).kind === 'party';
  const officeId = await pickModal({
    title: party ? 'Seek a post' : 'Run for office',
    body: party ? 'The committee decides. Loyalty, patience and usefulness are what it looks for.' : 'You can fight one campaign a year. Skipping rungs is possible, and hard.',
    options: pol.ladder().map((o) => ({ value: o.id, label: o.title, disabled: !!o.blocked,
      sub: o.blocked || `${o.odds[0].toUpperCase()}${o.odds.slice(1)}. From ${fmtMoney(o.cost, c)}; pays ${fmtMoney(o.salary, c)} a year for ${o.term} years${o.fullTime ? '' : ', alongside your job'}.` })),
  });
  if (!officeId) return undefined;
  let platform = 'jobs';
  if (!party) {
    platform = await pickModal({ title: 'What do you stand for?', body: 'Nobody knows what the voters want this year until the votes are counted.', options: pol.platforms().map((x) => ({ value: x.id, label: x.name })) });
    if (!platform) return undefined;
  }
  const budget = await pickModal({ title: party ? 'How much will you spend on making friends?' : 'How much will you spend?', body: 'It comes out of your own pocket.',
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
  return report(api, pol.campaign(officeId, { platform, budget, moves: chosen }));
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
export async function politicsAction(id, api) {
  if (id === 'run') return run(api);
  if (id === 'govern') return govern(api);
  if (id === 'resign') {
    const k = pol.inOffice();
    const sure = await confirmModal({ title: k.ruler ? 'Give up power?' : `Resign as ${k.title}?`, body: 'The salary stops, and somebody else takes the office.', yes: k.ruler ? 'Give it up' : 'Resign', danger: true });
    if (sure) return report(api, pol.resign());
  }
  return undefined;
}
