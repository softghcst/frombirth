// Screens for royalty and nobility: the card on the Self tab, public duties,
// and giving up a title. The rules live in engine/royalty.js.
import { store, player, country } from '../state.js';
import { esc, fmtMoney, theCountry } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { ROYAL_RANKS } from '../data/royalty.js';
import * as crown from '../engine/royalty.js';
import { meterHtml } from './meter.js';
import { messageModal, pickModal, confirmModal } from './modals.js';
import { openDynasty } from './dynasty.js';
import * as dyn from '../engine/dynasty.js';
import * as fame from '../engine/reputation.js';
import * as throne from '../engine/reign.js';
import { MONARCHIES } from '../data/royalty.js';
import { openModal } from './modals.js';

const mood = (v) => (v >= 80 ? 'adored' : v >= 62 ? 'well liked' : v >= 45 ? 'tolerated' : v >= 28 ? 'unpopular' : 'in disgrace');

/** The card on the Self tab. Empty for a commoner in a country without a crown. */
export function royalCard() {
  const p = player();
  const r = p.royal;
  const m = crown.monarchy();
  if (!r) {
    const fallen = !m && MONARCHIES[country().id] ? dyn.house() : null;
    const far = !fallen && p.flags.formerRoyal ? store.state.dynasties?.[p.flags.formerRoyal.countryId] : null;
    const gone = fallen ?? far;
    if (gone && throne.abolished(gone)) {
      const head = dyn.monarchOf(gone);
      return `<div class="card"><h3>The former royal house</h3>
        <div class="kv"><span>The house</span><span>${esc(gone.name)}</span></div>
        <div class="kv"><span>The monarchy</span><span>Abolished in ${gone.abolishedYear}</span></div>
        <div class="kv"><span>Head of the house</span><span>${head.isPlayer ? 'You' : `${esc(head.name)}, age ${dyn.ageOf(head)}`}</span></div>
        ${p.flags.formerRoyal ? `<div class="kv"><span>You</span><span>${p.flags.exile ? 'In exile' : 'A private citizen, once royal'}</span></div>` : ''}
        <p class="muted" style="margin-top:8px">The titles are gone and the palaces belong to the state. The family, and its history, remain. Countries have been known to ask a royal house back.</p>
        <div class="btn-stack" style="margin-top:10px"><button class="btn" data-dynasty="${gone.countryId}">The family and its history</button></div></div>`;
    }
    if (!m) return '';
    const k = crown.court().monarch;
    return `<div class="card"><h3>The crown</h3>
      <div class="kv"><span>On the throne</span><span>${esc(crown.titleOf(country().id, 'monarch', k.gender))} ${esc(k.name)}, age ${k.age}</span></div>
      <div class="kv"><span>The house</span><span>${esc(dyn.house().name)}</span></div>
      <div class="kv"><span>You</span><span>A commoner</span></div>
      <p class="muted" style="margin-top:8px">The famous, the wealthy and the successful are sometimes invited to the palace, where unmarried royals are to be met.${m.honours ? ' The crown also honours people who give a great deal to the country.' : ''}</p>
      <div class="btn-stack" style="margin-top:10px"><button class="btn" data-dynasty>The royal family and its history</button></div></div>`;
  }
  const inFamily = ROYAL_RANKS.includes(r.rank);
  const pay = crown.allowance();
  const d = inFamily ? dyn.house(r.countryId) : null;
  const mon = d ? dyn.monarchOf(d) : null;
  const rows = [['Title', crown.standing(p)], ...(d ? [['House', d.name], ...(mon && !mon.isPlayer ? [['On the throne', `${dyn.nameOf(d, mon)}, age ${dyn.ageOf(mon)}`]] : [])] : []), ['How you came by it', { birth: 'By birth', marriage: 'By marriage', honour: 'Given by the crown' }[r.by]]];
  if (r.line && r.rank !== 'monarch') rows.push(['Place in line to the throne', String(r.line)]);
  if (pay && p.age >= 18) rows.push(['Allowance from the crown', `${fmtMoney(pay, country())} a year`]);
  if (inFamily) rows.push(['Home', 'A royal residence, rent free']);
  if (d) rows.push(['The crown', throne.typeWords(d).replace(/^an? /, '').replace(/^./, (ch) => ch.toUpperCase())]);
  if (r.countryId !== country().id) rows.push(['Held in', theCountry(COUNTRIES[r.countryId].name)]);
  return `<div class="card"><h3>${inFamily ? 'Royal life' : 'Your title'}</h3>
    ${rows.map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('')}
    ${inFamily ? (() => {
    const rep = fame.summary();
    const loud = rep.stories[0];
    return `<div style="margin-top:10px">${rep.meters.map((m) => meterHtml(m.name, m.value, true)).join('')}${meterHtml('Support for the monarchy', d.standing, true)}</div>
      <p class="muted" style="margin-top:6px">${esc(rep.meters.map((m) => m.word).join('; ').replace(/^./, (c) => c.toUpperCase()))}.${loud ? ` In the newspapers: ${esc(loud.label)}, ${esc(loud.loud)}.` : ''}</p>`;
  })() : ''}
    <div class="btn-stack" style="margin-top:10px">
      ${inFamily ? '<button class="btn primary" data-dynasty>The dynasty</button><button class="btn" data-reputation>Reputation</button>' : ''}
      ${throne.canGovern() ? `<button class="btn" data-state>Affairs of state <small>${throne.powersLeft()} left this year</small></button>` : ''}
      ${crown.canDoDuties() && inFamily ? `<button class="btn" data-duties>Public duties <small>${crown.dutiesLeft()} left this year</small></button>` : ''}
      ${p.age >= 18 && !r.waiting ? `<button class="btn" data-renounce>${r.rank === 'monarch' && r.reigning ? 'Abdicate' : inFamily ? 'Step back from royal life' : 'Give up the title'}</button>` : ''}
    </div></div>`;
}

