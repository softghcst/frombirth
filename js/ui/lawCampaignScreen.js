// The campaign trail for an elected legal office, as a screen of its own (engine/lawCampaign.js): where the race
// stands, drawn as bars; what can be done this stretch, grouped; the debate; election day.
import { esc, fmtMoney } from '../util.js';
import { country } from '../state.js';
import { openModal, pickModal, messageModal, confirmModal } from './modals.js';
import { fitBars } from './fitBars.js';
import * as camp from '../engine/lawCampaign.js';

const kv = (a, b) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`;
const btn = (label, attrs, cls = '') => `<button type="button" class="btn ${cls}" ${attrs}>${esc(label)}</button>`;
const row = (attrs, title, sub = '') => `<button type="button" class="tree-row law-row" ${attrs}><strong>${esc(title)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
const card = (title, body) => `<div class="card"><h3>${esc(title)}</h3>${body}</div>`;
const say = (r) => messageModal({ title: r.title, body: r.text, tone: r.tone });

const GROUPS = [
  ['Money', ['committee', 'ask', 'big_donor']],
  ['Voters', ['town_hall', 'endorse_bar', 'endorse_paper', 'endorse_police', 'endorse_reform']],
  ['Your Message', ['ad_record', 'ad_views', 'ad_promise']],
  ['Your Opponent', ['respond', 'attack_fair', 'attack_false']],
];

function body() {
  const c = camp.campaignOf();
  if (!c) return '<p class="empty">You are not running for anything.</p>';
  const steps = ['Stretch 1', 'Stretch 2 · Debate', 'Stretch 3', 'Election Day'];
  const strip = `<div class="chips camp-steps">${steps.map((s, i) => `<span class="av-chip ${i + 1 === c.round ? 'on' : ''} ${i + 1 < c.round ? 'done' : ''}">${esc(s)}</span>`).join('')}</div>`;
  const now = c.polls[c.polls.length - 1] ?? camp.poll();
  const rival = c.rival ?? 'Your Opponent';
  const polls = card(c.polls.length ? 'The Latest Poll' : 'Where the Race Starts', `${fitBars({ you: now.you, need: now.rival, youLabel: 'You', needLabel: rival })}
    ${kv('Campaign fund', fmtMoney(c.fund, country()))}${c.endorsed.length ? kv('Endorsed by', String(c.endorsed.length)) : ''}`);
  const moves = (c.rivalMoves ?? []).length ? card(`What ${rival} Did`, c.rivalMoves.slice().reverse().map((m) => `<p class="muted">${esc(m.text)}</p>`).join('')) : '';
  const rules = camp.rulesNow();
  const rulesCard = rules ? card('The Rules for Judges', `<p class="muted">A judge must be fair to everyone who comes to court, so judicial candidates campaign under limits.</p>
    ${rules.laws.slice(0, 3).map((l) => `<p class="muted"><strong>${esc(l.name)}</strong>: ${esc(l.summary)}</p>`).join('')}`) : '';
  if (c.round > camp.ROUNDS) return `${strip}${polls}${moves}<div class="btn-row">${btn('Election Day', 'data-campvote', 'primary')}</div>`;
  const acts = camp.actions();
  const byId = Object.fromEntries(acts.map((a) => [a.id, a]));
  const left = camp.ACTS_PER_ROUND - c.used.filter((u) => u.startsWith(`${c.round}:`)).length;
  const groups = GROUPS.map(([name, ids]) => {
    const rows = ids.map((id) => byId[id]).filter(Boolean).map((a) => row(`data-camp="${a.id}" ${a.why ? 'disabled' : ''}`, a.name, a.why || a.sub)).join('');
    return rows ? `<div class="section-label">${esc(name)}</div>${rows}` : '';
  }).join('');
  const next = c.round === 2 && !c.debated ? btn('The Debate', 'data-campdebate', 'primary') : btn(c.round === camp.ROUNDS ? 'Finish the Campaign' : 'Next Stretch', 'data-campnext', 'primary');
  return `${strip}${polls}${card('This Stretch', `<p class="muted">${left > 0 ? `${left === 1 ? 'One more thing' : 'Two things'} you can do before moving on.` : 'You have done what you can. Move on when ready.'}</p>${groups}`)}${moves}${rulesCard}
    <div class="btn-row">${next}${btn('Withdraw', 'data-campquit')}</div>`;
}

/** Opens the campaign. `api.changed` is called after anything that changes the game. */
export function openCampaign(api = {}) {
  const m = openModal('<div class="law-hub law-campaign"></div>', { dismissable: true });
  const host = m.el.querySelector('.law-campaign');
  const draw = () => {
    const c = camp.campaignOf();
    host.innerHTML = `<div class="eyebrow">On the campaign trail</div><h2>${esc(c ? `Running for ${c.title}` : 'The Campaign')}</h2>${body()}`;
  };
  const changed = () => { api.changed?.(); draw(); };
  m.el.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t || t.disabled) return undefined;
    if (t.dataset.camp) { await say(camp.act(t.dataset.camp)); return changed(); }
    if (t.hasAttribute('data-campdebate')) {
      const a = await pickModal({ title: 'The Debate', body: 'The moderator turns to you. How do you answer?', options: camp.DEBATE.map(([l, v]) => ({ value: v, label: l })) });
      if (a) await say(camp.debate(a));
      return changed();
    }
    if (t.hasAttribute('data-campnext')) { await say(camp.nextRound()); return changed(); }
    if (t.hasAttribute('data-campvote')) { await say(camp.pollingDay()); api.changed?.(); m.close?.(); return undefined; }
    if (t.hasAttribute('data-campquit')) {
      if (await confirmModal({ title: 'Withdraw?', body: 'The filing fee is not refunded.', yes: 'Withdraw', no: 'Keep Running' })) { await say(camp.withdraw()); api.changed?.(); m.close?.(); return undefined; }
      return undefined;
    }
    return undefined;
  });
  draw();
  return m;
}
