// Screens for royalty and nobility: the card on the Self tab, public duties,
// and giving up a title. The rules live in engine/royalty.js.
import { player, country } from '../state.js';
import { esc, fmtMoney, theCountry } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { ROYAL_RANKS } from '../data/royalty.js';
import * as crown from '../engine/royalty.js';
import { meterHtml } from './meter.js';
import { messageModal, pickModal, confirmModal } from './modals.js';

const mood = (v) => (v >= 80 ? 'adored' : v >= 62 ? 'well liked' : v >= 45 ? 'tolerated' : v >= 28 ? 'unpopular' : 'in disgrace');

/** The card on the Self tab. Empty for a commoner in a country without a crown. */
export function royalCard() {
  const p = player();
  const r = p.royal;
  const m = crown.monarchy();
  if (!r) {
    if (!m) return '';
    const k = crown.court().monarch;
    return `<div class="card"><h3>The crown</h3>
      <div class="kv"><span>On the throne</span><span>${esc(crown.titleOf(country().id, 'monarch', k.gender))} ${esc(k.name)}, age ${k.age}</span></div>
      <div class="kv"><span>You</span><span>A commoner</span></div>
      <p class="muted" style="margin-top:8px">The famous, the wealthy and the successful are sometimes invited to the palace, where unmarried royals are to be met.${m.honours ? ' The crown also honours people who give a great deal to the country.' : ''}</p></div>`;
  }
  const inFamily = ROYAL_RANKS.includes(r.rank);
  const pay = crown.allowance();
  const rows = [['Title', crown.standing(p)], ['How you came by it', { birth: 'By birth', marriage: 'By marriage', honour: 'Given by the crown' }[r.by]]];
  if (r.line && r.rank !== 'monarch') rows.push(['Place in line to the throne', String(r.line)]);
  if (pay && p.age >= 18) rows.push(['Allowance from the crown', `${fmtMoney(pay, country())} a year`]);
  if (inFamily) rows.push(['Home', 'A royal residence, rent free']);
  if (r.countryId !== country().id) rows.push(['Held in', theCountry(COUNTRIES[r.countryId].name)]);
  return `<div class="card"><h3>${inFamily ? 'Royal life' : 'Your title'}</h3>
    ${rows.map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('')}
    ${inFamily ? `<div style="margin-top:10px">${meterHtml('Public image', r.image, true)}</div>
      <p class="muted" style="margin-top:6px">The public finds you ${mood(r.image)}. Duties raise their opinion; scandal, idleness and crime sink it. Fall too far and the palace will remove you.</p>` : ''}
    <div class="btn-stack" style="margin-top:10px">
      ${crown.canDoDuties() && inFamily ? `<button class="btn" data-duties>Public duties <small>${crown.dutiesLeft()} left this year</small></button>` : ''}
      ${p.age >= 18 && !r.waiting ? `<button class="btn" data-renounce>${r.rank === 'monarch' && r.reigning ? 'Abdicate' : inFamily ? 'Step back from royal life' : 'Give up the title'}</button>` : ''}
    </div></div>`;
}

/** Wires the card's buttons. Call after the Self tab has drawn it. */
export function bindRoyalCard(el, api) {
  const duties = el.querySelector('[data-duties]');
  if (duties) duties.onclick = () => openDuties(api);
  const out = el.querySelector('[data-renounce]');
  if (out) out.onclick = () => openRenounce(api);
}

async function openDuties(api) {
  const c = country();
  if (crown.dutiesLeft() <= 0) return messageModal({ body: 'Your diary is full for the year.' });
  const pick = await pickModal({
    title: 'Public duties',
    body: `You can carry out ${crown.dutiesLeft()} more this year. Do none, and it will be noticed.`,
    options: crown.dutyOptions().map((d) => ({ value: d.id, label: d.name,
      sub: d.risky ? 'It could go very well or very badly. Charm and wits help.' : d.cost ? `Costs ${fmtMoney(d.cost, c)} of your own money.` : '' })),
  });
  if (!pick) return undefined;
  const r = crown.doDuty(pick);
  api.changed();
  return messageModal({ body: r.text, tone: r.tone });
}

async function openRenounce(api) {
  const r = player().royal;
  const monarch = r.rank === 'monarch' && r.reigning;
  const sure = await confirmModal({
    title: monarch ? 'Abdicate the throne?' : 'Give it all up?',
    body: `${monarch ? 'The crown will pass to someone else.' : 'You will be a private citizen.'} The allowance${ROYAL_RANKS.includes(r.rank) ? ' and the residence go' : ' goes'} with it, and it cannot be undone.`,
    yes: monarch ? 'Abdicate' : 'Give it up', danger: true,
  });
  if (!sure) return undefined;
  const res = crown.renounce();
  api.changed();
  return messageModal({ body: res.text, tone: res.tone });
}
