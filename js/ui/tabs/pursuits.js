// Pursuits tab: gambling, crime, and, when it goes wrong, life inside.
// Health, travel, nightlife and social media arrive in Phase 8.
import { store, player, country } from '../../state.js';
import { esc, fmtMoney } from '../../util.js';
import { canGamble, GAMBLING_AGE } from '../../engine/gambling.js';
import * as law from '../../engine/justice.js';
import * as jail from '../../engine/prison.js';
import { CRIME_BY_ID, LIFE_SENTENCE } from '../../data/crimes.js';
import { playBlackjack, playHorses, playLottery } from '../minigames/casino.js';
import { playEscape } from '../minigames/escape.js';
import { meterHtml } from '../meter.js';
import { messageModal, pickModal, confirmModal } from '../modals.js';

async function report(api, r) {
  api.changed();
  await messageModal({ body: r.text, tone: r.tone });
}

async function commitCrime(api) {
  const id = await pickModal({
    title: 'Crime',
    body: 'Talent, brains and luck decide whether it works. Every crime wears your luck thinner and brings the police closer.',
    options: law.crimeOptions().map((c) => ({ value: c.id, label: c.name, sub: `Your chances: ${c.odds}. ${c.stakes}` })),
  });
  if (!id) return;
  let targetId;
  if (CRIME_BY_ID[id].target) {
    targetId = await pickModal({
      title: 'Who?',
      options: law.targets().map((n) => ({ value: n.id, label: `${n.firstName} ${n.lastName}`, sub: `Age ${n.age}` })),
    });
    if (!targetId) return;
  }
  const sure = await confirmModal({ title: `${CRIME_BY_ID[id].name}?`, body: 'There is no taking this back.', yes: 'Do it', danger: true });
  if (!sure) return;
  const r = law.commitCrime(id, targetId);
  await report(api, r);
  if (r.arrested) await api.justice();
}

async function joinGang(api) {
  const id = await pickModal({
    title: 'Join a gang',
    body: `Protection and standing, at the cost of your record inside. Your respect is ${Math.round(jail.cell().respect)}%.`,
    options: jail.gangOptions().map((g) => ({ value: g.id, label: g.name, disabled: !g.open,
      sub: g.open ? g.blurb : `${g.blurb} Needs ${g.respect}% respect.` })),
  });
  if (id) await report(api, jail.joinGang(id));
}

async function escape(api) {
  const sure = await confirmModal({
    title: 'Attempt an escape?',
    body: 'One attempt a year. Fail and you get two more years and a spell in solitary. Succeed and you are free, and hunted.',
    yes: 'Go tonight', danger: true,
  });
  if (!sure) return;
  const layout = jail.escapeLayout();
  if (!jail.beginEscape()) { await messageModal({ body: 'The guards are watching you too closely this year.' }); return; }
  api.changed();
  const out = await playEscape(layout);
  await report(api, jail.finishEscape(out));
}

function prisonCard() {
  const k = jail.cell();
  const g = jail.gang();
  const term = k.yearsLeft >= LIFE_SENTENCE ? 'Life' : `${k.yearsLeft} year${k.yearsLeft === 1 ? '' : 's'}`;
  const where = k.facility === 'juvenile' ? 'Juvenile detention'
    : `${{ min: 'Minimum', med: 'Medium', max: 'Maximum' }[k.security]}-security prison`;
  return `
    <div class="card"><h3>${esc(where)}</h3>
      <div class="kv"><span>Left to serve</span><span>${esc(term)}</span></div>
      <div class="kv"><span>Served</span><span>${k.served} year${k.served === 1 ? '' : 's'}</span></div>
      ${k.facility === 'prison' ? `<div class="kv"><span>Gang</span><span>${esc(g?.name ?? 'None')}</span></div>` : ''}
      <div style="margin-top:10px">${meterHtml('Respect', k.respect, true)}${meterHtml('Conduct', k.conduct, true)}</div>
      <p class="muted" style="margin-top:8px">Respect keeps you safe inside. Good conduct gets you parole.</p>
    </div>
    <div class="btn-stack">
      ${jail.prisonActions().map((a) => `<button class="btn ${a.danger ? 'danger' : ''}" data-prison="${a.id}">${esc(a.label)}</button>`).join('')}
    </div>`;
}

export default {
  id: 'pursuits', title: 'Pursuits', short: 'Pursuits',
  icon: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  render(el, api) {
    const p = player();
    const c = country();
    if (law.isJailed()) {
      el.innerHTML = prisonCard();
    } else {
      const gambled = p.counters.gambled * c.currency.scale;
      const record = p.legal.record.filter((r) => r.convicted);
      el.innerHTML = `
        <div class="card"><h3>Gambling</h3>
          ${canGamble()
    ? `<p class="muted" style="margin-bottom:10px">The house always has an edge. Stakes leave your account the moment you place them.</p>
             <div class="btn-stack">
               <button class="btn" data-play="blackjack">Blackjack</button>
               <button class="btn" data-play="horses">The races</button>
               <button class="btn" data-play="lottery">Lottery tickets</button>
             </div>
             ${gambled ? `<div class="kv" style="margin-top:10px"><span>Staked in your lifetime</span><span>${esc(fmtMoney(gambled, c))}</span></div>` : ''}`
    : `<p class="muted">You have to be ${GAMBLING_AGE} to gamble.</p>`}
        </div>
        ${law.canCommitCrimes() ? `<div class="card"><h3>Crime</h3>
          <div class="kv"><span>Police attention</span><span>${p.legal.heat >= 60 ? 'They are looking for you' : p.legal.heat >= 25 ? 'You are known to them' : 'None'}</span></div>
          ${record.length ? `<div class="kv"><span>Convictions</span><span>${record.length}</span></div>` : ''}
          ${p.flags.fugitive ? '<div class="kv"><span>Status</span><span>On the run</span></div>' : ''}
          <button class="btn danger" data-crime style="margin-top:10px">Commit a crime</button>
        </div>` : ''}
        <div class="card"><h3>Online</h3>
          <div class="kv"><span>Followers</span><span>${p.social.followers.toLocaleString('en-US')}</span></div>
        </div>`;
    }
    el.onclick = (e) => {
      const game = e.target.closest('[data-play]')?.dataset.play;
      if (game) return ({ blackjack: playBlackjack, horses: playHorses, lottery: playLottery })[game](api);
      if (e.target.closest('[data-crime]')) return commitCrime(api);
      const act = e.target.closest('[data-prison]')?.dataset.prison;
      if (!act) return undefined;
      if (act === 'gang') return joinGang(api);
      if (act === 'escape') return escape(api);
      const run = { workout: jail.workOut, read: jail.read, job: jail.prisonJob, leaveGang: jail.leaveGang,
        riot: jail.startRiot, appeal: jail.appeal }[act];
      return report(api, run()).then(() => { if (!store.state.player.alive) api.changed(); });
    };
  },
};