/** Wires the card's buttons. Call after the Self tab has drawn it. */
export function bindRoyalCard(el, api) {
  const book = el.querySelector('[data-dynasty]');
  if (book) book.onclick = () => openDynasty(undefined, book.dataset.dynasty || undefined);
  const stateBtn = el.querySelector('[data-state]');
  if (stateBtn) stateBtn.onclick = () => openAffairs(api);
  const repBtn = el.querySelector('[data-reputation]');
  if (repBtn) repBtn.onclick = () => openReputation();
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

/** The three reputations, what the newspapers are saying, and why each last moved. */
export function openReputation() {
  const rep = fame.summary();
  if (!rep) return;
  const sign = (n) => (n > 0 ? `+${n}` : `${n}`);
  const m = openModal(`
    <h2>Reputation</h2>
    ${rep.meters.map((x) => `${meterHtml(x.name, x.value, true)}<p class="muted" style="margin:2px 0 10px">${esc(x.word[0].toUpperCase() + x.word.slice(1))}.</p>`).join('')}
    ${(() => { const d = dyn.house(player().royal.countryId); return `${meterHtml('Support for the monarchy', d.standing, true)}<p class="muted" style="margin:2px 0 10px">${esc(throne.supportWord(d))}. If it stays very low, the country will be asked whether it wants a crown at all.</p>`; })()}
    <p class="muted">Public approval is what keeps you in royal life. The family's regard decides how much they back you, and your allowance. The press colours everything else.</p>
    <div class="section-label">In the newspapers</div>
    ${rep.stories.length ? rep.stories.map((s) => `<div class="kv"><span>${esc(s.label[0].toUpperCase() + s.label.slice(1))}${s.truth ? '' : ' <em>(untrue)</em>'}</span><span>${esc(s.loud)}</span></div>`).join('') : '<p class="muted">Nothing about you, for once.</p>'}
    <div class="section-label">What changed, and why</div>
    ${rep.why.length ? rep.why.map((w) => `<div class="kv"><span>${w.year} · ${esc(w.name)} ${sign(w.delta)}</span><span>${esc(w.text)}</span></div>`).join('') : '<p class="muted">Nothing yet.</p>'}
    <button class="btn" data-close style="margin-top:14px">Close</button>`, { dismissable: true });
  m.el.querySelector('[data-close]').addEventListener('click', () => m.close());
}

/** What a reigning monarch can do this year. */
async function openAffairs(api) {
  if (throne.powersLeft() <= 0) return messageModal({ body: 'The red boxes are done for the year.' });
  const d = dyn.house(player().royal.countryId);
  const pick = await pickModal({
    title: 'Affairs of state',
    body: `This is ${throne.typeWords(d)}. You can do ${throne.powersLeft()} more ${throne.powersLeft() === 1 ? 'thing' : 'things'} this year.`,
    options: throne.powerOptions().map((x) => ({ value: x.id, label: x.name, sub: x.note })),
  });
  if (!pick) return undefined;
  if (pick === 'assembly' || pick === 'refuse' || pick === 'silence') {
    const sure = await confirmModal({ title: 'Are you certain?', body: pick === 'assembly' ? 'You will reign, and no longer rule. It cannot be undone.' : pick === 'refuse' ? 'If the country does not back you, the crown itself will be in question.' : 'It will be remembered for as long as your house is.', yes: 'Do it', danger: true });
    if (!sure) return undefined;
  }
  const r = throne.usePower(pick);
  api.changed();
  return messageModal({ body: r.text, tone: r.tone });
}
